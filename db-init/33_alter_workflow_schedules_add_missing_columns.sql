-- 33_alter_workflow_schedules_add_missing_columns.sql
-- Add missing columns to workflow_schedules table for Component 5

-- Add missing columns to workflow_schedules
ALTER TABLE workflow_schedules 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update the schedule_type constraint to include new types
ALTER TABLE workflow_schedules 
DROP CONSTRAINT IF EXISTS workflow_schedules_schedule_type_check;

ALTER TABLE workflow_schedules
ADD CONSTRAINT workflow_schedules_schedule_type_check 
CHECK (schedule_type IN ('cron', 'event', 'conditional', 'batch', 'calendar', 'interval', 'once'));

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_user_id ON workflow_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_priority ON workflow_schedules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_config ON workflow_schedules USING GIN(configuration);

-- Update existing records to have default values
UPDATE workflow_schedules 
SET 
    user_id = COALESCE((SELECT id FROM users LIMIT 1), 1),
    name = COALESCE(name, 'Legacy Schedule ' || id),
    configuration = COALESCE(configuration, '{"cronExpression": "0 9 * * *", "timezone": "UTC"}'::jsonb),
    priority = COALESCE(priority, 5),
    metadata = COALESCE(metadata, '{}'::jsonb)
WHERE user_id IS NULL OR name IS NULL OR configuration IS NULL OR priority IS NULL OR metadata IS NULL;

-- Make user_id and name NOT NULL after updating
ALTER TABLE workflow_schedules 
ALTER COLUMN user_id SET NOT NULL,
ALTER COLUMN name SET NOT NULL;

-- Recreate the materialized view with correct column names
DROP MATERIALIZED VIEW IF EXISTS workflow_schedule_performance_overview;
CREATE MATERIALIZED VIEW workflow_schedule_performance_overview AS
SELECT 
    ws.id,
    ws.name,
    ws.schedule_type,
    ws.is_active,
    ws.priority,
    COUNT(wse.id) as total_executions,
    COUNT(CASE WHEN wse.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN wse.status = 'failed' THEN 1 END) as failed_executions,
    COUNT(CASE WHEN wse.status = 'skipped' THEN 1 END) as skipped_executions,
    ROUND(AVG(wse.execution_duration_ms)) as avg_execution_time_ms,
    MAX(wse.started_at) as last_execution_at,
    CASE 
        WHEN COUNT(wse.id) = 0 THEN 0
        ELSE ROUND((COUNT(CASE WHEN wse.status = 'completed' THEN 1 END)::numeric / COUNT(wse.id)::numeric) * 100, 2)
    END as success_rate_percentage
FROM workflow_schedules ws
LEFT JOIN workflow_schedule_executions wse ON ws.id = wse.schedule_id
    AND wse.started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ws.id, ws.name, ws.schedule_type, ws.is_active, ws.priority;

-- Create unique index for the materialized view
CREATE UNIQUE INDEX idx_schedule_performance_overview_id ON workflow_schedule_performance_overview(id);

-- Also add a workflow_definitions table reference if it doesn't exist
-- (The frontend expects workflow_definitions but we have workflows table)
CREATE VIEW IF NOT EXISTS workflow_definitions AS 
SELECT 
    id,
    name,
    description,
    workflow_data as definition,
    is_active,
    created_at,
    updated_at,
    user_id
FROM workflows;
