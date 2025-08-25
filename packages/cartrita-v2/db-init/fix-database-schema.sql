-- ============================================================================
-- Cartrita Database Schema Fix Script
-- ============================================================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- ============================================================================
-- 2. CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing is_active column to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================================================
-- 3. MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- 3b. CONVERSATION_MESSAGES TABLE (Alternative/Legacy table structure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT,
    message TEXT,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add missing metadata column to conversation_messages if it doesn't exist
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 4. WORKFLOWS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing next_run_at column to workflows
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 5. WORKFLOW_SCHEDULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_schedules (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 6. KNOWLEDGE TABLES
-- ============================================================================

-- Knowledge Items/Nodes Table
CREATE TABLE IF NOT EXISTS knowledge_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing importance_score column
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS importance_score DECIMAL(5,4) DEFAULT 0.0;

-- Knowledge Nodes (if separate from knowledge_items)
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT,
    node_type VARCHAR(50) DEFAULT 'concept',
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing importance_score column to knowledge_nodes
ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS importance_score DECIMAL(5,4) DEFAULT 0.0;

-- Knowledge Relationships/Edges
CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_node_id INTEGER NOT NULL,
    target_node_id INTEGER NOT NULL,
    relationship_type VARCHAR(100) DEFAULT 'related_to',
    strength DECIMAL(3,2) DEFAULT 0.5,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Clusters
CREATE TABLE IF NOT EXISTS knowledge_clusters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    description TEXT,
    cluster_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. AGENT METRICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4),
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. SESSIONS TABLE (for authentication)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_active 
ON conversations(user_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id 
ON conversations(user_id);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_user_id 
ON messages(user_id);

-- Conversation Messages indexes
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id 
ON conversation_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_role 
ON conversation_messages(role);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at 
ON conversation_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_content 
ON conversation_messages USING GIN(to_tsvector('english', content));

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user_active 
ON workflows(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_workflows_next_run 
ON workflows(next_run_at) WHERE is_active = true;

-- Workflow schedules indexes
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_active_next_run 
ON workflow_schedules(is_active, next_run_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow_id 
ON workflow_schedules(workflow_id);

-- Knowledge items indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_items_user_id 
ON knowledge_items(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_tags 
ON knowledge_items USING GIN(tags);

-- Knowledge nodes indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_user_id 
ON knowledge_nodes(user_id);

-- Knowledge relationships indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source 
ON knowledge_relationships(source_node_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_target 
ON knowledge_relationships(target_node_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_user_id 
ON knowledge_relationships(user_id);

-- Agent metrics indexes
CREATE INDEX IF NOT EXISTS idx_agent_metrics_user_recorded 
ON agent_metrics(user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_name_recorded 
ON agent_metrics(metric_name, recorded_at DESC);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash 
ON sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at 
ON sessions(expires_at);

-- ============================================================================
-- 10. INSERT DEFAULT DATA
-- ============================================================================

-- Insert a default user if none exists (for testing)
INSERT INTO users (name, email, password_hash) 
VALUES ('Robert Allen', 'robbienosebest@gmail.com', 'temp_hash')
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 11. UPDATE EXISTING DATA
-- ============================================================================

-- Update any existing conversations to be active
UPDATE conversations SET is_active = true WHERE is_active IS NULL;

-- Update any existing workflows to have next_run_at if null
UPDATE workflows SET next_run_at = CURRENT_TIMESTAMP + INTERVAL '1 hour' 
WHERE next_run_at IS NULL AND is_active = true;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
SELECT 'Database schema setup completed successfully!' as status;
