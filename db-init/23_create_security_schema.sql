-- Security System Database Schema
-- Advanced Security Hardening, Threat Detection, Audit Logging, and Compliance
-- Author: Robbie Allen - Lead Architect
-- Date: August 2025

-- Security Audit Logs Table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id SERIAL PRIMARY KEY,
    event_id UUID UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id INTEGER,
    session_id UUID,
    ip_address INET,
    user_agent TEXT,
    event_data JSONB,
    metadata JSONB,
    encrypted BOOLEAN DEFAULT false,
    integrity_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for security_audit_logs
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_timestamp ON security_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_severity ON security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ip_address ON security_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_id ON security_audit_logs(event_id);

-- Threat Detection Events Table
CREATE TABLE IF NOT EXISTS threat_detection_events (
    id SERIAL PRIMARY KEY,
    threat_id UUID UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    source_ip INET NOT NULL,
    target_resource VARCHAR(255),
    attack_pattern VARCHAR(100),
    detection_method VARCHAR(50) NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    threat_data JSONB NOT NULL,
    response_action VARCHAR(50),
    blocked BOOLEAN DEFAULT false,
    resolved BOOLEAN DEFAULT false,
    false_positive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for threat_detection_events
CREATE INDEX IF NOT EXISTS idx_threat_events_timestamp ON threat_detection_events(created_at);
CREATE INDEX IF NOT EXISTS idx_threat_events_source_ip ON threat_detection_events(source_ip);
CREATE INDEX IF NOT EXISTS idx_threat_events_severity ON threat_detection_events(severity);
CREATE INDEX IF NOT EXISTS idx_threat_events_blocked ON threat_detection_events(blocked);
CREATE INDEX IF NOT EXISTS idx_threat_events_resolved ON threat_detection_events(resolved);
CREATE INDEX IF NOT EXISTS idx_threat_events_risk_score ON threat_detection_events(risk_score);

-- IP Blocking Table
CREATE TABLE IF NOT EXISTS ip_blocks (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    block_reason VARCHAR(255) NOT NULL,
    blocked_by VARCHAR(100),
    block_duration INTEGER, -- Duration in seconds, NULL for permanent
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    block_count INTEGER DEFAULT 1,
    last_attempt TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    
    -- Unique constraint for active blocks
    UNIQUE (ip_address, active),
    
    -- Indexes
    INDEX idx_ip_blocks_ip_address (ip_address),
    INDEX idx_ip_blocks_active (active),
    INDEX idx_ip_blocks_expires_at (expires_at)
);

-- Security Sessions Table
CREATE TABLE IF NOT EXISTS security_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    active BOOLEAN DEFAULT true,
    mfa_verified BOOLEAN DEFAULT false,
    security_level VARCHAR(20) DEFAULT 'standard',
    session_data JSONB,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(255),
    
    -- Indexes
    INDEX idx_security_sessions_session_id (session_id),
    INDEX idx_security_sessions_user_id (user_id),
    INDEX idx_security_sessions_active (active),
    INDEX idx_security_sessions_expires_at (expires_at),
    INDEX idx_security_sessions_last_activity (last_activity)
);

-- Multi-Factor Authentication Table
CREATE TABLE IF NOT EXISTS mfa_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    backup_codes JSONB,
    enabled BOOLEAN DEFAULT false,
    method VARCHAR(20) DEFAULT 'totp' CHECK (method IN ('totp', 'sms', 'email')),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enabled_at TIMESTAMP WITH TIME ZONE,
    last_used TIMESTAMP WITH TIME ZONE,
    recovery_used BOOLEAN DEFAULT false,
    
    -- Indexes
    INDEX idx_mfa_settings_user_id (user_id),
    INDEX idx_mfa_settings_enabled (enabled)
);

-- Login Attempts Table
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username VARCHAR(255),
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mfa_required BOOLEAN DEFAULT false,
    mfa_verified BOOLEAN DEFAULT false,
    session_id UUID,
    metadata JSONB,
    
    -- Indexes
    INDEX idx_login_attempts_user_id (user_id),
    INDEX idx_login_attempts_ip_address (ip_address),
    INDEX idx_login_attempts_attempt_time (attempt_time),
    INDEX idx_login_attempts_success (success)
);

