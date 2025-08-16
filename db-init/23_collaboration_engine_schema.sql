-- Migration 23: Real-time Collaboration Engine Schema - Task 17
-- Database schema for collaborative documents, presence tracking, and conflict resolution
-- Version: PostgreSQL 13+ with pgvector extension

-- Collaborative Documents Table
-- Stores the current state and metadata for collaborative documents
CREATE TABLE IF NOT EXISTS collaborative_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    current_content TEXT NOT NULL DEFAULT '',
    current_revision INTEGER NOT NULL DEFAULT 0,
    owner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_locked BOOLEAN DEFAULT FALSE,
    locked_by UUID,
    locked_at TIMESTAMP WITH TIME ZONE,
    lock_expires_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_collaborative_documents_owner FOREIGN KEY (owner_id) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_collaborative_documents_locked_by FOREIGN KEY (locked_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

-- Document Revisions Table
-- Stores the complete history of document changes for operational transform
CREATE TABLE IF NOT EXISTS document_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(255) NOT NULL,
    revision_number INTEGER NOT NULL,
    content_snapshot TEXT NOT NULL,
    change_operations JSONB NOT NULL, -- Array of operations for this revision
    author_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    parent_revision INTEGER,
    is_merged BOOLEAN DEFAULT FALSE,
    merge_base_revision INTEGER,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_document_revisions_document 
        FOREIGN KEY (document_id) REFERENCES collaborative_documents(document_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_document_revisions_author FOREIGN KEY (author_id) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(document_id, revision_number)
);

-- Document Operations Table
-- Individual operations within document changes for detailed tracking
CREATE TABLE IF NOT EXISTS document_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL,
    operation_index INTEGER NOT NULL,
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('insert', 'delete', 'retain')),
    operation_position INTEGER NOT NULL,
    operation_length INTEGER,
    operation_text TEXT,
    transformed_position INTEGER,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_document_operations_revision FOREIGN KEY (revision_id) 
        REFERENCES document_revisions(id) ON DELETE CASCADE,
    
    UNIQUE(revision_id, operation_index)
);

-- Document Collaborators Table
-- Tracks users with access to collaborative documents and their permissions
CREATE TABLE IF NOT EXISTS document_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT ARRAY['read'],
    role VARCHAR(50) DEFAULT 'collaborator',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    invitation_token UUID,
    invited_by UUID,
    invited_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_document_collaborators_document 
        FOREIGN KEY (document_id) REFERENCES collaborative_documents(document_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_document_collaborators_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_collaborators_invited_by FOREIGN KEY (invited_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(document_id, user_id)
);

-- User Presence Sessions Table
-- Tracks active user presence across the collaboration system
CREATE TABLE IF NOT EXISTS user_presence_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID NOT NULL UNIQUE,
    connection_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    client_info JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_user_presence_sessions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- Document Presence Table
-- Tracks user presence within specific documents
CREATE TABLE IF NOT EXISTS document_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_id VARCHAR(255) NOT NULL,
    session_id UUID NOT NULL,
    cursor_position INTEGER DEFAULT 0,
    selection_start INTEGER,
    selection_end INTEGER,
    is_typing BOOLEAN DEFAULT FALSE,
    typing_started_at TIMESTAMP WITH TIME ZONE,
    viewport_start INTEGER,
    viewport_end INTEGER,
    user_color VARCHAR(7), -- Hex color for user identification
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_document_presence_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_presence_document 
        FOREIGN KEY (document_id) REFERENCES collaborative_documents(document_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_document_presence_session FOREIGN KEY (session_id) 
        REFERENCES user_presence_sessions(session_id) ON DELETE CASCADE,
    
    UNIQUE(user_id, document_id, session_id)
);

-- Presence Activity Log Table
-- Historical log of user activities for analytics and debugging
CREATE TABLE IF NOT EXISTS presence_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_id VARCHAR(255),
    activity_type VARCHAR(50) NOT NULL,
    activity_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id UUID,
    
    CONSTRAINT fk_presence_activity_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_presence_activity_document 
        FOREIGN KEY (document_id) REFERENCES collaborative_documents(document_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_presence_activity_session FOREIGN KEY (session_id) 
        REFERENCES user_presence_sessions(session_id) ON DELETE SET NULL
);

-- Collaboration Conflicts Table
-- Tracks detected and resolved conflicts in collaborative editing
CREATE TABLE IF NOT EXISTS collaboration_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id VARCHAR(255) UNIQUE NOT NULL,
    document_id VARCHAR(255) NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'detected' CHECK (status IN ('detected', 'resolving', 'resolved', 'failed')),
    priority INTEGER DEFAULT 1,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_strategy VARCHAR(50),
    resolution_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    involved_users UUID[] NOT NULL,
    conflicting_operations JSONB NOT NULL,
    resolution_result JSONB,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_collaboration_conflicts_document 
        FOREIGN KEY (document_id) REFERENCES collaborative_documents(document_id) 
        ON DELETE CASCADE
);

