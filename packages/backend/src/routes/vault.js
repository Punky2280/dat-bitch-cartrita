import express from 'express';
import SecureEncryptionService from '../system/SecureEncryptionService.js';
import authenticateToken from '../middleware/authenticateToken.js';
import pool from '../db.js';

const router = express.Router();

// Get all API providers
router.get('/providers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, display_name, description, icon, documentation_url, 
             default_base_url, required_fields, validation_pattern, key_format_example, is_active
      FROM api_providers 
      WHERE is_active = true 
      ORDER BY display_name
    `);

    res.json({
      success: true,
      providers: result.rows,
    });
  } catch (error) {
    console.error('Error fetching API providers:', error);
    // Return comprehensive default providers if table doesn't exist
    res.json({
      success: true,
      providers: [
        // AI/ML Providers
        {
          id: 1,
          name: 'openai',
          display_name: 'OpenAI',
          description: 'OpenAI GPT models, DALL-E, Whisper, and Embeddings',
          icon: 'openai',
          documentation_url: 'https://platform.openai.com/docs',
          default_base_url: 'https://api.openai.com/v1',
          required_fields: ['api_key'],
          validation_pattern: 'sk-[A-Za-z0-9]{48,}',
          key_format_example: 'sk-1234567890abcdef...',
          pricing_info: 'Pay-per-token usage',
          capabilities: [
            'text_generation',
            'image_generation',
            'embeddings',
            'speech_to_text',
          ],
          is_active: true,
        },
        {
          id: 2,
          name: 'anthropic',
          display_name: 'Anthropic',
          description: 'Claude AI models for conversational AI',
          icon: 'anthropic',
          documentation_url: 'https://docs.anthropic.com',
          default_base_url: 'https://api.anthropic.com',
          required_fields: ['api_key'],
          validation_pattern: 'sk-ant-[A-Za-z0-9-]{32,}',
          key_format_example: 'sk-ant-api03-...',
          pricing_info: 'Token-based pricing',
          capabilities: ['text_generation', 'analysis', 'coding'],
          is_active: true,
        },
        {
          id: 3,
          name: 'google-ai',
          display_name: 'Google AI (Gemini)',
          description: 'Google Gemini models and PaLM API',
          icon: 'google',
          documentation_url: 'https://ai.google.dev/docs',
          default_base_url: 'https://generativelanguage.googleapis.com',
          required_fields: ['api_key'],
          validation_pattern: 'AIza[A-Za-z0-9_-]{35}',
          key_format_example: 'AIzaSyD...',
          pricing_info: 'Usage-based billing',
          capabilities: ['text_generation', 'multimodal', 'embeddings'],
          is_active: true,
        },
        {
          id: 4,
          name: 'cohere',
          display_name: 'Cohere',
          description: 'Cohere language models and embeddings',
          icon: 'cohere',
          documentation_url: 'https://docs.cohere.ai',
          default_base_url: 'https://api.cohere.ai/v1',
          required_fields: ['api_key'],
          validation_pattern: '[A-Za-z0-9-_]{40,}',
          key_format_example: 'your-api-key-here',
          pricing_info: 'Per-request pricing',
          capabilities: ['text_generation', 'embeddings', 'classification'],
          is_active: true,
        },
        {
          id: 5,
          name: 'huggingface',
          display_name: 'Hugging Face',
          description: 'Access to thousands of ML models',
          icon: 'huggingface',
          documentation_url: 'https://huggingface.co/docs/api-inference',
          default_base_url: 'https://api-inference.huggingface.co',
          required_fields: ['api_key'],
          validation_pattern: 'hf_[A-Za-z0-9]{34}',
          key_format_example: 'hf_...',
          pricing_info: 'Free tier + paid plans',
          capabilities: [
            'text_generation',
            'image_generation',
            'audio',
            'vision',
          ],
          is_active: true,
        },
        {
          id: 6,
          name: 'replicate',
          display_name: 'Replicate',
          description: 'Run machine learning models in the cloud',
          icon: 'replicate',
          documentation_url: 'https://replicate.com/docs',
          default_base_url: 'https://api.replicate.com/v1',
          required_fields: ['api_key'],
          validation_pattern: 'r8_[A-Za-z0-9]{26}',
          key_format_example: 'r8_...',
          pricing_info: 'Pay per second of compute',
          capabilities: [
            'image_generation',
            'video_generation',
            'audio_generation',
          ],
          is_active: true,
        },

        // Cloud Providers
        {
          id: 7,
          name: 'aws',
          display_name: 'Amazon Web Services',
          description: 'AWS cloud services and Bedrock',
          icon: 'aws',
          documentation_url: 'https://docs.aws.amazon.com',
          default_base_url: 'https://bedrock-runtime.us-east-1.amazonaws.com',
          required_fields: ['access_key_id', 'secret_access_key', 'region'],
          validation_pattern: 'AKIA[A-Z0-9]{16}',
          key_format_example: 'AKIAIOSFODNN7EXAMPLE',
          pricing_info: 'Pay-as-you-go',
          capabilities: ['ai_models', 'cloud_services', 'storage'],
          is_active: true,
        },
        {
          id: 8,
          name: 'azure',
          display_name: 'Microsoft Azure',
          description: 'Azure OpenAI Service and Cognitive Services',
          icon: 'azure',
          documentation_url: 'https://docs.microsoft.com/azure',
          default_base_url: 'https://your-resource.openai.azure.com',
          required_fields: ['api_key', 'endpoint'],
          validation_pattern: '[A-Za-z0-9]{32}',
          key_format_example: 'abc123def456...',
          pricing_info: 'Token-based billing',
          capabilities: ['ai_models', 'cognitive_services', 'cloud_services'],
          is_active: true,
        },
        {
          id: 9,
          name: 'gcp',
          display_name: 'Google Cloud Platform',
          description: 'Google Cloud AI and ML services',
          icon: 'gcp',
          documentation_url: 'https://cloud.google.com/docs',
          default_base_url: 'https://us-central1-aiplatform.googleapis.com',
          required_fields: ['service_account_json'],
          validation_pattern: '\\{.*"type":\\s*"service_account".*\\}',
          key_format_example: '{"type": "service_account", ...}',
          pricing_info: 'Usage-based pricing',
          capabilities: ['ai_platform', 'ml_models', 'cloud_services'],
          is_active: true,
        },

        // Communication & Messaging
        {
          id: 10,
          name: 'twilio',
          display_name: 'Twilio',
          description: 'SMS, voice, and communication APIs',
          icon: 'twilio',
          documentation_url: 'https://www.twilio.com/docs',
          default_base_url: 'https://api.twilio.com',
          required_fields: ['account_sid', 'auth_token'],
          validation_pattern: 'AC[a-f0-9]{32}',
          key_format_example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          pricing_info: 'Per message/call pricing',
          capabilities: ['sms', 'voice', 'video', 'messaging'],
          is_active: true,
        },
        {
          id: 11,
          name: 'sendgrid',
          display_name: 'SendGrid',
          description: 'Email delivery and marketing platform',
          icon: 'sendgrid',
          documentation_url: 'https://docs.sendgrid.com',
          default_base_url: 'https://api.sendgrid.com/v3',
          required_fields: ['api_key'],
          validation_pattern: 'SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}',
          key_format_example: 'SG.xx.xx',
          pricing_info: 'Email volume pricing',
          capabilities: ['email_sending', 'email_marketing', 'analytics'],
          is_active: true,
        },
        {
          id: 12,
          name: 'slack',
          display_name: 'Slack',
          description: 'Slack workspace integration and bots',
          icon: 'slack',
          documentation_url: 'https://api.slack.com',
          default_base_url: 'https://slack.com/api',
          required_fields: ['bot_token'],
          validation_pattern: 'xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+',
          key_format_example: 'xoxb-1234-5678-abcd',
          pricing_info: 'Free for basic usage',
          capabilities: ['messaging', 'bot_integration', 'workflows'],
          is_active: true,
        },
        {
          id: 13,
          name: 'discord',
          display_name: 'Discord',
          description: 'Discord bot and server integration',
          icon: 'discord',
          documentation_url: 'https://discord.com/developers/docs',
          default_base_url: 'https://discord.com/api/v10',
          required_fields: ['bot_token'],
          validation_pattern:
            '[A-Za-z0-9_-]{24}\\.[A-Za-z0-9_-]{6}\\.[A-Za-z0-9_-]{27}',
          key_format_example: 'NzkyNzE1NDQwNjIyNjU...',
          pricing_info: 'Free',
          capabilities: ['bot_integration', 'server_management', 'messaging'],
          is_active: true,
        },

        // Voice & Audio
        {
          id: 14,
          name: 'deepgram',
          display_name: 'Deepgram',
          description: 'Speech recognition and audio intelligence',
          icon: 'deepgram',
          documentation_url: 'https://developers.deepgram.com',
          default_base_url: 'https://api.deepgram.com',
          required_fields: ['api_key'],
          validation_pattern: '[A-Za-z0-9]{40}',
          key_format_example: 'abcd1234efgh5678...',
          pricing_info: 'Per minute of audio',
          capabilities: ['speech_to_text', 'audio_intelligence', 'real_time'],
          is_active: true,
        },
        {
          id: 15,
          name: 'elevenlabs',
          display_name: 'ElevenLabs',
          description: 'AI voice generation and cloning',
          icon: 'elevenlabs',
          documentation_url: 'https://docs.elevenlabs.io',
          default_base_url: 'https://api.elevenlabs.io/v1',
          required_fields: ['api_key'],
          validation_pattern: '[a-f0-9]{32}',
          key_format_example: 'sk_abcd1234efgh5678...',
          pricing_info: 'Character-based pricing',
          capabilities: ['text_to_speech', 'voice_cloning', 'audio_generation'],
          is_active: true,
        },

        // Development & Code
        {
          id: 16,
          name: 'github',
          display_name: 'GitHub',
          description: 'GitHub API for repositories and automation',
          icon: 'github',
          documentation_url: 'https://docs.github.com/rest',
          default_base_url: 'https://api.github.com',
          required_fields: ['personal_access_token'],
          validation_pattern: 'gh[ps]_[A-Za-z0-9]{36}',
          key_format_example: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          pricing_info: 'Free tier available',
          capabilities: ['repository_management', 'ci_cd', 'issue_tracking'],
          is_active: true,
        },
        {
          id: 17,
          name: 'vercel',
          display_name: 'Vercel',
          description: 'Deployment platform and edge functions',
          icon: 'vercel',
          documentation_url: 'https://vercel.com/docs',
          default_base_url: 'https://api.vercel.com',
          required_fields: ['api_token'],
          validation_pattern: '[A-Za-z0-9]{24}',
          key_format_example: 'xxxxxxxxxxxxxxxxxxxxxxxx',
          pricing_info: 'Usage-based pricing',
          capabilities: ['deployment', 'edge_functions', 'analytics'],
          is_active: true,
        },

        // Analytics & Data
        {
          id: 18,
          name: 'google-analytics',
          display_name: 'Google Analytics',
          description: 'Website and app analytics',
          icon: 'google-analytics',
          documentation_url: 'https://developers.google.com/analytics',
          default_base_url: 'https://analyticsreporting.googleapis.com',
          required_fields: ['service_account_json'],
          validation_pattern: '\\{.*"type":\\s*"service_account".*\\}',
          key_format_example: '{"type": "service_account", ...}',
          pricing_info: 'Free tier available',
          capabilities: ['web_analytics', 'reporting', 'audience_insights'],
          is_active: true,
        },
        {
          id: 19,
          name: 'mixpanel',
          display_name: 'Mixpanel',
          description: 'Product analytics and user tracking',
          icon: 'mixpanel',
          documentation_url: 'https://developer.mixpanel.com',
          default_base_url: 'https://api.mixpanel.com',
          required_fields: ['api_token', 'api_secret'],
          validation_pattern: '[a-f0-9]{32}',
          key_format_example: 'abcd1234efgh5678...',
          pricing_info: 'Event-based pricing',
          capabilities: ['event_tracking', 'user_analytics', 'cohort_analysis'],
          is_active: true,
        },

        // Financial & Payment
        {
          id: 20,
          name: 'stripe',
          display_name: 'Stripe',
          description: 'Payment processing and financial services',
          icon: 'stripe',
          documentation_url: 'https://stripe.com/docs',
          default_base_url: 'https://api.stripe.com',
          required_fields: ['secret_key'],
          validation_pattern: 'sk_(test_|live_)[A-Za-z0-9]{24}',
          key_format_example: 'sk_test_...',
          pricing_info: 'Per-transaction fees',
          capabilities: [
            'payment_processing',
            'subscriptions',
            'financial_data',
          ],
          is_active: true,
        },
        {
          id: 21,
          name: 'plaid',
          display_name: 'Plaid',
          description: 'Banking data and financial APIs',
          icon: 'plaid',
          documentation_url: 'https://plaid.com/docs',
          default_base_url: 'https://production.plaid.com',
          required_fields: ['client_id', 'secret'],
          validation_pattern: '[a-f0-9]{24}',
          key_format_example: 'abcd1234efgh5678...',
          pricing_info: 'Per-API call pricing',
          capabilities: [
            'bank_connections',
            'transaction_data',
            'identity_verification',
          ],
          is_active: true,
        },

        // Specialized Services
        {
          id: 22,
          name: 'wolfram-alpha',
          display_name: 'Wolfram Alpha',
          description: 'Computational intelligence and knowledge',
          icon: 'wolfram',
          documentation_url: 'https://products.wolframalpha.com/api',
          default_base_url: 'http://api.wolframalpha.com/v2',
          required_fields: ['app_id'],
          validation_pattern: '[A-Z0-9-]{6,10}',
          key_format_example: 'XXXXXX-XXXXXXXXXX',
          pricing_info: 'Query-based pricing',
          capabilities: [
            'computational_queries',
            'mathematical_analysis',
            'data_computation',
          ],
          is_active: true,
        },
        {
          id: 23,
          name: 'weather-api',
          display_name: 'Weather API',
          description: 'Weather data and forecasting',
          icon: 'weather',
          documentation_url: 'https://www.weatherapi.com/docs',
          default_base_url: 'http://api.weatherapi.com/v1',
          required_fields: ['api_key'],
          validation_pattern: '[a-f0-9]{32}',
          key_format_example: 'abcd1234efgh5678...',
          pricing_info: 'Requests-based pricing',
          capabilities: ['current_weather', 'forecasts', 'historical_data'],
          is_active: true,
        },
        {
          id: 24,
          name: 'newsapi',
          display_name: 'News API',
          description: 'News articles and headlines',
          icon: 'news',
          documentation_url: 'https://newsapi.org/docs',
          default_base_url: 'https://newsapi.org/v2',
          required_fields: ['api_key'],
          validation_pattern: '[a-f0-9]{32}',
          key_format_example: 'abcd1234efgh5678...',
          pricing_info: 'Free tier + paid plans',
          capabilities: [
            'news_headlines',
            'article_search',
            'source_filtering',
          ],
          is_active: true,
        },
      ],
    });
  }
});

// Get user's API keys (with masked keys for security)
router.get('/keys', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider_id, active_only = true } = req.query;

    let query = `
      SELECT uak.id, uak.key_name, uak.usage_count, uak.last_used_at, 
             uak.is_active, uak.expires_at, uak.created_at, uak.updated_at,
             uak.rotation_interval_days, uak.next_rotation_at,
             ap.name as provider_name, ap.display_name as provider_display_name,
             ap.icon as provider_icon,
             CASE 
               WHEN uak.key_data IS NOT NULL THEN true 
               ELSE false 
             END as has_key
      FROM user_api_keys uak
      JOIN api_providers ap ON uak.provider_id = ap.id
      WHERE uak.user_id = $1
    `;
    const params = [userId];
    let paramCount = 1;

    if (provider_id) {
      paramCount++;
      query += ` AND uak.provider_id = $${paramCount}`;
      params.push(provider_id);
    }

    if (active_only === 'true') {
      query += ` AND uak.is_active = true`;
    }

    query += ` ORDER BY uak.updated_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      keys: result.rows,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    // Return empty array if table doesn't exist
    res.json({
      success: true,
      keys: [],
    });
  }
});

