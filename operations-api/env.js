const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

function summarizeDatabaseEnv(env) {
  const summary = {
    OPS_DB_USER: env.OPS_DB_USER || null,
    OPS_DB_HOST: env.OPS_DB_HOST || null,
    OPS_DB_PORT: env.OPS_DB_PORT || null,
    OPS_DB_NAME: env.OPS_DB_NAME || null,
    DATABASE_URL: null,
  };

  if (!env.DATABASE_URL) {
    return summary;
  }

  try {
    const parsed = new URL(env.DATABASE_URL);
    summary.DATABASE_URL = {
      protocol: parsed.protocol.replace(/:$/, ""),
      user: parsed.username || null,
      password: parsed.password ? "<redacted>" : null,
      host: parsed.hostname || null,
      port: parsed.port || null,
      database: parsed.pathname.replace(/^\//, "") || null,
    };
  } catch {
    summary.DATABASE_URL = "<invalid DATABASE_URL>";
  }

  return summary;
}

console.info("[ops-db] Loaded database env:", summarizeDatabaseEnv(process.env));

module.exports = process.env;
