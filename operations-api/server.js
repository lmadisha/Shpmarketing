require("./env");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("./db");

const app = express();

const PORT = Number(process.env.PORT || 5001);
const JWT_SECRET = process.env.JWT_SECRET;
const MOBILE_API_KEY = process.env.MOBILE_API_KEY;

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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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
]);

const PERMISSION_POLICY = Object.freeze({
  Admin: {
    inherits: [],
    grants: [...PERMISSION_FLAGS],
  },
  "Fleet Manager": {
    inherits: [],
    grants: [
      "assets.create",
      "assets.edit",
      "assets.delete",
      "assets.view",
      "mismatches.resolve",
      "mismatches.delete",
      "mismatches.view",
      "history.view",
      "device_checker.submit",
    ],
  },
  Factory: {
    inherits: [],
    grants: [
      "assets.create",
      "assets.edit",
      "assets.delete",
      "assets.view",
    ],
  },
  Outlet: {
    inherits: [],
    grants: [
      "assets.create",
      "assets.edit",
      "assets.view",
      "mismatches.view",
    ],
  },
  Technician: {
    inherits: [],
    grants: [
      "mismatches.view",
      "device_checker.submit",
    ],
  },
  User: {
    inherits: [],
    grants: [],
  },
});

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
  if (compactPermission === "fleetmanager" || compactPermission === "intermediate") return "Fleet Manager";
  if (compactPermission === "factory" || compactPermission === "factorymanager") return "Factory";
  if (compactPermission === "outlet" || compactPermission === "outletmanager") return "Outlet";
  if (compactPermission === "technician") return "Technician";
  if (compactPermission === "users" || compactPermission === "user" || compactPermission === "basic") return "User";

  return null;
}

async function getUserOrganisationId(client, userId) {
  const result = await client.query(
    `SELECT organisation_id
     FROM users
     WHERE id = $1`,
    [userId],
  );

  if (!result.rows.length) {
    return null;
  }

  return result.rows[0].organisation_id ?? null;
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

async function resolveOrganisationScope(client, user, requestedOrganisationIdRaw) {
  const requestedOrganisationId = parseRequestedOrganisationId(requestedOrganisationIdRaw);
  const isAdmin = user?.permissions === "Admin";
  const userOrganisationId = await getUserOrganisationId(client, user.id);

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

function cleanHex12(value) {
  return String(value || "")
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
}

function cleanCNumber(value) {
  return String(value || "").trim().toUpperCase().slice(0, 10);
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
  return String(value || "").trim().slice(0, 12);
}

function sanitizeBulkMac(value) {
  const cleaned = String(value || "")
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase();
  return cleaned ? cleaned.slice(0, 12) : null;
}

function sanitizeBulkCNumber(value) {
  const cleaned = String(value || "").trim().toUpperCase();
  if (!cleaned) return null;
  return cleaned.length <= 10 ? cleaned : null;
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

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "operations-api" });
  } catch (error) {
    res.status(500).json({ ok: false, error: "DB_UNAVAILABLE" });
  }
});

