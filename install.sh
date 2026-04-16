#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
SKIP_TOKEN=0
TOKEN=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-token)
      SKIP_TOKEN=1
      shift
      ;;
    --token)
      TOKEN="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found in PATH." >&2
  exit 1
fi

if [ "$SKIP_TOKEN" -ne 1 ] && [ -z "$TOKEN" ] && [ -t 0 ]; then
  printf 'Enter GLM token now. Leave empty to skip: '
  stty -echo
  IFS= read -r TOKEN
  stty echo
  printf '\n'
fi

if [ "$SKIP_TOKEN" -eq 1 ]; then
  exec node "$SCRIPT_DIR/scripts/install.js" --source-dir "$SCRIPT_DIR" --skip-token
fi

if [ -n "$TOKEN" ]; then
  exec node "$SCRIPT_DIR/scripts/install.js" --source-dir "$SCRIPT_DIR" --token "$TOKEN"
fi

exec node "$SCRIPT_DIR/scripts/install.js" --source-dir "$SCRIPT_DIR" --skip-token
