#!/usr/bin/env bash
#
# import-scan-extended.sh
#
# Scans source files for usage of specific top-level symbols that are
# referenced but not imported / locally declared.
#
# Features:
#   - Excludes build artifacts (dist, node_modules, hashed bundles)
#   - Strict word-boundary symbol matching
#   - Simple comment stripping
#   - Local declaration & import/require detection
#   - Basic usage pattern confirmation
#   - JSON output mode (--json)
#   - Clipboard copy (--copy or --windows-copy)
#
# Exit codes:
#   0 = success (no missing imports OR output copied)
#   1 = missing imports found (in plain mode)
#   2 = script error
#
# Usage:
#   ./import-scan-extended.sh
#   ./import-scan-extended.sh --json
#   ./import-scan-extended.sh --json --copy
#   SCAN_ALL=1 ./import-scan-extended.sh   # ignore ALLOWED_ROOTS restriction
#
# Customize below as needed.

set -euo pipefail

########################################
# Configuration
########################################

# Symbols to check. Adjust to your actual target set.
SYMBOLS=(
  "Timestamp"
  "MyHelper"
  "AnotherThing"
)

# Source roots to consider; anything outside is skipped unless SCAN_ALL=1
ALLOWED_ROOTS=(
  "packages/backend/src"
  "packages/frontend/src"
  "scripts"
)

# Exclude directory regex fragments (joined later)
EXCLUDE_DIR_PATTERNS=(
  "/dist/"
  "/build/"
  "/node_modules/"
  "/coverage/"
  "/out/"
  "/generated/"
  "/upstream-source/"   # vendor-copied code you don’t own
)

# File extensions to scan
EXTENSIONS_REGEX='\.(js|jsx|ts|tsx|mjs|cjs)$'

# Max file size (bytes) threshold to skip vendor-like huge files
VENDOR_MAX_SIZE=$((2 * 1024 * 1024))  # 2 MB

# Average line length threshold to classify as minified vendor content
VENDOR_AVG_LINE_LEN=500

# Hashed bundle filename regex (skip)
HASHED_FILENAME_REGEX='^index-[A-Za-z0-9]{6,}\.js$'

########################################
# Runtime options
########################################

JSON_MODE=0
COPY_MODE=0
WINDOWS_COPY_MODE=0

for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=1 ;;
    --copy) COPY_MODE=1 ;;
    --windows-copy) WINDOWS_COPY_MODE=1 ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--json] [--copy] [--windows-copy]

Options:
  --json           Output JSON array of findings.
  --copy           Copy output to clipboard (pbcopy/xclip/wl-copy).
  --windows-copy   Copy output to Windows clipboard (clip.exe in WSL).
Environment:
  SCAN_ALL=1       Scan all files ignoring ALLOWED_ROOTS restriction.

Exit codes:
  0 success
  1 missing imports found (plain mode)
  2 script error
EOF
      exit 0
      ;;
  esac
done

########################################
# Helper: join arrays
########################################
join_by() { local IFS="$1"; shift; echo "$*"; }

########################################
# Helper: test if file in allowed roots
########################################
in_allowed_root() {
  local f="$1"
  [[ "${SCAN_ALL:-0}" == "1" ]] && return 0
  local root
  for root in "${ALLOWED_ROOTS[@]}"; do
    if [[ "$f" == "$root"* ]]; then
      return 0
    fi
  done
  return 1
}

