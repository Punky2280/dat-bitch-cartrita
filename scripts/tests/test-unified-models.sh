#!/bin/bash
# Wrapper: forwards to canonical script under scripts/unified
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
exec "$SCRIPT_DIR/unified/test-unified-models.sh" "$@"