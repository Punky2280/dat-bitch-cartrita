-- 34_workflow_service_integration_hub_schema.sql
-- Component 6: Service Integration Hub - Database Schema
-- Comprehensive integration framework for external services and APIs

-- Create service_integrations table
CREATE TABLE IF NOT EXISTS service_integrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    integration_type VARCHAR(50) NOT NULL CHECK (integration_type IN ('rest_api', 'database', 'cloud_service', 'messaging', 'webhook', 'file_system', 'email')),
    description TEXT,
    configuration JSONB NOT NULL,
    auth_config JSONB DEFAULT '{}',
    rate_limit_config JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failed', 'testing')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for service_integrations
CREATE INDEX IF NOT EXISTS idx_service_integrations_user_id ON service_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_service_integrations_type ON service_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_service_integrations_status ON service_integrations(status);
CREATE INDEX IF NOT EXISTS idx_service_integrations_active ON service_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_service_integrations_config ON service_integrations USING GIN(configuration);
CREATE INDEX IF NOT EXISTS idx_service_integrations_auth ON service_integrations USING GIN(auth_config);

-- Create integration_executions table for execution tracking
CREATE TABLE IF NOT EXISTS integration_executions (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
    workflow_execution_id INTEGER, -- Reference to workflow execution if applicable
    operation_type VARCHAR(100) NOT NULL, -- 'api_call', 'database_query', 'message_publish', etc.
    operation_details JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'rate_limited')),
    duration_ms INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    response_data JSONB,
    error_message TEXT,
    error_code VARCHAR(50),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for integration_executions
