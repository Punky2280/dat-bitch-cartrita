-- =====================================================
-- API Key Vault Schema
-- =====================================================
-- This is the single source of truth for storing user API keys.

-- Table to define the available API providers (e.g., 'openai', 'google')
CREATE TABLE IF NOT EXISTS api_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- 'openai', 'google', 'deepgram'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table to store the user's encrypted API keys
CREATE TABLE IF NOT EXISTS user_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES api_providers(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    iv TEXT NOT NULL, -- Initialization Vector for encryption
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider_id ON user_api_keys(provider_id);

-- Add some default providers that the system can use
INSERT INTO api_providers (name) VALUES ('openai'), ('google'), ('deepgram')
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✅ API Key Vault schema created successfully.';
END $$;