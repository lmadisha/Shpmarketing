'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

try {
  require('dotenv').config();
} catch {}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const BOOTSTRAP_SQL = `
  CREATE TABLE IF NOT EXISTS frostlink.schema_migrations (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`;

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // Bootstrap: ensure tracking table exists
    await client.query(BOOTSTRAP_SQL);

    // Fetch already-applied migrations
    const { rows } = await client.query(
      'SELECT name FROM frostlink.schema_migrations ORDER BY name'
    );
    const applied = new Set(rows.map((r) => r.name));

    // Collect and sort migration files
    let files;
    try {
      files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    } catch {
      console.error(`migrations/ directory not found at ${MIGRATIONS_DIR}`);
      process.exit(1);
    }

    let ran = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`  run   ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO frostlink.schema_migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    if (ran === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`Applied ${ran} migration(s).`);
    }
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
