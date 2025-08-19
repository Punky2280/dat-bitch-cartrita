-- Cartrita V2 Foundation Schema Migration
-- Comprehensive migration from V1 to V2 with enhanced architecture
-- Date: August 18, 2025

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ============================================================
-- V2 CORE USER SYSTEM (Enhanced from V1)
-- ============================================================

-- Enhanced Users table with V2 features
CREATE TABLE IF NOT EXISTS v2_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_id INTEGER, -- Migration link to V1 users
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    
    -- Authentication
    password_hash VARCHAR(255), -- For local auth
    auth_provider VARCHAR(50) DEFAULT 'local', -- 'local', 'google', 'microsoft'
    auth_provider_id VARCHAR(255),
    
    -- Cartrita Persona & Preferences
    personality_profile JSONB DEFAULT '{
        "sarcasm_level": 7,
        "humor_style": "miami_sass",
        "verbosity": "expressive", 
        "attitude": "helpful_but_sassy",
        "cultural_context": "miami_urban"
    }'::jsonb,
    
    -- Agent Model Preferences
    model_preferences JSONB DEFAULT '{
        "primary_model": "gpt-4o-2024-08-06",
        "computer_use_model": "gpt-4-computer-use-preview", 
        "vision_model": "gpt-4-vision-preview",
        "code_model": "gpt-4-code-interpreter",
        "creative_model": "gpt-4-creative-writing"
    }'::jsonb,
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    usage_limits JSONB DEFAULT '{"daily_requests": 1000, "monthly_tokens": 100000}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Migration tracking
    migrated_from_v1 BOOLEAN DEFAULT FALSE,
    migration_completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_v2_users_email ON v2_users(email);
CREATE INDEX idx_v2_users_username ON v2_users(username);
CREATE INDEX idx_v2_users_legacy_id ON v2_users(legacy_id);
CREATE INDEX idx_v2_users_status ON v2_users(status);

-- ============================================================
-- V2 ENHANCED API KEY VAULT SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_api_key_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES v2_users(id) ON DELETE CASCADE,
    
    -- Key identification
    service_name VARCHAR(100) NOT NULL,
    key_alias VARCHAR(100),
    key_type VARCHAR(50) DEFAULT 'api_key', -- 'api_key', 'oauth_token', 'certificate'
    
    -- Encrypted storage
    encrypted_key TEXT NOT NULL,
    encryption_version INTEGER DEFAULT 1,
    key_hash VARCHAR(64), -- SHA-256 hash for deduplication
    
    -- Usage and permissions
    usage_scope TEXT[] DEFAULT ARRAY['general'], -- ['general', 'computer_use', 'fine_tuning']
    permission_level VARCHAR(20) DEFAULT 'standard', -- 'standard', 'elevated', 'admin'
    allowed_agents TEXT[] DEFAULT ARRAY['*'], -- Agent names or ['*'] for all
    
    -- Rotation and security
    rotation_policy JSONB DEFAULT '{
        "auto_rotate": false,
        "rotation_interval_days": 90,
        "notify_before_expiry_days": 7
    }'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    
    -- Metadata
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    rate_limits JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    next_rotation_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for API key vault
CREATE INDEX idx_v2_vault_user_service ON v2_api_key_vault(user_id, service_name);
CREATE INDEX idx_v2_vault_active ON v2_api_key_vault(is_active) WHERE is_active = true;
CREATE INDEX idx_v2_vault_expires ON v2_api_key_vault(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- V2 ENHANCED AGENT SYSTEM
-- ============================================================

-- Agent definitions and configurations
CREATE TABLE IF NOT EXISTS v2_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    
    -- Agent type and capabilities
    agent_type VARCHAR(50) NOT NULL, -- 'core', 'specialist', 'bridge', 'computer_use'
    capabilities TEXT[] DEFAULT ARRAY[],
    specialized_models JSONB DEFAULT '{}'::jsonb, -- Model assignments per task type
    
    -- Configuration
    system_prompt TEXT NOT NULL,
    persona_config JSONB DEFAULT '{}'::jsonb,
    tool_permissions TEXT[] DEFAULT ARRAY[],
    
    -- Performance settings
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    context_window INTEGER DEFAULT 128000,
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    version VARCHAR(20) DEFAULT '2.0.0',
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent model assignments (specialized models per agent)
CREATE TABLE IF NOT EXISTS v2_agent_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES v2_agents(id) ON DELETE CASCADE,
    
    -- Model configuration
    model_name VARCHAR(100) NOT NULL,
    model_provider VARCHAR(50) DEFAULT 'openai',
    model_type VARCHAR(50) NOT NULL, -- 'chat', 'vision', 'code', 'computer_use', 'multimodal'
    
    -- Performance settings
    priority INTEGER DEFAULT 1, -- Higher number = higher priority
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    
    -- Usage controls
    is_primary BOOLEAN DEFAULT false,
    fallback_model VARCHAR(100),
    cost_tier VARCHAR(20) DEFAULT 'standard', -- 'economy', 'standard', 'premium'
    
    -- Metadata
    configuration JSONB DEFAULT '{}'::jsonb,
    performance_data JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(agent_id, model_type, is_primary) -- Only one primary model per type per agent
);

