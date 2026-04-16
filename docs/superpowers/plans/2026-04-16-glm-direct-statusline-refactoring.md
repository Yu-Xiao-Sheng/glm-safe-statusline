# GLM Direct StatusLine Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Bridge daemon component and refactor the renderer to directly request quota information from the GLM API using the `ANTHROPIC_API_KEY` environment variable.

**Architecture:** Simplify from "Bridge Daemon + Renderer" to "Direct Renderer" architecture. The renderer will directly communicate with the GLM quota API, eliminating the need for a separate bridge process, Unix socket communication, and bridge process management.

**Tech Stack:** Node.js 24, CommonJS, built-in `node:test`, built-in `assert`, built-in `https`, built-in `fs/path/os`

---

## File Structure

### Files to Delete
- `src/bridge/config.js` - Bridge configuration loading
- `src/bridge/state.js` - Bridge state management
- `src/bridge/server.js` - Unix socket server
- `src/bridge/daemon.js` - Bridge daemon process management
- `src/bridgectl/index.js` - Bridge control commands
- `bin/glm-safe-bridge.js` - Bridge daemon entrypoint
- `bin/glm-safe-bridgectl.js` - Bridge control entrypoint
- `tests/bridge.test.js` - Bridge tests

### Files to Modify
- `src/shared/constants.js` - Add error status constants
- `src/shared/schema.js` - Update schema validation for new error statuses
- `src/renderer/index.js` - Remove socket logic, add direct API calls
- `src/renderer/render.js` - Add error message rendering
- `src/install/installer.js` - Remove bridge installation logic
- `install.sh` - Remove bridge installation steps
- `tests/contract.test.js` - Remove socket tests, keep schema/runtime tests
- `tests/renderer.test.js` - Add new error handling tests
- `tests/install.test.js` - Update for new installation flow
- `README.md` - Update documentation for new architecture

### Files to Create
- `src/renderer/upstream.js` - Moved from `src/bridge/upstream.js`, handles direct GLM API requests

---

## Task 1: Add Error Status Constants

**Files:**
- Modify: `src/shared/constants.js`
- Test: `tests/contract.test.js`

- [ ] **Step 1: Write the failing test**

First, let's understand what we need to add. We'll add new error status constants for different failure scenarios. Open `tests/contract.test.js` and add tests for the new constants:

```javascript
// Add to tests/contract.test.js
test('SNAPSHOT_STATUS includes all error states', (t) => {
  const { SNAPSHOT_STATUS } = require('../src/shared/constants');
  
  t.equal(SNAPSHOT_STATUS.NO_TOKEN, 'no_token');
  t.equal(SNAPSHOT_STATUS.TIMEOUT, 'timeout');
  t.equal(SNAPSHOT_STATUS.NETWORK_ERROR, 'network_error');
  t.equal(SNAPSHOT_STATUS.UNAUTHORIZED, 'unauthorized');
  t.equal(SNAPSHOT_STATUS.FORBIDDEN, 'forbidden');
  t.equal(SNAPSHOT_STATUS.CLIENT_ERROR, 'client_error');
  t.equal(SNAPSHOT_STATUS.SERVER_ERROR, 'server_error');
  t.equal(SNAPSHOT_STATUS.INVALID_RESPONSE, 'invalid_response');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/contract.test.js`
Expected: FAIL with "SNAPSHOT_STATUS.NO_TOKEN is undefined"

- [ ] **Step 3: Write minimal implementation**

Add the new error status constants to `src/shared/constants.js`:

```javascript
// Add to SNAPSHOT_STATUS Object.freeze
const SNAPSHOT_STATUS = Object.freeze({
  FRESH: 'fresh',
  STALE: 'stale',
  UNAVAILABLE: 'unavailable',
  // New error statuses
  NO_TOKEN: 'no_token',
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network_error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  CLIENT_ERROR: 'client_error',
  SERVER_ERROR: 'server_error',
  INVALID_RESPONSE: 'invalid_response',
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/contract.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants.js tests/contract.test.js
git commit -m "feat: add error status constants for direct API mode"
```

---

## Task 2: Update Schema Validation for Error Statuses

**Files:**
- Modify: `src/shared/schema.js`
- Test: `tests/contract.test.js`

- [ ] **Step 1: Write the failing test**

The new error statuses should be valid in the schema. Add this test to `tests/contract.test.js`:

