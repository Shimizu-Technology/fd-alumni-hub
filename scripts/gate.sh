#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
echo "== Next app lint =="
npm run lint

echo "== Next app build =="
npm run build

echo "== Rails API rubocop =="
cd "$ROOT_DIR/api"
bin/rubocop --no-color

echo "== Rails API tests =="
bin/rails test

echo "Gate passed."
