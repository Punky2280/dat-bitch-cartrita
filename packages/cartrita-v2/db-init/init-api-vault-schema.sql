-- API Key Vault Database Schema
-- Creates tables and populates with 19+ API provider presets

-- Create API providers table
CREATE TABLE IF NOT EXISTS api_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    documentation_url VARCHAR(500),
    default_base_url VARCHAR(500),
    required_fields JSONB DEFAULT '[]',
    validation_pattern VARCHAR(500),
    key_format_example VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create enhanced user_api_keys table (modify existing if needed)
DO $$ 
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'provider_id') THEN
        ALTER TABLE user_api_keys ADD COLUMN provider_id INTEGER REFERENCES api_providers(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'key_name') THEN
        ALTER TABLE user_api_keys ADD COLUMN key_name VARCHAR(200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'key_data') THEN
        ALTER TABLE user_api_keys ADD COLUMN key_data TEXT; -- Encrypted API key
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'is_active') THEN
        ALTER TABLE user_api_keys ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'expires_at') THEN
        ALTER TABLE user_api_keys ADD COLUMN expires_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'rotation_interval_days') THEN
        ALTER TABLE user_api_keys ADD COLUMN rotation_interval_days INTEGER DEFAULT 90;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'next_rotation_at') THEN
        ALTER TABLE user_api_keys ADD COLUMN next_rotation_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'last_used_at') THEN
        ALTER TABLE user_api_keys ADD COLUMN last_used_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'usage_count') THEN
        ALTER TABLE user_api_keys ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create API key usage logs table
