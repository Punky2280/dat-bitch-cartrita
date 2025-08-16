-- Task 25 Component 3: Workflow Template Library Database Schema
-- Template storage, categorization, usage tracking, and rating system
-- Created: December 2024

-- Workflow Templates Table (custom templates)
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    complexity VARCHAR(20) NOT NULL DEFAULT 'intermediate',
    tags TEXT[] DEFAULT '{}',
    definition JSONB NOT NULL,
    created_by UUID NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    estimated_duration VARCHAR(100),
    prerequisites TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Template metadata
    template_version VARCHAR(20) DEFAULT '1.0.0',
    minimum_engine_version VARCHAR(20),
    icon_url TEXT,
    preview_image_url TEXT,
    documentation_url TEXT,
    
    -- Publishing information
    published_at TIMESTAMP WITH TIME ZONE,
    publish_status VARCHAR(20) DEFAULT 'draft',
    approval_status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_workflow_templates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_templates_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_workflow_templates_complexity CHECK (complexity IN ('beginner', 'intermediate', 'advanced', 'expert')),
    CONSTRAINT chk_workflow_templates_publish_status CHECK (publish_status IN ('draft', 'published', 'archived', 'deprecated')),
    CONSTRAINT chk_workflow_templates_approval_status CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

-- Template Categories Table (predefined categories with metadata)
CREATE TABLE IF NOT EXISTS workflow_template_categories (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    color VARCHAR(7),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    parent_category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_template_categories_parent FOREIGN KEY (parent_category) REFERENCES workflow_template_categories(id) ON DELETE SET NULL
);

-- Template Tags Table (for better categorization and search)
CREATE TABLE IF NOT EXISTS workflow_template_tags (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    category VARCHAR(100),
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_template_tags_category FOREIGN KEY (category) REFERENCES workflow_template_categories(id) ON DELETE SET NULL
);

-- Template Usage Tracking Table
CREATE TABLE IF NOT EXISTS workflow_template_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID,
    prebuilt_template_id VARCHAR(255), -- For tracking prebuilt template usage
    user_id UUID NOT NULL,
    workflow_id UUID, -- The workflow created from this template
    used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Usage context
    usage_type VARCHAR(50) DEFAULT 'create_workflow',
    client_info JSONB DEFAULT '{}',
    customizations JSONB DEFAULT '{}',
    
    CONSTRAINT fk_template_usage_template FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_template_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_template_usage_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL,
    CONSTRAINT chk_template_usage_type CHECK (usage_type IN ('create_workflow', 'preview', 'export', 'clone'))
);

-- Template Reviews and Ratings Table
CREATE TABLE IF NOT EXISTS workflow_template_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rating INTEGER NOT NULL,
    review TEXT,
    helpful_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Review metadata
    is_verified_user BOOLEAN DEFAULT FALSE,
    review_status VARCHAR(20) DEFAULT 'published',
    moderated_by UUID,
    moderated_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_template_reviews_template FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_template_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_template_reviews_moderator FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_template_reviews_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT chk_template_reviews_status CHECK (review_status IN ('published', 'pending', 'hidden', 'deleted')),
    CONSTRAINT uq_template_reviews_user UNIQUE (template_id, user_id)
);

-- Template Collections Table (curated sets of templates)
CREATE TABLE IF NOT EXISTS workflow_template_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Collection metadata
    icon_url TEXT,
    banner_image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    
    CONSTRAINT fk_template_collections_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Template Collection Items Table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS workflow_template_collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL,
    template_id UUID,
    prebuilt_template_id VARCHAR(255), -- For including prebuilt templates
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    added_by UUID NOT NULL,
    
    -- Item metadata
    custom_description TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT fk_collection_items_collection FOREIGN KEY (collection_id) REFERENCES workflow_template_collections(id) ON DELETE CASCADE,
    CONSTRAINT fk_collection_items_template FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_collection_items_user FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_collection_items_template CHECK (
        (template_id IS NOT NULL AND prebuilt_template_id IS NULL) OR 
        (template_id IS NULL AND prebuilt_template_id IS NOT NULL)
    )
);

