-- 30_workflow_monitoring_dashboard_schema.sql
-- Component 4: Workflow Monitoring Dashboard - Database Schema
-- Real-time monitoring with alerts, metrics, and performance tracking

-- Workflow monitoring alerts table
CREATE TABLE IF NOT EXISTS workflow_monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL, -- 'long_execution', 'high_error_rate', 'resource_limit', 'failure_pattern'
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    workflow_id UUID REFERENCES workflow_definitions(id),
    execution_id UUID REFERENCES workflow_executions(id),
    user_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    acknowledged_by UUID,
    resolved_at TIMESTAMP,
    resolved_by UUID,
    resolution TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_monitoring_alerts_type (alert_type),
    INDEX idx_monitoring_alerts_severity (severity),
    INDEX idx_monitoring_alerts_workflow (workflow_id),
    INDEX idx_monitoring_alerts_execution (execution_id),
    INDEX idx_monitoring_alerts_user (user_id),
    INDEX idx_monitoring_alerts_status ((resolved_at IS NULL)),
    INDEX idx_monitoring_alerts_created (created_at),
    INDEX idx_monitoring_alerts_metadata (metadata) USING GIN
);

-- Workflow execution metrics table for time-series data
CREATE TABLE IF NOT EXISTS workflow_execution_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES workflow_executions(id),
    workflow_id UUID REFERENCES workflow_definitions(id),
    metric_type VARCHAR(50) NOT NULL, -- 'execution_time', 'memory_usage', 'cpu_usage', 'throughput'
    metric_value DECIMAL(10,4) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL, -- 'seconds', 'mb', 'percent', 'count'
    recorded_at TIMESTAMP DEFAULT NOW(),
    node_id VARCHAR(255), -- Specific node metrics
    tags JSONB DEFAULT '{}', -- Additional metric tags
    
    -- Indexes
    INDEX idx_execution_metrics_execution (execution_id),
    INDEX idx_execution_metrics_workflow (workflow_id),
    INDEX idx_execution_metrics_type (metric_type),
    INDEX idx_execution_metrics_recorded (recorded_at),
    INDEX idx_execution_metrics_node (node_id),
    INDEX idx_execution_metrics_tags (tags) USING GIN
);

-- Workflow performance snapshots for historical analysis
CREATE TABLE IF NOT EXISTS workflow_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflow_definitions(id),
    snapshot_date DATE NOT NULL,
    time_period VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
    
    -- Execution statistics
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    cancelled_executions INTEGER DEFAULT 0,
    avg_execution_time_seconds DECIMAL(10,3),
    min_execution_time_seconds DECIMAL(10,3),
    max_execution_time_seconds DECIMAL(10,3),
    
    -- Resource utilization
    avg_memory_usage_mb DECIMAL(10,2),
    max_memory_usage_mb DECIMAL(10,2),
    avg_cpu_usage_percent DECIMAL(5,2),
    max_cpu_usage_percent DECIMAL(5,2),
    
    -- Error analysis
    total_errors INTEGER DEFAULT 0,
    total_warnings INTEGER DEFAULT 0,
    error_rate DECIMAL(5,4),
    
    -- Node execution statistics
    total_nodes_executed INTEGER DEFAULT 0,
    avg_nodes_per_execution DECIMAL(8,2),
    
    -- Performance scores
    performance_score DECIMAL(3,2), -- 0.00 to 1.00
    reliability_score DECIMAL(3,2), -- 0.00 to 1.00
    efficiency_score DECIMAL(3,2), -- 0.00 to 1.00
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_workflow_snapshot_period UNIQUE (workflow_id, snapshot_date, time_period),
    
    -- Indexes
    INDEX idx_performance_snapshots_workflow (workflow_id),
    INDEX idx_performance_snapshots_date (snapshot_date),
    INDEX idx_performance_snapshots_period (time_period),
    INDEX idx_performance_snapshots_created (created_at)
);

-- System resource monitoring table
CREATE TABLE IF NOT EXISTS system_resource_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorded_at TIMESTAMP DEFAULT NOW(),
    
    -- System metrics
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_percent DECIMAL(5,2),
    disk_usage_percent DECIMAL(5,2),
    load_average DECIMAL(8,4),
    
    -- Application metrics
    active_executions INTEGER DEFAULT 0,
    queued_executions INTEGER DEFAULT 0,
    total_memory_mb DECIMAL(10,2),
    available_memory_mb DECIMAL(10,2),
    
    -- Database metrics
    database_connections INTEGER DEFAULT 0,
    database_size_mb DECIMAL(12,2),
    query_performance_ms DECIMAL(10,3),
    
    -- Network metrics
    network_in_mb DECIMAL(10,2),
    network_out_mb DECIMAL(10,2),
    
    -- Indexes
    INDEX idx_system_metrics_recorded (recorded_at)
);

