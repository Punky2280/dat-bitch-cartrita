-- Comprehensive Cartrita Database Schema
-- This file creates all required tables for the Cartrita system

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences
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

-- API Keys Vault
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    encrypted_key TEXT NOT NULL,
    key_alias VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Knowledge Hub
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text',
    embedding vector(1536),
    tags TEXT[],
    category VARCHAR(100),
    source_url VARCHAR(500),
    confidence_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Chat History
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID DEFAULT uuid_generate_v4(),
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    model_used VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Workflow System
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    execution_id UUID DEFAULT uuid_generate_v4(),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    result JSONB,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS workflow_schedules (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('cron', 'interval', 'once')),
    schedule_expression VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    next_run TIMESTAMP WITH TIME ZONE,
    last_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow Tools Registry
CREATE TABLE IF NOT EXISTS workflow_tools (
    id SERIAL PRIMARY KEY,
    tool_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    input_schema JSONB,
    output_schema JSONB,
    implementation_details JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version VARCHAR(50) DEFAULT '1.0.0'
);

-- Agent System
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capabilities TEXT[],
    configuration JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version VARCHAR(50) DEFAULT '1.0.0'
);

CREATE TABLE IF NOT EXISTS agent_interactions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id),
    user_id INTEGER REFERENCES users(id),
    interaction_type VARCHAR(100),
    input_data JSONB,
    output_data JSONB,
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multi-Modal Processing
CREATE TABLE IF NOT EXISTS multi_modal_processing_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID,
    input_type VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_type VARCHAR(50),
    output_data JSONB,
    processing_agent VARCHAR(100),
    processing_time_ms INTEGER,
    confidence_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Privacy and Security
CREATE TABLE IF NOT EXISTS privacy_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    data_retention_days INTEGER DEFAULT 90,
    allow_data_sharing BOOLEAN DEFAULT false,
    encryption_enabled BOOLEAN DEFAULT true,
    audit_logging BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Calendar Integration
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    external_event_id VARCHAR(255),
    calendar_provider VARCHAR(50) DEFAULT 'google',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    attendees JSONB DEFAULT '[]'::jsonb,
    is_all_day BOOLEAN DEFAULT false,
    recurrence_rule TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Contact Management
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    job_title VARCHAR(255),
    notes TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Email Management
CREATE TABLE IF NOT EXISTS email_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    provider VARCHAR(50),
    encrypted_credentials TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_threads (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES email_accounts(id) ON DELETE CASCADE,
    thread_id VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    participants JSONB DEFAULT '[]'::jsonb,
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voice and Audio
CREATE TABLE IF NOT EXISTS voice_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID DEFAULT uuid_generate_v4(),
    audio_duration_seconds FLOAT,
    transcription TEXT,
    response_text TEXT,
    voice_model VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Visual Analysis
CREATE TABLE IF NOT EXISTS visual_analysis (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    image_hash VARCHAR(64),
    analysis_type VARCHAR(50),
    analysis_result JSONB,
    confidence_score FLOAT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- System Health and Monitoring
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    component VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('healthy', 'warning', 'error', 'offline')),
    message TEXT,
    metrics JSONB DEFAULT '{}'::jsonb,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OpenTelemetry Traces
CREATE TABLE IF NOT EXISTS telemetry_traces (
    id SERIAL PRIMARY KEY,
    trace_id VARCHAR(32) NOT NULL,
    span_id VARCHAR(16) NOT NULL,
    parent_span_id VARCHAR(16),
    operation_name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    status VARCHAR(20),
    tags JSONB DEFAULT '{}'::jsonb,
    logs JSONB DEFAULT '[]'::jsonb
);

-- Hugging Face Model Registry
CREATE TABLE IF NOT EXISTS hf_models (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(255) UNIQUE NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    provider VARCHAR(100),
    description TEXT,
    parameters JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documentation System
CREATE TABLE IF NOT EXISTS documentation (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    doc_type VARCHAR(50) DEFAULT 'manual',
    category VARCHAR(100),
    tags TEXT[],
    version VARCHAR(50) DEFAULT '1.0.0',
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user_id ON knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding ON knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_agent_id ON agent_interactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_interactions_user_id ON agent_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_traces_trace_id ON telemetry_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_traces_operation_name ON telemetry_traces(operation_name);

-- Insert initial data
INSERT INTO users (name, email, password_hash) VALUES
    ('Lulu Fernandez', 'lulufdez84@gmail.com', '$2b$12$zIcI.vHRx6i.1GD0E0QF0Opoi8KmLhsprNy0.394h0oAuMsAskb/a'),
    ('Robert Allen', 'robert@test.com', '$2b$12$zIcI.vHRx6i.1GD0E0QF0Opoi8KmLhsprNy0.394h0oAuMsAskb/a'),
    ('Robbie', 'robbienosebest@gmail.com', '$2b$12$zIcI.vHRx6i.1GD0E0QF0Opoi8KmLhsprNy0.394h0oAuMsAskb/a')
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

-- Insert user preferences for all users
INSERT INTO user_preferences (user_id, sarcasm_level, verbosity, humor_style)
SELECT id, 7, 'normal', 'sarcastic' FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Insert initial agents
INSERT INTO agents (agent_type, name, description, capabilities) VALUES
    ('core', 'Enhanced Core Agent', 'Main conversational agent with advanced capabilities', ARRAY['conversation', 'reasoning', 'memory', 'planning']),
    ('research', 'Research Agent', 'Specialized in information gathering and analysis', ARRAY['web_search', 'document_analysis', 'summarization']),
    ('workflow', 'Workflow Engine', 'Manages and executes automated workflows', ARRAY['task_automation', 'scheduling', 'integration']),
    ('multimodal', 'Multi-Modal Agent', 'Handles vision, audio, and text processing', ARRAY['image_analysis', 'speech_recognition', 'text_to_speech']),
    ('security', 'Security Audit Agent', 'Monitors system security and compliance', ARRAY['security_monitoring', 'audit_logging', 'threat_detection'])
ON CONFLICT DO NOTHING;

-- Insert initial workflow tools
INSERT INTO workflow_tools (tool_id, name, description, category, input_schema, output_schema) VALUES
    ('web_search', 'Web Search', 'Search the web for information', 'research', '{"query": "string"}', '{"results": "array"}'),
    ('email_send', 'Send Email', 'Send emails through configured accounts', 'communication', '{"to": "string", "subject": "string", "body": "string"}', '{"success": "boolean"}'),
    ('calendar_create', 'Create Calendar Event', 'Create new calendar events', 'productivity', '{"title": "string", "start": "datetime", "end": "datetime"}', '{"event_id": "string"}'),
    ('knowledge_search', 'Knowledge Search', 'Search personal knowledge base', 'knowledge', '{"query": "string", "limit": "number"}', '{"results": "array"}'),
    ('image_analyze', 'Image Analysis', 'Analyze images using AI vision', 'multimodal', '{"image_url": "string"}', '{"analysis": "object"}')
ON CONFLICT (tool_id) DO NOTHING;

-- Insert initial documentation
INSERT INTO documentation (title, content, doc_type, category) VALUES
    ('Cartrita User Manual', 'Welcome to Cartrita - Your Personal AI Assistant', 'manual', 'user_guide'),
    ('API Documentation', 'Complete API reference for Cartrita services', 'api', 'developer'),
    ('Agent System Overview', 'Understanding the multi-agent architecture', 'manual', 'system'),
    ('Workflow Automation Guide', 'How to create and manage automated workflows', 'tutorial', 'workflows'),
    ('Privacy and Security', 'Data protection and security features', 'manual', 'security')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO robert;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO robert;