const test = require('node:test');
const assert = require('node:assert/strict');

function tryRequire(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return {};
  }
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

const renderModule = tryRequire('../src/renderer/render');
const rendererModule = tryRequire('../src/renderer/index');

test('renderStatusLine keeps non-GLM runtime on the base layout', async () => {
  assert.equal(typeof rendererModule.renderStatusLine, 'function');

  let apiCalls = 0;
  const output = await rendererModule.renderStatusLine({
    stdin: {
      model: { display_name: 'claude-sonnet-4-6' },
      context_window: {
        used_percentage: 42,
        total_output_tokens: 1200,
      },
      cost: {
        total_api_duration_ms: 3000,
      },
      workspace: {
        current_dir: '/tmp/demo-project',
      },
    },
    env: {
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    },
    branch: 'main',
    fetchQuotaSnapshot: async () => {
      apiCalls += 1;
      return null;
    },
  });

  const plain = stripAnsi(output);
  assert.equal(apiCalls, 0);
  assert.match(plain, /claude-sonnet-4-6/);
  assert.match(plain, /CTX 42%/);
  assert.match(plain, /400\.0 t\/s/);
  assert.match(plain, /demo-project/);
  assert.match(plain, /main/);
  assert.doesNotMatch(plain, /quota unavailable/i);
});

test('renderStatusLine renders the telemetry rail for a fresh GLM snapshot', async () => {
  assert.equal(typeof rendererModule.renderStatusLine, 'function');

  const output = await rendererModule.renderStatusLine({
    stdin: {
      model: { display_name: 'GLM-4.5' },
      context_window: {
        used_percentage: 34,
        total_output_tokens: 654,
      },
      cost: {
        total_api_duration_ms: 3000,
      },
      workspace: {
        current_dir: '/tmp/glm-safe-statusline',
      },
    },
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      ANTHROPIC_API_KEY: 'test-key',
    },
    branch: 'feature/rail',
    now: () => 1776297294000,
    fetchQuotaSnapshot: async () => ({
      status: 'fresh',
      plan_level: 'pro',
      token_usage_pct: 62,
      token_reset_at: 1776304080000,
      mcp_remaining: 680,
      mcp_total: 1000,
      snapshot_age_ms: 14000,
      fetched_at: 1776297280000,
    }),
  });

  const plain = stripAnsi(output);
  assert.match(plain, /GLM-4\.5/);
  assert.match(plain, /CTX 34%/);
  assert.match(plain, /218\.0 t\/s/);
  assert.match(plain, /TOKEN 5H/);
  assert.match(plain, /62%/);
  assert.match(plain, /PLAN/);
  assert.match(plain, /PRO/);
  assert.match(plain, /MCP/);
  assert.match(plain, /680\/1000/);
  assert.match(plain, /fresh 14s/);
});

test('renderStatusLine shows freshness hint for stale bridge data', async () => {
  assert.equal(typeof rendererModule.renderStatusLine, 'function');

  const output = await rendererModule.renderStatusLine({
    stdin: {
      model: { display_name: 'GLM-4.5' },
      context_window: {
        used_percentage: 34,
      },
      workspace: {
        current_dir: '/tmp/glm-safe-statusline',
      },
    },
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      ANTHROPIC_API_KEY: 'test-key',
    },
    branch: 'main',
    now: () => 1776297400000,
    fetchQuotaSnapshot: async () => ({
      status: 'stale',
      plan_level: 'max',
      token_usage_pct: 80,
      token_reset_at: 1776304080000,
      mcp_remaining: 3200,
      mcp_total: 4000,
      snapshot_age_ms: 120000,
      fetched_at: 1776297280000,
    }),
  });

  const plain = stripAnsi(output);
  assert.match(plain, /stale 2m/);
  assert.match(plain, /3200\/4000/);
});

test('renderStatusLine degrades safely when the bridge is unavailable', async () => {
  assert.equal(typeof rendererModule.renderStatusLine, 'function');
  assert.equal(typeof renderModule.renderStatusOutput, 'function');

  const output = await rendererModule.renderStatusLine({
    stdin: {
      model: { display_name: 'GLM-4.5' },
      context_window: {
        used_percentage: 81,
      },
      workspace: {
        current_dir: '/tmp/glm-safe-statusline',
      },
    },
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      ANTHROPIC_API_KEY: 'test-key',
    },
    branch: 'main',
    fetchQuotaSnapshot: async () => {
      throw new Error('socket timeout');
    },
  });

  const plain = stripAnsi(output);
  assert.match(plain, /CTX 81%/);
  assert.match(plain, /quota unavailable/i);
  assert.match(plain, /glm-safe-statusline/);
});

