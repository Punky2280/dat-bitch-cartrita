/**
 * Cartrita V2 Multi-Agent OS - Simplified Backend Entry Point (For Testing)
 */

import 'dotenv/config';
import { createApp } from './app.simple.js';

const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    console.log('🚀 Starting Cartrita V2 Multi-Agent OS Backend (Simplified)');
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Port: ${PORT}`);
    
    // Create and configure Fastify app
    const fastify = await createApp();
    
    // Start Fastify server
    const address = await fastify.listen({ 
      port: PORT, 
      host: '0.0.0.0' 
    });
    
    console.log(`✅ Cartrita V2 Backend running at ${address}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API docs: http://localhost:${PORT}/api/docs`);
    console.log(`WebSocket ready: ws://localhost:${PORT}/ws`);

    // Simple graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await fastify.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await fastify.close();
      process.exit(0);
    });

    return fastify;
  } catch (error) {
    console.error('❌ Failed to start Cartrita V2 Backend:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});