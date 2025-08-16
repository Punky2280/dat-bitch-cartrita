-- Task 14: Edge Computing Infrastructure Database Schema
-- Creates tables for distributed edge computing, CDN management, and geographic routing

BEGIN;

-- Edge node status enum
CREATE TYPE edge_node_status AS ENUM ('active', 'inactive', 'maintenance', 'failed');

-- CDN provider status enum
CREATE TYPE provider_status AS ENUM ('active', 'inactive', 'error');

-- Edge Nodes Table
CREATE TABLE edge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location JSONB NOT NULL, -- {country, region, city, coordinates}
    endpoint_url VARCHAR(512) NOT NULL,
    status edge_node_status DEFAULT 'active',
    capabilities JSONB DEFAULT '{}', -- supported features/limits
    resources JSONB DEFAULT '{}', -- CPU, memory, storage specs
    health_metrics JSONB DEFAULT '{}',
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for edge nodes
CREATE INDEX idx_edge_nodes_location ON edge_nodes USING gin(location);
CREATE INDEX idx_edge_nodes_status ON edge_nodes(status);
CREATE INDEX idx_edge_nodes_heartbeat ON edge_nodes(last_heartbeat);

-- CDN Providers Table
CREATE TABLE cdn_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    provider_type VARCHAR(50) NOT NULL, -- cloudflare, aws_cloudfront, azure_cdn
    configuration JSONB NOT NULL,
    api_credentials JSONB NOT NULL,
    regions JSONB DEFAULT '[]',
    status provider_status DEFAULT 'active',
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for CDN providers
CREATE INDEX idx_cdn_providers_type ON cdn_providers(provider_type);
CREATE INDEX idx_cdn_providers_status ON cdn_providers(status);

-- Edge Cache Entries Table
CREATE TABLE edge_cache_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(512) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    edge_node_id UUID REFERENCES edge_nodes(id) ON DELETE CASCADE,
    content_type VARCHAR(100),
    content_size BIGINT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed TIMESTAMP DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    cache_tags JSONB DEFAULT '[]'
);

-- Indexes for cache entries
CREATE INDEX idx_cache_key ON edge_cache_entries(cache_key);
CREATE INDEX idx_edge_node_cache ON edge_cache_entries(edge_node_id);
CREATE INDEX idx_cache_expires ON edge_cache_entries(expires_at);
CREATE INDEX idx_cache_hash ON edge_cache_entries(content_hash);

-- Geographic Routing Table
CREATE TABLE geographic_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_region VARCHAR(100) NOT NULL,
    target_edge_node_id UUID REFERENCES edge_nodes(id) ON DELETE CASCADE,
    routing_weight INTEGER DEFAULT 100,
    latency_threshold_ms INTEGER DEFAULT 200,
    failover_node_id UUID REFERENCES edge_nodes(id) ON DELETE SET NULL,
    route_conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for geographic routing
CREATE INDEX idx_geographic_routes_region ON geographic_routes(source_region);
CREATE INDEX idx_geographic_routes_active ON geographic_routes(is_active);
CREATE INDEX idx_geographic_routes_target ON geographic_routes(target_edge_node_id);

-- Edge Performance Metrics Table
CREATE TABLE edge_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edge_node_id UUID REFERENCES edge_nodes(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- latency, throughput, cpu_usage, memory_usage
    metric_value DECIMAL(10,3) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL, -- ms, mbps, percent, bytes
    client_location JSONB,
    recorded_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance metrics
CREATE INDEX idx_performance_metrics_node_type ON edge_performance_metrics(edge_node_id, metric_type);
CREATE INDEX idx_performance_metrics_time ON edge_performance_metrics(recorded_at);
CREATE INDEX idx_performance_metrics_node ON edge_performance_metrics(edge_node_id);

-- CDN Cache Invalidation Requests Table
CREATE TABLE cdn_cache_invalidation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES cdn_providers(id) ON DELETE CASCADE,
    cache_keys TEXT[] NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    request_id VARCHAR(255), -- Provider-specific request ID
    initiated_by UUID, -- user who requested invalidation
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Indexes for cache invalidation
CREATE INDEX idx_cache_invalidation_provider ON cdn_cache_invalidation_requests(provider_id);
CREATE INDEX idx_cache_invalidation_status ON cdn_cache_invalidation_requests(status);
CREATE INDEX idx_cache_invalidation_created ON cdn_cache_invalidation_requests(created_at);

-- Edge Node Health Check Log Table
CREATE TABLE edge_node_health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edge_node_id UUID REFERENCES edge_nodes(id) ON DELETE CASCADE,
    health_score DECIMAL(5,2) NOT NULL, -- 0-100 health score
    response_time_ms INTEGER,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    network_latency_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    warnings JSONB DEFAULT '[]',
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for health logs
CREATE INDEX idx_health_logs_node ON edge_node_health_logs(edge_node_id);
CREATE INDEX idx_health_logs_time ON edge_node_health_logs(recorded_at);
CREATE INDEX idx_health_logs_score ON edge_node_health_logs(health_score);

-- Edge Load Balancer Rules Table
CREATE TABLE edge_load_balancer_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- round_robin, weighted, latency_based, geo_proximity
    target_nodes UUID[] NOT NULL, -- Array of edge node IDs
    weights INTEGER[] DEFAULT '{}', -- Corresponding weights for weighted routing
    conditions JSONB DEFAULT '{}', -- Routing conditions and filters
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for load balancer rules
CREATE INDEX idx_lb_rules_type ON edge_load_balancer_rules(rule_type);
CREATE INDEX idx_lb_rules_active ON edge_load_balancer_rules(is_active);
CREATE INDEX idx_lb_rules_priority ON edge_load_balancer_rules(priority);

-- Edge Configuration Templates Table
CREATE TABLE edge_configuration_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(255) NOT NULL UNIQUE,
    template_version VARCHAR(50) DEFAULT '1.0',
    configuration JSONB NOT NULL,
    description TEXT,
    applicable_node_types JSONB DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for configuration templates
CREATE INDEX idx_config_templates_name ON edge_configuration_templates(template_name);
CREATE INDEX idx_config_templates_default ON edge_configuration_templates(is_default);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER edge_nodes_updated_at BEFORE UPDATE ON edge_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER cdn_providers_updated_at BEFORE UPDATE ON cdn_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER geographic_routes_updated_at BEFORE UPDATE ON geographic_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER edge_load_balancer_rules_updated_at BEFORE UPDATE ON edge_load_balancer_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER edge_configuration_templates_updated_at BEFORE UPDATE ON edge_configuration_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration template
INSERT INTO edge_configuration_templates (
    template_name,
    template_version,
    configuration,
    description,
    is_default
) VALUES (
    'standard-edge-node',
    '1.0',
    '{
        "cache_size_mb": 1024,
        "max_connections": 1000,
        "timeout_seconds": 30,
        "compression_enabled": true,
        "ssl_enabled": true,
        "monitoring_enabled": true,
        "health_check_interval": 30,
        "cache_ttl_default": 3600
    }',
    'Standard configuration for edge nodes with balanced performance and resource usage',
    true
);

COMMIT;
