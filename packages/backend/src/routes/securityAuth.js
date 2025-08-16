/* global process, console */
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import fetch from 'node-fetch';
import db from '../db.js';
import { authenticateJWT, authorizeRoles, authorizePermissions } from '../middleware/securityMiddleware.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Enhanced rate limiting for security endpoints
const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // stricter limit for security operations
  message: {
    error: 'Too many security requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login rate limiting (more restrictive)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login requests per windowMs
  message: {
    error: 'Too many login attempts, please try again later.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true,
});

// Apply security limiter to all routes in this module
router.use(securityLimiter);

/**
 * OAuth Provider Configuration
 */
const getOAuthConfig = () => {
  return {
    google: {
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/google/callback`
    },
    github: {
      enabled: !!process.env.GITHUB_CLIENT_ID,
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      redirectUri: process.env.GITHUB_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/github/callback`
    },
    microsoft: {
      enabled: !!process.env.MICROSOFT_CLIENT_ID,
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/microsoft/callback`
    },
    facebook: {
      enabled: !!process.env.FACEBOOK_CLIENT_ID,
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      redirectUri: process.env.FACEBOOK_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/facebook/callback`
    }
  };
};

/**
 * GET /api/security/oauth/providers
 * Get available OAuth providers
 */
router.get('/oauth/providers', (req, res) => {
  try {
    const config = getOAuthConfig();
    const providers = Object.entries(config)
      .filter(([, providerConfig]) => providerConfig.enabled)
      .map(([name, providerConfig]) => ({
        name,
        authUrl: getAuthUrl(name, providerConfig),
        enabled: true
      }));

    res.json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    console.error('[OAuth] Error getting providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OAuth providers'
    });
  }
});

/**
 * Generate OAuth authorization URLs
 */
function getAuthUrl(provider, config) {
  const state = crypto.randomBytes(16).toString('hex');
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:8001';
  
  switch (provider) {
    case 'google':
      const googleClient = new OAuth2Client(config.clientId, config.clientSecret, `${baseUrl}/api/security/oauth/google/callback`);
      return googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['profile', 'email'],
        state
      });
    
    case 'github':
      return `https://github.com/login/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(`${baseUrl}/api/security/oauth/github/callback`)}&scope=user:email&state=${state}`;
    
    case 'microsoft':
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(`${baseUrl}/api/security/oauth/microsoft/callback`)}&scope=openid profile email&state=${state}`;
    
    case 'facebook':
      return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(`${baseUrl}/api/security/oauth/facebook/callback`)}&scope=email&state=${state}`;
    
    default:
      throw new Error(`Unknown OAuth provider: ${provider}`);
  }
}

/**
 * GET /api/security/oauth/google/callback
 * Handle Google OAuth callback
 */
