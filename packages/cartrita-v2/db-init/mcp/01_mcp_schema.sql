-- =====================================================
-- MCP (Master Control Program) Database Schema
-- Integrates with existing Cartrita schema
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable vector extension if not exists (for future vector operations)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- MCP Messages Table (for exactly-once delivery)
-- =====================================================
CREATE TABLE IF NOT EXISTS mcp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID UNIQUE NOT NULL,
    correlation_id UUID,
    trace_id VARCHAR(32),
    span_id VARCHAR(32),
    sender VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    message_type VARCHAR(100) NOT NULL,
    payload JSONB,
    context JSONB,
    delivery JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Add constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0 AND retry_count <= 10)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_messages_message_id ON mcp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_correlation_id ON mcp_messages(correlation_id);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_trace_id ON mcp_messages(trace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_status ON mcp_messages(status);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_created_at ON mcp_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_recipient ON mcp_messages(recipient);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_sender ON mcp_messages(sender);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_type ON mcp_messages(message_type);

-- =====================================================
-- MCP Agent Registry
-- =====================================================
CREATE TABLE IF NOT EXISTS mcp_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    tier INTEGER NOT NULL,
    version VARCHAR(50),
    capabilities JSONB,
    metadata JSONB,
    health JSONB,
    config JSONB,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Add constraints
    CONSTRAINT valid_tier CHECK (tier IN (0, 1, 2)),
    CONSTRAINT valid_agent_type CHECK (agent_type IN ('ORCHESTRATOR', 'SUPERVISOR', 'SUB_AGENT'))
);

-- Indexes for agent registry
CREATE INDEX IF NOT EXISTS idx_mcp_agents_agent_id ON mcp_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_agents_type ON mcp_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_mcp_agents_tier ON mcp_agents(tier);
CREATE INDEX IF NOT EXISTS idx_mcp_agents_active ON mcp_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_mcp_agents_heartbeat ON mcp_agents(last_heartbeat);

-- =====================================================
-- MCP Task Executions (for monitoring and analytics)
-- =====================================================
CREATE TABLE IF NOT EXISTS mcp_task_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID UNIQUE NOT NULL,
    correlation_id UUID,
    task_type VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255),
    supervisor_id VARCHAR(255),
    user_id VARCHAR(255), -- Links to existing users table
    workspace_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    parameters JSONB,
    result JSONB,
    error_message TEXT,
    error_code VARCHAR(100),
    metrics JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    queue_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    model_used VARCHAR(100),
    trace_id VARCHAR(32),
    span_id VARCHAR(32),
    
    -- Add constraints
    CONSTRAINT valid_task_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
    CONSTRAINT valid_priority CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0 AND retry_count <= 10)
);

