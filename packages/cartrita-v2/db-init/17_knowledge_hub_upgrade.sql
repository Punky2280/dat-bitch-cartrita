-- Knowledge Hub Schema Upgrade
-- Add missing columns to existing tables and create new functionality

-- Upgrade knowledge_entries table
ALTER TABLE knowledge_entries 
ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100),
ADD COLUMN IF NOT EXISTS content_embedding vector(3072),
ADD COLUMN IF NOT EXISTS title_embedding vector(3072),
ADD COLUMN IF NOT EXISTS importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS content_length INTEGER,
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS sentiment_score FLOAT,
ADD COLUMN IF NOT EXISTS complexity_score FLOAT,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_entry_id INTEGER REFERENCES knowledge_entries(id),
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'user_created',
ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES users(id);

-- Add full-text search column (if it doesn't exist)
ALTER TABLE knowledge_entries 
ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
) STORED;

-- Upgrade knowledge_clusters table
ALTER TABLE knowledge_clusters 
ADD COLUMN IF NOT EXISTS cluster_type VARCHAR(50) DEFAULT 'semantic',
ADD COLUMN IF NOT EXISTS centroid_embedding vector(3072),
ADD COLUMN IF NOT EXISTS size_score FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS cohesion_score FLOAT,
ADD COLUMN IF NOT EXISTS algorithm_used VARCHAR(50),
ADD COLUMN IF NOT EXISTS algorithm_params JSONB,
ADD COLUMN IF NOT EXISTS min_similarity FLOAT DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS auto_update BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_clustered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS parent_cluster_id INTEGER REFERENCES knowledge_clusters(id),
ADD COLUMN IF NOT EXISTS depth_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_importance FLOAT,
ADD COLUMN IF NOT EXISTS total_access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by_algorithm VARCHAR(100);

-- Upgrade knowledge_relationships table
ALTER TABLE knowledge_relationships 
ADD COLUMN IF NOT EXISTS semantic_similarity FLOAT,
ADD COLUMN IF NOT EXISTS topic_overlap FLOAT,
ADD COLUMN IF NOT EXISTS entity_overlap INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS discovered_by VARCHAR(50) DEFAULT 'algorithm',
ADD COLUMN IF NOT EXISTS discovery_method VARCHAR(100),
ADD COLUMN IF NOT EXISTS algorithm_confidence FLOAT,
ADD COLUMN IF NOT EXISTS is_bidirectional BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validated_by INTEGER REFERENCES users(id);

