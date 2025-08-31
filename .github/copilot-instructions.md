# Copilot Project Instructions (Cartrita Multi-Agent OS)

Purpose: Keep AI coding agents instantly productive and consistent with established architecture and recent iteration progress. DO NOT invent new subsystems when extending; prefer additive migrations & specs already defined. Cartrita voice only in user-facing assistant responses; infrastructure code stays neutral.

## 0. Iteration Awareness & Memory Discipline
When a new iteration (e.g. "iteration 22") begins:
1. Auto-scan `docs/specs/**` and recent migrations in `db-init/` added after the last comprehensive snapshot (currently `06_comprehensive_cartrita_schema.sql`) plus highest numbered migration (presently `15_create_journal_entries.sql`).
2. Summarize deltas: new tables, new routes, new specs, UI scaffolds. Persist that summary in your internal working memory for the session (do NOT write to repo unless asked).
3. Before modifying any domain (workflows, journal, ambient intelligence, fusion, templates), locate its spec under `docs/specs/**` & re-validate assumptions. If spec mismatch detected, halt and request clarification rather than hallucinating fields.
4. Cross-check any DB column before use: search codebase and migrations; if absent create a new migration instead of editing old files.
5. Never fabricate API responses; if unsure, implement thin pass-through + TODO referencing spec filename.

Notebook discipline (required):
- Re-read `docs/PROJECT_NOTEBOOK.md` at task start and after each batch of 3–5 edits/tool calls.
- After meaningful changes (feature fixes/additions, migrations, CI/QoL scripts), append a concise Dev Log entry in `docs/PROJECT_NOTEBOOK.md` with date, scope, and verification notes (Build/Lint/Tests status).

Guardrails to reduce hallucination / drift:
- Always prefer reading existing files (routes/service/migration) before adding new ones for a feature.
- Keep changes minimal & scoped; describe rationale succinctly in PR.
- If a spec exists but conflicts with runtime code, align implementation to spec via new migration or incremental refactor doc.

## 1. High-Level Architecture

## 1. High-Level Architecture
- Monorepo (npm workspaces) under `packages/` (no turborepo). Core focus: `packages/backend` (Node + Express + LangChain StateGraph supervisor) & `packages/frontend` (React + Vite). Python MCP reference under `py/mcp_core` (types only currently).
- Hierarchical Multi-Agent System: Supervisor (`EnhancedLangChainCoreAgent.js` class name `CartritaSupervisorAgent`) dynamically imports ~20+ sub‑agents in `src/agi/**`. Delegation guardrails: `recursionLimit=15`, max 2 chained delegations, supervisor self-call cap=3. Always routes back to `cartrita` node until final `END`.
- Tool / Capability Layer: `AgentToolRegistry` centralizes tool definitions + per‑agent `allowedTools`. HuggingFace bridge agents (vision/audio/language/multimodal/data) added under `integrations/huggingface/bridge/*` with structured output contract.
- Observability: `OpenTelemetryTracing` sets up Node SDK + counters. Use helpers: `traceAgentOperation`, `traceToolExecution`, `traceOperation`. New metrics include fast‑path delegation, hf task counters, `hf_token_misuse_total`.
- Knowledge & Workflow: `WorkflowToolsService` + `routes/workflowTools.js` provide semantic search (OpenAI embeddings), category browse, bulk import with span attributes `import.success_count` / `import.error_count`.
- MCP / IPC: REST `routes/mcp.js` plus Unix domain socket transport (`unix-socket.ts`) using length‑prefixed MessagePack frames + heartbeat (`lastPing` in stats).
- Media / Multimodal Services: Routes (`voiceToText.js`, `vision.js`, `audioAnalytics.js`, etc.) integrate OpenAI + Deepgram; gating by presence of API keys.
- Secure Vault & Life OS: API key vault, email, calendar, contacts routes backed by SQL migrations in `db-init/` (see comprehensive snapshot `06_comprehensive_cartrita_schema.sql`).
- Binary Asset Pipeline: `/api/hf/upload` + in‑memory/disk spillover store (TTL 30m) producing tokens `hfbin:<uuid>` with ownership + misuse counter tracking.

