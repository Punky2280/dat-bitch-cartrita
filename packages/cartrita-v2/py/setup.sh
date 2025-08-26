#!/usr/bin/env bash
set -euo pipefail

# Cartrita Python Backend Setup Script
# - Installs required Python packages
# - Fixes common pitfalls (qiskit shadow file)
# - Prints diagnostics

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "[setup] Using Python: $(python3 -V)"

# Remove stray 'qiskit' file that shadows real package
if [ -f "$ROOT_DIR/qiskit" ]; then
  echo "[setup] Removing stray file: $ROOT_DIR/qiskit (shadows pip qiskit)"
  rm -f "$ROOT_DIR/qiskit"
fi

# Install dependencies
if [ -f requirements.txt ]; then
  echo "[setup] Installing Python dependencies"
  pip3 install -r requirements.txt
else
  echo "[setup] requirements.txt not found" >&2
fi

# Diagnostics
python3 - <<'PY'
import shutil, os
print("[diag] ffmpeg:", shutil.which("ffmpeg"))
try:
    import qiskit
    print("[diag] qiskit:", getattr(qiskit, "__version__", "unknown"))
except Exception as e:
    print("[diag] qiskit import error:", e)
print("[diag] OPENAI_API_KEY present:", bool(os.getenv("OPENAI_API_KEY")))
PY

echo "[setup] Done."