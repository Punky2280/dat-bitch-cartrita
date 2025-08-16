-- Migration: 25_comprehensive_security_testing_schema.sql
-- Purpose: Database schema for comprehensive security testing suite
-- Author: Robbie Allen - Lead Architect
-- Date: August 16, 2025

-- Security test runs tracking
CREATE TABLE IF NOT EXISTS security_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id VARCHAR(100) NOT NULL,
    suite_name VARCHAR(200) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, error
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    test_count INTEGER NOT NULL DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,
    tests_errors INTEGER DEFAULT 0,
    tests_warnings INTEGER DEFAULT 0,
    tests_skipped INTEGER DEFAULT 0,
    vulnerabilities_found INTEGER DEFAULT 0,
    error_message TEXT,
    triggered_by VARCHAR(100), -- user_id or 'system' for scheduled tests
    configuration JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual test results
CREATE TABLE IF NOT EXISTS security_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES security_test_runs(id) ON DELETE CASCADE,
    test_id VARCHAR(100) NOT NULL,
    test_name VARCHAR(200) NOT NULL,
    status VARCHAR(50) NOT NULL, -- passed, failed, error, warning, skipped
    duration_ms INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message TEXT,
    error_message TEXT,
    details JSONB DEFAULT '{}',
    vulnerabilities_found INTEGER DEFAULT 0,
    artifacts_path TEXT, -- Path to test artifacts (screenshots, logs, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vulnerability findings from security tests
CREATE TABLE IF NOT EXISTS security_test_vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES security_test_runs(id) ON DELETE CASCADE,
    test_result_id UUID REFERENCES security_test_results(id) ON DELETE CASCADE,
    vulnerability_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- critical, high, medium, low
    title VARCHAR(300) NOT NULL,
    description TEXT,
    impact TEXT,
    remediation TEXT,
    affected_endpoint TEXT,
    affected_file TEXT,
    affected_line INTEGER,
    payload TEXT, -- Test payload that triggered the vulnerability
    evidence JSONB DEFAULT '{}', -- Screenshots, logs, response data
    cvss_score DECIMAL(3,1),
    cve_id VARCHAR(50),
    status VARCHAR(50) DEFAULT 'open', -- open, investigating, fixed, false_positive, accepted
    assigned_to VARCHAR(100),
    fix_priority INTEGER DEFAULT 3, -- 1=critical, 2=high, 3=medium, 4=low
    estimated_fix_effort VARCHAR(50), -- hours, days, weeks
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Security test reports
CREATE TABLE IF NOT EXISTS security_test_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES security_test_runs(id) ON DELETE CASCADE,
    report_data JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    overall_risk VARCHAR(20) NOT NULL, -- critical, high, medium, low
    risk_score INTEGER NOT NULL DEFAULT 0, -- 0-100
    vulnerabilities_count INTEGER DEFAULT 0,
    recommendations_count INTEGER DEFAULT 0,
    compliance_status VARCHAR(50), -- compliant, mostly_compliant, partially_compliant, non_compliant
    report_format VARCHAR(20) DEFAULT 'json', -- json, pdf, html
    file_path TEXT, -- Path to generated report file
    shared_with TEXT[], -- Array of user IDs or emails who have access
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Security test schedules and automation
CREATE TABLE IF NOT EXISTS security_test_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id VARCHAR(100) NOT NULL,
    suite_name VARCHAR(200) NOT NULL,
    schedule_expression VARCHAR(100) NOT NULL, -- Cron expression
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    configuration JSONB DEFAULT '{}',
    notification_emails TEXT[],
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Security testing metrics and KPIs
CREATE TABLE IF NOT EXISTS security_test_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES security_test_runs(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    metric_unit VARCHAR(50),
    metric_category VARCHAR(50), -- performance, coverage, effectiveness, compliance
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Security test configurations and templates
CREATE TABLE IF NOT EXISTS security_test_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    suite_id VARCHAR(100) NOT NULL,
    configuration JSONB NOT NULL,
    is_template BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Security test artifacts (screenshots, logs, evidence)
CREATE TABLE IF NOT EXISTS security_test_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES security_test_runs(id) ON DELETE CASCADE,
    test_result_id UUID REFERENCES security_test_results(id) ON DELETE CASCADE,
    vulnerability_id UUID REFERENCES security_test_vulnerabilities(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL, -- screenshot, log, report, evidence, payload
    file_name VARCHAR(300) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_test_runs_suite_status 
    ON security_test_runs(suite_id, status);
CREATE INDEX IF NOT EXISTS idx_security_test_runs_started_at 
    ON security_test_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_security_test_runs_status_duration 
    ON security_test_runs(status, duration_ms);

CREATE INDEX IF NOT EXISTS idx_security_test_results_test_run 
    ON security_test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_security_test_results_status 
    ON security_test_results(status);

CREATE INDEX IF NOT EXISTS idx_security_test_vulnerabilities_run_severity 
    ON security_test_vulnerabilities(test_run_id, severity);
CREATE INDEX IF NOT EXISTS idx_security_test_vulnerabilities_type_status 
    ON security_test_vulnerabilities(vulnerability_type, status);
CREATE INDEX IF NOT EXISTS idx_security_test_vulnerabilities_severity_priority 
    ON security_test_vulnerabilities(severity, fix_priority);

CREATE INDEX IF NOT EXISTS idx_security_test_reports_risk_score 
    ON security_test_reports(overall_risk, risk_score);
CREATE INDEX IF NOT EXISTS idx_security_test_reports_generated_at 
    ON security_test_reports(generated_at);

CREATE INDEX IF NOT EXISTS idx_security_test_schedules_enabled_next_run 
    ON security_test_schedules(enabled, next_run_at);

CREATE INDEX IF NOT EXISTS idx_security_test_metrics_name_category 
    ON security_test_metrics(metric_name, metric_category);
CREATE INDEX IF NOT EXISTS idx_security_test_metrics_collected_at 
    ON security_test_metrics(collected_at);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_security_test_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_test_runs_updated_at
    BEFORE UPDATE ON security_test_runs
    FOR EACH ROW EXECUTE FUNCTION update_security_test_updated_at();

CREATE TRIGGER security_test_vulnerabilities_updated_at
    BEFORE UPDATE ON security_test_vulnerabilities
    FOR EACH ROW EXECUTE FUNCTION update_security_test_updated_at();

CREATE TRIGGER security_test_schedules_updated_at
    BEFORE UPDATE ON security_test_schedules
    FOR EACH ROW EXECUTE FUNCTION update_security_test_updated_at();

CREATE TRIGGER security_test_configurations_updated_at
    BEFORE UPDATE ON security_test_configurations
    FOR EACH ROW EXECUTE FUNCTION update_security_test_updated_at();

-- Views for dashboard and reporting
CREATE OR REPLACE VIEW security_testing_dashboard_stats AS
SELECT 
    COUNT(*) as total_test_runs,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_runs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
    COUNT(*) FILTER (WHERE status = 'running') as active_runs,
    AVG(duration_ms) as avg_duration_ms,
    SUM(vulnerabilities_found) as total_vulnerabilities,
    COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE - INTERVAL '7 days') as runs_last_7_days,
    COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE - INTERVAL '30 days') as runs_last_30_days
FROM security_test_runs;

CREATE OR REPLACE VIEW security_vulnerabilities_summary AS
SELECT 
    vulnerability_type,
    severity,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'open') as open_count,
    COUNT(*) FILTER (WHERE status = 'fixed') as fixed_count,
    AVG(cvss_score) as avg_cvss_score,
    MIN(created_at) as first_detected,
    MAX(created_at) as last_detected
