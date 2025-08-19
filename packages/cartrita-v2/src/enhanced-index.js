/**
 * Cartrita V2 Enhanced - Main Application Entry Point  
 * The Ultimate AI Operating System with Sophisticated Multi-Agent Architecture
 */

import { logger } from './core/logger.js';
import { CartritaV2EnhancedServer } from './core/enhanced-server.js';
import { pool } from './database/connection.js';

// Environment validation with intelligent defaults
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error(`❌ Missing critical environment variables: ${missingVars.join(', ')}`);
  logger.error(`💡 Please set these variables in your .env file`);
  process.exit(1);
}

// Optional but recommended environment variables
const recommendedVars = [
  'OPENAI_API_KEY',
  'DEEPGRAM_API_KEY',
  'HUGGINGFACE_API_KEY'
];

const missingRecommended = recommendedVars.filter(varName => !process.env[varName]);
if (missingRecommended.length > 0) {
  logger.warn(`⚠️  Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  logger.warn(`💡 Some AI features may be limited without these keys`);
}

async function validateDatabase() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version() as db_version');
    client.release();
    
    logger.info('✅ Database connection established', {
      timestamp: result.rows[0].now,
      version: result.rows[0].db_version.split(' ')[0]
    });
    
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', {
      error: error.message,
      code: error.code,
      hint: 'Check your DATABASE_URL and ensure PostgreSQL is running'
    });
    return false;
  }
}

async function validateAIServices() {
  const services = [];
  
  if (process.env.OPENAI_API_KEY) {
    services.push('OpenAI GPT-4 & Vision');
  }
  if (process.env.DEEPGRAM_API_KEY) {
    services.push('Deepgram Speech-to-Text');
  }
  if (process.env.HUGGINGFACE_API_KEY) {
    services.push('HuggingFace Inference');
  }
  
  if (services.length > 0) {
    logger.info('🧠 AI Services Available:', { services });
  } else {
    logger.warn('⚠️  No AI API keys detected - running in limited mode');
  }
  
  return services;
}

async function startCartritaV2() {
  const startTime = Date.now();
  
  try {
    logger.info('🚀 Initializing Cartrita V2 Enhanced AI Operating System...');
    
    // Validate database connection
    const dbValid = await validateDatabase();
    if (!dbValid) {
      process.exit(1);
    }
    
    // Validate AI services
    const availableServices = await validateAIServices();
    
    // Create enhanced server instance
    const cartritaServer = new CartritaV2EnhancedServer();
    
    // Start server
    const port = process.env.PORT || 8000;
    const host = process.env.HOST || '0.0.0.0';
    
    await cartritaServer.start(port, host);
    
    const startupDuration = Date.now() - startTime;
    const memUsage = process.memoryUsage();
    
    logger.info('🎉 Cartrita V2 Enhanced fully operational!', {
      startupTime: `${startupDuration}ms`,
      memoryUsage: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      nodeVersion: process.version,
      platform: process.platform,
      aiServices: availableServices.length
    });
    
    // Set up graceful shutdown for the server instance
    const gracefulShutdown = async (signal) => {
      logger.info(`🛑 Received ${signal}, initiating graceful shutdown...`);
      
      try {
        await cartritaServer.stop();
        await pool.end();
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    return cartritaServer;
    
  } catch (error) {
    logger.error('💥 Failed to start Cartrita V2 Enhanced:', error);
    process.exit(1);
  }
}

// Global error handling with intelligent reporting
process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Promise Rejection:', {
    reason: reason.message || reason,
    promise: promise.constructor.name,
    stack: reason.stack
  });
  
  // Don't exit on unhandled rejections in production - log and continue
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception - System Unstable:', {
    error: error.message,
    stack: error.stack,
    action: 'Exiting process for safety'
  });
  
  // Always exit on uncaught exceptions
  process.exit(1);
});

// Memory monitoring for production
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    
    if (heapUsedMB > 1000) { // Alert if using more than 1GB
      logger.warn('🐘 High memory usage detected', {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`
      });
    }
  }, 60000); // Check every minute
}

// Start Cartrita V2 Enhanced
logger.info('🌟 Welcome to Cartrita V2 Enhanced - The Future of AI Assistance! 🌟');
startCartritaV2().catch((error) => {
  logger.error('💥 Critical startup failure:', error);
  process.exit(1);
});