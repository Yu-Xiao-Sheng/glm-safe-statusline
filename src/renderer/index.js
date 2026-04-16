const { execSync } = require('node:child_process');
const net = require('node:net');

const { detectProviderRuntime } = require('../shared/runtime');
const { sanitizeSnapshot } = require('../shared/schema');
const { getSocketConfig } = require('../shared/socket');
const { renderStatusOutput } = require('./render');

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

function readBridgeSnapshot(options = {}) {
  const socketConfig = options.socketConfig || getSocketConfig();
  const timeoutMs = options.timeoutMs || 150;

  return new Promise((resolve, reject) => {
    const client = socketConfig.mode === 'unix'
      ? net.createConnection(socketConfig.socketPath)
      : net.createConnection(socketConfig.port, socketConfig.host);
    let buffer = '';
    let settled = false;

    function finish(error, value) {
      if (settled) {
        return;
      }
      settled = true;
      client.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve(value);
    }

    client.setEncoding('utf8');
    client.setTimeout(timeoutMs, () => {
      finish(new Error('bridge timeout'));
    });
    client.on('connect', () => {
      client.write(JSON.stringify({ type: 'get_snapshot' }) + '\n');
    });
    client.on('data', (chunk) => {
      buffer += chunk;
      if (!buffer.includes('\n')) {
        return;
      }

      const line = buffer.slice(0, buffer.indexOf('\n')).trim();
      try {
        finish(null, sanitizeSnapshot(JSON.parse(line)));
      } catch (error) {
        finish(error);
      }
    });
    client.on('error', finish);
  });
}

async function renderStatusLine(options = {}) {
  const stdin = options.stdin || {};
  const env = options.env || process.env;
  const now = options.now || Date.now;
  const provider = detectProviderRuntime({ env });
  const branch = options.branch ?? getGitBranch();
  let snapshot = null;

  if (provider.isGlm) {
    try {
      snapshot = await (options.readBridgeSnapshot || readBridgeSnapshot)({
        socketConfig: options.socketConfig,
        timeoutMs: options.timeoutMs,
      });
    } catch {
      snapshot = {
        status: 'unavailable',
      };
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
  readBridgeSnapshot,
  renderStatusLine,
};
