#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
export PATH="$HOME/.local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js/npm is missing in this WSL distribution. Use Ubuntu with the project development tools.' >&2
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
printf '\nProject: %s\nOpen http://localhost:5173 on the Dell. Keep this terminal open.\n\n' "$project_dir"
exec npm run dev -- --port 5173 --strictPort
