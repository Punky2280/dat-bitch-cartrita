-- Advanced Caching System Database Schema (Task 22)
-- Migration: 23_create_advanced_cache_schema.sql

-- =====================================================
-- Cache Analytics Tables
-- =====================================================

-- Cache Analytics Metrics (Time Series Data)
CREATE TABLE IF NOT EXISTS cache_analytics_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    time_slot TIMESTAMP WITH TIME ZONE NOT NULL, -- Rounded timestamp for aggregation
    
    -- Hit Rate Metrics
    hit_rate_l1 DECIMAL(5,2) DEFAULT 0,
    hit_rate_l2 DECIMAL(5,2) DEFAULT 0,
    hit_rate_l3 DECIMAL(5,2) DEFAULT 0,
    hit_rate_overall DECIMAL(5,2) DEFAULT 0,
    
    -- Latency Metrics (milliseconds)
    latency_l1_avg DECIMAL(10,3) DEFAULT 0,
    latency_l2_avg DECIMAL(10,3) DEFAULT 0,
    latency_l3_avg DECIMAL(10,3) DEFAULT 0,
    latency_overall_avg DECIMAL(10,3) DEFAULT 0,
    latency_l1_p95 DECIMAL(10,3) DEFAULT 0,
    latency_l2_p95 DECIMAL(10,3) DEFAULT 0,
    latency_l3_p95 DECIMAL(10,3) DEFAULT 0,
    
    -- Throughput Metrics
    operations_total INTEGER DEFAULT 0,
    hits_l1 INTEGER DEFAULT 0,
    hits_l2 INTEGER DEFAULT 0,
    hits_l3 INTEGER DEFAULT 0,
    misses_l1 INTEGER DEFAULT 0,
    misses_l2 INTEGER DEFAULT 0,
    misses_l3 INTEGER DEFAULT 0,
    sets_total INTEGER DEFAULT 0,
    deletes_total INTEGER DEFAULT 0,
    
    -- Error Metrics
    errors_l1 INTEGER DEFAULT 0,
    errors_l2 INTEGER DEFAULT 0,
    errors_l3 INTEGER DEFAULT 0,
    errors_total INTEGER DEFAULT 0,
    
    -- Size Metrics (bytes)
    size_l1 BIGINT DEFAULT 0,
    size_l2 BIGINT DEFAULT 0,
    size_l3 BIGINT DEFAULT 0,
    size_total BIGINT DEFAULT 0,
    
    -- Memory Usage
    memory_used_bytes BIGINT DEFAULT 0,
    memory_used_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Additional Metadata
    cache_strategy VARCHAR(50),
    environment VARCHAR(50) DEFAULT 'production',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Pattern Detection Results
CREATE TABLE IF NOT EXISTS cache_patterns (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(100) NOT NULL,
    pattern_name VARCHAR(255) NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Pattern Data
    confidence_score DECIMAL(4,3) NOT NULL,
    impact_level VARCHAR(20) CHECK (impact_level IN ('low', 'medium', 'high')),
    pattern_data JSONB NOT NULL,
    affected_keys TEXT[],
    
    -- Pattern Statistics
    frequency_count INTEGER DEFAULT 0,
    last_occurrence TIMESTAMP WITH TIME ZONE,
    trend VARCHAR(20) CHECK (trend IN ('increasing', 'stable', 'decreasing')),
    
    -- Pattern Context
    context_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'ignored')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Optimization Recommendations
CREATE TABLE IF NOT EXISTS cache_recommendations (
    id SERIAL PRIMARY KEY,
    recommendation_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Recommendation Details
    confidence_score DECIMAL(4,3) NOT NULL,
    impact_level VARCHAR(20) CHECK (impact_level IN ('low', 'medium', 'high')),
    priority_score INTEGER DEFAULT 0,
    
    -- Recommendation Actions
    recommended_actions JSONB NOT NULL,
    estimated_improvement JSONB,
    implementation_effort VARCHAR(20) CHECK (implementation_effort IN ('low', 'medium', 'high')),
    
    -- Context and Triggers
    trigger_patterns TEXT[],
    context_data JSONB DEFAULT '{}'::jsonb,
    prerequisites TEXT[],
    
    -- Status Tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'implemented', 'dismissed', 'expired')),
    implemented_at TIMESTAMP WITH TIME ZONE,
    implementation_notes TEXT,
    
    -- Results Tracking
    actual_improvement JSONB,
    effectiveness_score DECIMAL(4,3),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Cache Performance Alerts