app.get("/organisations", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, domin
       FROM organisation
       ORDER BY name ASC`,
    );
    return res.json(result.rows);
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

    const result = await pool.query(
      `INSERT INTO organisation (name, domin)
       VALUES ($1, $2)
       RETURNING id, name, domin, created_at`,
      [name, domin],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Organisation name or domain already exists." });
    }
    if (error.code === "22001") {
      return res.status(400).json({ error: "Organisation name or domain is too long." });
    }
    if (error.code === "42703") {
      return res.status(500).json({ error: "Database schema missing organisation.domin. Apply latest schema migration." });
    }
    if (error.code === "42P01") {
      return res.status(500).json({ error: "Database schema missing organisation table. Apply latest schema migration." });
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

  const client = await pool.connect();
  try {
    const linkCounts = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE organisation_id = $1) AS users_count,
         (SELECT COUNT(*)::int FROM fridges WHERE organisation_id = $1) AS fridges_count`,
      [organisationId],
    );

    const usersCount = linkCounts.rows[0]?.users_count ?? 0;
    const fridgesCount = linkCounts.rows[0]?.fridges_count ?? 0;

    if (usersCount > 0 || fridgesCount > 0) {
      return res.status(409).json({
        error: "Cannot delete organisation with linked users or fridges.",
        users_count: usersCount,
        fridges_count: fridgesCount,
      });
    }

    const result = await client.query(
      `DELETE FROM organisation
       WHERE id = $1
       RETURNING id, name`,
      [organisationId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Organisation not found" });
    }

    return res.json({ deleted: true, organisation: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
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

    const organisationResult = await pool.query(
      `SELECT id FROM organisation WHERE id = $1`,
      [organisationId],
    );

    if (!organisationResult.rows.length) {
      return res.status(400).json({ error: "Organisation not found" });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, permissions, is_active, organisation_id)
       VALUES ($1, $2, $3, $4, true, $5)
       RETURNING id, username, full_name, permissions, is_active, organisation_id`,
      [email, passwordHash, name, normalizedPermission, organisationId],
    );

    const createdUser = result.rows[0];
    const token = jwt.sign(
      {
        id: createdUser.id,
        username: createdUser.username,
        permissions: createdUser.permissions,
      },
      JWT_SECRET,
      { expiresIn: "12h" },
    );

    return res.status(201).json({
      token,
      user: {
        id: createdUser.id,
        username: createdUser.username,
        full_name: createdUser.full_name,
        permissions: createdUser.permissions,
        organisation_id: createdUser.organisation_id,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That email/username already exists" });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      `SELECT id, username, password_hash, is_active, full_name, permissions, organisation_id
       FROM users
       WHERE username = $1`,
      [String(username || "").trim().toLowerCase()],
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: "User is inactive" });
    }

    const passwordMatches = await bcrypt.compare(String(password || ""), user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        permissions: user.permissions,
      },
      JWT_SECRET,
      { expiresIn: "12h" },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        permissions: user.permissions,
        organisation_id: user.organisation_id,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.get("/profile", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id,
              u.username,
              u.full_name,
              u.permissions,
              u.organisation_id,
              o.name AS organisation_name,
              o.domin AS organisation_domin
       FROM users u
       LEFT JOIN organisation o ON o.id = u.organisation_id
       WHERE u.id = $1`,
      [req.user.id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.get("/users", requireAuth, requirePermission("users.view"), async (req, res) => {
  const client = await pool.connect();
  try {
    const scope = await resolveOrganisationScope(client, req.user, req.query.organisation_id);
    const result = await client.query(
      `SELECT u.id,
              u.username,
              u.full_name,
              u.permissions,
              u.is_active,
              u.created_at,
              u.organisation_id,
              o.name AS organisation_name
       FROM users u
       LEFT JOIN organisation o ON o.id = u.organisation_id
       WHERE ($1::int IS NULL OR u.organisation_id = $1)
       ORDER BY u.permissions ASC, u.created_at DESC`,
      [scope.effectiveOrganisationId],
    );
    return res.json(result.rows);
  } catch (error) {
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    if (error?.code === "INVALID_ORGANISATION_FILTER") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

app.post("/users", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, password, full_name, permissions, organisation_id } = req.body;

    if (!username || !password || !full_name || !permissions) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedPermission = normalizePermission(permissions);
    if (!normalizedPermission) {
      return res.status(400).json({ error: "Invalid permissions value" });
    }

    const email = String(username).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(String(password), 12);
    const scope = await resolveOrganisationScope(client, req.user, null);
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
      const organisationResult = await client.query(
        `SELECT id
         FROM organisation
         WHERE id = $1`,
        [organisationId],
      );
      if (!organisationResult.rows.length) {
        return res.status(400).json({ error: "Organisation not found" });
      }
    }

    const result = await client.query(
      `INSERT INTO users (username, password_hash, full_name, permissions, is_active, organisation_id)
       VALUES ($1, $2, $3, $4, true, $5)
       RETURNING id, username, full_name, permissions, is_active, created_at, organisation_id`,
      [email, passwordHash, String(full_name).trim(), normalizedPermission, organisationId],
    );

    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That email/username already exists" });
    }
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

app.put("/users/:id/permissions", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const client = await pool.connect();
  try {
    const permission = normalizePermission(req.body.permissions);
    if (!permission) {
      return res.status(400).json({ error: "Invalid permissions value" });
    }

    const scope = await resolveOrganisationScope(client, req.user, null);
    const result = await client.query(
      `UPDATE users
       SET permissions = $1
       WHERE id = $2
         AND ($3::int IS NULL OR organisation_id = $3)
       RETURNING id, username, full_name, permissions, is_active, created_at, organisation_id`,
      [permission, req.params.id, scope.effectiveOrganisationId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

app.put("/users/:id/password", requireAuth, async (req, res) => {
  const client = await pool.connect();
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
      const scope = await resolveOrganisationScope(client, req.user, null);
      const targetResult = await client.query(
        `SELECT id
         FROM users
         WHERE id = $1
           AND ($2::int IS NULL OR organisation_id = $2)`,
        [targetId, scope.effectiveOrganisationId],
      );
      if (!targetResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    const passwordHash = await bcrypt.hash(nextPassword, 12);
    const result = await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2
       RETURNING id`,
      [passwordHash, targetId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ message: "Password updated" });
  } catch (error) {
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

app.put("/users/:id/active", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const client = await pool.connect();
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

    const scope = await resolveOrganisationScope(client, req.user, null);
    const result = await client.query(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2
         AND ($3::int IS NULL OR organisation_id = $3)
       RETURNING id, username, full_name, permissions, is_active, created_at, organisation_id`,
      [isActive, targetId, scope.effectiveOrganisationId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    if (error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  } finally {
    client.release();
  }
});

app.post("/newDevice", requireAuth, requirePermission("assets.create"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { mac_address, fridge_serial_number, c_number } = req.body;
    logAssetAction("create-device:start", `serial=${fridge_serial_number || "unknown"} byUser=${req.user?.id || "unknown"}`);

    await client.query("BEGIN");
    await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [
      String(req.user.id),
    ]);
    const organisationId = await getUserOrganisationId(client, req.user.id);
    if (!organisationId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "User organisation is not configured." });
    }

    const result = await client.query(
      `INSERT INTO fridges (iot_mac_address, fridge_serial_number, c_number, organisation_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [mac_address, fridge_serial_number, c_number, organisationId],
    );

    await client.query("COMMIT");
    logAssetAction("create-device:success", `serial=${fridge_serial_number}`);
    return res.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return handleAssetError(res, "create-device", error);
  } finally {
    client.release();
  }
});

app.post("/newDevice/bulk", requireAuth, requirePermission("assets.create"), (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
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

    const client = await pool.connect();
    const inserted = [];
    const skippedRows = [];

    try {
      await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [String(req.user.id)]);
      const organisationId = await getUserOrganisationId(client, req.user.id);
      if (!organisationId) {
        return res.status(400).json({ error: "User organisation is not configured." });
      }

      console.info(`[bulk-upload] rows-to-process=${validRows.length}`);
      for (const row of validRows) {
        console.info(
          `[bulk-upload] row rowNumber=${row.rowNumber} serial_number=${row.fridge_serial_number} mac_address=${row.mac_address || ""} c_number=${row.c_number || ""}`,
        );

        const existing = await client.query(
          `SELECT fridge_serial_number, iot_mac_address
           FROM fridges
           WHERE fridge_serial_number = $1
              OR ($2::text IS NOT NULL AND iot_mac_address = $2)
           LIMIT 1`,
          [row.fridge_serial_number, row.mac_address],
        );

        if (existing.rows.length) {
          const existingRow = existing.rows[0];
          const isSerialMatch = existingRow.fridge_serial_number === row.fridge_serial_number;
          const isMacMatch = row.mac_address && existingRow.iot_mac_address === row.mac_address;
          skippedRows.push({
            rowNumber: row.rowNumber,
            serial: row.fridge_serial_number,
            reason: "DUPLICATE_IN_DB",
            message: isSerialMatch
              ? "Serial number already exists in database."
              : isMacMatch
                ? "MAC address already exists in database."
                : "Row already exists in database.",
          });
          continue;
        }

        try {
          const result = await client.query(
            `INSERT INTO fridges (iot_mac_address, fridge_serial_number, c_number, organisation_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING
             RETURNING *`,
            [row.mac_address, row.fridge_serial_number, row.c_number, organisationId],
          );
          if (result.rows.length) {
            inserted.push(result.rows[0]);
          } else {
            skippedRows.push({
              rowNumber: row.rowNumber,
              serial: row.fridge_serial_number,
              reason: "DUPLICATE_IN_DB",
              message: "Row skipped because it already exists in database.",
            });
          }
        } catch (rowError) {
          errors.push({
            rowNumber: row.rowNumber,
            serial: row.fridge_serial_number,
            reason: "INSERT_ERROR",
            message: rowError.message || "Unexpected insert error.",
          });
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
        inserted,
        skippedRows,
        errors,
      });
    } catch (error) {
      return handleAssetError(res, "bulk-upload", error);
    } finally {
      client.release();
    }
  });
});

app.post("/newDevice/bulk/preview", requireAuth, requirePermission("assets.create"), (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
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
  const client = await pool.connect();
  try {
    const scope = await resolveOrganisationScope(client, req.user, req.query.organisation_id);
    logAssetAction(
      "list-fridges:start",
      `orgFilter=${scope.effectiveOrganisationId ?? "all"} byUser=${req.user?.id || "unknown"}`,
    );

    const result = await client.query(
      `SELECT *
       FROM fridges
       WHERE ($1::int IS NULL OR organisation_id = $1)
       ORDER BY fridge_serial_number ASC`,
      [scope.effectiveOrganisationId],
    );
    logAssetAction("list-fridges:success", `count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "list-fridges", error);
  } finally {
    client.release();
  }
});

app.get(
  "/searchFridges",
  requireAuth,
  requireAnyPermission(["assets.view", "device_checker.submit"]),
  async (req, res) => {
  const client = await pool.connect();
  try {
    const searchTerm = String(req.query.searchTerm || "");
    const scope = await resolveOrganisationScope(client, req.user, req.query.organisation_id);
    logAssetAction("search-fridges:start", `term=${searchTerm} orgFilter=${scope.effectiveOrganisationId ?? "all"}`);
    const formattedSearch = `%${searchTerm}%`;

    const result = await client.query(
      `SELECT *
       FROM fridges
       WHERE ($1::int IS NULL OR organisation_id = $1)
         AND (
           iot_mac_address ILIKE $2
           OR fridge_serial_number ILIKE $2
           OR c_number ILIKE $2
         )
       ORDER BY fridge_serial_number ASC`,
      [scope.effectiveOrganisationId, formattedSearch],
    );

    logAssetAction("search-fridges:success", `count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "search-fridges", error);
  } finally {
    client.release();
  }
});

app.put("/updateDevice/:serialNumber", requireAuth, requirePermission("assets.edit"), async (req, res) => {
  const client = await pool.connect();
  try {
    logAssetAction(
      "update-device:start",
      `serial=${req.params.serialNumber || "unknown"} byUser=${req.user?.id || "unknown"}`,
    );
    await client.query("BEGIN");
    await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [
      String(req.user.id),
    ]);
    const scope = await resolveOrganisationScope(client, req.user, null);

    const result = await client.query(
      `UPDATE fridges
       SET iot_mac_address = COALESCE($1, iot_mac_address),
           c_number = COALESCE($2, c_number)
       WHERE fridge_serial_number = $3
         AND ($4::int IS NULL OR organisation_id = $4)
       RETURNING *`,
      [req.body.mac_address, req.body.c_number, req.params.serialNumber, scope.effectiveOrganisationId],
    );

    await client.query("COMMIT");

    if (!result.rows.length) {
      return res.status(404).json({ error: "No fridge found with that serial number" });
    }

    logAssetAction("update-device:success", `serial=${req.params.serialNumber}`);
    return res.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "update-device", error);
  } finally {
    client.release();
  }
});

app.delete("/deleteDevice/:serialNumber", requireAuth, requirePermission("assets.delete"), async (req, res) => {
  const client = await pool.connect();
  try {
    logAssetAction(
      "delete-device:start",
      `serial=${req.params.serialNumber || "unknown"} byUser=${req.user?.id || "unknown"}`,
    );
    await client.query("BEGIN");
    await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [
      String(req.user.id),
    ]);
    const scope = await resolveOrganisationScope(client, req.user, null);

    const result = await client.query(
      `DELETE FROM fridges
       WHERE fridge_serial_number = $1
         AND ($2::int IS NULL OR organisation_id = $2)
       RETURNING *`,
      [req.params.serialNumber, scope.effectiveOrganisationId],
    );

    await client.query("COMMIT");

    if (!result.rows.length) {
      return res.status(404).json({ error: "Fridge not found" });
    }

    logAssetAction("delete-device:success", `serial=${req.params.serialNumber}`);
    return res.json({ message: "Fridge deleted successfully", device: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "delete-device", error);
  } finally {
    client.release();
  }
});

app.get("/auditLog/:serialNumber", requireAuth, requirePermission("history.view"), async (req, res) => {
  const client = await pool.connect();
  try {
    const scope = await resolveOrganisationScope(client, req.user, req.query.organisation_id);
    logAssetAction(
      "device-history:start",
      `serial=${req.params.serialNumber || "unknown"} orgFilter=${scope.effectiveOrganisationId ?? "all"}`,
    );
    const result = await client.query(
      `SELECT fal.*,
              u.username AS changed_by_username
       FROM fridge_audit_log fal
       LEFT JOIN users u ON u.id = fal.changed_by
       LEFT JOIN fridges f ON f.fridge_serial_number = fal.fridge_serial_number
       WHERE UPPER(fal.fridge_serial_number) = UPPER($1)
         AND ($2::int IS NULL OR f.organisation_id = $2)
       ORDER BY fal.changed_at DESC`,
      [req.params.serialNumber, scope.effectiveOrganisationId],
    );
    logAssetAction("device-history:success", `serial=${req.params.serialNumber || "unknown"} count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "device-history", error);
  } finally {
    client.release();
  }
});

app.get("/auditLog", requireAuth, requirePermission("history.view"), async (req, res) => {
  const client = await pool.connect();
  try {
    const scope = await resolveOrganisationScope(client, req.user, req.query.organisation_id);
    logAssetAction("audit-history:start", `orgFilter=${scope.effectiveOrganisationId ?? "all"}`);
    const result = await client.query(
      `SELECT fal.*,
              u.username AS changed_by_username
       FROM fridge_audit_log fal
       LEFT JOIN users u ON u.id = fal.changed_by
       LEFT JOIN fridges f ON f.fridge_serial_number = fal.fridge_serial_number
       WHERE ($1::int IS NULL OR f.organisation_id = $1)
       ORDER BY fal.changed_at DESC`,
      [scope.effectiveOrganisationId],
    );
    logAssetAction("audit-history:success", `count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "audit-history", error);
  } finally {
    client.release();
  }
});

app.post("/mobile/verify", requireMobileKey, async (req, res) => {
  const client = await pool.connect();
  try {
    const fridge_serial_number = String(req.body?.fridge_serial_number || "").trim();
    const received_mac = String(req.body?.mac_address || "").trim().toUpperCase();
    const received_c_number = String(req.body?.c_number || "").trim().toUpperCase();

    if (!fridge_serial_number) {
      return res.status(400).json({ error: "fridge_serial_number is required" });
    }

    logAssetAction("mobile-verify:start", `serial=${fridge_serial_number}`);

    await client.query("BEGIN");

    const fridgeRes = await client.query(
      `SELECT fridge_serial_number, iot_mac_address, c_number, verified
       FROM fridges
       WHERE fridge_serial_number = $1`,
      [fridge_serial_number],
    );

    const norm = (value) => String(value || "").trim().toUpperCase();

    if (!fridgeRes.rows.length) {
      const mismatchInsert = await client.query(
        `INSERT INTO fridge_mismatches
          (fridge_serial_number, received_mac, received_c_number, db_mac, db_c_number, status)
         VALUES ($1, $2, $3, NULL, NULL, 'open')
         RETURNING *`,
        [fridge_serial_number, received_mac || null, received_c_number || null],
      );

      await client.query("COMMIT");
      logAssetAction("mobile-verify:mismatch-created", `serial=${fridge_serial_number} reason=NOT_FOUND`);
      return res.status(200).json({
        ok: false,
        result: "MISMATCH_CREATED",
        reason: "NOT_FOUND",
        mismatch: mismatchInsert.rows[0],
      });
    }

    const fridge = fridgeRes.rows[0];
    const macMatches = received_mac ? norm(fridge.iot_mac_address) === norm(received_mac) : true;
    const cMatches = received_c_number ? norm(fridge.c_number) === norm(received_c_number) : true;

    if (macMatches && cMatches) {
      const updated = await client.query(
        `UPDATE fridges
         SET verified = true,
             verified_at = NOW()
         WHERE fridge_serial_number = $1
         RETURNING *`,
        [fridge_serial_number],
      );

      await client.query("COMMIT");
      logAssetAction("mobile-verify:verified", `serial=${fridge_serial_number}`);
      return res.status(200).json({ ok: true, result: "VERIFIED", fridge: updated.rows[0] });
    }

    const mismatch = await client.query(
      `INSERT INTO fridge_mismatches
        (fridge_serial_number, received_mac, received_c_number, db_mac, db_c_number, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING *`,
      [
        fridge_serial_number,
        received_mac || null,
        received_c_number || null,
        fridge.iot_mac_address || null,
        fridge.c_number || null,
      ],
    );

    await client.query("COMMIT");
    logAssetAction("mobile-verify:mismatch-created", `serial=${fridge_serial_number} reason=VALUE_MISMATCH`);
    return res.status(200).json({
      ok: false,
      result: "MISMATCH_CREATED",
      reason: "VALUE_MISMATCH",
      mismatch: mismatch.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return handleAssetError(res, "mobile-verify", error);
  } finally {
    client.release();
  }
});

app.post("/mismatches/manual", requireAuth, requirePermission("device_checker.submit"), async (req, res) => {
  const client = await pool.connect();
  try {
    const serial = String(req.body?.fridge_serial_number || "").trim();
    const mac = String(req.body?.mac_address || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase().slice(0, 12);
    const cNum = String(req.body?.c_number || "").trim().toUpperCase().slice(0, 10);

    if (!serial) {
      return res.status(400).json({ error: "fridge_serial_number is required" });
    }

    if (!mac || !cNum) {
      return res.status(400).json({ error: "mac_address and c_number are required" });
    }

    logAssetAction(
      "submit-manual-mismatch:start",
      `serial=${serial} byUser=${req.user?.id || "unknown"}`
    );

    await client.query("BEGIN");
    await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [
      String(req.user.id),
    ]);
    const scope = await resolveOrganisationScope(client, req.user, null);

    const fridgeRes = await client.query(
      `SELECT fridge_serial_number, iot_mac_address, c_number, verified
       FROM fridges
       WHERE fridge_serial_number = $1
         AND ($2::int IS NULL OR organisation_id = $2)`,
      [serial, scope.effectiveOrganisationId],
    );

    if (!fridgeRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Fridge not found" });
    }

    const fridge = fridgeRes.rows[0];
    const norm = (value) => String(value || "").trim().toUpperCase();
    const macMatches = norm(fridge.iot_mac_address) === norm(mac);
    const cMatches = norm(fridge.c_number) === norm(cNum);

    if (macMatches && cMatches) {
      const updatedFridge = await client.query(
        `UPDATE fridges
         SET verified = true,
             verified_at = NOW()
         WHERE fridge_serial_number = $1
         RETURNING *`,
        [serial],
      );

      await client.query("COMMIT");
      logAssetAction("submit-manual-mismatch:verified", `serial=${serial}`);

      return res.status(200).json({
        ok: true,
        result: "VERIFIED",
        fridge_serial_number: serial,
        fridge: updatedFridge.rows[0],
      });
    }

    let updatedFridge = null;
    if (fridge.verified) {
      const updated = await client.query(
        `UPDATE fridges
         SET verified = false,
             verified_at = NOW()
         WHERE fridge_serial_number = $1
         RETURNING *`,
        [serial],
      );
      updatedFridge = updated.rows[0] || null;
    }

    const mismatchInsert = await client.query(
      `INSERT INTO fridge_mismatches
        (fridge_serial_number, received_mac, received_c_number, db_mac, db_c_number, status, sender_id)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING *`,
      [
        serial,
        mac || null,
        cNum || null,
        fridge.iot_mac_address || null,
        fridge.c_number || null,
        req.user.id
      ]
    );

    await client.query("COMMIT");
    logAssetAction("submit-manual-mismatch:success", `serial=${serial} id=${mismatchInsert.rows[0].id}`);
    
    return res.status(200).json({
      ok: true,
      result: "MISMATCH_CREATED",
      id: mismatchInsert.rows[0].id,
      fridge_serial_number: mismatchInsert.rows[0].fridge_serial_number,
      mismatch: mismatchInsert.rows[0],
      fridge: updatedFridge,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "submit-manual-mismatch", error);
  } finally {
    client.release();
  }
});

app.get("/mismatches", requireAuth, requirePermission("mismatches.view"), async (req, res) => {
  const client = await pool.connect();
  try {
    const rawStatus = String(req.query.status || "open").trim().toLowerCase();
    const scope = await resolveOrganisationScope(client, req.user, req.query.organisation_id);
    logAssetAction(
      "list-mismatches:start",
      `status=${rawStatus} orgFilter=${scope.effectiveOrganisationId ?? "all"}`,
    );
    const from = req.query.from || null;
    const to = req.query.to || null;
    const serial = String(req.query.serial || "").trim();

    const filters = [];
    const params = [];
    let index = 1;

    let statusAliases = [];
    if (rawStatus === "all") {
      statusAliases = [];
    } else if (rawStatus === "open") {
      statusAliases = ["open"];
    } else if (rawStatus === "resolve" || rawStatus === "resolved") {
      statusAliases = ["resolve", "resolved"];
    } else if (rawStatus === "cancel" || rawStatus === "cancelled" || rawStatus === "canceled") {
      statusAliases = ["cancel", "cancelled", "canceled"];
    } else if (rawStatus === "delete" || rawStatus === "deleted") {
      statusAliases = ["delete", "deleted"];
    } else {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    if (statusAliases.length) {
      filters.push(`LOWER(fm.status::text) = ANY($${index++}::text[])`);
      params.push(statusAliases);
    }

    if (from) {
      filters.push(`fm.received_at >= $${index++}::timestamptz`);
      params.push(`${from}T00:00:00Z`);
    }

    if (to) {
      filters.push(`fm.received_at <= $${index++}::timestamptz`);
      params.push(`${to}T23:59:59Z`);
    }

    if (serial) {
      filters.push(`fm.fridge_serial_number ILIKE $${index++}`);
      params.push(`%${serial}%`);
    }

    const orgParamIndex = index++;
    filters.push(`($${orgParamIndex}::int IS NULL OR f.organisation_id = $${orgParamIndex})`);
    params.push(scope.effectiveOrganisationId);

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await client.query(
      `SELECT fm.*,
              fm.db_mac AS expected_mac,
              fm.db_c_number AS expected_c_number
       FROM fridge_mismatches fm
       LEFT JOIN fridges f ON f.fridge_serial_number = fm.fridge_serial_number
       ${where}
       ORDER BY fm.received_at DESC
       LIMIT 500`,
      params,
    );

    logAssetAction("list-mismatches:success", `count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "list-mismatches", error);
  } finally {
    client.release();
  }
});

app.put("/mismatches/:id/resolve", requireAuth, requirePermission("mismatches.resolve"), async (req, res) => {
  const client = await pool.connect();
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

    await client.query("BEGIN");
    const scope = await resolveOrganisationScope(client, req.user, null);

    const mismatchResult = await client.query(
      `SELECT fm.*
       FROM fridge_mismatches fm
       LEFT JOIN fridges f ON f.fridge_serial_number = fm.fridge_serial_number
       WHERE fm.id = $1
         AND ($2::int IS NULL OR f.organisation_id = $2)`,
      [mismatchId, scope.effectiveOrganisationId],
    );

    if (!mismatchResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Mismatch not found" });
    }

    const mismatch = mismatchResult.rows[0];
    await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [String(req.user.id)]);

    const newMac = mismatch.received_mac ? String(mismatch.received_mac).trim().toUpperCase() : null;
    const newC = mismatch.received_c_number ? String(mismatch.received_c_number).trim().toUpperCase() : null;

    const updateFridge = await client.query(
      `UPDATE fridges
       SET iot_mac_address = COALESCE($1, iot_mac_address),
           c_number = COALESCE($2, c_number),
           verified = true,
           verified_at = NOW()
       WHERE fridge_serial_number = $3
       RETURNING *`,
      [newMac, newC, mismatch.fridge_serial_number],
    );

    const fridgeUpdated = updateFridge.rows[0] || null;

    const resolved = await client.query(
      `UPDATE fridge_mismatches
       SET status = 'resolve',
           resolved_at = NOW(),
           resolved_by = $1,
           resolution_note = COALESCE(NULLIF($2, ''), resolution_note)
       WHERE id = $3
       RETURNING *`,
      [req.user.id, String(note || "").trim(), mismatchId],
    );

    await client.query("COMMIT");

    logAssetAction("resolve-mismatch:success", `id=${req.params.id || "unknown"}`);

    return res.json({
      ok: true,
      mismatch: resolved.rows[0],
      fridge: fridgeUpdated,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "resolve-mismatch", error);
  } finally {
    client.release();
  }
});

app.delete("/mismatches/:id", requireAuth, requirePermission("mismatches.delete"), async (req, res) => {
  const client = await pool.connect();
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

    const scope = await resolveOrganisationScope(client, req.user, null);
    const mismatchResult = await client.query(
      `SELECT fm.id
       FROM fridge_mismatches fm
       LEFT JOIN fridges f ON f.fridge_serial_number = fm.fridge_serial_number
       WHERE fm.id = $1
         AND ($2::int IS NULL OR f.organisation_id = $2)`,
      [mismatchId, scope.effectiveOrganisationId],
    );

    if (!mismatchResult.rows.length) {
      return res.status(404).json({ error: "Mismatch not found" });
    }

    const result = await client.query(
      `UPDATE fridge_mismatches
       SET status = 'delete',
           resolved_at = NOW(),
           resolved_by = $1,
           resolution_note = $2
       WHERE id = $3
       RETURNING *`,
      [req.user.id, note, mismatchId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Mismatch not found" });
    }

    logAssetAction("delete-mismatch:success", `id=${req.params.id || "unknown"}`);
    return res.json({ ok: true, mismatch: result.rows[0] });
  } catch (error) {
    if (error?.code === "INVALID_ORGANISATION_FILTER" || error?.code === "USER_ORGANISATION_REQUIRED") {
      return res.status(400).json({ error: error.message });
    }
    return handleAssetError(res, "delete-mismatch", error);
  } finally {
    client.release();
  }
});

app.use((req, res) => {
  return res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, () => {
  console.log(`operations-api started on port ${PORT}`);
});
