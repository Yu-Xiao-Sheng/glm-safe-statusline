# GLM Direct StatusLine Design

**Date**: 2026-04-16
**Status**: Approved
**Author**: Claude
**Type**: Architecture Refactoring

## Overview

Remove the Bridge daemon component from the GLM Safe StatusLine project. The renderer will now directly request quota information from the GLM API using the `ANTHROPIC_API_KEY` environment variable that Claude Code already provides.

## Motivation

The original architecture used a separate Bridge daemon process to isolate credential access and API requests. This added complexity:
- Additional process management (start/stop/status)
- Unix socket communication between renderer and bridge
- Separate configuration for bridge credentials
- More installation steps

The new architecture simplifies the system by having the renderer directly communicate with the GLM API, using the token that Claude Code already has in its environment.

## Architecture

### Before (Bridge + Renderer)

```
Claude Code → Renderer ← Unix Socket → Bridge Daemon → GLM API
                                   ↑
                            GLM_SAFE_BRIDGE_AUTH_TOKEN
```

### After (Direct Renderer)

```
Claude Code → Renderer → GLM API
                    ↑
         ANTHROPIC_API_KEY
```

## Component Changes

### Deleted

| Component | Reason |
|-----------|--------|
| `src/bridge/config.js` | Bridge configuration no longer needed |
| `src/bridge/state.js` | Bridge state management no longer needed |
| `src/bridge/server.js` | Unix socket server no longer needed |
| `src/bridge/daemon.js` | Bridge daemon no longer needed |
| `src/bridgectl/index.js` | Bridge control commands no longer needed |
| `bin/glm-safe-bridge.js` | Bridge daemon entrypoint no longer needed |
| `bin/glm-safe-bridgectl.js` | Bridge control entrypoint no longer needed |

### Modified

| Component | Changes |
|-----------|---------|
| `src/renderer/index.js` | Remove socket communication, add direct API requests |
| `install.sh` | Remove bridge installation steps |
| `src/install/installer.js` | Remove bridge-related functions |
| `README.md` | Update documentation for new architecture |

### Created

| Component | Purpose |
|-----------|---------|
| `src/renderer/upstream.js` | Moved from `src/bridge/upstream.js`, handles direct GLM API requests |

### Unchanged

| Component | Reason |
|-----------|--------|
| `src/shared/constants.js` | Status constants still needed |
| `src/shared/schema.js` | Schema validation still needed |
| `src/shared/runtime.js` | Runtime detection still needed |
| `src/renderer/render.js` | Rendering logic unchanged |
| `bin/glm-safe-statusline.js` | Main entrypoint unchanged |

## Data Flow

1. Claude Code invokes statusLine command
   - Calls: `bin/glm-safe-statusline.js`

2. Renderer reads stdin
   - Parses: model, context, tokens/s

3. Runtime detection
   - Checks if `ANTHROPIC_BASE_URL` contains `open.bigmodel.cn`
   - If GLM: continue to quota request
   - If not GLM: render base info only

4. GLM quota request (if GLM runtime)
   - Read token from: `process.env.ANTHROPIC_API_KEY`
   - Request URL: `https://open.bigmodel.cn/api/monitor/usage/quota/limit`
   - Headers: `Authorization: Bearer <token>`
   - Timeout: 3 seconds
   - Parse response using `sanitizeSnapshot()`
   - On failure: set appropriate error status

5. Render output
   - Non-GLM: base info (model | CTX | branch)
   - GLM with data: full Telemetry Rail
   - GLM with error: error message

## Error Handling

### Error Status Mapping

| Scenario | Status | Output Display |
|----------|--------|----------------|
| Token not configured | `no_token` | `QUOTA \| no token configured` |
| Network unreachable | `network_error` | `QUOTA \| network error` |
| Request timeout (3s) | `timeout` | `QUOTA \| request timeout` |
| API returns 401 | `unauthorized` | `QUOTA \| unauthorized` |
| API returns 403 | `forbidden` | `QUOTA \| forbidden` |
| API returns other 4xx | `client_error` | `QUOTA \| client error (4xx)` |
| API returns 5xx | `server_error` | `QUOTA \| server error (5xx)` |
| Response parse failed | `invalid_response` | `QUOTA \| invalid response` |

### Error Handling Logic

