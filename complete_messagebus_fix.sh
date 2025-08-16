#!/usr/bin/env bash
# Deprecated wrapper. Use scripts/maintenance/complete_messagebus_fix.sh
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TARGET="$SCRIPT_DIR/scripts/maintenance/complete_messagebus_fix.sh"
if [ -f "$TARGET" ]; then
    exec "$TARGET" "$@"
else
    echo "Canonical script not found: $TARGET" >&2
    exit 1
fi
