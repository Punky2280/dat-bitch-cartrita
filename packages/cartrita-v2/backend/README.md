# Backend Service

This backend powers Cartrita's multi-agent system, workflow engine, model routing, persona management, audio pipeline, and supporting APIs.

## Dev Scripts

Standard:

- `npm run dev` – One-off build of the HuggingFace router (`build:router`) then start server.

Watch (hot reload):

- `npm run dev:watch` – Concurrent watch: TypeScript router build in watch mode + nodemon server restart.
  - `build:router:watch` – `tsc -p tsconfig.router.json --watch`
  - `serve:watch` – `nodemon --watch dist/router --watch src --ext js,json --delay 300ms index.js`

If you add new TypeScript router sources under `src/modelRouting/**/*.ts`, the watch pipeline rebuilds and restarts automatically.

## Environment / Test Utilities

Centralized in `src/util/env.js`:

- `isTestEnv()` – True when running under Vitest or NODE_ENV=test.
- `isLightweight()` – True for lightweight test runs (skips heavy subsystems) when `LIGHTWEIGHT_TEST=1`.
- `shouldQuietLogs()` – Returns true if logs should be suppressed (tests) unless `DEBUG_LOGS=1` or `WORKFLOW_DEBUG=1`.
- `quietConsole()` – Applies console no-op patches automatically in quiet mode.

Behavior:

- In tests, server `listen()` is skipped (index.js) to avoid port conflicts.
- Persona route returns a default persona when DB unavailable during lightweight tests.
- Workflow engine and other subsystems suppress verbose logs when `shouldQuietLogs()` is true. Enable full logging in tests by exporting `DEBUG_LOGS=1`.

## Logging Control

Verbose internal warnings (unimplemented workflow node handlers, execution traces) are gated and suppressed by default in test mode. To troubleshoot:

```
DEBUG_LOGS=1 npm test
# or for workflow details
WORKFLOW_DEBUG=1 npm test
```

Example enabling debug while running watch dev:

```
DEBUG_LOGS=1 WORKFLOW_DEBUG=1 npm run dev:watch
```

## Adding Workflow Node Handlers

Implement the handler method on `EnhancedWorkflowEngine` using the naming convention (e.g. `handleEmailNode`). The engine auto-registers; missing handlers fall back to a generic handler and (in non-quiet modes) log a warning.

## Model Routing

Endpoints under `/api/models/*` use a dynamic loader that builds/loads `dist/router/HuggingFaceRouterService.js` on demand. Use the watch dev script for rapid iteration.

## Persona Management

`/api/persona` supports GET/PUT with normalization (`PersonaMapperService`). In lightweight tests, DB failures are gracefully handled with an in-memory default persona.

## Audio Pipeline

Stub integration endpoints for upload, preprocess, transcribe, and TTS for test coverage and future expansion.

## Testing

Run full suite:

```
npm test
```

Lightweight (already default in CI) uses mocking/fallbacks for faster runs. Ensure new features respect `isLightweight()` where heavy initialization would slow tests.

## Contributing

- Add new agents dynamically (follow supervisor conventions) and avoid static imports in the supervisor.
- Wrap I/O heavy operations with tracing utilities where applicable.
- Keep migrations additive; do not modify historical SQL files.

---

This README focuses on recent additions: watch workflow, env utilities, logging control, and their interplay with tests.
