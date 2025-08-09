# Cartrita Documentation Consolidation Hub (Temp)

This temporary hub aggregates existing and new specification documents during the multi-phase platform expansion (Vault, Knowledge Hub, Life OS, Personality, System Health, Workflow Automation). Once stable, these will be refactored into a permanent information architecture.

## Purpose

- Centralize in-flight specs & migration notes
- Avoid drift across legacy scattered .md files
- Provide phase-by-phase progress tracking

## Structure

- phase-roadmap.md – Implementation tracker
- vault-spec.md – Expanded API Key Vault
- personality-spec.md – Humor & verbosity schema extensions
- knowledge-hub-spec.md – Read/aggregate/search completion
- lifeos-spec.md – Tasks, Habits, Journals, Vector recall
- health-spec.md – System health & diagnostics
- workflow-engine-spec.md – Workflow automation (Zapier/n8n hybrid)
- migrations-plan.md – Ordered SQL + rollback notes
- observability-spec.md – Metrics, traces, logs
- security-spec.md – Secret scoping, guardrails, compliance
- risk-register.md – Dynamic risk list (mirrors Section 15)

## Temporary Nature

This folder is a staging zone. Once Phase 6 completes, documents will be normalized into:

- docs/architecture/
- docs/guides/
- docs/reference/

## Conventions

- All JSON shown is canonical unless marked (example)
- TypeScript for code counterparts
- Embed version header at top of each spec file: `Version: x.y.z-phaseN`

---
Generated on: 2025-08-09
