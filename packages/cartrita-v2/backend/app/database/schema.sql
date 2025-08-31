-- Database schema for file attachments and related tables

-- Create file_attachments table for storing uploaded file metadata
CREATE TABLE IF NOT EXISTS file_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL CHECK (size > 0),
    hash VARCHAR(64) NOT NULL, -- SHA-256 hash
    url TEXT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scan_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    scan_result TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_attachments_session_id ON file_attachments(session_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_message_id ON file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_hash ON file_attachments(hash);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_at ON file_attachments(uploaded_at);

-- Create chat_sessions table if it doesn't exist (referenced by file_attachments)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    title VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table if it doesn't exist (referenced by file_attachments)
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Add foreign key constraints for file_attachments (if tables exist)
-- Note: These will be added only if the referenced tables exist
DO $$
BEGIN
    -- Add foreign key to session if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
        ALTER TABLE file_attachments 
        ADD CONSTRAINT fk_file_attachments_session_id 
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
    END IF;
    
    -- Add foreign key to message if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        ALTER TABLE file_attachments 
        ADD CONSTRAINT fk_file_attachments_message_id 
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL; -- Ignore if constraints already exist
END
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_file_attachments_updated_at 
    BEFORE UPDATE ON file_attachments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();