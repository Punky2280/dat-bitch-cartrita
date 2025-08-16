-- 26_comprehensive_analytics_schema.sql
-- Advanced Analytics & Business Intelligence Database Schema
-- Part of Task 24: Enhanced Analytics Framework

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =======================
-- ANALYTICS DATA TABLES
-- =======================

-- Metrics collection table for real-time and historical data
CREATE TABLE analytics_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(20,8) NOT NULL,
    metric_type VARCHAR(50) DEFAULT 'gauge', -- gauge, counter, histogram, summary
    timestamp BIGINT NOT NULL,
    
    -- Context and metadata
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    source VARCHAR(100) NOT NULL DEFAULT 'system', -- system, user, api, agent
    category VARCHAR(100),
    
    -- Additional metadata as JSON
    metadata JSONB DEFAULT '{}',
    tags JSONB DEFAULT '{}',
    
    -- Tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    
    -- Indexing
    CONSTRAINT valid_metric_type CHECK (metric_type IN ('gauge', 'counter', 'histogram', 'summary', 'timer')),
    CONSTRAINT valid_source CHECK (source IN ('system', 'user', 'api', 'agent', 'external'))
);

-- Optimized indexes for analytics queries
CREATE INDEX idx_analytics_metrics_name_timestamp ON analytics_metrics(metric_name, timestamp DESC);
CREATE INDEX idx_analytics_metrics_user_timestamp ON analytics_metrics(user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_metrics_source_timestamp ON analytics_metrics(source, timestamp DESC);
CREATE INDEX idx_analytics_metrics_category ON analytics_metrics(category) WHERE category IS NOT NULL;
CREATE INDEX idx_analytics_metrics_metadata ON analytics_metrics USING gin(metadata);
CREATE INDEX idx_analytics_metrics_tags ON analytics_metrics USING gin(tags);
CREATE INDEX idx_analytics_metrics_processed ON analytics_metrics(processed) WHERE NOT processed;

-- Time-series aggregated metrics for faster queries
CREATE TABLE analytics_aggregated_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    aggregation_type VARCHAR(50) NOT NULL, -- sum, avg, min, max, count, p50, p95, p99
    aggregation_period VARCHAR(20) NOT NULL, -- minute, hour, day, week, month
    
    -- Aggregated values
    aggregated_value DECIMAL(20,8) NOT NULL,
    data_points_count INTEGER NOT NULL DEFAULT 0,
    min_value DECIMAL(20,8),
    max_value DECIMAL(20,8),
    
    -- Time period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Context
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(100),
    category VARCHAR(100),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_aggregation_type CHECK (aggregation_type IN ('sum', 'avg', 'min', 'max', 'count', 'p50', 'p95', 'p99', 'stddev')),
    CONSTRAINT valid_aggregation_period CHECK (aggregation_period IN ('minute', 'hour', 'day', 'week', 'month')),
    CONSTRAINT valid_period_range CHECK (period_end >= period_start)
);

CREATE UNIQUE INDEX idx_analytics_aggregated_unique ON analytics_aggregated_metrics(
    metric_name, aggregation_type, aggregation_period, period_start, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
CREATE INDEX idx_analytics_aggregated_period ON analytics_aggregated_metrics(period_start DESC, period_end DESC);
CREATE INDEX idx_analytics_aggregated_user ON analytics_aggregated_metrics(user_id, period_start DESC) WHERE user_id IS NOT NULL;

-- =======================
-- USER BEHAVIOR ANALYTICS
-- =======================

-- User sessions tracking
CREATE TABLE analytics_user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Session details
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Session context
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50), -- desktop, mobile, tablet, api
    browser VARCHAR(100),
    operating_system VARCHAR(100),
    
    -- Activity metrics
    page_views INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    features_used TEXT[], -- Array of feature names
    
    -- Location and context
    country_code CHAR(2),
    city VARCHAR(100),
    timezone VARCHAR(50),
    
    -- Engagement metrics
    bounce_rate DECIMAL(5,2), -- Percentage
    engagement_score DECIMAL(5,2), -- 0-100 score
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_sessions_user_started ON analytics_user_sessions(user_id, started_at DESC);
CREATE INDEX idx_analytics_sessions_active ON analytics_user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_analytics_sessions_device ON analytics_user_sessions(device_type, started_at DESC);
CREATE INDEX idx_analytics_sessions_duration ON analytics_user_sessions(duration_seconds DESC) WHERE duration_seconds IS NOT NULL;

