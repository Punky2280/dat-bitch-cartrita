# Mobile-First Component Audit Plan
Status: Draft
Updated: 2025-08-10

## Objective
Ensure core application surfaces are usable and performant on small screens (≤ 390px width) with progressive enhancement toward desktop.

## Target Views (Priority Order)
1. Dashboard & Health Dashboard
2. Email Inbox (triage columns)
3. Personal Life OS (tabs + calendar + journal)
4. Workflow Builder (read-only viewing mode on mobile, editing disabled or gated)
5. Knowledge Hub (graph & categories)
6. API Key Vault & Rotation

## Responsive Strategy
- Use CSS grid breakpoint utilities (Tailwind) with mobile default stacking.
- Introduce responsive utility classes for hiding heavy visualizations on narrow screens (e.g., md:block hidden).
- Provide horizontal scroll containers for wide data tables (contacts, executions) with minimal columns first.

## Component Guidelines
| Component | Mobile Adaptation |
|----------|-------------------|
| Tri-column Email Triage | Collapse into segmented control switching single column; preserve counts badges |
| Workflow Canvas | FitView on load; disable drag by default; show node list collapsed drawer |
| Health Charts | Replace full charts with sparkline summaries; tap to expand modal |
| Contacts Table | Convert to card list (key fields) under sm: breakpoint |
| Journal Split View | Stack: entries list accordion over detail panel |

## CSS / Utility Additions
Create a responsive helper file (future): `responsive.css` with utility classes if Tailwind defaults insufficient (avoid premature abstraction now).

## Audit Checklist (Phase 1)
- [ ] Add meta viewport tag (confirm present in index.html)
- [ ] Ensure no horizontal scroll on core pages at 360px
- [ ] Collapse EmailInboxPage columns behind tabs or segmented control
- [ ] Contacts table: add mobile card rendering path
- [ ] Workflow page: show read-only notice + hide minimap & logs at <640px
- [ ] Dashboard health widgets: compress padding, reduce font sizes below md

## Telemetry (Optional)
Add viewport width logging (bucketed) to understand mobile share (privacy respecting, no fingerprinting).

## Performance Considerations
- Lazy load heavy graph libraries only ≥ md breakpoint.
- Avoid large base64 inline images on initial mobile load.

## Incremental Plan
1. Implement Email inbox responsive segmented control.
2. Add mobile card variant for contacts & executions.
3. Add conditional rendering for workflow builder heavy panels.
4. Adjust spacing & text sizes for health dashboard.
5. Add knowledge hub fallback (list) on mobile.

## Future Enhancements
- Gesture navigation between primary tabs.
- Offline caching for email triage & tasks.

---
End of plan.
