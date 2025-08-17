-- COMPREHENSIVE 60-TASK REVAMP DATABASE SCHEMA
-- Master schema for complete Cartrita AI OS platform
-- Created: December 27, 2025 - August 17, 2025 (Updated)

-- =============================================================================
-- CORE USER & AUTHENTICATION TABLES
-- =============================================================================

-- Enhanced user table with all features
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    timezone VARCHAR(100) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'dark',
    preferences JSONB DEFAULT '{}',
    last_login_at TIMESTAMP,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User sessions for enhanced security
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

-- User activity logs
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- API KEY VAULT & SECURITY MANAGEMENT
-- =============================================================================

-- Enhanced API key vault with rotation and versioning
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    encrypted_key TEXT NOT NULL,
    encryption_method VARCHAR(50) DEFAULT 'AES-256-GCM',
    key_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    max_usage_count INTEGER,
    permissions JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    rotation_policy JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, service_name, key_name, version)
);

-- API key usage analytics
CREATE TABLE IF NOT EXISTS api_key_usage (
    id BIGSERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_endpoint VARCHAR(255),
    request_method VARCHAR(10),
    response_status INTEGER,
    response_time_ms INTEGER,
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 4),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    source VARCHAR(100),
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- AI CONVERSATION & CHAT MANAGEMENT  
-- =============================================================================

-- Enhanced conversations with AI context
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    model_name VARCHAR(100),
    system_prompt TEXT,
    context_data JSONB,
    conversation_type VARCHAR(50) DEFAULT 'chat',
    is_archived BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10, 4) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation messages with enhanced metadata
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    model_name VARCHAR(100),
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 4),
    response_time_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    tools_used JSONB DEFAULT '[]',
    structured JSONB DEFAULT '[]',
    parent_message_id UUID REFERENCES conversation_messages(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- WORKFLOW AUTOMATION SYSTEM
-- =============================================================================

-- Workflow definitions (enhanced from Phase A)
CREATE TABLE IF NOT EXISTS workflow_automation_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50) DEFAULT 'manual',
    trigger_config JSONB DEFAULT '{}',
    steps JSONB NOT NULL,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    tags TEXT[],
    category VARCHAR(100),
    execution_timeout INTEGER DEFAULT 3600,
    retry_policy JSONB DEFAULT '{"max_retries": 3, "backoff": "exponential"}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Workflow execution logs (enhanced)
CREATE TABLE IF NOT EXISTS workflow_automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id INTEGER REFERENCES workflow_automation_definitions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'running',
    input_data JSONB,
    output_data JSONB,
    execution_logs JSONB DEFAULT '[]',
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    execution_time_ms INTEGER,
    steps_completed INTEGER DEFAULT 0,
    steps_total INTEGER,
    cost_usd DECIMAL(10, 4) DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- Workflow steps execution details
CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_log_id UUID REFERENCES workflow_automation_logs(id) ON DELETE CASCADE,
    step_id VARCHAR(100) NOT NULL,
    step_name VARCHAR(255),
    step_type VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    execution_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- Workflow templates marketplace
CREATE TABLE IF NOT EXISTS workflow_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    template_data JSONB NOT NULL,
    preview_image TEXT,
    tags TEXT[],
    difficulty_level VARCHAR(20) DEFAULT 'beginner',
    estimated_time_minutes INTEGER,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    price_usd DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- KNOWLEDGE HUB & RAG SYSTEM
-- =============================================================================

-- Knowledge documents with enhanced metadata
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    document_type VARCHAR(50),
    source_url TEXT,
    file_path TEXT,
    file_size INTEGER,
    mime_type VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    tags TEXT[],
    category VARCHAR(100),
    is_public BOOLEAN DEFAULT false,
    processing_status VARCHAR(20) DEFAULT 'pending',
    chunk_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Document chunks for RAG
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge collections
CREATE TABLE IF NOT EXISTS knowledge_collections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Document-collection mappings
CREATE TABLE IF NOT EXISTS knowledge_collection_documents (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(collection_id, document_id)
);

-- =============================================================================
-- AI MODEL REGISTRY & ROUTING
-- =============================================================================

