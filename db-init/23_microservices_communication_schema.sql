-- Migration: Advanced Microservices Communication Platform Schema
-- Task 16 Database Schema for Service Mesh, Message Queues, Event Sourcing, Circuit Breakers
-- Version: 23
-- Created: 2024

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ================================
-- SERVICE MESH TABLES
-- ================================

-- Service Registry
CREATE TABLE IF NOT EXISTS service_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) DEFAULT '1.0.0',
    address INET NOT NULL,
    port INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
    protocol VARCHAR(20) NOT NULL CHECK (protocol IN ('http', 'https', 'grpc', 'tcp', 'udp')),
    health_check_path TEXT,
    health_check_interval INTEGER DEFAULT 30000,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    load_balancing_weight INTEGER DEFAULT 100 CHECK (load_balancing_weight > 0 AND load_balancing_weight <= 1000),
    is_healthy BOOLEAN DEFAULT true,
    last_health_check TIMESTAMP WITH TIME ZONE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deregistered_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) DEFAULT 'system',
    
    CONSTRAINT unique_service_address UNIQUE (name, version, address, port),
    CONSTRAINT valid_health_check_interval CHECK (health_check_interval >= 5000)
);

-- Service Discovery Cache
CREATE TABLE IF NOT EXISTS service_discovery_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(255) NOT NULL,
    service_version VARCHAR(50),
    discovery_key VARCHAR(500) NOT NULL,
    cached_services JSONB NOT NULL,
    filters_applied JSONB DEFAULT '{}',
    cache_hit_count BIGINT DEFAULT 0,
    last_hit TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    CONSTRAINT unique_discovery_key UNIQUE (discovery_key)
);

-- Load Balancing Statistics
CREATE TABLE IF NOT EXISTS load_balancing_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES service_registry(id) ON DELETE CASCADE,
    algorithm VARCHAR(50) NOT NULL CHECK (algorithm IN ('round-robin', 'weighted', 'least-connections', 'ip-hash')),
    total_requests BIGINT DEFAULT 0,
    successful_requests BIGINT DEFAULT 0,
    failed_requests BIGINT DEFAULT 0,
    average_response_time DECIMAL(10,3) DEFAULT 0,
    current_connections INTEGER DEFAULT 0,
    max_connections INTEGER DEFAULT 0,
    last_selected TIMESTAMP WITH TIME ZONE,
    stats_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stats_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic Splitting Rules
CREATE TABLE IF NOT EXISTS traffic_splitting_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(255) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    version_weights JSONB NOT NULL, -- {"v1": 80, "v2": 20}
    conditions JSONB DEFAULT '{}', -- Additional routing conditions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system',
    
    CONSTRAINT unique_service_rule UNIQUE (service_name, rule_name)
);

-- ================================
-- MESSAGE QUEUE TABLES
-- ================================

-- Queue Definitions
CREATE TABLE IF NOT EXISTS message_queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    is_durable BOOLEAN DEFAULT true,
    max_size BIGINT DEFAULT 10000,
    message_ttl BIGINT DEFAULT 86400000, -- 24 hours in ms
    dead_letter_queue_name VARCHAR(255),
    max_retries INTEGER DEFAULT 3,
    retry_delay BIGINT DEFAULT 5000, -- 5 seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system'
);

-- Queue Messages
CREATE TABLE IF NOT EXISTS queue_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID REFERENCES message_queues(id) ON DELETE CASCADE,
    message_data JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    correlation_id UUID,
    causation_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) DEFAULT 'system',
    
    CONSTRAINT valid_retry_count CHECK (retry_count <= max_retries)
);

-- Pub/Sub Topics
CREATE TABLE IF NOT EXISTS pubsub_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    is_durable BOOLEAN DEFAULT true,
    partition_count INTEGER DEFAULT 1 CHECK (partition_count > 0 AND partition_count <= 100),
    retention_period BIGINT DEFAULT 604800000, -- 7 days in ms
    compression_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system'
);

