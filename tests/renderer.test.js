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

  let bridgeCalls = 0;
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
    readBridgeSnapshot: async () => {
      bridgeCalls += 1;
      return null;
    },
  });

  const plain = stripAnsi(output);
  assert.equal(bridgeCalls, 0);
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
    },
    branch: 'feature/rail',
    now: () => 1776297294000,
    readBridgeSnapshot: async () => ({
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
    },
    branch: 'main',
    now: () => 1776297400000,
    readBridgeSnapshot: async () => ({
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
    },
    branch: 'main',
    readBridgeSnapshot: async () => {
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
