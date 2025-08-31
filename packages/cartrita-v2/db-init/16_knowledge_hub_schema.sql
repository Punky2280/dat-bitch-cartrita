-- Advanced Knowledge Hub Database Schema
-- Implements Graph RAG with Vector Embeddings and Semantic Clustering

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Knowledge Entries Table (Core Content Storage)
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL DEFAULT 'text',
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    subcategory VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    -- Semantic Embeddings (OpenAI text-embedding-3-large: 3072 dimensions)
    content_embedding vector(3072),
    title_embedding vector(3072),
    
    -- Knowledge Metrics
    importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    confidence_score FLOAT DEFAULT 0.8 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    -- Content Analysis
    content_length INTEGER,
    word_count INTEGER,
    sentiment_score FLOAT, -- -1 to 1 sentiment analysis
    complexity_score FLOAT, -- Reading complexity
    
    -- Versioning and History
    version INTEGER DEFAULT 1,
    parent_entry_id INTEGER REFERENCES knowledge_entries(id),
    
    -- Metadata
    source_type VARCHAR(50), -- 'user_created', 'imported', 'ai_generated', 'web_scraped'
    source_url TEXT,
    author_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
    ) STORED
);

-- Knowledge Clusters Table (AI-Generated Knowledge Groups)
CREATE TABLE IF NOT EXISTS knowledge_clusters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    cluster_type VARCHAR(50) DEFAULT 'semantic', -- 'semantic', 'topical', 'hierarchical'
    
    -- Cluster Properties
    centroid_embedding vector(3072), -- Average embedding of cluster members
    color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for visualization
    size_score FLOAT DEFAULT 1.0, -- Visual size in graph
    cohesion_score FLOAT, -- How tightly clustered (0-1)
    
    -- Clustering Algorithm Metadata
    algorithm_used VARCHAR(50), -- 'kmeans', 'hierarchical', 'dbscan'
    algorithm_params JSONB,
    min_similarity FLOAT DEFAULT 0.7,
    
    -- Auto-management
    auto_update BOOLEAN DEFAULT TRUE,
    last_clustered_at TIMESTAMP WITH TIME ZONE,
    
    -- Hierarchy Support
    parent_cluster_id INTEGER REFERENCES knowledge_clusters(id),
    depth_level INTEGER DEFAULT 0,
    
    -- Statistics
    entry_count INTEGER DEFAULT 0,
    avg_importance FLOAT,
    total_access_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_by_algorithm VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Entry-Cluster Relationships (Many-to-Many with Weights)
CREATE TABLE IF NOT EXISTS knowledge_entry_clusters (
    entry_id INTEGER REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    cluster_id INTEGER REFERENCES knowledge_clusters(id) ON DELETE CASCADE,
    membership_strength FLOAT DEFAULT 1.0 CHECK (membership_strength >= 0 AND membership_strength <= 1),
    similarity_score FLOAT, -- Cosine similarity to cluster centroid
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by VARCHAR(50) DEFAULT 'algorithm', -- 'algorithm', 'manual', 'ai_suggestion'
    
    PRIMARY KEY (entry_id, cluster_id)
);

-- Knowledge Graph Edges (Relationships between Entries)
CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id SERIAL PRIMARY KEY,
    source_entry_id INTEGER REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    target_entry_id INTEGER REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    
    -- Relationship Properties
    relationship_type VARCHAR(100), -- 'similar_to', 'references', 'contradicts', 'builds_upon', 'example_of'
    strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    confidence FLOAT DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Semantic Analysis
    semantic_similarity FLOAT, -- Cosine similarity between embeddings
    topic_overlap FLOAT, -- How much topics overlap
    entity_overlap INTEGER DEFAULT 0, -- Number of shared entities/keywords
    
    -- Relationship Discovery
    discovered_by VARCHAR(50) DEFAULT 'algorithm', -- 'algorithm', 'manual', 'ai_analysis'
    discovery_method VARCHAR(100), -- 'embedding_similarity', 'topic_modeling', 'entity_extraction'
    algorithm_confidence FLOAT,
    
    -- Bidirectional support
    is_bidirectional BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    validated_at TIMESTAMP WITH TIME ZONE,
    validated_by INTEGER REFERENCES users(id),
    
    -- Prevent self-references and duplicates
    CHECK (source_entry_id != target_entry_id),
    UNIQUE(source_entry_id, target_entry_id)
);

