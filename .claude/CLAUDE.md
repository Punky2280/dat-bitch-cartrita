# Cartrita AI OS — CLAUDE.md (System + Engineering Constitution)
Version: 2.0  
Last Updated: 2025-08-17  
Maintainer: Robbie Allen  

## 0. Mission
Cartrita is a hierarchical, production-grade multi-agent AI Operating System (15+ specialized agents) using LangChain StateGraph + MCP. Goals: secure, observable, resilient, performant, iteration-stable evolution without architectural drift.

## 1. Role Contract (Claude Code Context)
You act as an Engineering Execution Layer (EEL):
- Enforce existing architecture; never invent new paradigms.
- Produce minimal, reversible, additive changes.
- Preserve backward compatibility (APIs, data formats, migrations).
- Distinguish layers: routes, services, agents, tools, infra, frontend.
- Output: plans, diffs, validation strategy—not vague prose.
- For multi-step internal processes always route via SupervisorAgent and terminate with next_agent="END" when complete.

## 2. High-Level Architecture
- SupervisorAgent + dynamic sub-agents (no static bundling).
- Central tool registry with per-agent allowlists.
- PostgreSQL 14+ (pgvector).
- Node.js / Express / TypeScript (strict) / React 18.
- OpenTelemetry tracing & counters (observability first).
- Standard response envelope: { success: boolean, data?, error?, meta? }.
- Additive SQL migrations only (db-init/NN_description.sql).
- Embeddings: canonical vector dimensions (OpenAI 1536, HuggingFace 1024); no silent changes.

## 3. Repository Critical Paths
- Backend entry: packages/backend/index.js
- Services: packages/backend/src/services/
- Routes: packages/backend/src/routes/
- Frontend entry: packages/frontend/src/main.tsx
- Migrations: db-init/
- Tests: packages/backend/tests/
- Scripts: packages/backend/scripts/
- Claude command specs: .claude/commands/

## 4. Agents
Core: SupervisorAgent (override), ResearcherAgent, CodeWriterAgent, ArtistAgent, SchedulerAgent, WriterAgent, EmotionalIntelligenceAgent, TaskManagementAgent, AnalyticsAgent  
HuggingFace specialists: VisionMaster, AudioWizard, LanguageMaestro, MultiModalOracle, DataSage  
Rules: dynamic import sub-agents; allowedTools enforced; no direct DB writes unless via sanctioned service layer.

## 5. Non-Negotiable Rules
1. Dynamic import sub-agents; no static supervisor coupling.
2. No in-place mutation of state graph arrays/objects—return new objects.
3. Always respond with standardized envelope externally.
4. Additive migrations only; past migrations immutable.
5. Preserve embedding/vector formats/dimensions.
6. All CPU/IO heavy operations traced (domain-oriented span names).
7. Supervisor mediation between steps; no autonomous long loops.
8. Tools access only if in agent's allowedTools set.
9. Binary/asset token ownership & expiry validated before use; log misuse.
10. User-safe errors only; internal detail goes to logs/traces.
11. Parameterized SQL exclusively; no string concatenation.
12. No secrets in code; all keys via secure env/vault.
13. Persona boundaries: infra/tool code neutral, user-facing agent replies may carry persona.
14. Structured outputs attached to metadata layer; agents don't persist directly.

## 6. Default Engineering Workflow
Plan -> Search -> Implement -> Trace -> Test -> Output -> Route Back (supervisor) -> END.

Return object for agent step:
{
  "messages": [...],
  "next_agent": "supervisor" | "SomeAgent" | "END",
  "tools_used": [...],
  "private_state": { ... }
}

Delegation JSON (from sub-agent):
{
  "thought": "...",
  "response": "...",
  "action": "respond" | "delegate",
  "delegate_to": "AgentName?"
}

On parse failure: safe neutral fallback.

## 7. Observability
Span naming taxonomy:
- agent.<agent>.<verb>
- service.<domain>.<method>
- route.<resource>.<method>
- db.query.<table>
- workflow.<pipeline>.<stage>
- vector.search.<table>
Core span attributes: task_id?, user_id?, latency_ms, row_count?, token_count?, tool_name?  
Counters: delegation_attempts, tool_usage{agent,tool}, token_validation_failures, vector_searches.  
No console.log in production; use structured logger with correlation_id.

## 8. Performance Guardrails
- p95 route latency < 2000ms
- Typical synchronous request ≤ 6 DB queries (prefer batching)
- Vector search requires ivfflat index before production
- Add caching only with explicit invalidation path
- Memory stability verified (no unbounded arrays / leaks)
- Avoid N+1; confirm via EXPLAIN ANALYZE.