```javascript
test('sanitizeSnapshot accepts new error statuses', (t) => {
  const { sanitizeSnapshot } = require('../src/shared/schema');
  
  const errorStatuses = [
    'no_token', 'timeout', 'network_error', 'unauthorized',
    'forbidden', 'client_error', 'server_error', 'invalid_response'
  ];
  
  for (const status of errorStatuses) {
    const result = sanitizeSnapshot({ status });
    t.equal(result.status, status, `status ${status} should be valid`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/contract.test.js`
Expected: FAIL with "Invalid snapshot status"

- [ ] **Step 3: Write minimal implementation**

Update `src/shared/schema.js` - the `VALID_STATUSES` Set already includes all `SNAPSHOT_STATUS` values via `Object.values()`, so this test should already pass once Task 1 is complete. If the test still fails, verify that `VALID_STATUSES` is constructed correctly:

```javascript
// In src/shared/schema.js, verify this is correct:
const VALID_STATUSES = new Set(Object.values(SNAPSHOT_STATUS));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/contract.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/schema.js tests/contract.test.js
git commit -m "test: verify schema accepts new error statuses"
```

---

## Task 3: Create Direct API Client Module

**Files:**
- Create: `src/renderer/upstream.js`
- Test: `tests/renderer.test.js`

- [ ] **Step 1: Write the failing test**

We need a module that directly fetches quota from GLM API. Write the test first:

```javascript
// Add to tests/renderer.test.js
test('fetchQuotaSnapshot requests GLM API directly', async (t) => {
  const { fetchQuotaSnapshot } = require('../src/renderer/upstream');
  
  // Mock https module
  const mockHttps = {
    get: (url, options, callback) => {
      // Simulate successful response
      const mockRes = {
        setEncoding: () => {},
        on: (event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ code: 200, data: { level: 'pro', limits: [] } }));
          }
          if (event === 'end') {
            handler();
          }
        },
      };
      callback(mockRes);
      return { on: () => {}, setTimeout: () => {} };
    },
  };
  
  const snapshot = await fetchQuotaSnapshot({
    authToken: 'test-token',
    quotaEndpoint: 'https://open.bigmodel.cn/api/monitor/usage/quota/limit',
  }, { transport: mockHttps });
  
  t.equal(snapshot.status, 'fresh');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/renderer.test.js`
Expected: FAIL with "Cannot find module '../src/renderer/upstream'"

- [ ] **Step 3: Write minimal implementation**

Create `src/renderer/upstream.js` by copying and modifying `src/bridge/upstream.js`:

```javascript
// src/renderer/upstream.js
const https = require('node:https');

const { sanitizeSnapshot } = require('../shared/schema');

const DEFAULT_QUOTA_ENDPOINT = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit';
const DEFAULT_REQUEST_TIMEOUT_MS = 3 * 1000;

const DEFAULT_QUOTA_BY_LEVEL = {
  lite: 100,
  pro: 1000,
  max: 4000,
};

function mapQuotaResponseToSnapshot(payload = {}, options = {}) {
  const quotaByLevel = options.quotaByLevel || DEFAULT_QUOTA_BY_LEVEL;
  const now = options.now || Date.now;
  const fetchedAt = options.fetchedAt || now();
  const limits = Array.isArray(payload.limits) ? payload.limits : [];
  const planLevel = String(payload.level || 'unknown').toLowerCase();
  const tokenLimit = limits.find((item) => item.type === 'TOKENS_LIMIT') || {};
  const timeLimit = limits.find((item) => item.type === 'TIME_LIMIT') || {};
  const total = quotaByLevel[planLevel] || null;
  const remaining = total === null ? null : Math.max(0, total - Number(timeLimit.usage || 0));

  return sanitizeSnapshot({
    status: 'fresh',
    plan_level: planLevel,
    token_usage_pct: tokenLimit.percentage,
    token_reset_at: tokenLimit.nextResetTime,
    mcp_remaining: remaining,
    mcp_total: total,
    snapshot_age_ms: now() - fetchedAt,
    fetched_at: fetchedAt,
  });
}

function fetchQuotaSnapshot(config, options = {}) {
  const transport = options.transport || https;
  const now = options.now || Date.now;

  return new Promise((resolve, reject) => {
    const quotaEndpoint = config.quotaEndpoint || DEFAULT_QUOTA_ENDPOINT;
    const authToken = config.authToken;

    if (!authToken) {
      reject(new Error('NO_TOKEN'));
      return;
    }

    const req = transport.get(quotaEndpoint, {
      headers: {
        Authorization: authToken,
        Accept: 'application/json',
        'Accept-Language': 'en-US,en',
      },
    }, (res) => {
      let body = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.code !== 200 || !parsed.data) {
            reject(new Error(`API_ERROR_${res.statusCode}`));
            return;
          }

          resolve(mapQuotaResponseToSnapshot(parsed.data, {
            fetchedAt: now(),
            now,
          }));
        } catch (error) {
          reject(new Error('INVALID_RESPONSE'));
        }
      });
    });

    req.on('error', (error) => {
      if (error.code === 'ECONNREFUSED') {
        reject(new Error('NETWORK_ERROR'));
      } else {
        reject(error);
      }
    });

    req.setTimeout(config.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('TIMEOUT'));
    });
  });
}

module.exports = {
  DEFAULT_QUOTA_ENDPOINT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_QUOTA_BY_LEVEL,
  fetchQuotaSnapshot,
  mapQuotaResponseToSnapshot,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/renderer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/upstream.js tests/renderer.test.js
git commit -m "feat: add direct GLM API client module"
```

