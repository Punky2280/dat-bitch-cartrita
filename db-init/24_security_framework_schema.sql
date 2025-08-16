-- Migration 24: Security Framework Schema - Task 18
-- Comprehensive security database schema for OAuth, JWT, RBAC, audit logging, and compliance

-- User Authentication Table (Enhanced)
CREATE TABLE IF NOT EXISTS user_authentication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    auth_type VARCHAR(50) NOT NULL DEFAULT 'local', -- local, oauth, saml, ldap
    provider VARCHAR(100), -- google, github, microsoft, etc.
    provider_user_id VARCHAR(255),
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT,
    password_salt VARCHAR(255),
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    backup_codes TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_user_auth_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    UNIQUE(provider, provider_user_id)
);

-- OAuth Tokens Table
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider VARCHAR(100) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT fk_oauth_tokens_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- JWT Token Blacklist
CREATE TABLE IF NOT EXISTS jwt_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID claim
    user_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason VARCHAR(255) DEFAULT 'logout',
    
    CONSTRAINT fk_jwt_blacklist_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Roles and Permissions (RBAC)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL, -- users, documents, workflows, etc.
    action VARCHAR(50) NOT NULL, -- create, read, update, delete, execute, etc.
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Role-Permission Many-to-Many
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID,
    
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) 
        REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) 
        REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_granted_by FOREIGN KEY (granted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(role_id, permission_id)
);

-- User-Role Many-to-Many
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) 
        REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(user_id, role_id)
);

-- Security Sessions
CREATE TABLE IF NOT EXISTS security_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    device_fingerprint VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    location JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    csrf_token VARCHAR(255),
    
    CONSTRAINT fk_security_sessions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- Security Audit Log
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID,
    session_id UUID,
    resource VARCHAR(100),
    action VARCHAR(100),
    outcome VARCHAR(50), -- success, failure, blocked
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, error, critical
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    correlation_id UUID,
    
    CONSTRAINT fk_audit_log_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_log_session FOREIGN KEY (session_id) 
        REFERENCES security_sessions(id) ON DELETE SET NULL
);

