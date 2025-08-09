-- ================================================================================================
-- CARTRITA COMPREHENSIVE DATABASE SCHEMA
-- Complete database schema for all iterations (18-22)
-- Created based on documentation analysis of README.md, AGENT_MANUAL.md, and BACKEND_STRUCTURE.md
-- ================================================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================================================
-- CORE AUTHENTICATION AND USER MANAGEMENT
-- ================================================================================================

-- Core users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences for personalization
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sarcasm_level INTEGER DEFAULT 5 CHECK (sarcasm_level >= 1 AND sarcasm_level <= 10),
    verbosity VARCHAR(50) DEFAULT 'normal' CHECK (verbosity IN ('minimal', 'normal', 'verbose')),
    humor_style VARCHAR(50) DEFAULT 'playful' CHECK (humor_style IN ('playful', 'sarcastic', 'witty', 'dry')),
    language_preference VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
    notifications_enabled BOOLEAN DEFAULT true,
    voice_enabled BOOLEAN DEFAULT true,
    ambient_listening BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- User sessions for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- ================================================================================================
-- ITERATION 18: SECURE API VAULT
-- ================================================================================================

-- API providers configuration and metadata
CREATE TABLE IF NOT EXISTS api_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    base_url VARCHAR(500),
    auth_type VARCHAR(50) CHECK (auth_type IN ('bearer', 'api_key', 'oauth2', 'basic')) DEFAULT 'bearer',
    documentation_url VARCHAR(500),
    rate_limit_rpm INTEGER DEFAULT 60,
    rate_limit_tpm INTEGER DEFAULT 90000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Encrypted API key storage with rotation tracking
CREATE TABLE IF NOT EXISTS user_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES api_providers(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,
    encrypted_key TEXT NOT NULL,
    encryption_iv VARCHAR(32) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_tested_at TIMESTAMP WITH TIME ZONE,
    test_status VARCHAR(20) CHECK (test_status IN ('pending', 'valid', 'invalid', 'expired')) DEFAULT 'pending',
    rotation_interval_days INTEGER DEFAULT 90,
    next_rotation_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider_id, key_name)
);

-- Security audit logs and event tracking
CREATE TABLE IF NOT EXISTS api_security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    api_key_id INTEGER REFERENCES user_api_keys(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('key_created', 'key_accessed', 'key_tested', 'key_failed', 'key_rotated', 'key_deleted', 'unauthorized_access')),
    event_description TEXT,
    ip_address INET,
    user_agent TEXT,
    risk_level VARCHAR(10) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Key rotation history and compliance
CREATE TABLE IF NOT EXISTS api_key_rotation_history (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,
    old_key_hash VARCHAR(128),
    new_key_hash VARCHAR(128),
    rotation_reason VARCHAR(100),
    rotation_status VARCHAR(20) CHECK (rotation_status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
    rotated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API key usage metrics and cost tracking
CREATE TABLE IF NOT EXISTS api_key_usage_analytics (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(200),
    request_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10,4) DEFAULT 0.0000,
    usage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(api_key_id, endpoint, usage_date)
);

-- ================================================================================================
-- ITERATION 19: PERSONAL LIFE OS
-- ================================================================================================

-- Calendar events with sync status
CREATE TABLE IF NOT EXISTS user_calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    calendar_provider VARCHAR(50) CHECK (calendar_provider IN ('google', 'outlook', 'manual')) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(500),
    attendees JSONB,
    is_all_day BOOLEAN DEFAULT false,
    recurrence_rule TEXT,
    status VARCHAR(20) CHECK (status IN ('confirmed', 'tentative', 'cancelled')) DEFAULT 'confirmed',
    sync_status VARCHAR(20) CHECK (sync_status IN ('synced', 'pending', 'failed')) DEFAULT 'synced',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calendar synchronization configuration
CREATE TABLE IF NOT EXISTS user_calendar_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) CHECK (provider IN ('google', 'outlook')) NOT NULL,
    calendar_id VARCHAR(255) NOT NULL,
    calendar_name VARCHAR(200),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sync_frequency_minutes INTEGER DEFAULT 15,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('success', 'failed', 'pending')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, calendar_id)
);

-- Email messages with AI analysis
CREATE TABLE IF NOT EXISTS user_email_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    email_provider VARCHAR(50) CHECK (email_provider IN ('gmail', 'outlook')) NOT NULL,
    message_id VARCHAR(255) UNIQUE,
    thread_id VARCHAR(255),
    subject VARCHAR(998),
    sender_email VARCHAR(254),
    sender_name VARCHAR(255),
    recipients JSONB,
    cc JSONB,
    bcc JSONB,
    body_text TEXT,
    body_html TEXT,
    attachments JSONB,
    labels JSONB,
    is_read BOOLEAN DEFAULT false,
    is_important BOOLEAN DEFAULT false,
    ai_summary TEXT,
    ai_category VARCHAR(50),
    ai_sentiment VARCHAR(20) CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
    ai_action_required BOOLEAN DEFAULT false,
    received_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email synchronization settings