## 9. Data & Schema Governance
- IDs: SERIAL integer unless business-critical UUID needed.
- Timestamps: created_at, updated_at (application or trigger).
- Vector columns: embedding vector(1536|1024); dimension validated pre-insert.
- Foreign keys: ON DELETE CASCADE only if analytics or integrity unaffected.
- Avoid duplicative derivable data unless performance justified (document rationale).
- Migration Template:

BEGIN;
-- Purpose: ...
CREATE TABLE IF NOT EXISTS name (...);
CREATE INDEX idx_name_col ON name(col);
COMMIT;

## 10. Security Matrix
Dimension | Requirement
--------- | -----------
Auth | JWT validation & scopes
Encryption | AES-256-GCM for sensitive fields at rest
Input Validation | Zod (or equivalent) at route boundary
Secrets | External vault/env (no commits)
Audit | All mutative operations logged (actor, action, target)
Error Surface | Generic; include correlation_id for support
SQL | Parameterized queries only
RLS | Apply where multi-tenant access control needed

## 11. Services & Routes
Service rules:
- Domain orchestration only (no transport)
- OpenTelemetry spans per method
- Throw domain errors; route layer maps to envelope
Route rules:
- Validate input
- Authenticate/authorize
- Call service
- Wrap heavy logic in traced span
- Return { success, data|error, meta? }

## 12. Testing Standards
Targets:
- Pass rate: 99%+
- Coverage: ≥85% (unit + integration)
Required layers:
- Unit (services, utilities, validators)
- Integration (routes ↔ DB)
- Agent orchestration (supervisor ↔ sub-agent delegation)
- Smoke (core health + critical endpoints)
- Performance (baseline + regressions for high-traffic paths)
Failure triage: reproduce -> narrow -> patch minimal -> new regression test -> trace confirm.

## 13. Iteration Workflow
Branch: iteration-XX-feature-name  
Commit: feat(iteration-XX): concise description  
Iteration checklist:
□ Review dependencies  
□ Migration (if schema change)  
□ Service + routes + tracing  
□ Tests (unit/integration)  
□ Frontend integration (if scope)  
□ Notebook update  
□ Script test-[iteration].js  
□ Smoke tests  
□ Observability verification  

## 14. Command Specs (.claude/commands/)
fix-iteration.md:
1. git status
2. Review paste.txt (iteration context)
3. Check db-init/ migrations
4. Inspect services + routes
5. npm test -- --testPathPattern=$ARGUMENTS
6. Fix + add tests
7. node packages/backend/scripts/test-iteration-$ARGUMENTS.js
8. Commit: fix(iteration-$ARGUMENTS): resolved implementation issues

implement-service.md:
1. Review copilot-instructions.md
2. Create service in services/
3. Add spans + error handling
4. Add routes + register in index.js
5. Tests (unit + integration)
6. Health endpoint
7. Update API docs
8. curl http://localhost:8001/api/[endpoint]/health

migrate-db.md:
1. psql -d $DATABASE_URL -c "\dt"
2. Create db-init/NN_$ARGUMENTS.sql
3. Add table + FKs + indexes + optional seed
4. Apply & verify
5. Update schema docs

## 15. Extended Prompt Snippets
Iteration:
I need Iteration [NUMBER]
Focus: ...
Tables: ...
Services: ...
Task: ...
Please:
1. Review iteration notebook
2. Inspect existing code
3. Identify gaps
4. Implement patterns (tracing, services)
5. Provide diffs + tests

Optimization:
think about optimizing [COMPONENT] for [METRIC]
Provide: root cause, ≥3 options, trade-offs, recommendation, migration strategy, projected metrics.

Chain-of-Thought Debug:
<thinking> steps 1–7 </thinking>
<implementation> patch summary </implementation>
<validation> regression tests list </validation>

## 16. Performance Optimization Flow
1. Baseline (latency, query count, memory, span tree)
2. Identify hotspots (EXPLAIN ANALYZE, flame graphs)
3. Optimize (indexing, batching, caching, concurrency)
4. Validate (compare metrics pre/post)
5. Stage + monitor
6. Document deltas

## 17. Production Readiness
Checklist:
Code: strict TS, lint clean, coverage ≥85%, no console.log.  
Security: auth, validation, encryption, audit, RLS as needed.  
Performance: p95 <2s, no N+1, indexes present.  
Observability: spans for all critical flows, health endpoints green, counters incrementing.  
Docs: API + iteration notebook + migration notes updated.  
Rollback plan documented (previous build artifact + migration reversal strategy if safe).  

