-- Advanced Workflow System Schema
-- Tables for workflow definitions, executions, templates, and analytics

-- Workflow definitions (user-created workflows)
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    definition JSONB NOT NULL,
    variables JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, archived
    is_template BOOLEAN DEFAULT false,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow templates (pre-built and shared workflows)
CREATE TABLE IF NOT EXISTS workflow_templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    difficulty VARCHAR(50) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    estimated_time VARCHAR(100),
    definition JSONB NOT NULL,
    variables JSONB DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow executions (runtime instances)
CREATE TABLE IF NOT EXISTS workflow_executions (
    id VARCHAR(255) PRIMARY KEY,
    workflow_id VARCHAR(255) REFERENCES workflows(id) ON DELETE CASCADE,
    template_id VARCHAR(255) REFERENCES workflow_templates(id),
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50) NOT NULL, -- running, completed, failed, cancelled
    input_data JSONB,
    output_data JSONB,
    variables JSONB DEFAULT '{}',
    execution_path JSONB DEFAULT '[]',
    current_node VARCHAR(255),
    error_message TEXT,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow execution logs (detailed step-by-step logs)
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id SERIAL PRIMARY KEY,
    execution_id VARCHAR(255) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(255),
    event VARCHAR(100) NOT NULL, -- started, completed, failed, node_enter, node_exit
    level VARCHAR(20) DEFAULT 'info', -- debug, info, warn, error
    message TEXT,
    data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow sharing and collaboration
CREATE TABLE IF NOT EXISTS workflow_shares (
    id SERIAL PRIMARY KEY,
    workflow_id VARCHAR(255) REFERENCES workflows(id) ON DELETE CASCADE,
    shared_by INTEGER REFERENCES users(id),
    shared_with INTEGER REFERENCES users(id),
    permission VARCHAR(50) DEFAULT 'view', -- view, edit, execute
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id, shared_with)
);

-- Workflow ratings and reviews
CREATE TABLE IF NOT EXISTS workflow_reviews (
    id SERIAL PRIMARY KEY,
    workflow_id VARCHAR(255) REFERENCES workflows(id) ON DELETE CASCADE,
    template_id VARCHAR(255) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id, user_id),
    UNIQUE(template_id, user_id)
);

