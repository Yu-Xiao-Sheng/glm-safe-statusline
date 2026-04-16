# Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click macOS/Linux installer that installs the project into a user-owned location, optionally captures a GLM token, and automatically updates Claude Code `statusLine`.

**Architecture:** Keep the user-facing entrypoint as `install.sh`, but move all stateful install logic into a testable Node installer module. Bash handles prompting and invocation; Node handles copying files, writing wrappers, backing up and updating `~/.claude/settings.json`, and writing bridge config safely.

**Tech Stack:** Bash, Node.js 24, CommonJS, built-in `node:test`, built-in `assert`, built-in `fs/path/os`

---

### Task 1: Installer Contract and Claude Config Merge

**Files:**
- Create: `tests/install.test.js`
- Create: `src/install/installer.js`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
  Run: `node --test tests/install.test.js`
  Expected: FAIL with missing installer module
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**
  Run: `node --test tests/install.test.js`
  Expected: PASS

### Task 2: Install Script and Wrapper Generation

**Files:**
- Create: `install.sh`
- Create: `scripts/install.js`
- Modify: `README.md`
- Modify: `.gitignore`
- Test: `tests/install.test.js`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
  Run: `node --test tests/install.test.js`
  Expected: FAIL with missing install runner behavior
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**
  Run: `node --test tests/install.test.js`
  Expected: PASS

### Task 3: Full Verification

**Files:**
- Modify: `README.md`
- Test: `tests/install.test.js`
- Test: `tests/bridge.test.js`
- Test: `tests/contract.test.js`
- Test: `tests/renderer.test.js`

- [ ] **Step 1: Run full suite**
  Run: `npm test`
  Expected: PASS
- [ ] **Step 2: Run installer smoke test**
  Run: `bash install.sh --skip-token`
  Expected: install completes, wrappers are written, Claude settings updated with backup
