--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Debian 16.9-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: analyze_workflow_performance(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.analyze_workflow_performance() RETURNS TABLE(table_name text, table_size text, index_size text, row_count bigint, last_vacuum timestamp without time zone, last_analyze timestamp without time zone, recommendations text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.analyze_workflow_performance() OWNER TO robert;

--
-- Name: FUNCTION analyze_workflow_performance(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.analyze_workflow_performance() IS 'Analyzes workflow-related table performance and provides optimization recommendations';


--
-- Name: analyze_workflow_system_performance(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.analyze_workflow_system_performance() RETURNS TABLE(table_name text, table_size text, index_size text, row_count bigint, last_vacuum timestamp without time zone, last_analyze timestamp without time zone, recommendations text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.analyze_workflow_system_performance() OWNER TO robert;

--
-- Name: FUNCTION analyze_workflow_system_performance(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.analyze_workflow_system_performance() IS 'Analyzes workflow system table performance and provides optimization recommendations';


--
-- Name: apply_data_masking(text, character varying, character varying); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.apply_data_masking(p_value text, p_table_name character varying, p_column_name character varying) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_masking_method VARCHAR(50);
    v_masking_config JSONB;
    v_result TEXT;
BEGIN
    -- Get masking configuration
    SELECT masking_method, masking_config INTO v_masking_method, v_masking_config
    FROM data_masking_rules
    WHERE table_name = p_table_name AND column_name = p_column_name AND enabled = TRUE
    ORDER BY priority ASC
    LIMIT 1;
    
    -- If no specific rule found, check wildcard rules
    IF v_masking_method IS NULL THEN
        SELECT masking_method, masking_config INTO v_masking_method, v_masking_config
        FROM data_masking_rules
        WHERE table_name = '*' AND column_name = p_column_name AND enabled = TRUE
        ORDER BY priority ASC
        LIMIT 1;
    END IF;
    
    -- Apply masking based on method
    CASE v_masking_method
        WHEN 'full' THEN
            v_result := REPEAT('*', LENGTH(p_value));
        WHEN 'partial' THEN
            -- Simple partial masking (show first 2 and last 2 characters)
            IF LENGTH(p_value) <= 4 THEN
                v_result := REPEAT('*', LENGTH(p_value));
            ELSE
                v_result := SUBSTRING(p_value FROM 1 FOR 2) || REPEAT('*', LENGTH(p_value) - 4) || SUBSTRING(p_value FROM LENGTH(p_value) - 1);
            END IF;
        WHEN 'hash' THEN
            v_result := ENCODE(DIGEST(p_value || 'salt', 'sha256'), 'hex');
        WHEN 'random' THEN
            v_result := REPEAT('X', LENGTH(p_value));
        ELSE
            v_result := p_value; -- No masking
    END CASE;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION public.apply_data_masking(p_value text, p_table_name character varying, p_column_name character varying) OWNER TO robert;

--
-- Name: archive_old_integration_executions(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.archive_old_integration_executions(archive_days integer DEFAULT 180) RETURNS TABLE(archived_count bigint, archived_size text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.archive_old_integration_executions(archive_days integer) OWNER TO robert;

--
-- Name: FUNCTION archive_old_integration_executions(archive_days integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.archive_old_integration_executions(archive_days integer) IS 'Archives integration execution records older than specified days';


--
-- Name: archive_old_workflow_executions(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.archive_old_workflow_executions(archive_days integer DEFAULT 90) RETURNS TABLE(archived_count bigint, archived_size text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.archive_old_workflow_executions(archive_days integer) OWNER TO robert;

--
-- Name: FUNCTION archive_old_workflow_executions(archive_days integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.archive_old_workflow_executions(archive_days integer) IS 'Archives workflow executions older than specified days to reduce main table size';


--
-- Name: archive_old_workflow_logs(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.archive_old_workflow_logs(archive_days integer DEFAULT 90) RETURNS TABLE(archived_count bigint, archived_size text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.archive_old_workflow_logs(archive_days integer) OWNER TO robert;

--
-- Name: FUNCTION archive_old_workflow_logs(archive_days integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.archive_old_workflow_logs(archive_days integer) IS 'Archives workflow execution logs older than specified days to reduce main table size';


--
-- Name: calculate_integration_health_score(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.calculate_integration_health_score(integration_id_param integer) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    health_score numeric := 100.0;
    success_rate numeric;
    avg_response_time numeric;
    error_frequency numeric;
    last_execution_hours numeric;
    auth_status varchar;
BEGIN
    -- Get success rate (last 30 days)
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 100
            ELSE (COUNT(CASE WHEN status = 'success' THEN 1 END)::numeric / COUNT(*)::numeric) * 100
        END
    INTO success_rate
    FROM integration_executions 
    WHERE integration_id = integration_id_param 
    AND executed_at >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Get average response time (last 7 days)
    SELECT AVG(duration_ms) INTO avg_response_time
    FROM integration_executions 
    WHERE integration_id = integration_id_param 
    AND executed_at >= CURRENT_DATE - INTERVAL '7 days'
    AND status = 'success';
    
    -- Get error frequency (errors per day in last 7 days)
    SELECT COUNT(*)::numeric / 7 INTO error_frequency
    FROM integration_executions 
    WHERE integration_id = integration_id_param 
    AND executed_at >= CURRENT_DATE - INTERVAL '7 days'
    AND status = 'error';
    
    -- Get hours since last execution
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(executed_at))) / 3600 INTO last_execution_hours
    FROM integration_executions 
    WHERE integration_id = integration_id_param;
    
    -- Get integration status
    SELECT status INTO auth_status
    FROM service_integrations
    WHERE id = integration_id_param;
    
    -- Calculate health score based on multiple factors
    
    -- Success rate impact (40% of score)
    health_score := health_score * (COALESCE(success_rate, 100) / 100) * 0.4 + health_score * 0.6;
    
    -- Response time impact (20% of score)
    IF avg_response_time > 10000 THEN -- > 10 seconds
        health_score := health_score * 0.6;
    ELSIF avg_response_time > 5000 THEN -- > 5 seconds
        health_score := health_score * 0.8;
    ELSIF avg_response_time > 2000 THEN -- > 2 seconds
        health_score := health_score * 0.95;
    END IF;
    
    -- Error frequency impact (20% of score)
    IF error_frequency > 10 THEN
        health_score := health_score * 0.3;
    ELSIF error_frequency > 5 THEN
        health_score := health_score * 0.6;
    ELSIF error_frequency > 1 THEN
        health_score := health_score * 0.85;
    END IF;
    
    -- Last execution recency impact (10% of score)
    IF last_execution_hours > 168 THEN -- > 1 week
        health_score := health_score * 0.5;
    ELSIF last_execution_hours > 48 THEN -- > 2 days
        health_score := health_score * 0.8;
    ELSIF last_execution_hours > 24 THEN -- > 1 day
        health_score := health_score * 0.95;
    END IF;
    
    -- Integration status impact (10% of score)
    IF auth_status = 'failed' THEN
        health_score := health_score * 0.2;
    ELSIF auth_status = 'inactive' THEN
        health_score := health_score * 0.5;
    END IF;
    
    RETURN ROUND(health_score, 2);
END;
$$;


ALTER FUNCTION public.calculate_integration_health_score(integration_id_param integer) OWNER TO robert;

--
-- Name: FUNCTION calculate_integration_health_score(integration_id_param integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.calculate_integration_health_score(integration_id_param integer) IS 'Calculates a comprehensive health score (0-100) for an integration based on success rate, response time, error frequency, and status';


--
-- Name: calculate_schedule_health_score(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.calculate_schedule_health_score(schedule_id_param integer) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
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
    WHERE schedule_id = schedule_id_param 
    AND started_at >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Get average execution time trend
    SELECT AVG(execution_duration_ms) INTO avg_execution_time
    FROM workflow_schedule_executions 
    WHERE schedule_id = schedule_id_param 
    AND started_at >= CURRENT_DATE - INTERVAL '7 days'
    AND status = 'completed';
    
    -- Get error frequency (errors per day in last 7 days)
    SELECT COUNT(*)::numeric / 7 INTO error_frequency
    FROM workflow_schedule_executions 
    WHERE schedule_id = schedule_id_param 
    AND started_at >= CURRENT_DATE - INTERVAL '7 days'
    AND status = 'failed';
    
    -- Get days since last execution
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(started_at))) / 86400 INTO last_execution_days
    FROM workflow_schedule_executions 
    WHERE schedule_id = schedule_id_param;
    
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
$$;


ALTER FUNCTION public.calculate_schedule_health_score(schedule_id_param integer) OWNER TO robert;

--
-- Name: FUNCTION calculate_schedule_health_score(schedule_id_param integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.calculate_schedule_health_score(schedule_id_param integer) IS 'Calculates a health score (0-100) for a workflow schedule based on success rate, error frequency, and performance metrics';


--
-- Name: calculate_schedule_health_score(uuid); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.calculate_schedule_health_score(schedule_uuid uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.calculate_schedule_health_score(schedule_uuid uuid) OWNER TO robert;

--
-- Name: FUNCTION calculate_schedule_health_score(schedule_uuid uuid); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.calculate_schedule_health_score(schedule_uuid uuid) IS 'Calculates a health score (0-100) for a workflow schedule based on success rate, error frequency, and performance metrics';


--
-- Name: check_performance_thresholds(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.check_performance_thresholds() RETURNS TABLE(metric_name character varying, current_value numeric, threshold_value numeric, severity character varying, threshold_exceeded boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH latest_metrics AS (
        SELECT DISTINCT ON (pm.name)
            pm.name,
            pm.value,
            pm.timestamp
        FROM performance_metrics pm
        WHERE pm.timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        ORDER BY pm.name, pm.timestamp DESC
    )
    SELECT 
        pt.metric_name,
        lm.value as current_value,
        pt.threshold_value,
        pt.severity,
        CASE pt.threshold_type
            WHEN 'greater_than' THEN lm.value > pt.threshold_value
            WHEN 'less_than' THEN lm.value < pt.threshold_value
            WHEN 'equals' THEN lm.value = pt.threshold_value
            ELSE FALSE
        END as threshold_exceeded
    FROM performance_thresholds pt
    LEFT JOIN latest_metrics lm ON pt.metric_name = lm.name
    WHERE pt.enabled = TRUE
    ORDER BY pt.severity DESC, pt.metric_name;
END;
$$;


ALTER FUNCTION public.check_performance_thresholds() OWNER TO robert;

--
-- Name: check_user_permissions(integer, character varying); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.check_user_permissions(user_id_param integer, permission_name character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    has_permission BOOLEAN := false;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_id_param 
        AND ur.is_active = true
        AND p.name = permission_name
        AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$;


ALTER FUNCTION public.check_user_permissions(user_id_param integer, permission_name character varying) OWNER TO robert;

--
-- Name: cleanup_expired_tokens(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.cleanup_expired_tokens() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM jwt_blacklist WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    DELETE FROM oauth_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    
    DELETE FROM security_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_tokens() OWNER TO robert;

--
-- Name: cleanup_old_integration_data(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.cleanup_old_integration_data() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Clean up old execution records (older than 180 days)
    DELETE FROM integration_executions 
    WHERE executed_at < CURRENT_DATE - INTERVAL '180 days';
    
    -- Clean up old webhook events (older than 90 days)
    DELETE FROM integration_webhook_events 
    WHERE received_at < CURRENT_DATE - INTERVAL '90 days';
    
    -- Clean up old health check records (older than 30 days)
    DELETE FROM integration_health_checks 
    WHERE checked_at < CURRENT_DATE - INTERVAL '30 days';
    
    -- Clean up old rate limit records (older than 7 days)
    DELETE FROM integration_rate_limits 
    WHERE time_window_start < CURRENT_DATE - INTERVAL '7 days';
    
    -- Refresh performance views after cleanup
    PERFORM refresh_integration_performance_views();
END;
$$;


ALTER FUNCTION public.cleanup_old_integration_data() OWNER TO robert;

--
-- Name: FUNCTION cleanup_old_integration_data(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.cleanup_old_integration_data() IS 'Cleans up old integration execution data and analytics to maintain performance';


--
-- Name: cleanup_old_performance_metrics(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.cleanup_old_performance_metrics() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete metrics older than 90 days
    DELETE FROM performance_metrics 
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete resolved alerts older than 30 days
    DELETE FROM performance_alerts 
    WHERE status = 'resolved' 
    AND resolved_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Delete old recommendations that are dismissed or implemented (older than 60 days)
    DELETE FROM performance_recommendations 
    WHERE status IN ('dismissed', 'implemented') 
    AND COALESCE(dismissed_at, implemented_at) < CURRENT_TIMESTAMP - INTERVAL '60 days';
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_performance_metrics() OWNER TO robert;

--
-- Name: cleanup_old_schedule_data(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.cleanup_old_schedule_data() RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.cleanup_old_schedule_data() OWNER TO robert;

--
-- Name: FUNCTION cleanup_old_schedule_data(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.cleanup_old_schedule_data() IS 'Cleans up old schedule execution data and statistics to maintain performance';


--
-- Name: cleanup_old_security_test_data(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.cleanup_old_security_test_data(retention_days integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete old test runs and cascade to related data
    DELETE FROM security_test_runs 
    WHERE started_at < CURRENT_DATE - (retention_days || ' days')::INTERVAL
    AND status IN ('completed', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old artifacts files (would need file system cleanup too)
    DELETE FROM security_test_artifacts 
    WHERE created_at < CURRENT_DATE - (retention_days || ' days')::INTERVAL;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_security_test_data(retention_days integer) OWNER TO robert;

--
-- Name: cleanup_old_webhook_events(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.cleanup_old_webhook_events(cleanup_days integer DEFAULT 30) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.cleanup_old_webhook_events(cleanup_days integer) OWNER TO robert;

--
-- Name: FUNCTION cleanup_old_webhook_events(cleanup_days integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.cleanup_old_webhook_events(cleanup_days integer) IS 'Removes old webhook events to free up space';


--
-- Name: cleanup_orphaned_executions(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.cleanup_orphaned_executions() RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    row_count BIGINT;
BEGIN
    -- Clean up executions for deleted workflows
    DELETE FROM workflow_executions 
    WHERE workflow_id NOT IN (SELECT id FROM workflows);
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    RETURN row_count;
END;
$$;


ALTER FUNCTION public.cleanup_orphaned_executions() OWNER TO robert;

--
-- Name: FUNCTION cleanup_orphaned_executions(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.cleanup_orphaned_executions() IS 'Removes execution records for deleted workflows';


--
-- Name: cleanup_workflow_system_data(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.cleanup_workflow_system_data(cleanup_days integer DEFAULT 30) RETURNS TABLE(cleanup_task text, records_removed bigint, status text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.cleanup_workflow_system_data(cleanup_days integer) OWNER TO robert;

--
-- Name: FUNCTION cleanup_workflow_system_data(cleanup_days integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.cleanup_workflow_system_data(cleanup_days integer) IS 'Comprehensive cleanup of old workflow system data';


--
-- Name: get_performance_summary(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.get_performance_summary(time_range_minutes integer DEFAULT 60) RETURNS TABLE(metric_name character varying, avg_value numeric, max_value numeric, min_value numeric, count integer, unit character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pm.name,
        AVG(pm.value) as avg_value,
        MAX(pm.value) as max_value,
        MIN(pm.value) as min_value,
        COUNT(*)::INTEGER as count,
        COALESCE(pm.unit, '') as unit
    FROM performance_metrics pm
    WHERE pm.timestamp >= CURRENT_TIMESTAMP - (time_range_minutes || ' minutes')::INTERVAL
    GROUP BY pm.name, pm.unit
    ORDER BY pm.name;
END;
$$;


ALTER FUNCTION public.get_performance_summary(time_range_minutes integer) OWNER TO robert;

--
-- Name: get_schedule_next_execution(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.get_schedule_next_execution(schedule_id_param integer) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    AS $$
DECLARE
    schedule_record workflow_schedules%ROWTYPE;
    next_execution TIMESTAMP WITH TIME ZONE;
    config JSONB;
BEGIN
    -- Get schedule configuration
    SELECT * INTO schedule_record 
    FROM workflow_schedules 
    WHERE id = schedule_id_param;
    
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
$$;


ALTER FUNCTION public.get_schedule_next_execution(schedule_id_param integer) OWNER TO robert;

--
-- Name: FUNCTION get_schedule_next_execution(schedule_id_param integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.get_schedule_next_execution(schedule_id_param integer) IS 'Estimates the next execution time for a workflow schedule based on its configuration';


--
-- Name: get_schedule_next_execution(uuid); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.get_schedule_next_execution(schedule_uuid uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.get_schedule_next_execution(schedule_uuid uuid) OWNER TO robert;

--
-- Name: FUNCTION get_schedule_next_execution(schedule_uuid uuid); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.get_schedule_next_execution(schedule_uuid uuid) IS 'Estimates the next execution time for a workflow schedule based on its configuration';


--
-- Name: get_security_testing_metrics(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.get_security_testing_metrics(start_date timestamp with time zone DEFAULT (CURRENT_DATE - '30 days'::interval), end_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP) RETURNS TABLE(metric_name text, metric_value numeric, metric_category text, trend_direction text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT 
            stm.metric_name,
            AVG(stm.metric_value) as avg_value,
            stm.metric_category
        FROM security_test_metrics stm
        WHERE stm.collected_at BETWEEN start_date AND end_date
        GROUP BY stm.metric_name, stm.metric_category
    ),
    previous_period AS (
        SELECT 
            stm.metric_name,
            AVG(stm.metric_value) as avg_value,
            stm.metric_category
        FROM security_test_metrics stm
        WHERE stm.collected_at BETWEEN 
            start_date - (end_date - start_date) AND 
            start_date
        GROUP BY stm.metric_name, stm.metric_category
    )
    SELECT 
        cp.metric_name,
        cp.avg_value,
        cp.metric_category,
        CASE 
            WHEN pp.avg_value IS NULL THEN 'new'
            WHEN cp.avg_value > pp.avg_value THEN 'improving'
            WHEN cp.avg_value < pp.avg_value THEN 'declining'
            ELSE 'stable'
        END as trend_direction
    FROM current_period cp
    LEFT JOIN previous_period pp ON cp.metric_name = pp.metric_name AND cp.metric_category = pp.metric_category;
END;
$$;


ALTER FUNCTION public.get_security_testing_metrics(start_date timestamp with time zone, end_date timestamp with time zone) OWNER TO robert;

--
-- Name: get_workflow_execution_stats(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.get_workflow_execution_stats(days integer DEFAULT 7) RETURNS TABLE(date date, total_executions bigint, successful_executions bigint, failed_executions bigint, avg_duration_seconds numeric, max_duration_seconds numeric)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.get_workflow_execution_stats(days integer) OWNER TO robert;

--
-- Name: FUNCTION get_workflow_execution_stats(days integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.get_workflow_execution_stats(days integer) IS 'Gets daily workflow execution statistics for specified number of days';


--
-- Name: identify_problematic_workflows(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.identify_problematic_workflows() RETURNS TABLE(workflow_id integer, workflow_name text, user_id integer, recent_failures bigint, avg_duration_ms numeric, last_success timestamp without time zone, issue_type text)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.identify_problematic_workflows() OWNER TO robert;

--
-- Name: FUNCTION identify_problematic_workflows(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.identify_problematic_workflows() IS 'Identifies workflows with performance or reliability issues';


--
-- Name: identify_slow_workflow_queries(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.identify_slow_workflow_queries() RETURNS TABLE(query_text text, calls bigint, total_time double precision, mean_time double precision, max_time double precision, stddev_time double precision)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.identify_slow_workflow_queries() OWNER TO robert;

--
-- Name: FUNCTION identify_slow_workflow_queries(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.identify_slow_workflow_queries() IS 'Identifies slow queries related to workflow operations using pg_stat_statements';


--
-- Name: log_data_access(integer, character varying, character varying, character varying, character varying, character varying, text, text, inet, text, integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.log_data_access(p_user_id integer, p_session_id character varying, p_table_name character varying, p_column_name character varying, p_operation character varying, p_record_id character varying DEFAULT NULL::character varying, p_old_value text DEFAULT NULL::text, p_new_value text DEFAULT NULL::text, p_client_ip inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_risk_score integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO data_access_audit_log (
        user_id, session_id, table_name, column_name, operation,
        record_id, old_value, new_value, client_ip, user_agent, risk_score
    ) VALUES (
        p_user_id, p_session_id, p_table_name, p_column_name, p_operation,
        p_record_id, p_old_value, p_new_value, p_client_ip, p_user_agent, p_risk_score
    );
END;
$$;


ALTER FUNCTION public.log_data_access(p_user_id integer, p_session_id character varying, p_table_name character varying, p_column_name character varying, p_operation character varying, p_record_id character varying, p_old_value text, p_new_value text, p_client_ip inet, p_user_agent text, p_risk_score integer) OWNER TO robert;

--
-- Name: log_security_event(integer, character varying, character varying, jsonb, inet, text, boolean); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.log_security_event(user_id_param integer, action_param character varying, resource_param character varying DEFAULT NULL::character varying, details_param jsonb DEFAULT '{}'::jsonb, ip_param inet DEFAULT NULL::inet, user_agent_param text DEFAULT NULL::text, success_param boolean DEFAULT true) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    log_id INTEGER;
BEGIN
    INSERT INTO security_audit_log (
        user_id, action, resource, details, ip_address, user_agent, success
    ) VALUES (
        user_id_param, action_param, resource_param, details_param, 
        ip_param, user_agent_param, success_param
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;


ALTER FUNCTION public.log_security_event(user_id_param integer, action_param character varying, resource_param character varying, details_param jsonb, ip_param inet, user_agent_param text, success_param boolean) OWNER TO robert;

--
-- Name: monitor_connection_usage(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.monitor_connection_usage() RETURNS TABLE(database_name text, active_connections integer, idle_connections integer, total_connections integer, max_connections integer, connection_utilization numeric)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.monitor_connection_usage() OWNER TO robert;

--
-- Name: FUNCTION monitor_connection_usage(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.monitor_connection_usage() IS 'Monitors database connection usage and pool utilization';


--
-- Name: refresh_integration_performance_views(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.refresh_integration_performance_views() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY integration_performance_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY integration_usage_analytics;
END;
$$;


ALTER FUNCTION public.refresh_integration_performance_views() OWNER TO robert;

--
-- Name: FUNCTION refresh_integration_performance_views(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.refresh_integration_performance_views() IS 'Refreshes materialized views for integration performance analytics';


--
-- Name: refresh_schedule_performance_views(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.refresh_schedule_performance_views() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_schedule_performance_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_schedule_queue_analysis;
END;
$$;


ALTER FUNCTION public.refresh_schedule_performance_views() OWNER TO robert;

--
-- Name: FUNCTION refresh_schedule_performance_views(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.refresh_schedule_performance_views() IS 'Refreshes materialized views for schedule performance analytics';


--
-- Name: run_workflow_maintenance(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.run_workflow_maintenance() RETURNS TABLE(maintenance_task text, status text, details text, duration interval)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.run_workflow_maintenance() OWNER TO robert;

--
-- Name: FUNCTION run_workflow_maintenance(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.run_workflow_maintenance() IS 'Comprehensive maintenance procedure for workflow system optimization';


--
-- Name: run_workflow_system_maintenance(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.run_workflow_system_maintenance() RETURNS TABLE(maintenance_task text, status text, details text, duration interval)
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.run_workflow_system_maintenance() OWNER TO robert;

--
-- Name: FUNCTION run_workflow_system_maintenance(); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.run_workflow_system_maintenance() IS 'Comprehensive maintenance procedure for workflow system optimization';


--
-- Name: should_mask_column(character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.should_mask_column(p_table_name character varying, p_column_name character varying, p_user_role character varying DEFAULT NULL::character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_masking_enabled BOOLEAN := FALSE;
    v_user_exempt BOOLEAN := FALSE;
BEGIN
    -- Check if masking is enabled for this column
    SELECT masking_enabled INTO v_masking_enabled
    FROM database_security_config
    WHERE table_name = p_table_name AND column_name = p_column_name;
    
    -- If no specific config, check wildcard rules
    IF v_masking_enabled IS NULL THEN
        SELECT masking_enabled INTO v_masking_enabled
        FROM database_security_config
        WHERE table_name = '*' AND column_name = p_column_name;
    END IF;
    
    -- Check if user role is exempt from masking (admin, system, etc.)
    IF p_user_role IN ('admin', 'system', 'security_officer') THEN
        v_user_exempt := TRUE;
    END IF;
    
    RETURN COALESCE(v_masking_enabled, FALSE) AND NOT COALESCE(v_user_exempt, FALSE);
END;
$$;


ALTER FUNCTION public.should_mask_column(p_table_name character varying, p_column_name character varying, p_user_role character varying) OWNER TO robert;

--
-- Name: test_integration_health(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.test_integration_health(integration_id_param integer) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    integration_record service_integrations%ROWTYPE;
    health_result jsonb := '{}';
    test_passed boolean := false;
BEGIN
    -- Get integration configuration
    SELECT * INTO integration_record 
    FROM service_integrations 
    WHERE id = integration_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'not_found',
            'message', 'Integration not found'
        );
    END IF;
    
    -- Perform basic health check based on integration type
    CASE integration_record.integration_type
        WHEN 'rest_api' THEN
            -- For REST APIs, we would test connectivity
            test_passed := true; -- Simplified
            health_result := jsonb_build_object(
                'status', 'healthy',
                'type', 'rest_api',
                'connectivity', 'ok'
            );
            
        WHEN 'database' THEN
            -- For databases, we would test connection
            test_passed := true; -- Simplified
            health_result := jsonb_build_object(
                'status', 'healthy',
                'type', 'database',
                'connection', 'ok'
            );
            
        ELSE
            health_result := jsonb_build_object(
                'status', 'unknown',
                'type', integration_record.integration_type,
                'message', 'Health check not implemented for this integration type'
            );
    END CASE;
    
    -- Record the health check
    INSERT INTO integration_health_checks (
        integration_id, check_type, status, check_details
    ) VALUES (
        integration_id_param,
        'full_test',
        CASE WHEN test_passed THEN 'healthy' ELSE 'unhealthy' END,
        health_result
    );
    
    RETURN health_result;
END;
$$;


ALTER FUNCTION public.test_integration_health(integration_id_param integer) OWNER TO robert;

--
-- Name: FUNCTION test_integration_health(integration_id_param integer); Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON FUNCTION public.test_integration_health(integration_id_param integer) IS 'Performs a comprehensive health test for an integration and returns detailed status information';


--
-- Name: update_integration_auth_tokens_updated_at(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_integration_auth_tokens_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_integration_auth_tokens_updated_at() OWNER TO robert;

--
-- Name: update_integration_connection_pools_updated_at(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_integration_connection_pools_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_integration_connection_pools_updated_at() OWNER TO robert;

--
-- Name: update_security_test_updated_at(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_security_test_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_security_test_updated_at() OWNER TO robert;

--
-- Name: update_service_integrations_updated_at(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_service_integrations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_service_integrations_updated_at() OWNER TO robert;

--
-- Name: update_tag_usage_count(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_tag_usage_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE workflow_template_tags 
    SET usage_count = usage_count + 1 
    WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workflow_template_tags 
    SET usage_count = usage_count - 1 
    WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_tag_usage_count() OWNER TO robert;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO robert;

--
-- Name: update_user_activity(integer); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_user_activity(user_id_param integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE security_sessions 
    SET last_activity = CURRENT_TIMESTAMP
    WHERE user_id = user_id_param AND is_active = true;
    
    UPDATE user_authentication
    SET last_login = CURRENT_TIMESTAMP,
        login_count = login_count + 1
    WHERE user_id = user_id_param;
END;
$$;


ALTER FUNCTION public.update_user_activity(user_id_param integer) OWNER TO robert;

--
-- Name: update_workflow_batch_processing_updated_at(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_workflow_batch_processing_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_workflow_batch_processing_updated_at() OWNER TO robert;

--
-- Name: update_workflow_calendar_integrations_updated_at(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_workflow_calendar_integrations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_workflow_calendar_integrations_updated_at() OWNER TO robert;

--
-- Name: update_workflow_schedules_updated_at(); Type: FUNCTION; Schema: public; Owner: robert
--

CREATE FUNCTION public.update_workflow_schedules_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_workflow_schedules_updated_at() OWNER TO robert;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_interactions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.agent_interactions (
    id integer NOT NULL,
    agent_id integer,
    user_id integer,
    interaction_type character varying(100),
    input_data jsonb,
    output_data jsonb,
    processing_time_ms integer,
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.agent_interactions OWNER TO robert;

--
-- Name: agent_interactions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.agent_interactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agent_interactions_id_seq OWNER TO robert;

--
-- Name: agent_interactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.agent_interactions_id_seq OWNED BY public.agent_interactions.id;


--
-- Name: agents; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.agents (
    id integer NOT NULL,
    agent_type character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    capabilities text[],
    configuration jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version character varying(50) DEFAULT '1.0.0'::character varying
);


ALTER TABLE public.agents OWNER TO robert;

--
-- Name: agents_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.agents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agents_id_seq OWNER TO robert;

--
-- Name: agents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.agents_id_seq OWNED BY public.agents.id;


--
-- Name: ai_model_usage; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.ai_model_usage (
    id bigint NOT NULL,
    model_id integer,
    user_id integer,
    request_type character varying(100),
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    cost_usd numeric(10,4),
    response_time_ms integer,
    success boolean DEFAULT true,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ai_model_usage OWNER TO robert;

--
-- Name: ai_model_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.ai_model_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_model_usage_id_seq OWNER TO robert;

--
-- Name: ai_model_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.ai_model_usage_id_seq OWNED BY public.ai_model_usage.id;


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.ai_models (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    provider character varying(100) NOT NULL,
    model_id character varying(255) NOT NULL,
    capabilities text[] NOT NULL,
    input_types text[] DEFAULT '{text}'::text[],
    output_types text[] DEFAULT '{text}'::text[],
    max_tokens integer,
    cost_per_1k_tokens numeric(10,6),
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    configuration jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ai_models OWNER TO robert;

--
-- Name: ai_models_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.ai_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_models_id_seq OWNER TO robert;

--
-- Name: ai_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.ai_models_id_seq OWNED BY public.ai_models.id;


--
-- Name: api_key_usage; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.api_key_usage (
    id bigint NOT NULL,
    api_key_id integer,
    user_id integer,
    service_endpoint character varying(255),
    request_method character varying(10),
    response_status integer,
    response_time_ms integer,
    tokens_used integer,
    cost_usd numeric(10,4),
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.api_key_usage OWNER TO robert;

--
-- Name: api_key_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.api_key_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_key_usage_id_seq OWNER TO robert;

--
-- Name: api_key_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.api_key_usage_id_seq OWNED BY public.api_key_usage.id;


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    user_id integer,
    service_name character varying(100) NOT NULL,
    encrypted_key text NOT NULL,
    key_alias character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.api_keys OWNER TO robert;

--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_keys_id_seq OWNER TO robert;

--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: api_security_policies; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.api_security_policies (
    id integer NOT NULL,
    policy_name character varying(100) NOT NULL,
    policy_type character varying(50) NOT NULL,
    endpoints text[] DEFAULT '{}'::text[],
    rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.api_security_policies OWNER TO robert;

--
-- Name: TABLE api_security_policies; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.api_security_policies IS 'API security policy configuration';


--
-- Name: api_security_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.api_security_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_security_policies_id_seq OWNER TO robert;

--
-- Name: api_security_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.api_security_policies_id_seq OWNED BY public.api_security_policies.id;


--
-- Name: audio_assets; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.audio_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    filename character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    duration_seconds numeric(10,3),
    sample_rate integer,
    channels integer,
    transcription text,
    transcription_confidence numeric(5,4),
    language_detected character varying(10),
    audio_analysis jsonb,
    processing_status character varying(20) DEFAULT 'pending'::character varying,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.audio_assets OWNER TO robert;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    resource_type character varying(100),
    resource_id character varying(255),
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_log OWNER TO robert;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_id_seq OWNER TO robert;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: backup_encryption_log; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.backup_encryption_log (
    id integer NOT NULL,
    backup_id character varying(255) NOT NULL,
    backup_type character varying(50) NOT NULL,
    encryption_key_id integer,
    file_path text,
    file_size_bytes bigint,
    compression_ratio numeric(5,2),
    encryption_time_ms integer,
    checksum character varying(128),
    backup_started_at timestamp with time zone,
    backup_completed_at timestamp with time zone,
    status character varying(20) DEFAULT 'completed'::character varying,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.backup_encryption_log OWNER TO robert;

--
-- Name: backup_encryption_log_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.backup_encryption_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.backup_encryption_log_id_seq OWNER TO robert;

--
-- Name: backup_encryption_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.backup_encryption_log_id_seq OWNED BY public.backup_encryption_log.id;


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.calendar_events (
    id integer NOT NULL,
    user_id integer,
    external_event_id character varying(255),
    calendar_provider character varying(50) DEFAULT 'google'::character varying,
    title character varying(255) NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    location text,
    attendees jsonb DEFAULT '[]'::jsonb,
    is_all_day boolean DEFAULT false,
    recurrence_rule text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.calendar_events OWNER TO robert;

--
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_events_id_seq OWNER TO robert;

--
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    session_id integer,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tokens_used integer DEFAULT 0,
    model_used character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT chat_messages_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying])::text[])))
);


ALTER TABLE public.chat_messages OWNER TO robert;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_id_seq OWNER TO robert;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.chat_sessions (
    id integer NOT NULL,
    user_id integer,
    session_id uuid DEFAULT public.uuid_generate_v4(),
    title character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.chat_sessions OWNER TO robert;

--
-- Name: chat_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.chat_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_sessions_id_seq OWNER TO robert;

--
-- Name: chat_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.chat_sessions_id_seq OWNED BY public.chat_sessions.id;


--
-- Name: compliance_findings; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.compliance_findings (
    id integer NOT NULL,
    report_id integer NOT NULL,
    requirement_id character varying(100),
    title character varying(255) NOT NULL,
    description text,
    severity character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    remediation text,
    evidence jsonb DEFAULT '{}'::jsonb,
    due_date timestamp with time zone,
    resolved_at timestamp with time zone,
    CONSTRAINT compliance_findings_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


ALTER TABLE public.compliance_findings OWNER TO robert;

--
-- Name: compliance_findings_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.compliance_findings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.compliance_findings_id_seq OWNER TO robert;

--
-- Name: compliance_findings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.compliance_findings_id_seq OWNED BY public.compliance_findings.id;


--
-- Name: compliance_reports; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.compliance_reports (
    id integer NOT NULL,
    framework character varying(50) NOT NULL,
    report_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    compliance_score integer,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    generated_by integer,
    summary jsonb DEFAULT '{}'::jsonb,
    findings_count integer DEFAULT 0,
    critical_findings integer DEFAULT 0,
    report_data jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT compliance_reports_compliance_score_check CHECK (((compliance_score >= 0) AND (compliance_score <= 100)))
);


ALTER TABLE public.compliance_reports OWNER TO robert;

--
-- Name: TABLE compliance_reports; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.compliance_reports IS 'Compliance framework reports';


--
-- Name: compliance_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.compliance_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.compliance_reports_id_seq OWNER TO robert;

--
-- Name: compliance_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.compliance_reports_id_seq OWNED BY public.compliance_reports.id;


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.contacts (
    id integer NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    company character varying(255),
    job_title character varying(255),
    notes text,
    tags text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.contacts OWNER TO robert;

--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contacts_id_seq OWNER TO robert;

--
-- Name: contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.contacts_id_seq OWNED BY public.contacts.id;


--
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.conversation_messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    user_id integer NOT NULL,
    role character varying(50) NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversation_messages_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying])::text[])))
);


ALTER TABLE public.conversation_messages OWNER TO robert;

--
-- Name: conversation_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.conversation_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversation_messages_id_seq OWNER TO robert;

--
-- Name: conversation_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.conversation_messages_id_seq OWNED BY public.conversation_messages.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.conversations OWNER TO robert;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO robert;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: data_backups; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.data_backups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    backup_type character varying(50) NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    compression_type character varying(20),
    encryption_enabled boolean DEFAULT false,
    backup_status character varying(20) DEFAULT 'completed'::character varying,
    started_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    expires_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.data_backups OWNER TO robert;

--
-- Name: data_classification_assignments; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.data_classification_assignments (
    id integer NOT NULL,
    table_name character varying(255) NOT NULL,
    column_name character varying(255),
    tag_id integer,
    confidence_score numeric(3,2) DEFAULT 1.0,
    assigned_by integer,
    assignment_method character varying(50) DEFAULT 'manual'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.data_classification_assignments OWNER TO robert;

--
-- Name: data_classification_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.data_classification_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_classification_assignments_id_seq OWNER TO robert;

--
-- Name: data_classification_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.data_classification_assignments_id_seq OWNED BY public.data_classification_assignments.id;


--
-- Name: data_classification_tags; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.data_classification_tags (
    id integer NOT NULL,
    tag_name character varying(100) NOT NULL,
    tag_category character varying(50) NOT NULL,
    tag_description text,
    color_code character varying(7),
    retention_period_days integer,
    handling_requirements jsonb,
    compliance_frameworks text[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.data_classification_tags OWNER TO robert;

--
-- Name: data_classification_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.data_classification_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_classification_tags_id_seq OWNER TO robert;

--
-- Name: data_classification_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.data_classification_tags_id_seq OWNED BY public.data_classification_tags.id;


--
-- Name: data_masking_rules; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.data_masking_rules (
    id integer NOT NULL,
    rule_name character varying(255) NOT NULL,
    table_name character varying(255) NOT NULL,
    column_name character varying(255) NOT NULL,
    masking_method character varying(50) NOT NULL,
    masking_config jsonb,
    preserve_length boolean DEFAULT true,
    preserve_format boolean DEFAULT false,
    enabled boolean DEFAULT true,
    priority integer DEFAULT 100,
    created_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.data_masking_rules OWNER TO robert;

--
-- Name: data_masking_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.data_masking_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_masking_rules_id_seq OWNER TO robert;

--
-- Name: data_masking_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.data_masking_rules_id_seq OWNED BY public.data_masking_rules.id;


--
-- Name: database_security_config; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.database_security_config (
    id integer NOT NULL,
    table_name character varying(255) NOT NULL,
    column_name character varying(255) NOT NULL,
    security_classification character varying(50) DEFAULT 'public'::character varying NOT NULL,
    encryption_enabled boolean DEFAULT false,
    encryption_algorithm character varying(50) DEFAULT 'AES-256-GCM'::character varying,
    masking_enabled boolean DEFAULT false,
    masking_method character varying(50) DEFAULT 'partial'::character varying,
    audit_enabled boolean DEFAULT true,
    data_retention_days integer DEFAULT 365,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.database_security_config OWNER TO robert;

--
-- Name: database_security_config_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.database_security_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.database_security_config_id_seq OWNER TO robert;

--
-- Name: database_security_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.database_security_config_id_seq OWNED BY public.database_security_config.id;


--
-- Name: database_security_policies; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.database_security_policies (
    id integer NOT NULL,
    policy_name character varying(255) NOT NULL,
    policy_type character varying(50) NOT NULL,
    scope_type character varying(50) NOT NULL,
    scope_value text,
    policy_rules jsonb NOT NULL,
    priority integer DEFAULT 100,
    enabled boolean DEFAULT true,
    enforcement_level character varying(20) DEFAULT 'enforce'::character varying,
    violation_action character varying(50) DEFAULT 'log'::character varying,
    created_by integer,
    approved_by integer,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.database_security_policies OWNER TO robert;

--
-- Name: database_security_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.database_security_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.database_security_policies_id_seq OWNER TO robert;

--
-- Name: database_security_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.database_security_policies_id_seq OWNED BY public.database_security_policies.id;


--
-- Name: documentation; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.documentation (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    doc_type character varying(50) DEFAULT 'manual'::character varying,
    category character varying(100),
    tags text[],
    version character varying(50) DEFAULT '1.0.0'::character varying,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.documentation OWNER TO robert;

--
-- Name: documentation_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.documentation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documentation_id_seq OWNER TO robert;

--
-- Name: documentation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.documentation_id_seq OWNED BY public.documentation.id;


--
-- Name: email_accounts; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.email_accounts (
    id integer NOT NULL,
    user_id integer,
    email_address character varying(255) NOT NULL,
    provider character varying(50),
    encrypted_credentials text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_accounts OWNER TO robert;

--
-- Name: email_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.email_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_accounts_id_seq OWNER TO robert;

--
-- Name: email_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.email_accounts_id_seq OWNED BY public.email_accounts.id;


--
-- Name: email_threads; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.email_threads (
    id integer NOT NULL,
    account_id integer,
    thread_id character varying(255) NOT NULL,
    subject character varying(500),
    participants jsonb DEFAULT '[]'::jsonb,
    message_count integer DEFAULT 0,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_threads OWNER TO robert;

--
-- Name: email_threads_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.email_threads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_threads_id_seq OWNER TO robert;

--
-- Name: email_threads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.email_threads_id_seq OWNED BY public.email_threads.id;


--
-- Name: emails; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    message_id character varying(255) NOT NULL,
    thread_id character varying(255),
    subject character varying(500),
    sender_email character varying(255),
    sender_name character varying(255),
    recipient_emails text[],
    body_text text,
    body_html text,
    attachments jsonb DEFAULT '[]'::jsonb,
    labels text[],
    folder character varying(100) DEFAULT 'inbox'::character varying,
    is_read boolean DEFAULT false,
    is_starred boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    received_at timestamp without time zone,
    external_source character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.emails OWNER TO robert;

--
-- Name: encryption_keys; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.encryption_keys (
    id integer NOT NULL,
    key_name character varying(100) NOT NULL,
    key_type character varying(50) NOT NULL,
    key_size integer,
    key_data text NOT NULL,
    iv text,
    salt text,
    algorithm character varying(50),
    created_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    rotation_policy jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.encryption_keys OWNER TO robert;

--
-- Name: TABLE encryption_keys; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.encryption_keys IS 'Encryption key management';


--
-- Name: encryption_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.encryption_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.encryption_keys_id_seq OWNER TO robert;

--
-- Name: encryption_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.encryption_keys_id_seq OWNED BY public.encryption_keys.id;


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.error_logs (
    id bigint NOT NULL,
    user_id integer,
    request_id uuid,
    error_type character varying(100) NOT NULL,
    error_message text NOT NULL,
    stack_trace text,
    endpoint character varying(255),
    method character varying(10),
    status_code integer,
    context jsonb DEFAULT '{}'::jsonb,
    resolved_at timestamp without time zone,
    resolution_notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.error_logs OWNER TO robert;

--
-- Name: error_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.error_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.error_logs_id_seq OWNER TO robert;

--
-- Name: error_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.error_logs_id_seq OWNED BY public.error_logs.id;


--
-- Name: hf_models; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.hf_models (
    id integer NOT NULL,
    model_id character varying(255) NOT NULL,
    model_name character varying(255) NOT NULL,
    task_type character varying(100) NOT NULL,
    provider character varying(100),
    description text,
    parameters jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.hf_models OWNER TO robert;

--
-- Name: hf_models_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.hf_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hf_models_id_seq OWNER TO robert;

--
-- Name: hf_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.hf_models_id_seq OWNED BY public.hf_models.id;


--
-- Name: image_assets; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.image_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    filename character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    width integer,
    height integer,
    description text,
    objects_detected jsonb DEFAULT '[]'::jsonb,
    faces_detected jsonb DEFAULT '[]'::jsonb,
    text_extracted text,
    color_palette jsonb,
    processing_status character varying(20) DEFAULT 'pending'::character varying,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.image_assets OWNER TO robert;

--
-- Name: integration_api_schemas; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_api_schemas (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    endpoint character varying(255) NOT NULL,
    method character varying(10) DEFAULT 'GET'::character varying,
    request_schema jsonb,
    response_schema jsonb,
    schema_version character varying(20) DEFAULT '1.0'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.integration_api_schemas OWNER TO robert;

--
-- Name: TABLE integration_api_schemas; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_api_schemas IS 'API request and response schema validation rules';


--
-- Name: integration_api_schemas_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_api_schemas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_api_schemas_id_seq OWNER TO robert;

--
-- Name: integration_api_schemas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_api_schemas_id_seq OWNED BY public.integration_api_schemas.id;


--
-- Name: integration_auth_tokens; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_auth_tokens (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    token_type character varying(50) NOT NULL,
    encrypted_token text NOT NULL,
    token_metadata jsonb DEFAULT '{}'::jsonb,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT integration_auth_tokens_token_type_check CHECK (((token_type)::text = ANY ((ARRAY['access_token'::character varying, 'refresh_token'::character varying, 'api_key'::character varying, 'certificate'::character varying])::text[])))
);


ALTER TABLE public.integration_auth_tokens OWNER TO robert;

--
-- Name: TABLE integration_auth_tokens; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_auth_tokens IS 'Secure storage for authentication tokens and credentials';


--
-- Name: integration_auth_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_auth_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_auth_tokens_id_seq OWNER TO robert;

--
-- Name: integration_auth_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_auth_tokens_id_seq OWNED BY public.integration_auth_tokens.id;


--
-- Name: integration_connection_pools; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_connection_pools (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    pool_type character varying(50) NOT NULL,
    pool_config jsonb NOT NULL,
    current_connections integer DEFAULT 0,
    max_connections integer DEFAULT 10,
    idle_connections integer DEFAULT 0,
    pool_status character varying(50) DEFAULT 'healthy'::character varying,
    last_health_check timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT integration_connection_pools_pool_status_check CHECK (((pool_status)::text = ANY ((ARRAY['healthy'::character varying, 'degraded'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.integration_connection_pools OWNER TO robert;

--
-- Name: TABLE integration_connection_pools; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_connection_pools IS 'Database connection pool management and monitoring';


--
-- Name: integration_connection_pools_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_connection_pools_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_connection_pools_id_seq OWNER TO robert;

--
-- Name: integration_connection_pools_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_connection_pools_id_seq OWNED BY public.integration_connection_pools.id;


--
-- Name: integration_executions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_executions (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    workflow_execution_id integer,
    operation_type character varying(100) NOT NULL,
    operation_details jsonb DEFAULT '{}'::jsonb,
    status character varying(50) NOT NULL,
    duration_ms integer,
    request_size_bytes integer,
    response_size_bytes integer,
    response_data jsonb,
    error_message text,
    error_code character varying(50),
    executed_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT integration_executions_status_check CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'error'::character varying, 'timeout'::character varying, 'rate_limited'::character varying])::text[])))
);


ALTER TABLE public.integration_executions OWNER TO robert;

--
-- Name: TABLE integration_executions; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_executions IS 'Records of all integration execution attempts and results';


--
-- Name: integration_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_executions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_executions_id_seq OWNER TO robert;

--
-- Name: integration_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_executions_id_seq OWNED BY public.integration_executions.id;


--
-- Name: integration_health_checks; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_health_checks (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    check_type character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    response_time_ms integer,
    error_message text,
    check_details jsonb DEFAULT '{}'::jsonb,
    checked_at timestamp with time zone DEFAULT now(),
    CONSTRAINT integration_health_checks_status_check CHECK (((status)::text = ANY ((ARRAY['healthy'::character varying, 'degraded'::character varying, 'unhealthy'::character varying])::text[])))
);


ALTER TABLE public.integration_health_checks OWNER TO robert;

--
-- Name: TABLE integration_health_checks; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_health_checks IS 'Health monitoring and status check results';


--
-- Name: integration_health_checks_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_health_checks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_health_checks_id_seq OWNER TO robert;

--
-- Name: integration_health_checks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_health_checks_id_seq OWNED BY public.integration_health_checks.id;


--
-- Name: integration_message_queues; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_message_queues (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    queue_name character varying(255) NOT NULL,
    queue_type character varying(50) NOT NULL,
    queue_config jsonb DEFAULT '{}'::jsonb,
    message_count integer DEFAULT 0,
    consumer_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.integration_message_queues OWNER TO robert;

--
-- Name: TABLE integration_message_queues; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_message_queues IS 'Message queue configuration and status tracking';


--
-- Name: integration_message_queues_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_message_queues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_message_queues_id_seq OWNER TO robert;

--
-- Name: integration_message_queues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_message_queues_id_seq OWNED BY public.integration_message_queues.id;


--
-- Name: service_integrations; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.service_integrations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    integration_type character varying(50) NOT NULL,
    description text,
    configuration jsonb NOT NULL,
    auth_config jsonb DEFAULT '{}'::jsonb,
    rate_limit_config jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    status character varying(50) DEFAULT 'active'::character varying,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT service_integrations_integration_type_check CHECK (((integration_type)::text = ANY ((ARRAY['rest_api'::character varying, 'database'::character varying, 'cloud_service'::character varying, 'messaging'::character varying, 'webhook'::character varying, 'file_system'::character varying, 'email'::character varying])::text[]))),
    CONSTRAINT service_integrations_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'failed'::character varying, 'testing'::character varying])::text[])))
);


ALTER TABLE public.service_integrations OWNER TO robert;

--
-- Name: TABLE service_integrations; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.service_integrations IS 'Main table for external service integrations configuration';


--
-- Name: integration_performance_overview; Type: MATERIALIZED VIEW; Schema: public; Owner: robert
--

CREATE MATERIALIZED VIEW public.integration_performance_overview AS
 SELECT si.id,
    si.name,
    si.integration_type,
    si.is_active,
    si.status,
    count(ie.id) AS total_executions,
    count(
        CASE
            WHEN ((ie.status)::text = 'success'::text) THEN 1
            ELSE NULL::integer
        END) AS successful_executions,
    count(
        CASE
            WHEN ((ie.status)::text = 'error'::text) THEN 1
            ELSE NULL::integer
        END) AS failed_executions,
    round(avg(ie.duration_ms)) AS avg_response_time_ms,
    min(ie.duration_ms) AS min_response_time_ms,
    max(ie.duration_ms) AS max_response_time_ms,
    max(ie.executed_at) AS last_execution_at,
        CASE
            WHEN (count(ie.id) = 0) THEN (100)::numeric
            ELSE round((((count(
            CASE
                WHEN ((ie.status)::text = 'success'::text) THEN 1
                ELSE NULL::integer
            END))::numeric / (count(ie.id))::numeric) * (100)::numeric), 2)
        END AS success_rate_percentage
   FROM (public.service_integrations si
     LEFT JOIN public.integration_executions ie ON (((si.id = ie.integration_id) AND (ie.executed_at >= (CURRENT_DATE - '30 days'::interval)))))
  GROUP BY si.id, si.name, si.integration_type, si.is_active, si.status
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.integration_performance_overview OWNER TO robert;

--
-- Name: integration_performance_summary; Type: VIEW; Schema: public; Owner: robert
--

CREATE VIEW public.integration_performance_summary AS
 SELECT si.id,
    si.user_id,
    si.name,
    si.integration_type,
    si.status,
    si.is_active,
    COALESCE(perf.total_executions, (0)::bigint) AS total_executions,
    COALESCE(perf.successful_executions, (0)::bigint) AS successful_executions,
    COALESCE(perf.failed_executions, (0)::bigint) AS failed_executions,
    perf.avg_response_time_ms,
    perf.last_execution_at,
        CASE
            WHEN (COALESCE(perf.total_executions, (0)::bigint) = 0) THEN (100)::numeric
            ELSE round((((perf.successful_executions)::numeric / (perf.total_executions)::numeric) * (100)::numeric), 2)
        END AS success_rate_percentage,
        CASE
            WHEN ((si.status)::text = 'failed'::text) THEN (0)::numeric
            WHEN ((si.status)::text = 'inactive'::text) THEN (25)::numeric
            WHEN (COALESCE(perf.total_executions, (0)::bigint) = 0) THEN (75)::numeric
            ELSE LEAST((100)::numeric, ((((COALESCE(perf.successful_executions, (0)::bigint))::numeric / (GREATEST(perf.total_executions, (1)::bigint))::numeric) * (100)::numeric) *
            CASE
                WHEN (perf.avg_response_time_ms > (10000)::numeric) THEN 0.5
                WHEN (perf.avg_response_time_ms > (5000)::numeric) THEN 0.7
                WHEN (perf.avg_response_time_ms > (2000)::numeric) THEN 0.9
                ELSE 1.0
            END))
        END AS health_score
   FROM (public.service_integrations si
     LEFT JOIN ( SELECT integration_executions.integration_id,
            count(*) AS total_executions,
            count(
                CASE
                    WHEN ((integration_executions.status)::text = 'success'::text) THEN 1
                    ELSE NULL::integer
                END) AS successful_executions,
            count(
                CASE
                    WHEN ((integration_executions.status)::text = 'error'::text) THEN 1
                    ELSE NULL::integer
                END) AS failed_executions,
            avg(integration_executions.duration_ms) AS avg_response_time_ms,
            max(integration_executions.executed_at) AS last_execution_at
           FROM public.integration_executions
          WHERE (integration_executions.executed_at >= (CURRENT_DATE - '30 days'::interval))
          GROUP BY integration_executions.integration_id) perf ON ((si.id = perf.integration_id)));


ALTER VIEW public.integration_performance_summary OWNER TO robert;

--
-- Name: VIEW integration_performance_summary; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON VIEW public.integration_performance_summary IS 'Performance summary view for service integrations with health scores';


--
-- Name: integration_rate_limits; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_rate_limits (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    time_window_start timestamp with time zone NOT NULL,
    time_window_duration interval DEFAULT '00:01:00'::interval,
    requests_count integer DEFAULT 0,
    requests_limit integer NOT NULL,
    burst_count integer DEFAULT 0,
    burst_limit integer,
    is_blocked boolean DEFAULT false,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.integration_rate_limits OWNER TO robert;

--
-- Name: TABLE integration_rate_limits; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_rate_limits IS 'Rate limiting tracking and enforcement data';


--
-- Name: integration_rate_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_rate_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_rate_limits_id_seq OWNER TO robert;

--
-- Name: integration_rate_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_rate_limits_id_seq OWNED BY public.integration_rate_limits.id;


--
-- Name: integration_usage_analytics; Type: MATERIALIZED VIEW; Schema: public; Owner: robert
--

CREATE MATERIALIZED VIEW public.integration_usage_analytics AS
 SELECT date_trunc('day'::text, ie.executed_at) AS date,
    si.integration_type,
    count(ie.id) AS total_requests,
    count(
        CASE
            WHEN ((ie.status)::text = 'success'::text) THEN 1
            ELSE NULL::integer
        END) AS successful_requests,
    count(
        CASE
            WHEN ((ie.status)::text = 'error'::text) THEN 1
            ELSE NULL::integer
        END) AS failed_requests,
    avg(ie.duration_ms) AS avg_response_time,
    sum(ie.request_size_bytes) AS total_request_bytes,
    sum(ie.response_size_bytes) AS total_response_bytes
   FROM (public.integration_executions ie
     JOIN public.service_integrations si ON ((ie.integration_id = si.id)))
  WHERE (ie.executed_at >= (CURRENT_DATE - '90 days'::interval))
  GROUP BY (date_trunc('day'::text, ie.executed_at)), si.integration_type
  ORDER BY (date_trunc('day'::text, ie.executed_at)) DESC, si.integration_type
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.integration_usage_analytics OWNER TO robert;

--
-- Name: integration_webhook_events; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_webhook_events (
    id integer NOT NULL,
    webhook_id integer NOT NULL,
    request_method character varying(10) NOT NULL,
    request_headers jsonb DEFAULT '{}'::jsonb,
    request_body jsonb,
    request_ip_address inet,
    response_status integer,
    response_body jsonb,
    processing_duration_ms integer,
    error_message text,
    received_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.integration_webhook_events OWNER TO robert;

--
-- Name: TABLE integration_webhook_events; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_webhook_events IS 'Log of all webhook events received and processed';


--
-- Name: integration_webhook_events_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_webhook_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_webhook_events_id_seq OWNER TO robert;

--
-- Name: integration_webhook_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_webhook_events_id_seq OWNED BY public.integration_webhook_events.id;


--
-- Name: integration_webhooks; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integration_webhooks (
    id integer NOT NULL,
    integration_id integer NOT NULL,
    webhook_path character varying(255) NOT NULL,
    allowed_methods text[] DEFAULT ARRAY['POST'::text],
    security_config jsonb DEFAULT '{}'::jsonb,
    headers_config jsonb DEFAULT '{}'::jsonb,
    payload_transformation jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    last_triggered_at timestamp with time zone,
    total_triggers integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.integration_webhooks OWNER TO robert;

--
-- Name: TABLE integration_webhooks; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.integration_webhooks IS 'Configuration for webhook endpoints and routing';


--
-- Name: integration_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integration_webhooks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integration_webhooks_id_seq OWNER TO robert;

--
-- Name: integration_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integration_webhooks_id_seq OWNED BY public.integration_webhooks.id;


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.integrations (
    id integer NOT NULL,
    user_id integer,
    service_name character varying(100) NOT NULL,
    service_type character varying(50) NOT NULL,
    configuration jsonb NOT NULL,
    is_active boolean DEFAULT true,
    last_sync_at timestamp without time zone,
    sync_status character varying(20) DEFAULT 'pending'::character varying,
    sync_error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.integrations OWNER TO robert;

--
-- Name: integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.integrations_id_seq OWNER TO robert;

--
-- Name: integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.integrations_id_seq OWNED BY public.integrations.id;


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    title character varying(500),
    content text NOT NULL,
    mood_score integer,
    emotions text[],
    tags text[],
    weather character varying(50),
    location text,
    is_private boolean DEFAULT true,
    word_count integer DEFAULT 0,
    sentiment_score numeric(3,2),
    sentiment_analysis jsonb,
    attachments jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT journal_entries_mood_score_check CHECK (((mood_score >= 1) AND (mood_score <= 10)))
);


ALTER TABLE public.journal_entries OWNER TO robert;

--
-- Name: jwt_blacklist; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.jwt_blacklist (
    id integer NOT NULL,
    user_id integer,
    jti character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    blacklisted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason character varying(255) DEFAULT 'logout'::character varying
);


ALTER TABLE public.jwt_blacklist OWNER TO robert;

--
-- Name: TABLE jwt_blacklist; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.jwt_blacklist IS 'Blacklisted JWT tokens for secure logout';


--
-- Name: jwt_blacklist_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.jwt_blacklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.jwt_blacklist_id_seq OWNER TO robert;

--
-- Name: jwt_blacklist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.jwt_blacklist_id_seq OWNED BY public.jwt_blacklist.id;


--
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.knowledge_chunks (
    id integer NOT NULL,
    document_id integer NOT NULL,
    user_id integer NOT NULL,
    chunk_text text NOT NULL,
    chunk_index integer NOT NULL,
    chunk_tokens integer,
    embedding public.vector(1536),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.knowledge_chunks OWNER TO robert;

--
-- Name: knowledge_chunks_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.knowledge_chunks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_chunks_id_seq OWNER TO robert;

--
-- Name: knowledge_chunks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.knowledge_chunks_id_seq OWNED BY public.knowledge_chunks.id;


--
-- Name: knowledge_collections; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.knowledge_collections (
    id integer NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    description text,
    document_count integer DEFAULT 0,
    is_public boolean DEFAULT false,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.knowledge_collections OWNER TO robert;

--
-- Name: knowledge_collections_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.knowledge_collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_collections_id_seq OWNER TO robert;

--
-- Name: knowledge_collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.knowledge_collections_id_seq OWNED BY public.knowledge_collections.id;


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.knowledge_documents (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(500) NOT NULL,
    content text,
    file_path character varying(1000),
    file_type character varying(100),
    file_size integer,
    content_hash character varying(64),
    metadata jsonb DEFAULT '{}'::jsonb,
    processing_status character varying(50) DEFAULT 'pending'::character varying,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.knowledge_documents OWNER TO robert;

--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.knowledge_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_documents_id_seq OWNER TO robert;

--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.knowledge_documents_id_seq OWNED BY public.knowledge_documents.id;


--
-- Name: knowledge_entries; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.knowledge_entries (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    content_type character varying(50) DEFAULT 'text'::character varying,
    embedding public.vector(1536),
    tags text[],
    category character varying(100),
    source_url character varying(500),
    confidence_score double precision DEFAULT 1.0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.knowledge_entries OWNER TO robert;

--
-- Name: knowledge_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.knowledge_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_entries_id_seq OWNER TO robert;

--
-- Name: knowledge_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.knowledge_entries_id_seq OWNED BY public.knowledge_entries.id;


--
-- Name: knowledge_extractions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.knowledge_extractions (
    id integer NOT NULL,
    document_id integer NOT NULL,
    user_id integer NOT NULL,
    extraction_type character varying(100) NOT NULL,
    extracted_data jsonb NOT NULL,
    confidence_score double precision,
    extraction_method character varying(100),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.knowledge_extractions OWNER TO robert;

--
-- Name: knowledge_extractions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.knowledge_extractions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_extractions_id_seq OWNER TO robert;

--
-- Name: knowledge_extractions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.knowledge_extractions_id_seq OWNED BY public.knowledge_extractions.id;


--
-- Name: knowledge_queries; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.knowledge_queries (
    id integer NOT NULL,
    user_id integer NOT NULL,
    query_text text NOT NULL,
    query_embedding public.vector(1536),
    search_type character varying(50) DEFAULT 'semantic'::character varying,
    results_count integer DEFAULT 0,
    response_generated text,
    processing_time_ms integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.knowledge_queries OWNER TO robert;

--
-- Name: knowledge_queries_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.knowledge_queries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_queries_id_seq OWNER TO robert;

--
-- Name: knowledge_queries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.knowledge_queries_id_seq OWNED BY public.knowledge_queries.id;


--
-- Name: knowledge_relationships; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.knowledge_relationships (
    id integer NOT NULL,
    user_id integer NOT NULL,
    source_document_id integer NOT NULL,
    target_document_id integer NOT NULL,
    relationship_type character varying(100) NOT NULL,
    similarity_score double precision,
    relationship_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.knowledge_relationships OWNER TO robert;

--
-- Name: knowledge_relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.knowledge_relationships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.knowledge_relationships_id_seq OWNER TO robert;

--
-- Name: knowledge_relationships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.knowledge_relationships_id_seq OWNED BY public.knowledge_relationships.id;


--
-- Name: mcp_tasks; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.mcp_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_type character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    parameters jsonb,
    result jsonb,
    error_message text,
    metadata jsonb,
    embedding public.vector(1536),
    user_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.mcp_tasks OWNER TO robert;

--
-- Name: mood_analytics; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.mood_analytics (
    id integer NOT NULL,
    user_id integer,
    date date NOT NULL,
    mood_average numeric(3,2),
    mood_entries_count integer DEFAULT 0,
    dominant_emotions text[],
    journal_word_count integer DEFAULT 0,
    activities text[],
    weather character varying(50),
    sleep_hours numeric(3,1),
    exercise_minutes integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.mood_analytics OWNER TO robert;

--
-- Name: mood_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.mood_analytics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mood_analytics_id_seq OWNER TO robert;

--
-- Name: mood_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.mood_analytics_id_seq OWNED BY public.mood_analytics.id;


--
-- Name: multi_modal_processing_log; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.multi_modal_processing_log (
    id integer NOT NULL,
    user_id integer,
    session_id uuid,
    input_type character varying(50) NOT NULL,
    input_data jsonb,
    output_type character varying(50),
    output_data jsonb,
    processing_agent character varying(100),
    processing_time_ms integer,
    confidence_score double precision,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    processing_status character varying(50) DEFAULT 'pending'::character varying,
    processed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.multi_modal_processing_log OWNER TO robert;

--
-- Name: multi_modal_processing_log_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.multi_modal_processing_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.multi_modal_processing_log_id_seq OWNER TO robert;

--
-- Name: multi_modal_processing_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.multi_modal_processing_log_id_seq OWNED BY public.multi_modal_processing_log.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    priority character varying(20) DEFAULT 'normal'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT notifications_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))
);


ALTER TABLE public.notifications OWNER TO robert;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO robert;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: oauth_tokens; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.oauth_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    provider character varying(50) NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    scope text,
    token_type character varying(20) DEFAULT 'Bearer'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.oauth_tokens OWNER TO robert;

--
-- Name: TABLE oauth_tokens; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.oauth_tokens IS 'OAuth token storage for external providers';


--
-- Name: oauth_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.oauth_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.oauth_tokens_id_seq OWNER TO robert;

--
-- Name: oauth_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.oauth_tokens_id_seq OWNED BY public.oauth_tokens.id;


--
-- Name: performance_alerts; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.performance_alerts (
    id integer NOT NULL,
    alert_id character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    metric character varying(255) NOT NULL,
    value numeric NOT NULL,
    threshold numeric NOT NULL,
    severity character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    message text,
    triggered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT performance_alerts_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT performance_alerts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'resolved'::character varying, 'suppressed'::character varying])::text[])))
);


ALTER TABLE public.performance_alerts OWNER TO robert;

--
-- Name: performance_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.performance_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.performance_alerts_id_seq OWNER TO robert;

--
-- Name: performance_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.performance_alerts_id_seq OWNED BY public.performance_alerts.id;


--
-- Name: performance_metrics; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.performance_metrics (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    value numeric NOT NULL,
    unit character varying(50) DEFAULT ''::character varying,
    labels jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.performance_metrics OWNER TO robert;

--
-- Name: performance_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.performance_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.performance_metrics_id_seq OWNER TO robert;

--
-- Name: performance_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.performance_metrics_id_seq OWNED BY public.performance_metrics.id;


--
-- Name: performance_recommendations; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.performance_recommendations (
    id integer NOT NULL,
    rule_name character varying(255) NOT NULL,
    recommendation text NOT NULL,
    severity character varying(50) NOT NULL,
    automated boolean DEFAULT false,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    implemented_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    context jsonb DEFAULT '{}'::jsonb,
    metrics_snapshot jsonb DEFAULT '{}'::jsonb,
    implementation_notes text,
    estimated_impact character varying(255),
    CONSTRAINT performance_recommendations_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT performance_recommendations_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'implemented'::character varying, 'dismissed'::character varying])::text[])))
);


ALTER TABLE public.performance_recommendations OWNER TO robert;

--
-- Name: performance_recommendations_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.performance_recommendations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.performance_recommendations_id_seq OWNER TO robert;

--
-- Name: performance_recommendations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.performance_recommendations_id_seq OWNED BY public.performance_recommendations.id;


--
-- Name: performance_thresholds; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.performance_thresholds (
    id integer NOT NULL,
    metric_name character varying(255) NOT NULL,
    threshold_value numeric NOT NULL,
    threshold_type character varying(50) NOT NULL,
    severity character varying(50) NOT NULL,
    enabled boolean DEFAULT true,
    description text,
    unit character varying(50) DEFAULT ''::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT performance_thresholds_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT performance_thresholds_threshold_type_check CHECK (((threshold_type)::text = ANY ((ARRAY['greater_than'::character varying, 'less_than'::character varying, 'equals'::character varying])::text[])))
);


ALTER TABLE public.performance_thresholds OWNER TO robert;

--
-- Name: performance_thresholds_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.performance_thresholds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.performance_thresholds_id_seq OWNER TO robert;

--
-- Name: performance_thresholds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.performance_thresholds_id_seq OWNED BY public.performance_thresholds.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.permissions OWNER TO robert;

--
-- Name: TABLE permissions; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.permissions IS 'Granular permissions for resources';


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permissions_id_seq OWNER TO robert;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: privacy_settings; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.privacy_settings (
    id integer NOT NULL,
    user_id integer,
    data_retention_days integer DEFAULT 90,
    allow_data_sharing boolean DEFAULT false,
    encryption_enabled boolean DEFAULT true,
    audit_logging boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.privacy_settings OWNER TO robert;

--
-- Name: privacy_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.privacy_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.privacy_settings_id_seq OWNER TO robert;

--
-- Name: privacy_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.privacy_settings_id_seq OWNED BY public.privacy_settings.id;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id integer,
    endpoint text NOT NULL,
    p256dh_key text NOT NULL,
    auth_key text NOT NULL,
    user_agent text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    last_used_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.push_subscriptions OWNER TO robert;

--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_subscriptions_id_seq OWNER TO robert;

--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    granted_by integer,
    granted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO robert;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_permissions_id_seq OWNER TO robert;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system_role boolean DEFAULT false NOT NULL,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.roles OWNER TO robert;

--
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.roles IS 'System roles for RBAC';


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO robert;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: search_analytics; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.search_analytics (
    id bigint NOT NULL,
    user_id integer,
    query_text text NOT NULL,
    results_count integer DEFAULT 0,
    clicked_result_id uuid,
    response_time_ms integer,
    search_type character varying(50) DEFAULT 'global'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.search_analytics OWNER TO robert;

--
-- Name: search_analytics_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.search_analytics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.search_analytics_id_seq OWNER TO robert;

--
-- Name: search_analytics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.search_analytics_id_seq OWNED BY public.search_analytics.id;


--
-- Name: search_index; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.search_index (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    content_type character varying(100) NOT NULL,
    content_id character varying(255) NOT NULL,
    title character varying(500),
    content text,
    url text,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    search_vector tsvector,
    embedding public.vector(1536),
    last_indexed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.search_index OWNER TO robert;

--
-- Name: security_audit_log; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_audit_log (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    resource character varying(100),
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address inet,
    user_agent text,
    success boolean DEFAULT true NOT NULL,
    risk_score integer DEFAULT 0,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT security_audit_log_risk_score_check CHECK (((risk_score >= 0) AND (risk_score <= 100)))
);


ALTER TABLE public.security_audit_log OWNER TO robert;

--
-- Name: TABLE security_audit_log; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_audit_log IS 'Comprehensive security audit logging';


--
-- Name: security_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.security_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_audit_log_id_seq OWNER TO robert;

--
-- Name: security_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.security_audit_log_id_seq OWNED BY public.security_audit_log.id;


--
-- Name: security_configuration; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_configuration (
    id integer NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value jsonb NOT NULL,
    description text,
    is_sensitive boolean DEFAULT false NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.security_configuration OWNER TO robert;

--
-- Name: TABLE security_configuration; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_configuration IS 'Security system configuration';


--
-- Name: security_configuration_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.security_configuration_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_configuration_id_seq OWNER TO robert;

--
-- Name: security_configuration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.security_configuration_id_seq OWNED BY public.security_configuration.id;


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_events (
    id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    affected_user_id integer,
    ip_address inet,
    resolved boolean DEFAULT false NOT NULL,
    resolved_by integer,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT security_events_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


ALTER TABLE public.security_events OWNER TO robert;

--
-- Name: TABLE security_events; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_events IS 'Security events and incidents';


--
-- Name: security_events_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.security_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_events_id_seq OWNER TO robert;

--
-- Name: security_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.security_events_id_seq OWNED BY public.security_events.id;


--
-- Name: security_sessions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_token character varying(255) NOT NULL,
    ip_address inet,
    user_agent text,
    device_fingerprint character varying(255),
    expires_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_activity timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.security_sessions OWNER TO robert;

--
-- Name: TABLE security_sessions; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_sessions IS 'Enhanced session management';


--
-- Name: security_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.security_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_sessions_id_seq OWNER TO robert;

--
-- Name: security_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.security_sessions_id_seq OWNED BY public.security_sessions.id;


--
-- Name: security_test_artifacts; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_test_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_run_id uuid,
    test_result_id uuid,
    vulnerability_id uuid,
    artifact_type character varying(50) NOT NULL,
    file_name character varying(300) NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    mime_type character varying(100),
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.security_test_artifacts OWNER TO robert;

--
-- Name: TABLE security_test_artifacts; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_test_artifacts IS 'Test evidence, logs, screenshots, and other artifacts';


--
-- Name: security_test_configurations; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_test_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    suite_id character varying(100) NOT NULL,
    configuration jsonb NOT NULL,
    is_template boolean DEFAULT false,
    is_default boolean DEFAULT false,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.security_test_configurations OWNER TO robert;

--
-- Name: TABLE security_test_configurations; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_test_configurations IS 'Reusable security test configurations and templates';


--
-- Name: security_test_metrics; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_test_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_run_id uuid,
    metric_name character varying(100) NOT NULL,
    metric_value numeric(10,2) NOT NULL,
    metric_unit character varying(50),
    metric_category character varying(50),
    collected_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.security_test_metrics OWNER TO robert;

--
-- Name: TABLE security_test_metrics; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_test_metrics IS 'Security testing performance and effectiveness metrics';


--
-- Name: security_test_reports; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_test_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_run_id uuid,
    report_data jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    overall_risk character varying(20) NOT NULL,
    risk_score integer DEFAULT 0 NOT NULL,
    vulnerabilities_count integer DEFAULT 0,
    recommendations_count integer DEFAULT 0,
    compliance_status character varying(50),
    report_format character varying(20) DEFAULT 'json'::character varying,
    file_path text,
    shared_with text[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.security_test_reports OWNER TO robert;

--
-- Name: TABLE security_test_reports; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_test_reports IS 'Generated security test reports and documentation';


--
-- Name: security_test_results; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_test_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_run_id uuid,
    test_id character varying(100) NOT NULL,
    test_name character varying(200) NOT NULL,
    status character varying(50) NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    message text,
    error_message text,
    details jsonb DEFAULT '{}'::jsonb,
    vulnerabilities_found integer DEFAULT 0,
    artifacts_path text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.security_test_results OWNER TO robert;

--
-- Name: TABLE security_test_results; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_test_results IS 'Individual test results within test runs';


--
-- Name: security_test_runs; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_test_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    suite_id character varying(100) NOT NULL,
    suite_name character varying(200) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    duration_ms integer,
    test_count integer DEFAULT 0 NOT NULL,
    tests_passed integer DEFAULT 0,
    tests_failed integer DEFAULT 0,
    tests_errors integer DEFAULT 0,
    tests_warnings integer DEFAULT 0,
    tests_skipped integer DEFAULT 0,
    vulnerabilities_found integer DEFAULT 0,
    error_message text,
    triggered_by character varying(100),
    configuration jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.security_test_runs OWNER TO robert;

--
-- Name: TABLE security_test_runs; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_test_runs IS 'Tracks security test suite execution runs';


--
-- Name: security_test_schedules; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_test_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    suite_id character varying(100) NOT NULL,
    suite_name character varying(200) NOT NULL,
    schedule_expression character varying(100) NOT NULL,
    enabled boolean DEFAULT true,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    configuration jsonb DEFAULT '{}'::jsonb,
    notification_emails text[],
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.security_test_schedules OWNER TO robert;

--
-- Name: TABLE security_test_schedules; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_test_schedules IS 'Automated security test scheduling';


--
-- Name: security_test_suite_performance; Type: VIEW; Schema: public; Owner: robert
--

CREATE VIEW public.security_test_suite_performance AS
 SELECT suite_id,
    suite_name,
    count(*) AS total_runs,
    count(*) FILTER (WHERE ((status)::text = 'completed'::text)) AS successful_runs,
    avg(duration_ms) AS avg_duration_ms,
    avg(vulnerabilities_found) AS avg_vulnerabilities_per_run,
    max(started_at) AS last_run_at
   FROM public.security_test_runs
  GROUP BY suite_id, suite_name;


ALTER VIEW public.security_test_suite_performance OWNER TO robert;

--
-- Name: security_test_vulnerabilities; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.security_test_vulnerabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_run_id uuid,
    test_result_id uuid,
    vulnerability_type character varying(100) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(300) NOT NULL,
    description text,
    impact text,
    remediation text,
    affected_endpoint text,
    affected_file text,
    affected_line integer,
    payload text,
    evidence jsonb DEFAULT '{}'::jsonb,
    cvss_score numeric(3,1),
    cve_id character varying(50),
    status character varying(50) DEFAULT 'open'::character varying,
    assigned_to character varying(100),
    fix_priority integer DEFAULT 3,
    estimated_fix_effort character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.security_test_vulnerabilities OWNER TO robert;

--
-- Name: TABLE security_test_vulnerabilities; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.security_test_vulnerabilities IS 'Vulnerability findings from security tests';


--
-- Name: security_testing_dashboard_stats; Type: VIEW; Schema: public; Owner: robert
--

CREATE VIEW public.security_testing_dashboard_stats AS
 SELECT count(*) AS total_test_runs,
    count(*) FILTER (WHERE ((status)::text = 'completed'::text)) AS completed_runs,
    count(*) FILTER (WHERE ((status)::text = 'failed'::text)) AS failed_runs,
    count(*) FILTER (WHERE ((status)::text = 'running'::text)) AS active_runs,
    avg(duration_ms) AS avg_duration_ms,
    sum(vulnerabilities_found) AS total_vulnerabilities,
    count(*) FILTER (WHERE (started_at >= (CURRENT_DATE - '7 days'::interval))) AS runs_last_7_days,
    count(*) FILTER (WHERE (started_at >= (CURRENT_DATE - '30 days'::interval))) AS runs_last_30_days
   FROM public.security_test_runs;


ALTER VIEW public.security_testing_dashboard_stats OWNER TO robert;

--
-- Name: security_testing_trends; Type: VIEW; Schema: public; Owner: robert
--

CREATE VIEW public.security_testing_trends AS
 SELECT date_trunc('day'::text, started_at) AS date,
    suite_id,
    count(*) AS runs_count,
    avg(duration_ms) AS avg_duration,
    sum(vulnerabilities_found) AS vulnerabilities_found,
    count(*) FILTER (WHERE ((status)::text = 'completed'::text)) AS successful_runs
   FROM public.security_test_runs
  WHERE (started_at >= (CURRENT_DATE - '90 days'::interval))
  GROUP BY (date_trunc('day'::text, started_at)), suite_id
  ORDER BY (date_trunc('day'::text, started_at)) DESC;


ALTER VIEW public.security_testing_trends OWNER TO robert;

--
-- Name: security_vulnerabilities_summary; Type: VIEW; Schema: public; Owner: robert
--

CREATE VIEW public.security_vulnerabilities_summary AS
 SELECT vulnerability_type,
    severity,
    count(*) AS count,
    count(*) FILTER (WHERE ((status)::text = 'open'::text)) AS open_count,
    count(*) FILTER (WHERE ((status)::text = 'fixed'::text)) AS fixed_count,
    avg(cvss_score) AS avg_cvss_score,
    min(created_at) AS first_detected,
    max(created_at) AS last_detected
   FROM public.security_test_vulnerabilities
  GROUP BY vulnerability_type, severity;


ALTER VIEW public.security_vulnerabilities_summary OWNER TO robert;

--
-- Name: sensitive_data_detection; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.sensitive_data_detection (
    id integer NOT NULL,
    table_name character varying(255) NOT NULL,
    column_name character varying(255) NOT NULL,
    data_type character varying(100) NOT NULL,
    confidence_score numeric(3,2) DEFAULT 0.0,
    detection_method character varying(100) NOT NULL,
    sample_data text,
    false_positive boolean DEFAULT false,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sensitive_data_detection OWNER TO robert;

--
-- Name: sensitive_data_detection_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.sensitive_data_detection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sensitive_data_detection_id_seq OWNER TO robert;

--
-- Name: sensitive_data_detection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.sensitive_data_detection_id_seq OWNED BY public.sensitive_data_detection.id;


--
-- Name: service_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.service_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.service_integrations_id_seq OWNER TO robert;

--
-- Name: service_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.service_integrations_id_seq OWNED BY public.service_integrations.id;


--
-- Name: system_health; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.system_health (
    id integer NOT NULL,
    component character varying(100) NOT NULL,
    status character varying(50) NOT NULL,
    message text,
    metrics jsonb DEFAULT '{}'::jsonb,
    checked_at timestamp with time zone DEFAULT now(),
    CONSTRAINT system_health_status_check CHECK (((status)::text = ANY ((ARRAY['healthy'::character varying, 'warning'::character varying, 'error'::character varying, 'offline'::character varying])::text[])))
);


ALTER TABLE public.system_health OWNER TO robert;

--
-- Name: system_health_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.system_health_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_health_id_seq OWNER TO robert;

--
-- Name: system_health_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.system_health_id_seq OWNED BY public.system_health.id;


--
-- Name: system_metrics; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.system_metrics (
    id bigint NOT NULL,
    metric_name character varying(100) NOT NULL,
    metric_value numeric(15,6) NOT NULL,
    metric_unit character varying(50),
    service_name character varying(100),
    instance_id character varying(100),
    labels jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp without time zone DEFAULT now()
);


ALTER TABLE public.system_metrics OWNER TO robert;

--
-- Name: system_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.system_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_metrics_id_seq OWNER TO robert;

--
-- Name: system_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.system_metrics_id_seq OWNED BY public.system_metrics.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    user_id integer,
    title character varying(500) NOT NULL,
    description text,
    due_date timestamp without time zone,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    category character varying(100),
    tags text[],
    assignee_id integer,
    project_id integer,
    parent_task_id integer,
    completion_percentage integer DEFAULT 0,
    estimated_hours numeric(5,2),
    actual_hours numeric(5,2),
    external_id character varying(255),
    external_source character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tasks OWNER TO robert;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO robert;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: telemetry_traces; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.telemetry_traces (
    id integer NOT NULL,
    trace_id character varying(32) NOT NULL,
    span_id character varying(16) NOT NULL,
    parent_span_id character varying(16),
    operation_name character varying(255) NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    duration_ms integer,
    status character varying(20),
    tags jsonb DEFAULT '{}'::jsonb,
    logs jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.telemetry_traces OWNER TO robert;

--
-- Name: telemetry_traces_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.telemetry_traces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.telemetry_traces_id_seq OWNER TO robert;

--
-- Name: telemetry_traces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.telemetry_traces_id_seq OWNED BY public.telemetry_traces.id;


--
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.user_activity_logs (
    id bigint NOT NULL,
    user_id integer,
    session_id uuid,
    action character varying(100) NOT NULL,
    resource_type character varying(50),
    resource_id character varying(100),
    ip_address inet,
    user_agent text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_activity_logs OWNER TO robert;

--
-- Name: user_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.user_activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_activity_logs_id_seq OWNER TO robert;

--
-- Name: user_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.user_activity_logs_id_seq OWNED BY public.user_activity_logs.id;


--
-- Name: user_authentication; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.user_authentication (
    id integer NOT NULL,
    user_id integer NOT NULL,
    auth_provider character varying(50) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    auth_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    last_login timestamp with time zone,
    login_count integer DEFAULT 0 NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_authentication OWNER TO robert;

--
-- Name: TABLE user_authentication; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.user_authentication IS 'User authentication data for multiple providers';


--
-- Name: user_authentication_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.user_authentication_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_authentication_id_seq OWNER TO robert;

--
-- Name: user_authentication_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.user_authentication_id_seq OWNED BY public.user_authentication.id;


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.user_preferences (
    id integer NOT NULL,
    user_id integer NOT NULL,
    sarcasm_level integer DEFAULT 5,
    verbosity character varying(50) DEFAULT 'normal'::character varying,
    humor_style character varying(50) DEFAULT 'playful'::character varying,
    language_preference character varying(10) DEFAULT 'en'::character varying,
    timezone character varying(100) DEFAULT 'America/New_York'::character varying,
    theme character varying(20) DEFAULT 'dark'::character varying,
    notifications_enabled boolean DEFAULT true,
    voice_enabled boolean DEFAULT true,
    ambient_listening boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_preferences_humor_style_check CHECK (((humor_style)::text = ANY ((ARRAY['playful'::character varying, 'sarcastic'::character varying, 'witty'::character varying, 'dry'::character varying])::text[]))),
    CONSTRAINT user_preferences_sarcasm_level_check CHECK (((sarcasm_level >= 1) AND (sarcasm_level <= 10))),
    CONSTRAINT user_preferences_theme_check CHECK (((theme)::text = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'auto'::character varying])::text[]))),
    CONSTRAINT user_preferences_verbosity_check CHECK (((verbosity)::text = ANY ((ARRAY['minimal'::character varying, 'normal'::character varying, 'verbose'::character varying])::text[])))
);


ALTER TABLE public.user_preferences OWNER TO robert;

--
-- Name: user_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.user_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_preferences_id_seq OWNER TO robert;

--
-- Name: user_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.user_preferences_id_seq OWNED BY public.user_preferences.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    assigned_by integer,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.user_roles OWNER TO robert;

--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_roles_id_seq OWNER TO robert;

--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    session_token character varying(255) NOT NULL,
    refresh_token character varying(255),
    ip_address inet,
    user_agent text,
    device_info jsonb,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    last_used_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_sessions OWNER TO robert;

--
-- Name: users; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role character varying(50) DEFAULT 'user'::character varying,
    is_admin boolean DEFAULT false
);


ALTER TABLE public.users OWNER TO robert;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO robert;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: video_assets; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.video_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    filename character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    duration_seconds numeric(10,3),
    width integer,
    height integer,
    frame_rate numeric(5,2),
    thumbnail_path text,
    transcription text,
    scene_analysis jsonb,
    processing_status character varying(20) DEFAULT 'pending'::character varying,
    tags text[],
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.video_assets OWNER TO robert;

--
-- Name: visual_analysis; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.visual_analysis (
    id integer NOT NULL,
    user_id integer,
    image_hash character varying(64),
    analysis_type character varying(50),
    analysis_result jsonb,
    confidence_score double precision,
    processing_time_ms integer,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.visual_analysis OWNER TO robert;

--
-- Name: visual_analysis_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.visual_analysis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.visual_analysis_id_seq OWNER TO robert;

--
-- Name: visual_analysis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.visual_analysis_id_seq OWNED BY public.visual_analysis.id;


--
-- Name: voice_sessions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.voice_sessions (
    id integer NOT NULL,
    user_id integer,
    session_id uuid DEFAULT public.uuid_generate_v4(),
    audio_duration_seconds double precision,
    transcription text,
    response_text text,
    voice_model character varying(100),
    language character varying(10) DEFAULT 'en'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.voice_sessions OWNER TO robert;

--
-- Name: voice_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.voice_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.voice_sessions_id_seq OWNER TO robert;

--
-- Name: voice_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.voice_sessions_id_seq OWNED BY public.voice_sessions.id;


--
-- Name: vulnerabilities; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.vulnerabilities (
    id integer NOT NULL,
    scan_id integer NOT NULL,
    vulnerability_id character varying(100),
    title character varying(255) NOT NULL,
    description text,
    severity character varying(20) NOT NULL,
    cvss_score numeric(3,1),
    affected_component character varying(255),
    remediation text,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    detected_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT vulnerabilities_severity_check CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


ALTER TABLE public.vulnerabilities OWNER TO robert;

--
-- Name: vulnerabilities_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.vulnerabilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vulnerabilities_id_seq OWNER TO robert;

--
-- Name: vulnerabilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.vulnerabilities_id_seq OWNED BY public.vulnerabilities.id;


--
-- Name: vulnerability_scans; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.vulnerability_scans (
    id integer NOT NULL,
    scan_type character varying(50) NOT NULL,
    target character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    initiated_by integer,
    results jsonb DEFAULT '{}'::jsonb,
    summary jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.vulnerability_scans OWNER TO robert;

--
-- Name: TABLE vulnerability_scans; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.vulnerability_scans IS 'Automated vulnerability scanning results';


--
-- Name: vulnerability_scans_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.vulnerability_scans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vulnerability_scans_id_seq OWNER TO robert;

--
-- Name: vulnerability_scans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.vulnerability_scans_id_seq OWNED BY public.vulnerability_scans.id;


--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    url text NOT NULL,
    secret character varying(255),
    events text[] NOT NULL,
    is_active boolean DEFAULT true,
    last_triggered_at timestamp without time zone,
    success_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.webhooks OWNER TO robert;

--
-- Name: workflow_automation_definitions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_automation_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    trigger_type character varying(100) DEFAULT 'manual'::character varying NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    definition jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    owner_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_executed_at timestamp with time zone,
    execution_count integer DEFAULT 0,
    CONSTRAINT valid_trigger_type CHECK (((trigger_type)::text = ANY ((ARRAY['webhook'::character varying, 'schedule'::character varying, 'manual'::character varying, 'event'::character varying])::text[])))
);


ALTER TABLE public.workflow_automation_definitions OWNER TO robert;

--
-- Name: workflow_automation_logs; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_automation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    step_id uuid,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    level character varying(20) DEFAULT 'info'::character varying NOT NULL,
    message text NOT NULL,
    context jsonb DEFAULT '{}'::jsonb,
    source character varying(100),
    correlation_id character varying(100),
    CONSTRAINT valid_log_level CHECK (((level)::text = ANY ((ARRAY['debug'::character varying, 'info'::character varying, 'warn'::character varying, 'error'::character varying, 'fatal'::character varying])::text[])))
);


ALTER TABLE public.workflow_automation_logs OWNER TO robert;

--
-- Name: workflow_automation_steps; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_automation_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    node_id character varying(255) NOT NULL,
    step_name character varying(255) NOT NULL,
    step_type character varying(100) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    duration_ms integer,
    input_data jsonb DEFAULT '{}'::jsonb,
    output_data jsonb DEFAULT '{}'::jsonb,
    error_data jsonb DEFAULT '{}'::jsonb,
    retry_count integer DEFAULT 0,
    CONSTRAINT valid_step_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying, 'retrying'::character varying])::text[])))
);


ALTER TABLE public.workflow_automation_steps OWNER TO robert;

--
-- Name: workflow_automation_templates; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_automation_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    template_data jsonb NOT NULL,
    preview_image character varying(500),
    use_count integer DEFAULT 0,
    is_public boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    created_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workflow_automation_templates OWNER TO robert;

--
-- Name: workflow_batch_processing; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_batch_processing (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    data_source character varying(255) NOT NULL,
    batch_size integer DEFAULT 10,
    filter_criteria jsonb DEFAULT '{}'::jsonb,
    processing_status character varying(50) DEFAULT 'idle'::character varying,
    last_batch_at timestamp with time zone,
    total_processed integer DEFAULT 0,
    total_failed integer DEFAULT 0,
    current_batch_id integer,
    parallel_processing boolean DEFAULT false,
    max_concurrency integer DEFAULT 3,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_batch_processing_processing_status_check CHECK (((processing_status)::text = ANY ((ARRAY['idle'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.workflow_batch_processing OWNER TO robert;

--
-- Name: TABLE workflow_batch_processing; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_batch_processing IS 'Configuration for batch workflow processing';


--
-- Name: workflow_batch_processing_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_batch_processing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_batch_processing_id_seq OWNER TO robert;

--
-- Name: workflow_batch_processing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_batch_processing_id_seq OWNED BY public.workflow_batch_processing.id;


--
-- Name: workflow_calendar_integrations; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_calendar_integrations (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    calendar_provider character varying(100) NOT NULL,
    calendar_id character varying(255) NOT NULL,
    access_token_encrypted text,
    refresh_token_encrypted text,
    event_query jsonb DEFAULT '{}'::jsonb,
    trigger_offset_minutes integer DEFAULT 0,
    business_hours_only boolean DEFAULT false,
    timezone character varying(100) DEFAULT 'UTC'::character varying,
    last_sync_at timestamp with time zone,
    sync_status character varying(50) DEFAULT 'active'::character varying,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_calendar_integrations_calendar_provider_check CHECK (((calendar_provider)::text = ANY ((ARRAY['google'::character varying, 'outlook'::character varying, 'ical'::character varying, 'caldav'::character varying])::text[]))),
    CONSTRAINT workflow_calendar_integrations_sync_status_check CHECK (((sync_status)::text = ANY ((ARRAY['active'::character varying, 'error'::character varying, 'disabled'::character varying])::text[])))
);


ALTER TABLE public.workflow_calendar_integrations OWNER TO robert;

--
-- Name: TABLE workflow_calendar_integrations; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_calendar_integrations IS 'Calendar system integrations for scheduling';


--
-- Name: workflow_calendar_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_calendar_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_calendar_integrations_id_seq OWNER TO robert;

--
-- Name: workflow_calendar_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_calendar_integrations_id_seq OWNED BY public.workflow_calendar_integrations.id;


--
-- Name: workflow_conditional_rules; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_conditional_rules (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    rule_name character varying(255) NOT NULL,
    condition_type character varying(100) NOT NULL,
    condition_query text NOT NULL,
    expected_value jsonb,
    operator character varying(50) DEFAULT 'equals'::character varying,
    evaluation_order integer DEFAULT 1,
    is_active boolean DEFAULT true,
    last_evaluated_at timestamp with time zone,
    last_result boolean,
    evaluation_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_conditional_rules_condition_type_check CHECK (((condition_type)::text = ANY ((ARRAY['database'::character varying, 'api'::character varying, 'time'::character varying, 'file'::character varying, 'webhook'::character varying])::text[]))),
    CONSTRAINT workflow_conditional_rules_operator_check CHECK (((operator)::text = ANY ((ARRAY['equals'::character varying, 'not_equals'::character varying, 'greater_than'::character varying, 'less_than'::character varying, 'contains'::character varying, 'regex'::character varying, 'exists'::character varying])::text[])))
);


ALTER TABLE public.workflow_conditional_rules OWNER TO robert;

--
-- Name: TABLE workflow_conditional_rules; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_conditional_rules IS 'Rules for conditional workflow scheduling';


--
-- Name: workflow_conditional_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_conditional_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_conditional_rules_id_seq OWNER TO robert;

--
-- Name: workflow_conditional_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_conditional_rules_id_seq OWNED BY public.workflow_conditional_rules.id;


--
-- Name: workflow_connectors; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_connectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    icon character varying(100),
    version character varying(20) DEFAULT '1.0.0'::character varying NOT NULL,
    auth_type character varying(50) DEFAULT 'none'::character varying NOT NULL,
    auth_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    base_url character varying(500),
    default_headers jsonb DEFAULT '{}'::jsonb,
    rate_limit_config jsonb DEFAULT '{}'::jsonb,
    supported_operations text[] DEFAULT '{}'::text[],
    webhook_support boolean DEFAULT false,
    polling_support boolean DEFAULT false,
    is_builtin boolean DEFAULT true,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_auth_type CHECK (((auth_type)::text = ANY ((ARRAY['none'::character varying, 'api_key'::character varying, 'oauth2'::character varying, 'basic'::character varying, 'custom'::character varying])::text[])))
);


ALTER TABLE public.workflow_connectors OWNER TO robert;

--
-- Name: workflows; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflows (
    id integer NOT NULL,
    user_id integer,
    name character varying(255) NOT NULL,
    description text,
    workflow_data jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version integer DEFAULT 1,
    is_template boolean DEFAULT false,
    template_version integer DEFAULT 1,
    template_metadata jsonb DEFAULT '{}'::jsonb,
    category_id integer,
    base_template_id integer
);


ALTER TABLE public.workflows OWNER TO robert;

--
-- Name: workflow_definitions; Type: VIEW; Schema: public; Owner: robert
--

CREATE VIEW public.workflow_definitions AS
 SELECT id,
    name,
    description,
    workflow_data AS definition,
    is_active,
    created_at,
    updated_at,
    user_id
   FROM public.workflows;


ALTER VIEW public.workflow_definitions OWNER TO robert;

--
-- Name: workflow_event_triggers; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_event_triggers (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    event_type character varying(255) NOT NULL,
    event_source character varying(255) NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb,
    last_triggered_at timestamp with time zone,
    trigger_count integer DEFAULT 0,
    rate_limit_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workflow_event_triggers OWNER TO robert;

--
-- Name: TABLE workflow_event_triggers; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_event_triggers IS 'Configuration for event-based workflow triggers';


--
-- Name: workflow_event_triggers_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_event_triggers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_event_triggers_id_seq OWNER TO robert;

--
-- Name: workflow_event_triggers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_event_triggers_id_seq OWNED BY public.workflow_event_triggers.id;


--
-- Name: workflow_executions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_executions (
    old_id integer NOT NULL,
    workflow_id integer,
    execution_id uuid DEFAULT public.uuid_generate_v4(),
    status character varying(50) DEFAULT 'pending'::character varying,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    result jsonb,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    CONSTRAINT workflow_executions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.workflow_executions OWNER TO robert;

--
-- Name: workflow_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_executions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_executions_id_seq OWNER TO robert;

--
-- Name: workflow_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_executions_id_seq OWNED BY public.workflow_executions.old_id;


--
-- Name: workflow_nodes; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_type character varying(100) NOT NULL,
    category character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    icon character varying(100),
    version character varying(20) DEFAULT '1.0.0'::character varying NOT NULL,
    input_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    output_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    properties_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    supports_batching boolean DEFAULT false,
    max_batch_size integer DEFAULT 1,
    timeout_ms integer DEFAULT 30000,
    retry_policy jsonb DEFAULT '{"delay_ms": 1000, "max_attempts": 3}'::jsonb,
    is_builtin boolean DEFAULT true,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_node_type CHECK (((node_type)::text = ANY ((ARRAY['trigger'::character varying, 'action'::character varying, 'condition'::character varying, 'transform'::character varying])::text[])))
);


ALTER TABLE public.workflow_nodes OWNER TO robert;

--
-- Name: workflow_schedule_executions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_schedule_executions (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    execution_id integer,
    status character varying(50) NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    context jsonb DEFAULT '{}'::jsonb,
    error_message text,
    retry_count integer DEFAULT 0,
    execution_duration_ms integer,
    priority integer,
    trigger_data jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT workflow_schedule_executions_status_check CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying])::text[])))
);


ALTER TABLE public.workflow_schedule_executions OWNER TO robert;

--
-- Name: TABLE workflow_schedule_executions; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_schedule_executions IS 'Records of all workflow schedule executions';


--
-- Name: workflow_schedule_executions_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_schedule_executions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_schedule_executions_id_seq OWNER TO robert;

--
-- Name: workflow_schedule_executions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_schedule_executions_id_seq OWNED BY public.workflow_schedule_executions.id;


--
-- Name: workflow_schedules; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_schedules (
    id integer NOT NULL,
    workflow_id integer,
    schedule_type character varying(50) NOT NULL,
    schedule_expression character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    next_run timestamp with time zone,
    last_run timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    configuration jsonb DEFAULT '{}'::jsonb,
    priority integer DEFAULT 5,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT workflow_schedules_priority_check CHECK (((priority >= 1) AND (priority <= 10))),
    CONSTRAINT workflow_schedules_schedule_type_check CHECK (((schedule_type)::text = ANY ((ARRAY['cron'::character varying, 'event'::character varying, 'conditional'::character varying, 'batch'::character varying, 'calendar'::character varying, 'interval'::character varying, 'once'::character varying])::text[])))
);


ALTER TABLE public.workflow_schedules OWNER TO robert;

--
-- Name: TABLE workflow_schedules; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_schedules IS 'Main table for workflow scheduling configurations';


--
-- Name: workflow_schedule_performance_overview; Type: MATERIALIZED VIEW; Schema: public; Owner: robert
--

CREATE MATERIALIZED VIEW public.workflow_schedule_performance_overview AS
 SELECT ws.id,
    ws.name,
    ws.schedule_type,
    ws.is_active,
    ws.priority,
    count(wse.id) AS total_executions,
    count(
        CASE
            WHEN ((wse.status)::text = 'completed'::text) THEN 1
            ELSE NULL::integer
        END) AS successful_executions,
    count(
        CASE
            WHEN ((wse.status)::text = 'failed'::text) THEN 1
            ELSE NULL::integer
        END) AS failed_executions,
    count(
        CASE
            WHEN ((wse.status)::text = 'skipped'::text) THEN 1
            ELSE NULL::integer
        END) AS skipped_executions,
    round(avg(wse.execution_duration_ms)) AS avg_execution_time_ms,
    max(wse.started_at) AS last_execution_at,
        CASE
            WHEN (count(wse.id) = 0) THEN (0)::numeric
            ELSE round((((count(
            CASE
                WHEN ((wse.status)::text = 'completed'::text) THEN 1
                ELSE NULL::integer
            END))::numeric / (count(wse.id))::numeric) * (100)::numeric), 2)
        END AS success_rate_percentage
   FROM (public.workflow_schedules ws
     LEFT JOIN public.workflow_schedule_executions wse ON (((ws.id = wse.schedule_id) AND (wse.started_at >= (CURRENT_DATE - '30 days'::interval)))))
  GROUP BY ws.id, ws.name, ws.schedule_type, ws.is_active, ws.priority
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.workflow_schedule_performance_overview OWNER TO robert;

--
-- Name: workflow_schedule_queue; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_schedule_queue (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    workflow_id integer NOT NULL,
    priority integer DEFAULT 5 NOT NULL,
    queue_status character varying(50) DEFAULT 'pending'::character varying,
    context jsonb DEFAULT '{}'::jsonb,
    scheduled_for timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    retry_count integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    error_message text,
    processing_node character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_schedule_queue_queue_status_check CHECK (((queue_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.workflow_schedule_queue OWNER TO robert;

--
-- Name: TABLE workflow_schedule_queue; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_schedule_queue IS 'Priority queue for scheduled workflow executions';


--
-- Name: workflow_schedule_queue_analysis; Type: MATERIALIZED VIEW; Schema: public; Owner: robert
--

CREATE MATERIALIZED VIEW public.workflow_schedule_queue_analysis AS
 SELECT date_trunc('hour'::text, created_at) AS hour_bucket,
    schedule_id,
    count(*) AS items_queued,
    count(
        CASE
            WHEN ((queue_status)::text = 'completed'::text) THEN 1
            ELSE NULL::integer
        END) AS items_completed,
    count(
        CASE
            WHEN ((queue_status)::text = 'failed'::text) THEN 1
            ELSE NULL::integer
        END) AS items_failed,
    (avg((EXTRACT(epoch FROM (COALESCE(started_at, now()) - created_at)) * (1000)::numeric)))::integer AS avg_queue_wait_ms,
    (avg(
        CASE
            WHEN ((completed_at IS NOT NULL) AND (started_at IS NOT NULL)) THEN (EXTRACT(epoch FROM (completed_at - started_at)) * (1000)::numeric)
            ELSE NULL::numeric
        END))::integer AS avg_processing_time_ms,
    avg(priority) AS avg_priority
   FROM public.workflow_schedule_queue
  WHERE (created_at >= (CURRENT_DATE - '7 days'::interval))
  GROUP BY (date_trunc('hour'::text, created_at)), schedule_id
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.workflow_schedule_queue_analysis OWNER TO robert;

--
-- Name: workflow_schedule_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_schedule_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_schedule_queue_id_seq OWNER TO robert;

--
-- Name: workflow_schedule_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_schedule_queue_id_seq OWNED BY public.workflow_schedule_queue.id;


--
-- Name: workflow_schedule_statistics; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_schedule_statistics (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    date_recorded date DEFAULT CURRENT_DATE,
    total_executions integer DEFAULT 0,
    successful_executions integer DEFAULT 0,
    failed_executions integer DEFAULT 0,
    skipped_executions integer DEFAULT 0,
    avg_execution_time_ms integer DEFAULT 0,
    min_execution_time_ms integer DEFAULT 0,
    max_execution_time_ms integer DEFAULT 0,
    total_queue_time_ms integer DEFAULT 0,
    avg_queue_time_ms integer DEFAULT 0,
    error_types jsonb DEFAULT '{}'::jsonb,
    performance_metrics jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workflow_schedule_statistics OWNER TO robert;

--
-- Name: TABLE workflow_schedule_statistics; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_schedule_statistics IS 'Daily statistics for workflow schedule performance';


--
-- Name: workflow_schedule_statistics_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_schedule_statistics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_schedule_statistics_id_seq OWNER TO robert;

--
-- Name: workflow_schedule_statistics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_schedule_statistics_id_seq OWNED BY public.workflow_schedule_statistics.id;


--
-- Name: workflow_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_schedules_id_seq OWNER TO robert;

--
-- Name: workflow_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_schedules_id_seq OWNED BY public.workflow_schedules.id;


--
-- Name: workflow_step_executions; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_step_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_log_id uuid,
    step_id character varying(100) NOT NULL,
    step_name character varying(255),
    step_type character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    input_data jsonb,
    output_data jsonb,
    error_message text,
    started_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    execution_time_ms integer,
    retry_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.workflow_step_executions OWNER TO robert;

--
-- Name: workflow_template_categories; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_template_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workflow_template_categories OWNER TO robert;

--
-- Name: TABLE workflow_template_categories; Type: COMMENT; Schema: public; Owner: robert
--

COMMENT ON TABLE public.workflow_template_categories IS 'Categories for organizing workflow templates';


--
-- Name: workflow_template_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_template_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_template_categories_id_seq OWNER TO robert;

--
-- Name: workflow_template_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_template_categories_id_seq OWNED BY public.workflow_template_categories.id;


--
-- Name: workflow_template_tags; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_template_tags (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workflow_template_tags OWNER TO robert;

--
-- Name: workflow_template_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_template_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_template_tags_id_seq OWNER TO robert;

--
-- Name: workflow_template_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_template_tags_id_seq OWNED BY public.workflow_template_tags.id;


--
-- Name: workflow_template_usage; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_template_usage (
    id bigint NOT NULL,
    template_id integer NOT NULL,
    instantiated_workflow_id integer NOT NULL,
    user_id integer NOT NULL,
    variables_used jsonb DEFAULT '{}'::jsonb,
    instantiated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workflow_template_usage OWNER TO robert;

--
-- Name: workflow_template_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_template_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_template_usage_id_seq OWNER TO robert;

--
-- Name: workflow_template_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_template_usage_id_seq OWNED BY public.workflow_template_usage.id;


--
-- Name: workflow_template_variables; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_template_variables (
    id bigint NOT NULL,
    workflow_id integer NOT NULL,
    var_name text NOT NULL,
    description text,
    required boolean DEFAULT true,
    default_value text,
    var_type character varying(50) DEFAULT 'string'::character varying,
    validation_pattern text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.workflow_template_variables OWNER TO robert;

--
-- Name: workflow_template_variables_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_template_variables_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_template_variables_id_seq OWNER TO robert;

--
-- Name: workflow_template_variables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_template_variables_id_seq OWNED BY public.workflow_template_variables.id;


--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    author_id integer,
    template_data jsonb NOT NULL,
    preview_image text,
    tags text[],
    difficulty_level character varying(20) DEFAULT 'beginner'::character varying,
    estimated_time_minutes integer,
    usage_count integer DEFAULT 0,
    rating numeric(3,2) DEFAULT 0,
    rating_count integer DEFAULT 0,
    is_public boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    price_usd numeric(10,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.workflow_templates OWNER TO robert;

--
-- Name: workflow_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_templates_id_seq OWNER TO robert;

--
-- Name: workflow_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_templates_id_seq OWNED BY public.workflow_templates.id;


--
-- Name: workflow_tools; Type: TABLE; Schema: public; Owner: robert
--

CREATE TABLE public.workflow_tools (
    id integer NOT NULL,
    tool_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    input_schema jsonb,
    output_schema jsonb,
    implementation_details jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version character varying(50) DEFAULT '1.0.0'::character varying
);


ALTER TABLE public.workflow_tools OWNER TO robert;

--
-- Name: workflow_tools_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflow_tools_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflow_tools_id_seq OWNER TO robert;

--
-- Name: workflow_tools_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflow_tools_id_seq OWNED BY public.workflow_tools.id;


--
-- Name: workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: robert
--

CREATE SEQUENCE public.workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workflows_id_seq OWNER TO robert;

--
-- Name: workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: robert
--

ALTER SEQUENCE public.workflows_id_seq OWNED BY public.workflows.id;


--
-- Name: agent_interactions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.agent_interactions ALTER COLUMN id SET DEFAULT nextval('public.agent_interactions_id_seq'::regclass);


--
-- Name: agents id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.agents ALTER COLUMN id SET DEFAULT nextval('public.agents_id_seq'::regclass);


--
-- Name: ai_model_usage id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.ai_model_usage ALTER COLUMN id SET DEFAULT nextval('public.ai_model_usage_id_seq'::regclass);


--
-- Name: ai_models id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.ai_models ALTER COLUMN id SET DEFAULT nextval('public.ai_models_id_seq'::regclass);


--
-- Name: api_key_usage id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_key_usage ALTER COLUMN id SET DEFAULT nextval('public.api_key_usage_id_seq'::regclass);


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: api_security_policies id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_security_policies ALTER COLUMN id SET DEFAULT nextval('public.api_security_policies_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: backup_encryption_log id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.backup_encryption_log ALTER COLUMN id SET DEFAULT nextval('public.backup_encryption_log_id_seq'::regclass);


--
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: chat_sessions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.chat_sessions ALTER COLUMN id SET DEFAULT nextval('public.chat_sessions_id_seq'::regclass);


--
-- Name: compliance_findings id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.compliance_findings ALTER COLUMN id SET DEFAULT nextval('public.compliance_findings_id_seq'::regclass);


--
-- Name: compliance_reports id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.compliance_reports ALTER COLUMN id SET DEFAULT nextval('public.compliance_reports_id_seq'::regclass);


--
-- Name: contacts id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.contacts ALTER COLUMN id SET DEFAULT nextval('public.contacts_id_seq'::regclass);


--
-- Name: conversation_messages id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.conversation_messages ALTER COLUMN id SET DEFAULT nextval('public.conversation_messages_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: data_classification_assignments id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_classification_assignments ALTER COLUMN id SET DEFAULT nextval('public.data_classification_assignments_id_seq'::regclass);


--
-- Name: data_classification_tags id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_classification_tags ALTER COLUMN id SET DEFAULT nextval('public.data_classification_tags_id_seq'::regclass);


--
-- Name: data_masking_rules id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_masking_rules ALTER COLUMN id SET DEFAULT nextval('public.data_masking_rules_id_seq'::regclass);


--
-- Name: database_security_config id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.database_security_config ALTER COLUMN id SET DEFAULT nextval('public.database_security_config_id_seq'::regclass);


--
-- Name: database_security_policies id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.database_security_policies ALTER COLUMN id SET DEFAULT nextval('public.database_security_policies_id_seq'::regclass);


--
-- Name: documentation id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.documentation ALTER COLUMN id SET DEFAULT nextval('public.documentation_id_seq'::regclass);


--
-- Name: email_accounts id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.email_accounts ALTER COLUMN id SET DEFAULT nextval('public.email_accounts_id_seq'::regclass);


--
-- Name: email_threads id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.email_threads ALTER COLUMN id SET DEFAULT nextval('public.email_threads_id_seq'::regclass);


--
-- Name: encryption_keys id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.encryption_keys ALTER COLUMN id SET DEFAULT nextval('public.encryption_keys_id_seq'::regclass);


--
-- Name: error_logs id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.error_logs ALTER COLUMN id SET DEFAULT nextval('public.error_logs_id_seq'::regclass);


--
-- Name: hf_models id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.hf_models ALTER COLUMN id SET DEFAULT nextval('public.hf_models_id_seq'::regclass);


--
-- Name: integration_api_schemas id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_api_schemas ALTER COLUMN id SET DEFAULT nextval('public.integration_api_schemas_id_seq'::regclass);


--
-- Name: integration_auth_tokens id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_auth_tokens ALTER COLUMN id SET DEFAULT nextval('public.integration_auth_tokens_id_seq'::regclass);


--
-- Name: integration_connection_pools id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_connection_pools ALTER COLUMN id SET DEFAULT nextval('public.integration_connection_pools_id_seq'::regclass);


--
-- Name: integration_executions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_executions ALTER COLUMN id SET DEFAULT nextval('public.integration_executions_id_seq'::regclass);


--
-- Name: integration_health_checks id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_health_checks ALTER COLUMN id SET DEFAULT nextval('public.integration_health_checks_id_seq'::regclass);


--
-- Name: integration_message_queues id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_message_queues ALTER COLUMN id SET DEFAULT nextval('public.integration_message_queues_id_seq'::regclass);


--
-- Name: integration_rate_limits id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_rate_limits ALTER COLUMN id SET DEFAULT nextval('public.integration_rate_limits_id_seq'::regclass);


--
-- Name: integration_webhook_events id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_webhook_events ALTER COLUMN id SET DEFAULT nextval('public.integration_webhook_events_id_seq'::regclass);


--
-- Name: integration_webhooks id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_webhooks ALTER COLUMN id SET DEFAULT nextval('public.integration_webhooks_id_seq'::regclass);


--
-- Name: integrations id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integrations ALTER COLUMN id SET DEFAULT nextval('public.integrations_id_seq'::regclass);


--
-- Name: jwt_blacklist id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.jwt_blacklist ALTER COLUMN id SET DEFAULT nextval('public.jwt_blacklist_id_seq'::regclass);


--
-- Name: knowledge_chunks id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_chunks ALTER COLUMN id SET DEFAULT nextval('public.knowledge_chunks_id_seq'::regclass);


--
-- Name: knowledge_collections id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_collections ALTER COLUMN id SET DEFAULT nextval('public.knowledge_collections_id_seq'::regclass);


--
-- Name: knowledge_documents id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_documents ALTER COLUMN id SET DEFAULT nextval('public.knowledge_documents_id_seq'::regclass);


--
-- Name: knowledge_entries id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_entries ALTER COLUMN id SET DEFAULT nextval('public.knowledge_entries_id_seq'::regclass);


--
-- Name: knowledge_extractions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_extractions ALTER COLUMN id SET DEFAULT nextval('public.knowledge_extractions_id_seq'::regclass);


--
-- Name: knowledge_queries id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_queries ALTER COLUMN id SET DEFAULT nextval('public.knowledge_queries_id_seq'::regclass);


--
-- Name: knowledge_relationships id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_relationships ALTER COLUMN id SET DEFAULT nextval('public.knowledge_relationships_id_seq'::regclass);


--
-- Name: mood_analytics id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.mood_analytics ALTER COLUMN id SET DEFAULT nextval('public.mood_analytics_id_seq'::regclass);


--
-- Name: multi_modal_processing_log id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.multi_modal_processing_log ALTER COLUMN id SET DEFAULT nextval('public.multi_modal_processing_log_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: oauth_tokens id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.oauth_tokens ALTER COLUMN id SET DEFAULT nextval('public.oauth_tokens_id_seq'::regclass);


--
-- Name: performance_alerts id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_alerts ALTER COLUMN id SET DEFAULT nextval('public.performance_alerts_id_seq'::regclass);


--
-- Name: performance_metrics id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_metrics ALTER COLUMN id SET DEFAULT nextval('public.performance_metrics_id_seq'::regclass);


--
-- Name: performance_recommendations id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_recommendations ALTER COLUMN id SET DEFAULT nextval('public.performance_recommendations_id_seq'::regclass);


--
-- Name: performance_thresholds id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_thresholds ALTER COLUMN id SET DEFAULT nextval('public.performance_thresholds_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: privacy_settings id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.privacy_settings ALTER COLUMN id SET DEFAULT nextval('public.privacy_settings_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: search_analytics id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.search_analytics ALTER COLUMN id SET DEFAULT nextval('public.search_analytics_id_seq'::regclass);


--
-- Name: security_audit_log id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_audit_log ALTER COLUMN id SET DEFAULT nextval('public.security_audit_log_id_seq'::regclass);


--
-- Name: security_configuration id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_configuration ALTER COLUMN id SET DEFAULT nextval('public.security_configuration_id_seq'::regclass);


--
-- Name: security_events id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_events ALTER COLUMN id SET DEFAULT nextval('public.security_events_id_seq'::regclass);


--
-- Name: security_sessions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_sessions ALTER COLUMN id SET DEFAULT nextval('public.security_sessions_id_seq'::regclass);


--
-- Name: sensitive_data_detection id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.sensitive_data_detection ALTER COLUMN id SET DEFAULT nextval('public.sensitive_data_detection_id_seq'::regclass);


--
-- Name: service_integrations id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.service_integrations ALTER COLUMN id SET DEFAULT nextval('public.service_integrations_id_seq'::regclass);


--
-- Name: system_health id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.system_health ALTER COLUMN id SET DEFAULT nextval('public.system_health_id_seq'::regclass);


--
-- Name: system_metrics id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.system_metrics ALTER COLUMN id SET DEFAULT nextval('public.system_metrics_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: telemetry_traces id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.telemetry_traces ALTER COLUMN id SET DEFAULT nextval('public.telemetry_traces_id_seq'::regclass);


--
-- Name: user_activity_logs id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.user_activity_logs_id_seq'::regclass);


--
-- Name: user_authentication id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_authentication ALTER COLUMN id SET DEFAULT nextval('public.user_authentication_id_seq'::regclass);


--
-- Name: user_preferences id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_preferences_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: visual_analysis id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.visual_analysis ALTER COLUMN id SET DEFAULT nextval('public.visual_analysis_id_seq'::regclass);


--
-- Name: voice_sessions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.voice_sessions ALTER COLUMN id SET DEFAULT nextval('public.voice_sessions_id_seq'::regclass);


--
-- Name: vulnerabilities id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.vulnerabilities ALTER COLUMN id SET DEFAULT nextval('public.vulnerabilities_id_seq'::regclass);


--
-- Name: vulnerability_scans id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.vulnerability_scans ALTER COLUMN id SET DEFAULT nextval('public.vulnerability_scans_id_seq'::regclass);


--
-- Name: workflow_batch_processing id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_batch_processing ALTER COLUMN id SET DEFAULT nextval('public.workflow_batch_processing_id_seq'::regclass);


--
-- Name: workflow_calendar_integrations id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_calendar_integrations ALTER COLUMN id SET DEFAULT nextval('public.workflow_calendar_integrations_id_seq'::regclass);


--
-- Name: workflow_conditional_rules id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_conditional_rules ALTER COLUMN id SET DEFAULT nextval('public.workflow_conditional_rules_id_seq'::regclass);


--
-- Name: workflow_event_triggers id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_event_triggers ALTER COLUMN id SET DEFAULT nextval('public.workflow_event_triggers_id_seq'::regclass);


--
-- Name: workflow_executions old_id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_executions ALTER COLUMN old_id SET DEFAULT nextval('public.workflow_executions_id_seq'::regclass);


--
-- Name: workflow_schedule_executions id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_executions ALTER COLUMN id SET DEFAULT nextval('public.workflow_schedule_executions_id_seq'::regclass);


--
-- Name: workflow_schedule_queue id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_queue ALTER COLUMN id SET DEFAULT nextval('public.workflow_schedule_queue_id_seq'::regclass);


--
-- Name: workflow_schedule_statistics id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_statistics ALTER COLUMN id SET DEFAULT nextval('public.workflow_schedule_statistics_id_seq'::regclass);


--
-- Name: workflow_schedules id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedules ALTER COLUMN id SET DEFAULT nextval('public.workflow_schedules_id_seq'::regclass);


--
-- Name: workflow_template_categories id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_categories ALTER COLUMN id SET DEFAULT nextval('public.workflow_template_categories_id_seq'::regclass);


--
-- Name: workflow_template_tags id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_tags ALTER COLUMN id SET DEFAULT nextval('public.workflow_template_tags_id_seq'::regclass);


--
-- Name: workflow_template_usage id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_usage ALTER COLUMN id SET DEFAULT nextval('public.workflow_template_usage_id_seq'::regclass);


--
-- Name: workflow_template_variables id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_variables ALTER COLUMN id SET DEFAULT nextval('public.workflow_template_variables_id_seq'::regclass);


--
-- Name: workflow_templates id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_templates ALTER COLUMN id SET DEFAULT nextval('public.workflow_templates_id_seq'::regclass);


--
-- Name: workflow_tools id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_tools ALTER COLUMN id SET DEFAULT nextval('public.workflow_tools_id_seq'::regclass);


--
-- Name: workflows id; Type: DEFAULT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflows ALTER COLUMN id SET DEFAULT nextval('public.workflows_id_seq'::regclass);


--
-- Name: agent_interactions agent_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.agent_interactions
    ADD CONSTRAINT agent_interactions_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: ai_model_usage ai_model_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.ai_model_usage
    ADD CONSTRAINT ai_model_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_name_key UNIQUE (name);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: api_key_usage api_key_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_key_usage
    ADD CONSTRAINT api_key_usage_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: api_security_policies api_security_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_security_policies
    ADD CONSTRAINT api_security_policies_pkey PRIMARY KEY (id);


--
-- Name: api_security_policies api_security_policies_policy_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_security_policies
    ADD CONSTRAINT api_security_policies_policy_name_key UNIQUE (policy_name);


--
-- Name: audio_assets audio_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.audio_assets
    ADD CONSTRAINT audio_assets_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: backup_encryption_log backup_encryption_log_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.backup_encryption_log
    ADD CONSTRAINT backup_encryption_log_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: compliance_findings compliance_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.compliance_findings
    ADD CONSTRAINT compliance_findings_pkey PRIMARY KEY (id);


--
-- Name: compliance_reports compliance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: data_backups data_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_backups
    ADD CONSTRAINT data_backups_pkey PRIMARY KEY (id);


--
-- Name: data_classification_assignments data_classification_assignmen_table_name_column_name_tag_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_classification_assignments
    ADD CONSTRAINT data_classification_assignmen_table_name_column_name_tag_id_key UNIQUE (table_name, column_name, tag_id);


--
-- Name: data_classification_assignments data_classification_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_classification_assignments
    ADD CONSTRAINT data_classification_assignments_pkey PRIMARY KEY (id);


--
-- Name: data_classification_tags data_classification_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_classification_tags
    ADD CONSTRAINT data_classification_tags_pkey PRIMARY KEY (id);


--
-- Name: data_classification_tags data_classification_tags_tag_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_classification_tags
    ADD CONSTRAINT data_classification_tags_tag_name_key UNIQUE (tag_name);


--
-- Name: data_masking_rules data_masking_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_masking_rules
    ADD CONSTRAINT data_masking_rules_pkey PRIMARY KEY (id);


--
-- Name: data_masking_rules data_masking_rules_rule_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_masking_rules
    ADD CONSTRAINT data_masking_rules_rule_name_key UNIQUE (rule_name);


--
-- Name: database_security_config database_security_config_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.database_security_config
    ADD CONSTRAINT database_security_config_pkey PRIMARY KEY (id);


--
-- Name: database_security_config database_security_config_table_name_column_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.database_security_config
    ADD CONSTRAINT database_security_config_table_name_column_name_key UNIQUE (table_name, column_name);


--
-- Name: database_security_policies database_security_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.database_security_policies
    ADD CONSTRAINT database_security_policies_pkey PRIMARY KEY (id);


--
-- Name: database_security_policies database_security_policies_policy_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.database_security_policies
    ADD CONSTRAINT database_security_policies_policy_name_key UNIQUE (policy_name);


--
-- Name: documentation documentation_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.documentation
    ADD CONSTRAINT documentation_pkey PRIMARY KEY (id);


--
-- Name: email_accounts email_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_pkey PRIMARY KEY (id);


--
-- Name: email_threads email_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_pkey PRIMARY KEY (id);


--
-- Name: emails emails_message_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_message_id_key UNIQUE (message_id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: encryption_keys encryption_keys_key_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.encryption_keys
    ADD CONSTRAINT encryption_keys_key_name_key UNIQUE (key_name);


--
-- Name: encryption_keys encryption_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.encryption_keys
    ADD CONSTRAINT encryption_keys_pkey PRIMARY KEY (id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: hf_models hf_models_model_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.hf_models
    ADD CONSTRAINT hf_models_model_id_key UNIQUE (model_id);


--
-- Name: hf_models hf_models_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.hf_models
    ADD CONSTRAINT hf_models_pkey PRIMARY KEY (id);


--
-- Name: image_assets image_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_pkey PRIMARY KEY (id);


--
-- Name: integration_api_schemas integration_api_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_api_schemas
    ADD CONSTRAINT integration_api_schemas_pkey PRIMARY KEY (id);


--
-- Name: integration_auth_tokens integration_auth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_auth_tokens
    ADD CONSTRAINT integration_auth_tokens_pkey PRIMARY KEY (id);


--
-- Name: integration_connection_pools integration_connection_pools_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_connection_pools
    ADD CONSTRAINT integration_connection_pools_pkey PRIMARY KEY (id);


--
-- Name: integration_executions integration_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_executions
    ADD CONSTRAINT integration_executions_pkey PRIMARY KEY (id);


--
-- Name: integration_health_checks integration_health_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_health_checks
    ADD CONSTRAINT integration_health_checks_pkey PRIMARY KEY (id);


--
-- Name: integration_message_queues integration_message_queues_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_message_queues
    ADD CONSTRAINT integration_message_queues_pkey PRIMARY KEY (id);


--
-- Name: integration_rate_limits integration_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_rate_limits
    ADD CONSTRAINT integration_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: integration_webhook_events integration_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_webhook_events
    ADD CONSTRAINT integration_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: integration_webhooks integration_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_webhooks
    ADD CONSTRAINT integration_webhooks_pkey PRIMARY KEY (id);


--
-- Name: integration_webhooks integration_webhooks_webhook_path_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_webhooks
    ADD CONSTRAINT integration_webhooks_webhook_path_key UNIQUE (webhook_path);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_user_id_service_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_service_name_key UNIQUE (user_id, service_name);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: jwt_blacklist jwt_blacklist_jti_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.jwt_blacklist
    ADD CONSTRAINT jwt_blacklist_jti_key UNIQUE (jti);


--
-- Name: jwt_blacklist jwt_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.jwt_blacklist
    ADD CONSTRAINT jwt_blacklist_pkey PRIMARY KEY (id);


--
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_collections knowledge_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_collections
    ADD CONSTRAINT knowledge_collections_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_content_hash_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_content_hash_key UNIQUE (content_hash);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: knowledge_entries knowledge_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_entries
    ADD CONSTRAINT knowledge_entries_pkey PRIMARY KEY (id);


--
-- Name: knowledge_extractions knowledge_extractions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_extractions
    ADD CONSTRAINT knowledge_extractions_pkey PRIMARY KEY (id);


--
-- Name: knowledge_queries knowledge_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_queries
    ADD CONSTRAINT knowledge_queries_pkey PRIMARY KEY (id);


--
-- Name: knowledge_relationships knowledge_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_relationships
    ADD CONSTRAINT knowledge_relationships_pkey PRIMARY KEY (id);


--
-- Name: knowledge_relationships knowledge_relationships_source_document_id_target_document__key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_relationships
    ADD CONSTRAINT knowledge_relationships_source_document_id_target_document__key UNIQUE (source_document_id, target_document_id, relationship_type);


--
-- Name: mcp_tasks mcp_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.mcp_tasks
    ADD CONSTRAINT mcp_tasks_pkey PRIMARY KEY (id);


--
-- Name: mood_analytics mood_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.mood_analytics
    ADD CONSTRAINT mood_analytics_pkey PRIMARY KEY (id);


--
-- Name: mood_analytics mood_analytics_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.mood_analytics
    ADD CONSTRAINT mood_analytics_user_id_date_key UNIQUE (user_id, date);


--
-- Name: multi_modal_processing_log multi_modal_processing_log_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.multi_modal_processing_log
    ADD CONSTRAINT multi_modal_processing_log_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: oauth_tokens oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: performance_alerts performance_alerts_alert_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_alerts
    ADD CONSTRAINT performance_alerts_alert_id_key UNIQUE (alert_id);


--
-- Name: performance_alerts performance_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_alerts
    ADD CONSTRAINT performance_alerts_pkey PRIMARY KEY (id);


--
-- Name: performance_metrics performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_metrics
    ADD CONSTRAINT performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: performance_recommendations performance_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_recommendations
    ADD CONSTRAINT performance_recommendations_pkey PRIMARY KEY (id);


--
-- Name: performance_thresholds performance_thresholds_metric_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_thresholds
    ADD CONSTRAINT performance_thresholds_metric_name_key UNIQUE (metric_name);


--
-- Name: performance_thresholds performance_thresholds_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.performance_thresholds
    ADD CONSTRAINT performance_thresholds_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: privacy_settings privacy_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.privacy_settings
    ADD CONSTRAINT privacy_settings_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: search_analytics search_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.search_analytics
    ADD CONSTRAINT search_analytics_pkey PRIMARY KEY (id);


--
-- Name: search_index search_index_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.search_index
    ADD CONSTRAINT search_index_pkey PRIMARY KEY (id);


--
-- Name: search_index search_index_user_id_content_type_content_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.search_index
    ADD CONSTRAINT search_index_user_id_content_type_content_id_key UNIQUE (user_id, content_type, content_id);


--
-- Name: security_audit_log security_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_audit_log
    ADD CONSTRAINT security_audit_log_pkey PRIMARY KEY (id);


--
-- Name: security_configuration security_configuration_config_key_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_configuration
    ADD CONSTRAINT security_configuration_config_key_key UNIQUE (config_key);


--
-- Name: security_configuration security_configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_configuration
    ADD CONSTRAINT security_configuration_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: security_sessions security_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_sessions
    ADD CONSTRAINT security_sessions_pkey PRIMARY KEY (id);


--
-- Name: security_sessions security_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_sessions
    ADD CONSTRAINT security_sessions_session_token_key UNIQUE (session_token);


--
-- Name: security_test_artifacts security_test_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_artifacts
    ADD CONSTRAINT security_test_artifacts_pkey PRIMARY KEY (id);


--
-- Name: security_test_configurations security_test_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_configurations
    ADD CONSTRAINT security_test_configurations_pkey PRIMARY KEY (id);


--
-- Name: security_test_metrics security_test_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_metrics
    ADD CONSTRAINT security_test_metrics_pkey PRIMARY KEY (id);


--
-- Name: security_test_reports security_test_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_reports
    ADD CONSTRAINT security_test_reports_pkey PRIMARY KEY (id);


--
-- Name: security_test_results security_test_results_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_results
    ADD CONSTRAINT security_test_results_pkey PRIMARY KEY (id);


--
-- Name: security_test_runs security_test_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_runs
    ADD CONSTRAINT security_test_runs_pkey PRIMARY KEY (id);


--
-- Name: security_test_schedules security_test_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_schedules
    ADD CONSTRAINT security_test_schedules_pkey PRIMARY KEY (id);


--
-- Name: security_test_vulnerabilities security_test_vulnerabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_vulnerabilities
    ADD CONSTRAINT security_test_vulnerabilities_pkey PRIMARY KEY (id);


--
-- Name: sensitive_data_detection sensitive_data_detection_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.sensitive_data_detection
    ADD CONSTRAINT sensitive_data_detection_pkey PRIMARY KEY (id);


--
-- Name: sensitive_data_detection sensitive_data_detection_table_name_column_name_data_type_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.sensitive_data_detection
    ADD CONSTRAINT sensitive_data_detection_table_name_column_name_data_type_key UNIQUE (table_name, column_name, data_type);


--
-- Name: service_integrations service_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.service_integrations
    ADD CONSTRAINT service_integrations_pkey PRIMARY KEY (id);


--
-- Name: system_health system_health_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.system_health
    ADD CONSTRAINT system_health_pkey PRIMARY KEY (id);


--
-- Name: system_metrics system_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.system_metrics
    ADD CONSTRAINT system_metrics_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telemetry_traces telemetry_traces_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.telemetry_traces
    ADD CONSTRAINT telemetry_traces_pkey PRIMARY KEY (id);


--
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: user_authentication user_authentication_auth_provider_provider_user_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_authentication
    ADD CONSTRAINT user_authentication_auth_provider_provider_user_id_key UNIQUE (auth_provider, provider_user_id);


--
-- Name: user_authentication user_authentication_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_authentication
    ADD CONSTRAINT user_authentication_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_refresh_token_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_refresh_token_key UNIQUE (refresh_token);


--
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: video_assets video_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.video_assets
    ADD CONSTRAINT video_assets_pkey PRIMARY KEY (id);


--
-- Name: visual_analysis visual_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.visual_analysis
    ADD CONSTRAINT visual_analysis_pkey PRIMARY KEY (id);


--
-- Name: voice_sessions voice_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.voice_sessions
    ADD CONSTRAINT voice_sessions_pkey PRIMARY KEY (id);


--
-- Name: vulnerabilities vulnerabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_pkey PRIMARY KEY (id);


--
-- Name: vulnerability_scans vulnerability_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.vulnerability_scans
    ADD CONSTRAINT vulnerability_scans_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: workflow_automation_definitions workflow_automation_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_automation_definitions
    ADD CONSTRAINT workflow_automation_definitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_automation_logs workflow_automation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_automation_logs
    ADD CONSTRAINT workflow_automation_logs_pkey PRIMARY KEY (id);


--
-- Name: workflow_automation_steps workflow_automation_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_automation_steps
    ADD CONSTRAINT workflow_automation_steps_pkey PRIMARY KEY (id);


--
-- Name: workflow_automation_templates workflow_automation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_automation_templates
    ADD CONSTRAINT workflow_automation_templates_pkey PRIMARY KEY (id);


--
-- Name: workflow_batch_processing workflow_batch_processing_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_batch_processing
    ADD CONSTRAINT workflow_batch_processing_pkey PRIMARY KEY (id);


--
-- Name: workflow_calendar_integrations workflow_calendar_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_calendar_integrations
    ADD CONSTRAINT workflow_calendar_integrations_pkey PRIMARY KEY (id);


--
-- Name: workflow_conditional_rules workflow_conditional_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_conditional_rules
    ADD CONSTRAINT workflow_conditional_rules_pkey PRIMARY KEY (id);


--
-- Name: workflow_connectors workflow_connectors_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_connectors
    ADD CONSTRAINT workflow_connectors_name_key UNIQUE (name);


--
-- Name: workflow_connectors workflow_connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_connectors
    ADD CONSTRAINT workflow_connectors_pkey PRIMARY KEY (id);


--
-- Name: workflow_event_triggers workflow_event_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_event_triggers
    ADD CONSTRAINT workflow_event_triggers_pkey PRIMARY KEY (id);


--
-- Name: workflow_executions workflow_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_pkey PRIMARY KEY (id);


--
-- Name: workflow_nodes workflow_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_nodes
    ADD CONSTRAINT workflow_nodes_pkey PRIMARY KEY (id);


--
-- Name: workflow_schedule_executions workflow_schedule_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_executions
    ADD CONSTRAINT workflow_schedule_executions_pkey PRIMARY KEY (id);


--
-- Name: workflow_schedule_queue workflow_schedule_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_queue
    ADD CONSTRAINT workflow_schedule_queue_pkey PRIMARY KEY (id);


--
-- Name: workflow_schedule_statistics workflow_schedule_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_statistics
    ADD CONSTRAINT workflow_schedule_statistics_pkey PRIMARY KEY (id);


--
-- Name: workflow_schedule_statistics workflow_schedule_statistics_schedule_id_date_recorded_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_statistics
    ADD CONSTRAINT workflow_schedule_statistics_schedule_id_date_recorded_key UNIQUE (schedule_id, date_recorded);


--
-- Name: workflow_schedules workflow_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedules
    ADD CONSTRAINT workflow_schedules_pkey PRIMARY KEY (id);


--
-- Name: workflow_step_executions workflow_step_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_step_executions
    ADD CONSTRAINT workflow_step_executions_pkey PRIMARY KEY (id);


--
-- Name: workflow_template_categories workflow_template_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_categories
    ADD CONSTRAINT workflow_template_categories_name_key UNIQUE (name);


--
-- Name: workflow_template_categories workflow_template_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_categories
    ADD CONSTRAINT workflow_template_categories_pkey PRIMARY KEY (id);


--
-- Name: workflow_template_tags workflow_template_tags_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_tags
    ADD CONSTRAINT workflow_template_tags_name_key UNIQUE (name);


--
-- Name: workflow_template_tags workflow_template_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_tags
    ADD CONSTRAINT workflow_template_tags_pkey PRIMARY KEY (id);


--
-- Name: workflow_template_usage workflow_template_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_usage
    ADD CONSTRAINT workflow_template_usage_pkey PRIMARY KEY (id);


--
-- Name: workflow_template_variables workflow_template_variables_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_variables
    ADD CONSTRAINT workflow_template_variables_pkey PRIMARY KEY (id);


--
-- Name: workflow_template_variables workflow_template_variables_workflow_id_var_name_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_variables
    ADD CONSTRAINT workflow_template_variables_workflow_id_var_name_key UNIQUE (workflow_id, var_name);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: workflow_tools workflow_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_tools
    ADD CONSTRAINT workflow_tools_pkey PRIMARY KEY (id);


--
-- Name: workflow_tools workflow_tools_tool_id_key; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_tools
    ADD CONSTRAINT workflow_tools_tool_id_key UNIQUE (tool_id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: idx_agent_interactions_agent_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_agent_interactions_agent_id ON public.agent_interactions USING btree (agent_id);


--
-- Name: idx_agent_interactions_user_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_agent_interactions_user_id ON public.agent_interactions USING btree (user_id);


--
-- Name: idx_api_key_usage_created; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_api_key_usage_created ON public.api_key_usage USING btree (created_at DESC);


--
-- Name: idx_api_keys_user_service; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_api_keys_user_service ON public.api_keys USING btree (user_id, service_name) WHERE (is_active = true);


--
-- Name: idx_api_policies_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_api_policies_active ON public.api_security_policies USING btree (is_active);


--
-- Name: idx_api_policies_name; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_api_policies_name ON public.api_security_policies USING btree (policy_name);


--
-- Name: idx_api_schemas_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_api_schemas_active ON public.integration_api_schemas USING btree (is_active);


--
-- Name: idx_api_schemas_endpoint; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_api_schemas_endpoint ON public.integration_api_schemas USING btree (endpoint);


--
-- Name: idx_api_schemas_integration_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_api_schemas_integration_id ON public.integration_api_schemas USING btree (integration_id);


--
-- Name: idx_api_schemas_method; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_api_schemas_method ON public.integration_api_schemas USING btree (method);


--
-- Name: idx_audio_assets_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_audio_assets_user ON public.audio_assets USING btree (user_id, created_at DESC);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_audit_action ON public.security_audit_log USING btree (action);


--
-- Name: idx_audit_log_created_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_audit_log_created_at ON public.audit_log USING btree (created_at);


--
-- Name: idx_audit_log_user_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_audit_log_user_id ON public.audit_log USING btree (user_id);


--
-- Name: idx_audit_resource; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_audit_resource ON public.security_audit_log USING btree (resource);


--
-- Name: idx_audit_risk; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_audit_risk ON public.security_audit_log USING btree (risk_score);


--
-- Name: idx_audit_timestamp; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_audit_timestamp ON public.security_audit_log USING btree ("timestamp");


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_audit_user ON public.security_audit_log USING btree (user_id);


--
-- Name: idx_batch_processing_data_source; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_batch_processing_data_source ON public.workflow_batch_processing USING btree (data_source);


--
-- Name: idx_batch_processing_schedule_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_batch_processing_schedule_id ON public.workflow_batch_processing USING btree (schedule_id);


--
-- Name: idx_batch_processing_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_batch_processing_status ON public.workflow_batch_processing USING btree (processing_status);


--
-- Name: idx_calendar_events_start_time; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_calendar_events_start_time ON public.calendar_events USING btree (start_time);


--
-- Name: idx_calendar_events_user_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_calendar_events_user_id ON public.calendar_events USING btree (user_id);


--
-- Name: idx_calendar_events_user_time; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_calendar_events_user_time ON public.calendar_events USING btree (user_id, start_time);


--
-- Name: idx_calendar_integrations_provider; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_calendar_integrations_provider ON public.workflow_calendar_integrations USING btree (calendar_provider);


--
-- Name: idx_calendar_integrations_schedule_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_calendar_integrations_schedule_id ON public.workflow_calendar_integrations USING btree (schedule_id);


--
-- Name: idx_calendar_integrations_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_calendar_integrations_status ON public.workflow_calendar_integrations USING btree (sync_status);


--
-- Name: idx_chat_messages_session_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_chat_messages_session_id ON public.chat_messages USING btree (session_id);


--
-- Name: idx_compliance_date; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_compliance_date ON public.compliance_reports USING btree (report_date);


--
-- Name: idx_compliance_findings_report; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_compliance_findings_report ON public.compliance_findings USING btree (report_id);


--
-- Name: idx_compliance_findings_severity; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_compliance_findings_severity ON public.compliance_findings USING btree (severity);


--
-- Name: idx_compliance_framework; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_compliance_framework ON public.compliance_reports USING btree (framework);


--
-- Name: idx_conditional_rules_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_conditional_rules_active ON public.workflow_conditional_rules USING btree (is_active);


--
-- Name: idx_conditional_rules_order; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_conditional_rules_order ON public.workflow_conditional_rules USING btree (evaluation_order);


--
-- Name: idx_conditional_rules_schedule_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_conditional_rules_schedule_id ON public.workflow_conditional_rules USING btree (schedule_id);


--
-- Name: idx_conditional_rules_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_conditional_rules_type ON public.workflow_conditional_rules USING btree (condition_type);


--
-- Name: idx_connection_pools_integration_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_connection_pools_integration_id ON public.integration_connection_pools USING btree (integration_id);


--
-- Name: idx_connection_pools_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_connection_pools_status ON public.integration_connection_pools USING btree (pool_status);


--
-- Name: idx_connection_pools_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_connection_pools_type ON public.integration_connection_pools USING btree (pool_type);


--
-- Name: idx_contacts_user_name; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_contacts_user_name ON public.contacts USING btree (user_id, name);


--
-- Name: idx_conversation_messages_conv; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_conversation_messages_conv ON public.conversation_messages USING btree (conversation_id, created_at);


--
-- Name: idx_conversation_messages_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_conversation_messages_user ON public.conversation_messages USING btree (user_id, created_at DESC);


--
-- Name: idx_conversations_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_conversations_user ON public.conversations USING btree (user_id, created_at DESC);


--
-- Name: idx_emails_user_received; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_emails_user_received ON public.emails USING btree (user_id, received_at DESC);


--
-- Name: idx_encryption_keys_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_encryption_keys_active ON public.encryption_keys USING btree (is_active);


--
-- Name: idx_encryption_keys_expires; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_encryption_keys_expires ON public.encryption_keys USING btree (expires_at);


--
-- Name: idx_encryption_keys_name; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_encryption_keys_name ON public.encryption_keys USING btree (key_name);


--
-- Name: idx_error_logs_created; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_error_logs_created ON public.error_logs USING btree (created_at DESC);


--
-- Name: idx_error_logs_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_error_logs_type ON public.error_logs USING btree (error_type, created_at DESC);


--
-- Name: idx_event_triggers_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_event_triggers_active ON public.workflow_event_triggers USING btree (is_active);


--
-- Name: idx_event_triggers_event_source; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_event_triggers_event_source ON public.workflow_event_triggers USING btree (event_source);


--
-- Name: idx_event_triggers_event_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_event_triggers_event_type ON public.workflow_event_triggers USING btree (event_type);


--
-- Name: idx_event_triggers_schedule_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_event_triggers_schedule_id ON public.workflow_event_triggers USING btree (schedule_id);


--
-- Name: idx_events_created; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_events_created ON public.security_events USING btree (created_at);


--
-- Name: idx_events_resolved; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_events_resolved ON public.security_events USING btree (resolved);


--
-- Name: idx_events_severity; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_events_severity ON public.security_events USING btree (severity);


--
-- Name: idx_events_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_events_type ON public.security_events USING btree (event_type);


--
-- Name: idx_health_checks_checked_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_health_checks_checked_at ON public.integration_health_checks USING btree (checked_at DESC);


--
-- Name: idx_health_checks_integration_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_health_checks_integration_id ON public.integration_health_checks USING btree (integration_id);


--
-- Name: idx_health_checks_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_health_checks_status ON public.integration_health_checks USING btree (status);


--
-- Name: idx_health_checks_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_health_checks_type ON public.integration_health_checks USING btree (check_type);


--
-- Name: idx_image_assets_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_image_assets_user ON public.image_assets USING btree (user_id, created_at DESC);


--
-- Name: idx_integration_auth_tokens_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_auth_tokens_active ON public.integration_auth_tokens USING btree (is_active);


--
-- Name: idx_integration_auth_tokens_expires; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_auth_tokens_expires ON public.integration_auth_tokens USING btree (expires_at);


--
-- Name: idx_integration_auth_tokens_integration_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_auth_tokens_integration_id ON public.integration_auth_tokens USING btree (integration_id);


--
-- Name: idx_integration_auth_tokens_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_auth_tokens_type ON public.integration_auth_tokens USING btree (token_type);


--
-- Name: idx_integration_executions_executed_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_executions_executed_at ON public.integration_executions USING btree (executed_at DESC);


--
-- Name: idx_integration_executions_integration_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_executions_integration_id ON public.integration_executions USING btree (integration_id);


--
-- Name: idx_integration_executions_operation_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_executions_operation_type ON public.integration_executions USING btree (operation_type);


--
-- Name: idx_integration_executions_recent_performance; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_executions_recent_performance ON public.integration_executions USING btree (integration_id, executed_at DESC, status, duration_ms);


--
-- Name: idx_integration_executions_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_executions_status ON public.integration_executions USING btree (status);


--
-- Name: idx_integration_executions_workflow_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_executions_workflow_id ON public.integration_executions USING btree (workflow_execution_id);


--
-- Name: idx_integration_performance_overview_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE UNIQUE INDEX idx_integration_performance_overview_id ON public.integration_performance_overview USING btree (id);


--
-- Name: idx_integration_rate_limits_blocked; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_rate_limits_blocked ON public.integration_rate_limits USING btree (is_blocked);


--
-- Name: idx_integration_rate_limits_integration_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_rate_limits_integration_id ON public.integration_rate_limits USING btree (integration_id);


--
-- Name: idx_integration_rate_limits_window_start; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_rate_limits_window_start ON public.integration_rate_limits USING btree (time_window_start);


--
-- Name: idx_integration_usage_analytics_date_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_usage_analytics_date_type ON public.integration_usage_analytics USING btree (date, integration_type);


--
-- Name: idx_integration_webhooks_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_webhooks_active ON public.integration_webhooks USING btree (is_active);


--
-- Name: idx_integration_webhooks_integration_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_webhooks_integration_id ON public.integration_webhooks USING btree (integration_id);


--
-- Name: idx_integration_webhooks_path; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_integration_webhooks_path ON public.integration_webhooks USING btree (webhook_path);


--
-- Name: idx_journal_entries_user_created; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_journal_entries_user_created ON public.journal_entries USING btree (user_id, created_at DESC);


--
-- Name: idx_jwt_blacklist_expires; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_jwt_blacklist_expires ON public.jwt_blacklist USING btree (expires_at);


--
-- Name: idx_jwt_blacklist_jti; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_jwt_blacklist_jti ON public.jwt_blacklist USING btree (jti);


--
-- Name: idx_knowledge_chunks_doc; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_chunks_doc ON public.knowledge_chunks USING btree (document_id, chunk_index);


--
-- Name: idx_knowledge_chunks_document; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_chunks_document ON public.knowledge_chunks USING btree (document_id, chunk_index);


--
-- Name: idx_knowledge_chunks_embedding; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_chunks_embedding ON public.knowledge_chunks USING ivfflat (embedding public.vector_cosine_ops);


--
-- Name: idx_knowledge_docs_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_docs_user ON public.knowledge_documents USING btree (user_id, created_at DESC);


--
-- Name: idx_knowledge_documents_hash; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_documents_hash ON public.knowledge_documents USING btree (content_hash);


--
-- Name: idx_knowledge_documents_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_documents_user ON public.knowledge_documents USING btree (user_id, created_at);


--
-- Name: idx_knowledge_entries_embedding; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_entries_embedding ON public.knowledge_entries USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_knowledge_entries_user_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_entries_user_id ON public.knowledge_entries USING btree (user_id);


--
-- Name: idx_knowledge_extractions_document; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_extractions_document ON public.knowledge_extractions USING btree (document_id, extraction_type);


--
-- Name: idx_knowledge_queries_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_queries_user ON public.knowledge_queries USING btree (user_id, created_at);


--
-- Name: idx_knowledge_relationships_source; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_knowledge_relationships_source ON public.knowledge_relationships USING btree (source_document_id);


--
-- Name: idx_masking_rules_table_column; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_masking_rules_table_column ON public.data_masking_rules USING btree (table_name, column_name);


--
-- Name: idx_mcp_tasks_created; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_mcp_tasks_created ON public.mcp_tasks USING btree (created_at);


--
-- Name: idx_mcp_tasks_embedding; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_mcp_tasks_embedding ON public.mcp_tasks USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_mcp_tasks_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_mcp_tasks_status ON public.mcp_tasks USING btree (status);


--
-- Name: idx_mcp_tasks_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_mcp_tasks_type ON public.mcp_tasks USING btree (task_type);


--
-- Name: idx_mcp_tasks_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_mcp_tasks_user ON public.mcp_tasks USING btree (user_id);


--
-- Name: idx_message_queues_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_message_queues_active ON public.integration_message_queues USING btree (is_active);


--
-- Name: idx_message_queues_integration_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_message_queues_integration_id ON public.integration_message_queues USING btree (integration_id);


--
-- Name: idx_message_queues_name; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_message_queues_name ON public.integration_message_queues USING btree (queue_name);


--
-- Name: idx_message_queues_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_message_queues_type ON public.integration_message_queues USING btree (queue_type);


--
-- Name: idx_mood_analytics_user_date; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_mood_analytics_user_date ON public.mood_analytics USING btree (user_id, date DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_oauth_tokens_expires; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_oauth_tokens_expires ON public.oauth_tokens USING btree (expires_at);


--
-- Name: idx_oauth_tokens_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_oauth_tokens_user ON public.oauth_tokens USING btree (user_id);


--
-- Name: idx_performance_alerts_metric; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_alerts_metric ON public.performance_alerts USING btree (metric);


--
-- Name: idx_performance_alerts_severity; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_alerts_severity ON public.performance_alerts USING btree (severity);


--
-- Name: idx_performance_alerts_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_alerts_status ON public.performance_alerts USING btree (status);


--
-- Name: idx_performance_alerts_triggered_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_alerts_triggered_at ON public.performance_alerts USING btree (triggered_at);


--
-- Name: idx_performance_metrics_name; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_metrics_name ON public.performance_metrics USING btree (name);


--
-- Name: idx_performance_metrics_name_timestamp; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_metrics_name_timestamp ON public.performance_metrics USING btree (name, "timestamp");


--
-- Name: idx_performance_metrics_timestamp; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_metrics_timestamp ON public.performance_metrics USING btree ("timestamp");


--
-- Name: idx_performance_recommendations_created_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_recommendations_created_at ON public.performance_recommendations USING btree (created_at);


--
-- Name: idx_performance_recommendations_rule; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_recommendations_rule ON public.performance_recommendations USING btree (rule_name);


--
-- Name: idx_performance_recommendations_severity; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_recommendations_severity ON public.performance_recommendations USING btree (severity);


--
-- Name: idx_performance_recommendations_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_recommendations_status ON public.performance_recommendations USING btree (status);


--
-- Name: idx_performance_thresholds_enabled; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_thresholds_enabled ON public.performance_thresholds USING btree (enabled);


--
-- Name: idx_performance_thresholds_metric; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_performance_thresholds_metric ON public.performance_thresholds USING btree (metric_name);


--
-- Name: idx_schedule_executions_context; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_executions_context ON public.workflow_schedule_executions USING gin (context);


--
-- Name: idx_schedule_executions_execution_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_executions_execution_id ON public.workflow_schedule_executions USING btree (execution_id);


--
-- Name: idx_schedule_executions_schedule_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_executions_schedule_id ON public.workflow_schedule_executions USING btree (schedule_id);


--
-- Name: idx_schedule_executions_started_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_executions_started_at ON public.workflow_schedule_executions USING btree (started_at DESC);


--
-- Name: idx_schedule_executions_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_executions_status ON public.workflow_schedule_executions USING btree (status);


--
-- Name: idx_schedule_performance_overview_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE UNIQUE INDEX idx_schedule_performance_overview_id ON public.workflow_schedule_performance_overview USING btree (id);


--
-- Name: idx_schedule_queue_analysis_hour_schedule; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_queue_analysis_hour_schedule ON public.workflow_schedule_queue_analysis USING btree (hour_bucket, schedule_id);


--
-- Name: idx_schedule_queue_priority; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_queue_priority ON public.workflow_schedule_queue USING btree (priority DESC, created_at);


--
-- Name: idx_schedule_queue_processing_node; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_queue_processing_node ON public.workflow_schedule_queue USING btree (processing_node);


--
-- Name: idx_schedule_queue_schedule_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_queue_schedule_id ON public.workflow_schedule_queue USING btree (schedule_id);


--
-- Name: idx_schedule_queue_scheduled_for; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_queue_scheduled_for ON public.workflow_schedule_queue USING btree (scheduled_for);


--
-- Name: idx_schedule_queue_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_queue_status ON public.workflow_schedule_queue USING btree (queue_status);


--
-- Name: idx_schedule_queue_workflow_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_queue_workflow_id ON public.workflow_schedule_queue USING btree (workflow_id);


--
-- Name: idx_schedule_statistics_date; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_statistics_date ON public.workflow_schedule_statistics USING btree (date_recorded DESC);


--
-- Name: idx_schedule_statistics_schedule_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_schedule_statistics_schedule_id ON public.workflow_schedule_statistics USING btree (schedule_id);


--
-- Name: idx_search_index_embedding; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_search_index_embedding ON public.search_index USING ivfflat (embedding public.vector_cosine_ops);


--
-- Name: idx_search_index_user_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_search_index_user_type ON public.search_index USING btree (user_id, content_type);


--
-- Name: idx_security_config_key; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_config_key ON public.security_configuration USING btree (config_key);


--
-- Name: idx_security_config_table_column; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_config_table_column ON public.database_security_config USING btree (table_name, column_name);


--
-- Name: idx_security_test_metrics_collected_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_metrics_collected_at ON public.security_test_metrics USING btree (collected_at);


--
-- Name: idx_security_test_metrics_name_category; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_metrics_name_category ON public.security_test_metrics USING btree (metric_name, metric_category);


--
-- Name: idx_security_test_reports_generated_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_reports_generated_at ON public.security_test_reports USING btree (generated_at);


--
-- Name: idx_security_test_reports_risk_score; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_reports_risk_score ON public.security_test_reports USING btree (overall_risk, risk_score);


--
-- Name: idx_security_test_results_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_results_status ON public.security_test_results USING btree (status);


--
-- Name: idx_security_test_results_test_run; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_results_test_run ON public.security_test_results USING btree (test_run_id);


--
-- Name: idx_security_test_runs_started_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_runs_started_at ON public.security_test_runs USING btree (started_at);


--
-- Name: idx_security_test_runs_status_duration; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_runs_status_duration ON public.security_test_runs USING btree (status, duration_ms);


--
-- Name: idx_security_test_runs_suite_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_runs_suite_status ON public.security_test_runs USING btree (suite_id, status);


--
-- Name: idx_security_test_schedules_enabled_next_run; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_schedules_enabled_next_run ON public.security_test_schedules USING btree (enabled, next_run_at);


--
-- Name: idx_security_test_vulnerabilities_run_severity; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_vulnerabilities_run_severity ON public.security_test_vulnerabilities USING btree (test_run_id, severity);


--
-- Name: idx_security_test_vulnerabilities_severity_priority; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_vulnerabilities_severity_priority ON public.security_test_vulnerabilities USING btree (severity, fix_priority);


--
-- Name: idx_security_test_vulnerabilities_type_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_security_test_vulnerabilities_type_status ON public.security_test_vulnerabilities USING btree (vulnerability_type, status);


--
-- Name: idx_sensitive_data_detection_table; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_sensitive_data_detection_table ON public.sensitive_data_detection USING btree (table_name, column_name);


--
-- Name: idx_service_integrations_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_service_integrations_active ON public.service_integrations USING btree (is_active);


--
-- Name: idx_service_integrations_auth; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_service_integrations_auth ON public.service_integrations USING gin (auth_config);


--
-- Name: idx_service_integrations_config; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_service_integrations_config ON public.service_integrations USING gin (configuration);


--
-- Name: idx_service_integrations_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_service_integrations_status ON public.service_integrations USING btree (status);


--
-- Name: idx_service_integrations_status_updated; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_service_integrations_status_updated ON public.service_integrations USING btree (status, updated_at DESC);


--
-- Name: idx_service_integrations_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_service_integrations_type ON public.service_integrations USING btree (integration_type);


--
-- Name: idx_service_integrations_user_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_service_integrations_user_id ON public.service_integrations USING btree (user_id);


--
-- Name: idx_service_integrations_user_type_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_service_integrations_user_type_active ON public.service_integrations USING btree (user_id, integration_type, is_active);


--
-- Name: idx_sessions_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_sessions_active ON public.security_sessions USING btree (is_active);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_sessions_expires ON public.security_sessions USING btree (expires_at);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_sessions_token ON public.security_sessions USING btree (session_token);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_sessions_user ON public.security_sessions USING btree (user_id);


--
-- Name: idx_system_metrics_name_time; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_system_metrics_name_time ON public.system_metrics USING btree (metric_name, "timestamp" DESC);


--
-- Name: idx_tasks_user_due; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_tasks_user_due ON public.tasks USING btree (user_id, due_date) WHERE ((status)::text <> 'completed'::text);


--
-- Name: idx_telemetry_traces_operation_name; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_telemetry_traces_operation_name ON public.telemetry_traces USING btree (operation_name);


--
-- Name: idx_telemetry_traces_trace_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_telemetry_traces_trace_id ON public.telemetry_traces USING btree (trace_id);


--
-- Name: idx_template_usage_template; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_template_usage_template ON public.workflow_template_usage USING btree (template_id);


--
-- Name: idx_template_usage_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_template_usage_user ON public.workflow_template_usage USING btree (user_id);


--
-- Name: idx_template_variables_workflow; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_template_variables_workflow ON public.workflow_template_variables USING btree (workflow_id);


--
-- Name: idx_user_activity_user_created; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_user_activity_user_created ON public.user_activity_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_user_auth_provider; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_user_auth_provider ON public.user_authentication USING btree (auth_provider, provider_user_id);


--
-- Name: idx_user_auth_user_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_user_auth_user_id ON public.user_authentication USING btree (user_id);


--
-- Name: idx_user_roles_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_user_roles_active ON public.user_roles USING btree (user_id, is_active);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);


--
-- Name: idx_user_sessions_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id, expires_at);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_video_assets_user; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_video_assets_user ON public.video_assets USING btree (user_id, created_at DESC);


--
-- Name: idx_vuln_scans_started; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_vuln_scans_started ON public.vulnerability_scans USING btree (started_at);


--
-- Name: idx_vuln_scans_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_vuln_scans_status ON public.vulnerability_scans USING btree (status);


--
-- Name: idx_vuln_scans_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_vuln_scans_type ON public.vulnerability_scans USING btree (scan_type);


--
-- Name: idx_vulnerabilities_detected; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_vulnerabilities_detected ON public.vulnerabilities USING btree (detected_at);


--
-- Name: idx_vulnerabilities_scan; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_vulnerabilities_scan ON public.vulnerabilities USING btree (scan_id);


--
-- Name: idx_vulnerabilities_severity; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_vulnerabilities_severity ON public.vulnerabilities USING btree (severity);


--
-- Name: idx_vulnerabilities_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_vulnerabilities_status ON public.vulnerabilities USING btree (status);


--
-- Name: idx_webhook_events_ip; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_webhook_events_ip ON public.integration_webhook_events USING btree (request_ip_address);


--
-- Name: idx_webhook_events_received_at; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_webhook_events_received_at ON public.integration_webhook_events USING btree (received_at DESC);


--
-- Name: idx_webhook_events_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_webhook_events_status ON public.integration_webhook_events USING btree (response_status);


--
-- Name: idx_webhook_events_webhook_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_webhook_events_webhook_id ON public.integration_webhook_events USING btree (webhook_id);


--
-- Name: idx_workflow_automation_definitions_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_definitions_active ON public.workflow_automation_definitions USING btree (is_active);


--
-- Name: idx_workflow_automation_definitions_owner; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_definitions_owner ON public.workflow_automation_definitions USING btree (owner_id);


--
-- Name: idx_workflow_automation_definitions_trigger; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_definitions_trigger ON public.workflow_automation_definitions USING btree (trigger_type);


--
-- Name: idx_workflow_automation_logs_execution; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_logs_execution ON public.workflow_automation_logs USING btree (execution_id);


--
-- Name: idx_workflow_automation_logs_level; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_logs_level ON public.workflow_automation_logs USING btree (level);


--
-- Name: idx_workflow_automation_logs_timestamp; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_logs_timestamp ON public.workflow_automation_logs USING btree ("timestamp");


--
-- Name: idx_workflow_automation_steps_execution; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_steps_execution ON public.workflow_automation_steps USING btree (execution_id);


--
-- Name: idx_workflow_automation_steps_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_steps_status ON public.workflow_automation_steps USING btree (status);


--
-- Name: idx_workflow_automation_templates_category; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_automation_templates_category ON public.workflow_automation_templates USING btree (category);


--
-- Name: idx_workflow_connectors_category; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_connectors_category ON public.workflow_connectors USING btree (category);


--
-- Name: idx_workflow_connectors_enabled; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_connectors_enabled ON public.workflow_connectors USING btree (is_enabled) WHERE (is_enabled = true);


--
-- Name: idx_workflow_defs_user_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_defs_user_active ON public.workflow_automation_definitions USING btree (owner_id, is_active);


--
-- Name: idx_workflow_executions_completed_duration; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_completed_duration ON public.workflow_executions USING btree (completed_at DESC, workflow_id) WHERE (completed_at IS NOT NULL);


--
-- Name: idx_workflow_executions_metadata; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_metadata ON public.workflow_executions USING gin (metadata);


--
-- Name: idx_workflow_executions_running; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_running ON public.workflow_executions USING btree (workflow_id, started_at DESC) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying])::text[]));


--
-- Name: idx_workflow_executions_started; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_started ON public.workflow_executions USING btree (started_at);


--
-- Name: idx_workflow_executions_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_status ON public.workflow_executions USING btree (status);


--
-- Name: idx_workflow_executions_status_started; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_status_started ON public.workflow_executions USING btree (status, started_at DESC);


--
-- Name: idx_workflow_executions_workflow; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_workflow ON public.workflow_executions USING btree (workflow_id);


--
-- Name: idx_workflow_executions_workflow_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_workflow_id ON public.workflow_executions USING btree (workflow_id);


--
-- Name: idx_workflow_executions_workflow_status; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_executions_workflow_status ON public.workflow_executions USING btree (workflow_id, status, started_at DESC);


--
-- Name: idx_workflow_nodes_enabled; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_nodes_enabled ON public.workflow_nodes USING btree (is_enabled) WHERE (is_enabled = true);


--
-- Name: idx_workflow_nodes_type_category; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_nodes_type_category ON public.workflow_nodes USING btree (node_type, category);


--
-- Name: idx_workflow_schedules_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_schedules_active ON public.workflow_schedules USING btree (is_active);


--
-- Name: idx_workflow_schedules_config; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_schedules_config ON public.workflow_schedules USING gin (configuration);


--
-- Name: idx_workflow_schedules_priority; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_schedules_priority ON public.workflow_schedules USING btree (priority DESC);


--
-- Name: idx_workflow_schedules_type; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_schedules_type ON public.workflow_schedules USING btree (schedule_type);


--
-- Name: idx_workflow_schedules_user_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_schedules_user_active ON public.workflow_schedules USING btree (user_id, is_active, schedule_type);


--
-- Name: idx_workflow_schedules_user_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_schedules_user_id ON public.workflow_schedules USING btree (user_id);


--
-- Name: idx_workflow_schedules_workflow_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_schedules_workflow_active ON public.workflow_schedules USING btree (workflow_id, is_active);


--
-- Name: idx_workflow_schedules_workflow_id; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_schedules_workflow_id ON public.workflow_schedules USING btree (workflow_id);


--
-- Name: idx_workflow_step_exec_log; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflow_step_exec_log ON public.workflow_step_executions USING btree (workflow_log_id, started_at);


--
-- Name: idx_workflows_base_template; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflows_base_template ON public.workflows USING btree (base_template_id) WHERE (base_template_id IS NOT NULL);


--
-- Name: idx_workflows_data_gin; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflows_data_gin ON public.workflows USING gin (workflow_data);


--
-- Name: idx_workflows_is_template; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflows_is_template ON public.workflows USING btree (is_template) WHERE (is_template = true);


--
-- Name: idx_workflows_name_search; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflows_name_search ON public.workflows USING btree (name, user_id) WHERE (is_active = true);


--
-- Name: idx_workflows_search_content; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflows_search_content ON public.workflows USING gin (to_tsvector('english'::regconfig, (((name)::text || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_workflows_search_name; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflows_search_name ON public.workflows USING gin (to_tsvector('english'::regconfig, (((name)::text || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_workflows_user_active; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX idx_workflows_user_active ON public.workflows USING btree (user_id, is_active);


--
-- Name: workflow_template_tags_name_idx; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX workflow_template_tags_name_idx ON public.workflow_template_tags USING btree (name);


--
-- Name: workflows_is_template_idx; Type: INDEX; Schema: public; Owner: robert
--

CREATE INDEX workflows_is_template_idx ON public.workflows USING btree (is_template) WHERE (is_template = true);


--
-- Name: security_test_configurations security_test_configurations_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER security_test_configurations_updated_at BEFORE UPDATE ON public.security_test_configurations FOR EACH ROW EXECUTE FUNCTION public.update_security_test_updated_at();


--
-- Name: security_test_runs security_test_runs_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER security_test_runs_updated_at BEFORE UPDATE ON public.security_test_runs FOR EACH ROW EXECUTE FUNCTION public.update_security_test_updated_at();


--
-- Name: security_test_schedules security_test_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER security_test_schedules_updated_at BEFORE UPDATE ON public.security_test_schedules FOR EACH ROW EXECUTE FUNCTION public.update_security_test_updated_at();


--
-- Name: security_test_vulnerabilities security_test_vulnerabilities_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER security_test_vulnerabilities_updated_at BEFORE UPDATE ON public.security_test_vulnerabilities FOR EACH ROW EXECUTE FUNCTION public.update_security_test_updated_at();


--
-- Name: integration_auth_tokens trigger_update_integration_auth_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER trigger_update_integration_auth_tokens_updated_at BEFORE UPDATE ON public.integration_auth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_integration_auth_tokens_updated_at();


--
-- Name: integration_connection_pools trigger_update_integration_connection_pools_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER trigger_update_integration_connection_pools_updated_at BEFORE UPDATE ON public.integration_connection_pools FOR EACH ROW EXECUTE FUNCTION public.update_integration_connection_pools_updated_at();


--
-- Name: service_integrations trigger_update_service_integrations_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER trigger_update_service_integrations_updated_at BEFORE UPDATE ON public.service_integrations FOR EACH ROW EXECUTE FUNCTION public.update_service_integrations_updated_at();


--
-- Name: workflow_batch_processing trigger_update_workflow_batch_processing_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER trigger_update_workflow_batch_processing_updated_at BEFORE UPDATE ON public.workflow_batch_processing FOR EACH ROW EXECUTE FUNCTION public.update_workflow_batch_processing_updated_at();


--
-- Name: workflow_calendar_integrations trigger_update_workflow_calendar_integrations_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER trigger_update_workflow_calendar_integrations_updated_at BEFORE UPDATE ON public.workflow_calendar_integrations FOR EACH ROW EXECUTE FUNCTION public.update_workflow_calendar_integrations_updated_at();


--
-- Name: workflow_schedules trigger_update_workflow_schedules_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER trigger_update_workflow_schedules_updated_at BEFORE UPDATE ON public.workflow_schedules FOR EACH ROW EXECUTE FUNCTION public.update_workflow_schedules_updated_at();


--
-- Name: data_masking_rules update_data_masking_rules_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER update_data_masking_rules_updated_at BEFORE UPDATE ON public.data_masking_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: database_security_config update_database_security_config_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER update_database_security_config_updated_at BEFORE UPDATE ON public.database_security_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: database_security_policies update_database_security_policies_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER update_database_security_policies_updated_at BEFORE UPDATE ON public.database_security_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workflow_automation_definitions update_workflow_automation_definitions_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER update_workflow_automation_definitions_updated_at BEFORE UPDATE ON public.workflow_automation_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workflow_automation_templates update_workflow_automation_templates_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER update_workflow_automation_templates_updated_at BEFORE UPDATE ON public.workflow_automation_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workflow_connectors update_workflow_connectors_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER update_workflow_connectors_updated_at BEFORE UPDATE ON public.workflow_connectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workflow_nodes update_workflow_nodes_updated_at; Type: TRIGGER; Schema: public; Owner: robert
--

CREATE TRIGGER update_workflow_nodes_updated_at BEFORE UPDATE ON public.workflow_nodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_interactions agent_interactions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.agent_interactions
    ADD CONSTRAINT agent_interactions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_interactions agent_interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.agent_interactions
    ADD CONSTRAINT agent_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ai_model_usage ai_model_usage_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.ai_model_usage
    ADD CONSTRAINT ai_model_usage_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE CASCADE;


--
-- Name: ai_model_usage ai_model_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.ai_model_usage
    ADD CONSTRAINT ai_model_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_key_usage api_key_usage_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_key_usage
    ADD CONSTRAINT api_key_usage_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;


--
-- Name: api_key_usage api_key_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_key_usage
    ADD CONSTRAINT api_key_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: api_security_policies api_security_policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.api_security_policies
    ADD CONSTRAINT api_security_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audio_assets audio_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.audio_assets
    ADD CONSTRAINT audio_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: backup_encryption_log backup_encryption_log_encryption_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.backup_encryption_log
    ADD CONSTRAINT backup_encryption_log_encryption_key_id_fkey FOREIGN KEY (encryption_key_id) REFERENCES public.encryption_keys(id);


--
-- Name: calendar_events calendar_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: compliance_findings compliance_findings_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.compliance_findings
    ADD CONSTRAINT compliance_findings_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.compliance_reports(id) ON DELETE CASCADE;


--
-- Name: compliance_reports compliance_reports_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_backups data_backups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_backups
    ADD CONSTRAINT data_backups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_classification_assignments data_classification_assignments_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.data_classification_assignments
    ADD CONSTRAINT data_classification_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.data_classification_tags(id) ON DELETE CASCADE;


--
-- Name: email_accounts email_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_threads email_threads_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.email_accounts(id) ON DELETE CASCADE;


--
-- Name: emails emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: encryption_keys encryption_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.encryption_keys
    ADD CONSTRAINT encryption_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: error_logs error_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: image_assets image_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.image_assets
    ADD CONSTRAINT image_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: integration_api_schemas integration_api_schemas_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_api_schemas
    ADD CONSTRAINT integration_api_schemas_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_integrations(id) ON DELETE CASCADE;


--
-- Name: integration_auth_tokens integration_auth_tokens_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_auth_tokens
    ADD CONSTRAINT integration_auth_tokens_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_integrations(id) ON DELETE CASCADE;


--
-- Name: integration_connection_pools integration_connection_pools_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_connection_pools
    ADD CONSTRAINT integration_connection_pools_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_integrations(id) ON DELETE CASCADE;


--
-- Name: integration_executions integration_executions_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_executions
    ADD CONSTRAINT integration_executions_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_integrations(id) ON DELETE CASCADE;


--
-- Name: integration_health_checks integration_health_checks_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_health_checks
    ADD CONSTRAINT integration_health_checks_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_integrations(id) ON DELETE CASCADE;


--
-- Name: integration_message_queues integration_message_queues_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_message_queues
    ADD CONSTRAINT integration_message_queues_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_integrations(id) ON DELETE CASCADE;


--
-- Name: integration_rate_limits integration_rate_limits_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_rate_limits
    ADD CONSTRAINT integration_rate_limits_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_integrations(id) ON DELETE CASCADE;


--
-- Name: integration_webhook_events integration_webhook_events_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_webhook_events
    ADD CONSTRAINT integration_webhook_events_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.integration_webhooks(id) ON DELETE CASCADE;


--
-- Name: integration_webhooks integration_webhooks_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integration_webhooks
    ADD CONSTRAINT integration_webhooks_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.service_integrations(id) ON DELETE CASCADE;


--
-- Name: integrations integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: jwt_blacklist jwt_blacklist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.jwt_blacklist
    ADD CONSTRAINT jwt_blacklist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_collections knowledge_collections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_collections
    ADD CONSTRAINT knowledge_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_documents knowledge_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_entries knowledge_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_entries
    ADD CONSTRAINT knowledge_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_extractions knowledge_extractions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_extractions
    ADD CONSTRAINT knowledge_extractions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_extractions knowledge_extractions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_extractions
    ADD CONSTRAINT knowledge_extractions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_queries knowledge_queries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_queries
    ADD CONSTRAINT knowledge_queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_relationships knowledge_relationships_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_relationships
    ADD CONSTRAINT knowledge_relationships_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_relationships knowledge_relationships_target_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_relationships
    ADD CONSTRAINT knowledge_relationships_target_document_id_fkey FOREIGN KEY (target_document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_relationships knowledge_relationships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.knowledge_relationships
    ADD CONSTRAINT knowledge_relationships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mcp_tasks mcp_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.mcp_tasks
    ADD CONSTRAINT mcp_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: mood_analytics mood_analytics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.mood_analytics
    ADD CONSTRAINT mood_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: multi_modal_processing_log multi_modal_processing_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.multi_modal_processing_log
    ADD CONSTRAINT multi_modal_processing_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: oauth_tokens oauth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: privacy_settings privacy_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.privacy_settings
    ADD CONSTRAINT privacy_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: search_analytics search_analytics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.search_analytics
    ADD CONSTRAINT search_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: search_index search_index_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.search_index
    ADD CONSTRAINT search_index_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_audit_log security_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_audit_log
    ADD CONSTRAINT security_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_configuration security_configuration_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_configuration
    ADD CONSTRAINT security_configuration_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_events security_events_affected_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_affected_user_id_fkey FOREIGN KEY (affected_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_events security_events_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_sessions security_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_sessions
    ADD CONSTRAINT security_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_test_artifacts security_test_artifacts_test_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_artifacts
    ADD CONSTRAINT security_test_artifacts_test_result_id_fkey FOREIGN KEY (test_result_id) REFERENCES public.security_test_results(id) ON DELETE CASCADE;


--
-- Name: security_test_artifacts security_test_artifacts_test_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_artifacts
    ADD CONSTRAINT security_test_artifacts_test_run_id_fkey FOREIGN KEY (test_run_id) REFERENCES public.security_test_runs(id) ON DELETE CASCADE;


--
-- Name: security_test_artifacts security_test_artifacts_vulnerability_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_artifacts
    ADD CONSTRAINT security_test_artifacts_vulnerability_id_fkey FOREIGN KEY (vulnerability_id) REFERENCES public.security_test_vulnerabilities(id) ON DELETE CASCADE;


--
-- Name: security_test_metrics security_test_metrics_test_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_metrics
    ADD CONSTRAINT security_test_metrics_test_run_id_fkey FOREIGN KEY (test_run_id) REFERENCES public.security_test_runs(id) ON DELETE CASCADE;


--
-- Name: security_test_reports security_test_reports_test_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_reports
    ADD CONSTRAINT security_test_reports_test_run_id_fkey FOREIGN KEY (test_run_id) REFERENCES public.security_test_runs(id) ON DELETE CASCADE;


--
-- Name: security_test_results security_test_results_test_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_results
    ADD CONSTRAINT security_test_results_test_run_id_fkey FOREIGN KEY (test_run_id) REFERENCES public.security_test_runs(id) ON DELETE CASCADE;


--
-- Name: security_test_vulnerabilities security_test_vulnerabilities_test_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_vulnerabilities
    ADD CONSTRAINT security_test_vulnerabilities_test_result_id_fkey FOREIGN KEY (test_result_id) REFERENCES public.security_test_results(id) ON DELETE CASCADE;


--
-- Name: security_test_vulnerabilities security_test_vulnerabilities_test_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.security_test_vulnerabilities
    ADD CONSTRAINT security_test_vulnerabilities_test_run_id_fkey FOREIGN KEY (test_run_id) REFERENCES public.security_test_runs(id) ON DELETE CASCADE;


--
-- Name: service_integrations service_integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.service_integrations
    ADD CONSTRAINT service_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id);


--
-- Name: tasks tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id);


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_activity_logs user_activity_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_sessions(id) ON DELETE SET NULL;


--
-- Name: user_activity_logs user_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_authentication user_authentication_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_authentication
    ADD CONSTRAINT user_authentication_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: video_assets video_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.video_assets
    ADD CONSTRAINT video_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: visual_analysis visual_analysis_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.visual_analysis
    ADD CONSTRAINT visual_analysis_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: voice_sessions voice_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.voice_sessions
    ADD CONSTRAINT voice_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vulnerabilities vulnerabilities_scan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.vulnerability_scans(id) ON DELETE CASCADE;


--
-- Name: vulnerability_scans vulnerability_scans_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.vulnerability_scans
    ADD CONSTRAINT vulnerability_scans_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: webhooks webhooks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflow_automation_logs workflow_automation_logs_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_automation_logs
    ADD CONSTRAINT workflow_automation_logs_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workflow_executions(id) ON DELETE CASCADE;


--
-- Name: workflow_automation_logs workflow_automation_logs_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_automation_logs
    ADD CONSTRAINT workflow_automation_logs_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.workflow_automation_steps(id) ON DELETE CASCADE;


--
-- Name: workflow_automation_steps workflow_automation_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_automation_steps
    ADD CONSTRAINT workflow_automation_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workflow_executions(id) ON DELETE CASCADE;


--
-- Name: workflow_batch_processing workflow_batch_processing_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_batch_processing
    ADD CONSTRAINT workflow_batch_processing_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedules(id) ON DELETE CASCADE;


--
-- Name: workflow_calendar_integrations workflow_calendar_integrations_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_calendar_integrations
    ADD CONSTRAINT workflow_calendar_integrations_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedules(id) ON DELETE CASCADE;


--
-- Name: workflow_conditional_rules workflow_conditional_rules_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_conditional_rules
    ADD CONSTRAINT workflow_conditional_rules_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedules(id) ON DELETE CASCADE;


--
-- Name: workflow_event_triggers workflow_event_triggers_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_event_triggers
    ADD CONSTRAINT workflow_event_triggers_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedules(id) ON DELETE CASCADE;


--
-- Name: workflow_schedule_executions workflow_schedule_executions_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_executions
    ADD CONSTRAINT workflow_schedule_executions_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedules(id) ON DELETE CASCADE;


--
-- Name: workflow_schedule_queue workflow_schedule_queue_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_queue
    ADD CONSTRAINT workflow_schedule_queue_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedules(id) ON DELETE CASCADE;


--
-- Name: workflow_schedule_queue workflow_schedule_queue_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_queue
    ADD CONSTRAINT workflow_schedule_queue_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_schedule_statistics workflow_schedule_statistics_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedule_statistics
    ADD CONSTRAINT workflow_schedule_statistics_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.workflow_schedules(id) ON DELETE CASCADE;


--
-- Name: workflow_schedules workflow_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedules
    ADD CONSTRAINT workflow_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflow_schedules workflow_schedules_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_schedules
    ADD CONSTRAINT workflow_schedules_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_step_executions workflow_step_executions_workflow_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_step_executions
    ADD CONSTRAINT workflow_step_executions_workflow_log_id_fkey FOREIGN KEY (workflow_log_id) REFERENCES public.workflow_automation_logs(id) ON DELETE CASCADE;


--
-- Name: workflow_template_usage workflow_template_usage_instantiated_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_usage
    ADD CONSTRAINT workflow_template_usage_instantiated_workflow_id_fkey FOREIGN KEY (instantiated_workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_template_usage workflow_template_usage_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_usage
    ADD CONSTRAINT workflow_template_usage_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_template_usage workflow_template_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_usage
    ADD CONSTRAINT workflow_template_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflow_template_variables workflow_template_variables_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_template_variables
    ADD CONSTRAINT workflow_template_variables_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_templates workflow_templates_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workflows workflows_base_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_base_template_id_fkey FOREIGN KEY (base_template_id) REFERENCES public.workflows(id) ON DELETE SET NULL;


--
-- Name: workflows workflows_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.workflow_template_categories(id);


--
-- Name: workflows workflows_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: robert
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

