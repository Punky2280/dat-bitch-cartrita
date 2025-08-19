/**
 * Cartrita V2 Multi-Agent OS - Main Backend Entry Point
 * Enhanced architecture with improved observability and microservice support
 */

import 'dotenv/config';
import { setupTelemetry } from './telemetry/setup.js';
import { createApp } from './app.js';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setupWebSocket } from './websocket/handler.js';
import { connectDatabase } from './database/connection.js';
import { connectRedis } from './redis/connection.js';
import { logger } from './utils/logger.js';
import { gracefulShutdown, gracefulShutdownFastify } from './utils/shutdown.js';

const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Initialize OpenTelemetry first
    setupTelemetry();
    
    logger.info('🚀 Starting Cartrita V2 Multi-Agent OS Backend', {
      port: PORT,
      environment: NODE_ENV,
      version: '2.0.0'
    });

    // Connect to databases
    await connectDatabase();
    await connectRedis();
    
    // Create and configure Fastify app
    const fastify = await createApp();
    // Create Node HTTP server and attach Fastify handler
    const server = http.createServer((req, res) => {
      fastify.server.emit('request', req, res);
    });

    // Attach Socket.IO
    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
      }
    });
    global.socketIO = io;
    setupWebSocket(io);

    // Start HTTP + WS server
    await new Promise((resolve) => server.listen(PORT, '0.0.0.0', resolve));
    const address = `http://localhost:${PORT}`;
    
    logger.info(`✅ Cartrita V2 Backend running with Fastify`, {
      address,
      port: PORT,
      environment: NODE_ENV,
      server: 'Fastify v4',
      healthEndpoint: `http://localhost:${PORT}/health`,
      metricsEndpoint: `http://localhost:${PORT}/metrics`,
      docsEndpoint: `http://localhost:${PORT}/api/docs`,
      performance: 'optimized'
    });

    // Setup graceful shutdown
    gracefulShutdownFastify(fastify);
    process.on('SIGINT', async () => {
      await fastify.close();
      io.close();
      server.close(() => process.exit(0));
    });

    return fastify;
  } catch (error) {
    logger.error('❌ Failed to start Cartrita V2 Backend', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});