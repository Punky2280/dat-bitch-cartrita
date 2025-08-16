-- Task 25 Component 2: Workflow Execution Engine Database Schema
-- Advanced execution tracking and monitoring tables
-- Created: December 2024

-- Workflow Executions Table (enhanced)
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    input_data JSONB NOT NULL DEFAULT '{}',
    result_data JSONB,
    error_message TEXT,
    settings JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Execution metadata
    execution_context JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 0,
    timeout_seconds INTEGER DEFAULT 3600,
    priority INTEGER DEFAULT 5,
    
    -- Performance metrics
    nodes_executed INTEGER DEFAULT 0,
    nodes_failed INTEGER DEFAULT 0,
    parallel_branches INTEGER DEFAULT 0,
    retries_performed INTEGER DEFAULT 0,
    
    CONSTRAINT fk_workflow_executions_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_executions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_workflow_executions_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    CONSTRAINT chk_workflow_executions_priority CHECK (priority >= 1 AND priority <= 10)
);

-- Node Executions Table (detailed execution tracking)
CREATE TABLE IF NOT EXISTS workflow_node_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL,
    node_id VARCHAR(255) NOT NULL,
    node_type VARCHAR(100) NOT NULL,
    node_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    
    -- Node execution metadata
    execution_order INTEGER,
    parent_node_id VARCHAR(255),
    branch_id VARCHAR(255),
    
    CONSTRAINT fk_node_executions_execution FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    CONSTRAINT chk_node_executions_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'retrying'))
);

-- Execution Logs Table (detailed logging)
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL,
    node_id VARCHAR(255),
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Log metadata
    source VARCHAR(100),
    thread_id VARCHAR(100),
    correlation_id VARCHAR(100),
    
    CONSTRAINT fk_execution_logs_execution FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    CONSTRAINT chk_execution_logs_level CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal'))
);

-- Execution Variables Table (runtime variable storage)
CREATE TABLE IF NOT EXISTS workflow_execution_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    scope VARCHAR(20) NOT NULL DEFAULT 'local',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Variable metadata
    data_type VARCHAR(50),
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT fk_execution_variables_execution FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    CONSTRAINT chk_execution_variables_scope CHECK (scope IN ('local', 'global', 'session')),
    CONSTRAINT uq_execution_variables_name_scope UNIQUE (execution_id, name, scope)
);

-- Execution State Snapshots Table (checkpointing)
CREATE TABLE IF NOT EXISTS workflow_execution_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL,
    snapshot_type VARCHAR(50) NOT NULL DEFAULT 'checkpoint',
    state_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Snapshot metadata
    description TEXT,
    file_size_bytes INTEGER,
    compression_type VARCHAR(20),
    
    CONSTRAINT fk_execution_snapshots_execution FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    CONSTRAINT chk_execution_snapshots_type CHECK (snapshot_type IN ('checkpoint', 'error', 'completion', 'manual'))
);

