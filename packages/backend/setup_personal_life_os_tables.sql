-- Personal Life OS Database Schema
-- Iteration 19: Calendar, Email, and Contact Management

-- ========================================
-- CALENDAR MANAGEMENT TABLES
-- ========================================

-- Calendar events storage
CREATE TABLE IF NOT EXISTS user_calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calendar_id VARCHAR(255) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',
    location VARCHAR(500),
    attendees JSONB, -- Array of {email, name, status}
    recurrence_rule VARCHAR(255), -- RRULE format
    reminder_minutes INTEGER[], -- Array of reminder times in minutes
    status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, tentative, cancelled
    visibility VARCHAR(50) DEFAULT 'private', -- private, public, confidential
    meeting_url VARCHAR(500), -- Zoom, Teams, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, calendar_id, event_id)
);

-- Calendar synchronization status
CREATE TABLE IF NOT EXISTS user_calendar_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calendar_id VARCHAR(255) NOT NULL,
    calendar_name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'google', 'outlook', 'apple'
    calendar_color VARCHAR(7), -- Hex color code
    sync_token VARCHAR(500),
    page_token VARCHAR(500),
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    access_role VARCHAR(50) DEFAULT 'reader', -- owner, writer, reader
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, calendar_id, provider)
);

-- ========================================
-- EMAIL MANAGEMENT TABLES
-- ========================================

-- Email messages cache
CREATE TABLE IF NOT EXISTS user_email_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    provider VARCHAR(50) NOT NULL, -- 'gmail', 'outlook'
    folder VARCHAR(100) NOT NULL, -- 'inbox', 'sent', 'trash', 'draft', etc.
    subject VARCHAR(500),
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipient_emails TEXT[],
    cc_emails TEXT[],
    bcc_emails TEXT[],
    body_text TEXT,
    body_html TEXT,
    attachments JSONB, -- Array of {filename, mimeType, size, contentId}
    labels TEXT[],
    is_read BOOLEAN DEFAULT false,
    is_important BOOLEAN DEFAULT false,
    is_spam BOOLEAN DEFAULT false,
    is_draft BOOLEAN DEFAULT false,
    ai_summary TEXT,
    ai_category VARCHAR(100), -- work, personal, finance, travel, etc.
    ai_sentiment VARCHAR(50), -- positive, negative, neutral, urgent
    ai_action_required BOOLEAN DEFAULT false,
    ai_confidence FLOAT, -- AI classification confidence (0-1)
    internal_date TIMESTAMPTZ, -- When message was received by server
    sent_date TIMESTAMPTZ, -- When message was sent
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, message_id, provider)
);

-- Email sync status and configuration
CREATE TABLE IF NOT EXISTS user_email_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'gmail', 'outlook'
    email_address VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    sync_token VARCHAR(500),
    history_id VARCHAR(100), -- For Gmail incremental sync
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    folders_to_sync TEXT[] DEFAULT ARRAY['INBOX', 'SENT'],
    auto_categorize BOOLEAN DEFAULT true,
    auto_summarize BOOLEAN DEFAULT true,
    max_messages_per_sync INTEGER DEFAULT 100,
    sync_interval_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider, email_address)
);

-- Email templates and signatures
CREATE TABLE IF NOT EXISTS user_email_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    subject_template VARCHAR(500),
    body_template TEXT NOT NULL,
    template_type VARCHAR(50) DEFAULT 'custom', -- custom, auto_reply, signature
    use_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, template_name)
);

-- ========================================
-- CONTACT MANAGEMENT TABLES
-- ========================================