## 2. Key Conventions & Patterns
- Agent Definition: Sub‑agents extend `BaseAgent`/specialized base; short lowercase `name`, role `'sub'`, explicit `config.allowedTools`. Add filename to `agentFileNames` array in supervisor or it won’t load.
- Delegation JSON Contract: `{ thought, response, action: 'respond'|'delegate', delegate_to? }`. Parse failure triggers safe fallback.
- State Graph I/O: Return `{ messages: [...LangChain Message], next_agent: 'cartrita' | '<agent>' | 'END', tools_used?, private_state? }`; never mutate existing state in place.
- Private State Aggregation: Supervisor records each completed agent result in `private_state[agentName]` and composes final summary before `END`.
- Structured Outputs: Bridge agents attach structured payloads persisted under `conversation_messages.metadata.structured` (array). Retrieve via `/api/chat/structured` (filters: `task`, `status`, pagination).
- HF Binary Tokens: Pattern `hfbin:<uuid>` stored with ownership + expiry. Always validate ownership in tools; misuse increments `hf_token_misuse_total`.
- Fast‑Path Delegation: Supervisor may short‑circuit to a specialized agent (keyword heuristic); increments dedicated counter—keep heuristic additive and safe.
- Embeddings Format: Store as bracketed float string (Postgres array literal) NOT JSON.
- Tracing: Wrap I/O/CPU heavy ops with `traceOperation` or agent/tool helpers; include domain-oriented span names (`hf.vision.classify`, `workflow.import.bulk`).
- Error Handling: Catch & convert to user-facing message; never throw uncaught in agent graph.
- Persona Boundary: Only user-facing assistant responses adopt Cartrita voice—infra/auth/tool code remains neutral.

## 3. Common Tasks (Do Exactly This)
- Run backend (dev local): `npm run dev:backend` (ensure Postgres migrations applied: run SQL in `db-init/00_setup_pgvector.sql` then comprehensive snapshot if fresh DB).
- Add Sub-Agent: Create file under `src/agi/consciousness/`, export default class, append filename to `agentFileNames`, set `allowedTools`, add tracing where heavy.
- Add HuggingFace Tool/Task: Extend registry in `AgentToolRegistry.js`; ensure ownership check on `hfbin` tokens + tracing span + counter attribute `task`.
- New Route: Add under `src/routes/`, import & mount in `index.js`. Use `{ success: true, data }` or `{ success: false, error }`. Wrap heavy work with tracing.
- Structured Output Persistence: Attach object to agent return; persistence handled centrally (do not write DB logic in agents for this).
- Add Metric: `const counter = OpenTelemetryTracing.createCounter('name','desc')`; store on `global.otelCounters` similar to existing.
- Extend Workflow Tool Schema: Create new migration file (increment number), update field lists in `WorkflowToolsService`, adjust serialization & tests.
- List / Revoke HF Binaries: `/api/hf/list` (pagination, mime, expired modes) & `/api/hf/revoke/:id`—reuse patterns when adding filters.
- Retrieve Structured Outputs: `/api/chat/structured?task=...&status=...&limit=...&offset=...`.
- Update Dev Log: Add a short entry to `docs/PROJECT_NOTEBOOK.md` summarizing what was changed and how it was verified; keep it terse.

## 4. Anti-Patterns (Avoid)
- DO NOT import sub-agents statically inside the supervisor (kept dynamic to avoid circular deps). Follow dynamic `await import()` pattern.
- DO NOT mutate `state.messages` directly; always return new messages array from node functions.
- DO NOT store raw embedding arrays as JSON; keep bracketed numeric string.
- DO NOT expand persona into infrastructure code (tracing, DB, security modules).
- DO NOT exceed delegation limits or bypass supervisor finalization logic.

