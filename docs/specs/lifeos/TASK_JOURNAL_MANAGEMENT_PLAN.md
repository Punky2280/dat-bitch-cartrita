# Task & Journal Management Plan (Life OS)

Status: Draft (Scaffold Implemented)
Owner: LifeOS Module
Last Updated: 2025-08-10

## Goals
Provide a unified surface for: 
- Structured actionable tasks (priority, status, goal linkage)
- Unstructured reflective journal entries (free-form text, mood, tags)
- AI-derived insights bridging the two (convert reflections → tasks, sentiment trends → focus recommendations)

## Scope (Phase 1 MVP)
- CRUD Tasks (reuse existing /api/lifeos/tasks and DB tables personal_tasks)
- CRUD Journal Entries (new table: personal_journal)
- Sentiment + Emotion scoring (asynchronous enrichment; stored in columns sentiment_score NUMERIC, emotions JSONB)
- Conversion endpoint: journal entry → proposed tasks list
- Lightweight tagging & search

## Data Model (Proposed Additive Migration)
```sql
CREATE TABLE personal_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content TEXT NOT NULL,
  mood VARCHAR(32), -- user selected (e.g., optimistic, stressed)
  sentiment_score NUMERIC, -- -1..1
  emotions JSONB, -- { joy:0.7, anxiety:0.2 }
  tags TEXT[],
  ai_generated BOOLEAN DEFAULT FALSE,
  derived_task_ids UUID[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON personal_journal(user_id, entry_date DESC);
CREATE INDEX ON personal_journal USING GIN (tags);
```

## API Endpoints (Planned)
| Method | Path | Purpose | Notes |
|--------|------|---------|-------|
| GET | /api/lifeos/journal | List entries (filters: date range, tag, mood) | pagination params limit/offset |
| POST | /api/lifeos/journal | Create entry | triggers async enrichment job |
| GET | /api/lifeos/journal/:id | Fetch single entry | includes enrichment fields |
| PUT | /api/lifeos/journal/:id | Update entry | partial updates |
| DELETE | /api/lifeos/journal/:id | Delete entry | soft delete (future) |
| POST | /api/lifeos/journal/:id/derive-tasks | Convert entry to tasks draft | returns proposed tasks (not persisted) |
| POST | /api/lifeos/journal/batch-sentiment | Recompute sentiment for date range | maintenance/op reprocess |

## Enrichment Workflow
1. User POSTs new entry.
2. Entry stored with null sentiment_score.
3. Background job (agent tool) pulls pending entries.
4. LLM + rule heuristics produce: sentiment_score, emotions distribution, suggested tags, derived tasks.
5. Update row; optionally append structured output reference.

## Sentiment/Emotion Extraction (Initial Heuristic)
- Model: existing language agent tool or OpenAI sentiment classification.
- Map textual valence to [-1,1]; separate discrete emotion logits normalized.
- Confidence < threshold ⇒ mark entry for manual review (future).

## Journal → Task Derivation Contract
Input: entry_id, optional user constraints (max_tasks, focus_domains[])
Output JSON:
```json
{
  "source_entry": "uuid",
  "generated_at": "2025-08-10T12:00:00Z",
  "tasks": [
    {"title":"Follow up with design team","priority":"medium","reason":"You mentioned a blocker in your reflection"},
    {"title":"Schedule 30m deep work block","priority":"high","reason":"Low focus & context switching noted"}
  ]
}
```

## Frontend UX (Phase 1)
Tabs within Personal Life OS:
- Tasks (existing)
- Journal (new) showing: left column entries list (date, mood badge, sentiment color); right panel selected entry detail + derived insights card + quick convert-to-task buttons.
- New Entry modal with mood selector & live sentiment pre-check (optional stub).

Visual cues:
- Sentiment color scale (red → amber → green). 
- Emotion chip cloud hovering on detail panel.

## Telemetry & Metrics
Spans: lifeos.journal.create, lifeos.journal.enrich, lifeos.journal.derive_tasks
Counters: journal_entries_total, journal_enrich_failures_total
Histogram: journal_sentiment_distribution (custom bucket mapping -1..1 to 10 bins)

## Security & Privacy
- Content potentially sensitive: mark table for future encryption-at-rest upgrade path.
- Redact PII for analytics export pipelines (fields hashed).
- Access control: strictly per-user; no sharing in Phase 1.

## Future Enhancements
- Streak tracking (days journaled)
- Mood forecasting & relapse risk alerts
- Cross-linking tasks <-> journal timeline overlay
- Vector semantic search across entries
- Topic clustering weekly digest

---
Implementation Order (Incremental):
1. Migration for personal_journal
2. Basic CRUD routes + list integration
3. Frontend Journal tab scaffold
4. Async enrichment worker (agent tool)
5. Derive tasks endpoint + UI action
6. Advanced search & clustering
