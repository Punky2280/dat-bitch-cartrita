#!/usr/bin/env bash
# Deprecated file name (leading space). Delegates to canonical path.
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CANONICAL="$SCRIPT_DIR/import-scan-extended.sh"
if [ -f "$CANONICAL" ]; then
  exec "$CANONICAL" "$@"
else
  echo "Canonical script not found: $CANONICAL" >&2
  exit 1
fi
