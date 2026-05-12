const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("POST /placements accepts full and scan-only placement permissions", () => {
  const serverSource = fs.readFileSync(
    path.join(__dirname, "..", "server.js"),
    "utf8",
  );

  assert.match(
    serverSource,
    /app\.post\("\/placements",\s*requireAuth,\s*requireAnyPermission\(\["placement\.submit", "placement\.submit_scan_only"\]\)/,
  );
});