-- User behavior events
CREATE TABLE analytics_user_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) REFERENCES analytics_user_sessions(session_id) ON DELETE CASCADE,
    
    -- Event details
    event_name VARCHAR(255) NOT NULL,
    event_category VARCHAR(100) NOT NULL, -- navigation, interaction, conversion, error
    event_action VARCHAR(255) NOT NULL,
    event_label VARCHAR(255),
    event_value DECIMAL(10,2),
    
    -- Context
    page_url TEXT,
    referrer_url TEXT,
    element_id VARCHAR(255),
    element_text TEXT,
    
    -- Timing
    timestamp BIGINT NOT NULL,
    duration_ms INTEGER, -- For timed events
    
    -- Additional properties
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_event_category CHECK (event_category IN ('navigation', 'interaction', 'conversion', 'error', 'system', 'custom'))
);

CREATE INDEX idx_analytics_events_user_timestamp ON analytics_user_events(user_id, timestamp DESC);
CREATE INDEX idx_analytics_events_session ON analytics_user_events(session_id, timestamp DESC);
CREATE INDEX idx_analytics_events_name_category ON analytics_user_events(event_name, event_category);
CREATE INDEX idx_analytics_events_properties ON analytics_user_events USING gin(properties);

-- =======================
-- BUSINESS INTELLIGENCE
-- =======================

-- KPI definitions and tracking
CREATE TABLE analytics_kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- KPI configuration
    calculation_method VARCHAR(100) NOT NULL, -- sum, avg, count, ratio, custom
    source_metrics TEXT[] NOT NULL, -- Array of metric names
    calculation_formula TEXT, -- For custom calculations
    
    -- Target and thresholds
    target_value DECIMAL(20,8),
    unit VARCHAR(50) DEFAULT '',
    
    -- Thresholds for alerting
    critical_threshold DECIMAL(20,8),
    warning_threshold DECIMAL(20,8),
    good_threshold DECIMAL(20,8),
    
    -- Configuration
    update_frequency VARCHAR(50) DEFAULT 'hourly', -- real-time, minute, hourly, daily
    is_active BOOLEAN DEFAULT TRUE,
    category VARCHAR(100) DEFAULT 'general',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT valid_calculation_method CHECK (calculation_method IN ('sum', 'avg', 'count', 'ratio', 'min', 'max', 'custom')),
    CONSTRAINT valid_update_frequency CHECK (update_frequency IN ('real-time', 'minute', 'hourly', 'daily', 'weekly'))
);

-- KPI values over time
CREATE TABLE analytics_kpi_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_id UUID NOT NULL REFERENCES analytics_kpis(id) ON DELETE CASCADE,
    
    -- Value data
    calculated_value DECIMAL(20,8) NOT NULL,
    target_value DECIMAL(20,8),
    variance_from_target DECIMAL(20,8),
    percentage_change DECIMAL(8,4), -- From previous period
    
    -- Status based on thresholds
    status VARCHAR(20) DEFAULT 'unknown', -- critical, warning, good, unknown
    
    -- Time period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    calculation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Context
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- For user-specific KPIs
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_kpi_status CHECK (status IN ('critical', 'warning', 'good', 'unknown'))
);

CREATE INDEX idx_analytics_kpi_values_kpi_period ON analytics_kpi_values(kpi_id, period_start DESC);
CREATE INDEX idx_analytics_kpi_values_status ON analytics_kpi_values(status, calculation_timestamp DESC);
CREATE INDEX idx_analytics_kpi_values_user ON analytics_kpi_values(user_id, calculation_timestamp DESC) WHERE user_id IS NOT NULL;

-- =======================
-- PREDICTIVE ANALYTICS
-- =======================

