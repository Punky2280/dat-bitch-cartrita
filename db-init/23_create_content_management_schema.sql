-- Task 13: Advanced Content Management System - Database Schema
-- Migration: 23_create_content_management_schema.sql
-- Created: January 15, 2025

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types for content management
CREATE TYPE content_type_enum AS ENUM (
    'article', 'page', 'media', 'template', 'component', 'document', 'snippet', 'form', 'widget'
);

CREATE TYPE content_status_enum AS ENUM (
    'draft', 'in_review', 'approved', 'published', 'archived', 'deleted'
);

CREATE TYPE collection_type_enum AS ENUM (
    'category', 'tag', 'collection', 'taxonomy', 'folder'
);

CREATE TYPE comment_type_enum AS ENUM (
    'comment', 'suggestion', 'review', 'approval', 'change_request'
);

CREATE TYPE comment_status_enum AS ENUM (
    'open', 'resolved', 'rejected', 'implemented'
);

CREATE TYPE workflow_type_enum AS ENUM (
    'review_approval', 'publishing', 'content_validation', 'seo_optimization', 'compliance_check'
);

CREATE TYPE workflow_status_enum AS ENUM (
    'active', 'completed', 'cancelled', 'paused'
);

-- Main content items table
CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type content_type_enum NOT NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content_body JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    status content_status_enum DEFAULT 'draft',
    version_info JSONB NOT NULL DEFAULT '{"current": "1.0", "branch": "main", "commits": []}',
    permissions JSONB NOT NULL DEFAULT '{}',
    author_id UUID REFERENCES users(id),
    editor_id UUID REFERENCES users(id),
    parent_id UUID REFERENCES content_items(id), -- For hierarchical content
    template_id UUID REFERENCES content_items(id), -- Template reference
    search_vector tsvector, -- Full-text search
    content_hash TEXT, -- SHA-256 hash for integrity
    word_count INTEGER DEFAULT 0,
    reading_time INTEGER DEFAULT 0, -- Estimated reading time in minutes
    seo_score INTEGER DEFAULT 0, -- SEO optimization score (0-100)
    engagement_score DECIMAL(5,2) DEFAULT 0.00, -- Content engagement score
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP,
    scheduled_publish_at TIMESTAMP,
    archived_at TIMESTAMP
);

-- Content versions table for complete history
CREATE TABLE content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    version_hash TEXT NOT NULL UNIQUE, -- SHA-256 of content + metadata
    parent_hash TEXT, -- Previous version hash
    branch_name TEXT DEFAULT 'main',
    version_number TEXT NOT NULL, -- Semantic versioning (1.0, 1.1, 2.0, etc.)
    content_snapshot JSONB NOT NULL, -- Complete content state at this version
    changes_summary TEXT,
    change_log JSONB DEFAULT '[]', -- Detailed change tracking
    author_id UUID REFERENCES users(id),
    commit_message TEXT,
    is_major_version BOOLEAN DEFAULT false,
    size_bytes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(content_id, version_number)
);

-- Content relationships (parent/child, references, links, etc.)
CREATE TABLE content_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    child_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- 'child', 'reference', 'dependency', 'translation', 'variant'
    relationship_data JSONB DEFAULT '{}',
    weight INTEGER DEFAULT 0, -- For ordering relationships
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(parent_id, child_id, relationship_type)
);

-- Content collections and taxonomies
CREATE TABLE content_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    type collection_type_enum DEFAULT 'category',
    parent_id UUID REFERENCES content_collections(id),
    icon TEXT, -- Icon identifier
    color TEXT, -- Hex color code
    metadata JSONB DEFAULT '{}',
    permissions JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    item_count INTEGER DEFAULT 0, -- Cached count of items
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (parent_id != id) -- Prevent self-reference
);

-- Content to collections mapping (many-to-many)
CREATE TABLE content_collection_items (
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES content_collections(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}', -- Additional relationship metadata
    added_at TIMESTAMP DEFAULT NOW(),
    added_by UUID REFERENCES users(id),
    
    PRIMARY KEY (content_id, collection_id)
);

