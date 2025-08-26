-- Cartrita V2 Database Initialization Script
-- Creates necessary extensions and tables for the Python-only backend

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS cartrita;
CREATE SCHEMA IF NOT EXISTS chat;
CREATE SCHEMA IF NOT EXISTS agents;
CREATE SCHEMA IF NOT EXISTS mcp;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Set default search path
ALTER DATABASE cartrita_v2 SET search_path TO cartrita, chat, agents, mcp, analytics, public;

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat.sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    agent_type VARCHAR(100),
    token_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding VECTOR(1536) -- OpenAI embeddings dimension
);

-- Agent executions table
CREATE TABLE IF NOT EXISTS agents.executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat.sessions(id) ON DELETE CASCADE,
    agent_type VARCHAR(100) NOT NULL,
    task_description TEXT,
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- MCP tool executions table
CREATE TABLE IF NOT EXISTS mcp.tool_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat.sessions(id) ON DELETE CASCADE,
    tool_name VARCHAR(255) NOT NULL,
    server_name VARCHAR(255),
    input_parameters JSONB DEFAULT '{}'::jsonb,
    output_result JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS cartrita.embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type VARCHAR(100) NOT NULL, -- 'message', 'document', 'code', etc.
    content_id UUID NOT NULL,
    content_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS cartrita.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) UNIQUE NOT NULL,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics and usage tracking
CREATE TABLE IF NOT EXISTS analytics.usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(255),
    session_id UUID,
    agent_type VARCHAR(100),
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON chat.sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON chat.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_embedding_cosine ON chat.messages USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_executions_session_id ON agents.executions(session_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent_type ON agents.executions(agent_type);
CREATE INDEX IF NOT EXISTS idx_executions_status ON agents.executions(status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_session_id ON mcp.tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON cartrita.embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_id ON cartrita.embeddings(content_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_cosine ON cartrita.embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON analytics.usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON analytics.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON analytics.usage_events(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON chat.sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON cartrita.user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default data
INSERT INTO cartrita.user_preferences (user_id, preferences) 
VALUES ('default', '{
    "theme": "dark",
    "default_agent": "supervisor",
    "streaming_enabled": true,
    "max_tokens": 4000,
    "temperature": 0.7
}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;