FROM security_test_vulnerabilities
GROUP BY vulnerability_type, severity;

CREATE OR REPLACE VIEW security_test_suite_performance AS
SELECT 
    suite_id,
    suite_name,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_runs,
    AVG(duration_ms) as avg_duration_ms,
    AVG(vulnerabilities_found) as avg_vulnerabilities_per_run,
    MAX(started_at) as last_run_at
FROM security_test_runs
GROUP BY suite_id, suite_name;

CREATE OR REPLACE VIEW security_testing_trends AS
SELECT 
    DATE_TRUNC('day', started_at) as date,
    suite_id,
    COUNT(*) as runs_count,
    AVG(duration_ms) as avg_duration,
    SUM(vulnerabilities_found) as vulnerabilities_found,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_runs
FROM security_test_runs
WHERE started_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', started_at), suite_id
ORDER BY date DESC;

-- Sample data for testing
INSERT INTO security_test_configurations (name, description, suite_id, configuration, is_template, is_default)
VALUES 
    ('Default Penetration Testing', 'Standard penetration testing configuration with OWASP Top 10 coverage', 
     'penetration_testing', 
     '{"timeout": 300000, "max_concurrent": 3, "target_url": "http://localhost:3000", "include_owasp_top_10": true}',
     true, true),
    
    ('Quick Vulnerability Scan', 'Fast vulnerability scanning for CI/CD pipeline',
     'vulnerability_scanning',
     '{"timeout": 180000, "max_concurrent": 5, "quick_scan": true, "skip_port_scan": false}',
     true, false),
     
    ('Comprehensive Code Analysis', 'Complete static and dynamic code analysis',
     'code_analysis',
     '{"include_dependencies": true, "detect_secrets": true, "code_quality_check": true}',
     true, true),
     
    ('GDPR Compliance Check', 'Automated GDPR compliance validation',
     'compliance_testing',
     '{"frameworks": ["gdpr"], "include_data_flow_analysis": true, "check_consent_mechanisms": true}',
     true, false);

