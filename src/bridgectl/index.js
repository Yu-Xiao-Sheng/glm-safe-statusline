const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { getRuntimePaths, getSocketConfig } = require('../shared/socket');

function readPid(pidPath) {
  if (!fs.existsSync(pidPath)) {
    return null;
  }

  const pid = Number(fs.readFileSync(pidPath, 'utf8').trim());
  return Number.isInteger(pid) ? pid : null;
}

function isProcessAlive(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getBridgeStatus(options = {}) {
  const runtimePaths = options.runtimePaths || getRuntimePaths();
  const socketConfig = options.socketConfig || getSocketConfig();
  const pid = readPid(runtimePaths.pidPath);
  const running = isProcessAlive(pid);
  const socketPresent = socketConfig.mode === 'unix'
    ? fs.existsSync(runtimePaths.socketPath)
    : false;

  if (!running) {
    return {
      running: false,
      pid: pid || null,
      socketPresent,
      message: 'Bridge is not running',
    };
  }

  return {
    running: true,
    pid,
    socketPresent,
    message: socketPresent ? 'Bridge is running' : 'Bridge process is running without a socket',
  };
}

function stopBridge(options = {}) {
  const runtimePaths = options.runtimePaths || getRuntimePaths();
  const pid = readPid(runtimePaths.pidPath);

  if (!pid || !isProcessAlive(pid)) {
    fs.rmSync(runtimePaths.pidPath, { force: true });
    return false;
  }

  process.kill(pid, 'SIGTERM');
  return true;
}

function startBridge(options = {}) {
  const runtimePaths = options.runtimePaths || getRuntimePaths();
  const status = getBridgeStatus(options);
  if (status.running) {
    return status;
  }

  fs.mkdirSync(runtimePaths.stateDir, { recursive: true, mode: 0o700 });
  const logFd = fs.openSync(runtimePaths.logPath, 'a', 0o600);
  const bridgeEntry = path.join(__dirname, '../../bin/glm-safe-bridge.js');
  const child = spawn(process.execPath, [bridgeEntry], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: options.env || process.env,
  });

  child.unref();
  return {
    running: true,
    pid: child.pid,
    socketPresent: false,
    message: 'Bridge start requested',
  };
}

function runCli(args = process.argv.slice(2), options = {}) {
  const command = args[0] || 'status';

  if (command === 'start') {
    const result = startBridge(options);
    return `${result.message}${result.pid ? ` (pid ${result.pid})` : ''}`;
  }

  if (command === 'stop') {
    return stopBridge(options) ? 'Bridge stop requested' : 'Bridge is not running';
  }

  const status = getBridgeStatus(options);
  return status.message;
}

module.exports = {
  getBridgeStatus,
  isProcessAlive,
  readPid,
  runCli,
  startBridge,
  stopBridge,
};
