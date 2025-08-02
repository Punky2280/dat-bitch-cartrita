-- Database initialization script for Dat Bitch Cartrita
-- This script creates all necessary tables and extensions

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_settings table with all required columns
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    sarcasm INTEGER DEFAULT 5 CHECK (sarcasm >= 1 AND sarcasm <= 10),
    verbosity VARCHAR(20) DEFAULT 'normal' CHECK (verbosity IN ('concise', 'normal', 'detailed')),
    humor VARCHAR(20) DEFAULT 'playful' CHECK (humor IN ('none', 'dry', 'playful', 'sarcastic')),
    theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
    language VARCHAR(10) DEFAULT 'en',
    voice_responses BOOLEAN DEFAULT true,
    ambient_listening BOOLEAN DEFAULT false,
    sound_effects BOOLEAN DEFAULT true,
    camera_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create knowledge_entries table with vector support
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(255),
    entry_type VARCHAR(50) DEFAULT 'note',
    tags TEXT[],
    embedding vector(1536), -- OpenAI ada-002 embedding dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create knowledge_clusters table with color column
CREATE TABLE IF NOT EXISTS knowledge_clusters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#4A90E2', -- Hex color code with default blue
    cluster_vector vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create knowledge_cluster_entries with similarity_score (not relevance_score)
CREATE TABLE IF NOT EXISTS knowledge_cluster_entries (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER REFERENCES knowledge_clusters(id) ON DELETE CASCADE,
    entry_id INTEGER REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    similarity_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cluster_id, entry_id)
);

-- Create memory_sessions table
CREATE TABLE IF NOT EXISTS memory_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255) NOT NULL,
    context_query TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create memory_session_results table
CREATE TABLE IF NOT EXISTS memory_session_results (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES memory_sessions(id) ON DELETE CASCADE,
    entry_id INTEGER REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    similarity_score FLOAT DEFAULT 0.0, -- Using similarity_score consistently
    rank_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user_id ON knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding ON knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_created_at ON knowledge_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_user_id ON knowledge_clusters(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_cluster_vector ON knowledge_clusters USING ivfflat (cluster_vector vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_entries_cluster_id ON knowledge_cluster_entries(cluster_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_entries_entry_id ON knowledge_cluster_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_entries_similarity ON knowledge_cluster_entries(similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_memory_sessions_user_id ON memory_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_session_results_session_id ON memory_session_results(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_session_results_similarity ON memory_session_results(similarity_score DESC);

-- Create helper function for vector similarity
CREATE OR REPLACE FUNCTION vector_similarity(vector1 vector, vector2 vector, similarity_type text DEFAULT 'cosine')
RETURNS float AS $$
BEGIN
    CASE similarity_type
        WHEN 'cosine' THEN
            RETURN 1 - (vector1 <=> vector2);
        WHEN 'l2' THEN  
            RETURN 1 / (1 + (vector1 <-> vector2));
        WHEN 'inner_product' THEN
            RETURN vector1 <#> vector2;
        ELSE
            RETURN 1 - (vector1 <=> vector2); -- Default to cosine
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add table comments for documentation
COMMENT ON TABLE knowledge_entries IS 'Stores user knowledge entries with vector embeddings for semantic search';
COMMENT ON TABLE knowledge_clusters IS 'Groups related knowledge entries into clusters with color coding';
COMMENT ON TABLE knowledge_cluster_entries IS 'Junction table linking entries to clusters with similarity scores';
COMMENT ON TABLE memory_sessions IS 'Tracks memory retrieval sessions for context management';
COMMENT ON TABLE memory_session_results IS 'Stores ranked results from memory sessions';

COMMENT ON COLUMN knowledge_entries.embedding IS 'Vector embedding for semantic similarity search';
COMMENT ON COLUMN knowledge_clusters.color IS 'Hex color code for visual cluster representation';
COMMENT ON COLUMN knowledge_cluster_entries.similarity_score IS 'Cosine similarity score between entry and cluster';
COMMENT ON COLUMN user_settings.camera_enabled IS 'Whether camera access is enabled for multi-modal features';

-- Create views for easier querying
CREATE OR REPLACE VIEW knowledge_clusters_with_stats AS
SELECT 
    kc.*,
    COUNT(kce.entry_id) as entry_count,
    AVG(kce.similarity_score) as avg_similarity,
    MAX(kce.similarity_score) as max_similarity
FROM knowledge_clusters kc
LEFT JOIN knowledge_cluster_entries kce ON kc.id = kce.cluster_id
GROUP BY kc.id;

-- Update sequences if needed
SELECT setval('users_id_seq', COALESCE(MAX(id), 1)) FROM users;
SELECT setval('knowledge_entries_id_seq', COALESCE(MAX(id), 1)) FROM knowledge_entries;
SELECT setval('knowledge_clusters_id_seq', COALESCE(MAX(id), 1)) FROM knowledge_clusters;

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema initialized successfully with pgvector support';
    RAISE NOTICE '📊 Tables created: users, user_settings, knowledge_entries, knowledge_clusters, knowledge_cluster_entries, memory_sessions, memory_session_results';
    RAISE NOTICE '🔍 Indexes created for optimal vector search performance';
    RAISE NOTICE '🎨 Color support added to knowledge clusters';
    RAISE NOTICE '📹 Camera permissions added to user settings';
END $$;