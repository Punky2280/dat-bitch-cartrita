/* global process, console */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Enhanced Security Middleware for Task 18
 * Provides JWT authentication, RBAC authorization, encryption utilities, and audit logging
 */

// JWT Authentication Middleware
export const authenticateJWT = async (req, res, next) => {
  const span = OpenTelemetryTracing.startSpan('security.authenticate_jwt');
  
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      span.setStatus({ code: 2, message: 'No authorization header' });
      return res.status(401).json({
        success: false,
        error: 'Access token is required'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      span.setStatus({ code: 2, message: 'No token provided' });
      return res.status(401).json({
        success: false,
        error: 'Access token format invalid'
      });
    }

    // Check if token is blacklisted
    const blacklistedCheck = await db.query(
      'SELECT id FROM jwt_blacklist WHERE token_jti = $1 AND expires_at > NOW()',
      [token] // In production, extract jti from decoded token
    );

    if (blacklistedCheck.rows.length > 0) {
      span.setStatus({ code: 2, message: 'Token blacklisted' });
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user information
    const userQuery = await db.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userQuery.rows.length === 0) {
      span.setStatus({ code: 2, message: 'User not found' });
      return res.status(401).json({
        success: false,
        error: 'Invalid token - user not found'
      });
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username || userQuery.rows[0].username,
      email: decoded.email || userQuery.rows[0].email,
      auth_type: decoded.auth_type || 'local'
    };

    span.addEvent('jwt.authentication.success', { userId: req.user.userId });
    span.setStatus({ code: 1 });
    
    next();

  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    console.error('JWT authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  } finally {
    span.end();
  }
};

// Role-based Authorization Middleware
export const authorizeRoles = (allowedRoles) => {
  return async (req, res, next) => {
    const span = SimplifiedOpenTelemetryTracing.startSpan('security.authorize_roles');
    
    try {
      if (!req.user) {
        span.setStatus({ code: 2, message: 'No user context' });
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user roles
      const rolesQuery = await db.query(
        `SELECT r.name FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND ur.is_active = true 
           AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
        [req.user.userId]
      );

      const userRoles = rolesQuery.rows.map(row => row.name);

      // Check if user has any of the allowed roles
      const hasPermission = allowedRoles.some(role => userRoles.includes(role));

      if (!hasPermission) {
        span.setStatus({ code: 2, message: 'Insufficient role permissions' });
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      span.addEvent('role.authorization.success', { 
        userId: req.user.userId, 
        userRoles,
        allowedRoles 
      });
      span.setStatus({ code: 1 });
      
      next();

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      
      console.error('Role authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    } finally {
      span.end();
    }
  };
};

// Permission-based Authorization Middleware
export const authorizePermissions = (requiredPermissions) => {
  return async (req, res, next) => {
    const span = SimplifiedOpenTelemetryTracing.startSpan('security.authorize_permissions');
    
    try {
      if (!req.user) {
        span.setStatus({ code: 2, message: 'No user context' });
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Check each required permission
      const permissionChecks = await Promise.all(
        requiredPermissions.map(async (permission) => {
          const [resource, action] = permission.split('.');
          
          const result = await db.query(
            'SELECT check_user_permission($1, $2, $3) as has_permission',
            [req.user.userId, resource, action]
          );
          
          return result.rows[0]?.has_permission || false;
        })
      );

      // Check if user has all required permissions
      const hasAllPermissions = permissionChecks.every(Boolean);

      if (!hasAllPermissions) {
        span.setStatus({ code: 2, message: 'Insufficient permissions' });
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      span.addEvent('permission.authorization.success', { 
        userId: req.user.userId, 
        requiredPermissions 
      });
      span.setStatus({ code: 1 });
      
      next();

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      
      console.error('Permission authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    } finally {
      span.end();
    }
  };
};

// JWT Token Generation Utility
export const generateJWT = (payload, options = {}) => {
  const defaultOptions = {
    expiresIn: '2h',
    issuer: 'cartrita-security',
    audience: 'cartrita-app'
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    ...defaultOptions,
    ...options
  });
};

// Encryption Utilities
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);

export const encryptData = (data) => {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Encryption failed');
  }
};

export const decryptData = (encryptedData, ivHex) => {
  try {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Decryption failed');
  }
};

// Security Audit Logging
export const auditLog = async (eventType, userId, details = {}, req = null) => {
  const span = SimplifiedOpenTelemetryTracing.startSpan('security.audit_log');
  
  try {
    const auditData = {
      event_type: eventType,
      user_id: userId,
      details: JSON.stringify(details),
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      timestamp: new Date()
    };

    await db.query(
      `INSERT INTO security_audit_log 
       (event_type, user_id, details, ip_address, user_agent, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        auditData.event_type,
        auditData.user_id,
        auditData.details,
        auditData.ip_address,
        auditData.user_agent,
        auditData.timestamp
      ]
    );

    span.addEvent('audit.log.created', { eventType, userId });
    span.setStatus({ code: 1 });

  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    console.error('Audit logging error:', error);
  } finally {
    span.end();
  }
};

// Security Headers Middleware
export const securityHeaders = (req, res, next) => {
  // Remove or modify headers that reveal server information
  res.removeHeader('X-Powered-By');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  
  // HSTS header for HTTPS
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// Rate Limiting by User ID
export const userRateLimit = (windowMs = 60000, maxRequests = 100) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user?.userId) {
      return next();
    }
    
    const userId = req.user.userId;
    const now = Date.now();
    
    if (!userRequests.has(userId)) {
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userRequest = userRequests.get(userId);
    
    if (now > userRequest.resetTime) {
      userRequest.count = 1;
      userRequest.resetTime = now + windowMs;
      return next();
    }
    
    userRequest.count++;
    
    if (userRequest.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'User rate limit exceeded',
        resetTime: new Date(userRequest.resetTime)
      });
    }
    
    next();
  };
};

// Session Management
export const createSession = async (userId, deviceFingerprint, req) => {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(16).toString('hex');
  
  await db.query(
    `INSERT INTO security_sessions 
     (session_id, user_id, device_fingerprint, user_agent, ip_address, 
      created_at, last_activity, expires_at, csrf_token)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW() + INTERVAL '24 hours', $6)`,
    [
      sessionId,
      userId,
      deviceFingerprint,
      req.headers['user-agent'],
      req.ip,
      csrfToken
    ]
  );
  
  return { sessionId, csrfToken };
};

export const validateSession = async (sessionId) => {
  const result = await db.query(
    `SELECT * FROM security_sessions 
     WHERE session_id = $1 AND is_active = true AND expires_at > NOW()`,
    [sessionId]
  );
  
  if (result.rows.length > 0) {
    // Update last activity
    await db.query(
      'UPDATE security_sessions SET last_activity = NOW() WHERE id = $1',
      [result.rows[0].id]
    );
    
    return result.rows[0];
  }
  
  return null;
};

// Default export for backward compatibility
export default {
  authenticateJWT,
  authorizeRoles,
  authorizePermissions,
  generateJWT,
  encryptData,
  decryptData,
  auditLog,
  securityHeaders,
  userRateLimit,
  createSession,
  validateSession
};
