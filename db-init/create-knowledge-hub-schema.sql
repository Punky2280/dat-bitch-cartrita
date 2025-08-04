-- AI Knowledge Hub Database Schema with pgvector support
-- Creates tables for document storage, vector embeddings, and knowledge management

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge collections (categories/folders for organizing documents)
CREATE TABLE IF NOT EXISTS knowledge_collections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for UI
    icon VARCHAR(50) DEFAULT '📚',
    is_public BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Knowledge documents (individual documents/files)
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id SERIAL PRIMARY KEY,
    collection_id INTEGER REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    document_type VARCHAR(50) DEFAULT 'text', -- text, pdf, markdown, html, code
    file_path VARCHAR(1000), -- Original file path if uploaded
    file_size INTEGER,
    mime_type VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    tags TEXT[], -- Array of tags
    metadata JSONB DEFAULT '{}',
    content_hash VARCHAR(64), -- SHA-256 hash for deduplication
    word_count INTEGER,
    is_processed BOOLEAN DEFAULT false,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document chunks for RAG (Retrieval Augmented Generation)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL, -- Order within document
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-ada-002 dimensions
    word_count INTEGER,
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge search history and analytics
CREATE TABLE IF NOT EXISTS knowledge_searches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    search_type VARCHAR(50) DEFAULT 'semantic', -- semantic, keyword, hybrid
    filters JSONB DEFAULT '{}',
    results_count INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge search results (for analytics and improvement)
CREATE TABLE IF NOT EXISTS knowledge_search_results (
    id SERIAL PRIMARY KEY,
    search_id INTEGER NOT NULL REFERENCES knowledge_searches(id) ON DELETE CASCADE,
    chunk_id INTEGER NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
    similarity_score REAL,
    rank_position INTEGER,
    was_clicked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge conversations (AI chat about documents)
CREATE TABLE IF NOT EXISTS knowledge_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    context_document_ids INTEGER[],
    conversation_data JSONB, -- Messages, context, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_collections_user ON knowledge_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_collection ON knowledge_documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_user ON knowledge_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_type ON knowledge_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status ON knowledge_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_hash ON knowledge_documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_searches_user ON knowledge_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_search_results_search ON knowledge_search_results(search_id);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content_fts ON knowledge_documents 
USING gin(to_tsvector('english', title || ' ' || content));

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content_fts ON knowledge_chunks 
USING gin(to_tsvector('english', content));

-- Update triggers
CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_collections_updated_at 
    BEFORE UPDATE ON knowledge_collections
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

CREATE TRIGGER update_knowledge_documents_updated_at 
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

CREATE TRIGGER update_knowledge_conversations_updated_at 
    BEFORE UPDATE ON knowledge_conversations
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_updated_at();

COMMIT;