require("./env");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const XLSX = require("xlsx");
const prisma = require("./prisma");
const { sendWelcomeEmail } = require("./email");
const {
  DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES,
  normalizeHexIdentifier,
  normalizeCNumber,
  parseLocationCoordinates,
  validateAssetIdentifiers,
  validateOrganisationAssetValidationPayload,
} = require("./asset-validation");

// Prisma returns JS enum names which may use underscores. Serialize on the way out.
function serializePermission(p) {
  if (!p) return p;
  return p.replace(/_/g, " ");
}

// BigInt JSON serialization support
// Prisma returns BigInt for BIGSERIAL columns; JSON.stringify does not handle BigInt natively.
const origStringify = JSON.stringify;
// Monkey-patch res.json to handle BigInt by converting to string before serializing.
// We do this via a replacer on Express's json() middleware instead.
const app = express();

const PORT = Number(process.env.PORT || 5001);
const JWT_SECRET = process.env.JWT_SECRET;
const MOBILE_API_KEY = process.env.MOBILE_API_KEY;

if (!prisma?.fridgeImage?.create) {
  console.warn(
    "[asset-manager] Prisma client is missing fridgeImage delegate. Run `npx prisma generate` in operations-api to enable image persistence.",
  );
}

if (!JWT_SECRET || !MOBILE_API_KEY) {
  console.error("FATAL: JWT_SECRET and MOBILE_API_KEY must be set in operations-api/.env");
  process.exit(1);
}

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!allowedOrigins.length) {
  allowedOrigins.push("http://localhost:5173", "http://127.0.0.1:5173");
}

const localDevOriginRegex = /^https?:\/\/(localhost|127\.0\.0\.1):(\d{2,5})$/i;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (localDevOriginRegex.test(origin)) return callback(null, true);
      return callback(new Error(`CORS not allowed for origin: ${origin}`));
    },
  }),
);

app.use(express.json());

// Override res.json to serialize BigInt values as strings
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const safeBody = JSON.parse(JSON.stringify(body, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ));
    return originalJson(safeBody);
  };
  next();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted'));
    }
  },
});

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const name = String(file.originalname || "").toLowerCase();
    const hasValidExtension = /\.(csv|xlsx|xls)$/i.test(name);
    const allowedMimeTypes = new Set([
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroenabled.12",
    ]);

    if (allowedMimeTypes.has(mime) || hasValidExtension) {
      cb(null, true);
      return;
    }

    cb(new Error("Only CSV and Excel files are accepted"));
  },
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

const PERMISSION_FLAGS = Object.freeze([
  "users.manage",
  "users.view",
  "assets.create",
  "assets.edit",
  "assets.delete",
  "assets.view",
  "mismatches.resolve",
  "mismatches.delete",
  "mismatches.view",
  "history.view",
  "device_checker.submit",
  "placement.submit",
]);

const PERMISSION_POLICY = Object.freeze({
  Admin: {
    inherits: [],
    grants: [...PERMISSION_FLAGS],
  },
  Advanced: {
    inherits: [],
    grants: [
      "users.manage",
      "users.view",
      "assets.create",
      "assets.edit",
      "assets.delete",
      "assets.view",
      "mismatches.resolve",
      "mismatches.delete",
      "mismatches.view",
      "history.view",
      "device_checker.submit",
      "placement.submit",
    ],
  },
  Intermediate: {
    inherits: [],
    grants: [
      "mismatches.view",
      "device_checker.submit",
      "placement.submit",
    ],
  },
  Basic: {
    inherits: [],
    grants: [
      "assets.view",
      "mismatches.view",
      "history.view",
    ],
  },
});

const USER_PERMISSION_LEVELS = Object.freeze([
  "Admin",
  "Advanced",
  "Intermediate",
  "Basic",
]);

const PERMISSION_LEVEL_RANK = Object.freeze(
  USER_PERMISSION_LEVELS.reduce((accumulator, level, index) => {
    accumulator[level] = index;
    return accumulator;
  }, {}),
);

function getPermissionLevelRank(level) {
  if (typeof level !== "string") {
    return Number.POSITIVE_INFINITY;
  }
  return Object.prototype.hasOwnProperty.call(PERMISSION_LEVEL_RANK, level)
    ? PERMISSION_LEVEL_RANK[level]
    : Number.POSITIVE_INFINITY;
}

function canTargetRole(actorLevel, targetLevel) {
  return getPermissionLevelRank(targetLevel) >= getPermissionLevelRank(actorLevel);
}

function resolvePermissionGrants(level, visited = new Set()) {
  if (!level || visited.has(level)) {
    return new Set();
  }

  const policy = PERMISSION_POLICY[level];
  if (!policy) {
    return new Set();
  }

  visited.add(level);
  const grants = new Set(policy.grants || []);

  for (const inheritedLevel of policy.inherits || []) {
    const inheritedGrants = resolvePermissionGrants(inheritedLevel, visited);
    inheritedGrants.forEach((grant) => grants.add(grant));
  }

  return grants;
}

function hasUserPermission(user, flag) {
  if (!user || !flag || !PERMISSION_FLAGS.includes(flag)) {
    return false;
  }
  return resolvePermissionGrants(user.permissions).has(flag);
}

function requirePermission(flag) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    if (!hasUserPermission(req.user, flag)) {
      return res.status(403).json({ error: `Permission required: ${flag}` });
    }

    return next();
  };
}

function requireAnyPermission(flags) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Missing user context" });
    }

    const permitted = (flags || []).some((flag) => hasUserPermission(req.user, flag));
    if (!permitted) {
      return res.status(403).json({ error: `Any of these permissions required: ${(flags || []).join(", ")}` });
    }

    return next();
  };
}

function requireMobileKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== MOBILE_API_KEY) {
    return res.status(401).json({ error: "Invalid mobile api key" });
  }
  return next();
}

function normalizePermission(value) {
  const permission = String(value || "").trim().toLowerCase();
  const compactPermission = permission.replace(/[\s_-]+/g, "");

  if (compactPermission === "admin") return "Admin";
  if (compactPermission === "advanced" || compactPermission === "fleetmanager") return "Advanced";
  if (compactPermission === "intermediate" || compactPermission === "technician") return "Intermediate";
  if (compactPermission === "basic" || compactPermission === "user" || compactPermission === "users") return "Basic";

  return null;
}

async function getUserOrganisationId(tx, userId) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { organisationId: true },
  });

  if (!user) {
    return null;
  }

  return user.organisationId ?? null;
}

function parseRequestedOrganisationId(rawValue) {
  if (rawValue == null) return null;
  const raw = String(rawValue).trim().toLowerCase();
  if (!raw || raw === "all") {
    return null;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error("Invalid organisation_id filter.");
    error.code = "INVALID_ORGANISATION_FILTER";
    throw error;
  }

  return value;
}

async function resolveOrganisationScope(tx, user, requestedOrganisationIdRaw) {
  const requestedOrganisationId = parseRequestedOrganisationId(requestedOrganisationIdRaw);
  const isAdmin = user?.permissions === "Admin";
  const userOrganisationId = await getUserOrganisationId(tx, user.id);

  if (!isAdmin && !userOrganisationId) {
    const error = new Error("User organisation is not configured.");
    error.code = "USER_ORGANISATION_REQUIRED";
    throw error;
  }

  return {
    isAdmin,
    userOrganisationId,
    requestedOrganisationId,
    effectiveOrganisationId: isAdmin ? requestedOrganisationId : userOrganisationId,
  };
}

async function resolveOrganisationMutationScope(
  tx,
  user,
  requestedOrganisationIdRaw,
  options = {},
) {
  const { requireExisting = false } = options;
  const scope = await resolveOrganisationScope(tx, user, requestedOrganisationIdRaw);

  if (!scope.isAdmin) {
    return scope;
  }

  const effectiveOrganisationId = scope.requestedOrganisationId ?? scope.userOrganisationId;
  if (!effectiveOrganisationId) {
    const error = new Error("User organisation is not configured.");
    error.code = "USER_ORGANISATION_REQUIRED";
    throw error;
  }

  if (requireExisting) {
    const organisation = await tx.organisation.findUnique({
      where: { id: effectiveOrganisationId },
      select: { id: true },
    });
    if (!organisation) {
      const error = new Error("Organisation not found.");
      error.code = "ORGANISATION_NOT_FOUND";
      throw error;
    }
  }

  return {
    ...scope,
    effectiveOrganisationId,
  };
}

function canManageOrganisationAssetValidation(user) {
  return user?.permissions === "Admin" || user?.permissions === "Advanced";
}

function requireOrganisationAssetValidationEditor(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Missing user context" });
  }

  if (!canManageOrganisationAssetValidation(req.user)) {
    return res.status(403).json({ error: "Only Admin and Advanced can manage organisation asset validation rules." });
  }

  return next();
}

async function ensureOrganisationAssetValidationRules(tx, organisationId) {
  await tx.organisationAssetValidationRules.upsert({
    where: { organisationId },
    update: {},
    create: {
      organisationId,
      serialMinLength: DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES.serial_min_length,
      serialMaxLength: DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES.serial_max_length,
      macMinLength: DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES.mac_min_length,
      macMaxLength: DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES.mac_max_length,
      cNumberMinLength: DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES.c_number_min_length,
      cNumberMaxLength: DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES.c_number_max_length,
    },
  });
}

async function getOrganisationAssetValidationRules(tx, organisationId) {
  if (!organisationId) {
    const error = new Error("Organisation is not configured.");
    error.code = "USER_ORGANISATION_REQUIRED";
    throw error;
  }

  await ensureOrganisationAssetValidationRules(tx, organisationId);

  const rules = await tx.organisationAssetValidationRules.findUnique({
    where: { organisationId },
  });

  if (!rules) {
    const error = new Error("Organisation asset validation rules not found.");
    error.code = "ORGANISATION_ASSET_VALIDATION_RULES_NOT_FOUND";
    throw error;
  }

  // Return in the snake_case shape that the rest of the code expects
  return {
    organisation_id: rules.organisationId,
    serial_min_length: rules.serialMinLength,
    serial_max_length: rules.serialMaxLength,
    mac_min_length: rules.macMinLength,
    mac_max_length: rules.macMaxLength,
    c_number_min_length: rules.cNumberMinLength,
    c_number_max_length: rules.cNumberMaxLength,
  };
}

