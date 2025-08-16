-- Task 18 Security Framework Schema - Fixed for Integer User IDs
-- Updated to work with existing integer user IDs from comprehensive schema

-- Create security-related tables with proper foreign key references

-- User Authentication Table
CREATE TABLE IF NOT EXISTS user_authentication (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  auth_provider VARCHAR(50) NOT NULL, -- google, github, microsoft, facebook, local
  provider_user_id VARCHAR(255) NOT NULL,
  auth_data JSONB NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE,
  login_count INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(auth_provider, provider_user_id)
);

-- OAuth Tokens Table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  token_type VARCHAR(20) DEFAULT 'Bearer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- JWT Blacklist for logout functionality
CREATE TABLE IF NOT EXISTS jwt_blacklist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  jti VARCHAR(255) NOT NULL UNIQUE, -- JWT ID
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  blacklisted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255) DEFAULT 'logout',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Roles Table (Core RBAC)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permissions Table (Granular permissions)
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Role Permissions Junction Table
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  granted_by INTEGER,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(role_id, permission_id)
);

-- User Roles Junction Table
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  assigned_by INTEGER,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, role_id)
);

-- Security Sessions for enhanced session management
CREATE TABLE IF NOT EXISTS security_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Security Audit Log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Security Events for monitoring
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  affected_user_id INTEGER,
  ip_address INET,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by INTEGER,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affected_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Vulnerability Scans
CREATE TABLE IF NOT EXISTS vulnerability_scans (
  id SERIAL PRIMARY KEY,
  scan_type VARCHAR(50) NOT NULL,
  target VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  initiated_by INTEGER,
  results JSONB DEFAULT '{}',
  summary JSONB DEFAULT '{}',
  FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Vulnerabilities found during scans
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id SERIAL PRIMARY KEY,
  scan_id INTEGER NOT NULL,
  vulnerability_id VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  cvss_score DECIMAL(3,1),
  affected_component VARCHAR(255),
  remediation TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (scan_id) REFERENCES vulnerability_scans(id) ON DELETE CASCADE
);

-- Compliance Reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id SERIAL PRIMARY KEY,
  framework VARCHAR(50) NOT NULL, -- GDPR, HIPAA, SOX, PCI_DSS, ISO27001
  report_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  generated_by INTEGER,
  summary JSONB DEFAULT '{}',
  findings_count INTEGER DEFAULT 0,
  critical_findings INTEGER DEFAULT 0,
  report_data JSONB DEFAULT '{}',
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Compliance Findings
CREATE TABLE IF NOT EXISTS compliance_findings (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL,
  requirement_id VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  remediation TEXT,
  evidence JSONB DEFAULT '{}',
  due_date TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (report_id) REFERENCES compliance_reports(id) ON DELETE CASCADE
);