-- Conflict Resolution Attempts Table
-- Detailed log of conflict resolution attempts
CREATE TABLE IF NOT EXISTS conflict_resolution_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id UUID NOT NULL,
    attempt_number INTEGER NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    success BOOLEAN,
    error_message TEXT,
    resolution_data JSONB,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_conflict_resolution_conflict FOREIGN KEY (conflict_id) 
        REFERENCES collaboration_conflicts(id) ON DELETE CASCADE,
    
    UNIQUE(conflict_id, attempt_number)
);

-- WebSocket Connection Sessions Table
-- Tracks WebSocket connections for collaboration
CREATE TABLE IF NOT EXISTS websocket_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID,
    session_id UUID,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    client_info JSONB DEFAULT '{}',
    rooms TEXT[] DEFAULT ARRAY[]::TEXT[],
    message_count INTEGER DEFAULT 0,
    bytes_sent BIGINT DEFAULT 0,
    bytes_received BIGINT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT fk_websocket_sessions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_websocket_sessions_session FOREIGN KEY (session_id) 
        REFERENCES user_presence_sessions(session_id) ON DELETE SET NULL
);

-- User Collaboration Preferences Table
-- User-specific settings for collaboration features
CREATE TABLE IF NOT EXISTS user_collaboration_preferences (
    user_id UUID PRIMARY KEY,
    auto_save_interval INTEGER DEFAULT 5000, -- milliseconds
    cursor_blink_rate INTEGER DEFAULT 500,
    show_other_cursors BOOLEAN DEFAULT TRUE,
    show_typing_indicators BOOLEAN DEFAULT TRUE,
    conflict_resolution_preference VARCHAR(50) DEFAULT 'operational_transform',
    notification_settings JSONB DEFAULT '{
        "document_changes": true,
        "user_joins": true,
        "user_leaves": false,
        "conflicts": true,
        "mentions": true
    }',
    ui_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_user_collaboration_prefs_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- Collaboration Analytics Table
-- Aggregated analytics for collaboration usage
CREATE TABLE IF NOT EXISTS collaboration_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    document_id VARCHAR(255),
    total_collaborators INTEGER DEFAULT 0,
    total_changes INTEGER DEFAULT 0,
    total_conflicts INTEGER DEFAULT 0,
    resolved_conflicts INTEGER DEFAULT 0,
    average_session_duration INTERVAL,
    peak_concurrent_users INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    analytics_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_collaboration_analytics_document 
        FOREIGN KEY (document_id) REFERENCES collaborative_documents(document_id) 
        ON DELETE CASCADE,
    
    UNIQUE(date, document_id)
);

-- Create indexes for performance optimization

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_collaborative_documents_document_id 
    ON collaborative_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_documents_owner 
    ON collaborative_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_documents_updated_at 
    ON collaborative_documents(updated_at DESC);

