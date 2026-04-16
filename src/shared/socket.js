const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_TCP_PORT,
  LOG_FILE_NAME,
  PID_FILE_NAME,
  SOCKET_FILE_NAME,
  STATE_DIR_NAME,
} = require('./constants');

function getStateDir(options = {}) {
  const homedir = options.homedir || os.homedir();
  return path.join(homedir, STATE_DIR_NAME);
}

function getRuntimePaths(options = {}) {
  const stateDir = getStateDir(options);

  return {
    stateDir,
    socketPath: path.join(stateDir, SOCKET_FILE_NAME),
    pidPath: path.join(stateDir, PID_FILE_NAME),
    logPath: path.join(stateDir, LOG_FILE_NAME),
  };
}

function getSocketConfig(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const runtimePaths = getRuntimePaths(options);
  const forcedMode = env.GLM_SAFE_BRIDGE_MODE;

  if (forcedMode === 'tcp' || platform === 'win32') {
    return {
      mode: 'tcp',
      host: '127.0.0.1',
      port: Number(env.GLM_SAFE_BRIDGE_PORT) || DEFAULT_TCP_PORT,
      socketPath: null,
      stateDir: runtimePaths.stateDir,
    };
  }

  return {
    mode: 'unix',
    host: null,
    port: null,
    socketPath: runtimePaths.socketPath,
    stateDir: runtimePaths.stateDir,
  };
}

module.exports = {
  getRuntimePaths,
  getSocketConfig,
  getStateDir,
};
