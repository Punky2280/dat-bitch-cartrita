/**
 * Cartrita V2 - Request Logger Middleware
 * Enhanced request logging with correlation IDs and performance metrics
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { trace } from '@opentelemetry/api';

export function requestLogger(req, res, next) {
  // Generate request ID
  req.id = uuidv4();
  
  // Add request ID to response headers
  res.set('X-Request-ID', req.id);
  
  const start = Date.now();
  
  // Log request start
  logger.info('Request started', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    userId: req.user?.id
  });

  // Add span attributes for tracing
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes({
      'http.request.id': req.id,
      'http.method': req.method,
      'http.url': req.url,
      'http.user_agent': req.get('User-Agent') || '',
      'http.client.ip': req.ip
    });
  }

  // Override res.end to log when response is complete
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // Log request completion
    logger.logRequest(req, res, duration);
    
    // Add performance attributes to span
    if (span) {
      span.setAttributes({
        'http.response.status_code': res.statusCode,
        'http.response.duration_ms': duration
      });
      
      if (res.statusCode >= 400) {
        span.setStatus({ code: 2, message: `HTTP ${res.statusCode}` });
      } else {
        span.setStatus({ code: 1 });
      }
    }
    
    // Call original end method
    originalEnd.apply(this, args);
  };
  
  next();
}