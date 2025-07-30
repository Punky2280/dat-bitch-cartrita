-- =====================================================
-- Dat Bitch Cartrita Database Initialization
-- =====================================================

-- 🚀 Initializing Dat Bitch Cartrita Database...

-- Create the timestamp update function first (needed by triggers)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ Created timestamp trigger function

-- =====================================================
-- USERS TABLE (Base table - no dependencies)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add update trigger for users
DO
$$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_timestamp_users' AND tgrelid = 'users'::regclass
 ) THEN
    CREATE TRIGGER set_timestamp_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
 END IF;
END
$$;

-- ✅ Users table created

-- =====================================================
-- CONVERSATIONS TABLE (Depends on users)
-- =====================================================

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('user', 'cartrita')),
  text TEXT NOT NULL,
  model TEXT, -- The model used for the response, e.g., 'cartrita-orchestrator'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_speaker ON conversations(speaker);

-- ✅ Conversations table created

-- =====================================================
-- USER API KEYS TABLE (Depends on users)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_name VARCHAR(100) NOT NULL, -- e.g., 'GoogleCalendar', 'DALLE'
  key_data TEXT NOT NULL, -- This will store the encrypted key and initialization vector (IV)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure a user can only have one key per service
  UNIQUE(user_id, service_name)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_service ON user_api_keys(service_name);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_service ON user_api_keys(user_id, service_name);

-- Add update trigger for user_api_keys
DO
$$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_timestamp_api_keys' AND tgrelid = 'user_api_keys'::regclass
 ) THEN
    CREATE TRIGGER set_timestamp_api_keys
    BEFORE UPDATE ON user_api_keys
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
 END IF;
END
$$;

-- ✅ User API Keys table created

-- =====================================================
-- WORKFLOWS TABLE (Depends on users)
-- =====================================================

CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL, -- Stores the array of steps for the workflow
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);

-- Add update trigger for workflows
DO
$$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_timestamp_workflows' AND tgrelid = 'workflows'::regclass
 ) THEN
    CREATE TRIGGER set_timestamp_workflows
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
 END IF;
END
$$;

-- ✅ Workflows table created

-- =====================================================
-- USER SETTINGS TABLE (Optional - for user preferences)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key);

-- Add update trigger for user_settings
DO
$$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_timestamp_settings' AND tgrelid = 'user_settings'::regclass
 ) THEN
    CREATE TRIGGER set_timestamp_settings
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
 END IF;
END
$$;

-- ✅ User Settings table created

-- =====================================================
-- INSERT SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert a test user if it doesn't exist
INSERT INTO users (email, name, password_hash) 
VALUES ('test@example.com', 'Test User', '$2b$10$rHzq8QQjQHfQjKjQHfQjKe')
ON CONFLICT (email) DO NOTHING;

-- Get the test user ID for sample data
DO
$$
DECLARE
  test_user_id INTEGER;
BEGIN
  SELECT id INTO test_user_id FROM users WHERE email = 'test@example.com';
  
  -- Insert sample conversation
  INSERT INTO conversations (user_id, speaker, text, model)
  VALUES 
      (test_user_id, 'user', 'Hello Cartrita!', NULL),
      (test_user_id, 'cartrita', 'Hello! How can I help you today?', 'cartrita-orchestrator')
  ON CONFLICT DO NOTHING;
  
  -- Insert sample workflow
  INSERT INTO workflows (user_id, name, description, definition)
  VALUES (
      test_user_id, 
      'Morning Routine', 
      'Daily morning automation workflow',
      '[{"step": 1, "action": "check_weather", "params": {}}, {"step": 2, "action": "send_summary", "params": {"recipient": "user"}}]'::jsonb
  )
  ON CONFLICT DO NOTHING;
  
  -- Insert sample settings
  INSERT INTO user_settings (user_id, setting_key, setting_value)
  VALUES 
      (test_user_id, 'theme', '"dark"'::jsonb),
      (test_user_id, 'notifications', '{"email": true, "push": false}'::jsonb)
  ON CONFLICT (user_id, setting_key) DO NOTHING;
END
$$;

-- ✅ Sample data inserted

-- =====================================================
-- VERIFY INSTALLATION
-- =====================================================

-- 📊 Database Summary:
-- ===================

-- Show table counts
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations  
UNION ALL
SELECT 'user_api_keys', COUNT(*) FROM user_api_keys
UNION ALL
SELECT 'workflows', COUNT(*) FROM workflows
UNION ALL
SELECT 'user_settings', COUNT(*) FROM user_settings;

-- 🎉 Database initialization complete!
-- ✅ All tables created with proper relationships
-- ✅ Indexes and triggers configured
-- ✅ Sample data available for testing