-- Workflow monitoring dashboard configurations
CREATE TABLE IF NOT EXISTS workflow_dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    dashboard_name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Dashboard configuration
    layout JSONB DEFAULT '{}', -- Widget positions and sizes
    widgets JSONB DEFAULT '[]', -- Enabled widgets and their settings
    filters JSONB DEFAULT '{}', -- Default filters (time range, workflows, categories)
    refresh_interval INTEGER DEFAULT 30, -- Seconds
    
    -- Alert settings
    alert_preferences JSONB DEFAULT '{}', -- Alert types, notifications
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_user_dashboard_name UNIQUE (user_id, dashboard_name),
    
    -- Indexes
    INDEX idx_dashboard_configs_user (user_id),
    INDEX idx_dashboard_configs_default (user_id, is_default)
);

-- Workflow monitoring widget definitions
CREATE TABLE IF NOT EXISTS workflow_monitoring_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_type VARCHAR(50) NOT NULL, -- 'execution_stats', 'performance_chart', 'error_analysis', etc.
    widget_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Widget configuration schema
    config_schema JSONB NOT NULL, -- JSON schema for widget configuration
    default_config JSONB DEFAULT '{}', -- Default configuration
    
    -- Display properties
    min_width INTEGER DEFAULT 2,
    min_height INTEGER DEFAULT 2,
    max_width INTEGER DEFAULT 12,
    max_height INTEGER DEFAULT 8,
    
    -- Data requirements
    data_sources JSONB DEFAULT '[]', -- Required data sources
    update_frequency INTEGER DEFAULT 30, -- Seconds
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_monitoring_widgets_type (widget_type),
    INDEX idx_monitoring_widgets_active (is_active)
);

-- Workflow execution annotations for monitoring
CREATE TABLE IF NOT EXISTS workflow_execution_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES workflow_executions(id),
    workflow_id UUID REFERENCES workflow_definitions(id),
    
    -- Annotation details
    annotation_type VARCHAR(50) NOT NULL, -- 'milestone', 'issue', 'optimization', 'deployment'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20), -- 'info', 'warning', 'critical'
    
    -- Context
    node_id VARCHAR(255), -- Specific node if applicable
    timestamp_offset INTEGER, -- Seconds from execution start
    
    -- Metadata
    tags JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_execution_annotations_execution (execution_id),
    INDEX idx_execution_annotations_workflow (workflow_id),
    INDEX idx_execution_annotations_type (annotation_type),
    INDEX idx_execution_annotations_created (created_at)
);

-- Alert notification rules
CREATE TABLE IF NOT EXISTS workflow_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Rule conditions
    alert_types JSONB DEFAULT '[]', -- Array of alert types to match
    severity_threshold VARCHAR(20) DEFAULT 'warning', -- Minimum severity
    workflow_filter JSONB DEFAULT '{}', -- Workflow ID patterns, categories
    time_window_minutes INTEGER DEFAULT 60, -- Alert aggregation window
    
    -- Notification settings
    notification_channels JSONB DEFAULT '[]', -- email, slack, webhook, etc.
    notification_config JSONB DEFAULT '{}', -- Channel-specific configuration
    cooldown_minutes INTEGER DEFAULT 60, -- Minimum time between notifications
    
    -- Escalation rules
    escalation_config JSONB DEFAULT '{}', -- Escalation timing and targets
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_alert_rules_user (user_id),
    INDEX idx_alert_rules_active (is_active)
);

-- Workflow monitoring views for common queries

-- Real-time execution status view
CREATE OR REPLACE VIEW workflow_execution_status_realtime AS
SELECT 
    we.id as execution_id,
    we.workflow_id,
    wd.name as workflow_name,
    wd.category,
    we.status,
    we.started_at,
    we.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(we.completed_at, NOW()) - we.started_at)) as duration_seconds,
    we.current_node_id,
    we.nodes_executed,
    we.trigger_type,
    
    -- Resource usage
    we.memory_usage_mb,
    we.cpu_usage_percent,
    
    -- Error counts
    (SELECT COUNT(*) FROM workflow_execution_logs wel WHERE wel.execution_id = we.id AND wel.level = 'error') as error_count,
    (SELECT COUNT(*) FROM workflow_execution_logs wel WHERE wel.execution_id = we.id AND wel.level = 'warn') as warning_count,
    
    -- Health status
    CASE 
        WHEN we.status = 'failed' THEN 'critical'
        WHEN we.status = 'completed' AND (SELECT COUNT(*) FROM workflow_execution_logs wel WHERE wel.execution_id = we.id AND wel.level = 'error') > 0 THEN 'warning'
        WHEN we.status = 'completed' THEN 'healthy'
        WHEN we.status = 'running' THEN 'active'
        ELSE 'unknown'
    END as health_status
    
