const test = require('node:test');
const assert = require('node:assert/strict');

function tryRequire(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return {};
  }
}

const runtime = tryRequire('../src/shared/runtime');
const schema = tryRequire('../src/shared/schema');

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
