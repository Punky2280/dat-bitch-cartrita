-- Iteration 18: Secure API Key Vault - Database Schema
-- Create tables for secure API key management and audit logging

-- API Security Events table for audit logging
CREATE TABLE IF NOT EXISTS api_security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX (user_id, created_at),
    INDEX (event_type, created_at),
    INDEX (severity, created_at)
);

-- API Key Rotation History table
CREATE TABLE IF NOT EXISTS api_key_rotation_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES api_providers(id),
    key_name VARCHAR(255) NOT NULL,
    old_key_hash VARCHAR(64), -- SHA256 hash of old key for verification
    rotation_reason VARCHAR(100), -- 'scheduled', 'security_breach', 'manual'
    rotated_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_by INTEGER REFERENCES users(id), -- NULL for automatic rotations
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    INDEX (user_id, rotated_at),
    INDEX (provider_id, rotated_at)
);

-- API Usage Analytics table
CREATE TABLE IF NOT EXISTS api_key_usage_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id INTEGER NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES api_providers(id),
    usage_date DATE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0, -- Track API costs in cents
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key_id, usage_date),
    INDEX (user_id, usage_date),
    INDEX (key_id, usage_date)
);

-- API Providers - Enhanced with more providers
INSERT INTO api_providers (name, display_name, description, icon, documentation_url, default_base_url, required_fields, validation_pattern, key_format_example, is_active) VALUES
-- AI/ML Providers
('openai', 'OpenAI', 'OpenAI GPT-4, DALL-E, Whisper and other AI models', 'openai', 'https://platform.openai.com/docs', 'https://api.openai.com/v1', ARRAY['api_key'], 'sk-[A-Za-z0-9]{48}', 'sk-...', true),
('anthropic', 'Anthropic Claude', 'Anthropic Claude AI models', 'anthropic', 'https://docs.anthropic.com', 'https://api.anthropic.com', ARRAY['api_key'], 'sk-ant-[A-Za-z0-9-]{32,}', 'sk-ant-...', true),
('google-ai', 'Google AI (Gemini)', 'Google AI and Gemini models', 'google', 'https://ai.google.dev/docs', 'https://generativelanguage.googleapis.com', ARRAY['api_key'], 'AIza[A-Za-z0-9_-]{35}', 'AIza...', true),
('azure-openai', 'Azure OpenAI', 'Azure OpenAI Service', 'azure', 'https://docs.microsoft.com/en-us/azure/cognitive-services/openai/', 'https://api.cognitive.microsoft.com/sts/v1.0', ARRAY['api_key', 'endpoint'], '[A-Za-z0-9]{32}', '12345678901234567890123456789012', true),

-- Voice/Audio Providers
('deepgram', 'Deepgram', 'Speech-to-text and audio intelligence', 'deepgram', 'https://developers.deepgram.com', 'https://api.deepgram.com', ARRAY['api_key'], '[A-Za-z0-9]{40}', '1234567890abcdef1234567890abcdef12345678', true),
('elevenlabs', 'ElevenLabs', 'AI voice synthesis and cloning', 'elevenlabs', 'https://docs.elevenlabs.io', 'https://api.elevenlabs.io', ARRAY['api_key'], '[A-Za-z0-9]{32}', '12345678901234567890123456789012', true),

-- Cloud Providers
('aws', 'Amazon Web Services', 'AWS services and APIs', 'aws', 'https://docs.aws.amazon.com', 'https://amazonaws.com', ARRAY['access_key_id', 'secret_access_key'], 'AKIA[A-Za-z0-9]{16}', 'AKIAIOSFODNN7EXAMPLE', true),
('google-cloud', 'Google Cloud', 'Google Cloud Platform APIs', 'google', 'https://cloud.google.com/docs', 'https://googleapis.com', ARRAY['service_account_json'], '', 'JSON service account key', true),
('azure', 'Microsoft Azure', 'Azure cloud services', 'azure', 'https://docs.microsoft.com/en-us/azure/', 'https://management.azure.com', ARRAY['tenant_id', 'client_id', 'client_secret'], '', 'Azure AD credentials', true),

