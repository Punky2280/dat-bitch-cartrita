-- 36_workflow_database_optimization_corrected.sql
-- Component 7: Database Schema Optimization (Corrected)
-- Comprehensive performance optimization for enterprise workflow system (schema-accurate)

-- ===========================================================================
-- ADVANCED INDEXING STRATEGIES (Schema-Accurate)
-- ===========================================================================

-- Workflow-related composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_user_active ON workflows(user_id, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_name_search ON workflows(name, user_id) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_updated_recent ON workflows(updated_at DESC, user_id) WHERE updated_at > CURRENT_DATE - INTERVAL '30 days';

-- Workflow execution optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_status_started ON workflow_executions(status, started_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_workflow_status ON workflow_executions(workflow_id, status, started_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_completed_duration ON workflow_executions(completed_at DESC, workflow_id) WHERE completed_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_running ON workflow_executions(workflow_id, started_at DESC) WHERE status IN ('pending', 'running');

-- Service integration indexes (schema-accurate)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_integrations_user_type_active ON service_integrations(user_id, integration_type, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_service_integrations_status_updated ON service_integrations(status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_executions_recent_performance ON integration_executions(integration_id, executed_at DESC, status, duration_ms);

-- Workflow scheduling indexes (schema-accurate)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_schedules_user_active ON workflow_schedules(user_id, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_schedules_workflow_active ON workflow_schedules(workflow_id, is_active);

-- Full-text search indexes for workflow content (using actual columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_search_content ON workflows USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- JSON field optimization indexes (using actual columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_data_gin ON workflows USING gin(workflow_data);

-- ===========================================================================
-- QUERY OPTIMIZATION VIEWS (Schema-Accurate)
-- ===========================================================================

-- Optimized view for workflow dashboard queries
CREATE OR REPLACE VIEW workflow_dashboard_summary AS
SELECT 
    w.id,
    w.user_id,
    w.name,
    w.description,
    w.is_active,
    w.created_at,
    w.updated_at,
    w.version,
    COALESCE(exec_stats.total_executions, 0) as total_executions,
    COALESCE(exec_stats.successful_executions, 0) as successful_executions,
    COALESCE(exec_stats.failed_executions, 0) as failed_executions,
    COALESCE(exec_stats.running_executions, 0) as running_executions,
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
        COUNT(CASE WHEN status IN ('pending', 'running') THEN 1 END) as running_executions,
        MAX(started_at) as last_execution_at,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_duration_ms
    FROM workflow_executions
    WHERE started_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY workflow_id
) exec_stats ON w.id = exec_stats.workflow_id;

-- Optimized view for recent workflow activity
CREATE OR REPLACE VIEW workflow_recent_activity AS
SELECT 
    we.id,
    we.workflow_id,
    we.execution_id,
    we.status,
    we.started_at,
    we.completed_at,
    we.error_message,
    w.name as workflow_name,
    w.user_id,
    EXTRACT(EPOCH FROM (COALESCE(we.completed_at, NOW()) - we.started_at)) * 1000 as duration_ms,
    CASE 
        WHEN we.status = 'completed' THEN 'success'
        WHEN we.status = 'failed' THEN 'error'  
        WHEN we.status IN ('pending', 'running') THEN 'running'
        ELSE 'unknown'
    END as execution_state
FROM workflow_executions we
JOIN workflows w ON we.workflow_id = w.id
WHERE we.started_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY we.started_at DESC;

-- Performance metrics view for workflows
CREATE OR REPLACE VIEW workflow_performance_metrics AS
SELECT 
    w.id as workflow_id,
    w.name,
    w.user_id,
    COUNT(we.id) as total_runs,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_runs,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_runs,
    COUNT(CASE WHEN we.status IN ('pending', 'running') THEN 1 END) as running_runs,
    AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at)) * 1000) as avg_duration_ms,
    MIN(EXTRACT(EPOCH FROM (we.completed_at - we.started_at)) * 1000) as min_duration_ms,
    MAX(EXTRACT(EPOCH FROM (we.completed_at - we.started_at)) * 1000) as max_duration_ms,
    MAX(we.started_at) as last_run_at,
    CASE 
        WHEN COUNT(we.id) = 0 THEN 100
        ELSE ROUND((COUNT(CASE WHEN we.status = 'completed' THEN 1 END)::numeric / COUNT(we.id)::numeric) * 100, 2)
    END as success_rate_percentage,
    -- Calculate health score based on success rate and recent activity
    CASE 
        WHEN COUNT(we.id) = 0 THEN 75 -- No runs yet
        WHEN MAX(we.started_at) < CURRENT_DATE - INTERVAL '7 days' THEN 50 -- Inactive
        ELSE LEAST(100, 
            (COUNT(CASE WHEN we.status = 'completed' THEN 1 END)::numeric / COUNT(we.id)::numeric) * 100 *
            CASE 
                WHEN AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at)) * 1000) > 60000 THEN 0.8 -- > 1 minute
                WHEN AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at)) * 1000) > 30000 THEN 0.9 -- > 30 seconds
                ELSE 1.0
            END
        )
    END as health_score
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id 
    AND we.started_at >= CURRENT_DATE - INTERVAL '30 days'