---

## Task 4: Update Renderer to Use Direct API

**Files:**
- Modify: `src/renderer/index.js`
- Test: `tests/renderer.test.js`

- [ ] **Step 1: Write the failing test**

Test that renderer uses `ANTHROPIC_API_KEY` and calls the new API client:

```javascript
// Add to tests/renderer.test.js
test('renderStatusLine uses ANTHROPIC_API_KEY for GLM', async (t) => {
  const { renderStatusLine } = require('../src/renderer/index');
  const { fetchQuotaSnapshot } = require('../src/renderer/upstream');
  
  // Mock fetchQuotaSnapshot
  let capturedToken = null;
  const originalFetch = fetchQuotaSnapshot;
  
  // We'll need to inject the mock, but first let's verify the behavior
  const stdin = {
    model: { display_name: 'GLM-4.5' },
    context_window: { used_percentage: 81 },
  };
  
  const output = await renderStatusLine({
    stdin,
    env: {
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/v1',
      ANTHROPIC_API_KEY: 'test-key-123',
    },
    branch: 'main',
    fetchQuotaSnapshot: async (config) => {
      capturedToken = config.authToken;
      return { status: 'fresh', plan_level: 'pro', token_usage_pct: 45 };
    },
  });
  
  t.equal(capturedToken, 'test-key-123');
  t.ok(output.includes('GLM-4.5'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/renderer.test.js`
Expected: FAIL - the current implementation still uses `readBridgeSnapshot`

- [ ] **Step 3: Write minimal implementation**

Update `src/renderer/index.js`:

```javascript
// src/renderer/index.js
const { execSync } = require('node:child_process');

const { detectProviderRuntime } = require('../shared/runtime');
const { renderStatusOutput } = require('./render');
const { fetchQuotaSnapshot } = require('./upstream');
const { SNAPSHOT_STATUS } = require('../shared/constants');

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

function mapErrorToStatus(error) {
  const message = error.message || '';
  
  if (message === 'NO_TOKEN') {
    return SNAPSHOT_STATUS.NO_TOKEN;
  }
  if (message === 'TIMEOUT') {
    return SNAPSHOT_STATUS.TIMEOUT;
  }
  if (message === 'NETWORK_ERROR' || message.includes('ECONNREFUSED')) {
    return SNAPSHOT_STATUS.NETWORK_ERROR;
  }
  if (message.includes('401') || message.includes('API_ERROR_401')) {
    return SNAPSHOT_STATUS.UNAUTHORIZED;
  }
  if (message.includes('403') || message.includes('API_ERROR_403')) {
    return SNAPSHOT_STATUS.FORBIDDEN;
  }
  if (message === 'INVALID_RESPONSE') {
    return SNAPSHOT_STATUS.INVALID_RESPONSE;
  }
  if (message.includes('API_ERROR_5')) {
    return SNAPSHOT_STATUS.SERVER_ERROR;
  }
  if (message.includes('API_ERROR_4')) {
    return SNAPSHOT_STATUS.CLIENT_ERROR;
  }
  
  return SNAPSHOT_STATUS.UNAVAILABLE;
}

async function renderStatusLine(options = {}) {
  const stdin = options.stdin || {};
  const env = options.env || process.env;
  const now = options.now || Date.now;
  const provider = detectProviderRuntime({ env });
  const branch = options.branch ?? getGitBranch();
  let snapshot = null;

  if (provider.isGlm) {
    const apiKey = env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      snapshot = { status: SNAPSHOT_STATUS.NO_TOKEN };
    } else {
      try {
        snapshot = await (options.fetchQuotaSnapshot || fetchQuotaSnapshot)({
          authToken: apiKey,
          requestTimeoutMs: 3000,
        });
      } catch (error) {
        snapshot = { status: mapErrorToStatus(error) };
      }
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
  renderStatusLine,
  mapErrorToStatus,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/renderer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.js tests/renderer.test.js
git commit -m "refactor: renderer uses direct API calls instead of bridge"
```

