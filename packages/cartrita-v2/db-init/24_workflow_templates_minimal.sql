-- Migration: Workflow Templates Core Infrastructure
-- Simplified approach building on existing workflows table (ID type: integer)
-- Based on WORKFLOW_TEMPLATES_SYSTEM_PLAN.md specification

-- Add template support flags to existing workflows
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS template_version INT DEFAULT 1;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS template_metadata JSONB DEFAULT '{}';

-- Self-referencing for template inheritance (workflows.id is integer)
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS base_template_id INT 
  REFERENCES workflows(id) ON DELETE SET NULL;

-- Template variables for parameterization
CREATE TABLE workflow_template_variables (
  id BIGSERIAL PRIMARY KEY,
  workflow_id INT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  var_name TEXT NOT NULL,
  description TEXT,
  required BOOLEAN DEFAULT TRUE,
  default_value TEXT,
  var_type VARCHAR(50) DEFAULT 'string',
  validation_pattern TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, var_name)
);

-- Template categories lookup
CREATE TABLE workflow_template_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category reference
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS category_id INT 
  REFERENCES workflow_template_categories(id) ON DELETE SET NULL;

-- Template usage tracking
CREATE TABLE workflow_template_usage (
  id BIGSERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  instantiated_workflow_id INT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variables_used JSONB DEFAULT '{}',
  instantiated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template) WHERE is_template = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflows_base_template ON workflows(base_template_id) WHERE base_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_template_variables_workflow ON workflow_template_variables(workflow_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON workflow_template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_user ON workflow_template_usage(user_id);

-- Insert default template categories
INSERT INTO workflow_template_categories (name, description, icon, sort_order) VALUES
('productivity', 'Productivity and task management workflows', 'productivity', 1),
('communication', 'Email, messaging, and collaboration workflows', 'communication', 2),
('knowledge', 'Information processing and knowledge management', 'knowledge', 3),
('automation', 'General automation and integration workflows', 'automation', 4),
('analytics', 'Data analysis and reporting workflows', 'analytics', 5),
('personal', 'Personal life and habit tracking workflows', 'personal', 6)
ON CONFLICT (name) DO NOTHING;