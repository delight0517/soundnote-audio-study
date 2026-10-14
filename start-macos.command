#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it from python.org or Homebrew."
  read -r -p "Press Return to close..."
  exit 1
fi
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'; then
  echo "Python 3.10 or later is required."
  read -r -p "Press Return to close..."
  exit 1
fi
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  echo "Node.js 22 or later is required for ChatGPT sign-in."
  read -r -p "Press Return to close..."
  exit 1
fi

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install -r requirements.txt
if [ ! -d node_modules/@siwc/local ]; then
  npm ci
fi
npm run build:siwc

.venv/bin/python app.py &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
sleep 2
open http://127.0.0.1:8765
wait "$server_pid"
