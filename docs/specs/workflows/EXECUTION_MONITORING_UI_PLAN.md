# Execution Monitoring UI Plan
Status: Draft
Updated: 2025-08-10

## Objectives
Provide real-time & historical visibility into workflow execution lifecycle: queued, running, node-level progress, success/failure metrics, and logs.

## Views (Phase 1)
1. Per-Workflow History Panel
   - Table: execution_id (short), status pill, duration, started_at, completed_at, error (truncated), trigger type.
   - Pagination (limit, offset) backed by GET /api/workflows/:id/executions.
2. Execution Detail Drawer
   - Tabs: Summary | Nodes | Logs | Context
   - Summary: status, timing, counts (nodes total, succeeded, failed, skipped), error.
   - Nodes: linear list with status icon + duration; future graph overlay.
   - Logs: streaming (future SSE); fallback poll every 2s until terminal.
   - Context: JSON viewer (input_context, output_context) with copy + search.
3. Live Engine Overview (future page)
   - Active executions with runtime, node pointer, CPU/time metrics (GET /api/workflows/engine/stats + websocket later).

## Status Visual Language
| Status | Color | Icon |
|--------|-------|------|
| pending | gray | ⏳ |
| running | blue | 🔄 |
| completed | green | ✅ |
| failed | red | ❌ |
| canceled | yellow | ⚠️ |

## Polling Strategy (MVP)
- History table refresh every 10s while visible.
- Execution detail: poll status + logs every 1s until terminal.
- Abort polling on unmount.

## Component Hierarchy
WorkflowsPage
  └── ExecutionHistoryPanel (selectedWorkflow.id)
        ├── ExecutionRow (click => open detail)
        └── ExecutionDetailDrawer
              ├── SummaryTab
              ├── NodesTab
              ├── LogsTab
              └── ContextTab

## API Needs
Existing: /api/workflows/:id/executions (history)
Needed (future):
- GET /api/workflows/executions/:executionId (detailed including node breakdown & context)
- GET /api/workflows/executions/:executionId/logs (paginated or stream)
- SSE /api/workflows/executions/:executionId/stream (future)

Interim: augment existing execution start response with execution.id; detail route already partially present (validate shape).

## Data Shape (Proposed Detail Response)
```json
{
  "success": true,
  "execution": {
    "id": "uuid",
    "workflow_id": "uuid",
    "status": "running",
    "started_at": "2025-08-10T12:00:00Z",
    "completed_at": null,
    "duration_ms": 0,
    "current_node_id": "ai-gpt4_123",
    "nodes": [
      {"id":"trigger_1","type":"trigger-manual","status":"completed","started_at":"...","completed_at":"...","duration_ms":120},
      {"id":"ai-gpt4_2","type":"ai-gpt4","status":"running","started_at":"...","completed_at":null}
    ],
    "execution_logs": [{"timestamp":"...","level":"info","message":"Node started","nodeId":"trigger_1"}],
    "input_context": {},
    "output_context": null,
    "error": null
  }
}
```

## UX Interactions
- Select workflow → show History accordion beneath workflow cards.
- Click execution row → slide-up drawer (or side sheet) with tabs.
- Auto-scroll logs to bottom unless user scrolls upward (pause auto-scroll indicator).

## Performance Considerations
- Limit log payload size; request incremental logs (after last_timestamp) future.
- Virtualize history table if > 500 rows (Phase 2).

## Telemetry
- UI metric: execution_history_view_open_total
- Span wrappers for fetch durations.

## Accessibility
- Status pills with aria-label including textual status.
- Drawer focus trap and ESC close.

## Incremental Delivery
1. Static history table (wired to existing history endpoint).
2. Detail drawer pulling existing execution detail (if shape available) else placeholder.
3. Polling + status colorization.
4. Logs tab hooking into existing execution.execution_logs field.
5. Engine stats mini-widget (counts of running / failed last 24h).

---
Pending: SSE streaming & node progress graph overlay.
