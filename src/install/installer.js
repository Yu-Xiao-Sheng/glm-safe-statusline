const fs = require('node:fs');
const path = require('node:path');

async function installProject(options = {}) {
  const {
    installDir = path.join(process.env.HOME, '.local', 'share', 'glm-safe-statusline'),
    binDir = path.join(process.env.HOME, '.local', 'bin'),
    claudeSettingsPath = path.join(process.env.HOME, '.claude', 'settings.json'),
  } = options;

  // Create install directory
  await fs.promises.mkdir(installDir, { recursive: true });
  await fs.promises.mkdir(binDir, { recursive: true });

  // Copy src directory (contains all dependencies)
  const srcSource = path.join(__dirname, '..', '..', 'src');
  const srcTarget = path.join(installDir, 'src');
  await copyDirectory(srcSource, srcTarget);

  // Copy renderer script
  const rendererSource = path.join(__dirname, '..', '..', 'bin', 'glm-safe-statusline.js');
  const rendererTarget = path.join(installDir, 'glm-safe-statusline.js');
  await fs.promises.copyFile(rendererSource, rendererTarget);

  // Write wrapper script
  const wrapperPath = path.join(binDir, 'glm-safe-statusline');
  await fs.promises.writeFile(wrapperPath, `#!/bin/sh
exec node ${installDir}/glm-safe-statusline.js "$@"
`, { mode: 0o755 });

  // Update Claude settings
  await mergeClaudeSettings({
    settingsPath: claudeSettingsPath,
    command: path.join(binDir, 'glm-safe-statusline'),
  });

  return { installDir, binDir };
}

async function mergeClaudeSettings(options = {}) {
  const {
    settingsPath,
    command,
  } = options;

  let settings = {};

  if (fs.existsSync(settingsPath)) {
    const content = await fs.promises.readFile(settingsPath, 'utf8');
    try {
      settings = JSON.parse(content);
    } catch {
      // Invalid JSON, start fresh
    }
  }

  // Backup existing settings
  if (fs.existsSync(settingsPath)) {
    const backupPath = `${settingsPath}.backup.${Date.now()}`;
    await fs.promises.copyFile(settingsPath, backupPath);
  }

  // Update statusLine
  settings.statusLine = {
    type: 'command',
    command,
  };

  await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

async function copyDirectory(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

module.exports = {
  installProject,
  mergeClaudeSettings,
  copyDirectory,
};
