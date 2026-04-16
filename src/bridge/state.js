const { sanitizeSnapshot } = require('../shared/schema');

function createUnavailableSnapshot(now) {
  return sanitizeSnapshot({
    status: 'unavailable',
    plan_level: 'unknown',
    token_usage_pct: null,
    token_reset_at: null,
    mcp_remaining: null,
    mcp_total: null,
    snapshot_age_ms: null,
    fetched_at: now(),
  });
}

function createBridgeState(options = {}) {
  const now = options.now || Date.now;
  let currentSnapshot = createUnavailableSnapshot(now);

  return {
    getSnapshot() {
      if (currentSnapshot.status === 'unavailable') {
        return currentSnapshot;
      }

      return sanitizeSnapshot({
        ...currentSnapshot,
        snapshot_age_ms: Math.max(0, now() - currentSnapshot.fetched_at),
      });
    },
    setFreshSnapshot(snapshot) {
      currentSnapshot = sanitizeSnapshot({
        ...snapshot,
        status: 'fresh',
      });
    },
    markFailure() {
      if (currentSnapshot.status === 'unavailable') {
        currentSnapshot = createUnavailableSnapshot(now);
        return;
      }

      currentSnapshot = sanitizeSnapshot({
        ...currentSnapshot,
        status: 'stale',
      });
    },
  };
}

module.exports = {
  createBridgeState,
};
