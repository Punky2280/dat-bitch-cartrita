-- Cartrita V2 - Agent Orchestration Database Schema
-- Migration 001: Core agent orchestration and performance tracking tables
-- Supports PostgreSQL with optimizations for high-throughput agent operations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Conversation Sessions
-- Tracks multi-turn conversations and their context
CREATE TABLE conversation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    context_summary TEXT,
    metadata JSONB DEFAULT '{}',
    total_messages INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10, 6) DEFAULT 0.00
);

-- Indexes for conversation_sessions
CREATE INDEX idx_conversation_sessions_session_id ON conversation_sessions(session_id);
CREATE INDEX idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX idx_conversation_sessions_active ON conversation_sessions(is_active, last_activity);
CREATE INDEX idx_conversation_sessions_metadata ON conversation_sessions USING GIN(metadata);

-- Agent Instances
-- Tracks all specialist agents and their configurations
CREATE TABLE agent_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL UNIQUE,
    agent_type VARCHAR(100) NOT NULL, -- orchestrator, retrieval, code, etc.
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prompt_id VARCHAR(255), -- Reference to versioned prompt
    prompt_version VARCHAR(50),
    model_config JSONB NOT NULL DEFAULT '{}', -- model, temperature, etc.
    capabilities JSONB DEFAULT '[]', -- array of capability strings
    tools_allowed JSONB DEFAULT '[]', -- array of tool names
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, error, maintenance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    performance_metrics JSONB DEFAULT '{}'
);

-- Indexes for agent_instances
CREATE INDEX idx_agent_instances_agent_id ON agent_instances(agent_id);
CREATE INDEX idx_agent_instances_type_status ON agent_instances(agent_type, status);
CREATE INDEX idx_agent_instances_capabilities ON agent_instances USING GIN(capabilities);
CREATE INDEX idx_agent_instances_tools ON agent_instances USING GIN(tools_allowed);

-- Task Executions
-- Records of all task executions with routing decisions
CREATE TABLE task_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(255) NOT NULL UNIQUE,
    session_id UUID REFERENCES conversation_sessions(id),
    user_id VARCHAR(255) NOT NULL,
    orchestrator_agent_id VARCHAR(255) REFERENCES agent_instances(agent_id),
    assigned_agent_id VARCHAR(255) REFERENCES agent_instances(agent_id),
    task_description TEXT NOT NULL,
    task_classification JSONB DEFAULT '{}', -- intents, complexity, etc.
    routing_decision JSONB DEFAULT '{}', -- model chosen, reasoning_effort, etc.
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, cancelled
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd DECIMAL(8, 6) DEFAULT 0.00,
    result_content TEXT,
    result_metadata JSONB DEFAULT '{}',
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    parent_task_id UUID REFERENCES task_executions(id), -- for sub-tasks
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for task_executions  
CREATE INDEX idx_task_executions_task_id ON task_executions(task_id);
CREATE INDEX idx_task_executions_session ON task_executions(session_id);
CREATE INDEX idx_task_executions_user_status ON task_executions(user_id, status);
CREATE INDEX idx_task_executions_agent_status ON task_executions(assigned_agent_id, status);
CREATE INDEX idx_task_executions_started_at ON task_executions(started_at);
CREATE INDEX idx_task_executions_classification ON task_executions USING GIN(task_classification);
CREATE INDEX idx_task_executions_routing ON task_executions USING GIN(routing_decision);
CREATE INDEX idx_task_executions_parent ON task_executions(parent_task_id);

-- Tool Executions
-- Detailed logging of all tool executions by agents
CREATE TABLE tool_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id VARCHAR(255) NOT NULL,
    task_id UUID REFERENCES task_executions(id),
    agent_id VARCHAR(255) REFERENCES agent_instances(agent_id),
    tool_name VARCHAR(255) NOT NULL,
    tool_category VARCHAR(100), -- system, web, file, etc.
    security_level VARCHAR(50), -- safe, monitored, restricted, dangerous
    arguments_hash VARCHAR(32), -- SHA256 hash of arguments for auditing
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER DEFAULT 0,
    result_size_bytes INTEGER DEFAULT 0,
    error_type VARCHAR(255),
    error_message TEXT,
    permission_granted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tool_executions