-- Predictions generated by ML models
CREATE TABLE analytics_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    prediction_type VARCHAR(100) NOT NULL, -- forecast, trend, anomaly, classification
    
    -- Prediction data
    predicted_value DECIMAL(20,8),
    predicted_values JSONB, -- Array of values for multi-step predictions
    confidence_score DECIMAL(5,4) NOT NULL, -- 0.0 to 1.0
    prediction_horizon_ms BIGINT NOT NULL, -- How far into the future
    
    -- Time context
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Model information
    model_name VARCHAR(255) NOT NULL,
    model_version VARCHAR(50) DEFAULT '1.0',
    algorithm_used VARCHAR(100),
    training_data_points INTEGER,
    
    -- Accuracy tracking
    actual_value DECIMAL(20,8), -- Filled in when actual data is available
    accuracy_score DECIMAL(5,4), -- Calculated after validation
    prediction_error DECIMAL(20,8),
    
    -- Context
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_prediction_type CHECK (prediction_type IN ('forecast', 'trend', 'anomaly', 'classification', 'regression')),
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT valid_time_range CHECK (valid_until >= valid_from)
);

CREATE INDEX idx_analytics_predictions_metric_time ON analytics_predictions(metric_name, valid_from DESC);
CREATE INDEX idx_analytics_predictions_type ON analytics_predictions(prediction_type, generated_at DESC);
CREATE INDEX idx_analytics_predictions_accuracy ON analytics_predictions(accuracy_score DESC) WHERE accuracy_score IS NOT NULL;
CREATE INDEX idx_analytics_predictions_user ON analytics_predictions(user_id, generated_at DESC) WHERE user_id IS NOT NULL;

-- Anomaly detection results
CREATE TABLE analytics_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    
    -- Anomaly details
    anomaly_type VARCHAR(100) NOT NULL, -- statistical, pattern, contextual, collective
    detected_value DECIMAL(20,8) NOT NULL,
    expected_value DECIMAL(20,8),
    anomaly_score DECIMAL(8,4) NOT NULL, -- Severity score
    
    -- Detection context
    detection_algorithm VARCHAR(100) NOT NULL,
    threshold_used DECIMAL(8,4),
    confidence_level DECIMAL(5,4) NOT NULL,
    
    -- Classification
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    is_confirmed BOOLEAN DEFAULT NULL, -- NULL = pending, TRUE = confirmed, FALSE = false positive
    
    -- Time context
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    anomaly_timestamp BIGINT NOT NULL, -- When the anomaly occurred
    
    -- Context data
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    additional_context JSONB DEFAULT '{}',
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    CONSTRAINT valid_anomaly_type CHECK (anomaly_type IN ('statistical', 'pattern', 'contextual', 'collective', 'temporal')),
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_confidence_level CHECK (confidence_level >= 0.0 AND confidence_level <= 1.0)
);

CREATE INDEX idx_analytics_anomalies_metric_time ON analytics_anomalies(metric_name, anomaly_timestamp DESC);
CREATE INDEX idx_analytics_anomalies_severity ON analytics_anomalies(severity, detected_at DESC);
CREATE INDEX idx_analytics_anomalies_unresolved ON analytics_anomalies(resolved, detected_at DESC) WHERE NOT resolved;
CREATE INDEX idx_analytics_anomalies_user ON analytics_anomalies(user_id, detected_at DESC) WHERE user_id IS NOT NULL;

-- =======================
-- REPORTING AND DASHBOARDS
-- =======================

-- Dashboard definitions
CREATE TABLE analytics_dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Dashboard configuration
    layout_config JSONB NOT NULL DEFAULT '{}', -- Grid layout configuration
    widgets JSONB NOT NULL DEFAULT '[]', -- Array of widget configurations
    filters JSONB DEFAULT '{}', -- Default filters
    
    -- Access control
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    shared_with UUID[], -- Array of user IDs
    
    -- Settings
    refresh_interval INTEGER DEFAULT 300, -- Seconds
    is_active BOOLEAN DEFAULT TRUE,
    category VARCHAR(100) DEFAULT 'general',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_refresh_interval CHECK (refresh_interval >= 30)
);

CREATE INDEX idx_analytics_dashboards_owner ON analytics_dashboards(owner_id, created_at DESC);
CREATE INDEX idx_analytics_dashboards_public ON analytics_dashboards(is_public, created_at DESC) WHERE is_public = TRUE;
CREATE INDEX idx_analytics_dashboards_category ON analytics_dashboards(category, created_at DESC);

