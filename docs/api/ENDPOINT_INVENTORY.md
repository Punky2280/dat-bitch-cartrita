# Backend Endpoint Inventory (Initial Pass)

This document enumerates core backend endpoints to support Task 1: Restore Core Backend Availability & Eliminate 404s. It will evolve as we harden routes and add coverage.

- Base: `http://localhost:8001`
- Entry: `/` → 200 JSON { message, version, environment, uptime }
- Health:
  - `/health` → 200/503 JSON { success, status, services }
  - `/api/health/*` (module health routes) → mounted via `src/routes/health.js`
- Unified AI:
  - `GET /api/unified/health`
  - `GET /api/unified/metrics`
  - `POST /api/unified/inference`
  - `POST /api/unified/chat`
  - `POST /api/unified/speech-to-text`
  - `POST /api/unified/embeddings`
  - `POST /api/unified/generate-image`
  - `POST /api/unified/classify-image`
  - `POST /api/unified/summarize`
  - `POST /api/unified/classify`
- Legacy Aliases:
  - `GET /api/ai/health`
  - `GET /api/ai/providers`
  - `POST /api/ai/inference`
- Agents:
  - `GET /api/agents/role-call` (HF names injection ensured)
- Metrics:
  - `GET /metrics` (process metrics)
  - `GET /api/metrics/custom` (debug metrics snapshot)
- Debug:
  - `GET /api/debug-direct`
- HF Binary Store:
  - `POST /api/hf/upload` (auth required)
  - `GET /api/hf/list` (auth required)
  - `DELETE /api/hf/revoke/:id` (auth required)
- Router (requires auth):
  - `POST /api/router` (task dispatch)

Feature Domains

- AI Hub (`src/routes/ai-hub.js`):
  - `GET /api/ai-hub/health` → basic health
  - `GET /api/ai-hub/status` → feature flags
  - `GET /api/ai-hub/test` → smoke probe

- Models (`src/routes/modelRouting.js`):
  - `GET /api/models/status` → auth; JSON status
  - `GET /api/models/catalog` → auth; list of router models
  - `POST /api/models/route` → auth; body `{ prompt, options? }`
  - `POST /api/models/classify` → auth; body `{ prompt }`

- Knowledge Hub (`src/routes/knowledge.js`):
  - `GET /api/knowledge/search` → auth; query `q`, `limit?`, `threshold?`
  - `POST /api/knowledge/upload` → auth; multipart `file`, fields `title`, `category?`, `tags?`
  - `GET /api/knowledge/collections` → auth; categories summary
  - `GET /api/knowledge/documents` → auth; query filters
  - `GET /api/knowledge/documents/:id` → auth; document details
  - `DELETE /api/knowledge/documents/:id` → auth; delete
  - `GET /api/knowledge/entries` · `GET /api/knowledge/clusters` · `GET /api/knowledge/graph` · `GET /api/knowledge/analytics` · `GET /api/knowledge/processing-status` · `GET /api/knowledge/relationships` · `GET /api/knowledge/extractions` · `GET /api/knowledge/stats` (all auth)

- Voice To Text (`src/routes/voiceToText.js`):
  - `GET /api/voice-to-text/` → public service info
  - `POST /api/voice-to-text/transcribe` → auth; multipart `audio` or JSON `{ url }`; optional analysis flags
  - `GET /api/voice-to-text/status` → auth; service status

- HuggingFace Bridge (`src/integrations/huggingface/routes/huggingfaceRoutes.js`):
  - `GET /api/huggingface/health` → health
  - `GET /api/huggingface/capabilities` | `/tasks` | `/stats` → some require orchestrator/auth

- Security Integrations (`src/routes/securityIntegrations.js`):
  - `GET /api/security/health` → public health
  - `GET /api/security/status` → public status
  - `GET /api/security/metrics` → auth; metrics snapshot
  - `POST /api/security/scan` → auth; body `{ scan_type, target_components[] }`
  - `GET /api/security/events` → auth; query `limit?`
  - `POST /api/security/log-event` → auth; body `{ eventType, details }`

- Monitoring (`src/routes/monitoring.js`):
  - `GET /api/monitoring/agent-metrics` → auth
  - `GET /api/monitoring/dependencies` → auth
  - `GET /api/monitoring/advanced-mcp-status` → auth
  - `GET /api/monitoring/observability-metrics` → auth
  - `GET /api/monitoring/trace-analytics` → auth

- Vision (`src/routes/vision.js`):
  - `GET /api/vision/status` → auth
  - `GET /api/vision/` → auth; base info or listing

- Vaults (`src/routes/vault.js`, unified `src/routes/keyVault.js`):
  - `GET /api/vault/keys` → auth
  - `GET /api/key-vault/keys` → auth (admin)
  - Additional: validate, rotate, analytics (all auth)

- API Keys (`src/routes/apiKeyManagement.js`):
  - `GET /api/api-keys/status` → public status
  - `GET /api/api-keys/dev-keys` → public dev listing (dev only semantics)
  - `GET /api/api-keys/test` → key-auth required

Specs Cross-Links

- Workflows: `docs/specs/workflows/WORKFLOW_BUILDER_DESIGN.md`, `EXECUTION_MONITORING_UI_PLAN.md`, `WORKFLOW_TEMPLATES_SYSTEM_PLAN.md`
- Multimodal/Fusion: `docs/specs/multimodal/CROSS_MODAL_FUSION_DISPLAYS_PLAN.md`
- Ambient Intelligence: `docs/specs/intelligence/AMBIENT_INTELLIGENCE_CONTROLS_PLAN.md`
- Life OS (journal): `docs/specs/lifeos/TASK_JOURNAL_MANAGEMENT_PLAN.md`

See `packages/backend/index.js` for the full route mount list.

## Notes

- Public unified routes are intentionally unauthenticated in dev to reduce friction; protect in production.
- `/api/agents/role-call` has an override and shim to ensure HF agents appear even if underlying graph isn't initialized.
- Many domains are auth-only; availability tests assert "not 404" when unauthenticated and expect non-2xx for protected routes.

Production Gating

- Gate `/api/unified/*` behind auth and rate limits in production (see `index.js`); allow public in dev for speed.

## Next Steps

- Expand this inventory with each feature domain under `docs/specs/**` cross-referenced.
- Link to readiness matrix and tests.
- Add method + payload examples per route as we standardize responses.
