-- Security Incident Response System Database Schema
-- Comprehensive incident tracking, response automation, and forensic evidence collection
-- Migration: 24_security_incident_response_schema.sql
-- Date: August 16, 2025

-- Security Incidents table
CREATE TABLE IF NOT EXISTS security_incidents (
    id UUID PRIMARY KEY,
    incident_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'responding', 'contained', 'resolved', 'false_positive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    max_response_time INTEGER, -- Maximum response time in seconds
    actual_response_time INTEGER, -- Actual response time in seconds
    
    -- Source information
    source_data JSONB, -- Original event data that triggered the incident
    source_system VARCHAR(100), -- System that detected the incident
    
    -- Classification and analysis
    classification JSONB, -- Threat classification, affected systems, impact assessment
    threat_indicators JSONB, -- IOCs, threat signatures, behavioral patterns
    
    -- Assignment and ownership
    assigned_to INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    assigned_by INTEGER REFERENCES users(id),
    
    -- Response tracking
    auto_actions_taken JSONB DEFAULT '[]', -- Automated actions executed
    manual_actions_required JSONB DEFAULT '[]', -- Manual actions needed
    manual_actions_completed JSONB DEFAULT '[]', -- Manual actions completed
    
    -- Escalation
    escalation_level INTEGER DEFAULT 0,
    escalated_at TIMESTAMP WITH TIME ZONE,
    escalation_reason VARCHAR(500),
    
    -- Resolution
    resolution_notes TEXT,
    resolution_method VARCHAR(100), -- How the incident was resolved
    false_positive_reason TEXT,
    
    -- Metrics
    containment_time INTEGER, -- Time to contain the incident (seconds)
    investigation_time INTEGER, -- Time spent investigating (seconds)
    
    -- Audit trail
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Incident response actions log
CREATE TABLE IF NOT EXISTS incident_response_actions (
    id SERIAL PRIMARY KEY,
    incident_id UUID REFERENCES security_incidents(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    action_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (action_status IN ('pending', 'executing', 'completed', 'failed', 'cancelled')),
    
    -- Action details
    action_description TEXT,
    action_config JSONB, -- Configuration parameters for the action
    
    -- Execution tracking
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time INTEGER, -- Execution time in milliseconds
    
    -- Results
    result_data JSONB, -- Action execution results
    error_message TEXT,
    
    -- Automation vs manual
    is_automated BOOLEAN DEFAULT FALSE,
    executed_by INTEGER REFERENCES users(id), -- NULL for automated actions
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Forensic evidence collection
CREATE TABLE IF NOT EXISTS forensic_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES security_incidents(id) ON DELETE CASCADE,
    
    -- Evidence details
    evidence_type VARCHAR(100) NOT NULL, -- 'network_logs', 'system_state', 'user_activity', 'database_logs', etc.
    evidence_description TEXT,
    evidence_data JSONB, -- The actual evidence data
    evidence_hash VARCHAR(64), -- SHA-256 hash of evidence for integrity
    
    -- Collection metadata
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    collected_by INTEGER REFERENCES users(id), -- NULL for automated collection
    collection_method VARCHAR(100), -- 'automated', 'manual', 'api_extraction', etc.
    
    -- Chain of custody
    custody_log JSONB DEFAULT '[]', -- Array of custody transfers
    
    -- Evidence integrity and retention
    is_tampered BOOLEAN DEFAULT FALSE,
    tamper_detection_method VARCHAR(100),
    retention_period INTEGER DEFAULT 2592000, -- 30 days default retention in seconds
    retention_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Storage and access
    storage_location VARCHAR(500), -- Where the evidence is stored
    access_log JSONB DEFAULT '[]', -- Who accessed the evidence and when
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Incident escalation history
CREATE TABLE IF NOT EXISTS incident_escalations (
    id SERIAL PRIMARY KEY,
    incident_id UUID REFERENCES security_incidents(id) ON DELETE CASCADE,
    
    -- Escalation details
    escalation_level INTEGER NOT NULL,
    escalation_reason TEXT NOT NULL,
    escalated_from INTEGER, -- Previous escalation level
    escalated_to INTEGER, -- New escalation level
    
    -- Notification details
    notified_parties JSONB, -- Array of notified users/groups
    notification_method VARCHAR(50), -- 'email', 'sms', 'slack', 'pager', etc.
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Response tracking
    response_required BOOLEAN DEFAULT TRUE,
    response_deadline TIMESTAMP WITH TIME ZONE,
    response_received_at TIMESTAMP WITH TIME ZONE,
    response_notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    escalated_by INTEGER REFERENCES users(id)
);

-- Incident response playbooks
CREATE TABLE IF NOT EXISTS incident_response_playbooks (
    id SERIAL PRIMARY KEY,
    playbook_name VARCHAR(200) NOT NULL UNIQUE,
    incident_type VARCHAR(100) NOT NULL,
    severity_level VARCHAR(20) NOT NULL,
    
    -- Playbook content
    description TEXT,
    auto_actions JSONB DEFAULT '[]', -- Automated actions to execute
    manual_actions JSONB DEFAULT '[]', -- Manual actions required
    escalation_rules JSONB DEFAULT '[]', -- When to escalate
    
    -- Timing and prioritization
    max_response_time INTEGER, -- Maximum response time in seconds
    priority_boost INTEGER DEFAULT 0, -- Adjustment to base priority
    
    -- Conditions and triggers
    trigger_conditions JSONB, -- Conditions that activate this playbook
    prerequisite_checks JSONB DEFAULT '[]', -- Checks before executing actions
    
    -- Effectiveness tracking
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2), -- Success rate percentage
    avg_resolution_time INTEGER, -- Average resolution time in seconds
    
    -- Versioning and management
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Incident response metrics and KPIs
CREATE TABLE IF NOT EXISTS security_incident_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    
    -- Incident volume metrics
    total_incidents INTEGER DEFAULT 0,
    critical_incidents INTEGER DEFAULT 0,
    high_incidents INTEGER DEFAULT 0,
    medium_incidents INTEGER DEFAULT 0,
    low_incidents INTEGER DEFAULT 0,
    
    -- Response time metrics
    avg_response_time DECIMAL(10,2), -- Average response time in seconds
    avg_containment_time DECIMAL(10,2), -- Average containment time in seconds
    avg_resolution_time DECIMAL(10,2), -- Average resolution time in seconds
    
    -- Resolution metrics
    resolved_incidents INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    unresolved_incidents INTEGER DEFAULT 0,
    escalated_incidents INTEGER DEFAULT 0,
    
    -- Automation metrics
    automated_actions_executed INTEGER DEFAULT 0,
    automated_actions_failed INTEGER DEFAULT 0,
    automation_success_rate DECIMAL(5,2),
    
    -- Effectiveness metrics
    incidents_resolved_within_sla INTEGER DEFAULT 0,
    sla_compliance_rate DECIMAL(5,2),
    
    -- Threat intelligence
    unique_threat_types INTEGER DEFAULT 0,
    repeat_incidents INTEGER DEFAULT 0, -- Same threat type as previous incidents
    
    -- Resource utilization
    total_investigation_hours DECIMAL(10,2),
    total_response_hours DECIMAL(10,2),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(metric_date)
);

-- Incident threat intelligence
CREATE TABLE IF NOT EXISTS incident_threat_intelligence (
    id SERIAL PRIMARY KEY,
    incident_id UUID REFERENCES security_incidents(id) ON DELETE CASCADE,
    
    -- Threat details
    threat_type VARCHAR(100) NOT NULL,
    threat_source VARCHAR(200), -- Source of the threat intelligence
    confidence_level VARCHAR(20) CHECK (confidence_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Indicators of Compromise (IOCs)
    ioc_type VARCHAR(50), -- 'ip', 'domain', 'hash', 'url', 'email', etc.
    ioc_value TEXT NOT NULL,
    ioc_context TEXT, -- Additional context about the IOC
    
    -- Threat attribution
    threat_actor VARCHAR(200),
    campaign_name VARCHAR(200),
    attack_technique VARCHAR(200), -- MITRE ATT&CK technique
    attack_tactic VARCHAR(200), -- MITRE ATT&CK tactic
    
    -- Intelligence metadata
    first_seen TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    intelligence_source VARCHAR(200), -- Which feed/source provided this intel
    intelligence_reliability VARCHAR(20), -- Reliability of the source
    
    -- Correlation and relationships
    related_incidents UUID[], -- Array of related incident IDs
    correlation_score DECIMAL(3,2), -- How closely related to this incident (0-1)
    
    -- Action taken
    action_taken VARCHAR(200), -- What action was taken based on this intelligence
    blocked_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Incident communication log
CREATE TABLE IF NOT EXISTS incident_communications (
    id SERIAL PRIMARY KEY,
    incident_id UUID REFERENCES security_incidents(id) ON DELETE CASCADE,
    
    -- Communication details
    communication_type VARCHAR(50) NOT NULL, -- 'email', 'slack', 'teams', 'sms', 'call', etc.
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    
    -- Recipients and participants
    recipients JSONB, -- Array of recipient information
    sender_id INTEGER REFERENCES users(id),
    
    -- Message content
    subject VARCHAR(500),
    message_body TEXT,
    message_template VARCHAR(200), -- Template used if applicable
    
    -- Delivery tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    response_received_at TIMESTAMP WITH TIME ZONE,
    
    -- Context and categorization
    communication_purpose VARCHAR(100), -- 'notification', 'update', 'escalation', 'resolution', etc.
    priority_level VARCHAR(20),
    
    -- Attachments and references
    attachments JSONB DEFAULT '[]',
    referenced_evidence_ids UUID[],
    
    -- Status tracking
    delivery_status VARCHAR(50) DEFAULT 'pending',
    delivery_errors TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at ON security_incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_assigned_to ON security_incidents(assigned_to);

CREATE INDEX IF NOT EXISTS idx_incident_response_actions_incident_id ON incident_response_actions(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_response_actions_type ON incident_response_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_incident_response_actions_status ON incident_response_actions(action_status);

CREATE INDEX IF NOT EXISTS idx_forensic_evidence_incident_id ON forensic_evidence(incident_id);
CREATE INDEX IF NOT EXISTS idx_forensic_evidence_type ON forensic_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_forensic_evidence_collected_at ON forensic_evidence(collected_at);

CREATE INDEX IF NOT EXISTS idx_incident_escalations_incident_id ON incident_escalations(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_level ON incident_escalations(escalation_level);

CREATE INDEX IF NOT EXISTS idx_incident_threat_intel_incident_id ON incident_threat_intelligence(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_threat_intel_ioc_value ON incident_threat_intelligence(ioc_value);
CREATE INDEX IF NOT EXISTS idx_incident_threat_intel_threat_type ON incident_threat_intelligence(threat_type);

CREATE INDEX IF NOT EXISTS idx_incident_communications_incident_id ON incident_communications(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_communications_type ON incident_communications(communication_type);

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_incident_response_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers
CREATE TRIGGER update_security_incidents_timestamp
    BEFORE UPDATE ON security_incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_response_timestamp();

CREATE TRIGGER update_incident_response_actions_timestamp
    BEFORE UPDATE ON incident_response_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_response_timestamp();

CREATE TRIGGER update_forensic_evidence_timestamp
    BEFORE UPDATE ON forensic_evidence
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_response_timestamp();

CREATE TRIGGER update_incident_response_playbooks_timestamp
    BEFORE UPDATE ON incident_response_playbooks
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_response_timestamp();

CREATE TRIGGER update_security_incident_metrics_timestamp
    BEFORE UPDATE ON security_incident_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_response_timestamp();

CREATE TRIGGER update_incident_threat_intelligence_timestamp
    BEFORE UPDATE ON incident_threat_intelligence
    FOR EACH ROW
    EXECUTE FUNCTION update_incident_response_timestamp();

-- Insert default incident response playbooks
INSERT INTO incident_response_playbooks (playbook_name, incident_type, severity_level, description, auto_actions, manual_actions, max_response_time) VALUES
('SQL Injection Response', 'sql_injection', 'critical', 'Automated response for SQL injection attempts', 
 '[{"type": "block_ip", "duration": 3600}, {"type": "disable_user_session"}, {"type": "alert_security_team"}, {"type": "log_forensic_data"}]',
 '["Review query logs for additional suspicious activity", "Analyze application logs for potential code vulnerabilities", "Consider blocking user account pending investigation"]',
 300), -- 5 minutes

('Brute Force Attack Response', 'brute_force', 'high', 'Response for detected brute force login attempts',
 '[{"type": "rate_limit_ip", "multiplier": 10}, {"type": "temporary_account_lock", "duration": 1800}, {"type": "alert_user_security_event"}, {"type": "log_forensic_data"}]',
 '["Review authentication logs for patterns", "Check for compromised credentials in breach databases", "Consider implementing additional MFA requirements"]',
 900), -- 15 minutes

('Data Exfiltration Response', 'data_exfiltration', 'critical', 'Response for suspected data exfiltration attempts',
 '[{"type": "block_user_access"}, {"type": "quarantine_session"}, {"type": "alert_security_team", "urgency": "immediate"}, {"type": "preserve_forensic_evidence"}]',
 '["Identify scope of potentially compromised data", "Assess legal notification requirements", "Coordinate with legal and compliance teams", "Prepare incident disclosure if required"]',
 300), -- 5 minutes

('Privilege Escalation Response', 'privilege_escalation', 'high', 'Response for unauthorized privilege escalation attempts',
 '[{"type": "revoke_elevated_permissions"}, {"type": "force_session_logout"}, {"type": "alert_administrators"}, {"type": "audit_permission_history"}]',
 '["Review role assignments and permissions", "Verify integrity of role-based access controls", "Investigate potential insider threat indicators"]',
 900), -- 15 minutes

('Anomalous Access Response', 'anomalous_access', 'medium', 'Response for unusual access patterns or locations',
 '[{"type": "require_additional_auth"}, {"type": "log_detailed_activity"}, {"type": "alert_user_suspicious_activity"}]',
 '["Verify user location and device", "Review recent account activity", "Consider implementing geolocation restrictions"]',
 3600); -- 1 hour

-- Create incident response dashboard metrics view
CREATE OR REPLACE VIEW incident_response_dashboard_metrics AS
SELECT 
    -- Current active incidents
    COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'false_positive')) as active_incidents,
    COUNT(*) FILTER (WHERE status = 'critical') as critical_active,
    COUNT(*) FILTER (WHERE status = 'high') as high_active,
    
    -- Today's incidents
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as incidents_today,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND severity = 'critical') as critical_today,
    
    -- Response time metrics (today)
    AVG(actual_response_time) FILTER (WHERE created_at >= CURRENT_DATE AND actual_response_time IS NOT NULL) as avg_response_time_today,
    AVG(containment_time) FILTER (WHERE created_at >= CURRENT_DATE AND containment_time IS NOT NULL) as avg_containment_time_today,
    
    -- SLA compliance (today)
    ROUND(
        (COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND actual_response_time <= max_response_time) * 100.0 / 
         NULLIF(COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND actual_response_time IS NOT NULL), 0)), 2
    ) as sla_compliance_rate_today,
    
    -- Automation effectiveness (today)
    COUNT(DISTINCT ira.incident_id) FILTER (WHERE ira.is_automated = TRUE AND ira.created_at >= CURRENT_DATE) as automated_responses_today,
    ROUND(
        (COUNT(*) FILTER (WHERE ira.is_automated = TRUE AND ira.action_status = 'completed' AND ira.created_at >= CURRENT_DATE) * 100.0 /
         NULLIF(COUNT(*) FILTER (WHERE ira.is_automated = TRUE AND ira.created_at >= CURRENT_DATE), 0)), 2
    ) as automation_success_rate_today,
    
    -- Most common incident types (last 7 days)
    mode() WITHIN GROUP (ORDER BY incident_type) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as most_common_incident_type,
    
    -- Escalation rate (last 7 days)
    ROUND(
        (COUNT(*) FILTER (WHERE escalation_level > 0 AND created_at >= CURRENT_DATE - INTERVAL '7 days') * 100.0 /
         NULLIF(COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'), 0)), 2
    ) as escalation_rate_weekly
FROM security_incidents si
LEFT JOIN incident_response_actions ira ON si.id = ira.incident_id;

-- Grant appropriate permissions (adjust based on your user roles)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO incident_responders;
-- GRANT SELECT ON incident_response_dashboard_metrics TO security_monitors;