Deployment Protocol:
1. npm test
2. npm run build
3. ./scripts/migrate-prod.sh
4. pm2 restart cartrita-backend
5. Deploy frontend
6. curl https://api.cartrita.ai/health
7. Smoke tests (npm run smoke:prod)
8. Monitor logs & metrics
9. If failure: ./scripts/rollback.sh

## 18. Emergency Protocols
Critical Bug (P0):
Reproduce -> isolate commit -> trace spans/logs -> minimal hotfix branch -> targeted tests -> deploy with heightened monitoring -> post-mortem.

Service Down:
curl health -> pm2 logs -> DB SELECT 1 -> redis-cli ping (if used) -> restart -> diagnostics script -> patch.

Data Recovery:
Halt writes -> snapshot current -> scope analysis -> restore last good backup -> apply diffs -> integrity checks -> resume -> audit.

## 19. Validation Before Commit
□ Dynamic imports only for sub-agents  
□ No state mutation in returns  
□ next_agent correct (or END)  
□ allowedTools enforced  
□ Binary token validation (when applicable)  
□ Tracing on CPU/IO heavy paths  
□ Response envelope standard  
□ Data formats unchanged (vectors, embeddings)  
□ Migration additive only  
□ Tests added/updated & passing  
□ Persona boundary preserved  

## 20. Success Metrics
- Test pass rate ≥99%
- Coverage ≥85%
- p95 latency <2s
- Error rate <0.1%
- Zero undisclosed security issues
- Clean observability (no missing spans for critical flows)

## 21. Continuous Improvement
Weekly:
- Review span noise / cardinality
- Add missing negative-path tests
- Evaluate caching efficacy
- Update iteration notebook
- Refine agent delegation heuristics conservatively

## 22. Quick Commands
Development:
npm run dev
npm run dev:backend
npm test -- --testPathPattern=iteration-22
curl http://localhost:8001/api/health

Docker:
docker-compose up -d
docker-compose logs -f cartrita-backend
docker-compose restart cartrita-backend
docker-compose down && docker-compose up --build

Production:
./scripts/deploy.sh
./scripts/rollback.sh
pm2 monit
pm2 logs cartrita-backend --lines 1000

## 23. Example Service Skeleton
```ts
class ExampleService {
  constructor(pool, tracer, logger) {
    this.db = pool;
    this.tracer = tracer;
    this.logger = logger;
    this.serviceName = 'workflow.example';
  }
  async list({ userId, limit = 10, offset = 0 }) {
    const span = this.tracer?.startSpan(`${this.serviceName}.list`);
    try {
      if (!userId) throw new Error('Missing userId');
      const sql = 'SELECT id,name FROM example WHERE user_id=$1 ORDER BY id DESC LIMIT $2 OFFSET $3';
      const result = await this.db.query(sql, [userId, limit, offset]);
      span?.setAttribute('row.count', result.rowCount);
      return { success: true, data: result.rows, meta: { count: result.rowCount } };
    } catch (e) {
      span?.recordException(e);
      span?.setStatus({ code: 2, message: e.message });
      throw e;
    } finally {
      span?.end();
    }
  }
  async health() {
    try {
      await this.db.query('SELECT 1');
      return { healthy: true, service: this.serviceName };
    } catch (e) {
      return { healthy: false, service: this.serviceName, error: e.message };
    }
  }
}
export default ExampleService;
```

## 24. Sample Route Pattern
```ts
router.get('/example/list', authenticate, async (req, res) => {
  const span = tracer?.startSpan('route.example.list');
  try {
    const { limit = '10', offset = '0' } = req.query;
    const result = await exampleService.list({
      userId: req.user.id,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
    res.json(result);
  } catch (e) {
    span?.recordException(e);
    res.status(500).json({ success: false, error: e.message || 'Internal server error' });
  } finally {
    span?.end();
  }
});
```

## 25. Agent Delegation Example
```json
{
  "thought": "Need specialized analysis on media embeddings.",
  "response": "Delegating media vector normalization.",
  "action": "delegate",
  "delegate_to": "VisionMaster"
}
```

## 26. Final Reminder
Adhere strictly to these constraints. Minimize surface area of changes. Always trace, test, document, and route through SupervisorAgent. Return END only when the user-facing goal is fully satisfied.

---
Cartrita: A Personal AI Operating System—treat every contribution as a production system enhancement.