-- Reports configuration and scheduling
CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Report configuration
    report_type VARCHAR(100) NOT NULL, -- dashboard, kpi, custom, executive
    data_sources JSONB NOT NULL DEFAULT '[]', -- Array of data source configurations
    parameters JSONB DEFAULT '{}', -- Report parameters
    
    -- Scheduling
    schedule_enabled BOOLEAN DEFAULT FALSE,
    schedule_cron VARCHAR(255), -- Cron expression for scheduling
    schedule_timezone VARCHAR(100) DEFAULT 'UTC',
    
    -- Output configuration
    output_formats TEXT[] DEFAULT ARRAY['pdf'], -- pdf, excel, csv, json
    delivery_method VARCHAR(100) DEFAULT 'email', -- email, webhook, storage
    recipients JSONB DEFAULT '[]', -- Array of recipient configurations
    
    -- Access control
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_report_type CHECK (report_type IN ('dashboard', 'kpi', 'custom', 'executive', 'operational')),
    CONSTRAINT valid_delivery_method CHECK (delivery_method IN ('email', 'webhook', 'storage', 'api'))
);

CREATE INDEX idx_analytics_reports_owner ON analytics_reports(owner_id, created_at DESC);
CREATE INDEX idx_analytics_reports_scheduled ON analytics_reports(schedule_enabled, created_at DESC) WHERE schedule_enabled = TRUE;
CREATE INDEX idx_analytics_reports_type ON analytics_reports(report_type, created_at DESC);

-- Report execution history
CREATE TABLE analytics_report_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES analytics_reports(id) ON DELETE CASCADE,
    
    -- Execution details
    execution_type VARCHAR(50) NOT NULL, -- manual, scheduled, api
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- running, completed, failed, cancelled
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    execution_duration_ms INTEGER,
    
    -- Results
    output_files JSONB DEFAULT '[]', -- Array of generated file information
    row_count INTEGER,
    error_message TEXT,
    
    -- Context
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    parameters_used JSONB DEFAULT '{}',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_execution_type CHECK (execution_type IN ('manual', 'scheduled', 'api')),
    CONSTRAINT valid_execution_status CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_analytics_report_executions_report ON analytics_report_executions(report_id, started_at DESC);
CREATE INDEX idx_analytics_report_executions_status ON analytics_report_executions(status, started_at DESC);
CREATE INDEX idx_analytics_report_executions_user ON analytics_report_executions(executed_by, started_at DESC) WHERE executed_by IS NOT NULL;

-- =======================
-- SYSTEM PERFORMANCE ANALYTICS
-- =======================

-- System performance metrics
CREATE TABLE analytics_system_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- System metrics
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_percent DECIMAL(5,2),
    disk_usage_percent DECIMAL(5,2),
    network_in_bytes BIGINT,
    network_out_bytes BIGINT,
    
    -- Application metrics
    active_users INTEGER,
    concurrent_sessions INTEGER,
    requests_per_second DECIMAL(8,2),
    average_response_time_ms DECIMAL(8,2),
    error_rate_percent DECIMAL(5,4),
    
    -- Database metrics
    db_connections_active INTEGER,
    db_connections_total INTEGER,
    db_query_time_avg_ms DECIMAL(8,2),
    db_slow_queries INTEGER,
    
    -- Cache metrics
    cache_hit_rate_percent DECIMAL(5,2),
    cache_memory_usage_mb INTEGER,
    cache_evictions INTEGER,
    
    -- Custom metrics
    custom_metrics JSONB DEFAULT '{}',
    
    -- Timestamp
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_system_performance_timestamp ON analytics_system_performance(timestamp DESC);
CREATE INDEX idx_analytics_system_performance_cpu ON analytics_system_performance(cpu_usage_percent DESC, timestamp DESC);
CREATE INDEX idx_analytics_system_performance_memory ON analytics_system_performance(memory_usage_percent DESC, timestamp DESC);
CREATE INDEX idx_analytics_system_performance_response_time ON analytics_system_performance(average_response_time_ms DESC, timestamp DESC);

-- =======================
-- ANALYTICS CONFIGURATION
-- =======================

-- Analytics configuration and settings
CREATE TABLE analytics_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    data_type VARCHAR(50) NOT NULL, -- string, number, boolean, object, array
    category VARCHAR(100) DEFAULT 'general',
    
    -- Validation
    validation_rules JSONB DEFAULT '{}',
    is_sensitive BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT valid_data_type CHECK (data_type IN ('string', 'number', 'boolean', 'object', 'array'))
);