-- Compliance Assessments Table
CREATE TABLE IF NOT EXISTS compliance_assessments (
    id SERIAL PRIMARY KEY,
    assessment_id UUID UNIQUE NOT NULL,
    framework VARCHAR(50) NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    total_rules INTEGER NOT NULL,
    passed_rules INTEGER NOT NULL,
    failed_rules INTEGER NOT NULL,
    assessment_data JSONB NOT NULL,
    violations JSONB,
    recommendations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100),
    
    -- Indexes
    INDEX idx_compliance_assessments_framework (framework),
    INDEX idx_compliance_assessments_created_at (created_at),
    INDEX idx_compliance_assessments_overall_score (overall_score)
);

-- Compliance Violations Table
CREATE TABLE IF NOT EXISTS compliance_violations (
    id SERIAL PRIMARY KEY,
    violation_id UUID UNIQUE NOT NULL,
    assessment_id UUID NOT NULL REFERENCES compliance_assessments(assessment_id),
    framework VARCHAR(50) NOT NULL,
    rule_id VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    description TEXT NOT NULL,
    details JSONB,
    remediation TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'false_positive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    assigned_to VARCHAR(100),
    
    -- Indexes
    INDEX idx_compliance_violations_framework (framework),
    INDEX idx_compliance_violations_severity (severity),
    INDEX idx_compliance_violations_status (status),
    INDEX idx_compliance_violations_created_at (created_at)
);

-- Security Metrics Table
CREATE TABLE IF NOT EXISTS security_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    
    -- Indexes
    INDEX idx_security_metrics_metric_name (metric_name),
    INDEX idx_security_metrics_timestamp (timestamp),
    INDEX idx_security_metrics_category (category)
);

-- Encryption Keys Table
CREATE TABLE IF NOT EXISTS encryption_keys (
    id SERIAL PRIMARY KEY,
    key_id UUID UNIQUE NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    key_purpose VARCHAR(100) NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    key_size INTEGER NOT NULL,
    encrypted_key BYTEA NOT NULL,
    salt BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    rotation_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    INDEX idx_encryption_keys_key_id (key_id),
    INDEX idx_encryption_keys_key_type (key_type),
    INDEX idx_encryption_keys_active (active),
    INDEX idx_encryption_keys_expires_at (expires_at)
);

-- Security Configurations Table
CREATE TABLE IF NOT EXISTS security_configurations (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    config_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100),
    version INTEGER DEFAULT 1,
    
    -- Indexes
    INDEX idx_security_configurations_config_key (config_key),
    INDEX idx_security_configurations_config_type (config_type)
);

-- Security Alerts Table
CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    alert_id UUID UNIQUE NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    alert_data JSONB,
    source VARCHAR(100),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(100),
    resolved_by VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'false_positive')),
    escalated BOOLEAN DEFAULT false,
    
    -- Indexes
    INDEX idx_security_alerts_alert_type (alert_type),
    INDEX idx_security_alerts_severity (severity),
    INDEX idx_security_alerts_status (status),
    INDEX idx_security_alerts_triggered_at (triggered_at)
);

-- User Security Profiles Table
CREATE TABLE IF NOT EXISTS user_security_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    security_level VARCHAR(20) DEFAULT 'standard',
    last_password_change TIMESTAMP WITH TIME ZONE,
    failed_login_count INTEGER DEFAULT 0,
    account_locked BOOLEAN DEFAULT false,
    locked_until TIMESTAMP WITH TIME ZONE,
    security_questions JSONB,
    trusted_devices JSONB,
    security_preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_user_security_profiles_user_id (user_id),
    INDEX idx_user_security_profiles_risk_score (risk_score),
    INDEX idx_user_security_profiles_account_locked (account_locked)
);