-- Contact information
CREATE TABLE IF NOT EXISTS user_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'google', 'outlook', 'apple', 'manual'
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    middle_name VARCHAR(255),
    display_name VARCHAR(255),
    nickname VARCHAR(255),
    prefix VARCHAR(50), -- Mr., Mrs., Dr., etc.
    suffix VARCHAR(50), -- Jr., Sr., III, etc.
    
    -- Contact methods
    email_addresses JSONB, -- Array of {email, type, label, primary}
    phone_numbers JSONB,   -- Array of {number, type, label, primary}
    addresses JSONB,       -- Array of {street, city, state, zip, country, type, label}
    
    -- Professional info
    organizations JSONB,   -- Array of {company, title, department, location}
    
    -- Personal info
    birthday DATE,
    anniversary DATE,
    spouse_name VARCHAR(255),
    children_names TEXT[],
    
    -- Additional info
    notes TEXT,
    photo_url VARCHAR(500),
    website_url VARCHAR(500),
    social_profiles JSONB, -- {linkedin, twitter, facebook, instagram, etc.}
    custom_fields JSONB,   -- User-defined fields
    tags TEXT[],
    
    -- Relationship tracking
    relationship VARCHAR(100), -- friend, colleague, family, client, etc.
    last_interaction_at TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    interaction_score FLOAT DEFAULT 0.0, -- Calculated relationship strength
    
    -- Sync info  
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_id, provider)
);

-- Contact interaction history
CREATE TABLE IF NOT EXISTS user_contact_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL, -- 'email', 'call', 'meeting', 'message', 'social'
    interaction_date TIMESTAMPTZ NOT NULL,
    direction VARCHAR(20), -- 'inbound', 'outbound', 'mutual'
    subject VARCHAR(500), -- Email subject, meeting title, call topic
    description TEXT,
    duration_minutes INTEGER, -- For calls and meetings
    location VARCHAR(255), -- For meetings
    metadata JSONB, -- Additional context (message_id, meeting_id, etc.)
    sentiment VARCHAR(20), -- positive, negative, neutral
    importance_score FLOAT DEFAULT 0.5, -- 0-1 scale
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact groups and lists
CREATE TABLE IF NOT EXISTS user_contact_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    is_system_group BOOLEAN DEFAULT false, -- For built-in groups like 'Family', 'Work'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_name)
);

-- Many-to-many relationship between contacts and groups
CREATE TABLE IF NOT EXISTS user_contact_group_members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES user_contact_groups(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contact_id, group_id)
);

-- ========================================
-- PERSONAL ASSISTANT FEATURES
-- ========================================

-- AI-generated tasks and reminders
CREATE TABLE IF NOT EXISTS user_assistant_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL, -- 'reminder', 'follow_up', 'preparation', 'review'
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    due_date TIMESTAMPTZ,
    source_type VARCHAR(50), -- 'email', 'calendar', 'contact', 'manual'
    source_id VARCHAR(255), -- Reference to source object
    context JSONB, -- Additional context about the task
    completion_notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Smart notifications and alerts