-- Real-time collaborative editing sessions
CREATE TABLE content_edit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL, -- WebSocket session identifier
    user_id UUID REFERENCES users(id),
    cursor_position JSONB, -- Current cursor/selection position
    session_data JSONB NOT NULL DEFAULT '{}', -- Operational transform data
    permissions JSONB DEFAULT '{}', -- Session-specific permissions
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Content comments and reviews
CREATE TABLE content_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    version_hash TEXT, -- Reference to specific version
    parent_id UUID REFERENCES content_comments(id), -- For threaded comments
    user_id UUID REFERENCES users(id),
    comment_text TEXT NOT NULL,
    comment_type comment_type_enum DEFAULT 'comment',
    position_data JSONB, -- For inline comments (line, character, selection)
    attachments JSONB DEFAULT '[]', -- File attachments
    reactions JSONB DEFAULT '{}', -- Emoji reactions
    status comment_status_enum DEFAULT 'open',
    priority INTEGER DEFAULT 0, -- 0=low, 1=medium, 2=high, 3=critical
    due_date TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Publishing workflows and approvals
CREATE TABLE content_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    workflow_type workflow_type_enum NOT NULL,
    workflow_name TEXT NOT NULL,
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL,
    workflow_data JSONB NOT NULL DEFAULT '{}', -- Step definitions, assignees, etc.
    assignees JSONB DEFAULT '[]', -- Current step assignees
    approvers JSONB DEFAULT '[]', -- Previous approvers
    due_date TIMESTAMP,
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=urgent
    status workflow_status_enum DEFAULT 'active',
    completion_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Content publishing channels and distribution
CREATE TABLE content_publishing_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- 'web', 'api', 'social', 'email', 'mobile', 'print'
    configuration JSONB NOT NULL DEFAULT '{}', -- Channel-specific config
    credentials JSONB DEFAULT '{}', -- Encrypted API credentials
    status TEXT DEFAULT 'active', -- 'active', 'inactive', 'error'
    last_published_at TIMESTAMP,
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    error_log JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Content publication history
CREATE TABLE content_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    version_hash TEXT NOT NULL,
    channel_id UUID REFERENCES content_publishing_channels(id) ON DELETE CASCADE,
    publication_data JSONB NOT NULL DEFAULT '{}',
    external_id TEXT, -- ID from external publishing system
    external_url TEXT, -- Published URL
    status TEXT DEFAULT 'pending', -- 'pending', 'published', 'failed', 'cancelled'
    published_at TIMESTAMP,
    unpublished_at TIMESTAMP,
    error_message TEXT,
    analytics_data JSONB DEFAULT '{}', -- Performance metrics
    published_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(content_id, channel_id, version_hash)
);

-- Content analytics and performance tracking
CREATE TABLE content_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    date_recorded DATE DEFAULT CURRENT_DATE,
    views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    time_on_page INTEGER DEFAULT 0, -- Average time in seconds
    bounce_rate DECIMAL(5,2) DEFAULT 0.00,
    conversion_rate DECIMAL(5,2) DEFAULT 0.00,
    social_shares INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    search_ranking INTEGER DEFAULT 0,
    seo_score INTEGER DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0.00,
    custom_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(content_id, date_recorded)
);

-- Content AI optimization results
CREATE TABLE content_ai_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    version_hash TEXT NOT NULL,
    optimization_type TEXT NOT NULL, -- 'seo', 'readability', 'tone', 'grammar', 'performance'
    original_score DECIMAL(5,2),
    optimized_score DECIMAL(5,2),
    suggestions JSONB NOT NULL DEFAULT '[]',
    applied_suggestions JSONB DEFAULT '[]',
    ai_model TEXT, -- Model used for optimization
    processing_time_ms INTEGER,
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Media assets for content
CREATE TABLE content_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Storage path
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_hash TEXT NOT NULL, -- SHA-256 for integrity
    alt_text TEXT,
    caption TEXT,
    metadata JSONB DEFAULT '{}', -- EXIF data, dimensions, etc.
    is_optimized BOOLEAN DEFAULT false,
    optimization_data JSONB DEFAULT '{}',
    usage_count INTEGER DEFAULT 0, -- How many times referenced
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(file_hash)
);