test('fetchQuotaSnapshot requests GLM API directly', async () => {
  const { fetchQuotaSnapshot } = require('../src/renderer/upstream');

  // Mock https module
  const mockHttps = {
    get: (url, options, callback) => {
      // Simulate successful response
      const mockRes = {
        setEncoding: () => {},
        on: (event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ code: 200, data: { level: 'pro', limits: [] } }));
          }
          if (event === 'end') {
            handler();
          }
        },
      };
      callback(mockRes);
      return { on: () => {}, setTimeout: () => {} };
    },
  };

  const snapshot = await fetchQuotaSnapshot({
    authToken: 'test-token',
    quotaEndpoint: 'https://open.bigmodel.cn/api/monitor/usage/quota/limit',
  }, { transport: mockHttps });

  assert.equal(snapshot.status, 'fresh');
});

test('renderStatusLine uses ANTHROPIC_API_KEY for GLM', async () => {
  const { renderStatusLine } = require('../src/renderer/index');

  let capturedToken = null;

  const stdin = {
    model: { display_name: 'GLM-4.5' },
    context_window: { used_percentage: 81 },
  };

  const output = await renderStatusLine({
    stdin,
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/v1',
      ANTHROPIC_API_KEY: 'test-key-123',
    },
    branch: 'main',
    fetchQuotaSnapshot: async (config) => {
      capturedToken = config.authToken;
      return { status: 'fresh', plan_level: 'pro', token_usage_pct: 45 };
    },
  });

  assert.equal(capturedToken, 'test-key-123');
  assert.ok(output.includes('GLM-4.5'));
});

test('mapErrorToStatus maps errors to correct status constants', async () => {
  const { mapErrorToStatus } = require('../src/renderer/index');
  const { SNAPSHOT_STATUS } = require('../src/shared/constants');

  assert.equal(mapErrorToStatus(new Error('NO_TOKEN')), SNAPSHOT_STATUS.NO_TOKEN);
  assert.equal(mapErrorToStatus(new Error('TIMEOUT')), SNAPSHOT_STATUS.TIMEOUT);
  assert.equal(mapErrorToStatus(new Error('NETWORK_ERROR')), SNAPSHOT_STATUS.NETWORK_ERROR);
  assert.equal(mapErrorToStatus(new Error('ECONNREFUSED')), SNAPSHOT_STATUS.NETWORK_ERROR);
  assert.equal(mapErrorToStatus(new Error('API_ERROR_401')), SNAPSHOT_STATUS.UNAUTHORIZED);
  assert.equal(mapErrorToStatus(new Error('401 Unauthorized')), SNAPSHOT_STATUS.UNAUTHORIZED);
  assert.equal(mapErrorToStatus(new Error('API_ERROR_403')), SNAPSHOT_STATUS.FORBIDDEN);
  assert.equal(mapErrorToStatus(new Error('403 Forbidden')), SNAPSHOT_STATUS.FORBIDDEN);
  assert.equal(mapErrorToStatus(new Error('INVALID_RESPONSE')), SNAPSHOT_STATUS.INVALID_RESPONSE);
  assert.equal(mapErrorToStatus(new Error('API_ERROR_500')), SNAPSHOT_STATUS.SERVER_ERROR);
  assert.equal(mapErrorToStatus(new Error('API_ERROR_503')), SNAPSHOT_STATUS.SERVER_ERROR);
  assert.equal(mapErrorToStatus(new Error('API_ERROR_400')), SNAPSHOT_STATUS.CLIENT_ERROR);
  assert.equal(mapErrorToStatus(new Error('API_ERROR_429')), SNAPSHOT_STATUS.CLIENT_ERROR);
  assert.equal(mapErrorToStatus(new Error('Unknown error')), SNAPSHOT_STATUS.UNAVAILABLE);
});

test('renderStatusLine handles NO_TOKEN when API key is missing', async () => {
  const { renderStatusLine } = require('../src/renderer/index');

  const output = await renderStatusLine({
    stdin: {
      model: { display_name: 'GLM-4.5' },
      context_window: { used_percentage: 81 },
    },
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/v1',
      // No ANTHROPIC_API_KEY
    },
    branch: 'main',
  });

  const plain = stripAnsi(output);
  assert.match(plain, /no_token/);
});

test('renderStatusLine handles API errors gracefully', async () => {
  const { renderStatusLine } = require('../src/renderer/index');

  const output = await renderStatusLine({
    stdin: {
      model: { display_name: 'GLM-4.5' },
      context_window: { used_percentage: 81 },
    },
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/v1',
      ANTHROPIC_API_KEY: 'test-key',
    },
    branch: 'main',
    fetchQuotaSnapshot: async () => {
      throw new Error('API_ERROR_401');
    },
  });

  const plain = stripAnsi(output);
  assert.match(plain, /unauthorized/);
});
