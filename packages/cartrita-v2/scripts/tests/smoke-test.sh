#!/bin/bash
# Wrapper: forwards to canonical script under scripts/smoke
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
exec "$SCRIPT_DIR/smoke/smoke-test.sh" "$@"