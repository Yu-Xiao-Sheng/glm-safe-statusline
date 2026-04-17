<div align="center">

# GLM Direct StatusLine

**轻量级的 Claude Code 状态栏，用于 GLM 配额监控**

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](tests/)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[English](README.md) | 简体中文

</div>

---

## ✨ 特性

- 🚀 **直接 API 集成** - 无需后台守护进程
- ⚡ **快速轻量** - 3秒超时，资源占用最小
- 🎯 **智能令牌检测** - 自动从 Claude 设置中读取
- 🛡️ **错误处理** - 清晰的错误信息便于排查
- ✅ **测试完善** - 全面的测试覆盖

## 📦 安装

### 快速安装 (macOS/Linux)

```bash
bash install.sh
```

安装器将自动完成以下操作：
- 复制运行时文件到 `~/.local/share/glm-safe-statusline`
- 创建命令入口到 `~/.local/bin/glm-safe-statusline`
- 更新 `~/.claude/settings.json`（自动备份）

### 手动安装

```bash
# 安装依赖
npm install

# 全局链接命令
npm link
```

## ⚙️ 配置

状态栏会自动从以下位置检测你的 GLM 令牌：

1. **`~/.claude/settings.json`**（优先）
   ```json
   {
     "env": {
       "ANTHROPIC_AUTH_TOKEN": "your-token-here"
     }
   }
   ```

2. **环境变量**（备选）
   ```bash
   export ANTHROPIC_API_KEY="your-token-here"
   ```

使用 Claude Code 配置 GLM 时无需额外配置！

## 📊 输出示例

### GLM 运行时 - 正常状态

```
GLM-4.5 | CTX 34% | 218.0 t/s
TOKEN 5H | █████░░░ | 62%
PLAN     | PRO | reset 1h53m
MCP      | 968/1968 | fresh 14s
my-project | main
```

### GLM 运行时 - 错误状态

```
GLM-4.5 | CTX 81%
QUOTA    | no token configured
my-project | main
```

### 非 GLM 运行时

```
claude-sonnet-4-6 | CTX 42% | 400.0 t/s
my-project | main
```

## 🔧 故障排除

| 错误信息 | 原因 | 解决方案 |
|---------------|-------|----------|
| `no token configured` | 未找到令牌 | 检查 `~/.claude/settings.json` 或设置 `ANTHROPIC_API_KEY` |
| `network error` | 无法连接 GLM API | 检查网络连接 |
| `request timeout` | API 请求超时（3秒） | 稍后重试，API 可能响应较慢 |
| `unauthorized` | 令牌无效（401） | 验证令牌是否正确 |
| `forbidden` | 令牌缺少权限（403） | 检查令牌权限 |
| `client error` | 其他 4xx 错误 | 检查 API 端点配置 |
| `server error` | GLM API 故障（5xx） | 等待后重试 |
| `invalid response` | 响应解析失败 | API 可能已更新，请报告问题 |

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行测试并查看覆盖率
npm run test:coverage
```

## 🏗️ 架构

```
src/
├── renderer/
│   ├── index.js      # 主入口
│   ├── render.js     # 状态栏渲染
│   └── upstream.js   # 直接 API 客户端
├── shared/
│   ├── constants.js  # 错误状态常量
│   └── runtime.js    # 提供商检测
tests/
└── *.test.js         # 全面测试
```

## 📝 技术细节

- **运行环境**: Node.js ≥ 18.0.0
- **API 端点**: `https://open.bigmodel.cn/api/monitor/usage/quota/limit`
- **请求超时**: 3 秒
- **状态栏接口**: Claude Code `statusLine` 命令类型

## 🤝 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

为 Claude Code 社区构建，使用 GLM API。

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star！**

</div>
