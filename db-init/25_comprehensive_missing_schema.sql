-- Comprehensive Schema Update for Cartrita AI Operating System
-- This file addresses all missing tables, columns, and schema fixes
-- Version: 2025-08-15 - Complete current and future requirements

-- ==================================================================================
-- WORKFLOW SYSTEM FIXES - Fix column type incompatibilities
-- ==================================================================================

-- First, fix workflow_executions to match expected schema
ALTER TABLE workflow_executions 
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS execution_path JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS node_outputs JSONB DEFAULT '{}';

-- Add missing columns to workflows table
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS definition JSONB,
  ADD COLUMN IF NOT EXISTS template_id INTEGER,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ==================================================================================
-- WORKFLOW SYSTEM - Additional Tables (Safe Creation)
-- ==================================================================================

-- Workflow templates
CREATE TABLE IF NOT EXISTS workflow_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    tags TEXT[],
    definition JSONB NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'beginner',
    estimated_duration INTEGER, -- in minutes
    variables JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id),
    usage_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    is_official BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER REFERENCES workflow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Workflow sharing and collaboration
CREATE TABLE IF NOT EXISTS workflow_shares (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    shared_by INTEGER REFERENCES users(id),
    shared_with INTEGER REFERENCES users(id),
    permission VARCHAR(20) DEFAULT 'read', -- read, write, admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow reviews and ratings
CREATE TABLE IF NOT EXISTS workflow_reviews (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES workflow_templates(id) ON DELETE CASCADE,
    reviewer_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_review_per_user UNIQUE(workflow_id, template_id, reviewer_id)
);

-- Workflow node types registry
CREATE TABLE IF NOT EXISTS workflow_node_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    input_schema JSONB,
    output_schema JSONB,
    config_schema JSONB,
    icon VARCHAR(50),
    color VARCHAR(7), -- hex color
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow analytics
CREATE TABLE IF NOT EXISTS workflow_analytics (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    average_duration_ms INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================================================
-- INTELLIGENT PROVIDER SELECTION - Enhanced Tables
-- ==================================================================================

-- Provider availability tracking
CREATE TABLE IF NOT EXISTS provider_availability (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    failure_count INTEGER DEFAULT 0,
    backoff_until TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider)
);

-- Provider rate limiting
CREATE TABLE IF NOT EXISTS provider_rate_limits (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    task VARCHAR(100) NOT NULL,
    requests_per_minute INTEGER NOT NULL,
    requests_per_hour INTEGER NOT NULL,
    requests_per_day INTEGER NOT NULL,
    current_minute_count INTEGER DEFAULT 0,
    current_hour_count INTEGER DEFAULT 0,
    current_day_count INTEGER DEFAULT 0,
    reset_minute TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reset_day TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, task)
);

-- Provider model catalog
CREATE TABLE IF NOT EXISTS provider_models (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(200) NOT NULL,
    task_types TEXT[],
    input_cost DECIMAL(12, 8),
    output_cost DECIMAL(12, 8),
    max_tokens INTEGER,
    supports_streaming BOOLEAN DEFAULT false,
    supports_functions BOOLEAN DEFAULT false,
    quality_score DECIMAL(3,2) DEFAULT 0,
    speed_score DECIMAL(3,2) DEFAULT 0,
    reliability_score DECIMAL(3,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, model_name)
);

-- ==================================================================================
-- ADVANCED HEALTH MONITORING - System Metrics
-- ==================================================================================