CREATE TABLE IF NOT EXISTS user_email_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) CHECK (provider IN ('gmail', 'outlook')) NOT NULL,
    email_address VARCHAR(254) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sync_frequency_minutes INTEGER DEFAULT 5,
    sync_labels JSONB,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('success', 'failed', 'pending')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, email_address)
);

-- Contact management with interaction history
CREATE TABLE IF NOT EXISTS user_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    contact_provider VARCHAR(50) CHECK (contact_provider IN ('google', 'outlook', 'manual')) NOT NULL,
    display_name VARCHAR(255),
    given_name VARCHAR(100),
    family_name VARCHAR(100),
    middle_name VARCHAR(100),
    email_addresses JSONB,
    phone_numbers JSONB,
    addresses JSONB,
    organization VARCHAR(255),
    job_title VARCHAR(255),
    birthday DATE,
    notes TEXT,
    photo_url VARCHAR(500),
    is_favorite BOOLEAN DEFAULT false,
    sync_status VARCHAR(20) CHECK (sync_status IN ('synced', 'pending', 'failed')) DEFAULT 'synced',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact interaction tracking
CREATE TABLE IF NOT EXISTS user_contact_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) CHECK (interaction_type IN ('email', 'call', 'meeting', 'message', 'other')) NOT NULL,
    interaction_subject VARCHAR(255),
    interaction_summary TEXT,
    interaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact synchronization status
CREATE TABLE IF NOT EXISTS user_contact_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) CHECK (provider IN ('google', 'outlook')) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    sync_frequency_minutes INTEGER DEFAULT 60,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('success', 'failed', 'pending')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- AI-generated tasks from emails/calendar
CREATE TABLE IF NOT EXISTS user_assistant_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(20) CHECK (source_type IN ('email', 'calendar', 'manual')) NOT NULL,
    source_id INTEGER,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    priority VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    ai_confidence DECIMAL(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Smart notifications and reminders
CREATE TABLE IF NOT EXISTS user_assistant_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) CHECK (notification_type IN ('reminder', 'alert', 'suggestion', 'update')) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================================
-- ITERATION 20: MULTI-AGENT FRAMEWORK
-- ================================================================================================

