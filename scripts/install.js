#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { installProject } = require('../src/install/installer');

function parseArgs(argv) {
  const parsed = {
    homeDir: null,
    sourceDir: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

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

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const homeDir = args.homeDir || env.HOME || os.homedir();
  const sourceDir = args.sourceDir || path.resolve(__dirname, '..');

  const result = await installProject({
    installDir: path.join(homeDir, '.local', 'share', 'glm-safe-statusline'),
    binDir: path.join(homeDir, '.local', 'bin'),
    claudeSettingsPath: path.join(homeDir, '.claude', 'settings.json'),
  });

  process.stdout.write(`Installed to ${result.installDir}\n`);
  process.stdout.write(`Commands installed to ${result.binDir}\n`);
  process.stdout.write(`Claude Code statusLine set to ${path.join(result.binDir, 'glm-safe-statusline')}\n`);
  process.stdout.write('If ~/.local/bin is not on PATH, add it for shell usage.\n');
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`install failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  parseArgs,
};