-- Indexes for task executions
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_task_id ON mcp_task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_correlation_id ON mcp_task_executions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_type ON mcp_task_executions(task_type);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_status ON mcp_task_executions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_user_id ON mcp_task_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_agent_id ON mcp_task_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_supervisor_id ON mcp_task_executions(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_started_at ON mcp_task_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_completed_at ON mcp_task_executions(completed_at);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_trace_id ON mcp_task_executions(trace_id);

-- =====================================================
-- MCP Audit Log (comprehensive audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS mcp_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    actor_id VARCHAR(255),
    actor_type VARCHAR(50), -- 'user', 'agent', 'system'
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    sensitive_data_hash VARCHAR(64), -- SHA-256 hash of sensitive data
    ip_address INET,
    user_agent TEXT,
    trace_id VARCHAR(32),
    span_id VARCHAR(32),
    correlation_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add constraints
    CONSTRAINT valid_actor_type CHECK (actor_type IN ('user', 'agent', 'system', 'external'))
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_mcp_audit_event_type ON mcp_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_actor_id ON mcp_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_actor_type ON mcp_audit_log(actor_type);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_resource_type ON mcp_audit_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_resource_id ON mcp_audit_log(resource_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_action ON mcp_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_created_at ON mcp_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_trace_id ON mcp_audit_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_correlation_id ON mcp_audit_log(correlation_id);

-- =====================================================
-- MCP Cost Tracking (integrates with budget management)
-- =====================================================
CREATE TABLE IF NOT EXISTS mcp_cost_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255), -- Links to existing users table
    workspace_id VARCHAR(255),
    task_id UUID,
    agent_id VARCHAR(255),
    model_name VARCHAR(100),
    provider VARCHAR(50), -- 'openai', 'huggingface', 'deepgram', etc.
    service_type VARCHAR(100), -- 'text-generation', 'audio-transcription', etc.
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    tokens_total INTEGER DEFAULT 0,
    cost_per_token DECIMAL(12,9),
    cost_usd DECIMAL(10,6) NOT NULL,
    billing_period DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for cost tracking
CREATE INDEX IF NOT EXISTS idx_mcp_cost_user_id ON mcp_cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_cost_workspace_id ON mcp_cost_tracking(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mcp_cost_task_id ON mcp_cost_tracking(task_id);
CREATE INDEX IF NOT EXISTS idx_mcp_cost_agent_id ON mcp_cost_tracking(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_cost_model_name ON mcp_cost_tracking(model_name);
CREATE INDEX IF NOT EXISTS idx_mcp_cost_provider ON mcp_cost_tracking(provider);
CREATE INDEX IF NOT EXISTS idx_mcp_cost_billing_period ON mcp_cost_tracking(billing_period);
CREATE INDEX IF NOT EXISTS idx_mcp_cost_created_at ON mcp_cost_tracking(created_at);

-- =====================================================
-- MCP Cache (for intelligent caching of results)
-- =====================================================
CREATE TABLE IF NOT EXISTS mcp_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(512) UNIQUE NOT NULL,
    task_type VARCHAR(255) NOT NULL,
    parameters_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of parameters
    result JSONB NOT NULL,
    metadata JSONB,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Add TTL constraint
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for cache
CREATE INDEX IF NOT EXISTS idx_mcp_cache_key ON mcp_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_mcp_cache_type ON mcp_cache(task_type);
CREATE INDEX IF NOT EXISTS idx_mcp_cache_hash ON mcp_cache(parameters_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_cache_expires ON mcp_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_cache_last_accessed ON mcp_cache(last_accessed);

-- =====================================================
-- MCP Metrics (for OpenTelemetry integration)
-- =====================================================
CREATE TABLE IF NOT EXISTS mcp_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'counter', 'histogram', 'gauge'
    value DOUBLE PRECISION NOT NULL,
    labels JSONB,
    agent_id VARCHAR(255),
    task_id UUID,
    trace_id VARCHAR(32),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add constraints
    CONSTRAINT valid_metric_type CHECK (metric_type IN ('counter', 'histogram', 'gauge', 'summary'))
);

-- Indexes for metrics
CREATE INDEX IF NOT EXISTS idx_mcp_metrics_name ON mcp_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_mcp_metrics_type ON mcp_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_mcp_metrics_agent_id ON mcp_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_metrics_task_id ON mcp_metrics(task_id);
CREATE INDEX IF NOT EXISTS idx_mcp_metrics_recorded_at ON mcp_metrics(recorded_at);

-- =====================================================
-- Foreign Key Relationships (where applicable)
-- =====================================================

-- Link MCP task executions to existing users table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE mcp_task_executions 
        ADD CONSTRAINT fk_mcp_task_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL;
        
        ALTER TABLE mcp_cost_tracking 
        ADD CONSTRAINT fk_mcp_cost_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN 
        -- Foreign key already exists, skip
        NULL;
END $$;

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for mcp_messages updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mcp_messages_updated_at') THEN
        CREATE TRIGGER update_mcp_messages_updated_at 
        BEFORE UPDATE ON mcp_messages 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Function to cleanup expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM mcp_messages 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM mcp_cache 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Initial Data and Configuration
-- =====================================================

-- Insert initial orchestrator agent
INSERT INTO mcp_agents (
    agent_id,
    agent_name,
    agent_type,
    tier,
    version,
    capabilities,
    metadata,
    health
) VALUES (
    'mcp-orchestrator',
    'MCP Orchestrator',
    'ORCHESTRATOR',
    0,
    '1.0.0',
    '["routing", "authentication", "load_balancing", "health_monitoring"]'::jsonb,
    '{"description": "Tier-0 MCP Orchestrator for request routing and system coordination"}'::jsonb,
    '{"status": "initializing", "cpu_usage": 0, "memory_mb": 0}'::jsonb
) ON CONFLICT (agent_id) DO UPDATE SET
    last_heartbeat = NOW(),
    version = EXCLUDED.version,
    capabilities = EXCLUDED.capabilities;

-- =====================================================
-- Permissions and Security
-- =====================================================

-- Create MCP-specific role for agents
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp_agent') THEN
        CREATE ROLE mcp_agent;
        
        -- Grant necessary permissions
        GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO mcp_agent;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mcp_agent;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO mcp_agent;
        
        -- Allow future objects
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO mcp_agent;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mcp_agent;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO mcp_agent;
    END IF;
END $$;

-- =====================================================
-- Success Notification
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ MCP database schema initialized successfully!';
    RAISE NOTICE '📊 Tables created: mcp_messages, mcp_agents, mcp_task_executions, mcp_audit_log, mcp_cost_tracking, mcp_cache, mcp_metrics';
    RAISE NOTICE '🔧 Functions created: cleanup_expired_mcp_messages(), cleanup_expired_mcp_cache()';
    RAISE NOTICE '👤 Role created: mcp_agent';
    RAISE NOTICE '🚀 MCP system ready for integration with existing Cartrita infrastructure';
END $$;