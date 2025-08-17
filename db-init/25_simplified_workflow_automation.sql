-- Phase A Simplified Workflow Schema (Compatible with existing system)
-- Creates workflow automation tables without breaking existing schema

-- Drop existing views that conflict
DROP VIEW IF EXISTS workflow_recent_activity CASCADE;
DROP VIEW IF EXISTS workflow_performance_metrics CASCADE;
DROP VIEW IF EXISTS workflow_dashboard_summary CASCADE;

-- Check existing users table structure
DO $$
BEGIN
  -- Convert users.id to UUID if it's integer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'id' 
    AND data_type = 'integer'
  ) THEN
    -- For simplicity, work with integer IDs and convert references
    RAISE NOTICE 'Working with integer user IDs';
  END IF;
END $$;

-- Update workflow_executions to use UUID and drop constraints
ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_pkey CASCADE;
ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_workflow_id_fkey CASCADE;
ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_user_id_fkey CASCADE;

-- Add UUID column and update
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS uuid_id UUID DEFAULT gen_random_uuid();
UPDATE workflow_executions SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;

-- Rename columns
ALTER TABLE workflow_executions RENAME COLUMN id TO old_id;
ALTER TABLE workflow_executions RENAME COLUMN uuid_id TO id;
ALTER TABLE workflow_executions ADD PRIMARY KEY (id);

-- Create Phase A workflow tables (simplified)
CREATE TABLE IF NOT EXISTS workflow_automation_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_type VARCHAR(100) NOT NULL DEFAULT 'manual',
  trigger_config JSONB NOT NULL DEFAULT '{}',
  definition JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  owner_id INTEGER, -- Keep as integer for compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  execution_count INTEGER DEFAULT 0,
  
  CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('webhook', 'schedule', 'manual', 'event'))
);

-- Create execution steps table (references workflow_executions by UUID)
CREATE TABLE IF NOT EXISTS workflow_automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_data JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 0,
  
  CONSTRAINT valid_step_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'retrying'))
);

-- Create execution logs table
CREATE TABLE IF NOT EXISTS workflow_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES workflow_automation_steps(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  source VARCHAR(100),
  correlation_id VARCHAR(100),
  
  CONSTRAINT valid_log_level CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal'))
);

-- Create templates table (without foreign key to users for now)
CREATE TABLE IF NOT EXISTS workflow_automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  template_data JSONB NOT NULL,
  preview_image VARCHAR(500),
  use_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_by INTEGER, -- Keep as integer for compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_automation_definitions_owner ON workflow_automation_definitions(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflow_automation_definitions_active ON workflow_automation_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_automation_definitions_trigger ON workflow_automation_definitions(trigger_type);

CREATE INDEX IF NOT EXISTS idx_workflow_automation_steps_execution ON workflow_automation_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_automation_steps_status ON workflow_automation_steps(status);

CREATE INDEX IF NOT EXISTS idx_workflow_automation_logs_execution ON workflow_automation_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_automation_logs_timestamp ON workflow_automation_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_workflow_automation_logs_level ON workflow_automation_logs(level);

CREATE INDEX IF NOT EXISTS idx_workflow_automation_templates_category ON workflow_automation_templates(category);

-- Create update triggers
CREATE TRIGGER update_workflow_automation_definitions_updated_at 
    BEFORE UPDATE ON workflow_automation_definitions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_automation_templates_updated_at 
    BEFORE UPDATE ON workflow_automation_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial builtin nodes (into existing workflow_nodes table)
INSERT INTO workflow_nodes (node_type, category, name, display_name, description, input_schema, output_schema, properties_schema) VALUES
-- HTTP nodes
('action', 'http', 'http_request', 'HTTP Request', 'Make HTTP request to external API', 
 '{"type": "object", "properties": {"url": {"type": "string"}, "method": {"type": "string"}}}', 
 '{"type": "object", "properties": {"status": {"type": "number"}, "body": {}}}',
 '{"type": "object", "properties": {"timeout": {"type": "number", "default": 30000}}}'),

-- Logic nodes
('transform', 'data', 'data_transform', 'Data Transform', 'Transform data using expressions', 
 '{"type": "object"}', '{"type": "object"}',
 '{"type": "object", "properties": {"expression": {"type": "string"}}}'),

('condition', 'logic', 'if_condition', 'If Condition', 'Conditional branching', 
 '{"type": "object"}', '{"type": "object", "properties": {"result": {"type": "boolean"}}}',
 '{"type": "object", "properties": {"condition": {"type": "string"}}}')

ON CONFLICT (name, node_type, category) DO NOTHING;

-- Insert initial connectors (into existing workflow_connectors table)  
INSERT INTO workflow_connectors (name, display_name, description, category, auth_type, supported_operations) VALUES
('http_client', 'HTTP Client', 'Generic HTTP client for API calls', 'api', 'none', ARRAY['GET', 'POST', 'PUT', 'DELETE']),
('webhook_receiver', 'Webhook Receiver', 'Receive webhook notifications', 'communication', 'none', ARRAY['receive']),
('expression_evaluator', 'Expression Evaluator', 'Evaluate JavaScript expressions', 'utility', 'none', ARRAY['evaluate'])

ON CONFLICT (name) DO NOTHING;

COMMIT;