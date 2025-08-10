## Vault Re-encryption Procedure

Use when `ENCRYPTION_MASTER_KEY` rotates.

### Prerequisites

- Database backup completed
- New master passphrase chosen (strong & unique)
- Environment variables prepared:
  - `OLD_ENCRYPTION_MASTER_KEY`
  - `NEW_ENCRYPTION_MASTER_KEY`

### Steps

```bash
OLD_ENCRYPTION_MASTER_KEY=oldpass \
NEW_ENCRYPTION_MASTER_KEY=newpass \
node packages/backend/scripts/reencryptVaultKeys.js
```

### What the script does

1. Backs up current `user_api_keys` rows to `vault-backup-<timestamp>.json`
2. Decrypts with old key, encrypts with new
3. Verifies round-trip integrity
4. Updates checksum (recomputes if mismatch)
5. Commits or rolls back upon first failure

### Post-rotation

- Set `ENCRYPTION_MASTER_KEY=newpass` in deployment secrets
- Restart backend services
- Spot test: validate a key via `/api/vault/keys/:id/validate`

### Rollback

If failure after commit is suspected:

1. Stop services
2. Restore DB from backup OR re-run using inverse old/new values (only if old passphrase not compromised)

### Audit

Record rotation in security log (date, operator, counts). Store backup file securely then remove after verification.