async function resolveOrganisationAssetValidationScope(tx, user, requestedOrganisationIdRaw) {
  const requestedOrganisationId = parseRequestedOrganisationId(requestedOrganisationIdRaw);
  const userOrganisationId = await getUserOrganisationId(tx, user.id);

  if (user?.permissions === "Admin") {
    const targetOrganisationId = requestedOrganisationId ?? userOrganisationId;
    if (!targetOrganisationId) {
      const error = new Error("organisation_id is required for this admin account.");
      error.code = "ORGANISATION_ID_REQUIRED";
      throw error;
    }

    const org = await tx.organisation.findUnique({
      where: { id: targetOrganisationId },
      select: { id: true },
    });
    if (!org) {
      const error = new Error("Organisation not found.");
      error.code = "ORGANISATION_NOT_FOUND";
      throw error;
    }

    return targetOrganisationId;
  }

  if (!userOrganisationId) {
    const error = new Error("User organisation is not configured.");
    error.code = "USER_ORGANISATION_REQUIRED";
    throw error;
  }

  if (requestedOrganisationId && requestedOrganisationId !== userOrganisationId) {
    const error = new Error("You can only manage asset validation rules for your organisation.");
    error.code = "FORBIDDEN_ORGANISATION_SCOPE";
    throw error;
  }

  return userOrganisationId;
}

function formatValidationErrors(errors) {
  return Object.entries(errors).map(([field, message]) => ({ field, message }));
}

function buildValidationErrorResponse(errors) {
  const fieldErrors = formatValidationErrors(errors);
  return {
    error: fieldErrors[0]?.message || "Validation failed.",
    fieldErrors,
  };
}

function parseNullableCoordinate(value) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeFridgeRow(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    latitude: parseNullableCoordinate(row.latitude),
    longitude: parseNullableCoordinate(row.longitude),
  };
}

function serializeMismatchRow(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    latitude: parseNullableCoordinate(row.latitude),
    longitude: parseNullableCoordinate(row.longitude),
  };
}

// Convert a Prisma fridge object to the snake_case shape the API returns
function fridgePrismaToRow(fridge) {
  if (!fridge) return fridge;
  return {
    fridge_serial_number: fridge.fridgeSerialNumber,
    iot_mac_address: fridge.iotMacAddress,
    c_number: fridge.cNumber,
    verified: fridge.verified,
    verified_at: fridge.verifiedAt,
    organisation_id: fridge.organisationId,
    latitude: fridge.latitude,
    longitude: fridge.longitude,
  };
}

// Convert a Prisma mismatch object to the snake_case shape the API returns
function mismatchPrismaToRow(mismatch) {
  if (!mismatch) return mismatch;
  return {
    id: mismatch.id,
    received_at: mismatch.receivedAt,
    fridge_serial_number: mismatch.fridgeSerialNumber,
    received_mac: mismatch.receivedMac,
    received_c_number: mismatch.receivedCNumber,
    db_mac: mismatch.dbMac,
    db_c_number: mismatch.dbCNumber,
    status: mismatch.status,
    resolved_at: mismatch.resolvedAt,
    resolved_by: mismatch.resolvedBy,
    resolution_note: mismatch.resolutionNote,
    sender_id: mismatch.senderId,
    latitude: mismatch.latitude,
    longitude: mismatch.longitude,
  };
}

function logAssetAction(action, details = "") {
  const suffix = details ? ` ${details}` : "";
  console.log(`[asset-manager] ${action}${suffix}`);
}

function handleAssetError(res, action, error) {
  const message = error?.message || "Unknown error";
  const code = error?.code ? ` code=${error.code}` : "";
  const detail = error?.detail ? ` detail=${error.detail}` : "";
  console.error(`[asset-manager] ${action} failed: ${message}${code}${detail}`);
  return res.status(500).json({ error: `${action} failed: ${message}` });
}

function pickColumn(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value != null && String(value).trim() !== "") {
        return String(value);
      }
    }
  }
  return "";
}

function normalizeHeaderKey(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function normalizeRowKeys(row) {
  const normalized = {};
  for (const key of Object.keys(row || {})) {
    normalized[normalizeHeaderKey(key)] = row[key];
  }
  return normalized;
}

function sanitizeBulkSerial(value) {
  return normalizeHexIdentifier(value);
}

function sanitizeBulkMac(value) {
  const cleaned = normalizeHexIdentifier(value);
  return cleaned || null;
}

function sanitizeBulkCNumber(value) {
  const cleaned = normalizeCNumber(value);
  return cleaned || null;
}

function getRequestDurationMs(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  let logged = false;

  console.info(`[operations-api] ${req.method} ${req.originalUrl} started`);

  const writeLog = (event) => {
    if (logged) {
      return;
    }

    logged = true;

    const durationMs = getRequestDurationMs(startedAt).toFixed(1);
    const actor = req.user?.id || "anonymous";
    const suffix = event === "close" && !res.writableEnded ? " connection=closed" : "";
    const message = `[operations-api] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${durationMs}ms actor=${actor} ip=${req.ip}${suffix}`;

    if (res.statusCode >= 500) {
      console.error(message);
      return;
    }

    if (res.statusCode >= 400) {
      console.warn(message);
      return;
    }

    console.info(message);
  };

  res.on("finish", () => writeLog("finish"));
  res.on("close", () => writeLog("close"));

  next();
});

function parseUploadedSheetRows(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    return { firstSheet: "", rows: [] };
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "", raw: false });
  return { firstSheet, rows };
}

function buildBulkRows(parsedRows) {
  const preparedRows = [];
  let excludedRows = 0;

  parsedRows.forEach((rawRow, idx) => {
    const row = rawRow && typeof rawRow === "object" ? normalizeRowKeys(rawRow) : {};
    const rowNumber = idx + 2;

    const serialRaw = pickColumn(row, [
      "fridgeserialnumber",
      "fridgeserial",
      "serial",
      "serialnumber",
      "assetserial",
      "fridge_serial_number",
    ]);
    const macRaw = pickColumn(row, ["macaddress", "iotmacaddress", "mac", "devicemac", "mac_address"]);
    const cRaw = pickColumn(row, ["cnumber", "cnum", "customernumber", "c_number"]);

    const fridge_serial_number = sanitizeBulkSerial(serialRaw);
    if (!fridge_serial_number) {
      excludedRows += 1;
      return;
    }

    preparedRows.push({
      rowNumber,
      fridge_serial_number,
      mac_address: sanitizeBulkMac(macRaw),
      c_number: sanitizeBulkCNumber(cRaw),
    });
  });

  return { preparedRows, excludedRows };
}

function buildSkippedDuplicateReportRow(row, existingRow, message) {
  return {
    rowNumber: row.rowNumber,
    serial: row.fridge_serial_number,
    reason: "DUPLICATE_IN_DB",
    message,
    upload_mac_address: row.mac_address || null,
    upload_c_number: row.c_number || null,
    db_serial: existingRow?.fridge_serial_number || existingRow?.fridgeSerialNumber || null,
    db_mac_address: existingRow?.iot_mac_address || existingRow?.iotMacAddress || null,
    db_c_number: existingRow?.c_number || existingRow?.cNumber || null,
  };
}

// ---------------------------------------------------------------------------
// Audit log helpers
// ---------------------------------------------------------------------------

async function buildMismatchNoteMap(logs) {
  const ids = [...new Set(
    logs.filter((l) => l.mismatchId != null).map((l) => l.mismatchId),
  )];
  if (!ids.length) return {};
  const mismatches = await prisma.fridgeMismatch.findMany({
    where: { id: { in: ids } },
    select: { id: true, resolutionNote: true },
  });
  return Object.fromEntries(mismatches.map((m) => [String(m.id), m.resolutionNote ?? null]));
}

function extractDeletionReasonFromMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const metadataRecord = metadata;
  const snakeCaseReason = metadataRecord.deletion_reason;
  if (typeof snakeCaseReason === "string" && snakeCaseReason.trim()) {
    return snakeCaseReason;
  }

  const camelCaseReason = metadataRecord.deletionReason;
  if (typeof camelCaseReason === "string" && camelCaseReason.trim()) {
    return camelCaseReason;
  }

  return null;
}

function resolveDeletionReason(log) {
  if (typeof log?.deletionReason === "string" && log.deletionReason.trim()) {
    return log.deletionReason;
  }
  return extractDeletionReasonFromMetadata(log?.metadata);
}

function isMissingDeletionReasonColumnError(error) {
  const dbCode = String(error?.meta?.code || error?.code || "");
  if (dbCode === "42703") {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return message.includes("deletion_reason") && message.includes("does not exist");
}

async function writeDeleteReasonToAuditLog(tx, fridgeSerialNumber, deletionReason) {
  const reason = typeof deletionReason === "string" ? deletionReason.trim() : "";
  if (!reason) {
    return;
  }

  try {
    await tx.$executeRaw`
      UPDATE frostlink.fridge_audit_log
      SET deletion_reason = ${reason}
      WHERE fridge_serial_number = ${fridgeSerialNumber}
        AND action_type = 'DELETE'
        AND deletion_reason IS NULL
    `;
  } catch (error) {
    if (!isMissingDeletionReasonColumnError(error)) {
      throw error;
    }

    await tx.$executeRaw`
      UPDATE frostlink.fridge_audit_log
      SET metadata = CASE
        WHEN metadata IS NULL THEN jsonb_build_object('deletion_reason', ${reason})
        WHEN jsonb_typeof(metadata::jsonb) = 'object' THEN metadata::jsonb || jsonb_build_object('deletion_reason', ${reason})
        ELSE metadata::jsonb
      END
      WHERE fridge_serial_number = ${fridgeSerialNumber}
        AND action_type = 'DELETE'
        AND (
          metadata IS NULL
          OR (
            jsonb_typeof(metadata::jsonb) = 'object'
            AND NOT (metadata::jsonb ? 'deletion_reason')
          )
        )
    `;
  }
}

function serializeAuditLogRow(log, mismatchNoteMap = {}) {
  return {
    log_id: log.logId,
    fridge_serial_number: log.fridgeSerialNumber,
    source_table: log.sourceTable,
    action_type: log.actionType,
    old_mac: log.oldMac,
    new_mac: log.newMac,
    old_c_num: log.oldCNum,
    new_c_num: log.newCNum,
    mismatch_id: log.mismatchId,
    metadata: log.metadata,
    deletion_reason: resolveDeletionReason(log),
    resolution_note: log.mismatchId != null ? (mismatchNoteMap[String(log.mismatchId)] ?? null) : null,
    organisation_id: log.organisationId,
    changed_at: log.changedAt,
    changed_by: log.changedBy,
    changed_by_username: log.changedByUser?.username ?? null,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "operations-api" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "DB_UNAVAILABLE" });
  }
});

