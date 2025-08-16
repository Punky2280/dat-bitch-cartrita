# AI Assistant Guardrails

Primary Goal: Maintain a unified project architecture & design system while implementing or refactoring features.

ALWAYS:

- Confirm the real path before modifying a file (list directory first if unsure).
- Ask clarifying questions when feature requirements are ambiguous or conflicting.
- Preserve existing exported APIs unless part of an approved refactor.
- Use provided color & design tokens; never hardcode hex colors outside tokens.
- Prefer updating `docs/PROJECT_NOTEBOOK.md` over creating new scattered docs.
- Re-read `docs/PROJECT_NOTEBOOK.md` at the start of a task and after every 3–5 edits/tool calls to stay aligned with current priorities.
- Log progress: append a short entry to `docs/PROJECT_NOTEBOOK.md` (Dev Log) after meaningful changes (features fixed/added, workflows, migrations, CI updates).
- When adding dependencies, justify necessity and compare lighter alternatives.
- Generate tests (unit or smoke) for new endpoints, and add corresponding curl examples to `docs/SMOKE_TESTS.md`.
- Use idempotent scripts for cleanup and migrations.

NEVER:

- Invent endpoints or environment variables—propose, then await confirmation if uncertain.
- Duplicate config files—merge differences instead.
- Commit secrets, keys, tokens, or raw credentials.

SELF-CHECK LOOP (before finalizing a change):

1. Does this change align with architecture and theme tokens?
2. Are there redundant or newly orphaned files?
3. Are docs updated (PROJECT_NOTEBOOK.md + CHANGELOG if needed)?
4. Are minimal smoke tests in place or updated?
5. Is there a rollback path?
6. Did you re-read the Project Notebook recently, and add a Dev Log entry for this change?

If any answer is “No”, prompt the developer before proceeding.

---

Monorepo Layout Notes

- Backend: `packages/backend`
- Frontend: `packages/frontend`
- Theme tokens live under `packages/frontend/src/theme/`. Do not introduce raw hex in components; use tokens or CSS variables exposed by ThemeProvider.
- Smoke scripts live under `scripts/smoke` and `scripts/unified`; CI-friendly runner under `scripts/smoke/run_all.sh`.

---

Progress Discipline (for agents and contributors)

- At task start: skim `docs/PROJECT_NOTEBOOK.md` to refresh context; note any in-progress priorities.
- During work: after each batch of 3–5 edits or a major step, re-read the notebook and adjust course if needed.
- After changes: add a Dev Log bullet list with date, scope, and verification notes (build/tests/linters status).
- Keep entries concise; prefer bullets over prose. Example template:
	- Date — Area(s) changed
	- Actions: short bullets
	- Verification: Build PASS/FAIL, Tests PASS/FAIL, Notes