```javascript
if (provider.isGlm) {
  if (!env.ANTHROPIC_API_KEY) {
    snapshot = { status: 'no_token' };
  } else {
    try {
      snapshot = await fetchQuotaSnapshot({
        authToken: env.ANTHROPIC_API_KEY,
        requestTimeoutMs: 3000,
      });
    } catch (error) {
      // Map error to specific status
      if (error.message.includes('timeout')) {
        snapshot = { status: 'timeout' };
      } else if (error.message.includes('ECONNREFUSED')) {
        snapshot = { status: 'network_error' };
      } else if (error.message.includes('401')) {
        snapshot = { status: 'unauthorized' };
      } else if (error.message.includes('403')) {
        snapshot = { status: 'forbidden' };
      } else {
        snapshot = { status: 'error' };
      }
    }
  }
}
```

### Error Output Examples

**GLM with no token:**
```
GLM-4.5 | CTX 81%
QUOTA    | no token configured
glm-safe-statusline | main
```

**GLM with network error:**
```
GLM-4.5 | CTX 81%
QUOTA    | network error
glm-safe-statusline | main
```

**GLM with timeout:**
```
GLM-4.5 | CTX 81%
QUOTA    | request timeout
glm-safe-statusline | main
```

## Testing

### Tests to Delete

- `tests/bridge.test.js` - Entire file (bridge logic removed)
- Socket-related tests in `tests/contract.test.js`
- Bridge installation tests in `tests/install.test.js`

### Tests to Modify

**`tests/renderer.test.js`:**
```javascript
// Add new tests
+ renderStatusLine shows 'no token' when ANTHROPIC_API_KEY is missing
+ renderStatusLine shows 'timeout' when request times out
+ renderStatusLine shows 'network error' on connection failure
+ renderStatusLine shows 'unauthorized' on 401 response
+ renderStatusLine shows 'forbidden' on 403 response
+ renderStatusLine shows 'server error' on 500 response

// Remove old tests
- renderStatusLine reads from bridge socket
```

### Tests to Keep

```javascript
// tests/contract.test.js
+ sanitizeSnapshot validates the public bridge schema
+ sanitizeSnapshot rejects invalid statuses
+ detectProviderRuntime recognizes GLM runtime context
+ detectProviderRuntime keeps non-GLM runtime on the base path
```

## Installation

### Simplified Installation Steps

**Before:**
1. Copy runtime files
2. Write wrapper scripts
3. Create bridge runtime directory
4. Write bridge config
5. Start bridge daemon
6. Update Claude settings

**After:**
1. Copy runtime files
2. Write wrapper scripts
3. Update Claude settings

### File Structure After Installation

```
~/.local/share/glm-safe-statusline/
└── (minimal metadata only)
~/.local/bin/
└── glm-safe-statusline
```

### Claude Settings (Unchanged)

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.local/bin/glm-safe-statusline"
  }
}
```

## Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `ANTHROPIC_API_KEY` | Claude Code environment | GLM API token |
| `ANTHROPIC_BASE_URL` | Claude Code environment | Used to detect GLM runtime |

No additional configuration needed.

## Implementation Tasks

1. **Update schema constants** - Add new error status constants
2. **Move upstream module** - Move `src/bridge/upstream.js` to `src/renderer/upstream.js`
3. **Refactor renderer** - Update `src/renderer/index.js` to use direct API calls
4. **Update render logic** - Add error message rendering in `src/renderer/render.js`
5. **Delete bridge code** - Remove `src/bridge/`, `src/bridgectl/`, and bridge bin files
6. **Update installer** - Remove bridge installation logic
7. **Update tests** - Delete bridge tests, add new error handling tests
8. **Update documentation** - Rewrite README for new architecture

## Migration Notes

For users upgrading from the bridge-based version:

1. Run the new installer: `bash install.sh`
2. Stop any running bridge daemons (if present)
3. Clean up old bridge files (optional):
   ```bash
   rm -rf ~/.glm-safe-statusline/
   rm ~/.local/bin/glm-safe-bridgectl
   ```

## Trade-offs

### Benefits

- **Simplicity**: No separate daemon process to manage
- **Easier installation**: Fewer steps, less configuration
- **Fewer failure modes**: No socket connection issues
- **Clearer errors**: Users see specific error messages

### Drawbacks

- **No caching**: Every status line refresh makes an API request
- **Token exposure**: Renderer process has direct access to GLM token (same as Claude Code itself)
- **Latency**: Each status line update waits for API response (3s timeout)

## Future Enhancements

Out of scope for this refactoring, but potential future improvements:

- Add in-memory caching to reduce API requests
- Add configurable cache duration
- Support for multiple providers
- Browser-based quota visualization panel
