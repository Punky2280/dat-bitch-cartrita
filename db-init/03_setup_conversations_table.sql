-- =====================================================
-- CONVERSATIONS TABLE SETUP
-- =====================================================

-- Create conversations table (depends on users)
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('user', 'cartrita')),
  text TEXT NOT NULL,
  model TEXT, -- The model used for the response
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

\echo "✅ Conversations table is ready."
