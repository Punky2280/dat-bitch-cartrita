#!/usr/bin/env bash
set -euo pipefail

echo "Scanning for duplicate markdown files..." >&2

declare -A map
while IFS= read -r -d '' file; do
  hash=$(sha1sum "$file" | cut -d' ' -f1)
  base=$(basename "$file" | tr '[:upper:]' '[:lower:]')
  key="${base}_${hash}"
  if [[ -n "${map[$key]:-}" ]]; then
    echo "Duplicate content candidate: $file (same as ${map[$key]})"
  else
    map[$key]="$file"
  fi
done < <(find . -type f -name "*.md" -print0)

echo "Review output above; remove outdated duplicates manually or extend script for auto-clean."