-- Knowledge Topics (LDA/BERTopic Results)
CREATE TABLE IF NOT EXISTS knowledge_topics (
    id SERIAL PRIMARY KEY,
    topic_number INTEGER,
    name VARCHAR(200),
    keywords TEXT[],
    top_words TEXT[],
    
    -- Topic Modeling Results
    coherence_score FLOAT,
    prevalence_score FLOAT, -- How common this topic is
    topic_embedding vector(3072),
    
    -- Algorithm Details
    algorithm_used VARCHAR(50), -- 'lda', 'bertopic', 'nmf'
    num_topics INTEGER,
    model_version VARCHAR(50),
    
    -- Statistics
    document_count INTEGER DEFAULT 0,
    avg_document_length FLOAT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entry-Topic Associations
CREATE TABLE IF NOT EXISTS knowledge_entry_topics (
    entry_id INTEGER REFERENCES knowledge_entries(id) ON DELETE CASCADE,
    topic_id INTEGER REFERENCES knowledge_topics(id) ON DELETE CASCADE,
    topic_weight FLOAT CHECK (topic_weight >= 0 AND topic_weight <= 1),
    
    PRIMARY KEY (entry_id, topic_id)
);

-- Knowledge Search Sessions (Track Search Analytics)
CREATE TABLE IF NOT EXISTS knowledge_search_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(100),
    
    -- Search Parameters
    query_text TEXT NOT NULL,
    query_type VARCHAR(50) DEFAULT 'semantic', -- 'semantic', 'fulltext', 'hybrid'
    search_method VARCHAR(50), -- 'embedding_similarity', 'graph_traversal', 'hybrid'
    
    -- Results
    result_count INTEGER DEFAULT 0,
    results_clicked INTEGER DEFAULT 0,
    avg_similarity_score FLOAT,
    search_duration_ms INTEGER,
    
    -- User Feedback
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
    found_relevant BOOLEAN,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Analytics (Aggregated Metrics)
CREATE TABLE IF NOT EXISTS knowledge_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    
    -- Content Metrics
    total_entries INTEGER DEFAULT 0,
    new_entries INTEGER DEFAULT 0,
    updated_entries INTEGER DEFAULT 0,
    deleted_entries INTEGER DEFAULT 0,
    
    -- Engagement Metrics
    total_searches INTEGER DEFAULT 0,
    avg_search_results INTEGER DEFAULT 0,
    avg_user_satisfaction FLOAT,
    
    -- Graph Metrics
    total_relationships INTEGER DEFAULT 0,
    avg_relationships_per_entry FLOAT,
    graph_density FLOAT,
    clustering_coefficient FLOAT,
    
    -- Quality Metrics
    avg_confidence_score FLOAT,
    high_confidence_entries INTEGER DEFAULT 0,
    orphaned_entries INTEGER DEFAULT 0, -- Entries with no relationships
    
    -- Performance Metrics
    avg_search_time_ms FLOAT,
    avg_embedding_time_ms FLOAT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content_embedding ON knowledge_entries USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_title_embedding ON knowledge_entries USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_centroid ON knowledge_clusters USING ivfflat (centroid_embedding vector_cosine_ops) WITH (lists = 50);

-- Traditional indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_search_vector ON knowledge_entries USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content_type ON knowledge_entries(content_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_tags ON knowledge_entries USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_created_at ON knowledge_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_importance ON knowledge_entries(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_access_count ON knowledge_entries(access_count DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source ON knowledge_relationships(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_target ON knowledge_relationships(target_entry_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_type ON knowledge_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_strength ON knowledge_relationships(strength DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_entry_clusters_entry ON knowledge_entry_clusters(entry_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entry_clusters_cluster ON knowledge_entry_clusters(cluster_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_entry_clusters_strength ON knowledge_entry_clusters(membership_strength DESC);

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_knowledge_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_knowledge_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update cluster entry counts when entries are added/removed
    IF TG_OP = 'INSERT' THEN
        UPDATE knowledge_clusters 
        SET entry_count = entry_count + 1,
            updated_at = NOW()
        WHERE id = NEW.cluster_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE knowledge_clusters 
        SET entry_count = entry_count - 1,
            updated_at = NOW()
        WHERE id = OLD.cluster_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_knowledge_entries_updated_at ON knowledge_entries;
CREATE TRIGGER update_knowledge_entries_updated_at
    BEFORE UPDATE ON knowledge_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_entry_updated_at();

DROP TRIGGER IF EXISTS update_cluster_counts ON knowledge_entry_clusters;
CREATE TRIGGER update_cluster_counts
    AFTER INSERT OR DELETE ON knowledge_entry_clusters
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_analytics();

-- Initial seed data for project context
INSERT INTO knowledge_entries (title, content, content_type, category, tags, importance_score, source_type, author_id) VALUES
('Cartrita AI Platform Overview', 'Cartrita is an advanced AI platform featuring multi-agent orchestration, HuggingFace integration, RAG pipelines, and knowledge management. The system includes real-time chat, ambient voice processing, and comprehensive analytics.', 'text', 'ai', ARRAY['ai', 'platform', 'cartrita', 'multi-agent'], 0.9, 'user_created', 3),

('HuggingFace Integration', 'The platform integrates with HuggingFace Inference Providers API for chat completion, text-to-image generation, speech-to-text, and embeddings creation. Uses models like DeepSeek V3, FLUX.1, and Whisper.', 'text', 'ai', ARRAY['huggingface', 'api', 'integration', 'models'], 0.8, 'user_created', 3),

('RAG Pipeline Implementation', 'Advanced RAG (Retrieval-Augmented Generation) pipeline with document processing, confidence scoring, source attribution, and metadata tracking. Supports 50MB file uploads and multiple document formats.', 'text', 'ai', ARRAY['rag', 'retrieval', 'generation', 'documents'], 0.9, 'user_created', 3),

('Multi-Agent Architecture', 'Hierarchical multi-agent system with specialized agents for coding, research, art, writing, scheduling, and analytics. Includes 45 registered tools across 14 categories with intelligent orchestration.', 'text', 'ai', ARRAY['multi-agent', 'orchestration', 'specialized-agents'], 0.9, 'user_created', 3),

('Ambient Voice Processing', 'Real-time voice activity detection and wake word processing with WebSocket communication. Includes spectral centroid analysis and intelligent voice command recognition.', 'text', 'ai', ARRAY['voice', 'ambient', 'real-time', 'processing'], 0.7, 'user_created', 3),

('Database Architecture', 'PostgreSQL-based system with user management, chat history, API key vault, and now knowledge graph storage. Supports vector embeddings and advanced analytics.', 'text', 'database', ARRAY['postgresql', 'database', 'architecture', 'vector'], 0.8, 'user_created', 3),

('Frontend Development', 'React TypeScript frontend with responsive design, real-time updates, and comprehensive UI components. Features glass morphism design and advanced theme customization.', 'text', 'frontend', ARRAY['react', 'typescript', 'ui', 'responsive'], 0.7, 'user_created', 3),

('API Security', 'JWT-based authentication with role-based access control, API key management with auto-rotation, and encrypted credential storage. Implements comprehensive security best practices.', 'text', 'security', ARRAY['jwt', 'authentication', 'security', 'encryption'], 0.8, 'user_created', 3)

ON CONFLICT DO NOTHING;

-- Create initial clusters for project data
INSERT INTO knowledge_clusters (name, description, cluster_type, color, algorithm_used) VALUES
('AI & Machine Learning', 'Core AI functionality including agents, models, and processing capabilities', 'semantic', '#8b5cf6', 'manual'),
('System Architecture', 'Infrastructure, databases, and backend architecture components', 'semantic', '#06b6d4', 'manual'),
('User Interface', 'Frontend development, UI/UX, and user interaction components', 'semantic', '#10b981', 'manual'),
('Security & Authentication', 'Security measures, authentication, and data protection', 'semantic', '#f59e0b', 'manual')

ON CONFLICT DO NOTHING;

-- Associate entries with clusters
INSERT INTO knowledge_entry_clusters (entry_id, cluster_id, membership_strength, assigned_by) VALUES
(1, 1, 1.0, 'manual'), -- Cartrita Platform -> AI & ML
(2, 1, 0.9, 'manual'), -- HuggingFace -> AI & ML
(3, 1, 0.9, 'manual'), -- RAG Pipeline -> AI & ML
(4, 1, 1.0, 'manual'), -- Multi-Agent -> AI & ML
(5, 1, 0.8, 'manual'), -- Ambient Voice -> AI & ML
(6, 2, 1.0, 'manual'), -- Database -> System Architecture
(7, 3, 1.0, 'manual'), -- Frontend -> User Interface
(8, 4, 1.0, 'manual')  -- API Security -> Security

ON CONFLICT DO NOTHING;

COMMENT ON TABLE knowledge_entries IS 'Core knowledge storage with vector embeddings for semantic search';
COMMENT ON TABLE knowledge_clusters IS 'AI-generated knowledge clusters for organization and visualization';
COMMENT ON TABLE knowledge_relationships IS 'Graph relationships between knowledge entries';
COMMENT ON TABLE knowledge_topics IS 'Topic modeling results for thematic organization';
COMMENT ON TABLE knowledge_search_sessions IS 'Search analytics and user behavior tracking';
COMMENT ON TABLE knowledge_analytics IS 'Daily aggregated metrics for knowledge system performance';