CREATE TABLE IF NOT EXISTS user_assistant_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'reminder', 'conflict', 'suggestion', 'alert'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500), -- Deep link to relevant interface
    action_data JSONB, -- Data needed to execute action
    priority VARCHAR(20) DEFAULT 'medium',
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    scheduled_for TIMESTAMPTZ, -- When to show notification
    expires_at TIMESTAMPTZ, -- When notification becomes irrelevant
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences for Personal Life OS
CREATE TABLE IF NOT EXISTS user_lifeos_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Calendar preferences
    default_calendar_view VARCHAR(20) DEFAULT 'week', -- month, week, day, agenda
    work_hours_start TIME DEFAULT '09:00',
    work_hours_end TIME DEFAULT '17:00',
    work_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- Monday=1, Sunday=7
    timezone VARCHAR(100) DEFAULT 'UTC',
    default_event_duration INTEGER DEFAULT 60, -- minutes
    
    -- Email preferences
    email_summary_frequency VARCHAR(20) DEFAULT 'daily', -- real_time, hourly, daily, never
    auto_categorize_emails BOOLEAN DEFAULT true,
    show_email_previews BOOLEAN DEFAULT true,
    max_emails_per_page INTEGER DEFAULT 50,
    
    -- Contact preferences
    auto_sync_contacts BOOLEAN DEFAULT true,
    deduplicate_contacts BOOLEAN DEFAULT true,
    track_interactions BOOLEAN DEFAULT true,
    
    -- Assistant preferences
    proactive_suggestions BOOLEAN DEFAULT true,
    meeting_preparation_reminders BOOLEAN DEFAULT true,
    follow_up_reminders BOOLEAN DEFAULT true,
    birthday_reminders BOOLEAN DEFAULT true,
    
    -- Privacy preferences
    data_retention_days INTEGER DEFAULT 365,
    share_analytics BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Calendar indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON user_calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_sync ON user_calendar_events(user_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_user ON user_calendar_sync(user_id, sync_enabled);

-- Email indexes
CREATE INDEX IF NOT EXISTS idx_email_messages_user_folder ON user_email_messages(user_id, folder, internal_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON user_email_messages(user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender ON user_email_messages(user_id, sender_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_unread ON user_email_messages(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_email_sync_user ON user_email_sync(user_id, sync_enabled);

-- Contact indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_name ON user_contacts(user_id, display_name);
CREATE INDEX IF NOT EXISTS idx_contacts_user_interaction ON user_contacts(user_id, last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_provider ON user_contacts(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact ON user_contact_interactions(contact_id, interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_user ON user_contact_interactions(user_id, interaction_date DESC);

-- Assistant indexes
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_user_status ON user_assistant_tasks(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_assistant_notifications_user ON user_assistant_notifications(user_id, scheduled_for, is_read);

-- ========================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ========================================

-- Calendar events
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calendar_events_updated_at
    BEFORE UPDATE ON user_calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Calendar sync
CREATE TRIGGER trigger_calendar_sync_updated_at
    BEFORE UPDATE ON user_calendar_sync
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Email messages
CREATE TRIGGER trigger_email_messages_updated_at
    BEFORE UPDATE ON user_email_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Email sync
CREATE TRIGGER trigger_email_sync_updated_at
    BEFORE UPDATE ON user_email_sync
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Contacts
CREATE TRIGGER trigger_contacts_updated_at
    BEFORE UPDATE ON user_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Contact groups
CREATE TRIGGER trigger_contact_groups_updated_at
    BEFORE UPDATE ON user_contact_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Assistant tasks
CREATE TRIGGER trigger_assistant_tasks_updated_at
    BEFORE UPDATE ON user_assistant_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Life OS preferences
CREATE TRIGGER trigger_lifeos_preferences_updated_at
    BEFORE UPDATE ON user_lifeos_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- ========================================
-- INITIAL DATA SETUP
-- ========================================

-- Create default contact groups for all existing users
INSERT INTO user_contact_groups (user_id, group_name, description, is_system_group)
SELECT id, 'Family', 'Family members and relatives', true FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_contact_groups 
    WHERE user_id = users.id AND group_name = 'Family'
);

INSERT INTO user_contact_groups (user_id, group_name, description, is_system_group)
SELECT id, 'Work', 'Professional contacts and colleagues', true FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_contact_groups 
    WHERE user_id = users.id AND group_name = 'Work'
);

INSERT INTO user_contact_groups (user_id, group_name, description, is_system_group)
SELECT id, 'Friends', 'Personal friends and social contacts', true FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_contact_groups 
    WHERE user_id = users.id AND group_name = 'Friends'
);

-- Create default preferences for all existing users
INSERT INTO user_lifeos_preferences (user_id)
SELECT id FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_lifeos_preferences 
    WHERE user_id = users.id
);

-- ========================================
-- NOTIFICATION SYSTEM TABLES
-- ========================================

-- User notifications storage
CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- calendar_reminder, email_urgent, etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    urgency INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=critical
    data JSONB, -- Additional context data
    delivery_method VARCHAR(20) DEFAULT 'in_app', -- in_app, email, push
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ, -- NULL for immediate delivery
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    delivery_method VARCHAR(20) DEFAULT 'in_app', -- in_app, email, push, disabled
    advance_minutes INTEGER DEFAULT 15, -- How far in advance to notify
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, notification_type)
);

-- Create indexes for notification tables
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_user_notifications_scheduled ON user_notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_type ON user_notification_preferences(notification_type);

-- ✅ Personal Life OS database schema is ready.