router.get('/oauth/google/callback', async (req, res) => {
  const span = OpenTelemetryTracing.startSpan('oauth.google.callback');
  
  try {
    const { code, error, state } = req.query;
    
    if (error) {
      span.recordException(new Error(`Google OAuth error: ${error}`));
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      span.recordException(new Error('No authorization code received from Google'));
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent('No authorization code received')}`);
    }

    const config = getOAuthConfig().google;
    if (!config.enabled) {
      span.recordException(new Error('Google OAuth not configured'));
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent('Google OAuth not configured')}`);
    }

    const googleClient = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      `${process.env.BACKEND_URL || 'http://localhost:8001'}/api/security/oauth/google/callback`
    );

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user profile
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.clientId
    });

    const payload = ticket.getPayload();
    const googleUserId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    // Check if user exists or create new one
    let user;
    const existingAuth = await db.query(
      'SELECT ua.*, u.email, u.full_name FROM user_authentication ua JOIN users u ON ua.user_id = u.id WHERE ua.auth_provider = $1 AND ua.provider_user_id = $2',
      ['google', googleUserId]
    );

    if (existingAuth.rows.length > 0) {
      // Update existing user
      user = existingAuth.rows[0];
      await db.query(
        'UPDATE user_authentication SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1, auth_data = $1 WHERE id = $2',
        [JSON.stringify({ email, name, picture, tokens }), user.id]
      );
    } else {
      // Check if user exists by email
      const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      
      if (existingUser.rows.length > 0) {
        // Link Google account to existing user
        user = existingUser.rows[0];
        await db.query(
          'INSERT INTO user_authentication (user_id, auth_provider, provider_user_id, auth_data, is_verified) VALUES ($1, $2, $3, $4, $5)',
          [user.id, 'google', googleUserId, JSON.stringify({ email, name, picture, tokens }), true]
        );
      } else {
        // Create new user
        const newUser = await db.query(
          'INSERT INTO users (email, full_name, avatar_url, email_verified) VALUES ($1, $2, $3, $4) RETURNING *',
          [email, name, picture, true]
        );
        
        user = newUser.rows[0];
        
        // Create authentication record
        await db.query(
          'INSERT INTO user_authentication (user_id, auth_provider, provider_user_id, auth_data, is_verified) VALUES ($1, $2, $3, $4, $5)',
          [user.id, 'google', googleUserId, JSON.stringify({ email, name, picture, tokens }), true]
        );

        // Assign default user role
        const defaultRole = await db.query('SELECT id FROM roles WHERE name = $1', ['user']);
        if (defaultRole.rows.length > 0) {
          await db.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [user.id, defaultRole.rows[0].id]
          );
        }
      }
    }

    // Store OAuth tokens
    await db.query(`
      INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, expires_at, scope, token_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `, [
      user.id, 
      'google',
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      'profile email',
      'Bearer'
    ]);

    // Generate JWT for our system
    const jwtPayload = {
      userId: user.id,
      email: user.email || email,
      name: user.full_name || name,
      provider: 'google',
      iat: Math.floor(Date.now() / 1000)
    };

    const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRY || '24h',
      jwtid: crypto.randomUUID()
    });

    // Log security event
    await db.query(
      'INSERT INTO security_audit_log (user_id, action, details, ip_address, success) VALUES ($1, $2, $3, $4, $5)',
      [user.id, 'oauth_login', JSON.stringify({ provider: 'google', email }), req.ip, true]
    );

    span.setStatus({ code: 1 });
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${jwtToken}`);

  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    console.error('[OAuth] Google callback error:', error);
    
    // Log failed attempt
    await db.query(
      'INSERT INTO security_audit_log (action, details, ip_address, success) VALUES ($1, $2, $3, $4)',
      ['oauth_login_failed', JSON.stringify({ provider: 'google', error: error.message }), req.ip, false]
    ).catch(() => {}); // Don't fail on logging failure

    res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent('Authentication failed')}`);
  } finally {
    span.end();
  }
});

/**
 * GET /api/security/oauth/github/callback
 * Handle GitHub OAuth callback
 */
