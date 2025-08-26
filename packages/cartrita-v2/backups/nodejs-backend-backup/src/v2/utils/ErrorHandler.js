/*
 * Cartrita V2 Error Handler
 * Comprehensive error handling for V2 API
 */

import { traceOperation } from '../../system/OpenTelemetryTracing.js';
import { CartritaV2ResponseFormatter } from './ResponseFormatter.js';

export class CartritaV2ErrorHandler {
  
  // Create validation error
  static createValidationError(field, message) {
    const error = new Error(`Validation failed for field '${field}': ${message}`);
    error.name = 'ValidationError';
    error.field = field;
    error.statusCode = 400;
    return error;
  }
  
  // Create authentication error
  static createAuthError(message = 'Authentication required') {
    const error = new Error(message);
    error.name = 'UnauthorizedError';
    error.statusCode = 401;
    return error;
  }
  
  // Create authorization error
  static createAuthorizationError(message = 'Insufficient permissions') {
    const error = new Error(message);
    error.name = 'ForbiddenError';
    error.statusCode = 403;
    return error;
  }
  
  // Create not found error
  static createNotFoundError(resource) {
    const error = new Error(`${resource} not found`);
    error.name = 'NotFoundError';
    error.resource = resource;
    error.statusCode = 404;
    return error;
  }
  
  // Create rate limit error
  static createRateLimitError(retryAfter) {
    const error = new Error('Rate limit exceeded');
    error.name = 'RateLimitError';
    error.retryAfter = retryAfter;
    error.statusCode = 429;
    return error;
  }
  
  // Create service unavailable error
  static createServiceUnavailableError(service) {
    const error = new Error(`${service} service is unavailable`);
    error.name = 'ServiceUnavailableError';
    error.service = service;
    error.statusCode = 503;
    return error;
  }
  
  // Global error middleware
  static middleware() {
    return (error, req, res, next) => {
      const span = traceOperation('v2.error_handler.global');
      
      try {
        const errorId = `v2_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Log error with context
        console.error('[V2 Error Handler]', {
          errorId,
          name: error.name,
          message: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
          user: req.user?.id,
          request_id: req.requestId,
          timestamp: new Date().toISOString()
        });
        
        // Determine error type and response
        let statusCode = error.statusCode || 500;
        let errorType = 'INTERNAL_ERROR';
        let responseData = {};
        
        switch (error.name) {
          case 'ValidationError':
            statusCode = 400;
            errorType = 'VALIDATION_ERROR';
            responseData.field = error.field;
            break;
            
          case 'UnauthorizedError':
            statusCode = 401;
            errorType = 'UNAUTHORIZED';
            responseData.auth_required = true;
            break;
            
          case 'ForbiddenError':
            statusCode = 403;
            errorType = 'FORBIDDEN';
            break;
            
          case 'NotFoundError':
            statusCode = 404;
            errorType = 'NOT_FOUND';
            responseData.resource = error.resource;
            break;
            
          case 'RateLimitError':
            statusCode = 429;
            errorType = 'RATE_LIMIT_EXCEEDED';
            responseData.retry_after = error.retryAfter;
            break;
            
          case 'ServiceUnavailableError':
            statusCode = 503;
            errorType = 'SERVICE_UNAVAILABLE';
            responseData.service = error.service;
            break;
            
          case 'MongoError':
          case 'PostgresError':
            statusCode = 500;
            errorType = 'DATABASE_ERROR';
            // Don't expose database details to client
            error.message = 'Database operation failed';
            break;
            
          case 'TimeoutError':
            statusCode = 504;
            errorType = 'TIMEOUT_ERROR';
            break;
            
          default:
            statusCode = 500;
            errorType = 'INTERNAL_ERROR';
            // Don't expose internal error details in production
            if (process.env.NODE_ENV === 'production') {
              error.message = 'An internal error occurred';
            }
        }
        
        res.status(statusCode).json(CartritaV2ResponseFormatter.error(
          error.message,
          statusCode,
          {
            error_type: errorType,
            error_id: errorId,
            request_id: req.requestId,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString(),
            ...responseData
          }
        ));
        
        span?.setAttributes({
          'error.type': errorType,
          'error.status_code': statusCode,
          'error.handled': true,
          'error.id': errorId
        });
        
      } catch (handlerError) {
        console.error('[V2 Error Handler] Handler error:', handlerError);
        
        // Fallback error response
        res.status(500).json({
          success: false,
          error: 'Critical error in error handler',
          meta: {
            api_version: 'v2',
            timestamp: new Date().toISOString(),
            error_type: 'CRITICAL_ERROR'
          }
        });
        
        span?.setAttributes({
          'error.critical': true,
          'error.handler_failed': true
        });
      } finally {
        span?.end();
      }
    };
  }
  
  // Async error wrapper
  static asyncWrapper(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
  
  // Validation error formatter
  static formatValidationErrors(errors) {
    return errors.map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));
  }
  
  // Custom error types
  static get ErrorTypes() {
    return {
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      UNAUTHORIZED: 'UNAUTHORIZED',
      FORBIDDEN: 'FORBIDDEN',
      NOT_FOUND: 'NOT_FOUND',
      RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
      SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
      DATABASE_ERROR: 'DATABASE_ERROR',
      TIMEOUT_ERROR: 'TIMEOUT_ERROR',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
      CRITICAL_ERROR: 'CRITICAL_ERROR'
    };
  }
}

// V2 Input validation helpers
export class CartritaV2Validators {
  
  static validateRequired(value, fieldName) {
    if (value === undefined || value === null || value === '') {
      throw CartritaV2ErrorHandler.createValidationError(fieldName, 'Field is required');
    }
  }
  
  static validateType(value, expectedType, fieldName) {
    if (typeof value !== expectedType) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName, 
        `Expected ${expectedType}, got ${typeof value}`
      );
    }
  }
  
  static validateRange(value, min, max, fieldName) {
    if (typeof value !== 'number' || value < min || value > max) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        `Value must be a number between ${min} and ${max}`
      );
    }
  }
  
  static validateEnum(value, allowedValues, fieldName) {
    if (!allowedValues.includes(value)) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        `Value must be one of: ${allowedValues.join(', ')}`
      );
    }
  }
  
  static validateEmail(value, fieldName) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        'Must be a valid email address'
      );
    }
  }
  
  static validateUrl(value, fieldName) {
    try {
      new URL(value);
    } catch {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        'Must be a valid URL'
      );
    }
  }
  
  static validateUUID(value, fieldName) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        'Must be a valid UUID'
      );
    }
  }
  
  static validateArray(value, fieldName, options = {}) {
    if (!Array.isArray(value)) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        'Must be an array'
      );
    }
    
    if (options.minLength && value.length < options.minLength) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        `Array must have at least ${options.minLength} items`
      );
    }
    
    if (options.maxLength && value.length > options.maxLength) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        `Array must have at most ${options.maxLength} items`
      );
    }
  }
  
  static validateObject(value, fieldName, requiredKeys = []) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw CartritaV2ErrorHandler.createValidationError(
        fieldName,
        'Must be an object'
      );
    }
    
    for (const key of requiredKeys) {
      if (!(key in value)) {
        throw CartritaV2ErrorHandler.createValidationError(
          fieldName,
          `Missing required property: ${key}`
        );
      }
    }
  }
}

export default CartritaV2ErrorHandler;