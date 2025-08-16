-- Migration: Create conversation threading tables
-- Date: January 2025
-- Author: Robbie Allen - Lead Architect
-- Purpose: Support multi-agent conversation threading with context preservation and decision tracking

-- Conversation threads table
CREATE TABLE IF NOT EXISTS conversation_threads (
    id SERIAL PRIMARY KEY,
    thread_id VARCHAR(36) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    title VARCHAR(255),
    participants JSONB NOT NULL DEFAULT '[]', -- Array of agent names
    shared_state JSONB DEFAULT '{}', -- Shared state between agents
    metadata JSONB DEFAULT '{}', -- Thread-level metadata (stats, status, etc.)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages within conversation threads
CREATE TABLE IF NOT EXISTS conversation_thread_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(36) UNIQUE NOT NULL,
    thread_id VARCHAR(36) NOT NULL REFERENCES conversation_threads(thread_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    agent VARCHAR(100), -- Which agent generated this message (null for user messages)
    metadata JSONB DEFAULT '{}',
    context_snapshot JSONB, -- Snapshot of thread context at message time
    structured_output JSONB, -- Structured output from the message
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent decision tracking
CREATE TABLE IF NOT EXISTS conversation_thread_decisions (
    id SERIAL PRIMARY KEY,
    decision_id VARCHAR(36) UNIQUE NOT NULL,
    thread_id VARCHAR(36) NOT NULL REFERENCES conversation_threads(thread_id) ON DELETE CASCADE,
    agent VARCHAR(100) NOT NULL,
    decision TEXT NOT NULL, -- The decision made
    reasoning TEXT, -- Why the decision was made
    confidence DECIMAL(4,3) CHECK (confidence >= 0 AND confidence <= 1),
    context JSONB DEFAULT '{}', -- Context that influenced the decision
    alternatives JSONB DEFAULT '[]', -- Alternative options considered
    impacted_agents JSONB DEFAULT '[]', -- Which agents are affected by this decision
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Context transfers between agents
CREATE TABLE IF NOT EXISTS conversation_context_transfers (
    id SERIAL PRIMARY KEY,
    transfer_id VARCHAR(36) UNIQUE NOT NULL,
    thread_id VARCHAR(36) NOT NULL REFERENCES conversation_threads(thread_id) ON DELETE CASCADE,
    from_agent VARCHAR(100) NOT NULL,
    to_agent VARCHAR(100) NOT NULL,
    transfer_data JSONB DEFAULT '{}', -- Data being transferred
    context_snapshot JSONB, -- Context at time of transfer
    reason VARCHAR(100) DEFAULT 'delegation', -- Reason for transfer
    success BOOLEAN, -- Whether transfer was successful
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent handoffs tracking
CREATE TABLE IF NOT EXISTS conversation_agent_handoffs (
    id SERIAL PRIMARY KEY,
    handoff_id VARCHAR(36) UNIQUE NOT NULL,
    thread_id VARCHAR(36) NOT NULL REFERENCES conversation_threads(thread_id) ON DELETE CASCADE,
    from_agent VARCHAR(100) NOT NULL,
    to_agent VARCHAR(100) NOT NULL,
    trigger_message_id VARCHAR(36), -- Message that triggered the handoff
    handoff_reason VARCHAR(100),
    context_preserved BOOLEAN DEFAULT true,
    handoff_success BOOLEAN,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thread analytics snapshots
CREATE TABLE IF NOT EXISTS conversation_thread_analytics (
    id SERIAL PRIMARY KEY,
    thread_id VARCHAR(36) NOT NULL REFERENCES conversation_threads(thread_id) ON DELETE CASCADE,
    snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    participant_count INTEGER,
    message_count INTEGER,
    decision_count INTEGER,
    agent_switch_count INTEGER,
    avg_response_time_ms INTEGER,
    collaboration_score DECIMAL(4,3),
    context_retention_score DECIMAL(4,3),
    dominant_agent VARCHAR(100),
    conversation_pattern VARCHAR(50), -- sequential, cyclical, hub_spoke, etc.
    analytics_data JSONB DEFAULT '{}' -- Full analytics payload
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_conversation_threads_user ON conversation_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_active ON conversation_threads(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_conversation_threads_created ON conversation_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_conversation ON conversation_threads(conversation_id);

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread ON conversation_thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_agent ON conversation_thread_messages(agent);
CREATE INDEX IF NOT EXISTS idx_thread_messages_role ON conversation_thread_messages(role);
CREATE INDEX IF NOT EXISTS idx_thread_messages_created ON conversation_thread_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thread_messages_structured ON conversation_thread_messages USING gin(structured_output) WHERE structured_output IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thread_decisions_thread ON conversation_thread_decisions(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_decisions_agent ON conversation_thread_decisions(agent);
CREATE INDEX IF NOT EXISTS idx_thread_decisions_sequence ON conversation_thread_decisions(thread_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_thread_decisions_confidence ON conversation_thread_decisions(confidence DESC) WHERE confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thread_decisions_created ON conversation_thread_decisions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_transfers_thread ON conversation_context_transfers(thread_id);
CREATE INDEX IF NOT EXISTS idx_context_transfers_agents ON conversation_context_transfers(from_agent, to_agent);
CREATE INDEX IF NOT EXISTS idx_context_transfers_created ON conversation_context_transfers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_handoffs_thread ON conversation_agent_handoffs(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_handoffs_agents ON conversation_agent_handoffs(from_agent, to_agent);
CREATE INDEX IF NOT EXISTS idx_agent_handoffs_success ON conversation_agent_handoffs(handoff_success);
CREATE INDEX IF NOT EXISTS idx_agent_handoffs_created ON conversation_agent_handoffs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_thread_analytics_thread ON conversation_thread_analytics(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_analytics_time ON conversation_thread_analytics(snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_thread_analytics_pattern ON conversation_thread_analytics(conversation_pattern);

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_threads_participants_gin ON conversation_threads USING gin(participants);
CREATE INDEX IF NOT EXISTS idx_threads_metadata_gin ON conversation_threads USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_thread_messages_metadata_gin ON conversation_thread_messages USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_thread_decisions_context_gin ON conversation_thread_decisions USING gin(context);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_conversation_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conversation_threads_updated_at ON conversation_threads;
CREATE TRIGGER trigger_conversation_threads_updated_at
    BEFORE UPDATE ON conversation_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_thread_timestamp();

-- Views for common queries
CREATE OR REPLACE VIEW thread_summary AS
SELECT 
    ct.thread_id,
    ct.user_id,
    ct.conversation_id,
    ct.title,
    jsonb_array_length(ct.participants) as participant_count,
    COUNT(DISTINCT ctm.id) as message_count,
    COUNT(DISTINCT ctd.id) as decision_count,
    COUNT(DISTINCT cah.id) as handoff_count,
    ct.is_active,
    ct.created_at,
    ct.updated_at,
    EXTRACT(EPOCH FROM (NOW() - ct.created_at))/3600 as age_hours
FROM conversation_threads ct
LEFT JOIN conversation_thread_messages ctm ON ct.thread_id = ctm.thread_id
LEFT JOIN conversation_thread_decisions ctd ON ct.thread_id = ctd.thread_id
LEFT JOIN conversation_agent_handoffs cah ON ct.thread_id = cah.thread_id
GROUP BY ct.thread_id, ct.user_id, ct.conversation_id, ct.title, ct.participants, ct.is_active, ct.created_at, ct.updated_at;

-- Agent performance summary view
CREATE OR REPLACE VIEW agent_thread_performance AS
SELECT 
    ctm.agent,
    COUNT(DISTINCT ctm.thread_id) as threads_participated,
    COUNT(ctm.id) as total_messages,
    AVG(ctm.processing_time_ms) as avg_processing_time,
    COUNT(DISTINCT ctd.id) as decisions_made,
    AVG(ctd.confidence) as avg_decision_confidence,
    COUNT(DISTINCT cah_from.id) as handoffs_initiated,
    COUNT(DISTINCT cah_to.id) as handoffs_received,
    MIN(ctm.created_at) as first_participation,
    MAX(ctm.created_at) as last_participation
FROM conversation_thread_messages ctm
LEFT JOIN conversation_thread_decisions ctd ON ctm.agent = ctd.agent AND ctm.thread_id = ctd.thread_id
LEFT JOIN conversation_agent_handoffs cah_from ON ctm.agent = cah_from.from_agent AND ctm.thread_id = cah_from.thread_id
LEFT JOIN conversation_agent_handoffs cah_to ON ctm.agent = cah_to.to_agent AND ctm.thread_id = cah_to.thread_id
WHERE ctm.agent IS NOT NULL
GROUP BY ctm.agent;

-- User thread activity view
CREATE OR REPLACE VIEW user_thread_activity AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT ct.thread_id) as total_threads,
    COUNT(DISTINCT CASE WHEN ct.is_active THEN ct.thread_id END) as active_threads,
    SUM(jsonb_array_length(ct.participants)) as total_agent_interactions,
    AVG(jsonb_array_length(ct.participants)) as avg_agents_per_thread,
    MIN(ct.created_at) as first_thread,
    MAX(ct.created_at) as last_thread,
    COUNT(DISTINCT ctm.id) as total_messages_in_threads,
    COUNT(DISTINCT ctd.id) as total_decisions_witnessed
FROM users u
LEFT JOIN conversation_threads ct ON u.id = ct.user_id
LEFT JOIN conversation_thread_messages ctm ON ct.thread_id = ctm.thread_id
LEFT JOIN conversation_thread_decisions ctd ON ct.thread_id = ctd.thread_id
GROUP BY u.id, u.email;

-- Comments for documentation
COMMENT ON TABLE conversation_threads IS 'Multi-agent conversation threads with context preservation';
COMMENT ON TABLE conversation_thread_messages IS 'Messages within conversation threads with agent attribution';
COMMENT ON TABLE conversation_thread_decisions IS 'Agent decision tracking with reasoning and confidence';
COMMENT ON TABLE conversation_context_transfers IS 'Context transfers between agents during handoffs';
COMMENT ON TABLE conversation_agent_handoffs IS 'Agent handoff tracking with success metrics';
COMMENT ON TABLE conversation_thread_analytics IS 'Periodic analytics snapshots of thread performance';

COMMENT ON COLUMN conversation_threads.participants IS 'JSONB array of agent names participating in this thread';
COMMENT ON COLUMN conversation_threads.shared_state IS 'Shared state variables accessible to all agents';
COMMENT ON COLUMN conversation_thread_messages.context_snapshot IS 'Thread context snapshot at message creation time';
COMMENT ON COLUMN conversation_thread_decisions.alternatives IS 'Alternative options considered by the agent';
COMMENT ON COLUMN conversation_thread_decisions.impacted_agents IS 'Agents affected by this decision';

COMMENT ON VIEW thread_summary IS 'Summary statistics for conversation threads';
COMMENT ON VIEW agent_thread_performance IS 'Performance metrics for agents across threads';
COMMENT ON VIEW user_thread_activity IS 'User activity summary for conversation threading';

-- Grant permissions (adjust based on your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_threads, conversation_thread_messages, conversation_thread_decisions, conversation_context_transfers, conversation_agent_handoffs, conversation_thread_analytics TO your_app_user;
-- GRANT SELECT ON thread_summary, agent_thread_performance, user_thread_activity TO your_app_user;
