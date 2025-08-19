/**
 * Simplified Fastify App for WebSocket Testing
 */

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createApp() {
  const fastify = Fastify({
    logger: true  // Use simple console logging instead of pino-pretty
  });

  // Register middleware
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false
  });

  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true
  });

  await fastify.register(fastifyCompress, {
    global: true
  });

  // Register WebSocket support
  await fastify.register(fastifyWebSocket);

  // Register static file serving (commented out since public dir doesn't exist)
  // await fastify.register(fastifyStatic, {
  //   root: join(__dirname, '../../public'),
  //   prefix: '/public/',
  // });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { 
      success: true, 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'cartrita-v2-backend',
      version: '2.0.0'
    };
  });

  // API Documentation
  fastify.get('/api/docs', async () => {
    return {
      service: 'Cartrita V2 Multi-Agent OS Backend',
      version: '2.0.0',
      endpoints: {
        health: 'GET /health',
        websocket: 'ws://localhost:8000/ws',
        realtime: {
          systemStats: 'GET /api/v2/realtime/system/stats',
          agentStatus: 'GET /api/v2/realtime/agent/status',
          activityFeed: 'GET /api/v2/realtime/activity/feed',
          analytics: 'GET /api/v2/realtime/analytics/metrics'
        }
      },
      websocketEvents: {
        connection: 'Establish WebSocket connection',
        'stream:start': 'Start real-time data streaming',
        'stream:stop': 'Stop specific stream',
        'stream:stop:all': 'Stop all streams'
      }
    };
  });

  // Simplified real-time API endpoints
  fastify.get('/api/v2/realtime/system/stats', async () => {
    const memUsage = process.memoryUsage();
    return {
      success: true,
      data: {
        cpu: Math.random() * 100,
        memory: (memUsage.heapUsed / memUsage.heapTotal * 100),
        aiLoad: Math.random() * 80,
        powerEfficiency: 85 + Math.random() * 10,
        timestamp: new Date().toISOString()
      }
    };
  });

  fastify.get('/api/v2/realtime/agent/status', async () => {
    const agentIds = [
      'cartrita_core', 'code_maestro', 'data_science_wizard', 'creative_director',
      'productivity_master', 'security_guardian', 'business_strategy'
    ];

    const agents = agentIds.map(id => ({
      agentId: id,
      status: ['active', 'inactive', 'busy'][Math.floor(Math.random() * 3)],
      tasksInProgress: Math.floor(Math.random() * 3),
      lastActivity: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      performance: {
        successRate: 90 + Math.random() * 10,
        averageResponseTime: 1 + Math.random() * 3,
        tasksCompleted: Math.floor(Math.random() * 100)
      }
    }));

    return {
      success: true,
      data: agents
    };
  });

  fastify.get('/api/v2/realtime/activity/feed', async () => {
    const activities = [];
    
    // Generate 0-3 random activities
    const activityCount = Math.floor(Math.random() * 4);
    for (let i = 0; i < activityCount; i++) {
      activities.push({
        id: `activity_${Date.now()}_${i}`,
        type: ['chat', 'agent', 'system'][Math.floor(Math.random() * 3)],
        message: 'Activity completed successfully',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'cartrita-v2',
          priority: Math.random() > 0.8 ? 'high' : 'normal'
        }
      });
    }

    return {
      success: true,
      data: activities
    };
  });

  fastify.get('/api/v2/realtime/analytics/metrics', async (request) => {
    const { timeRange = 'day' } = request.query;
    
    return {
      success: true,
      data: {
        timeRange,
        interactions: [
          { name: '2024-01-01', value: 150, change: '+12%' },
          { name: '2024-01-02', value: 180, change: '+20%' }
        ],
        users: [
          { name: '2024-01-01', value: 45, change: '+5%' },
          { name: '2024-01-02', value: 52, change: '+15%' }
        ],
        responseTime: [
          { name: '2024-01-01', value: 1.2, change: '-5%' },
          { name: '2024-01-02', value: 1.1, change: '-8%' }
        ],
        successRate: [
          { name: '2024-01-01', value: 98.5, change: '+1%' },
          { name: '2024-01-02', value: 99.2, change: '+0.7%' }
        ],
        lastUpdated: new Date().toISOString()
      }
    };
  });

  // Simple WebSocket endpoint
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      console.log('New WebSocket connection established');
      
      connection.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('WebSocket message received:', data);

          // Echo the message back
          connection.send(JSON.stringify({
            type: 'echo',
            data: data,
            timestamp: new Date().toISOString()
          }));

          // Handle streaming requests
          if (data.type === 'stream:start') {
            console.log('Starting stream:', data.streamType);
            connection.send(JSON.stringify({
              type: 'stream:started',
              streamType: data.streamType,
              message: `Started streaming ${data.streamType}`,
              timestamp: new Date().toISOString()
            }));
          }

        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          connection.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: new Date().toISOString()
          }));
        }
      });

      connection.on('close', () => {
        console.log('WebSocket connection closed');
      });

      connection.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      connection.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Cartrita V2 WebSocket',
        timestamp: new Date().toISOString()
      }));
    });
  });

  return fastify;
}