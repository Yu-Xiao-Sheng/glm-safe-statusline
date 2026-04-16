const fs = require('node:fs');

const { loadBridgeConfig } = require('./config');
const { fetchQuotaSnapshot } = require('./upstream');
const { createBridgeState } = require('./state');
const { startBridgeServer } = require('./server');

function ensureStateDir(runtimePaths) {
  fs.mkdirSync(runtimePaths.stateDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(runtimePaths.stateDir, 0o700);
}

async function startBridgeDaemon(options = {}) {
  const now = options.now || Date.now;
  const config = options.config || loadBridgeConfig(options);
  const state = options.state || createBridgeState({ now });
  const runtimePaths = config.runtimePaths;
  let stopped = false;

  ensureStateDir(runtimePaths);
  fs.writeFileSync(runtimePaths.pidPath, String(process.pid), { mode: 0o600 });

  async function refresh() {
    if (!config.authToken) {
      state.markFailure();
      return state.getSnapshot();
    }

    try {
      const snapshot = await fetchQuotaSnapshot(config, { now });
      state.setFreshSnapshot(snapshot);
    } catch {
      state.markFailure();
    }

    return state.getSnapshot();
  }

  const server = await startBridgeServer({
    socketConfig: config.socketConfig,
    state,
  });

  await refresh();
  const timer = setInterval(() => {
    refresh().catch(() => {});
  }, config.refreshIntervalMs);

  async function stop() {
    if (stopped) {
      return;
    }

    stopped = true;
    clearInterval(timer);
    await server.close();
    fs.rmSync(runtimePaths.pidPath, { force: true });
  }

  function attachSignal(signal) {
    process.on(signal, async () => {
      await stop();
      process.exit(0);
    });
  }

  attachSignal('SIGINT');
  attachSignal('SIGTERM');

  return {
    config,
    refresh,
    server,
    state,
    stop,
  };
}

module.exports = {
  startBridgeDaemon,
};
