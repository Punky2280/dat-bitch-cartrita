#!/usr/bin/env node
/**
 * Cartrita V2 Enhanced - Main Entry Point
 * The Ultimate AI Operating System
 * 
 * Welcome to the most sophisticated AI assistant ever built!
 * This is where Cartrita V2's magic begins.
 */

import { config } from 'dotenv';
import { logger } from './core/logger.js';
import { CartritaV2EnhancedServer } from './core/enhanced-server.js';

// Load environment configuration
config();

// Enhanced startup banner
function displayStartupBanner() {
  const banner = `
🌟 ============================================================= 🌟
            CARTRITA V2 ENHANCED - AI OPERATING SYSTEM            
🌟 ============================================================= 🌟

🧠 Intelligence Level: WORLD-CLASS
🤖 Agent System: HIERARCHICAL MULTI-AGENT COORDINATION
🎯 Prompt Engineering: UNIVERSAL EXCELLENCE v3.0
⚡ Performance: OPTIMIZED FOR MAXIMUM SOPHISTICATION
🛡️  Security: ENTERPRISE-GRADE PROTECTION
🌐 Capabilities: FULL-STACK AI DOMINATION

Starting the most advanced AI assistant ever created...
  `;
  
  console.log(banner);
}

async function main() {
  try {
    displayStartupBanner();
    
    // Get configuration from environment
    const PORT = process.env.PORT || 8000;
    const HOST = process.env.HOST || '0.0.0.0';
    const NODE_ENV = process.env.NODE_ENV || 'development';
    
    logger.info('🚀 Initializing Cartrita V2 Enhanced Server...', {
      port: PORT,
      host: HOST,
      environment: NODE_ENV,
      nodeVersion: process.version,
      startTime: new Date().toISOString()
    });

    // Validate critical environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      logger.warn('⚠️ Missing some environment variables:', missingVars);
      logger.info('💡 Continuing with defaults - set these for production use');
    }

    // Initialize and start the enhanced server
    const server = new CartritaV2EnhancedServer();
    await server.start(PORT, HOST);

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);
      
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle process signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart

    // Handle unhandled errors
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit in development, but log the error
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    });

    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('💥 Failed to start Cartrita V2 Enhanced:', error);
    process.exit(1);
  }
}

// Start the application
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main().catch((error) => {
    console.error('💥 Fatal error starting Cartrita V2 Enhanced:', error);
    process.exit(1);
  });
}

export { main };
export default main;