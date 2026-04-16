const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

function tryRequire(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return {};
  }
}

const bridgeConfig = tryRequire('../src/bridge/config');
const upstream = tryRequire('../src/bridge/upstream');
const stateModule = tryRequire('../src/bridge/state');
const serverModule = tryRequire('../src/bridge/server');
const bridgectl = tryRequire('../src/bridgectl/index');

test('assertAllowedQuotaEndpoint only accepts the fixed GLM quota endpoint', () => {
  assert.equal(typeof bridgeConfig.assertAllowedQuotaEndpoint, 'function');

  assert.doesNotThrow(() => {
    bridgeConfig.assertAllowedQuotaEndpoint(
      'https://open.bigmodel.cn/api/monitor/usage/quota/limit',
    );
  });

  assert.throws(() => {
    bridgeConfig.assertAllowedQuotaEndpoint(
      'https://example.com/api/monitor/usage/quota/limit',
    );
  }, /allowlist/i);
});

test('mapQuotaResponseToSnapshot returns only the sanitized public fields', () => {
  assert.equal(typeof upstream.mapQuotaResponseToSnapshot, 'function');

  const snapshot = upstream.mapQuotaResponseToSnapshot({
    level: 'pro',
    limits: [
      {
        type: 'TOKENS_LIMIT',
        percentage: 62,
        nextResetTime: 1776304080000,
      },
      {
        type: 'TIME_LIMIT',
        usage: 320,
      },
    ],
    userSecret: 'must-not-leak',
  }, {
    quotaByLevel: { pro: 1000 },
    fetchedAt: 1776297280000,
    now: () => 1776297294000,
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

test('createBridgeState transitions from unavailable to fresh to stale', () => {
  assert.equal(typeof stateModule.createBridgeState, 'function');

  const state = stateModule.createBridgeState({
    now: () => 1000,
  });

  assert.equal(state.getSnapshot().status, 'unavailable');

  state.setFreshSnapshot({
    status: 'fresh',
    plan_level: 'pro',
    token_usage_pct: 40,
    token_reset_at: 5000,
    mcp_remaining: 700,
    mcp_total: 1000,
    snapshot_age_ms: 0,
    fetched_at: 1000,
  });

  assert.equal(state.getSnapshot().status, 'fresh');

  state.markFailure();

  const snapshot = state.getSnapshot();
  assert.equal(snapshot.status, 'stale');
  assert.equal(snapshot.plan_level, 'pro');
});

test('startBridgeServer serves the current sanitized snapshot over a unix socket', async () => {
  assert.equal(typeof stateModule.createBridgeState, 'function');
  assert.equal(typeof serverModule.startBridgeServer, 'function');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-bridge-test-'));
  const socketPath = path.join(tmpDir, 'bridge.sock');
  const state = stateModule.createBridgeState({
    now: () => 2000,
  });

  state.setFreshSnapshot({
    status: 'fresh',
    plan_level: 'pro',
    token_usage_pct: 51,
    token_reset_at: 9000,
    mcp_remaining: 850,
    mcp_total: 1000,
    snapshot_age_ms: 0,
    fetched_at: 2000,
  });

  const server = await serverModule.startBridgeServer({
    socketConfig: {
      mode: 'unix',
      socketPath,
      host: null,
      port: null,
    },
    state,
  });

  const response = await new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let body = '';

    client.setEncoding('utf8');
    client.on('connect', () => {
      client.write(JSON.stringify({ type: 'get_snapshot' }) + '\n');
    });
    client.on('data', (chunk) => {
      body += chunk;
      if (body.includes('\n')) {
        client.end();
      }
    });
    client.on('end', () => resolve(body.trim()));
    client.on('error', reject);
  });

  await server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.deepEqual(JSON.parse(response), {
    status: 'fresh',
    plan_level: 'pro',
    token_usage_pct: 51,
    token_reset_at: 9000,
    mcp_remaining: 850,
    mcp_total: 1000,
    snapshot_age_ms: 0,
    fetched_at: 2000,
  });
});

test('getBridgeStatus reports stopped when pid and socket are missing', () => {
  assert.equal(typeof bridgectl.getBridgeStatus, 'function');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-bridgectl-test-'));
  const status = bridgectl.getBridgeStatus({
    runtimePaths: {
      stateDir: tmpDir,
      pidPath: path.join(tmpDir, 'bridge.pid'),
      socketPath: path.join(tmpDir, 'bridge.sock'),
      logPath: path.join(tmpDir, 'bridge.log'),
    },
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.equal(status.running, false);
  assert.match(status.message, /not running/i);
});

test('stopBridge returns false when no bridge pid file exists', () => {
  assert.equal(typeof bridgectl.stopBridge, 'function');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-bridgectl-test-'));
  const stopped = bridgectl.stopBridge({
    runtimePaths: {
      stateDir: tmpDir,
      pidPath: path.join(tmpDir, 'bridge.pid'),
      socketPath: path.join(tmpDir, 'bridge.sock'),
      logPath: path.join(tmpDir, 'bridge.log'),
    },
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.equal(stopped, false);
});
