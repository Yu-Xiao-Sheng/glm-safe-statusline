const {
  SNAPSHOT_STATUS,
  VALID_PLAN_LEVELS,
} = require('./constants');

const VALID_STATUSES = new Set(Object.values(SNAPSHOT_STATUS));

function toNullableInteger(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return Math.trunc(parsed);
}

function normalizePlanLevel(value) {
  const normalized = String(value || 'unknown').toLowerCase();
  return VALID_PLAN_LEVELS.has(normalized) ? normalized : 'unknown';
}

function sanitizeSnapshot(input = {}) {
  const status = String(input.status || '');
  if (!VALID_STATUSES.has(status)) {
    throw new Error('Invalid snapshot status');
  }

  const tokenUsage = toNullableInteger(input.token_usage_pct, 'token_usage_pct');
  const snapshot = {
    status,
    plan_level: normalizePlanLevel(input.plan_level),
    token_usage_pct: tokenUsage === null ? null : Math.max(0, Math.min(100, tokenUsage)),
    token_reset_at: toNullableInteger(input.token_reset_at, 'token_reset_at'),
    mcp_remaining: toNullableInteger(input.mcp_remaining, 'mcp_remaining'),
    mcp_total: toNullableInteger(input.mcp_total, 'mcp_total'),
    mcp_reset_at: toNullableInteger(input.mcp_reset_at, 'mcp_reset_at'),
    snapshot_age_ms: toNullableInteger(input.snapshot_age_ms, 'snapshot_age_ms'),
    fetched_at: toNullableInteger(input.fetched_at, 'fetched_at'),
  };

  return snapshot;
}

module.exports = {
  sanitizeSnapshot,
};