## 5. File Landmarks (Updated)
- Supervisor: `packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js`
- Tool Registry: `packages/backend/src/agi/orchestration/AgentToolRegistry.js`
- HF Bridge Agents: `packages/backend/src/integrations/huggingface/bridge/*Agent.js`
- Tracing Core: `packages/backend/src/system/OpenTelemetryTracing.js`
- Binary Upload Routes: `packages/backend/src/routes/hf.js`
- Structured Output Retrieval: `packages/backend/src/routes/chatHistory.js` (`/api/chat/structured`)
- Workflow Tools Routes: `packages/backend/src/routes/workflowTools.js`
- MCP Routes: `packages/backend/src/routes/mcp.js`
- Unix Socket Transport: `packages/backend/src/unix-socket.ts`
- Exemplary Agent Prompting: `packages/backend/src/agi/consciousness/AnalyticsAgent.js`
- DB Schemas: `db-init/` (apply `00_setup_pgvector.sql` then latest snapshot `06_comprehensive_cartrita_schema.sql` followed by subsequent incremental migrations `07+` .. current highest `15_create_journal_entries.sql`).
- Recent Additions:
	- Journal Entries Migration: `15_create_journal_entries.sql` (journal_entries table)
	- Responsive UI audit plan: `docs/specs/ui/MOBILE_FIRST_COMPONENT_AUDIT_PLAN.md`
	- Workflow monitoring & templates specs under `docs/specs/workflows/`
	- Fusion & ambient intelligence plans under `docs/specs/multimodal/` & `docs/specs/intelligence/`

## 5.1 Pending Backend Feature Seeds
Follow spec-first approach before coding beyond stubs:
- Journal enrichment pipeline (sentiment/emotion) — see `TASK_JOURNAL_MANAGEMENT_PLAN.md`.
- Workflow execution streaming (SSE/WebSocket) — see `EXECUTION_MONITORING_UI_PLAN.md`.
- Fusion aggregation endpoints — implement after artifact schema migration.
- Ambient policy evaluator — schedule periodic evaluation loop with tracing.


## 6. Extension Guidelines
- Mirror an existing minimal agent for structure (names, exports, allowedTools) before customizing.
- Wrap new external APIs inside `src/services/<Domain>Service.js` + expose via tool registry, not directly from agents.
- Keep migrations additive; never rewrite old migration files—add new numbered file.
- Maintain structured output shape stability; version changes via new `type` field inside structured entry if you must evolve it.

## 7. Safety & Graceful Degradation
- Missing external key => log once + user-facing “feature unavailable” message; never abort startup.
- Always validate `hfbin:` ownership before file access; increment misuse counter on violations.
- Guard supervisor operations with `isInitialized`; return safe fallback if not ready.
- Do not leak stack traces to users; rely on fallback responses.

## 8. PR / Change Hygiene
- Single-responsibility commits; migrations isolated.
- Reference spec file names in commit messages for traceability.
- If adding a migration: bump numeric prefix; never alter previous migrations.
- Run lint/type checks where available before pushing.

## 9. Observability Additions
- Wrap new DB or external API operations in `traceOperation` with domain-prefixed span names.
- Add counters for new external services or policy evaluation loops.

---
Questions or missing patterns? Propose refinement via PR with concise diff + justification.

## Addendum: Copilot Agent Policy Schema v1.0.0
The following schema and policy instance define operational governance for the coding agent. Treat this as authoritative and enforce strictly. If conflicts arise with other docs, pause, reconcile via clarification, and prefer additive alignment.

