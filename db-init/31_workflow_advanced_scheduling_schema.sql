-- 31_workflow_advanced_scheduling_schema.sql
-- Component 5: Advanced Scheduling System - Database Schema
-- Comprehensive scheduling tables for cron, event, conditional, and batch processing

-- Create workflow_schedules table
CREATE TABLE IF NOT EXISTS workflow_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('cron', 'event', 'conditional', 'batch', 'calendar')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_schedules
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow_id ON workflow_schedules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_user_id ON workflow_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_type ON workflow_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_active ON workflow_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_priority ON workflow_schedules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_config ON workflow_schedules USING GIN(configuration);

-- Create workflow_schedule_executions table
CREATE TABLE IF NOT EXISTS workflow_schedule_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    context JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    execution_duration_ms INTEGER,
    priority INTEGER,
    trigger_data JSONB DEFAULT '{}'
);

-- Create indexes for workflow_schedule_executions
CREATE INDEX IF NOT EXISTS idx_schedule_executions_schedule_id ON workflow_schedule_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_execution_id ON workflow_schedule_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_status ON workflow_schedule_executions(status);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_started_at ON workflow_schedule_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_context ON workflow_schedule_executions USING GIN(context);

-- Create workflow_event_triggers table for event-based scheduling
CREATE TABLE IF NOT EXISTS workflow_event_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
    event_type VARCHAR(255) NOT NULL,
    event_source VARCHAR(255) NOT NULL,
    conditions JSONB DEFAULT '{}',
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    rate_limit_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_event_triggers
CREATE INDEX IF NOT EXISTS idx_event_triggers_schedule_id ON workflow_event_triggers(schedule_id);
CREATE INDEX IF NOT EXISTS idx_event_triggers_event_type ON workflow_event_triggers(event_type);
CREATE INDEX IF NOT EXISTS idx_event_triggers_event_source ON workflow_event_triggers(event_source);
CREATE INDEX IF NOT EXISTS idx_event_triggers_active ON workflow_event_triggers(is_active);

