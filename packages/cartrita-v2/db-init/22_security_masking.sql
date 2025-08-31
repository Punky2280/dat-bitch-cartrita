-- Migration: Add security masking and access control tables
-- Date: 2025-08-12
-- Purpose: Support masking controls, reveal tokens, and security audit logging

-- Security preferences table for user-specific masking settings
CREATE TABLE IF NOT EXISTS security_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    default_visibility VARCHAR(20) DEFAULT 'masked' CHECK (default_visibility IN ('visible', 'masked', 'hidden')),
    reveal_timeout INTEGER DEFAULT 30, -- seconds
    require_confirmation BOOLEAN DEFAULT true,
    audit_access BOOLEAN DEFAULT true,
    mask_pattern VARCHAR(10) DEFAULT '****',
    show_last_chars INTEGER DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Reveal tokens for temporary access to sensitive data
CREATE TABLE IF NOT EXISTS reveal_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id VARCHAR(100) NOT NULL, -- ID of the resource being revealed (e.g., api_key.id)
    resource_type VARCHAR(50) NOT NULL, -- Type of resource ('api_key', 'credential', etc.)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security events audit log
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_security_preferences_user ON security_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_reveal_tokens_user ON reveal_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reveal_tokens_token ON reveal_tokens(token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reveal_tokens_expires ON reveal_tokens(expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);

-- Insert default security preferences for existing users
INSERT INTO security_preferences (user_id, default_visibility, reveal_timeout, require_confirmation, audit_access)
SELECT 
    u.id,
    CASE 
        WHEN u.is_admin = true THEN 'visible'
        ELSE 'masked'
    END as default_visibility,
    CASE 
        WHEN u.is_admin = true THEN 60
        ELSE 30
    END as reveal_timeout,
    true,
    true
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM security_preferences sp WHERE sp.user_id = u.id
);

-- Function to automatically clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_reveal_tokens()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    DELETE FROM reveal_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log preference changes
CREATE OR REPLACE FUNCTION log_preference_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO security_events (user_id, event_type, metadata)
    VALUES (
        NEW.user_id,
        'preferences_updated',
        json_build_object(
            'old_visibility', OLD.default_visibility,
            'new_visibility', NEW.default_visibility,
            'old_timeout', OLD.reveal_timeout,
            'new_timeout', NEW.reveal_timeout
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_preferences_audit_trigger
    AFTER UPDATE ON security_preferences
    FOR EACH ROW
    EXECUTE FUNCTION log_preference_changes();

-- Add comments for documentation
COMMENT ON TABLE security_preferences IS 'User-specific security and masking preferences';
COMMENT ON TABLE reveal_tokens IS 'Temporary tokens for revealing sensitive data with time-based expiration';
COMMENT ON TABLE security_events IS 'Audit log for security-related events and data access';

COMMENT ON COLUMN security_preferences.default_visibility IS 'Default visibility level: visible, masked, or hidden';
COMMENT ON COLUMN security_preferences.reveal_timeout IS 'Seconds before reveal token expires';
COMMENT ON COLUMN reveal_tokens.resource_id IS 'ID of the resource being revealed (polymorphic)';
COMMENT ON COLUMN reveal_tokens.resource_type IS 'Type of resource being revealed';

-- Create a view for security dashboard
CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    sp.default_visibility,
    sp.reveal_timeout,
    sp.require_confirmation,
    sp.audit_access,
    
    -- Recent activity counts
    (SELECT COUNT(*) FROM security_events se WHERE se.user_id = u.id AND se.created_at >= NOW() - INTERVAL '24 hours') as events_24h,
    (SELECT COUNT(*) FROM reveal_tokens rt WHERE rt.user_id = u.id AND rt.created_at >= NOW() - INTERVAL '24 hours') as reveals_24h,
    
    -- Security score (higher is more secure)
    (
        CASE WHEN sp.default_visibility = 'hidden' THEN 30
             WHEN sp.default_visibility = 'masked' THEN 20
             WHEN sp.default_visibility = 'visible' THEN 10
             ELSE 0 END +
        CASE WHEN sp.require_confirmation = true THEN 15 ELSE 0 END +
        CASE WHEN sp.audit_access = true THEN 10 ELSE 0 END +
        CASE WHEN sp.reveal_timeout <= 30 THEN 15
             WHEN sp.reveal_timeout <= 60 THEN 10
             WHEN sp.reveal_timeout <= 120 THEN 5
             ELSE 0 END
    ) as security_score,
    
    sp.updated_at as preferences_updated_at
FROM users u
LEFT JOIN security_preferences sp ON sp.user_id = u.id
ORDER BY security_score DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON security_preferences TO robert;
GRANT SELECT, INSERT, UPDATE, DELETE ON reveal_tokens TO robert;
GRANT SELECT, INSERT, UPDATE, DELETE ON security_events TO robert;
GRANT USAGE ON SEQUENCE security_preferences_id_seq TO robert;
GRANT USAGE ON SEQUENCE reveal_tokens_id_seq TO robert;
GRANT USAGE ON SEQUENCE security_events_id_seq TO robert;