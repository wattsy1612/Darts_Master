#!/usr/bin/env bash
set -eu
for tool in git node npm python3 gcc make gh; do
  command -v "$tool" >/dev/null || { echo "Missing: $tool"; exit 1; }
done
git --version
node --version
npm --version
python3 --version
gcc -dumpversion
make --version | head -n 1
gh --version | head -n 1
node --input-type=module -e 'import assert from "node:assert/strict"; assert.equal(await Promise.resolve(2 + 2), 4); console.log("Node runtime: OK")'
python3 -m venv /tmp/darts-dev-check-venv
/tmp/darts-dev-check-venv/bin/python -m pip --version
printf 'Development tools: OK\n'
