const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

function tryRequire(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return {};
  }
}

const runtime = tryRequire('../src/shared/runtime');
const schema = tryRequire('../src/shared/schema');
const socket = tryRequire('../src/shared/socket');

test('detectProviderRuntime recognizes GLM runtime context', () => {
  assert.equal(typeof runtime.detectProviderRuntime, 'function');

  const result = runtime.detectProviderRuntime({
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
    },
  });

  assert.deepEqual(result, {
    isGlm: true,
    provider: 'glm',
  });
});

test('detectProviderRuntime keeps non-GLM runtime on the base path', () => {
  assert.equal(typeof runtime.detectProviderRuntime, 'function');

  const result = runtime.detectProviderRuntime({
    env: {
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    },
  });

  assert.deepEqual(result, {
    isGlm: false,
    provider: 'unknown',
  });
});

test('sanitizeSnapshot validates the public bridge schema', () => {
  assert.equal(typeof schema.sanitizeSnapshot, 'function');

  const snapshot = schema.sanitizeSnapshot({
    status: 'fresh',
    plan_level: 'pro',
    token_usage_pct: 62.4,
    token_reset_at: 1776304080000,
    mcp_remaining: 680,
    mcp_total: 1000,
    snapshot_age_ms: 14000,
    fetched_at: 1776297280000,
    ignored_secret: 'must-not-pass-through',
  });

  assert.deepEqual(snapshot, {
    status: 'fresh',
    plan_level: 'pro',
    token_usage_pct: 62,
    token_reset_at: 1776304080000,
    mcp_remaining: 680,
    mcp_total: 1000,
    snapshot_age_ms: 14000,
    fetched_at: 1776297280000,
  });
});

test('sanitizeSnapshot rejects invalid statuses', () => {
  assert.equal(typeof schema.sanitizeSnapshot, 'function');
  assert.throws(() => {
    schema.sanitizeSnapshot({ status: 'broken' });
  }, /status/i);
});

test('getSocketConfig defaults to a local user-private unix socket path', () => {
  assert.equal(typeof socket.getSocketConfig, 'function');

  const config = socket.getSocketConfig({
    env: {},
    platform: 'linux',
    homedir: '/tmp/example-home',
  });

  assert.equal(config.mode, 'unix');
  assert.equal(config.host, null);
  assert.equal(config.port, null);
  assert.equal(
    config.socketPath,
    path.join('/tmp/example-home', '.glm-safe-statusline', 'bridge.sock'),
  );
});

test('getSocketConfig uses loopback tcp fallback on win32', () => {
  assert.equal(typeof socket.getSocketConfig, 'function');

  const config = socket.getSocketConfig({
    env: {},
    platform: 'win32',
    homedir: os.homedir(),
  });

  assert.equal(config.mode, 'tcp');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 45219);
  assert.equal(config.socketPath, null);
});

test('SNAPSHOT_STATUS includes all error states', () => {
  const { SNAPSHOT_STATUS } = require('../src/shared/constants');

  assert.equal(SNAPSHOT_STATUS.NO_TOKEN, 'no_token');
  assert.equal(SNAPSHOT_STATUS.TIMEOUT, 'timeout');
  assert.equal(SNAPSHOT_STATUS.NETWORK_ERROR, 'network_error');
  assert.equal(SNAPSHOT_STATUS.UNAUTHORIZED, 'unauthorized');
  assert.equal(SNAPSHOT_STATUS.FORBIDDEN, 'forbidden');
  assert.equal(SNAPSHOT_STATUS.CLIENT_ERROR, 'client_error');
  assert.equal(SNAPSHOT_STATUS.SERVER_ERROR, 'server_error');
  assert.equal(SNAPSHOT_STATUS.INVALID_RESPONSE, 'invalid_response');
});

test('sanitizeSnapshot accepts new error statuses', () => {
  const { sanitizeSnapshot } = require('../src/shared/schema');

  const errorStatuses = [
    'no_token', 'timeout', 'network_error', 'unauthorized',
    'forbidden', 'client_error', 'server_error', 'invalid_response'
  ];

  for (const status of errorStatuses) {
    const result = sanitizeSnapshot({ status });
    assert.equal(result.status, status, `status ${status} should be valid`);
  }
});
