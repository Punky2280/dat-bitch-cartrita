# Backend Readiness Matrix (Task 1)

Status legend: ✅ Ready · ⚠️ Degraded · ⏳ Initializing · ❌ Failing · N/A

- `/` — ✅ Returns 200 with version/environment/uptime
- `/health` — ✅ Returns 200/503 with service breakdown
- `/api/unified/health` — ✅ Public health snapshot
- `/api/unified/metrics` — ✅ Public metrics snapshot
- `/api/unified/* (POST)` — ✅ Responds; errors return structured JSON
- `/api/ai/health` — ✅ Legacy alias health
- `/api/ai/providers` — ✅ Providers list
- `/api/ai/inference (POST)` — ✅ Legacy inference mapping
- `/api/agents/role-call` — ✅ Always includes HF agents via injection
- `/api/metrics/custom` — ✅ Debug metrics
- `/api/debug-direct` — ✅ Debug route
- `/api/router (POST)` — ✅ Auth-enforced; unauthenticated → non-2xx
- `/api/hf/upload (POST)` — ✅ Auth-enforced; unauthenticated → non-2xx; not 404

- `/api/ai-hub/health` — ✅ Public health
- `/api/ai-hub/status` — ✅ Public status
- `/api/ai-hub/test` — ✅ Public smoke
- `/api/models/status` — ✅ Mounted; requires auth; unauth → non-2xx
- `/api/models/catalog` — ✅ Mounted; requires auth; not 404
- `/api/knowledge/search` — ✅ Mounted; requires auth; not 404
- `/api/knowledge/collections` — ✅ Mounted; requires auth; not 404
- `/api/voice-to-text/` — ✅ Public info
- `/api/huggingface/health` — ✅ Public health

- `/api/security/health` — ✅ Public health
- `/api/security/status` — ✅ Public status
- `/api/monitoring/agent-metrics` — ✅ Mounted; requires auth; unauth → non-2xx
- `/api/monitoring/dependencies` — ✅ Mounted; requires auth; unauth → non-2xx
- `/api/vision/status` — ✅ Mounted; requires auth; unauth → non-2xx
- `/api/vault/keys` — ✅ Mounted; requires auth; unauth → non-2xx
- `/api/key-vault/keys` — ✅ Mounted; admin auth; unauth → non-2xx
- `/api/api-keys/status` — ✅ Public status
- `/api/api-keys/dev-keys` — ✅ Public (dev semantics); available
- `/api/api-keys/test` — ✅ Mounted; key-auth; unauth → non-2xx

Notes

- Public unified routes are for local dev; gate behind auth/rate limits in production.
- Role-call has explicit override to prevent empty agent lists during lazy init.
- Many feature routes require auth; tests only assert non-404 without credentials.

Verification

- Covered by `packages/backend/tests/unit/endpoint-availability.test.js` and root smoke scripts in `scripts/smoke/`.
