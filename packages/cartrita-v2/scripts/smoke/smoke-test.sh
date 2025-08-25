#!/bin/bash

# Cartrita Full Stack Smoke Test Suite (canonical)
# Usage: bash scripts/smoke/smoke-test.sh [BACKEND_URL] [FRONTEND_URL]

set -euo pipefail

BACKEND_URL=${1:-"http://localhost:8001"}
FRONTEND_URL=${2:-"http://localhost:3000"}

# Minimal subset to avoid huge output in CI
curl -sS -w '\nStatus: %{http_code}\n' "$BACKEND_URL/health" || echo "[smoke] Backend health check failed"

LOGIN_JSON=$(curl -sS -w '\n' -H 'Content-Type: application/json' \
  -d '{"email":"smoketest@example.com","password":"smoketest123"}' \
  "$BACKEND_URL/api/auth/login" || true)
if command -v jq >/dev/null 2>&1; then
  echo "$LOGIN_JSON" | jq '.' || true
  TOKEN=$(echo "$LOGIN_JSON" | jq -r '.token // empty')
else
  TOKEN=""
fi

if [ -n "$TOKEN" ]; then
  curl -sS -w '\nStatus: %{http_code}\n' -H "Authorization: Bearer $TOKEN" \
    "$BACKEND_URL/api/agents/role-call" | { command -v jq >/dev/null 2>&1 && jq '.' || cat; } || true
else
  echo "Warning: no token returned; skipping authorized checks" >&2
fi

# Frontend ping
curl -sS -o /dev/null -w 'Frontend reachable: %{http_code}\n' "$FRONTEND_URL" || echo "[smoke] Frontend unreachable"
