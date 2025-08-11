# Key & Secret Governance Strategy

This document summarizes the implemented controls for API key discovery, permission scoping, runtime protection, and rotation.

## Components Implemented

1. Inventory & Detection
   - `scripts/security/scan-api-keys.mjs` produces `key-inventory.json` with hashed findings (no plaintext) + detectors + occurrences.
   - Patterns: OpenAI (sk-), GitHub (ghp_), GitLab (glpat-), HF (hf_), Google (AIza), AWS (AKIA), generic JWT-like, plus env assignments.
   - Baseline comparison via `rotate-keys.mjs` (diffs current vs `key-inventory.prev.json`).

2. Permissions Overlay
   - `config/api-key-permissions.json` overrides internal defaults in `APIKeyManager` so roles → services can change without code deploy.
   - Validation hook logs configuration anomalies at startup.

3. Pre-Commit Enforcement
   - `.husky/pre-commit` invokes `precommit-secret-check.mjs`:
     - Runs scan, compares new hashed secrets to baseline limit (`SECRET_NEW_HASH_LIMIT`, default=5).
     - Fails commit if threshold exceeded. Override: `SKIP_PRECOMMIT_SECURITY=1` (audited usage only).
   - Regex fallback still scans staged JS/TS/JSON/env for obvious token patterns.

4. Redaction Middleware
   - `redactSecrets` wraps `res.json`/`res.send` to mask leaked secrets in API responses.
   - Hash style: keep first 4 chars then `***REDACTED***`.

5. Internal Status Route
   - `/api/internal/keys/status` returns sanitized key manager status + short SHA-256 prefixes instead of raw keys.
   - Intended for internal ops dashboards & monitoring only (ensure network ACL / auth layer in front if exposed).

6. Rotation Workflow
   - `keys:rotate` script regenerates scan, diffs with previous snapshot:
     - `added` hashes, `removed` hashes, `stable` count.
     - Update baseline: `UPDATE_KEY_SNAPSHOT=1 node scripts/security/rotate-keys.mjs` after validating additions.

## Recommended Operational Flow

1. After cloning: `npm run scan:keys` to generate initial inventory.
2. Approve baseline: `UPDATE_KEY_SNAPSHOT=1 npm run keys:rotate` (creates `key-inventory.prev.json`).
3. Normal development: pre-commit hook blocks accidental secret introduction beyond allowed delta.
4. Secret Rotation Event:
   - Replace env values securely.
   - Run `npm run scan:keys` then `npm run keys:rotate` to confirm new hashes (old should appear in `removed`).
   - If expected, update baseline.
5. Monitoring: Periodic call to `/api/internal/keys/status` (internal network) for audit panel.

## Environment Variables

- `SECRET_NEW_HASH_LIMIT`: Max new secret hashes allowed per commit (default 5).
- `SKIP_PRECOMMIT_SECURITY=1`: Explicit bypass (discouraged, logs reason in commit message ideally).
- `UPDATE_KEY_SNAPSHOT=1`: When set while running rotation script, updates baseline file.

## Future Enhancements (Not Yet Implemented)

- Encrypted secret storage / sealed vault integration for runtime (currently env-based).
- Automatic rotation triggers and decommission scheduling.
- Alerting pipeline (Prometheus counter for secret scan deltas).
- Role → key usage telemetry (span attributes) for anomaly detection.

## Security Notes

- Never commit plaintext secrets; hashed inventory is safe to version.
- Always review `added` list in rotation report for unexpected tokens.
- Limit use of bypass variable; treat it as an exception requiring peer review.

---
Maintainer: Security/Platform Engineering
Last Updated: ${new Date().toISOString()}
