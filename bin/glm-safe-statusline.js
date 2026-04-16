#!/usr/bin/env node

const { main } = require('../src/renderer/index');

main().catch((error) => {
  process.stderr.write(`glm-safe-statusline failed: ${error.message}\n`);
  process.exitCode = 1;
});