-- AI model definitions and capabilities
CREATE TABLE IF NOT EXISTS ai_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    capabilities TEXT[] NOT NULL,
    input_types TEXT[] DEFAULT '{"text"}',
    output_types TEXT[] DEFAULT '{"text"}',
    max_tokens INTEGER,
    cost_per_1k_tokens DECIMAL(10, 6),
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    configuration JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Model usage statistics
CREATE TABLE IF NOT EXISTS ai_model_usage (
    id BIGSERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES ai_models(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(100),
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd DECIMAL(10, 4),
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- LIFE OS & PERSONAL MANAGEMENT
-- =============================================================================

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',
    location TEXT,
    event_type VARCHAR(50) DEFAULT 'appointment',
    recurrence_rule TEXT,
    reminder_settings JSONB DEFAULT '[]',
    attendees JSONB DEFAULT '[]',
    is_all_day BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'confirmed',
    external_id VARCHAR(255),
    external_source VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Contacts management
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    job_title VARCHAR(255),
    address TEXT,
    notes TEXT,
    tags TEXT[],
    avatar_url TEXT,
    is_favorite BOOLEAN DEFAULT false,
    external_id VARCHAR(255),
    external_source VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Email management
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    thread_id VARCHAR(255),
    subject VARCHAR(500),
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipient_emails TEXT[],
    body_text TEXT,
    body_html TEXT,
    attachments JSONB DEFAULT '[]',
    labels TEXT[],
    folder VARCHAR(100) DEFAULT 'inbox',
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    received_at TIMESTAMP,
    external_source VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tasks and todos
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_date TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    category VARCHAR(100),
    tags TEXT[],
    assignee_id INTEGER REFERENCES users(id),
    project_id INTEGER,
    parent_task_id INTEGER REFERENCES tasks(id),
    completion_percentage INTEGER DEFAULT 0,
    estimated_hours DECIMAL(5, 2),
    actual_hours DECIMAL(5, 2),
    external_id VARCHAR(255),
    external_source VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- JOURNAL & MOOD TRACKING
-- =============================================================================

-- Enhanced journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT NOT NULL,
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    emotions TEXT[],
    tags TEXT[],
    weather VARCHAR(50),
    location TEXT,
    is_private BOOLEAN DEFAULT true,
    word_count INTEGER DEFAULT 0,
    sentiment_score DECIMAL(3, 2),
    sentiment_analysis JSONB,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mood tracking analytics
CREATE TABLE IF NOT EXISTS mood_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mood_average DECIMAL(3, 2),
    mood_entries_count INTEGER DEFAULT 0,
    dominant_emotions TEXT[],
    journal_word_count INTEGER DEFAULT 0,
    activities TEXT[],
    weather VARCHAR(50),
    sleep_hours DECIMAL(3, 1),
    exercise_minutes INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- =============================================================================
-- MULTIMODAL PROCESSING & MEDIA
-- =============================================================================

-- Audio processing and analysis
CREATE TABLE IF NOT EXISTS audio_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    duration_seconds DECIMAL(10, 3),
    sample_rate INTEGER,
    channels INTEGER,
    transcription TEXT,
    transcription_confidence DECIMAL(5, 4),
    language_detected VARCHAR(10),
    audio_analysis JSONB,
    processing_status VARCHAR(20) DEFAULT 'pending',
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Image processing and analysis
CREATE TABLE IF NOT EXISTS image_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    description TEXT,
    objects_detected JSONB DEFAULT '[]',
    faces_detected JSONB DEFAULT '[]',
    text_extracted TEXT,
    color_palette JSONB,
    processing_status VARCHAR(20) DEFAULT 'pending',
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Video processing and analysis
CREATE TABLE IF NOT EXISTS video_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    duration_seconds DECIMAL(10, 3),
    width INTEGER,
    height INTEGER,
    frame_rate DECIMAL(5, 2),
    thumbnail_path TEXT,
    transcription TEXT,
    scene_analysis JSONB,
    processing_status VARCHAR(20) DEFAULT 'pending',
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- SYSTEM MONITORING & ANALYTICS
-- =============================================================================

-- System health metrics
CREATE TABLE IF NOT EXISTS system_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 6) NOT NULL,
    metric_unit VARCHAR(50),
    service_name VARCHAR(100),
    instance_id VARCHAR(100),
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Application performance monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID,
    user_id INTEGER REFERENCES users(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    memory_usage_mb DECIMAL(10, 3),
    cpu_usage_percent DECIMAL(5, 2),
    database_query_time_ms INTEGER,
    external_api_time_ms INTEGER,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Error tracking and debugging
CREATE TABLE IF NOT EXISTS error_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    request_id UUID,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    context JSONB DEFAULT '{}',
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- NOTIFICATION & COMMUNICATION SYSTEM
-- =============================================================================

-- User notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    category VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    action_url TEXT,
    action_label VARCHAR(100),
    expires_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- SEARCH & DISCOVERY
-- =============================================================================

-- Global search index
CREATE TABLE IF NOT EXISTS search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(100) NOT NULL,
    content_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    content TEXT,
    url TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    search_vector tsvector,
    embedding vector(1536),
    last_indexed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, content_type, content_id)
);