router.get('/oauth/github/callback', async (req, res) => {
  const span = OpenTelemetryTracing.startSpan('oauth.github.callback');
  
  try {
    const { code, error, state } = req.query;
    
    if (error) {
      span.recordException(new Error(`GitHub OAuth error: ${error}`));
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      span.recordException(new Error('No authorization code received from GitHub'));
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent('No authorization code received')}`);
    }

    const config = getOAuthConfig().github;
    if (!config.enabled) {
      span.recordException(new Error('GitHub OAuth not configured'));
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent('GitHub OAuth not configured')}`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(`GitHub token exchange failed: ${tokenData.error_description}`);
    }

    // Get user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'Cartrita-App'
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch GitHub user profile');
    }

    const githubUser = await userResponse.json();

    // Get user email (might be private)
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'Cartrita-App'
      }
    });

    let email = githubUser.email;
    if (!email && emailResponse.ok) {
      const emails = await emailResponse.json();
      const primaryEmail = emails.find(e => e.primary) || emails[0];
      email = primaryEmail?.email;
    }

    // Similar user creation/linking logic as Google OAuth
    let user;
    const existingAuth = await db.query(
      'SELECT ua.*, u.email, u.full_name FROM user_authentication ua JOIN users u ON ua.user_id = u.id WHERE ua.auth_provider = $1 AND ua.provider_user_id = $2',
      ['github', githubUser.id.toString()]
    );

    if (existingAuth.rows.length > 0) {
      user = existingAuth.rows[0];
      await db.query(
        'UPDATE user_authentication SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1, auth_data = $1 WHERE id = $2',
        [JSON.stringify({ ...githubUser, email, tokenData }), user.id]
      );
    } else {
      if (email) {
        const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (existingUser.rows.length > 0) {
          user = existingUser.rows[0];
          await db.query(
            'INSERT INTO user_authentication (user_id, auth_provider, provider_user_id, auth_data, is_verified) VALUES ($1, $2, $3, $4, $5)',
            [user.id, 'github', githubUser.id.toString(), JSON.stringify({ ...githubUser, email, tokenData }), true]
          );
        } else {
          const newUser = await db.query(
            'INSERT INTO users (email, full_name, avatar_url, email_verified) VALUES ($1, $2, $3, $4) RETURNING *',
            [email, githubUser.name || githubUser.login, githubUser.avatar_url, !!email]
          );
          
          user = newUser.rows[0];
          
          await db.query(
            'INSERT INTO user_authentication (user_id, auth_provider, provider_user_id, auth_data, is_verified) VALUES ($1, $2, $3, $4, $5)',
            [user.id, 'github', githubUser.id.toString(), JSON.stringify({ ...githubUser, email, tokenData }), true]
          );

          // Assign default role
          const defaultRole = await db.query('SELECT id FROM roles WHERE name = $1', ['user']);
          if (defaultRole.rows.length > 0) {
            await db.query(
              'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [user.id, defaultRole.rows[0].id]
            );
          }
        }
      } else {
        throw new Error('No email available from GitHub profile');
      }
    }

    // Store OAuth tokens
    await db.query(`
      INSERT INTO oauth_tokens (user_id, provider, access_token, scope, token_type)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        updated_at = CURRENT_TIMESTAMP
    `, [user.id, 'github', tokenData.access_token, tokenData.scope, 'Bearer']);

    // Generate JWT
    const jwtPayload = {
      userId: user.id,
      email: user.email || email,
      name: user.full_name || githubUser.name || githubUser.login,
      provider: 'github',
      iat: Math.floor(Date.now() / 1000)
    };

    const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRY || '24h',
      jwtid: crypto.randomUUID()
    });

    // Log security event
    await db.query(
      'INSERT INTO security_audit_log (user_id, action, details, ip_address, success) VALUES ($1, $2, $3, $4, $5)',
      [user.id, 'oauth_login', JSON.stringify({ provider: 'github', email }), req.ip, true]
    );

    span.setStatus({ code: 1 });
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${jwtToken}`);

  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    console.error('[OAuth] GitHub callback error:', error);
    
    await db.query(
      'INSERT INTO security_audit_log (action, details, ip_address, success) VALUES ($1, $2, $3, $4)',
      ['oauth_login_failed', JSON.stringify({ provider: 'github', error: error.message }), req.ip, false]
    ).catch(() => {});

    res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent('Authentication failed')}`);
  } finally {
    span.end();
  }
});

/**
 * POST /api/security/auth/refresh
 * Refresh JWT token using refresh token
 */
router.post('/auth/refresh', async (req, res) => {
  const span = OpenTelemetryTracing.startSpan('auth.token.refresh');
  
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    // Verify refresh token exists and is valid
    const tokenRecord = await db.query(
      'SELECT ot.*, u.email, u.full_name FROM oauth_tokens ot JOIN users u ON ot.user_id = u.id WHERE ot.refresh_token = $1 AND (ot.expires_at IS NULL OR ot.expires_at > CURRENT_TIMESTAMP)',
      [refreshToken]
    );

    if (tokenRecord.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }

    const tokenData = tokenRecord.rows[0];

    // Generate new JWT
    const jwtPayload = {
      userId: tokenData.user_id,
      email: tokenData.email,
      name: tokenData.full_name,
      provider: tokenData.provider,
      iat: Math.floor(Date.now() / 1000)
    };

    const newJwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRY || '24h',
      jwtid: crypto.randomUUID()
    });

    // Log security event
    await db.query(
      'INSERT INTO security_audit_log (user_id, action, details, ip_address, success) VALUES ($1, $2, $3, $4, $5)',
      [tokenData.user_id, 'token_refresh', JSON.stringify({ provider: tokenData.provider }), req.ip, true]
    );

    span.setStatus({ code: 1 });
    
    res.json({
      success: true,
      data: {
        token: newJwtToken,
        expiresIn: process.env.JWT_EXPIRY || '24h'
      }
    });

  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    console.error('[Auth] Token refresh error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  } finally {
    span.end();
  }
});

/**
 * POST /api/security/auth/logout
 * Enhanced logout with token blacklisting
 */