-- Create workflow_conditional_rules table for conditional scheduling
CREATE TABLE IF NOT EXISTS workflow_conditional_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(100) NOT NULL CHECK (condition_type IN ('database', 'api', 'time', 'file', 'webhook')),
    condition_query TEXT NOT NULL,
    expected_value JSONB,
    operator VARCHAR(50) DEFAULT 'equals' CHECK (operator IN ('equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'regex', 'exists')),
    evaluation_order INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    last_evaluated_at TIMESTAMP WITH TIME ZONE,
    last_result BOOLEAN,
    evaluation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_conditional_rules
CREATE INDEX IF NOT EXISTS idx_conditional_rules_schedule_id ON workflow_conditional_rules(schedule_id);
CREATE INDEX IF NOT EXISTS idx_conditional_rules_type ON workflow_conditional_rules(condition_type);
CREATE INDEX IF NOT EXISTS idx_conditional_rules_order ON workflow_conditional_rules(evaluation_order);
CREATE INDEX IF NOT EXISTS idx_conditional_rules_active ON workflow_conditional_rules(is_active);

-- Create workflow_batch_processing table for batch scheduling
CREATE TABLE IF NOT EXISTS workflow_batch_processing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
    data_source VARCHAR(255) NOT NULL,
    batch_size INTEGER DEFAULT 10,
    filter_criteria JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'idle' CHECK (processing_status IN ('idle', 'processing', 'completed', 'failed')),
    last_batch_at TIMESTAMP WITH TIME ZONE,
    total_processed INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    current_batch_id UUID,
    parallel_processing BOOLEAN DEFAULT false,
    max_concurrency INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_batch_processing
CREATE INDEX IF NOT EXISTS idx_batch_processing_schedule_id ON workflow_batch_processing(schedule_id);
CREATE INDEX IF NOT EXISTS idx_batch_processing_data_source ON workflow_batch_processing(data_source);
CREATE INDEX IF NOT EXISTS idx_batch_processing_status ON workflow_batch_processing(processing_status);

-- Create workflow_calendar_integrations table for calendar-based scheduling
CREATE TABLE IF NOT EXISTS workflow_calendar_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
    calendar_provider VARCHAR(100) NOT NULL CHECK (calendar_provider IN ('google', 'outlook', 'ical', 'caldav')),
    calendar_id VARCHAR(255) NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    event_query JSONB DEFAULT '{}',
    trigger_offset_minutes INTEGER DEFAULT 0,
    business_hours_only BOOLEAN DEFAULT false,
    timezone VARCHAR(100) DEFAULT 'UTC',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'disabled')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_calendar_integrations
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_schedule_id ON workflow_calendar_integrations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_provider ON workflow_calendar_integrations(calendar_provider);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_status ON workflow_calendar_integrations(sync_status);

-- Create workflow_schedule_queue table for priority queue management
CREATE TABLE IF NOT EXISTS workflow_schedule_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 5,
    queue_status VARCHAR(50) DEFAULT 'pending' CHECK (queue_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    context JSONB DEFAULT '{}',
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    processing_node VARCHAR(255), -- For distributed processing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for workflow_schedule_queue
CREATE INDEX IF NOT EXISTS idx_schedule_queue_schedule_id ON workflow_schedule_queue(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_queue_workflow_id ON workflow_schedule_queue(workflow_id);
CREATE INDEX IF NOT EXISTS idx_schedule_queue_priority ON workflow_schedule_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_schedule_queue_status ON workflow_schedule_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_schedule_queue_scheduled_for ON workflow_schedule_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_schedule_queue_processing_node ON workflow_schedule_queue(processing_node);

-- Create workflow_schedule_statistics table for analytics
CREATE TABLE IF NOT EXISTS workflow_schedule_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
    date_recorded DATE DEFAULT CURRENT_DATE,
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    skipped_executions INTEGER DEFAULT 0,
    avg_execution_time_ms INTEGER DEFAULT 0,
    min_execution_time_ms INTEGER DEFAULT 0,
    max_execution_time_ms INTEGER DEFAULT 0,
    total_queue_time_ms INTEGER DEFAULT 0,
    avg_queue_time_ms INTEGER DEFAULT 0,
    error_types JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(schedule_id, date_recorded)
);

-- Create indexes for workflow_schedule_statistics
CREATE INDEX IF NOT EXISTS idx_schedule_statistics_schedule_id ON workflow_schedule_statistics(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_statistics_date ON workflow_schedule_statistics(date_recorded DESC);

-- Create materialized view for schedule performance overview
CREATE MATERIALIZED VIEW IF NOT EXISTS workflow_schedule_performance_overview AS
SELECT 
    ws.id,
    ws.name,
    ws.schedule_type,
    ws.is_active,
    ws.priority,
    COUNT(wse.id) as total_executions,
    COUNT(CASE WHEN wse.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN wse.status = 'failed' THEN 1 END) as failed_executions,
    COUNT(CASE WHEN wse.status = 'skipped' THEN 1 END) as skipped_executions,
    ROUND(AVG(wse.execution_duration_ms)) as avg_execution_time_ms,
    MAX(wse.started_at) as last_execution_at,
    CASE 
        WHEN COUNT(wse.id) = 0 THEN 0
        ELSE ROUND((COUNT(CASE WHEN wse.status = 'completed' THEN 1 END)::numeric / COUNT(wse.id)::numeric) * 100, 2)
    END as success_rate_percentage
FROM workflow_schedules ws
LEFT JOIN workflow_schedule_executions wse ON ws.id = wse.schedule_id
    AND wse.started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ws.id, ws.name, ws.schedule_type, ws.is_active, ws.priority;

-- Create index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_performance_overview_id ON workflow_schedule_performance_overview(id);

-- Create materialized view for schedule queue analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS workflow_schedule_queue_analysis AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour_bucket,
    schedule_id,
    COUNT(*) as items_queued,
    COUNT(CASE WHEN queue_status = 'completed' THEN 1 END) as items_completed,
    COUNT(CASE WHEN queue_status = 'failed' THEN 1 END) as items_failed,
    AVG(EXTRACT(EPOCH FROM (COALESCE(started_at, NOW()) - created_at)) * 1000)::integer as avg_queue_wait_ms,
    AVG(CASE 
        WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
    END)::integer as avg_processing_time_ms,
    AVG(priority) as avg_priority
FROM workflow_schedule_queue
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), schedule_id;

-- Create index for the queue analysis view
CREATE INDEX IF NOT EXISTS idx_schedule_queue_analysis_hour_schedule ON workflow_schedule_queue_analysis(hour_bucket, schedule_id);

-- Create function to refresh performance views
CREATE OR REPLACE FUNCTION refresh_schedule_performance_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_schedule_performance_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_schedule_queue_analysis;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old schedule data
CREATE OR REPLACE FUNCTION cleanup_old_schedule_data()
RETURNS void AS $$
BEGIN
    -- Clean up old execution records (older than 90 days)
    DELETE FROM workflow_schedule_executions 
    WHERE started_at < CURRENT_DATE - INTERVAL '90 days';
    
    -- Clean up completed queue items (older than 30 days)
    DELETE FROM workflow_schedule_queue 
    WHERE queue_status IN ('completed', 'failed', 'cancelled')
    AND completed_at < CURRENT_DATE - INTERVAL '30 days';
    
    -- Clean up old statistics (older than 1 year)
    DELETE FROM workflow_schedule_statistics 
    WHERE date_recorded < CURRENT_DATE - INTERVAL '1 year';
    
    -- Refresh performance views after cleanup
    PERFORM refresh_schedule_performance_views();
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate schedule health score
CREATE OR REPLACE FUNCTION calculate_schedule_health_score(schedule_uuid UUID)
RETURNS numeric AS $$
DECLARE
    health_score numeric := 100.0;
    success_rate numeric;
    avg_execution_time numeric;
    error_frequency numeric;
    last_execution_days numeric;
BEGIN
    -- Get success rate (last 30 days)
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 100
            ELSE (COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric / COUNT(*)::numeric) * 100
        END
    INTO success_rate
    FROM workflow_schedule_executions 
    WHERE schedule_id = schedule_uuid 
    AND started_at >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Get average execution time trend
    SELECT AVG(execution_duration_ms) INTO avg_execution_time
    FROM workflow_schedule_executions 
    WHERE schedule_id = schedule_uuid 
    AND started_at >= CURRENT_DATE - INTERVAL '7 days'
    AND status = 'completed';
    
    -- Get error frequency (errors per day in last 7 days)
    SELECT COUNT(*)::numeric / 7 INTO error_frequency
    FROM workflow_schedule_executions 
    WHERE schedule_id = schedule_uuid 
    AND started_at >= CURRENT_DATE - INTERVAL '7 days'
    AND status = 'failed';
    
    -- Get days since last execution
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(started_at))) / 86400 INTO last_execution_days
    FROM workflow_schedule_executions 
    WHERE schedule_id = schedule_uuid;
    
    -- Calculate health score based on multiple factors
    
    -- Success rate impact (40% of score)
    health_score := health_score * (COALESCE(success_rate, 100) / 100) * 0.4 + health_score * 0.6;
    
    -- Error frequency impact (30% of score)
    IF error_frequency > 5 THEN
        health_score := health_score * 0.3;
    ELSIF error_frequency > 2 THEN
        health_score := health_score * 0.7;
    ELSIF error_frequency > 0 THEN
        health_score := health_score * 0.9;
    END IF;
    
    -- Last execution recency impact (20% of score)
    IF last_execution_days > 7 THEN
        health_score := health_score * 0.5;
    ELSIF last_execution_days > 3 THEN
        health_score := health_score * 0.8;
    ELSIF last_execution_days > 1 THEN
        health_score := health_score * 0.95;
    END IF;
    
    -- Performance impact (10% of score)
    -- This is simplified - could be enhanced with baseline comparison
    IF avg_execution_time > 60000 THEN -- > 1 minute
        health_score := health_score * 0.9;
    END IF;
    
    RETURN ROUND(health_score, 2);
