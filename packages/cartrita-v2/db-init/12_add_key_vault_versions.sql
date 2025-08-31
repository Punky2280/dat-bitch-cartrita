-- 12_add_key_vault_versions.sql
-- Adds user_api_key_versions table and new metadata columns to user_api_keys
-- Safe to run multiple times (guards with IF NOT EXISTS / conditional ALTERs)

BEGIN;

-- 1. Ensure new columns on user_api_keys (idempotent style)
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ NULL;
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS checksum VARCHAR(128);

-- 2. Version history table
CREATE TABLE IF NOT EXISTS user_api_key_versions (
    id BIGSERIAL PRIMARY KEY,
    user_api_key_id BIGINT NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    encrypted_key JSONB NOT NULL,
    iv TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    checksum VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_api_key_id, version_number)
);

-- 3. Helpful index for lookup
CREATE INDEX IF NOT EXISTS idx_user_api_key_versions_keyid ON user_api_key_versions(user_api_key_id);

COMMIT;
