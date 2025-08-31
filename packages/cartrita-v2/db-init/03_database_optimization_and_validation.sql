-- Database Optimization and Validation Script
-- Ensures proper indexing, constraints, and labeling for Cartrita V2

-- First, let's validate and fix the workflow_tools table structure
DO $$
BEGIN
    -- Ensure all required columns exist with proper constraints
    
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='prerequisites') THEN
        ALTER TABLE workflow_tools ADD COLUMN prerequisites TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='technologies') THEN
        ALTER TABLE workflow_tools ADD COLUMN technologies TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='api_requirements') THEN
        ALTER TABLE workflow_tools ADD COLUMN api_requirements TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='estimated_time') THEN
        ALTER TABLE workflow_tools ADD COLUMN estimated_time VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='difficulty_rating') THEN
        ALTER TABLE workflow_tools ADD COLUMN difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='tags') THEN
        ALTER TABLE workflow_tools ADD COLUMN tags TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='is_white_hat') THEN
        ALTER TABLE workflow_tools ADD COLUMN is_white_hat BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='requires_permission') THEN
        ALTER TABLE workflow_tools ADD COLUMN requires_permission BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='safety_notes') THEN
        ALTER TABLE workflow_tools ADD COLUMN safety_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='author') THEN
        ALTER TABLE workflow_tools ADD COLUMN author VARCHAR(100) DEFAULT 'System';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='embedding') THEN
        ALTER TABLE workflow_tools ADD COLUMN embedding vector(1536);
    END IF;
    
    -- Add proper constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='workflow_tools_tool_type_check') THEN
        ALTER TABLE workflow_tools ADD CONSTRAINT workflow_tools_tool_type_check 
        CHECK (tool_type IN ('dev', 'security', 'devops', 'data', 'cloud', 'testing', 'monitoring', 'documentation', 'productivity', 'custom'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='workflow_tools_complexity_level_check') THEN
        ALTER TABLE workflow_tools ADD CONSTRAINT workflow_tools_complexity_level_check 
        CHECK (complexity_level IN ('beginner', 'intermediate', 'advanced', 'expert'));
    END IF;
    
END $$;

-- Optimize workflow_tools indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_tools_title_search ON workflow_tools USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_workflow_tools_description_search ON workflow_tools USING GIN(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_workflow_tools_combined_search ON workflow_tools USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(use_case, '')));

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_workflow_tools_type_complexity ON workflow_tools(tool_type, complexity_level) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_tools_category_rating ON workflow_tools(category_id, difficulty_rating) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_tools_white_hat_permission ON workflow_tools(is_white_hat, requires_permission) WHERE is_active = true;

