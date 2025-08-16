# Cartrita Test Scripts

This folder previously housed the test and smoke scripts. They have been relocated to `scripts/`.

Prerequisites

- bash, curl, jq
- Backend running at BACKEND_URL (default <http://localhost:8001>)
- Frontend running at FRONTEND_URL (default <http://localhost:3000>)

Environment variables

- BACKEND_URL: Base URL for backend (optional)
- FRONTEND_URL: Base URL for frontend (optional)

Scripts (new locations)

- scripts/smoke/quick-smoke-test.sh: Fast checks for backend/AI health and frontend reachability.
- scripts/smoke/smoke-test.sh: Full-stack suite (auth, agents, vault, knowledge hub, unified AI, etc.).
- scripts/unified/test-unified-inference.sh: Exercises /api/unified/inference with small prompts and model routing.
- scripts/unified/test-unified-models.sh: Lists/validates available models via unified endpoints.

Usage

- bash scripts/smoke/quick-smoke-test.sh
- bash scripts/smoke/smoke-test.sh
- bash scripts/unified/test-unified-inference.sh
- bash scripts/unified/test-unified-models.sh

Notes

- Scripts tolerate missing optional endpoints but will flag failures in summary.
- If ports differ, export BACKEND_URL/FRONTEND_URL before running.
