-- Migration 27: V2 Agent Model Configuration and GPT-5 Integration
-- Created: 2025-01-27
-- Purpose: Add comprehensive V2 support with GPT-5 optimization

-- Agent Model Assignments Table
CREATE TABLE IF NOT EXISTS agent_model_assignments (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL UNIQUE,
    model_name VARCHAR(100) NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    reasoning_level VARCHAR(20) DEFAULT 'medium',
    verbosity_level VARCHAR(20) DEFAULT 'medium',
    features JSONB DEFAULT '[]'::jsonb,
    rationale TEXT,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Tracking for V2
CREATE TABLE IF NOT EXISTS v2_performance_metrics (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    request_type VARCHAR(50),
    response_time_ms INTEGER,
    token_usage JSONB,
    cost_usd DECIMAL(10,6),
    reasoning_complexity VARCHAR(20),
    verbosity_used VARCHAR(20),
    success BOOLEAN DEFAULT true,
    error_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Model Switch Tracking
CREATE TABLE IF NOT EXISTS model_switch_log (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(100) NOT NULL,
    from_model VARCHAR(100),
    to_model VARCHAR(100) NOT NULL,
    switch_reason VARCHAR(255),
    performance_impact JSONB,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial agent model assignments
INSERT INTO agent_model_assignments (agent_name, model_name, temperature, reasoning_level, verbosity_level, features, rationale) VALUES
('supervisor', 'gpt-5', 0.3, 'high', 'high', '["freeform_calling", "context_free_grammar", "minimal_reasoning"]', 'Complex orchestration and delegation decisions'),
('computer_use', 'gpt-5-fast', 0.1, 'medium', 'low', '["minimal_reasoning", "speed_optimization"]', 'Precise computer control with safety validation'),
('code_maestro', 'gpt-5', 0.2, 'high', 'high', '["freeform_calling", "context_free_grammar"]', 'Complex code generation and refactoring'),
('architect', 'gpt-5', 0.3, 'high', 'high', '["freeform_calling", "context_free_grammar"]', 'System architecture and design decisions'),
('analytics', 'gpt-5', 0.3, 'high', 'medium', '["freeform_calling", "minimal_reasoning"]', 'Complex data analysis and insights'),
('workflow_maestro', 'gpt-5', 0.3, 'high', 'medium', '["freeform_calling", "context_free_grammar"]', 'Complex workflow orchestration'),
('writer', 'gpt-5-mini', 0.8, 'medium', 'high', '["cost_effective", "balanced_performance"]', 'Creative writing with balanced performance'),
('researcher', 'gpt-5-mini', 0.5, 'medium', 'medium', '["cost_effective", "balanced_performance"]', 'Information gathering and synthesis'),
('integration', 'gpt-5-mini', 0.5, 'medium', 'low', '["cost_effective"]', 'API integration and data processing'),
('security', 'gpt-5', 0.3, 'high', 'low', '["freeform_calling", "minimal_reasoning"]', 'Security analysis requires high reasoning'),
('artist', 'gpt-5-mini', 0.8, 'medium', 'medium', '["cost_effective", "balanced_performance"]', 'Creative visual generation with cost efficiency'),
('file_organizer', 'gpt-5-nano', 0.2, 'minimal', 'low', '["ultra_lightweight", "fast_response"]', 'Simple file operations'),
('knowledge_curator', 'gpt-5-mini', 0.5, 'medium', 'medium', '["cost_effective", "balanced_performance"]', 'Knowledge organization and retrieval'),
('hf_language', 'gpt-5-nano', 0.2, 'minimal', 'low', '["ultra_lightweight", "fast_response"]', 'Bridge to HF models, minimal reasoning needed'),
('hf_vision', 'gpt-5-nano', 0.2, 'minimal', 'low', '["ultra_lightweight", "fast_response"]', 'Bridge to HF models, minimal reasoning needed'),
('hf_audio', 'gpt-5-nano', 0.2, 'minimal', 'low', '["ultra_lightweight", "fast_response"]', 'Bridge to HF models, minimal reasoning needed')
ON CONFLICT (agent_name) DO UPDATE SET
    model_name = EXCLUDED.model_name,
    temperature = EXCLUDED.temperature,
    reasoning_level = EXCLUDED.reasoning_level,
    verbosity_level = EXCLUDED.verbosity_level,
    features = EXCLUDED.features,
    rationale = EXCLUDED.rationale,
    updated_at = CURRENT_TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_model_assignments_agent_name ON agent_model_assignments(agent_name);
CREATE INDEX IF NOT EXISTS idx_v2_performance_metrics_agent_name ON v2_performance_metrics(agent_name);
CREATE INDEX IF NOT EXISTS idx_v2_performance_metrics_created_at ON v2_performance_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_model_switch_log_agent_name ON model_switch_log(agent_name);

-- Update trigger for agent_model_assignments
CREATE OR REPLACE FUNCTION update_agent_model_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_agent_model_assignments_updated_at ON agent_model_assignments;
CREATE TRIGGER trigger_update_agent_model_assignments_updated_at
    BEFORE UPDATE ON agent_model_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_model_assignments_updated_at();