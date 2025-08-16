# Copilot Project Instructions (Cartrita Multi-Agent OS)

Purpose: Keep AI coding agents instantly productive and consistent with established architecture and recent iteration progress. DO NOT invent new subsystems when extending; prefer additive migrations & specs already defined. Cartrita voice only in user-facing assistant responses; infrastructure code stays neutral.

## 0. Iteration Awareness & Memory Discipline
When a new iteration (e.g. "iteration 22") begins:
1. Auto-scan `docs/specs/**` and recent migrations in `db-init/` added after the last comprehensive snapshot (currently `06_comprehensive_cartrita_schema.sql`) plus highest numbered migration (presently `15_create_journal_entries.sql`).
2. Summarize deltas: new tables, new routes, new specs, UI scaffolds. Persist that summary in your internal working memory for the session (do NOT write to repo unless asked).
3. Before modifying any domain (workflows, journal, ambient intelligence, fusion, templates), locate its spec under `docs/specs/**` & re-validate assumptions. If spec mismatch detected, halt and request clarification rather than hallucinating fields.
4. Cross-check any DB column before use: search codebase and migrations; if absent create a new migration instead of editing old files.
5. Never fabricate API responses; if unsure, implement thin pass-through + TODO referencing spec filename.

Notebook discipline (required):
- Re-read `docs/PROJECT_NOTEBOOK.md` at task start and after each batch of 3–5 edits/tool calls.
- After meaningful changes (feature fixes/additions, migrations, CI/QoL scripts), append a concise Dev Log entry in `docs/PROJECT_NOTEBOOK.md` with date, scope, and verification notes (Build/Lint/Tests status).

Guardrails to reduce hallucination / drift:
- Always prefer reading existing files (routes/service/migration) before adding new ones for a feature.
- Keep changes minimal & scoped; describe rationale succinctly in PR.
- If a spec exists but conflicts with runtime code, align implementation to spec via new migration or incremental refactor doc.

## 1. High-Level Architecture

### Core System
- **Monorepo**: npm workspaces under `packages/` (no turborepo). Core focus: `packages/backend` (Node + Express + LangChain StateGraph supervisor) & `packages/frontend` (React + Vite). Python MCP reference under `py/mcp_core` (types only currently).
- **ES6 Modules**: Backend uses `"type": "module"` - use `import/export`, not `require/module.exports`
- **Development Commands**: 
  - Backend: `cd packages/backend && npm run dev` (auto-builds router, starts on port 8001)
  - Frontend: `cd packages/frontend && npm run dev` (Vite dev server on port 3000)
  - Database: Apply migrations from `db-init/` in numerical order

### Hierarchical Multi-Agent System
- **Supervisor**: `EnhancedLangChainCoreAgent.js` (class name `CartritaSupervisorAgent`) dynamically imports ~20+ sub‑agents in `src/agi/**`. 
- **Delegation guardrails**: `recursionLimit=15`, max 2 chained delegations, supervisor self-call cap=3. Always routes back to `cartrita` node until final `END`.
- **Agent Loading**: Add filename to `agentFileNames` array in supervisor or it won't load.
- **Tool Layer**: `AgentToolRegistry` centralizes tool definitions + per‑agent `allowedTools`. HuggingFace bridge agents (vision/audio/language/multimodal/data) under `integrations/huggingface/bridge/*`.

### Infrastructure & Services
- **Observability**: `OpenTelemetryTracing` sets up Node SDK + counters. Use helpers: `traceAgentOperation`, `traceToolExecution`, `traceOperation`. 
- **Knowledge & Workflow**: `WorkflowToolsService` + `routes/workflowTools.js` provide semantic search (OpenAI embeddings), category browse, bulk import.
- **MCP / IPC**: REST `routes/mcp.js` plus Unix domain socket transport (`unix-socket.ts`) using length‑prefixed MessagePack frames.
- **Media Services**: Routes (`voiceToText.js`, `vision.js`, `audioAnalytics.js`) integrate OpenAI + Deepgram; gracefully degrade if API keys missing.
- **Secure Vault**: API key vault, email, calendar, contacts routes backed by SQL migrations in `db-init/`.
- **Binary Assets**: `/api/hf/upload` + in‑memory/disk spillover store (TTL 30m) producing tokens `hfbin:<uuid>` with ownership tracking.

## 2. Key Conventions & Patterns

### Agent Development
- **Base Classes**: Sub‑agents extend `BaseAgent`/specialized base; short lowercase `name`, role `'sub'`, explicit `config.allowedTools`.
- **Delegation Contract**: `{ thought, response, action: 'respond'|'delegate', delegate_to? }`. Parse failure triggers safe fallback.
- **State Graph I/O**: Return `{ messages: [...LangChain Message], next_agent: 'cartrita' | '<agent>' | 'END', tools_used?, private_state? }`; never mutate existing state in place.
- **Private State**: Supervisor records each completed agent result in `private_state[agentName]` and composes final summary before `END`.