-- ============================================================
-- V2 COMPUTER USE SYSTEM (Enhanced)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_computer_use_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES v2_users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES v2_agents(id),
    
    -- Session details
    session_name VARCHAR(255),
    task_description TEXT NOT NULL,
    justification TEXT NOT NULL,
    
    -- Authorization
    supervisor_authorization JSONB NOT NULL, -- Full auth record
    api_key_permission JSONB NOT NULL, -- Vault access record
    
    -- Execution details
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'executing', 'completed', 'failed', 'cancelled')),
    safety_classification VARCHAR(20) DEFAULT 'unknown' CHECK (safety_classification IN ('safe', 'caution', 'dangerous', 'unknown')),
    max_iterations INTEGER DEFAULT 10,
    actual_iterations INTEGER DEFAULT 0,
    
    -- Results and metrics
    execution_log JSONB DEFAULT '[]'::jsonb,
    safety_checks JSONB DEFAULT '[]'::jsonb,
    screenshots_taken INTEGER DEFAULT 0,
    actions_executed INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    environment_info JSONB DEFAULT '{}'::jsonb,
    execution_metadata JSONB DEFAULT '{}'::jsonb
);

-- Computer use actions log (detailed action tracking)
CREATE TABLE IF NOT EXISTS v2_computer_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES v2_computer_use_sessions(id) ON DELETE CASCADE,
    
    -- Action details
    sequence_number INTEGER NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'screenshot', 'click', 'type', 'scroll', 'keypress'
    action_data JSONB NOT NULL,
    
    -- Execution
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'skipped')),
    execution_time_ms INTEGER,
    
    -- Safety and validation
    safety_check_passed BOOLEAN DEFAULT true,
    safety_concerns TEXT[],
    
    -- Results
    result_data JSONB,
    screenshot_before TEXT, -- Base64 encoded screenshot
    screenshot_after TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for computer use system
CREATE INDEX idx_v2_computer_sessions_user ON v2_computer_use_sessions(user_id);
CREATE INDEX idx_v2_computer_sessions_status ON v2_computer_use_sessions(status);
CREATE INDEX idx_v2_computer_actions_session ON v2_computer_actions(session_id, sequence_number);

