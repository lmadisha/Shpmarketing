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

function requireAdmin(req, res, next) {
  if (!req.user || req.user.permissions !== "Admin") {
    return res.status(403).json({ error: "Admin permission required" });
  }
  return next();
}

function requireMobileKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== MOBILE_API_KEY) {
    return res.status(401).json({ error: "Invalid mobile api key" });
  }
  return next();
}

function normalizePermission(value) {
  const permission = String(value || "").trim();
  return ["Admin", "Intermediate", "Basic"].includes(permission) ? permission : null;
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
  return String(value || "").trim();
}

function sanitizeBulkMac(value) {
  const cleaned = String(value || "")
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase();
  return cleaned.length === 12 ? cleaned : null;
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

app.post("/signup", loginLimiter, async (req, res) => {
  try {
    const { username, password, full_name, permissions } = req.body;

    if (!username || !password || !full_name || !permissions) {
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
    const passwordHash = await bcrypt.hash(String(password), 12);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, permissions, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, username, full_name, permissions, is_active`,
      [email, passwordHash, name, normalizedPermission],
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
      `SELECT id, username, password_hash, is_active, full_name, permissions
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
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, permissions, is_active, created_at
       FROM users
       ORDER BY created_at DESC`,
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.post("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, full_name, permissions } = req.body;

    if (!username || !password || !full_name || !permissions) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedPermission = normalizePermission(permissions);
    if (!normalizedPermission) {
      return res.status(400).json({ error: "Invalid permissions value" });
    }

    const email = String(username).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(String(password), 12);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, permissions, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, username, full_name, permissions, is_active, created_at`,
      [email, passwordHash, String(full_name).trim(), normalizedPermission],
    );

    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That email/username already exists" });
    }
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.put("/users/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const permission = normalizePermission(req.body.permissions);
    if (!permission) {
      return res.status(400).json({ error: "Invalid permissions value" });
    }

    const result = await pool.query(
      `UPDATE users
       SET permissions = $1
       WHERE id = $2
       RETURNING id, username, full_name, permissions, is_active, created_at`,
      [permission, req.params.id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.put("/users/:id/password", requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const isSelf = req.user.id === targetId;
    const isAdmin = req.user.permissions === "Admin";

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const nextPassword = String(req.body.new_password || "");
    if (nextPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(nextPassword, 12);
    const result = await pool.query(
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
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.post("/newDevice", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { mac_address, fridge_serial_number, c_number } = req.body;
    logAssetAction("create-device:start", `serial=${fridge_serial_number || "unknown"} byUser=${req.user?.id || "unknown"}`);

    await client.query("BEGIN");
    await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [
      String(req.user.id),
    ]);

    const result = await client.query(
      `INSERT INTO fridges (iot_mac_address, fridge_serial_number, c_number)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [mac_address, fridge_serial_number, c_number],
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

app.post("/newDevice/bulk", requireAuth, (req, res) => {
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

    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [String(req.user.id)]);

      for (const row of validRows) {
        try {
          const result = await client.query(
            `INSERT INTO fridges (iot_mac_address, fridge_serial_number, c_number)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [row.mac_address, row.fridge_serial_number, row.c_number],
          );
          inserted.push(result.rows[0]);
        } catch (error) {
          if (error.code === "23505") {
            errors.push({
              rowNumber: row.rowNumber,
              serial: row.fridge_serial_number,
              reason: "DUPLICATE_IN_DB",
              message: "Fridge already exists.",
            });
            continue;
          }
          throw error;
        }
      }

      await client.query("COMMIT");
      logAssetAction(
        "bulk-upload:success",
        `file=${file.originalname || "unknown"} inserted=${inserted.length} failed=${errors.length}`,
      );
      return res.json({
        ok: true,
        summary: {
          totalRows: parsedRows.length,
          excludedRows,
          validRows: validRows.length,
          insertedRows: inserted.length,
          failedRows: errors.length,
        },
        inserted,
        errors,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return handleAssetError(res, "bulk-upload", error);
    } finally {
      client.release();
    }
  });
});

app.post("/newDevice/bulk/preview", requireAuth, (req, res) => {
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

app.get("/getFridges", requireAuth, async (_req, res) => {
  try {
    logAssetAction("list-fridges:start");
    const result = await pool.query("SELECT * FROM fridges ORDER BY fridge_serial_number ASC");
    logAssetAction("list-fridges:success", `count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    return handleAssetError(res, "list-fridges", error);
  }
});

app.get("/searchFridges", requireAuth, async (req, res) => {
  try {
    const searchTerm = String(req.query.searchTerm || "");
    logAssetAction("search-fridges:start", `term=${searchTerm}`);
    const formattedSearch = `%${searchTerm}%`;

    const result = await pool.query(
      `SELECT * FROM fridges
       WHERE iot_mac_address ILIKE $1
          OR fridge_serial_number ILIKE $1
          OR c_number ILIKE $1
       ORDER BY fridge_serial_number ASC`,
      [formattedSearch],
    );

    logAssetAction("search-fridges:success", `count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    return handleAssetError(res, "search-fridges", error);
  }
});

app.put("/updateDevice/:serialNumber", requireAuth, async (req, res) => {
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

    const result = await client.query(
      `UPDATE fridges
       SET iot_mac_address = COALESCE($1, iot_mac_address),
           c_number = COALESCE($2, c_number)
       WHERE fridge_serial_number = $3
       RETURNING *`,
      [req.body.mac_address, req.body.c_number, req.params.serialNumber],
    );

    await client.query("COMMIT");

    if (!result.rows.length) {
      return res.status(404).json({ error: "No fridge found with that serial number" });
    }

    logAssetAction("update-device:success", `serial=${req.params.serialNumber}`);
    return res.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return handleAssetError(res, "update-device", error);
  } finally {
    client.release();
  }
});

app.delete("/deleteDevice/:serialNumber", requireAuth, async (req, res) => {
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

    const result = await client.query(
      `DELETE FROM fridges
       WHERE fridge_serial_number = $1
       RETURNING *`,
      [req.params.serialNumber],
    );

    await client.query("COMMIT");

    if (!result.rows.length) {
      return res.status(404).json({ error: "Fridge not found" });
    }

    logAssetAction("delete-device:success", `serial=${req.params.serialNumber}`);
    return res.json({ message: "Fridge deleted successfully", device: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return handleAssetError(res, "delete-device", error);
  } finally {
    client.release();
  }
});

app.get("/auditLog/:serialNumber", requireAuth, async (req, res) => {
  try {
    logAssetAction("device-history:start", `serial=${req.params.serialNumber || "unknown"}`);
    const result = await pool.query(
      `SELECT *
       FROM fridge_audit_log
       WHERE UPPER(fridge_serial_number) = UPPER($1)
       ORDER BY changed_at DESC`,
      [req.params.serialNumber],
    );
    logAssetAction("device-history:success", `serial=${req.params.serialNumber || "unknown"} count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    return handleAssetError(res, "device-history", error);
  }
});

app.get("/auditLog", requireAuth, async (_req, res) => {
  try {
    logAssetAction("audit-history:start");
    const result = await pool.query(
      `SELECT *
       FROM fridge_audit_log
       ORDER BY changed_at DESC`,
    );
    logAssetAction("audit-history:success", `count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    return handleAssetError(res, "audit-history", error);
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

app.post("/mismatches/manual", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const fridge_serial_number = String(req.body?.fridge_serial_number || "").trim();
    const received_mac = String(req.body?.mac_address || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase().slice(0, 12);
    const received_c_number = String(req.body?.c_number || "").trim().toUpperCase().slice(0, 10);

    logAssetAction("manual-mismatch:start", `serial=${fridge_serial_number} byUser=${req.user?.id || "unknown"}`);

    if (!fridge_serial_number) {
      return res.status(400).json({ error: "fridge_serial_number is required." });
    }

    const fridgeRes = await client.query(
      `SELECT iot_mac_address, c_number FROM fridges WHERE fridge_serial_number = $1`,
      [fridge_serial_number],
    );

    if (!fridgeRes.rows.length) {
      return res.status(404).json({ error: "Fridge not found." });
    }

    const fridge = fridgeRes.rows[0];

    await client.query("BEGIN");
    await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [String(req.user.id)]);

    const inserted = await client.query(
      `INSERT INTO fridge_mismatches
        (fridge_serial_number, received_mac, received_c_number, db_mac, db_c_number, status, sender_id)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING *`,
      [
        fridge_serial_number,
        received_mac || null,
        received_c_number || null,
        fridge.iot_mac_address || null,
        fridge.c_number || null,
        req.user.id,
      ],
    );

    await client.query("COMMIT");

    logAssetAction("manual-mismatch:success", `id=${inserted.rows[0].id} serial=${fridge_serial_number}`);
    return res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return handleAssetError(res, "manual-mismatch", error);
  } finally {
    client.release();
  }
});

app.post("/mismatches/manual", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { fridge_serial_number, mac_address, c_number } = req.body;
    const serial = String(fridge_serial_number || "").trim();
    const mac = mac_address ? String(mac_address).trim().toUpperCase() : null;
    const cNum = c_number ? String(c_number).trim().toUpperCase() : null;

    if (!serial) {
      return res.status(400).json({ error: "fridge_serial_number is required" });
    }

    logAssetAction(
      "submit-manual-mismatch:start",
      `serial=${serial} byUser=${req.user?.id || "unknown"}`
    );

    await client.query("BEGIN");
    await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [
      String(req.user.id),
    ]);

    const fridgeRes = await client.query(
      `SELECT iot_mac_address, c_number
       FROM fridges
       WHERE fridge_serial_number = $1`,
      [serial]
    );

    if (!fridgeRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Fridge not found" });
    }

    const fridge = fridgeRes.rows[0];

    const mismatchInsert = await client.query(
      `INSERT INTO fridge_mismatches
        (fridge_serial_number, received_mac, received_c_number, db_mac, db_c_number, status, sender_id)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING *`,
      [
        serial,
        mac,
        cNum,
        fridge.iot_mac_address || null,
        fridge.c_number || null,
        req.user.id
      ]
    );

    await client.query("COMMIT");
    logAssetAction("submit-manual-mismatch:success", `serial=${serial} id=${mismatchInsert.rows[0].id}`);
    
    return res.status(200).json({
      ok: true,
      id: mismatchInsert.rows[0].id,
      fridge_serial_number: mismatchInsert.rows[0].fridge_serial_number,
      mismatch: mismatchInsert.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return handleAssetError(res, "submit-manual-mismatch", error);
  } finally {
    client.release();
  }
});

app.get("/mismatches", requireAuth, async (req, res) => {
  try {
    logAssetAction("list-mismatches:start", `status=${String(req.query.status || "open")}`);
    const status = String(req.query.status || "open").toLowerCase();
    const from = req.query.from || null;
    const to = req.query.to || null;
    const serial = String(req.query.serial || "").trim();

    const filters = [];
    const params = [];
    let index = 1;

    if (status !== "all") {
      filters.push(`status::text = $${index++}`);
      params.push(status);
    }

    if (from) {
      filters.push(`received_at >= $${index++}::timestamptz`);
      params.push(`${from}T00:00:00Z`);
    }

    if (to) {
      filters.push(`received_at <= $${index++}::timestamptz`);
      params.push(`${to}T23:59:59Z`);
    }

    if (serial) {
      filters.push(`fridge_serial_number ILIKE $${index++}`);
      params.push(`%${serial}%`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT *,
              db_mac AS expected_mac,
              db_c_number AS expected_c_number
       FROM fridge_mismatches
       ${where}
       ORDER BY received_at DESC
       LIMIT 500`,
      params,
    );

    logAssetAction("list-mismatches:success", `count=${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    return handleAssetError(res, "list-mismatches", error);
  }
});

app.put("/mismatches/:id/resolve", requireAuth, async (req, res) => {
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

    const { applyToFridge = false, setVerified = true, note = "" } = req.body;

    await client.query("BEGIN");

    const mismatchResult = await client.query(
      `SELECT *
       FROM fridge_mismatches
       WHERE id = $1`,
      [mismatchId],
    );

    if (!mismatchResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Mismatch not found" });
    }

    const mismatch = mismatchResult.rows[0];
    let fridgeUpdated = null;

    if (applyToFridge) {
      await client.query("SELECT set_config('myapp.current_user_id', $1, false)", [String(req.user.id)]);

      const newMac = mismatch.received_mac ? String(mismatch.received_mac).trim().toUpperCase() : null;
      const newC = mismatch.received_c_number
        ? String(mismatch.received_c_number).trim().toUpperCase()
        : null;

      const updateFridge = await client.query(
        `UPDATE fridges
         SET iot_mac_address = COALESCE($1, iot_mac_address),
             c_number = COALESCE($2, c_number),
             verified = CASE WHEN $3::boolean THEN true ELSE verified END,
             verified_at = CASE WHEN $3::boolean THEN NOW() ELSE verified_at END
         WHERE fridge_serial_number = $4
         RETURNING *`,
        [newMac, newC, Boolean(setVerified), mismatch.fridge_serial_number],
      );

      fridgeUpdated = updateFridge.rows[0] || null;
    }

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
    return handleAssetError(res, "resolve-mismatch", error);
  } finally {
    client.release();
  }
});

app.delete("/mismatches/:id", requireAuth, async (req, res) => {
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

    const result = await pool.query(
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
    return handleAssetError(res, "delete-mismatch", error);
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
