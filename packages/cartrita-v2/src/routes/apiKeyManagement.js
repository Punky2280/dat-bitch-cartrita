import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import apiKeyAuth, { createApiKey, listApiKeys, revokeApiKey, generateApiKey } from '../middleware/apiKeyAuth.js';
import crypto from 'crypto';

const router = express.Router();

/**
 * Generate a development API key for testing
 * This provides the actual API key that corresponds to the hashes in the database
 */
function generateDevApiKey(userId, email) {
  return `cartrita_dev_${userId}_${email}`;
}

/**
 * GET /api/api-keys/dev-keys
 * Get development API keys for existing users (for testing)
 */
router.get('/dev-keys', async (req, res) => {
  try {
    // This endpoint provides the development API keys for testing
    const devKeys = [
      {
        user_id: 1,
        email: 'lulufdez84@gmail.com',
        name: 'Lulu Fernandez',
        api_key: generateDevApiKey(1, 'lulufdez84@gmail.com')
      },
      {
        user_id: 2,
        email: 'robert@test.com',
        name: 'Robert Allen',
        api_key: generateDevApiKey(2, 'robert@test.com')
      },
      {
        user_id: 3,
        email: 'robbienosebest@gmail.com',
        name: 'Robert Allen',
        api_key: generateDevApiKey(3, 'robbienosebest@gmail.com')
      }
    ];
    
    res.json({
      success: true,
      message: 'Development API keys for testing',
      keys: devKeys,
      usage: 'Use these keys in Authorization header as "Bearer cartrita_dev_..." or x-api-key header'
    });
  } catch (error) {
    console.error('[APIKeyMgmt] Error getting dev keys:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/api-keys/list
 * List API keys for authenticated user (JWT auth required)
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const apiKeys = await listApiKeys(req.user.id);
    res.json({
      success: true,
      api_keys: apiKeys
    });
  } catch (error) {
    console.error('[APIKeyMgmt] Error listing keys:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/api-keys/create
 * Create new API key for authenticated user (JWT auth required)
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const keyName = name || `API Key ${Date.now()}`;
    
    const apiKey = await createApiKey(req.user.id, keyName);
    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      ...apiKey,
      usage: 'Store this key securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('[APIKeyMgmt] Error creating key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/api-keys/:keyId
 * Revoke an API key (JWT auth required)
 */
router.delete('/:keyId', authenticateToken, async (req, res) => {
  try {
    const keyId = parseInt(req.params.keyId);
    const revokedKey = await revokeApiKey(req.user.id, keyId);
    
    res.json({
      success: true,
      message: 'API key revoked successfully',
      revoked_key: revokedKey
    });
  } catch (error) {
    console.error('[APIKeyMgmt] Error revoking key:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/api-keys/test
 * Test endpoint using API key authentication
 */
router.get('/test', apiKeyAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'API key authentication successful',
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        api_key_name: req.user.api_key_name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[APIKeyMgmt] Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/api-keys/status
 * Get API key system status
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'API Key authentication system is active',
      features: {
        permanent_keys: true,
        jwt_tokens: true,
        automatic_rotation: false
      },
      endpoints: {
        create_key: 'POST /api/api-keys/create (JWT required)',
        list_keys: 'GET /api/api-keys/list (JWT required)',
        revoke_key: 'DELETE /api/api-keys/:id (JWT required)',
        test_auth: 'GET /api/api-keys/test (API key required)',
        dev_keys: 'GET /api/api-keys/dev-keys (public, for development)'
      },
      usage: {
        header_format: 'Authorization: Bearer cartrita_...',
        alternative_header: 'x-api-key: cartrita_...'
      }
    });
  } catch (error) {
    console.error('[APIKeyMgmt] Status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;