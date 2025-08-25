-- Migration: Add Workflow Templates Support
-- Adds template versioning and variable scaffolding for reusable workflow templates
-- Based on WORKFLOW_TEMPLATES_SYSTEM_PLAN.md specification

-- Add base template reference column (workflows uses integer IDs)
ALTER TABLE workflows ADD COLUMN base_template_id INT NULL REFERENCES workflows(id);

-- Create workflow template variables table  
CREATE TABLE workflow_template_variables (
  id BIGSERIAL PRIMARY KEY,
  workflow_id INT REFERENCES workflows(id) ON DELETE CASCADE,
  var_name TEXT NOT NULL,
  description TEXT,
  required BOOLEAN DEFAULT TRUE,
  default_value TEXT,
  var_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, secret_ref
  validation_pattern TEXT, -- regex pattern for validation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX ON workflow_template_variables(workflow_id);
CREATE INDEX ON workflow_template_variables(var_name);
CREATE INDEX ON workflows(base_template_id) WHERE base_template_id IS NOT NULL;

-- Create template usage tracking table
CREATE TABLE workflow_template_usage (
  id BIGSERIAL PRIMARY KEY,
  template_id INT REFERENCES workflows(id) ON DELETE CASCADE,
  instantiated_workflow_id INT REFERENCES workflows(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  variables_used JSONB DEFAULT '{}',
  instantiated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage tracking
CREATE INDEX ON workflow_template_usage(template_id);
CREATE INDEX ON workflow_template_usage(user_id);
CREATE INDEX ON workflow_template_usage(instantiated_at DESC);

-- Add template rating system
CREATE TABLE workflow_template_ratings (
  id BIGSERIAL PRIMARY KEY,
  template_id INT REFERENCES workflows(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, user_id)
);

-- Junction table for workflow-tag relationships
CREATE TABLE workflow_template_tag_associations (
  id BIGSERIAL PRIMARY KEY,
  workflow_id INT REFERENCES workflows(id) ON DELETE CASCADE,
  tag_id INT REFERENCES workflow_template_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, tag_id)
);

-- Indexes for tags
CREATE INDEX ON workflow_template_tag_associations(workflow_id);
CREATE INDEX ON workflow_template_tag_associations(tag_id);
CREATE INDEX ON workflow_template_tags(name);

-- View for template statistics
CREATE OR REPLACE VIEW workflow_template_stats AS
SELECT 
  w.id,
  w.name,
  w.description,
  w.template_version,
  wtc.name as category_name,
  COUNT(wtu.id) as usage_count,
  AVG(wtr.rating) as avg_rating,
  COUNT(wtr.id) as rating_count,
  w.created_at,
  w.updated_at
FROM workflows w
LEFT JOIN workflow_template_categories wtc ON w.category_id = wtc.id
LEFT JOIN workflow_template_usage wtu ON w.id = wtu.template_id
LEFT JOIN workflow_template_ratings wtr ON w.id = wtr.template_id
WHERE w.is_template = TRUE
GROUP BY w.id, w.name, w.description, w.template_version, wtc.name, w.created_at, w.updated_at;

-- Function to increment tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE workflow_template_tags 
    SET usage_count = usage_count + 1 
    WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workflow_template_tags 
    SET usage_count = usage_count - 1 
    WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain tag usage counts
CREATE TRIGGER trigger_update_tag_usage_count
  AFTER INSERT OR DELETE ON workflow_template_tag_associations
  FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();

-- Insert starter template tags
INSERT INTO workflow_template_tags (name) VALUES
('beginner'),
('advanced'),
('api-integration'),
('email'),
('slack'),
('calendar'),
('data-processing'),
('notifications'),
('scheduling'),
('reporting'),
('ai-powered'),
('nlp'),
('vision'),
('automation'),
('productivity');

COMMENT ON TABLE workflow_template_variables IS 'Defines variables required for workflow template instantiation';
COMMENT ON TABLE workflow_template_categories IS 'Categories for organizing workflow templates';
COMMENT ON TABLE workflow_template_usage IS 'Tracks template usage and instantiation history';
COMMENT ON TABLE workflow_template_ratings IS 'User ratings and reviews for workflow templates';
COMMENT ON VIEW workflow_template_stats IS 'Aggregated statistics for workflow templates';