-- Security Incidents Table
CREATE TABLE IF NOT EXISTS security_incidents (
    id SERIAL PRIMARY KEY,
    incident_id UUID UNIQUE NOT NULL,
    incident_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    affected_systems JSONB,
    impact_assessment JSONB,
    timeline JSONB,
    response_actions JSONB,
    status VARCHAR(20) DEFAULT 'investigating' CHECK (status IN ('investigating', 'contained', 'eradicating', 'recovering', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    detected_at TIMESTAMP WITH TIME ZONE,
    contained_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    assigned_to VARCHAR(100),
    created_by VARCHAR(100),
    
    -- Indexes
    INDEX idx_security_incidents_incident_type (incident_type),
    INDEX idx_security_incidents_severity (severity),
    INDEX idx_security_incidents_status (status),
    INDEX idx_security_incidents_created_at (created_at)
);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_security_configurations_updated_at
    BEFORE UPDATE ON security_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_security_profiles_updated_at
    BEFORE UPDATE ON user_security_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for cleaning up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM security_sessions
    WHERE expires_at < NOW() AND active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for cleaning up expired IP blocks
CREATE OR REPLACE FUNCTION cleanup_expired_ip_blocks()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE ip_blocks
    SET active = false
    WHERE expires_at < NOW() AND active = true;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for calculating user risk score
CREATE OR REPLACE FUNCTION calculate_user_risk_score(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    risk_score INTEGER := 0;
    failed_logins INTEGER;
    recent_threats INTEGER;
    mfa_enabled BOOLEAN;
BEGIN
    -- Check failed login attempts in last 24 hours
    SELECT COUNT(*) INTO failed_logins
    FROM login_attempts
    WHERE user_id = p_user_id
      AND success = false
      AND attempt_time > NOW() - INTERVAL '24 hours';
    
    -- Check recent threats targeting this user
    SELECT COUNT(*) INTO recent_threats
    FROM threat_detection_events tde
    JOIN security_sessions ss ON ss.ip_address = tde.source_ip
    WHERE ss.user_id = p_user_id
      AND tde.created_at > NOW() - INTERVAL '7 days';
    
    -- Check MFA status
    SELECT enabled INTO mfa_enabled
    FROM mfa_settings
    WHERE user_id = p_user_id;
    
    -- Calculate risk score
    risk_score := failed_logins * 10 + recent_threats * 20;
    
    IF NOT COALESCE(mfa_enabled, false) THEN
        risk_score := risk_score + 30;
    END IF;
    
    -- Cap at 100
    IF risk_score > 100 THEN
        risk_score := 100;
    END IF;
    
    RETURN risk_score;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_logs_composite 
ON security_audit_logs(event_type, severity, timestamp);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_threat_events_composite 
ON threat_detection_events(source_ip, created_at, severity);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_login_attempts_composite 
ON login_attempts(ip_address, attempt_time, success);

-- Create partial indexes for active records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ip_blocks_active_only 
ON ip_blocks(ip_address) WHERE active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_sessions_active_only 
ON security_sessions(user_id, last_activity) WHERE active = true;

-- Add comments for documentation
COMMENT ON TABLE security_audit_logs IS 'Comprehensive audit logging for security events';
COMMENT ON TABLE threat_detection_events IS 'Detected security threats and attacks';
COMMENT ON TABLE ip_blocks IS 'Blocked IP addresses and their status';
COMMENT ON TABLE security_sessions IS 'Active user sessions with security context';
COMMENT ON TABLE mfa_settings IS 'Multi-factor authentication configuration per user';
COMMENT ON TABLE login_attempts IS 'All login attempts for security monitoring';
COMMENT ON TABLE compliance_assessments IS 'Compliance framework assessment results';
COMMENT ON TABLE compliance_violations IS 'Detailed compliance violations and remediation';
COMMENT ON TABLE security_metrics IS 'Security-related metrics and KPIs';
COMMENT ON TABLE encryption_keys IS 'Encryption key management and rotation';
COMMENT ON TABLE security_configurations IS 'System security configuration settings';
COMMENT ON TABLE security_alerts IS 'Security alerts requiring attention';
COMMENT ON TABLE user_security_profiles IS 'Per-user security profiles and risk assessment';
COMMENT ON TABLE security_incidents IS 'Security incident tracking and response';

COMMIT;