### Data & API Patterns  
- **Route Responses**: Use `{ success: true, data }` or `{ success: false, error }`. Mount routes in `index.js`.
- **Structured Outputs**: Bridge agents attach structured payloads persisted under `conversation_messages.metadata.structured` (array). Retrieve via `/api/chat/structured`.
- **HF Binary Tokens**: Pattern `hfbin:<uuid>` stored with ownership + expiry. Always validate ownership; misuse increments `hf_token_misuse_total`.
- **Embeddings Format**: Store as bracketed float string (Postgres array literal) NOT JSON.
- **Error Handling**: Catch & convert to user-facing message; never throw uncaught in agent graph.

### Code Quality
- **ES6 Import/Export**: All modules use ES6 syntax (`import`/`export default`, not CommonJS)
- **Tracing**: Wrap I/O/CPU heavy ops with `traceOperation` or agent/tool helpers; use domain-oriented span names (`hf.vision.classify`, `workflow.import.bulk`).
- **Environment Variables**: Located in `.env` files (root and `packages/backend/.env`). Check both for API keys.
- **Graceful Degradation**: Missing API keys => log warning + disable features, don't crash startup.

## 3. Common Tasks (Do Exactly This)

### Development Workflow
- **Start Backend**: `cd packages/backend && npm run dev` (builds router + starts server on port 8001)
- **Start Frontend**: `cd packages/frontend && npm run dev` (Vite dev server on port 3000)  
- **Database**: Run migrations in `db-init/` numerically: `00_setup_pgvector.sql`, then `06_comprehensive_cartrita_schema.sql`, then incremental migrations
- **Test Routes**: Use `curl http://localhost:8001/health` to verify backend running

### Agent Development
- **Add Sub-Agent**: Create file under `src/agi/consciousness/`, export default class, append filename to `agentFileNames` array in supervisor, set `allowedTools`, add tracing where heavy.
- **Tool Registry**: Extend `AgentToolRegistry.js`; ensure ownership check on `hfbin` tokens + tracing span + counter attributes.

### Route Development
- **New Route**: Add under `src/routes/`, import & mount in `index.js`. Use standard response format. Wrap heavy work with tracing.
- **Missing Routes**: If getting 404s, check if route file exists AND is imported in `index.js`. Common issue: import exists but mount line missing.
- **Auth Routes**: Many routes use POST/PUT, not GET. Auth routes require `Content-Type: application/json`.

### Database & State
- **Migrations**: Create new migration file (increment number), update field lists in services, adjust serialization. Never edit existing migration files.
- **Structured Output**: Attach object to agent return; persistence handled centrally.
- **Metrics**: `const counter = OpenTelemetryTracing.createCounter('name','desc')`; store on `global.otelCounters`.

### Documentation
- **Dev Log**: Add short entry to `docs/PROJECT_NOTEBOOK.md` after meaningful changes with date, scope, verification notes.
- **Project Status**: Current status shows 27/30 major tasks completed (90% milestone achieved).

## 4. Anti-Patterns (Avoid)

- **NO Static Agent Imports**: Keep dynamic `await import()` pattern in supervisor to avoid circular dependencies.
- **NO State Mutation**: Never mutate `state.messages` directly; always return new messages array.
- **NO JSON Embeddings**: Store as bracketed numeric string for Postgres array compatibility.
- **NO Persona in Infrastructure**: Keep Cartrita voice only in user-facing responses; infra code stays neutral.
- **NO Migration Edits**: Never edit existing migration files; create new incremental migrations.
- **NO CommonJS**: Use ES6 modules (`import`/`export`) throughout; backend has `"type": "module"`.

## 5. File Landmarks (Updated)

### Core Architecture
- **Supervisor**: `packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js`
- **Tool Registry**: `packages/backend/src/agi/orchestration/AgentToolRegistry.js`  
- **Main Server**: `packages/backend/index.js` (route mounting, middleware setup)
- **Tracing**: `packages/backend/src/system/OpenTelemetryTracing.js`

### Agent System
- **HF Bridge Agents**: `packages/backend/src/integrations/huggingface/bridge/*Agent.js`
- **Agent Examples**: `packages/backend/src/agi/consciousness/AnalyticsAgent.js` (exemplary patterns)
- **MCP Coordinator**: `packages/backend/src/agi/system/EnhancedMCPCoordinator.js`

