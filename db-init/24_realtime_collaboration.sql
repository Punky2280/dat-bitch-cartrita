-- Real-time Collaboration Schema
-- Support for live document editing, user presence, and collaborative workflows
-- @author Robbie Allen - Lead Architect
-- @date January 2025

-- Collaboration sessions table for tracking active collaboration sessions
CREATE TABLE IF NOT EXISTS collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id TEXT NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'document', 'workflow', 'conversation'
    session_data JSONB DEFAULT '{}',
    collaborators JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for collaboration sessions
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_resource ON collaboration_sessions(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_updated_at ON collaboration_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_expires_at ON collaboration_sessions(expires_at);

-- User presence table for tracking user online status and activities
CREATE TABLE IF NOT EXISTS user_presence (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'offline', -- 'online', 'away', 'busy', 'offline'
    current_activity TEXT,
    socket_id TEXT,
    active_resources JSONB DEFAULT '[]',
    cursor_position JSONB DEFAULT '{}',
    selection_data JSONB DEFAULT '{}',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user presence
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen);
CREATE INDEX IF NOT EXISTS idx_user_presence_updated_at ON user_presence(updated_at);

-- Document operations log for operational transform and version control
CREATE TABLE IF NOT EXISTS document_operations (
    id BIGSERIAL PRIMARY KEY,
    document_id TEXT NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    operation_data JSONB NOT NULL,
    operation_type VARCHAR(50) NOT NULL, -- 'insert', 'delete', 'replace', 'format'
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    position INTEGER,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE
);

-- Indexes for document operations
CREATE INDEX IF NOT EXISTS idx_document_operations_document ON document_operations(document_id, document_type);
CREATE INDEX IF NOT EXISTS idx_document_operations_version ON document_operations(document_id, version);
CREATE INDEX IF NOT EXISTS idx_document_operations_user_id ON document_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_document_operations_applied_at ON document_operations(applied_at);

-- Workflow operations log for collaborative workflow editing
CREATE TABLE IF NOT EXISTS workflow_operations (
    id BIGSERIAL PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    operation_data JSONB NOT NULL,
    operation_type VARCHAR(50) NOT NULL, -- 'add_node', 'update_node', 'delete_node', 'add_edge', 'delete_edge'
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    node_id TEXT,
    edge_id TEXT,
    metadata JSONB DEFAULT '{}',
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE
);

-- Indexes for workflow operations
CREATE INDEX IF NOT EXISTS idx_workflow_operations_workflow_id ON workflow_operations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_operations_version ON workflow_operations(workflow_id, version);
CREATE INDEX IF NOT EXISTS idx_workflow_operations_user_id ON workflow_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_operations_applied_at ON workflow_operations(applied_at);

-- Resource locks for exclusive editing
CREATE TABLE IF NOT EXISTS resource_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id TEXT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    lock_type VARCHAR(50) NOT NULL, -- 'node', 'section', 'document'
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    socket_id TEXT NOT NULL,
    lock_data JSONB DEFAULT '{}',
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes')
);

