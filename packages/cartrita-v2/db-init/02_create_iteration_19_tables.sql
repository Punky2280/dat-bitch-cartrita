-- Iteration 19: Personal Life OS - Database Schema
-- Create tables for Calendar, Email, and Contact management

-- Calendar Events table
CREATE TABLE IF NOT EXISTS user_calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calendar_id VARCHAR(255) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100),
    location VARCHAR(500),
    attendees JSONB,
    recurrence_rule VARCHAR(255),
    reminder_minutes INTEGER[],
    status VARCHAR(50) DEFAULT 'confirmed',
    visibility VARCHAR(50) DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, calendar_id, event_id)
);

-- Calendar Synchronization Status table
CREATE TABLE IF NOT EXISTS user_calendar_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calendar_id VARCHAR(255) NOT NULL,
    calendar_name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'outlook', 'apple', 'caldav')),
    sync_token VARCHAR(500),
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, calendar_id)
);

-- Email Messages table
CREATE TABLE IF NOT EXISTS user_email_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
    folder VARCHAR(100) NOT NULL,
    subject VARCHAR(500),
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipient_emails TEXT[],
    cc_emails TEXT[],
    bcc_emails TEXT[],
    body_text TEXT,
    body_html TEXT,
    attachments JSONB,
    labels TEXT[],
    is_read BOOLEAN DEFAULT false,
    is_important BOOLEAN DEFAULT false,
    is_spam BOOLEAN DEFAULT false,
    ai_summary TEXT,
    ai_category VARCHAR(100),
    ai_sentiment VARCHAR(50),
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, message_id, provider)
);

-- Email Synchronization Status table
CREATE TABLE IF NOT EXISTS user_email_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
    email_address VARCHAR(255) NOT NULL,
    sync_token VARCHAR(500),
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    folders_to_sync TEXT[] DEFAULT ARRAY['inbox', 'sent'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider, email_address)
);

-- Contacts table
CREATE TABLE IF NOT EXISTS user_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'outlook', 'apple', 'carddav')),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    email_addresses JSONB,
    phone_numbers JSONB,
    addresses JSONB,
    organizations JSONB,
    birthday DATE,
    anniversary DATE,
    notes TEXT,
    photo_url VARCHAR(500),
    social_profiles JSONB,
    custom_fields JSONB,
    tags TEXT[],
    last_interaction_at TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_id, provider)
);

-- Contact Interactions History table
CREATE TABLE IF NOT EXISTS user_contact_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('email', 'call', 'meeting', 'message', 'note')),
    interaction_date TIMESTAMPTZ NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Synchronization Status table  
CREATE TABLE IF NOT EXISTS user_contact_sync (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'outlook', 'apple', 'carddav')),
    address_book_id VARCHAR(255),
    address_book_name VARCHAR(255),
    sync_token VARCHAR(500),
    last_sync_at TIMESTAMPTZ,
    sync_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider, address_book_id)
);

-- Personal Assistant Tasks table (extracted from emails/calendar)
CREATE TABLE IF NOT EXISTS user_assistant_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date TIMESTAMPTZ,
    source_type VARCHAR(50), -- 'email', 'calendar', 'manual'
    source_id VARCHAR(255), -- reference to original email/event
    context JSONB, -- additional context from AI analysis
    assigned_by VARCHAR(20) DEFAULT 'ai', -- 'ai', 'user'
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assistant Notifications table
CREATE TABLE IF NOT EXISTS user_assistant_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'reminder', 'suggestion', 'alert', 'info'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    action_url VARCHAR(500), -- link to relevant page/action
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    metadata JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON user_calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar ON user_calendar_events(calendar_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_user ON user_calendar_sync(user_id, sync_enabled);

CREATE INDEX IF NOT EXISTS idx_email_messages_user_received ON user_email_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON user_email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_unread ON user_email_messages(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_email_messages_important ON user_email_messages(user_id, is_important) WHERE is_important = true;
CREATE INDEX IF NOT EXISTS idx_email_sync_user ON user_email_sync(user_id, sync_enabled);

CREATE INDEX IF NOT EXISTS idx_contacts_user_name ON user_contacts(user_id, display_name);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON user_contacts USING GIN (email_addresses);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON user_contacts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_date ON user_contact_interactions(contact_id, interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_contact_sync_user ON user_contact_sync(user_id, sync_enabled);

CREATE INDEX IF NOT EXISTS idx_assistant_tasks_user_status ON user_assistant_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_due_date ON user_assistant_tasks(user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_notifications_user_unread ON user_assistant_notifications(user_id, is_read) WHERE is_read = false;

-- Add text search capabilities
CREATE INDEX IF NOT EXISTS idx_email_messages_subject_search ON user_email_messages USING GIN (to_tsvector('english', subject));
CREATE INDEX IF NOT EXISTS idx_email_messages_body_search ON user_email_messages USING GIN (to_tsvector('english', body_text));
CREATE INDEX IF NOT EXISTS idx_contacts_name_search ON user_contacts USING GIN (to_tsvector('english', display_name));

-- Add triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON user_calendar_events FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_calendar_sync_updated_at BEFORE UPDATE ON user_calendar_sync FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_email_sync_updated_at BEFORE UPDATE ON user_email_sync FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON user_contacts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_contact_sync_updated_at BEFORE UPDATE ON user_contact_sync FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_assistant_tasks_updated_at BEFORE UPDATE ON user_assistant_tasks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add table comments
COMMENT ON TABLE user_calendar_events IS 'Synchronized calendar events from various providers';
COMMENT ON TABLE user_calendar_sync IS 'Calendar synchronization status and configuration';
COMMENT ON TABLE user_email_messages IS 'Cached email messages with AI analysis';
COMMENT ON TABLE user_email_sync IS 'Email synchronization status and configuration';
COMMENT ON TABLE user_contacts IS 'Synchronized contacts from various providers';
COMMENT ON TABLE user_contact_interactions IS 'History of interactions with contacts';
COMMENT ON TABLE user_contact_sync IS 'Contact synchronization status and configuration';
COMMENT ON TABLE user_assistant_tasks IS 'AI-generated tasks from emails and calendar events';
COMMENT ON TABLE user_assistant_notifications IS 'Personal assistant notifications and reminders';

-- Insert sample data if users exist
INSERT INTO user_calendar_events (user_id, calendar_id, event_id, title, description, start_time, end_time)
SELECT 1, 'primary', 'sample-event-1', 'Sample Meeting', 'This is a test calendar event', 
       NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '1 hour'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
ON CONFLICT (user_id, calendar_id, event_id) DO NOTHING;

INSERT INTO user_assistant_notifications (user_id, type, title, message, priority)
SELECT 1, 'info', 'Personal Life OS Activated', 
       'Your Personal Life OS is now active! Calendar, Email, and Contact synchronization is available.', 
       'medium'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
ON CONFLICT DO NOTHING;