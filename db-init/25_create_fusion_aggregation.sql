-- Fusion Aggregation Engine Database Schema
-- This schema supports intelligent multi-source data fusion with conflict resolution,
-- confidence scoring, temporal analysis, and automated synthesis capabilities

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fusion data sources table
CREATE TABLE IF NOT EXISTS fusion_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('conversation', 'workflow', 'analytics', 'external')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    reliability FLOAT NOT NULL DEFAULT 0.8 CHECK (reliability >= 0 AND reliability <= 1),
    active BOOLEAN NOT NULL DEFAULT true,
    last_accessed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Performance indexes
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_fusion_sources_user_type ON fusion_sources(user_id, type);
CREATE INDEX IF NOT EXISTS idx_fusion_sources_active ON fusion_sources(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_fusion_sources_priority ON fusion_sources(priority DESC);

-- Fusion data entries table
CREATE TABLE IF NOT EXISTS fusion_data_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES fusion_sources(id) ON DELETE CASCADE,
    data_key VARCHAR(500) NOT NULL,
    data_value JSONB NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    checksum VARCHAR(64) NOT NULL,
    
    -- Prevent duplicate entries from same source
    UNIQUE(source_id, data_key, checksum)
);

CREATE INDEX IF NOT EXISTS idx_fusion_data_source_key ON fusion_data_entries(source_id, data_key);
CREATE INDEX IF NOT EXISTS idx_fusion_data_timestamp ON fusion_data_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_data_confidence ON fusion_data_entries(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_data_expires ON fusion_data_entries(expires_at) WHERE expires_at IS NOT NULL;

-- Fusion conflicts table
CREATE TABLE IF NOT EXISTS fusion_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_key VARCHAR(500) NOT NULL,
    source1_id UUID NOT NULL REFERENCES fusion_sources(id),
    source2_id UUID NOT NULL REFERENCES fusion_sources(id),
    source1_data JSONB NOT NULL,
    source2_data JSONB NOT NULL,
    source1_confidence FLOAT NOT NULL,
    source2_confidence FLOAT NOT NULL,
    conflict_type VARCHAR(50) NOT NULL CHECK (conflict_type IN ('value_mismatch', 'temporal_conflict', 'confidence_dispute', 'structural_difference')),
    resolution_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'ignored')),
    resolution_method VARCHAR(50),
    resolution_data JSONB,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_conflicts_key ON fusion_conflicts(data_key);
CREATE INDEX IF NOT EXISTS idx_fusion_conflicts_status ON fusion_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_fusion_conflicts_created ON fusion_conflicts(created_at DESC);