-- Indexes for resource locks
CREATE INDEX IF NOT EXISTS idx_resource_locks_resource ON resource_locks(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_locks_user_id ON resource_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_locks_expires_at ON resource_locks(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_locks_unique ON resource_locks(resource_id, resource_type, lock_type);

-- Collaboration invitations for sharing documents and workflows
CREATE TABLE IF NOT EXISTS collaboration_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id TEXT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invitee_email TEXT,
    permissions JSONB DEFAULT '["read"]',
    invitation_token TEXT UNIQUE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    declined_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for collaboration invitations
CREATE INDEX IF NOT EXISTS idx_collaboration_invitations_resource ON collaboration_invitations(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_collaboration_invitations_inviter ON collaboration_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_invitations_invitee ON collaboration_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_invitations_status ON collaboration_invitations(status);
CREATE INDEX IF NOT EXISTS idx_collaboration_invitations_expires_at ON collaboration_invitations(expires_at);

-- Resource permissions for collaboration access control
CREATE TABLE IF NOT EXISTS resource_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id TEXT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '["read"]', -- ['read', 'write', 'share', 'admin']
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Indexes for resource permissions
CREATE INDEX IF NOT EXISTS idx_resource_permissions_resource ON resource_permissions(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_user_id ON resource_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_active ON resource_permissions(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_permissions_unique ON resource_permissions(resource_id, resource_type, user_id) WHERE is_active = true;

-- Activity log for collaboration tracking
CREATE TABLE IF NOT EXISTS collaboration_activity (
    id BIGSERIAL PRIMARY KEY,
    resource_id TEXT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'joined', 'left', 'edited', 'commented', 'shared'
    activity_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for collaboration activity
CREATE INDEX IF NOT EXISTS idx_collaboration_activity_resource ON collaboration_activity(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_collaboration_activity_user_id ON collaboration_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_activity_type ON collaboration_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_collaboration_activity_created_at ON collaboration_activity(created_at);

-- Comments and annotations for collaborative feedback
CREATE TABLE IF NOT EXISTS collaboration_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id TEXT NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    position_data JSONB DEFAULT '{}', -- For pinpoint comments
    thread_id UUID REFERENCES collaboration_comments(id) ON DELETE CASCADE,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for collaboration comments
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_resource ON collaboration_comments(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_user_id ON collaboration_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_thread_id ON collaboration_comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_resolved ON collaboration_comments(is_resolved);
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_created_at ON collaboration_comments(created_at);

-- Real-time communication channels (text/voice/video)
CREATE TABLE IF NOT EXISTS communication_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_name VARCHAR(100) NOT NULL,
    channel_type VARCHAR(50) DEFAULT 'text', -- 'text', 'voice', 'video', 'screen_share'
    resource_id TEXT,
    resource_type VARCHAR(50),
    participants JSONB DEFAULT '[]',
    channel_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for communication channels
CREATE INDEX IF NOT EXISTS idx_communication_channels_resource ON communication_channels(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_communication_channels_type ON communication_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_communication_channels_active ON communication_channels(is_active);
CREATE INDEX IF NOT EXISTS idx_communication_channels_created_by ON communication_channels(created_by);

-- Functions for collaboration management

-- Function to clean up expired sessions and locks
CREATE OR REPLACE FUNCTION cleanup_expired_collaboration_data()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- Clean up expired collaboration sessions
    DELETE FROM collaboration_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- Clean up expired resource locks
    DELETE FROM resource_locks 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Clean up expired invitations
    UPDATE collaboration_invitations 
    SET status = 'expired'
    WHERE expires_at < CURRENT_TIMESTAMP AND status = 'pending';
    
    -- Clean up old offline presence data (older than 24 hours)
    DELETE FROM user_presence 
    WHERE status = 'offline' AND last_seen < CURRENT_TIMESTAMP - INTERVAL '24 hours';
    
    -- Clean up old operations (keep last 30 days)
    DELETE FROM document_operations 
    WHERE applied_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    DELETE FROM workflow_operations 
    WHERE applied_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence(
    p_user_id UUID,
    p_status VARCHAR(20),
    p_activity TEXT DEFAULT NULL,
    p_socket_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_presence (user_id, status, current_activity, socket_id, last_seen, updated_at)
    VALUES (p_user_id, p_status, p_activity, p_socket_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        current_activity = COALESCE(EXCLUDED.current_activity, user_presence.current_activity),
        socket_id = COALESCE(EXCLUDED.socket_id, user_presence.socket_id),
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to acquire resource lock
CREATE OR REPLACE FUNCTION acquire_resource_lock(
    p_resource_id TEXT,
    p_resource_type VARCHAR(50),
    p_lock_type VARCHAR(50),
    p_user_id UUID,
    p_socket_id TEXT,
    p_duration_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
    lock_exists BOOLEAN;
BEGIN
    -- Check if lock already exists and is not expired
    SELECT EXISTS(
        SELECT 1 FROM resource_locks 
        WHERE resource_id = p_resource_id 
          AND resource_type = p_resource_type 
          AND lock_type = p_lock_type
          AND expires_at > CURRENT_TIMESTAMP
    ) INTO lock_exists;
    
    IF lock_exists THEN
        RETURN FALSE; -- Lock already exists
    END IF;
    
    -- Acquire the lock
    INSERT INTO resource_locks (resource_id, resource_type, lock_type, user_id, socket_id, expires_at)
    VALUES (p_resource_id, p_resource_type, p_lock_type, p_user_id, p_socket_id, 
            CURRENT_TIMESTAMP + (p_duration_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (resource_id, resource_type, lock_type) 
    DO UPDATE SET
        user_id = EXCLUDED.user_id,
        socket_id = EXCLUDED.socket_id,
        acquired_at = CURRENT_TIMESTAMP,
        expires_at = EXCLUDED.expires_at
    WHERE resource_locks.expires_at <= CURRENT_TIMESTAMP; -- Only if expired
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to release resource lock
CREATE OR REPLACE FUNCTION release_resource_lock(
    p_resource_id TEXT,
    p_resource_type VARCHAR(50),
    p_lock_type VARCHAR(50),
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM resource_locks 
    WHERE resource_id = p_resource_id 
      AND resource_type = p_resource_type 
      AND lock_type = p_lock_type
      AND user_id = p_user_id;
      
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Views for collaboration analytics

-- Active collaboration sessions view
CREATE OR REPLACE VIEW active_collaboration_sessions AS
SELECT 
    cs.id,
    cs.resource_id,
    cs.resource_type,
    jsonb_array_length(cs.collaborators) as collaborator_count,
    cs.created_at,
    cs.updated_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - cs.created_at)) / 60 as duration_minutes
FROM collaboration_sessions cs
WHERE cs.expires_at > CURRENT_TIMESTAMP OR cs.expires_at IS NULL;

-- User presence summary view
CREATE OR REPLACE VIEW user_presence_summary AS
SELECT 
    status,
    COUNT(*) as user_count,
    COUNT(*) FILTER (WHERE current_activity IS NOT NULL) as active_users
FROM user_presence
WHERE last_seen > CURRENT_TIMESTAMP - INTERVAL '1 hour'
GROUP BY status;

-- Resource collaboration stats view
CREATE OR REPLACE VIEW resource_collaboration_stats AS
SELECT 
    ca.resource_id,
    ca.resource_type,
    COUNT(DISTINCT ca.user_id) as unique_collaborators,
    COUNT(*) as total_activities,
    MAX(ca.created_at) as last_activity,
    COUNT(*) FILTER (WHERE ca.activity_type = 'edited') as edit_count,
    COUNT(*) FILTER (WHERE ca.activity_type = 'commented') as comment_count
FROM collaboration_activity ca
WHERE ca.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY ca.resource_id, ca.resource_type;

-- Collaboration performance metrics view
CREATE OR REPLACE VIEW collaboration_performance_metrics AS
SELECT 
    DATE_TRUNC('hour', applied_at) as hour,
    document_type,
    COUNT(*) as operation_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(EXTRACT(EPOCH FROM (applied_at - LAG(applied_at) OVER (PARTITION BY document_id ORDER BY applied_at)))) as avg_time_between_operations
FROM document_operations
WHERE applied_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', applied_at), document_type
ORDER BY hour DESC;

-- Triggers for automatic updates

-- Trigger to update collaboration session timestamp
CREATE OR REPLACE FUNCTION update_collaboration_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE collaboration_sessions 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_collaboration_session ON document_operations;
CREATE TRIGGER trigger_update_collaboration_session
    AFTER INSERT ON document_operations
    FOR EACH ROW
    WHEN (NEW.session_id IS NOT NULL)
    EXECUTE FUNCTION update_collaboration_session_timestamp();

DROP TRIGGER IF EXISTS trigger_update_collaboration_session_workflow ON workflow_operations;
CREATE TRIGGER trigger_update_collaboration_session_workflow
    AFTER INSERT ON workflow_operations
    FOR EACH ROW
    WHEN (NEW.session_id IS NOT NULL)
    EXECUTE FUNCTION update_collaboration_session_timestamp();

-- Comments for documentation
COMMENT ON TABLE collaboration_sessions IS 'Active collaboration sessions for real-time editing and coordination';
COMMENT ON TABLE user_presence IS 'Real-time user presence and activity tracking';
COMMENT ON TABLE document_operations IS 'Log of all document operations for operational transform and version control';
COMMENT ON TABLE workflow_operations IS 'Log of all workflow operations for collaborative workflow editing';
COMMENT ON TABLE resource_locks IS 'Exclusive locks for preventing editing conflicts';
COMMENT ON TABLE collaboration_invitations IS 'Invitations for sharing resources and collaboration';
COMMENT ON TABLE resource_permissions IS 'Access control permissions for collaborative resources';
COMMENT ON TABLE collaboration_activity IS 'Audit log of all collaboration activities';
COMMENT ON TABLE collaboration_comments IS 'Comments and annotations for collaborative feedback';
COMMENT ON TABLE communication_channels IS 'Real-time communication channels for voice/video/screen sharing';

COMMENT ON FUNCTION cleanup_expired_collaboration_data() IS 'Cleans up expired sessions, locks, and old data';
COMMENT ON FUNCTION update_user_presence(UUID, VARCHAR, TEXT, TEXT) IS 'Updates or inserts user presence information';
COMMENT ON FUNCTION acquire_resource_lock(TEXT, VARCHAR, VARCHAR, UUID, TEXT, INTEGER) IS 'Attempts to acquire an exclusive lock on a resource';
COMMENT ON FUNCTION release_resource_lock(TEXT, VARCHAR, VARCHAR, UUID) IS 'Releases a resource lock held by a user';

COMMENT ON VIEW active_collaboration_sessions IS 'Currently active collaboration sessions with metrics';
COMMENT ON VIEW user_presence_summary IS 'Summary of user presence statistics';
COMMENT ON VIEW resource_collaboration_stats IS 'Collaboration statistics per resource';
COMMENT ON VIEW collaboration_performance_metrics IS 'Performance metrics for collaboration operations';
