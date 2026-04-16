const fs = require('node:fs');
const path = require('node:path');

const { getRuntimePaths, getSocketConfig } = require('../shared/socket');

const DEFAULT_QUOTA_ENDPOINT = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit';
const ALLOWED_HOST = 'open.bigmodel.cn';
const ALLOWED_PATH = '/api/monitor/usage/quota/limit';
const DEFAULT_REFRESH_INTERVAL_MS = 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 3 * 1000;

function assertAllowedQuotaEndpoint(endpoint) {
  const parsed = new URL(endpoint);
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== ALLOWED_HOST ||
    parsed.pathname !== ALLOWED_PATH
  ) {
    throw new Error('Quota endpoint is not in the allowlist');
  }
}

function loadBridgeFileConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function loadBridgeConfig(options = {}) {
  const env = options.env || process.env;
  const homedir = options.homedir;
  const runtimePaths = getRuntimePaths({ homedir });
  const configPath = env.GLM_SAFE_BRIDGE_CONFIG ||
    path.join(runtimePaths.stateDir, 'bridge.config.json');
  const fileConfig = loadBridgeFileConfig(configPath);
  const quotaEndpoint = env.GLM_SAFE_BRIDGE_QUOTA_ENDPOINT ||
    fileConfig.quotaEndpoint ||
    DEFAULT_QUOTA_ENDPOINT;

  assertAllowedQuotaEndpoint(quotaEndpoint);

  return {
    authToken: env.GLM_SAFE_BRIDGE_AUTH_TOKEN || fileConfig.authToken || '',
    quotaEndpoint,
    refreshIntervalMs: Number(env.GLM_SAFE_BRIDGE_REFRESH_MS) ||
      fileConfig.refreshIntervalMs ||
      DEFAULT_REFRESH_INTERVAL_MS,
    requestTimeoutMs: Number(env.GLM_SAFE_BRIDGE_TIMEOUT_MS) ||
      fileConfig.requestTimeoutMs ||
      DEFAULT_REQUEST_TIMEOUT_MS,
    runtimePaths,
    socketConfig: getSocketConfig({ env, homedir, platform: options.platform }),
  };
}

module.exports = {
  ALLOWED_HOST,
  ALLOWED_PATH,
  DEFAULT_QUOTA_ENDPOINT,
  assertAllowedQuotaEndpoint,
  loadBridgeConfig,
};
