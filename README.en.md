<div align="center">

# GLM Direct StatusLine

**A lightweight Claude Code status line for GLM quota monitoring**

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

## 📦 Installation

### Quick Install (macOS/Linux)

```bash
bash install.sh
```

The installer will:
- Copy runtime files to `~/.local/share/glm-safe-statusline`
- Create command entry at `~/.local/bin/glm-safe-statusline`
- Update `~/.claude/settings.json` (with backup)

### Manual Install

```bash
# Install dependencies
npm install

# Link command globally
npm link
```

## ⚙️ Configuration

The status line automatically detects your GLM token from:

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

No additional configuration needed when using Claude Code with GLM!

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

### Non-GLM Runtime

```
claude-sonnet-4-6 | CTX 42% | 400.0 t/s
my-project | main
```

## 🔧 Troubleshooting

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `no token configured` | Token not found | Check `~/.claude/settings.json` or set `ANTHROPIC_API_KEY` |
| `network error` | Cannot reach GLM API | Check your internet connection |
| `request timeout` | API request timed out (3s) | Try again, API may be slow |
| `unauthorized` | Invalid token (401) | Verify your token is correct |
| `forbidden` | Token lacks permission (403) | Check token permissions |
| `client error` | Other 4xx errors | Check API endpoint configuration |
| `server error` | GLM API issues (5xx) | Wait and try again later |
| `invalid response` | Response parse failed | API may have changed, report issue |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
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

- **Runtime**: Node.js ≥ 18.0.0
- **API Endpoint**: `https://open.bigmodel.cn/api/monitor/usage/quota/limit`
- **Request Timeout**: 3 seconds
- **Status Line Interface**: Claude Code `statusLine` command type

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built for the Claude Code community using GLM API.

---

<div align="center">

**If you find this project helpful, please give it a ⭐️ Star!**

</div>
