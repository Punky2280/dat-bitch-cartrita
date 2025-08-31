-- Migration 28: GPT-5 Advanced Features Integration
-- Created: 2025-01-27
-- Purpose: Add support for GPT-5's advanced capabilities

-- GPT-5 Request Logs with Advanced Features
CREATE TABLE IF NOT EXISTS gpt5_request_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    agent_name VARCHAR(100),
    model_used VARCHAR(100),
    verbosity_level VARCHAR(20) DEFAULT 'medium',
    reasoning_mode VARCHAR(20) DEFAULT 'standard',
    freeform_calling BOOLEAN DEFAULT false,
    cfg_constraints TEXT,
    minimal_reasoning BOOLEAN DEFAULT false,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    response_time_ms INTEGER,
    cost_usd DECIMAL(10,6),
    quality_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Code Quality Reports for Sourcery Integration  
CREATE TABLE IF NOT EXISTS code_quality_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    file_path VARCHAR(500),
    file_type VARCHAR(50),
    issues_found INTEGER DEFAULT 0,
    security_issues INTEGER DEFAULT 0,
    performance_issues INTEGER DEFAULT 0,
    style_issues INTEGER DEFAULT 0,
    complexity_score INTEGER,
    maintainability_score INTEGER,
    technical_debt_minutes INTEGER,
    sourcery_suggestions JSONB DEFAULT '[]'::jsonb,
    auto_fixes_applied JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- V2 Feature Usage Tracking
CREATE TABLE IF NOT EXISTS v2_feature_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    feature_name VARCHAR(100),
    usage_count INTEGER DEFAULT 1,
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    average_response_time DECIMAL(8,2),
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, feature_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enhanced Conversation Messages for V2
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS v2_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS verbosity_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS reasoning_complexity VARCHAR(20),
ADD COLUMN IF NOT EXISTS gpt5_features JSONB DEFAULT '[]'::jsonb;

-- Model Performance Benchmarks
CREATE TABLE IF NOT EXISTS model_performance_benchmarks (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    avg_response_time_ms DECIMAL(8,2),
    avg_cost_per_1k_tokens DECIMAL(10,6),
    quality_score DECIMAL(5,2),
    success_rate DECIMAL(5,2),
    reasoning_capability VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_name, task_type)
);

-- Seed initial performance benchmarks for GPT-5 models
INSERT INTO model_performance_benchmarks (model_name, task_type, avg_response_time_ms, avg_cost_per_1k_tokens, quality_score, success_rate, reasoning_capability) VALUES
('gpt-5', 'text-generation', 800.0, 0.030, 95.0, 98.5, 'high'),
('gpt-5', 'code-generation', 1200.0, 0.030, 97.0, 96.8, 'high'),
('gpt-5', 'reasoning', 1500.0, 0.030, 98.0, 97.2, 'high'),
('gpt-5-fast', 'text-generation', 400.0, 0.025, 92.0, 97.0, 'medium'),
('gpt-5-fast', 'code-generation', 600.0, 0.025, 94.0, 95.5, 'medium'),
('gpt-5-mini', 'text-generation', 300.0, 0.015, 88.0, 96.0, 'medium'),
('gpt-5-mini', 'creative-writing', 500.0, 0.015, 90.0, 94.5, 'medium'),
('gpt-5-nano', 'simple-tasks', 150.0, 0.005, 85.0, 95.0, 'minimal')
ON CONFLICT (model_name, task_type) DO UPDATE SET
    avg_response_time_ms = EXCLUDED.avg_response_time_ms,
    avg_cost_per_1k_tokens = EXCLUDED.avg_cost_per_1k_tokens,
    quality_score = EXCLUDED.quality_score,
    success_rate = EXCLUDED.success_rate,
    reasoning_capability = EXCLUDED.reasoning_capability,
    updated_at = CURRENT_TIMESTAMP;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gpt5_request_logs_user_id ON gpt5_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_gpt5_request_logs_created_at ON gpt5_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_gpt5_request_logs_agent_name ON gpt5_request_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_code_quality_reports_user_id ON code_quality_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_code_quality_reports_file_path ON code_quality_reports(file_path);
CREATE INDEX IF NOT EXISTS idx_v2_feature_usage_user_feature ON v2_feature_usage(user_id, feature_name);
CREATE INDEX IF NOT EXISTS idx_model_performance_benchmarks_model_task ON model_performance_benchmarks(model_name, task_type);

-- Update conversation_messages metadata index
CREATE INDEX IF NOT EXISTS idx_conversation_messages_v2_metadata ON conversation_messages USING GIN(v2_metadata);

-- Upsert function for feature usage tracking
CREATE OR REPLACE FUNCTION upsert_v2_feature_usage(
    p_user_id INTEGER,
    p_feature_name VARCHAR(100),
    p_success BOOLEAN DEFAULT true,
    p_response_time DECIMAL(8,2) DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO v2_feature_usage (user_id, feature_name, usage_count, success_rate, average_response_time)
    VALUES (p_user_id, p_feature_name, 1, CASE WHEN p_success THEN 100.00 ELSE 0.00 END, p_response_time)
    ON CONFLICT (user_id, feature_name) DO UPDATE SET
        usage_count = v2_feature_usage.usage_count + 1,
        success_rate = CASE 
            WHEN p_success THEN 
                ((v2_feature_usage.success_rate * v2_feature_usage.usage_count + 100.00) / (v2_feature_usage.usage_count + 1))
            ELSE 
                ((v2_feature_usage.success_rate * v2_feature_usage.usage_count) / (v2_feature_usage.usage_count + 1))
        END,
        average_response_time = CASE 
            WHEN p_response_time IS NOT NULL THEN
                CASE 
                    WHEN v2_feature_usage.average_response_time IS NULL THEN p_response_time
                    ELSE ((v2_feature_usage.average_response_time * v2_feature_usage.usage_count + p_response_time) / (v2_feature_usage.usage_count + 1))
                END
            ELSE v2_feature_usage.average_response_time
        END,
        last_used = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;