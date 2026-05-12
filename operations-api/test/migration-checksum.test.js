const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  checksumMigrationContent,
  matchesMigrationChecksum,
} = require("../database/migration-checksum");

function legacyChecksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

test("migration checksums stay stable across LF and CRLF line endings", () => {
  const lfContent = [
    "-- Description: Create fridge_placement table",
    "-- UP",
    "CREATE TABLE frostlink.fridge_placement (id BIGSERIAL PRIMARY KEY);",
    "-- DOWN",
    "DROP TABLE frostlink.fridge_placement;",
  ].join("\n");
  const crlfContent = lfContent.replace(/\n/g, "\r\n");

  assert.equal(
    checksumMigrationContent(lfContent),
    checksumMigrationContent(crlfContent),
  );

  assert.equal(
    matchesMigrationChecksum(legacyChecksum(lfContent), crlfContent),
    true,
  );
  assert.equal(
    matchesMigrationChecksum(legacyChecksum(crlfContent), lfContent),
    true,
  );
});