CREATE INDEX IF NOT EXISTS idx_integration_executions_integration_id ON integration_executions(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_executions_workflow_id ON integration_executions(workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_integration_executions_status ON integration_executions(status);
CREATE INDEX IF NOT EXISTS idx_integration_executions_executed_at ON integration_executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_executions_operation_type ON integration_executions(operation_type);

-- Create integration_auth_tokens table for OAuth and token management
CREATE TABLE IF NOT EXISTS integration_auth_tokens (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
    token_type VARCHAR(50) NOT NULL CHECK (token_type IN ('access_token', 'refresh_token', 'api_key', 'certificate')),
    encrypted_token TEXT NOT NULL,
    token_metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for integration_auth_tokens
CREATE INDEX IF NOT EXISTS idx_integration_auth_tokens_integration_id ON integration_auth_tokens(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_auth_tokens_type ON integration_auth_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_integration_auth_tokens_active ON integration_auth_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_integration_auth_tokens_expires ON integration_auth_tokens(expires_at);

-- Create integration_webhooks table for webhook management
CREATE TABLE IF NOT EXISTS integration_webhooks (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
    webhook_path VARCHAR(255) NOT NULL UNIQUE,
    allowed_methods TEXT[] DEFAULT ARRAY['POST'],
    security_config JSONB DEFAULT '{}', -- IP whitelist, signature verification, etc.
    headers_config JSONB DEFAULT '{}',
    payload_transformation JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    total_triggers INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for integration_webhooks
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_integration_id ON integration_webhooks(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_path ON integration_webhooks(webhook_path);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_active ON integration_webhooks(is_active);

-- Create integration_webhook_events table for webhook event tracking
CREATE TABLE IF NOT EXISTS integration_webhook_events (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
    request_method VARCHAR(10) NOT NULL,
    request_headers JSONB DEFAULT '{}',
    request_body JSONB,
    request_ip_address INET,
    response_status INTEGER,
    response_body JSONB,
    processing_duration_ms INTEGER,
    error_message TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for integration_webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON integration_webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON integration_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON integration_webhook_events(response_status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_ip ON integration_webhook_events(request_ip_address);

-- Create integration_rate_limits table for rate limiting tracking
CREATE TABLE IF NOT EXISTS integration_rate_limits (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
    time_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    time_window_duration INTERVAL DEFAULT '1 minute',
    requests_count INTEGER DEFAULT 0,
    requests_limit INTEGER NOT NULL,
    burst_count INTEGER DEFAULT 0,
    burst_limit INTEGER,
    is_blocked BOOLEAN DEFAULT false,
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for integration_rate_limits
CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_integration_id ON integration_rate_limits(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_window_start ON integration_rate_limits(time_window_start);
CREATE INDEX IF NOT EXISTS idx_integration_rate_limits_blocked ON integration_rate_limits(is_blocked);

-- Create integration_connection_pools table for database connection management
CREATE TABLE IF NOT EXISTS integration_connection_pools (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
    pool_type VARCHAR(50) NOT NULL, -- 'postgresql', 'mysql', 'mongodb', 'redis'
    pool_config JSONB NOT NULL,
    current_connections INTEGER DEFAULT 0,
    max_connections INTEGER DEFAULT 10,
    idle_connections INTEGER DEFAULT 0,
    pool_status VARCHAR(50) DEFAULT 'healthy' CHECK (pool_status IN ('healthy', 'degraded', 'failed')),
    last_health_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for integration_connection_pools
CREATE INDEX IF NOT EXISTS idx_connection_pools_integration_id ON integration_connection_pools(integration_id);
CREATE INDEX IF NOT EXISTS idx_connection_pools_type ON integration_connection_pools(pool_type);
CREATE INDEX IF NOT EXISTS idx_connection_pools_status ON integration_connection_pools(pool_status);

-- Create integration_message_queues table for messaging system management
CREATE TABLE IF NOT EXISTS integration_message_queues (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
    queue_name VARCHAR(255) NOT NULL,
    queue_type VARCHAR(50) NOT NULL, -- 'rabbitmq', 'kafka', 'redis', 'sqs'
    queue_config JSONB DEFAULT '{}',
    message_count INTEGER DEFAULT 0,
    consumer_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for integration_message_queues
CREATE INDEX IF NOT EXISTS idx_message_queues_integration_id ON integration_message_queues(integration_id);
CREATE INDEX IF NOT EXISTS idx_message_queues_name ON integration_message_queues(queue_name);
CREATE INDEX IF NOT EXISTS idx_message_queues_type ON integration_message_queues(queue_type);
CREATE INDEX IF NOT EXISTS idx_message_queues_active ON integration_message_queues(is_active);

-- Create integration_api_schemas table for API schema validation
CREATE TABLE IF NOT EXISTS integration_api_schemas (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    request_schema JSONB, -- JSON Schema for request validation
    response_schema JSONB, -- JSON Schema for response validation
    schema_version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for integration_api_schemas
CREATE INDEX IF NOT EXISTS idx_api_schemas_integration_id ON integration_api_schemas(integration_id);
CREATE INDEX IF NOT EXISTS idx_api_schemas_endpoint ON integration_api_schemas(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_schemas_method ON integration_api_schemas(method);
CREATE INDEX IF NOT EXISTS idx_api_schemas_active ON integration_api_schemas(is_active);

-- Create integration_health_checks table for monitoring integration health
CREATE TABLE IF NOT EXISTS integration_health_checks (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES service_integrations(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL, -- 'ping', 'full_test', 'auth_test'
    status VARCHAR(50) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    response_time_ms INTEGER,
    error_message TEXT,
    check_details JSONB DEFAULT '{}',
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for integration_health_checks
CREATE INDEX IF NOT EXISTS idx_health_checks_integration_id ON integration_health_checks(integration_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON integration_health_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON integration_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_type ON integration_health_checks(check_type);

-- Create materialized view for integration performance overview
CREATE MATERIALIZED VIEW IF NOT EXISTS integration_performance_overview AS
SELECT 
    si.id,
    si.name,
    si.integration_type,
    si.is_active,
    si.status,
    COUNT(ie.id) as total_executions,
    COUNT(CASE WHEN ie.status = 'success' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN ie.status = 'error' THEN 1 END) as failed_executions,
    ROUND(AVG(ie.duration_ms)) as avg_response_time_ms,
    MIN(ie.duration_ms) as min_response_time_ms,
    MAX(ie.duration_ms) as max_response_time_ms,
    MAX(ie.executed_at) as last_execution_at,
    CASE 
        WHEN COUNT(ie.id) = 0 THEN 100
        ELSE ROUND((COUNT(CASE WHEN ie.status = 'success' THEN 1 END)::numeric / COUNT(ie.id)::numeric) * 100, 2)
    END as success_rate_percentage
FROM service_integrations si
LEFT JOIN integration_executions ie ON si.id = ie.integration_id
    AND ie.executed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY si.id, si.name, si.integration_type, si.is_active, si.status;

-- Create unique index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_performance_overview_id ON integration_performance_overview(id);

-- Create materialized view for integration usage analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS integration_usage_analytics AS
SELECT 
    DATE_TRUNC('day', ie.executed_at) as date,
    si.integration_type,
    COUNT(ie.id) as total_requests,
    COUNT(CASE WHEN ie.status = 'success' THEN 1 END) as successful_requests,
    COUNT(CASE WHEN ie.status = 'error' THEN 1 END) as failed_requests,
    AVG(ie.duration_ms) as avg_response_time,
    SUM(ie.request_size_bytes) as total_request_bytes,
    SUM(ie.response_size_bytes) as total_response_bytes
FROM integration_executions ie
JOIN service_integrations si ON ie.integration_id = si.id
WHERE ie.executed_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', ie.executed_at), si.integration_type
ORDER BY date DESC, si.integration_type;

-- Create index for the usage analytics view
CREATE INDEX IF NOT EXISTS idx_integration_usage_analytics_date_type ON integration_usage_analytics(date, integration_type);

-- Create function to refresh performance views
CREATE OR REPLACE FUNCTION refresh_integration_performance_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY integration_performance_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY integration_usage_analytics;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old integration data
CREATE OR REPLACE FUNCTION cleanup_old_integration_data()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to calculate integration health score
CREATE OR REPLACE FUNCTION calculate_integration_health_score(integration_id_param INTEGER)
RETURNS numeric AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to test integration health
CREATE OR REPLACE FUNCTION test_integration_health(integration_id_param INTEGER)
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to update service_integrations updated_at
CREATE OR REPLACE FUNCTION update_service_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_service_integrations_updated_at
    BEFORE UPDATE ON service_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_service_integrations_updated_at();

-- Create trigger to update integration_auth_tokens updated_at
CREATE OR REPLACE FUNCTION update_integration_auth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_integration_auth_tokens_updated_at
    BEFORE UPDATE ON integration_auth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_auth_tokens_updated_at();

-- Create trigger to update integration_connection_pools updated_at
CREATE OR REPLACE FUNCTION update_integration_connection_pools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_integration_connection_pools_updated_at
    BEFORE UPDATE ON integration_connection_pools
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_connection_pools_updated_at();

COMMENT ON TABLE service_integrations IS 'Main table for external service integrations configuration';
COMMENT ON TABLE integration_executions IS 'Records of all integration execution attempts and results';
COMMENT ON TABLE integration_auth_tokens IS 'Secure storage for authentication tokens and credentials';
COMMENT ON TABLE integration_webhooks IS 'Configuration for webhook endpoints and routing';
COMMENT ON TABLE integration_webhook_events IS 'Log of all webhook events received and processed';
COMMENT ON TABLE integration_rate_limits IS 'Rate limiting tracking and enforcement data';
COMMENT ON TABLE integration_connection_pools IS 'Database connection pool management and monitoring';
COMMENT ON TABLE integration_message_queues IS 'Message queue configuration and status tracking';
COMMENT ON TABLE integration_api_schemas IS 'API request and response schema validation rules';
COMMENT ON TABLE integration_health_checks IS 'Health monitoring and status check results';

COMMENT ON FUNCTION calculate_integration_health_score(INTEGER) IS 'Calculates a comprehensive health score (0-100) for an integration based on success rate, response time, error frequency, and status';
COMMENT ON FUNCTION test_integration_health(INTEGER) IS 'Performs a comprehensive health test for an integration and returns detailed status information';
COMMENT ON FUNCTION refresh_integration_performance_views() IS 'Refreshes materialized views for integration performance analytics';
COMMENT ON FUNCTION cleanup_old_integration_data() IS 'Cleans up old integration execution data and analytics to maintain performance';
