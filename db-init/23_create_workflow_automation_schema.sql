-- Migration 23: Core Workflow Automation Platform Schema
-- PHASE_A_WORKFLOW_IMPLEMENTATION: Core workflow automation infrastructure
-- Created as part of unified workflow automation platform (n8n/Zapier parity)

-- Create workflow_definitions table
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_type VARCHAR(100) NOT NULL, -- webhook, schedule, manual, event
  trigger_config JSONB NOT NULL DEFAULT '{}',
  definition JSONB NOT NULL DEFAULT '{}', -- Complete workflow definition
  settings JSONB NOT NULL DEFAULT '{}', -- Execution settings, timeouts, etc
  tags TEXT[] DEFAULT '{}',
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  execution_count INTEGER DEFAULT 0,
  
  CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('webhook', 'schedule', 'manual', 'event'))
);

-- Create workflow_nodes table for node definitions and registry
CREATE TABLE IF NOT EXISTS workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type VARCHAR(100) NOT NULL, -- trigger, action, condition, transform
  category VARCHAR(100) NOT NULL,   -- http, database, ai, logic, etc
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  
  -- Node behavior configuration
  input_schema JSONB NOT NULL DEFAULT '{}',    -- JSON Schema for inputs
  output_schema JSONB NOT NULL DEFAULT '{}',   -- JSON Schema for outputs  
  properties_schema JSONB NOT NULL DEFAULT '{}', -- Configuration properties
  
  -- Execution settings
  supports_batching BOOLEAN DEFAULT false,
  max_batch_size INTEGER DEFAULT 1,
  timeout_ms INTEGER DEFAULT 30000,
  retry_policy JSONB DEFAULT '{"max_attempts": 3, "delay_ms": 1000}',
  
  -- Registry metadata
  is_builtin BOOLEAN DEFAULT true,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_node_type CHECK (node_type IN ('trigger', 'action', 'condition', 'transform'))
);

-- Create workflow_connectors table for external service integrations
CREATE TABLE IF NOT EXISTS workflow_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- ai, database, api, storage, communication
  icon VARCHAR(100),
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  
  -- Authentication configuration
  auth_type VARCHAR(50) NOT NULL DEFAULT 'none', -- none, api_key, oauth2, basic
  auth_schema JSONB NOT NULL DEFAULT '{}',
  
  -- Connection configuration
  base_url VARCHAR(500),
  default_headers JSONB DEFAULT '{}',
  rate_limit_config JSONB DEFAULT '{}',
  
  -- Capabilities
  supported_operations TEXT[] DEFAULT '{}',
  webhook_support BOOLEAN DEFAULT false,
  polling_support BOOLEAN DEFAULT false,
  
  -- Registry metadata
  is_builtin BOOLEAN DEFAULT true,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_auth_type CHECK (auth_type IN ('none', 'api_key', 'oauth2', 'basic', 'custom'))
);

-- Create workflow_executions table for execution tracking
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  trigger_data JSONB DEFAULT '{}',
  execution_context JSONB DEFAULT '{}',
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  error_stack TEXT,
  
  -- Execution metadata
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  failed_steps INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  
  -- Resource usage
  memory_usage_mb DECIMAL(10,2),
  cpu_time_ms INTEGER,
  network_requests INTEGER DEFAULT 0,
  
  CONSTRAINT valid_execution_status CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'timeout'))
);

-- Create workflow_execution_steps table for step-level tracking
CREATE TABLE IF NOT EXISTS workflow_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL, -- Node ID from workflow definition
  step_name VARCHAR(255) NOT NULL,
  step_type VARCHAR(100) NOT NULL,
  
  -- Step execution tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Step data
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_data JSONB DEFAULT '{}',
  
  -- Execution metadata
  retry_count INTEGER DEFAULT 0,
  memory_usage_mb DECIMAL(10,2),
  
  CONSTRAINT valid_step_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'retrying'))
);

-- Create workflow_execution_logs table for detailed logging
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES workflow_execution_steps(id) ON DELETE CASCADE,
  
  -- Log entry details
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  
  -- Log metadata
  source VARCHAR(100), -- node_id or system component
  correlation_id VARCHAR(100),
  
  CONSTRAINT valid_log_level CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal'))
);