app.get("/organisations", async (_req, res) => {
  try {
    const organisations = await prisma.organisation.findMany({
      select: { id: true, name: true, domin: true },
      orderBy: { name: "asc" },
    });
    return res.json(organisations);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.post("/organisations", requireAuth, async (req, res) => {
  if (req.user?.permissions !== "Admin") {
    return res.status(403).json({ error: "Admin permission required" });
  }

  try {
    const name = String(req.body?.name || "").trim();
    const dominRaw = req.body?.domin;
    const domin = String(dominRaw == null ? "" : dominRaw).trim().toLowerCase() || null;

    if (!name) {
      return res.status(400).json({ error: "Organisation name is required" });
    }
    if (name.length > 120) {
      return res.status(400).json({ error: "Organisation name must be 120 characters or fewer" });
    }
    if (domin && domin.length > 120) {
      return res.status(400).json({ error: "Organisation domain must be 120 characters or fewer" });
    }

    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.organisation.create({
        data: { name, domin },
        select: { id: true, name: true, domin: true, createdAt: true },
      });

      await ensureOrganisationAssetValidationRules(tx, org.id);

      return org;
    });

    return res.status(201).json({
      id: created.id,
      name: created.name,
      domin: created.domin,
      created_at: created.createdAt,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Organisation name or domain already exists." });
    }
    if (error.code === "23505") {
      return res.status(409).json({ error: "Organisation name or domain already exists." });
    }
    if (error.code === "22001") {
      return res.status(400).json({ error: "Organisation name or domain is too long." });
    }
    console.error("[organisations:create] failed", {
      code: error?.code,
      detail: error?.detail,
      message: error?.message,
    });
    return res.status(500).json({ error: "Server Error" });
  }
});

app.delete("/organisations/:id", requireAuth, async (req, res) => {
  if (req.user?.permissions !== "Admin") {
    return res.status(403).json({ error: "Admin permission required" });
  }

  const organisationId = Number(req.params.id);
  if (!Number.isInteger(organisationId) || organisationId <= 0) {
    return res.status(400).json({ error: "Invalid organisation id" });
  }

  try {
    const [usersCount, fridgesCount] = await Promise.all([
      prisma.user.count({ where: { organisationId } }),
      prisma.fridge.count({ where: { organisationId } }),
    ]);

    if (usersCount > 0 || fridgesCount > 0) {
      return res.status(409).json({
        error: "Cannot delete organisation with linked users or fridges.",
        users_count: usersCount,
        fridges_count: fridgesCount,
      });
    }

    const deleted = await prisma.organisation.delete({
      where: { id: organisationId },
      select: { id: true, name: true },
    });

    return res.json({ deleted: true, organisation: deleted });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Organisation not found" });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.post("/signup", loginLimiter, async (req, res) => {
  try {
    const { username, password, full_name, permissions, organisation_id } = req.body;

    if (!username || !password || !full_name || !permissions || organisation_id == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const normalizedPermission = normalizePermission(permissions);
    if (!normalizedPermission) {
      return res.status(400).json({ error: "Invalid permissions value" });
    }

    const email = String(username).trim().toLowerCase();
    const name = String(full_name).trim();
    const organisationId = Number(organisation_id);

    if (!Number.isInteger(organisationId) || organisationId <= 0) {
      return res.status(400).json({ error: "Invalid organisation_id" });
    }

    const org = await prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { id: true },
    });

    if (!org) {
      return res.status(400).json({ error: "Organisation not found" });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);

    const createdUser = await prisma.user.create({
      data: {
        username: email,
        passwordHash,
        fullName: name,
        permissions: normalizedPermission,
        isActive: true,
        organisationId,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        permissions: true,
        organisationId: true,
      },
    });

    const token = jwt.sign(
      {
        id: createdUser.id,
        username: createdUser.username,
        permissions: serializePermission(createdUser.permissions),
      },
      JWT_SECRET,
      { expiresIn: "12h" },
    );

    return res.status(201).json({
      token,
      user: {
        id: createdUser.id,
        username: createdUser.username,
        full_name: createdUser.fullName,
        permissions: serializePermission(createdUser.permissions),
        organisation_id: createdUser.organisationId,
      },
    });
  } catch (error) {
    if (error.code === "P2002" || error.code === "23505") {
      return res.status(409).json({ error: "That email/username already exists" });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username: String(username || "").trim().toLowerCase() },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        isActive: true,
        fullName: true,
        permissions: true,
        organisationId: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "User is inactive" });
    }

    const passwordMatches = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        permissions: serializePermission(user.permissions),
      },
      JWT_SECRET,
      { expiresIn: "12h" },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.fullName,
        permissions: serializePermission(user.permissions),
        organisation_id: user.organisationId,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        firstName: true,
        lastName: true,
        permissions: true,
        organisationId: true,
        organisation: {
          select: { name: true, domin: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({
      id: user.id,
      username: user.username,
      full_name: user.fullName,
      first_name: user.firstName,
      last_name: user.lastName,
      permissions: serializePermission(user.permissions),
      organisation_id: user.organisationId,
      organisation_name: user.organisation?.name ?? null,
      organisation_domin: user.organisation?.domin ?? null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.put("/profile", requireAuth, async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const firstNameInput = String(req.body?.first_name ?? "").trim();
    const lastNameInput = String(req.body?.last_name ?? "").trim();
    const firstName = firstNameInput || null;
    const lastName = lastNameInput || null;
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;

    if (!username) {
      return res.status(400).json({ error: "Email is required" });
    }
    if (username.length > 50) {
      return res.status(400).json({ error: "Email must be 50 characters or fewer" });
    }
    if (firstNameInput.length > 100) {
      return res.status(400).json({ error: "First name must be 100 characters or fewer" });
    }
    if (lastNameInput.length > 100) {
      return res.status(400).json({ error: "Last name must be 100 characters or fewer" });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { username, firstName, lastName, fullName },
      select: {
        id: true,
        username: true,
        fullName: true,
        firstName: true,
        lastName: true,
        permissions: true,
        organisationId: true,
        organisation: {
          select: { name: true, domin: true },
        },
      },
    });

    return res.json({
      id: updated.id,
      username: updated.username,
      full_name: updated.fullName,
      first_name: updated.firstName,
      last_name: updated.lastName,
      permissions: serializePermission(updated.permissions),
      organisation_id: updated.organisationId,
      organisation_name: updated.organisation?.name ?? null,
      organisation_domin: updated.organisation?.domin ?? null,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Profile not found" });
    }
    if (error.code === "P2002" || error.code === "23505") {
      return res.status(409).json({ error: "That email/username already exists" });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.get(
  "/organisation-asset-validation",
  requireAuth,
  requireOrganisationAssetValidationEditor,
  async (req, res) => {
    try {
      const organisationId = await resolveOrganisationAssetValidationScope(
        prisma,
        req.user,
        req.query.organisation_id,
      );
      const rules = await getOrganisationAssetValidationRules(prisma, organisationId);
      return res.json(rules);
    } catch (error) {
      if (
        error?.code === "USER_ORGANISATION_REQUIRED" ||
        error?.code === "INVALID_ORGANISATION_FILTER" ||
        error?.code === "ORGANISATION_ID_REQUIRED" ||
        error?.code === "ORGANISATION_NOT_FOUND"
      ) {
        return res.status(400).json({ error: error.message });
      }
      if (error?.code === "FORBIDDEN_ORGANISATION_SCOPE") {
        return res.status(403).json({ error: error.message });
      }
      console.error(error);
      return res.status(500).json({ error: "Server Error" });
    }
  },
);

app.put(
  "/organisation-asset-validation",
  requireAuth,
  requireOrganisationAssetValidationEditor,
  async (req, res) => {
    try {
      const organisationId = await resolveOrganisationAssetValidationScope(
        prisma,
        req.user,
        req.body?.organisation_id ?? req.query.organisation_id,
      );
      const { values, errors, isValid } = validateOrganisationAssetValidationPayload(req.body || {});
      if (!isValid) {
        return res.status(400).json(buildValidationErrorResponse(errors));
      }

      await ensureOrganisationAssetValidationRules(prisma, organisationId);

      const updated = await prisma.organisationAssetValidationRules.update({
        where: { organisationId },
        data: {
          serialMinLength: values.serial_min_length,
          serialMaxLength: values.serial_max_length,
          macMinLength: values.mac_min_length,
          macMaxLength: values.mac_max_length,
          cNumberMinLength: values.c_number_min_length,
          cNumberMaxLength: values.c_number_max_length,
        },
      });

      return res.json({
        organisation_id: updated.organisationId,
        serial_min_length: updated.serialMinLength,
        serial_max_length: updated.serialMaxLength,
        mac_min_length: updated.macMinLength,
        mac_max_length: updated.macMaxLength,
        c_number_min_length: updated.cNumberMinLength,
        c_number_max_length: updated.cNumberMaxLength,
      });
    } catch (error) {
      if (
        error?.code === "USER_ORGANISATION_REQUIRED" ||
        error?.code === "INVALID_ORGANISATION_FILTER" ||
        error?.code === "ORGANISATION_ID_REQUIRED" ||
        error?.code === "ORGANISATION_NOT_FOUND"
      ) {
        return res.status(400).json({ error: error.message });
      }
      if (error?.code === "FORBIDDEN_ORGANISATION_SCOPE") {
        return res.status(403).json({ error: error.message });
      }
      console.error(error);
      return res.status(500).json({ error: "Server Error" });
    }
  },
);

app.get("/users", requireAuth, requirePermission("users.view"), async (req, res) => {
  try {
    const scope = await resolveOrganisationScope(prisma, req.user, req.query.organisation_id);
    const users = await prisma.user.findMany({
      where: scope.effectiveOrganisationId != null
        ? { organisationId: scope.effectiveOrganisationId }
        : {},
      select: {
        id: true,
        username: true,
        fullName: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        organisationId: true,
        organisation: { select: { name: true } },
      },
      orderBy: [{ permissions: "asc" }, { createdAt: "desc" }],
    });

    const rows = users
      .filter((u) => canTargetRole(req.user.permissions, u.permissions))
      .map((u) => ({
        id: u.id,
        username: u.username,
        full_name: u.fullName,
        permissions: serializePermission(u.permissions),
        is_active: u.isActive,
        created_at: u.createdAt,
        organisation_id: u.organisationId,
        organisation_name: u.organisation?.name ?? null,
      }));

    return res.json(rows);
  } catch (error) {
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    if (error?.code === "INVALID_ORGANISATION_FILTER") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.post("/users", requireAuth, requirePermission("users.manage"), async (req, res) => {
  try {
    const { username, password, full_name, permissions, organisation_id } = req.body;

    if (!username || !password || !full_name || !permissions) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedPermission = normalizePermission(permissions);
    if (!normalizedPermission) {
      return res.status(400).json({ error: "Invalid permissions value" });
    }
    if (!canTargetRole(req.user.permissions, normalizedPermission)) {
      return res.status(403).json({ error: "You cannot assign a higher permission level than your own." });
    }

    const email = String(username).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(String(password), 12);
    const scope = await resolveOrganisationScope(prisma, req.user, null);
    let organisationId = organisation_id == null ? null : Number(organisation_id);

    if (organisationId != null && (!Number.isInteger(organisationId) || organisationId <= 0)) {
      return res.status(400).json({ error: "Invalid organisation_id" });
    }

    if (!scope.isAdmin) {
      if (organisationId != null && organisationId !== scope.userOrganisationId) {
        return res.status(403).json({ error: "You can only create users within your organisation." });
      }
      organisationId = scope.userOrganisationId;
    }

    if (organisationId != null) {
      const org = await prisma.organisation.findUnique({
        where: { id: organisationId },
        select: { id: true },
      });
      if (!org) {
        return res.status(400).json({ error: "Organisation not found" });
      }
    }

    const created = await prisma.user.create({
      data: {
        username: email,
        passwordHash,
        fullName: String(full_name).trim(),
        permissions: normalizedPermission,
        isActive: true,
        organisationId,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        organisationId: true,
      },
    });

    const appUrl = process.env.APP_URL || (process.env.CORS_ORIGIN || "").split(",")[0] || "http://localhost:5173";
    sendWelcomeEmail({
      to: created.username,
      fullName: created.fullName,
      password: String(req.body.password),
      permissions: serializePermission(created.permissions),
      appUrl,
    }).catch((emailErr) => console.error("[email] Welcome email failed:", emailErr));

    return res.json({
      id: created.id,
      username: created.username,
      full_name: created.fullName,
      permissions: serializePermission(created.permissions),
      is_active: created.isActive,
      created_at: created.createdAt,
      organisation_id: created.organisationId,
    });
  } catch (error) {
    if (error.code === "P2002" || error.code === "23505") {
      return res.status(409).json({ error: "That email/username already exists" });
    }
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.put("/users/:id/permissions", requireAuth, requirePermission("users.manage"), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const permission = normalizePermission(req.body.permissions);
    if (!permission) {
      return res.status(400).json({ error: "Invalid permissions value" });
    }
    if (!canTargetRole(req.user.permissions, permission)) {
      return res.status(403).json({ error: "You cannot assign a higher permission level than your own." });
    }

    const scope = await resolveOrganisationScope(prisma, req.user, null);

    const target = await prisma.user.findFirst({
      where: {
        id: targetId,
        ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
      },
      select: { id: true, permissions: true },
    });

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!canTargetRole(req.user.permissions, target.permissions)) {
      return res.status(403).json({ error: "You cannot modify a user above your permission level." });
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { permissions: permission },
      select: {
        id: true,
        username: true,
        fullName: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        organisationId: true,
      },
    });

    return res.json({
      id: updated.id,
      username: updated.username,
      full_name: updated.fullName,
      permissions: serializePermission(updated.permissions),
      is_active: updated.isActive,
      created_at: updated.createdAt,
      organisation_id: updated.organisationId,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.put("/users/:id/organisation", requireAuth, requirePermission("users.manage"), async (req, res) => {
  try {
    if (req.user?.permissions !== "Admin") {
      return res.status(403).json({ error: "Admin permission required" });
    }

    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const organisationId = Number(req.body?.organisation_id);
    if (!Number.isInteger(organisationId) || organisationId <= 0) {
      return res.status(400).json({ error: "Invalid organisation_id" });
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { id: true, name: true },
    });
    if (!organisation) {
      return res.status(400).json({ error: "Organisation not found" });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, permissions: true },
    });
    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!canTargetRole(req.user.permissions, target.permissions)) {
      return res.status(403).json({ error: "You cannot modify a user above your permission level." });
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { organisationId },
      select: {
        id: true,
        username: true,
        fullName: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        organisationId: true,
        organisation: { select: { name: true } },
      },
    });

    return res.json({
      id: updated.id,
      username: updated.username,
      full_name: updated.fullName,
      permissions: serializePermission(updated.permissions),
      is_active: updated.isActive,
      created_at: updated.createdAt,
      organisation_id: updated.organisationId,
      organisation_name: updated.organisation?.name ?? null,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.put("/users/:id/password", requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const isSelf = req.user.id === targetId;
    const canManageUsers = hasUserPermission(req.user, "users.manage");

    if (!isSelf && !canManageUsers) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const nextPassword = String(req.body.new_password || "");
    if (nextPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    if (!isSelf) {
      const scope = await resolveOrganisationScope(prisma, req.user, null);
      const target = await prisma.user.findFirst({
        where: {
          id: targetId,
          ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
        },
        select: { id: true },
      });
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    const passwordHash = await bcrypt.hash(nextPassword, 12);
    await prisma.user.update({
      where: { id: targetId },
      data: { passwordHash },
    });

    return res.json({ message: "Password updated" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.put("/users/:id/active", requireAuth, requirePermission("users.manage"), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const isActive = req.body?.is_active;

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "is_active must be a boolean" });
    }

    if (targetId === req.user.id && isActive === false) {
      return res.status(400).json({ error: "You cannot deactivate your own account." });
    }

    const scope = await resolveOrganisationScope(prisma, req.user, null);

    const updated = await prisma.user.updateMany({
      where: {
        id: targetId,
        ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
      },
      data: { isActive },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        username: true,
        fullName: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        organisationId: true,
      },
    });

    return res.json({
      id: user.id,
      username: user.username,
      full_name: user.fullName,
      permissions: serializePermission(user.permissions),
      is_active: user.isActive,
      created_at: user.createdAt,
      organisation_id: user.organisationId,
    });
  } catch (error) {
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.post("/newDevice", requireAuth, requirePermission("assets.create"), async (req, res) => {
  try {
    const fridge_serial_number = normalizeHexIdentifier(req.body?.fridge_serial_number);
    const mac_address = normalizeHexIdentifier(req.body?.mac_address);
    const c_number = normalizeCNumber(req.body?.c_number);
    logAssetAction("create-device:start", `serial=${fridge_serial_number || "unknown"} byUser=${req.user?.id || "unknown"}`);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;

      const requestedOrganisationScope = req.body?.organisation_id ?? req.query.organisation_id;
      const scope = await resolveOrganisationMutationScope(
        tx,
        req.user,
        requestedOrganisationScope,
        { requireExisting: true },
      );
      const organisationId = scope.effectiveOrganisationId;
      if (!organisationId) {
        const error = new Error("User organisation is not configured.");
        error.code = "USER_ORGANISATION_REQUIRED";
        throw error;
      }

      const rules = await getOrganisationAssetValidationRules(tx, organisationId);
      const validationErrors = validateAssetIdentifiers(
        { fridge_serial_number, mac_address, c_number },
        rules,
        { requireSerial: true },
      );
      if (Object.keys(validationErrors).length) {
        const err = new Error("VALIDATION_ERROR");
        err.code = "VALIDATION_ERROR";
        err.validationErrors = validationErrors;
        throw err;
      }

      return await tx.fridge.create({
        data: {
          fridgeSerialNumber: fridge_serial_number,
          iotMacAddress: mac_address || "",
          cNumber: c_number || "",
          organisationId,
        },
      });
    });

    logAssetAction("create-device:success", `serial=${fridge_serial_number}`);
    return res.json(serializeFridgeRow(fridgePrismaToRow(result)));
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return res.status(400).json(buildValidationErrorResponse(error.validationErrors));
    }
    if (error.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === "ORGANISATION_NOT_FOUND") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "create-device", error);
  }
});

app.post("/newDevice/bulk", requireAuth, requirePermission("assets.create"), (req, res) => {
  spreadsheetUpload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || "Invalid upload." });
    }

    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: "Please upload a CSV or Excel file." });
    }

    console.log(
      `[bulk-upload] received file name=${file.originalname || "unknown"} sizeBytes=${file.size || 0}`,
    );
    logAssetAction("bulk-upload:start", `file=${file.originalname || "unknown"} byUser=${req.user?.id || "unknown"}`);

    let parsedRows;
    let firstSheet;
    try {
      const parsed = parseUploadedSheetRows(file.buffer);
      firstSheet = parsed.firstSheet;
      parsedRows = parsed.rows;

      if (!firstSheet) {
        return res.status(400).json({ error: "Uploaded file has no sheets." });
      }

      if (!parsedRows.length) {
        return res.status(400).json({ error: "Uploaded file has no data rows." });
      }

      console.log(`[bulk-upload] parsed rows=${parsedRows.length} sheet=${firstSheet}`);
    } catch (error) {
      console.error(error);
      return res.status(400).json({ error: "Could not parse file. Use CSV, XLS, or XLSX." });
    }

    const seenSerials = new Set();
    const validRows = [];
    const errors = [];

    const { preparedRows, excludedRows } = buildBulkRows(parsedRows);

    preparedRows.forEach((row) => {
      if (seenSerials.has(row.fridge_serial_number)) {
        errors.push({
          rowNumber: row.rowNumber,
          serial: row.fridge_serial_number,
          reason: "DUPLICATE_IN_FILE",
          message: "Duplicate serial in uploaded file.",
        });
        return;
      }

      seenSerials.add(row.fridge_serial_number);
      validRows.push(row);
    });

    if (!validRows.length) {
      return res.status(400).json({
        error: "No valid rows found in upload.",
        summary: {
          totalRows: parsedRows.length,
          excludedRows,
          validRows: 0,
          insertedRows: 0,
          failedRows: errors.length,
        },
        errors,
      });
    }

    const inserted = [];
    const skippedRows = [];

    try {
      // Set the current user config for audit trigger (no transaction wrapping the whole bulk, rows are individual)
      await prisma.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;

      const requestedOrganisationScope = req.body?.organisation_id ?? req.query.organisation_id;
      const scope = await resolveOrganisationMutationScope(
        prisma,
        req.user,
        requestedOrganisationScope,
        { requireExisting: true },
      );
      const organisationId = scope.effectiveOrganisationId;
      if (!organisationId) {
        return res.status(400).json({ error: "User organisation is not configured." });
      }
      const rules = await getOrganisationAssetValidationRules(prisma, organisationId);

      console.info(`[bulk-upload] rows-to-process=${validRows.length}`);
      for (const row of validRows) {
        console.info(
          `[bulk-upload] row rowNumber=${row.rowNumber} serial_number=${row.fridge_serial_number} mac_address=${row.mac_address || ""} c_number=${row.c_number || ""}`,
        );

        const validationErrors = validateAssetIdentifiers(
          {
            fridge_serial_number: row.fridge_serial_number,
            mac_address: row.mac_address || "",
            c_number: row.c_number || "",
          },
          rules,
          { requireSerial: true },
        );
        if (Object.keys(validationErrors).length) {
          const fieldErrorMessages = formatValidationErrors(validationErrors)
            .map((item) => item.message)
            .join(" ");
          errors.push({
            rowNumber: row.rowNumber,
            serial: row.fridge_serial_number,
            reason: "INVALID_LENGTH",
            message: fieldErrorMessages,
          });
          continue;
        }

        // Check for existing row by serial or mac
        const existing = await prisma.fridge.findFirst({
          where: {
            OR: [
              { fridgeSerialNumber: row.fridge_serial_number },
              ...(row.mac_address ? [{ iotMacAddress: row.mac_address }] : []),
            ],
          },
          select: {
            fridgeSerialNumber: true,
            iotMacAddress: true,
            cNumber: true,
          },
        });

        if (existing) {
          const isSerialMatch = existing.fridgeSerialNumber === row.fridge_serial_number;
          const isMacMatch = row.mac_address && existing.iotMacAddress === row.mac_address;
          skippedRows.push(buildSkippedDuplicateReportRow(
            row,
            existing,
            isSerialMatch
              ? "Serial number already exists in database."
              : isMacMatch
                ? "MAC address already exists in database."
                : "Row already exists in database.",
          ));
          continue;
        }

        try {
          const createdFridge = await prisma.fridge.create({
            data: {
              fridgeSerialNumber: row.fridge_serial_number,
              iotMacAddress: row.mac_address,
              cNumber: row.c_number,
              organisationId,
            },
          });
          inserted.push(fridgePrismaToRow(createdFridge));
        } catch (rowError) {
          // P2002 = unique constraint violation (conflict)
          if (rowError.code === "P2002") {
            const existingAfterConflict = await prisma.fridge.findFirst({
              where: {
                OR: [
                  { fridgeSerialNumber: row.fridge_serial_number },
                  ...(row.mac_address ? [{ iotMacAddress: row.mac_address }] : []),
                ],
              },
              select: { fridgeSerialNumber: true, iotMacAddress: true, cNumber: true },
            });
            skippedRows.push(buildSkippedDuplicateReportRow(
              row,
              existingAfterConflict,
              "Row skipped because it already exists in database.",
            ));
          } else {
            errors.push({
              rowNumber: row.rowNumber,
              serial: row.fridge_serial_number,
              reason: "INSERT_ERROR",
              message: rowError.message || "Unexpected insert error.",
            });
          }
        }
      }

      logAssetAction(
        "bulk-upload:success",
        `file=${file.originalname || "unknown"} inserted=${inserted.length} skipped=${skippedRows.length} failed=${errors.length}`,
      );
      return res.json({
        ok: true,
        summary: {
          totalRows: parsedRows.length,
          excludedRows,
          validRows: validRows.length,
          insertedRows: inserted.length,
          skippedRows: skippedRows.length,
          failedRows: errors.length,
        },
        inserted: inserted.map(serializeFridgeRow),
        skippedRows,
        errors,
      });
    } catch (error) {
      if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
        return res.status(400).json({ error: error.message });
      }
      if (error?.code === "ORGANISATION_NOT_FOUND") {
        return res.status(400).json({ error: error.message });
      }
      return handleAssetError(res, "bulk-upload", error);
    }
  });
});

app.post("/newDevice/bulk/update", requireAuth, requirePermission("assets.edit"), async (req, res) => {
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided for update." });
    }

    logAssetAction("bulk-update:start", `rowCount=${rows.length} byUser=${req.user?.id || "unknown"}`);

    await prisma.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;

    const requestedOrganisationScope = req.body?.organisation_id ?? req.query.organisation_id;
    const scope = await resolveOrganisationMutationScope(
      prisma,
      req.user,
      requestedOrganisationScope,
      { requireExisting: true },
    );
    const organisationId = scope.effectiveOrganisationId;

    const rules = organisationId
      ? await getOrganisationAssetValidationRules(prisma, organisationId)
      : null;

    const updated = [];
    const skipped = [];
    const errors = [];

    for (const row of rows) {
      const serial = normalizeHexIdentifier(row.serial || row.fridge_serial_number || "");
      const mac = normalizeHexIdentifier(row.upload_mac_address || row.mac_address || "");
      const cNumber = normalizeCNumber(row.upload_c_number || row.c_number || "");

      if (!serial) {
        errors.push({ serial, reason: "MISSING_SERIAL", message: "Serial number is required." });
        continue;
      }

      if (rules) {
        const validationErrors = validateAssetIdentifiers(
          { mac_address: mac, c_number: cNumber },
          rules,
        );
        if (Object.keys(validationErrors).length) {
          const fieldErrorMessages = formatValidationErrors(validationErrors)
            .map((item) => item.message)
            .join(" ");
          errors.push({ serial, reason: "VALIDATION_ERROR", message: fieldErrorMessages });
          continue;
        }
      }

      try {
        const fridge = await prisma.fridge.findFirst({
          where: {
            fridgeSerialNumber: serial,
            ...(organisationId != null ? { organisationId } : {}),
          },
        });

        if (!fridge) {
          skipped.push({ serial, reason: "NOT_FOUND", message: "Fridge not found in database." });
          continue;
        }

        const macChanged = (mac || "") !== (fridge.iotMacAddress || "");
        const cNumberChanged = (cNumber || "") !== (fridge.cNumber || "");

        if (!macChanged && !cNumberChanged) {
          skipped.push({ serial, reason: "NO_CHANGES", message: "No changes to apply." });
          continue;
        }

        const shouldUnverify = fridge.verified && (macChanged || cNumberChanged);

        const result = await prisma.fridge.update({
          where: { fridgeSerialNumber: serial },
          data: {
            iotMacAddress: mac || "",
            cNumber: cNumber || "",
            ...(shouldUnverify ? { verified: false, verifiedAt: null } : {}),
          },
        });
        updated.push(serializeFridgeRow(fridgePrismaToRow(result)));
      } catch (rowError) {
        errors.push({ serial, reason: "UPDATE_ERROR", message: rowError.message || "Unexpected update error." });
      }
    }

    logAssetAction(
      "bulk-update:success",
      `updated=${updated.length} skipped=${skipped.length} failed=${errors.length}`,
    );

    return res.json({
      ok: true,
      summary: {
        totalRows: rows.length,
        updatedRows: updated.length,
        skippedRows: skipped.length,
        failedRows: errors.length,
      },
      updated,
      skipped,
      errors,
    });
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    if (error?.code === "ORGANISATION_NOT_FOUND") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "bulk-update", error);
  }
});