-- Topic Subscriptions
CREATE TABLE IF NOT EXISTS topic_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES pubsub_topics(id) ON DELETE CASCADE,
    subscriber_id VARCHAR(255) NOT NULL,
    subscription_name VARCHAR(255),
    callback_url TEXT,
    filter_conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_message_offset BIGINT DEFAULT 0,
    messages_processed BIGINT DEFAULT 0,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_topic_subscriber UNIQUE (topic_id, subscriber_id)
);

-- Published Messages
CREATE TABLE IF NOT EXISTS published_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES pubsub_topics(id) ON DELETE CASCADE,
    partition_key VARCHAR(255),
    message_data JSONB NOT NULL,
    headers JSONB DEFAULT '{}',
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_offset BIGINT NOT NULL,
    correlation_id UUID,
    publisher_id VARCHAR(255) DEFAULT 'system',
    
    CONSTRAINT unique_topic_offset UNIQUE (topic_id, message_offset)
);

-- ================================
-- EVENT SOURCING TABLES
-- ================================

-- Event Store
CREATE TABLE IF NOT EXISTS event_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_version INTEGER NOT NULL CHECK (event_version > 0),
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    correlation_id UUID,
    causation_id UUID,
    stream_name VARCHAR(255),
    expected_version INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system',
    
    CONSTRAINT unique_aggregate_version UNIQUE (aggregate_id, event_version)
);

-- Event Snapshots
CREATE TABLE IF NOT EXISTS event_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    snapshot_version INTEGER NOT NULL CHECK (snapshot_version > 0),
    snapshot_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system',
    
    CONSTRAINT unique_aggregate_snapshot UNIQUE (aggregate_id, snapshot_version)
);

-- Event Projections
CREATE TABLE IF NOT EXISTS event_projections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projection_name VARCHAR(255) NOT NULL UNIQUE,
    projection_type VARCHAR(100) NOT NULL,
    event_types TEXT[] DEFAULT '{}',
    last_processed_event_id UUID,
    last_processed_version BIGINT DEFAULT 0,
    projection_state JSONB DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    is_catching_up BOOLEAN DEFAULT false,
    events_processed BIGINT DEFAULT 0,
    last_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system'
);

-- Event Stream Subscriptions
CREATE TABLE IF NOT EXISTS event_stream_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id VARCHAR(255) NOT NULL UNIQUE,
    stream_name VARCHAR(255) NOT NULL,
    subscriber_callback TEXT,
    from_position BIGINT DEFAULT 0,
    last_processed_position BIGINT DEFAULT 0,
    batch_size INTEGER DEFAULT 1 CHECK (batch_size > 0 AND batch_size <= 1000),
    is_catch_up BOOLEAN DEFAULT true,
    is_live_only BOOLEAN DEFAULT false,
    filter_conditions JSONB DEFAULT '{}',
    events_processed BIGINT DEFAULT 0,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- CIRCUIT BREAKER TABLES
-- ================================

-- Circuit Breaker Definitions
CREATE TABLE IF NOT EXISTS circuit_breakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    timeout_ms BIGINT DEFAULT 30000 CHECK (timeout_ms >= 1000),
    failure_threshold INTEGER DEFAULT 5 CHECK (failure_threshold > 0),
    success_threshold INTEGER DEFAULT 3 CHECK (success_threshold > 0),
    recovery_timeout_ms BIGINT DEFAULT 60000 CHECK (recovery_timeout_ms >= 5000),
    max_concurrent_calls INTEGER DEFAULT 100 CHECK (max_concurrent_calls > 0),
    is_enabled BOOLEAN DEFAULT true,
    bulkhead_enabled BOOLEAN DEFAULT true,
    health_check_enabled BOOLEAN DEFAULT true,
    fallback_enabled BOOLEAN DEFAULT true,
    adaptive_thresholds BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system'
);

