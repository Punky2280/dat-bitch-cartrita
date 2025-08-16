#!/bin/bash
# Deprecated: moved to scripts/smoke/smoke-test.sh
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
exec "$SCRIPT_DIR/scripts/smoke/smoke-test.sh" "$@"