END;
$$ LANGUAGE plpgsql;

-- Create function to get schedule next execution estimate
CREATE OR REPLACE FUNCTION get_schedule_next_execution(schedule_uuid UUID)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    schedule_record workflow_schedules%ROWTYPE;
    next_execution TIMESTAMP WITH TIME ZONE;
    config JSONB;
BEGIN
    -- Get schedule configuration
    SELECT * INTO schedule_record 
    FROM workflow_schedules 
    WHERE id = schedule_uuid;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    config := schedule_record.configuration;
    
    -- Estimate next execution based on schedule type
    CASE schedule_record.schedule_type
        WHEN 'cron' THEN
            -- For cron schedules, this would require a more sophisticated cron parser
            -- For now, returning a simple estimate
            next_execution := NOW() + INTERVAL '1 hour';
            
        WHEN 'event' THEN
            -- Event-based schedules are unpredictable
            next_execution := NULL;
            
        WHEN 'conditional' THEN
            -- Based on check interval
            next_execution := NOW() + INTERVAL '1 minute' * COALESCE((config->>'checkInterval')::integer / 60000, 1);
            
        WHEN 'batch' THEN
            -- Based on processing interval
            next_execution := NOW() + INTERVAL '1 minute' * COALESCE((config->>'processingInterval')::integer / 60000, 5);
            
        ELSE
            next_execution := NULL;
    END CASE;
    
    RETURN next_execution;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update workflow_schedules updated_at
