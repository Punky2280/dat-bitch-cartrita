#!/bin/bash
# Deprecated: moved to scripts/unified/test-unified-inference.sh
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
exec "$SCRIPT_DIR/scripts/unified/test-unified-inference.sh" "$@"
