#!/usr/bin/env bash
set -e

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)

echo "== Quick Smoke =="
"$ROOT_DIR/docs/tests/quick-smoke-test.sh"

echo "== Full Smoke =="
"$ROOT_DIR/docs/tests/smoke-test.sh"

echo "All smoke tests completed."
