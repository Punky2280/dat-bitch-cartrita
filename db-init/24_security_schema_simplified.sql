-- Security System Database Schema (Simplified)
-- Advanced Security Hardening, Threat Detection, Audit Logging, and Compliance
-- Author: Robbie Allen - Lead Architect
-- Date: August 2025

-- Security Audit Logs
DROP TABLE IF EXISTS security_audit_logs CASCADE;
CREATE TABLE security_audit_logs (
    id SERIAL PRIMARY KEY,
    event_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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

-- Threat Detection Events
DROP TABLE IF EXISTS threat_detection_events CASCADE;
CREATE TABLE threat_detection_events (
    id SERIAL PRIMARY KEY,
    threat_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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

-- IP Blocking
DROP TABLE IF EXISTS ip_blocks CASCADE;
CREATE TABLE ip_blocks (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    block_reason VARCHAR(255) NOT NULL,
    blocked_by VARCHAR(100),
    block_duration INTEGER,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    block_count INTEGER DEFAULT 1,
    last_attempt TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- Security Sessions
DROP TABLE IF EXISTS security_sessions CASCADE;
CREATE TABLE security_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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
    revoked_reason VARCHAR(255)
);

-- Multi-Factor Authentication
DROP TABLE IF EXISTS mfa_settings CASCADE;
CREATE TABLE mfa_settings (
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
    recovery_used BOOLEAN DEFAULT false
);

-- Login Attempts
DROP TABLE IF EXISTS login_attempts CASCADE;
CREATE TABLE login_attempts (
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
    metadata JSONB
);

-- Compliance Assessments
DROP TABLE IF EXISTS compliance_assessments CASCADE;
CREATE TABLE compliance_assessments (
    id SERIAL PRIMARY KEY,
    assessment_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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
    created_by VARCHAR(100)
);

-- Compliance Violations
DROP TABLE IF EXISTS compliance_violations CASCADE;
CREATE TABLE compliance_violations (
    id SERIAL PRIMARY KEY,
    violation_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL,
    framework VARCHAR(50) NOT NULL,
    rule_id VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    description TEXT NOT NULL,
    details JSONB,
    remediation TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'false_positive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    assigned_to VARCHAR(100)
);

-- Security Metrics
DROP TABLE IF EXISTS security_metrics CASCADE;
CREATE TABLE security_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Security Alerts
DROP TABLE IF EXISTS security_alerts CASCADE;
CREATE TABLE security_alerts (
    id SERIAL PRIMARY KEY,
    alert_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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
    escalated BOOLEAN DEFAULT false
);

-- User Security Profiles
DROP TABLE IF EXISTS user_security_profiles CASCADE;
CREATE TABLE user_security_profiles (
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security Incidents  
DROP TABLE IF EXISTS security_incidents CASCADE;
CREATE TABLE security_incidents (
    id SERIAL PRIMARY KEY,
    incident_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
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
    created_by VARCHAR(100)
);

-- Create Indexes
CREATE INDEX idx_security_audit_logs_timestamp ON security_audit_logs(timestamp);
CREATE INDEX idx_security_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX idx_security_audit_logs_severity ON security_audit_logs(severity);
CREATE INDEX idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX idx_security_audit_logs_ip_address ON security_audit_logs(ip_address);

CREATE INDEX idx_threat_events_created_at ON threat_detection_events(created_at);
CREATE INDEX idx_threat_events_source_ip ON threat_detection_events(source_ip);
CREATE INDEX idx_threat_events_severity ON threat_detection_events(severity);
CREATE INDEX idx_threat_events_blocked ON threat_detection_events(blocked);

CREATE INDEX idx_ip_blocks_ip_address ON ip_blocks(ip_address);
CREATE INDEX idx_ip_blocks_active ON ip_blocks(active);

CREATE INDEX idx_security_sessions_session_id ON security_sessions(session_id);
CREATE INDEX idx_security_sessions_user_id ON security_sessions(user_id);
CREATE INDEX idx_security_sessions_active ON security_sessions(active);

CREATE INDEX idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_attempt_time ON login_attempts(attempt_time);

CREATE INDEX idx_compliance_assessments_framework ON compliance_assessments(framework);
CREATE INDEX idx_compliance_assessments_created_at ON compliance_assessments(created_at);

CREATE INDEX idx_compliance_violations_framework ON compliance_violations(framework);
CREATE INDEX idx_compliance_violations_severity ON compliance_violations(severity);
CREATE INDEX idx_compliance_violations_status ON compliance_violations(status);

CREATE INDEX idx_security_alerts_alert_type ON security_alerts(alert_type);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_status ON security_alerts(status);

CREATE INDEX idx_user_security_profiles_user_id ON user_security_profiles(user_id);
CREATE INDEX idx_security_incidents_incident_type ON security_incidents(incident_type);
