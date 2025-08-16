-- Enhanced Database Security Schema Migration
-- Field-level encryption, data classification, audit trails
-- @author Robbie Allen - Lead Architect
-- @date August 16, 2025

-- Create database security configuration table
CREATE TABLE IF NOT EXISTS database_security_config (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    security_classification VARCHAR(50) NOT NULL DEFAULT 'public', -- public, internal, confidential, restricted
    encryption_enabled BOOLEAN DEFAULT FALSE,
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    masking_enabled BOOLEAN DEFAULT FALSE,
    masking_method VARCHAR(50) DEFAULT 'partial', -- partial, full, hash, random
    audit_enabled BOOLEAN DEFAULT TRUE,
    data_retention_days INTEGER DEFAULT 365,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(table_name, column_name)
);

-- Create data access audit log table
CREATE TABLE IF NOT EXISTS data_access_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER,
    session_id VARCHAR(255),
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255),
    operation VARCHAR(20) NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
    record_id VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    client_ip INET,
    user_agent TEXT,
    query_fingerprint VARCHAR(255),
    access_granted BOOLEAN DEFAULT TRUE,
    denial_reason TEXT,
    risk_score INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_data_access_audit_user_timestamp (user_id, timestamp),
    INDEX idx_data_access_audit_table_timestamp (table_name, timestamp),
    INDEX idx_data_access_audit_operation (operation),
    INDEX idx_data_access_audit_risk_score (risk_score)
);

-- Create query monitoring table
CREATE TABLE IF NOT EXISTS query_monitoring_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER,
    session_id VARCHAR(255),
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT,
    query_type VARCHAR(20), -- SELECT, INSERT, UPDATE, DELETE, DDL
    tables_accessed TEXT[], -- Array of table names
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    rows_examined INTEGER,
    client_ip INET,
    application_name VARCHAR(255),
    risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    anomaly_detected BOOLEAN DEFAULT FALSE,
    anomaly_reason TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance and monitoring
    INDEX idx_query_monitoring_user_timestamp (user_id, timestamp),
    INDEX idx_query_monitoring_hash (query_hash),
    INDEX idx_query_monitoring_risk_level (risk_level),
    INDEX idx_query_monitoring_anomaly (anomaly_detected)
);

-- Create sensitive data detection table
CREATE TABLE IF NOT EXISTS sensitive_data_detection (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    data_type VARCHAR(100) NOT NULL, -- PII, PHI, PCI, SSN, CREDIT_CARD, etc.
    confidence_score DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 1.0
    detection_method VARCHAR(100) NOT NULL, -- regex, ml_model, pattern_match, manual
    sample_data TEXT, -- Masked sample for verification
    false_positive BOOLEAN DEFAULT FALSE,
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(table_name, column_name, data_type)
);

-- Create data masking rules table
CREATE TABLE IF NOT EXISTS data_masking_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    masking_method VARCHAR(50) NOT NULL, -- partial, full, hash, random, custom
    masking_config JSONB, -- Configuration for masking method
    preserve_length BOOLEAN DEFAULT TRUE,
    preserve_format BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100, -- Lower number = higher priority
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create encryption key management table
CREATE TABLE IF NOT EXISTS encryption_keys (
    id SERIAL PRIMARY KEY,
    key_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    key_name VARCHAR(255) NOT NULL UNIQUE,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    key_size INTEGER NOT NULL DEFAULT 256,
    encrypted_key TEXT NOT NULL, -- Master key encrypted version
    key_derivation_method VARCHAR(100) DEFAULT 'PBKDF2',
    salt BYTEA,
    iterations INTEGER DEFAULT 100000,
    status VARCHAR(20) DEFAULT 'active', -- active, rotated, deprecated
    usage_count BIGINT DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    rotation_schedule_days INTEGER DEFAULT 90,
    next_rotation_date TIMESTAMP WITH TIME ZONE,
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP WITH TIME ZONE
);

