-- Migration 12: Extend vault with usage + scopes, add event_log table, persona_config column
-- Date: 2025-08-10
-- Idempotent migration adding missing fields required by refactor.

BEGIN;

-- Add columns to user_api_keys if not exist
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS usage_count BIGINT DEFAULT 0;
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[];
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS purpose_tags TEXT[];

-- Ensure checksum column exists (was added earlier but safety)
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS checksum TEXT;

-- Event log table for audit events (append only)
CREATE TABLE IF NOT EXISTS event_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON event_log(created_at);

-- Persona config column on user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS persona_config JSONB;

-- Persona presets table
CREATE TABLE IF NOT EXISTS persona_presets (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  persona_config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_persona_presets_user ON persona_presets(user_id);

COMMIT;

DO $$ BEGIN RAISE NOTICE '✅ Migration 12_extend_vault_usage_persona applied.'; END $$;
