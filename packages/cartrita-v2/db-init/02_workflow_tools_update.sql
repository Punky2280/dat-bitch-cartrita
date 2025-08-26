-- Update workflow_tools table and create user_manual_sections table
-- for the populateWorkflowTools.js script

-- First, let's add missing columns to workflow_tools if they don't exist
DO $$
BEGIN
    -- Add title column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='title') THEN
        ALTER TABLE workflow_tools ADD COLUMN title VARCHAR(255);
    END IF;
    
    -- Add category_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='category_id') THEN
        ALTER TABLE workflow_tools ADD COLUMN category_id INTEGER;
    END IF;
    
    -- Add tool_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='tool_type') THEN
        ALTER TABLE workflow_tools ADD COLUMN tool_type VARCHAR(50);
    END IF;
    
    -- Add complexity_level column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='complexity_level') THEN
        ALTER TABLE workflow_tools ADD COLUMN complexity_level VARCHAR(50);
    END IF;
    
    -- Add use_case column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='use_case') THEN
        ALTER TABLE workflow_tools ADD COLUMN use_case TEXT;
    END IF;
    
    -- Add prerequisites column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='prerequisites') THEN
        ALTER TABLE workflow_tools ADD COLUMN prerequisites TEXT[];
    END IF;
    
    -- Add technologies column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='technologies') THEN
        ALTER TABLE workflow_tools ADD COLUMN technologies TEXT[];
    END IF;
    
    -- Add api_requirements column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='api_requirements') THEN
        ALTER TABLE workflow_tools ADD COLUMN api_requirements TEXT[];
    END IF;
    
    -- Add estimated_time column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='estimated_time') THEN
        ALTER TABLE workflow_tools ADD COLUMN estimated_time VARCHAR(100);
    END IF;
    
    -- Add difficulty_rating column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='difficulty_rating') THEN
        ALTER TABLE workflow_tools ADD COLUMN difficulty_rating INTEGER;
    END IF;
    
    -- Add tags column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='tags') THEN
        ALTER TABLE workflow_tools ADD COLUMN tags TEXT[];
    END IF;
    
    -- Add is_white_hat column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='is_white_hat') THEN
        ALTER TABLE workflow_tools ADD COLUMN is_white_hat BOOLEAN DEFAULT true;
    END IF;
    
    -- Add requires_permission column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='requires_permission') THEN
        ALTER TABLE workflow_tools ADD COLUMN requires_permission BOOLEAN DEFAULT false;
    END IF;
    
    -- Add safety_notes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='safety_notes') THEN
        ALTER TABLE workflow_tools ADD COLUMN safety_notes TEXT;
    END IF;
    
    -- Add embedding column for vector search
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='embedding') THEN
        ALTER TABLE workflow_tools ADD COLUMN embedding vector(1536);
    END IF;
    
    -- Add author column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workflow_tools' AND column_name='author') THEN
        ALTER TABLE workflow_tools ADD COLUMN author VARCHAR(100) DEFAULT 'System';
    END IF;
END $$;

-- Create user_manual_sections table
CREATE TABLE IF NOT EXISTS user_manual_sections (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    section_type VARCHAR(50) DEFAULT 'guide',
    difficulty_level VARCHAR(50) DEFAULT 'beginner',
    estimated_read_time VARCHAR(50),
    tags TEXT[],
    is_featured BOOLEAN DEFAULT false,
    version VARCHAR(20) DEFAULT '1.0',
    embedding vector(1536),
    last_updated_by VARCHAR(100) DEFAULT 'System',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_tools_category_id ON workflow_tools(category_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_tool_type ON workflow_tools(tool_type);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_complexity ON workflow_tools(complexity_level);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_tags ON workflow_tools USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_workflow_tools_embedding ON workflow_tools USING ivfflat(embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_manual_sections_slug ON user_manual_sections(slug);
CREATE INDEX IF NOT EXISTS idx_manual_sections_section_type ON user_manual_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_manual_sections_tags ON user_manual_sections USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_manual_sections_embedding ON user_manual_sections USING ivfflat(embedding vector_cosine_ops);

-- Add comments
COMMENT ON TABLE user_manual_sections IS 'User manual sections with documentation and guides';
COMMENT ON COLUMN workflow_tools.embedding IS 'Vector embedding for semantic search';
COMMENT ON COLUMN user_manual_sections.embedding IS 'Vector embedding for semantic search';