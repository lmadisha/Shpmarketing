require("./env");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const MIGRATION_TABLE = "public.frostlink_migrations";
const LOCK_KEY = 813245901;
const MAX_CONNECT_ATTEMPTS = Number(process.env.MIGRATION_CONNECT_RETRIES || 30);
const CONNECT_RETRY_DELAY_MS = Number(process.env.MIGRATION_CONNECT_RETRY_DELAY_MS || 2000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function connectWithRetry(client) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
    try {
      await client.connect();
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[migrations] database not ready (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS}): ${error.message}`);
      if (attempt < MAX_CONNECT_ATTEMPTS) {
        await sleep(CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      file_name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function listMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrations(client) {
  const result = await client.query(`SELECT file_name, checksum FROM ${MIGRATION_TABLE}`);
  return new Map(result.rows.map((row) => [row.file_name, row.checksum]));
}

async function applyMigration(client, fileName) {
  const fullPath = path.join(MIGRATIONS_DIR, fileName);
  const sql = await fs.readFile(fullPath, "utf8");
  const fileChecksum = checksum(sql);

  const existing = await client.query(
    `SELECT checksum FROM ${MIGRATION_TABLE} WHERE file_name = $1`,
    [fileName],
  );

  if (existing.rowCount > 0) {
    const existingChecksum = existing.rows[0].checksum;
    if (existingChecksum !== fileChecksum) {
      throw new Error(`Migration ${fileName} already applied with different checksum.`);
    }
    console.log(`[migrations] already applied: ${fileName}`);
    return;
  }

  console.log(`[migrations] applying: ${fileName}`);
  await client.query("SET search_path TO frostlink, public");
  await client.query(sql);
  await client.query(
    `INSERT INTO ${MIGRATION_TABLE} (file_name, checksum) VALUES ($1, $2)`,
    [fileName, fileChecksum],
  );
  console.log(`[migrations] applied: ${fileName}`);
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for running migrations.");
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await connectWithRetry(client);
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await ensureMigrationTable(client);

    const files = await listMigrationFiles();
    if (!files.length) {
      console.log("[migrations] no migration files found, nothing to do.");
      return;
    }

    const applied = await getAppliedMigrations(client);
    console.log(`[migrations] discovered ${files.length} migration file(s), ${applied.size} already recorded.`);

    for (const fileName of files) {
      await applyMigration(client, fileName);
    }

    console.log("[migrations] all pending migrations have been applied.");
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } catch {
      // no-op; connection might already be closed
    }
    await client.end().catch(() => {});
  }
}

run().catch((error) => {
  console.error(`[migrations] failed: ${error.message}`);
  process.exit(1);
});
