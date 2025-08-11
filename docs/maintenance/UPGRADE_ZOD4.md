# Zod 3 -> 4 Migration Plan

Status: Draft
Target Stage: Stage 1 of Major Upgrade Sequence

## Scope
Current usage limited to backend orchestration & supervisor registry:
- `packages/backend/src/agi/orchestration/AgentToolRegistry.js`
- `packages/backend/src/agi/orchestration/EnhancedLangChainToolRegistry.js`
- `packages/backend/src/agi/orchestration/FullyFunctionalToolRegistry.js`
- `packages/backend/src/system/SupervisorRegistry.js`

Usage patterns:
- `z.object({...})` for tool input schemas
- Optional string enums (simple strings, not `z.enum` currently)
- `z.array(z.any())`, `z.string().optional()` patterns in SupervisorState
- No advanced features: no `zodResolver`, no custom errors, no union discriminators, no schema merging.

## Breaking Change Review (High-Level)
Consult official changelog before execution (placeholder; fill with specifics once reviewed):
1. Potential renames or stricter typing on `z.any()` vs `z.unknown()`.
2. Changes to default error formatting (adjust tests if snapshotting errors).
3. Possible stricter inference around `.optional()` chains.
4. ESM/CJS packaging adjustments (ensure no require() usages).

## Migration Steps
1. Create feature branch `upgrade/zod4`.
2. Bump dependency in `packages/backend/package.json` to `"zod": "^4.0.0"`.
3. Run `npm install` (root) to update lockfile.
4. Type check & run tests.
5. Replace any `z.any()` with `z.unknown()` if compiler warns or changelog advises.
6. Verify tool registry dynamic schema generation still works (initialize registry in a smoke script with DB_SKIP=1).
7. Validate SupervisorRegistry state shape: ensure no runtime validation errors when constructing state graph.
8. Add temporary test asserting a simple schema parse success (quick regression guard).
9. Update this document with concrete changelog diffs encountered (Under "Observed Changes").
10. Open PR referencing this file & include risk notes.

## Validation Checklist
- [ ] `npm test` passes (backend)
- [ ] Server starts with `NODE_ENV=test DB_SKIP=1 node packages/backend/index.js` without Zod-related errors
- [ ] Tool registry initialization logs success (sample: AgentToolRegistry, EnhancedLangChainToolRegistry)
- [ ] SupervisorRegistry builds coordination graph without schema issues
- [ ] No new runtime warnings about deprecated Zod APIs

## Rollback Procedure
If failures occur:
1. Revert package.json version bump.
2. Restore lockfile from pre-upgrade tag (e.g., `git checkout pre-zod4 -- package-lock.json`).
3. Remove any code modifications (schema replacements) via git revert.
4. Re-run tests to confirm stability.

## Observed Changes (Fill During Execution)
| Area | Before | After | Action |
|------|--------|-------|--------|
| Error formatting | default Zod3 messages | unchanged | none |
| any() vs unknown() | using z.any() | z.any() still accepted | none (monitor changelog) |
| Optional chaining | .optional() semantics | unchanged | none |

### Execution Notes
- Registry smoke script succeeded: all tool registries initialized; supervisor status retrieved.
- Regression test passed (valid empty input accepted, invalid format rejected).
- No deprecation warnings observed in console output during smoke/test runs.

## Post-Migration Actions
- Remove temporary regression test if redundant.
- Tag commit `post-zod4`.
- Proceed to Stage 2 (Jest 30) after 24h soak if no errors.

## Notes
Keep migration atomic—do not bundle with other upgrades. Avoid modifying tool schemas semantically; only adapt types to satisfy compiler/runtime.