router.post('/auth/logout', authenticateJWT, async (req, res) => {
  const span = OpenTelemetryTracing.startSpan('auth.logout');
  
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.decode(token);
    
    if (decoded && decoded.jti) {
      // Add token to blacklist
      await db.query(
        'INSERT INTO jwt_blacklist (user_id, jti, expires_at, reason) VALUES ($1, $2, $3, $4) ON CONFLICT (jti) DO NOTHING',
        [req.user.userId, decoded.jti, new Date(decoded.exp * 1000), 'logout']
      );
    }

    // Invalidate all sessions for this user
    await db.query(
      'UPDATE security_sessions SET is_active = false WHERE user_id = $1',
      [req.user.userId]
    );

    // Log security event
    await db.query(
      'INSERT INTO security_audit_log (user_id, action, details, ip_address, success) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, 'logout', JSON.stringify({ reason: 'user_initiated' }), req.ip, true]
    );

    span.setStatus({ code: 1 });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    console.error('[Auth] Logout error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  } finally {
    span.end();
  }
});

/**
 * GET /api/security/auth/profile
 * Get authenticated user profile with security info
 */
router.get('/auth/profile', authenticateJWT, async (req, res) => {
  try {
    // Get user with authentication methods and roles
    const userQuery = await db.query(`
      SELECT 
        u.*,
        array_agg(DISTINCT ua.auth_provider) as auth_providers,
        array_agg(DISTINCT r.name) as roles,
        COUNT(ss.id) as active_sessions
      FROM users u
      LEFT JOIN user_authentication ua ON u.id = ua.user_id
      LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN security_sessions ss ON u.id = ss.user_id AND ss.is_active = true
      WHERE u.id = $1
      GROUP BY u.id
    `, [req.user.userId]);

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userQuery.rows[0];
    
    // Get recent security events
    const securityEvents = await db.query(
      'SELECT action, timestamp, success, ip_address FROM security_audit_log WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 10',
      [req.user.userId]
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          avatarUrl: user.avatar_url,
          emailVerified: user.email_verified,
          createdAt: user.created_at,
          authProviders: user.auth_providers.filter(p => p !== null),
          roles: user.roles.filter(r => r !== null),
          activeSessions: user.active_sessions
        },
        security: {
          recentActivity: securityEvents.rows
        }
      }
    });

  } catch (error) {
    console.error('[Auth] Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

/**
 * POST /api/security/roles/assign
 * Assign roles to users (admin only)
 */
router.post('/roles/assign', authenticateJWT, authorizeRoles(['admin', 'security_admin']), async (req, res) => {
  const span = OpenTelemetryTracing.startSpan('security.role.assign');
  
  try {
    const { userId, roleId, expiresAt } = req.body;
    
    if (!userId || !roleId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Role ID are required'
      });
    }

    // Verify role exists
    const roleExists = await db.query('SELECT id, name FROM roles WHERE id = $1', [roleId]);
    if (roleExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    // Assign role
    await db.query(`
      INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, role_id) DO UPDATE SET
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = CURRENT_TIMESTAMP,
        expires_at = EXCLUDED.expires_at,
        is_active = true
    `, [userId, roleId, req.user.userId, expiresAt || null]);

    // Log security event
    await db.query(
      'INSERT INTO security_audit_log (user_id, action, details, ip_address, success) VALUES ($1, $2, $3, $4, $5)',
      [req.user.userId, 'role_assign', JSON.stringify({ targetUserId: userId, roleId, roleName: roleExists.rows[0].name }), req.ip, true]
    );

    span.setStatus({ code: 1 });
    
    res.json({
      success: true,
      message: `Role ${roleExists.rows[0].name} assigned successfully`
    });

  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    console.error('[Security] Role assignment error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Role assignment failed'
    });
  } finally {
    span.end();
  }
});

/**
 * GET /api/security/audit/logs
 * Get security audit logs (admin only)
 */
router.get('/audit/logs', authenticateJWT, authorizeRoles(['admin', 'security_admin', 'compliance_officer']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      userId, 
      success,
      startDate,
      endDate 
    } = req.query;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (action) {
      whereConditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (userId) {
      whereConditions.push(`user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (success !== undefined) {
      whereConditions.push(`success = $${paramIndex}`);
      params.push(success === 'true');
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`timestamp >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`timestamp <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const query = `
      SELECT 
        sal.*,
        u.email as user_email,
        u.full_name as user_name
      FROM security_audit_log sal
      LEFT JOIN users u ON sal.user_id = u.id
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const logs = await db.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM security_audit_log ${whereClause}`;
    const countResult = await db.query(countQuery, params.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        logs: logs.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('[Security] Audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit logs'
    });
  }
});

export default router;