-- Execution Queue Table (scheduling and queue management)
CREATE TABLE IF NOT EXISTS workflow_execution_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL,
    user_id UUID NOT NULL,
    priority INTEGER DEFAULT 5,
    input_data JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Queue metadata
    queue_name VARCHAR(100) DEFAULT 'default',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    
    CONSTRAINT fk_execution_queue_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_execution_queue_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_execution_queue_status CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT chk_execution_queue_priority CHECK (priority >= 1 AND priority <= 10)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Workflow executions indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_status ON workflow_executions(workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_status ON workflow_executions(user_id, status);

-- Node executions indexes
CREATE INDEX IF NOT EXISTS idx_node_executions_execution_id ON workflow_node_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_node_executions_node_id ON workflow_node_executions(node_id);
CREATE INDEX IF NOT EXISTS idx_node_executions_status ON workflow_node_executions(status);
CREATE INDEX IF NOT EXISTS idx_node_executions_started_at ON workflow_node_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_node_executions_execution_order ON workflow_node_executions(execution_id, execution_order);

-- Execution logs indexes
CREATE INDEX IF NOT EXISTS idx_execution_logs_execution_id ON workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_level ON workflow_execution_logs(level);
CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON workflow_execution_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_node_id ON workflow_execution_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_execution_timestamp ON workflow_execution_logs(execution_id, timestamp);

-- Execution variables indexes
CREATE INDEX IF NOT EXISTS idx_execution_variables_execution_id ON workflow_execution_variables(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_variables_name ON workflow_execution_variables(name);
CREATE INDEX IF NOT EXISTS idx_execution_variables_scope ON workflow_execution_variables(scope);

-- Execution snapshots indexes
CREATE INDEX IF NOT EXISTS idx_execution_snapshots_execution_id ON workflow_execution_snapshots(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_snapshots_type ON workflow_execution_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_execution_snapshots_created_at ON workflow_execution_snapshots(created_at DESC);

-- Execution queue indexes
CREATE INDEX IF NOT EXISTS idx_execution_queue_status ON workflow_execution_queue(status);
CREATE INDEX IF NOT EXISTS idx_execution_queue_priority ON workflow_execution_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_execution_queue_scheduled_for ON workflow_execution_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_execution_queue_created_at ON workflow_execution_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_execution_queue_workflow_id ON workflow_execution_queue(workflow_id);
CREATE INDEX IF NOT EXISTS idx_execution_queue_user_id ON workflow_execution_queue(user_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workflow_executions_composite ON workflow_executions(workflow_id, user_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_composite ON workflow_execution_logs(execution_id, level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_execution_queue_processing ON workflow_execution_queue(status, priority DESC, scheduled_for) 
WHERE status IN ('queued', 'processing');

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update workflow_executions.updated_at trigger
CREATE OR REPLACE FUNCTION update_workflow_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_workflow_executions_updated_at ON workflow_executions;
CREATE TRIGGER tr_workflow_executions_updated_at
    BEFORE UPDATE ON workflow_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_executions_updated_at();

-- Update execution variables updated_at trigger
CREATE OR REPLACE FUNCTION update_execution_variables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_execution_variables_updated_at ON workflow_execution_variables;
CREATE TRIGGER tr_execution_variables_updated_at
    BEFORE UPDATE ON workflow_execution_variables
    FOR EACH ROW
    EXECUTE FUNCTION update_execution_variables_updated_at();

-- Calculate node execution duration trigger
CREATE OR REPLACE FUNCTION calculate_node_execution_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_node_executions_duration ON workflow_node_executions;
CREATE TRIGGER tr_node_executions_duration
    BEFORE INSERT OR UPDATE ON workflow_node_executions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_node_execution_duration();

-- Update execution queue updated_at trigger
CREATE OR REPLACE FUNCTION update_execution_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_execution_queue_updated_at ON workflow_execution_queue;
CREATE TRIGGER tr_execution_queue_updated_at
    BEFORE UPDATE ON workflow_execution_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_execution_queue_updated_at();

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Execution summary view
CREATE OR REPLACE VIEW workflow_execution_summary AS
SELECT 
    we.id,
    we.workflow_id,
    w.name as workflow_name,
    w.category as workflow_category,
    we.user_id,
    u.email as user_email,
    we.status,
    we.started_at,
    we.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(we.completed_at, NOW()) - we.started_at)) * 1000 as duration_ms,
    we.nodes_executed,
    we.nodes_failed,
    we.parallel_branches,
    we.retries_performed,
    we.retry_count,
    CASE 
        WHEN we.nodes_executed + we.nodes_failed > 0 
        THEN ROUND((we.nodes_executed::DECIMAL / (we.nodes_executed + we.nodes_failed)) * 100, 2)
        ELSE 0 
    END as success_rate_percent
FROM workflow_executions we
LEFT JOIN workflows w ON we.workflow_id = w.id
LEFT JOIN users u ON we.user_id = u.id;

-- Node execution statistics view
CREATE OR REPLACE VIEW workflow_node_execution_stats AS
SELECT 
    wne.execution_id,
    COUNT(*) as total_nodes,
    COUNT(CASE WHEN wne.status = 'completed' THEN 1 END) as completed_nodes,
    COUNT(CASE WHEN wne.status = 'failed' THEN 1 END) as failed_nodes,
    COUNT(CASE WHEN wne.status = 'running' THEN 1 END) as running_nodes,
    AVG(wne.duration_ms) as avg_duration_ms,
    MAX(wne.duration_ms) as max_duration_ms,
    MIN(wne.duration_ms) as min_duration_ms,
    SUM(wne.retry_count) as total_retries
FROM workflow_node_executions wne
GROUP BY wne.execution_id;

-- Recent execution activity view
CREATE OR REPLACE VIEW recent_workflow_activity AS
SELECT 
    we.id as execution_id,
    we.workflow_id,
    w.name as workflow_name,
    we.status,
    we.started_at,
    we.completed_at,
    u.email as user_email,
    EXTRACT(EPOCH FROM (COALESCE(we.completed_at, NOW()) - we.started_at)) * 1000 as duration_ms
FROM workflow_executions we
LEFT JOIN workflows w ON we.workflow_id = w.id
LEFT JOIN users u ON we.user_id = u.id
WHERE we.started_at >= NOW() - INTERVAL '24 hours'
ORDER BY we.started_at DESC;

-- =============================================================================
-- SAMPLE DATA FOR TESTING
-- =============================================================================

-- Note: Sample data should be added after workflows and users exist

COMMENT ON TABLE workflow_executions IS 'Main execution tracking table for workflow runs';
COMMENT ON TABLE workflow_node_executions IS 'Detailed tracking of individual node executions within workflows';
COMMENT ON TABLE workflow_execution_logs IS 'Comprehensive logging system for workflow and node execution events';
COMMENT ON TABLE workflow_execution_variables IS 'Runtime variable storage for workflow executions';
COMMENT ON TABLE workflow_execution_snapshots IS 'Execution state snapshots for checkpointing and recovery';
COMMENT ON TABLE workflow_execution_queue IS 'Queue management system for scheduled and batch workflow executions';

-- Performance monitoring functions

-- Function to cleanup old execution data
CREATE OR REPLACE FUNCTION cleanup_old_execution_data(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete old execution logs (keep logs for completed executions for specified days)
    DELETE FROM workflow_execution_logs 
    WHERE execution_id IN (
        SELECT id FROM workflow_executions 
        WHERE status IN ('completed', 'failed', 'cancelled') 
        AND completed_at < NOW() - INTERVAL '1 day' * days_to_keep
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old node executions
    DELETE FROM workflow_node_executions 
    WHERE execution_id IN (
        SELECT id FROM workflow_executions 
        WHERE status IN ('completed', 'failed', 'cancelled') 
        AND completed_at < NOW() - INTERVAL '1 day' * days_to_keep
    );
    
    -- Delete old execution variables
    DELETE FROM workflow_execution_variables 
    WHERE execution_id IN (
        SELECT id FROM workflow_executions 
        WHERE status IN ('completed', 'failed', 'cancelled') 
        AND completed_at < NOW() - INTERVAL '1 day' * days_to_keep
    );
    
    -- Delete old snapshots (except completion snapshots)
    DELETE FROM workflow_execution_snapshots 
    WHERE execution_id IN (
        SELECT id FROM workflow_executions 
        WHERE status IN ('completed', 'failed', 'cancelled') 
        AND completed_at < NOW() - INTERVAL '1 day' * days_to_keep
    ) AND snapshot_type != 'completion';
    
    -- Finally delete old execution records
    DELETE FROM workflow_executions 
    WHERE status IN ('completed', 'failed', 'cancelled') 
    AND completed_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_execution_data IS 'Cleanup old workflow execution data older than specified days';