-- Template Download/Export History Table
CREATE TABLE IF NOT EXISTS workflow_template_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID,
    prebuilt_template_id VARCHAR(255),
    user_id UUID NOT NULL,
    download_type VARCHAR(50) NOT NULL DEFAULT 'json',
    downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Download metadata
    file_format VARCHAR(20),
    file_size_bytes INTEGER,
    client_info JSONB DEFAULT '{}',
    
    CONSTRAINT fk_template_downloads_template FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_template_downloads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_template_downloads_type CHECK (download_type IN ('json', 'yaml', 'xml', 'zip')),
    CONSTRAINT chk_template_downloads_format CHECK (file_format IN ('json', 'yaml', 'xml', 'zip'))
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Workflow templates indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_complexity ON workflow_templates(complexity);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON workflow_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_public ON workflow_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_publish_status ON workflow_templates(publish_status);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_at ON workflow_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_tags ON workflow_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_name_search ON workflow_templates USING GIN(to_tsvector('english', name || ' ' || description));

-- Template categories indexes
CREATE INDEX IF NOT EXISTS idx_template_categories_parent ON workflow_template_categories(parent_category);
CREATE INDEX IF NOT EXISTS idx_template_categories_active ON workflow_template_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_template_categories_sort ON workflow_template_categories(sort_order);

-- Template tags indexes
CREATE INDEX IF NOT EXISTS idx_template_tags_category ON workflow_template_tags(category);
CREATE INDEX IF NOT EXISTS idx_template_tags_usage_count ON workflow_template_tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_template_tags_active ON workflow_template_tags(is_active);

