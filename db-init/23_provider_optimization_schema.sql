-- Provider Optimization Schema
-- Tables for intelligent provider selection and performance tracking

-- Provider metrics tracking
CREATE TABLE IF NOT EXISTS provider_metrics (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    task VARCHAR(100) NOT NULL,
    latency_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    cost DECIMAL(10, 8) DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Provider selection logging
CREATE TABLE IF NOT EXISTS provider_selections (
    id SERIAL PRIMARY KEY,
    task VARCHAR(100) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    selected_provider VARCHAR(50) NOT NULL,
    alternatives JSONB DEFAULT '[]',
    user_id INTEGER REFERENCES users(id),
    constraints JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Provider cost tracking
CREATE TABLE IF NOT EXISTS provider_costs (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    cost_per_unit DECIMAL(12, 10) NOT NULL,
    unit_type VARCHAR(50) NOT NULL, -- 'token', 'request', 'minute', etc.
    currency VARCHAR(3) DEFAULT 'USD',
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider, model, effective_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider_task ON provider_metrics(provider, task);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_timestamp ON provider_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_provider_selections_task ON provider_selections(task);
CREATE INDEX IF NOT EXISTS idx_provider_selections_user_id ON provider_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_costs_provider_model ON provider_costs(provider, model);

-- Insert initial cost data
INSERT INTO provider_costs (provider, model, cost_per_unit, unit_type) VALUES
    ('openai', 'gpt-4', 0.03, 'token_1k'),
    ('openai', 'gpt-4o-mini', 0.00015, 'token_1k'),
    ('openai', 'gpt-3.5-turbo', 0.002, 'token_1k'),
    ('openai', 'text-embedding-3-large', 0.00013, 'token_1k'),
    ('openai', 'text-embedding-3-small', 0.00002, 'token_1k'),
    ('openai', 'dall-e-3', 0.040, 'request'),
    ('openai', 'whisper-1', 0.006, 'minute'),
    ('huggingface', 'chat', 0.001, 'token_1k'),
    ('huggingface', 'embedding', 0.00005, 'token_1k'),
    ('huggingface', 'image-generation', 0.002, 'request'),
    ('huggingface', 'audio-transcription', 0.003, 'minute'),
    ('deepgram', 'nova-2', 0.0043, 'minute'),
    ('deepgram', 'base', 0.0025, 'minute'),
    ('deepgram', 'enhanced', 0.0059, 'minute')
ON CONFLICT (provider, model, effective_date) DO NOTHING;

-- Create views for analytics
CREATE OR REPLACE VIEW provider_performance_summary AS
SELECT 
    provider,
    task,
    COUNT(*) as request_count,
    AVG(latency_ms) as avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
    AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100 as success_rate_percent,
    SUM(cost) as total_cost,
    DATE_TRUNC('hour', timestamp) as hour_bucket
FROM provider_metrics 
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY provider, task, DATE_TRUNC('hour', timestamp)
ORDER BY hour_bucket DESC, request_count DESC;

CREATE OR REPLACE VIEW provider_selection_analysis AS
SELECT 
    task,
    strategy,
    selected_provider,
    COUNT(*) as selection_count,
    COUNT(DISTINCT user_id) as unique_users,
    DATE_TRUNC('day', timestamp) as day_bucket
FROM provider_selections 
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY task, strategy, selected_provider, DATE_TRUNC('day', timestamp)
ORDER BY day_bucket DESC, selection_count DESC;

-- Add comments
COMMENT ON TABLE provider_metrics IS 'Performance metrics for AI provider requests';
COMMENT ON TABLE provider_selections IS 'Log of provider selection decisions and rationale';
COMMENT ON TABLE provider_costs IS 'Cost structure for different providers and models';
COMMENT ON VIEW provider_performance_summary IS 'Aggregated performance metrics by provider and task';
COMMENT ON VIEW provider_selection_analysis IS 'Analysis of provider selection patterns over time';