/**
 * Cartrita V2 - Not Found Handler Middleware
 * Handle 404 errors with appropriate responses
 */

import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res, next) {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `The requested resource ${req.method} ${req.url} was not found`,
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
}