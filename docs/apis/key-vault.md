# Key Vault API

Lightweight secure API key management endpoints (new unified service).
Base path: `/api/key-vault`

## Endpoints

### POST /keys
Create or upsert a key for a provider.
Body: { serviceName, key, scopes?: string[], purposeTags?: string[], description?, expiresAt? }
Response: { success: true, key: { id, serviceName, scopes, purposeTags } }

### GET /keys
List masked keys for the authenticated user.
Response: { success: true, keys: [ { id, service, usage_count, last_accessed_at, scopes, purpose_tags, ... } ] }

### GET /keys/:serviceName/metadata
Retrieve metadata (no raw secret, no usage increment).
Response: { success: true, metadata }

### POST /keys/rotate
Rotate current key; optionally preserve previous version.
Body: { serviceName, newKey, reason?, preserve_old?: boolean }
Response: { success: true, rotated: boolean }

### GET /keys/:serviceName/versions
List preserved historical versions (most recent first for DB path; memory mode returns ascending order with { version, created_at }).
Response: { success: true, versions: [ { version, created_at } ] }

### DELETE /keys/:serviceName
Soft delete (marks key inactive & sets soft_deleted_at).
Response: { success: true, removed: boolean }

### POST /keys/:serviceName/restore
Restore previously soft-deleted key. Returns { success: true, restored } (restored may be false if no soft-deleted record).

### POST /keys/:serviceName/validate
Lightweight candidate validation (length check placeholder) – does not store key.
Body: { candidate }
Response: { success: true, valid: boolean, hashPreview }

### GET /keys/usage/analytics
Simple usage counters for each key (usage_count, last_accessed_at).
Response: { success: true, usage: [ { service, usage_count, last_accessed_at } ] }

## Notes
- In test mode (LIGHTWEIGHT_TEST=1) an in-memory provider/key store is used (no DB).
- Historical versions stored only when rotate called with preserve_old=true.
- Encryption: AES-256-GCM with MASTER_KEY; checksum is first 32 chars of key_hash (sha256).
- Soft delete vs hard delete: current API only supports soft removal; version history retained.
- Validation endpoint currently format-only, add provider-specific logic later.
- Auth: Requires admin token (test bypass tokens: `test-admin-token` / `test-user-token`).

## Migration
Run `12_add_key_vault_versions.sql` to add versioning table & new columns.
