-- Migration: Create permanent API keys table for stable authentication
-- Date: 2025-08-12
-- Purpose: Support permanent API key authentication as alternative to JWT

-- Create permanent API keys table
CREATE TABLE IF NOT EXISTS user_api_keys_permanent (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'API Key',
    key_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of the API key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, name)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_permanent_api_keys_hash ON user_api_keys_permanent(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_permanent_api_keys_user ON user_api_keys_permanent(user_id);
CREATE INDEX IF NOT EXISTS idx_permanent_api_keys_active ON user_api_keys_permanent(user_id, is_active) WHERE is_active = true;

-- Create default API keys for existing users
DO $$
DECLARE
    user_record RECORD;
    api_key_hash TEXT;
BEGIN
    -- Generate default API keys for existing users
    FOR user_record IN 
        SELECT id, name, email FROM users WHERE id IN (1, 2, 3)
    LOOP
        -- Create a default API key hash for each user (these will be printed for manual setup)
        api_key_hash := encode(sha256(('cartrita_dev_' || user_record.id || '_' || user_record.email)::bytea), 'hex');
        
        INSERT INTO user_api_keys_permanent (user_id, name, key_hash, created_at, is_active)
        VALUES (
            user_record.id,
            'Development API Key',
            api_key_hash,
            NOW(),
            true
        ) ON CONFLICT (user_id, name) DO NOTHING;
        
        -- Log the corresponding API key (for development purposes)
        RAISE NOTICE 'Created API key for user %: cartrita_dev_%_%', user_record.name, user_record.id, user_record.email;
    END LOOP;
END $$;

-- Add comments
COMMENT ON TABLE user_api_keys_permanent IS 'Permanent API keys for authentication alternative to JWT tokens';
COMMENT ON COLUMN user_api_keys_permanent.key_hash IS 'SHA-256 hash of the API key for secure storage';
COMMENT ON COLUMN user_api_keys_permanent.last_used_at IS 'Timestamp of last successful authentication';
COMMENT ON COLUMN user_api_keys_permanent.metadata IS 'Additional key metadata like scopes, rate limits, etc.';

-- Create a view for safe API key management (without exposing hashes)
CREATE OR REPLACE VIEW user_api_keys_safe AS
SELECT 
    id,
    user_id,
    name,
    created_at,
    last_used_at,
    revoked_at,
    is_active,
    metadata,
    CASE 
        WHEN last_used_at IS NOT NULL THEN EXTRACT(days FROM NOW() - last_used_at)
        ELSE NULL 
    END as days_since_last_use
FROM user_api_keys_permanent;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON user_api_keys_permanent TO robert;
GRANT USAGE ON SEQUENCE user_api_keys_permanent_id_seq TO robert;