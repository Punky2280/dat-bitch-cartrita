#!/bin/bash
# Deprecated: moved to scripts/smoke/quick-smoke-test.sh
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
exec "$SCRIPT_DIR/scripts/smoke/quick-smoke-test.sh" "$@"
