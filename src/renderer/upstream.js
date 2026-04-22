const https = require('node:https');

const { sanitizeSnapshot } = require('../shared/schema');

const DEFAULT_QUOTA_ENDPOINT = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit';
const DEFAULT_MINIMAX_ENDPOINT = 'https://www.minimaxi.com/v1/token_plan/remains';
const DEFAULT_REQUEST_TIMEOUT_MS = 3 * 1000;

const DEFAULT_QUOTA_BY_LEVEL = {
  lite: 100,
  pro: 1000,
  max: 4000,
};

function mapQuotaResponseToSnapshot(payload = {}, options = {}) {
  const quotaByLevel = options.quotaByLevel || DEFAULT_QUOTA_BY_LEVEL;
  const now = options.now || Date.now;
  const fetchedAt = options.fetchedAt || now();
  const limits = Array.isArray(payload.limits) ? payload.limits : [];
  const planLevel = String(payload.level || 'unknown').toLowerCase();
  const tokenLimit = limits.find((item) => item.type === 'TOKENS_LIMIT') || {};
  const timeLimit = limits.find((item) => item.type === 'TIME_LIMIT') || {};

  // Use actual values from API response
  // API fields: usage = total quota, currentValue = used, remaining = left
  let mcpRemaining = null;
  let mcpTotal = null;

  if (timeLimit.usage !== undefined && timeLimit.usage !== null) {
    // API provides: usage=total quota, currentValue=used, remaining=left
    mcpTotal = Number(timeLimit.usage);
    mcpRemaining = Number(timeLimit.remaining || 0);
  } else {
    // Fallback to hardcoded quota
    mcpTotal = quotaByLevel[planLevel] || null;
    mcpRemaining = mcpTotal === null ? null : Math.max(0, mcpTotal - Number(timeLimit.currentValue || 0));
  }

  return sanitizeSnapshot({
    status: 'fresh',
    plan_level: planLevel,
    token_usage_pct: tokenLimit.percentage,
    token_reset_at: tokenLimit.nextResetTime,
    mcp_remaining: mcpRemaining,
    mcp_total: mcpTotal,
    mcp_reset_at: timeLimit.nextResetTime,
    snapshot_age_ms: now() - fetchedAt,
    fetched_at: fetchedAt,
  });
}

function mapMinimaxResponseToSnapshot(payload = {}, options = {}) {
  const now = options.now || Date.now;
  const fetchedAt = options.fetchedAt || now();
  const modelRemains = Array.isArray(payload.model_remains) ? payload.model_remains : [];

  const mainModel = modelRemains.find(m => m.model_name && m.model_name.includes('MiniMax-M'))
    || modelRemains[0]
    || {};

  const total = Number(mainModel.current_interval_total_count || 0);
  const usage = Number(mainModel.current_interval_usage_count || 0);
  const remainsTime = Number(mainModel.remains_time || 0);

  const tokenUsagePct = total > 0 ? Math.round((usage / total) * 100) : 0;
  const tokenResetAt = remainsTime > 0 ? now() + remainsTime : null;

  return sanitizeSnapshot({
    status: 'fresh',
    plan_level: 'unknown',
    token_usage_pct: tokenUsagePct,
    token_reset_at: tokenResetAt,
    mcp_remaining: null,
    mcp_total: null,
    mcp_reset_at: null,
    snapshot_age_ms: now() - fetchedAt,
    fetched_at: fetchedAt,
  });
}

function fetchQuotaSnapshot(config, options = {}) {
  const transport = options.transport || https;
  const now = options.now || Date.now;
  const provider = config.provider || 'glm';

  return new Promise((resolve, reject) => {
    const isMinimax = provider === 'minimax';
    const quotaEndpoint = isMinimax
      ? (config.quotaEndpoint || DEFAULT_MINIMAX_ENDPOINT)
      : (config.quotaEndpoint || DEFAULT_QUOTA_ENDPOINT);
    const authToken = config.authToken;

    if (!authToken) {
      reject(new Error('NO_TOKEN'));
      return;
    }

    const headers = {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en',
    };

    if (isMinimax) {
      // MiniMax API expects Bearer token
      headers.Authorization = `Bearer ${authToken}`;
    } else {
      // GLM API expects token directly without Bearer prefix
      headers.Authorization = authToken;
    }

    const req = transport.get(quotaEndpoint, { headers }, (res) => {
      let body = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);

          if (isMinimax) {
            // MiniMax error check: base_resp.status_code !== 0
            if (parsed.base_resp && parsed.base_resp.status_code !== 0) {
              reject(new Error(`API_ERROR_${res.statusCode}`));
              return;
            }
            resolve(mapMinimaxResponseToSnapshot(parsed, {
              fetchedAt: now(),
              now,
            }));
          } else {
            // GLM error check
            if (parsed.code !== 200 || !parsed.data) {
              reject(new Error(`API_ERROR_${res.statusCode}`));
              return;
            }
            resolve(mapQuotaResponseToSnapshot(parsed.data, {
              fetchedAt: now(),
              now,
            }));
          }
        } catch (error) {
          reject(new Error('INVALID_RESPONSE'));
        }
      });
    });

    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        reject(new Error('NETWORK_ERROR'));
      } else {
        reject(error);
      }
    });

    req.setTimeout(config.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('TIMEOUT'));
    });
  });
}

module.exports = {
  DEFAULT_QUOTA_ENDPOINT,
  DEFAULT_MINIMAX_ENDPOINT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_QUOTA_BY_LEVEL,
  fetchQuotaSnapshot,
  mapQuotaResponseToSnapshot,
  mapMinimaxResponseToSnapshot,
};