// Add or update API key
router.post('/keys', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      provider_id,
      key_name,
      key_value,
      expires_at,
      rotation_interval_days = 90,
    } = req.body;

    // Validate required fields
    if (!provider_id || !key_name || !key_value) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID, key name, and key value are required',
      });
    }

    // Check if provider exists
    const providerResult = await pool.query(
      'SELECT validation_pattern FROM api_providers WHERE id = $1 AND is_active = true',
      [provider_id]
    );

    if (providerResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive provider',
      });
    }

    // Validate key format if pattern is provided
    const validationPattern = providerResult.rows[0].validation_pattern;
    if (validationPattern) {
      const regex = new RegExp(validationPattern);
      if (!regex.test(key_value)) {
        return res.status(400).json({
          success: false,
          error: 'API key format is invalid for this provider',
        });
      }
    }

    // Encrypt the API key
    const encryptedKey = SecureEncryptionService.encrypt(key_value);

    // Calculate next rotation date
    const nextRotationAt =
      expires_at ||
      (rotation_interval_days
        ? new Date(Date.now() + rotation_interval_days * 24 * 60 * 60 * 1000)
        : null);

    // Insert or update the key
    const result = await pool.query(
      `
      INSERT INTO user_api_keys 
      (user_id, provider_id, key_name, key_data, expires_at, rotation_interval_days, next_rotation_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, provider_id, key_name) 
      DO UPDATE SET 
        key_data = EXCLUDED.key_data,
        expires_at = EXCLUDED.expires_at,
        rotation_interval_days = EXCLUDED.rotation_interval_days,
        next_rotation_at = EXCLUDED.next_rotation_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, key_name, created_at, updated_at
    `,
      [
        userId,
        provider_id,
        key_name,
        encryptedKey,
        expires_at,
        rotation_interval_days,
        nextRotationAt,
      ]
    );

    // Log security event
    await pool.query(
      `
      INSERT INTO api_security_events (user_id, event_type, description, metadata)
      VALUES ($1, $2, $3, $4)
    `,
      [
        userId,
        'key_created',
        `API key '${key_name}' created for provider ${provider_id}`,
        JSON.stringify({ provider_id, key_name }),
      ]
    );

    res.json({
      success: true,
      message: 'API key saved successfully',
      key: result.rows[0],
    });
  } catch (error) {
    console.error('Error saving API key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete API key
router.delete('/keys/:keyId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;

    const result = await pool.query(
      `
      DELETE FROM user_api_keys 
      WHERE id = $1 AND user_id = $2 
      RETURNING key_name, provider_id
    `,
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    // Log security event
    await pool.query(
      `
      INSERT INTO api_security_events (user_id, event_type, description, metadata)
      VALUES ($1, $2, $3, $4)
    `,
      [
        userId,
        'key_deleted',
        `API key '${result.rows[0].key_name}' deleted`,
        JSON.stringify({
          key_id: keyId,
          provider_id: result.rows[0].provider_id,
        }),
      ]
    );

    res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get security events
router.get('/security-events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `
      SELECT id, event_type, description, metadata, severity, created_at
      FROM api_security_events 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      events: result.rows,
    });
  } catch (error) {
    console.error('Error fetching security events:', error);
    // Return empty array if table doesn't exist
    res.json({
      success: true,
      events: [],
    });
  }
});

