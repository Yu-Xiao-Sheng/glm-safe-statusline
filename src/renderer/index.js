const { execSync } = require('node:child_process');

const { detectProviderRuntime } = require('../shared/runtime');
const { renderStatusOutput } = require('./render');
const { fetchQuotaSnapshot } = require('./upstream');
const { SNAPSHOT_STATUS } = require('../shared/constants');

function parseJsonInput(inputText) {
  if (!inputText) {
    return {};
  }

  try {
    return JSON.parse(inputText);
  } catch {
    return {};
  }
}

function getGitBranch() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function mapErrorToStatus(error) {
  const message = error.message || '';

  if (message === 'NO_TOKEN') {
    return SNAPSHOT_STATUS.NO_TOKEN;
  }
  if (message === 'TIMEOUT') {
    return SNAPSHOT_STATUS.TIMEOUT;
  }
  if (message === 'NETWORK_ERROR' || message.includes('ECONNREFUSED')) {
    return SNAPSHOT_STATUS.NETWORK_ERROR;
  }
  if (message.includes('401') || message.includes('API_ERROR_401')) {
    return SNAPSHOT_STATUS.UNAUTHORIZED;
  }
  if (message.includes('403') || message.includes('API_ERROR_403')) {
    return SNAPSHOT_STATUS.FORBIDDEN;
  }
  if (message === 'INVALID_RESPONSE') {
    return SNAPSHOT_STATUS.INVALID_RESPONSE;
  }
  if (message.includes('API_ERROR_5')) {
    return SNAPSHOT_STATUS.SERVER_ERROR;
  }
  if (message.includes('API_ERROR_4')) {
    return SNAPSHOT_STATUS.CLIENT_ERROR;
  }

  return SNAPSHOT_STATUS.UNAVAILABLE;
}

async function renderStatusLine(options = {}) {
  const stdin = options.stdin || {};
  const env = options.env || process.env;
  const now = options.now || Date.now;
  const provider = detectProviderRuntime({ env });
  const branch = options.branch ?? getGitBranch();
  let snapshot = null;

  if (provider.isGlm) {
    const apiKey = env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      snapshot = { status: SNAPSHOT_STATUS.NO_TOKEN };
    } else {
      try {
        snapshot = await (options.fetchQuotaSnapshot || fetchQuotaSnapshot)({
          authToken: apiKey,
          requestTimeoutMs: 3000,
        });
      } catch (error) {
        snapshot = { status: mapErrorToStatus(error) };
      }
    }
  }

  return renderStatusOutput({
    stdin,
    snapshot,
    provider,
    branch,
    now,
  });
}

async function main(options = {}) {
  const stdinStream = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;
  const env = options.env || process.env;
  let input = '';

  for await (const chunk of stdinStream) {
    input += chunk;
  }

  const output = await renderStatusLine({
    stdin: parseJsonInput(input),
    env,
  });

  if (output) {
    stdout.write(output + '\n');
  }
}

module.exports = {
  getGitBranch,
  main,
  parseJsonInput,
  renderStatusLine,
  mapErrorToStatus,
};