-- ============================================================
-- V2 ENHANCED KNOWLEDGE HUB
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_knowledge_hub (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES v2_users(id) ON DELETE CASCADE,
    
    -- Content identification
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- 'text', 'code', 'document', 'image', 'url'
    source_type VARCHAR(50), -- 'manual', 'import', 'web_scrape', 'document_upload'
    source_url TEXT,
    
    -- Vector embeddings (multiple models supported)
    embedding_openai vector(1536), -- OpenAI text-embedding-3-small
    embedding_cohere vector(4096), -- Cohere embed-english-v3.0
    embedding_model_used VARCHAR(100) DEFAULT 'text-embedding-3-small',
    
    -- Organization
    category VARCHAR(100),
    tags TEXT[],
    collections TEXT[] DEFAULT ARRAY[], -- User-defined collections
    
    -- Quality and relevance
    confidence_score DECIMAL(4,3) DEFAULT 1.000,
    quality_score DECIMAL(4,3),
    relevance_score DECIMAL(4,3),
    
    -- Usage tracking
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    processing_status VARCHAR(20) DEFAULT 'completed',
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    processing_metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge hub indexes for vector search
CREATE INDEX idx_v2_knowledge_user ON v2_knowledge_hub(user_id);
CREATE INDEX idx_v2_knowledge_category ON v2_knowledge_hub(category);
CREATE INDEX idx_v2_knowledge_tags ON v2_knowledge_hub USING GIN(tags);
CREATE INDEX idx_v2_knowledge_active ON v2_knowledge_hub(is_active) WHERE is_active = true;

-- Vector similarity search indexes (HNSW for better performance)
CREATE INDEX idx_v2_knowledge_embedding_openai ON v2_knowledge_hub USING hnsw (embedding_openai vector_cosine_ops);
CREATE INDEX idx_v2_knowledge_embedding_cohere ON v2_knowledge_hub USING hnsw (embedding_cohere vector_cosine_ops);

-- ============================================================
-- V2 ENHANCED CONVERSATION SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES v2_users(id) ON DELETE CASCADE,
    
    -- Conversation metadata
    title VARCHAR(500),
    conversation_type VARCHAR(50) DEFAULT 'chat', -- 'chat', 'workflow', 'computer_use', 'voice'
    
    -- Agent involvement
    primary_agent VARCHAR(100), -- Main agent handling conversation
    agents_involved TEXT[] DEFAULT ARRAY[], -- All agents that participated
    
    -- Context and state
    context_window_tokens INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    conversation_embedding vector(1536), -- Conversation summary embedding
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    is_pinned BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS v2_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES v2_conversations(id) ON DELETE CASCADE,
    
    -- Message content
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'file', 'code'
    
    -- Agent and model info
    agent_name VARCHAR(100),
    model_used VARCHAR(100),
    
    -- Token tracking
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Message metadata
    tool_calls JSONB,
    function_calls JSONB,
    attachments JSONB,
    structured_data JSONB, -- For structured outputs from agents
    
    -- Quality metrics
    response_time_ms INTEGER,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Parent message for threading
    parent_message_id UUID REFERENCES v2_messages(id)
);

-- Conversation indexes
CREATE INDEX idx_v2_conversations_user ON v2_conversations(user_id);
CREATE INDEX idx_v2_conversations_status ON v2_conversations(status);
CREATE INDEX idx_v2_conversations_updated ON v2_conversations(updated_at DESC);
CREATE INDEX idx_v2_messages_conversation ON v2_messages(conversation_id, created_at);
CREATE INDEX idx_v2_messages_agent ON v2_messages(agent_name);

-- ============================================================
-- V2 WORKFLOW SYSTEM (Enhanced)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES v2_users(id) ON DELETE CASCADE,
    
    -- Workflow identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[],
    
    -- Workflow definition
    workflow_definition JSONB NOT NULL, -- Complete workflow definition
    version VARCHAR(20) DEFAULT '1.0.0',
    
    -- Execution configuration
    execution_mode VARCHAR(20) DEFAULT 'manual', -- 'manual', 'scheduled', 'triggered', 'auto'
    schedule_config JSONB, -- Cron-like scheduling config
    trigger_config JSONB, -- Event-based triggers
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    visibility VARCHAR(20) DEFAULT 'private', -- 'private', 'shared', 'public'
    
    -- Performance metrics
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    average_duration_ms INTEGER DEFAULT 0,
    last_execution_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS v2_workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES v2_workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES v2_users(id) ON DELETE CASCADE,
    
    -- Execution details
    execution_type VARCHAR(20) NOT NULL, -- 'manual', 'scheduled', 'triggered'
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Input and output
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    error_data JSONB,
    
    -- Metrics
    steps_total INTEGER DEFAULT 0,
    steps_completed INTEGER DEFAULT 0,
    duration_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Execution log
    execution_log JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Workflow indexes
CREATE INDEX idx_v2_workflows_user ON v2_workflows(user_id);
CREATE INDEX idx_v2_workflows_active ON v2_workflows(is_active) WHERE is_active = true;
CREATE INDEX idx_v2_workflows_category ON v2_workflows(category);
CREATE INDEX idx_v2_workflow_executions_workflow ON v2_workflow_executions(workflow_id);
CREATE INDEX idx_v2_workflow_executions_status ON v2_workflow_executions(status);