CREATE INDEX idx_tool_executions_execution_id ON tool_executions(execution_id);
CREATE INDEX idx_tool_executions_task ON tool_executions(task_id);
CREATE INDEX idx_tool_executions_agent_tool ON tool_executions(agent_id, tool_name);
CREATE INDEX idx_tool_executions_success_time ON tool_executions(success, created_at);
CREATE INDEX idx_tool_executions_security ON tool_executions(security_level, created_at);

-- Agent Performance Metrics
-- Aggregated performance statistics per agent per time period
CREATE TABLE agent_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) REFERENCES agent_instances(agent_id),
    time_period DATE NOT NULL, -- daily aggregation
    total_tasks INTEGER DEFAULT 0,
    successful_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    avg_execution_time_ms DECIMAL(10, 2) DEFAULT 0.00,
    p95_execution_time_ms INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(8, 6) DEFAULT 0.00,
    avg_cost_per_task_usd DECIMAL(8, 6) DEFAULT 0.00,
    tool_usage_stats JSONB DEFAULT '{}', -- per-tool usage counts
    error_breakdown JSONB DEFAULT '{}', -- error types and counts
    model_usage JSONB DEFAULT '{}', -- which models were used how often
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent_performance_metrics
CREATE UNIQUE INDEX idx_agent_performance_unique ON agent_performance_metrics(agent_id, time_period);
CREATE INDEX idx_agent_performance_period ON agent_performance_metrics(time_period);
CREATE INDEX idx_agent_performance_stats ON agent_performance_metrics USING GIN(tool_usage_stats);

-- Vector Store Sessions
-- Tracks OpenAI vector store usage and lifecycle
CREATE TABLE vector_store_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vector_store_id VARCHAR(255) NOT NULL UNIQUE, -- OpenAI vector store ID
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(255), -- agent_id or user_id
    store_config JSONB DEFAULT '{}', -- chunking strategy, expiration, etc.
    status VARCHAR(50) DEFAULT 'creating', -- creating, active, expired, deleted
    file_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    search_count INTEGER DEFAULT 0,
    last_search_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for vector_store_sessions
CREATE INDEX idx_vector_store_sessions_store_id ON vector_store_sessions(vector_store_id);
CREATE INDEX idx_vector_store_sessions_status ON vector_store_sessions(status);
CREATE INDEX idx_vector_store_sessions_expires ON vector_store_sessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_vector_store_sessions_created_by ON vector_store_sessions(created_by);

-- File Uploads
-- Tracks files uploaded to vector stores
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id VARCHAR(255) NOT NULL UNIQUE, -- OpenAI file ID
    original_filename VARCHAR(255) NOT NULL,
    size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100),
    upload_hash VARCHAR(64), -- SHA256 of content for deduplication
    vector_store_ids JSONB DEFAULT '[]', -- array of vector store IDs
    processing_status VARCHAR(50) DEFAULT 'uploading', -- uploading, processing, completed, failed
    upload_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    chunk_count INTEGER,
    uploaded_by VARCHAR(255), -- agent_id or user_id
    metadata JSONB DEFAULT '{}'
);

-- Indexes for file_uploads
CREATE INDEX idx_file_uploads_file_id ON file_uploads(file_id);
CREATE INDEX idx_file_uploads_hash ON file_uploads(upload_hash);
CREATE INDEX idx_file_uploads_status ON file_uploads(processing_status);
CREATE INDEX idx_file_uploads_vector_stores ON file_uploads USING GIN(vector_store_ids);
CREATE INDEX idx_file_uploads_uploaded_by ON file_uploads(uploaded_by);