app.post("/newDevice/bulk/preview", requireAuth, requirePermission("assets.create"), (req, res) => {
  spreadsheetUpload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || "Invalid upload." });
    }

    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: "Please upload a CSV or Excel file." });
    }

    try {
      const parsed = parseUploadedSheetRows(file.buffer);
      if (!parsed.firstSheet) {
        return res.status(400).json({ error: "Uploaded file has no sheets." });
      }
      if (!parsed.rows.length) {
        return res.status(400).json({ error: "Uploaded file has no data rows." });
      }

      const { preparedRows, excludedRows } = buildBulkRows(parsed.rows);

      logAssetAction(
        "bulk-preview:success",
        `file=${file.originalname || "unknown"} previewRows=${preparedRows.length} excludedRows=${excludedRows}`,
      );

      return res.json({
        ok: true,
        columns: ["rowNumber", "fridge_serial_number", "mac_address", "c_number"],
        summary: {
          totalRows: parsed.rows.length,
          previewRows: preparedRows.length,
          excludedRows,
        },
        rows: preparedRows,
      });
    } catch (error) {
      return handleAssetError(res, "bulk-preview", error);
    }
  });
});

app.get(
  "/getFridges",
  requireAuth,
  requireAnyPermission(["assets.view", "device_checker.submit"]),
  async (req, res) => {
    try {
      const scope = await resolveOrganisationScope(prisma, req.user, req.query.organisation_id);
      logAssetAction(
        "list-fridges:start",
        `orgFilter=${scope.effectiveOrganisationId ?? "all"} byUser=${req.user?.id || "unknown"}`,
      );

      const fridges = await prisma.fridge.findMany({
        where: scope.effectiveOrganisationId != null
          ? { organisationId: scope.effectiveOrganisationId }
          : {},
        orderBy: { fridgeSerialNumber: "asc" },
      });

      logAssetAction("list-fridges:success", `count=${fridges.length}`);
      return res.json(fridges.map((f) => serializeFridgeRow(fridgePrismaToRow(f))));
    } catch (error) {
      if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
        return res.status(400).json({ error: error.message });
      }
      return handleAssetError(res, "list-fridges", error);
    }
  },
);

