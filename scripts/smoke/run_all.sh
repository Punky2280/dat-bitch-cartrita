#!/usr/bin/env bash
set -e

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

# Prefer CI-provided API_BASE_URL, else default to backend on 3000
BACKEND_URL=${API_BASE_URL:-"http://localhost:3000"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3000"}

echo "== Quick Smoke =="
bash "$ROOT_DIR/scripts/smoke/quick-smoke-test.sh" "$BACKEND_URL"

echo "== Full Smoke =="
bash "$ROOT_DIR/scripts/smoke/smoke-test.sh" "$BACKEND_URL" "$FRONTEND_URL"

echo "All smoke tests completed."
