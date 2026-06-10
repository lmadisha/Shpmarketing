const { exec } = require("node:child_process");
const { EventEmitter } = require("node:events");
const { syncBuiltinESMExports } = require("node:module");
const childProcess = require("node:child_process");

function findCallback(args) {
  for (let i = args.length - 1; i >= 0; i -= 1) {
    if (typeof args[i] === "function") {
      return args[i];
    }
  }
  return null;
}

function createNoopChildProcess() {
  const fake = new EventEmitter();
  fake.pid = undefined;
  fake.stdin = null;
  fake.stdout = null;
  fake.stderr = null;
  fake.kill = () => true;
  return fake;
}

childProcess.exec = function patchedExec(command, ...args) {
  try {
    return exec.call(this, command, ...args);
  } catch (error) {
    const normalizedCommand = typeof command === "string" ? command.trim().toLowerCase() : "";
    const isWindowsNetUse = process.platform === "win32" && normalizedCommand === "net use";

    if (!isWindowsNetUse || !error || error.code !== "EPERM") {
      throw error;
    }

    const callback = findCallback(args);
    if (callback) {
      process.nextTick(() => callback(error, "", ""));
    }

    return createNoopChildProcess();
  }
};

syncBuiltinESMExports();
