# Hugging Face Model Routing Subsystem

This subsystem provides dynamic model selection ("routing") across a curated Hugging Face catalog for multiple task types:

Tasks supported:
- `text-generation` (generic inference)
- `embedding`
- `rerank`
- `translation`

## 1. Catalog

Source: `hfModelCatalog.json` (100 curated entries). Core fields:

| Field | Description |
|-------|-------------|
| `repo_id` | Hugging Face repository identifier (org/model). |
| `category` | High‑level size / capability tier (e.g. small, medium, instruct, reranker). |
| `approx_params` | Approximate parameter count (for cost heuristics). |
| `primary_tasks` | Array of primary task types the model is suited for. |
| `serverless_candidate` | Hint whether HF Inference Serverless likely supports it. |
| `requires_endpoint` | True if a custom hosted endpoint is normally required. |
| `notes` | Misc free‑form guidance. |

The router shortlists only catalog entries compatible with the requested task and then scores them.

## 2. Scoring & Shortlisting

Composite score (normalized to ~0..1):

```
composite = 0.40 * qualityPrior
          + 0.25 * latencyScore   // EWMA inverse latency (recent probes)
          + 0.20 * costScore      // Favor lower param counts when close in quality
          + 0.15 * reliabilityScore // Success rate from recent attempts
```

Heuristics:
- `qualityPrior` seeded from category + task fit.
- `latencyScore` updated via lightweight probe calls (`/models/{id}` minimal payload) when enabled.
- `costScore` down‑weights extremely large models unless needed.
- `reliabilityScore` decays on errors / timeouts.

Shortlisting keeps the top N (default 6) before probing & fallbacks.

## 3. Probing & Fallbacks

The router attempts inference with the highest composite score first. On failure (timeout / HTTP >=500 / structured invalid), it:
1. Records an error + increments `hfRoutingFallbacks`.
2. Penalizes reliability for that model.
3. Tries the next candidate until one succeeds or list exhausted.

If all candidates fail, an error object is returned with aggregated failure reasons (no throw leak).

## 4. Confidence Heuristic

Returned as `confidence` (0..1):
- Text generation: based on output length diversity (unique tokens / total + length normalization). Very short / repetitive => lower.
- Embedding / rerank / translation: currently high constant (0.9) unless an error fallback triggered (then reduced slightly).

Intended for UI hinting / downstream ensemble logic—not a calibrated probability.

## 5. API Endpoints

Mounted under `/api/models`:

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/api/models/catalog` | — | Return raw catalog array. |
| POST | `/api/models/classify` | `{ prompt }` | Returns task classification + suggested task. |
| POST | `/api/models/route` | `{ prompt, taskHint?, maxCandidates?, temperature? }` | Executes routing + inference (text) or task‑specific op. |

Response (route success) example:
```json
{
  "success": true,
  "data": {
    "model_id": "mistralai/Mistral-7B-Instruct-v0.2",
    "task": "text-generation",
    "output": "...",
    "confidence": 0.83,
    "attempts": [
      { "model": "mistralai/Mistral-7B-Instruct-v0.2", "status": "ok", "score": 0.912 }
    ],
    "meta": { "compositeScore": 0.912 }
  }
}
```

On failures:
```json
{
  "success": false,
  "error": "All candidates failed",
  "failures": [ { "model": "...", "reason": "timeout" } ]
}
```

## 6. Agent Tools

Registered in `AgentToolRegistry.js` (allowed to relevant agents):
- `hf_route_inference` – generic text generation via router.
- `hf_embed` – embedding task through routing.
- `hf_rerank` – reranking of document snippets.
- `hf_translate` – translation task.

Tools invoke the same service singleton ensuring shared EWMA latency / reliability state.

## 7. CLI

Script: `scripts/hf-route-cli.js`

Usage (inline prompt):
```
node scripts/hf-route-cli.js --prompt "Explain retrieval augmented generation." --task text-generation --json
```

Or from file:
```
node scripts/hf-route-cli.js --file prompt.txt --task rerank
```

Flags:
- `--prompt` / `--file`
- `--task` (`text-generation|embedding|rerank|translation`)
- `--maxCandidates` (default 6)
- `--temperature` (passed to generation models when supported)
- `--http` (force HTTP API instead of in‑process)
- `--json` (machine readable output)
- `--verbose`

## 8. Metrics & Tracing

Defined in `OpenTelemetryTracing.js`:
- Counter: `hfRoutingSuccess`
- Counter: `hfRoutingErrors`
- Counter: `hfRoutingFallbacks`
- Histogram: `hfRoutingLatency` (ms)

Each tool / API call wraps inference in spans with attributes:
- `hf.task`
- `hf.model`
- `hf.fallback` (boolean)
- `hf.composite_score`

## 9. Environment Variables

Add to `.env` or `.env.example` (see root/backend examples):
```
HUGGINGFACE_API_KEY=hf_xxx
# Optional tuning
HF_ROUTER_ENABLE_PROBES=true
HF_ROUTER_PROBE_TIMEOUT_MS=3500
HF_ROUTER_MAX_CANDIDATES=6
```

Feature flag gating (already present): `ENABLE_HF_BRIDGE=true` enables related components.

## 10. Reliability Notes

- Never throws uncaught errors outward; returns structured failure objects.
- Reliability score dampens after each failure to push alternative models upward next time.
- Probing is lightweight; disable via `HF_ROUTER_ENABLE_PROBES=false` if rate limits are tight.

## 11. Extending the Catalog

1. Append new model entry to `hfModelCatalog.json` (preserve fields).
2. Adjust category or add new category — update internal qualityPrior mapping accordingly (see service file) if needed.
3. No restart needed if hot‑reloading; else restart backend.

## 12. Future Enhancements (Ideas)

- Structured calibration of confidence using small validation sets.
- Adaptive weighting via bandit algorithm.
- Caching layer for identical short prompts.
- Vendor cost telemetry (tokens/sec, $/1K tokens) integration.

---
For questions or changes, update this README and open a PR referencing routing enhancements.