---

## Task 5: Add Error Message Rendering

**Files:**
- Modify: `src/renderer/render.js`
- Test: `tests/renderer.test.js`

- [ ] **Step 1: Write the failing test**

Test that different error statuses render appropriate messages:

```javascript
// Add to tests/renderer.test.js
test('renderStatusOutput shows specific error messages', (t) => {
  const { renderStatusOutput } = require('../src/renderer/render');
  
  const errorCases = [
    { status: 'no_token', expected: 'no token configured' },
    { status: 'timeout', expected: 'request timeout' },
    { status: 'network_error', expected: 'network error' },
    { status: 'unauthorized', expected: 'unauthorized' },
    { status: 'forbidden', expected: 'forbidden' },
  ];
  
  for (const { status, expected } of errorCases) {
    const output = renderStatusOutput({
      stdin: { model: { display_name: 'GLM-4.5' } },
      snapshot: { status },
      provider: { isGlm: true },
      branch: 'main',
    });
    
    t.ok(output.includes(expected), `status ${status} should show "${expected}"`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/renderer.test.js`
Expected: FAIL - current implementation shows "quota unavailable" for all errors

- [ ] **Step 3: Write minimal implementation**

Update `src/renderer/render.js` to handle error statuses:

```javascript
// In src/renderer/render.js, update the GLM rendering section:

function getErrorMessage(snapshot) {
  const messages = {
    no_token: 'no token configured',
    timeout: 'request timeout',
    network_error: 'network error',
    unauthorized: 'unauthorized',
    forbidden: 'forbidden',
    client_error: 'client error',
    server_error: 'server error',
    invalid_response: 'invalid response',
    unavailable: 'quota unavailable',
  };
  
  return messages[snapshot.status] || 'quota unavailable';
}

// Update renderStatusOutput function:
function renderStatusOutput(options) {
  const {
    stdin,
    snapshot,
    provider,
    branch,
    now = Date.now,
  } = options;
  const lines = [];
  const baseParts = buildBaseParts(stdin);

  if (baseParts.length > 0) {
    lines.push(baseParts.join(colorize(GRAY, ' | ')));
  }

  if (provider.isGlm) {
    if (!snapshot || snapshot.status === 'unavailable' || 
        ['no_token', 'timeout', 'network_error', 'unauthorized', 
         'forbidden', 'client_error', 'server_error', 'invalid_response'
        ].includes(snapshot.status)) {
      // Render error message
      const errorMsg = snapshot ? getErrorMessage(snapshot) : 'quota unavailable';
      lines.push(colorize(RED, `QUOTA    | ${errorMsg}`));
    } else {
      // Existing successful rendering logic
      const tokenPct = snapshot.token_usage_pct ?? 0;
      const railColor = colorForPercentage(tokenPct);
      const resetMs = Number(snapshot.token_reset_at || 0) - now();
      const planLevel = String(snapshot.plan_level || 'unknown').toUpperCase();
      const freshness = formatFreshness(snapshot);
      const mcpText = snapshot.mcp_total
        ? `${snapshot.mcp_remaining}/${snapshot.mcp_total}`
        : '--';

      lines.push(
        `TOKEN 5H | ${makeBar(tokenPct)} | ${colorize(railColor, `${tokenPct}%`)}`,
      );
      lines.push(
        `PLAN     | ${colorize(MAGENTA, planLevel)} | ${colorize(YELLOW, `reset ${formatDuration(resetMs)}`)}`,
      );
      lines.push(
        `MCP      | ${colorize(GREEN, mcpText)}${freshness ? ` | ${colorize(GRAY, freshness)}` : ''}`,
      );
    }
  }

  const projectLine = buildProjectLine(stdin, branch);
  if (projectLine) {
    lines.push(projectLine);
  }

  return lines.join('\n');
}

module.exports = {
  buildBaseParts,
  getThroughput,
  renderStatusOutput,
  getErrorMessage,  // Export for testing
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/renderer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/render.js tests/renderer.test.js
git commit -m "feat: add specific error messages for quota failures"
```

