-- Migration: Add missing columns for Cartrita backend
-- File: /home/robbie/development/dat-bitch-cartrita/db-init/10_add_missing_columns.sql
-- Date: 2025-08-02

-- Add last_login column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login'
    ) THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
        RAISE NOTICE 'Added last_login column to users table';
    ELSE
        RAISE NOTICE 'last_login column already exists in users table';
    END IF;
END $$;

-- Add response_time_ms column to conversations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'response_time_ms'
    ) THEN
        ALTER TABLE conversations ADD COLUMN response_time_ms INTEGER;
        RAISE NOTICE 'Added response_time_ms column to conversations table';
    ELSE
        RAISE NOTICE 'response_time_ms column already exists in conversations table';
    END IF;
END $$;

-- Update existing users to have a default last_login value
UPDATE users 
SET last_login = created_at 
WHERE last_login IS NULL;

-- Create index on last_login for better query performance
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Create index on response_time_ms for analytics
CREATE INDEX IF NOT EXISTS idx_conversations_response_time ON conversations(response_time_ms);

-- Verify the changes
SELECT 
    'users' as table_name,
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'last_login'

UNION ALL

SELECT 
    'conversations' as table_name,
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'conversations' AND column_name = 'response_time_ms';

-- Show summary
SELECT 'Migration 10_add_missing_columns.sql completed successfully' as status;