-- Template usage indexes
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON workflow_template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_prebuilt ON workflow_template_usage(prebuilt_template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_user ON workflow_template_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_used_at ON workflow_template_usage(used_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_type ON workflow_template_usage(usage_type);
CREATE INDEX IF NOT EXISTS idx_template_usage_composite ON workflow_template_usage(template_id, user_id, used_at DESC);

-- Template reviews indexes
CREATE INDEX IF NOT EXISTS idx_template_reviews_template ON workflow_template_reviews(template_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_user ON workflow_template_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_rating ON workflow_template_reviews(rating DESC);
CREATE INDEX IF NOT EXISTS idx_template_reviews_created_at ON workflow_template_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_reviews_status ON workflow_template_reviews(review_status);

-- Template collections indexes
CREATE INDEX IF NOT EXISTS idx_template_collections_created_by ON workflow_template_collections(created_by);
CREATE INDEX IF NOT EXISTS idx_template_collections_is_public ON workflow_template_collections(is_public);
CREATE INDEX IF NOT EXISTS idx_template_collections_is_featured ON workflow_template_collections(is_featured);
CREATE INDEX IF NOT EXISTS idx_template_collections_sort ON workflow_template_collections(sort_order);

-- Collection items indexes
CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON workflow_template_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_template ON workflow_template_collection_items(template_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_prebuilt ON workflow_template_collection_items(prebuilt_template_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_sort ON workflow_template_collection_items(collection_id, sort_order);

-- Template downloads indexes
CREATE INDEX IF NOT EXISTS idx_template_downloads_template ON workflow_template_downloads(template_id);
CREATE INDEX IF NOT EXISTS idx_template_downloads_prebuilt ON workflow_template_downloads(prebuilt_template_id);
CREATE INDEX IF NOT EXISTS idx_template_downloads_user ON workflow_template_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_template_downloads_downloaded_at ON workflow_template_downloads(downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_downloads_type ON workflow_template_downloads(download_type);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update workflow_templates.updated_at trigger
CREATE OR REPLACE FUNCTION update_workflow_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_workflow_templates_updated_at ON workflow_templates;
CREATE TRIGGER tr_workflow_templates_updated_at
    BEFORE UPDATE ON workflow_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_templates_updated_at();

-- Update template reviews updated_at trigger
CREATE OR REPLACE FUNCTION update_template_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_template_reviews_updated_at ON workflow_template_reviews;
CREATE TRIGGER tr_template_reviews_updated_at
    BEFORE UPDATE ON workflow_template_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_template_reviews_updated_at();

-- Update collections updated_at trigger
CREATE OR REPLACE FUNCTION update_template_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_template_collections_updated_at ON workflow_template_collections;
CREATE TRIGGER tr_template_collections_updated_at
    BEFORE UPDATE ON workflow_template_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_template_collections_updated_at();

-- Update tag usage count trigger
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update usage count for tags when templates are created/updated
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE workflow_template_tags 
        SET usage_count = (
            SELECT COUNT(*)
            FROM workflow_templates wt
            WHERE wt.tags && ARRAY[workflow_template_tags.id]
        )
        WHERE id = ANY(NEW.tags);
    END IF;
    
    -- Handle deletions
    IF TG_OP = 'DELETE' THEN
        UPDATE workflow_template_tags 
        SET usage_count = (
            SELECT COUNT(*)
            FROM workflow_templates wt
            WHERE wt.tags && ARRAY[workflow_template_tags.id]
        )
        WHERE id = ANY(OLD.tags);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_template_tag_usage ON workflow_templates;
CREATE TRIGGER tr_template_tag_usage
    AFTER INSERT OR UPDATE OR DELETE ON workflow_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_tag_usage_count();

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Template popularity view
CREATE OR REPLACE VIEW workflow_template_popularity AS
SELECT 
    wt.id,
    wt.name,
    wt.category,
    wt.complexity,
    wt.created_by,
    wt.is_public,
    COUNT(wtu.id) as usage_count,
    COUNT(wtr.id) as review_count,
    COALESCE(AVG(wtr.rating), 0) as avg_rating,
    COUNT(wtd.id) as download_count,
    wt.created_at,
    wt.updated_at,
    -- Calculate popularity score
    (
        COUNT(wtu.id) * 0.4 +
        COUNT(wtr.id) * 0.3 +
        COALESCE(AVG(wtr.rating), 0) * 0.2 +
        COUNT(wtd.id) * 0.1
    ) as popularity_score
FROM workflow_templates wt
LEFT JOIN workflow_template_usage wtu ON wt.id = wtu.template_id
LEFT JOIN workflow_template_reviews wtr ON wt.id = wtr.template_id AND wtr.review_status = 'published'
LEFT JOIN workflow_template_downloads wtd ON wt.id = wtd.template_id
WHERE wt.publish_status = 'published'
GROUP BY wt.id, wt.name, wt.category, wt.complexity, wt.created_by, wt.is_public, wt.created_at, wt.updated_at;

-- Template statistics view
CREATE OR REPLACE VIEW workflow_template_statistics AS
SELECT 
    category,
    complexity,
    COUNT(*) as template_count,
    COUNT(CASE WHEN is_public = true THEN 1 END) as public_count,
    COUNT(CASE WHEN publish_status = 'published' THEN 1 END) as published_count,
    AVG((
        SELECT AVG(rating) 
        FROM workflow_template_reviews wtr 
        WHERE wtr.template_id = wt.id AND wtr.review_status = 'published'
    )) as avg_rating,
    SUM((
        SELECT COUNT(*) 
        FROM workflow_template_usage wtu 
        WHERE wtu.template_id = wt.id
    )) as total_usage
FROM workflow_templates wt
GROUP BY category, complexity;

-- Recent template activity view
CREATE OR REPLACE VIEW recent_template_activity AS
SELECT 
    'template_created' as activity_type,
    wt.id as template_id,
    wt.name as template_name,
    wt.created_by as user_id,
    u.email as user_email,
    wt.created_at as activity_date
FROM workflow_templates wt
LEFT JOIN users u ON wt.created_by = u.id
WHERE wt.created_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
    'template_used' as activity_type,
    wtu.template_id,
    wt.name as template_name,
    wtu.user_id,
    u.email as user_email,
    wtu.used_at as activity_date
FROM workflow_template_usage wtu
LEFT JOIN workflow_templates wt ON wtu.template_id = wt.id
LEFT JOIN users u ON wtu.user_id = u.id
WHERE wtu.used_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
    'template_reviewed' as activity_type,
    wtr.template_id,
    wt.name as template_name,
    wtr.user_id,
    u.email as user_email,
    wtr.created_at as activity_date
FROM workflow_template_reviews wtr
LEFT JOIN workflow_templates wt ON wtr.template_id = wt.id
LEFT JOIN users u ON wtr.user_id = u.id
WHERE wtr.created_at >= NOW() - INTERVAL '7 days'

ORDER BY activity_date DESC;

-- =============================================================================
-- SAMPLE DATA INITIALIZATION
-- =============================================================================

-- Insert predefined categories
INSERT INTO workflow_template_categories (id, name, description, icon, color, sort_order) VALUES
('data_processing', 'Data Processing', 'Templates for data transformation, validation, and ETL processes', 'data', '#2196F3', 1),
('approval_workflows', 'Approval Workflows', 'Multi-stage approval and review processes', 'approval', '#4CAF50', 2),
('notifications', 'Notifications', 'Alert and notification automation templates', 'notification', '#FF9800', 3),
('reporting', 'Reporting', 'Automated reporting and dashboard generation', 'report', '#9C27B0', 4),
('customer_onboarding', 'Customer Onboarding', 'Customer journey and onboarding automation', 'customer', '#00BCD4', 5),
('inventory_management', 'Inventory Management', 'Stock monitoring and inventory automation', 'inventory', '#8BC34A', 6),
('lead_qualification', 'Lead Qualification', 'Sales lead processing and qualification', 'lead', '#FF5722', 7),
('content_management', 'Content Management', 'Content creation, review, and publishing workflows', 'content', '#795548', 8),
('financial_processing', 'Financial Processing', 'Financial transaction and approval workflows', 'finance', '#607D8B', 9),
('hr_automation', 'HR Automation', 'Human resources and employee management', 'hr', '#E91E63', 10),
('marketing_automation', 'Marketing Automation', 'Marketing campaigns and customer engagement', 'marketing', '#3F51B5', 11),
('support_automation', 'Support Automation', 'Customer support and ticket management', 'support', '#009688', 12)
ON CONFLICT (id) DO NOTHING;

-- Insert common tags
INSERT INTO workflow_template_tags (id, name, description, category, color) VALUES
('beginner-friendly', 'Beginner Friendly', 'Easy to use templates for newcomers', null, '#4CAF50'),
('integration', 'Integration', 'Templates that connect multiple systems', null, '#2196F3'),
('ai-powered', 'AI Powered', 'Templates utilizing artificial intelligence', null, '#9C27B0'),
('real-time', 'Real-time', 'Templates for real-time processing', null, '#FF5722'),
('batch-processing', 'Batch Processing', 'Templates for batch operations', 'data_processing', '#607D8B'),
('multi-step', 'Multi-step', 'Complex multi-stage workflows', null, '#FF9800'),
('automated', 'Automated', 'Fully automated processes', null, '#00BCD4'),
('approval', 'Approval', 'Approval and review processes', 'approval_workflows', '#4CAF50'),
('notification', 'Notification', 'Notification and alerting', 'notifications', '#FF9800'),
('reporting', 'Reporting', 'Data reporting and analytics', 'reporting', '#9C27B0')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE workflow_templates IS 'Custom workflow templates created by users';
COMMENT ON TABLE workflow_template_categories IS 'Predefined categories for organizing templates';
COMMENT ON TABLE workflow_template_tags IS 'Tags for better template categorization and search';
COMMENT ON TABLE workflow_template_usage IS 'Tracking of template usage and adoption';
COMMENT ON TABLE workflow_template_reviews IS 'User reviews and ratings for templates';
COMMENT ON TABLE workflow_template_collections IS 'Curated collections of related templates';
COMMENT ON TABLE workflow_template_collection_items IS 'Items within template collections';
COMMENT ON TABLE workflow_template_downloads IS 'Template download and export tracking';

-- Performance monitoring functions

-- Function to cleanup old template usage data
CREATE OR REPLACE FUNCTION cleanup_old_template_usage_data(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete old usage records
    DELETE FROM workflow_template_usage 
    WHERE used_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old download records
    DELETE FROM workflow_template_downloads 
    WHERE downloaded_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_template_usage_data IS 'Cleanup old template usage and download data older than specified days';