-- Sample scheduled tests
INSERT INTO security_test_schedules (suite_id, suite_name, schedule_expression, configuration, notification_emails)
VALUES 
    ('vulnerability_scanning', 'Daily Vulnerability Scan', '0 2 * * *', 
     '{"quick_scan": true}', 
     ARRAY['security@cartrita.ai', 'admin@cartrita.ai']),
     
    ('penetration_testing', 'Weekly Penetration Test', '0 3 * * 0',
     '{"comprehensive": true}',
     ARRAY['security@cartrita.ai']),
     
    ('compliance_testing', 'Monthly Compliance Audit', '0 1 1 * *',
     '{"all_frameworks": true}',
     ARRAY['compliance@cartrita.ai', 'legal@cartrita.ai']);

-- Function to get security testing metrics
CREATE OR REPLACE FUNCTION get_security_testing_metrics(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE (
    metric_name TEXT,
    metric_value DECIMAL,
    metric_category TEXT,
    trend_direction TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT 
            stm.metric_name,
            AVG(stm.metric_value) as avg_value,
            stm.metric_category
        FROM security_test_metrics stm
        WHERE stm.collected_at BETWEEN start_date AND end_date
        GROUP BY stm.metric_name, stm.metric_category
    ),
    previous_period AS (
        SELECT 
            stm.metric_name,
            AVG(stm.metric_value) as avg_value,
            stm.metric_category
        FROM security_test_metrics stm
        WHERE stm.collected_at BETWEEN 
            start_date - (end_date - start_date) AND 
            start_date
        GROUP BY stm.metric_name, stm.metric_category
    )
    SELECT 
        cp.metric_name,
        cp.avg_value,
        cp.metric_category,
        CASE 
            WHEN pp.avg_value IS NULL THEN 'new'
            WHEN cp.avg_value > pp.avg_value THEN 'improving'
            WHEN cp.avg_value < pp.avg_value THEN 'declining'
            ELSE 'stable'
        END as trend_direction
    FROM current_period cp
    LEFT JOIN previous_period pp ON cp.metric_name = pp.metric_name AND cp.metric_category = pp.metric_category;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old test data
CREATE OR REPLACE FUNCTION cleanup_old_security_test_data(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete old test runs and cascade to related data
    DELETE FROM security_test_runs 
    WHERE started_at < CURRENT_DATE - (retention_days || ' days')::INTERVAL
    AND status IN ('completed', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old artifacts files (would need file system cleanup too)
    DELETE FROM security_test_artifacts 
    WHERE created_at < CURRENT_DATE - (retention_days || ' days')::INTERVAL;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Permissions and security
REVOKE ALL ON security_test_runs FROM PUBLIC;
REVOKE ALL ON security_test_results FROM PUBLIC;
REVOKE ALL ON security_test_vulnerabilities FROM PUBLIC;
REVOKE ALL ON security_test_reports FROM PUBLIC;

-- Grant appropriate permissions (adjust based on your role system)
-- GRANT SELECT, INSERT, UPDATE ON security_test_runs TO security_testing_role;
-- GRANT SELECT, INSERT, UPDATE ON security_test_results TO security_testing_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON security_test_vulnerabilities TO security_testing_role;
-- GRANT SELECT, INSERT ON security_test_reports TO security_testing_role;

COMMENT ON TABLE security_test_runs IS 'Tracks security test suite execution runs';
COMMENT ON TABLE security_test_results IS 'Individual test results within test runs';
COMMENT ON TABLE security_test_vulnerabilities IS 'Vulnerability findings from security tests';
COMMENT ON TABLE security_test_reports IS 'Generated security test reports and documentation';
COMMENT ON TABLE security_test_schedules IS 'Automated security test scheduling';
COMMENT ON TABLE security_test_metrics IS 'Security testing performance and effectiveness metrics';
COMMENT ON TABLE security_test_configurations IS 'Reusable security test configurations and templates';
COMMENT ON TABLE security_test_artifacts IS 'Test evidence, logs, screenshots, and other artifacts';

COMMIT;
