-- Update database schema for enhanced agent integration
-- Add missing columns to chat_messages table

-- Add tools_used column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' 
                   AND column_name = 'tools_used') THEN
        ALTER TABLE chat_messages ADD COLUMN tools_used JSONB;
    END IF;
END $$;

-- Add execution_details column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' 
                   AND column_name = 'execution_details') THEN
        ALTER TABLE chat_messages ADD COLUMN execution_details JSONB;
    END IF;
END $$;

-- Add agent_capabilities table for enhanced agent management
CREATE TABLE IF NOT EXISTS agent_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    capability VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    configuration JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add agent_sessions table for tracking agent usage
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB,
    performance_metrics JSONB
);

-- Add mcp_tools table for MCP integration tracking
CREATE TABLE IF NOT EXISTS mcp_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_name VARCHAR(255) NOT NULL,
    tool_name VARCHAR(255) NOT NULL,
    description TEXT,
    parameters JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_name, tool_name)
);

-- Add mcp_executions table for tracking MCP tool usage
CREATE TABLE IF NOT EXISTS mcp_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    server_name VARCHAR(255) NOT NULL,
    tool_name VARCHAR(255) NOT NULL,
    parameters JSONB,
    result JSONB,
    execution_time INTEGER, -- milliseconds
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add langchain_chains table for LangChain integration
CREATE TABLE IF NOT EXISTS langchain_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    chain_type VARCHAR(100),
    configuration JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add langchain_executions table for tracking chain usage
CREATE TABLE IF NOT EXISTS langchain_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    chain_name VARCHAR(255) NOT NULL,
    inputs JSONB,
    outputs JSONB,
    execution_time INTEGER, -- milliseconds
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_tools_used ON chat_messages USING gin(tools_used);
CREATE INDEX IF NOT EXISTS idx_chat_messages_execution_details ON chat_messages USING gin(execution_details);
CREATE INDEX IF NOT EXISTS idx_agent_capabilities_agent_id ON agent_capabilities(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_server_tool ON mcp_tools(server_name, tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_executions_message_id ON mcp_executions(message_id);
CREATE INDEX IF NOT EXISTS idx_langchain_executions_message_id ON langchain_executions(message_id);

-- Insert default agent capabilities
INSERT INTO agent_capabilities (agent_id, capability, enabled, configuration) VALUES
    ('supervisor', 'COORDINATION', TRUE, '{"priority": "high", "auto_delegate": true}'),
    ('supervisor', 'TASK_MANAGEMENT', TRUE, '{"max_concurrent_tasks": 5}'),
    ('research_specialist', 'RESEARCH', TRUE, '{"sources": ["web", "academic", "technical"]}'),
    ('research_specialist', 'DATA_ANALYSIS', TRUE, '{"formats": ["csv", "json", "xml"]}'),
    ('content_writer', 'CONTENT_CREATION', TRUE, '{"styles": ["technical", "creative", "academic"]}'),
    ('vision_analyst', 'COMPUTER_VISION', TRUE, '{"formats": ["jpg", "png", "pdf", "svg"]}'),
    ('computer_use_agent', 'AUTOMATION', TRUE, '{"platforms": ["desktop", "web", "mobile"]}'),
    ('code_writer', 'CODE_GENERATION', TRUE, '{"languages": ["python", "javascript", "typescript", "java", "c++"]}'),
    ('data_scientist', 'DATA_SCIENCE', TRUE, '{"libraries": ["pandas", "numpy", "sklearn", "tensorflow"]}'),
    ('cybersecurity_expert', 'SECURITY_ANALYSIS', TRUE, '{"scopes": ["web", "network", "code", "infrastructure"]}'),
    ('financial_analyst', 'FINANCIAL_ANALYSIS', TRUE, '{"markets": ["stocks", "crypto", "forex", "commodities"]}'),
    ('health_wellness_advisor', 'HEALTH_GUIDANCE', TRUE, '{"areas": ["nutrition", "fitness", "mental_health"]}'),
    ('educational_tutor', 'EDUCATION', TRUE, '{"subjects": ["math", "science", "languages", "programming"]}'),
    ('project_manager', 'PROJECT_MANAGEMENT', TRUE, '{"methodologies": ["agile", "waterfall", "kanban"]}'),
    ('emotional_support_agent', 'EMOTIONAL_SUPPORT', TRUE, '{"approaches": ["cognitive", "mindfulness", "empathetic"]}'),
    ('comedian_agent', 'ENTERTAINMENT', TRUE, '{"styles": ["observational", "wordplay", "situational"]}'),
    ('api_key_manager', 'API_MANAGEMENT', TRUE, '{"services": ["openai", "anthropic", "google", "azure"]}'')
ON CONFLICT (agent_id, capability) DO NOTHING;

-- Insert default MCP tools
INSERT INTO mcp_tools (server_name, tool_name, description, parameters, enabled) VALUES
    ('cartrita_tools_server', 'web_search', 'Search the web for information', '{"query": {"type": "string", "required": true}}', TRUE),
    ('cartrita_tools_server', 'file_operations', 'Read and write files', '{"operation": {"type": "string"}, "path": {"type": "string"}}', TRUE),
    ('data_analysis_server', 'analyze_data', 'Analyze data using pandas and numpy', '{"data": {"type": "object"}, "operation": {"type": "string"}}', TRUE),
    ('computer_use_server', 'screenshot', 'Take a screenshot', '{"region": {"type": "object", "required": false}}', TRUE),
    ('computer_use_server', 'click', 'Click at coordinates', '{"x": {"type": "number"}, "y": {"type": "number"}}', TRUE)
ON CONFLICT (server_name, tool_name) DO NOTHING;

-- Insert default LangChain chains
INSERT INTO langchain_chains (chain_name, description, chain_type, configuration, enabled) VALUES
    ('conversation_chain', 'Basic conversation with memory', 'ConversationChain', '{"memory_type": "buffer", "max_tokens": 1000}', TRUE),
    ('retrieval_qa_chain', 'Question answering with document retrieval', 'RetrievalQA', '{"chunk_size": 500, "overlap": 100}', TRUE),
    ('research_chain', 'Multi-step research with web search and synthesis', 'SequentialChain', '{"steps": ["search", "analyze", "synthesize"]}', TRUE),
    ('code_analysis_chain', 'Code analysis and review', 'CodeReviewChain', '{"languages": ["python", "javascript", "typescript"]}', TRUE),
    ('creative_writing_chain', 'Creative content generation', 'CreativeChain', '{"styles": ["story", "poem", "article"]}', TRUE)
ON CONFLICT (chain_name) DO NOTHING;