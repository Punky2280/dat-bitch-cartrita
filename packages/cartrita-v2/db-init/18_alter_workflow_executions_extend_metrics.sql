-- 18_alter_workflow_executions_extend_metrics.sql
-- Add richer execution metrics & summary fields.
-- Additive only.

ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS node_count INTEGER;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS success_node_count INTEGER;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS failed_node_count INTEGER;
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS failure_type VARCHAR(64);
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS latency_bucket VARCHAR(32); -- e.g. p50|p75|p90|p95|p99
ALTER TABLE workflow_executions ADD COLUMN IF NOT EXISTS summary_text TEXT;

-- Partial index to accelerate active/running lookups
CREATE INDEX IF NOT EXISTS idx_workflow_exec_running ON workflow_executions(status) WHERE status IN ('pending','running');

-- Histogram support: we may bucket durations later; keep index on latency_bucket
CREATE INDEX IF NOT EXISTS idx_workflow_exec_latency_bucket ON workflow_executions(latency_bucket);
