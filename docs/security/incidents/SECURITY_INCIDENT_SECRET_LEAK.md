## Secret Exposure Incident – Remediation Guide

This repository previously contained real secrets (.env committed). Those secrets must be considered compromised. Follow this guide whenever secrets leak.

### 1. Rotate / Revoke All Leaked Credentials

- OpenAI: Create new key, delete old.
- OpenAI Fine‑Tuning key (if separate): rotate.
- LangChain / LangSmith key: rotate.
- Deepgram, Tavily, SerpAPI, GNews, Wolfram Alpha: rotate if exposed.
- GitHub PAT: revoke & reissue with least privilege.
- GitLab PAT (glpat-): revoke & reissue.
- Google API key: restrict by HTTP referrer / IP & regenerate if needed.
- Hugging Face token: revoke & recreate (fine‑grained scope).
- JWT secret & Encryption key: change values; invalidate existing sessions & re-encrypt stored vault entries if necessary.

Document rotation timestamps in internal tracker.

### 2. Purge Secrets From Git History

Install git-filter-repo (preferred) then run from repo root:

```bash
pip install git-filter-repo
# Remove entire .env file across history
git filter-repo --invert-paths --path .env
# Replace inline tokens
git filter-repo --replace-text secret-replacements.txt
rm -rf .git/refs/original/
git reflog expire --all --expire=now
git gc --prune=now --aggressive
git push --force-with-lease origin main
```

Adjust command if additional secret files surfaced.

### 3. Verify Removal

```bash
git grep -I "sk-" HEAD || true
git grep -I "ghp_" HEAD || true
```

Optionally scan with TruffleHog or detect-secrets.

### 4. Update Local Development Practices

- Keep only `.env.example` with placeholders committed.
- Add pre-commit hook to block accidental additions.
- Consider adding CI secret scanning (GitHub Advanced Security already triggers push protection).

### 5. Re-encrypt Vaulted Data (If Key Changed)

If `ENCRYPTION_KEY` rotated:

1. Put system in maintenance mode.
2. Export encrypted entries.
3. Decrypt with old key (offline script), re-encrypt with new key.
4. Validate checksum & length, reinsert.

### 6. Incident Record Template

| Field | Value |
|-------|-------|
| Discovered | DATE_HERE |
| Window of Exposure | Initial commit – purge commit |
| Secrets Affected | OpenAI, GitHub PAT, ... |
| Rotated By | ENGINEER_NAME |
| Rotation Completed | DATE_TIME |
| Verification | grep scan + external scanner |
| Preventive Controls Added | pre-commit hook, CI scan |

### 7. Pre-commit Hook Example

`.git/hooks/pre-commit` (not versioned):

```bash
#!/bin/bash
if git diff --cached | grep -E 'sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|glpat-|hf_[A-Za-z0-9]|AIza' >/dev/null; then
  echo "❌ Potential secret detected; aborting commit."
  exit 1
fi
```

Run: `chmod +x .git/hooks/pre-commit`

### 8. Next Hardening Steps

- Add `detect-secrets` baseline.
- Enforce branch protection & required status checks.
- Introduce dynamic secrets (short TTL) where feasible.
- Instrument secret access auditing.

---

If additional historical blobs surface, append their regex forms to `secret-replacements.txt` and re-run filter-repo.