-- Agent registry and configuration
CREATE TABLE IF NOT EXISTS agent_registry (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(100) UNIQUE NOT NULL,
    agent_name VARCHAR(200) NOT NULL,
    agent_description TEXT,
    agent_class_path VARCHAR(500),
    capabilities JSONB,
    tools_available JSONB,
    is_active BOOLEAN DEFAULT true,
    version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent health monitoring and status
CREATE TABLE IF NOT EXISTS agent_health_status (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(100) NOT NULL REFERENCES agent_registry(agent_type) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('healthy', 'degraded', 'failed', 'offline')) NOT NULL,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tool registry and access control
CREATE TABLE IF NOT EXISTS tool_registry (
    id SERIAL PRIMARY KEY,
    tool_name VARCHAR(100) UNIQUE NOT NULL,
    tool_description TEXT,
    tool_function_path VARCHAR(500),
    input_schema JSONB,
    output_schema JSONB,
    access_level VARCHAR(20) CHECK (access_level IN ('public', 'restricted', 'private')) DEFAULT 'public',
    rate_limit_per_minute INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent tool access permissions
CREATE TABLE IF NOT EXISTS agent_tool_permissions (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(100) NOT NULL REFERENCES agent_registry(agent_type) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL REFERENCES tool_registry(tool_name) ON DELETE CASCADE,
    can_access BOOLEAN DEFAULT true,
    usage_limit_per_hour INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_type, tool_name)
);

-- Inter-agent communication messages
CREATE TABLE IF NOT EXISTS agent_messages (
    id SERIAL PRIMARY KEY,
    sender_agent VARCHAR(100) NOT NULL,
    receiver_agent VARCHAR(100) NOT NULL,
    message_type VARCHAR(50) CHECK (message_type IN ('request', 'response', 'notification', 'error')) NOT NULL,
    message_content JSONB NOT NULL,
    conversation_id UUID DEFAULT uuid_generate_v4(),
    parent_message_id INTEGER REFERENCES agent_messages(id),
    status VARCHAR(20) CHECK (status IN ('pending', 'delivered', 'processed', 'failed')) DEFAULT 'pending',
    priority VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Agent performance metrics
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(100) NOT NULL REFERENCES agent_registry(agent_type) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    task_type VARCHAR(100),
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    api_calls_made INTEGER,
    success BOOLEAN,
    error_message TEXT,
    feedback_score DECIMAL(3,2) CHECK (feedback_score >= 0 AND feedback_score <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================================
-- ITERATION 21: MULTI-MODAL INTELLIGENCE
-- ================================================================================================

-- Voice interaction sessions and transcripts
CREATE TABLE IF NOT EXISTS voice_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID DEFAULT uuid_generate_v4(),
    audio_file_path VARCHAR(500),
    transcript TEXT,
    confidence_score DECIMAL(4,3),
    wake_word_detected BOOLEAN DEFAULT false,
    processing_time_ms INTEGER,
    response_text TEXT,
    response_audio_path VARCHAR(500),
    voice_model VARCHAR(50) DEFAULT 'alloy',
    language_detected VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visual analysis results
CREATE TABLE IF NOT EXISTS visual_analysis_results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_file_path VARCHAR(500),
    analysis_type VARCHAR(50) CHECK (analysis_type IN ('scene_description', 'object_detection', 'ocr', 'face_detection', 'emotion_analysis')) NOT NULL,
    analysis_result JSONB NOT NULL,
    confidence_score DECIMAL(4,3),
    processing_time_ms INTEGER,
    model_used VARCHAR(50) DEFAULT 'gpt-4-vision-preview',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ambient listening data
CREATE TABLE IF NOT EXISTS ambient_listening_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audio_segment_path VARCHAR(500),
    detected_sounds JSONB,
    environment_type VARCHAR(50),
    noise_level DECIMAL(5,2),
    speech_detected BOOLEAN DEFAULT false,
    wake_word_probability DECIMAL(4,3),
    processing_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Multi-modal fusion sessions
CREATE TABLE IF NOT EXISTS multimodal_fusion_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID DEFAULT uuid_generate_v4(),
    modalities JSONB NOT NULL, -- ['audio', 'visual', 'text']
    fusion_result JSONB,
    confidence_score DECIMAL(4,3),
    context_understanding TEXT,
    action_recommendations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sensory processing history
CREATE TABLE IF NOT EXISTS sensory_processing_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sensor_type VARCHAR(50) CHECK (sensor_type IN ('microphone', 'camera', 'text_input', 'system')) NOT NULL,
    raw_data_path VARCHAR(500),
    processed_data JSONB,
    processing_pipeline VARCHAR(100),
    processing_status VARCHAR(20) CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ================================================================================================
-- ITERATION 22: ADVANCED AI INTEGRATION
-- ================================================================================================

-- Multi-modal data storage with embeddings
CREATE TABLE IF NOT EXISTS multimodal_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) CHECK (data_type IN ('text', 'image', 'audio', 'video', 'structured')) NOT NULL,
    content_hash VARCHAR(128) UNIQUE,
    raw_content TEXT,
    file_path VARCHAR(500),
    metadata JSONB,
    embeddings vector(1536),
    tags JSONB,
    content_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cross-modal relationship mapping
CREATE TABLE IF NOT EXISTS multimodal_relationships (
    id SERIAL PRIMARY KEY,
    source_data_id INTEGER NOT NULL REFERENCES multimodal_data(id) ON DELETE CASCADE,
    target_data_id INTEGER NOT NULL REFERENCES multimodal_data(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) CHECK (relationship_type IN ('similar', 'related', 'contradicts', 'supports', 'sequence')) NOT NULL,
    confidence_score DECIMAL(4,3),
    discovered_by VARCHAR(100),
    validation_status VARCHAR(20) CHECK (validation_status IN ('pending', 'verified', 'disputed')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_data_id, target_data_id, relationship_type)
);

-- AI learning models configurations and training states
CREATE TABLE IF NOT EXISTS ai_learning_models (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    model_name VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) CHECK (model_type IN ('embedding', 'classification', 'regression', 'generative', 'multimodal')) NOT NULL,
    model_config JSONB NOT NULL,
    training_data_sources JSONB,
    training_status VARCHAR(20) CHECK (training_status IN ('pending', 'training', 'completed', 'failed')) DEFAULT 'pending',
    model_weights_path VARCHAR(500),
    performance_metrics JSONB,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tool usage analytics and optimization
CREATE TABLE IF NOT EXISTS tool_performance_history (
    id SERIAL PRIMARY KEY,
    tool_name VARCHAR(100) NOT NULL REFERENCES tool_registry(tool_name) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    agent_type VARCHAR(100) REFERENCES agent_registry(agent_type) ON DELETE SET NULL,
    execution_time_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_type VARCHAR(100),
    input_size_bytes INTEGER,
    output_size_bytes INTEGER,
    resource_usage JSONB,
    optimization_suggestions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adaptive behavior rule engine
CREATE TABLE IF NOT EXISTS agent_adaptation_rules (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(100) NOT NULL REFERENCES agent_registry(agent_type) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    condition_expression TEXT NOT NULL,
    action_expression TEXT NOT NULL,
    rule_priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intelligent orchestration decision tracking
CREATE TABLE IF NOT EXISTS orchestration_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    orchestration_id UUID DEFAULT uuid_generate_v4(),
    decision_context JSONB NOT NULL,
    agent_selection_rationale TEXT,
    tool_selection_rationale TEXT,
    execution_plan JSONB,
    actual_execution_path JSONB,
    optimization_applied JSONB,
    performance_score DECIMAL(4,3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time data stream configuration
CREATE TABLE IF NOT EXISTS intelligence_streams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stream_name VARCHAR(100) NOT NULL,
    stream_type VARCHAR(50) CHECK (stream_type IN ('sensor', 'api', 'database', 'event', 'user_input')) NOT NULL,
    data_source_config JSONB NOT NULL,
    processing_pipeline JSONB,
    output_destinations JSONB,
    is_active BOOLEAN DEFAULT true,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, stream_name)
);

-- AI-generated predictions and recommendations
CREATE TABLE IF NOT EXISTS predictive_insights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) CHECK (insight_type IN ('prediction', 'recommendation', 'alert', 'pattern', 'anomaly')) NOT NULL,
    insight_title VARCHAR(255) NOT NULL,
    insight_description TEXT,
    confidence_score DECIMAL(4,3),
    data_sources JSONB,
    supporting_evidence JSONB,
    recommended_actions JSONB,
    predicted_outcome TEXT,
    validation_status VARCHAR(20) CHECK (validation_status IN ('pending', 'confirmed', 'rejected')) DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    validated_at TIMESTAMP WITH TIME ZONE
);

-- Multi-modal training sessions
CREATE TABLE IF NOT EXISTS cross_modal_learning_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_name VARCHAR(100) NOT NULL,
    modalities_involved JSONB NOT NULL,
    training_objective TEXT,
    data_sources JSONB,
    learning_algorithm VARCHAR(50),
    session_status VARCHAR(20) CHECK (session_status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0,
    performance_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enhanced MCP communication analytics
CREATE TABLE IF NOT EXISTS mcp_message_analytics (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
    processing_time_ms INTEGER,
    routing_efficiency_score DECIMAL(4,3),
    context_preservation_score DECIMAL(4,3),
    semantic_similarity DECIMAL(4,3),
    translation_accuracy DECIMAL(4,3),
    optimization_suggestions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================================
-- CONVERSATION AND KNOWLEDGE MANAGEMENT
-- ================================================================================================

-- Conversation store for memory
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID DEFAULT uuid_generate_v4(),
    title VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual messages in conversations
CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    embeddings vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base with vector embeddings
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(255),
    tags JSONB,
    embeddings vector(1536),
    access_level VARCHAR(20) CHECK (access_level IN ('public', 'user', 'private')) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================================
-- WORKFLOW AND AUTOMATION
-- ================================================================================================

-- Workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    execution_id UUID DEFAULT uuid_generate_v4(),
    status VARCHAR(20) CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    execution_log JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ================================================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ================================================================================================

-- Core user table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Session and authentication indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- API vault indexes
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(provider_id);
CREATE INDEX IF NOT EXISTS idx_api_security_events_user_id ON api_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_api_security_events_type ON api_security_events(event_type);

-- Personal Life OS indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON user_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON user_calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON user_email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_received ON user_email_messages(received_at);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON user_contacts(user_id);

-- Multi-agent framework indexes
CREATE INDEX IF NOT EXISTS idx_agent_messages_sender ON agent_messages(sender_agent);
CREATE INDEX IF NOT EXISTS idx_agent_messages_receiver ON agent_messages(receiver_agent);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_type ON agent_performance_metrics(agent_type);

-- Multi-modal indexes
CREATE INDEX IF NOT EXISTS idx_voice_interactions_user_id ON voice_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_session ON voice_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_visual_analysis_user_id ON visual_analysis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_multimodal_data_user_id ON multimodal_data(user_id);
CREATE INDEX IF NOT EXISTS idx_multimodal_data_type ON multimodal_data(data_type);

-- Vector similarity indexes
CREATE INDEX IF NOT EXISTS idx_multimodal_data_embeddings ON multimodal_data USING ivfflat (embeddings vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embeddings ON knowledge_base USING ivfflat (embeddings vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_embeddings ON conversation_messages USING ivfflat (embeddings vector_cosine_ops);

-- Advanced AI indexes
CREATE INDEX IF NOT EXISTS idx_orchestration_logs_user_id ON orchestration_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_predictive_insights_user_id ON predictive_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_predictive_insights_type ON predictive_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_tool_performance_tool ON tool_performance_history(tool_name);

-- Conversation and workflow indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- ================================================================================================
-- INITIAL DATA POPULATION
-- ================================================================================================

-- Insert supported API providers
INSERT INTO api_providers (name, display_name, description, auth_type, rate_limit_rpm, rate_limit_tpm) VALUES
    ('openai', 'OpenAI', 'GPT-4, DALL-E, Embeddings, TTS', 'bearer', 60, 90000),
    ('deepgram', 'Deepgram', 'Speech-to-Text API', 'api_key', 100, 500000),
    ('google', 'Google Cloud', 'Various Google APIs', 'api_key', 1000, 1000000),
    ('github', 'GitHub', 'GitHub API for repositories', 'bearer', 5000, 5000000),
    ('tavily', 'Tavily Search', 'Web search API', 'api_key', 1000, 100000),
    ('serpapi', 'SerpAPI', 'Google search results', 'api_key', 100, 100000),
    ('wolfram', 'Wolfram Alpha', 'Computational knowledge', 'api_key', 200, 200000)
ON CONFLICT (name) DO NOTHING;

-- Insert default agent registry
INSERT INTO agent_registry (agent_type, agent_name, agent_description, capabilities) VALUES
    ('core', 'Enhanced Core Agent', 'Master supervisor agent with full tool access', '["supervision", "coordination", "all_tools"]'),
    ('researcher', 'Research Agent', 'Web research and information gathering', '["web_search", "fact_checking", "analysis"]'),
    ('codewriter', 'Code Writer Agent', 'Code generation and software development', '["code_generation", "debugging", "architecture"]'),
    ('artist', 'Artist Agent', 'Image generation and visual content', '["image_generation", "visual_design", "creativity"]'),
    ('writer', 'Writer Agent', 'Content creation and writing', '["content_creation", "editing", "copywriting"]'),
    ('analyst', 'Analytics Agent', 'Data analysis and insights', '["data_analysis", "statistics", "reporting"]'),
    ('scheduler', 'Scheduler Agent', 'Calendar and task management', '["scheduling", "time_management", "reminders"]'),
    ('comedian', 'Comedian Agent', 'Humor and entertainment', '["humor", "entertainment", "personality"]'),
    ('designer', 'Design Agent', 'UI/UX and design systems', '["ui_design", "ux_design", "prototyping"]'),
    ('emotional', 'Emotional Intelligence Agent', 'Emotional analysis and support', '["emotion_detection", "empathy", "support"]'),
    ('task', 'Task Management Agent', 'Task coordination and workflow', '["task_management", "workflow", "productivity"]')
ON CONFLICT (agent_type) DO NOTHING;

-- Insert default tool registry
INSERT INTO tool_registry (tool_name, tool_description, access_level) VALUES
    ('web_search', 'Search the web for information', 'public'),
    ('wolfram_alpha', 'Query computational knowledge engine', 'public'),
    ('github_search', 'Search GitHub repositories and code', 'public'),
    ('image_generation', 'Generate images using AI', 'restricted'),
    ('voice_synthesis', 'Convert text to speech', 'restricted'),
    ('vision_analysis', 'Analyze images and visual content', 'restricted'),
    ('database_query', 'Query application database', 'private'),
    ('email_send', 'Send emails through configured providers', 'restricted'),
    ('calendar_access', 'Access and manage calendar events', 'restricted'),
    ('contact_management', 'Manage user contacts', 'restricted')
ON CONFLICT (tool_name) DO NOTHING;

-- ================================================================================================
-- MAINTENANCE AND CLEANUP FUNCTIONS
-- ================================================================================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update user preferences timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER trigger_update_user_preferences
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_timestamp();

-- ================================================================================================
-- COMPLETION MESSAGE
-- ================================================================================================

DO $$ 
BEGIN 
    RAISE NOTICE 'Cartrita comprehensive database schema created successfully!';
    RAISE NOTICE 'Total tables created: 33+ tables across all iterations (18-22)';
    RAISE NOTICE 'Indexes created for optimal performance';
    RAISE NOTICE 'Initial data populated for API providers, agents, and tools';
END $$;