-- Create workflow_templates table for reusable workflow templates
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- Template data
  template_data JSONB NOT NULL,
  preview_image VARCHAR(500),
  use_count INTEGER DEFAULT 0,
  
  -- Template metadata
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_owner ON workflow_definitions(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active ON workflow_definitions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_trigger ON workflow_definitions(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_updated ON workflow_definitions(updated_at);

CREATE INDEX IF NOT EXISTS idx_workflow_nodes_type_category ON workflow_nodes(node_type, category);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_enabled ON workflow_nodes(is_enabled) WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_workflow_connectors_category ON workflow_connectors(category);
CREATE INDEX IF NOT EXISTS idx_workflow_connectors_enabled ON workflow_connectors(is_enabled) WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON workflow_executions(started_at);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_execution ON workflow_execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_status ON workflow_execution_steps(status);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_execution ON workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_step ON workflow_execution_logs(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_timestamp ON workflow_execution_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_level ON workflow_execution_logs(level);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_workflow_templates_featured ON workflow_templates(is_featured) WHERE is_featured = true;

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflow_definitions_updated_at 
    BEFORE UPDATE ON workflow_definitions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_nodes_updated_at 
    BEFORE UPDATE ON workflow_nodes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_connectors_updated_at 
    BEFORE UPDATE ON workflow_connectors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_templates_updated_at 
    BEFORE UPDATE ON workflow_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial builtin nodes and connectors
INSERT INTO workflow_nodes (node_type, category, name, display_name, description, input_schema, output_schema, properties_schema) VALUES
-- Trigger nodes
('trigger', 'http', 'webhook_trigger', 'Webhook Trigger', 'Triggers workflow when HTTP request is received', 
 '{}', '{"type": "object", "properties": {"body": {}, "headers": {}, "query": {}}}', 
 '{"type": "object", "properties": {"path": {"type": "string"}, "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"]}}}'),

('trigger', 'schedule', 'schedule_trigger', 'Schedule Trigger', 'Triggers workflow on schedule', 
 '{}', '{"type": "object", "properties": {"timestamp": {"type": "string"}}}', 
 '{"type": "object", "properties": {"cron": {"type": "string"}, "timezone": {"type": "string"}}}'),

-- Action nodes  
('action', 'http', 'http_request', 'HTTP Request', 'Make HTTP request to external API', 
 '{"type": "object", "properties": {"url": {"type": "string"}, "method": {"type": "string"}, "body": {}, "headers": {}}}', 
 '{"type": "object", "properties": {"status": {"type": "number"}, "body": {}, "headers": {}}}',
 '{"type": "object", "properties": {"timeout": {"type": "number", "default": 30000}, "retry_count": {"type": "number", "default": 3}}}'),

('action', 'logic', 'delay', 'Delay', 'Wait for specified amount of time', 
 '{"type": "object", "properties": {"delay_ms": {"type": "number"}}}', '{}',
 '{"type": "object", "properties": {"max_delay": {"type": "number", "default": 300000}}}'),

-- Transform nodes
('transform', 'data', 'json_transform', 'JSON Transform', 'Transform JSON data using expressions', 
 '{"type": "object"}', '{"type": "object"}',
 '{"type": "object", "properties": {"mappings": {"type": "object"}, "expression": {"type": "string"}}}'),

-- Condition nodes
('condition', 'logic', 'condition', 'Condition', 'Conditional branching based on expression', 
 '{"type": "object"}', '{"type": "object", "properties": {"result": {"type": "boolean"}}}',
 '{"type": "object", "properties": {"expression": {"type": "string"}, "true_path": {"type": "string"}, "false_path": {"type": "string"}}}')

ON CONFLICT DO NOTHING;

-- Insert initial builtin connectors
INSERT INTO workflow_connectors (name, display_name, description, category, auth_type, supported_operations) VALUES
('http', 'HTTP/REST API', 'Generic HTTP/REST API connector', 'api', 'none', ARRAY['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
('openai', 'OpenAI', 'OpenAI API integration', 'ai', 'api_key', ARRAY['chat', 'completion', 'embedding', 'image', 'audio']),
('webhook', 'Webhook', 'Webhook receiver and sender', 'communication', 'none', ARRAY['receive', 'send']),
('schedule', 'Schedule', 'Time-based triggers', 'utility', 'none', ARRAY['cron', 'interval', 'delay'])

ON CONFLICT DO NOTHING;

-- Commit transaction
COMMIT;