app.get("/stats", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user?.permissions === "Admin";
    let total_units;

    if (isAdmin) {
      total_units = await prisma.fridge.count();
    } else {
      const organisationId = await getUserOrganisationId(prisma, req.user.id);
      if (!organisationId) {
        return res.status(400).json({ error: "User organisation is not configured." });
      }
      total_units = await prisma.fridge.count({ where: { organisationId } });
    }

    return res.json({ total_units });
  } catch (error) {
    console.error("[stats] error", error);
    return res.status(500).json({ error: "Could not retrieve stats." });
  }
});

app.get(
  "/searchFridges",
  requireAuth,
  requireAnyPermission(["assets.view", "device_checker.submit"]),
  async (req, res) => {
    try {
      const searchTerm = String(req.query.searchTerm || "");
      const scope = await resolveOrganisationScope(prisma, req.user, req.query.organisation_id);
      logAssetAction("search-fridges:start", `term=${searchTerm} orgFilter=${scope.effectiveOrganisationId ?? "all"}`);

      const fridges = await prisma.fridge.findMany({
        where: {
          ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
          OR: [
            { iotMacAddress: { contains: searchTerm, mode: "insensitive" } },
            { fridgeSerialNumber: { contains: searchTerm, mode: "insensitive" } },
            { cNumber: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        orderBy: { fridgeSerialNumber: "asc" },
      });

      logAssetAction("search-fridges:success", `count=${fridges.length}`);
      return res.json(fridges.map((f) => serializeFridgeRow(fridgePrismaToRow(f))));
    } catch (error) {
      if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
        return res.status(400).json({ error: error.message });
      }
      return handleAssetError(res, "search-fridges", error);
    }
  },
);

app.put("/updateDevice/:serialNumber", requireAuth, requirePermission("assets.edit"), async (req, res) => {
  try {
    logAssetAction(
      "update-device:start",
      `serial=${req.params.serialNumber || "unknown"} byUser=${req.user?.id || "unknown"}`,
    );

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;

      const scope = await resolveOrganisationMutationScope(tx, req.user, req.query.organisation_id);

      const fridge = await tx.fridge.findFirst({
        where: {
          fridgeSerialNumber: req.params.serialNumber,
          ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
        },
      });

      if (!fridge) {
        const error = new Error("No fridge found with that serial number");
        error.code = "NOT_FOUND";
        throw error;
      }

      const nextMac = Object.prototype.hasOwnProperty.call(req.body || {}, "mac_address")
        ? normalizeHexIdentifier(req.body?.mac_address)
        : String(fridge.iotMacAddress || "");
      const nextCNumber = Object.prototype.hasOwnProperty.call(req.body || {}, "c_number")
        ? normalizeCNumber(req.body?.c_number)
        : String(fridge.cNumber || "");

      const rules = await getOrganisationAssetValidationRules(tx, fridge.organisationId);
      const validationErrors = validateAssetIdentifiers(
        { mac_address: nextMac, c_number: nextCNumber },
        rules,
      );
      if (Object.keys(validationErrors).length) {
        const err = new Error("VALIDATION_ERROR");
        err.code = "VALIDATION_ERROR";
        err.validationErrors = validationErrors;
        throw err;
      }

      const macChanged = (nextMac || "") !== (fridge.iotMacAddress || "");
      const cNumberChanged = (nextCNumber || "") !== (fridge.cNumber || "");
      const shouldUnverify = fridge.verified && (macChanged || cNumberChanged);

      return await tx.fridge.update({
        where: {
          fridgeSerialNumber: req.params.serialNumber,
          ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
        },
        data: {
          iotMacAddress: nextMac || "",
          cNumber: nextCNumber || "",
          ...(shouldUnverify ? { verified: false, verifiedAt: null } : {}),
        },
      });
    });

    logAssetAction("update-device:success", `serial=${req.params.serialNumber}`);
    return res.json(serializeFridgeRow(fridgePrismaToRow(result)));
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return res.status(400).json(buildValidationErrorResponse(error.validationErrors));
    }
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ error: error.message });
    }
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "update-device", error);
  }
});

