-- Add pgvector extension and enhanced vector capabilities for v2
-- This migration ensures pgvector is available and adds enhanced embedding tables

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" CASCADE;

-- Create enhanced embeddings table if not exists (extends v1 capabilities)
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_table VARCHAR(100) NOT NULL, -- 'knowledge_entries', 'documents', etc.
    source_id UUID NOT NULL,
    embedding vector(1536) NOT NULL,
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-large',
    content_hash VARCHAR(64), -- SHA256 of content for change detection
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient similarity search (conditional on row count)
DO $$
DECLARE
    cnt BIGINT;
    idx_exists BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO cnt FROM embeddings;
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'embeddings_vector_cosine_idx'
    ) INTO idx_exists;
    
    IF cnt > 100 AND NOT idx_exists THEN
        CREATE INDEX embeddings_vector_cosine_idx 
        ON embeddings USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = GREATEST(LEAST(cnt / 100, 1000), 10));
        ANALYZE embeddings;
    END IF;
END;
$$;

-- Helper function to upsert embeddings with change detection
CREATE OR REPLACE FUNCTION upsert_embedding(
    p_source_table VARCHAR(100),
    p_source_id UUID,
    p_embedding vector(1536),
    p_model VARCHAR(100) DEFAULT 'text-embedding-3-large',
    p_content_hash VARCHAR(64) DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    embedding_id UUID;
BEGIN
    -- Check if embedding exists
    SELECT id INTO embedding_id 
    FROM embeddings 
    WHERE source_table = p_source_table AND source_id = p_source_id;
    
    IF embedding_id IS NULL THEN
        -- Insert new embedding
        INSERT INTO embeddings (source_table, source_id, embedding, embedding_model, content_hash, metadata)
        VALUES (p_source_table, p_source_id, p_embedding, p_model, p_content_hash, p_metadata)
        RETURNING id INTO embedding_id;
    ELSE
        -- Update existing embedding
        UPDATE embeddings 
        SET embedding = p_embedding,
            embedding_model = p_model,
            content_hash = p_content_hash,
            metadata = p_metadata,
            updated_at = NOW()
        WHERE id = embedding_id;
    END IF;
    
    RETURN embedding_id;
END;
$$ LANGUAGE plpgsql;

-- Function for semantic similarity search
CREATE OR REPLACE FUNCTION similarity_search(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.8,
    match_count INT DEFAULT 5,
    source_filter VARCHAR(100) DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    source_table VARCHAR(100),
    source_id UUID,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.source_table,
        e.source_id,
        1 - (e.embedding <=> query_embedding) AS similarity,
        e.metadata
    FROM embeddings e
    WHERE (source_filter IS NULL OR e.source_table = source_filter)
        AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Migrate existing knowledge_entries embeddings to new table
INSERT INTO embeddings (source_table, source_id, embedding, embedding_model, created_at, updated_at)
SELECT 
    'knowledge_entries' as source_table,
    id::UUID as source_id,
    embedding,
    'text-embedding-3-large' as embedding_model,
    created_at,
    updated_at
FROM knowledge_entries 
WHERE embedding IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON embeddings(content_hash);

-- Grant permissions to application user
GRANT ALL ON embeddings TO robert;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO robert;