### API & Routes
- **Structured Outputs**: `packages/backend/src/routes/chatHistory.js` (`/api/chat/structured`)
- **Workflow Tools**: `packages/backend/src/routes/workflowTools.js`
- **HF Binary**: `packages/backend/src/routes/hf.js` (`/api/hf/*`)
- **MCP Routes**: `packages/backend/src/routes/mcp.js`
- **Socket Transport**: `packages/backend/src/unix-socket.ts`

### Database & Configuration
- **DB Schemas**: `db-init/` (apply `00_setup_pgvector.sql`, `06_comprehensive_cartrita_schema.sql`, then migrations `07+`)
- **Environment**: `packages/backend/.env` (API keys, database config)
- **Dev Notebook**: `docs/PROJECT_NOTEBOOK.md` (current status, progress tracking)

## 6. Extension Guidelines

### Development Best Practices
- **Mirror Existing**: Copy structure from existing minimal agent/route before customizing.
- **Service Wrapper**: Wrap external APIs in `src/services/<Domain>Service.js` + expose via tool registry, not directly from agents.
- **Incremental Changes**: Keep migrations additive; maintain structured output stability.
- **Environment Checks**: Always check for API key presence before initializing services.

### Testing & Validation
- **Route Testing**: Test with correct HTTP methods (many auth routes use POST, not GET).
- **Service Health**: Use `/health` endpoint to verify backend status and service availability.
- **Migration Validation**: Verify database schema matches migration files before deployment.

## 7. Safety & Graceful Degradation

- **Missing Dependencies**: API key missing => log warning + disable features, never crash startup.
- **HF Token Validation**: Always validate `hfbin:` ownership before file access; increment misuse counter on violations.  
- **Supervisor Guards**: Check `isInitialized` before operations; return safe fallback if not ready.
- **Error Boundaries**: Don't leak stack traces to users; provide user-friendly error messages.

## 8. Current Development Status

- **Progress**: 27/30 major tasks completed (90% milestone achieved)
- **Recent**: Task 26 (System Performance Optimization) completed with comprehensive monitoring
- **Architecture**: Stable hierarchical multi-agent system with 15+ specialized agents
- **Performance**: Real response times verified (Chat ~11s, Image ~8s, Embeddings ~440ms)  
- **Security**: AES-256-GCM encryption, 50+ API providers in secure vault

---

**Questions or missing patterns?** Propose refinement via PR with concise diff + justification.

## 2. Key Conventions & Patterns
- Agent Definition: Sub‑agents extend `BaseAgent`/specialized base; short lowercase `name`, role `'sub'`, explicit `config.allowedTools`. Add filename to `agentFileNames` array in supervisor or it won’t load.
- Delegation JSON Contract: `{ thought, response, action: 'respond'|'delegate', delegate_to? }`. Parse failure triggers safe fallback.
- State Graph I/O: Return `{ messages: [...LangChain Message], next_agent: 'cartrita' | '<agent>' | 'END', tools_used?, private_state? }`; never mutate existing state in place.
- Private State Aggregation: Supervisor records each completed agent result in `private_state[agentName]` and composes final summary before `END`.
- Structured Outputs: Bridge agents attach structured payloads persisted under `conversation_messages.metadata.structured` (array). Retrieve via `/api/chat/structured` (filters: `task`, `status`, pagination).
- HF Binary Tokens: Pattern `hfbin:<uuid>` stored with ownership + expiry. Always validate ownership in tools; misuse increments `hf_token_misuse_total`.
- Fast‑Path Delegation: Supervisor may short‑circuit to a specialized agent (keyword heuristic); increments dedicated counter—keep heuristic additive and safe.
- Embeddings Format: Store as bracketed float string (Postgres array literal) NOT JSON.
- Tracing: Wrap I/O/CPU heavy ops with `traceOperation` or agent/tool helpers; include domain-oriented span names (`hf.vision.classify`, `workflow.import.bulk`).
- Error Handling: Catch & convert to user-facing message; never throw uncaught in agent graph.
- Persona Boundary: Only user-facing assistant responses adopt Cartrita voice—infra/auth/tool code remains neutral.

