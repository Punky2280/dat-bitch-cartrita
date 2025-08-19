/**
 * @fileoverview Request Validation Middleware for V2 Backend
 * Schema-based request validation for secure agent interactions
 */

import { logger } from '../utils/logger.js';

/**
 * Validate request against schema
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    try {
      const errors = [];

      // Validate body if schema defines body validation
      if (schema.body) {
        const bodyErrors = validateObject(req.body, schema.body, 'body');
        errors.push(...bodyErrors);
      }

      // Validate query parameters if schema defines query validation
      if (schema.query) {
        const queryErrors = validateObject(req.query, schema.query, 'query');
        errors.push(...queryErrors);
      }

      // Validate URL parameters if schema defines params validation
      if (schema.params) {
        const paramsErrors = validateObject(req.params, schema.params, 'params');
        errors.push(...paramsErrors);
      }

      if (errors.length > 0) {
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors,
          userId: req.user?.id
        });

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: 'Request does not meet validation requirements',
          details: errors
        });
      }

      logger.debug('Request validation passed', {
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });

      next();
    } catch (error) {
      logger.error('Validation middleware error', error, {
        path: req.path,
        method: req.method
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}

/**
 * Validate object against field schema
 */
function validateObject(obj, schema, section) {
  const errors = [];
  
  if (!obj) {
    obj = {};
  }

  // Check required fields
  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];
    const fieldPath = `${section}.${field}`;

    // Required field check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: fieldPath,
        error: 'required',
        message: `${field} is required`
      });
      continue;
    }

    // Skip validation if field is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    if (rules.type) {
      const typeError = validateType(value, rules.type, fieldPath);
      if (typeError) {
        errors.push(typeError);
        continue;
      }
    }

    // String length validation
    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: fieldPath,
          error: 'minLength',
          message: `${field} must be at least ${rules.minLength} characters long`
        });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: fieldPath,
          error: 'maxLength',
          message: `${field} must be no more than ${rules.maxLength} characters long`
        });
      }
    }

    // Number range validation
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({
          field: fieldPath,
          error: 'min',
          message: `${field} must be at least ${rules.min}`
        });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({
          field: fieldPath,
          error: 'max',
          message: `${field} must be no more than ${rules.max}`
        });
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field: fieldPath,
        error: 'enum',
        message: `${field} must be one of: ${rules.enum.join(', ')}`
      });
    }

    // Email validation
    if (rules.format === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push({
          field: fieldPath,
          error: 'format',
          message: `${field} must be a valid email address`
        });
      }
    }

    // Custom validation function
    if (rules.validate && typeof rules.validate === 'function') {
      try {
        const customResult = rules.validate(value);
        if (customResult !== true) {
          errors.push({
            field: fieldPath,
            error: 'custom',
            message: customResult || `${field} failed custom validation`
          });
        }
      } catch (error) {
        errors.push({
          field: fieldPath,
          error: 'custom',
          message: `${field} validation error: ${error.message}`
        });
      }
    }
  }

  return errors;
}

/**
 * Validate value type
 */
function validateType(value, expectedType, fieldPath) {
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  
  if (actualType !== expectedType) {
    return {
      field: fieldPath,
      error: 'type',
      message: `Expected ${expectedType}, got ${actualType}`
    };
  }
  
  return null;
}

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export function sanitizeInput(req, res, next) {
  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    next();
  } catch (error) {
    logger.error('Input sanitization error', error);
    res.status(500).json({
      success: false,
      error: 'Input processing error'
    });
  }
}

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    // Basic XSS prevention
    return obj
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

logger.info('✅ Validation middleware initialized');