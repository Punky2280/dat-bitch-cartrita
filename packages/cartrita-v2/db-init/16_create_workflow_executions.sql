-- 16_create_workflow_executions.sql
-- Adds workflow_executions + workflow_execution_logs tables (initial minimal shape)
-- Referenced by execution monitoring UI. Extend (do not modify) in later migrations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending|running|completed|failed|canceled
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    input_data JSONB,
    output_data JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

CREATE TABLE IF NOT EXISTS workflow_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    level VARCHAR(16) DEFAULT 'info', -- info|warn|error|debug|success
    message TEXT NOT NULL,
    node_id VARCHAR(128),
    data JSONB
);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_execution ON workflow_execution_logs(execution_id, timestamp);
