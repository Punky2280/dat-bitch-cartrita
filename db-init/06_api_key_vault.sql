-- =====================================================
-- SECURE API KEY VAULT - Database Schema
-- =====================================================

-- API key providers/services table
CREATE TABLE IF NOT EXISTS api_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(255), -- URL or emoji for the provider icon
    documentation_url VARCHAR(500),
    default_base_url VARCHAR(500),
    required_fields JSONB DEFAULT '[]', -- Additional fields required for this provider
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User API keys table with advanced encryption
CREATE TABLE IF NOT EXISTS user_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES api_providers(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL, -- User-friendly name for the key
    encrypted_key TEXT NOT NULL, -- AES-256 encrypted API key
    key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for verification
    encrypted_metadata JSONB, -- Additional encrypted fields (secrets, tokens, etc.)
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    rotation_interval_days INTEGER, -- Auto-rotation interval
    next_rotation_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider_id, key_name)
);

-- API key usage tracking and analytics
CREATE TABLE IF NOT EXISTS api_key_usage (
    id SERIAL PRIMARY KEY,
    user_api_key_id INTEGER NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,
    service_name VARCHAR(100), -- Which service/feature used the key
    request_type VARCHAR(50), -- GET, POST, etc.
    endpoint VARCHAR(500), -- API endpoint called
    status_code INTEGER, -- Response status code
    response_time_ms INTEGER,
    tokens_used INTEGER, -- For AI APIs
    cost_estimate DECIMAL(10, 6), -- Estimated cost in USD
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- API key security events and monitoring
CREATE TABLE IF NOT EXISTS api_key_security_events (
    id SERIAL PRIMARY KEY,
    user_api_key_id INTEGER REFERENCES user_api_keys(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- created, accessed, rotated, compromised, deleted
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
    description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    additional_context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API key sharing and team collaboration
CREATE TABLE IF NOT EXISTS api_key_sharing (
    id SERIAL PRIMARY KEY,
    user_api_key_id INTEGER NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,
    shared_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for team-wide
    permission_level VARCHAR(20) DEFAULT 'read', -- read, use, manage
    can_view_key BOOLEAN DEFAULT FALSE,
    usage_limit INTEGER, -- Max uses per day/month
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API key templates and configurations
CREATE TABLE IF NOT EXISTS api_key_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for system templates
    provider_id INTEGER NOT NULL REFERENCES api_providers(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    configuration JSONB NOT NULL, -- Default settings, rate limits, etc.
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Master encryption keys table (for key rotation)
CREATE TABLE IF NOT EXISTS vault_encryption_keys (
    id SERIAL PRIMARY KEY,
    key_version INTEGER NOT NULL,
    encrypted_master_key TEXT NOT NULL, -- The master key encrypted with application key
    key_hash VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME Zone DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance and security
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider_id ON user_api_keys(provider_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_expires_at ON user_api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_hash ON user_api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(user_api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_timestamp ON api_key_usage(request_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_service ON api_key_usage(service_name);

CREATE INDEX IF NOT EXISTS idx_api_key_security_events_key_id ON api_key_security_events(user_api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_security_events_user_id ON api_key_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_security_events_type ON api_key_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_api_key_security_events_severity ON api_key_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_api_key_security_events_timestamp ON api_key_security_events(created_at DESC);

-- Insert common API providers
INSERT INTO api_providers (name, display_name, description, icon, documentation_url, default_base_url, required_fields) VALUES
('openai', 'OpenAI', 'OpenAI GPT models and APIs', '🤖', 'https://platform.openai.com/docs', 'https://api.openai.com/v1', '[]'),
('anthropic', 'Anthropic Claude', 'Claude AI models by Anthropic', '🎭', 'https://docs.anthropic.com', 'https://api.anthropic.com', '[{"field": "version", "default": "2023-06-01"}]'),
('google-ai', 'Google AI (Gemini)', 'Google Gemini and PaLM APIs', '🔍', 'https://ai.google.dev/docs', 'https://generativelanguage.googleapis.com', '[]'),
('cohere', 'Cohere', 'Cohere language models', '🧬', 'https://docs.cohere.com', 'https://api.cohere.ai', '[]'),
('huggingface', 'Hugging Face', 'Hugging Face Inference API', '🤗', 'https://huggingface.co/docs/api-inference', 'https://api-inference.huggingface.co', '[]'),
('replicate', 'Replicate', 'Run AI models in the cloud', '🔄', 'https://replicate.com/docs', 'https://api.replicate.com', '[]'),
('elevenlabs', 'ElevenLabs', 'AI voice synthesis and cloning', '🔊', 'https://elevenlabs.io/docs', 'https://api.elevenlabs.io', '[]'),
('deepgram', 'Deepgram', 'Speech-to-text and audio intelligence', '🎤', 'https://developers.deepgram.com', 'https://api.deepgram.com', '[]'),
('pinecone', 'Pinecone', 'Vector database for AI applications', '🌲', 'https://docs.pinecone.io', 'https://api.pinecone.io', '[{"field": "environment", "required": true}]'),
('weaviate', 'Weaviate', 'Vector search engine', '🕸️', 'https://weaviate.io/developers/weaviate', '', '[{"field": "cluster_url", "required": true}]'),
('github', 'GitHub', 'GitHub API for repositories and actions', '🐙', 'https://docs.github.com/en/rest', 'https://api.github.com', '[]'),
('stripe', 'Stripe', 'Payment processing API', '💳', 'https://stripe.com/docs/api', 'https://api.stripe.com', '[]'),
('sendgrid', 'SendGrid', 'Email delivery service', '📧', 'https://docs.sendgrid.com', 'https://api.sendgrid.com', '[]'),
('twilio', 'Twilio', 'Communications APIs', '📱', 'https://www.twilio.com/docs', 'https://api.twilio.com', '[{"field": "account_sid", "required": true}]'),
('aws', 'Amazon Web Services', 'AWS cloud services', '☁️', 'https://docs.aws.amazon.com', '', '[{"field": "region", "default": "us-east-1"}, {"field": "access_key_id", "required": true}]'),
('gcp', 'Google Cloud Platform', 'Google Cloud services', '🌩️', 'https://cloud.google.com/docs', '', '[{"field": "project_id", "required": true}]'),
('azure', 'Microsoft Azure', 'Microsoft Azure cloud services', '🔷', 'https://docs.microsoft.com/azure', '', '[{"field": "tenant_id", "required": true}]'),
('discord', 'Discord', 'Discord bot and webhook APIs', '🎮', 'https://discord.com/developers/docs', 'https://discord.com/api', '[]'),
('slack', 'Slack', 'Slack workspace and bot APIs', '💬', 'https://api.slack.com/web', 'https://slack.com/api', '[]'),
('notion', 'Notion', 'Notion workspace and database APIs', '📄', 'https://developers.notion.com', 'https://api.notion.com', '[]'),
('airtable', 'Airtable', 'Airtable database APIs', '📊', 'https://airtable.com/developers/web/api', 'https://api.airtable.com', '[{"field": "base_id", "required": true}]')
ON CONFLICT (name) DO NOTHING;

-- Create initial vault encryption key
INSERT INTO vault_encryption_keys (key_version, encrypted_master_key, key_hash, is_active) 
VALUES (1, 'initial_placeholder_key', 'placeholder_hash', TRUE)
ON CONFLICT DO NOTHING;

-- ✅ API Key Vault database schema created