## 3. Common Tasks (Do Exactly This)
- Run backend (dev local): `npm run dev:backend` (ensure Postgres migrations applied: run SQL in `db-init/00_setup_pgvector.sql` then comprehensive snapshot if fresh DB).
- Add Sub-Agent: Create file under `src/agi/consciousness/`, export default class, append filename to `agentFileNames`, set `allowedTools`, add tracing where heavy.
- Add HuggingFace Tool/Task: Extend registry in `AgentToolRegistry.js`; ensure ownership check on `hfbin` tokens + tracing span + counter attribute `task`.
- New Route: Add under `src/routes/`, import & mount in `index.js`. Use `{ success: true, data }` or `{ success: false, error }`. Wrap heavy work with tracing.
- Structured Output Persistence: Attach object to agent return; persistence handled centrally (do not write DB logic in agents for this).
- Add Metric: `const counter = OpenTelemetryTracing.createCounter('name','desc')`; store on `global.otelCounters` similar to existing.
- Extend Workflow Tool Schema: Create new migration file (increment number), update field lists in `WorkflowToolsService`, adjust serialization & tests.
- List / Revoke HF Binaries: `/api/hf/list` (pagination, mime, expired modes) & `/api/hf/revoke/:id`—reuse patterns when adding filters.
- Retrieve Structured Outputs: `/api/chat/structured?task=...&status=...&limit=...&offset=...`.
- Update Dev Log: Add a short entry to `docs/PROJECT_NOTEBOOK.md` summarizing what was changed and how it was verified; keep it terse.

## 4. Anti-Patterns (Avoid)
- DO NOT import sub-agents statically inside the supervisor (kept dynamic to avoid circular deps). Follow dynamic `await import()` pattern.
- DO NOT mutate `state.messages` directly; always return new messages array from node functions.
- DO NOT store raw embedding arrays as JSON; keep bracketed numeric string.
- DO NOT expand persona into infrastructure code (tracing, DB, security modules).
- DO NOT exceed delegation limits or bypass supervisor finalization logic.

## 5. File Landmarks (Updated)
- Supervisor: `packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js`
- Tool Registry: `packages/backend/src/agi/orchestration/AgentToolRegistry.js`
- HF Bridge Agents: `packages/backend/src/integrations/huggingface/bridge/*Agent.js`
- Tracing Core: `packages/backend/src/system/OpenTelemetryTracing.js`
- Binary Upload Routes: `packages/backend/src/routes/hf.js`
- Structured Output Retrieval: `packages/backend/src/routes/chatHistory.js` (`/api/chat/structured`)
- Workflow Tools Routes: `packages/backend/src/routes/workflowTools.js`
- MCP Routes: `packages/backend/src/routes/mcp.js`
- Unix Socket Transport: `packages/backend/src/unix-socket.ts`
- Exemplary Agent Prompting: `packages/backend/src/agi/consciousness/AnalyticsAgent.js`
- DB Schemas: `db-init/` (apply `00_setup_pgvector.sql` then latest snapshot `06_comprehensive_cartrita_schema.sql` followed by subsequent incremental migrations `07+` .. current highest `15_create_journal_entries.sql`).
- Recent Additions:
	- Journal Entries Migration: `15_create_journal_entries.sql` (journal_entries table)
	- Responsive UI audit plan: `docs/specs/ui/MOBILE_FIRST_COMPONENT_AUDIT_PLAN.md`
	- Workflow monitoring & templates specs under `docs/specs/workflows/`
	- Fusion & ambient intelligence plans under `docs/specs/multimodal/` & `docs/specs/intelligence/`

## 5.1 Pending Backend Feature Seeds
Follow spec-first approach before coding beyond stubs:
- Journal enrichment pipeline (sentiment/emotion) — see `TASK_JOURNAL_MANAGEMENT_PLAN.md`.
- Workflow execution streaming (SSE/WebSocket) — see `EXECUTION_MONITORING_UI_PLAN.md`.
- Fusion aggregation endpoints — implement after artifact schema migration.
- Ambient policy evaluator — schedule periodic evaluation loop with tracing.


## 6. Extension Guidelines
- Mirror an existing minimal agent for structure (names, exports, allowedTools) before customizing.
- Wrap new external APIs inside `src/services/<Domain>Service.js` + expose via tool registry, not directly from agents.
- Keep migrations additive; never rewrite old migration files—add new numbered file.
- Maintain structured output shape stability; version changes via new `type` field inside structured entry if you must evolve it.

## 7. Safety & Graceful Degradation
- Missing external key => log once + user-facing “feature unavailable” message; never abort startup.
- Always validate `hfbin:` ownership before file access; increment misuse counter on violations.
- Guard supervisor operations with `isInitialized`; return safe fallback if not ready.
- Do not leak stack traces to users; rely on fallback responses.

## 8. PR / Change Hygiene
- Single-responsibility commits; migrations isolated.
- Reference spec file names in commit messages for traceability.
- If adding a migration: bump numeric prefix; never alter previous migrations.
- Run lint/type checks where available before pushing.

## 9. Observability Additions
- Wrap new DB or external API operations in `traceOperation` with domain-prefixed span names.
- Add counters for new external services or policy evaluation loops.

---
Questions or missing patterns? Propose refinement via PR with concise diff + justification.