-- Fusion aggregation results table
CREATE TABLE IF NOT EXISTS fusion_aggregation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    query VARCHAR(1000) NOT NULL,
    source_ids UUID[] NOT NULL,
    strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('weighted_average', 'highest_confidence', 'consensus', 'temporal_priority')),
    options JSONB DEFAULT '{}',
    result_data JSONB NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    metadata JSONB DEFAULT '{}',
    execution_time_ms INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_results_user ON fusion_aggregation_results(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_results_query ON fusion_aggregation_results USING gin(to_tsvector('english', query));
CREATE INDEX IF NOT EXISTS idx_fusion_results_created ON fusion_aggregation_results(created_at DESC);

-- Fusion synthesis results table
CREATE TABLE IF NOT EXISTS fusion_synthesis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    topic VARCHAR(500) NOT NULL,
    source_count INTEGER NOT NULL,
    output_format VARCHAR(20) NOT NULL CHECK (output_format IN ('summary', 'detailed', 'structured', 'insights')),
    synthesis_data JSONB NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    insights_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_synthesis_user ON fusion_synthesis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_fusion_synthesis_topic ON fusion_synthesis_results USING gin(to_tsvector('english', topic));
CREATE INDEX IF NOT EXISTS idx_fusion_synthesis_created ON fusion_synthesis_results(created_at DESC);

-- Fusion analytics table
CREATE TABLE IF NOT EXISTS fusion_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimensions JSONB DEFAULT '{}',
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fusion_analytics_user_metric ON fusion_analytics(user_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_fusion_analytics_period ON fusion_analytics(period_start, period_end);

-- Update trigger function for fusion sources
CREATE OR REPLACE FUNCTION update_fusion_source_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to fusion sources
CREATE TRIGGER fusion_sources_update_trigger
    BEFORE UPDATE ON fusion_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_fusion_source_timestamp();

-- Function to calculate data entry checksum
CREATE OR REPLACE FUNCTION calculate_data_checksum(data_value JSONB)
RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(digest(data_value::text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to automatically calculate checksums for data entries
CREATE OR REPLACE FUNCTION set_data_entry_checksum()
RETURNS TRIGGER AS $$
BEGIN
    NEW.checksum = calculate_data_checksum(NEW.data_value);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fusion_data_checksum_trigger
    BEFORE INSERT OR UPDATE ON fusion_data_entries
    FOR EACH ROW
    EXECUTE FUNCTION set_data_entry_checksum();

-- Function to detect potential conflicts
CREATE OR REPLACE FUNCTION detect_fusion_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    existing_entry fusion_data_entries%ROWTYPE;
    conflict_id UUID;
BEGIN
    -- Check for existing entries with same data_key but different data_value
    SELECT * INTO existing_entry
    FROM fusion_data_entries fde
    JOIN fusion_sources fs ON fde.source_id = fs.id
    WHERE fde.data_key = NEW.data_key 
      AND fde.source_id != NEW.source_id
      AND fde.checksum != NEW.checksum
      AND fs.active = true
    ORDER BY fde.timestamp DESC
    LIMIT 1;
    
    -- If conflicting entry found, create conflict record
    IF FOUND THEN
        INSERT INTO fusion_conflicts (
            data_key,
            source1_id,
            source2_id,
            source1_data,
            source2_data,
            source1_confidence,
            source2_confidence,
            conflict_type
        ) VALUES (
            NEW.data_key,
            existing_entry.source_id,
            NEW.source_id,
            existing_entry.data_value,
            NEW.data_value,
            existing_entry.confidence,
            NEW.confidence,
            CASE 
                WHEN existing_entry.timestamp > NOW() - INTERVAL '1 hour' THEN 'temporal_conflict'
                WHEN ABS(existing_entry.confidence - NEW.confidence) > 0.3 THEN 'confidence_dispute'
                ELSE 'value_mismatch'
            END
        ) RETURNING id INTO conflict_id;
        
        -- Log conflict detection
        RAISE NOTICE 'Fusion conflict detected for key %, conflict ID: %', NEW.data_key, conflict_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fusion_conflict_detection_trigger
    AFTER INSERT ON fusion_data_entries
    FOR EACH ROW
    EXECUTE FUNCTION detect_fusion_conflicts();

-- Function to clean up expired data entries
CREATE OR REPLACE FUNCTION cleanup_expired_fusion_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM fusion_data_entries 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        RAISE NOTICE 'Cleaned up % expired fusion data entries', deleted_count;
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for active fusion sources with statistics
CREATE OR REPLACE VIEW fusion_sources_stats AS
SELECT 
    fs.*,
    COUNT(fde.id) as data_entries_count,
    AVG(fde.confidence) as avg_confidence,
    MAX(fde.timestamp) as last_data_entry,
    COUNT(fc1.id) + COUNT(fc2.id) as conflicts_count
FROM fusion_sources fs
LEFT JOIN fusion_data_entries fde ON fs.id = fde.source_id
LEFT JOIN fusion_conflicts fc1 ON fs.id = fc1.source1_id
LEFT JOIN fusion_conflicts fc2 ON fs.id = fc2.source2_id
WHERE fs.active = true
GROUP BY fs.id;

-- View for recent fusion activity
CREATE OR REPLACE VIEW fusion_activity_summary AS
SELECT 
    DATE(created_at) as activity_date,
    'source_registration' as activity_type,
    COUNT(*) as count
FROM fusion_sources 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)

UNION ALL

SELECT 
    DATE(timestamp) as activity_date,
    'data_entry' as activity_type,
    COUNT(*) as count
FROM fusion_data_entries 
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)

UNION ALL

SELECT 
    DATE(created_at) as activity_date,
    'aggregation' as activity_type,
    COUNT(*) as count
FROM fusion_aggregation_results 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)

UNION ALL

SELECT 
    DATE(created_at) as activity_date,
    'synthesis' as activity_type,
    COUNT(*) as count
FROM fusion_synthesis_results 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)