-- Encryption Keys Management
CREATE TABLE IF NOT EXISTS encryption_keys (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL UNIQUE,
  key_type VARCHAR(50) NOT NULL, -- AES, RSA, ECDSA
  key_size INTEGER,
  key_data TEXT NOT NULL, -- Encrypted key data
  iv TEXT,
  salt TEXT,
  algorithm VARCHAR(50),
  created_by INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rotation_policy JSONB DEFAULT '{}',
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- API Security Policies
CREATE TABLE IF NOT EXISTS api_security_policies (
  id SERIAL PRIMARY KEY,
  policy_name VARCHAR(100) NOT NULL UNIQUE,
  policy_type VARCHAR(50) NOT NULL, -- rate_limit, access_control, validation
  endpoints TEXT[] DEFAULT '{}',
  rules JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Security Configuration
CREATE TABLE IF NOT EXISTS security_configuration (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  updated_by INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_auth_provider ON user_authentication(auth_provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_user_id ON user_authentication(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_jti ON jwt_blacklist(jti);
CREATE INDEX IF NOT EXISTS idx_jwt_blacklist_expires ON jwt_blacklist(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON security_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON security_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON security_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON security_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON security_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON security_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON security_audit_log(resource);
CREATE INDEX IF NOT EXISTS idx_audit_risk ON security_audit_log(risk_score);

CREATE INDEX IF NOT EXISTS idx_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_events_created ON security_events(created_at);

CREATE INDEX IF NOT EXISTS idx_vuln_scans_type ON vulnerability_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_vuln_scans_status ON vulnerability_scans(status);
CREATE INDEX IF NOT EXISTS idx_vuln_scans_started ON vulnerability_scans(started_at);

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_scan ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_detected ON vulnerabilities(detected_at);

CREATE INDEX IF NOT EXISTS idx_compliance_framework ON compliance_reports(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_date ON compliance_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_report ON compliance_findings(report_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity);

CREATE INDEX IF NOT EXISTS idx_encryption_keys_name ON encryption_keys(key_name);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_expires ON encryption_keys(expires_at);

CREATE INDEX IF NOT EXISTS idx_api_policies_name ON api_security_policies(policy_name);
CREATE INDEX IF NOT EXISTS idx_api_policies_active ON api_security_policies(is_active);

CREATE INDEX IF NOT EXISTS idx_security_config_key ON security_configuration(config_key);

-- Security functions for cleanup and maintenance
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM jwt_blacklist WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    DELETE FROM oauth_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    
    DELETE FROM security_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_user_permissions(user_id_param INTEGER, permission_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := false;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_id_param 
        AND ur.is_active = true
        AND p.name = permission_name
        AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_security_event(
    user_id_param INTEGER,
    action_param VARCHAR,
    resource_param VARCHAR DEFAULT NULL,
    details_param JSONB DEFAULT '{}'::jsonb,
    ip_param INET DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL,
    success_param BOOLEAN DEFAULT true
)
RETURNS INTEGER AS $$
DECLARE
    log_id INTEGER;
BEGIN
    INSERT INTO security_audit_log (
        user_id, action, resource, details, ip_address, user_agent, success
    ) VALUES (
        user_id_param, action_param, resource_param, details_param, 
        ip_param, user_agent_param, success_param
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_activity(user_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE security_sessions 
    SET last_activity = CURRENT_TIMESTAMP
    WHERE user_id = user_id_param AND is_active = true;
    
    UPDATE user_authentication
    SET last_login = CURRENT_TIMESTAMP,
        login_count = login_count + 1
    WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Insert default roles
INSERT INTO roles (name, description, is_system_role, permissions) VALUES
('admin', 'Full system administrator', true, ARRAY['*']),
('user', 'Standard user', true, ARRAY['read:own', 'write:own']),
('security_admin', 'Security administrator', true, ARRAY['security:*', 'audit:read']),
('compliance_officer', 'Compliance and audit officer', true, ARRAY['compliance:*', 'audit:read', 'reports:*']),
('developer', 'System developer', true, ARRAY['api:read', 'api:write', 'debug:read']),
('guest', 'Guest user with limited access', true, ARRAY['read:public'])
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
('user:read', 'Read user information', 'user', 'read'),
('user:write', 'Modify user information', 'user', 'write'),
('user:delete', 'Delete user accounts', 'user', 'delete'),
('admin:read', 'Read admin functions', 'admin', 'read'),
('admin:write', 'Execute admin functions', 'admin', 'write'),
('security:read', 'Read security settings', 'security', 'read'),
('security:write', 'Modify security settings', 'security', 'write'),
('audit:read', 'Read audit logs', 'audit', 'read'),
('compliance:read', 'Read compliance reports', 'compliance', 'read'),
('compliance:write', 'Generate compliance reports', 'compliance', 'write'),
('api:read', 'Read via API', 'api', 'read'),
('api:write', 'Write via API', 'api', 'write'),
('reports:read', 'Read reports', 'reports', 'read'),
('reports:write', 'Generate reports', 'reports', 'write'),
('debug:read', 'Access debug information', 'debug', 'read')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'admin' 
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'user' AND p.name IN ('user:read', 'api:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'security_admin' AND p.name LIKE 'security:%' OR p.name = 'audit:read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'compliance_officer' AND (p.name LIKE 'compliance:%' OR p.name LIKE 'reports:%' OR p.name = 'audit:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'developer' AND p.name IN ('api:read', 'api:write', 'debug:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Insert default security configuration
INSERT INTO security_configuration (config_key, config_value, description) VALUES
('session_timeout', '"3600"', 'Session timeout in seconds'),
('max_login_attempts', '"5"', 'Maximum failed login attempts before lockout'),
('lockout_duration', '"900"', 'Account lockout duration in seconds'),
('password_policy', '{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_numbers": true, "require_symbols": false}', 'Password complexity requirements'),
('jwt_expiry', '"86400"', 'JWT token expiry in seconds'),
('require_2fa', 'false', 'Require two-factor authentication')
ON CONFLICT (config_key) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO robert;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO robert;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO robert;

-- Comments for documentation
COMMENT ON TABLE user_authentication IS 'User authentication data for multiple providers';
COMMENT ON TABLE oauth_tokens IS 'OAuth token storage for external providers';
COMMENT ON TABLE jwt_blacklist IS 'Blacklisted JWT tokens for secure logout';
COMMENT ON TABLE roles IS 'System roles for RBAC';
COMMENT ON TABLE permissions IS 'Granular permissions for resources';
COMMENT ON TABLE security_sessions IS 'Enhanced session management';
COMMENT ON TABLE security_audit_log IS 'Comprehensive security audit logging';
COMMENT ON TABLE security_events IS 'Security events and incidents';
COMMENT ON TABLE vulnerability_scans IS 'Automated vulnerability scanning results';
COMMENT ON TABLE compliance_reports IS 'Compliance framework reports';
COMMENT ON TABLE encryption_keys IS 'Encryption key management';
COMMENT ON TABLE api_security_policies IS 'API security policy configuration';
COMMENT ON TABLE security_configuration IS 'Security system configuration';

-- Ensure robert user has full access
ALTER TABLE user_authentication OWNER TO robert;
ALTER TABLE oauth_tokens OWNER TO robert;
ALTER TABLE jwt_blacklist OWNER TO robert;
ALTER TABLE roles OWNER TO robert;
ALTER TABLE permissions OWNER TO robert;
ALTER TABLE role_permissions OWNER TO robert;
ALTER TABLE user_roles OWNER TO robert;
ALTER TABLE security_sessions OWNER TO robert;
ALTER TABLE security_audit_log OWNER TO robert;
ALTER TABLE security_events OWNER TO robert;
ALTER TABLE vulnerability_scans OWNER TO robert;
ALTER TABLE vulnerabilities OWNER TO robert;
ALTER TABLE compliance_reports OWNER TO robert;
ALTER TABLE compliance_findings OWNER TO robert;
ALTER TABLE encryption_keys OWNER TO robert;
ALTER TABLE api_security_policies OWNER TO robert;
ALTER TABLE security_configuration OWNER TO robert;