CREATE OR REPLACE FUNCTION update_workflow_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_schedules_updated_at
    BEFORE UPDATE ON workflow_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_schedules_updated_at();

-- Create trigger to update workflow_batch_processing updated_at
CREATE OR REPLACE FUNCTION update_workflow_batch_processing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_batch_processing_updated_at
    BEFORE UPDATE ON workflow_batch_processing
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_batch_processing_updated_at();

-- Create trigger to update workflow_calendar_integrations updated_at
CREATE OR REPLACE FUNCTION update_workflow_calendar_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_calendar_integrations_updated_at
    BEFORE UPDATE ON workflow_calendar_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_calendar_integrations_updated_at();

-- Insert default schedule types for reference
INSERT INTO lookup_tables (table_name, key, value, description) VALUES
('schedule_types', 'cron', 'Cron Expression', 'Time-based scheduling using cron expressions'),
('schedule_types', 'event', 'Event Trigger', 'Event-driven scheduling based on system or external events'),
('schedule_types', 'conditional', 'Conditional Logic', 'Scheduling based on conditional rules and database queries'),
('schedule_types', 'batch', 'Batch Processing', 'Bulk data processing with configurable batch sizes'),
('schedule_types', 'calendar', 'Calendar Integration', 'Integration with external calendar systems')
ON CONFLICT (table_name, key) DO NOTHING;

-- Insert default condition operators
INSERT INTO lookup_tables (table_name, key, value, description) VALUES
('condition_operators', 'equals', 'Equals', 'Exact value match'),
('condition_operators', 'not_equals', 'Not Equals', 'Value does not match'),
('condition_operators', 'greater_than', 'Greater Than', 'Numeric value is greater'),
('condition_operators', 'less_than', 'Less Than', 'Numeric value is less'),
('condition_operators', 'contains', 'Contains', 'String or array contains value'),
('condition_operators', 'regex', 'Regular Expression', 'String matches regex pattern'),
('condition_operators', 'exists', 'Exists', 'Value or property exists')
ON CONFLICT (table_name, key) DO NOTHING;

-- Create a scheduled job to refresh materialized views (runs every hour)
-- This would typically be set up in your application or cron system
-- SELECT cron.schedule('refresh-schedule-views', '0 * * * *', 'SELECT refresh_schedule_performance_views();');

-- Create a scheduled job to cleanup old data (runs daily at 2 AM)
-- SELECT cron.schedule('cleanup-schedule-data', '0 2 * * *', 'SELECT cleanup_old_schedule_data();');

COMMENT ON TABLE workflow_schedules IS 'Main table for workflow scheduling configurations';
COMMENT ON TABLE workflow_schedule_executions IS 'Records of all workflow schedule executions';
COMMENT ON TABLE workflow_event_triggers IS 'Configuration for event-based workflow triggers';
COMMENT ON TABLE workflow_conditional_rules IS 'Rules for conditional workflow scheduling';
COMMENT ON TABLE workflow_batch_processing IS 'Configuration for batch workflow processing';
COMMENT ON TABLE workflow_calendar_integrations IS 'Calendar system integrations for scheduling';
COMMENT ON TABLE workflow_schedule_queue IS 'Priority queue for scheduled workflow executions';
COMMENT ON TABLE workflow_schedule_statistics IS 'Daily statistics for workflow schedule performance';

COMMENT ON FUNCTION calculate_schedule_health_score(UUID) IS 'Calculates a health score (0-100) for a workflow schedule based on success rate, error frequency, and performance metrics';
COMMENT ON FUNCTION get_schedule_next_execution(UUID) IS 'Estimates the next execution time for a workflow schedule based on its configuration';
COMMENT ON FUNCTION refresh_schedule_performance_views() IS 'Refreshes materialized views for schedule performance analytics';
COMMENT ON FUNCTION cleanup_old_schedule_data() IS 'Cleans up old schedule execution data and statistics to maintain performance';
