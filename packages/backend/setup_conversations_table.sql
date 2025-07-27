-- packages/backend/setup_conversations_table.sql

-- Create the 'conversations' table if it doesn't already exist.
-- This table will store the entire chat history for all users.
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    speaker TEXT NOT NULL, -- 'user' or 'cartrita'
    text TEXT NOT NULL,
    model TEXT, -- The model used for the response, e.g., 'cartrita-orchestrator'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index on user_id for faster history lookups.
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- Notify that the script has run
\echo "✅ 'conversations' table is ready."
