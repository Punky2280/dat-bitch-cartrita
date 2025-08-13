-- Fix Knowledge Hub Database Schema
-- This script creates all necessary tables and columns for the knowledge hub, RAG system, and pgvector support

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing problematic constraints and indexes if they exist
DROP INDEX IF EXISTS idx_knowledge_entries_content_embedding;
DROP INDEX IF EXISTS idx_knowledge_entries_title_embedding;
DROP INDEX IF EXISTS idx_knowledge_clusters_centroid;
DROP INDEX IF EXISTS idx_knowledge_entries_search_vector;
DROP INDEX IF EXISTS idx_knowledge_entries_importance;
DROP INDEX IF EXISTS idx_knowledge_entries_access_count;
DROP INDEX IF EXISTS idx_knowledge_relationships_source;
DROP INDEX IF EXISTS idx_knowledge_relationships_target;
DROP INDEX IF EXISTS idx_knowledge_relationships_strength;

-- Fix knowledge_entries table - add missing columns
ALTER TABLE knowledge_entries 
  ADD COLUMN IF NOT EXISTS content_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS title_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS importance_score DECIMAL(3,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS content_length INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS complexity_score DECIMAL(3,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'user_created',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES users(id);

-- Add search vector column (without generated always constraint for now)
ALTER TABLE knowledge_entries 
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector updates
DROP TRIGGER IF EXISTS update_knowledge_search_vector_trigger ON knowledge_entries;
CREATE TRIGGER update_knowledge_search_vector_trigger
  BEFORE INSERT OR UPDATE ON knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION update_knowledge_search_vector();

-- Update existing rows to have search vectors
UPDATE knowledge_entries SET 
  search_vector = setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                 setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
                 setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
WHERE search_vector IS NULL;

-- Fix knowledge_clusters table - add missing columns
ALTER TABLE knowledge_clusters 
  ADD COLUMN IF NOT EXISTS centroid_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS cluster_type VARCHAR(50) DEFAULT 'semantic',
  ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#8b5cf6',
  ADD COLUMN IF NOT EXISTS algorithm_used VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by_algorithm VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS entry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_similarity DECIMAL(3,2) DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS avg_importance DECIMAL(3,2) DEFAULT 0.5;

-- Fix knowledge_relationships table - add missing columns
ALTER TABLE knowledge_relationships 
  ADD COLUMN IF NOT EXISTS source_entry_id INTEGER REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_entry_id INTEGER REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS strength DECIMAL(3,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2) DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS semantic_similarity DECIMAL(3,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS discovery_method VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS discovered_by VARCHAR(50) DEFAULT 'user';

-- Create knowledge_documents table if it doesn't exist (referenced by foreign keys)
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    file_path VARCHAR(1000),
    file_type VARCHAR(50),
    file_size INTEGER,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending',
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create knowledge_analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS knowledge_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_entries INTEGER DEFAULT 0,
    new_entries INTEGER DEFAULT 0,
    total_relationships INTEGER DEFAULT 0,
    avg_relationships_per_entry DECIMAL(5,2) DEFAULT 0.0,
    avg_confidence_score DECIMAL(3,2) DEFAULT 0.0,
    high_confidence_entries INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create multi_modal_processing_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS multi_modal_processing_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    processing_status VARCHAR(50) DEFAULT 'pending',
    model_used VARCHAR(100),
    processing_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Add missing columns to users table for roles
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate source_document_id and target_document_id to entry references
UPDATE knowledge_relationships 
SET source_entry_id = source_document_id,
    target_entry_id = target_document_id
WHERE source_entry_id IS NULL AND source_document_id IS NOT NULL;

-- Create optimized indexes for vector operations (using hnsw for better performance)
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content_embedding 
  ON knowledge_entries USING hnsw (content_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_title_embedding 
  ON knowledge_entries USING hnsw (title_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_centroid 
  ON knowledge_clusters USING hnsw (centroid_embedding vector_cosine_ops);

-- Create text search indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_search_vector 
  ON knowledge_entries USING gin(search_vector);

-- Create regular indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_user_id 
  ON knowledge_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category 
  ON knowledge_entries(category);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_importance 
  ON knowledge_entries(importance_score DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_access_count 
  ON knowledge_entries(access_count DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_created_at 
  ON knowledge_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source 
  ON knowledge_relationships(source_entry_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_target 
  ON knowledge_relationships(target_entry_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_strength 
  ON knowledge_relationships(strength DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_user_id 
  ON knowledge_clusters(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_user_id 
  ON knowledge_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status 
  ON knowledge_documents(status);

-- Create function to update cluster entry counts
CREATE OR REPLACE FUNCTION update_cluster_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE knowledge_clusters 
    SET entry_count = entry_count + 1,
        updated_at = NOW()
    WHERE id = NEW.cluster_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE knowledge_clusters 
    SET entry_count = GREATEST(entry_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.cluster_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cluster entry count updates
DROP TRIGGER IF EXISTS update_cluster_entry_count_trigger ON knowledge_entry_clusters;
CREATE TRIGGER update_cluster_entry_count_trigger
  AFTER INSERT OR DELETE ON knowledge_entry_clusters
  FOR EACH ROW EXECUTE FUNCTION update_cluster_entry_count();

-- Insert default user roles
INSERT INTO user_roles (name, display_name, description, permissions) VALUES
('admin', 'Administrator', 'Full system access', ARRAY['*']),
('user', 'Standard User', 'Basic user access', ARRAY['read:own', 'write:own']),
('moderator', 'Moderator', 'Content moderation access', ARRAY['read:*', 'moderate:content'])
ON CONFLICT (name) DO NOTHING;

-- Update existing users to have default role
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Update cluster entry counts based on existing data
UPDATE knowledge_clusters 
SET entry_count = (
    SELECT COUNT(*) 
    FROM knowledge_entry_clusters 
    WHERE cluster_id = knowledge_clusters.id
),
avg_importance = (
    SELECT COALESCE(AVG(ke.importance_score), 0.5)
    FROM knowledge_entries ke 
    JOIN knowledge_entry_clusters kec ON ke.id = kec.entry_id 
    WHERE kec.cluster_id = knowledge_clusters.id
);

-- Create sample knowledge entries for testing (only if none exist)
INSERT INTO knowledge_entries (
    user_id, title, content, content_type, category, tags, 
    importance_score, source_type, author_id
) 
SELECT 
    3, 'Unified AI Inference System', 
    'The unified AI inference system provides a single interface to multiple AI providers through HuggingFace tokens. It includes fallback mechanisms, circuit breakers, caching, and comprehensive metrics. The system supports 9 task families including chat, embeddings, image generation, and NLP tasks.',
    'text', 'ai', ARRAY['ai', 'inference', 'huggingface', 'unified'], 
    0.95, 'system_generated', 3
WHERE NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE title = 'Unified AI Inference System');

INSERT INTO knowledge_entries (
    user_id, title, content, content_type, category, tags,
    importance_score, source_type, author_id
)
SELECT 
    3, 'Database Schema Management',
    'The application uses PostgreSQL with pgvector extension for vector operations. The database includes tables for users, knowledge entries, clusters, relationships, and analytics. Vector embeddings are stored using 1536-dimensional vectors with HNSW indexing for optimal performance.',
    'text', 'database', ARRAY['postgresql', 'pgvector', 'database', 'schema'],
    0.85, 'system_generated', 3
WHERE NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE title = 'Database Schema Management');

-- Create default clusters if none exist
INSERT INTO knowledge_clusters (
    user_id, name, description, cluster_type, color, algorithm_used, 
    created_by_algorithm, entry_count, min_similarity
) 
SELECT 
    3, 'AI & Machine Learning', 
    'Core AI functionality including unified inference, machine learning models, and intelligent processing',
    'semantic', '#8b5cf6', 'manual', 'system_init', 0, 0.75
WHERE NOT EXISTS (SELECT 1 FROM knowledge_clusters WHERE name = 'AI & Machine Learning');

INSERT INTO knowledge_clusters (
    user_id, name, description, cluster_type, color, algorithm_used,
    created_by_algorithm, entry_count, min_similarity
)
SELECT 
    3, 'System Infrastructure',
    'Database architecture, containerization, and infrastructure components',
    'semantic', '#06b6d4', 'manual', 'system_init', 0, 0.70
WHERE NOT EXISTS (SELECT 1 FROM knowledge_clusters WHERE name = 'System Infrastructure');

-- Update analytics
INSERT INTO knowledge_analytics (
    date, total_entries, new_entries, total_relationships,
    avg_relationships_per_entry, avg_confidence_score, high_confidence_entries
) VALUES (
    CURRENT_DATE,
    (SELECT COUNT(*) FROM knowledge_entries),
    (SELECT COUNT(*) FROM knowledge_entries WHERE created_at >= CURRENT_DATE),
    (SELECT COUNT(*) FROM knowledge_relationships WHERE source_entry_id IS NOT NULL),
    (SELECT COALESCE(ROUND(AVG(rel_count), 2), 0) FROM (
        SELECT COUNT(*) as rel_count 
        FROM knowledge_relationships 
        WHERE source_entry_id IS NOT NULL
        GROUP BY source_entry_id
    ) t),
    (SELECT COALESCE(ROUND(AVG(confidence), 3), 0.8) FROM knowledge_relationships WHERE confidence IS NOT NULL),
    (SELECT COUNT(*) FROM knowledge_relationships WHERE confidence >= 0.9)
)
ON CONFLICT (date) DO UPDATE SET 
    total_entries = EXCLUDED.total_entries,
    total_relationships = EXCLUDED.total_relationships,
    avg_relationships_per_entry = EXCLUDED.avg_relationships_per_entry,
    avg_confidence_score = EXCLUDED.avg_confidence_score,
    high_confidence_entries = EXCLUDED.high_confidence_entries;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO robert;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO robert;

-- Create function to fix ambiguous user_id references in queries
CREATE OR REPLACE FUNCTION fix_knowledge_queries() RETURNS TEXT AS $$
BEGIN
    -- This function exists to document the query fixes needed
    -- The actual fixes need to be made in the application code:
    -- Change "WHERE user_id = $1" to "WHERE ke.user_id = $1" in knowledge entry queries
    RETURN 'Knowledge query fixes documented - update application code to use table aliases';
END;
$$ LANGUAGE plpgsql;

SELECT fix_knowledge_queries();