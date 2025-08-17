-- Phase B Workflow Enhancement Migration
-- Adds comprehensive workflow tracking, connector registry, and execution monitoring

-- Enhance workflow_executions table with Phase B features
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS nodes_executed JSONB DEFAULT '[]'::jsonb;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS dry_run BOOLEAN DEFAULT FALSE;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS phase VARCHAR(10) DEFAULT 'B';

-- Update workflow_execution_logs with enhanced logging
ALTER TABLE workflow_execution_logs ADD COLUMN IF NOT EXISTS node_type VARCHAR(128);
ALTER TABLE workflow_execution_logs ADD COLUMN IF NOT EXISTS execution_context JSONB;

-- Create connector registry table
CREATE TABLE IF NOT EXISTS workflow_connectors (
    id SERIAL PRIMARY KEY,
    type VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) DEFAULT '1.0.0',
    category VARCHAR(100),
    inputs JSONB DEFAULT '[]'::jsonb,
    outputs JSONB DEFAULT '[]'::jsonb,
    configuration JSONB DEFAULT '{}'::jsonb,
    statistics JSONB DEFAULT '{"executions": 0, "failures": 0}'::jsonb,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create connector versions table for version management
CREATE TABLE IF NOT EXISTS workflow_connector_versions (
    id SERIAL PRIMARY KEY,
    connector_id INTEGER NOT NULL REFERENCES workflow_connectors(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    definition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(connector_id, version)
);

-- Create workflow execution metrics table for analytics
CREATE TABLE IF NOT EXISTS workflow_execution_metrics (
    id BIGSERIAL PRIMARY KEY,
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL,
    metric_unit VARCHAR(50),
    node_id VARCHAR(128),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create workflow templates table (separate from regular workflows)
CREATE TABLE IF NOT EXISTS workflow_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    definition JSONB NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    usage_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow dependencies table for subworkflow tracking
CREATE TABLE IF NOT EXISTS workflow_dependencies (
    id SERIAL PRIMARY KEY,
    parent_workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    child_workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'subworkflow',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_workflow_id, child_workflow_id)
);

-- Create expression evaluation cache for performance
CREATE TABLE IF NOT EXISTS expression_cache (
    id BIGSERIAL PRIMARY KEY,
    expression_hash VARCHAR(64) UNIQUE NOT NULL,
    expression TEXT NOT NULL,
    variables_hash VARCHAR(64),
    result JSONB,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0
);

-- Create workflow execution queues for scheduling
CREATE TABLE IF NOT EXISTS workflow_execution_queue (
    id BIGSERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    input_data JSONB,
    execution_options JSONB DEFAULT '{}'::jsonb,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    priority INTEGER DEFAULT 5,
    status VARCHAR(32) DEFAULT 'pending', -- pending|running|completed|failed|cancelled
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_phase ON workflow_executions(user_id, phase, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_dry_run ON workflow_executions(dry_run, status);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_node_type ON workflow_execution_logs(node_type, execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_metrics_name ON workflow_execution_metrics(metric_name, execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_metrics_timestamp ON workflow_execution_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_connectors_type_enabled ON workflow_connectors(type, is_enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_connectors_category ON workflow_connectors(category, is_enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category_public ON workflow_templates(category, is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_dependencies_parent ON workflow_dependencies(parent_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_dependencies_child ON workflow_dependencies(child_workflow_id);
CREATE INDEX IF NOT EXISTS idx_expression_cache_hash ON expression_cache(expression_hash, variables_hash);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_queue_status ON workflow_execution_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_queue_user ON workflow_execution_queue(user_id, status);

-- Insert built-in connectors
INSERT INTO workflow_connectors (type, name, description, category, inputs, outputs) VALUES
('http-request', 'HTTP Request', 'Make HTTP requests to external APIs', 'Integration', 
 '["url", "method", "headers", "body"]', '["response", "status", "headers"]'),
('data-transform', 'Data Transform', 'Transform and manipulate data structures', 'Data',
 '["data", "transformation"]', '["transformedData"]'),
('utility', 'Utility Functions', 'Common utility functions for data processing', 'Utility',
 '["operation", "data"]', '["result"]'),
('condition', 'Conditional Logic', 'Execute conditional logic and routing', 'Logic',
 '["condition", "trueValue", "falseValue"]', '["result"]'),
('delay', 'Delay', 'Add delays to workflow execution', 'Utility',
 '["duration", "unit"]', '["completed"]'),
('validate', 'Data Validation', 'Validate data against schemas and rules', 'Data',
 '["data", "schema", "rules"]', '["isValid", "errors"]'),
('file-process', 'File Processing', 'Process and manipulate files', 'File',
 '["operation", "file", "options"]', '["result"]'),
('email', 'Email', 'Send emails and notifications', 'Communication',
 '["to", "subject", "body", "attachments"]', '["sent", "messageId"]'),
('database', 'Database Query', 'Execute database queries and operations', 'Database',
 '["query", "parameters", "connection"]', '["result", "rowCount"]'),
('webhook', 'Webhook', 'Send webhook notifications', 'Integration',
 '["url", "payload", "headers"]', '["response", "delivered"]')
ON CONFLICT (type) DO NOTHING;

-- Create workflow execution statistics view
CREATE OR REPLACE VIEW workflow_execution_stats AS
SELECT 
    w.id as workflow_id,
    w.name,
    w.category,
    COUNT(we.id) as total_executions,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
    COUNT(CASE WHEN we.dry_run = true THEN 1 END) as dry_run_executions,
    AVG(we.execution_time_ms) as avg_execution_time_ms,
    MAX(we.started_at) as last_execution,
    MIN(we.started_at) as first_execution
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
GROUP BY w.id, w.name, w.category;

-- Create connector usage statistics view
CREATE OR REPLACE VIEW connector_usage_stats AS
SELECT 
    wc.type,
    wc.name,
    wc.category,
    wc.version,
    (wc.statistics->>'executions')::integer as executions,
    (wc.statistics->>'failures')::integer as failures,
    CASE 
        WHEN (wc.statistics->>'executions')::integer > 0 
        THEN (((wc.statistics->>'executions')::integer - (wc.statistics->>'failures')::integer) * 100.0) / (wc.statistics->>'executions')::integer
        ELSE 0 
    END as success_rate,
    wc.updated_at as last_updated
FROM workflow_connectors wc
WHERE wc.is_enabled = true;

-- Update workflows table for Phase B compatibility
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS phase VARCHAR(10) DEFAULT 'B';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create index for workflow version and phase
CREATE INDEX IF NOT EXISTS idx_workflows_phase_version ON workflows(phase, version, updated_at DESC);

-- Create functions for workflow execution analytics
CREATE OR REPLACE FUNCTION update_connector_statistics(connector_type VARCHAR, execution_success BOOLEAN)
RETURNS VOID AS $$
BEGIN
    IF execution_success THEN
        UPDATE workflow_connectors 
        SET statistics = jsonb_set(
            jsonb_set(statistics, '{executions}', (COALESCE((statistics->>'executions')::integer, 0) + 1)::text::jsonb),
            '{lastUsed}', to_jsonb(NOW())
        )
        WHERE type = connector_type;
    ELSE
        UPDATE workflow_connectors 
        SET statistics = jsonb_set(
            jsonb_set(
                jsonb_set(statistics, '{executions}', (COALESCE((statistics->>'executions')::integer, 0) + 1)::text::jsonb),
                '{failures}', (COALESCE((statistics->>'failures')::integer, 0) + 1)::text::jsonb
            ),
            '{lastUsed}', to_jsonb(NOW())
        )
        WHERE type = connector_type;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update workflow updated_at timestamp
CREATE OR REPLACE FUNCTION update_workflow_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_update_timestamp
    BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE PROCEDURE update_workflow_timestamp();

-- Clean up old expression cache entries (retention policy)
CREATE OR REPLACE FUNCTION cleanup_expression_cache()
RETURNS VOID AS $$
BEGIN
    DELETE FROM expression_cache 
    WHERE accessed_at < NOW() - INTERVAL '7 days' 
    AND access_count < 5;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE workflow_connectors IS 'Registry of available workflow connectors with metadata and statistics';
COMMENT ON TABLE workflow_connector_versions IS 'Version management for workflow connectors';
COMMENT ON TABLE workflow_execution_metrics IS 'Detailed metrics for workflow execution performance analysis';
COMMENT ON TABLE workflow_templates IS 'Reusable workflow templates for common patterns';
COMMENT ON TABLE workflow_dependencies IS 'Tracks relationships between workflows (subworkflows, etc.)';
COMMENT ON TABLE expression_cache IS 'Cache for frequently used expression evaluations';
COMMENT ON TABLE workflow_execution_queue IS 'Queue system for scheduled and batch workflow execution';