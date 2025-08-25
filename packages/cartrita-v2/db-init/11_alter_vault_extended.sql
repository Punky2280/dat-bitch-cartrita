-- Migration 11: Extend user_api_keys with Phase 1 vault fields
-- Date: 2025-08-09
-- Description: Adds category, rotation_policy, visibility, checksum, metadata columns
--              and supporting indexes if not existing. Safe re-runnable.

BEGIN;

-- Add new columns if not exist
ALTER TABLE user_api_keys
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS rotation_policy JSONB DEFAULT '{"intervalDays":90,"autoRotate":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'MASKED',
  ADD COLUMN IF NOT EXISTS checksum TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Backfill category from provider category if such attribute exists (placeholder logic)
-- (No provider category column yet; reserved for future migration.)

-- Populate checksum for existing rows missing it
UPDATE user_api_keys SET checksum = substr(md5(coalesce(key_data,'')),1,32)
WHERE checksum IS NULL;

-- Create index for searching by checksum
CREATE INDEX IF NOT EXISTS idx_user_api_keys_checksum ON user_api_keys(checksum);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_category ON user_api_keys(category);

COMMIT;

DO $$ BEGIN RAISE NOTICE '✅ Migration 11_alter_vault_extended applied.'; END $$;
