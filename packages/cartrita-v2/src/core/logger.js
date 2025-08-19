/**
 * Cartrita V2 - Simplified Logger System
 * Using Pino for high-performance logging
 */

import pino from 'pino';

// Create pino logger instance
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

const logger = pino({
  name: 'cartrita-v2',
  level: logLevel,
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
      messageFormat: '{time} [V2-{name}] [{level}]: {msg}'
    }
  } : undefined,
  base: {
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    component: 'core'
  }
});

// Add convenience methods for different types of logs
logger.agent = (event, data, meta = {}) => {
  logger.info({ event, data, ...meta, category: 'agent' }, `🤖 Agent ${event}`);
};

logger.database = (operation, status, duration, meta = {}) => {
  logger.info({ operation, status, duration, ...meta, category: 'database' }, `💾 Database ${operation} ${status} (${duration}ms)`);
};

logger.performance = (metric, value, meta = {}) => {
  if (value > 1000) {
    logger.warn({ metric, value, ...meta, category: 'performance' }, `⚡ Performance ${metric}: ${value}ms`);
  } else {
    logger.info({ metric, value, ...meta, category: 'performance' }, `⚡ Performance ${metric}: ${value}ms`);
  }
};

logger.security = (event, level, meta = {}) => {
  const logMethod = level === 'critical' ? 'error' : level === 'warning' ? 'warn' : 'info';
  logger[logMethod]({ event, level, ...meta, category: 'security' }, `🛡️ Security ${event}`);
};

export { logger };
export default logger;