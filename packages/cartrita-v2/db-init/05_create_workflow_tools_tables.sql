-- Create workflow tools and documentation tables
-- This will store all the workflow tools with vector embeddings for semantic search

-- Workflow categories table
CREATE TABLE IF NOT EXISTS workflow_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES workflow_categories(id),
    icon VARCHAR(100),
    color VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow tools table
CREATE TABLE IF NOT EXISTS workflow_tools (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category_id INTEGER REFERENCES workflow_categories(id),
    tool_type VARCHAR(100) NOT NULL, -- 'dev', 'security', 'data', 'devops', 'custom', etc.
    complexity_level VARCHAR(50) DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'advanced', 'expert'
    use_case TEXT, -- Main use case or scenario
    prerequisites TEXT[], -- Array of prerequisites
    technologies TEXT[], -- Array of technologies used
    api_requirements TEXT[], -- Required API keys or services
    estimated_time VARCHAR(50), -- e.g., "5-10 minutes", "1-2 hours"
    difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
    popularity_score INTEGER DEFAULT 0,
    implementation_notes TEXT,
    example_code TEXT,
    related_tools INTEGER[], -- Array of related tool IDs
    tags TEXT[], -- Array of tags for better searching
    is_white_hat BOOLEAN DEFAULT true,
    requires_permission BOOLEAN DEFAULT false,
    safety_notes TEXT,
    embedding vector(1536), -- OpenAI embeddings for semantic search
    search_keywords TEXT, -- Additional keywords for search
    version VARCHAR(20) DEFAULT '1.0',
    author VARCHAR(255),
    license VARCHAR(100) DEFAULT 'MIT',
    github_url VARCHAR(500),
    documentation_url VARCHAR(500),
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_tools
CREATE INDEX IF NOT EXISTS idx_workflow_tools_category ON workflow_tools(category_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_type ON workflow_tools(tool_type);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_complexity ON workflow_tools(complexity_level);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_tags ON workflow_tools USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_technologies ON workflow_tools USING GIN (technologies);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_embedding ON workflow_tools USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_active ON workflow_tools(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_tools_featured ON workflow_tools(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_workflow_tools_popularity ON workflow_tools(popularity_score DESC);

-- User manual sections table
CREATE TABLE IF NOT EXISTS user_manual_sections (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    section_type VARCHAR(100) NOT NULL, -- 'guide', 'reference', 'tutorial', 'api', 'faq'
    parent_id INTEGER REFERENCES user_manual_sections(id),
    sort_order INTEGER DEFAULT 0,
    difficulty_level VARCHAR(50) DEFAULT 'beginner',
    estimated_read_time VARCHAR(50), -- e.g., "3-5 minutes"
    tags TEXT[],
    related_sections INTEGER[], -- Array of related section IDs
    embedding vector(1536), -- OpenAI embeddings for semantic search
    search_keywords TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    views_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    last_updated_by VARCHAR(255),
    version VARCHAR(20) DEFAULT '1.0',
    changelog TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user_manual_sections
CREATE INDEX IF NOT EXISTS idx_manual_sections_type ON user_manual_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_manual_sections_parent ON user_manual_sections(parent_id);
CREATE INDEX IF NOT EXISTS idx_manual_sections_slug ON user_manual_sections(slug);
CREATE INDEX IF NOT EXISTS idx_manual_sections_tags ON user_manual_sections USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_manual_sections_embedding ON user_manual_sections USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_manual_sections_active ON user_manual_sections(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_manual_sections_featured ON user_manual_sections(is_featured) WHERE is_featured = true;

-- Workflow tool dependencies table
CREATE TABLE IF NOT EXISTS workflow_tool_dependencies (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER NOT NULL REFERENCES workflow_tools(id) ON DELETE CASCADE,
    dependency_tool_id INTEGER NOT NULL REFERENCES workflow_tools(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL, -- 'requires', 'suggests', 'conflicts_with'
    description TEXT,
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tool_id, dependency_tool_id, dependency_type)
);

-- Workflow execution logs table
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER REFERENCES workflow_tools(id),
    user_id INTEGER REFERENCES users(id),
    execution_status VARCHAR(50) NOT NULL, -- 'started', 'completed', 'failed', 'aborted'
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    input_parameters JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_context JSONB, -- Environment, agent info, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_execution_logs
CREATE INDEX IF NOT EXISTS idx_execution_logs_tool ON workflow_execution_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_user ON workflow_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON workflow_execution_logs(execution_status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_time ON workflow_execution_logs(start_time DESC);

-- User favorites table
CREATE TABLE IF NOT EXISTS user_workflow_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_id INTEGER REFERENCES workflow_tools(id) ON DELETE CASCADE,
    manual_section_id INTEGER REFERENCES user_manual_sections(id) ON DELETE CASCADE,
    favorite_type VARCHAR(50) NOT NULL, -- 'tool', 'manual'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tool_id, manual_section_id, favorite_type),
    CHECK (
        (tool_id IS NOT NULL AND manual_section_id IS NULL AND favorite_type = 'tool') OR
        (tool_id IS NULL AND manual_section_id IS NOT NULL AND favorite_type = 'manual')
    )
);

-- User tool ratings table
CREATE TABLE IF NOT EXISTS user_tool_ratings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_id INTEGER NOT NULL REFERENCES workflow_tools(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    is_helpful BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tool_id)
);

-- Full-text search configuration
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_workflow_tools_fts ON workflow_tools USING GIN (
    to_tsvector('english', 
        COALESCE(title, '') || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(use_case, '') || ' ' ||
        COALESCE(search_keywords, '')
    )
);

CREATE INDEX IF NOT EXISTS idx_manual_sections_fts ON user_manual_sections USING GIN (
    to_tsvector('english', 
        COALESCE(title, '') || ' ' || 
        COALESCE(content, '') || ' ' ||
        COALESCE(search_keywords, '')
    )
);

-- Trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS idx_workflow_tools_title_trgm ON workflow_tools USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_manual_sections_title_trgm ON user_manual_sections USING GIN (title gin_trgm_ops);

-- Insert initial categories
INSERT INTO workflow_categories (name, description, icon, color, sort_order) VALUES
('Development', 'Code analysis, testing, and development workflows', 'code', '#3B82F6', 1),
('Security', 'White-hat security testing and compliance workflows', 'shield', '#EF4444', 2),
('DevOps', 'CI/CD, infrastructure, and deployment workflows', 'server', '#10B981', 3),
('Data Analysis', 'Data processing, analytics, and visualization workflows', 'chart-bar', '#8B5CF6', 4),
('Cloud & Infrastructure', 'Cloud services, containers, and infrastructure workflows', 'cloud', '#F59E0B', 5),
('Documentation', 'Documentation generation and management workflows', 'document', '#6B7280', 6),
('Productivity', 'General productivity and automation workflows', 'lightning', '#06B6D4', 7),
('Testing & QA', 'Quality assurance and testing workflows', 'beaker', '#EC4899', 8),
('Monitoring', 'Observability, logging, and monitoring workflows', 'eye', '#84CC16', 9),
('Custom Tools', 'User-created custom workflow tools', 'puzzle', '#F97316', 10)
ON CONFLICT (name) DO NOTHING;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_workflow_tools_updated_at BEFORE UPDATE ON workflow_tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_manual_sections_updated_at BEFORE UPDATE ON user_manual_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tool_ratings_updated_at BEFORE UPDATE ON user_tool_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();