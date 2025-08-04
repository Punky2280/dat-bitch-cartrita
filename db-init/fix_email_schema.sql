-- Fix email schema issues for Personal Life OS
-- Add missing columns and fix data type inconsistencies

-- Add received_at column as alias for internal_date for backward compatibility
ALTER TABLE user_email_messages 
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- Update received_at with internal_date values for existing records
UPDATE user_email_messages 
SET received_at = internal_date 
WHERE received_at IS NULL AND internal_date IS NOT NULL;

-- Create a trigger to keep received_at in sync with internal_date
CREATE OR REPLACE FUNCTION sync_email_received_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Keep received_at in sync with internal_date
    IF NEW.internal_date IS NOT NULL THEN
        NEW.received_at = NEW.internal_date;
    END IF;
    
    -- If received_at is set but internal_date is not, sync the other way
    IF NEW.received_at IS NOT NULL AND NEW.internal_date IS NULL THEN
        NEW.internal_date = NEW.received_at;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new inserts and updates
DROP TRIGGER IF EXISTS trigger_email_received_at_sync ON user_email_messages;
CREATE TRIGGER trigger_email_received_at_sync
    BEFORE INSERT OR UPDATE ON user_email_messages
    FOR EACH ROW
    EXECUTE FUNCTION sync_email_received_at();

-- Add any missing notification system tables if they don't exist

-- Create comprehensive notification system table if missing
CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    category VARCHAR(50) DEFAULT 'system', -- system, calendar, email, contact, reminder
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    data JSONB, -- Additional context data
    actions JSONB, -- Array of action buttons
    scheduled_for TIMESTAMPTZ, -- NULL for immediate delivery
    expires_at TIMESTAMPTZ, -- When notification becomes irrelevant
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notification preferences table if missing
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    delivery_method VARCHAR(20) DEFAULT 'in_app', -- in_app, email, push
    sound_enabled BOOLEAN DEFAULT true,
    advance_minutes INTEGER DEFAULT 15,
    quiet_hours JSONB, -- {enabled: boolean, start_time: string, end_time: string}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, notification_type)
);

-- Privacy control tables for GDPR compliance
CREATE TABLE IF NOT EXISTS user_consent_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL, -- data_processing, service_improvement, etc.
    consent_given BOOLEAN NOT NULL,
    details JSONB, -- {scope, purpose, retention_days}
    granted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, consent_type)
);

CREATE TABLE IF NOT EXISTS user_data_access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- read, write, delete, export
    data_type VARCHAR(50) NOT NULL, -- calendar_events, email_messages, etc.
    details TEXT,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_data_export_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    export_type VARCHAR(50) NOT NULL, -- full, calendar_only, etc.
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    file_path VARCHAR(500),
    download_url VARCHAR(500),
    expires_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_data_deletion_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deletion_type VARCHAR(50) NOT NULL, -- partial_data, full_account
    data_types TEXT[], -- Array of data types to delete
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON user_email_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON user_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON user_notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consent_records_user ON user_consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_timestamp ON user_data_access_logs(user_id, timestamp DESC);

-- Insert default notification preferences for existing users
INSERT INTO user_notification_preferences (user_id, notification_type, enabled, delivery_method)
SELECT u.id, 'calendar_reminder', true, 'in_app' FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_notification_preferences 
    WHERE user_id = u.id AND notification_type = 'calendar_reminder'
);

INSERT INTO user_notification_preferences (user_id, notification_type, enabled, delivery_method)
SELECT u.id, 'email_urgent', true, 'in_app' FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_notification_preferences 
    WHERE user_id = u.id AND notification_type = 'email_urgent'
);

INSERT INTO user_notification_preferences (user_id, notification_type, enabled, delivery_method)
SELECT u.id, 'birthday_reminder', true, 'in_app' FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_notification_preferences 
    WHERE user_id = u.id AND notification_type = 'birthday_reminder'
);

INSERT INTO user_notification_preferences (user_id, notification_type, enabled, delivery_method)
SELECT u.id, 'follow_up_reminder', true, 'in_app' FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_notification_preferences 
    WHERE user_id = u.id AND notification_type = 'follow_up_reminder'
);

-- Insert default consent records for existing users
INSERT INTO user_consent_records (user_id, consent_type, consent_given, details, granted_at)
SELECT u.id, 'data_processing', true, '{"scope": "essential_features", "purpose": "Core functionality"}', NOW() FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_consent_records 
    WHERE user_id = u.id AND consent_type = 'data_processing'
);

INSERT INTO user_consent_records (user_id, consent_type, consent_given, details, granted_at)
SELECT u.id, 'service_improvement', false, '{"scope": "analytics", "purpose": "Product improvement"}', NOW() FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_consent_records 
    WHERE user_id = u.id AND consent_type = 'service_improvement'
);

-- ✅ Email schema fixes and privacy tables are ready