########################################
# Helper: vendor / bundle heuristics
########################################
is_vendor_like() {
  local file="$1"
  local size
  size=$(stat -c '%s' "$file" 2>/dev/null || stat -f '%z' "$file" 2>/dev/null || echo 0)
  if (( size > VENDOR_MAX_SIZE )); then
    return 0
  fi
  # Average line length heuristic
  local total=0 lines=0
  # Use awk for portability
  while IFS= read -r line; do
    (( total += ${#line} ))
    (( lines++ ))
  done < "$file"
  if (( lines > 0 )); then
    local avg=$(( total / lines ))
    (( avg > VENDOR_AVG_LINE_LEN )) && return 0
  fi
  return 1
}

########################################
# Helper: quick exclude checks
########################################
should_exclude_file() {
  local file="$1"
  # Directory pattern exclusion
  local pat
  for pat in "${EXCLUDE_DIR_PATTERNS[@]}"; do
    [[ "$file" == *"$pat"* ]] && return 0
  done

  # Extension check
  if [[ ! "$file" =~ $EXTENSIONS_REGEX ]]; then
    return 0
  fi

  # Hashed build filenames
  local base
  base=$(basename "$file")
  if [[ "$base" =~ $HASHED_FILENAME_REGEX ]]; then
    return 0
  fi

  # Vendor-like (big or minified)
  if is_vendor_like "$file"; then
    # Only treat as vendor if it's in a typical build area
    if [[ "$file" == *"/dist/"* || "$file" == *"/build/"* || "$file" == *"/assets/"* ]]; then
      return 0
    fi
  fi

  return 1  # keep
}

########################################
# Helper: strip simple comments (heuristic)
# - Removes // trailing
# - Removes /* ... */ (non-nested) across whole content
########################################
strip_comments() {
  local content
  content=$(sed -E 's://.*$::' "$1" \
    | sed -E ':a; s:/\*[^*/]*\*/::g; ta')
  printf "%s" "$content"
}

########################################
# Helper: test for local declarations
########################################
has_local_declaration() {
  local content="$1" symbol="$2"
  grep -Eq "\b(class|function|type|interface)\s+$symbol\b" <<< "$content" && return 0
  grep -Eq "\b(const|let|var)\s+$symbol\b" <<< "$content" && return 0
  return 1
}

########################################
# Helper: test for import/require existence
########################################
has_import() {
  local content="$1" symbol="$2"
  # ES imports (default, destructured, renamed)
  grep -Eq "import[^;]*\b$symbol\b" <<< "$content" && return 0
  # require forms
  grep -Eq "require\([^)]*\b$symbol\b" <<< "$content" && return 0
  return 1
}

########################################
# Helper: usage pattern check
# Ensures it's not only inside unrelated strings or longer names
########################################
has_usage_pattern() {
  local content="$1" symbol="$2"
  # Patterns:
  #   new Symbol
  #   Symbol(
  #   : Symbol  (TS type or flow)
  #   <Symbol> (JSX)
  #   Symbol,  or Symbol; or Symbol= (rudimentary)
  grep -Eq "(new[[:space:]]+$symbol\b|$symbol[[:space:]]*\(|: $symbol\b|<$symbol>|$symbol[[:space:]]*[,;=])" <<< "$content"
}

########################################
# Global arrays for results
########################################
declare -a PLAIN_RESULTS=()
declare -a JSON_OBJECTS=()

########################################
# Main scan logic for a single file
########################################
scan_file() {
  local file="$1"
  # Exclusion filters
  should_exclude_file "$file" && return
  in_allowed_root "$file" || return

  # Quick skip: if none of the symbols appear at all (raw grep)
  local sym
  local raw_found_any=0
  for sym in "${SYMBOLS[@]}"; do
    grep -q "$sym" "$file" && { raw_found_any=1; break; }
  done
  (( raw_found_any == 0 )) && return

  # Load filtered content
  local filtered
  filtered="$(strip_comments "$file")"

  for sym in "${SYMBOLS[@]}"; do
    # Quick presence test with word boundary
    grep -Eq "\<$sym\>" <<< "$filtered" || continue

    # Local declaration?
    if has_local_declaration "$filtered" "$sym"; then
      continue
    fi

    # Imported?
    if has_import "$filtered" "$sym"; then
      continue
    fi

    # Confirm real usage
    if ! has_usage_pattern "$filtered" "$sym"; then
      # No convincing usage pattern; skip (likely a substring in a doc/comment)
      continue
    fi

    # Record first line number of symbol usage
    local first_line
    first_line=$(grep -n "\<$sym\>" "$file" | head -1 | cut -d: -f1 || echo 0)

    local message="MISSING_IMPORT($sym) $file:${first_line}"
    PLAIN_RESULTS+=("$message")

    if (( JSON_MODE == 1 )); then
      # Minimal JSON object
      JSON_OBJECTS+=("{\"symbol\":\"$sym\",\"file\":\"$file\",\"line\":$first_line}")
    fi
  done
}

########################################
# File enumeration
########################################
# Use find with null separator to be safe with spaces
while IFS= read -r -d '' candidate; do
  scan_file "$candidate"

done < <(find . -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' -o -name '*.cjs' \) -print0)

########################################
# Output
########################################

if (( JSON_MODE == 1 )); then
  if ((${#JSON_OBJECTS[@]})); then
    printf '[\n  %s\n]\n' "$(join_by ',\n  ' "${JSON_OBJECTS[@]}")"
  else
    echo "[]"
  fi
else
  if ((${#PLAIN_RESULTS[@]})); then
    printf '%s\n' "${PLAIN_RESULTS[@]}"
  else
    echo "No missing imports found."
  fi
fi

########################################
# Clipboard copy (optional)
########################################
copy_output() {
  local data="$1"
  # Prefer pbcopy/wl-copy/xclip; fallback to Windows clip.exe if requested
  if command -v pbcopy >/dev/null 2>&1; then
    printf "%s" "$data" | pbcopy
    echo "Copied to clipboard (pbcopy)."
  elif command -v wl-copy >/dev/null 2>&1; then
    printf "%s" "$data" | wl-copy
    echo "Copied to clipboard (wl-copy)."
  elif command -v xclip >/dev/null 2>&1; then
    printf "%s" "$data" | xclip -selection clipboard
    echo "Copied to clipboard (xclip)."
  else
    echo "Clipboard tool not found."
    return 1
  fi
  return 0
}

if (( COPY_MODE == 1 || WINDOWS_COPY_MODE == 1 )); then
  output_buffer=""
  if (( JSON_MODE == 1 )); then
    if ((${#JSON_OBJECTS[@]})); then
      output_buffer=$(printf '[\n  %s\n]\n' "$(join_by ',\n  ' "${JSON_OBJECTS[@]}")")
    else
      output_buffer="[]"
    fi
  else
    if ((${#PLAIN_RESULTS[@]})); then
      output_buffer=$(printf '%s\n' "${PLAIN_RESULTS[@]}")
    else
      output_buffer="No missing imports found."
    fi
  fi

  if (( WINDOWS_COPY_MODE == 1 )); then
    if command -v clip.exe >/dev/null 2>&1; then
      printf "%s" "$output_buffer" | clip.exe
      echo "Copied to Windows clipboard (clip.exe)."
    else
      echo "clip.exe not found (are you in WSL?)."
      exit 2
    fi
  else
    copy_output "$output_buffer" || exit 2
  fi
fi

########################################
# Exit code logic
########################################
if ((${#PLAIN_RESULTS[@]})); then
  # If JSON or copy mode, still return 0 (optional). Adjust if you prefer non-zero.
  if (( JSON_MODE == 1 )); then
    exit 0
  fi
  exit 1
fi

exit 0
