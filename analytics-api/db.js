const { Pool } = require("pg");

function resolveDbHost(host) {
  if (String(host || "").trim().toLowerCase() === "localhost") {
    return "127.0.0.1";
  }
  return host;
}

const configuredHost = process.env.ANALYTICS_DB_HOST;
const resolvedHost = resolveDbHost(configuredHost);

if (resolvedHost !== configuredHost) {
  console.warn(`[analytics-db] Normalized ANALYTICS_DB_HOST from ${configuredHost} to ${resolvedHost}`);
}

const pool = new Pool({
  user: process.env.ANALYTICS_DB_USER,
  password: process.env.ANALYTICS_DB_PASSWORD,
  host: resolvedHost,
  port: Number(process.env.ANALYTICS_DB_PORT || 5432),
  database: process.env.ANALYTICS_DB_NAME,
});

pool.on("error", (error) => {
  console.error(`[analytics-db] Unexpected idle client error: ${error.message}`);
});

async function verifyConnection() {
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    console.info(
      `[analytics-db] Connection verified for ${process.env.ANALYTICS_DB_NAME} at ${resolvedHost}:${process.env.ANALYTICS_DB_PORT || 5432}`,
    );
  } catch (error) {
    console.error(`[analytics-db] Failed to connect: ${error.message}`);
  } finally {
    client?.release();
  }
}

verifyConnection();

module.exports = pool;
