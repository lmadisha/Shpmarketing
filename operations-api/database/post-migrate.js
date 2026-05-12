#!/usr/bin/env node
/**
 * Post-migration hook: automatically extracts and updates schema documentation
 * Run after migrations complete: node database/post-migrate.js
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const schemaScriptPath = path.join(__dirname, "extract-schema.js");

try {
  console.log("[post-migrate] Extracting schema documentation...");
  execSync(`node "${schemaScriptPath}"`, { stdio: "inherit" });
  console.log("[post-migrate] Schema documentation updated");
} catch (err) {
  console.error("[post-migrate] Failed to update schema:", err.message);
  process.exit(1);
}
