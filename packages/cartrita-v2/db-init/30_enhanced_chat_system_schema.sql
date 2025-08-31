-- =====================================================
-- ENHANCED CHAT SYSTEM SCHEMA
-- Modern ChatGPT/Claude-style chat system with MCP integration
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CHAT SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    agent_id VARCHAR(100), -- Which agent this session is primarily with
    session_type VARCHAR(50) DEFAULT 'chat' CHECK (session_type IN ('chat', 'computer_use', 'code_generation', 'research')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    model_used VARCHAR(100), -- Track which model was used (gpt-4o, etc.)
    total_messages INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0.00,
    settings JSONB DEFAULT '{}'::jsonb, -- Chat-specific settings
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CHAT MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_index INTEGER NOT NULL, -- Position in conversation
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text' CHECK (content_type IN ('text', 'markdown', 'code', 'image', 'audio', 'file')),
    
    -- Agent and model information
    agent_id VARCHAR(100), -- Which agent responded (if assistant)
    model_used VARCHAR(100), -- Model used for this specific message
    
    -- Token tracking
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost DECIMAL(8,6) DEFAULT 0.00,
    
    -- Tool usage information
    tools_used JSONB DEFAULT '[]'::jsonb, -- Array of tools used
    tool_calls JSONB DEFAULT '[]'::jsonb, -- Tool call details
    tool_results JSONB DEFAULT '[]'::jsonb, -- Tool execution results
    
    -- Computer use information
    computer_actions JSONB DEFAULT '[]'::jsonb, -- Computer use actions taken
    screenshots JSONB DEFAULT '[]'::jsonb, -- Screenshots captured
    
    -- Message metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    response_time_ms INTEGER, -- How long the response took
    error_info JSONB, -- Error information if message failed
    
    -- Status and visibility
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'streaming', 'completed', 'failed', 'cancelled')),
    is_hidden BOOLEAN DEFAULT FALSE, -- For system messages or tool calls
    is_favorite BOOLEAN DEFAULT FALSE, -- User can favorite messages
    is_regenerated BOOLEAN DEFAULT FALSE, -- Was this message regenerated
    parent_message_id UUID REFERENCES chat_messages(id), -- For message regeneration/branching
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CHAT MESSAGE ATTACHMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100), -- image/png, application/pdf, etc.
    file_size BIGINT, -- Size in bytes
    mime_type VARCHAR(255),
    
    -- For images
    width INTEGER,
    height INTEGER,
    
    -- For analysis results
    analysis_results JSONB DEFAULT '{}'::jsonb,
    
    -- Upload metadata
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- CHAT SESSION PARTICIPANTS (for multi-agent conversations)
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_session_participants (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    agent_id VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'participant' CHECK (role IN ('primary', 'participant', 'observer')),
    permissions JSONB DEFAULT '{}'::jsonb, -- What this agent can do
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by INTEGER REFERENCES users(id),
    UNIQUE(session_id, agent_id)
);

-- =====================================================
-- CONVERSATION TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- coding, research, writing, etc.
    system_prompt TEXT NOT NULL,
    suggested_agents JSONB DEFAULT '[]'::jsonb, -- Recommended agents
    default_settings JSONB DEFAULT '{}'::jsonb, -- Default session settings
    is_public BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CHAT FEEDBACK AND RATINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_message_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'copy', 'regenerate', 'edit')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, feedback_type)
);

-- =====================================================
-- CHAT SEARCH INDEX FOR VECTOR SEARCH
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_message_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    content_embedding vector(1536), -- OpenAI embedding dimension
    metadata_embedding vector(1536), -- For metadata search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Chat sessions indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status) WHERE status != 'deleted';
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_type ON chat_sessions(session_type);

-- Chat messages indexes  
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_index ON chat_messages(session_id, message_index);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id ON chat_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_search ON chat_messages USING GIN (to_tsvector('english', content));

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON chat_message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_type ON chat_message_attachments(file_type);

-- Participants indexes
CREATE INDEX IF NOT EXISTS idx_chat_participants_session_id ON chat_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_agent_id ON chat_session_participants(agent_id);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_conversation_templates_category ON conversation_templates(category);
CREATE INDEX IF NOT EXISTS idx_conversation_templates_public ON conversation_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_conversation_templates_usage ON conversation_templates(usage_count DESC);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_chat_feedback_message_id ON chat_message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_user_id ON chat_message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_type ON chat_message_feedback(feedback_type);

-- Embeddings indexes (for vector similarity search)
CREATE INDEX IF NOT EXISTS idx_chat_embeddings_message_id ON chat_message_embeddings(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_embeddings_content_vector ON chat_message_embeddings USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update chat_sessions.updated_at when messages are added
CREATE OR REPLACE FUNCTION update_chat_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions 
    SET 
        updated_at = NOW(),
        last_message_at = NOW(),
        total_messages = total_messages + 1,
        total_tokens = total_tokens + COALESCE(NEW.total_tokens, 0)
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_session_on_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_session_on_message();

-- Update message_index automatically
CREATE OR REPLACE FUNCTION set_message_index()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.message_index IS NULL THEN
        NEW.message_index := (
            SELECT COALESCE(MAX(message_index), 0) + 1 
            FROM chat_messages 
            WHERE session_id = NEW.session_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_message_index
    BEFORE INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION set_message_index();

-- =====================================================
-- DEFAULT CONVERSATION TEMPLATES
-- =====================================================

-- Insert default conversation templates
INSERT INTO conversation_templates (name, description, category, system_prompt, suggested_agents, default_settings) 
VALUES 
(
    'General Assistant',
    'A helpful AI assistant for general questions and tasks',
    'general',
    'You are a helpful AI assistant. Be concise, accurate, and friendly in your responses.',
    '["supervisor_cartrita_v2"]',
    '{"temperature": 0.7, "max_tokens": 2048}'
),
(
    'Code Assistant',
    'Specialized assistant for programming and software development',
    'coding',
    'You are a senior software engineer and coding assistant. Provide high-quality, well-documented code solutions.',
    '["code_writer_agent_v2"]',
    '{"temperature": 0.3, "max_tokens": 4096}'
),
(
    'Research Assistant',
    'Assistant specialized in research and fact-finding',
    'research',
    'You are a research assistant. Provide thorough, well-sourced information and analysis.',
    '["research_agent_v2"]',
    '{"temperature": 0.5, "max_tokens": 3072}'
),
(
    'Writing Assistant',
    'Assistant for creative and technical writing',
    'writing',
    'You are a professional writing assistant. Help with content creation, editing, and writing improvement.',
    '["writer_agent_v2"]',
    '{"temperature": 0.8, "max_tokens": 3072}'
),
(
    'Computer Use Agent',
    'Assistant that can interact with your computer',
    'automation',
    'You are a computer use agent. You can see and interact with the desktop to help users with tasks.',
    '["computer_use_agent_v2"]',
    '{"temperature": 0.4, "max_tokens": 2048, "computer_use_enabled": true}'
);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE chat_sessions IS 'Chat sessions - similar to ChatGPT conversations';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat sessions';
COMMENT ON TABLE chat_message_attachments IS 'File attachments for chat messages';
COMMENT ON TABLE chat_session_participants IS 'Multi-agent participants in chat sessions';
COMMENT ON TABLE conversation_templates IS 'Pre-defined conversation templates and prompts';
COMMENT ON TABLE chat_message_feedback IS 'User feedback on AI responses';
COMMENT ON TABLE chat_message_embeddings IS 'Vector embeddings for semantic search';

\echo "✅ Enhanced chat system schema created successfully!";