app.delete("/deleteDevice/:serialNumber", requireAuth, requirePermission("assets.delete"), async (req, res) => {
  try {
    logAssetAction(
      "delete-device:start",
      `serial=${req.params.serialNumber || "unknown"} byUser=${req.user?.id || "unknown"}`,
    );

    const deleted = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;

      const scope = await resolveOrganisationMutationScope(tx, req.user, req.query.organisation_id);

      const fridge = await tx.fridge.findFirst({
        where: {
          fridgeSerialNumber: req.params.serialNumber,
          ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
        },
      });

      if (!fridge) {
        return null;
      }

      const result = await tx.fridge.delete({
        where: { fridgeSerialNumber: req.params.serialNumber },
      });

      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (reason) {
        await writeDeleteReasonToAuditLog(tx, req.params.serialNumber, reason);
      }

      return result;
    });

    if (!deleted) {
      return res.status(404).json({ error: "Fridge not found" });
    }

    logAssetAction("delete-device:success", `serial=${req.params.serialNumber}`);
    return res.json({ message: "Fridge deleted successfully", device: fridgePrismaToRow(deleted) });
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "delete-device", error);
  }
});

app.post("/deleteDevice/bulk", requireAuth, requirePermission("assets.delete"), async (req, res) => {
  try {
    const serials = req.body?.serials;
    if (!Array.isArray(serials) || serials.length === 0) {
      return res.status(400).json({ error: "serials must be a non-empty array." });
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    logAssetAction("bulk-delete:start", `count=${serials.length} byUser=${req.user?.id || "unknown"}`);

    const succeeded = [];
    const notFound = [];
    const errors = [];

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;
      const scope = await resolveOrganisationMutationScope(tx, req.user, req.query.organisation_id);

      for (const serial of serials) {
        try {
          const fridge = await tx.fridge.findFirst({
            where: {
              fridgeSerialNumber: serial,
              ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
            },
          });

          if (!fridge) {
            notFound.push(serial);
            continue;
          }

          await tx.fridge.delete({ where: { fridgeSerialNumber: serial } });

          if (reason) {
            await writeDeleteReasonToAuditLog(tx, serial, reason);
          }

          succeeded.push(serial);
        } catch (err) {
          errors.push({ serial, message: err instanceof Error ? err.message : String(err) });
        }
      }
    });

    logAssetAction("bulk-delete:success", `deleted=${succeeded.length} notFound=${notFound.length} errors=${errors.length}`);
    return res.json({ succeeded, notFound, errors });
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "bulk-delete", error);
  }
});

app.post("/moveDevice/bulk", requireAuth, requirePermission("assets.edit"), async (req, res) => {
  try {
    const serials = req.body?.serials;
    const targetOrgId = req.body?.organisation_id;

    if (!Array.isArray(serials) || serials.length === 0) {
      return res.status(400).json({ error: "serials must be a non-empty array." });
    }
    if (!targetOrgId || typeof targetOrgId !== "number") {
      return res.status(400).json({ error: "organisation_id must be a valid number." });
    }

    logAssetAction("bulk-move:start", `count=${serials.length} targetOrg=${targetOrgId} byUser=${req.user?.id || "unknown"}`);

    const succeeded = [];
    const notFound = [];
    const errors = [];

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;
      const scope = await resolveOrganisationMutationScope(tx, req.user, req.query.organisation_id);

      const targetOrg = await tx.organisation.findUnique({ where: { id: targetOrgId } });
      if (!targetOrg) {
        throw Object.assign(new Error(`Organisation ${targetOrgId} not found.`), { code: "TARGET_ORG_NOT_FOUND" });
      }

      for (const serial of serials) {
        try {
          const fridge = await tx.fridge.findFirst({
            where: {
              fridgeSerialNumber: serial,
              ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
            },
          });

          if (!fridge) {
            notFound.push(serial);
            continue;
          }

          await tx.fridge.update({
            where: { fridgeSerialNumber: serial },
            data: { organisationId: targetOrgId },
          });

          succeeded.push(serial);
        } catch (err) {
          errors.push({ serial, message: err instanceof Error ? err.message : String(err) });
        }
      }
    });

    logAssetAction("bulk-move:success", `moved=${succeeded.length} notFound=${notFound.length} errors=${errors.length}`);
    return res.json({ succeeded, notFound, errors });
  } catch (error) {
    if (error?.code === "TARGET_ORG_NOT_FOUND") {
      return res.status(404).json({ error: error.message });
    }
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "bulk-move", error);
  }
});

app.get("/auditLog/:serialNumber", requireAuth, requirePermission("history.view"), async (req, res) => {
  try {
    const scope = await resolveOrganisationScope(prisma, req.user, req.query.organisation_id);
    logAssetAction(
      "device-history:start",
      `serial=${req.params.serialNumber || "unknown"} orgFilter=${scope.effectiveOrganisationId ?? "all"}`,
    );

    const logs = await prisma.fridgeAuditLog.findMany({
      where: {
        fridgeSerialNumber: { equals: req.params.serialNumber, mode: "insensitive" },
        ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
      },
      include: {
        changedByUser: { select: { username: true } },
      },
      orderBy: { changedAt: "desc" },
    });

    const mismatchNoteMap = await buildMismatchNoteMap(logs);

    logAssetAction("device-history:success", `serial=${req.params.serialNumber || "unknown"} count=${logs.length}`);

    return res.json(logs.map((log) => serializeAuditLogRow(log, mismatchNoteMap)));
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "device-history", error);
  }
});

