# Workflow Templates System Plan
Status: Draft
Updated: 2025-08-10

## Purpose
Enable reusable starter workflows (templates) that accelerate user adoption and promote best practices. Provide curated system templates and user-shared templates (future) with version control and safe variable scaffolding.

## Template Definition
A template is a workflow record with is_template = true and may include placeholder tokens requiring user input prior to activation.

Example placeholder tokens inside node config:
```
{{VAR:openai_api_key}}
{{VAR:slack_channel_id}}
```
Resolution map stored per user when instantiating from template.

## Data Model Additions
Add table for template variable metadata (optional):
```sql
CREATE TABLE workflow_template_variables (
  id BIGSERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  var_name TEXT NOT NULL,
  description TEXT,
  required BOOLEAN DEFAULT TRUE,
  default_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON workflow_template_variables(workflow_id);
```

## API Extensions
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/workflows/templates | List templates (existing) |
| POST | /api/workflows/templates | Create template (admin/user) |
| POST | /api/workflows/templates/:id/instantiate | Create new workflow from template supplying variable map |
| GET | /api/workflows/templates/:id/variables | List required variables |

Instantiation Payload:
```json
{
  "name": "My Slack Summarizer",
  "variables": { "openai_api_key": "ref:secret:openai", "slack_channel_id": "C12345" },
  "category": "communication",
  "tags": ["slack","summaries"]
}
```

## Variable Resolution
- At instantiate time: replace {{VAR:var_name}} with provided value.
- If value starts with ref:secret: look up secret from vault at execution time (defer injection, store token reference not secret literal).

## Versioning Strategy
- Template version increments when workflow_json changes.
- Keep previous versions for existing instantiations; new instantiations default to latest_version.

Additional columns (workflows table additive):
```
ALTER TABLE workflows ADD COLUMN template_version INT DEFAULT 1;
ALTER TABLE workflows ADD COLUMN base_template_id UUID NULL REFERENCES workflows(id);
```

## UI Enhancements
Templates section:
- Filter by category, search by tag.
- Badge: NEW (last 7 days) and UPDATED (version changed).
- Click opens Template Detail Drawer: description, preview graph (read-only), required variables form, instantiate button.

Instantiate Flow:
1. User selects template → detail drawer.
2. System fetches /templates/:id/variables.
3. Render dynamic form (required fields flagged).
4. Submit calls instantiate endpoint; redirect to builder.

## Security & Permissions
- Only template owner or admin can update/delete template.
- Sharing model Phase 2: visibility enum (private|organization|public).

## Telemetry
Counters: workflow_templates_instantiate_total{template_id}
Gauge: workflow_templates_active_total
Span: wf.template.instantiate

## Out-of-the-Box Templates (MVP Set)
| Name | Category | Purpose |
|------|----------|---------|
| Daily Standup Summarizer | productivity | Aggregate calendar + notes into summary |
| Email Triage Classifier | communication | Classify & route emails |
| RAG Knowledge Answerer | knowledge | Search internal embeddings + answer |
| Contact Follow-Up Generator | relationships | Identify stale contacts & draft messages |

## Incremental Implementation Plan
1. Add migration for template variables + columns.
2. Extend workflows routes with template create, variables list, instantiate.
3. Frontend: Template detail drawer + variable form & instantiate action.
4. Placeholder variable token detection utility on save (auto-scan node configs for {{VAR:...}}).
5. Secret reference integration (defer injection at execute time).
6. Version bump logic on template update.

## Future Enhancements
- Rating & usage count ranking.
- Template marketplace / sharing feed.
- AI-assisted template generation from natural language spec.

---
End of plan.