CREATE TABLE IF NOT EXISTS api_key_usage_logs (
    id SERIAL PRIMARY KEY,
    user_api_key_id INTEGER REFERENCES user_api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(500),
    method VARCHAR(10),
    status_code INTEGER,
    response_time_ms INTEGER,
    tokens_used INTEGER,
    cost_usd DECIMAL(10,6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create security events table for audit trail
CREATE TABLE IF NOT EXISTS api_security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'key_created', 'key_rotated', 'key_compromised', 'suspicious_usage'
    description TEXT,
    metadata JSONB,
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert 19+ API provider presets
INSERT INTO api_providers (name, display_name, description, icon, documentation_url, default_base_url, required_fields, validation_pattern, key_format_example) VALUES
-- AI/ML Providers
('openai', 'OpenAI', 'GPT-4, GPT-3.5, DALL-E, Whisper, and embeddings API', '🤖', 'https://platform.openai.com/docs', 'https://api.openai.com/v1', '["api_key"]', '^sk-[a-zA-Z0-9]{48,}$', 'sk-proj-1234567890abcdef...'),
('anthropic', 'Anthropic (Claude)', 'Claude AI models for advanced reasoning and analysis', '🧠', 'https://docs.anthropic.com', 'https://api.anthropic.com', '["api_key"]', '^sk-ant-[a-zA-Z0-9-_]{95,}$', 'sk-ant-api03-1234567890abcdef...'),
('google-ai', 'Google AI (Gemini)', 'Google Gemini and PaLM AI models', '🔍', 'https://ai.google.dev', 'https://generativelanguage.googleapis.com', '["api_key"]', '^AIza[a-zA-Z0-9_-]{35}$', 'AIzaSyDp-cMne4eJ-EtV68iNlypHdssyZ76cFb4'),
('cohere', 'Cohere', 'Language models and embeddings for NLP tasks', '💬', 'https://docs.cohere.ai', 'https://api.cohere.ai/v1', '["api_key"]', '^[a-zA-Z0-9]{40}$', 'abcdef1234567890abcdef1234567890abcdef12'),
('huggingface', 'Hugging Face', 'Open source ML models and datasets', '🤗', 'https://huggingface.co/docs/api-inference', 'https://api-inference.huggingface.co', '["api_key"]', '^hf_[a-zA-Z0-9]{37}$', 'hf_1234567890abcdef1234567890abcdef123456'),

-- Cloud Platforms
('aws', 'Amazon Web Services', 'AWS cloud services and APIs', '☁️', 'https://docs.aws.amazon.com', 'https://aws.amazon.com', '["access_key_id", "secret_access_key", "region"]', '^[A-Z0-9]{20}$', 'AKIAIOSFODNN7EXAMPLE'),
('azure', 'Microsoft Azure', 'Azure cloud platform and cognitive services', '🔷', 'https://docs.microsoft.com/azure', 'https://management.azure.com', '["subscription_id", "client_id", "client_secret", "tenant_id"]', '^[a-f0-9-]{36}$', '12345678-1234-1234-1234-123456789012'),
('gcp', 'Google Cloud Platform', 'Google Cloud services and APIs', '🌐', 'https://cloud.google.com/docs', 'https://googleapis.com', '["api_key", "project_id"]', '^AIza[a-zA-Z0-9_-]{35}$', 'AIzaSyDp-cMne4eJ-EtV68iNlypHdssyZ76cFb4'),

-- Communication APIs
('twilio', 'Twilio', 'SMS, voice calls, and communication APIs', '📱', 'https://www.twilio.com/docs', 'https://api.twilio.com', '["account_sid", "auth_token"]', '^AC[a-z0-9]{32}$', 'ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
('sendgrid', 'SendGrid', 'Email delivery and marketing platform', '📧', 'https://docs.sendgrid.com', 'https://api.sendgrid.com/v3', '["api_key"]', '^SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}$', 'SG.1234567890abcdef1234.abcdef1234567890abcdef1234567890abcdef123'),
('slack', 'Slack', 'Team communication and workspace integration', '💬', 'https://api.slack.com', 'https://slack.com/api', '["bot_token"]', '^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$', 'xoxb-123456789012-123456789012-abcdef1234567890abcdef12'),
('discord', 'Discord', 'Gaming and community chat platform', '🎮', 'https://discord.com/developers/docs', 'https://discord.com/api/v10', '["bot_token"]', '^[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27}$', 'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.G12345.abcdef1234567890abcdef1234567890'),

-- Development APIs
('github', 'GitHub', 'Code hosting, CI/CD, and collaboration platform', '🐙', 'https://docs.github.com/rest', 'https://api.github.com', '["token"]', '^ghp_[a-zA-Z0-9]{36}$', 'ghp_1234567890abcdef1234567890abcdef1234'),
('gitlab', 'GitLab', 'DevOps platform with Git repository management', '🦊', 'https://docs.gitlab.com/ee/api', 'https://gitlab.com/api/v4', '["token"]', '^glpat-[a-zA-Z0-9_-]{20}$', 'glpat-1234567890abcdef1234'),
('stripe', 'Stripe', 'Online payment processing and financial APIs', '💳', 'https://stripe.com/docs/api', 'https://api.stripe.com/v1', '["publishable_key", "secret_key"]', '^sk_live_[a-zA-Z0-9]{99}$', 'sk_live_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123'),

-- Social Media APIs
('twitter', 'Twitter (X)', 'Social media platform API for tweets and engagement', '🐦', 'https://developer.twitter.com/docs', 'https://api.twitter.com/2', '["bearer_token"]', '^[a-zA-Z0-9]{126}$', 'AAAAAAAAAAAAAAAAAAAAAMLheAAAAAAA0%2BuSeid%2BULvsea4JtiGRiSDSJSI%3DEUifiRBkKG5E2XzMDjRfl76ZC9Ub0wnz4XsNiRVBChTYbJcE3F'),
('linkedin', 'LinkedIn', 'Professional networking and career platform', '💼', 'https://docs.microsoft.com/linkedin', 'https://api.linkedin.com/v2', '["access_token"]', '^[a-zA-Z0-9-_]{86}$', 'AQXdSP_W41_UPs5ioT_t8HESyODB4FqbkJ8LrV_5mff4gNmdp_q_lCIhPAjXsP6lkN24'),
('instagram', 'Instagram', 'Photo and video sharing social platform', '📸', 'https://developers.facebook.com/docs/instagram-api', 'https://graph.instagram.com', '["access_token"]', '^[a-zA-Z0-9]{195}$', 'IGQVJYcjE1NVBkaEFISmYzZAW1JQUxMNVBDSEU1MGx2N0hOUGpEUEFwYTFheFo3QnBDTVozNHBBTTg'),

-- Analytics & SEO
('google-analytics', 'Google Analytics', 'Web analytics and user behavior tracking', '📊', 'https://developers.google.com/analytics', 'https://analyticsreporting.googleapis.com', '["api_key", "view_id"]', '^AIza[a-zA-Z0-9_-]{35}$', 'AIzaSyDp-cMne4eJ-EtV68iNlypHdssyZ76cFb4'),
('ahrefs', 'Ahrefs', 'SEO and backlink analysis platform', '🔗', 'https://ahrefs.com/api/documentation', 'https://apiv2.ahrefs.com', '["token"]', '^[a-f0-9]{32}$', 'abcdef1234567890abcdef1234567890ab'),

-- Video & Media
('youtube', 'YouTube Data API', 'Video platform data and analytics', '📺', 'https://developers.google.com/youtube/v3', 'https://www.googleapis.com/youtube/v3', '["api_key"]', '^AIza[a-zA-Z0-9_-]{35}$', 'AIzaSyDp-cMne4eJ-EtV68iNlypHdssyZ76cFb4'),

-- Productivity & Automation
('notion', 'Notion', 'All-in-one workspace for notes and collaboration', '📝', 'https://developers.notion.com', 'https://api.notion.com/v1', '["token"]', '^secret_[a-zA-Z0-9]{43}$', 'secret_1234567890abcdef1234567890abcdef1234567'),
('airtable', 'Airtable', 'Cloud-based database and collaboration platform', '📋', 'https://airtable.com/developers/web/api', 'https://api.airtable.com/v0', '["api_key", "base_id"]', '^pat[a-zA-Z0-9]{17}\.[a-zA-Z0-9]{64}$', 'pat1234567890abcdef.1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12'),
('zapier', 'Zapier', 'Workflow automation between web applications', '⚡', 'https://platform.zapier.com/docs', 'https://zapier.com/api/v1', '["api_key"]', '^[a-f0-9]{32}$', 'abcdef1234567890abcdef1234567890ab');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_providers_name ON api_providers(name);
CREATE INDEX IF NOT EXISTS idx_api_providers_active ON api_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_provider ON user_api_keys(user_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_logs_key_id ON api_key_usage_logs(user_api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_security_events_user_id ON api_security_events(user_id);

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_api_providers_updated_at BEFORE UPDATE ON api_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;