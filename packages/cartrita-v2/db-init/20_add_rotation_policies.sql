-- Migration: Add rotation policy fields to api_keys table
-- Date: 2025-08-12
-- Purpose: Support automated credential rotation scheduling

-- Add rotation policy columns to existing api_keys table
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS rotation_policy JSONB DEFAULT '{"intervalDays":90,"autoRotate":false,"graceDays":7}',
ADD COLUMN IF NOT EXISTS needs_rotation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'never_tested',
ADD COLUMN IF NOT EXISTS next_rotation_due TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rotation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rotation_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queries on rotation status
CREATE INDEX IF NOT EXISTS idx_api_keys_needs_rotation ON api_keys(needs_rotation) WHERE needs_rotation = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_next_rotation_due ON api_keys(next_rotation_due) WHERE next_rotation_due IS NOT NULL;

-- Create rotation_events table to track rotation history
CREATE TABLE IF NOT EXISTS rotation_events (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual', 'emergency', 'failed'
    reason TEXT,
    old_key_hash VARCHAR(64), -- Hash of the old key for audit purposes
    new_key_hash VARCHAR(64), -- Hash of the new key
    rotation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    error_message TEXT,
    performed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for efficient rotation event queries
CREATE INDEX IF NOT EXISTS idx_rotation_events_api_key_id ON rotation_events(api_key_id);
CREATE INDEX IF NOT EXISTS idx_rotation_events_created_at ON rotation_events(created_at);

-- Create rotation_policies table for global and per-provider policies
CREATE TABLE IF NOT EXISTS rotation_policies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_name VARCHAR(100), -- NULL for global policy
    policy_name VARCHAR(100) NOT NULL,
    interval_days INTEGER DEFAULT 90,
    auto_rotate BOOLEAN DEFAULT false,
    grace_days INTEGER DEFAULT 7, -- Warning period before forced rotation
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider_name, policy_name)
);

-- Create index for policy lookups
CREATE INDEX IF NOT EXISTS idx_rotation_policies_user_provider ON rotation_policies(user_id, provider_name);

-- Update existing keys to set initial rotation due date based on created_at + 90 days
UPDATE api_keys 
SET next_rotation_due = created_at + INTERVAL '90 days'
WHERE next_rotation_due IS NULL AND is_active = true;

-- Function to automatically update rotation status
CREATE OR REPLACE FUNCTION update_rotation_status()
RETURNS trigger AS $$
BEGIN
    -- Update needs_rotation flag based on next_rotation_due
    IF NEW.next_rotation_due IS NOT NULL AND NEW.next_rotation_due <= NOW() THEN
        NEW.needs_rotation = true;
    ELSE
        NEW.needs_rotation = false;
    END IF;
    
    -- Update next rotation due when policy changes
    IF (TG_OP = 'UPDATE' AND OLD.rotation_policy IS DISTINCT FROM NEW.rotation_policy) OR TG_OP = 'INSERT' THEN
        IF NEW.rotation_policy->>'autoRotate' = 'true' AND (NEW.rotation_policy->>'intervalDays')::integer > 0 THEN
            NEW.next_rotation_due = COALESCE(NEW.last_rotation_at, NEW.created_at) + 
                                   MAKE_INTERVAL(days => (NEW.rotation_policy->>'intervalDays')::integer);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically manage rotation status
DROP TRIGGER IF EXISTS update_rotation_status_trigger ON api_keys;
CREATE TRIGGER update_rotation_status_trigger
    BEFORE INSERT OR UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_rotation_status();

-- Insert some default rotation policies for common providers
INSERT INTO rotation_policies (user_id, provider_name, policy_name, interval_days, auto_rotate, grace_days) 
SELECT DISTINCT 
    u.id,
    'openai',
    'OpenAI Standard',
    90,
    false,
    7
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM rotation_policies rp 
    WHERE rp.user_id = u.id AND rp.provider_name = 'openai'
)
ON CONFLICT (user_id, provider_name, policy_name) DO NOTHING;

INSERT INTO rotation_policies (user_id, provider_name, policy_name, interval_days, auto_rotate, grace_days) 
SELECT DISTINCT 
    u.id,
    'huggingface',
    'HuggingFace Standard',
    60,
    false,
    5
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM rotation_policies rp 
    WHERE rp.user_id = u.id AND rp.provider_name = 'huggingface'
)
ON CONFLICT (user_id, provider_name, policy_name) DO NOTHING;

-- Add comment to document the schema
COMMENT ON TABLE rotation_events IS 'Tracks the history of API key rotations for audit and debugging';
COMMENT ON TABLE rotation_policies IS 'Defines rotation policies for API keys by user and provider';
COMMENT ON COLUMN api_keys.rotation_policy IS 'JSON policy defining rotation behavior: {intervalDays, autoRotate, graceDays}';
COMMENT ON COLUMN api_keys.needs_rotation IS 'True when the key is due for rotation based on policy';
COMMENT ON COLUMN api_keys.validation_status IS 'Status of the last key validation: never_tested, valid, invalid, expired';