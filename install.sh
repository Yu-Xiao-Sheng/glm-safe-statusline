#!/bin/bash
set -e

INSTALL_DIR="$HOME/.local/share/glm-safe-statusline"
BIN_DIR="$HOME/.local/bin"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "Installing Domestic AI StatusLine (GLM/MiniMax)..."

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Copy src directory (all dependencies)
cp -r src "$INSTALL_DIR/"

# Copy renderer
cp bin/glm-safe-statusline.js "$INSTALL_DIR/"

# Create wrapper
cat > "$BIN_DIR/glm-safe-statusline" <<EOF
#!/bin/sh
exec node "$INSTALL_DIR/glm-safe-statusline.js" "\$@"
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

# Fix require paths in installed script
node ~/.local/bin/fix-paths.js

echo "Installation complete!"
echo "Status line command: $BIN_DIR/glm-safe-statusline"
echo ""
echo "Note: The status line reads ANTHROPIC_AUTH_TOKEN from ~/.claude/settings.json"
echo "      This should be automatically available when using GLM or MiniMax in Claude Code"
