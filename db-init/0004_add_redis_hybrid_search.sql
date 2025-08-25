-- Add Redis integration and caching support for v2 architecture
-- Creates tables for Redis session management and cache invalidation

-- Redis session tracking (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS redis_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_key VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    data_type VARCHAR(100) NOT NULL, -- 'chat', 'workflow', 'cache', etc.
    ttl_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Cache invalidation log
CREATE TABLE IF NOT EXISTS cache_invalidation_log (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) NOT NULL,
    cache_namespace VARCHAR(100) NOT NULL,
    invalidation_reason VARCHAR(255),
    invalidated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Hybrid retrieval configuration
CREATE TABLE IF NOT EXISTS retrieval_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    config_name VARCHAR(255) NOT NULL,
    vector_weight FLOAT DEFAULT 0.7 CHECK (vector_weight >= 0 AND vector_weight <= 1),
    keyword_weight FLOAT DEFAULT 0.3 CHECK (keyword_weight >= 0 AND keyword_weight <= 1),
    rerank_enabled BOOLEAN DEFAULT true,
    max_results INTEGER DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.7,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_weights CHECK (vector_weight + keyword_weight = 1.0)
);

-- Performance metrics for hybrid search
CREATE TABLE IF NOT EXISTS search_performance_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query_text TEXT,
    search_type VARCHAR(50), -- 'vector', 'keyword', 'hybrid'
    result_count INTEGER,
    execution_time_ms INTEGER,
    cache_hit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add full-text search columns to knowledge_entries for hybrid retrieval
ALTER TABLE knowledge_entries 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_fts 
ON knowledge_entries USING gin(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
DROP TRIGGER IF EXISTS knowledge_entries_search_vector_update ON knowledge_entries;
CREATE TRIGGER knowledge_entries_search_vector_update
    BEFORE INSERT OR UPDATE ON knowledge_entries
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Update existing records
UPDATE knowledge_entries 
SET search_vector = 
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
WHERE search_vector IS NULL;

-- Hybrid search function combining vector and keyword search
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector(1536) DEFAULT NULL,
    vector_weight FLOAT DEFAULT 0.7,
    keyword_weight FLOAT DEFAULT 0.3,
    similarity_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    user_id_filter INT DEFAULT NULL
) RETURNS TABLE (
    id INTEGER,
    title VARCHAR(255),
    content TEXT,
    hybrid_score FLOAT,
    vector_similarity FLOAT,
    keyword_rank FLOAT,
    source VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            ke.id,
            ke.title,
            ke.content,
            (1 - (e.embedding <=> query_embedding)) as similarity,
            'vector'::VARCHAR(50) as source
        FROM knowledge_entries ke
        JOIN embeddings e ON e.source_id::INTEGER = ke.id AND e.source_table = 'knowledge_entries'
        WHERE (user_id_filter IS NULL OR ke.user_id = user_id_filter)
            AND query_embedding IS NOT NULL
            AND (1 - (e.embedding <=> query_embedding)) > similarity_threshold
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    keyword_results AS (
        SELECT 
            ke.id,
            ke.title,
            ke.content,
            ts_rank(ke.search_vector, plainto_tsquery('english', query_text)) as rank,
            'keyword'::VARCHAR(50) as source
        FROM knowledge_entries ke
        WHERE (user_id_filter IS NULL OR ke.user_id = user_id_filter)
            AND ke.search_vector @@ plainto_tsquery('english', query_text)
        ORDER BY ts_rank(ke.search_vector, plainto_tsquery('english', query_text)) DESC
        LIMIT match_count * 2
    ),
    combined_results AS (
        SELECT 
            COALESCE(v.id, k.id) as id,
            COALESCE(v.title, k.title) as title,
            COALESCE(v.content, k.content) as content,
            COALESCE(v.similarity, 0) * vector_weight + COALESCE(k.rank, 0) * keyword_weight as hybrid_score,
            COALESCE(v.similarity, 0) as vector_similarity,
            COALESCE(k.rank, 0) as keyword_rank,
            CASE 
                WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 'hybrid'
                WHEN v.id IS NOT NULL THEN 'vector'
                ELSE 'keyword'
            END as source
        FROM vector_results v
        FULL OUTER JOIN keyword_results k ON v.id = k.id
    )
    SELECT 
        cr.id,
        cr.title,
        cr.content,
        cr.hybrid_score,
        cr.vector_similarity,
        cr.keyword_rank,
        cr.source
    FROM combined_results cr
    ORDER BY cr.hybrid_score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_redis_sessions_session_key ON redis_sessions(session_key);
CREATE INDEX IF NOT EXISTS idx_redis_sessions_user_id ON redis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_redis_sessions_expires_at ON redis_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_cache_key ON cache_invalidation_log(cache_key);
CREATE INDEX IF NOT EXISTS idx_retrieval_configs_user_id ON retrieval_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_performance_metrics_user_id ON search_performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_performance_metrics_created_at ON search_performance_metrics(created_at);

-- Insert default retrieval configuration
INSERT INTO retrieval_configs (user_id, config_name, vector_weight, keyword_weight)
SELECT id, 'default', 0.7, 0.3 
FROM users 
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL ON redis_sessions TO robert;
GRANT ALL ON cache_invalidation_log TO robert;
GRANT ALL ON retrieval_configs TO robert;
GRANT ALL ON search_performance_metrics TO robert;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO robert;