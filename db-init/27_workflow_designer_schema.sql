-- Task 25: Enterprise Workflow Automation System - Component 1
-- Visual Workflow Designer Database Schema
-- This migration creates tables for the workflow designer functionality

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Workflow Definitions Table (Enhanced from existing)
-- This table stores the visual workflow definitions with node/connection data
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) DEFAULT '1.0.0',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
    definition JSONB NOT NULL DEFAULT '{}', -- Contains nodes, connections, variables
    settings JSONB DEFAULT '{}', -- Execution settings, timeouts, etc.
    metadata JSONB DEFAULT '{}', -- Tags, category, creation info
    permissions JSONB DEFAULT '{}', -- Sharing permissions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    CONSTRAINT workflow_definitions_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Create indexes for workflow_definitions
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_user_id ON workflow_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status ON workflow_definitions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_at ON workflow_definitions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_updated_at ON workflow_definitions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_name_search ON workflow_definitions USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_description_search ON workflow_definitions USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_metadata ON workflow_definitions USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_category ON workflow_definitions USING gin((metadata->>'category'));

-- Workflow Node Types Registry
-- This table defines available node types for the visual designer
CREATE TABLE IF NOT EXISTS workflow_node_types (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    icon VARCHAR(100),
    color VARCHAR(7), -- Hex color code
    description TEXT,
    inputs INTEGER DEFAULT 1,
    outputs INTEGER DEFAULT 1,
    config_schema JSONB DEFAULT '{}', -- JSON schema for node configuration
    implementation_class VARCHAR(255), -- Backend class for execution
    ui_component VARCHAR(255), -- Frontend component name
    version VARCHAR(50) DEFAULT '1.0.0',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for workflow_node_types
CREATE INDEX IF NOT EXISTS idx_workflow_node_types_category ON workflow_node_types(category);
CREATE INDEX IF NOT EXISTS idx_workflow_node_types_active ON workflow_node_types(active);
CREATE INDEX IF NOT EXISTS idx_workflow_node_types_name_search ON workflow_node_types USING gin(to_tsvector('english', name || ' ' || description));

-- Workflow Templates
-- This table stores pre-built workflow templates for common use cases
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    definition JSONB NOT NULL DEFAULT '{}', -- Template workflow definition
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    difficulty_level VARCHAR(50) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_time INTEGER, -- Estimated setup time in minutes
    prerequisites TEXT[], -- Required skills/knowledge
    use_cases TEXT[], -- Common use cases for this template
    popularity_score INTEGER DEFAULT 0, -- Based on usage statistics
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_official BOOLEAN DEFAULT false, -- Official templates from system
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT workflow_templates_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Create indexes for workflow_templates
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_difficulty ON workflow_templates(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_popularity ON workflow_templates(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_official ON workflow_templates(is_official);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_tags ON workflow_templates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_search ON workflow_templates USING gin(to_tsvector('english', name || ' ' || description));
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_at ON workflow_templates(created_at DESC);

-- Workflow Designer Sessions
-- This table tracks user designer sessions for collaboration and auto-save
CREATE TABLE IF NOT EXISTS workflow_designer_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_data JSONB DEFAULT '{}', -- Canvas state, zoom, position, etc.
    auto_save_data JSONB DEFAULT '{}', -- Auto-saved workflow state
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one active session per user per workflow
    CONSTRAINT unique_active_designer_session UNIQUE (workflow_id, user_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for workflow_designer_sessions
CREATE INDEX IF NOT EXISTS idx_workflow_designer_sessions_workflow_id ON workflow_designer_sessions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_designer_sessions_user_id ON workflow_designer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_designer_sessions_active ON workflow_designer_sessions(is_active, last_activity DESC);

-- Workflow Validation Results
-- This table stores validation results for workflows
CREATE TABLE IF NOT EXISTS workflow_validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    is_valid BOOLEAN NOT NULL,
    errors JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',
    node_count INTEGER,
    connection_count INTEGER,
    complexity_score DECIMAL(5,2),
    estimated_duration INTEGER, -- In milliseconds
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    workflow_version VARCHAR(50),
    
    -- Keep only recent validation results
    CONSTRAINT workflow_validation_results_counts_positive 
        CHECK (node_count >= 0 AND connection_count >= 0)
);

-- Create indexes for workflow_validation_results
CREATE INDEX IF NOT EXISTS idx_workflow_validation_results_workflow_id ON workflow_validation_results(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_validation_results_validated_at ON workflow_validation_results(validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_validation_results_valid ON workflow_validation_results(is_valid);

-- Workflow Designer Metrics
-- This table tracks usage metrics for the designer
CREATE TABLE IF NOT EXISTS workflow_designer_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    metric_type VARCHAR(100) NOT NULL, -- 'node_added', 'connection_created', 'validation_run', etc.
    metric_data JSONB DEFAULT '{}',
    node_type VARCHAR(100), -- For node-specific metrics
    session_id UUID REFERENCES workflow_designer_sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Partition by month for performance
    CHECK (created_at >= DATE_TRUNC('month', CURRENT_DATE))
);

-- Create indexes for workflow_designer_metrics
CREATE INDEX IF NOT EXISTS idx_workflow_designer_metrics_user_id ON workflow_designer_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_designer_metrics_workflow_id ON workflow_designer_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_designer_metrics_type ON workflow_designer_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_workflow_designer_metrics_created_at ON workflow_designer_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_designer_metrics_node_type ON workflow_designer_metrics(node_type) WHERE node_type IS NOT NULL;

-- Insert default node types for the visual designer
INSERT INTO workflow_node_types (id, name, category, icon, color, description, inputs, outputs, config_schema) VALUES
-- Control Flow Nodes
('start', 'Start', 'control', 'play-circle', '#28a745', 'Starting point of workflow execution', 0, 1, '{}'),
('end', 'End', 'control', 'stop-circle', '#dc3545', 'Terminal point of workflow execution', 1, 0, '{}'),
('decision', 'Decision', 'control', 'git-branch', '#ffc107', 'Conditional branching based on expression evaluation', 1, 2, 
 '{"condition": {"type": "expression", "required": true}, "trueLabel": {"type": "string", "default": "True"}, "falseLabel": {"type": "string", "default": "False"}}'),
('parallel', 'Parallel', 'control', 'share-alt', '#17a2b8', 'Execute multiple branches in parallel', 1, -1, 
 '{"branches": {"type": "number", "min": 2, "max": 10, "default": 2}, "waitForAll": {"type": "boolean", "default": true}}'),
('merge', 'Merge', 'control', 'code-merge', '#6f42c1', 'Merge multiple parallel execution paths', -1, 1, 
 '{"strategy": {"type": "select", "options": ["waitAll", "waitAny", "first"], "default": "waitAll"}}'),

-- Data Processing Nodes
('transform', 'Transform Data', 'data', 'exchange-alt', '#fd7e14', 'Transform data using custom JavaScript code', 1, 1, 
 '{"transformation": {"type": "code", "language": "javascript", "required": true}, "timeout": {"type": "number", "default": 30000, "min": 1000, "max": 300000}}'),
('filter', 'Filter Data', 'data', 'filter', '#20c997', 'Filter data based on specified conditions', 1, 2, 
 '{"condition": {"type": "expression", "required": true}, "passLabel": {"type": "string", "default": "Pass"}, "failLabel": {"type": "string", "default": "Fail"}}'),
('aggregate', 'Aggregate', 'data', 'layer-group', '#6610f2', 'Aggregate data using mathematical operations', 1, 1, 
 '{"operation": {"type": "select", "options": ["sum", "avg", "count", "min", "max", "group"], "required": true}, "field": {"type": "string", "required": true}, "groupBy": {"type": "array"}}'),

-- Action Nodes
('http_request', 'HTTP Request', 'action', 'globe', '#007bff', 'Make HTTP requests to external APIs', 1, 2, 
 '{"method": {"type": "select", "options": ["GET", "POST", "PUT", "DELETE", "PATCH"], "default": "GET"}, "url": {"type": "string", "required": true}, "headers": {"type": "object"}, "body": {"type": "object"}, "timeout": {"type": "number", "default": 30000}, "retryCount": {"type": "number", "default": 3, "min": 0, "max": 10}}'),
('database_query', 'Database Query', 'action', 'database', '#28a745', 'Execute database queries', 1, 2, 
 '{"query": {"type": "sql", "required": true}, "parameters": {"type": "object"}, "timeout": {"type": "number", "default": 30000}}'),
('send_email', 'Send Email', 'action', 'envelope', '#dc3545', 'Send email notifications', 1, 2, 
 '{"to": {"type": "array", "required": true}, "subject": {"type": "string", "required": true}, "body": {"type": "text", "required": true}, "cc": {"type": "array"}, "bcc": {"type": "array"}, "attachments": {"type": "array"}}'),
('webhook', 'Webhook', 'action', 'broadcast-tower', '#17a2b8', 'Send webhook notifications', 1, 2, 
 '{"url": {"type": "string", "required": true}, "method": {"type": "select", "options": ["POST", "PUT"], "default": "POST"}, "payload": {"type": "object"}, "headers": {"type": "object"}, "timeout": {"type": "number", "default": 30000}}'),

-- AI/ML Nodes
('ai_agent_call', 'AI Agent', 'ai', 'robot', '#e83e8c', 'Call AI agents for processing', 1, 2, 
 '{"agent": {"type": "select", "options": [], "required": true}, "prompt": {"type": "text", "required": true}, "parameters": {"type": "object"}, "timeout": {"type": "number", "default": 60000}}'),
('analyze_sentiment', 'Sentiment Analysis', 'ai', 'heart', '#fd7e14', 'Analyze sentiment of text data', 1, 1, 
 '{"textField": {"type": "string", "required": true}, "language": {"type": "select", "options": ["auto", "en", "es", "fr", "de"], "default": "auto"}}'),

-- Utility Nodes
('delay', 'Delay', 'utility', 'clock', '#6c757d', 'Add delay to workflow execution', 1, 1, 
 '{"duration": {"type": "number", "required": true, "min": 1000, "max": 86400000}, "unit": {"type": "select", "options": ["milliseconds", "seconds", "minutes", "hours"], "default": "seconds"}}'),
('log', 'Log', 'utility', 'file-text', '#495057', 'Log messages and data during execution', 1, 1, 
 '{"level": {"type": "select", "options": ["debug", "info", "warn", "error"], "default": "info"}, "message": {"type": "string", "required": true}, "data": {"type": "object"}}'),
('variable', 'Set Variable', 'utility', 'tag', '#20c997', 'Set variables for use in workflow', 1, 1, 
 '{"name": {"type": "string", "required": true}, "value": {"type": "expression", "required": true}, "scope": {"type": "select", "options": ["local", "global"], "default": "local"}}')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    config_schema = EXCLUDED.config_schema,
    updated_at = CURRENT_TIMESTAMP;

-- Insert sample workflow templates
INSERT INTO workflow_templates (name, description, category, tags, definition, difficulty_level, estimated_time, use_cases) VALUES
('Simple Data Processing', 'Basic template for processing and transforming data', 'data-processing', 
 ARRAY['beginner', 'data', 'transform'], 
 '{"nodes": [{"id": "start1", "type": "start", "position": {"x": 100, "y": 100}}, {"id": "transform1", "type": "transform", "position": {"x": 300, "y": 100}}, {"id": "end1", "type": "end", "position": {"x": 500, "y": 100}}], "connections": [{"from": "start1", "to": "transform1"}, {"from": "transform1", "to": "end1"}]}',
 'beginner', 10, ARRAY['Data transformation', 'Basic automation']),

('API Integration Workflow', 'Template for integrating with external APIs and processing responses', 'integration', 
 ARRAY['intermediate', 'api', 'http'], 
 '{"nodes": [{"id": "start1", "type": "start", "position": {"x": 100, "y": 100}}, {"id": "http1", "type": "http_request", "position": {"x": 300, "y": 100}}, {"id": "decision1", "type": "decision", "position": {"x": 500, "y": 100}}, {"id": "transform1", "type": "transform", "position": {"x": 700, "y": 50}}, {"id": "log1", "type": "log", "position": {"x": 700, "y": 150}}, {"id": "end1", "type": "end", "position": {"x": 900, "y": 100}}], "connections": [{"from": "start1", "to": "http1"}, {"from": "http1", "to": "decision1"}, {"from": "decision1", "to": "transform1"}, {"from": "decision1", "to": "log1"}, {"from": "transform1", "to": "end1"}, {"from": "log1", "to": "end1"}]}',
 'intermediate', 20, ARRAY['API integration', 'Data processing', 'Error handling']),

('Email Notification System', 'Template for creating automated email notification workflows', 'notification', 
 ARRAY['beginner', 'email', 'notification'], 
 '{"nodes": [{"id": "start1", "type": "start", "position": {"x": 100, "y": 100}}, {"id": "filter1", "type": "filter", "position": {"x": 300, "y": 100}}, {"id": "email1", "type": "send_email", "position": {"x": 500, "y": 50}}, {"id": "log1", "type": "log", "position": {"x": 500, "y": 150}}, {"id": "end1", "type": "end", "position": {"x": 700, "y": 100}}], "connections": [{"from": "start1", "to": "filter1"}, {"from": "filter1", "to": "email1"}, {"from": "filter1", "to": "log1"}, {"from": "email1", "to": "end1"}, {"from": "log1", "to": "end1"}]}',
 'beginner', 15, ARRAY['Email automation', 'Notifications', 'Alerts'])

ON CONFLICT DO NOTHING;

-- Create updated_at trigger for workflow_definitions
CREATE OR REPLACE FUNCTION update_workflow_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workflow_definitions_updated_at ON workflow_definitions;
CREATE TRIGGER trigger_update_workflow_definitions_updated_at
    BEFORE UPDATE ON workflow_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_definitions_updated_at();

-- Create updated_at trigger for workflow_node_types
CREATE OR REPLACE FUNCTION update_workflow_node_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workflow_node_types_updated_at ON workflow_node_types;
CREATE TRIGGER trigger_update_workflow_node_types_updated_at
    BEFORE UPDATE ON workflow_node_types
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_node_types_updated_at();

-- Create updated_at trigger for workflow_templates
CREATE OR REPLACE FUNCTION update_workflow_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workflow_templates_updated_at ON workflow_templates;
CREATE TRIGGER trigger_update_workflow_templates_updated_at
    BEFORE UPDATE ON workflow_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_templates_updated_at();

-- Create cleanup function for old validation results (keep only last 10 per workflow)
CREATE OR REPLACE FUNCTION cleanup_old_validation_results()
RETURNS void AS $$
BEGIN
    DELETE FROM workflow_validation_results
    WHERE id NOT IN (
        SELECT id FROM (
            SELECT id, 
                   ROW_NUMBER() OVER (PARTITION BY workflow_id ORDER BY validated_at DESC) as rn
            FROM workflow_validation_results
        ) ranked
        WHERE ranked.rn <= 10
    );
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for old designer sessions (remove inactive sessions older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_designer_sessions()
RETURNS void AS $$
BEGIN
    -- Mark old active sessions as inactive
    UPDATE workflow_designer_sessions 
    SET is_active = false
    WHERE is_active = true 
      AND last_activity < CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    -- Delete very old inactive sessions (older than 7 days)
    DELETE FROM workflow_designer_sessions
    WHERE is_active = false 
      AND last_activity < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE workflow_definitions IS 'Visual workflow definitions with node and connection data for the drag-and-drop designer';
COMMENT ON TABLE workflow_node_types IS 'Registry of available node types for the visual workflow designer';
COMMENT ON TABLE workflow_templates IS 'Pre-built workflow templates for common automation patterns';
COMMENT ON TABLE workflow_designer_sessions IS 'Active designer sessions for collaboration and auto-save functionality';
COMMENT ON TABLE workflow_validation_results IS 'Validation results and complexity analysis for workflows';
COMMENT ON TABLE workflow_designer_metrics IS 'Usage metrics and analytics for the workflow designer';

COMMENT ON COLUMN workflow_definitions.definition IS 'JSONB containing nodes, connections, and variables for the visual workflow';
COMMENT ON COLUMN workflow_definitions.settings IS 'Execution settings including timeouts, retry policies, and error handling';
COMMENT ON COLUMN workflow_definitions.metadata IS 'Workflow metadata including tags, category, and creation information';
COMMENT ON COLUMN workflow_definitions.permissions IS 'Sharing permissions including editors, viewers, and public access';

COMMENT ON COLUMN workflow_node_types.config_schema IS 'JSON schema defining the configuration options for this node type';
COMMENT ON COLUMN workflow_node_types.inputs IS 'Number of input connections (-1 for variable)';
COMMENT ON COLUMN workflow_node_types.outputs IS 'Number of output connections (-1 for variable)';

-- Create views for common queries
CREATE OR REPLACE VIEW workflow_designer_summary AS
SELECT 
    wd.id,
    wd.name,
    wd.description,
    wd.status,
    wd.user_id,
    wd.created_at,
    wd.updated_at,
    (wd.metadata->>'category')::text as category,
    (wd.metadata->>'tags')::jsonb as tags,
    COALESCE((wd.definition->>'nodes')::jsonb, '[]'::jsonb) as nodes_count,
    COALESCE((wd.definition->>'connections')::jsonb, '[]'::jsonb) as connections_count,
    wvr.is_valid as last_validation_valid,
    wvr.complexity_score,
    (SELECT COUNT(*) FROM workflow_executions we WHERE we.workflow_id = wd.id) as execution_count,
    (SELECT MAX(created_at) FROM workflow_executions we WHERE we.workflow_id = wd.id) as last_executed
FROM workflow_definitions wd
LEFT JOIN LATERAL (
    SELECT * FROM workflow_validation_results wvr2 
    WHERE wvr2.workflow_id = wd.id 
    ORDER BY validated_at DESC LIMIT 1
) wvr ON true;

COMMENT ON VIEW workflow_designer_summary IS 'Summary view of workflows with validation and execution statistics';

-- Grant permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO workflow_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO workflow_user;

-- Performance optimization: Consider partitioning workflow_designer_metrics by month
-- This can be done later as the table grows

SELECT 'Task 25 Component 1: Visual Workflow Designer database schema created successfully!' as result;
