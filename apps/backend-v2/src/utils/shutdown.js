/**
 * Cartrita V2 - Graceful Shutdown Handler
 * Ensures clean shutdown of all resources and connections
 */

import { logger } from './logger.js';
import { closeDatabase } from '../database/connection.js';
import { closeRedis } from '../redis/connection.js';

let isShuttingDown = false;
const shutdownHandlers = [];

export function gracefulShutdown(server) {
  // Register cleanup handlers
  addShutdownHandler('HTTP Server', async () => {
    return new Promise((resolve) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err.message });
        } else {
          logger.info('✅ HTTP server closed');
        }
        resolve();
      });
    });
  });

  addShutdownHandler('Database', async () => {
    try {
      await closeDatabase();
    } catch (error) {
      logger.error('Error closing database', { error: error.message });
    }
  });

  addShutdownHandler('Redis', async () => {
    try {
      await closeRedis();
    } catch (error) {
      logger.error('Error closing Redis', { error: error.message });
    }
  });

  // Setup signal handlers
  const signalHandler = (signal) => {
    if (isShuttingDown) {
      logger.warn(`Received ${signal} during shutdown, forcing exit...`);
      process.exit(1);
    }
    
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    performShutdown(signal);
  };

  process.on('SIGTERM', () => signalHandler('SIGTERM'));
  process.on('SIGINT', () => signalHandler('SIGINT'));
  process.on('SIGUSR2', () => signalHandler('SIGUSR2')); // nodemon restart

  // Handle process warnings
  process.on('warning', (warning) => {
    logger.warn('Process warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });

  logger.info('✅ Graceful shutdown handlers registered');
}

export function gracefulShutdownFastify(fastify) {
  // Register cleanup handlers for Fastify
  addShutdownHandler('Fastify Server', async () => {
    try {
      await fastify.close();
      logger.info('✅ Fastify server closed');
    } catch (error) {
      logger.error('Error closing Fastify server', { error: error.message });
      throw error;
    }
  });

  addShutdownHandler('Database', async () => {
    try {
      await closeDatabase();
    } catch (error) {
      logger.error('Error closing database', { error: error.message });
    }
  });

  addShutdownHandler('Redis', async () => {
    try {
      await closeRedis();
    } catch (error) {
      logger.error('Error closing Redis', { error: error.message });
    }
  });

  // Setup signal handlers
  const signalHandler = (signal) => {
    if (isShuttingDown) {
      logger.warn(`Received ${signal} during shutdown, forcing exit...`);
      process.exit(1);
    }
    
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    performShutdown(signal);
  };

  process.on('SIGTERM', () => signalHandler('SIGTERM'));
  process.on('SIGINT', () => signalHandler('SIGINT'));
  process.on('SIGUSR2', () => signalHandler('SIGUSR2')); // nodemon restart

  // Handle process warnings
  process.on('warning', (warning) => {
    logger.warn('Process warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });

  logger.info('✅ Fastify graceful shutdown handlers registered');
}

export function addShutdownHandler(name, handler) {
  shutdownHandlers.push({ name, handler });
}

async function performShutdown(signal) {
  isShuttingDown = true;
  const shutdownStart = Date.now();
  
  logger.info(`Starting graceful shutdown due to ${signal}`, {
    handlersCount: shutdownHandlers.length
  });

  // Execute all shutdown handlers in parallel with timeout
  const shutdownPromises = shutdownHandlers.map(async ({ name, handler }) => {
    try {
      logger.info(`Shutting down ${name}...`);
      const start = Date.now();
      
      // Add timeout to each handler
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Shutdown timeout for ${name}`)), 10000);
      });
      
      await Promise.race([handler(), timeoutPromise]);
      
      const duration = Date.now() - start;
      logger.info(`✅ ${name} shutdown complete`, { duration });
    } catch (error) {
      logger.error(`❌ Failed to shutdown ${name}`, {
        error: error.message
      });
    }
  });

  try {
    // Wait for all handlers with a global timeout
    const globalTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Global shutdown timeout')), 30000);
    });

    await Promise.race([
      Promise.allSettled(shutdownPromises),
      globalTimeout
    ]);

    const shutdownDuration = Date.now() - shutdownStart;
    logger.info('✅ Graceful shutdown completed', {
      duration: shutdownDuration,
      signal
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Shutdown timeout reached, forcing exit', {
      error: error.message
    });
    process.exit(1);
  }
}