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
