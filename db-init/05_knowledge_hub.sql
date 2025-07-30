-- =====================================================
-- AI KNOWLEDGE HUB & MEMORY PALACE - Database Schema
-- =====================================================

-- Knowledge entries table - stores individual pieces of knowledge
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- text, code, image, document, link
    source_type VARCHAR(50) DEFAULT 'conversation', -- conversation, manual, import, workflow
    source_reference VARCHAR(255), -- conversation_id, file_path, url, etc.
    embedding VECTOR(1536), -- OpenAI embedding for semantic search
    tags TEXT[], -- User-defined tags
    category VARCHAR(100) DEFAULT 'general',
    importance_score FLOAT DEFAULT 0.5, -- 0-1 scale of importance
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge relationships table - represents connections between knowledge entries
CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id SERIAL PRIMARY KEY,
    source_entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    target_entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- related, depends_on, contradicts, builds_on, similar
    strength FLOAT DEFAULT 0.5, -- 0-1 scale of relationship strength
    context TEXT, -- Description of the relationship
    created_by VARCHAR(50) DEFAULT 'ai', -- ai, user, system
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_entry_id, target_entry_id, relationship_type)
);

-- Knowledge clusters table - semantic groupings of related knowledge
CREATE TABLE IF NOT EXISTS knowledge_clusters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cluster_embedding VECTOR(1536), -- Centroid embedding of cluster
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for visualization
    size INTEGER DEFAULT 0, -- Number of entries in cluster
    density FLOAT DEFAULT 0.0, -- How tightly packed the cluster is
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for knowledge entries in clusters
CREATE TABLE IF NOT EXISTS knowledge_cluster_entries (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER NOT NULL REFERENCES knowledge_clusters(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    relevance_score FLOAT DEFAULT 1.0, -- How relevant this entry is to the cluster
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cluster_id, entry_id)
);

-- Memory retrieval sessions - track how knowledge is accessed and used
CREATE TABLE IF NOT EXISTS memory_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) DEFAULT 'search', -- search, conversation, exploration
    query TEXT,
    query_embedding VECTOR(1536),
    results_count INTEGER DEFAULT 0,
    session_duration INTEGER, -- Duration in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session results - what knowledge was retrieved in each session
CREATE TABLE IF NOT EXISTS memory_session_results (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES memory_sessions(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    relevance_score FLOAT NOT NULL,
    rank_position INTEGER NOT NULL,
    was_useful BOOLEAN, -- User feedback on usefulness
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge evolution tracking - how knowledge changes over time
CREATE TABLE IF NOT EXISTS knowledge_evolution (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- created, updated, linked, clustered, accessed
    previous_content TEXT,
    new_content TEXT,
    change_summary TEXT,
    confidence_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collaborative knowledge sharing
CREATE TABLE IF NOT EXISTS knowledge_sharing (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    shared_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for public
    permission_level VARCHAR(20) DEFAULT 'read', -- read, comment, edit
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user_id ON knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content_type ON knowledge_entries(content_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_tags ON knowledge_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_importance ON knowledge_entries(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_created_at ON knowledge_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source ON knowledge_relationships(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_target ON knowledge_relationships(target_entry_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_type ON knowledge_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_user_id ON knowledge_clusters(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_entries_cluster ON knowledge_cluster_entries(cluster_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_entries_entry ON knowledge_cluster_entries(entry_id);

CREATE INDEX IF NOT EXISTS idx_memory_sessions_user_id ON memory_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_sessions_created_at ON memory_sessions(created_at DESC);

-- Enable vector similarity search with pgvector
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding ON knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_embedding ON knowledge_clusters USING ivfflat (cluster_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_memory_sessions_embedding ON memory_sessions USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100);

-- Insert some initial knowledge categories and sample data
INSERT INTO knowledge_clusters (user_id, name, description, color) 
SELECT 
    u.id as user_id,
    cluster.name,
    cluster.description,
    cluster.color
FROM (
    SELECT 'Programming & Development' as name, 'Code, algorithms, software development concepts' as description, '#10B981' as color
    UNION ALL
    SELECT 'AI & Machine Learning', 'Artificial intelligence, ML models, neural networks', '#8B5CF6'
    UNION ALL
    SELECT 'Business & Strategy', 'Business concepts, strategies, market insights', '#F59E0B'
    UNION ALL
    SELECT 'Personal Insights', 'Personal learnings, reflections, and discoveries', '#EF4444'
    UNION ALL
    SELECT 'Research & Documentation', 'Research findings, documentation, references', '#3B82F6'
) cluster
CROSS JOIN (SELECT id FROM users ORDER BY id LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM knowledge_clusters WHERE name = cluster.name);

-- ✅ Knowledge Hub database schema created