---

## Task 6: Delete Bridge-Related Files

**Files:**
- Delete: `src/bridge/` directory
- Delete: `src/bridgectl/` directory
- Delete: `bin/glm-safe-bridge.js`
- Delete: `bin/glm-safe-bridgectl.js`
- Delete: `tests/bridge.test.js`
- Modify: `tests/contract.test.js` (remove socket tests)

- [ ] **Step 1: Remove socket-related tests**

Update `tests/contract.test.js` - remove socket tests:

```javascript
// Remove these tests from tests/contract.test.js:
// - "getSocketConfig defaults to a local user-private unix socket path"
// - "getSocketConfig uses loopback tcp fallback on win32"

// Keep these tests:
// - sanitizeSnapshot tests
// - detectProviderRuntime tests
```

- [ ] **Step 2: Run remaining tests to verify they still pass**

Run: `node --test tests/contract.test.js`
Expected: PASS (schema and runtime tests should still pass)

- [ ] **Step 3: Delete bridge files**

```bash
# Delete bridge source files
rm -rf src/bridge/
rm -rf src/bridgectl/

# Delete bridge entrypoints
rm bin/glm-safe-bridge.js
rm bin/glm-safe-bridgectl.js

# Delete bridge tests
rm tests/bridge.test.js

# Also remove socket.js from shared since we no longer need it
rm src/shared/socket.js
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS (except any tests that reference deleted modules)

- [ ] **Step 5: Update tests that import deleted modules**

Check if any tests import from deleted modules and update them. If `tests/contract.test.js` imports from `socket.js`, remove those imports.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove bridge daemon and related files"
```

---

## Task 7: Update Installer

**Files:**
- Modify: `src/install/installer.js`
- Modify: `install.sh`
- Test: `tests/install.test.js`

- [ ] **Step 1: Write the failing test**

Update installer tests to reflect new behavior (no bridge files):

```javascript
// Update tests/install.test.js
test('installProject only installs renderer', async (t) => {
  const { installProject } = require('../src/install/installer');
  const fs = require('node:fs');
  
  const tempDir = `/tmp/test-install-${Date.now()}`;
  
  await installProject({
    installDir: tempDir,
    binDir: `${tempDir}/bin`,
    claudeSettingsPath: `${tempDir}/settings.json`,
  });
  
  // Check that renderer exists
  t.ok(fs.existsSync(`${tempDir}/bin/glm-safe-statusline`));
  
  // Check that bridge files do NOT exist
  t.ok(!fs.existsSync(`${tempDir}/bin/glm-safe-bridgectl`));
  t.ok(!fs.existsSync(`${tempDir}/glm-safe-bridge.js`));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/install.test.js`
Expected: FAIL - installer still creates bridge files

- [ ] **Step 3: Write minimal implementation**

Update `src/install/installer.js` to remove bridge-related logic:

```javascript
// src/install/installer.js
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

module.exports = {
  installProject,
  mergeClaudeSettings,
};
```

Update `install.sh`:

```bash
#!/bin/bash
set -e

INSTALL_DIR="$HOME/.local/share/glm-safe-statusline"
BIN_DIR="$HOME/.local/bin"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "Installing GLM Safe StatusLine..."

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Copy renderer
cp bin/glm-safe-statusline.js "$INSTALL_DIR/"

# Create wrapper
cat > "$BIN_DIR/glm-safe-statusline" <<'EOF'
#!/bin/sh
exec node "$INSTALL_DIR/glm-safe-statusline.js" "$@"
EOF
chmod +x "$BIN_DIR/glm-safe-statusline"

# Update Claude settings
node -e "
const fs = require('fs');
const path = require('path');

let settings = {};
const settingsPath = '$SETTINGS_FILE';

if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {}
}

// Backup
if (fs.existsSync(settingsPath)) {
  fs.copyFileSync(settingsPath, settingsPath + '.backup.' + Date.now());
}

settings.statusLine = {
  type: 'command',
  command: path.join('$BIN_DIR', 'glm-safe-statusline')
};

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
"

echo "Installation complete!"
echo "Status line command: $BIN_DIR/glm-safe-statusline"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/install.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/install/installer.js install.sh tests/install.test.js
git commit -m "refactor: simplify installer, remove bridge installation"
```