CREATE TABLE IF NOT EXISTS cache_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Alert Data
    alert_data JSONB DEFAULT '{}'::jsonb,
    threshold_value DECIMAL(15,6),
    actual_value DECIMAL(15,6),
    
    -- Alert Context
    affected_components TEXT[],
    related_keys TEXT[],
    
    -- Status and Resolution
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'suppressed')),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Escalation
    escalation_level INTEGER DEFAULT 0,
    escalated_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Cache Configuration Management
-- =====================================================

-- Cache Service Configurations
CREATE TABLE IF NOT EXISTS cache_configurations (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    service_version VARCHAR(50),
    config_name VARCHAR(100) NOT NULL,
    
    -- Configuration Data
    config_data JSONB NOT NULL,
    config_schema JSONB,
    
    -- Version Control
    version INTEGER DEFAULT 1,
    parent_version INTEGER,
    
    -- Environment and Scope
    environment VARCHAR(50) DEFAULT 'production',
    scope VARCHAR(50) DEFAULT 'global', -- 'global', 'user', 'tenant'
    scope_id VARCHAR(255),
    
    -- Status and Lifecycle
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,
    
    -- Change Tracking
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Validation and Testing
    validation_status VARCHAR(20) CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    validation_errors JSONB,
    test_results JSONB,
    
    UNIQUE(service_name, config_name, environment, version)
);

-- Cache Configuration History
CREATE TABLE IF NOT EXISTS cache_configuration_history (
    id SERIAL PRIMARY KEY,
    configuration_id INTEGER NOT NULL REFERENCES cache_configurations(id) ON DELETE CASCADE,
    
    -- Change Details
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'activate', 'deprecate')),
    changed_fields JSONB,
    old_values JSONB,
    new_values JSONB,
    
    -- Change Context
    change_reason TEXT,
    change_source VARCHAR(100), -- 'manual', 'api', 'recommendation', 'automated'
    
    -- User and Time
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Impact Assessment
    impact_assessment JSONB,
    rollback_data JSONB
);

-- =====================================================
-- Cache Warming and Predictions
-- =====================================================

-- Cache Warming Jobs
CREATE TABLE IF NOT EXISTS cache_warming_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('manual', 'scheduled', 'predictive', 'reactive')),
    
    -- Job Configuration
    warming_strategy VARCHAR(50) NOT NULL,
    target_keys TEXT[],
    target_patterns TEXT[],
    target_criteria JSONB,
    
    -- Scheduling
    schedule_expression VARCHAR(100), -- Cron expression
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    
    -- Execution Limits
    max_concurrent_warmups INTEGER DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 300,
    retry_attempts INTEGER DEFAULT 3,
    
    -- Status and Results
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    current_progress JSONB,
    execution_results JSONB,
    error_details JSONB,
    
    -- Statistics
    total_keys_warmed INTEGER DEFAULT 0,
    successful_warmups INTEGER DEFAULT 0,
    failed_warmups INTEGER DEFAULT 0,
    bytes_warmed BIGINT DEFAULT 0,
    execution_time_ms BIGINT DEFAULT 0,
    
    -- Metadata
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Warming Predictions
CREATE TABLE IF NOT EXISTS cache_warming_predictions (
    id SERIAL PRIMARY KEY,
    prediction_key VARCHAR(512) NOT NULL,
    predicted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prediction Details
    prediction_strategy VARCHAR(50) NOT NULL,
    predicted_access_time TIMESTAMP WITH TIME ZONE NOT NULL,
    confidence_score DECIMAL(4,3) NOT NULL,
    prediction_horizon_minutes INTEGER NOT NULL,
    
    -- Context and Patterns
    access_pattern_data JSONB,
    temporal_factors JSONB,
    frequency_factors JSONB,
    contextual_factors JSONB,
    
    -- Prediction Parameters
    suggested_ttl_seconds INTEGER,
    suggested_priority INTEGER DEFAULT 0,
    estimated_size_bytes INTEGER,
    
    -- Validation and Results
    actual_access_time TIMESTAMP WITH TIME ZONE,
    prediction_accuracy DECIMAL(4,3),
    warmup_executed BOOLEAN DEFAULT FALSE,
    warmup_job_id UUID REFERENCES cache_warming_jobs(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'warmed', 'missed', 'expired')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    validated_at TIMESTAMP WITH TIME ZONE
);

