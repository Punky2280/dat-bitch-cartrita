-- Task 19: Performance Monitoring Suite Database Schema
-- Creates tables for performance metrics, alerts, and recommendations

-- Performance metrics storage
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value NUMERIC NOT NULL,
    unit VARCHAR(50) DEFAULT '',
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance alerts
CREATE TABLE IF NOT EXISTS performance_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(100) NOT NULL,
    metric VARCHAR(255) NOT NULL,
    value NUMERIC NOT NULL,
    threshold NUMERIC NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'suppressed')),
    message TEXT,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Performance recommendations
CREATE TABLE IF NOT EXISTS performance_recommendations (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL,
    recommendation TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    automated BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'implemented', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    implemented_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    context JSONB DEFAULT '{}',
    metrics_snapshot JSONB DEFAULT '{}',
    implementation_notes TEXT,
    estimated_impact VARCHAR(255)
);

-- Performance thresholds configuration
CREATE TABLE IF NOT EXISTS performance_thresholds (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255) UNIQUE NOT NULL,
    threshold_value NUMERIC NOT NULL,
    threshold_type VARCHAR(50) NOT NULL CHECK (threshold_type IN ('greater_than', 'less_than', 'equals')),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT,
    unit VARCHAR(50) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics (name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics (timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_timestamp ON performance_metrics (name, timestamp);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_status ON performance_alerts (status);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_severity ON performance_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_metric ON performance_alerts (metric);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_triggered_at ON performance_alerts (triggered_at);

CREATE INDEX IF NOT EXISTS idx_performance_recommendations_status ON performance_recommendations (status);
CREATE INDEX IF NOT EXISTS idx_performance_recommendations_severity ON performance_recommendations (severity);
CREATE INDEX IF NOT EXISTS idx_performance_recommendations_rule ON performance_recommendations (rule_name);
CREATE INDEX IF NOT EXISTS idx_performance_recommendations_created_at ON performance_recommendations (created_at);

CREATE INDEX IF NOT EXISTS idx_performance_thresholds_enabled ON performance_thresholds (enabled);
CREATE INDEX IF NOT EXISTS idx_performance_thresholds_metric ON performance_thresholds (metric_name);

-- Insert default performance thresholds
INSERT INTO performance_thresholds (metric_name, threshold_value, threshold_type, severity, description, unit) 
VALUES
    ('system.cpu_usage', 80, 'greater_than', 'high', 'System CPU usage percentage', '%'),
    ('system.memory_usage', 85, 'greater_than', 'high', 'System memory usage percentage', '%'),
    ('system.disk_usage', 90, 'greater_than', 'critical', 'System disk usage percentage', '%'),
    ('app.response_time', 2000, 'greater_than', 'medium', 'Application response time', 'ms'),
    ('app.error_rate', 0.05, 'greater_than', 'high', 'Application error rate', '%'),
    ('db.query_duration', 5000, 'greater_than', 'medium', 'Database query duration', 'ms'),
    ('websocket.latency', 1000, 'greater_than', 'medium', 'WebSocket message latency', 'ms'),
    ('agent.execution_time', 30000, 'greater_than', 'medium', 'Agent task execution time', 'ms')
ON CONFLICT (metric_name) DO NOTHING;
