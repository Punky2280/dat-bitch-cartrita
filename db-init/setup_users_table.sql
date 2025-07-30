-- =====================================================
-- USERS TABLE SETUP
-- =====================================================

-- Create the timestamp update function if it doesn't exist
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create users table
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

-- Add update trigger
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

\echo "✅ Users table is ready."
