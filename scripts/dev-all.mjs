import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const children = [];
const rootDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function startProcess(name, command, args, cwd = rootDir) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev-all] ${name} exited via signal ${signal}`);
      return;
    }

    if (code && code !== 0) {
      console.error(`[dev-all] ${name} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  children.push(child);
  return child;
}

function stopChildren(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => {
  stopChildren("SIGINT");
  process.exit(130);
});

process.on("SIGTERM", () => {
  stopChildren("SIGTERM");
  process.exit(143);
});

startProcess(
  "operations-api",
  process.execPath,
  ["server.js"],
  path.join(rootDir, "operations-api"),
);

startProcess(
  "analytics-api",
  process.execPath,
  ["server.js"],
  path.join(rootDir, "analytics-api"),
);

startProcess(
  "frontend",
  process.execPath,
  [
    path.join(rootDir, "node_modules", "nuxt", "bin", "nuxt.mjs"),
    "dev",
    "--host",
    "192.168.0.121",
    "--port",
    "5174",
  ],
);
