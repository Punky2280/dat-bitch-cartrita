-- Fix workflow automation schema compatibility issues
-- Update existing tables to be compatible with Phase A schema

-- First, check if workflow_executions.id is already UUID
DO $$
BEGIN
  -- Check if workflow_executions id is integer and convert to UUID if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_executions' 
    AND column_name = 'id' 
    AND data_type = 'integer'
  ) THEN
    -- Add new UUID column
    ALTER TABLE workflow_executions ADD COLUMN new_id UUID DEFAULT gen_random_uuid();
    
    -- Update new_id with UUIDs for existing rows
    UPDATE workflow_executions SET new_id = gen_random_uuid() WHERE new_id IS NULL;
    
    -- Drop old id column and rename new_id
    ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_pkey CASCADE;
    ALTER TABLE workflow_executions DROP COLUMN id;
    ALTER TABLE workflow_executions RENAME COLUMN new_id TO id;
    ALTER TABLE workflow_executions ADD PRIMARY KEY (id);
    
    RAISE NOTICE 'Converted workflow_executions.id from integer to UUID';
  ELSE
    RAISE NOTICE 'workflow_executions.id is already UUID compatible';
  END IF;
END $$;

-- Create workflow_execution_steps table if not exists
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

-- Create workflow_execution_logs table if not exists
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

-- Check if users table exists and has UUID id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    -- Create minimal users table if it doesn't exist
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    RAISE NOTICE 'Created minimal users table';
  END IF;
END $$;

-- Create workflow_templates table if not exists
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

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_execution ON workflow_execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_status ON workflow_execution_steps(status);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_execution ON workflow_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_step ON workflow_execution_logs(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_timestamp ON workflow_execution_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_level ON workflow_execution_logs(level);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_workflow_templates_featured ON workflow_templates(is_featured) WHERE is_featured = true;

-- Add triggers for updated_at
CREATE TRIGGER update_workflow_templates_updated_at 
    BEFORE UPDATE ON workflow_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update workflow_definitions if it's a view, convert to table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'workflow_definitions') THEN
    -- Drop the view and create proper table
    DROP VIEW workflow_definitions CASCADE;
    
    CREATE TABLE workflow_definitions (
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
    
    -- Create indexes for workflow_definitions table
    CREATE INDEX idx_workflow_definitions_owner ON workflow_definitions(owner_id);
    CREATE INDEX idx_workflow_definitions_active ON workflow_definitions(is_active) WHERE is_active = true;
    CREATE INDEX idx_workflow_definitions_trigger ON workflow_definitions(trigger_type);
    CREATE INDEX idx_workflow_definitions_updated ON workflow_definitions(updated_at);
    
    -- Add trigger for updated_at
    CREATE TRIGGER update_workflow_definitions_updated_at 
        BEFORE UPDATE ON workflow_definitions 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    RAISE NOTICE 'Converted workflow_definitions from view to table';
  ELSE
    RAISE NOTICE 'workflow_definitions is already a table or does not exist';
  END IF;
END $$;

COMMIT;