-- Circuit Breaker State
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    circuit_id UUID PRIMARY KEY REFERENCES circuit_breakers(id) ON DELETE CASCADE,
    current_state VARCHAR(20) DEFAULT 'CLOSED' CHECK (current_state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_failure_time TIMESTAMP WITH TIME ZONE,
    last_state_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_retry_time TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circuit Breaker Statistics
CREATE TABLE IF NOT EXISTS circuit_breaker_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circuit_id UUID REFERENCES circuit_breakers(id) ON DELETE CASCADE,
    total_calls BIGINT DEFAULT 0,
    successful_calls BIGINT DEFAULT 0,
    failed_calls BIGINT DEFAULT 0,
    rejected_calls BIGINT DEFAULT 0,
    timeout_calls BIGINT DEFAULT 0,
    fallback_calls BIGINT DEFAULT 0,
    average_response_time DECIMAL(10,3) DEFAULT 0,
    failure_rate DECIMAL(5,2) DEFAULT 0,
    stats_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stats_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circuit Breaker History
CREATE TABLE IF NOT EXISTS circuit_breaker_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circuit_id UUID REFERENCES circuit_breakers(id) ON DELETE CASCADE,
    previous_state VARCHAR(20) NOT NULL,
    new_state VARCHAR(20) NOT NULL,
    trigger_event VARCHAR(100) NOT NULL, -- 'failure_threshold_reached', 'recovery_timeout', 'manual_reset', etc.
    failure_count INTEGER,
    success_count INTEGER,
    context_data JSONB DEFAULT '{}',
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health Check Status
CREATE TABLE IF NOT EXISTS health_check_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(255) NOT NULL,
    circuit_id UUID REFERENCES circuit_breakers(id) ON DELETE SET NULL,
    is_healthy BOOLEAN DEFAULT true,
    last_check_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    check_duration_ms BIGINT,
    error_message TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    consecutive_successes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_service_health UNIQUE (service_name)
);

-- ================================
-- PERFORMANCE METRICS TABLES
-- ================================

-- System Metrics Aggregation
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(100) NOT NULL, -- 'service_mesh', 'grpc', 'message_queue', 'event_sourcing', 'circuit_breaker'
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(50),
    tags JSONB DEFAULT '{}',
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    collection_period_minutes INTEGER DEFAULT 1,
    
    CONSTRAINT valid_collection_period CHECK (collection_period_minutes > 0)
);

-- Performance Monitoring Windows
CREATE TABLE IF NOT EXISTS performance_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_name VARCHAR(255) NOT NULL, -- service name, circuit name, etc.
    component_type VARCHAR(100) NOT NULL, -- 'service', 'circuit', 'queue', 'topic'
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    operation_count BIGINT DEFAULT 0,
    success_count BIGINT DEFAULT 0,
    failure_count BIGINT DEFAULT 0,
    average_duration_ms DECIMAL(10,3) DEFAULT 0,
    min_duration_ms BIGINT DEFAULT 0,
    max_duration_ms BIGINT DEFAULT 0,
    p50_duration_ms DECIMAL(10,3) DEFAULT 0,
    p95_duration_ms DECIMAL(10,3) DEFAULT 0,
    p99_duration_ms DECIMAL(10,3) DEFAULT 0,
    throughput_per_second DECIMAL(10,3) DEFAULT 0,
    error_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_component_window UNIQUE (component_name, component_type, window_start),
    CONSTRAINT valid_window_period CHECK (window_end > window_start)
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Service Registry Indexes
CREATE INDEX IF NOT EXISTS idx_service_registry_name_version ON service_registry (name, version);
CREATE INDEX IF NOT EXISTS idx_service_registry_healthy ON service_registry (is_healthy) WHERE is_healthy = true;
CREATE INDEX IF NOT EXISTS idx_service_registry_protocol ON service_registry (protocol);
CREATE INDEX IF NOT EXISTS idx_service_registry_tags ON service_registry USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_service_registry_metadata ON service_registry USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_service_registry_updated ON service_registry (updated_at DESC);