app.get("/auditLog", requireAuth, requirePermission("history.view"), async (req, res) => {
  try {
    const scope = await resolveOrganisationScope(prisma, req.user, req.query.organisation_id);
    logAssetAction("audit-history:start", `orgFilter=${scope.effectiveOrganisationId ?? "all"}`);

    const logs = await prisma.fridgeAuditLog.findMany({
      where: scope.effectiveOrganisationId != null
        ? { organisationId: scope.effectiveOrganisationId }
        : {},
      include: {
        changedByUser: { select: { username: true } },
      },
      orderBy: { changedAt: "desc" },
    });

    const mismatchNoteMap = await buildMismatchNoteMap(logs);

    logAssetAction("audit-history:success", `count=${logs.length}`);

    return res.json(logs.map((log) => serializeAuditLogRow(log, mismatchNoteMap)));
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "audit-history", error);
  }
});

app.post("/mobile/verify", requireMobileKey, async (req, res) => {
  try {
    const fridge_serial_number = String(req.body?.fridge_serial_number || "").trim();
    const received_mac = String(req.body?.mac_address || "").trim().toUpperCase();
    const received_c_number = String(req.body?.c_number || "").trim().toUpperCase();

    if (!fridge_serial_number) {
      return res.status(400).json({ error: "fridge_serial_number is required" });
    }

    logAssetAction("mobile-verify:start", `serial=${fridge_serial_number}`);

    const norm = (value) => String(value || "").trim().toUpperCase();

    const result = await prisma.$transaction(async (tx) => {
      const fridge = await tx.fridge.findUnique({
        where: { fridgeSerialNumber: fridge_serial_number },
        select: { fridgeSerialNumber: true, iotMacAddress: true, cNumber: true, verified: true },
      });

      if (!fridge) {
        const mismatch = await tx.fridgeMismatch.create({
          data: {
            fridgeSerialNumber: fridge_serial_number,
            receivedMac: received_mac || null,
            receivedCNumber: received_c_number || null,
            dbMac: null,
            dbCNumber: null,
            status: "open",
          },
        });
        return { type: "NOT_FOUND", mismatch };
      }

      const macMatches = received_mac ? norm(fridge.iotMacAddress) === norm(received_mac) : true;
      const cMatches = received_c_number ? norm(fridge.cNumber) === norm(received_c_number) : true;

      if (macMatches && cMatches) {
        const updated = await tx.fridge.update({
          where: { fridgeSerialNumber: fridge_serial_number },
          data: { verified: true, verifiedAt: new Date() },
        });
        return { type: "VERIFIED", fridge: updated };
      }

      const mismatch = await tx.fridgeMismatch.create({
        data: {
          fridgeSerialNumber: fridge_serial_number,
          receivedMac: received_mac || null,
          receivedCNumber: received_c_number || null,
          dbMac: fridge.iotMacAddress || null,
          dbCNumber: fridge.cNumber || null,
          status: "open",
        },
      });
      return { type: "VALUE_MISMATCH", mismatch };
    });

    if (result.type === "NOT_FOUND") {
      logAssetAction("mobile-verify:mismatch-created", `serial=${fridge_serial_number} reason=NOT_FOUND`);
      return res.status(200).json({
        ok: false,
        result: "MISMATCH_CREATED",
        reason: "NOT_FOUND",
        mismatch: serializeMismatchRow(mismatchPrismaToRow(result.mismatch)),
      });
    }

    if (result.type === "VERIFIED") {
      logAssetAction("mobile-verify:verified", `serial=${fridge_serial_number}`);
      return res.status(200).json({
        ok: true,
        result: "VERIFIED",
        fridge: serializeFridgeRow(fridgePrismaToRow(result.fridge)),
      });
    }

    logAssetAction("mobile-verify:mismatch-created", `serial=${fridge_serial_number} reason=VALUE_MISMATCH`);
    return res.status(200).json({
      ok: false,
      result: "MISMATCH_CREATED",
      reason: "VALUE_MISMATCH",
      mismatch: serializeMismatchRow(mismatchPrismaToRow(result.mismatch)),
    });
  } catch (error) {
    return handleAssetError(res, "mobile-verify", error);
  }
});

app.post("/mismatches/manual", requireAuth, requirePermission("device_checker.submit"), (req, res, next) => {
  imageUpload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {

    const serial = String(req.body?.fridge_serial_number || "").trim();
    const mac = normalizeHexIdentifier(req.body?.mac_address);
    const cNum = normalizeCNumber(req.body?.c_number);
    const parsedLocation = parseLocationCoordinates(req.body);

    if (!serial) {
      return res.status(400).json({ error: "fridge_serial_number is required" });
    }

    if (!parsedLocation.isValid) {
      return res.status(400).json(buildValidationErrorResponse(parsedLocation.errors));
    }

    const { latitude, longitude } = parsedLocation.values;

    logAssetAction(
      "submit-manual-mismatch:start",
      `serial=${serial} byUser=${req.user?.id || "unknown"}`,
    );

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;

      const requestedOrganisationScope = req.body?.organisation_id ?? req.query.organisation_id;
      const scope = await resolveOrganisationMutationScope(tx, req.user, requestedOrganisationScope);

      const fridge = await tx.fridge.findFirst({
        where: {
          fridgeSerialNumber: serial,
          ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
        },
        select: { fridgeSerialNumber: true, iotMacAddress: true, cNumber: true, verified: true },
      });

      if (!fridge) {
        const error = new Error("Fridge not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      // Persist image when the Prisma client includes the FridgeImage delegate.
      // This guards older generated clients where tx.fridgeImage is undefined.
      let fridgeImageId = null;
      if (req.file && tx?.fridgeImage?.create) {
        const fridgeImage = await tx.fridgeImage.create({
          data: {
            fridgeSerialNumber: serial,
            image: req.file.buffer,
            createdBy: req.user.id,
          },
        });
        fridgeImageId = fridgeImage.id;
      } else if (req.file) {
        logAssetAction(
          "submit-manual-mismatch:image-storage-skipped",
          `serial=${serial} reason=missing-prisma-fridgeImage-delegate`,
        );
      }

      const norm = (value) => String(value || "").trim().toUpperCase();
      const macMatches = mac ? norm(fridge.iotMacAddress) === norm(mac) : null;
      const cMatches = cNum ? norm(fridge.cNumber) === norm(cNum) : null;
      const hasAnyField = mac || cNum;
      const allProvidedMatch = hasAnyField && macMatches !== false && cMatches !== false;

      if (allProvidedMatch) {
        const updatedFridge = await tx.fridge.update({
          where: { fridgeSerialNumber: serial },
          data: {
            verified: true,
            verifiedAt: new Date(),
            ...(latitude != null ? { latitude } : {}),
            ...(longitude != null ? { longitude } : {}),
            ...(fridgeImageId != null ? { image: { connect: { id: fridgeImageId } } } : {}),
          },
        });
        return { type: "VERIFIED", fridge: updatedFridge };
      }

      const mismatch = await tx.fridgeMismatch.create({
        data: {
          fridgeSerialNumber: serial,
          receivedMac: mac || null,
          receivedCNumber: cNum || null,
          dbMac: fridge.iotMacAddress || null,
          dbCNumber: fridge.cNumber || null,
          status: "open",
          senderUser: { connect: { id: req.user.id } },
          latitude,
          longitude,
          ...(fridgeImageId != null ? { image: { connect: { id: fridgeImageId } } } : {}),
        },
      });

      if (fridgeImageId != null && tx?.fridgeImage?.update) {
        await tx.fridgeImage.update({
          where: { id: fridgeImageId },
          data: { mismatchAction: "open" },
        });
      }

      return { type: "MISMATCH_CREATED", mismatch };
    });

    if (result.type === "VERIFIED") {
      logAssetAction("submit-manual-mismatch:verified", `serial=${serial}`);
      return res.status(200).json({
        ok: true,
        result: "VERIFIED",
        fridge_serial_number: serial,
        fridge: serializeFridgeRow(fridgePrismaToRow(result.fridge)),
      });
    }

    logAssetAction("submit-manual-mismatch:success", `serial=${serial} id=${result.mismatch.id}`);

    return res.status(200).json({
      ok: true,
      result: "MISMATCH_CREATED",
      id: result.mismatch.id,
      fridge_serial_number: result.mismatch.fridgeSerialNumber,
      mismatch: serializeMismatchRow(mismatchPrismaToRow(result.mismatch)),
    });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ error: error.message });
    }
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "submit-manual-mismatch", error);
  }
});

app.post("/placements", requireAuth, requirePermission("placement.submit"), (req, res, next) => {
  imageUpload.array("images", 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const serial = String(req.body?.serial_number || "").trim();
    const mac = normalizeHexIdentifier(req.body?.mac_address);
    const cNum = normalizeCNumber(req.body?.c_number);
    const parsedLocation = parseLocationCoordinates(req.body);

    if (!serial) {
      return res.status(400).json({ error: "serial_number is required" });
    }

    if (!parsedLocation.isValid) {
      return res.status(400).json(buildValidationErrorResponse(parsedLocation.errors));
    }

    const { latitude, longitude } = parsedLocation.values;

    logAssetAction("placement:start", `serial=${serial} byUser=${req.user?.id || "unknown"}`);

    const imageCount = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;

      const requestedOrganisationScope = req.body?.organisation_id ?? req.query.organisation_id;
      const scope = await resolveOrganisationMutationScope(tx, req.user, requestedOrganisationScope);

      await tx.$executeRaw`
        INSERT INTO frostlink.fridges (fridge_serial_number, iot_mac_address, c_number, organisation_id, placed, latitude, longitude)
        VALUES (
          ${serial},
          ${mac || null},
          ${cNum || null},
          ${scope.effectiveOrganisationId ?? null},
          true,
          ${latitude ?? null},
          ${longitude ?? null}
        )
        ON CONFLICT (fridge_serial_number) DO UPDATE SET placed = true
      `;

      const files = Array.isArray(req.files) ? req.files : [];

      for (const file of files) {
        await tx.$executeRaw`
          INSERT INTO frostlink.fridge_placement (fridge_serial_number, image, created_by)
          VALUES (${serial}, ${file.buffer}, ${req.user.id})
        `;
      }

      return files.length;
    });

    logAssetAction("placement:success", `serial=${serial} images=${imageCount}`);

    return res.status(200).json({
      ok: true,
      result: "PLACED",
      serial_number: serial,
      image_count: imageCount,
    });
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "placement", error);
  }
});