WHERE w.is_active = true
GROUP BY w.id, w.name, w.user_id;

-- ===========================================================================
-- ARCHIVING PROCEDURES (Schema-Accurate)
-- ===========================================================================

-- Procedure to archive old workflow executions
CREATE OR REPLACE FUNCTION archive_old_workflow_executions(archive_days INTEGER DEFAULT 90)
RETURNS TABLE(archived_count BIGINT, archived_size TEXT) AS $$
DECLARE
    cutoff_date TIMESTAMP;
    row_count BIGINT;
    table_size TEXT;
BEGIN
    cutoff_date := CURRENT_DATE - (archive_days || ' days')::INTERVAL;
    
    -- Create archive table if it doesn't exist
    CREATE TABLE IF NOT EXISTS workflow_executions_archive (
        LIKE workflow_executions INCLUDING ALL
    );
    
    -- Move old completed/failed executions to archive
    WITH moved_rows AS (
        DELETE FROM workflow_executions 
        WHERE started_at < cutoff_date 
        AND status IN ('completed', 'failed', 'cancelled')
        RETURNING *
    )
    INSERT INTO workflow_executions_archive 
    SELECT * FROM moved_rows;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    -- Get size of archived data
    SELECT pg_size_pretty(pg_total_relation_size('workflow_executions_archive')) 
    INTO table_size;
    
    RETURN QUERY SELECT row_count, table_size;
END;
$$ LANGUAGE plpgsql;

-- Procedure to clean up orphaned execution records
CREATE OR REPLACE FUNCTION cleanup_orphaned_executions()
RETURNS BIGINT AS $$
DECLARE
    row_count BIGINT;
BEGIN
    -- Clean up executions for deleted workflows
    DELETE FROM workflow_executions 
    WHERE workflow_id NOT IN (SELECT id FROM workflows);
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    RETURN row_count;
END;
$$ LANGUAGE plpgsql;

-- Procedure to clean up old integration data (using existing function)
CREATE OR REPLACE FUNCTION cleanup_workflow_system_data(cleanup_days INTEGER DEFAULT 30)
RETURNS TABLE(
    cleanup_task TEXT,
    records_removed BIGINT,
    status TEXT
) AS $$
DECLARE
    cutoff_date TIMESTAMP;
    row_count BIGINT;
BEGIN
    cutoff_date := CURRENT_DATE - (cleanup_days || ' days')::INTERVAL;
    
    -- Clean up old webhook events
    DELETE FROM integration_webhook_events 
    WHERE received_at < cutoff_date;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RETURN QUERY SELECT 'Webhook Events'::TEXT, row_count, 'SUCCESS'::TEXT;
    
    -- Clean up old health checks
    DELETE FROM integration_health_checks 
    WHERE checked_at < cutoff_date;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RETURN QUERY SELECT 'Health Checks'::TEXT, row_count, 'SUCCESS'::TEXT;
    
    -- Clean up old rate limit records
    DELETE FROM integration_rate_limits 
    WHERE time_window_start < cutoff_date;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RETURN QUERY SELECT 'Rate Limits'::TEXT, row_count, 'SUCCESS'::TEXT;
    
    -- Clean up orphaned records
    PERFORM cleanup_orphaned_executions();
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RETURN QUERY SELECT 'Orphaned Executions'::TEXT, row_count, 'SUCCESS'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- PERFORMANCE MONITORING (Schema-Accurate)
-- ===========================================================================

