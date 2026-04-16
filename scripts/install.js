#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { installProject } = require('../src/install/installer');

function parseArgs(argv) {
  const parsed = {
    homeDir: null,
    skipToken: false,
    sourceDir: '',
    token: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--skip-token') {
      parsed.skipToken = true;
      continue;
    }
    if (arg === '--token') {
      parsed.token = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--home') {
      parsed.homeDir = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--source-dir') {
      parsed.sourceDir = argv[index + 1] || '';
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function hasConfiguredToken(homeDir) {
  const configPath = path.join(homeDir, '.glm-safe-statusline', 'bridge.config.json');
  if (!fs.existsSync(configPath)) {
    return false;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return Boolean(config.authToken);
  } catch {
    return false;
  }
}

function maybeStartBridge(statuslineBinDir, homeDir) {
  if (!hasConfiguredToken(homeDir)) {
    return {
      started: false,
      message: 'Bridge not started because no GLM token is configured yet.',
    };
  }

  const bridgectlPath = path.join(statuslineBinDir, 'glm-safe-bridgectl');
  const result = spawnSync(bridgectlPath, ['start'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    return {
      started: false,
      message: `Bridge start failed: ${result.stderr.trim() || result.stdout.trim() || 'unknown error'}`,
    };
  }

  return {
    started: true,
    message: result.stdout.trim() || 'Bridge start requested',
  };
}

function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const homeDir = args.homeDir || env.HOME || os.homedir();
  const sourceDir = args.sourceDir || path.resolve(__dirname, '..');
  const token = args.skipToken ? '' : args.token;

  const result = installProject({
    sourceDir,
    homeDir,
    token,
  });
  const bridge = maybeStartBridge(result.binDir, homeDir);

  process.stdout.write(`Installed to ${result.installDir}\n`);
  process.stdout.write(`Commands installed to ${result.binDir}\n`);
  process.stdout.write(`Claude Code statusLine set to ${result.statuslineCommand}\n`);
  process.stdout.write(`${bridge.message}\n`);
  process.stdout.write('If ~/.local/bin is not on PATH, add it for shell usage.\n');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`install failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  hasConfiguredToken,
  main,
  maybeStartBridge,
  parseArgs,
};
