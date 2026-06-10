const crypto = require("node:crypto");

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function normalizeMigrationContent(content) {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function checksumMigrationContent(content) {
  return hashContent(normalizeMigrationContent(content));
}

function getCompatibleMigrationChecksums(content) {
  const normalized = normalizeMigrationContent(content);
  const crlfNormalized = normalized.replace(/\n/g, "\r\n");

  return new Set([
    hashContent(content),
    hashContent(normalized),
    hashContent(crlfNormalized),
  ]);
}

function matchesMigrationChecksum(storedChecksum, content) {
  return getCompatibleMigrationChecksums(content).has(storedChecksum);
}

module.exports = {
  checksumMigrationContent,
  matchesMigrationChecksum,
  normalizeMigrationContent,
};
