require("./env");
const { Pool } = require("pg");

function resolveDbHost(host) {
  if (String(host || "").trim().toLowerCase() === "localhost") {
    return "127.0.0.1";
  }

  return host;
}

const configuredHost = process.env.OPS_DB_HOST;
const resolvedHost = resolveDbHost(configuredHost);

if (resolvedHost !== configuredHost) {
  console.warn(`[ops-db] Normalized OPS_DB_HOST from ${configuredHost} to ${resolvedHost}`);
}

const pool = new Pool({
  user: process.env.OPS_DB_USER,
  password: process.env.OPS_DB_PASSWORD,
  host: resolvedHost,
  port: Number(process.env.OPS_DB_PORT || 5432),
  database: process.env.OPS_DB_NAME,
});

pool.on("error", (error) => {
  console.error(`[ops-db] Unexpected idle client error: ${error.message}`);
});

async function verifyDatabaseConnection() {
  let client;

  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    console.info(
      `[ops-db] Database connection verified for ${process.env.OPS_DB_NAME} at ${resolvedHost}:${process.env.OPS_DB_PORT || 5432}`,
    );
  } catch (error) {
    console.error(`[ops-db] Failed to connect: ${error.message}`);
    console.error("[ops-db] Connection config:", {
      OPS_DB_USER: process.env.OPS_DB_USER,
      OPS_DB_HOST: configuredHost,
      OPS_DB_HOST_EFFECTIVE: resolvedHost,
      OPS_DB_PORT: process.env.OPS_DB_PORT,
      OPS_DB_NAME: process.env.OPS_DB_NAME,
    });
  } finally {
    client?.release();
  }
}

verifyDatabaseConnection();

module.exports = pool;