-- Content templates
CREATE TABLE content_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    template_data JSONB NOT NULL, -- Template structure and fields
    thumbnail TEXT, -- Template preview image
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    author_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Content search and indexing
CREATE INDEX idx_content_items_type ON content_items(type);
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_author ON content_items(author_id);
CREATE INDEX idx_content_items_created_at ON content_items(created_at DESC);
CREATE INDEX idx_content_items_updated_at ON content_items(updated_at DESC);
CREATE INDEX idx_content_items_published_at ON content_items(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX idx_content_items_search_vector ON content_items USING GIN(search_vector);
CREATE INDEX idx_content_items_slug ON content_items(slug);
CREATE INDEX idx_content_items_parent ON content_items(parent_id) WHERE parent_id IS NOT NULL;

-- Content versions indexing
CREATE INDEX idx_content_versions_content_id ON content_versions(content_id);
CREATE INDEX idx_content_versions_hash ON content_versions(version_hash);
CREATE INDEX idx_content_versions_branch ON content_versions(content_id, branch_name);
CREATE INDEX idx_content_versions_created_at ON content_versions(created_at DESC);

-- Content relationships indexing
CREATE INDEX idx_content_relationships_parent ON content_relationships(parent_id);
CREATE INDEX idx_content_relationships_child ON content_relationships(child_id);
CREATE INDEX idx_content_relationships_type ON content_relationships(relationship_type);

-- Collections indexing
CREATE INDEX idx_content_collections_parent ON content_collections(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_content_collections_type ON content_collections(type);
CREATE INDEX idx_content_collections_active ON content_collections(is_active) WHERE is_active = true;

-- Comments indexing
CREATE INDEX idx_content_comments_content_id ON content_comments(content_id);
CREATE INDEX idx_content_comments_user ON content_comments(user_id);
CREATE INDEX idx_content_comments_status ON content_comments(status);
CREATE INDEX idx_content_comments_created_at ON content_comments(created_at DESC);

-- Publishing and analytics indexing
CREATE INDEX idx_content_publications_content_id ON content_publications(content_id);
CREATE INDEX idx_content_publications_channel ON content_publications(channel_id);
CREATE INDEX idx_content_publications_status ON content_publications(status);
CREATE INDEX idx_content_analytics_content_date ON content_analytics(content_id, date_recorded);

-- Trigger functions for automated tasks

-- Update search vector when content changes
CREATE OR REPLACE FUNCTION update_content_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.title, '') || ' ' || 
        COALESCE(NEW.content_body->>'raw', '') || ' ' ||
        COALESCE(NEW.metadata->>'description', '') || ' ' ||
        COALESCE(NEW.metadata->>'keywords', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_search_vector_update
    BEFORE INSERT OR UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION update_content_search_vector();

-- Update content hash when content changes
CREATE OR REPLACE FUNCTION update_content_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_hash := encode(
        digest(
            NEW.title || NEW.content_body::text || NEW.metadata::text,
            'sha256'
        ),
        'hex'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_hash_update
    BEFORE INSERT OR UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION update_content_hash();

-- Calculate word count and reading time
CREATE OR REPLACE FUNCTION calculate_content_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate word count from content body
    NEW.word_count := (
        LENGTH(COALESCE(NEW.content_body->>'raw', '')) - 
        LENGTH(REPLACE(COALESCE(NEW.content_body->>'raw', ''), ' ', ''))
    ) + 1;
    
    -- Estimate reading time (average 200 words per minute)
    NEW.reading_time := GREATEST(1, CEIL(NEW.word_count / 200.0));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_stats_update
    BEFORE INSERT OR UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION calculate_content_stats();

-- Update collection item counts
CREATE OR REPLACE FUNCTION update_collection_item_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE content_collections 
        SET item_count = item_count + 1,
            updated_at = NOW()
        WHERE id = NEW.collection_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE content_collections 
        SET item_count = item_count - 1,
            updated_at = NOW()
        WHERE id = OLD.collection_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_item_count_update
    AFTER INSERT OR DELETE ON content_collection_items
    FOR EACH ROW EXECUTE FUNCTION update_collection_item_count();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_items_updated_at
    BEFORE UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_collections_updated_at
    BEFORE UPDATE ON content_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_comments_updated_at
    BEFORE UPDATE ON content_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_workflows_updated_at
    BEFORE UPDATE ON content_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create default collections
INSERT INTO content_collections (name, slug, description, type, metadata) VALUES
('General', 'general', 'General content category', 'category', '{"default": true}'),
('Blog Posts', 'blog-posts', 'Blog articles and posts', 'category', '{"content_types": ["article"]}'),
('Pages', 'pages', 'Static pages and landing pages', 'category', '{"content_types": ["page"]}'),
('Media', 'media', 'Images, videos, and other media assets', 'category', '{"content_types": ["media"]}'),
('Templates', 'templates', 'Content templates and layouts', 'category', '{"content_types": ["template"]}'),
('Published', 'published', 'Published content', 'tag', '{"auto_tag": true}'),
('Draft', 'draft', 'Content in draft state', 'tag', '{"auto_tag": true}'),
('Featured', 'featured', 'Featured content items', 'tag', '{"featured": true}');

-- Create default publishing channels
INSERT INTO content_publishing_channels (name, type, configuration) VALUES
('Website', 'web', '{"base_url": "/", "auto_publish": true}'),
('API', 'api', '{"version": "v1", "format": "json"}'),
('Email Newsletter', 'email', '{"template": "default", "auto_send": false}');

COMMIT;
