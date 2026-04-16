# GLM Safe StatusLine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GLM-only Claude Code status line with a local read-only bridge so the renderer never reads the upstream credential.

**Architecture:** Split the system into a local `bridge` daemon, a `renderer` status line command, and a thin `bridgectl` manager. Share only a sanitized snapshot schema over a Unix socket, and keep ANSI rendering fully inside the renderer.

**Tech Stack:** Node.js 24, CommonJS, built-in `node:test`, built-in `assert`, built-in `net/http/https/fs`

---

## File Structure

- Create: `package.json`
- Create: `bin/glm-safe-statusline.js`
- Create: `bin/glm-safe-bridge.js`
- Create: `bin/glm-safe-bridgectl.js`
- Create: `src/shared/constants.js`
- Create: `src/shared/schema.js`
- Create: `src/shared/runtime.js`
- Create: `src/shared/socket.js`
- Create: `src/renderer/render.js`
- Create: `src/renderer/index.js`
- Create: `src/bridge/config.js`
- Create: `src/bridge/upstream.js`
- Create: `src/bridge/state.js`
- Create: `src/bridge/server.js`
- Create: `src/bridgectl/index.js`
- Create: `tests/renderer.test.js`
- Create: `tests/bridge.test.js`
- Create: `tests/contract.test.js`
- Modify: `README.md`
- Modify: `.gitignore`

### Task 1: Project Scaffold and Shared Contract

**Files:**
- Create: `package.json`
- Create: `src/shared/constants.js`
- Create: `src/shared/schema.js`
- Create: `src/shared/runtime.js`
- Create: `src/shared/socket.js`
- Test: `tests/contract.test.js`

- [ ] **Step 1: Write the failing contract tests**

Write tests for:
- GLM runtime gating vs non-GLM runtime
- sanitized snapshot validation
- Unix socket path resolution and local-only defaults

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/contract.test.js`
Expected: FAIL with missing shared modules

- [ ] **Step 3: Write minimal shared implementation**

Implement:
- snapshot status constants
- snapshot schema validation/coercion
- runtime provider detection
- socket path helpers for bridge and renderer

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/contract.test.js`
Expected: PASS

### Task 2: Bridge Fetching, State, and Local Read API

**Files:**
- Create: `src/bridge/config.js`
- Create: `src/bridge/upstream.js`
- Create: `src/bridge/state.js`
- Create: `src/bridge/server.js`
- Test: `tests/bridge.test.js`

- [ ] **Step 1: Write the failing bridge tests**

Write tests for:
- allowlisted upstream URL enforcement
- raw GLM response sanitization into approved snapshot schema
- `fresh`, `stale`, `unavailable` state transitions
- local socket server returning only sanitized JSON

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bridge.test.js`
Expected: FAIL with missing bridge modules

- [ ] **Step 3: Write minimal bridge implementation**

Implement:
- bridge config loading from bridge-only env or user-private config
- upstream fetch with timeout and fixed endpoint
- snapshot state container
- Unix socket server with read-only `GET_SNAPSHOT` style request

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bridge.test.js`
Expected: PASS

### Task 3: Renderer Telemetry Rail and Fallbacks

**Files:**
- Create: `src/renderer/render.js`
- Create: `src/renderer/index.js`
- Create: `bin/glm-safe-statusline.js`
- Test: `tests/renderer.test.js`

- [ ] **Step 1: Write the failing renderer tests**

Write tests for:
- non-GLM runtime renders only base line plus project line
- GLM runtime with fresh snapshot renders telemetry rail
- stale snapshot shows freshness hint
- unavailable bridge renders `quota unavailable` without crashing

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/renderer.test.js`
Expected: FAIL with missing renderer modules

- [ ] **Step 3: Write minimal renderer implementation**

Implement:
- stdin parsing
- local bridge read with hard timeout
- ANSI badge/rail rendering

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/renderer.test.js`
Expected: PASS

### Task 4: Bridgectl and End-to-End Wiring

**Files:**
- Create: `src/bridgectl/index.js`
- Create: `bin/glm-safe-bridge.js`
- Create: `bin/glm-safe-bridgectl.js`
- Modify: `README.md`
- Modify: `.gitignore`
- Test: `tests/bridge.test.js`
- Test: `tests/renderer.test.js`
- Test: `tests/contract.test.js`

- [ ] **Step 1: Write the failing bridgectl test coverage**

Add tests for:
- bridge process metadata paths
- `status` behavior when bridge socket/pid is present or missing
- safe stop behavior when bridge is absent

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bridge.test.js`
Expected: FAIL with missing bridgectl behavior

- [ ] **Step 3: Write minimal bridgectl and docs updates**

Implement:
- `start`, `stop`, `status` commands
- executable entrypoints
- README usage for bridge startup and Claude Code `statusLine`
- ignore bridge runtime artifacts

- [ ] **Step 4: Run full test suite**

Run: `node --test tests/*.test.js`
Expected: PASS

- [ ] **Step 5: Manual smoke check**

Run:
- `node bin/glm-safe-bridgectl.js status`
- `printf '{}' | node bin/glm-safe-statusline.js`

Expected:
- bridgectl prints a stable local status message
- renderer exits cleanly and prints a safe fallback or base line
