require("./env");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Client } = require("pg");
const {
  checksumMigrationContent,
  matchesMigrationChecksum,
} = require("./database/migration-checksum");

const MIGRATIONS_DIR = path.join(__dirname, "database", "migrations");
const MIGRATION_TABLE = "public.frostlink_migrations";
const LOCK_KEY = 813245901;
const MAX_CONNECT_ATTEMPTS = Number(process.env.MIGRATION_CONNECT_RETRIES || 30);
const CONNECT_RETRY_DELAY_MS = Number(process.env.MIGRATION_CONNECT_RETRY_DELAY_MS || 2000);
const DIRECTION = process.argv.includes("--down") ? "down" : "up";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMigrationFile(content) {
  const upMatch = content.match(/--\s*UP\s*\n([\s\S]*?)(?=--\s*DOWN|$)/i);
  const downMatch = content.match(/--\s*DOWN\s*\n([\s\S]*?)$/i);

  const up = upMatch ? upMatch[1].trim() : "";
  const down = downMatch ? downMatch[1].trim() : "";

  if (!up) {
    throw new Error("Migration file must contain -- UP section");
  }

  return { up, down };
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
      direction TEXT NOT NULL DEFAULT 'up',
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
  try {
    const result = await client.query(`SELECT file_name, checksum FROM ${MIGRATION_TABLE}`);
    return new Map(result.rows.map((row) => [row.file_name, row.checksum]));
  } catch (err) {
    // Table might not exist yet on first run
    if (err.message.includes("does not exist")) {
      return new Map();
    }
    throw err;
  }
}

async function applyMigration(client, fileName) {
  const fullPath = path.join(MIGRATIONS_DIR, fileName);
  const content = await fs.readFile(fullPath, "utf8");
  const fileChecksum = checksumMigrationContent(content);
  const { up, down } = parseMigrationFile(content);

  let existing;
  try {
    existing = await client.query(
      `SELECT checksum, direction FROM ${MIGRATION_TABLE} WHERE file_name = $1`,
      [fileName],
    );
  } catch (err) {
    // If direction column doesn't exist, query without it (for old schema)
    if (err.message.includes('column "direction" does not exist')) {
      existing = await client.query(
        `SELECT checksum FROM ${MIGRATION_TABLE} WHERE file_name = $1`,
        [fileName],
      );
      // Add direction field for compatibility
      if (existing.rowCount > 0) {
        existing.rows[0].direction = 'up';
      }
    } else {
      throw err;
    }
  }

  if (existing.rowCount > 0) {
    const row = existing.rows[0];
    if (!matchesMigrationChecksum(row.checksum, content)) {
      throw new Error(`Migration ${fileName} already applied with different checksum.`);
    }
    if (row.direction === DIRECTION) {
      if (row.checksum !== fileChecksum) {
        await client.query(
          `UPDATE ${MIGRATION_TABLE} SET checksum = $1, applied_at = now() WHERE file_name = $2`,
          [fileChecksum, fileName],
        );
        console.log(`[migrations] normalized checksum: ${fileName}`);
      }
      console.log(`[migrations] already ${DIRECTION}: ${fileName}`);
      return;
    }
  }

  const sql = DIRECTION === "up" ? up : down;
  if (!sql) {
    throw new Error(`Migration ${fileName} missing -- ${DIRECTION.toUpperCase()} section`);
  }

  console.log(`[migrations] running ${DIRECTION}: ${fileName}`);
  try {
    await client.query("SET search_path TO frostlink, public");
    await client.query(sql);
  } catch (err) {
    throw new Error(`Failed to execute ${DIRECTION} for ${fileName}: ${err.message}`);
  }

  if (DIRECTION === "up") {
    if (existing.rowCount > 0) {
      await client.query(
        `UPDATE ${MIGRATION_TABLE} SET checksum = $1, direction = 'up', applied_at = now() WHERE file_name = $2`,
        [fileChecksum, fileName],
      );
    } else {
      await client.query(
        `INSERT INTO ${MIGRATION_TABLE} (file_name, checksum, direction) VALUES ($1, $2, 'up')`,
        [fileName, fileChecksum],
      );
    }
  } else {
    // On rollback, remove the migration record to allow re-applying it later
    await client.query(
      `DELETE FROM ${MIGRATION_TABLE} WHERE file_name = $1`,
      [fileName],
    );
  }

  console.log(`[migrations] ${DIRECTION}: ${fileName}`);
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

    let files = await listMigrationFiles();
    if (!files.length) {
      console.log("[migrations] no migration files found, nothing to do.");
      return;
    }

    console.log(`[migrations] direction: ${DIRECTION}`);
    const applied = await getAppliedMigrations(client);
    console.log(`[migrations] discovered ${files.length} migration file(s), ${applied.size} already recorded.`);

    if (DIRECTION === "down") {
      files = files.reverse();
    }

    for (const fileName of files) {
      await applyMigration(client, fileName);
    }

    const action = DIRECTION === "up" ? "applied" : "rolled back";
    console.log(`[migrations] all pending migrations have been ${action}.`);
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