-- Add new indexes for the upgraded columns
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content_embedding ON knowledge_entries USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_title_embedding ON knowledge_entries USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_clusters_centroid ON knowledge_clusters USING ivfflat (centroid_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_search_vector ON knowledge_entries USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_importance ON knowledge_entries(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_access_count ON knowledge_entries(access_count DESC);

-- Clear existing data and insert upgraded seed data
DELETE FROM knowledge_entry_clusters;
DELETE FROM knowledge_relationships;
DELETE FROM knowledge_clusters;
DELETE FROM knowledge_entries;

-- Insert comprehensive seed data for the project
INSERT INTO knowledge_entries (
    title, content, content_type, category, subcategory, tags, 
    importance_score, source_type, author_id, content_length, word_count
) VALUES
('Cartrita AI Platform Architecture', 'Cartrita is a revolutionary AI platform featuring hierarchical multi-agent orchestration with 29 specialized agents, real-time HuggingFace integration, advanced RAG pipelines with 50MB document support, ambient voice processing with wake word detection, and comprehensive knowledge management. The system implements Graph RAG with vector embeddings for semantic search and clustering.', 'text', 'ai', 'architecture', ARRAY['cartrita', 'ai', 'platform', 'multi-agent', 'architecture'], 1.0, 'user_created', 3, 463, 67),

('HuggingFace Router Service', 'Advanced integration with HuggingFace Inference Providers API implementing JavaScript fetch-based communication. Supports chat completion with DeepSeek V3, text-to-image generation with FLUX.1-dev, speech-to-text with Whisper, and embeddings creation. Features intelligent rate limiting with token bucket algorithm and exponential backoff retry logic.', 'text', 'ai', 'integration', ARRAY['huggingface', 'api', 'router', 'deepseek', 'flux', 'whisper'], 0.9, 'user_created', 3, 392, 55),

('RAG Pipeline Implementation', 'Production-ready Retrieval-Augmented Generation pipeline with document processing up to 50MB, confidence scoring (achieving 93.3% accuracy), source attribution, and comprehensive metadata tracking. Implements advanced pipeline with embedding models, reranking, and generation models. Supports multiple document formats with real-time processing.', 'text', 'ai', 'rag', ARRAY['rag', 'retrieval', 'generation', 'documents', 'confidence', 'metadata'], 0.95, 'user_created', 3, 389, 58),

('Multi-Agent Orchestration System', 'Hierarchical AGI system with CartritaSupervisor managing 29 specialized agents including CodeWriter, Researcher, Artist, Writer, Scheduler, TaskManager, Comedian, Analytics, Designer, and HuggingFace bridge agents. Features 45 registered tools across 14 categories with intelligent delegation and real-time orchestration.', 'text', 'ai', 'agents', ARRAY['multi-agent', 'orchestration', 'agi', 'specialized-agents', 'supervisor'], 1.0, 'user_created', 3, 427, 62),

('Ambient Voice Processing Engine', 'Real-time voice activity detection and wake word processing with WebSocket communication. Implements spectral centroid calculation for audio analysis, Voice Activity Detection (VAD) with configurable thresholds, and intelligent voice command recognition. Features session management and audio chunk processing.', 'text', 'ai', 'voice', ARRAY['voice', 'ambient', 'vad', 'wake-word', 'real-time', 'websocket'], 0.8, 'user_created', 3, 356, 52),

('Vector Database Architecture', 'PostgreSQL-based vector database with pgvector extension supporting 3072-dimensional embeddings (OpenAI text-embedding-3-large). Implements semantic search with cosine similarity, IVFFlat indexing for high-performance ANN search, and comprehensive knowledge graph storage with relationship tracking.', 'text', 'database', 'vector', ARRAY['postgresql', 'pgvector', 'embeddings', 'semantic-search', 'cosine-similarity'], 0.85, 'user_created', 3, 378, 52),

('Knowledge Graph Database Schema', 'Advanced database schema implementing Graph RAG with vector embeddings, semantic clustering using K-means algorithm, topic modeling with LDA/BERTopic, relationship discovery algorithms, and comprehensive analytics tracking. Features auto-updating clusters and hierarchical organization.', 'text', 'database', 'knowledge-graph', ARRAY['knowledge-graph', 'graph-rag', 'clustering', 'topic-modeling', 'relationships'], 0.9, 'user_created', 3, 401, 55),

('Frontend React Architecture', 'Modern React TypeScript frontend with glass morphism design, responsive layouts, real-time WebSocket communication, comprehensive UI components, theme customization with CSS custom properties, and accessibility compliance. Features HMR development with Vite and comprehensive state management.', 'text', 'frontend', 'react', ARRAY['react', 'typescript', 'glass-morphism', 'responsive', 'websocket', 'accessibility'], 0.7, 'user_created', 3, 367, 51),

('JWT Authentication System', 'Secure authentication with JWT tokens, role-based access control, API key management with auto-rotation capabilities, encrypted credential storage using AES-256, and comprehensive security middleware. Implements public/private endpoint routing and user session management.', 'text', 'security', 'authentication', ARRAY['jwt', 'authentication', 'rbac', 'api-keys', 'encryption', 'security'], 0.85, 'user_created', 3, 312, 45),

('OpenAI API Integration', 'Complete integration with OpenAI API featuring GPT-4o for chat completion, DALL-E 3 for image generation, GPT-4 Vision for multimodal analysis, Whisper for speech-to-text, and text-embedding-3-large for semantic embeddings. Implements intelligent rate limiting and error handling.', 'text', 'ai', 'openai', ARRAY['openai', 'gpt-4o', 'dalle-3', 'whisper', 'embeddings', 'multimodal'], 0.9, 'user_created', 3, 365, 53),

('Docker Development Environment', 'Containerized development setup with Docker Compose orchestrating PostgreSQL database, Redis cache, backend Node.js service, and frontend React application. Features environment variable management, volume persistence, and development hot-reload capabilities.', 'text', 'devops', 'docker', ARRAY['docker', 'docker-compose', 'postgresql', 'redis', 'containerization'], 0.6, 'user_created', 3, 291, 42),

('API Rate Limiting Engine', 'Production-grade rate limiting system implementing token bucket algorithm with configurable RPM/TPM limits, intelligent request queuing, exponential backoff retry logic, and comprehensive monitoring. Supports both per-user and global rate limiting with priority queuing.', 'text', 'backend', 'rate-limiting', ARRAY['rate-limiting', 'token-bucket', 'exponential-backoff', 'monitoring'], 0.75, 'user_created', 3, 324, 46)

ON CONFLICT DO NOTHING;

-- Create knowledge clusters with enhanced metadata
INSERT INTO knowledge_clusters (
    name, description, cluster_type, color, algorithm_used, 
    created_by_algorithm, entry_count, min_similarity
) VALUES
('AI & Machine Learning Core', 'Advanced AI capabilities including multi-agent systems, machine learning models, and intelligent processing engines', 'semantic', '#8b5cf6', 'manual', 'admin_created', 6, 0.75),
('System Infrastructure', 'Backend architecture, databases, containerization, and infrastructure components', 'semantic', '#06b6d4', 'manual', 'admin_created', 3, 0.70),
('User Experience & Frontend', 'Frontend development, user interfaces, and user experience components', 'semantic', '#10b981', 'manual', 'admin_created', 1, 0.65),
('Security & Authentication', 'Security measures, authentication systems, and data protection mechanisms', 'semantic', '#f59e0b', 'manual', 'admin_created', 1, 0.80),
('API & Integration', 'External API integrations, service connections, and third-party systems', 'semantic', '#ef4444', 'manual', 'admin_created', 1, 0.70)

ON CONFLICT DO NOTHING;

-- Create sophisticated entry-cluster relationships
INSERT INTO knowledge_entry_clusters (entry_id, cluster_id, membership_strength, similarity_score, assigned_by) VALUES
-- AI & ML Cluster
(1, 1, 1.0, 0.95, 'manual'), -- Cartrita Platform
(2, 1, 0.9, 0.88, 'manual'), -- HuggingFace Router
(3, 1, 0.95, 0.92, 'manual'), -- RAG Pipeline
(4, 1, 1.0, 0.98, 'manual'), -- Multi-Agent System
(5, 1, 0.85, 0.82, 'manual'), -- Ambient Voice
(10, 1, 0.9, 0.87, 'manual'), -- OpenAI Integration

-- System Infrastructure Cluster
(6, 2, 1.0, 0.94, 'manual'), -- Vector Database
(7, 2, 0.95, 0.91, 'manual'), -- Knowledge Graph Schema
(11, 2, 0.8, 0.76, 'manual'), -- Docker Environment

-- Frontend Cluster
(8, 3, 1.0, 0.89, 'manual'), -- React Architecture

-- Security Cluster
(9, 4, 1.0, 0.92, 'manual'), -- JWT Authentication

-- API Integration Cluster
(12, 5, 0.9, 0.85, 'manual') -- Rate Limiting Engine

ON CONFLICT DO NOTHING;

-- Create knowledge relationships (Graph connections)
INSERT INTO knowledge_relationships (
    source_entry_id, target_entry_id, relationship_type, strength, confidence,
    semantic_similarity, discovery_method, discovered_by
) VALUES
-- Core platform relationships
(1, 4, 'contains', 0.9, 0.95, 0.88, 'manual_analysis', 'manual'), -- Platform contains Multi-Agent
(1, 2, 'integrates_with', 0.8, 0.90, 0.75, 'manual_analysis', 'manual'), -- Platform integrates HuggingFace
(1, 3, 'implements', 0.85, 0.92, 0.80, 'manual_analysis', 'manual'), -- Platform implements RAG
(1, 5, 'features', 0.75, 0.88, 0.70, 'manual_analysis', 'manual'), -- Platform features Voice

-- Technical relationships
(2, 10, 'similar_to', 0.7, 0.85, 0.82, 'embedding_similarity', 'algorithm'), -- HuggingFace similar to OpenAI
(3, 6, 'depends_on', 0.8, 0.90, 0.76, 'manual_analysis', 'manual'), -- RAG depends on Vector DB
(4, 12, 'uses', 0.6, 0.80, 0.65, 'manual_analysis', 'manual'), -- Multi-Agent uses Rate Limiting
(6, 7, 'implements', 0.9, 0.95, 0.89, 'manual_analysis', 'manual'), -- Vector DB implements Knowledge Graph

-- Security relationships
(9, 1, 'secures', 0.8, 0.90, 0.72, 'manual_analysis', 'manual'), -- JWT secures Platform
(12, 2, 'protects', 0.7, 0.85, 0.68, 'manual_analysis', 'manual'), -- Rate Limiting protects HuggingFace

-- Infrastructure relationships
(11, 6, 'hosts', 0.7, 0.88, 0.71, 'manual_analysis', 'manual'), -- Docker hosts Vector DB
(8, 1, 'interfaces_with', 0.8, 0.87, 0.74, 'manual_analysis', 'manual') -- React interfaces with Platform

ON CONFLICT DO NOTHING;

-- Update cluster statistics
UPDATE knowledge_clusters SET 
    entry_count = (
        SELECT COUNT(*) FROM knowledge_entry_clusters 
        WHERE cluster_id = knowledge_clusters.id
    ),
    avg_importance = (
        SELECT AVG(ke.importance_score) 
        FROM knowledge_entries ke 
        JOIN knowledge_entry_clusters kec ON ke.id = kec.entry_id 
        WHERE kec.cluster_id = knowledge_clusters.id
    ),
    updated_at = NOW();

-- Insert initial analytics for today
INSERT INTO knowledge_analytics (
    date, total_entries, new_entries, total_relationships, 
    avg_relationships_per_entry, avg_confidence_score, high_confidence_entries
) VALUES (
    CURRENT_DATE,
    (SELECT COUNT(*) FROM knowledge_entries),
    (SELECT COUNT(*) FROM knowledge_entries WHERE created_at >= CURRENT_DATE),
    (SELECT COUNT(*) FROM knowledge_relationships),
    (SELECT ROUND(AVG(rel_count), 2) FROM (
        SELECT COUNT(*) as rel_count FROM knowledge_relationships 
        GROUP BY source_entry_id
    ) t),
    (SELECT ROUND(AVG(confidence), 3) FROM knowledge_relationships),
    (SELECT COUNT(*) FROM knowledge_relationships WHERE confidence >= 0.9)
)
ON CONFLICT (date) DO UPDATE SET 
    total_entries = EXCLUDED.total_entries,
    total_relationships = EXCLUDED.total_relationships,
    avg_relationships_per_entry = EXCLUDED.avg_relationships_per_entry,
    avg_confidence_score = EXCLUDED.avg_confidence_score,
    high_confidence_entries = EXCLUDED.high_confidence_entries;

COMMENT ON TABLE knowledge_entries IS 'Enhanced knowledge storage with comprehensive metadata and vector embeddings';
COMMENT ON TABLE knowledge_clusters IS 'AI-powered knowledge clustering with algorithm tracking and hierarchical support';
COMMENT ON TABLE knowledge_relationships IS 'Sophisticated knowledge graph with relationship discovery and validation';