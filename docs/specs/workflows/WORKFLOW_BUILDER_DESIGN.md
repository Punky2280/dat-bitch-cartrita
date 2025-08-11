# Workflow Builder Design (MVP Spec)
Status: Draft
Updated: 2025-08-10
Owner: Automation / Agent Orchestration

## Objectives
Provide an in-browser visual editor for defining, persisting, and executing AI + data + integration workflows leveraging existing multi‑agent & tool registry infrastructure.

## Core Concepts
- Workflow: Directed acyclic graph (future cyclic w/ guards) of typed nodes.
- Node: Declarative config + runtime execution adapter (mapped to agent tool, external API, logic primitive, or control structure).
- Edge: Data & control dependency. In MVP edges carry implicit full context object; later add edge-level mapping & transforms.
- Execution Context: JSON state evolving after each node (messages, variables, errors, metrics).

## Node Taxonomy (Initial)
| Category | Type Key | Purpose | Backend Mapping |
|----------|----------|---------|-----------------|
| Triggers | trigger-manual | Manual start | REST call kickoff |
| Triggers | trigger-schedule | CRON schedule | Scheduler table + cron worker |
| AI | ai-gpt4 | LLM completion | Tool: openai.chat.completions |
| AI | ai-claude | Anthropic completion | Tool wrapper |
| RAG | rag-search | Vector search | WorkflowToolsService embedding search |
| Data | data-fetch | HTTP fetch | Generic HTTP tool |
| Logic | logic-condition | Branching boolean | Inline JS sandbox (safe eval) |
| Logic | logic-transform | Map/derive fields | Simple template engine |
| Integration | http-request | External API | HTTP tool |
| Integration | mcp-call | MCP tool request | MCP route |
| Output | output-console | Log result | Logging w/ tracing span |
| Output | output-webhook | POST to webhook | HTTP tool |

## Node Config Schema (Generic)
```json
{
  "id": "string",
  "type": "ai-gpt4",
  "name": "Summarize Email",
  "config": {
    "model": "gpt-4",
    "prompt": "Summarize: {{input.email_body}}",
    "temperature": 0.2
  },
  "retry": {"max": 2, "backoff_ms": 2000},
  "timeout_ms": 60000,
  "on_error": "continue|stop|skip",
  "outputs": ["summary_text"]
}
```

## Persistence Model (DB Additions)
Tables (simplified):
```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',
  tags TEXT[],
  workflow_json JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_template BOOLEAN DEFAULT FALSE,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON workflows(user_id, category);

CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|failed|canceled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  input_context JSONB,
  output_context JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON workflow_executions(workflow_id, status);

CREATE TABLE workflow_execution_logs (
  id BIGSERIAL PRIMARY KEY,
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id TEXT,
  level TEXT, -- info|warn|error|debug
  message TEXT,
  metadata JSONB,
  ts TIMESTAMPTZ DEFAULT NOW()
);
```

## Execution Engine (MVP)
1. Load workflow JSON; topologically sort nodes.
2. Initialize context = input_context || {}.
3. For each node:
   - Create tracing span (wf.node.<type>)
   - Resolve templates in config using Mustache-like {{path}}.
   - Execute adapter; capture outputs; merge into context.
   - Persist execution log row.
   - Handle errors per on_error.
4. On completion: update execution row (status, output_context).
5. Emit websocket / SSE events (future) for UI live updates.

## Adapter Contract
Input:
```ts
interface AdapterInput { node: NodeDef; context: any; userId: string; executionId: string; }
```
Output:
```ts
interface AdapterResult { success: boolean; outputs?: Record<string,any>; error?: string; metrics?: Record<string,number>; }
```

## Template Resolution
- Use lightweight mustache library.
- Support dot-path lookups into context.
- Future: add inline transforms e.g. {{input.text | truncate:200}}.

## Security & Isolation
- Logic nodes executed in VM2 sandbox (time & memory limits).
- Disallow dynamic require/network except allowed tools.
- Rate limit external HTTP nodes per workflow.

## Versioning
- Editing creates new version (increment). Execution links to version snapshot (store snapshot in execution row to avoid mutation drift).

## Telemetry
Counters: workflow_executions_total{status}, workflow_node_errors_total{type}
Histogram: workflow_node_duration_ms{type}
Spans: wf.execute, wf.node.<type>

## UI Enhancements Roadmap
Phase A (Current): Basic drag/drop, save, execute, logs panel.
Phase B: Node inspector side panel (edit config), mini execution progress overlay.
Phase C: Branching condition visualization (colored edges), templated variable explorer.
Phase D: Live execution stream & retry individual node.

## Open Questions
- Multi-branch merging semantics (first-success vs all-required)?
- Secret injection strategy (map environment secret refs at runtime)?
- Caching policy for RAG & LLM nodes.

## Incremental Implementation Plan
1. Add DB migration for workflows + executions + logs.
2. Implement backend CRUD + execute route skeleton with topological order util.
3. Implement adapter registry with 3 adapters (manual trigger, ai-gpt4, http-request).
4. Wire existing WorkflowsPage save to new endpoints (once ready).
5. Add node inspector pane editing & validation.
6. Introduce branch logic + condition evaluation.
7. Introduce websocket streaming + incremental log updates.

---
This spec will evolve; changes require updating version history at top.