-- Search Queries
-- Logs all vector store search operations
CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id VARCHAR(255) NOT NULL,
    session_id UUID REFERENCES conversation_sessions(id),
    task_id UUID REFERENCES task_executions(id),
    agent_id VARCHAR(255) REFERENCES agent_instances(agent_id),
    query_text TEXT NOT NULL,
    query_embedding_hash VARCHAR(32), -- for similarity detection
    vector_store_ids JSONB NOT NULL, -- stores searched
    max_results INTEGER DEFAULT 4,
    min_score DECIMAL(5, 4) DEFAULT 0.0000,
    result_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER DEFAULT 0,
    cost_estimate_usd DECIMAL(6, 6) DEFAULT 0.000000,
    results_summary JSONB DEFAULT '{}', -- file citations, scores, etc.
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for search_queries
CREATE INDEX idx_search_queries_query_id ON search_queries(query_id);
CREATE INDEX idx_search_queries_session ON search_queries(session_id);
CREATE INDEX idx_search_queries_task ON search_queries(task_id);
CREATE INDEX idx_search_queries_agent ON search_queries(agent_id);
CREATE INDEX idx_search_queries_embedding ON search_queries(query_embedding_hash);
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);
CREATE INDEX idx_search_queries_vector_stores ON search_queries USING GIN(vector_store_ids);

-- Prompt Versions
-- Versioned storage for all prompts used by agents
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    prompt_type VARCHAR(100) NOT NULL, -- persona_system_prompt, agent_system_prompt, etc.
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA256 of content
    description TEXT,
    model_compatibility JSONB DEFAULT '[]', -- supported models
    tokens_estimated INTEGER DEFAULT 0,
    usage_context VARCHAR(255),
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for prompt_versions
CREATE UNIQUE INDEX idx_prompt_versions_id_version ON prompt_versions(prompt_id, version);
CREATE INDEX idx_prompt_versions_type ON prompt_versions(prompt_type);
CREATE INDEX idx_prompt_versions_hash ON prompt_versions(content_hash);
CREATE INDEX idx_prompt_versions_active ON prompt_versions(prompt_id, is_active);
CREATE INDEX idx_prompt_versions_compatibility ON prompt_versions USING GIN(model_compatibility);

-- Model Usage Statistics  
-- Tracks usage patterns across different OpenAI models
CREATE TABLE model_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_period DATE NOT NULL, -- daily aggregation
    model_name VARCHAR(100) NOT NULL,
    agent_type VARCHAR(100), -- can be NULL for aggregation across types
    usage_category VARCHAR(100), -- orchestration, retrieval, code, etc.
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_cost_usd DECIMAL(10, 6) DEFAULT 0.00,
    avg_response_time_ms DECIMAL(10, 2) DEFAULT 0.00,
    p95_response_time_ms INTEGER DEFAULT 0,
    reasoning_effort_breakdown JSONB DEFAULT '{}', -- minimal, low, medium, high counts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for model_usage_stats
CREATE UNIQUE INDEX idx_model_usage_unique ON model_usage_stats(time_period, model_name, COALESCE(agent_type, ''), usage_category);
CREATE INDEX idx_model_usage_period ON model_usage_stats(time_period);
CREATE INDEX idx_model_usage_model ON model_usage_stats(model_name);
CREATE INDEX idx_model_usage_agent_type ON model_usage_stats(agent_type);

-- System Events
-- Audit log for system-wide events and admin actions
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- agent_created, tool_permission_granted, etc.
    event_source VARCHAR(100) NOT NULL, -- system, admin, agent, user
    actor_id VARCHAR(255), -- who/what caused the event
    target_resource VARCHAR(255), -- affected resource ID
    event_data JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info', -- debug, info, warning, error, critical
    message TEXT,
    correlation_id VARCHAR(255), -- for tracking related events
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for system_events
CREATE INDEX idx_system_events_event_id ON system_events(event_id);
CREATE INDEX idx_system_events_type_created ON system_events(event_type, created_at);
CREATE INDEX idx_system_events_source_actor ON system_events(event_source, actor_id);
CREATE INDEX idx_system_events_severity ON system_events(severity, created_at);
CREATE INDEX idx_system_events_correlation ON system_events(correlation_id);
CREATE INDEX idx_system_events_target ON system_events(target_resource);