ORDER BY activity_date DESC, activity_type;

-- Create a materialized view for fusion analytics dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS fusion_analytics_dashboard AS
SELECT 
    fs.user_id,
    COUNT(DISTINCT fs.id) as active_sources,
    COUNT(fde.id) as total_data_entries,
    AVG(fde.confidence) as avg_confidence,
    COUNT(CASE WHEN fc.resolution_status = 'pending' THEN 1 END) as pending_conflicts,
    COUNT(CASE WHEN fc.resolution_status = 'resolved' THEN 1 END) as resolved_conflicts,
    COUNT(far.id) as total_aggregations,
    COUNT(fsr.id) as total_syntheses,
    AVG(far.execution_time_ms) as avg_aggregation_time,
    AVG(fsr.execution_time_ms) as avg_synthesis_time,
    MAX(fde.timestamp) as last_activity
FROM fusion_sources fs
LEFT JOIN fusion_data_entries fde ON fs.id = fde.source_id
LEFT JOIN fusion_conflicts fc ON fs.id IN (fc.source1_id, fc.source2_id)
LEFT JOIN fusion_aggregation_results far ON fs.user_id = far.user_id
LEFT JOIN fusion_synthesis_results fsr ON fs.user_id = fsr.user_id
WHERE fs.active = true
GROUP BY fs.user_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_fusion_analytics_dashboard_user 
ON fusion_analytics_dashboard(user_id);

-- Function to refresh analytics dashboard
CREATE OR REPLACE FUNCTION refresh_fusion_analytics_dashboard()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY fusion_analytics_dashboard;
    RAISE NOTICE 'Fusion analytics dashboard refreshed';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your user roles)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated_users;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated_users;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated_users;

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fusion_data_entries_gin_data_value 
ON fusion_data_entries USING gin(data_value);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fusion_conflicts_sources 
ON fusion_conflicts(source1_id, source2_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fusion_results_confidence 
ON fusion_aggregation_results(confidence DESC);

-- Add comments for documentation
COMMENT ON TABLE fusion_sources IS 'Registered data sources for fusion aggregation with priority and reliability scoring';
COMMENT ON TABLE fusion_data_entries IS 'Individual data entries from sources with confidence scores and metadata';
COMMENT ON TABLE fusion_conflicts IS 'Detected conflicts between data sources requiring resolution';
COMMENT ON TABLE fusion_aggregation_results IS 'Results of fusion aggregation operations with performance metrics';
COMMENT ON TABLE fusion_synthesis_results IS 'Results of information synthesis operations with insights';
COMMENT ON TABLE fusion_analytics IS 'Analytics metrics for fusion engine performance monitoring';

COMMENT ON COLUMN fusion_sources.priority IS 'Source priority (1-10, higher is more important)';
COMMENT ON COLUMN fusion_sources.reliability IS 'Source reliability score (0-1, higher is more reliable)';
COMMENT ON COLUMN fusion_data_entries.confidence IS 'Confidence score for this data entry (0-1)';
COMMENT ON COLUMN fusion_data_entries.checksum IS 'SHA256 checksum of data_value for conflict detection';

-- Insert initial system analytics metrics
INSERT INTO fusion_analytics (
    user_id, 
    metric_name, 
    metric_value, 
    dimensions,
    period_start, 
    period_end
) VALUES 
(uuid_generate_v4(), 'system_initialized', 1, '{"version": "1.0.0", "schema_version": "1.0"}', NOW(), NOW())
ON CONFLICT DO NOTHING;

COMMIT;