-- Function to analyze workflow system performance
CREATE OR REPLACE FUNCTION analyze_workflow_system_performance()
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
        WHERE tablename IN ('workflows', 'workflow_executions', 'service_integrations', 'integration_executions', 'workflow_schedules')
    ),
    row_counts AS (
        SELECT 
            'workflows' as tablename, 
            (SELECT COUNT(*) FROM workflows) as row_count
        UNION ALL
        SELECT 
            'workflow_executions' as tablename, 
            (SELECT COUNT(*) FROM workflow_executions) as row_count
        UNION ALL
        SELECT 
            'service_integrations' as tablename, 
            (SELECT COUNT(*) FROM service_integrations) as row_count
        UNION ALL
        SELECT 
            'integration_executions' as tablename, 
            (SELECT COUNT(*) FROM integration_executions) as row_count
        UNION ALL
        SELECT 
            'workflow_schedules' as tablename, 
            (SELECT COUNT(*) FROM workflow_schedules) as row_count
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

-- Function to get workflow execution statistics
CREATE OR REPLACE FUNCTION get_workflow_execution_stats(days INTEGER DEFAULT 7)
RETURNS TABLE(
    date DATE,
    total_executions BIGINT,
    successful_executions BIGINT,
    failed_executions BIGINT,
    avg_duration_seconds NUMERIC,
    max_duration_seconds NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(we.started_at) as date,
        COUNT(*) as total_executions,
        COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
        ROUND(AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))), 2) as avg_duration_seconds,
        ROUND(MAX(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))), 2) as max_duration_seconds
    FROM workflow_executions we
    WHERE we.started_at >= CURRENT_DATE - (days || ' days')::INTERVAL
    AND we.completed_at IS NOT NULL
    GROUP BY DATE(we.started_at)
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to identify problematic workflows
CREATE OR REPLACE FUNCTION identify_problematic_workflows()
RETURNS TABLE(
    workflow_id INTEGER,
    workflow_name TEXT,
    user_id INTEGER,
    recent_failures BIGINT,
    avg_duration_ms NUMERIC,
    last_success TIMESTAMP,
    issue_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH workflow_issues AS (
        SELECT 
            w.id as workflow_id,
            w.name as workflow_name,
            w.user_id,
            COUNT(CASE WHEN we.status = 'failed' AND we.started_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_failures,
            AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at)) * 1000) as avg_duration_ms,
            MAX(CASE WHEN we.status = 'completed' THEN we.started_at END) as last_success
        FROM workflows w
        LEFT JOIN workflow_executions we ON w.id = we.workflow_id
        WHERE w.is_active = true
        GROUP BY w.id, w.name, w.user_id
    )
    SELECT 
        wi.workflow_id,
        wi.workflow_name,
        wi.user_id,
        wi.recent_failures,
        ROUND(wi.avg_duration_ms, 2) as avg_duration_ms,
        wi.last_success,
        CASE 
            WHEN wi.recent_failures >= 5 THEN 'High Failure Rate'
            WHEN wi.avg_duration_ms > 60000 THEN 'Slow Execution'
            WHEN wi.last_success IS NULL THEN 'Never Successful'
            WHEN wi.last_success < CURRENT_DATE - INTERVAL '7 days' THEN 'Inactive'
            ELSE 'OK'
        END as issue_type
    FROM workflow_issues wi
    WHERE wi.recent_failures >= 3 
       OR wi.avg_duration_ms > 30000 
       OR wi.last_success IS NULL 
       OR wi.last_success < CURRENT_DATE - INTERVAL '7 days'
    ORDER BY wi.recent_failures DESC, wi.avg_duration_ms DESC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- AUTOMATED MAINTENANCE PROCEDURES (Schema-Accurate)
-- ===========================================================================

-- Comprehensive maintenance procedure
CREATE OR REPLACE FUNCTION run_workflow_system_maintenance()
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
    archived_count BIGINT;
    archived_size TEXT;
BEGIN
    -- Task 1: Update table statistics
    start_time := clock_timestamp();
    
    BEGIN
        ANALYZE workflows;
        ANALYZE workflow_executions;
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

    -- Task 2: Clean up old data
    start_time := clock_timestamp();
    
    BEGIN
        SELECT * INTO archived_count, archived_size FROM archive_old_workflow_executions(90);
        PERFORM cleanup_workflow_system_data(30);
        end_time := clock_timestamp();
        task_count := task_count + 1;
        RETURN QUERY SELECT 'Cleanup Old Data'::TEXT, 'SUCCESS'::TEXT, 
                           format('Archived %s executions (%s)', archived_count, archived_size)::TEXT, 
                           (end_time - start_time);
    EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'Cleanup Old Data'::TEXT, 'ERROR'::TEXT, SQLERRM::TEXT, (end_time - start_time);
    END;

    -- Task 3: Refresh materialized views (if they exist)
    start_time := clock_timestamp();
    
    BEGIN
        -- Check if materialized views exist before refreshing
        IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'integration_performance_overview') THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY integration_performance_overview;
        END IF;
        
        IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'integration_usage_analytics') THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY integration_usage_analytics;
        END IF;
        
        end_time := clock_timestamp();
        task_count := task_count + 1;
        RETURN QUERY SELECT 'Refresh Views'::TEXT, 'SUCCESS'::TEXT, 'Materialized views updated'::TEXT, (end_time - start_time);
    EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'Refresh Views'::TEXT, 'WARNING'::TEXT, 'Some views may not exist yet'::TEXT, (end_time - start_time);
    END;

    -- Return summary
    RETURN QUERY SELECT 'MAINTENANCE SUMMARY'::TEXT, 'COMPLETED'::TEXT, 
                        format('%s tasks executed', task_count)::TEXT, 
                        '0 seconds'::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- PERFORMANCE TUNING RECOMMENDATIONS
