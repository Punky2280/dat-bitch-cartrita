# Jest 29 -> 30 Upgrade Log

Date: 2025-08-10
Stage: 2 (after Zod 4)
Status: Completed (suite green) — temporary retention of `--experimental-vm-modules`.

## Scope
Backend test infrastructure only (`packages/backend`).

## Final Changes Applied
- Upgraded `jest` to `^30.0.5` and `@types/jest` to `^30.0.0`.
- Consolidated to single `jest.config.js`; removed obsolete `jest.config.mjs`.
- Added `rawSchemas` map in `AgentToolRegistry` enabling Zod schema regression tests (DynamicTool wrapper returns `undefined` for parsed result, so raw schema preserved).
- Restored `getCurrentDateTime` schema to enum with default and adjusted tests.
- Added `test:pure` script (no flag) and kept main `test` script with `NODE_OPTIONS=--experimental-vm-modules` due to persistent ESM import error without it.

## Validation Results
| Check | Result |
|-------|--------|
| Full suite (`npm test`) | PASS (3 suites / 6 tests) |
| Zod regression test | PASS |
| Pure run (`npm run test:pure`) | FAIL (ESM import error) |
| Duplicate config removal | DONE |
| Unexpected warnings | None critical |

## ESM Issue Summary
Running without the experimental VM modules flag triggers `SyntaxError: Cannot use import statement outside a module` on test files, despite repo `"type": "module"`. Rather than introduce Babel/ts-jest overhead now, we retain the minimal legacy flag to unblock subsequent upgrade stages.

## Next Optimization Steps (Deferred)
1. Attempt pure ESM by adding a minimal Babel config (`babel-jest`) limited to `test/**`.
2. Try renaming tests to `.mjs` and confirm Jest 30 intrinsic ESM handling (ensure config aligns; avoid deprecated `extensionsToTreatAsEsm`).
3. Explore adding a `transform` using `@swc/jest` for faster ESM if Babel adds latency.
4. Once pure mode passes, drop the flag and delete the `test:pure` script (or repurpose it).

## Rollback Procedure
1. Revert dependency versions in `package.json`.
2. If needed, restore prior test script (already effectively present via flag).
3. Re-run `npm install` and `npm test`.

## Rationale for rawSchemas Addition
`DynamicTool` encapsulation prevented direct Zod parse result (returned `undefined`). Storing original schemas allows stable regression tests across future LangChain or Zod changes without relying on internal tool behavior.

## Artifacts / Logs (Ephemeral)
JSON reports (`jest-full.json`, `jest-esm-attempt.json`) were produced during upgrade; not committed.

## Conclusion
Upgrade complete with full green status under flagged execution. Deferred work focuses on eliminating the experimental flag for cleaner Node 20+ ESM compliance.
