/**
 * Cartrita V2 - Error Handler Middleware
 * Comprehensive error handling with logging and user-friendly responses
 */

import { logger } from '../utils/logger.js';
import { trace } from '@opentelemetry/api';

export function errorHandler(error, req, res, next) {
  const span = trace.getActiveSpan();
  
  // Log the error
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  });

  // Record error in tracing
  if (span) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
  }

  // Handle different error types
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = error.details || error.message;
  } else if (error.name === 'UnauthorizedError' || error.message === 'Unauthorized') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError' || error.message === 'Forbidden') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError' || error.message === 'Not Found') {
    statusCode = 404;
    message = 'Not Found';
  } else if (error.name === 'ConflictError' || error.message === 'Conflict') {
    statusCode = 409;
    message = 'Conflict';
  } else if (error.name === 'TooManyRequestsError' || error.status === 429) {
    statusCode = 429;
    message = 'Too Many Requests';
  } else if (error.status && error.status >= 400 && error.status < 500) {
    statusCode = error.status;
    message = error.message || 'Client Error';
  }

  // Don't leak error details in production
  const response = {
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { 
      details: details || error.message,
      stack: error.stack 
    })
  };

  // Add request ID for debugging
  if (req.id) {
    response.requestId = req.id;
  }

  res.status(statusCode).json(response);
}