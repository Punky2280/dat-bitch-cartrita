-- Migration: Advanced Security Tables
-- Description: Creates tables for security event detection, alerts, and monitoring

-- Security events table for comprehensive event logging
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    user_id INTEGER REFERENCES users(id),
    endpoint VARCHAR(255),
    metadata JSONB,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    
    -- Indexes for performance
    INDEX idx_security_events_type (type),
    INDEX idx_security_events_ip (ip_address),
    INDEX idx_security_events_timestamp (timestamp),
    INDEX idx_security_events_severity (severity),
    INDEX idx_security_events_user (user_id)
);

-- Security alerts table for active threats
CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    ip_address INET,
    user_id INTEGER REFERENCES users(id),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'false_positive')),
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_security_alerts_type (type),
    INDEX idx_security_alerts_status (status),
    INDEX idx_security_alerts_severity (severity),
    INDEX idx_security_alerts_timestamp (timestamp)
);

-- IP blacklist for malicious IPs
CREATE TABLE IF NOT EXISTS ip_blacklist (
    id SERIAL PRIMARY KEY,
    ip_address INET UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    blacklisted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    blacklisted_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Indexes
    INDEX idx_ip_blacklist_ip (ip_address),
    INDEX idx_ip_blacklist_active (is_active),
    INDEX idx_ip_blacklist_expires (expires_at)
);

-- User sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    location JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB,
    
    -- Indexes
    INDEX idx_user_sessions_token (session_token),
    INDEX idx_user_sessions_user (user_id),
    INDEX idx_user_sessions_status (status),
    INDEX idx_user_sessions_expires (expires_at)
);

-- Multi-factor authentication table
CREATE TABLE IF NOT EXISTS user_mfa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    method VARCHAR(20) NOT NULL CHECK (method IN ('totp', 'sms', 'email', 'hardware')),
    secret_key VARCHAR(255), -- Encrypted TOTP secret
    phone_number VARCHAR(20), -- For SMS
    backup_codes TEXT[], -- Encrypted backup codes
    is_enabled BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP,
    
    -- Ensure one primary method per type per user
    UNIQUE(user_id, method)
);

-- Security preferences for users
CREATE TABLE IF NOT EXISTS user_security_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
    require_mfa BOOLEAN DEFAULT FALSE,
    allowed_ips INET[], -- Whitelist of allowed IPs
    max_concurrent_sessions INTEGER DEFAULT 5,
    session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
    login_notifications BOOLEAN DEFAULT TRUE,
    location_tracking BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit log for security-sensitive actions
CREATE TABLE IF NOT EXISTS security_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    details JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_security_audit_user (user_id),
    INDEX idx_security_audit_action (action),
    INDEX idx_security_audit_timestamp (timestamp),
    INDEX idx_security_audit_success (success)
);

-- Failed login attempts tracking
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_count INTEGER DEFAULT 1,
    first_attempt TIMESTAMP DEFAULT NOW(),
    last_attempt TIMESTAMP DEFAULT NOW(),
    blocked_until TIMESTAMP,
    
    -- Composite index for efficient lookups
    INDEX idx_failed_logins_email_ip (email, ip_address),
    INDEX idx_failed_logins_ip_blocked (ip_address, blocked_until)
);

-- Security metrics for monitoring
CREATE TABLE IF NOT EXISTS security_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_type VARCHAR(20) DEFAULT 'counter' CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
    labels JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_security_metrics_name (metric_name),
    INDEX idx_security_metrics_timestamp (timestamp)
);

-- Create functions for automatic cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_security_data()
RETURNS void AS $$
BEGIN
    -- Clean up old security events (older than 90 days)
    DELETE FROM security_events 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- Clean up resolved security alerts (older than 30 days)
    DELETE FROM security_alerts 
    WHERE status IN ('resolved', 'false_positive') 
    AND resolved_at < NOW() - INTERVAL '30 days';
    
    -- Clean up expired IP blacklist entries
    DELETE FROM ip_blacklist 
    WHERE expires_at < NOW() AND expires_at IS NOT NULL;
    
    -- Clean up expired user sessions
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR status = 'expired';
    
    -- Clean up old audit logs (older than 1 year)
    DELETE FROM security_audit_log 
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    -- Clean up old failed login attempts (older than 7 days)
    DELETE FROM failed_login_attempts 
    WHERE last_attempt < NOW() - INTERVAL '7 days';
    
    -- Clean up old metrics (older than 30 days)
    DELETE FROM security_metrics 
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_security_preferences_updated_at
    BEFORE UPDATE ON user_security_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant appropriate permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_composite 
ON security_events (type, severity, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_alerts_composite 
ON security_alerts (status, severity, timestamp DESC);

-- Insert default security preferences for existing users
INSERT INTO user_security_preferences (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM user_security_preferences)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE security_events IS 'Comprehensive logging of all security-related events';
COMMENT ON TABLE security_alerts IS 'Active security threats and alerts requiring attention';
COMMENT ON TABLE ip_blacklist IS 'Blacklisted IP addresses and their expiration times';
COMMENT ON TABLE user_sessions IS 'Active user sessions with detailed tracking';
COMMENT ON TABLE user_mfa IS 'Multi-factor authentication methods for users';
COMMENT ON TABLE user_security_preferences IS 'Per-user security configuration and preferences';
COMMENT ON TABLE security_audit_log IS 'Audit trail for security-sensitive operations';
COMMENT ON TABLE failed_login_attempts IS 'Tracking failed login attempts for rate limiting';
COMMENT ON TABLE security_metrics IS 'Security monitoring metrics and KPIs';
