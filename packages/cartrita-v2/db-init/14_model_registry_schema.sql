-- Model Registry Schema
-- Creates tables for model registry, cost tracking, and performance monitoring
-- Author: Claude (Internal Developer Agent)
-- Date: August 2025

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Model Registry Table
CREATE TABLE IF NOT EXISTS models (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(100) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    task_types TEXT[] NOT NULL DEFAULT '{}',
    family VARCHAR(50),
    parameters_billion DECIMAL(8,3),
    architectural_type VARCHAR(50) DEFAULT 'decoder',
    license VARCHAR(100),
    commercial_allowed BOOLEAN DEFAULT false,
    context_length INTEGER DEFAULT 8192,
    quantizations TEXT[] DEFAULT '{"fp16"}',
    throughput_metadata JSONB DEFAULT '{}'::jsonb,
    avg_latency_ms_512_tokens INTEGER,
    quality_metrics JSONB DEFAULT '{}'::jsonb,
    safety_risk_level VARCHAR(20) DEFAULT 'medium' CHECK (safety_risk_level IN ('low', 'medium', 'high', 'critical')),
    default_temperature DECIMAL(3,2) DEFAULT 0.7,
    cost_profile JSONB DEFAULT '{}'::jsonb,
    routing_tags TEXT[] DEFAULT '{}',
    fallback_chain TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'testing', 'retired')),
    last_benchmark TIMESTAMP WITH TIME ZONE,
    risk_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Model Metrics Historical Table
CREATE TABLE IF NOT EXISTS model_metrics (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(100) NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    hardware_config VARCHAR(100),
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    measurement_context JSONB DEFAULT '{}'::jsonb
);

-- Cost Events Table
CREATE TABLE IF NOT EXISTS cost_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    model_id VARCHAR(100) NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    workflow_run_id VARCHAR(100),
    stage VARCHAR(100),
    supervisor VARCHAR(100),
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (tokens_in + tokens_out) STORED,
    latency_ms INTEGER,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    estimation_method VARCHAR(50),
    pipeline_context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Cost Aggregates Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS model_daily_costs AS
SELECT
    model_id,
    date_trunc('day', created_at) AS day,
    COUNT(*) AS total_calls,
    SUM(cost_usd) AS total_cost_usd,
    SUM(total_tokens) AS total_tokens,
    AVG(latency_ms) AS avg_latency_ms,
    AVG(cost_usd) AS avg_cost_per_call,
    SUM(cost_usd) / NULLIF(SUM(total_tokens) * 1000.0, 0) AS cost_per_1k_tokens
FROM cost_events
GROUP BY model_id, date_trunc('day', created_at);

-- Budget Tracking Table
CREATE TABLE IF NOT EXISTS budget_tracking (
    id SERIAL PRIMARY KEY,
    budget_name VARCHAR(100) NOT NULL,
    budget_type VARCHAR(50) DEFAULT 'daily' CHECK (budget_type IN ('hourly', 'daily', 'weekly', 'monthly')),
    limit_usd DECIMAL(10,2) NOT NULL,
    spent_usd DECIMAL(10,2) DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_end TIMESTAMP WITH TIME ZONE,
    alert_thresholds JSONB DEFAULT '{"warning": 0.7, "critical": 0.9, "hard_stop": 1.0}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model Performance Benchmarks
CREATE TABLE IF NOT EXISTS model_benchmarks (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(100) NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
    benchmark_name VARCHAR(100) NOT NULL,
    score DECIMAL(8,4),
    max_score DECIMAL(8,4),
    normalized_score DECIMAL(5,4) GENERATED ALWAYS AS (
        CASE WHEN max_score > 0 THEN score / max_score ELSE NULL END
    ) STORED,
    benchmark_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    benchmark_config JSONB DEFAULT '{}'::jsonb
);

-- Safety Evaluations
CREATE TABLE IF NOT EXISTS model_safety_evaluations (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(100) NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
    evaluation_type VARCHAR(50) NOT NULL,
    risk_score DECIMAL(5,4) CHECK (risk_score >= 0 AND risk_score <= 1),
    flagged_content_rate DECIMAL(5,4),
    evaluation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    evaluator_model VARCHAR(100),
    notes TEXT,
    evaluation_config JSONB DEFAULT '{}'::jsonb
);

-- Model Usage Analytics
CREATE TABLE IF NOT EXISTS model_usage_analytics (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(100) NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
    usage_date DATE DEFAULT CURRENT_DATE,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    fallback_triggered INTEGER DEFAULT 0,
    avg_response_time_ms DECIMAL(8,2),
    total_tokens_processed BIGINT DEFAULT 0,
    total_cost_usd DECIMAL(10,6) DEFAULT 0,
    efficiency_score DECIMAL(5,4),
    PRIMARY KEY (model_id, usage_date)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_routing_tags ON models USING GIN(routing_tags);
CREATE INDEX IF NOT EXISTS idx_models_task_types ON models USING GIN(task_types);

CREATE INDEX IF NOT EXISTS idx_cost_events_model_id ON cost_events(model_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_created_at ON cost_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_events_workflow ON cost_events(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_user_id ON cost_events(user_id);

CREATE INDEX IF NOT EXISTS idx_model_metrics_model_id ON model_metrics(model_id);
CREATE INDEX IF NOT EXISTS idx_model_metrics_measured_at ON model_metrics(measured_at);

CREATE INDEX IF NOT EXISTS idx_model_benchmarks_model_id ON model_benchmarks(model_id);
CREATE INDEX IF NOT EXISTS idx_model_benchmarks_date ON model_benchmarks(benchmark_date);

-- Functions for Cost Calculation
CREATE OR REPLACE FUNCTION calculate_cost_per_1k_tokens(
    hardware_hourly_usd DECIMAL,
    tokens_per_second INTEGER
) RETURNS DECIMAL AS $$
BEGIN
    RETURN hardware_hourly_usd / ((tokens_per_second * 3600.0) / 1000.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update model efficiency scores
CREATE OR REPLACE FUNCTION update_model_efficiency_scores() RETURNS void AS $$
BEGIN
    UPDATE models SET 
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{efficiency_score}',
            to_jsonb(
                COALESCE(
                    (quality_metrics->>'composite_score')::decimal / 
                    NULLIF((cost_profile->>'estimated_cost_per_1k_tokens_usd')::decimal, 0),
                    0
                )
            )
        ),
        updated_at = NOW()
    WHERE status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh materialized view daily
CREATE OR REPLACE FUNCTION refresh_model_daily_costs() RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW model_daily_costs;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_refresh_daily_costs') THEN
        CREATE TRIGGER trigger_refresh_daily_costs
            AFTER INSERT ON cost_events
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_model_daily_costs();
    END IF;
END;
$$;

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW model_daily_costs;