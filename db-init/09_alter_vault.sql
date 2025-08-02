-- =====================================================
-- API KEY VAULT - Migration Script
-- =====================================================

-- Update existing user_api_keys table to add new columns
ALTER TABLE user_api_keys 
ADD COLUMN IF NOT EXISTS provider_id INTEGER,
ADD COLUMN IF NOT EXISTS key_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS key_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS encrypted_metadata JSONB,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rotation_interval_days INTEGER,
ADD COLUMN IF NOT EXISTS next_rotation_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add foreign key constraint if api_providers table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_providers') THEN
        -- Add foreign key constraint
        ALTER TABLE user_api_keys 
        ADD CONSTRAINT fk_user_api_keys_provider 
        FOREIGN KEY (provider_id) REFERENCES api_providers(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Update existing keys to have default values
UPDATE user_api_keys SET 
    key_name = COALESCE(key_name, 'Legacy Key'),
    is_active = COALESCE(is_active, TRUE),
    updated_at = COALESCE(updated_at, NOW())
WHERE key_name IS NULL OR is_active IS NULL OR updated_at IS NULL;

-- Create additional indexes for new columns
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider_id_new ON user_api_keys(provider_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active_new ON user_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_expires_at_new ON user_api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_hash_new ON user_api_keys(key_hash);

-- ✅ API Key Vault migration completed