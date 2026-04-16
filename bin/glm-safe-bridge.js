#!/usr/bin/env node

const { startBridgeDaemon } = require('../src/bridge/daemon');

startBridgeDaemon().catch((error) => {
  process.stderr.write(`glm-safe-bridge failed: ${error.message}\n`);
  process.exitCode = 1;
});
