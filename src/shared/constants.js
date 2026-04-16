const SNAPSHOT_STATUS = Object.freeze({
  FRESH: 'fresh',
  STALE: 'stale',
  UNAVAILABLE: 'unavailable',
  // New error statuses
  NO_TOKEN: 'no_token',
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network_error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  CLIENT_ERROR: 'client_error',
  SERVER_ERROR: 'server_error',
  INVALID_RESPONSE: 'invalid_response',
});

const VALID_PLAN_LEVELS = new Set(['lite', 'pro', 'max', 'unknown']);
const STATE_DIR_NAME = '.glm-safe-statusline';
const SOCKET_FILE_NAME = 'bridge.sock';
const PID_FILE_NAME = 'bridge.pid';
const LOG_FILE_NAME = 'bridge.log';
const DEFAULT_TCP_PORT = 45219;

module.exports = {
  DEFAULT_TCP_PORT,
  LOG_FILE_NAME,
  PID_FILE_NAME,
  SNAPSHOT_STATUS,
  SOCKET_FILE_NAME,
  STATE_DIR_NAME,
  VALID_PLAN_LEVELS,
};
