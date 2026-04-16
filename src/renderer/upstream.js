const https = require('node:https');

const { sanitizeSnapshot } = require('../shared/schema');

const DEFAULT_QUOTA_ENDPOINT = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit';
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
  const total = quotaByLevel[planLevel] || null;
  const remaining = total === null ? null : Math.max(0, total - Number(timeLimit.usage || 0));

  return sanitizeSnapshot({
    status: 'fresh',
    plan_level: planLevel,
    token_usage_pct: tokenLimit.percentage,
    token_reset_at: tokenLimit.nextResetTime,
    mcp_remaining: remaining,
    mcp_total: total,
    snapshot_age_ms: now() - fetchedAt,
    fetched_at: fetchedAt,
  });
}

function fetchQuotaSnapshot(config, options = {}) {
  const transport = options.transport || https;
  const now = options.now || Date.now;

  return new Promise((resolve, reject) => {
    const quotaEndpoint = config.quotaEndpoint || DEFAULT_QUOTA_ENDPOINT;
    const authToken = config.authToken;

    if (!authToken) {
      reject(new Error('NO_TOKEN'));
      return;
    }

    const req = transport.get(quotaEndpoint, {
      headers: {
        // GLM API expects token directly without Bearer prefix
        Authorization: authToken,
        Accept: 'application/json',
        'Accept-Language': 'en-US,en',
      },
    }, (res) => {
      let body = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.code !== 200 || !parsed.data) {
            reject(new Error(`API_ERROR_${res.statusCode}`));
            return;
          }

          resolve(mapQuotaResponseToSnapshot(parsed.data, {
            fetchedAt: now(),
            now,
          }));
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
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_QUOTA_BY_LEVEL,
  fetchQuotaSnapshot,
  mapQuotaResponseToSnapshot,
};
