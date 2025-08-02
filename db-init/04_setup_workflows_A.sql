-- =====================================================
-- WORKFLOW AUTOMATION SYSTEM - Database Schema
-- =====================================================

-- Workflows table - stores workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_data JSONB NOT NULL, -- Stores nodes, connections, positions
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,
    category VARCHAR(100) DEFAULT 'custom',
    tags TEXT[], -- Array of tags for categorization
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow executions table - stores execution history
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'running', -- running, completed, failed, cancelled
    trigger_type VARCHAR(50), -- manual, scheduled, webhook, api
    input_data JSONB,
    output_data JSONB,
    execution_logs JSONB[], -- Array of execution step logs
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_time_ms INTEGER
);

-- Workflow schedules table - for scheduled workflows
CREATE TABLE IF NOT EXISTS workflow_schedules (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow webhooks table - for webhook triggers
CREATE TABLE IF NOT EXISTS workflow_webhooks (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    webhook_url VARCHAR(255) UNIQUE NOT NULL,
    webhook_token VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow shared data table - for data shared between workflow runs
CREATE TABLE IF NOT EXISTS workflow_shared_data (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_key VARCHAR(255) NOT NULL,
    data_value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id, data_key)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_run_at ON workflow_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_workflow_webhooks_webhook_url ON workflow_webhooks(webhook_url);

-- Insert some default workflow templates (using a system user approach)
INSERT INTO workflows (user_id, name, description, workflow_data, is_template, category, tags) 
SELECT 
    u.id as user_id,
    template.name,
    template.description,
    template.workflow_data::jsonb,
    template.is_template,
    template.category,
    template.tags
FROM (
    SELECT 'AI Chat Assistant' as name, 'Simple AI chat workflow using GPT-4' as description, 
           '{"nodes":[{"id":"trigger","type":"manual-trigger","position":{"x":100,"y":100},"data":{"label":"Manual Trigger"}},{"id":"ai","type":"ai-gpt4","position":{"x":300,"y":100},"data":{"label":"GPT-4","model":"gpt-4","prompt":"You are a helpful assistant. Respond to: {{input}}"}}],"edges":[{"id":"e1","source":"trigger","target":"ai"}]}' as workflow_data,
           true as is_template, 'ai' as category, ARRAY['ai', 'chat', 'gpt'] as tags
    UNION ALL
    SELECT 'RAG Document Search', 'Document search using RAG pipeline', 
           '{"nodes":[{"id":"trigger","type":"manual-trigger","position":{"x":100,"y":100},"data":{"label":"Manual Trigger"}},{"id":"embed","type":"rag-embeddings","position":{"x":300,"y":100},"data":{"label":"Generate Embeddings"}},{"id":"search","type":"rag-search","position":{"x":500,"y":100},"data":{"label":"Vector Search"}},{"id":"ai","type":"ai-gpt4","position":{"x":700,"y":100},"data":{"label":"GPT-4","prompt":"Based on the context: {{context}}, answer: {{query}}"}}],"edges":[{"id":"e1","source":"trigger","target":"embed"},{"id":"e2","source":"embed","target":"search"},{"id":"e3","source":"search","target":"ai"}]}',
           true, 'rag', ARRAY['rag', 'search', 'documents']
    UNION ALL
    SELECT 'Multi-Agent Workflow', 'Orchestrate multiple MCP agents', 
           '{"nodes":[{"id":"trigger","type":"manual-trigger","position":{"x":100,"y":100},"data":{"label":"Manual Trigger"}},{"id":"writer","type":"mcp-writer","position":{"x":300,"y":50},"data":{"label":"Writer Agent"}},{"id":"coder","type":"mcp-coder","position":{"x":300,"y":150},"data":{"label":"Code Writer Agent"}},{"id":"merge","type":"logic-merge","position":{"x":500,"y":100},"data":{"label":"Merge Results"}}],"edges":[{"id":"e1","source":"trigger","target":"writer"},{"id":"e2","source":"trigger","target":"coder"},{"id":"e3","source":"writer","target":"merge"},{"id":"e4","source":"coder","target":"merge"}]}',
           true, 'agents', ARRAY['mcp', 'agents', 'multi-agent']
) template
CROSS JOIN (SELECT id FROM users ORDER BY id LIMIT 1) u
WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE is_template = true);

-- ✅ Workflow system database schema created