-- Enhanced chat system schema (tables only)
-- This creates the new chat tables without dropping existing ones

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Chat sessions table - represents individual chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    agent_type VARCHAR(50) DEFAULT 'supervisor',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Chat messages table - stores all messages in chat sessions
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    agent_type VARCHAR(50),
    parent_message_id UUID REFERENCES chat_messages(id),
    is_streaming BOOLEAN DEFAULT false,
    is_complete BOOLEAN DEFAULT true,
    token_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Chat message attachments - for file uploads and media
CREATE TABLE IF NOT EXISTS chat_message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Chat session participants - for multi-user chats (future use)
CREATE TABLE IF NOT EXISTS chat_session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'participant',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(session_id, user_id)
);

-- Conversation templates - predefined conversation starters
CREATE TABLE IF NOT EXISTS conversation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    template_content TEXT NOT NULL,
    agent_type VARCHAR(50) DEFAULT 'supervisor',
    tags TEXT[],
    is_public BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Chat message feedback - ratings and feedback on AI responses
CREATE TABLE IF NOT EXISTS chat_message_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('like', 'dislike', 'flag', 'rating')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(message_id, user_id, feedback_type)
);

-- Chat message embeddings - for semantic search
CREATE TABLE IF NOT EXISTS chat_message_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    embedding vector(1536),
    model_version VARCHAR(50) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);
CREATE INDEX IF NOT EXISTS idx_chat_messages_parent_id ON chat_messages(parent_message_id);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON chat_message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON chat_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON chat_session_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_templates_category ON conversation_templates(category);
CREATE INDEX IF NOT EXISTS idx_conversation_templates_agent_type ON conversation_templates(agent_type);
CREATE INDEX IF NOT EXISTS idx_conversation_templates_public ON conversation_templates(is_public) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON chat_message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON chat_message_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_message_embeddings_message_id ON chat_message_embeddings(message_id);

-- Update triggers for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_conversation_templates_updated_at 
    BEFORE UPDATE ON conversation_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default conversation templates
INSERT INTO conversation_templates (name, description, category, template_content, agent_type) VALUES
('General Chat', 'Start a general conversation', 'general', 'Hi! I''d like to chat about {topic}', 'supervisor'),
('Code Review', 'Get help with code review and debugging', 'development', 'Please review this code and suggest improvements: {code}', 'code_writer'),
('Research Task', 'Get help with research and information gathering', 'research', 'I need help researching {topic}. Can you help me find comprehensive information?', 'research'),
('Writing Assistant', 'Get help with writing and editing', 'writing', 'I need help writing {type_of_content}. Here''s what I have so far: {content}', 'writer'),
('Image Analysis', 'Analyze images and visual content', 'vision', 'Please analyze this image and tell me what you see: {image_description}', 'vision'),
('Task Automation', 'Help with computer tasks and automation', 'automation', 'I need help automating this task: {task_description}', 'computer_use')
ON CONFLICT DO NOTHING;

SELECT '✅ Enhanced chat system tables created successfully!' as result;