-- Cache Access Patterns (for learning)
CREATE TABLE IF NOT EXISTS cache_access_patterns (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(512) NOT NULL,
    access_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Access Details
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('hit', 'miss', 'set', 'delete')),
    cache_level VARCHAR(10) CHECK (cache_level IN ('l1', 'l2', 'l3')),
    latency_ms DECIMAL(10,3),
    value_size_bytes INTEGER,
    
    -- Context
    user_id INTEGER,
    session_id VARCHAR(255),
    request_context JSONB,
    
    -- Performance
    cpu_usage_percent DECIMAL(5,2),
    memory_pressure DECIMAL(5,2),
    concurrent_requests INTEGER,
    
    -- Indexing for time-series queries
    hour_of_day INTEGER,
    day_of_week INTEGER,
    day_of_month INTEGER,
    month_of_year INTEGER
);

-- =====================================================
-- Cache Invalidation Management
-- =====================================================

-- Cache Invalidation Dependencies
CREATE TABLE IF NOT EXISTS cache_invalidation_dependencies (
    id SERIAL PRIMARY KEY,
    parent_key VARCHAR(512) NOT NULL,
    dependent_key VARCHAR(512) NOT NULL,
    dependency_type VARCHAR(50) DEFAULT 'explicit',
    
    -- Dependency Metadata
    relationship_strength DECIMAL(3,2) DEFAULT 1.0,
    dependency_context JSONB DEFAULT '{}'::jsonb,
    
    -- Lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(parent_key, dependent_key),
    CHECK (parent_key != dependent_key)
);

