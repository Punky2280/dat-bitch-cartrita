# Phased Feature Roadmap (Draft)

Derived from PROJECT_NOTEBOOK detailed requirements (Aug 2025).

## Phase 1 – Security & Observability Foundations (Q4 2025 Start)
Features: Credential Rotation Scheduling (1), Masking/Security Controls (2), Ambient Intelligence Controls (17)
Goals: Reduce secret exposure risk, enable automated rotation, establish threshold-driven automation controls.
Deliverables:
- Rotation API (CRUD policies, events) + frontend schedule UI
- Masking UI (masked/partial/reveal-once) + audit events
- Ambient controls panel (threshold sliders, automation toggles)
Success Metrics: 90% credentials with active policy, zero unlogged reveals, alert latency <5s.

## Phase 2 – Personalization & Knowledge (Late Q4 2025)
Features: Enhanced Personality Settings (3), Trait Editor (4), Knowledge Category UI (7), Category Org Interface (8), Task & Journal Sentiment (12)
Goals: Deep personalization, improved knowledge curation, emotional context capture.
Success Metrics: 70% users create custom profile, category reclass drag success <300ms, sentiment tagging accuracy >85%.

## Phase 3 – Workflow & Monitoring (Early Q1 2026)
Features: Health Dashboard (5), Real-Time System Health (6), Visual Workflow Builder (13), Execution Monitoring (14), Workflow Templates (15)
Goals: Visual orchestration + transparent runtime behavior.
Success Metrics: Workflow build time reduced 40%, node execution trace viability 100%, template reuse rate >35%.

## Phase 4 – Productivity Integrations (Mid Q1 2026)
Features: Calendar UI (9), Email Categorization UI (10), Contacts Management (11)
Success Metrics: Conflict resolution suggestions adoption >50%, email triage time -30%.

## Phase 5 – Advanced UX & Multimodal (Late Q1–Q2 2026)
Features: Cross-Modal Fusion Displays (16), Mobile-First Responsive Components (18)
Success Metrics: Mobile retention parity ±5% desktop, fusion panel usage >25% of multi-modal sessions.

## Cross-Cutting Work
- Testing & Coverage
- Accessibility
- Performance budgets
- Observability instrumentation

## Dependency Graph (Simplified)
Rotation & Masking -> Ambient Controls -> Personality & Knowledge -> Workflow Builder -> Monitoring -> Templates -> Productivity -> Fusion & Mobile.

## Risk Mitigation
- Secret Handling: Strict component boundaries, memory zeroization.
- Performance: WebSocket backpressure handling for real-time metrics.
- Complexity: Incremental node type rollout for workflow builder.

## Tracking
Each feature to have an ADR or update referencing requirement IDs (1–18) for traceability.

---
Draft maintained with roadmap sync every iteration.
