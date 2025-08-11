# Ambient Intelligence Controls Plan
Status: Draft
Updated: 2025-08-10

## Vision
Provide a user-governed automation layer where background agents observe signals (calendar load, unread priority emails, stale contacts, mood drift) and trigger assistive actions under explicit guardrails.

## Core Control Dimensions
1. Signal Sources (calendar, email, tasks, journal sentiment, contacts recency, workflow metrics)
2. Automation Policies (if condition THEN recommendation|auto-action)
3. Safety & Consent (confirm before first execution per policy; override to auto)
4. Transparency (activity feed + rationale + ability to revert)
5. Rate / Frequency Limits (per policy + global daily cap)

## Data Model (Additive)
```sql
CREATE TABLE ambient_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  signal_type TEXT NOT NULL, -- calendar_load|email_priority|contact_stale|mood_trend
  condition_expr TEXT NOT NULL, -- expression language referencing signal JSON
  action_type TEXT NOT NULL, -- suggest_block|draft_email|create_task|notify|trigger_workflow
  action_payload JSONB, -- template variables
  mode TEXT DEFAULT 'manual', -- manual|confirm|auto
  enabled BOOLEAN DEFAULT TRUE,
  cooldown_seconds INT DEFAULT 3600,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ambient_activity (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  policy_id UUID REFERENCES ambient_policies(id) ON DELETE SET NULL,
  signal_snapshot JSONB,
  action_executed BOOLEAN,
  action_result JSONB,
  status TEXT, -- triggered|skipped|error
  rationale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Condition Expression
- Safe subset: boolean logic + comparisons over provided signal object.
- Example: `signal.calendar.busy_hours_today > 5 AND signal.focus_blocks_remaining < 2`
- Evaluate in sandbox (VM2) with timeouts.

## Action Types (Phase 1)
| action_type | Effect |
|-------------|--------|
| suggest_block | Creates suggestion entry (no direct calendar change) |
| create_task | Adds task with AI-generated description |
| draft_email | Generates email draft (not sent) |
| notify | Pushes notification banner |
| trigger_workflow | Starts workflow by ID |

## API (Phase 1)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/ambient/policies | List policies |
| POST | /api/ambient/policies | Create policy |
| PUT | /api/ambient/policies/:id | Update policy |
| DELETE | /api/ambient/policies/:id | Remove policy |
| POST | /api/ambient/policies/:id/test | Dry-run condition with sample signal |
| GET | /api/ambient/activity | Paginated activity feed |

## Evaluation Loop
1. Signal harvesting job aggregates metrics snapshot per user every N minutes.
2. For each enabled policy (enabled && now - last_triggered > cooldown):
   - Evaluate condition.
   - If true: queue action.
   - Record ambient_activity row with rationale.
3. Action executor processes queued actions (respect mode: manual → only suggestion, confirm → pending until user approves, auto → execute immediately but still log).

## UI (Preview Panel)
- Ambient Intelligence tab (settings or dashboard) listing policies with status toggles & last trigger.
- Create Policy modal: pick signal_type → guided condition builder (basic comparators) + action selection.
- Activity Feed: timeline cards (icon by signal_type) with rationale & quick undo (where possible).

## Telemetry
Counters: ambient_policy_trigger_total{signal_type,action_type}
Histogram: ambient_condition_eval_ms
Gauge: ambient_policies_enabled_total

## Safety & Privacy
- All actions must be reversible or harmless in MVP (no auto-send emails).
- Provide explicit explanatory rationale (store in activity log).
- User can globally pause all policies (emergency stop).

## Incremental Delivery Plan
1. DB migrations.
2. CRUD endpoints + validation of condition_expr (lint sandbox).
3. Evaluation worker (cron style) with logging only (no actions).
4. Action execution for suggest_block & notify.
5. UI list + create/edit + activity feed.
6. Additional actions (draft_email, create_task, trigger_workflow) + confirm mode.

## Future Enhancements
- Adaptive policies (auto-adjust thresholds based on usage).
- Learning from dismissals to refine conditions.
- Multi-user shared ambient policies (team context).

---
End of plan.
