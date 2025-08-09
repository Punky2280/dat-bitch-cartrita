# Copilot Project Instructions (Cartrita Multi-Agent OS)

Purpose: Make AI coding agents instantly productive in this repo. Follow these concrete conventions; do not invent new architectures. Keep Cartrita's established personality only where user-facing text is already personality-driven; keep code changes neutral.

## 1. High-Level Architecture
- Monorepo (npm workspaces) under `packages/` (no turborepo). Core focus: `packages/backend` (Node + Express + LangChain StateGraph supervisor) & `packages/frontend` (React + Vite). Python MCP reference under `py/mcp_core` (types only currently).
- Hierarchical Multi-Agent System: Supervisor (`EnhancedLangChainCoreAgent.js` class name `CartritaSupervisorAgent`) dynamically imports ~20+ sub‑agents in `src/agi/**`. Delegation guardrails: `recursionLimit=15`, max 2 chained delegations, supervisor self-call cap=3. Always routes back to `cartrita` node until final `END`.
- Tool / Capability Layer: `AgentToolRegistry` centralizes tool definitions + per‑agent `allowedTools`. HuggingFace bridge agents (vision/audio/language/multimodal/data) added under `integrations/huggingface/bridge/*` with structured output contract.
- Observability: `OpenTelemetryTracing` sets up Node SDK + counters. Use helpers: `traceAgentOperation`, `traceToolExecution`, `traceOperation`. New metrics include fast‑path delegation, hf task counters, `hf_token_misuse_total`.
- Knowledge & Workflow: `WorkflowToolsService` + `routes/workflowTools.js` provide semantic search (OpenAI embeddings), category browse, bulk import with span attributes `import.success_count` / `import.error_count`.
- MCP / IPC: REST `routes/mcp.js` plus Unix domain socket transport (`unix-socket.ts`) using length‑prefixed MessagePack frames + heartbeat (`lastPing` in stats).
- Media / Multimodal Services: Routes (`voiceToText.js`, `vision.js`, `audioAnalytics.js`, etc.) integrate OpenAI + Deepgram; gating by presence of API keys.
- Secure Vault & Life OS: API key vault, email, calendar, contacts routes backed by SQL migrations in `db-init/` (see comprehensive snapshot `06_comprehensive_cartrita_schema.sql`).
- Binary Asset Pipeline: `/api/hf/upload` + in‑memory/disk spillover store (TTL 30m) producing tokens `hfbin:<uuid>` with ownership + misuse counter tracking.

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

## 4. Anti-Patterns (Avoid)
- DO NOT import sub-agents statically inside the supervisor (kept dynamic to avoid circular deps). Follow dynamic `await import()` pattern.
- DO NOT mutate `state.messages` directly; always return new messages array from node functions.
- DO NOT store raw embedding arrays as JSON; keep bracketed numeric string.
- DO NOT expand persona into infrastructure code (tracing, DB, security modules).
- DO NOT exceed delegation limits or bypass supervisor finalization logic.

## 5. File Landmarks
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
- DB Schemas: `db-init/` (use latest comprehensive snapshot + subsequent migrations)

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

---
Questions or missing patterns? Open an issue or ask for a refinement—keep this file concise and updated when patterns evolve.
