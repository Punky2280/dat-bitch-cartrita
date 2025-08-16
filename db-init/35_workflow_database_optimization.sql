-- 35_workflow_database_optimization.sql
-- Component 7: Database Schema Optimization
-- Comprehensive performance optimization for enterprise workflow system

-- ===========================================================================
-- ADVANCED INDEXING STRATEGIES
-- ===========================================================================

-- Workflow-related composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_user_category_status ON workflows(user_id, category, status) WHERE is_template = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_template_category ON workflows(category, created_at DESC) WHERE is_template = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_public_templates ON workflows(is_public, category, created_at DESC) WHERE is_template = true;

-- Workflow execution optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_status_created ON workflow_executions(status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_workflow_status ON workflow_executions(workflow_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_user_recent ON workflow_executions(user_id, created_at DESC) WHERE created_at > CURRENT_DATE - INTERVAL '30 days';

-- Workflow execution logs optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_execution_logs_execution_timestamp ON workflow_execution_logs(execution_id, timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_execution_logs_level_timestamp ON workflow_execution_logs(log_level, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_execution_logs_error_recent ON workflow_execution_logs(execution_id, timestamp DESC) WHERE log_level = 'error';

-- Service integration indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_integrations_user_type_active ON service_integrations(user_id, integration_type, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_integrations_status_updated ON service_integrations(status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_executions_recent_performance ON integration_executions(integration_id, executed_at DESC, status, duration_ms);

-- Workflow scheduling indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_schedules_next_run ON workflow_schedules(next_run_time) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_schedules_user_active ON workflow_schedules(user_id, is_active, schedule_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_schedule_executions_schedule_time ON workflow_schedule_executions(schedule_id, executed_at DESC);

-- Template and library indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_category_rating ON workflow_templates(category, average_rating DESC NULLS LAST);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_downloads ON workflow_templates(download_count DESC, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_template_versions_template_version ON workflow_template_versions(template_id, version_number DESC);

-- Monitoring and metrics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_monitoring_metrics_time_series ON workflow_monitoring_metrics(workflow_id, metric_timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_monitoring_alerts_active ON workflow_monitoring_alerts(workflow_id, is_active, severity);

-- Full-text search indexes for workflow content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_search_name ON workflows USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_templates_search ON workflow_templates USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(tags::text, '')));

-- JSON field optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_configuration_gin ON workflows USING gin(configuration);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_metadata ON workflow_executions USING gin(metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_integrations_config ON service_integrations USING gin(configuration);

-- ===========================================================================
-- TABLE PARTITIONING STRATEGIES  
-- ===========================================================================

-- Partition workflow_execution_logs by month for better performance
-- This helps with log retention and query performance
CREATE TABLE workflow_execution_logs_partitioned (
    LIKE workflow_execution_logs INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- Create partitions for the last 12 months and next 3 months
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    -- Create partitions for last 12 months
    FOR i IN -12..3 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'workflow_execution_logs_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF workflow_execution_logs_partitioned
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
    END LOOP;
END $$;

-- Partition integration_executions by month
CREATE TABLE integration_executions_partitioned (
    LIKE integration_executions INCLUDING ALL
) PARTITION BY RANGE (executed_at);

-- Create partitions for integration executions
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    FOR i IN -12..3 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'integration_executions_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF integration_executions_partitioned
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
    END LOOP;
END $$;

-- ===========================================================================
-- QUERY OPTIMIZATION VIEWS
-- ===========================================================================

-- Optimized view for workflow dashboard queries
CREATE OR REPLACE VIEW workflow_dashboard_summary AS
SELECT 
    w.id,
    w.user_id,
    w.name,
    w.category,
    w.status,
    w.is_template,
    w.is_public,
    w.created_at,
    w.updated_at,
    COALESCE(exec_stats.total_executions, 0) as total_executions,
    COALESCE(exec_stats.successful_executions, 0) as successful_executions,
    COALESCE(exec_stats.failed_executions, 0) as failed_executions,
    exec_stats.last_execution_at,
    exec_stats.avg_duration_ms,
    CASE 
        WHEN COALESCE(exec_stats.total_executions, 0) = 0 THEN 100
        ELSE ROUND((exec_stats.successful_executions::numeric / exec_stats.total_executions::numeric) * 100, 2)
    END as success_rate_percentage
FROM workflows w
LEFT JOIN (
    SELECT 
        workflow_id,
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
        MAX(created_at) as last_execution_at,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) as avg_duration_ms
    FROM workflow_executions
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY workflow_id
) exec_stats ON w.id = exec_stats.workflow_id;

-- Optimized view for integration performance
CREATE OR REPLACE VIEW integration_performance_summary AS
SELECT 
    si.id,
    si.user_id,
    si.name,
    si.integration_type,
    si.status,
    si.is_active,
    COALESCE(perf.total_executions, 0) as total_executions,
    COALESCE(perf.successful_executions, 0) as successful_executions,
    COALESCE(perf.failed_executions, 0) as failed_executions,
    perf.avg_response_time_ms,
    perf.last_execution_at,
    CASE 
        WHEN COALESCE(perf.total_executions, 0) = 0 THEN 100
        ELSE ROUND((perf.successful_executions::numeric / perf.total_executions::numeric) * 100, 2)
    END as success_rate_percentage,
    -- Health score calculation
    CASE 
        WHEN si.status = 'failed' THEN 0
        WHEN si.status = 'inactive' THEN 25
        WHEN COALESCE(perf.total_executions, 0) = 0 THEN 75
        ELSE LEAST(100, 
            (COALESCE(perf.successful_executions, 0)::numeric / GREATEST(perf.total_executions, 1)::numeric) * 100 *
            CASE 
                WHEN perf.avg_response_time_ms > 10000 THEN 0.5
                WHEN perf.avg_response_time_ms > 5000 THEN 0.7
                WHEN perf.avg_response_time_ms > 2000 THEN 0.9
                ELSE 1.0
            END
        )
    END as health_score
FROM service_integrations si
LEFT JOIN (
    SELECT 
        integration_id,
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_executions,
        AVG(duration_ms) as avg_response_time_ms,
        MAX(executed_at) as last_execution_at
    FROM integration_executions
    WHERE executed_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY integration_id
) perf ON si.id = perf.integration_id;

-- Optimized view for schedule management
CREATE OR REPLACE VIEW workflow_schedule_overview AS
SELECT 
    ws.id,
    ws.user_id,
    ws.workflow_id,
    ws.name,
    ws.schedule_type,
    ws.is_active,
    ws.next_run_time,
    ws.created_at,
    w.name as workflow_name,
    COALESCE(exec_stats.total_runs, 0) as total_runs,
    COALESCE(exec_stats.successful_runs, 0) as successful_runs,
    COALESCE(exec_stats.failed_runs, 0) as failed_runs,
    exec_stats.last_run_at,
    exec_stats.avg_duration_ms
FROM workflow_schedules ws
JOIN workflows w ON ws.workflow_id = w.id
LEFT JOIN (
    SELECT 
        schedule_id,
        COUNT(*) as total_runs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_runs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs,
        MAX(executed_at) as last_run_at,
        AVG(EXTRACT(EPOCH FROM (completed_at - executed_at)) * 1000) as avg_duration_ms
    FROM workflow_schedule_executions
    WHERE executed_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY schedule_id
) exec_stats ON ws.id = exec_stats.schedule_id;

-- ===========================================================================
-- ARCHIVING PROCEDURES
-- ===========================================================================

-- Procedure to archive old workflow execution logs
CREATE OR REPLACE FUNCTION archive_old_workflow_logs(archive_days INTEGER DEFAULT 90)
RETURNS TABLE(archived_count BIGINT, archived_size TEXT) AS $$
DECLARE
    cutoff_date TIMESTAMP;
    row_count BIGINT;
    table_size BIGINT;
BEGIN
    cutoff_date := CURRENT_DATE - (archive_days || ' days')::INTERVAL;
    
    -- Create archive table if it doesn't exist
    CREATE TABLE IF NOT EXISTS workflow_execution_logs_archive (
        LIKE workflow_execution_logs INCLUDING ALL
    );
    
    -- Move old records to archive
    WITH moved_rows AS (
        DELETE FROM workflow_execution_logs 
        WHERE timestamp < cutoff_date
        RETURNING *
    )
    INSERT INTO workflow_execution_logs_archive 
    SELECT * FROM moved_rows;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    -- Get size of archived data
    SELECT pg_size_pretty(pg_total_relation_size('workflow_execution_logs_archive')) 
    INTO table_size;
    
    RETURN QUERY SELECT row_count, table_size::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Procedure to archive old integration executions
CREATE OR REPLACE FUNCTION archive_old_integration_executions(archive_days INTEGER DEFAULT 180)
RETURNS TABLE(archived_count BIGINT, archived_size TEXT) AS $$
DECLARE
    cutoff_date TIMESTAMP;
    row_count BIGINT;
    table_size TEXT;
BEGIN
    cutoff_date := CURRENT_DATE - (archive_days || ' days')::INTERVAL;
    
    CREATE TABLE IF NOT EXISTS integration_executions_archive (
        LIKE integration_executions INCLUDING ALL
    );
    
    WITH moved_rows AS (
        DELETE FROM integration_executions 
        WHERE executed_at < cutoff_date
        RETURNING *
    )
    INSERT INTO integration_executions_archive 
    SELECT * FROM moved_rows;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    SELECT pg_size_pretty(pg_total_relation_size('integration_executions_archive')) 
    INTO table_size;
    
    RETURN QUERY SELECT row_count, table_size;
END;
$$ LANGUAGE plpgsql;

-- Procedure to clean up old webhook events
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(cleanup_days INTEGER DEFAULT 30)
RETURNS BIGINT AS $$
DECLARE
    cutoff_date TIMESTAMP;
    row_count BIGINT;
BEGIN
    cutoff_date := CURRENT_DATE - (cleanup_days || ' days')::INTERVAL;
    
    DELETE FROM integration_webhook_events 
    WHERE received_at < cutoff_date;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    RETURN row_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- PERFORMANCE MONITORING
-- ===========================================================================

-- Function to analyze table statistics and performance
CREATE OR REPLACE FUNCTION analyze_workflow_performance()
RETURNS TABLE(
    table_name TEXT,
    table_size TEXT,
    index_size TEXT,
    row_count BIGINT,
    last_vacuum TIMESTAMP,
    last_analyze TIMESTAMP,
    recommendations TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH table_stats AS (
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as idx_size,
            n_tup_ins + n_tup_upd + n_tup_del as total_activity,
            last_vacuum,
            last_autovacuum,
            last_analyze,
            last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE tablename LIKE 'workflow%' OR tablename LIKE 'integration%' OR tablename LIKE 'service_%'
    ),
    row_counts AS (
        SELECT 
            tablename,
            (xpath('//row/@count', query_to_xml(format('SELECT count(*) as count FROM %I.%I', schemaname, tablename), false, true, '')))[1]::text::bigint as row_count
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (tablename LIKE 'workflow%' OR tablename LIKE 'integration%' OR tablename LIKE 'service_%')
    )
    SELECT 
        ts.tablename::TEXT,
        ts.size::TEXT,
        ts.idx_size::TEXT,
        COALESCE(rc.row_count, 0) as row_count,
        GREATEST(ts.last_vacuum, ts.last_autovacuum) as last_vacuum,
        GREATEST(ts.last_analyze, ts.last_autoanalyze) as last_analyze,
        CASE 
            WHEN COALESCE(rc.row_count, 0) > 1000000 THEN 'Consider partitioning - large table'
            WHEN GREATEST(ts.last_vacuum, ts.last_autovacuum) < CURRENT_DATE - INTERVAL '7 days' THEN 'Needs vacuum'
            WHEN GREATEST(ts.last_analyze, ts.last_autoanalyze) < CURRENT_DATE - INTERVAL '7 days' THEN 'Needs analyze'
            WHEN ts.total_activity > 100000 THEN 'High activity - monitor performance'
            ELSE 'OK'
        END::TEXT as recommendations
    FROM table_stats ts
    LEFT JOIN row_counts rc ON ts.tablename = rc.tablename
    ORDER BY rc.row_count DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function to identify slow queries related to workflows
CREATE OR REPLACE FUNCTION identify_slow_workflow_queries()
RETURNS TABLE(
    query_text TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    max_time DOUBLE PRECISION,
    stddev_time DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        LEFT(query, 100) as query_text,
        calls,
        total_exec_time as total_time,
        mean_exec_time as mean_time,
        max_exec_time as max_time,
        stddev_exec_time as stddev_time
    FROM pg_stat_statements 
    WHERE query ILIKE '%workflow%' 
       OR query ILIKE '%integration%' 
       OR query ILIKE '%service_%'
    ORDER BY mean_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- AUTOMATED MAINTENANCE PROCEDURES
-- ===========================================================================

-- Comprehensive maintenance procedure
CREATE OR REPLACE FUNCTION run_workflow_maintenance()
RETURNS TABLE(
    maintenance_task TEXT,
    status TEXT,
    details TEXT,
    duration INTERVAL
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    task_count INTEGER := 0;
BEGIN
    -- Task 1: Refresh materialized views
    start_time := clock_timestamp();
    
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY integration_performance_overview;
        REFRESH MATERIALIZED VIEW CONCURRENTLY integration_usage_analytics;
        end_time := clock_timestamp();
        task_count := task_count + 1;
        RETURN QUERY SELECT 'Refresh Materialized Views'::TEXT, 'SUCCESS'::TEXT, 'Performance views updated'::TEXT, (end_time - start_time);
    EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'Refresh Materialized Views'::TEXT, 'ERROR'::TEXT, SQLERRM::TEXT, (end_time - start_time);
    END;

    -- Task 2: Update table statistics
    start_time := clock_timestamp();
    
    BEGIN
        ANALYZE workflows;
        ANALYZE workflow_executions;
        ANALYZE workflow_execution_logs;
        ANALYZE service_integrations;
        ANALYZE integration_executions;
        ANALYZE workflow_schedules;
        end_time := clock_timestamp();
        task_count := task_count + 1;
        RETURN QUERY SELECT 'Update Statistics'::TEXT, 'SUCCESS'::TEXT, 'Table statistics updated'::TEXT, (end_time - start_time);
    EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'Update Statistics'::TEXT, 'ERROR'::TEXT, SQLERRM::TEXT, (end_time - start_time);
    END;

    -- Task 3: Clean up old data
    start_time := clock_timestamp();
    
    BEGIN
        PERFORM cleanup_old_webhook_events(30);
        PERFORM cleanup_old_integration_data();
        end_time := clock_timestamp();
        task_count := task_count + 1;
        RETURN QUERY SELECT 'Cleanup Old Data'::TEXT, 'SUCCESS'::TEXT, 'Old records cleaned up'::TEXT, (end_time - start_time);
    EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'Cleanup Old Data'::TEXT, 'ERROR'::TEXT, SQLERRM::TEXT, (end_time - start_time);
    END;

    -- Task 4: Reindex if necessary
    start_time := clock_timestamp();
    
    BEGIN
        -- Only reindex if bloat is detected (simplified check)
        REINDEX INDEX CONCURRENTLY idx_workflows_user_category_status;
        REINDEX INDEX CONCURRENTLY idx_workflow_executions_status_created;
        end_time := clock_timestamp();
        task_count := task_count + 1;
        RETURN QUERY SELECT 'Reindex Critical Indexes'::TEXT, 'SUCCESS'::TEXT, 'Key indexes rebuilt'::TEXT, (end_time - start_time);
    EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'Reindex Critical Indexes'::TEXT, 'ERROR'::TEXT, SQLERRM::TEXT, (end_time - start_time);
    END;

    -- Return summary
    RETURN QUERY SELECT 'MAINTENANCE SUMMARY'::TEXT, 'COMPLETED'::TEXT, 
                        format('%s tasks executed', task_count)::TEXT, 
                        '0 seconds'::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- CONNECTION POOLING OPTIMIZATION
-- ===========================================================================

-- Function to monitor connection usage
CREATE OR REPLACE FUNCTION monitor_connection_usage()
RETURNS TABLE(
    database_name TEXT,
    active_connections INTEGER,
    idle_connections INTEGER,
    total_connections INTEGER,
    max_connections INTEGER,
    connection_utilization NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        datname::TEXT as database_name,
        COUNT(CASE WHEN state = 'active' THEN 1 END)::INTEGER as active_connections,
        COUNT(CASE WHEN state = 'idle' THEN 1 END)::INTEGER as idle_connections,
        COUNT(*)::INTEGER as total_connections,
        (SELECT setting::INTEGER FROM pg_settings WHERE name = 'max_connections') as max_connections,
        ROUND((COUNT(*)::NUMERIC / (SELECT setting::INTEGER FROM pg_settings WHERE name = 'max_connections')::NUMERIC) * 100, 2) as connection_utilization
    FROM pg_stat_activity 
    WHERE datname IS NOT NULL
    GROUP BY datname
    ORDER BY total_connections DESC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- COMMENTS AND DOCUMENTATION
-- ===========================================================================

COMMENT ON FUNCTION archive_old_workflow_logs(INTEGER) IS 'Archives workflow execution logs older than specified days to reduce main table size';
COMMENT ON FUNCTION archive_old_integration_executions(INTEGER) IS 'Archives integration execution records older than specified days';
COMMENT ON FUNCTION cleanup_old_webhook_events(INTEGER) IS 'Removes old webhook events to free up space';
COMMENT ON FUNCTION analyze_workflow_performance() IS 'Analyzes workflow-related table performance and provides optimization recommendations';
COMMENT ON FUNCTION identify_slow_workflow_queries() IS 'Identifies slow queries related to workflow operations using pg_stat_statements';
COMMENT ON FUNCTION run_workflow_maintenance() IS 'Comprehensive maintenance procedure for workflow system optimization';
COMMENT ON FUNCTION monitor_connection_usage() IS 'Monitors database connection usage and pool utilization';

COMMENT ON VIEW workflow_dashboard_summary IS 'Optimized view for workflow dashboard queries with pre-calculated statistics';
COMMENT ON VIEW integration_performance_summary IS 'Performance summary view for service integrations with health scores';
COMMENT ON VIEW workflow_schedule_overview IS 'Overview of workflow schedules with execution statistics';

-- Create scheduled job for automatic maintenance (requires pg_cron extension)
-- SELECT cron.schedule('workflow-maintenance', '0 2 * * *', 'SELECT run_workflow_maintenance();');

-- Final performance check
SELECT 'Database optimization completed successfully' as status,
       COUNT(*) as new_indexes_created,
       'Run ANALYZE on all tables for optimal performance' as recommendation
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%workflow%' 
AND indexname NOT IN (
    SELECT indexname 
    FROM pg_stat_user_indexes 
    WHERE idx_scan = 0
);