-- ============================================================
-- V2 ANALYTICS AND METRICS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_user_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES v2_users(id) ON DELETE CASCADE,
    
    -- Date tracking
    date DATE NOT NULL,
    
    -- Usage metrics
    sessions_count INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    
    -- Feature usage
    agents_used TEXT[] DEFAULT ARRAY[],
    tools_used TEXT[] DEFAULT ARRAY[],
    models_used TEXT[] DEFAULT ARRAY[],
    
    -- Computer use metrics
    computer_sessions INTEGER DEFAULT 0,
    computer_actions INTEGER DEFAULT 0,
    computer_safety_blocks INTEGER DEFAULT 0,
    
    -- Workflow metrics
    workflows_executed INTEGER DEFAULT 0,
    workflows_succeeded INTEGER DEFAULT 0,
    
    -- Performance metrics
    average_response_time_ms INTEGER,
    satisfaction_rating DECIMAL(3,2),
    
    -- Aggregated at day level
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- Analytics indexes
CREATE INDEX idx_v2_analytics_user_date ON v2_user_analytics(user_id, date DESC);
CREATE INDEX idx_v2_analytics_date ON v2_user_analytics(date);

-- ============================================================
-- V2 MIGRATION TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_migration_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Migration details
    migration_name VARCHAR(255) NOT NULL,
    migration_version VARCHAR(50) NOT NULL,
    migration_type VARCHAR(50), -- 'schema', 'data', 'config'
    
    -- User-specific migration (if applicable)
    user_id UUID REFERENCES v2_users(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    
    -- Details
    source_system VARCHAR(50) DEFAULT 'v1',
    records_processed INTEGER DEFAULT 0,
    records_migrated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    
    -- Error tracking
    error_details JSONB,
    warnings JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    migration_metadata JSONB DEFAULT '{}'::jsonb
);

-- Migration indexes
CREATE INDEX idx_v2_migration_status ON v2_migration_log(status);
CREATE INDEX idx_v2_migration_user ON v2_migration_log(user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- V2 TRIGGERS AND FUNCTIONS
-- ============================================================

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_v2_users_updated_at BEFORE UPDATE ON v2_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_v2_api_key_vault_updated_at BEFORE UPDATE ON v2_api_key_vault FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_v2_agents_updated_at BEFORE UPDATE ON v2_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_v2_agent_models_updated_at BEFORE UPDATE ON v2_agent_models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_v2_computer_use_sessions_updated_at BEFORE UPDATE ON v2_computer_use_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_v2_knowledge_hub_updated_at BEFORE UPDATE ON v2_knowledge_hub FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_v2_conversations_updated_at BEFORE UPDATE ON v2_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_v2_workflows_updated_at BEFORE UPDATE ON v2_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================

COMMENT ON TABLE v2_users IS 'V2 enhanced user system with Cartrita persona integration';
COMMENT ON TABLE v2_api_key_vault IS 'Secure API key storage with enhanced permissions and rotation';
COMMENT ON TABLE v2_agents IS 'Agent definitions with specialized model assignments';
COMMENT ON TABLE v2_agent_models IS 'Model assignments per agent with fallback and optimization';
COMMENT ON TABLE v2_computer_use_sessions IS 'Computer use sessions with full supervision and audit trail';
COMMENT ON TABLE v2_computer_actions IS 'Detailed computer action logging for safety and compliance';
COMMENT ON TABLE v2_knowledge_hub IS 'Enhanced knowledge storage with multi-model embeddings';
COMMENT ON TABLE v2_conversations IS 'Conversation management with agent tracking';
COMMENT ON TABLE v2_messages IS 'Message storage with structured data and metrics';
COMMENT ON TABLE v2_workflows IS 'Enhanced workflow system with scheduling and triggers';
COMMENT ON TABLE v2_workflow_executions IS 'Workflow execution tracking with detailed logs';
COMMENT ON TABLE v2_user_analytics IS 'Daily user analytics and metrics aggregation';
COMMENT ON TABLE v2_migration_log IS 'Migration tracking and audit trail';

-- Migration completed successfully
INSERT INTO v2_migration_log (
    migration_name, 
    migration_version, 
    migration_type, 
    status, 
    started_at, 
    completed_at,
    migration_metadata
) VALUES (
    'V2 Foundation Schema',
    '2.0.0',
    'schema',
    'completed',
    NOW(),
    NOW(),
    '{"description": "Complete V2 schema foundation with enhanced architecture", "tables_created": 14}'::jsonb
);