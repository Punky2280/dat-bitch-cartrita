# Phase Roadmap (Vault, Personality, Health, Knowledge Hub, Life OS, Workflow Engine)

Version: 0.1.0-phase1

## Phase 1 Scope (Weeks 1-2)

- Extended API Key Vault provider metadata & validation layer
- Personality settings schema (humor + verbosity) backend storage
- Basic health checks (db_connectivity, provider_ping:openai/hf, disk_usage, error_spike primitive)
- Knowledge Hub: category + search endpoint (read-only) augmentation

### Deliverables

- Migrations 11_add_vault_extended_providers.sql, 14_personality_settings.sql
- New routes: /api/vault/providers, /api/vault/credentials (create/list), /api/settings/personality (GET/PUT)
- Health: /api/health/light, /api/health/full (subset)
- Consolidated docs folder created (this)

### Exit Criteria

- Provider catalog returns >= 20 providers with field schema
- Personality update persists & validates enum expansions
- Health full endpoint returns PASS/WARN for at least 4 checks
- Knowledge search filters by category & tag

## Phase 2 Scope (Weeks 3-4)

Version: 0.2.0-phase2

- Life OS core (tasks, journals with sentiment) + embeddings
- Rotation scheduler baseline
- Advanced health checks (rate limits, rotation overdue, memory_pressure)
- Knowledge Hub related entries vector search

## Phase 3 Scope (Weeks 5-6)

Version: 0.3.0-phase3

- Workflow foundational tables + minimal nodes
- Execution engine sequential + retries
- Vector recall endpoint for Life OS entities
- Provider fallback chain logic (LLM summarization)

## Phase 4 Scope (Weeks 7-8)

Version: 0.4.0-phase4

- Parallel & loop nodes
- Snapshot resumability
- Diff & version history
- Habit tracking + usage budgets

## Phase 5 Scope (Weeks 9-10)

Version: 0.5.0-phase5

- Plugin model (Node.js)
- Extended health (dependency drift, rotation compliance)
- Observability dashboards
- Provider catalog reaches full 50 set

## Phase 6 Scope (Weeks 11+)

Version: 0.6.0-phase6

- Security hardening, penetration tests
- Journal encryption opt-in
- Plugin adapters (Python/Java)
- Documentation normalization & deprecation of temp folder

## Tracking Metrics

| Metric | Phase 1 Target | Phase 6 Target |
|--------|----------------|----------------|
| Secret Providers Implemented | 20 | 50 |
| Workflow Node Types | 0 | 25+ |
| Health Checks | 4 | 15+ |
| Personality Modes | 14 combos | 40+ combos |
| Fallback Coverage (%) | 0% | 90% |

## Change Log

- 0.1.0-phase1: Initial roadmap file created.