-- Productivity APIs
('gmail', 'Gmail API', 'Gmail and Google Workspace integration', 'gmail', 'https://developers.google.com/gmail/api', 'https://gmail.googleapis.com', ARRAY['client_id', 'client_secret', 'refresh_token'], '', 'OAuth2 credentials', true),
('outlook', 'Microsoft Outlook', 'Outlook and Office 365 integration', 'outlook', 'https://docs.microsoft.com/en-us/graph/', 'https://graph.microsoft.com', ARRAY['client_id', 'client_secret', 'refresh_token'], '', 'OAuth2 credentials', true),
('google-calendar', 'Google Calendar', 'Google Calendar API integration', 'calendar', 'https://developers.google.com/calendar', 'https://www.googleapis.com/calendar/v3', ARRAY['client_id', 'client_secret', 'refresh_token'], '', 'OAuth2 credentials', true),
('google-contacts', 'Google Contacts', 'Google Contacts API integration', 'contacts', 'https://developers.google.com/people', 'https://people.googleapis.com', ARRAY['client_id', 'client_secret', 'refresh_token'], '', 'OAuth2 credentials', true),

-- Payment/Finance
('stripe', 'Stripe', 'Payment processing and billing', 'stripe', 'https://stripe.com/docs/api', 'https://api.stripe.com', ARRAY['api_key'], 'sk_(test_|live_)[A-Za-z0-9]{24,}', 'sk_test_...', true),
('plaid', 'Plaid', 'Banking and financial data', 'plaid', 'https://plaid.com/docs/', 'https://production.plaid.com', ARRAY['client_id', 'secret'], '', 'Plaid credentials', true),

-- Development Tools
('github', 'GitHub', 'GitHub API for repositories and actions', 'github', 'https://docs.github.com/en/rest', 'https://api.github.com', ARRAY['api_key'], 'gh[ps]_[A-Za-z0-9]{36}', 'ghp_...', true),
('gitlab', 'GitLab', 'GitLab API for CI/CD and repositories', 'gitlab', 'https://docs.gitlab.com/ee/api/', 'https://gitlab.com/api/v4', ARRAY['api_key'], 'glpat-[A-Za-z0-9]{20}', 'glpat-...', true),

-- Communication
('twilio', 'Twilio', 'SMS, voice, and communication APIs', 'twilio', 'https://www.twilio.com/docs', 'https://api.twilio.com', ARRAY['account_sid', 'auth_token'], 'SK[A-Za-z0-9]{32}', 'SK12345678901234567890123456789012', true),
('sendgrid', 'SendGrid', 'Email delivery and marketing', 'sendgrid', 'https://docs.sendgrid.com', 'https://api.sendgrid.com', ARRAY['api_key'], 'SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}', 'SG.xxx.xxx', true)

ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    documentation_url = EXCLUDED.documentation_url,
    default_base_url = EXCLUDED.default_base_url,
    required_fields = EXCLUDED.required_fields,
    validation_pattern = EXCLUDED.validation_pattern,
    key_format_example = EXCLUDED.key_format_example,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Add missing columns to user_api_keys if they don't exist
DO $$
BEGIN
    -- Add rotation columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='rotation_interval_days') THEN
        ALTER TABLE user_api_keys ADD COLUMN rotation_interval_days INTEGER DEFAULT 90;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='next_rotation_at') THEN
        ALTER TABLE user_api_keys ADD COLUMN next_rotation_at TIMESTAMPTZ;
    END IF;
    
    -- Add usage tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='usage_count') THEN
        ALTER TABLE user_api_keys ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='last_used_at') THEN
        ALTER TABLE user_api_keys ADD COLUMN last_used_at TIMESTAMPTZ;
    END IF;
    
    -- Add key metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='key_hash') THEN
        ALTER TABLE user_api_keys ADD COLUMN key_hash VARCHAR(64); -- SHA256 hash for integrity
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_api_keys' AND column_name='environment') THEN
        ALTER TABLE user_api_keys ADD COLUMN environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production'));
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON user_api_keys(user_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(is_active, next_rotation_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_security_events_user_time ON api_security_events(user_id, created_at DESC);

-- Insert initial security event
INSERT INTO api_security_events (user_id, event_type, description, metadata, severity)
SELECT 1, 'vault_initialized', 'Secure API Vault system initialized', '{"iteration": 18, "version": "2.0"}', 'info'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE api_security_events IS 'Audit log for all API key vault security events';
COMMENT ON TABLE api_key_rotation_history IS 'History of API key rotations for compliance and security tracking';
COMMENT ON TABLE api_key_usage_analytics IS 'Analytics and usage tracking for API keys';
COMMENT ON COLUMN user_api_keys.key_hash IS 'SHA256 hash of the API key for integrity verification';
COMMENT ON COLUMN user_api_keys.environment IS 'Environment classification (dev/staging/prod) for the API key';