-- Document revisions indexes
CREATE INDEX IF NOT EXISTS idx_document_revisions_document_id 
    ON document_revisions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_revisions_revision_number 
    ON document_revisions(document_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_revisions_author 
    ON document_revisions(author_id);
CREATE INDEX IF NOT EXISTS idx_document_revisions_timestamp 
    ON document_revisions(timestamp DESC);

-- Document operations indexes
CREATE INDEX IF NOT EXISTS idx_document_operations_revision 
    ON document_operations(revision_id);
CREATE INDEX IF NOT EXISTS idx_document_operations_type 
    ON document_operations(operation_type);

-- Collaborators indexes
CREATE INDEX IF NOT EXISTS idx_document_collaborators_document 
    ON document_collaborators(document_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_user 
    ON document_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_active 
    ON document_collaborators(is_active, last_active_at);

-- Presence session indexes
CREATE INDEX IF NOT EXISTS idx_user_presence_sessions_user 
    ON user_presence_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_sessions_status 
    ON user_presence_sessions(status, last_activity);
CREATE INDEX IF NOT EXISTS idx_user_presence_sessions_expires 
    ON user_presence_sessions(expires_at);

-- Document presence indexes
CREATE INDEX IF NOT EXISTS idx_document_presence_document 
    ON document_presence(document_id);
CREATE INDEX IF NOT EXISTS idx_document_presence_user 
    ON document_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_document_presence_session 
    ON document_presence(session_id);
CREATE INDEX IF NOT EXISTS idx_document_presence_typing 
    ON document_presence(is_typing, typing_started_at);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_presence_activity_user 
    ON presence_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_activity_document 
    ON presence_activity_log(document_id);
CREATE INDEX IF NOT EXISTS idx_presence_activity_type 
    ON presence_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_presence_activity_timestamp 
    ON presence_activity_log(timestamp DESC);

-- Conflict indexes
CREATE INDEX IF NOT EXISTS idx_collaboration_conflicts_document 
    ON collaboration_conflicts(document_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_conflicts_status 
    ON collaboration_conflicts(status, detected_at);
CREATE INDEX IF NOT EXISTS idx_collaboration_conflicts_priority 
    ON collaboration_conflicts(priority DESC, detected_at);

-- Conflict resolution indexes
CREATE INDEX IF NOT EXISTS idx_conflict_resolution_conflict 
    ON conflict_resolution_attempts(conflict_id);
CREATE INDEX IF NOT EXISTS idx_conflict_resolution_strategy 
    ON conflict_resolution_attempts(strategy);

-- WebSocket session indexes
CREATE INDEX IF NOT EXISTS idx_websocket_sessions_user 
    ON websocket_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_websocket_sessions_active 
    ON websocket_sessions(is_active, last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_websocket_sessions_rooms 
    ON websocket_sessions USING GIN(rooms);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_collaboration_analytics_date 
    ON collaboration_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_collaboration_analytics_document 
    ON collaboration_analytics(document_id, date DESC);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_collaborative_documents_metadata 
    ON collaborative_documents USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_document_revisions_metadata 
    ON document_revisions USING GIN(change_operations);
CREATE INDEX IF NOT EXISTS idx_collaboration_conflicts_operations 
    ON collaboration_conflicts USING GIN(conflicting_operations);
CREATE INDEX IF NOT EXISTS idx_user_collaboration_prefs_notification 
    ON user_collaboration_preferences USING GIN(notification_settings);

-- Partial indexes for active records
CREATE INDEX IF NOT EXISTS idx_active_document_presence 
    ON document_presence(document_id, user_id) 
    WHERE last_update > NOW() - INTERVAL '1 hour';

CREATE INDEX IF NOT EXISTS idx_active_websocket_sessions 
    ON websocket_sessions(user_id, connected_at) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_unresolved_conflicts 
    ON collaboration_conflicts(document_id, priority DESC, detected_at) 
    WHERE status IN ('detected', 'resolving');

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_collaboration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_presence_last_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_update = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER trigger_collaborative_documents_updated_at
    BEFORE UPDATE ON collaborative_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_collaboration_updated_at();

CREATE TRIGGER trigger_document_presence_last_update
    BEFORE UPDATE ON document_presence
    FOR EACH ROW
    EXECUTE FUNCTION update_presence_last_update();

CREATE TRIGGER trigger_user_collaboration_preferences_updated_at
    BEFORE UPDATE ON user_collaboration_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_collaboration_updated_at();

-- Function to clean up expired presence sessions
CREATE OR REPLACE FUNCTION cleanup_expired_presence()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired presence sessions
    DELETE FROM user_presence_sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up orphaned document presence records
    DELETE FROM document_presence 
    WHERE session_id NOT IN (
        SELECT session_id FROM user_presence_sessions
    );
    
    -- Clean up old activity logs (keep last 30 days)
    DELETE FROM presence_activity_log 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get document collaboration stats
CREATE OR REPLACE FUNCTION get_document_collaboration_stats(doc_id VARCHAR(255))
RETURNS TABLE (
    total_collaborators INTEGER,
    active_collaborators INTEGER,
    total_revisions INTEGER,
    recent_changes INTEGER,
    current_conflicts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM document_collaborators 
         WHERE document_id = doc_id)::INTEGER as total_collaborators,
        
        (SELECT COUNT(*)::INTEGER FROM document_collaborators dc
         JOIN document_presence dp ON dc.user_id = dp.user_id 
         WHERE dc.document_id = doc_id 
         AND dp.document_id = doc_id 
         AND dp.last_update > NOW() - INTERVAL '5 minutes')::INTEGER as active_collaborators,
        
        (SELECT COUNT(*)::INTEGER FROM document_revisions 
         WHERE document_id = doc_id)::INTEGER as total_revisions,
        
        (SELECT COUNT(*)::INTEGER FROM document_revisions 
         WHERE document_id = doc_id 
         AND timestamp > NOW() - INTERVAL '1 hour')::INTEGER as recent_changes,
        
        (SELECT COUNT(*)::INTEGER FROM collaboration_conflicts 
         WHERE document_id = doc_id 
         AND status IN ('detected', 'resolving'))::INTEGER as current_conflicts;
END;
$$ LANGUAGE plpgsql;

-- Function to update collaboration analytics
CREATE OR REPLACE FUNCTION update_collaboration_analytics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    doc_record RECORD;
BEGIN
    -- Update analytics for each active document
    FOR doc_record IN 
        SELECT DISTINCT document_id 
        FROM document_revisions 
        WHERE DATE(timestamp) = target_date
    LOOP
        INSERT INTO collaboration_analytics (
            date, 
            document_id, 
            total_collaborators,
            total_changes,
            total_conflicts,
            resolved_conflicts,
            total_messages
        )
        SELECT 
            target_date,
            doc_record.document_id,
            (SELECT COUNT(DISTINCT user_id) FROM document_collaborators 
             WHERE document_id = doc_record.document_id)::INTEGER,
            (SELECT COUNT(*) FROM document_revisions 
             WHERE document_id = doc_record.document_id 
             AND DATE(timestamp) = target_date)::INTEGER,
            (SELECT COUNT(*) FROM collaboration_conflicts 
             WHERE document_id = doc_record.document_id 
             AND DATE(detected_at) = target_date)::INTEGER,
            (SELECT COUNT(*) FROM collaboration_conflicts 
             WHERE document_id = doc_record.document_id 
             AND DATE(resolved_at) = target_date)::INTEGER,
            (SELECT COUNT(*) FROM presence_activity_log 
             WHERE document_id = doc_record.document_id 
             AND DATE(timestamp) = target_date)::INTEGER
        ON CONFLICT (date, document_id) 
        DO UPDATE SET
            total_collaborators = EXCLUDED.total_collaborators,
            total_changes = EXCLUDED.total_changes,
            total_conflicts = EXCLUDED.total_conflicts,
            resolved_conflicts = EXCLUDED.resolved_conflicts,
            total_messages = EXCLUDED.total_messages;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Initial data setup
INSERT INTO user_collaboration_preferences (user_id) 
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM user_collaboration_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Comments for documentation
COMMENT ON TABLE collaborative_documents IS 'Main table for collaborative document state and metadata';
COMMENT ON TABLE document_revisions IS 'Complete history of document changes for operational transform';
COMMENT ON TABLE document_operations IS 'Individual operations within document revisions for detailed tracking';
COMMENT ON TABLE document_collaborators IS 'Users with access to collaborative documents and their permissions';
COMMENT ON TABLE user_presence_sessions IS 'Active user presence sessions across the collaboration system';
COMMENT ON TABLE document_presence IS 'User presence within specific documents including cursor positions';
COMMENT ON TABLE presence_activity_log IS 'Historical log of user activities for analytics and debugging';
COMMENT ON TABLE collaboration_conflicts IS 'Detected and resolved conflicts in collaborative editing';
COMMENT ON TABLE conflict_resolution_attempts IS 'Detailed log of conflict resolution attempts and outcomes';
COMMENT ON TABLE websocket_sessions IS 'WebSocket connection tracking for real-time collaboration';
COMMENT ON TABLE user_collaboration_preferences IS 'User-specific settings for collaboration features';
COMMENT ON TABLE collaboration_analytics IS 'Aggregated analytics for collaboration usage and performance';

COMMENT ON FUNCTION cleanup_expired_presence() IS 'Cleans up expired presence sessions and related data';
COMMENT ON FUNCTION get_document_collaboration_stats(VARCHAR) IS 'Returns comprehensive collaboration statistics for a document';
COMMENT ON FUNCTION update_collaboration_analytics(DATE) IS 'Updates daily collaboration analytics for performance tracking';