FROM workflow_executions we
LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
WHERE we.started_at >= NOW() - INTERVAL '24 hours'
ORDER BY we.started_at DESC;

-- Workflow performance summary view
CREATE OR REPLACE VIEW workflow_performance_summary AS
SELECT 
    wd.id as workflow_id,
    wd.name as workflow_name,
    wd.category,
    wd.created_by,
    
    -- Execution statistics (last 30 days)
    COUNT(we.id) as total_executions_30d,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions_30d,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions_30d,
    
    -- Performance metrics
    AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))) as avg_execution_time_seconds,
    AVG(we.nodes_executed) as avg_nodes_executed,
    AVG(we.memory_usage_mb) as avg_memory_usage_mb,
    
    -- Success rate
    CASE 
        WHEN COUNT(we.id) > 0 THEN
            COUNT(CASE WHEN we.status = 'completed' THEN 1 END)::FLOAT / COUNT(we.id)
        ELSE 0
    END as success_rate,
    
    -- Recent activity
    MAX(we.started_at) as last_execution,
    COUNT(CASE WHEN we.started_at >= NOW() - INTERVAL '7 days' THEN 1 END) as executions_7d,
    COUNT(CASE WHEN we.started_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as executions_24h

FROM workflow_definitions wd
LEFT JOIN workflow_executions we ON wd.id = we.workflow_id 
    AND we.started_at >= NOW() - INTERVAL '30 days'
GROUP BY wd.id, wd.name, wd.category, wd.created_by;

-- Active alerts summary view
CREATE OR REPLACE VIEW workflow_alerts_summary AS
SELECT 
    wma.severity,
    wma.alert_type,
    COUNT(*) as alert_count,
    COUNT(CASE WHEN wma.acknowledged_at IS NULL THEN 1 END) as unacknowledged_count,
    MIN(wma.created_at) as oldest_alert,
    MAX(wma.created_at) as newest_alert,
    AVG(EXTRACT(EPOCH FROM (COALESCE(wma.resolved_at, NOW()) - wma.created_at))) as avg_resolution_time_seconds

FROM workflow_monitoring_alerts wma
WHERE wma.resolved_at IS NULL
    OR wma.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY wma.severity, wma.alert_type
ORDER BY 
    CASE wma.severity 
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'info' THEN 3
        ELSE 4
    END,
    alert_count DESC;

-- System resource trends view
CREATE OR REPLACE VIEW system_resource_trends AS
SELECT 
    DATE_TRUNC('hour', recorded_at) as hour,
    AVG(cpu_usage_percent) as avg_cpu_usage,
    MAX(cpu_usage_percent) as max_cpu_usage,
    AVG(memory_usage_percent) as avg_memory_usage,
    MAX(memory_usage_percent) as max_memory_usage,
    AVG(load_average) as avg_load,
    MAX(load_average) as max_load,
    AVG(active_executions) as avg_active_executions,
    MAX(active_executions) as max_active_executions,
    AVG(queued_executions) as avg_queued_executions,
    MAX(queued_executions) as max_queued_executions

FROM system_resource_metrics
WHERE recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', recorded_at)
ORDER BY hour;

-- Add default monitoring widgets
INSERT INTO workflow_monitoring_widgets (widget_type, widget_name, description, config_schema, default_config, min_width, min_height, data_sources) VALUES
('execution_stats', 'Execution Statistics', 'Real-time workflow execution statistics', 
    '{"type": "object", "properties": {"timeRange": {"type": "string", "enum": ["1h", "24h", "7d"]}, "showPercentages": {"type": "boolean"}}}',
    '{"timeRange": "24h", "showPercentages": true}',
    3, 2, '["workflow_executions"]'),

('performance_chart', 'Performance Timeline', 'Performance metrics over time',
    '{"type": "object", "properties": {"metrics": {"type": "array"}, "timeRange": {"type": "string"}, "chartType": {"type": "string"}}}',
    '{"metrics": ["execution_time", "success_rate"], "timeRange": "24h", "chartType": "line"}',
    6, 4, '["workflow_execution_metrics"]'),

('error_analysis', 'Error Analysis', 'Error patterns and analysis',
    '{"type": "object", "properties": {"groupBy": {"type": "string"}, "topN": {"type": "number"}}}',
    '{"groupBy": "error_type", "topN": 10}',
    4, 3, '["workflow_execution_logs"]'),

('resource_usage', 'Resource Usage', 'System resource utilization',
    '{"type": "object", "properties": {"showPrediction": {"type": "boolean"}, "alertThresholds": {"type": "object"}}}',
    '{"showPrediction": false, "alertThresholds": {"cpu": 80, "memory": 80}}',
    4, 3, '["system_resource_metrics"]'),

('active_workflows', 'Active Workflows', 'Currently running workflows',
    '{"type": "object", "properties": {"maxItems": {"type": "number"}, "showDetails": {"type": "boolean"}}}',
    '{"maxItems": 20, "showDetails": true}',
    6, 4, '["workflow_executions"]'),

('alerts_panel', 'Alerts Panel', 'Active alerts and notifications',
    '{"type": "object", "properties": {"severityFilter": {"type": "array"}, "autoRefresh": {"type": "boolean"}}}',
    '{"severityFilter": ["critical", "warning"], "autoRefresh": true}',
    4, 3, '["workflow_monitoring_alerts"]');

-- Create functions for common monitoring operations

-- Function to calculate workflow health score
CREATE OR REPLACE FUNCTION calculate_workflow_health_score(workflow_id_param UUID, days_back INTEGER DEFAULT 7)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    success_rate DECIMAL;
    avg_execution_time DECIMAL;
    error_rate DECIMAL;
    health_score DECIMAL;
BEGIN
    -- Calculate success rate
    SELECT 
        CASE 
            WHEN COUNT(*) > 0 THEN
                COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / COUNT(*)
            ELSE 0
        END
    INTO success_rate
    FROM workflow_executions 
    WHERE workflow_id = workflow_id_param 
        AND started_at >= NOW() - (days_back || ' days')::INTERVAL;
    
    -- Calculate error rate from logs
    SELECT 
        CASE 
            WHEN COUNT(DISTINCT we.id) > 0 THEN
                COUNT(wel.id)::DECIMAL / COUNT(DISTINCT we.id)
            ELSE 0
        END
    INTO error_rate
    FROM workflow_executions we
    LEFT JOIN workflow_execution_logs wel ON we.id = wel.execution_id AND wel.level = 'error'
    WHERE we.workflow_id = workflow_id_param 
        AND we.started_at >= NOW() - (days_back || ' days')::INTERVAL;
    
    -- Composite health score
    health_score := GREATEST(0, LEAST(1,
        (COALESCE(success_rate, 0) * 0.5) + 
        ((1 - LEAST(1, COALESCE(error_rate, 0))) * 0.3) +
        0.2 -- Base score for active workflows
    ));
    
    RETURN health_score;
END;
$$ LANGUAGE plpgsql;

-- Function to get workflow performance trend
CREATE OR REPLACE FUNCTION get_workflow_performance_trend(workflow_id_param UUID, hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
    hour_bucket TIMESTAMP,
    execution_count INTEGER,
    avg_execution_time DECIMAL,
    success_rate DECIMAL,
    error_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('hour', we.started_at) as hour_bucket,
        COUNT(we.id)::INTEGER as execution_count,
        AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at)))::DECIMAL as avg_execution_time,
        (COUNT(CASE WHEN we.status = 'completed' THEN 1 END)::DECIMAL / NULLIF(COUNT(we.id), 0))::DECIMAL as success_rate,
        (SELECT COUNT(*) FROM workflow_execution_logs wel 
         WHERE wel.execution_id = ANY(ARRAY_AGG(we.id)) AND wel.level = 'error')::INTEGER as error_count
    FROM workflow_executions we
    WHERE we.workflow_id = workflow_id_param
        AND we.started_at >= NOW() - (hours_back || ' hours')::INTERVAL
    GROUP BY DATE_TRUNC('hour', we.started_at)
    ORDER BY hour_bucket;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_started ON workflow_executions(status, started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_status ON workflow_executions(workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_level_timestamp ON workflow_execution_logs(level, timestamp);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity_created ON workflow_monitoring_alerts(severity, created_at);

-- Comments for documentation
COMMENT ON TABLE workflow_monitoring_alerts IS 'Stores workflow monitoring alerts with severity levels and resolution tracking';
COMMENT ON TABLE workflow_execution_metrics IS 'Time-series metrics data for workflow executions';
COMMENT ON TABLE workflow_performance_snapshots IS 'Historical performance snapshots for trend analysis';
COMMENT ON TABLE system_resource_metrics IS 'System resource utilization metrics';
COMMENT ON TABLE workflow_dashboard_configs IS 'User dashboard configurations and layouts';
COMMENT ON TABLE workflow_monitoring_widgets IS 'Widget definitions for monitoring dashboards';
COMMENT ON TABLE workflow_execution_annotations IS 'User annotations on workflow executions';
COMMENT ON TABLE workflow_alert_rules IS 'Alert notification rules and escalation policies';

COMMENT ON FUNCTION calculate_workflow_health_score IS 'Calculates a composite health score (0-1) for a workflow based on success rate and error patterns';
COMMENT ON FUNCTION get_workflow_performance_trend IS 'Returns hourly performance trend data for a specific workflow';