-- Message Queue Indexes
CREATE INDEX IF NOT EXISTS idx_queue_messages_queue_status ON queue_messages (queue_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_messages_scheduled ON queue_messages (scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_queue_messages_priority ON queue_messages (priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_queue_messages_correlation ON queue_messages (correlation_id);
CREATE INDEX IF NOT EXISTS idx_published_messages_topic_offset ON published_messages (topic_id, message_offset DESC);
CREATE INDEX IF NOT EXISTS idx_topic_subscriptions_active ON topic_subscriptions (topic_id, is_active) WHERE is_active = true;

-- Event Sourcing Indexes
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate ON event_store (aggregate_id, event_version ASC);
CREATE INDEX IF NOT EXISTS idx_event_store_type ON event_store (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_store_stream ON event_store (stream_name, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_event_store_correlation ON event_store (correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_snapshots_aggregate ON event_snapshots (aggregate_id, snapshot_version DESC);
CREATE INDEX IF NOT EXISTS idx_event_projections_enabled ON event_projections (is_enabled) WHERE is_enabled = true;

-- Circuit Breaker Indexes
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state_circuit ON circuit_breaker_state (circuit_id);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_history_circuit_time ON circuit_breaker_history (circuit_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_check_service ON health_check_status (service_name, last_check_time DESC);

-- Performance Metrics Indexes
CREATE INDEX IF NOT EXISTS idx_system_metrics_type_name ON system_metrics (metric_type, metric_name, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_windows_component ON performance_windows (component_name, component_type, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags ON system_metrics USING gin (tags);

-- ================================
-- FUNCTIONS AND TRIGGERS
-- ================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS trigger_service_registry_updated_at ON service_registry;
CREATE TRIGGER trigger_service_registry_updated_at
    BEFORE UPDATE ON service_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_message_queues_updated_at ON message_queues;
CREATE TRIGGER trigger_message_queues_updated_at
    BEFORE UPDATE ON message_queues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_topic_subscriptions_updated_at ON topic_subscriptions;
CREATE TRIGGER trigger_topic_subscriptions_updated_at
    BEFORE UPDATE ON topic_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_circuit_breakers_updated_at ON circuit_breakers;
CREATE TRIGGER trigger_circuit_breakers_updated_at
    BEFORE UPDATE ON circuit_breakers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_circuit_breaker_state_updated_at ON circuit_breaker_state;
CREATE TRIGGER trigger_circuit_breaker_state_updated_at
    BEFORE UPDATE ON circuit_breaker_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Service health check function
CREATE OR REPLACE FUNCTION update_service_health_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update service registry health status when health check status changes
    UPDATE service_registry 
    SET is_healthy = NEW.is_healthy,
        last_health_check = NEW.last_check_time
    WHERE name = NEW.service_name;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_service_health ON health_check_status;
CREATE TRIGGER trigger_update_service_health
    AFTER UPDATE ON health_check_status
    FOR EACH ROW EXECUTE FUNCTION update_service_health_status();

-- Circuit breaker state change logging
CREATE OR REPLACE FUNCTION log_circuit_breaker_state_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the state actually changed
    IF OLD.current_state IS DISTINCT FROM NEW.current_state THEN
        INSERT INTO circuit_breaker_history (
            circuit_id,
            previous_state,
            new_state,
            trigger_event,
            failure_count,
            success_count,
            context_data
        ) VALUES (
            NEW.circuit_id,
            COALESCE(OLD.current_state, 'UNKNOWN'),
            NEW.current_state,
            CASE 
                WHEN NEW.current_state = 'OPEN' THEN 'failure_threshold_reached'
                WHEN NEW.current_state = 'HALF_OPEN' THEN 'recovery_timeout'
                WHEN NEW.current_state = 'CLOSED' THEN 'success_threshold_reached'
                ELSE 'unknown_trigger'
            END,
            NEW.failure_count,
            NEW.success_count,
            jsonb_build_object(
                'last_failure_time', NEW.last_failure_time,
                'last_state_change', NEW.last_state_change
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_log_circuit_breaker_state_change ON circuit_breaker_state;
CREATE TRIGGER trigger_log_circuit_breaker_state_change
    AFTER UPDATE ON circuit_breaker_state
    FOR EACH ROW EXECUTE FUNCTION log_circuit_breaker_state_change();

-- ================================
-- INITIAL DATA / SEED DATA
-- ================================

-- Insert default circuit breakers
INSERT INTO circuit_breakers (name, timeout_ms, failure_threshold, success_threshold, recovery_timeout_ms, max_concurrent_calls, is_enabled)
VALUES 
    ('database', 5000, 3, 3, 30000, 50, true),
    ('external-api', 10000, 5, 3, 60000, 20, true),
    ('message-queue', 3000, 2, 2, 15000, 100, true),
    ('file-storage', 15000, 4, 3, 45000, 10, true)
ON CONFLICT (name) DO NOTHING;

-- Insert circuit breaker initial states
INSERT INTO circuit_breaker_state (circuit_id, current_state, failure_count, success_count)
SELECT id, 'CLOSED', 0, 0 
FROM circuit_breakers
ON CONFLICT (circuit_id) DO NOTHING;

-- Insert default message queues
INSERT INTO message_queues (name, priority, is_durable, max_size)
VALUES 
    ('default', 'normal', true, 10000),
    ('high-priority', 'high', true, 5000),
    ('background-tasks', 'low', true, 50000),
    ('dead-letters', 'critical', true, 1000)
ON CONFLICT (name) DO NOTHING;

-- Insert default pub/sub topics
INSERT INTO pubsub_topics (name, is_durable, partition_count)
VALUES 
    ('system-events', true, 3),
    ('user-events', true, 5),
    ('notifications', true, 2),
    ('audit-logs', true, 1)
ON CONFLICT (name) DO NOTHING;

-- ================================
-- COMMENTS AND DOCUMENTATION
-- ================================

COMMENT ON TABLE service_registry IS 'Service mesh registry for tracking all microservices and their health status';
COMMENT ON TABLE message_queues IS 'Queue definitions for the message queue engine';
COMMENT ON TABLE queue_messages IS 'Individual messages in queues with processing status and retry logic';
COMMENT ON TABLE pubsub_topics IS 'Topics for publish/subscribe messaging patterns';
COMMENT ON TABLE event_store IS 'Event sourcing event store with aggregate versioning';
COMMENT ON TABLE event_snapshots IS 'Aggregate snapshots for event sourcing performance optimization';
COMMENT ON TABLE circuit_breakers IS 'Circuit breaker definitions with configuration parameters';
COMMENT ON TABLE circuit_breaker_state IS 'Current state tracking for each circuit breaker';
COMMENT ON TABLE system_metrics IS 'Aggregated system performance metrics across all components';
COMMENT ON TABLE performance_windows IS 'Time-windowed performance data for trend analysis';

COMMENT ON COLUMN service_registry.load_balancing_weight IS 'Weight for load balancing (1-1000, higher = more traffic)';
COMMENT ON COLUMN queue_messages.scheduled_for IS 'When this message should be processed (supports delayed messages)';
COMMENT ON COLUMN event_store.expected_version IS 'Expected aggregate version for optimistic concurrency control';
COMMENT ON COLUMN circuit_breaker_state.next_retry_time IS 'When the circuit breaker should attempt to transition from OPEN to HALF_OPEN';

-- Grant permissions (adjust as needed for your security model)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cartrita_backend;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cartrita_backend;
