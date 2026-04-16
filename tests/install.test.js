const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const installer = require('../src/install/installer');

test('mergeClaudeSettings preserves unrelated settings and updates statusLine command', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-settings-test-'));
  const settingsPath = path.join(tmpDir, 'settings.json');

  // Create initial settings
  await fs.promises.writeFile(
    settingsPath,
    JSON.stringify({ theme: 'dark' }, null, 2),
  );

  await installer.mergeClaudeSettings({
    settingsPath,
    command: '/home/demo/.local/bin/glm-safe-statusline',
  });

  const settings = JSON.parse(await fs.promises.readFile(settingsPath, 'utf8'));
  assert.deepEqual(settings, {
    theme: 'dark',
    statusLine: {
      type: 'command',
      command: '/home/demo/.local/bin/glm-safe-statusline',
    },
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('installProject installs only renderer, no bridge files', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-install-test-'));
  const homeDir = path.join(tmpDir, 'home');
  const installDir = path.join(homeDir, '.local', 'share', 'glm-safe-statusline');
  const binDir = path.join(homeDir, '.local', 'bin');

  // Create source directory structure
  const sourceDir = path.join(tmpDir, 'source');
  fs.mkdirSync(path.join(sourceDir, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(sourceDir, 'src', 'install'), { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, 'bin', 'glm-safe-statusline.js'),
    '#!/usr/bin/env node\nconsole.log("statusline");\n',
  );
  fs.writeFileSync(
    path.join(sourceDir, 'src', 'install', 'installer.js'),
    'module.exports = {};\n',
  );

  // Create Claude settings directory
  fs.mkdirSync(path.join(homeDir, '.claude'), { recursive: true });
  await fs.promises.writeFile(
    path.join(homeDir, '.claude', 'settings.json'),
    JSON.stringify({ theme: 'dark' }, null, 2),
  );

  // Mock __dirname to point to our test source
  const originalDirname = __dirname;
  const installerModulePath = path.join(sourceDir, 'src', 'install', 'installer.js');

  // Run installation
  const result = await installer.installProject({
    installDir,
    binDir,
    claudeSettingsPath: path.join(homeDir, '.claude', 'settings.json'),
  });

  // Verify renderer was installed
  assert.equal(fs.existsSync(path.join(installDir, 'glm-safe-statusline.js')), true);
  assert.equal(fs.existsSync(path.join(binDir, 'glm-safe-statusline')), true);

  // Verify wrapper script content
  const wrapper = fs.readFileSync(path.join(binDir, 'glm-safe-statusline'), 'utf8');
  assert.match(wrapper, /exec node.*glm-safe-statusline\.js/);

  // Verify Claude settings were updated
  const settings = JSON.parse(fs.readFileSync(path.join(homeDir, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.theme, 'dark');
  assert.deepEqual(settings.statusLine, {
    type: 'command',
    command: path.join(binDir, 'glm-safe-statusline'),
  });

  // Verify backup was created
  const backupFiles = fs.readdirSync(path.join(homeDir, '.claude'))
    .filter(f => f.startsWith('settings.json.backup.'));
  assert.equal(backupFiles.length, 1);

  // Verify NO bridge files were created
  assert.equal(fs.existsSync(path.join(binDir, 'glm-safe-bridge')), false);
  assert.equal(fs.existsSync(path.join(binDir, 'glm-safe-bridgectl')), false);
  assert.equal(fs.existsSync(path.join(homeDir, '.glm-safe-statusline')), false);

  assert.equal(result.installDir, installDir);
  assert.equal(result.binDir, binDir);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('installProject creates Claude settings if they do not exist', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-install-test-'));
  const homeDir = path.join(tmpDir, 'home');
  const installDir = path.join(homeDir, '.local', 'share', 'glm-safe-statusline');
  const binDir = path.join(homeDir, '.local', 'bin');

  // Create source directory
  const sourceDir = path.join(tmpDir, 'source');
  fs.mkdirSync(path.join(sourceDir, 'bin'), { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, 'bin', 'glm-safe-statusline.js'),
    '#!/usr/bin/env node\n',
  );

  // Create Claude directory but no settings file
  fs.mkdirSync(path.join(homeDir, '.claude'), { recursive: true });

  await installer.installProject({
    installDir,
    binDir,
    claudeSettingsPath: path.join(homeDir, '.claude', 'settings.json'),
  });

  // Verify settings were created
  const settings = JSON.parse(fs.readFileSync(path.join(homeDir, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(settings.statusLine, {
    type: 'command',
    command: path.join(binDir, 'glm-safe-statusline'),
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
