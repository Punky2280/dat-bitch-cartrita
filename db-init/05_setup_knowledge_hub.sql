-- =====================================================
-- AI KNOWLEDGE HUB & MEMORY PALACE - Database Schema
-- =====================================================

-- This is the single source of truth for all knowledge-related tables.

-- Create a function to automatically update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Table: knowledge_entries
-- Stores individual pieces of knowledge
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
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

-- -----------------------------------------------------
-- Table: knowledge_clusters
-- Semantic groupings of related knowledge
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_clusters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#4A90E2', -- Hex color code for visual representation
    cluster_embedding VECTOR(1536), -- Centroid embedding of cluster
    entry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: knowledge_cluster_entries
-- Junction table for knowledge entries in clusters
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_cluster_entries (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER NOT NULL REFERENCES knowledge_clusters(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cluster_id, entry_id)
);

-- -----------------------------------------------------
-- Table: memory_sessions
-- Track how knowledge is accessed and used
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS memory_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) DEFAULT 'search', -- search, conversation, exploration
    query TEXT,
    query_embedding VECTOR(1536),
    results_count INTEGER DEFAULT 0,
    avg_similarity DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- INDEXES FOR PERFORMANCE
-- -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user_id ON knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_tags ON knowledge_entries USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_user_id ON knowledge_clusters(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_entries_cluster_id ON knowledge_cluster_entries(cluster_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_cluster_entries_entry_id ON knowledge_cluster_entries(entry_id);

CREATE INDEX IF NOT EXISTS idx_memory_sessions_user_id ON memory_sessions(user_id);

-- -----------------------------------------------------
-- VECTOR INDEXES FOR SIMILARITY SEARCH (pgvector)
-- -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding ON knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_embedding ON knowledge_clusters USING ivfflat (cluster_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_memory_sessions_embedding ON memory_sessions USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100);

-- -----------------------------------------------------
-- TRIGGERS FOR 'updated_at' TIMESTAMPS
-- -----------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_knowledge_entries') THEN
        CREATE TRIGGER set_timestamp_knowledge_entries BEFORE UPDATE ON knowledge_entries
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_knowledge_clusters') THEN
        CREATE TRIGGER set_timestamp_knowledge_clusters BEFORE UPDATE ON knowledge_clusters
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END
$$;

-- -----------------------------------------------------
-- UTILITY FUNCTIONS
-- -----------------------------------------------------
-- Function to calculate vector similarity
CREATE OR REPLACE FUNCTION vector_similarity(embedding1 vector, embedding2 vector, metric text DEFAULT 'cosine')
RETURNS DECIMAL AS $$
BEGIN
  CASE metric
    WHEN 'cosine' THEN
      RETURN 1 - (embedding1 <=> embedding2);
    WHEN 'euclidean' THEN  
      RETURN 1 / (1 + (embedding1 <-> embedding2));
    WHEN 'inner_product' THEN
      RETURN embedding1 <#> embedding2;
    ELSE
      RETURN 1 - (embedding1 <=> embedding2); -- Default to cosine
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update cluster centroids
CREATE OR REPLACE FUNCTION update_cluster_centroid(cluster_id_param INTEGER)
RETURNS void AS $$
DECLARE
  avg_embedding vector(1536);
  entry_count_var INTEGER;
BEGIN
  SELECT AVG(ke.embedding), COUNT(*)
  INTO avg_embedding, entry_count_var
  FROM knowledge_entries ke
  JOIN knowledge_cluster_entries kce ON ke.id = kce.entry_id
  WHERE kce.cluster_id = cluster_id_param;
  
  UPDATE knowledge_clusters 
  SET cluster_embedding = avg_embedding, entry_count = entry_count_var, updated_at = NOW()
  WHERE id = cluster_id_param;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- OPTIMIZED VIEWS
-- -----------------------------------------------------
CREATE OR REPLACE VIEW knowledge_search_view AS
SELECT 
  ke.*,
  array_agg(DISTINCT kc.name) FILTER (WHERE kc.name IS NOT NULL) as cluster_names
FROM knowledge_entries ke
LEFT JOIN knowledge_cluster_entries kce ON ke.id = kce.entry_id
LEFT JOIN knowledge_clusters kc ON kce.cluster_id = kc.id
GROUP BY ke.id;

-- -----------------------------------------------------
-- COMPLETION MESSAGE
-- -----------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '✅ Knowledge Hub schema created successfully!';
END $$;