/**
 * @fileoverview Authentication Middleware for V2 Backend
 * JWT token validation for secure agent access
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cartrita-v2-secret-key';

/**
 * Authenticate JWT token middleware
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      path: req.path,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      error: 'Access token required',
      message: 'Please provide a valid JWT token'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn('Authentication failed: Invalid token', {
        error: err.message,
        path: req.path,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }

    // Add user info to request
    req.user = {
      id: user.sub || user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      is_admin: user.is_admin || false,
      preferences: user.preferences || {}
    };

    logger.debug('User authenticated successfully', {
      userId: req.user.id,
      email: req.user.email,
      path: req.path
    });

    next();
  });
}

/**
 * Require admin role middleware
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (!req.user.is_admin) {
    logger.warn('Admin access denied', {
      userId: req.user.id,
      path: req.path
    });
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'This operation requires administrator privileges'
    });
  }

  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = {
        id: user.sub || user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        is_admin: user.is_admin || false,
        preferences: user.preferences || {}
      };
    }
    next();
  });
}

logger.info('✅ Authentication middleware initialized');