-- Update triggers for automatic timestamp management
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_conversation_sessions_updated_at 
    BEFORE UPDATE ON conversation_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_instances_updated_at 
    BEFORE UPDATE ON agent_instances 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_executions_updated_at 
    BEFORE UPDATE ON task_executions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vector_store_sessions_updated_at 
    BEFORE UPDATE ON vector_store_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_performance_metrics_updated_at 
    BEFORE UPDATE ON agent_performance_metrics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_usage_stats_updated_at 
    BEFORE UPDATE ON model_usage_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries

-- Active agents summary view
CREATE VIEW v_active_agents AS
SELECT 
    ai.agent_id,
    ai.agent_type,
    ai.name,
    ai.status,
    ai.last_used,
    COUNT(te.id) as total_tasks_24h,
    AVG(te.execution_time_ms) as avg_execution_time_ms,
    SUM(te.cost_usd) as total_cost_24h_usd
FROM agent_instances ai
LEFT JOIN task_executions te ON ai.agent_id = te.assigned_agent_id 
    AND te.created_at > NOW() - INTERVAL '24 hours'
WHERE ai.status = 'active'
GROUP BY ai.agent_id, ai.agent_type, ai.name, ai.status, ai.last_used;

-- Performance dashboard view  
CREATE VIEW v_performance_dashboard AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_tasks,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_tasks,
    AVG(execution_time_ms) as avg_execution_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time_ms,
    SUM(cost_usd) as total_cost_usd,
    AVG(cost_usd) as avg_cost_per_task_usd,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens
FROM task_executions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Tool usage summary view
CREATE VIEW v_tool_usage_summary AS
SELECT 
    tool_name,
    tool_category,
    security_level,
    COUNT(*) as execution_count,
    COUNT(*) FILTER (WHERE success = true) as successful_executions,
    COUNT(*) FILTER (WHERE success = false) as failed_executions,
    AVG(execution_time_ms) as avg_execution_time_ms,
    COUNT(DISTINCT agent_id) as agents_using_tool
FROM tool_executions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY tool_name, tool_category, security_level
ORDER BY execution_count DESC;

-- Comments for documentation
COMMENT ON TABLE conversation_sessions IS 'Tracks user conversation sessions with context and metrics';
COMMENT ON TABLE agent_instances IS 'Registry of all specialist agents and their configurations';  
COMMENT ON TABLE task_executions IS 'Complete audit log of all task executions with routing decisions';
COMMENT ON TABLE tool_executions IS 'Detailed logging of individual tool executions for security and performance';
COMMENT ON TABLE agent_performance_metrics IS 'Aggregated daily performance metrics per agent';
COMMENT ON TABLE vector_store_sessions IS 'OpenAI vector store lifecycle and usage tracking';
COMMENT ON TABLE file_uploads IS 'File upload tracking for vector stores with deduplication';
COMMENT ON TABLE search_queries IS 'Vector store search query logging and performance tracking';
COMMENT ON TABLE prompt_versions IS 'Versioned prompt storage with content hashing';
COMMENT ON TABLE model_usage_stats IS 'Daily aggregated statistics for OpenAI model usage and costs';
COMMENT ON TABLE system_events IS 'System-wide audit log for admin actions and significant events';

-- Initial data: Insert default orchestrator agent
INSERT INTO agent_instances (agent_id, agent_type, name, description, model_config, capabilities, status)
VALUES (
    'cartrita_orchestrator_v2',
    'orchestrator', 
    'Cartrita Orchestrator',
    'Oye, I''m the main coordinator que routes tasks to specialist agents',
    '{"default_model": "gpt-5-mini", "reasoning_effort": "low", "max_tokens": 4096}',
    '["task_classification", "agent_routing", "plan_decomposition", "conversation_management"]',
    'active'
);

-- Migration completion marker
INSERT INTO system_events (event_id, event_type, event_source, message, event_data)
VALUES (
    'migration_001_complete',
    'schema_migration',
    'system',
    'Agent orchestration schema migration 001 completed successfully',
    '{"migration": "001_agent_orchestration_schema", "tables_created": 11, "indexes_created": 45, "views_created": 3}'
);