CREATE INDEX idx_analytics_configuration_category ON analytics_configuration(category);
CREATE INDEX idx_analytics_configuration_sensitive ON analytics_configuration(is_sensitive);

-- Insert default configuration
INSERT INTO analytics_configuration (key, value, description, data_type, category) VALUES
('retention_period_days', '90', 'Data retention period in days', 'number', 'storage'),
('aggregation_intervals', '["1m", "5m", "1h", "1d"]', 'Available aggregation intervals', 'array', 'processing'),
('anomaly_detection_threshold', '2.5', 'Standard deviation threshold for anomaly detection', 'number', 'ml'),
('prediction_horizon_hours', '168', 'Default prediction horizon in hours (7 days)', 'number', 'ml'),
('real_time_processing', 'true', 'Enable real-time analytics processing', 'boolean', 'processing'),
('ml_insights_enabled', 'true', 'Enable machine learning insights', 'boolean', 'ml'),
('dashboard_refresh_interval', '30', 'Default dashboard refresh interval in seconds', 'number', 'ui'),
('alert_throttle_minutes', '15', 'Throttle repeated alerts for this many minutes', 'number', 'alerts'),
('export_max_rows', '1000000', 'Maximum rows allowed in data exports', 'number', 'security'),
('concurrent_processors', '4', 'Number of concurrent data processors', 'number', 'performance');

-- =======================
-- INDEXES AND CONSTRAINTS
-- =======================

-- Create additional composite indexes for common query patterns
CREATE INDEX idx_analytics_metrics_user_name_time ON analytics_metrics(user_id, metric_name, timestamp DESC) 
    WHERE user_id IS NOT NULL;

CREATE INDEX idx_analytics_metrics_hourly ON analytics_metrics(
    metric_name, 
    date_trunc('hour', to_timestamp(timestamp/1000))
);

CREATE INDEX idx_analytics_events_funnel ON analytics_user_events(user_id, event_category, timestamp)
    WHERE event_category = 'conversion';

-- =======================
-- FUNCTIONS AND TRIGGERS
-- =======================

-- Function to automatically update analytics_aggregated_metrics
CREATE OR REPLACE FUNCTION update_aggregated_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- This would contain logic to update aggregated metrics
    -- when new raw metrics are inserted
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update aggregations on new metrics
CREATE TRIGGER trigger_update_aggregated_metrics
    AFTER INSERT ON analytics_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_aggregated_metrics();

-- Function to clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    cutoff_timestamp BIGINT;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_date := CURRENT_TIMESTAMP - INTERVAL '1 day' * retention_days;
    cutoff_timestamp := EXTRACT(epoch FROM cutoff_date) * 1000;
    
    -- Delete old raw metrics
    DELETE FROM analytics_metrics 
    WHERE timestamp < cutoff_timestamp;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old user events
    DELETE FROM analytics_user_events 
    WHERE timestamp < cutoff_timestamp;
    
    -- Delete old predictions
    DELETE FROM analytics_predictions 
    WHERE valid_until < cutoff_date;
    
    -- Delete resolved anomalies older than retention period
    DELETE FROM analytics_anomalies 
    WHERE resolved = TRUE AND resolved_at < cutoff_date;
    
    -- Delete old report executions
    DELETE FROM analytics_report_executions 
    WHERE started_at < cutoff_date;
    
    -- Delete old system performance data
    DELETE FROM analytics_system_performance 
    WHERE timestamp < cutoff_timestamp;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate KPI values
CREATE OR REPLACE FUNCTION calculate_kpi_value(
    kpi_name VARCHAR,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE
) RETURNS DECIMAL(20,8) AS $$
DECLARE
    kpi_config RECORD;
    calculated_value DECIMAL(20,8);
BEGIN
    -- Get KPI configuration
    SELECT * INTO kpi_config 
    FROM analytics_kpis 
    WHERE name = kpi_name AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Calculate based on method
    CASE kpi_config.calculation_method
        WHEN 'avg' THEN
            SELECT AVG(metric_value) INTO calculated_value
            FROM analytics_metrics 
            WHERE metric_name = ANY(kpi_config.source_metrics)
            AND to_timestamp(timestamp/1000) BETWEEN period_start AND period_end;
        
        WHEN 'sum' THEN
            SELECT SUM(metric_value) INTO calculated_value
            FROM analytics_metrics 
            WHERE metric_name = ANY(kpi_config.source_metrics)
            AND to_timestamp(timestamp/1000) BETWEEN period_start AND period_end;
        
        WHEN 'count' THEN
            SELECT COUNT(*) INTO calculated_value
            FROM analytics_metrics 
            WHERE metric_name = ANY(kpi_config.source_metrics)
            AND to_timestamp(timestamp/1000) BETWEEN period_start AND period_end;
            
        ELSE
            calculated_value := 0;
    END CASE;
    
    RETURN calculated_value;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- VIEWS FOR COMMON QUERIES