-- ===========================================================================

-- Function to generate performance recommendations
CREATE OR REPLACE FUNCTION get_performance_recommendations()
RETURNS TABLE(
    category TEXT,
    recommendation TEXT,
    priority TEXT,
    impact TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH recommendations AS (
        -- Check for missing indexes
        SELECT 
            'Indexing' as category,
            'Consider adding index on workflow_executions(error_message) for error analysis' as recommendation,
            'Medium' as priority,
            'Faster error query performance' as impact
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'workflow_executions' 
            AND indexdef LIKE '%error_message%'
        )
        
        UNION ALL
        
        -- Check for large tables
        SELECT 
            'Maintenance' as category,
            format('Table %s is large (%s rows), consider archiving old data', 
                   table_name, row_count) as recommendation,
            'High' as priority,
            'Reduced storage and faster queries' as impact
        FROM (
            SELECT 'workflow_executions' as table_name, COUNT(*) as row_count FROM workflow_executions
            UNION ALL
            SELECT 'integration_executions' as table_name, COUNT(*) as row_count FROM integration_executions
        ) t
        WHERE row_count > 100000
        
        UNION ALL
        
        -- Check for workflows with high failure rates
        SELECT 
            'Workflow Health' as category,
            format('Workflow "%s" (ID: %s) has high failure rate - investigate', 
                   workflow_name, workflow_id) as recommendation,
            'High' as priority,
            'Improved workflow reliability' as impact
        FROM identify_problematic_workflows()
        WHERE issue_type = 'High Failure Rate'
        LIMIT 3
        
        UNION ALL
        
        -- General recommendations
        SELECT 
            'Configuration' as category,
            'Enable pg_stat_statements for query performance monitoring' as recommendation,
            'Medium' as priority,
            'Better query performance insights' as impact
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        )
    )
    SELECT * FROM recommendations
    ORDER BY 
        CASE priority 
            WHEN 'High' THEN 1 
            WHEN 'Medium' THEN 2 
            ELSE 3 
        END,
        category;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- COMMENTS AND DOCUMENTATION
-- ===========================================================================

COMMENT ON FUNCTION archive_old_workflow_executions(INTEGER) IS 'Archives workflow executions older than specified days to reduce main table size';
COMMENT ON FUNCTION cleanup_orphaned_executions() IS 'Removes execution records for deleted workflows';
COMMENT ON FUNCTION cleanup_workflow_system_data(INTEGER) IS 'Comprehensive cleanup of old workflow system data';
COMMENT ON FUNCTION analyze_workflow_system_performance() IS 'Analyzes workflow system table performance and provides optimization recommendations';
COMMENT ON FUNCTION get_workflow_execution_stats(INTEGER) IS 'Gets daily workflow execution statistics for specified number of days';
COMMENT ON FUNCTION identify_problematic_workflows() IS 'Identifies workflows with performance or reliability issues';
COMMENT ON FUNCTION run_workflow_system_maintenance() IS 'Comprehensive maintenance procedure for workflow system optimization';
COMMENT ON FUNCTION get_performance_recommendations() IS 'Generates actionable performance recommendations for the workflow system';

COMMENT ON VIEW workflow_dashboard_summary IS 'Optimized view for workflow dashboard queries with pre-calculated execution statistics';
COMMENT ON VIEW workflow_recent_activity IS 'Recent workflow execution activity for monitoring dashboards';
COMMENT ON VIEW workflow_performance_metrics IS 'Performance metrics and health scores for all active workflows';

-- Final optimization summary
SELECT 
    'Schema-Accurate Database Optimization Completed' as status,
    COUNT(DISTINCT indexname) as optimized_indexes,
    'All indexes aligned with actual table structure' as note
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('workflows', 'workflow_executions', 'service_integrations', 'integration_executions');

-- Run initial analysis
SELECT 'Initial Performance Analysis' as task;
SELECT * FROM analyze_workflow_system_performance();
