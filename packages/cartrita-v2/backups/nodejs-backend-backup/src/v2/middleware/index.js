/*
 * Cartrita V2 Middleware Suite
 * Comprehensive middleware system for V2 API architecture
 */

import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import { traceOperation } from '../../system/OpenTelemetryTracing.js';
import { CartritaV2ResponseFormatter } from '../utils/ResponseFormatter.js';

export class CartritaV2Middleware {
  
  // V2 Authentication Middleware
  static authenticateV2Token() {
    return (req, res, next) => {
      const span = traceOperation('v2.middleware.auth');
      
      try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
          return res.status(401).json(CartritaV2ResponseFormatter.error(
            'Access token required',
            401,
            {
              auth_required: true,
              api_version: 'v2',
              request_id: req.requestId
            }
          ));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.v2_context = {
          authenticated: true,
          user_id: decoded.id,
          auth_time: new Date().toISOString(),
          token_type: 'bearer'
        };
        
        span?.setAttributes({
          'auth.user_id': decoded.id,
          'auth.success': true
        });
        
        next();
      } catch (error) {
        span?.setAttributes({
          'auth.success': false,
          'auth.error': error.message
        });
        
        res.status(403).json(CartritaV2ResponseFormatter.error(
          'Invalid or expired token',
          403,
          {
            auth_error: error.message,
            api_version: 'v2',
            request_id: req.requestId
          }
        ));
      } finally {
        span?.end();
      }
    };
  }
  
  // V2 Request Tracing Middleware
  static traceV2Request(domain) {
    return (req, res, next) => {
      const span = traceOperation(`v2.${domain}.${req.method.toLowerCase()}`, {
        'http.method': req.method,
        'http.url': req.url,
        'http.route': req.route?.path,
        'cartrita.api_version': 'v2',
        'cartrita.domain': domain,
        'cartrita.request_id': req.requestId
      });
      
      req.trace_span = span;
      
      // Wrap res.json to capture response metrics
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        span?.setAttributes({
          'http.status_code': res.statusCode,
          'cartrita.success': data.success !== false,
          'cartrita.response_size': JSON.stringify(data).length
        });
        span?.end();
        return originalJson(data);
      };
      
      next();
    };
  }
  
  // V2 Request Validation Middleware
  static validateV2Request(schema) {
    return [
      // Apply validation rules
      ...(schema.body ? Object.keys(schema.body).map(field => 
        body(field).custom(value => {
          const rule = schema.body[field];
          if (rule.required && (value === undefined || value === null || value === '')) {
            throw new Error(`${field} is required`);
          }
          if (rule.type && typeof value !== rule.type) {
            throw new Error(`${field} must be of type ${rule.type}`);
          }
          if (rule.enum && !rule.enum.includes(value)) {
            throw new Error(`${field} must be one of: ${rule.enum.join(', ')}`);
          }
          return true;
        })
      ) : []),
      
      ...(schema.params ? Object.keys(schema.params).map(field =>
        param(field).custom(value => {
          const rule = schema.params[field];
          if (rule.required && !value) {
            throw new Error(`Parameter ${field} is required`);
          }
          if (rule.type && typeof value !== rule.type) {
            throw new Error(`Parameter ${field} must be of type ${rule.type}`);
          }
          return true;
        })
      ) : []),
      
      // Handle validation results
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json(CartritaV2ResponseFormatter.error(
            'Validation failed',
            400,
            {
              validation_errors: errors.array(),
              api_version: 'v2',
              request_id: req.requestId
            }
          ));
        }
        next();
      }
    ];
  }
  
  // V2 Rate Limiting Middleware
  static rateLimitV2(options = {}) {
    const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    const max = options.max || 100; // requests per window
    const domain = options.domain || 'general';
    
    return rateLimit({
      windowMs,
      max,
      keyGenerator: (req) => `${req.ip}_${domain}_${req.user?.id || 'anonymous'}`,
      message: CartritaV2ResponseFormatter.error(
        'Rate limit exceeded',
        429,
        {
          retry_after: Math.ceil(windowMs / 1000),
          rate_limit: {
            window_ms: windowMs,
            max_requests: max,
            domain
          },
          api_version: 'v2'
        }
      ),
      standardHeaders: true,
      legacyHeaders: false,
      onLimitReached: (req, res, options) => {
        console.warn(`[V2 Rate Limit] Limit reached for ${req.ip} on ${domain} domain`);
      }
    });
  }
  
  // V2 Request Context Enhancement Middleware
  static enhanceV2Context() {
    return (req, res, next) => {
      // Add V2 context information
      req.v2 = {
        request_id: req.requestId,
        timestamp: new Date().toISOString(),
        api_version: 'v2',
        user_context: {
          authenticated: !!req.user,
          user_id: req.user?.id,
          permissions: req.user?.permissions || []
        },
        request_context: {
          method: req.method,
          path: req.path,
          query: req.query,
          ip: req.ip,
          user_agent: req.get('User-Agent')
        }
      };
      
      next();
    };
  }
  
  // V2 Response Headers Middleware
  static addV2Headers() {
    return (req, res, next) => {
      res.setHeader('X-API-Version', 'v2');
      res.setHeader('X-Request-ID', req.requestId);
      res.setHeader('X-Powered-By', 'Cartrita-V2');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      next();
    };
  }
  
  // V2 CORS Middleware (Enhanced)
  static corsV2(allowedOrigins) {
    return (req, res, next) => {
      const origin = req.headers.origin;
      
      if (!origin || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 
          'Content-Type, Authorization, Accept, X-Requested-With, X-API-Version, X-Request-ID');
        res.setHeader('Access-Control-Max-Age', '86400');
        
        if (req.method === 'OPTIONS') {
          return res.status(204).end();
        }
      }
      
      next();
    };
  }
  
  // V2 Error Boundary Middleware
  static errorBoundary() {
    return (error, req, res, next) => {
      const span = traceOperation('v2.middleware.error_boundary');
      
      try {
        console.error('[V2 Error Boundary]', {
          error: error.message,
          stack: error.stack,
          request_id: req.requestId,
          path: req.path,
          method: req.method,
          user: req.user?.id
        });
        
        // Determine error type and response
        let statusCode = 500;
        let errorType = 'INTERNAL_ERROR';
        
        if (error.name === 'ValidationError') {
          statusCode = 400;
          errorType = 'VALIDATION_ERROR';
        } else if (error.name === 'UnauthorizedError') {
          statusCode = 401;
          errorType = 'UNAUTHORIZED';
        } else if (error.name === 'ForbiddenError') {
          statusCode = 403;
          errorType = 'FORBIDDEN';
        } else if (error.name === 'NotFoundError') {
          statusCode = 404;
          errorType = 'NOT_FOUND';
        }
        
        res.status(statusCode).json(CartritaV2ResponseFormatter.error(
          error.message,
          statusCode,
          {
            error_type: errorType,
            error_id: `v2_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            request_id: req.requestId,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
          }
        ));
        
        span?.setAttributes({
          'error.type': errorType,
          'error.status_code': statusCode,
          'error.handled': true
        });
        
      } catch (handlerError) {
        console.error('[V2 Error Boundary] Handler error:', handlerError);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          api_version: 'v2'
        });
      } finally {
        span?.end();
      }
    };
  }
}

export default CartritaV2Middleware;