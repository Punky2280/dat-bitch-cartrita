-- Optimize vector search with advanced indexing
-- Creates performance indexes only when sufficient data exists

DO $$
DECLARE
    cnt BIGINT;
    hnsw_supported BOOLEAN;
    ivfflat_exists BOOLEAN;
    hnsw_exists BOOLEAN;
BEGIN
    -- Check row count
    SELECT COUNT(*) INTO cnt FROM embeddings;
    
    -- Check if HNSW is supported (pgvector >= 0.5.0)
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'vector_l2_ops' 
        AND pronargs = 0
    ) INTO hnsw_supported;
    
    -- Check existing indexes
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'embeddings_vector_ivfflat_idx'
    ) INTO ivfflat_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'embeddings_vector_hnsw_idx'
    ) INTO hnsw_exists;
    
    -- Create appropriate indexes based on row count and capabilities
    IF cnt > 1000 THEN
        -- For larger datasets, prefer HNSW if available, otherwise IVFFlat
        IF hnsw_supported AND NOT hnsw_exists THEN
            CREATE INDEX CONCURRENTLY IF NOT EXISTS embeddings_vector_hnsw_idx 
            ON embeddings USING hnsw (embedding vector_cosine_ops) 
            WITH (m = 16, ef_construction = 64);
            
            -- Drop IVFFlat if HNSW created successfully
            IF ivfflat_exists THEN
                DROP INDEX IF EXISTS embeddings_vector_ivfflat_idx;
            END IF;
            
        ELSIF NOT ivfflat_exists AND NOT hnsw_exists THEN
            -- Fallback to IVFFlat
            CREATE INDEX CONCURRENTLY IF NOT EXISTS embeddings_vector_ivfflat_idx 
            ON embeddings USING ivfflat (embedding vector_cosine_ops) 
            WITH (lists = GREATEST(LEAST(cnt / 100, 1000), 10));
        END IF;
        
        -- Update statistics
        ANALYZE embeddings;
        
    END IF;
END;
$$;

-- Create function to rebuild vector indexes when needed
CREATE OR REPLACE FUNCTION rebuild_vector_indexes() 
RETURNS TEXT AS $$
DECLARE
    cnt BIGINT;
    result TEXT := 'Vector indexes rebuild: ';
BEGIN
    SELECT COUNT(*) INTO cnt FROM embeddings;
    
    -- Drop existing indexes
    DROP INDEX IF EXISTS embeddings_vector_cosine_idx;
    DROP INDEX IF EXISTS embeddings_vector_ivfflat_idx;
    DROP INDEX IF EXISTS embeddings_vector_hnsw_idx;
    
    -- Recreate based on current row count
    IF cnt > 1000 THEN
        -- Try HNSW first
        BEGIN
            CREATE INDEX embeddings_vector_hnsw_idx 
            ON embeddings USING hnsw (embedding vector_cosine_ops) 
            WITH (m = 16, ef_construction = 64);
            result := result || 'HNSW index created for ' || cnt || ' vectors';
        EXCEPTION WHEN OTHERS THEN
            -- Fallback to IVFFlat
            CREATE INDEX embeddings_vector_ivfflat_idx 
            ON embeddings USING ivfflat (embedding vector_cosine_ops) 
            WITH (lists = GREATEST(LEAST(cnt / 100, 1000), 10));
            result := result || 'IVFFlat index created for ' || cnt || ' vectors';
        END;
    ELSE
        result := result || 'No index needed (' || cnt || ' vectors < 1000 threshold)';
    END IF;
    
    ANALYZE embeddings;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add monitoring view for vector search performance
CREATE OR REPLACE VIEW vector_search_stats AS
SELECT 
    source_table,
    COUNT(*) as embedding_count,
    AVG(array_length(string_to_array(embedding::text, ','), 1)) as avg_dimension,
    MIN(created_at) as oldest_embedding,
    MAX(created_at) as newest_embedding,
    COUNT(DISTINCT embedding_model) as model_count
FROM embeddings
GROUP BY source_table
ORDER BY embedding_count DESC;

-- Grant access to view
GRANT SELECT ON vector_search_stats TO robert;