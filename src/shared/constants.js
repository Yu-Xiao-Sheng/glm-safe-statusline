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

module.exports = {
  SNAPSHOT_STATUS,
  VALID_PLAN_LEVELS,
};