-- =======================

-- View for real-time metrics dashboard
CREATE VIEW analytics_realtime_metrics AS
SELECT 
    metric_name,
    metric_value as current_value,
    timestamp,
    user_id,
    source,
    category,
    metadata,
    ROW_NUMBER() OVER (PARTITION BY metric_name ORDER BY timestamp DESC) as recency_rank
FROM analytics_metrics
WHERE timestamp > EXTRACT(epoch FROM (CURRENT_TIMESTAMP - INTERVAL '1 hour')) * 1000
ORDER BY timestamp DESC;

-- View for user engagement metrics
CREATE VIEW analytics_user_engagement AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT s.id) as total_sessions,
    COALESCE(AVG(s.duration_seconds), 0) as avg_session_duration,
    COALESCE(SUM(s.page_views), 0) as total_page_views,
    COALESCE(SUM(s.actions_count), 0) as total_actions,
    COALESCE(AVG(s.engagement_score), 0) as avg_engagement_score,
    MAX(s.started_at) as last_session,
    COUNT(DISTINCT DATE(s.started_at)) as active_days
FROM users u
LEFT JOIN analytics_user_sessions s ON u.id = s.user_id
GROUP BY u.id, u.email;

-- View for system health monitoring
CREATE VIEW analytics_system_health AS
SELECT 
    timestamp,
    cpu_usage_percent,
    memory_usage_percent,
    disk_usage_percent,
    requests_per_second,
    average_response_time_ms,
    error_rate_percent,
    active_users,
    concurrent_sessions,
    CASE 
        WHEN cpu_usage_percent > 90 OR memory_usage_percent > 90 OR error_rate_percent > 5 THEN 'critical'
        WHEN cpu_usage_percent > 70 OR memory_usage_percent > 70 OR error_rate_percent > 1 THEN 'warning'
        ELSE 'healthy'
    END as health_status,
    created_at
FROM analytics_system_performance
WHERE timestamp > EXTRACT(epoch FROM (CURRENT_TIMESTAMP - INTERVAL '24 hours')) * 1000
ORDER BY timestamp DESC;

COMMENT ON TABLE analytics_metrics IS 'Core metrics collection table for all analytics data';
COMMENT ON TABLE analytics_aggregated_metrics IS 'Pre-aggregated metrics for faster dashboard queries';
COMMENT ON TABLE analytics_user_sessions IS 'User session tracking for behavior analysis';
COMMENT ON TABLE analytics_user_events IS 'Detailed user interaction events';
COMMENT ON TABLE analytics_kpis IS 'Key Performance Indicator definitions';
COMMENT ON TABLE analytics_kpi_values IS 'Historical KPI values and calculations';
COMMENT ON TABLE analytics_predictions IS 'Machine learning predictions and forecasts';
COMMENT ON TABLE analytics_anomalies IS 'Detected anomalies and unusual patterns';
COMMENT ON TABLE analytics_dashboards IS 'Dashboard configurations and layouts';
COMMENT ON TABLE analytics_reports IS 'Report definitions and scheduling';
COMMENT ON TABLE analytics_report_executions IS 'Report execution history and results';
COMMENT ON TABLE analytics_system_performance IS 'System and application performance metrics';
COMMENT ON TABLE analytics_configuration IS 'Analytics system configuration settings';

COMMENT ON FUNCTION cleanup_old_analytics_data IS 'Removes old analytics data based on retention period';
COMMENT ON FUNCTION calculate_kpi_value IS 'Calculates KPI values for given time periods';

COMMENT ON VIEW analytics_realtime_metrics IS 'Real-time view of current metric values';
COMMENT ON VIEW analytics_user_engagement IS 'User engagement summary statistics';
COMMENT ON VIEW analytics_system_health IS 'Current system health status and metrics';