---

## Task 8: Update README Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README for new architecture**

```markdown
# GLM Direct StatusLine

A Claude Code status line that displays GLM quota information. The renderer directly requests quota data from the GLM API using your existing `ANTHROPIC_API_KEY` environment variable.

## Components

- `bin/glm-safe-statusline.js`
  Claude Code `statusLine` entry point. Reads stdin, detects runtime environment,
  and if GLM, directly requests quota API and renders the Telemetry Rail.

## Runtime Model

- Renderer reads GLM token from `ANTHROPIC_API_KEY` environment variable
- Renderer makes direct HTTP requests to GLM quota API
- Request timeout is 3 seconds
- On failure, displays specific error message

## One-Click Install

适用于 `macOS/Linux`：

```bash
bash install.sh
```

安装器会完成这些动作：

- 复制运行时文件到 `~/.local/share/glm-safe-statusline`
- 写入命令入口到 `~/.local/bin`
- 备份并更新 `~/.claude/settings.json`

安装完成后，Claude Code 会直接使用：

```text
~/.local/bin/glm-safe-statusline
```

## Environment Variables

The renderer requires the following environment variable:

- `ANTHROPIC_API_KEY`: Your GLM API token
  - Automatically available when Claude Code is configured for GLM
  - No separate configuration needed

## Output Shape

### Non-GLM Runtime

```text
claude-sonnet-4-6 | CTX 42% | 400.0 t/s
demo-project | main
```

### GLM Runtime - Success

```text
GLM-4.5 | CTX 34% | 218.0 t/s
TOKEN 5H | █████░░░ | 62%
PLAN     | PRO | reset 1h53m
MCP      | 680/1000 | fresh 14s
glm-safe-statusline | feature/rail
```

### GLM Runtime - Error

```text
GLM-4.5 | CTX 81%
QUOTA    | no token configured
glm-safe-statusline | main
```

## Error Messages

When quota information is unavailable, the status line shows the specific reason:

| Message | Cause |
|---------|-------|
| `no token configured` | `ANTHROPIC_API_KEY` is not set |
| `network error` | Cannot reach GLM API |
| `request timeout` | API request timed out (3s) |
| `unauthorized` | Token is invalid (401) |
| `forbidden` | Token lacks permission (403) |
| `client error` | Other 4xx errors |
| `server error` | GLM API is having issues (5xx) |
| `invalid response` | Response parse failed |

## Tests

```bash
npm test
```

## Notes

- Current version only supports GLM
- Current version does not have a browser panel
- Current version does not have multi-provider abstraction
```

- [ ] **Step 2: Verify README is accurate**

Read through the updated README to ensure all references to bridge are removed and the new architecture is correctly described.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for direct API architecture"
```

---

## Task 9: Full Integration Test

**Files:**
- All

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS (20+ tests)

- [ ] **Step 2: Manual smoke test**

Test the status line manually:

```bash
# Install the new version
bash install.sh --skip-token

# Test with GLM environment
export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/v1"
export ANTHROPIC_API_KEY="your-test-key"
echo '{}' | bin/glm-safe-statusline.js

# Test without GLM environment
unset ANTHROPIC_BASE_URL
echo '{}' | bin/glm-safe-statusline.js
```

Expected: Appropriate output for each scenario

- [ ] **Step 3: Verify file structure**

```bash
ls -la bin/
# Should only see: glm-safe-statusline.js

ls -la src/
# Should NOT see: bridge/, bridgectl/
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: verify full integration after bridge removal"
```

---

## Verification Checklist

Before considering the refactoring complete:

- [ ] All tests pass (`npm test`)
- [ ] No bridge-related files remain
- [ ] README accurately describes new architecture
- [ ] Installer works correctly
- [ ] Status line displays appropriate messages for all error scenarios
- [ ] Manual testing confirms GLM quota is displayed when available
- [ ] No references to bridge in documentation or comments

---

## Migration Notes for Existing Users

Users upgrading from the bridge-based version should:

1. Run the new installer: `bash install.sh`
2. Stop any running bridge daemons (if present)
3. Clean up old bridge files (optional):
   ```bash
   rm -rf ~/.glm-safe-statusline/
   rm ~/.local/bin/glm-safe-bridgectl
   ```
