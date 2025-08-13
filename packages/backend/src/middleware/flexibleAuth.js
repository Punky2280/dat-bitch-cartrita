import authenticateToken from './authenticateToken.js';
import apiKeyAuth from './apiKeyAuth.js';

/**
 * Flexible authentication middleware that supports both JWT tokens and API keys
 */
function flexibleAuth(req, res, next) {
  // Check if request has an API key (starts with 'cartrita_')
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];
  
  let hasApiKey = false;
  
  if (authHeader && authHeader.startsWith('Bearer cartrita_')) {
    hasApiKey = true;
  } else if (apiKeyHeader && apiKeyHeader.startsWith('cartrita_')) {
    hasApiKey = true;
  }
  
  if (hasApiKey) {
    // Use API key authentication
    return apiKeyAuth(req, res, next);
  } else {
    // Use JWT token authentication
    return authenticateToken(req, res, next);
  }
}

export default flexibleAuth;