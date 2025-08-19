import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
/**
 * Authentication Middleware for Cartrita Backend
 * Provides JWT token validation and user authentication
 */
import jwt from 'jsonwebtoken';
import { OpenTelemetryTracing } from '../system/OpenTelemetryTracing.js';

// JWT secret - in production this should be from environment
const JWT_SECRET = process.env.JWT_SECRET || 'cartrita-dev-secret-key-2024';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (req, res, next) => {
  const tracer = OpenTelemetryTracing.getTracer();
  
  await tracer.startActiveSpan('auth.authenticateToken', async (span) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

      if (!token) {
        span.setAttributes({
          'auth.success': false,
          'auth.error': 'no_token'
        });
        return res.status(401).json({ 
          success: false, 
          error: 'Access token required',
          code: 'NO_TOKEN'
        });
      }

      // Verify JWT token
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
          span.setAttributes({
            'auth.success': false,
            'auth.error': 'invalid_token',
            'auth.error_detail': err.name
          });
          return res.status(403).json({ 
            success: false, 
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
          });
        }

        // Add user info to request
        req.user = user;
        
        span.setAttributes({
          'auth.success': true,
          'auth.user_id': user.id || user.userId || 'unknown',
          'auth.username': user.username || 'unknown'
        });

        next();
      });
    } catch (error) {
      span.recordException(error);
      span.setAttributes({
        'auth.success': false,
        'auth.error': 'auth_error'
      });
      
      console.error('Authentication error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Authentication service error',
        code: 'AUTH_ERROR'
      });
    } finally {
      span.end();
    }
  });
};

/**
 * Optional authentication - allows both authenticated and anonymous access
 */
export const optionalAuth = async (req, res, next) => {
  const tracer = OpenTelemetryTracing.getTracer();
  
  await tracer.startActiveSpan('auth.optionalAuth', async (span) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        // No token provided - continue as anonymous
        req.user = { anonymous: true };
        span.setAttributes({
          'auth.mode': 'anonymous',
          'auth.success': true
        });
        return next();
      }

      // Verify token if provided
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
          // Invalid token - continue as anonymous but log warning
          console.warn('Invalid token in optional auth:', err.name);
          req.user = { anonymous: true, tokenError: err.name };
          span.setAttributes({
            'auth.mode': 'anonymous_with_invalid_token',
            'auth.success': true,
            'auth.token_error': err.name
          });
        } else {
          // Valid token - use authenticated user
          req.user = user;
          span.setAttributes({
            'auth.mode': 'authenticated',
            'auth.success': true,
            'auth.user_id': user.id || user.userId || 'unknown'
          });
        }
        next();
      });
    } catch (error) {
      span.recordException(error);
      console.error('Optional auth error:', error);
      
      // On error, continue as anonymous
      req.user = { anonymous: true, error: true };
      span.setAttributes({
        'auth.mode': 'anonymous_with_error',
        'auth.success': true,
        'auth.error': true
      });
      next();
    } finally {
      span.end();
    }
  });
};

/**
 * Generate JWT token for user
 */
export const generateToken = (user) => {
  const payload = {
    id: user.id,
    userId: user.id,
    username: user.username || user.email,
    email: user.email,
    role: user.role || 'user',
    permissions: user.permissions || [],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(payload, JWT_SECRET);
};

/**
 * Verify and decode JWT token without middleware
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles) => {
  return async (req, res, next) => {
    const tracer = OpenTelemetryTracing.getTracer();
    
    await tracer.startActiveSpan('auth.requireRole', async (span) => {
      try {
        if (!req.user || req.user.anonymous) {
          span.setAttributes({
            'auth.success': false,
            'auth.error': 'no_user'
          });
          return res.status(401).json({ 
            success: false, 
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          });
        }

        const userRole = req.user.role || 'user';
        const requiredRoles = Array.isArray(roles) ? roles : [roles];

        if (!requiredRoles.includes(userRole)) {
          span.setAttributes({
            'auth.success': false,
            'auth.error': 'insufficient_role',
            'auth.user_role': userRole,
            'auth.required_roles': requiredRoles.join(',')
          });
          return res.status(403).json({ 
            success: false, 
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }

        span.setAttributes({
          'auth.success': true,
          'auth.user_role': userRole,
          'auth.required_roles': requiredRoles.join(',')
        });

        next();
      } catch (error) {
        span.recordException(error);
        console.error('Role authorization error:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Authorization service error',
          code: 'AUTHZ_ERROR'
        });
      } finally {
        span.end();
      }
    });
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    const tracer = OpenTelemetryTracing.getTracer();
    
    await tracer.startActiveSpan('auth.requirePermission', async (span) => {
      try {
        if (!req.user || req.user.anonymous) {
          span.setAttributes({
            'auth.success': false,
            'auth.error': 'no_user'
          });
          return res.status(401).json({ 
            success: false, 
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
          });
        }

        const userPermissions = req.user.permissions || [];
        
        if (!userPermissions.includes(permission) && req.user.role !== 'admin') {
          span.setAttributes({
            'auth.success': false,
            'auth.error': 'insufficient_permission',
            'auth.required_permission': permission,
            'auth.user_permissions': userPermissions.join(',')
          });
          return res.status(403).json({ 
            success: false, 
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }

        span.setAttributes({
          'auth.success': true,
          'auth.required_permission': permission,
          'auth.user_permissions': userPermissions.join(',')
        });

        next();
      } catch (error) {
        span.recordException(error);
        console.error('Permission authorization error:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Authorization service error',
          code: 'AUTHZ_ERROR'
        });
      } finally {
        span.end();
      }
    });
  };
};

/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimitMap = new Map();
export const rateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    keyGenerator = (req) => req.ip
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (rateLimitMap.has(key)) {
      const requests = rateLimitMap.get(key).filter(timestamp => timestamp > windowStart);
      rateLimitMap.set(key, requests);
    }

    // Get current requests in window
    const currentRequests = rateLimitMap.get(key) || [];
    
    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    currentRequests.push(now);
    rateLimitMap.set(key, currentRequests);

    // Add headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - currentRequests.length - 1),
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    });

    next();
  };
};

// Default export for convenience
export default {
  authenticateToken,
  optionalAuth,
  generateToken,
  verifyToken,
  requireRole,
  requirePermission,
  rateLimit
};