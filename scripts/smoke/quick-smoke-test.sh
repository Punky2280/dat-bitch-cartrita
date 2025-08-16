#!/bin/bash

# Cartrita Quick Smoke Test (canonical)
# Usage: bash scripts/smoke/quick-smoke-test.sh [BACKEND_URL]

set -euo pipefail

BACKEND_URL=${1:-"http://localhost:8001"}

TOKEN=$(curl -s "$BACKEND_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"testpass123"}' | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
  echo "Failed to get token" >&2
  exit 1
fi

for path in "/" "/health" "/api/agents/role-call" "/api/agent/metrics" "/api/unified/health"; do
  if [[ "$path" == /api/* ]]; then
    code=$(curl -s -w '%{http_code}' -o /dev/null -H "Authorization: Bearer $TOKEN" "$BACKEND_URL$path")
  else
    code=$(curl -s -w '%{http_code}' -o /dev/null "$BACKEND_URL$path")
  fi
  echo "$path -> $code"
done
