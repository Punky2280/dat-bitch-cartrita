import express from 'express';
import EncryptionService from '../system/EncryptionService.js';
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
      providers: result.rows
    });
  } catch (error) {
    console.error('Error fetching API providers:', error);
    res.status(500).json({ success: false, error: error.message });
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
      keys: result.rows
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ success: false, error: error.message });
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
      rotation_interval_days = 90 
    } = req.body;

    // Validate required fields
    if (!provider_id || !key_name || !key_value) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID, key name, and key value are required'
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
        error: 'Invalid or inactive provider'
      });
    }

    // Validate key format if pattern is provided
    const validationPattern = providerResult.rows[0].validation_pattern;
    if (validationPattern) {
      const regex = new RegExp(validationPattern);
      if (!regex.test(key_value)) {
        return res.status(400).json({
          success: false,
          error: 'API key format is invalid for this provider'
        });
      }
    }

    // Encrypt the API key
    const encryptedKey = EncryptionService.encrypt(key_value);

    // Calculate next rotation date
    const nextRotationAt = expires_at || (rotation_interval_days ? 
      new Date(Date.now() + (rotation_interval_days * 24 * 60 * 60 * 1000)) : null);

    // Insert or update the key
    const result = await pool.query(`
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
    `, [userId, provider_id, key_name, encryptedKey, expires_at, rotation_interval_days, nextRotationAt]);

    // Log security event
    await pool.query(`
      INSERT INTO api_security_events (user_id, event_type, description, metadata)
      VALUES ($1, $2, $3, $4)
    `, [
      userId, 
      'key_created', 
      `API key '${key_name}' created for provider ${provider_id}`,
      JSON.stringify({ provider_id, key_name })
    ]);

    res.json({
      success: true,
      message: 'API key saved successfully',
      key: result.rows[0]
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

    const result = await pool.query(`
      DELETE FROM user_api_keys 
      WHERE id = $1 AND user_id = $2 
      RETURNING key_name, provider_id
    `, [keyId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // Log security event
    await pool.query(`
      INSERT INTO api_security_events (user_id, event_type, description, metadata)
      VALUES ($1, $2, $3, $4)
    `, [
      userId, 
      'key_deleted', 
      `API key '${result.rows[0].key_name}' deleted`,
      JSON.stringify({ key_id: keyId, provider_id: result.rows[0].provider_id })
    ]);

    res.json({
      success: true,
      message: 'API key deleted successfully'
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

    const result = await pool.query(`
      SELECT id, event_type, description, metadata, severity, created_at
      FROM api_security_events 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    res.json({
      success: true,
      events: result.rows
    });

  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test API key functionality
router.post('/keys/:keyId/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;

    // Get the encrypted key
    const result = await pool.query(`
      SELECT uak.key_data, ap.name as provider_name, ap.default_base_url
      FROM user_api_keys uak
      JOIN api_providers ap ON uak.provider_id = ap.id
      WHERE uak.id = $1 AND uak.user_id = $2 AND uak.is_active = true
    `, [keyId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found or inactive'
      });
    }

    const { key_data, provider_name, default_base_url } = result.rows[0];
    const decryptedKey = EncryptionService.decrypt(key_data);

    // Simple test based on provider
    let testResult = { success: false, message: 'Test not implemented for this provider' };

    switch (provider_name) {
      case 'openai':
        // Test OpenAI API
        try {
          const response = await fetch(`${default_base_url}/models`, {
            headers: { 'Authorization': `Bearer ${decryptedKey}` }
          });
          testResult = {
            success: response.ok,
            message: response.ok ? 'OpenAI API key is valid' : 'OpenAI API key test failed',
            status: response.status
          };
        } catch (error) {
          testResult = { success: false, message: `Test failed: ${error.message}` };
        }
        break;

      case 'google-ai':
        // Test Google AI API
        try {
          const response = await fetch(`${default_base_url}/v1beta/models?key=${decryptedKey}`);
          testResult = {
            success: response.ok,
            message: response.ok ? 'Google AI API key is valid' : 'Google AI API key test failed',
            status: response.status
          };
        } catch (error) {
          testResult = { success: false, message: `Test failed: ${error.message}` };
        }
        break;

      default:
        testResult = { success: true, message: `Key format appears valid for ${provider_name}` };
    }

    // Update last used timestamp
    await pool.query(`
      UPDATE user_api_keys 
      SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1
      WHERE id = $1
    `, [keyId]);

    res.json({
      success: true,
      test_result: testResult
    });

  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;