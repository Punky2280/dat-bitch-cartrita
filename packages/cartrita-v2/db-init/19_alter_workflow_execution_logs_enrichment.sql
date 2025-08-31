-- 19_alter_workflow_execution_logs_enrichment.sql
-- Adds enrichment columns to workflow_execution_logs for tracing correlation & metadata.

ALTER TABLE workflow_execution_logs ADD COLUMN IF NOT EXISTS span_id VARCHAR(64);
ALTER TABLE workflow_execution_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE workflow_execution_logs ADD COLUMN IF NOT EXISTS meta_tags TEXT[];
ALTER TABLE workflow_execution_logs ADD COLUMN IF NOT EXISTS error_stack TEXT;

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_span_id ON workflow_execution_logs(span_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_meta_tags ON workflow_execution_logs USING GIN(meta_tags);
