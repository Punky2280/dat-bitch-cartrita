/**
 * Cartrita V2 - Enhanced Logger
 * Structured logging with Winston and OpenTelemetry correlation
 */

import winston from 'winston';
import { trace } from '@opentelemetry/api';
import path from 'path';

const { combine, timestamp, printf, json, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const traceId = trace.getActiveSpan()?.spanContext()?.traceId;
  const spanId = trace.getActiveSpan()?.spanContext()?.spanId;
  
  let logMessage = `${timestamp} [${level}]: ${message}`;
  
  if (traceId && spanId) {
    logMessage += ` [trace: ${traceId.substring(0, 8)}, span: ${spanId.substring(0, 8)}]`;
  }
  
  if (Object.keys(meta).length > 0) {
    logMessage += ` ${JSON.stringify(meta)}`;
  }
  
  return logMessage;
});

// Custom format for file output
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
  winston.format((info) => {
    // Add OpenTelemetry correlation IDs
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      info.traceId = spanContext.traceId;
      info.spanId = spanContext.spanId;
    }
    return info;
  })()
);

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: {
    service: 'cartrita-backend-v2',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: combine(
          colorize(),
          timestamp({ format: 'HH:mm:ss' }),
          consoleFormat
        )
      })
    ] : []),
    
    // File transports for all environments
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    
    // Production console transport (structured JSON)
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.Console({
        format: combine(
          timestamp(),
          json()
        )
      })
    ] : [])
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ]
});

// Helper methods for common logging patterns
logger.logOperation = function(operation, data = {}) {
  this.info(`Operation: ${operation}`, { operation, ...data });
};

logger.logError = function(error, context = {}) {
  this.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    ...context
  });
};

logger.logRequest = function(req, res, duration) {
  this.info('HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  });
};

logger.logAgent = function(agentName, action, data = {}) {
  this.info(`Agent: ${agentName} - ${action}`, {
    agent: agentName,
    action,
    ...data
  });
};

logger.logDatabase = function(operation, table, data = {}) {
  this.debug(`Database: ${operation} on ${table}`, {
    database: { operation, table },
    ...data
  });
};

logger.logExternal = function(service, operation, data = {}) {
  this.info(`External: ${service} - ${operation}`, {
    external: { service, operation },
    ...data
  });
};

export { logger };