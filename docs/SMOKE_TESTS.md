# Smoke Tests

This doc aggregates curl-based smoke checks for backend and frontend.

Prereqs

- curl, jq
- Backend up at BACKEND_URL (default <http://localhost:8001>)
- Frontend at FRONTEND_URL (default <http://localhost:3000>)

Quick Start

- Run the canonical scripts under scripts/:
  - scripts/smoke/quick-smoke-test.sh
  - scripts/smoke/smoke-test.sh

CI Runner

- scripts/smoke/run_all.sh (invokes canonical scripts)

Targets

- Health: GET /health
- Unified AI: GET /api/unified/health, /api/unified/metrics
- Auth: POST /api/auth/login (if applicable)
- Models: GET /api/ai/providers or /api/unified/models (if present)
- Settings: GET /api/user/preferences
- Automations: GET /api/workflows

Expected Outcomes

- Health -> 200
- Unified endpoints -> 200 (or clear unavailable message if keys missing)
- Settings/preferences -> JSON with user settings object
- Workflows -> JSON array (possibly empty)