-- Optimize user_manual_sections table
CREATE INDEX IF NOT EXISTS idx_manual_sections_title_search ON user_manual_sections USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_manual_sections_content_search ON user_manual_sections USING GIN(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_manual_sections_featured_difficulty ON user_manual_sections(is_featured, difficulty_level);

-- Create workflow execution optimization indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_status ON workflow_executions(user_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_duration ON workflow_executions((EXTRACT(EPOCH FROM (completed_at - started_at)))) WHERE completed_at IS NOT NULL;

-- Optimize agent-related tables
CREATE INDEX IF NOT EXISTS idx_agents_status_updated ON agents(status, updated_at DESC) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_interactions_session ON agent_interactions(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_type_status ON agent_interactions(interaction_type, status);

-- Chat and messaging optimizations
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_timestamp ON chat_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_recent ON chat_messages(user_id, created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_active ON chat_sessions(user_id, is_active, last_activity DESC);

-- Knowledge base optimizations
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_user_type ON knowledge_documents(user_id, document_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_embedding ON knowledge_chunks(document_id) WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_queries_user_recent ON knowledge_queries(user_id, created_at DESC) WHERE created_at > NOW() - INTERVAL '7 days';

-- API security optimizations
CREATE INDEX IF NOT EXISTS idx_api_security_events_user_severity ON api_security_events(user_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_security_events_recent ON api_security_events(created_at DESC) WHERE created_at > NOW() - INTERVAL '24 hours';

-- System health and telemetry
CREATE INDEX IF NOT EXISTS idx_system_health_service_timestamp ON system_health(service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_traces_service_duration ON telemetry_traces(service_name, duration DESC) WHERE duration IS NOT NULL;

-- Notification optimizations
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority_recent ON notifications(priority, created_at DESC) WHERE created_at > NOW() - INTERVAL '7 days';

-- User and authentication optimizations
CREATE INDEX IF NOT EXISTS idx_users_active_login ON users(is_active, last_login DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_category ON user_preferences(user_id, category);

-- Create materialized views for common aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_workflow_tools_stats AS
SELECT 
    tool_type,
    complexity_level,
    COUNT(*) as total_tools,
    COUNT(*) FILTER (WHERE is_active = true) as active_tools,
    COUNT(*) FILTER (WHERE is_white_hat = true) as white_hat_tools,
    COUNT(*) FILTER (WHERE requires_permission = true) as permission_required_tools,
    AVG(difficulty_rating) as avg_difficulty,
    array_agg(DISTINCT tags) FILTER (WHERE tags IS NOT NULL) as all_tags
FROM workflow_tools 
GROUP BY tool_type, complexity_level;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_workflow_tools_stats_unique ON mv_workflow_tools_stats(tool_type, complexity_level);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_workflow_stats() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_workflow_tools_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic refresh (requires pg_cron extension if available)
-- SELECT cron.schedule('refresh-workflow-stats', '*/15 * * * *', 'SELECT refresh_workflow_stats();');

-- Add table comments for documentation
COMMENT ON TABLE workflow_tools IS 'Comprehensive workflow automation tools with semantic search capabilities';
COMMENT ON TABLE user_manual_sections IS 'User documentation and help sections with full-text search';
COMMENT ON TABLE workflow_executions IS 'Audit trail of workflow executions with performance metrics';

-- Add column comments
COMMENT ON COLUMN workflow_tools.embedding IS 'Vector embedding for semantic similarity search (OpenAI text-embedding-3-small)';
COMMENT ON COLUMN workflow_tools.tool_type IS 'Category of tool: dev, security, devops, data, cloud, testing, monitoring, documentation, productivity, custom';
COMMENT ON COLUMN workflow_tools.complexity_level IS 'User skill level required: beginner, intermediate, advanced, expert';
COMMENT ON COLUMN workflow_tools.is_white_hat IS 'Whether this tool is for legitimate defensive security use only';
COMMENT ON COLUMN workflow_tools.requires_permission IS 'Whether this tool requires explicit authorization before use';

-- Create database maintenance functions
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
    -- Clean up old telemetry data (older than 30 days)
    DELETE FROM telemetry_traces WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Clean up old system health records (older than 7 days)
    DELETE FROM system_health WHERE timestamp < NOW() - INTERVAL '7 days';
    
    -- Clean up old API security events (older than 90 days, except critical)
    DELETE FROM api_security_events 
    WHERE created_at < NOW() - INTERVAL '90 days' 
    AND severity != 'critical';
    
    -- Clean up old chat message embeddings (older than 60 days)
    DELETE FROM chat_message_embeddings 
    WHERE created_at < NOW() - INTERVAL '60 days';
    
    -- Update statistics
    ANALYZE;
END;
$$ LANGUAGE plpgsql;

-- Create performance monitoring function
CREATE OR REPLACE FUNCTION get_database_performance_stats() RETURNS TABLE(
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Total Tables'::TEXT, 
        COUNT(*)::NUMERIC, 
        'count'::TEXT,
        CASE WHEN COUNT(*) > 50 THEN 'warning' ELSE 'good' END::TEXT
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    
    UNION ALL
    
    SELECT 
        'Total Indexes'::TEXT, 
        COUNT(*)::NUMERIC, 
        'count'::TEXT,
        'good'::TEXT
    FROM pg_indexes 
    WHERE schemaname = 'public'
    
    UNION ALL
    
    SELECT 
        'Database Size'::TEXT, 
        ROUND(pg_database_size(current_database())::NUMERIC / 1024 / 1024, 2), 
        'MB'::TEXT,
        CASE 
            WHEN pg_database_size(current_database()) > 1073741824 THEN 'warning' -- > 1GB
            ELSE 'good' 
        END::TEXT
    
    UNION ALL
    
    SELECT 
        'Workflow Tools Count'::TEXT, 
        COUNT(*)::NUMERIC, 
        'count'::TEXT,
        CASE WHEN COUNT(*) < 10 THEN 'warning' ELSE 'good' END::TEXT
    FROM workflow_tools 
    WHERE is_active = true
    
    UNION ALL
    
    SELECT 
        'Active Users'::TEXT, 
        COUNT(*)::NUMERIC, 
        'count'::TEXT,
        'good'::TEXT
    FROM users 
    WHERE is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Validate current data integrity
DO $$
DECLARE
    error_count INTEGER := 0;
    warning_count INTEGER := 0;
BEGIN
    -- Check for duplicate tool_ids
    SELECT COUNT(*) INTO error_count 
    FROM (
        SELECT tool_id, COUNT(*) 
        FROM workflow_tools 
        GROUP BY tool_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF error_count > 0 THEN
        RAISE WARNING 'Found % duplicate tool_ids in workflow_tools', error_count;
    END IF;
    
    -- Check for missing embeddings
    SELECT COUNT(*) INTO warning_count 
    FROM workflow_tools 
    WHERE embedding IS NULL AND is_active = true;
    
    IF warning_count > 0 THEN
        RAISE WARNING 'Found % active workflow tools without embeddings', warning_count;
    END IF;
    
    -- Check for orphaned records
    SELECT COUNT(*) INTO warning_count
    FROM workflow_executions we
    LEFT JOIN workflows w ON we.workflow_id = w.id
    WHERE w.id IS NULL;
    
    IF warning_count > 0 THEN
        RAISE WARNING 'Found % orphaned workflow executions', warning_count;
    END IF;
    
    RAISE NOTICE 'Database validation completed. Errors: %, Warnings: %', error_count, warning_count;
END $$;

-- Final optimization: Update table statistics
ANALYZE workflow_tools;
ANALYZE user_manual_sections;
ANALYZE workflow_executions;
ANALYZE agents;
ANALYZE chat_messages;
ANALYZE notifications;

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'Database optimization and validation completed successfully!';
    RAISE NOTICE 'Indexes created, constraints added, and statistics updated.';
    RAISE NOTICE 'Run SELECT * FROM get_database_performance_stats(); to see current metrics.';
END $$;