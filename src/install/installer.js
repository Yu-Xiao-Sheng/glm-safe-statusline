const fs = require('node:fs');
const path = require('node:path');

const INSTALL_DIR_NAME = 'glm-safe-statusline';
const INSTALL_FILES = ['bin', 'src', 'package.json', 'README.md'];

function ensureDir(dirPath, mode = 0o755) {
  fs.mkdirSync(dirPath, { recursive: true, mode });
  fs.chmodSync(dirPath, mode);
}

function copyInstallFiles(sourceDir, installDir) {
  fs.rmSync(installDir, { recursive: true, force: true });
  ensureDir(installDir);

  for (const relativePath of INSTALL_FILES) {
    const sourcePath = path.join(sourceDir, relativePath);
    const targetPath = path.join(installDir, relativePath);
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
}

function mergeClaudeSettings(currentSettings = {}, commandPath) {
  return {
    ...currentSettings,
    statusLine: {
      type: 'command',
      command: commandPath,
    },
  };
}

function writeJson(filePath, value, mode = 0o600) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode });
  fs.chmodSync(filePath, mode);
}

function writeWrapper(binDir, commandName, targetJsPath) {
  const wrapperPath = path.join(binDir, commandName);
  const content = [
    '#!/usr/bin/env sh',
    'set -eu',
    'SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"',
    `exec node "$SCRIPT_DIR/../share/${INSTALL_DIR_NAME}/${targetJsPath}" "$@"`,
    '',
  ].join('\n');

  fs.writeFileSync(wrapperPath, content, { mode: 0o755 });
  fs.chmodSync(wrapperPath, 0o755);
}

function updateClaudeSettings(homeDir, now, statuslineCommand) {
  const claudeDir = path.join(homeDir, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  ensureDir(claudeDir, 0o700);

  let currentSettings = {};
  if (fs.existsSync(settingsPath)) {
    currentSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const backupPath = `${settingsPath}.bak-${now()}`;
    fs.copyFileSync(settingsPath, backupPath);
    fs.chmodSync(backupPath, 0o600);
  }

  const nextSettings = mergeClaudeSettings(currentSettings, statuslineCommand);
  writeJson(settingsPath, nextSettings, 0o600);
}

function writeBridgeConfig(homeDir, token) {
  if (!token) {
    return;
  }

  const bridgeDir = path.join(homeDir, '.glm-safe-statusline');
  ensureDir(bridgeDir, 0o700);
  writeJson(path.join(bridgeDir, 'bridge.config.json'), { authToken: token }, 0o600);
}

function installProject(options) {
  const {
    sourceDir,
    homeDir,
    token = '',
    now = Date.now,
  } = options;
  const localDir = path.join(homeDir, '.local');
  const shareDir = path.join(localDir, 'share');
  const binDir = path.join(localDir, 'bin');
  const installDir = path.join(shareDir, INSTALL_DIR_NAME);
  const statuslineCommand = path.join(binDir, 'glm-safe-statusline');

  ensureDir(localDir, 0o755);
  ensureDir(shareDir, 0o755);
  ensureDir(binDir, 0o755);

  copyInstallFiles(sourceDir, installDir);

  writeWrapper(binDir, 'glm-safe-statusline', 'bin/glm-safe-statusline.js');
  writeWrapper(binDir, 'glm-safe-bridge', 'bin/glm-safe-bridge.js');
  writeWrapper(binDir, 'glm-safe-bridgectl', 'bin/glm-safe-bridgectl.js');

  updateClaudeSettings(homeDir, now, statuslineCommand);
  writeBridgeConfig(homeDir, token);

  return {
    binDir,
    installDir,
    statuslineCommand,
  };
}

module.exports = {
  INSTALL_DIR_NAME,
  INSTALL_FILES,
  installProject,
  mergeClaudeSettings,
};