-- System health snapshots
CREATE TABLE IF NOT EXISTS health_snapshots (
    id SERIAL PRIMARY KEY,
    cpu_usage DECIMAL(5,2),
    memory_usage_bytes BIGINT,
    memory_usage_percent DECIMAL(5,2),
    disk_usage_bytes BIGINT,
    disk_usage_percent DECIMAL(5,2),
    active_connections INTEGER,
    database_size BIGINT,
    load_average DECIMAL(5,2),
    uptime_seconds BIGINT,
    error_rate DECIMAL(5,2),
    requests_per_minute INTEGER,
    response_time_avg_ms INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API endpoint metrics
CREATE TABLE IF NOT EXISTS api_endpoint_metrics (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    user_id INTEGER REFERENCES users(id),
    user_agent TEXT,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error tracking and logging
CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(100),
    error_message TEXT,
    stack_trace TEXT,
    endpoint VARCHAR(200),
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'error', -- debug, info, warn, error, fatal
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================================================
-- KNOWLEDGE MANAGEMENT ENHANCEMENTS
-- ==================================================================================

-- Knowledge categories
CREATE TABLE IF NOT EXISTS knowledge_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES knowledge_categories(id),
    icon VARCHAR(50),
    color VARCHAR(7),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge tags
CREATE TABLE IF NOT EXISTS knowledge_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge item tags (many-to-many)
CREATE TABLE IF NOT EXISTS knowledge_item_tags (
    knowledge_item_id INTEGER REFERENCES knowledge_items(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES knowledge_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (knowledge_item_id, tag_id)
);

-- Knowledge search history
CREATE TABLE IF NOT EXISTS knowledge_searches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query TEXT NOT NULL,
    results_count INTEGER,
    clicked_result_id INTEGER REFERENCES knowledge_items(id),
    search_type VARCHAR(50), -- semantic, keyword, hybrid
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================================================
-- ADVANCED USER MANAGEMENT
-- ==================================================================================

-- User sessions with enhanced tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    location_country VARCHAR(100),
    location_city VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activity log
CREATE TABLE IF NOT EXISTS user_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES user_sessions(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    activity_data JSONB DEFAULT '{}',
    endpoint VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User notification settings
CREATE TABLE IF NOT EXISTS user_notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email_enabled BOOLEAN DEFAULT true,
    browser_enabled BOOLEAN DEFAULT true,
    workflow_completion BOOLEAN DEFAULT true,
    security_alerts BOOLEAN DEFAULT true,
    system_updates BOOLEAN DEFAULT false,
    marketing BOOLEAN DEFAULT false,
    frequency VARCHAR(20) DEFAULT 'immediate', -- immediate, hourly, daily, weekly
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================================================
-- SECURITY AND AUDIT ENHANCEMENTS
-- ==================================================================================

-- Security events
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(200),
    event_data JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API key access logs
CREATE TABLE IF NOT EXISTS api_key_access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    api_key_id INTEGER REFERENCES user_api_keys(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- created, accessed, rotated, deleted, masked, unmasked
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System configuration audit
CREATE TABLE IF NOT EXISTS config_audit (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(200) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES users(id),
    change_reason TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================================================
-- MULTIMODAL AND AI ENHANCEMENTS
-- ==================================================================================

-- AI conversation context
CREATE TABLE IF NOT EXISTS ai_conversation_context (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    context_type VARCHAR(50), -- personality, preferences, history, domain
    context_data JSONB NOT NULL,
    priority INTEGER DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multimodal content processing
CREATE TABLE IF NOT EXISTS multimodal_content (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL, -- image, audio, video, document
    original_filename VARCHAR(500),
    file_path VARCHAR(1000),
    file_size BIGINT,
    mime_type VARCHAR(100),
    processing_status VARCHAR(20) DEFAULT 'pending',
    extracted_text TEXT,
    analysis_results JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Voice processing sessions
CREATE TABLE IF NOT EXISTS voice_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(100) UNIQUE,
    wake_word_detected BOOLEAN DEFAULT false,
    continuous_mode BOOLEAN DEFAULT false,
    language VARCHAR(10) DEFAULT 'en',
    quality_settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    total_utterances INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- ==================================================================================
-- PLUGIN AND EXTENSION SYSTEM (Future)
-- ==================================================================================

-- Plugin registry
CREATE TABLE IF NOT EXISTS plugins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    description TEXT,
    version VARCHAR(50),
    author VARCHAR(200),
    homepage_url VARCHAR(500),
    repository_url VARCHAR(500),
    category VARCHAR(100),
    tags TEXT[],
    permissions JSONB DEFAULT '[]',
    config_schema JSONB,
    is_official BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    install_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User installed plugins
CREATE TABLE IF NOT EXISTS user_plugins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plugin_id INTEGER REFERENCES plugins(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, plugin_id)
);

-- ==================================================================================
-- WORKFLOW VISUAL DESIGNER (Future)
-- ==================================================================================

-- Workflow canvas layouts
CREATE TABLE IF NOT EXISTS workflow_canvas_layouts (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    layout_data JSONB NOT NULL, -- node positions, connections, etc.
    zoom_level DECIMAL(4,2) DEFAULT 1.00,
    center_x INTEGER DEFAULT 0,
    center_y INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id)
);

-- Workflow collaboration sessions
CREATE TABLE IF NOT EXISTS workflow_collaboration (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    cursor_position JSONB,
    selected_nodes JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================================================

-- Workflow system indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public, is_official);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_rating ON workflow_templates(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_execution ON workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_node ON workflow_execution_logs(node_id, status);

-- Provider system indexes
CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider_task ON provider_metrics(provider, task, timestamp);
CREATE INDEX IF NOT EXISTS idx_provider_selections_user ON provider_selections(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_provider_availability_check ON provider_availability(last_check, is_available);

-- Health monitoring indexes
CREATE INDEX IF NOT EXISTS idx_health_snapshots_timestamp ON health_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_metrics_endpoint ON api_endpoint_metrics(endpoint, timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity, resolved, created_at);

-- Knowledge system indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_searches_user ON knowledge_searches(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_item_tags_item ON knowledge_item_tags(knowledge_item_id);

-- User activity indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_user_type ON user_activity(user_id, activity_type, created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active, last_activity);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity, resolved, created_at);
CREATE INDEX IF NOT EXISTS idx_api_key_access_logs_key ON api_key_access_logs(api_key_id, created_at);

-- ==================================================================================
-- VIEWS FOR ANALYTICS AND REPORTING
-- ==================================================================================

-- System health summary view
CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
    AVG(cpu_usage) as avg_cpu_usage,
    AVG(memory_usage_percent) as avg_memory_usage,
    AVG(response_time_avg_ms) as avg_response_time,
    COUNT(*) as snapshot_count,
    MAX(timestamp) as last_update
FROM health_snapshots 
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Top workflows by usage
CREATE OR REPLACE VIEW top_workflows AS
SELECT 
    w.id,
    w.name,
    w.category,
    wa.execution_count,
    wa.success_count,
    wa.average_duration_ms,
    ROUND((wa.success_count::DECIMAL / NULLIF(wa.execution_count, 0)) * 100, 2) as success_rate
FROM workflows w
JOIN workflow_analytics wa ON w.id = wa.workflow_id
ORDER BY wa.execution_count DESC;

-- User engagement metrics
CREATE OR REPLACE VIEW user_engagement_metrics AS
SELECT 
    u.id as user_id,
    u.name,
    COUNT(DISTINCT ua.activity_type) as activity_types,
    COUNT(ua.id) as total_activities,
    MAX(ua.created_at) as last_activity,
    EXTRACT(days FROM NOW() - MAX(ua.created_at)) as days_since_last_activity
FROM users u
LEFT JOIN user_activity ua ON u.id = ua.user_id
GROUP BY u.id, u.name;

-- Provider performance summary
CREATE OR REPLACE VIEW provider_performance AS
SELECT 
    provider,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    AVG(latency_ms) as avg_latency,
    SUM(cost) as total_cost,
    ROUND((COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*)) * 100, 2) as success_rate
FROM provider_metrics 
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY provider
ORDER BY total_requests DESC;

-- ==================================================================================
-- FUNCTIONS AND TRIGGERS
-- ==================================================================================

-- Function to update workflow analytics
CREATE OR REPLACE FUNCTION update_workflow_analytics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO workflow_analytics (workflow_id, execution_count, last_executed_at)
        VALUES (NEW.workflow_id, 1, NEW.started_at)
        ON CONFLICT (workflow_id) 
        DO UPDATE SET 
            execution_count = workflow_analytics.execution_count + 1,
            last_executed_at = NEW.started_at;
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        IF NEW.status = 'completed' THEN
            UPDATE workflow_analytics 
            SET success_count = success_count + 1,
                average_duration_ms = (
                    COALESCE(average_duration_ms * (execution_count - 1), 0) + 
                    EXTRACT(epoch FROM (NEW.completed_at - NEW.started_at)) * 1000
                ) / execution_count
            WHERE workflow_id = NEW.workflow_id;
        ELSIF NEW.status = 'failed' THEN
            UPDATE workflow_analytics 
            SET failure_count = failure_count + 1
            WHERE workflow_id = NEW.workflow_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for workflow analytics
DROP TRIGGER IF EXISTS workflow_analytics_trigger ON workflow_executions;
CREATE TRIGGER workflow_analytics_trigger
    AFTER INSERT OR UPDATE ON workflow_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_analytics();

-- Function to auto-expire user sessions
CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS void AS $$
BEGIN
    UPDATE user_sessions 
    SET is_active = false 
    WHERE is_active = true 
    AND (expires_at < NOW() OR last_activity < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- ==================================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ==================================================================================

-- Insert sample workflow node types
INSERT INTO workflow_node_types (name, category, description, icon, color) VALUES
('ai_chat', 'ai', 'Chat with AI assistant', 'message-circle', '#3B82F6'),
('condition', 'logic', 'Conditional branching', 'git-branch', '#EF4444'),
('delay', 'utility', 'Add delay to workflow', 'clock', '#F59E0B'),
('webhook', 'integration', 'Call external webhook', 'globe', '#10B981'),
('transform', 'data', 'Transform data structure', 'zap', '#8B5CF6'),
('parallel', 'flow', 'Parallel execution', 'shuffle', '#EC4899'),
('loop', 'flow', 'Loop over items', 'repeat', '#06B6D4'),
('database', 'data', 'Database operations', 'database', '#84CC16'),
('email', 'communication', 'Send email', 'mail', '#F97316'),
('schedule', 'utility', 'Schedule task', 'calendar', '#6366F1')
ON CONFLICT (name) DO NOTHING;

-- Insert sample knowledge categories
INSERT INTO knowledge_categories (name, description, icon, color) VALUES
('AI & Machine Learning', 'Articles about AI, ML, and related technologies', 'brain', '#3B82F6'),
('Programming', 'Code examples, tutorials, and best practices', 'code', '#10B981'),
('Business', 'Business strategies, management, and operations', 'briefcase', '#F59E0B'),
('Personal', 'Personal notes and private information', 'user', '#8B5CF6'),
('Research', 'Research papers, studies, and academic content', 'search', '#EC4899'),
('Documentation', 'Technical documentation and guides', 'book', '#06B6D4')
ON CONFLICT (name) DO NOTHING;

-- ==================================================================================
-- PERMISSIONS AND SECURITY
-- ==================================================================================

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cartrita_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cartrita_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cartrita_app;

-- ==================================================================================
-- COMPLETION SUMMARY
-- ==================================================================================

-- Log schema update completion
INSERT INTO config_audit (config_key, new_value, change_reason, created_at)
VALUES ('schema_version', '25_comprehensive_missing_schema', 'Complete schema update for all current and future requirements', NOW());

COMMENT ON TABLE workflow_templates IS 'Pre-built workflow templates with ratings and categories';
COMMENT ON TABLE provider_metrics IS 'Performance tracking for all AI providers';
COMMENT ON TABLE health_snapshots IS 'System health monitoring data points';
COMMENT ON TABLE knowledge_categories IS 'Hierarchical categorization for knowledge items';
COMMENT ON TABLE user_sessions IS 'Enhanced user session tracking';
COMMENT ON TABLE security_events IS 'Security event logging and monitoring';
COMMENT ON TABLE plugins IS 'Plugin system registry for future extensions';
COMMENT ON TABLE workflow_canvas_layouts IS 'Visual designer layout data';

-- Success notification
DO $$ 
BEGIN 
    RAISE NOTICE 'Comprehensive schema update completed successfully!';
    RAISE NOTICE 'Added % tables for complete system functionality', 
                  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public');
END $$;