-- Cache Invalidation Events
CREATE TABLE IF NOT EXISTS cache_invalidation_events (
    id SERIAL PRIMARY KEY,
    event_id UUID DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    
    -- Event Details
    trigger_source VARCHAR(100) NOT NULL,
    invalidation_strategy VARCHAR(50) NOT NULL,
    target_keys TEXT[],
    target_patterns TEXT[],
    
    -- Execution Results
    keys_invalidated INTEGER DEFAULT 0,
    cascade_depth INTEGER DEFAULT 0,
    execution_time_ms BIGINT DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    
    -- Event Data
    event_data JSONB DEFAULT '{}'::jsonb,
    execution_results JSONB DEFAULT '{}'::jsonb,
    error_details JSONB,
    
    -- Context
    user_id INTEGER,
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    
    -- Batch Information
    batch_id UUID,
    batch_size INTEGER,
    batch_position INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Cache Performance Optimization
-- =====================================================

-- Cache Optimization History
CREATE TABLE IF NOT EXISTS cache_optimization_history (
    id SERIAL PRIMARY KEY,
    optimization_type VARCHAR(100) NOT NULL,
    optimization_name VARCHAR(255) NOT NULL,
    
    -- Optimization Details
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by VARCHAR(255),
    optimization_data JSONB NOT NULL,
    
    -- Before/After Metrics
    baseline_metrics JSONB NOT NULL,
    target_metrics JSONB,
    actual_metrics JSONB,
    
    -- Results
    improvement_percentage DECIMAL(6,2),
    success_criteria_met BOOLEAN,
    effectiveness_score DECIMAL(4,3),
    
    -- Rollback Information
    rollback_data JSONB,
    rolled_back_at TIMESTAMP WITH TIME ZONE,
    rollback_reason TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'reverted', 'superseded')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache Key Statistics (aggregated)
CREATE TABLE IF NOT EXISTS cache_key_statistics (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(512) NOT NULL,
    analysis_date DATE NOT NULL,
    
    -- Usage Statistics
    total_accesses INTEGER DEFAULT 0,
    hit_count INTEGER DEFAULT 0,
    miss_count INTEGER DEFAULT 0,
    set_count INTEGER DEFAULT 0,
    delete_count INTEGER DEFAULT 0,
    
    -- Performance Statistics
    avg_latency_ms DECIMAL(10,3) DEFAULT 0,
    p95_latency_ms DECIMAL(10,3) DEFAULT 0,
    p99_latency_ms DECIMAL(10,3) DEFAULT 0,
    
    -- Size and Storage
    avg_size_bytes INTEGER DEFAULT 0,
    max_size_bytes INTEGER DEFAULT 0,
    total_bytes_transferred BIGINT DEFAULT 0,
    
    -- Temporal Patterns
    peak_hour INTEGER,
    peak_hour_accesses INTEGER DEFAULT 0,
    access_distribution JSONB, -- Hourly distribution
    
    -- Efficiency Metrics
    hit_rate DECIMAL(5,2) DEFAULT 0,
    cache_efficiency DECIMAL(5,2) DEFAULT 0,
    warming_success_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Status and Metadata
    key_category VARCHAR(100),
    last_access_at TIMESTAMP WITH TIME ZONE,
    ttl_effectiveness DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cache_key, analysis_date)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Cache Analytics Metrics Indexes
CREATE INDEX IF NOT EXISTS idx_cache_analytics_metrics_time_slot ON cache_analytics_metrics(time_slot);
CREATE INDEX IF NOT EXISTS idx_cache_analytics_metrics_timestamp ON cache_analytics_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_cache_analytics_metrics_environment ON cache_analytics_metrics(environment);
CREATE INDEX IF NOT EXISTS idx_cache_analytics_metrics_strategy ON cache_analytics_metrics(cache_strategy);

-- Cache Patterns Indexes
CREATE INDEX IF NOT EXISTS idx_cache_patterns_type ON cache_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_cache_patterns_detected_at ON cache_patterns(detected_at);
CREATE INDEX IF NOT EXISTS idx_cache_patterns_status ON cache_patterns(status);
CREATE INDEX IF NOT EXISTS idx_cache_patterns_confidence ON cache_patterns(confidence_score DESC);

-- Cache Recommendations Indexes
CREATE INDEX IF NOT EXISTS idx_cache_recommendations_type ON cache_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_cache_recommendations_status ON cache_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_cache_recommendations_priority ON cache_recommendations(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_cache_recommendations_created_at ON cache_recommendations(created_at);

-- Cache Alerts Indexes
CREATE INDEX IF NOT EXISTS idx_cache_alerts_severity ON cache_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_cache_alerts_status ON cache_alerts(status);
CREATE INDEX IF NOT EXISTS idx_cache_alerts_created_at ON cache_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_alerts_type ON cache_alerts(alert_type);

-- Cache Configurations Indexes
CREATE INDEX IF NOT EXISTS idx_cache_configurations_service ON cache_configurations(service_name);
CREATE INDEX IF NOT EXISTS idx_cache_configurations_environment ON cache_configurations(environment);
CREATE INDEX IF NOT EXISTS idx_cache_configurations_status ON cache_configurations(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_configurations_active ON cache_configurations(service_name, config_name, environment) 
WHERE status = 'active';

-- Cache Warming Indexes
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_status ON cache_warming_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_next_run ON cache_warming_jobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_cache_warming_jobs_type ON cache_warming_jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_cache_warming_predictions_key ON cache_warming_predictions(prediction_key);
CREATE INDEX IF NOT EXISTS idx_cache_warming_predictions_access_time ON cache_warming_predictions(predicted_access_time);
CREATE INDEX IF NOT EXISTS idx_cache_warming_predictions_status ON cache_warming_predictions(status);

-- Cache Access Patterns Indexes
CREATE INDEX IF NOT EXISTS idx_cache_access_patterns_key ON cache_access_patterns(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_access_patterns_timestamp ON cache_access_patterns(access_timestamp);
CREATE INDEX IF NOT EXISTS idx_cache_access_patterns_type ON cache_access_patterns(access_type);
CREATE INDEX IF NOT EXISTS idx_cache_access_patterns_temporal ON cache_access_patterns(hour_of_day, day_of_week);

-- Cache Invalidation Indexes
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_dependencies_parent ON cache_invalidation_dependencies(parent_key);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_dependencies_dependent ON cache_invalidation_dependencies(dependent_key);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_dependencies_expires ON cache_invalidation_dependencies(expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_invalidation_events_type ON cache_invalidation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_events_created_at ON cache_invalidation_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_events_batch ON cache_invalidation_events(batch_id);

-- Cache Statistics Indexes
CREATE INDEX IF NOT EXISTS idx_cache_key_statistics_key ON cache_key_statistics(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_key_statistics_date ON cache_key_statistics(analysis_date);
CREATE INDEX IF NOT EXISTS idx_cache_key_statistics_hit_rate ON cache_key_statistics(hit_rate DESC);
CREATE INDEX IF NOT EXISTS idx_cache_key_statistics_category ON cache_key_statistics(key_category);

-- =====================================================
-- Functions and Procedures
-- =====================================================

-- Function to clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_cache_analytics_data(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_analytics_metrics 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    DELETE FROM cache_access_patterns 
    WHERE access_timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate cache efficiency score
CREATE OR REPLACE FUNCTION calculate_cache_efficiency_score(
    hit_rate DECIMAL,
    avg_latency_ms DECIMAL,
    memory_usage_pct DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    -- Weighted efficiency score (hit_rate: 50%, latency: 30%, memory: 20%)
    RETURN (
        (hit_rate * 0.5) +
        ((1000 - LEAST(avg_latency_ms, 1000)) / 1000 * 30) +
        ((100 - memory_usage_pct) / 100 * 20)
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get cache hot keys
CREATE OR REPLACE FUNCTION get_cache_hot_keys(
    lookback_hours INTEGER DEFAULT 24,
    min_accesses INTEGER DEFAULT 100
) RETURNS TABLE (
    cache_key VARCHAR(512),
    total_accesses INTEGER,
    hit_rate DECIMAL,
    avg_latency_ms DECIMAL,
    efficiency_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cap.cache_key,
        COUNT(*)::INTEGER as total_accesses,
        (COUNT(CASE WHEN cap.access_type = 'hit' THEN 1 END) * 100.0 / COUNT(*))::DECIMAL(5,2) as hit_rate,
        AVG(cap.latency_ms)::DECIMAL(10,3) as avg_latency_ms,
        calculate_cache_efficiency_score(
            (COUNT(CASE WHEN cap.access_type = 'hit' THEN 1 END) * 100.0 / COUNT(*))::DECIMAL(5,2),
            AVG(cap.latency_ms)::DECIMAL(10,3),
            50::DECIMAL -- Placeholder for memory usage
        ) as efficiency_score
    FROM cache_access_patterns cap
    WHERE cap.access_timestamp >= NOW() - INTERVAL '1 hour' * lookback_hours
    GROUP BY cap.cache_key
    HAVING COUNT(*) >= min_accesses
    ORDER BY efficiency_score DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers for Automated Data Management
-- =====================================================

-- Trigger to update cache configuration updated_at
CREATE OR REPLACE FUNCTION update_cache_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cache_configurations_updated_at
    BEFORE UPDATE ON cache_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_cache_config_timestamp();

-- Trigger to create configuration history entries
CREATE OR REPLACE FUNCTION log_cache_config_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO cache_configuration_history (
        configuration_id,
        change_type,
        changed_fields,
        old_values,
        new_values,
        changed_by
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'create'
            WHEN TG_OP = 'UPDATE' THEN 'update'
            WHEN TG_OP = 'DELETE' THEN 'delete'
        END,
        CASE WHEN TG_OP = 'UPDATE' THEN 
            (SELECT json_object_agg(key, value) 
             FROM json_each_text(to_json(NEW)) 
             WHERE value IS DISTINCT FROM (to_json(OLD) ->> key))
        ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_json(NEW) ELSE NULL END,
        COALESCE(NEW.updated_by, OLD.created_by)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cache_configurations_history
    AFTER INSERT OR UPDATE OR DELETE ON cache_configurations
    FOR EACH ROW
    EXECUTE FUNCTION log_cache_config_changes();

-- =====================================================
-- Initial Configuration Data
-- =====================================================

-- Default cache configurations
INSERT INTO cache_configurations (service_name, config_name, config_data, created_by) VALUES
('advanced-caching-engine', 'default', '{
    "l1": {
        "maxSize": 1000,
        "ttl": 300
    },
    "l2": {
        "maxSize": 10000,
        "ttl": 3600,
        "compression": true
    },
    "l3": {
        "ttl": 86400,
        "batchSize": 100
    }
}', 'system'),
('cache-analytics', 'default', '{
    "analysisInterval": 60000,
    "dataRetention": 604800000,
    "optimizationThreshold": 0.7,
    "recommendations": {
        "enabled": true,
        "minDataPoints": 100,
        "confidenceThreshold": 0.8
    }
}', 'system'),
('cache-warming', 'default', '{
    "warmingInterval": 300000,
    "patternAnalysisInterval": 900000,
    "maxConcurrentWarmups": 10,
    "prediction": {
        "enabled": true,
        "lookAheadWindow": 3600000,
        "minConfidence": 0.6
    }
}', 'system'),
('cache-invalidation', 'default', '{
    "batchSize": 50,
    "batchDelay": 100,
    "maxConcurrentInvalidations": 10,
    "dependencies": {
        "enabled": true,
        "maxDepth": 5,
        "circularDetection": true
    }
}', 'system')
ON CONFLICT (service_name, config_name, environment, version) DO NOTHING;

-- =====================================================
-- Performance Optimization
-- =====================================================

-- Partitioning for large tables (example for metrics)
-- Note: This would need to be implemented with proper partition maintenance
DO $$
BEGIN
    -- Create monthly partitions for cache_analytics_metrics
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'cache_analytics_metrics_y2025m01'
    ) THEN
        CREATE TABLE cache_analytics_metrics_y2025m01 
        PARTITION OF cache_analytics_metrics
        FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
    END IF;
END $$;

-- Vacuum and analyze for optimal performance
ANALYZE cache_analytics_metrics;
ANALYZE cache_patterns;
ANALYZE cache_recommendations;
ANALYZE cache_alerts;
ANALYZE cache_configurations;
ANALYZE cache_warming_jobs;
ANALYZE cache_warming_predictions;
ANALYZE cache_access_patterns;
ANALYZE cache_invalidation_dependencies;
ANALYZE cache_invalidation_events;
ANALYZE cache_key_statistics;

-- Create extension for better JSON indexing if not exists
CREATE EXTENSION IF NOT EXISTS gin;

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_cache_patterns_data_gin ON cache_patterns USING gin(pattern_data);
CREATE INDEX IF NOT EXISTS idx_cache_recommendations_actions_gin ON cache_recommendations USING gin(recommended_actions);
CREATE INDEX IF NOT EXISTS idx_cache_configurations_data_gin ON cache_configurations USING gin(config_data);
CREATE INDEX IF NOT EXISTS idx_cache_warming_predictions_pattern_gin ON cache_warming_predictions USING gin(access_pattern_data);

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE cache_analytics_metrics IS 'Time-series cache performance metrics for analytics and monitoring';
COMMENT ON TABLE cache_patterns IS 'Detected cache access and usage patterns for optimization';
COMMENT ON TABLE cache_recommendations IS 'System-generated cache optimization recommendations';
COMMENT ON TABLE cache_alerts IS 'Cache performance and health alerts';
COMMENT ON TABLE cache_configurations IS 'Cache service configuration management';
COMMENT ON TABLE cache_warming_jobs IS 'Cache warming job definitions and execution tracking';
COMMENT ON TABLE cache_warming_predictions IS 'Predictive cache warming based on access patterns';
COMMENT ON TABLE cache_access_patterns IS 'Raw cache access patterns for machine learning and analysis';
COMMENT ON TABLE cache_invalidation_dependencies IS 'Cache key dependency relationships for cascade invalidation';
COMMENT ON TABLE cache_invalidation_events IS 'Cache invalidation event log for auditing and analysis';
COMMENT ON TABLE cache_key_statistics IS 'Aggregated cache key performance statistics';

-- Grant permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cache_service_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO cache_service_user;

COMMIT;
