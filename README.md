
# GLM Safe StatusLine

本项目实现了一个面向 GLM 的 Claude Code 状态线方案：`renderer` 只负责渲染，`bridge` 独占额度采集和 secret 读取。状态线脚本本身不直接碰上游 key，也不直接请求 GLM quota API。

## Components

- `bin/glm-safe-statusline.js`
  Claude Code `statusLine` 入口。读取 `stdin`，向本地 bridge 请求脱敏快照，渲染 `Telemetry Rail`。
- `bin/glm-safe-bridge.js`
  本地 bridge daemon。读取 bridge 专属 secret，访问固定 GLM quota endpoint，缓存脱敏快照，并通过本地 socket 提供只读访问。
- `bin/glm-safe-bridgectl.js`
  本地控制命令，提供 `start | stop | status`。
## Runtime Model

- `renderer` 不读取 `GLM` key
- `renderer` 不直连上游 quota API
- `bridge` 是唯一允许读取 credential 和访问上游 quota 的进程
- `renderer <-> bridge` 默认通过 Unix socket 通信
- Windows 环境下自动退化为 `127.0.0.1` TCP loopback

## One-Click Install

适用于 `macOS/Linux`：

```bash
bash install.sh
```

安装器会完成这些动作：

- 复制运行时文件到 `~/.local/share/glm-safe-statusline`
- 写入命令入口到 `~/.local/bin`
- 备份并更新 `~/.claude/settings.json`
- 默认交互式提示输入 `GLM token`
- 如果本地已配置 token，会尝试自动启动 bridge

可选参数：

```bash
bash install.sh --skip-token
bash install.sh --token "your-glm-token"
```

安装完成后，Claude Code 会直接使用：

```text
~/.local/bin/glm-safe-statusline
```

如果你的 shell 里没有 `~/.local/bin`，只会影响手动执行命令，不影响 Claude Code 的 `statusLine`。

## Manual Setup

### 1. 配置 bridge secret

推荐在启动 bridge 时注入专用环境变量：

```bash
export GLM_SAFE_BRIDGE_AUTH_TOKEN="your-glm-token"
```

也可以把配置写入：

```text
~/.glm-safe-statusline/bridge.config.json
```

示例：

```json
{
  "authToken": "your-glm-token"
}
```

### 2. 启动 bridge

```bash
node bin/glm-safe-bridgectl.js start
node bin/glm-safe-bridgectl.js status
```

### 3. 配置 Claude Code statusLine

`~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.local/bin/glm-safe-statusline"
  }
}
```

## Output Shape

非 GLM 运行时只显示基础信息：

```text
claude-sonnet-4-6 | CTX 42% | 400.0 t/s
demo-project | main
```

GLM 运行时显示 `Telemetry Rail`：

```text
GLM-4.5 | CTX 34% | 218.0 t/s
TOKEN 5H | █████░░░ | 62%
PLAN     | PRO | reset 1h53m
MCP      | 680/1000 | fresh 14s
glm-safe-statusline | feature/rail
```

bridge 不可用时安全降级：

```text
GLM-4.5 | CTX 81%
QUOTA    | quota unavailable
glm-safe-statusline | main
```

## Tests

```bash
npm test
```

## Notes

- 当前版本只支持 GLM
- 当前版本没有浏览器面板
- 当前版本没有多供应商抽象
- 当前版本默认把 bridge runtime 文件放在 `~/.glm-safe-statusline/`