// Test API key functionality
router.post('/keys/:keyId/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;

    // Get the encrypted key
    const result = await pool.query(
      `
      SELECT uak.key_data, ap.name as provider_name, ap.default_base_url
      FROM user_api_keys uak
      JOIN api_providers ap ON uak.provider_id = ap.id
      WHERE uak.id = $1 AND uak.user_id = $2 AND uak.is_active = true
    `,
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found or inactive',
      });
    }

    const { key_data, provider_name, default_base_url } = result.rows[0];
    const decryptedKey = SecureEncryptionService.decrypt(key_data);

    // Simple test based on provider
    let testResult = {
      success: false,
      message: 'Test not implemented for this provider',
    };

    switch (provider_name) {
      case 'openai':
        // Test OpenAI API
        try {
          const response = await fetch(`${default_base_url}/models`, {
            headers: { Authorization: `Bearer ${decryptedKey}` },
          });
          testResult = {
            success: response.ok,
            message: response.ok
              ? 'OpenAI API key is valid'
              : 'OpenAI API key test failed',
            status: response.status,
          };
        } catch (error) {
          testResult = {
            success: false,
            message: `Test failed: ${error.message}`,
          };
        }
        break;

      case 'google-ai':
        // Test Google AI API
        try {
          const response = await fetch(
            `${default_base_url}/v1beta/models?key=${decryptedKey}`
          );
          testResult = {
            success: response.ok,
            message: response.ok
              ? 'Google AI API key is valid'
              : 'Google AI API key test failed',
            status: response.status,
          };
        } catch (error) {
          testResult = {
            success: false,
            message: `Test failed: ${error.message}`,
          };
        }
        break;

      default:
        testResult = {
          success: true,
          message: `Key format appears valid for ${provider_name}`,
        };
    }

    // Update last used timestamp
    await pool.query(
      `
      UPDATE user_api_keys 
      SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1
      WHERE id = $1
    `,
      [keyId]
    );

    res.json({
      success: true,
      test_result: testResult,
    });
  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get API key usage analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    // Get usage statistics
    const usageStats = await pool.query(
      `
      SELECT 
        COUNT(*) as total_keys,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_keys,
        COUNT(CASE WHEN last_used_at >= NOW() - INTERVAL '${days} days' THEN 1 END) as recently_used_keys,
        AVG(usage_count) as avg_usage_count,
        SUM(usage_count) as total_usage_count
      FROM user_api_keys 
      WHERE user_id = $1
    `,
      [userId]
    );

    // Get provider distribution
    const providerStats = await pool.query(
      `
      SELECT 
        ap.display_name,
        COUNT(uak.*) as key_count,
        SUM(uak.usage_count) as total_usage
      FROM api_providers ap
      LEFT JOIN user_api_keys uak ON ap.id = uak.provider_id AND uak.user_id = $1
      GROUP BY ap.id, ap.display_name
      ORDER BY key_count DESC
    `,
      [userId]
    );

    // Get security events summary
    const securityStats = await pool.query(
      `
      SELECT 
        event_type,
        COUNT(*) as event_count
      FROM api_security_events 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY event_type
      ORDER BY event_count DESC
    `,
      [userId]
    );

    res.json({
      success: true,
      analytics: {
        usage_stats: usageStats.rows[0],
        provider_distribution: providerStats.rows,
        security_events: securityStats.rows,
        period_days: parseInt(days),
      },
    });
  } catch (error) {
    console.error('Error fetching vault analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rotate API key
router.post('/keys/:keyId/rotate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;
    const { new_key_value } = req.body;

    if (!new_key_value) {
      return res.status(400).json({
        success: false,
        error: 'New key value is required for rotation',
      });
    }

    // Get existing key info
    const keyResult = await pool.query(
      `
      SELECT uak.key_name, uak.provider_id, ap.validation_pattern
      FROM user_api_keys uak
      JOIN api_providers ap ON uak.provider_id = ap.id
      WHERE uak.id = $1 AND uak.user_id = $2
    `,
      [keyId, userId]
    );

    if (keyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    const { key_name, provider_id, validation_pattern } = keyResult.rows[0];

    // Validate new key format
    if (validation_pattern) {
      const regex = new RegExp(validation_pattern);
      if (!regex.test(new_key_value)) {
        return res.status(400).json({
          success: false,
          error: 'New API key format is invalid for this provider',
        });
      }
    }

    // Encrypt new key
    const encryptedNewKey = SecureEncryptionService.encrypt(new_key_value);

    // Update the key
    await pool.query(
      `
      UPDATE user_api_keys 
      SET key_data = $1, 
          last_rotated_at = CURRENT_TIMESTAMP,
          next_rotation_at = CURRENT_TIMESTAMP + INTERVAL '90 days',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
    `,
      [encryptedNewKey, keyId, userId]
    );

    // Log security event
    await pool.query(
      `
      INSERT INTO api_security_events (user_id, event_type, description, metadata, severity)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [
        userId,
        'key_rotated',
        `API key '${key_name}' rotated`,
        JSON.stringify({ key_id: keyId, provider_id }),
        'info',
      ]
    );

    res.json({
      success: true,
      message: 'API key rotated successfully',
    });
  } catch (error) {
    console.error('Error rotating API key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
