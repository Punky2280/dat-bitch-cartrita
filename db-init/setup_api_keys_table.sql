-- packages/backend/setup_api_keys_table.sql

-- Create the 'user_api_keys' table if it doesn't already exist.
-- This table will store encrypted API keys for third-party services.
CREATE TABLE IF NOT EXISTS user_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    service_name VARCHAR(100) NOT NULL, -- e.g., 'GoogleCalendar', 'DALLE'
    key_data TEXT NOT NULL, -- This will store the encrypted key and initialization vector (IV)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure a user can only have one key per service
    UNIQUE(user_id, service_name)
);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id_service ON user_api_keys(user_id, service_name);

-- Use the existing function to automatically update the updated_at timestamp
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
-- ✅ User API Keys table is ready.
