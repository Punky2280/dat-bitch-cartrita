import crypto from 'crypto';
import db from '../db.js';

/**
 * Simple API Key authentication middleware for permanent tokens
 * Creates and validates API keys stored in database
 */

const API_KEY_PREFIX = 'cartrita_';
const API_KEY_LENGTH = 32;

/**
 * Generate a new API key
 */
export function generateApiKey() {
  const randomPart = crypto.randomBytes(API_KEY_LENGTH).toString('hex');
  return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Hash an API key for storage
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(userId, name = 'Default API Key') {
  try {
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);

    const result = await db.query(
      `INSERT INTO user_api_keys_permanent (user_id, name, key_hash, created_at, last_used_at, is_active)
       VALUES ($1, $2, $3, NOW(), NULL, true)
       RETURNING id, name, created_at`,
      [userId, name, hashedKey]
    );

    return {
      id: result.rows[0].id,
      name: result.rows[0].name,
      api_key: apiKey, // Only returned once during creation
      created_at: result.rows[0].created_at,
    };
  } catch (error) {
    console.error('[APIKeyAuth] Error creating API key:', error);
    throw new Error('Failed to create API key');
  }
}

/**
 * API Key authentication middleware
 */
async function authenticateApiKey(req, res, next) {
  try {
    // Check for API key in Authorization header: "Bearer cartrita_..."
    const authHeader = req.headers.authorization;
    let apiKey = null;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (
        parts.length === 2 &&
        parts[0] === 'Bearer' &&
        parts[1].startsWith(API_KEY_PREFIX)
      ) {
        apiKey = parts[1];
      }
    }

    // Also check for API key in x-api-key header
    if (
      !apiKey &&
      req.headers['x-api-key'] &&
      req.headers['x-api-key'].startsWith(API_KEY_PREFIX)
    ) {
      apiKey = req.headers['x-api-key'];
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message:
          'Provide API key in Authorization header as "Bearer cartrita_..." or x-api-key header',
      });
    }

    // Hash the provided key and look it up
    const hashedKey = hashApiKey(apiKey);

    const result = await db.query(
      `SELECT uak.id, uak.user_id, uak.name, uak.created_at, uak.last_used_at,
              u.name as user_name, u.email, u.role, u.is_admin
       FROM user_api_keys_permanent uak
       JOIN users u ON u.id = uak.user_id
       WHERE uak.key_hash = $1 AND uak.is_active = true`,
      [hashedKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'API key not found or inactive',
      });
    }

    const keyData = result.rows[0];

    // Update last used timestamp
    await db.query(
      'UPDATE user_api_keys_permanent SET last_used_at = NOW() WHERE id = $1',
      [keyData.id]
    );

    // Set user context similar to JWT auth
    req.user = {
      id: keyData.user_id,
      name: keyData.user_name,
      email: keyData.email,
      role: keyData.role || 'user',
      is_admin: keyData.is_admin || false,
      api_key_id: keyData.id,
      api_key_name: keyData.name,
    };

    console.log(
      `[APIKeyAuth] ✅ Authenticated via API key: ${keyData.name} (User: ${keyData.user_name})`
    );
    next();
  } catch (error) {
    console.error('[APIKeyAuth] Authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during API key validation',
    });
  }
}

/**
 * List API keys for a user (without revealing the actual keys)
 */
export async function listApiKeys(userId) {
  try {
    const result = await db.query(
      `SELECT id, name, created_at, last_used_at, is_active
       FROM user_api_keys_permanent
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('[APIKeyAuth] Error listing API keys:', error);
    throw new Error('Failed to list API keys');
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(userId, keyId) {
  try {
    const result = await db.query(
      `UPDATE user_api_keys_permanent 
       SET is_active = false, revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_active = true
       RETURNING id, name`,
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('API key not found or already revoked');
    }

    return result.rows[0];
  } catch (error) {
    console.error('[APIKeyAuth] Error revoking API key:', error);
    throw error;
  }
}

export default authenticateApiKey;
