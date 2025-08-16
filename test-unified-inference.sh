#!/usr/bin/env bash
# Deprecated wrapper. Use scripts/unified/test-unified-inference.sh directly.
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TARGET="$SCRIPT_DIR/scripts/unified/test-unified-inference.sh"
if [ -f "$TARGET" ]; then
  exec "$TARGET" "$@"
else
  echo "Canonical script not found: $TARGET" >&2
  exit 1
fi