-- Security Events and Incidents
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved, false_positive
    title VARCHAR(255) NOT NULL,
    description TEXT,
    affected_users UUID[],
    source_ip INET,
    detection_method VARCHAR(100),
    first_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolution_notes TEXT,
    event_data JSONB DEFAULT '{}',
    
    CONSTRAINT fk_security_events_resolved_by FOREIGN KEY (resolved_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Vulnerability Scans
CREATE TABLE IF NOT EXISTS vulnerability_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_type VARCHAR(50) NOT NULL, -- automated, manual, penetration
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    scan_configuration JSONB DEFAULT '{}',
    vulnerabilities_found INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    scan_results JSONB DEFAULT '{}',
    recommendations TEXT[],
    initiated_by UUID,
    
    CONSTRAINT fk_vulnerability_scans_user FOREIGN KEY (initiated_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Individual Vulnerabilities
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL,
    vulnerability_id VARCHAR(255), -- CVE ID or custom ID
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    cvss_score DECIMAL(3,1),
    category VARCHAR(100),
    affected_component VARCHAR(255),
    location VARCHAR(500),
    cwe_id VARCHAR(20), -- Common Weakness Enumeration
    remediation TEXT,
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, accepted_risk
    first_found TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    false_positive BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT fk_vulnerabilities_scan FOREIGN KEY (scan_id) 
        REFERENCES vulnerability_scans(id) ON DELETE CASCADE
);

-- Compliance Reports
CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(100) NOT NULL, -- gdpr, hipaa, sox, pci_dss, iso27001
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    overall_score INTEGER, -- 0-100
    compliance_status VARCHAR(50), -- compliant, non_compliant, partial
    findings INTEGER DEFAULT 0,
    recommendations INTEGER DEFAULT 0,
    report_data JSONB DEFAULT '{}',
    generated_by UUID,
    
    CONSTRAINT fk_compliance_reports_user FOREIGN KEY (generated_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Compliance Findings
CREATE TABLE IF NOT EXISTS compliance_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL,
    finding_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requirement VARCHAR(255), -- Specific compliance requirement
    current_state VARCHAR(255),
    required_state VARCHAR(255),
    remediation_steps TEXT[],
    deadline TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'open',
    assigned_to UUID,
    
    CONSTRAINT fk_compliance_findings_report FOREIGN KEY (report_id) 
        REFERENCES compliance_reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_compliance_findings_assigned FOREIGN KEY (assigned_to) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Encryption Keys Management
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(255) UNIQUE NOT NULL,
    key_type VARCHAR(50) NOT NULL, -- aes, rsa, ec
    algorithm VARCHAR(100) NOT NULL,
    key_size INTEGER,
    purpose VARCHAR(100) NOT NULL, -- data_encryption, signing, authentication
    encrypted_key TEXT NOT NULL,
    public_key TEXT, -- For asymmetric keys
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    rotated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    
    CONSTRAINT fk_encryption_keys_user FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- API Security Policies
CREATE TABLE IF NOT EXISTS api_security_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(255) UNIQUE NOT NULL,
    resource_pattern VARCHAR(500), -- URL pattern or resource identifier
    method VARCHAR(10), -- GET, POST, PUT, DELETE, etc.
    required_roles VARCHAR(255)[],
    required_permissions VARCHAR(255)[],
    rate_limit_requests INTEGER,
    rate_limit_window INTEGER, -- in seconds
    require_authentication BOOLEAN DEFAULT TRUE,
    require_authorization BOOLEAN DEFAULT TRUE,
    allow_anonymous BOOLEAN DEFAULT FALSE,
    ip_whitelist INET[],
    ip_blacklist INET[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT fk_api_policies_user FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Security Configuration
CREATE TABLE IF NOT EXISTS security_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    config_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID,
    
    CONSTRAINT fk_security_config_user FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance optimization

-- Authentication indexes
CREATE INDEX IF NOT EXISTS idx_user_auth_user_id ON user_authentication(user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_username ON user_authentication(username);
CREATE INDEX IF NOT EXISTS idx_user_auth_email ON user_authentication(email);
CREATE INDEX IF NOT EXISTS idx_user_auth_provider ON user_authentication(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_active ON user_authentication(is_active, last_login_at);

-- OAuth tokens indexes
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_active ON oauth_tokens(is_active, expires_at);

-- JWT blacklist indexes
CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_jti ON jwt_blacklist(token_jti);
CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_expires ON jwt_blacklist(expires_at);

-- RBAC indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active, expires_at);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_security_sessions_user ON security_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_sessions_session_id ON security_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_security_sessions_active ON security_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_security_sessions_activity ON security_sessions(last_activity DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON security_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON security_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_audit_log_outcome ON security_audit_log(outcome);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_status ON security_events(status);
CREATE INDEX IF NOT EXISTS idx_security_events_detected ON security_events(first_detected DESC);

-- Vulnerability scan indexes
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_type ON vulnerability_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_status ON vulnerability_scans(status);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_started ON vulnerability_scans(started_at DESC);

-- Vulnerabilities indexes
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_scan ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_cve ON vulnerabilities(vulnerability_id);

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_compliance_reports_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_generated ON compliance_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_report ON compliance_findings(report_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity);

-- Encryption keys indexes
CREATE INDEX IF NOT EXISTS idx_encryption_keys_key_id ON encryption_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_purpose ON encryption_keys(purpose);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(is_active, expires_at);

-- API policies indexes
CREATE INDEX IF NOT EXISTS idx_api_policies_resource ON api_security_policies(resource_pattern);
CREATE INDEX IF NOT EXISTS idx_api_policies_active ON api_security_policies(is_active);

-- Configuration indexes
CREATE INDEX IF NOT EXISTS idx_security_config_key ON security_configuration(config_key);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_security_sessions_location ON security_sessions USING GIN(location);
CREATE INDEX IF NOT EXISTS idx_audit_log_details ON security_audit_log USING GIN(details);
CREATE INDEX IF NOT EXISTS idx_security_events_data ON security_events USING GIN(event_data);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_results ON vulnerability_scans USING GIN(scan_results);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_data ON compliance_reports USING GIN(report_data);

-- Functions for security management

-- Function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(
    user_uuid UUID, 
    resource_name VARCHAR(100), 
    action_name VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    SELECT COUNT(*) > 0 INTO has_permission
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_uuid
        AND ur.is_active = TRUE
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND p.resource = resource_name
        AND p.action = action_name;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- Function to log security audit events
CREATE OR REPLACE FUNCTION log_security_audit(
    event_type_param VARCHAR(100),
    user_id_param UUID DEFAULT NULL,
    session_id_param UUID DEFAULT NULL,
    resource_param VARCHAR(100) DEFAULT NULL,
    action_param VARCHAR(100) DEFAULT NULL,
    outcome_param VARCHAR(50) DEFAULT 'success',
    severity_param VARCHAR(20) DEFAULT 'info',
    details_param JSONB DEFAULT '{}'::jsonb,
    ip_address_param INET DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO security_audit_log (
        event_type, user_id, session_id, resource, action, 
        outcome, severity, details, ip_address, user_agent
    ) VALUES (
        event_type_param, user_id_param, session_id_param, 
        resource_param, action_param, outcome_param, 
        severity_param, details_param, ip_address_param, user_agent_param
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired tokens and sessions
CREATE OR REPLACE FUNCTION cleanup_expired_security_data()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- Clean up expired JWT blacklist entries
    DELETE FROM jwt_blacklist WHERE expires_at < NOW();
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Clean up expired OAuth tokens
    UPDATE oauth_tokens 
    SET is_active = FALSE 
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- Clean up expired sessions
    UPDATE security_sessions 
    SET is_active = FALSE 
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- Clean up old audit logs (keep last 90 days)
    DELETE FROM security_audit_log 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate security metrics
CREATE OR REPLACE FUNCTION get_security_metrics(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    metric_name TEXT,
    metric_value INTEGER,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'active_sessions'::TEXT, 
           COUNT(*)::INTEGER, 
           'Number of active user sessions'::TEXT
    FROM security_sessions 
    WHERE is_active = TRUE AND expires_at > NOW()
    
    UNION ALL
    
    SELECT 'failed_logins'::TEXT,
           COUNT(*)::INTEGER,
           'Failed login attempts in period'::TEXT
    FROM security_audit_log
    WHERE event_type = 'login_attempt' 
        AND outcome = 'failure'
        AND timestamp BETWEEN start_date AND end_date
    
    UNION ALL
    
    SELECT 'security_events'::TEXT,
           COUNT(*)::INTEGER,
           'Security events in period'::TEXT
    FROM security_events
    WHERE first_detected BETWEEN start_date AND end_date
    
    UNION ALL
    
    SELECT 'critical_vulnerabilities'::TEXT,
           COUNT(*)::INTEGER,
           'Critical vulnerabilities found'::TEXT
    FROM vulnerabilities
    WHERE severity = 'critical' AND status = 'open';
END;
$$ LANGUAGE plpgsql;

-- Insert default roles and permissions
INSERT INTO roles (name, display_name, description, is_system) VALUES
    ('super_admin', 'Super Administrator', 'Full system access with all privileges', true),
    ('admin', 'Administrator', 'Administrative access to most system functions', true),
    ('security_admin', 'Security Administrator', 'Security management and monitoring', true),
    ('auditor', 'Auditor', 'Read-only access to audit logs and compliance data', true),
    ('editor', 'Editor', 'Content creation and editing capabilities', true),
    ('viewer', 'Viewer', 'Read-only access to permitted resources', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, resource, action, description, is_system) VALUES
    ('users.create', 'users', 'create', 'Create new user accounts', true),
    ('users.read', 'users', 'read', 'View user information', true),
    ('users.update', 'users', 'update', 'Modify user accounts', true),
    ('users.delete', 'users', 'delete', 'Delete user accounts', true),
    ('security.read', 'security', 'read', 'View security logs and events', true),
    ('security.manage', 'security', 'manage', 'Manage security policies and settings', true),
    ('audit.read', 'audit', 'read', 'View audit logs', true),
    ('compliance.read', 'compliance', 'read', 'View compliance reports', true),
    ('compliance.generate', 'compliance', 'generate', 'Generate compliance reports', true),
    ('vulnerabilities.read', 'vulnerabilities', 'read', 'View vulnerability scans', true),
    ('vulnerabilities.scan', 'vulnerabilities', 'scan', 'Initiate vulnerability scans', true),
    ('documents.create', 'documents', 'create', 'Create documents', true),
    ('documents.read', 'documents', 'read', 'Read documents', true),
    ('documents.update', 'documents', 'update', 'Edit documents', true),
    ('documents.delete', 'documents', 'delete', 'Delete documents', true)
ON CONFLICT (name) DO NOTHING;

-- Grant permissions to default roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'super_admin' -- Super admin gets all permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'admin' 
    AND p.name IN ('users.read', 'users.update', 'documents.create', 'documents.read', 'documents.update', 'documents.delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'security_admin' 
    AND p.name IN ('security.read', 'security.manage', 'audit.read', 'vulnerabilities.read', 'vulnerabilities.scan')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'auditor' 
    AND p.name IN ('audit.read', 'compliance.read', 'security.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'editor' 
    AND p.name IN ('documents.create', 'documents.read', 'documents.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'viewer' 
    AND p.name IN ('documents.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Insert default security configuration
INSERT INTO security_configuration (config_key, config_value, config_type, description, is_sensitive) VALUES
    ('jwt_expires_in', '7200', 'number', 'JWT token expiration time in seconds', false),
    ('jwt_refresh_expires_in', '604800', 'number', 'JWT refresh token expiration time in seconds', false),
    ('max_login_attempts', '5', 'number', 'Maximum failed login attempts before account lockout', false),
    ('account_lockout_duration', '1800', 'number', 'Account lockout duration in seconds', false),
    ('session_timeout', '7200', 'number', 'User session timeout in seconds', false),
    ('password_min_length', '8', 'number', 'Minimum password length', false),
    ('require_2fa_admin', 'true', 'boolean', 'Require two-factor authentication for admin users', false),
    ('vulnerability_scan_interval', '86400', 'number', 'Vulnerability scan interval in seconds', false),
    ('compliance_report_interval', '604800', 'number', 'Compliance report generation interval in seconds', false)
ON CONFLICT (config_key) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Comments for documentation
COMMENT ON TABLE user_authentication IS 'Enhanced user authentication with OAuth and MFA support';
COMMENT ON TABLE oauth_tokens IS 'OAuth 2.0 access and refresh token storage';
COMMENT ON TABLE jwt_blacklist IS 'Blacklisted JWT tokens for logout and revocation';
COMMENT ON TABLE roles IS 'RBAC role definitions';
COMMENT ON TABLE permissions IS 'RBAC permission definitions';
COMMENT ON TABLE security_sessions IS 'Active user sessions with device tracking';
COMMENT ON TABLE security_audit_log IS 'Comprehensive security audit logging';
COMMENT ON TABLE security_events IS 'Security incidents and events tracking';
COMMENT ON TABLE vulnerability_scans IS 'Automated security vulnerability scans';
COMMENT ON TABLE compliance_reports IS 'Regulatory compliance reports and findings';
COMMENT ON TABLE encryption_keys IS 'Cryptographic key management';
COMMENT ON TABLE api_security_policies IS 'API endpoint security policies';

COMMENT ON FUNCTION check_user_permission(UUID, VARCHAR, VARCHAR) IS 'Check if user has specific permission';
COMMENT ON FUNCTION log_security_audit IS 'Log security audit events with full context';
COMMENT ON FUNCTION cleanup_expired_security_data() IS 'Clean up expired tokens, sessions, and old audit logs';
COMMENT ON FUNCTION get_security_metrics IS 'Generate security metrics for monitoring dashboard';
