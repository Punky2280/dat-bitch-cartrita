-- =====================================================
-- USER_SETTINGS TABLE SETUP
-- =====================================================

-- This table stores customizable personality traits for each user.

CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  
  -- Foreign key to the users table. If a user is deleted, their settings are also deleted.
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Personality Traits
  -- Sarcasm level, from 0 (none) to 10 (max).
  sarcasm INTEGER NOT NULL DEFAULT 5 CHECK (sarcasm >= 0 AND sarcasm <= 10),
  
  -- Verbosity level for responses.
  verbosity TEXT NOT NULL DEFAULT 'normal' CHECK (verbosity IN ('concise', 'normal', 'detailed')),
  
  -- Preferred humor style.
  humor TEXT NOT NULL DEFAULT 'playful' CHECK (humor IN ('dry', 'playful', 'dark', 'none')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Add the update trigger to automatically update the 'updated_at' timestamp
-- This assumes the 'trigger_set_timestamp' function already exists from the users table setup.
DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_timestamp_user_settings' AND tgrelid = 'user_settings'::regclass
  ) THEN
    CREATE TRIGGER set_timestamp_user_settings
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
  END IF;
END
$$;

-- Insert default settings for all existing users who don't have them yet.
-- This ensures that every user has a settings row.
INSERT INTO user_settings (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT (user_id) DO NOTHING;

-- ✅ User_settings table is ready and populated with defaults for existing users.
