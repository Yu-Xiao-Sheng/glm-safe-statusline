#!/usr/bin/env node

const { runCli } = require('../src/bridgectl/index');

try {
  process.stdout.write(runCli() + '\n');
} catch (error) {
  process.stderr.write(`glm-safe-bridgectl failed: ${error.message}\n`);
  process.exitCode = 1;
}