-- Search query analytics
CREATE TABLE IF NOT EXISTS search_analytics (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    clicked_result_id UUID,
    response_time_ms INTEGER,
    search_type VARCHAR(50) DEFAULT 'global',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- INTEGRATIONS & EXTERNAL SERVICES
-- =============================================================================

-- External service configurations
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    sync_error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, service_name)
);

-- Webhook configurations
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(255),
    events TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- BACKUP & RECOVERY
-- =============================================================================

-- Data backup tracking
CREATE TABLE IF NOT EXISTS data_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    backup_type VARCHAR(50) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    compression_type VARCHAR(20),
    encryption_enabled BOOLEAN DEFAULT false,
    backup_status VARCHAR(20) DEFAULT 'completed',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- User activity indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_created ON user_activity_logs(user_id, created_at DESC);

-- API key indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_service ON api_keys(user_id, service_name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage(created_at DESC);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv ON conversation_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user ON conversation_messages(user_id, created_at DESC);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflow_defs_user_active ON workflow_automation_definitions(owner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_automation_logs(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_user ON workflow_automation_logs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_step_exec_log ON workflow_step_executions(workflow_log_id, started_at);

-- Knowledge indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_user ON knowledge_documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat(embedding vector_cosine_ops);

-- Search indexes
CREATE INDEX IF NOT EXISTS idx_search_index_user_type ON search_index(user_id, content_type);
CREATE INDEX IF NOT EXISTS idx_search_index_vector ON search_index USING ivfflat(search_vector);
CREATE INDEX IF NOT EXISTS idx_search_index_embedding ON search_index USING ivfflat(embedding vector_cosine_ops);

-- Media asset indexes
CREATE INDEX IF NOT EXISTS idx_audio_assets_user ON audio_assets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_assets_user ON image_assets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_assets_user ON video_assets(user_id, created_at DESC);

-- Journal indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created ON journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mood_analytics_user_date ON mood_analytics(user_id, date DESC);

-- Life OS indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_contacts_user_name ON contacts(user_id, name);
CREATE INDEX IF NOT EXISTS idx_emails_user_received ON emails(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_date) WHERE status != 'completed';

-- System monitoring indexes
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_time ON system_metrics(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type, created_at DESC);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, created_at DESC) WHERE NOT is_read AND NOT is_archived;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- User dashboard summary view
CREATE OR REPLACE VIEW user_dashboard_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    (SELECT COUNT(*) FROM conversations WHERE user_id = u.id AND created_at > NOW() - INTERVAL '7 days') as conversations_week,
    (SELECT COUNT(*) FROM workflow_automation_logs WHERE user_id = u.id AND started_at > NOW() - INTERVAL '7 days') as workflows_week,
    (SELECT COUNT(*) FROM journal_entries WHERE user_id = u.id AND created_at > NOW() - INTERVAL '7 days') as journal_entries_week,
    (SELECT COUNT(*) FROM tasks WHERE user_id = u.id AND status != 'completed') as pending_tasks,
    (SELECT COUNT(*) FROM notifications WHERE user_id = u.id AND NOT is_read) as unread_notifications
FROM users u WHERE u.is_active = true;

-- System health summary view
CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(*) as total_requests,
    AVG(response_time_ms) as avg_response_time,
    COUNT(*) FILTER (WHERE status_code >= 500) as error_count,
    COUNT(*) FILTER (WHERE status_code = 200) as success_count
FROM performance_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

-- =============================================================================
-- FINAL SETUP
-- =============================================================================

-- Update schema version
INSERT INTO schema_versions (version, applied_at, description) 
VALUES (26, NOW(), 'Comprehensive 60-task revamp schema - Complete Cartrita AI OS platform')
ON CONFLICT (version) DO UPDATE SET 
    applied_at = NOW(),
    description = 'Comprehensive 60-task revamp schema - Complete Cartrita AI OS platform (Updated)';

-- Create default admin user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@cartrita.ai') THEN
        INSERT INTO users (email, password_hash, name, role, is_active, email_verified)
        VALUES ('admin@cartrita.ai', '$2b$10$dummy.hash.for.initial.setup', 'System Admin', 'admin', true, true);
    END IF;
END $$;

COMMIT;