-- Workflow node types registry
CREATE TABLE IF NOT EXISTS workflow_node_types (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    config_schema JSONB,
    icon VARCHAR(50),
    color VARCHAR(20),
    is_custom BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow analytics and metrics
CREATE TABLE IF NOT EXISTS workflow_analytics (
    id SERIAL PRIMARY KEY,
    workflow_id VARCHAR(255) REFERENCES workflows(id) ON DELETE CASCADE,
    template_id VARCHAR(255) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4),
    metric_data JSONB,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_difficulty ON workflow_templates(difficulty);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_rating ON workflow_templates(rating DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_usage_count ON workflow_templates(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_start_time ON workflow_executions(start_time);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_execution_id ON workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_timestamp ON workflow_execution_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_event ON workflow_execution_logs(event);

CREATE INDEX IF NOT EXISTS idx_workflow_shares_workflow_id ON workflow_shares(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_shares_shared_with ON workflow_shares(shared_with);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_workflows_definition_gin ON workflows USING GIN (definition);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_definition_gin ON workflow_templates USING GIN (definition);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_execution_path_gin ON workflow_executions USING GIN (execution_path);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_workflows_search ON workflows USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_workflow_templates_search ON workflow_templates USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Insert default node types
INSERT INTO workflow_node_types (id, name, description, category, config_schema, icon, color) VALUES
    ('start', 'Start Node', 'Entry point for workflow execution', 'control', '{}', '▶️', '#4ade80'),
    ('end', 'End Node', 'Exit point for workflow execution', 'control', '{}', '⏹️', '#ef4444'),
    ('ai_task', 'AI Task', 'Execute AI operations (chat, embedding, etc.)', 'ai', 
     '{"task": {"type": "string", "enum": ["chat", "embedding", "classification", "vision", "audio_transcribe"]}, "provider": {"type": "string"}, "model": {"type": "string"}, "prompt": {"type": "string"}, "options": {"type": "object"}}', 
     '🤖', '#6366f1'),
    ('condition', 'Condition', 'Conditional branching based on data', 'logic', 
     '{"condition": {"type": "string"}, "branches": {"type": "object"}}', 
     '🔀', '#f59e0b'),
    ('transform', 'Transform Data', 'Transform and format data', 'data', 
     '{"transformation": {"type": "object"}, "outputPath": {"type": "string"}}', 
     '🔄', '#8b5cf6'),
    ('parallel', 'Parallel Execution', 'Execute multiple branches in parallel', 'control', 
     '{"branches": {"type": "array"}, "mergeStrategy": {"type": "string"}}', 
     '⚡', '#06b6d4'),
    ('loop', 'Loop', 'Iterate over data or conditions', 'control', 
     '{"condition": {"type": "string"}, "maxIterations": {"type": "number"}, "loopBody": {"type": "array"}}', 
     '🔁', '#84cc16'),
    ('delay', 'Delay', 'Wait for specified duration', 'utility', 
     '{"duration": {"type": "number"}}', 
     '⏰', '#6b7280'),
    ('webhook', 'Webhook', 'Send HTTP requests to external services', 'integration', 
     '{"url": {"type": "string"}, "method": {"type": "string"}, "headers": {"type": "object"}, "body": {"type": "object"}}', 
     '🌐', '#10b981'),
    ('database', 'Database Operation', 'Execute database queries', 'data', 
     '{"operation": {"type": "string", "enum": ["select", "insert", "update", "delete"]}, "query": {"type": "string"}, "parameters": {"type": "array"}}', 
     '🗄️', '#3b82f6')
ON CONFLICT (id) DO NOTHING;

-- Create views for analytics
CREATE OR REPLACE VIEW workflow_execution_summary AS
SELECT 
    w.id as workflow_id,
    w.name as workflow_name,
    w.user_id,
    COUNT(we.id) as total_executions,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
    COUNT(CASE WHEN we.status = 'running' THEN 1 END) as running_executions,
    AVG(we.duration_ms) as avg_duration_ms,
    MIN(we.start_time) as first_execution,
    MAX(we.start_time) as last_execution
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
WHERE w.status = 'active'
GROUP BY w.id, w.name, w.user_id;

CREATE OR REPLACE VIEW workflow_template_popularity AS
SELECT 
    wt.id,
    wt.name,
    wt.category,
    wt.difficulty,
    wt.usage_count,
    wt.rating,
    COUNT(wr.id) as review_count,
    COUNT(we.id) as execution_count,
    AVG(we.duration_ms) as avg_execution_time_ms
FROM workflow_templates wt
LEFT JOIN workflow_reviews wr ON wt.id = wr.template_id
LEFT JOIN workflow_executions we ON wt.id = we.template_id
WHERE wt.is_public = true
GROUP BY wt.id, wt.name, wt.category, wt.difficulty, wt.usage_count, wt.rating
ORDER BY wt.usage_count DESC, wt.rating DESC;

CREATE OR REPLACE VIEW workflow_node_usage_stats AS
SELECT 
    node_type,
    COUNT(*) as usage_count,
    COUNT(DISTINCT workflow_id) as unique_workflows,
    AVG(node_duration_ms) as avg_duration_ms
FROM (
    SELECT 
        we.workflow_id,
        jsonb_array_elements(we.execution_path)->>'nodeId' as node_id,
        jsonb_array_elements(we.execution_path)->>'type' as node_type,
        (jsonb_array_elements(we.execution_path)->>'duration')::integer as node_duration_ms
    FROM workflow_executions we
    WHERE we.status = 'completed'
    AND jsonb_array_length(we.execution_path) > 0
) node_stats
GROUP BY node_type
ORDER BY usage_count DESC;

-- Functions for workflow management
CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflows_updated_at_trigger
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_updated_at();

CREATE TRIGGER workflow_templates_updated_at_trigger
    BEFORE UPDATE ON workflow_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_updated_at();

-- Function to calculate workflow template ratings
CREATE OR REPLACE FUNCTION update_template_rating(template_id_param VARCHAR(255))
RETURNS VOID AS $$
BEGIN
    UPDATE workflow_templates 
    SET rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM workflow_reviews 
        WHERE workflow_reviews.template_id = template_id_param
    )
    WHERE id = template_id_param;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update template ratings when reviews are added/updated
CREATE OR REPLACE FUNCTION update_template_rating_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_template_rating(NEW.template_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_template_rating(OLD.template_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_reviews_rating_trigger
    AFTER INSERT OR UPDATE OR DELETE ON workflow_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_template_rating_trigger();

-- Add comments
COMMENT ON TABLE workflows IS 'User-created workflow definitions';
COMMENT ON TABLE workflow_templates IS 'Pre-built workflow templates and shared workflows';
COMMENT ON TABLE workflow_executions IS 'Runtime instances of workflow executions';
COMMENT ON TABLE workflow_execution_logs IS 'Detailed step-by-step execution logs';
COMMENT ON TABLE workflow_shares IS 'Workflow sharing and collaboration permissions';
COMMENT ON TABLE workflow_reviews IS 'User ratings and reviews for workflows and templates';
COMMENT ON TABLE workflow_node_types IS 'Registry of available workflow node types';
COMMENT ON TABLE workflow_analytics IS 'Workflow performance and usage analytics';

COMMENT ON VIEW workflow_execution_summary IS 'Aggregated execution statistics per workflow';
COMMENT ON VIEW workflow_template_popularity IS 'Template popularity and performance metrics';
COMMENT ON VIEW workflow_node_usage_stats IS 'Usage statistics for different node types';