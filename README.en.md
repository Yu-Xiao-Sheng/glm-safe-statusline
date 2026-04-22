<div align="center">

# Domestic AI StatusLine

**Claude Code status bar for GLM/MiniMax quota monitoring**

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](tests/)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[简体中文](README.md) | English

</div>

---

## ✨ Features

- 🚀 **Direct API Integration** - No background daemon required
- ⚡ **Fast & Lightweight** - 3-second timeout, minimal resource usage
- 🎯 **Smart Token Detection** - Automatically reads from Claude settings
- 🛡️ **Error Handling** - Clear error messages for troubleshooting
- ✅ **Well Tested** - Comprehensive test coverage
- 🔄 **Dual Provider Support** - Supports both GLM and MiniMax

## 📦 Installation

### Quick Install (macOS/Linux)

```bash
bash install.sh
```

The installer will automatically:
- Copy runtime files to `~/.local/share/glm-safe-statusline`
- Create command entry at `~/.local/bin/glm-safe-statusline`
- Update `~/.claude/settings.json` (with automatic backup)

### Manual Install

```bash
# Install dependencies
npm install

# Link command globally
npm link
```

## ⚙️ Configuration

The status bar automatically detects and supports both GLM and MiniMax providers:

### GLM Configuration

Automatically detects your GLM token from:

1. **`~/.claude/settings.json`** (Priority)
   ```json
   {
     "env": {
       "ANTHROPIC_AUTH_TOKEN": "your-token-here"
     }
   }
   ```

2. **Environment Variable** (Fallback)
   ```bash
   export ANTHROPIC_API_KEY="your-token-here"
   ```

### MiniMax Configuration

MiniMax is also auto-detected, no additional configuration needed!

No additional configuration needed when using Claude Code with GLM or MiniMax!

## 📊 Output Examples

### GLM Runtime - Normal

```
GLM-4.5 | CTX 34% | 218.0 t/s
TOKEN 5H | █████░░░ | 62%
PLAN     | PRO | reset 1h53m
MCP      | 968/1000 | reset 28d23h
my-project | main
```

### GLM Runtime - Error

```
GLM-4.5 | CTX 81%
QUOTA    | no token configured
my-project | main
```

### MiniMax Runtime - Normal

```
MiniMax-M* | CTX 34% | 218.0 t/s
QUOTA      | █░░░░░░░░░ | 13% | 1h16m
my-project | main
```

### Non-GLM/MiniMax Runtime

```
claude-sonnet-4-6 | CTX 42% | 400.0 t/s
my-project | main
```

## 🔧 Troubleshooting

| Error Message | Cause | Solution | Applicable Provider |
|---------------|-------|----------|-------------------|
| `no token configured` | Token not found | Check `~/.claude/settings.json` or set `ANTHROPIC_API_KEY` | GLM/MiniMax |
| `network error` | Cannot reach API | Check your internet connection | GLM/MiniMax |
| `request timeout` | API request timed out (3s) | Try again, API may be slow | GLM/MiniMax |
| `unauthorized` | Invalid token (401) | Verify your token is correct | GLM/MiniMax |
| `forbidden` | Token lacks permission (403) | Check token permissions | GLM/MiniMax |
| `client error` | Other 4xx errors | Check API endpoint configuration | GLM/MiniMax |
| `server error` | API issues (5xx) | Wait and try again later | GLM/MiniMax |
| `invalid response` | Response parse failed | API may have changed, report issue | GLM/MiniMax |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🏗️ Architecture

```
src/
├── renderer/
│   ├── index.js      # Main entry point
│   ├── render.js     # Status line rendering
│   └── upstream.js   # Direct API client
├── shared/
│   ├── constants.js  # Error status constants
│   └── runtime.js    # Provider detection
tests/
└── *.test.js         # Comprehensive tests
```

## 📝 Technical Details

- **Runtime**: Node.js >= 18.0.0
- **API Endpoints**:
  - GLM: `https://open.bigmodel.cn/api/monitor/usage/quota/limit`
  - MiniMax: `https://api.minimaxi.chat/v1/usage/quota_info`
- **Request Timeout**: 3 seconds
- **Status Line Interface**: Claude Code `statusLine` command type

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built for Claude Code community using GLM/MiniMax API.

---

<div align="center">

**If this project is helpful to you, please give it a ⭐️ Star!**

Made with ❤️ by [Yu-Xiao-Sheng](https://github.com/Yu-Xiao-Sheng)

</div>