-- Create backup encryption log table
CREATE TABLE IF NOT EXISTS backup_encryption_log (
    id SERIAL PRIMARY KEY,
    backup_id VARCHAR(255) NOT NULL,
    backup_type VARCHAR(50) NOT NULL, -- full, incremental, differential
    encryption_key_id INTEGER REFERENCES encryption_keys(id),
    file_path TEXT,
    file_size_bytes BIGINT,
    compression_ratio DECIMAL(5,2),
    encryption_time_ms INTEGER,
    checksum VARCHAR(128),
    backup_started_at TIMESTAMP WITH TIME ZONE,
    backup_completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'completed', -- in_progress, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create data lineage tracking table
CREATE TABLE IF NOT EXISTS data_lineage (
    id BIGSERIAL PRIMARY KEY,
    source_table VARCHAR(255) NOT NULL,
    source_column VARCHAR(255) NOT NULL,
    destination_table VARCHAR(255) NOT NULL,
    destination_column VARCHAR(255) NOT NULL,
    transformation_type VARCHAR(100), -- copy, aggregate, join, calculate, mask, encrypt
    transformation_rule TEXT,
    data_flow_direction VARCHAR(20) DEFAULT 'forward', -- forward, backward, bidirectional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite index for lineage queries
    INDEX idx_data_lineage_source (source_table, source_column),
    INDEX idx_data_lineage_destination (destination_table, destination_column)
);

-- Create database security policies table
CREATE TABLE IF NOT EXISTS database_security_policies (
    id SERIAL PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL UNIQUE,
    policy_type VARCHAR(50) NOT NULL, -- access_control, encryption, masking, audit
    scope_type VARCHAR(50) NOT NULL, -- global, table, column, user, role
    scope_value TEXT, -- Specific table/column/user/role name
    policy_rules JSONB NOT NULL, -- JSON configuration for the policy
    priority INTEGER DEFAULT 100,
    enabled BOOLEAN DEFAULT TRUE,
    enforcement_level VARCHAR(20) DEFAULT 'enforce', -- monitor, warn, enforce
    violation_action VARCHAR(50) DEFAULT 'log', -- log, block, alert, escalate
    created_by INTEGER,
    approved_by INTEGER,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create data classification tags table
CREATE TABLE IF NOT EXISTS data_classification_tags (
    id SERIAL PRIMARY KEY,
    tag_name VARCHAR(100) NOT NULL UNIQUE,
    tag_category VARCHAR(50) NOT NULL, -- sensitivity, geography, department, compliance
    tag_description TEXT,
    color_code VARCHAR(7), -- Hex color for UI
    retention_period_days INTEGER,
    handling_requirements JSONB, -- Special handling requirements
    compliance_frameworks TEXT[], -- Array of compliance frameworks (GDPR, HIPAA, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create table to link data to classification tags
CREATE TABLE IF NOT EXISTS data_classification_assignments (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255),
    tag_id INTEGER REFERENCES data_classification_tags(id) ON DELETE CASCADE,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    assigned_by INTEGER,
    assignment_method VARCHAR(50) DEFAULT 'manual', -- manual, automatic, ml_detected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(table_name, column_name, tag_id)
);

-- Create security metrics table
CREATE TABLE IF NOT EXISTS database_security_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,5) NOT NULL,
    metric_unit VARCHAR(50),
    dimension_tags JSONB, -- Additional dimensions like table_name, user_id, etc.
    collection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Time-series partitioning helper
    INDEX idx_security_metrics_name_time (metric_name, collection_timestamp),
    INDEX idx_security_metrics_tags (dimension_tags)
);

-- Insert default data classification tags
INSERT INTO data_classification_tags (tag_name, tag_category, tag_description, color_code, compliance_frameworks) VALUES
('Public', 'sensitivity', 'Data that can be freely shared', '#28a745', ARRAY[]::TEXT[]),
('Internal', 'sensitivity', 'Data for internal use only', '#ffc107', ARRAY[]::TEXT[]),
('Confidential', 'sensitivity', 'Sensitive data requiring protection', '#fd7e14', ARRAY['SOX', 'PCI']),
('Restricted', 'sensitivity', 'Highly sensitive data with strict access controls', '#dc3545', ARRAY['GDPR', 'HIPAA', 'SOX', 'PCI']),
('PII', 'compliance', 'Personally Identifiable Information', '#6f42c1', ARRAY['GDPR', 'CCPA']),
('PHI', 'compliance', 'Protected Health Information', '#e83e8c', ARRAY['HIPAA']),
('PCI', 'compliance', 'Payment Card Industry data', '#fd7e14', ARRAY['PCI']),
('Financial', 'compliance', 'Financial data requiring SOX compliance', '#20c997', ARRAY['SOX']);

-- Insert default security configuration for common sensitive columns
INSERT INTO database_security_config (table_name, column_name, security_classification, encryption_enabled, masking_enabled, audit_enabled) VALUES
('users', 'email', 'internal', TRUE, TRUE, TRUE),
('users', 'password', 'confidential', TRUE, TRUE, TRUE),
('users', 'phone', 'confidential', TRUE, TRUE, TRUE),
('vault', 'encrypted_value', 'restricted', TRUE, FALSE, TRUE),
('api_keys', 'key_hash', 'restricted', TRUE, TRUE, TRUE),
('conversations', 'message_content', 'internal', FALSE, TRUE, TRUE),
('calendar_events', 'description', 'internal', FALSE, TRUE, TRUE),
('contacts', 'email', 'internal', TRUE, TRUE, TRUE),
('contacts', 'phone', 'confidential', TRUE, TRUE, TRUE);

-- Insert default masking rules
INSERT INTO data_masking_rules (rule_name, table_name, column_name, masking_method, masking_config) VALUES
('email_masking', 'users', 'email', 'partial', '{"preserve_domain": false, "mask_character": "*", "visible_chars": 2}'::jsonb),
('phone_masking', 'users', 'phone', 'partial', '{"mask_character": "X", "visible_chars": 4, "preserve_format": true}'::jsonb),
('credit_card_masking', '*', 'credit_card_number', 'partial', '{"mask_character": "*", "visible_chars": 4, "preserve_format": true}'::jsonb);

-- Insert default security policies
INSERT INTO database_security_policies (policy_name, policy_type, scope_type, scope_value, policy_rules) VALUES
('global_audit_policy', 'audit', 'global', '*', '{"operations": ["SELECT", "INSERT", "UPDATE", "DELETE"], "log_level": "info", "include_query": true}'::jsonb),
('sensitive_data_encryption', 'encryption', 'classification', 'confidential', '{"algorithm": "AES-256-GCM", "key_rotation_days": 90, "require_encryption": true}'::jsonb),
('admin_access_monitoring', 'access_control', 'role', 'admin', '{"require_mfa": true, "session_timeout_minutes": 30, "log_all_queries": true, "risk_threshold": "high"}'::jsonb),
('pii_masking_policy', 'masking', 'tag', 'PII', '{"default_masking": true, "masking_method": "partial", "audit_unmasked_access": true}'::jsonb);

-- Create master encryption key (this would be managed securely in production)
INSERT INTO encryption_keys (key_name, algorithm, encrypted_key, salt, next_rotation_date) VALUES
('master_key_v1', 'AES-256-GCM', 'encrypted_master_key_placeholder', decode('random_salt_bytes_here', 'hex'), CURRENT_TIMESTAMP + INTERVAL '90 days');

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_database_security_config_updated_at BEFORE UPDATE
    ON database_security_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_masking_rules_updated_at BEFORE UPDATE
    ON data_masking_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_database_security_policies_updated_at BEFORE UPDATE
    ON database_security_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to log data access for audit trail
CREATE OR REPLACE FUNCTION log_data_access(
    p_user_id INTEGER,
    p_session_id VARCHAR(255),
    p_table_name VARCHAR(255),
    p_column_name VARCHAR(255),
    p_operation VARCHAR(20),
    p_record_id VARCHAR(255) DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_client_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_risk_score INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    INSERT INTO data_access_audit_log (
        user_id, session_id, table_name, column_name, operation,
        record_id, old_value, new_value, client_ip, user_agent, risk_score
    ) VALUES (
        p_user_id, p_session_id, p_table_name, p_column_name, p_operation,
        p_record_id, p_old_value, p_new_value, p_client_ip, p_user_agent, p_risk_score
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to check if data should be masked
CREATE OR REPLACE FUNCTION should_mask_column(
    p_table_name VARCHAR(255),
    p_column_name VARCHAR(255),
    p_user_role VARCHAR(100) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_masking_enabled BOOLEAN := FALSE;
    v_user_exempt BOOLEAN := FALSE;
BEGIN
    -- Check if masking is enabled for this column
    SELECT masking_enabled INTO v_masking_enabled
    FROM database_security_config
    WHERE table_name = p_table_name AND column_name = p_column_name;
    
    -- If no specific config, check wildcard rules
    IF v_masking_enabled IS NULL THEN
        SELECT masking_enabled INTO v_masking_enabled
        FROM database_security_config
        WHERE table_name = '*' AND column_name = p_column_name;
    END IF;
    
    -- Check if user role is exempt from masking (admin, system, etc.)
    IF p_user_role IN ('admin', 'system', 'security_officer') THEN
        v_user_exempt := TRUE;
    END IF;
    
    RETURN COALESCE(v_masking_enabled, FALSE) AND NOT COALESCE(v_user_exempt, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Create function to apply data masking
CREATE OR REPLACE FUNCTION apply_data_masking(
    p_value TEXT,
    p_table_name VARCHAR(255),
    p_column_name VARCHAR(255)
) RETURNS TEXT AS $$
DECLARE
    v_masking_method VARCHAR(50);
    v_masking_config JSONB;
    v_result TEXT;
BEGIN
    -- Get masking configuration
    SELECT masking_method, masking_config INTO v_masking_method, v_masking_config
    FROM data_masking_rules
    WHERE table_name = p_table_name AND column_name = p_column_name AND enabled = TRUE
    ORDER BY priority ASC
    LIMIT 1;
    
    -- If no specific rule found, check wildcard rules
    IF v_masking_method IS NULL THEN
        SELECT masking_method, masking_config INTO v_masking_method, v_masking_config
        FROM data_masking_rules
        WHERE table_name = '*' AND column_name = p_column_name AND enabled = TRUE
        ORDER BY priority ASC
        LIMIT 1;
    END IF;
    
    -- Apply masking based on method
    CASE v_masking_method
        WHEN 'full' THEN
            v_result := REPEAT('*', LENGTH(p_value));
        WHEN 'partial' THEN
            -- Simple partial masking (show first 2 and last 2 characters)
            IF LENGTH(p_value) <= 4 THEN
                v_result := REPEAT('*', LENGTH(p_value));
            ELSE
                v_result := SUBSTRING(p_value FROM 1 FOR 2) || REPEAT('*', LENGTH(p_value) - 4) || SUBSTRING(p_value FROM LENGTH(p_value) - 1);
            END IF;
        WHEN 'hash' THEN
            v_result := ENCODE(DIGEST(p_value || 'salt', 'sha256'), 'hex');
        WHEN 'random' THEN
            v_result := REPEAT('X', LENGTH(p_value));
        ELSE
            v_result := p_value; -- No masking
    END CASE;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_config_table_column 
    ON database_security_config(table_name, column_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_table_time 
    ON data_access_audit_log(user_id, table_name, timestamp);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_monitoring_time_risk 
    ON query_monitoring_log(timestamp, risk_level);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensitive_data_detection_table 
    ON sensitive_data_detection(table_name, column_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_masking_rules_table_column 
    ON data_masking_rules(table_name, column_name);

-- Create view for security dashboard metrics
CREATE OR REPLACE VIEW security_dashboard_metrics AS
SELECT 
    'total_tables_protected' as metric_name,
    COUNT(DISTINCT table_name)::DECIMAL as metric_value,
    'count' as metric_unit,
    CURRENT_TIMESTAMP as collection_timestamp
FROM database_security_config
WHERE encryption_enabled = TRUE OR masking_enabled = TRUE OR audit_enabled = TRUE

UNION ALL

SELECT 
    'encrypted_columns' as metric_name,
    COUNT(*)::DECIMAL as metric_value,
    'count' as metric_unit,
    CURRENT_TIMESTAMP as collection_timestamp
FROM database_security_config
WHERE encryption_enabled = TRUE

UNION ALL

SELECT 
    'masked_columns' as metric_name,
    COUNT(*)::DECIMAL as metric_value,
    'count' as metric_unit,
    CURRENT_TIMESTAMP as collection_timestamp
FROM database_security_config
WHERE masking_enabled = TRUE

UNION ALL

SELECT 
    'audit_events_today' as metric_name,
    COUNT(*)::DECIMAL as metric_value,
    'count' as metric_unit,
    CURRENT_TIMESTAMP as collection_timestamp
FROM data_access_audit_log
WHERE timestamp >= CURRENT_DATE

UNION ALL

SELECT 
    'high_risk_queries_today' as metric_name,
    COUNT(*)::DECIMAL as metric_value,
    'count' as metric_unit,
    CURRENT_TIMESTAMP as collection_timestamp
FROM query_monitoring_log
WHERE risk_level IN ('high', 'critical') AND timestamp >= CURRENT_DATE;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO security_service_role;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO security_service_role;

-- Create notification for completed migration
DO $$
BEGIN
    RAISE NOTICE 'Enhanced Database Security Schema migration completed successfully';
    RAISE NOTICE 'Tables created: database_security_config, data_access_audit_log, query_monitoring_log, sensitive_data_detection, data_masking_rules, encryption_keys, backup_encryption_log, data_lineage, database_security_policies, data_classification_tags, data_classification_assignments, database_security_metrics';
    RAISE NOTICE 'Functions created: log_data_access, should_mask_column, apply_data_masking';
    RAISE NOTICE 'View created: security_dashboard_metrics';
END $$;
