#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
echo "== React/Vite app build =="
npm run build

echo "== React/Vite unit tests (Vitest) =="
npm test

echo "== Rails API Brakeman security scan =="
cd "$ROOT_DIR/api"
bundle exec brakeman --no-pager -q

echo "== Rails API bundler-audit =="
bin/bundler-audit

echo "== Rails API rubocop =="
bin/rubocop --no-color

echo "== Rails API tests =="
bin/rails test

echo "Gate passed."
