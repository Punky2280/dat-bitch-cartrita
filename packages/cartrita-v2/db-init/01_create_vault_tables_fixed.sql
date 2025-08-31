-- Iteration 18: Secure API Key Vault - Database Schema
-- Create tables for secure API key management and audit logging

-- API Security Events table for audit logging
CREATE TABLE IF NOT EXISTS api_security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_security_events_user_time ON api_security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_security_events_type ON api_security_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_api_security_events_severity ON api_security_events(severity, created_at);

-- API Key Rotation History table
CREATE TABLE IF NOT EXISTS api_key_rotation_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES api_providers(id),
    key_name VARCHAR(255) NOT NULL,
    old_key_hash VARCHAR(64), -- SHA256 hash of old key for verification
    rotation_reason VARCHAR(100), -- 'scheduled', 'security_breach', 'manual'
    rotated_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_by INTEGER REFERENCES users(id), -- NULL for automatic rotations
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_key_rotation_user_time ON api_key_rotation_history(user_id, rotated_at);
CREATE INDEX IF NOT EXISTS idx_api_key_rotation_provider ON api_key_rotation_history(provider_id, rotated_at);

-- API Usage Analytics table
CREATE TABLE IF NOT EXISTS api_key_usage_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id INTEGER NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES api_providers(id),
    usage_date DATE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0, -- Track API costs in cents
    last_used_at TIMESTAMPZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_analytics_user_date ON api_key_usage_analytics(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_analytics_key_date ON api_key_usage_analytics(key_id, usage_date);

-- Check if api_providers table has display_name column, if not add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_providers' AND column_name='display_name') THEN
        ALTER TABLE api_providers ADD COLUMN display_name VARCHAR(255);
        ALTER TABLE api_providers ADD COLUMN description TEXT;
        ALTER TABLE api_providers ADD COLUMN icon VARCHAR(50);
        ALTER TABLE api_providers ADD COLUMN documentation_url VARCHAR(500);
        ALTER TABLE api_providers ADD COLUMN default_base_url VARCHAR(500);
        ALTER TABLE api_providers ADD COLUMN required_fields TEXT[];
        ALTER TABLE api_providers ADD COLUMN validation_pattern VARCHAR(255);
        ALTER TABLE api_providers ADD COLUMN key_format_example VARCHAR(255);
        ALTER TABLE api_providers ADD COLUMN is_active BOOLEAN DEFAULT true;
        ALTER TABLE api_providers ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE api_providers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add missing columns to user_api_keys if they don't exist
DO $$
BEGIN
    -- Add rotation columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='rotation_interval_days') THEN
        ALTER TABLE user_api_keys ADD COLUMN rotation_interval_days INTEGER DEFAULT 90;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='next_rotation_at') THEN
        ALTER TABLE user_api_keys ADD COLUMN next_rotation_at TIMESTAMPTZ;
    END IF;
    
    -- Add usage tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='usage_count') THEN
        ALTER TABLE user_api_keys ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='last_used_at') THEN
        ALTER TABLE user_api_keys ADD COLUMN last_used_at TIMESTAMPTZ;
    END IF;
    
    -- Add key metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='key_hash') THEN
        ALTER TABLE user_api_keys ADD COLUMN key_hash VARCHAR(64); -- SHA256 hash for integrity
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='environment') THEN
        ALTER TABLE user_api_keys ADD COLUMN environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production'));
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON user_api_keys(user_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(is_active, next_rotation_at) WHERE is_active = true;

-- Insert initial security event
INSERT INTO api_security_events (user_id, event_type, description, metadata, severity)
SELECT 1, 'vault_initialized', 'Secure API Vault system initialized', '{"iteration": 18, "version": "2.0"}', 'info'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE api_security_events IS 'Audit log for all API key vault security events';
COMMENT ON TABLE api_key_rotation_history IS 'History of API key rotations for compliance and security tracking';
COMMENT ON TABLE api_key_usage_analytics IS 'Analytics and usage tracking for API keys';