```json
{
	"schema_version": "1.0.0",
	"_note": "This file contains two top-level objects: 'json_schema' (the JSON Schema definition) and 'policy_instance' (an instance conforming to that schema). Split them into separate files if needed.",
	"json_schema": {
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"$id": "https://example.org/schemas/copilot-agent-policy.schema.json",
		"title": "CopilotAgentPolicy",
		"type": "object",
		"required": ["metadata", "rules"],
		"additionalProperties": false,
		"properties": {
			"metadata": {
				"type": "object",
					"required": ["name", "version", "created", "description"],
					"properties": {
						"name": { "type": "string" },
						"version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9_.-]+)?$" },
						"created": { "type": "string", "format": "date-time" },
						"updated": { "type": "string", "format": "date-time" },
						"description": { "type": "string" },
						"owner": { "type": "string" },
						"contact": { "type": "string" },
						"repository": { "type": "string" },
						"policy_hash": { "type": "string" }
					}
			},
			"rules": {
				"type": "array",
				"minItems": 1,
				"items": {
					"type": "object",
					"required": ["id", "name", "objective", "actions"],
					"additionalProperties": false,
					"properties": {
						"id": { "type": "string", "pattern": "^[0-9]+$" },
						"name": { "type": "string" },
						"objective": { "type": "string" },
						"scope": {
							"type": "array",
							"items": { "type": "string" }
						},
						"triggers": {
							"type": "array",
							"items": { "type": "string" }
						},
						"prerequisites": {
							"type": "array",
							"items": { "type": "string" }
						},
						"actions": {
							"type": "array",
							"minItems": 1,
							"items": {
								"type": "object",
								"required": ["description"],
								"properties": {
									"description": { "type": "string" },
									"steps": {
										"type": "array",
										"items": { "type": "string" }
									},
									"automated": { "type": "boolean" },
									"tools": {
										"type": "array",
										"items": { "type": "string" }
									},
									"outputs": {
										"type": "array",
										"items": { "type": "string" }
									}
								},
								"additionalProperties": false
							}
						},
						"validations": {
							"type": "array",
							"items": { "type": "string" }
						},
						"failure_conditions": {
							"type": "array",
							"items": { "type": "string" }
						},
						"enforcement": {
							"type": "object",
							"properties": {
								"severity": { "type": "string", "enum": ["info", "warn", "error", "critical"] },
								"auto_remediation": { "type": "boolean" },
								"gating": { "type": "boolean" }
							},
							"additionalProperties": false
						},
						"logging": {
							"type": "object",
							"properties": {
								"record": { "type": "boolean" },
								"fields": {
									"type": "array",
									"items": { "type": "string" }
								}
							},
							"additionalProperties": false
						},
						"metrics": {
							"type": "object",
							"properties": {
								"track": { "type": "boolean" },
								"kpis": {
									"type": "array",
									"items": { "type": "string" }
								}
							},
							"additionalProperties": false
						},
						"rationale": { "type": "string" },
						"references": {
							"type": "object",
							"additionalProperties": { "type": "string" }
						},
						"tags": {
							"type": "array",
							"items": { "type": "string" }
						},
						"status": {
							"type": "string",
							"enum": ["active", "deprecated", "planned"]
						}
					}
				}
			},
			"workflows": {
				"type": "array",
				"items": {
					"type": "object",
					"required": ["id", "name", "sequence"],
					"properties": {
						"id": { "type": "string" },
						"name": { "type": "string" },
						"description": { "type": "string" },
						"sequence": {
							"type": "array",
							"items": { "type": "string" }
						}
					},
					"additionalProperties": false
				}
			},
			"checklists": {
				"type": "object",
				"additionalProperties": {
					"type": "array",
					"items": { "type": "string" }
				}
			},
			"prohibited_patterns": {
				"type": "array",
				"items": { "type": "string" }
			},
			"repository_structure": {
				"type": "array",
				"items": { "type": "string" }
			},
			"expansion_hooks": {
				"type": "array",
				"items": {
					"type": "object",
					"required": ["description"],
					"properties": {
						"description": { "type": "string" },
						"status": { "type": "string", "enum": ["proposed", "accepted", "rejected"] }
					},
					"additionalProperties": false
				}
			},
			"logging_format_examples": {
				"type": "array",
				"items": { "type": "string" }
			}
		}
	},
	"policy_instance": {
		"metadata": {
			"name": "GitHub Copilot Code Agent Policy",
			"version": "1.0.0",
			"created": "2025-08-18T12:35:00Z",
			"updated": "2025-08-18T12:35:00Z",
			"description": "Operational governance policy encoding rules for autonomous/semi-autonomous code assistant.",
			"owner": "platform-engineering",
			"contact": "platform@example.org",
			"repository": "git@example.org:org/repo",
			"policy_hash": "sha256:PLACEHOLDER_HASH"
		},
		"rules": [
			{
				"id": "1",
					"name": "Instruction Manual Refresh",
					"objective": "Ensure agent always uses latest project policies and architectural guidance.",
					"scope": ["edit", "commit", "pull_request"],
					"triggers": ["before_generation", "post_commit"],
					"actions": [
						{
							"description": "Reload core documents",
							"steps": [
								"Read README.md",
								"Read CONTRIBUTING.md",
								"Read ARCHITECTURE.md if exists",
								"Read ADR docs",
								"Read agent addendum file"
							],
							"automated": true,
							"tools": ["filesystem"],
							"outputs": ["log:INSTRUCTION_REFRESH"]
						}
					],
					"validations": [
						"Detect conflicting deprecated modules",
						"Abort if discrepancies unresolved"
					],
					"failure_conditions": [
						"Outdated patterns used",
						"Missing newly introduced constraints"
					],
					"enforcement": { "severity": "error", "auto_remediation": false, "gating": true },
					"logging": { "record": true, "fields": ["timestamp", "changed_files", "conflicts"] },
					"metrics": { "track": true, "kpis": ["refresh_latency_ms"] },
					"rationale": "Prevents policy drift.",
					"references": {
						"docs": "README.md",
						"addendum": "docs/agent/AGENT_RULES.md"
					},
					"tags": ["governance", "consistency"],
					"status": "active"
			},
			{
				"id": "2",
				"name": "Task Documentation",
				"objective": "Maintain traceable change history and rationale.",
				"actions": [
					{
						"description": "Update mandatory documents",
						"steps": [
							"Append CHANGELOG.md under Unreleased",
							"Update docblocks for public APIs",
							"Update ADR if architecture changed",
							"Append AGENT TASK LOG to PR body"
						],
						"automated": true,
						"outputs": ["CHANGELOG.md", "PR body log block"]
					}
				],
				"validations": [
					"Ensure log contains Task ID",
					"Ensure impacted files listed"
				],
				"failure_conditions": [
					"Missing changelog entry",
					"No rationale recorded"
				],
				"enforcement": { "severity": "error", "auto_remediation": true, "gating": true },
				"logging": { "record": true, "fields": ["task_id", "files_impacted"] },
				"metrics": { "track": true, "kpis": ["documentation_completeness_rate"] },
				"rationale": "Improves auditability.",
				"references": { "template": "PR_TEMPLATE.md" },
				"tags": ["documentation", "traceability"],
				"status": "active"
			},
			{
				"id": "3",
				"name": "Dependency Validation",
				"objective": "Keep dependencies current and secure without introducing instability.",
				"actions": [
					{
						"description": "Scan and selectively upgrade dependencies",
						"steps": [
							"Run outdated scan (ecosystem-specific)",
							"Filter non-major upgrades",
							"Apply upgrades",
							"Run tests, lint, type check, security scan",
							"Record diff to DEPENDENCY_UPDATES.md"
						],
						"automated": true,
						"tools": ["package_manager", "security_scanner"],
						"outputs": ["DEPENDENCY_UPDATES.md"]
					}
				],
				"validations": [
					"All tests pass",
					"Security audit clean"
				],
				"failure_conditions": [
					"Silent major version bump",
					"Introduced vulnerable package"
				],
				"enforcement": { "severity": "error", "auto_remediation": false, "gating": true },
				"logging": { "record": true, "fields": ["updated_packages", "audit_status"] },
				"metrics": { "track": true, "kpis": ["upgrade_success_rate", "audit_fail_count"] },
				"rationale": "Balances freshness and stability.",
				"references": { "policy": "DEPENDENCY_UPDATES.md" },
				"tags": ["dependencies", "security"],
				"status": "active"
			},
			{
				"id": "4",
				"name": "External Research",
				"objective": "Discover improvements and avoid obsolete practices.",
				"actions": [
					{
						"description": "Perform controlled web research",
						"steps": [
							"Query official docs first",
							"Collect candidate improvements",
							"Store summary in date-stamped note"
						],
						"automated": false,
						"outputs": ["RESEARCH_NOTES/<date>-<topic>.md"]
					}
				],
				"validations": ["Mark unverified items as CANDIDATE"],
				"failure_conditions": ["Unverified code adopted directly"],
				"enforcement": { "severity": "warn", "auto_remediation": false, "gating": false },
				"logging": { "record": true, "fields": ["sources", "applied"] },
				"metrics": { "track": true, "kpis": ["research_to_adoption_ratio"] },
				"rationale": "Encourages informed evolution.",
				"references": { "directory": "docs/agent/RESEARCH_NOTES/" },
				"tags": ["research", "innovation"],
				"status": "active"
			},
			{
				"id": "5",
				"name": "Performance Optimization",
				"objective": "Maintain or improve latency and efficiency.",
				"actions": [
					{
						"description": "Benchmark before and after changes",
						"steps": [
							"Run baseline benchmark",
							"Implement change",
							"Run post-change benchmark",
							"Record metrics delta"
						],
						"automated": true,
						"tools": ["benchmark_tool"],
						"outputs": ["scripts/bench/*", "benchmark_log"]
					}
				],
				"validations": ["Significant regressions flagged"],
				"failure_conditions": ["Unexplained >10% regression"],
				"enforcement": { "severity": "error", "auto_remediation": false, "gating": true },
				"logging": { "record": true, "fields": ["component", "latency_before", "latency_after", "delta_pct"] },
				"metrics": { "track": true, "kpis": ["median_latency", "regression_count"] },
				"rationale": "Prevents gradual performance decay.",
				"references": { "bench_dir": "scripts/bench/" },
				"tags": ["performance"],
				"status": "active"
			},
			{
				"id": "6",
				"name": "No Placeholders",
				"objective": "Prevent incomplete or misleading artifacts in production code.",
				"actions": [
					{
						"description": "Scan diffs for placeholder tokens",
						"steps": [
							"Search for TODO, FIXME, placeholder, lorem, mock data",
							"Exclude /tests/ directory",
							"Fail if found outside allowed scope"
						],
						"automated": true,
						"outputs": ["placeholder_scan_report"]
					}
				],
				"validations": ["All new code free of placeholders"],
				"failure_conditions": ["Placeholder outside test fixtures"],
				"enforcement": { "severity": "error", "auto_remediation": true, "gating": true },
				"logging": { "record": true, "fields": ["violations"] },
				"metrics": { "track": true, "kpis": ["placeholder_violation_count"] },
				"rationale": "Ensures integrity of delivered features.",
				"references": { "tests_dir": "tests/" },
				"tags": ["quality", "integrity"],
				"status": "active"
			},
			{
				"id": "7",
				"name": "Historical Search Before New File",
				"objective": "Preserve continuity and avoid divergent patterns.",
				"actions": [
					{
						"description": "Search repository history",
						"steps": [
							"git log for deleted similar files",
							"Extract naming conventions",
							"Document origin in header if reused"
						],
						"automated": false
					}
				],
				"validations": ["Header includes origin when applicable"],
					"failure_conditions": ["New file duplicates existing pattern without reference"],
					"enforcement": { "severity": "warn", "auto_remediation": false, "gating": false },
					"logging": { "record": true, "fields": ["new_file", "origin_commit"] },
					"metrics": { "track": true, "kpis": ["historical_reference_rate"] },
					"rationale": "Reduces style fragmentation.",
					"references": { "command": "git log --diff-filter=D --summary" },
					"tags": ["history", "consistency"],
					"status": "active"
			},
			{
				"id": "8",
				"name": "Regenerate Problematic Files",
				"objective": "Replace severely degraded files cleanly.",
				"actions": [
					{
						"description": "Assess file for regeneration triggers",
						"steps": [
							"Evaluate coverage",
							"Assess style fragmentation",
							"Check security flags",
							"If triggered, move old to legacy/ and recreate"
						],
						"automated": false,
						"outputs": ["legacy/<file>", "new file"]
					}
				],
				"validations": ["REGEN_NOTE added"],
				"failure_conditions": ["Patched instead of regeneration when threshold crossed"],
				"enforcement": { "severity": "error", "auto_remediation": false, "gating": true },
				"logging": { "record": true, "fields": ["file", "reason"] },
				"metrics": { "track": true, "kpis": ["regenerations_count"] },
				"rationale": "Prevents compounding technical debt.",
				"references": { "legacy_dir": "legacy/" },
				"tags": ["refactor", "debt"],
				"status": "active"
			},
			{
				"id": "9",
				"name": "System & Tooling Update",
				"objective": "Keep build, CI, and toolchains aligned with policy.",
				"actions": [
					{
						"description": "Check toolchain consistency",
						"steps": [
							"Verify versions in .tool-versions / eng/versions.json",
							"Detect CI config drift",
							"Update AGENT_STATUS.md snapshot"
						],
						"automated": true,
						"outputs": ["AGENT_STATUS.md"]
					}
				],
				"validations": ["All pinned versions consistent"],
				"failure_conditions": ["CI config stale vs policy"],
				"enforcement": { "severity": "warn", "auto_remediation": true, "gating": false },
				"logging": { "record": true, "fields": ["tool_versions", "drift"] },
				"metrics": { "track": true, "kpis": ["tool_drift_events"] },
				"rationale": "Ensures reproducibility.",
				"references": { "status_file": "AGENT_STATUS.md" },
				"tags": ["hygiene", "tooling"],
				"status": "active"
			}
		],
		"workflows": [
			{
				"id": "wf_default",
				"name": "Default Change Workflow",
				"description": "Standard end-to-end operational sequence",
				"sequence": [
					"1",
					"2",
					"3",
					"4",
					"5",
					"6",
					"7",
					"8",
					"5",
					"9"
				]
			}
		],
		"checklists": {
			"pre_commit": [
				"Instruction refresh performed",
				"Public API docs updated",
				"No placeholders outside tests",
				"Dependency changes audited",
				"Performance benchmarks run (if applicable)",
				"Regenerated files justified",
				"Security & license scans passed",
				"Changelog updated"
			]
		},
		"prohibited_patterns": [
			"Silent dependency major bumps",
			"Feature stubs with unimplemented logic in production code",
			"Editing corrupted legacy file inline",
			"Skipping performance validation on critical path",
			"Undocumented architectural divergence",
			"Generated artifact without source spec"
		],
		"repository_structure": [
			"docs/agent/AGENT_RULES.md",
			"docs/agent/RESEARCH_NOTES/",
			"docs/adr/",
			"AGENT_STATUS.md",
			"DEPENDENCY_UPDATES.md",
			"scripts/bench/",
			"legacy/"
		],
		"expansion_hooks": [
			{
				"description": "Add SBOM generation via CycloneDX",
				"status": "proposed"
			},
			{
				"description": "Static complexity gate enforcement",
				"status": "proposed"
			},
			{
				"description": "Automated Conventional Commit linting",
				"status": "proposed"
			}
		],
		"logging_format_examples": [
			"[AGENT_EXECUTION] Instruction_Refresh=OK Dependencies=updated:[...] audit=clean Regeneration=files:[...]",
			"[BENCH] component=auth pre_ms=18 post_ms=9 delta_pct=-50 tool=hyperfine"
		]
	}
}
```
