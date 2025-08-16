-- Advanced Search Analytics Schema
-- Tracks search queries, performance, and user patterns for optimization
-- @author Robbie Allen - Lead Architect
-- @date January 2025

-- Search analytics table for tracking search queries and performance
CREATE TABLE IF NOT EXISTS search_analytics (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_time_ms INTEGER DEFAULT 0,
    confidence_score NUMERIC(3,2) DEFAULT 0.0,
    search_types JSONB DEFAULT '[]',
    sources JSONB DEFAULT '[]',
    filters JSONB DEFAULT '{}',
    facets_used JSONB DEFAULT '[]',
    clicked_result_id TEXT,
    clicked_result_position INTEGER,
    session_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for search analytics performance
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics USING gin(to_tsvector('english', query));
CREATE INDEX IF NOT EXISTS idx_search_analytics_search_types ON search_analytics USING gin(search_types);
CREATE INDEX IF NOT EXISTS idx_search_analytics_sources ON search_analytics USING gin(sources);

-- Search query suggestions table
CREATE TABLE IF NOT EXISTS search_suggestions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    suggestion TEXT NOT NULL,
    suggestion_type VARCHAR(50) DEFAULT 'query',
    popularity_score NUMERIC(5,2) DEFAULT 0.0,
    source_type VARCHAR(50), -- 'knowledge', 'conversation', 'workflow', etc.
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for search suggestions
CREATE INDEX IF NOT EXISTS idx_search_suggestions_user_id ON search_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_type ON search_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_popularity ON search_suggestions(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_text ON search_suggestions USING gin(to_tsvector('english', suggestion));

-- Search performance metrics table
CREATE TABLE IF NOT EXISTS search_performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(10,4) NOT NULL,
    metric_type VARCHAR(50) DEFAULT 'gauge', -- 'gauge', 'counter', 'histogram'
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for search performance metrics
CREATE INDEX IF NOT EXISTS idx_search_performance_metrics_name ON search_performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_search_performance_metrics_recorded_at ON search_performance_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_search_performance_metrics_tags ON search_performance_metrics USING gin(tags);

-- Search result clicks table for tracking user engagement
CREATE TABLE IF NOT EXISTS search_result_clicks (
    id BIGSERIAL PRIMARY KEY,
    search_id BIGINT REFERENCES search_analytics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    result_id TEXT NOT NULL,
    result_type VARCHAR(50) NOT NULL,
    result_position INTEGER NOT NULL,
    result_score NUMERIC(5,4),
    time_to_click_ms INTEGER,
    session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for search result clicks
CREATE INDEX IF NOT EXISTS idx_search_result_clicks_search_id ON search_result_clicks(search_id);
CREATE INDEX IF NOT EXISTS idx_search_result_clicks_user_id ON search_result_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_search_result_clicks_result_id ON search_result_clicks(result_id);
CREATE INDEX IF NOT EXISTS idx_search_result_clicks_created_at ON search_result_clicks(created_at);

-- Search index statistics table
CREATE TABLE IF NOT EXISTS search_index_statistics (
    id BIGSERIAL PRIMARY KEY,
    index_name VARCHAR(100) NOT NULL,
    index_type VARCHAR(50) NOT NULL, -- 'knowledge', 'conversation', 'workflow', etc.
    document_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    avg_document_size NUMERIC(8,2) DEFAULT 0.0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_rebuilt TIMESTAMP WITH TIME ZONE,
    rebuild_duration_ms INTEGER,
    health_status VARCHAR(20) DEFAULT 'healthy',
    metadata JSONB DEFAULT '{}'
);

-- Index for search index statistics
CREATE INDEX IF NOT EXISTS idx_search_index_statistics_name ON search_index_statistics(index_name);
CREATE INDEX IF NOT EXISTS idx_search_index_statistics_type ON search_index_statistics(index_type);
CREATE INDEX IF NOT EXISTS idx_search_index_statistics_updated ON search_index_statistics(last_updated);

-- Functions for search analytics

-- Function to calculate search popularity scores
CREATE OR REPLACE FUNCTION calculate_search_popularity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update suggestion popularity based on search frequency
    INSERT INTO search_suggestions (user_id, suggestion, suggestion_type, popularity_score, source_type)
    VALUES (NEW.user_id, NEW.query, 'query', 1.0, 'search_history')
    ON CONFLICT (user_id, suggestion, suggestion_type)
    DO UPDATE SET 
        popularity_score = search_suggestions.popularity_score + 0.1,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search popularity
DROP TRIGGER IF EXISTS trigger_calculate_search_popularity ON search_analytics;
CREATE TRIGGER trigger_calculate_search_popularity
    AFTER INSERT ON search_analytics
    FOR EACH ROW
    EXECUTE FUNCTION calculate_search_popularity();

-- Function to clean old search analytics (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_search_analytics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM search_analytics 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also clean old search result clicks
    DELETE FROM search_result_clicks 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    -- Clean old performance metrics (keep last 30 days)
    DELETE FROM search_performance_metrics 
    WHERE recorded_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Views for search analytics dashboards

-- Search performance summary view
CREATE OR REPLACE VIEW search_performance_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_searches,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(search_time_ms) as avg_response_time,
    AVG(confidence_score) as avg_confidence,
    AVG(results_count) as avg_results_count,
    COUNT(*) FILTER (WHERE results_count = 0) as zero_result_searches,
    COUNT(*) FILTER (WHERE confidence_score >= 0.8) as high_confidence_searches
FROM search_analytics
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Popular search terms view
CREATE OR REPLACE VIEW popular_search_terms AS
SELECT 
    query,
    COUNT(*) as search_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(results_count) as avg_results,
    AVG(confidence_score) as avg_confidence,
    MAX(created_at) as last_searched
FROM search_analytics
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY query
HAVING COUNT(*) >= 2
ORDER BY search_count DESC
LIMIT 50;

-- Search source usage view
CREATE OR REPLACE VIEW search_source_usage AS
SELECT 
    source,
    COUNT(*) as usage_count,
    AVG(confidence_score) as avg_confidence
FROM search_analytics sa,
LATERAL jsonb_array_elements_text(sa.sources) as source
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY source
ORDER BY usage_count DESC;

-- User search behavior view
CREATE OR REPLACE VIEW user_search_behavior AS
SELECT 
    u.email,
    COUNT(sa.id) as total_searches,
    AVG(sa.search_time_ms) as avg_response_time,
    AVG(sa.confidence_score) as avg_confidence,
    COUNT(DISTINCT sa.query) as unique_queries,
    COUNT(src.id) as total_clicks,
    CASE 
        WHEN COUNT(sa.id) > 0 THEN COUNT(src.id)::NUMERIC / COUNT(sa.id)
        ELSE 0 
    END as click_through_rate,
    MAX(sa.created_at) as last_search
FROM users u
LEFT JOIN search_analytics sa ON u.id = sa.user_id
LEFT JOIN search_result_clicks src ON sa.id = src.search_id
WHERE sa.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' OR sa.created_at IS NULL
GROUP BY u.id, u.email
HAVING COUNT(sa.id) > 0
ORDER BY total_searches DESC;

-- Comment for documentation
COMMENT ON TABLE search_analytics IS 'Tracks all search queries and their performance metrics for optimization and analytics';
COMMENT ON TABLE search_suggestions IS 'Stores search suggestions based on user behavior and popular queries';
COMMENT ON TABLE search_performance_metrics IS 'System-level performance metrics for search service monitoring';
COMMENT ON TABLE search_result_clicks IS 'Tracks user clicks on search results for relevance optimization';
COMMENT ON TABLE search_index_statistics IS 'Statistics about search indexes for monitoring and maintenance';

COMMENT ON VIEW search_performance_summary IS 'Daily aggregated search performance metrics';
COMMENT ON VIEW popular_search_terms IS 'Most frequently searched terms with performance stats';
COMMENT ON VIEW search_source_usage IS 'Usage statistics by search source type';
COMMENT ON VIEW user_search_behavior IS 'Individual user search patterns and engagement metrics';
