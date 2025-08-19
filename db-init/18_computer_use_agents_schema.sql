-- Migration: Create Computer Use Agent tables
-- Description: Tables for managing Computer Use Agents with hierarchical supervision
-- Version: 18
-- Date: 2024-12-28

-- Computer Use Agents table
CREATE TABLE IF NOT EXISTS computer_use_agents (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    agent_type VARCHAR(50) DEFAULT 'computer_use',
    permission_level VARCHAR(20) NOT NULL DEFAULT 'SUPERVISED',
    config JSONB DEFAULT '{}',
    capabilities TEXT[] DEFAULT ARRAY[
        'computer_control',
        'screenshot_analysis', 
        'web_browsing',
        'application_automation',
        'form_filling',
        'data_extraction'
    ],
    safety_features TEXT[] DEFAULT ARRAY[
        'supervised_execution',
        'transaction_logging',
        'safety_check_enforcement',
        'permission_based_key_access'
    ],
    status VARCHAR(20) DEFAULT 'active',
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_execution_at TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    metadata JSONB DEFAULT '{}'
);

-- Computer Use Executions table
CREATE TABLE IF NOT EXISTS computer_use_executions (
    id SERIAL PRIMARY KEY,
    execution_id VARCHAR(255) UNIQUE NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    task TEXT NOT NULL,
    justification TEXT,
    task_category VARCHAR(100),
    max_iterations INTEGER DEFAULT 10,
    actual_iterations INTEGER,
    safety_level VARCHAR(20) DEFAULT 'moderate',
    status VARCHAR(20) NOT NULL,
    error TEXT,
    result JSONB,
    execution_log JSONB DEFAULT '[]',
    safety_checks JSONB DEFAULT '[]',
    screenshots_captured INTEGER DEFAULT 0,
    actions_executed INTEGER DEFAULT 0,
    duration_seconds DECIMAL(10,3),
    requested_by VARCHAR(255),
    supervisor_id VARCHAR(255) DEFAULT 'supervisor_cartrita_v2',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- API Key Transactions table (for secure key management)
CREATE TABLE IF NOT EXISTS api_key_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    key_id VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    permission_level VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    supervisor_id VARCHAR(255) NOT NULL,
    justification TEXT,
    approval_reason TEXT,
    safety_checks JSONB DEFAULT '[]',
    usage_stats JSONB DEFAULT '{}',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Computer Use Safety Checks table
CREATE TABLE IF NOT EXISTS computer_use_safety_checks (
    id SERIAL PRIMARY KEY,
    check_id VARCHAR(255) UNIQUE NOT NULL,
    execution_id VARCHAR(255),
    agent_id VARCHAR(255) NOT NULL,
    check_code VARCHAR(100) NOT NULL,
    check_message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP,
    resolution TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Computer Use System Events table (for monitoring)
CREATE TABLE IF NOT EXISTS computer_use_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    agent_id VARCHAR(255),
    execution_id VARCHAR(255),
    transaction_id VARCHAR(255),
    event_data JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    source VARCHAR(100) DEFAULT 'computer_use_system',
    correlation_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    indexed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_computer_use_agents_agent_id ON computer_use_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_computer_use_agents_permission_level ON computer_use_agents(permission_level);
CREATE INDEX IF NOT EXISTS idx_computer_use_agents_created_by ON computer_use_agents(created_by);
CREATE INDEX IF NOT EXISTS idx_computer_use_agents_created_at ON computer_use_agents(created_at);

CREATE INDEX IF NOT EXISTS idx_computer_use_executions_execution_id ON computer_use_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_computer_use_executions_agent_id ON computer_use_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_computer_use_executions_status ON computer_use_executions(status);
CREATE INDEX IF NOT EXISTS idx_computer_use_executions_requested_by ON computer_use_executions(requested_by);
CREATE INDEX IF NOT EXISTS idx_computer_use_executions_created_at ON computer_use_executions(created_at);

CREATE INDEX IF NOT EXISTS idx_api_key_transactions_transaction_id ON api_key_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_api_key_transactions_agent_id ON api_key_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_api_key_transactions_key_id ON api_key_transactions(key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_transactions_status ON api_key_transactions(status);
CREATE INDEX IF NOT EXISTS idx_api_key_transactions_created_at ON api_key_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_computer_use_safety_checks_check_id ON computer_use_safety_checks(check_id);
CREATE INDEX IF NOT EXISTS idx_computer_use_safety_checks_execution_id ON computer_use_safety_checks(execution_id);
CREATE INDEX IF NOT EXISTS idx_computer_use_safety_checks_agent_id ON computer_use_safety_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_computer_use_safety_checks_severity ON computer_use_safety_checks(severity);
CREATE INDEX IF NOT EXISTS idx_computer_use_safety_checks_status ON computer_use_safety_checks(status);

CREATE INDEX IF NOT EXISTS idx_computer_use_events_event_type ON computer_use_events(event_type);
CREATE INDEX IF NOT EXISTS idx_computer_use_events_agent_id ON computer_use_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_computer_use_events_execution_id ON computer_use_events(execution_id);
CREATE INDEX IF NOT EXISTS idx_computer_use_events_created_at ON computer_use_events(created_at);
CREATE INDEX IF NOT EXISTS idx_computer_use_events_correlation_id ON computer_use_events(correlation_id);

-- Add foreign key constraints
ALTER TABLE computer_use_executions 
ADD CONSTRAINT fk_computer_use_executions_agent_id 
FOREIGN KEY (agent_id) REFERENCES computer_use_agents(agent_id) 
ON DELETE CASCADE;

ALTER TABLE api_key_transactions 
ADD CONSTRAINT fk_api_key_transactions_agent_id 
FOREIGN KEY (agent_id) REFERENCES computer_use_agents(agent_id) 
ON DELETE CASCADE;

ALTER TABLE computer_use_safety_checks 
ADD CONSTRAINT fk_computer_use_safety_checks_agent_id 
FOREIGN KEY (agent_id) REFERENCES computer_use_agents(agent_id) 
ON DELETE CASCADE;

ALTER TABLE computer_use_safety_checks 
ADD CONSTRAINT fk_computer_use_safety_checks_execution_id 
FOREIGN KEY (execution_id) REFERENCES computer_use_executions(execution_id) 
ON DELETE SET NULL;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_computer_use_agents_updated_at 
BEFORE UPDATE ON computer_use_agents 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_computer_use_executions_updated_at 
BEFORE UPDATE ON computer_use_executions 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_key_transactions_updated_at 
BEFORE UPDATE ON api_key_transactions 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_computer_use_safety_checks_updated_at 
BEFORE UPDATE ON computer_use_safety_checks 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for monitoring and analytics
CREATE OR REPLACE VIEW computer_use_agent_summary AS
SELECT 
    a.agent_id,
    a.agent_name,
    a.permission_level,
    a.status,
    a.created_at,
    a.execution_count,
    a.success_rate,
    COUNT(e.id) as total_executions,
    COUNT(e.id) FILTER (WHERE e.status = 'completed') as successful_executions,
    COUNT(e.id) FILTER (WHERE e.status = 'failed') as failed_executions,
    AVG(e.duration_seconds) as avg_duration_seconds,
    MAX(e.created_at) as last_execution_at
FROM computer_use_agents a
LEFT JOIN computer_use_executions e ON a.agent_id = e.agent_id
GROUP BY a.agent_id, a.agent_name, a.permission_level, a.status, a.created_at, a.execution_count, a.success_rate;

CREATE OR REPLACE VIEW computer_use_system_health AS
SELECT 
    COUNT(DISTINCT a.agent_id) as total_agents,
    COUNT(DISTINCT a.agent_id) FILTER (WHERE a.status = 'active') as active_agents,
    COUNT(e.id) as total_executions_today,
    COUNT(e.id) FILTER (WHERE e.status = 'completed') as successful_executions_today,
    COUNT(e.id) FILTER (WHERE e.status = 'failed') as failed_executions_today,
    COUNT(s.id) as safety_checks_today,
    COUNT(s.id) FILTER (WHERE s.severity = 'critical') as critical_safety_checks_today,
    AVG(e.duration_seconds) as avg_execution_duration_today
FROM computer_use_agents a
LEFT JOIN computer_use_executions e ON a.agent_id = e.agent_id AND DATE(e.created_at) = CURRENT_DATE
LEFT JOIN computer_use_safety_checks s ON a.agent_id = s.agent_id AND DATE(s.created_at) = CURRENT_DATE;

-- Insert initial system configuration
INSERT INTO computer_use_agents (
    agent_id,
    agent_name,
    agent_type,
    permission_level,
    config,
    capabilities,
    safety_features,
    status,
    created_by,
    metadata
) VALUES (
    'system_supervisor_cua',
    'System Supervisor',
    'supervisor',
    'ADMIN',
    '{"role": "system_supervisor", "auto_approve_safe": true, "max_concurrent_executions": 5}',
    ARRAY['supervision', 'permission_management', 'safety_oversight', 'system_monitoring'],
    ARRAY['transaction_oversight', 'safety_enforcement', 'permission_validation', 'audit_logging'],
    'active',
    'system',
    '{"system_agent": true, "immutable": true}'
) ON CONFLICT (agent_id) DO NOTHING;

-- Create function to calculate agent success rate
CREATE OR REPLACE FUNCTION calculate_agent_success_rate(p_agent_id VARCHAR)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    success_rate DECIMAL(5,2);
BEGIN
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 0.00
            ELSE ROUND(
                (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)::DECIMAL) * 100,
                2
            )
        END INTO success_rate
    FROM computer_use_executions 
    WHERE agent_id = p_agent_id;
    
    RETURN success_rate;
END;
$$ LANGUAGE plpgsql;

-- Create function to update agent statistics
CREATE OR REPLACE FUNCTION update_agent_statistics(p_agent_id VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE computer_use_agents 
    SET 
        execution_count = (
            SELECT COUNT(*) 
            FROM computer_use_executions 
            WHERE agent_id = p_agent_id
        ),
        success_rate = calculate_agent_success_rate(p_agent_id),
        last_execution_at = (
            SELECT MAX(created_at) 
            FROM computer_use_executions 
            WHERE agent_id = p_agent_id
        ),
        updated_at = NOW()
    WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update agent statistics after execution
CREATE OR REPLACE FUNCTION trigger_update_agent_statistics()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_agent_statistics(NEW.agent_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_stats_after_execution
AFTER INSERT OR UPDATE ON computer_use_executions
FOR EACH ROW EXECUTE FUNCTION trigger_update_agent_statistics();

COMMENT ON TABLE computer_use_agents IS 'Computer Use Agents with hierarchical supervision and permission-based key access';
COMMENT ON TABLE computer_use_executions IS 'Execution records for computer tasks with full logging and safety tracking';
COMMENT ON TABLE api_key_transactions IS 'Secure API key access transactions with supervisor approval';
COMMENT ON TABLE computer_use_safety_checks IS 'Safety check records for computer use operations';
COMMENT ON TABLE computer_use_events IS 'System events for monitoring and audit trail';

-- Log migration completion
INSERT INTO computer_use_events (
    event_id,
    event_type,
    event_data,
    severity,
    source
) VALUES (
    'migration_18_' || EXTRACT(epoch FROM NOW()),
    'database_migration',
    '{"migration": "18_computer_use_agents_schema", "description": "Created Computer Use Agent tables with hierarchical supervision", "tables_created": 5, "views_created": 2, "functions_created": 3}',
    'info',
    'database_migration'
);