-- Migration: Create structured outputs table for enhanced queryability
-- Date: January 2025
-- Author: Robbie Allen - Lead Architect
-- Purpose: Dedicated table for structured outputs with advanced indexing and querying capabilities

-- Create structured outputs table
CREATE TABLE IF NOT EXISTS structured_outputs (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255),
    agent VARCHAR(100) NOT NULL,
    task VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (status IN ('success', 'error', 'warning', 'info')),
    confidence DECIMAL(4,3) CHECK (confidence >= 0 AND confidence <= 1),
    data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_structured_outputs_user_id ON structured_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_conversation_id ON structured_outputs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_agent ON structured_outputs(agent);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_task ON structured_outputs(task);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_status ON structured_outputs(status);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_created_at ON structured_outputs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_confidence ON structured_outputs(confidence DESC) WHERE confidence IS NOT NULL;

-- JSONB indexes for metadata and data fields
CREATE INDEX IF NOT EXISTS idx_structured_outputs_data_gin ON structured_outputs USING gin(data);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_metadata_gin ON structured_outputs USING gin(metadata);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_structured_outputs_user_task_created ON structured_outputs(user_id, task, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_conversation_agent ON structured_outputs(conversation_id, agent);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_agent_status_created ON structured_outputs(agent, status, created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_structured_outputs_updated_at()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_structured_outputs_updated_at ON structured_outputs;
CREATE TRIGGER trigger_structured_outputs_updated_at
    BEFORE UPDATE ON structured_outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_structured_outputs_updated_at();

-- Create view for enhanced structured output analytics
CREATE OR REPLACE VIEW structured_output_analytics AS
SELECT 
    agent,
    task,
    status,
    COUNT(*) as count,
    AVG(confidence) as avg_confidence,
    MIN(created_at) as first_output,
    MAX(created_at) as last_output,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT conversation_id) as unique_conversations,
    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 3600 as timespan_hours
FROM structured_outputs
GROUP BY agent, task, status
ORDER BY count DESC;

-- Create view for user structured output summary
CREATE OR REPLACE VIEW user_structured_output_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(so.id) as total_outputs,
    COUNT(DISTINCT so.agent) as unique_agents,
    COUNT(DISTINCT so.task) as unique_tasks,
    COUNT(DISTINCT so.conversation_id) as unique_conversations,
    AVG(so.confidence) as avg_confidence,
    MIN(so.created_at) as first_output,
    MAX(so.created_at) as last_output,
    COUNT(CASE WHEN so.status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN so.status = 'error' THEN 1 END) as error_count,
    COUNT(CASE WHEN so.status = 'warning' THEN 1 END) as warning_count,
    COUNT(CASE WHEN so.status = 'info' THEN 1 END) as info_count
FROM users u
LEFT JOIN structured_outputs so ON u.id = so.user_id
GROUP BY u.id, u.email
ORDER BY total_outputs DESC;

-- Create indexes on views for better performance
CREATE INDEX IF NOT EXISTS idx_structured_output_analytics_agent ON structured_outputs(agent, task, status);
CREATE INDEX IF NOT EXISTS idx_user_structured_output_summary_user ON structured_outputs(user_id, status);

-- Add comments for documentation
COMMENT ON TABLE structured_outputs IS 'Dedicated table for AI agent structured outputs with advanced querying capabilities';
COMMENT ON COLUMN structured_outputs.id IS 'Unique identifier for the structured output (UUID format)';
COMMENT ON COLUMN structured_outputs.user_id IS 'Reference to the user who generated this output';
COMMENT ON COLUMN structured_outputs.conversation_id IS 'Reference to the conversation that generated this output';
COMMENT ON COLUMN structured_outputs.agent IS 'Name of the AI agent that generated this output';
COMMENT ON COLUMN structured_outputs.task IS 'Type of task/analysis performed (sentiment_analysis, code_analysis, etc.)';
COMMENT ON COLUMN structured_outputs.status IS 'Status of the output (success, error, warning, info)';
COMMENT ON COLUMN structured_outputs.confidence IS 'Confidence score between 0 and 1';
COMMENT ON COLUMN structured_outputs.data IS 'The structured output data in JSONB format';
COMMENT ON COLUMN structured_outputs.metadata IS 'Additional metadata about the output generation';

COMMENT ON VIEW structured_output_analytics IS 'Aggregated analytics for structured outputs by agent, task, and status';
COMMENT ON VIEW user_structured_output_summary IS 'Per-user summary of structured output activity and performance';

-- Grant permissions (adjust based on your user setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON structured_outputs TO your_app_user;
-- GRANT SELECT ON structured_output_analytics, user_structured_output_summary TO your_app_user;
