-- 17_alter_workflow_executions_extend.sql
-- Align workflow_executions schema with EnhancedWorkflowEngine expectations.
-- Adds user linkage, trigger metadata, execution logs, timing, and error_message fields.
-- (Additive migration – do NOT modify 16_create_workflow_executions.sql)

ALTER TABLE workflow_executions
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE workflow_executions
    ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(32) DEFAULT 'manual';

ALTER TABLE workflow_executions
    ADD COLUMN IF NOT EXISTS execution_logs JSONB;

ALTER TABLE workflow_executions
    ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;

ALTER TABLE workflow_executions
    ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Helpful index for per-user lookups
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user ON workflow_executions(user_id, started_at DESC);