app.get("/mismatches", requireAuth, requirePermission("mismatches.view"), async (req, res) => {
  try {
    const rawStatus = String(req.query.status || "open").trim().toLowerCase();
    const scope = await resolveOrganisationScope(prisma, req.user, req.query.organisation_id);
    logAssetAction(
      "list-mismatches:start",
      `status=${rawStatus} orgFilter=${scope.effectiveOrganisationId ?? "all"}`,
    );
    const from = req.query.from || null;
    const to = req.query.to || null;
    const serial = String(req.query.serial || "").trim();

    let statusAliases = [];
    if (rawStatus === "all") {
      statusAliases = [];
    } else if (rawStatus === "open") {
      statusAliases = ["open"];
    } else if (rawStatus === "resolve" || rawStatus === "resolved") {
      statusAliases = ["resolve"];
    } else if (rawStatus === "cancel" || rawStatus === "cancelled" || rawStatus === "canceled") {
      statusAliases = ["cancel"];
    } else if (rawStatus === "delete" || rawStatus === "deleted") {
      statusAliases = ["delete"];
    } else {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    const where = {};

    if (statusAliases.length) {
      where.status = { in: statusAliases };
    }

    if (from) {
      where.receivedAt = { ...where.receivedAt, gte: new Date(`${from}T00:00:00Z`) };
    }

    if (to) {
      where.receivedAt = { ...where.receivedAt, lte: new Date(`${to}T23:59:59Z`) };
    }

    if (serial) {
      where.fridgeSerialNumber = { contains: serial, mode: "insensitive" };
    }

    if (scope.effectiveOrganisationId != null) {
      where.fridge = { organisationId: scope.effectiveOrganisationId };
    }

    // Use $queryRaw for this query since it joins fridges for org scoping and
    // the Prisma relation filter on a non-relation field requires raw SQL for the LEFT JOIN pattern
    const { Prisma } = require("@prisma/client");

    // Build the query using raw SQL to preserve the original LEFT JOIN behaviour
    // (mismatches for fridges that no longer exist still appear when no org filter)
    const filters = [];
    const params = [];
    let idx = 1;

    if (statusAliases.length) {
      filters.push(`LOWER(fm.status::text) = ANY($${idx++}::text[])`);
      params.push(statusAliases);
    }

    if (from) {
      filters.push(`fm.received_at >= $${idx++}::timestamptz`);
      params.push(`${from}T00:00:00Z`);
    }

    if (to) {
      filters.push(`fm.received_at <= $${idx++}::timestamptz`);
      params.push(`${to}T23:59:59Z`);
    }

    if (serial) {
      filters.push(`fm.fridge_serial_number ILIKE $${idx++}`);
      params.push(`%${serial}%`);
    }

    const orgParamIndex = idx++;
    filters.push(`($${orgParamIndex}::int IS NULL OR f.organisation_id = $${orgParamIndex})`);
    params.push(scope.effectiveOrganisationId);

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const rows = await prisma.$queryRawUnsafe(
      `SELECT fm.*,
              fm.db_mac AS expected_mac,
              fm.db_c_number AS expected_c_number
       FROM frostlink.fridge_mismatches fm
       LEFT JOIN frostlink.fridges f ON f.fridge_serial_number = fm.fridge_serial_number
       ${whereClause}
       ORDER BY fm.received_at DESC
       LIMIT 500`,
      ...params,
    );

    logAssetAction("list-mismatches:success", `count=${rows.length}`);
    return res.json(rows.map(serializeMismatchRow));
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "list-mismatches", error);
  }
});

app.put("/mismatches/:id/resolve", requireAuth, requirePermission("mismatches.resolve"), async (req, res) => {
  try {
    logAssetAction(
      "resolve-mismatch:start",
      `id=${req.params.id || "unknown"} byUser=${req.user?.id || "unknown"}`,
    );
    const mismatchId = Number(req.params.id);
    if (!mismatchId) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const { note = "" } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const scope = await resolveOrganisationMutationScope(tx, req.user, req.query.organisation_id);

      // Fetch mismatch with its fridge's organisation_id via raw query to preserve the LEFT JOIN behaviour
      const rows = await tx.$queryRawUnsafe(
        `SELECT fm.*, f.organisation_id
         FROM frostlink.fridge_mismatches fm
         LEFT JOIN frostlink.fridges f ON f.fridge_serial_number = fm.fridge_serial_number
         WHERE fm.id = $1
           AND ($2::int IS NULL OR f.organisation_id = $2)`,
        mismatchId,
        scope.effectiveOrganisationId,
      );

      if (!rows.length) {
        const error = new Error("Mismatch not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      const mismatch = rows[0];
      await tx.$executeRaw`SELECT set_config('myapp.current_user_id', ${String(req.user.id)}, false)`;

      const newMac = mismatch.received_mac ? normalizeHexIdentifier(mismatch.received_mac) : "";
      const newC = mismatch.received_c_number ? normalizeCNumber(mismatch.received_c_number) : "";
      const rules = await getOrganisationAssetValidationRules(tx, mismatch.organisation_id);
      const validationErrors = validateAssetIdentifiers(
        { mac_address: newMac, c_number: newC },
        rules,
      );
      if (Object.keys(validationErrors).length) {
        const err = new Error("VALIDATION_ERROR");
        err.code = "VALIDATION_ERROR";
        err.validationErrors = validationErrors;
        throw err;
      }

      // Check for duplicate MAC address before updating
      if (newMac) {
        const duplicateMac = await tx.$queryRawUnsafe(
          `SELECT fridge_serial_number FROM frostlink.fridges
           WHERE iot_mac_address = $1 AND fridge_serial_number <> $2`,
          newMac,
          mismatch.fridge_serial_number,
        );
        if (duplicateMac.length) {
          const err = new Error(`MAC address ${newMac} is already assigned to fridge ${duplicateMac[0].fridge_serial_number}.`);
          err.code = "DUPLICATE_MAC";
          throw err;
        }
      }

      // Update fridge using raw to preserve the COALESCE(NULLIF(...)) logic
      const updatedFridgeRows = await tx.$queryRawUnsafe(
        `UPDATE frostlink.fridges
         SET iot_mac_address = COALESCE(NULLIF($1, ''), iot_mac_address),
             c_number = COALESCE(NULLIF($2, ''), c_number),
             latitude = COALESCE($4::numeric, latitude),
             longitude = COALESCE($5::numeric, longitude),
             image_id = COALESCE($6::bigint, image_id),
             verified = true,
             verified_at = NOW()
         WHERE fridge_serial_number = $3
         RETURNING *`,
        newMac,
        newC,
        mismatch.fridge_serial_number,
        mismatch.latitude,
        mismatch.longitude,
        mismatch.image_id,
      );

      const fridgeUpdated = updatedFridgeRows[0] || null;

      const resolved = await tx.fridgeMismatch.update({
        where: { id: BigInt(mismatchId) },
        data: {
          status: "resolve",
          resolvedAt: new Date(),
          resolvedBy: req.user.id,
          resolutionNote: String(note || "").trim() || undefined,
        },
      });

      if (mismatch.image_id != null && tx?.fridgeImage?.update) {
        await tx.fridgeImage.update({
          where: { id: BigInt(mismatch.image_id) },
          data: { mismatchAction: "resolve" },
        });
      }

      return { resolved, fridgeUpdated };
    });

    logAssetAction("resolve-mismatch:success", `id=${req.params.id || "unknown"}`);

    return res.json({
      ok: true,
      mismatch: serializeMismatchRow(mismatchPrismaToRow(result.resolved)),
      fridge: result.fridgeUpdated ? serializeFridgeRow(result.fridgeUpdated) : null,
    });
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return res.status(400).json(buildValidationErrorResponse(error.validationErrors));
    }
    if (error.code === "DUPLICATE_MAC") {
      return res.status(409).json({ error: error.message });
    }
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ error: error.message });
    }
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "resolve-mismatch", error);
  }
});

app.delete("/mismatches/:id", requireAuth, requirePermission("mismatches.delete"), async (req, res) => {
  try {
    logAssetAction(
      "delete-mismatch:start",
      `id=${req.params.id || "unknown"} byUser=${req.user?.id || "unknown"}`,
    );
    const mismatchId = Number(req.params.id);
    if (!mismatchId) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const note = String(req.body?.note || "").trim();
    if (!note) {
      return res.status(400).json({ error: "A reason is required to delete a mismatch." });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const scope = await resolveOrganisationMutationScope(tx, req.user, req.query.organisation_id);

      // Check existence via raw to preserve the LEFT JOIN org scoping
      const rows = await tx.$queryRawUnsafe(
        `SELECT fm.id, fm.image_id
         FROM frostlink.fridge_mismatches fm
         LEFT JOIN frostlink.fridges f ON f.fridge_serial_number = fm.fridge_serial_number
         WHERE fm.id = $1
           AND ($2::int IS NULL OR f.organisation_id = $2)`,
        mismatchId,
        scope.effectiveOrganisationId,
      );

      if (!rows.length) {
        const error = new Error("Mismatch not found");
        error.code = "NOT_FOUND";
        throw error;
      }

      const mismatch = rows[0];

      const deletedMismatch = await tx.fridgeMismatch.update({
        where: { id: BigInt(mismatchId) },
        data: {
          status: "delete",
          resolvedAt: new Date(),
          resolvedBy: req.user.id,
          resolutionNote: note,
        },
      });

      if (mismatch.image_id != null && tx?.fridgeImage?.update) {
        await tx.fridgeImage.update({
          where: { id: BigInt(mismatch.image_id) },
          data: { mismatchAction: "delete" },
        });
      }

      return deletedMismatch;
    });

    logAssetAction("delete-mismatch:success", `id=${req.params.id || "unknown"}`);
    return res.json({ ok: true, mismatch: serializeMismatchRow(mismatchPrismaToRow(updated)) });
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Mismatch not found" });
    }
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "delete-mismatch", error);
  }
});

app.use((req, res) => {
  return res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`operations-api started on port ${PORT}`);
});
