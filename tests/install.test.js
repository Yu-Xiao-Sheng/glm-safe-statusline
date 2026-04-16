const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function tryRequire(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return {};
  }
}

const installer = tryRequire('../src/install/installer');
const installCli = tryRequire('../scripts/install.js');

test('mergeClaudeSettings preserves unrelated settings and updates statusLine command', () => {
  assert.equal(typeof installer.mergeClaudeSettings, 'function');

  const merged = installer.mergeClaudeSettings({
    theme: 'dark',
    statusLine: {
      type: 'command',
      command: 'node /old/path.js',
    },
  }, '/home/demo/.local/bin/glm-safe-statusline');

  assert.deepEqual(merged, {
    theme: 'dark',
    statusLine: {
      type: 'command',
      command: '/home/demo/.local/bin/glm-safe-statusline',
    },
  });
});

test('installProject copies runtime files, writes wrappers, and backs up Claude settings', () => {
  assert.equal(typeof installer.installProject, 'function');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-install-test-'));
  const sourceDir = path.join(tmpDir, 'source');
  const homeDir = path.join(tmpDir, 'home');

  fs.mkdirSync(path.join(sourceDir, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(sourceDir, 'src', 'renderer'), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'bin', 'glm-safe-statusline.js'), '#!/usr/bin/env node\n');
  fs.writeFileSync(path.join(sourceDir, 'bin', 'glm-safe-bridge.js'), '#!/usr/bin/env node\n');
  fs.writeFileSync(path.join(sourceDir, 'bin', 'glm-safe-bridgectl.js'), '#!/usr/bin/env node\n');
  fs.writeFileSync(path.join(sourceDir, 'src', 'renderer', 'index.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(sourceDir, 'package.json'), '{"name":"glm-safe-statusline"}\n');
  fs.writeFileSync(path.join(sourceDir, 'README.md'), '# demo\n');

  fs.mkdirSync(path.join(homeDir, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, '.claude', 'settings.json'),
    JSON.stringify({ theme: 'dark' }, null, 2),
  );

  const result = installer.installProject({
    sourceDir,
    homeDir,
    now: () => 1776300000000,
    token: '',
  });

  const installDir = path.join(homeDir, '.local', 'share', 'glm-safe-statusline');
  const binDir = path.join(homeDir, '.local', 'bin');
  const claudeSettingsPath = path.join(homeDir, '.claude', 'settings.json');

  assert.equal(result.installDir, installDir);
  assert.equal(result.binDir, binDir);
  assert.equal(
    fs.existsSync(path.join(installDir, 'bin', 'glm-safe-statusline.js')),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(binDir, 'glm-safe-statusline')),
    true,
  );

  const wrapper = fs.readFileSync(path.join(binDir, 'glm-safe-statusline'), 'utf8');
  assert.match(wrapper, /node "\$SCRIPT_DIR\/\.\.\/share\/glm-safe-statusline\/bin\/glm-safe-statusline\.js"/);

  const settings = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8'));
  assert.equal(settings.theme, 'dark');
  assert.deepEqual(settings.statusLine, {
    type: 'command',
    command: path.join(binDir, 'glm-safe-statusline'),
  });

  const backupPath = path.join(homeDir, '.claude', 'settings.json.bak-1776300000000');
  assert.equal(fs.existsSync(backupPath), true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('installProject writes bridge config when a token is provided', () => {
  assert.equal(typeof installer.installProject, 'function');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glm-install-test-'));
  const sourceDir = path.join(tmpDir, 'source');
  const homeDir = path.join(tmpDir, 'home');

  fs.mkdirSync(path.join(sourceDir, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(sourceDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'bin', 'glm-safe-statusline.js'), '#!/usr/bin/env node\n');
  fs.writeFileSync(path.join(sourceDir, 'bin', 'glm-safe-bridge.js'), '#!/usr/bin/env node\n');
  fs.writeFileSync(path.join(sourceDir, 'bin', 'glm-safe-bridgectl.js'), '#!/usr/bin/env node\n');
  fs.writeFileSync(path.join(sourceDir, 'src', 'placeholder.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(sourceDir, 'package.json'), '{"name":"glm-safe-statusline"}\n');
  fs.writeFileSync(path.join(sourceDir, 'README.md'), '# demo\n');

  installer.installProject({
    sourceDir,
    homeDir,
    now: () => 1776300000000,
    token: 'secret-token',
  });

  const configPath = path.join(homeDir, '.glm-safe-statusline', 'bridge.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  assert.deepEqual(config, {
    authToken: 'secret-token',
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('parseArgs supports skip-token and explicit token flows', () => {
  assert.equal(typeof installCli.parseArgs, 'function');

  assert.deepEqual(
    installCli.parseArgs(['--skip-token', '--source-dir', '/repo']),
    {
      homeDir: null,
      skipToken: true,
      sourceDir: '/repo',
      token: '',
    },
  );

  assert.deepEqual(
    installCli.parseArgs(['--token', 'abc123', '--home', '/tmp/demo', '--source-dir', '/repo']),
    {
      homeDir: '/tmp/demo',
      skipToken: false,
      sourceDir: '/repo',
      token: 'abc123',
    },
  );
});
