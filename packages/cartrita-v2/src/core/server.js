/**
 * Cartrita V2 - Enhanced Fastify Server
 * Built from V1 Express server with Fastify performance improvements
 */

import Fastify from 'fastify';
import { logger } from './logger.js';

// Fastify plugins
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJWT from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// Core V2 routes
import { healthRoutes } from '../routes/health.js';
import { authRoutes } from '../routes/auth.js';
import { agentRoutes } from '../routes/agents.js';
import { chatRoutes } from '../routes/chat.js';
import { aiRoutes } from '../routes/ai.js';
import { embeddingsRoutes } from '../routes/embeddings.js';
import { websocketRoutes } from '../routes/websocket.js';

export async function createServer() {
  // Enhanced Fastify instance with V2 configuration
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname'
        }
      } : undefined
    },
    trustProxy: true,
    keepAliveTimeout: 30000,
    requestTimeout: 60000,
    bodyLimit: 50 * 1024 * 1024, // 50MB
    disableRequestLogging: process.env.NODE_ENV === 'production'
  });
  
  // Enhanced security middleware
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"]
      }
    },
    crossOriginEmbedderPolicy: false
  });
  
  // Enhanced CORS configuration
  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      const hostname = new URL(origin || 'http://localhost').hostname;
      
      // Allow development origins
      if (process.env.NODE_ENV === 'development') {
        return cb(null, true);
      }
      
      // Production origin whitelist
      const allowedOrigins = [
        'localhost',
        'cartrita.com',
        'app.cartrita.com',
        '127.0.0.1'
      ];
      
      const isAllowed = allowedOrigins.some(allowed => hostname.includes(allowed));
      cb(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });
  
  // Compression middleware
  await fastify.register(fastifyCompress, {
    global: true,
    encodings: ['gzip', 'deflate']
  });
  
  // Enhanced rate limiting
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    skipOnError: true,
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for'] || request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(context.ttl / 1000)
      };
    }
  });
  
  // JWT authentication
  await fastify.register(fastifyJWT, {
    secret: process.env.JWT_SECRET || 'cartrita-v2-development-secret',
    sign: {
      issuer: 'cartrita-v2',
      expiresIn: '24h'
    },
    verify: {
      issuer: 'cartrita-v2'
    }
  });
  
  // File upload support
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
      files: 10
    },
    attachFieldsToBody: true
  });
  
  // WebSocket support
  await fastify.register(fastifyWebSocket);
  
  // API Documentation
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Cartrita V2 API',
        description: 'Multi-Agent AI Operating System API',
        version: '2.0.0',
        contact: {
          name: 'Cartrita Team',
          email: 'api@cartrita.com'
        }
      },
      servers: [
        {
          url: 'http://localhost:8000',
          description: 'Development server'
        },
        {
          url: 'https://api.cartrita.com',
          description: 'Production server'
        }
      ],
      components: {
        securitySchemes: {
          Bearer: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'agents', description: 'AI Agent management' },
        { name: 'chat', description: 'Chat and conversations' },
        { name: 'ai', description: 'AI provider integrations' },
        { name: 'embeddings', description: 'Text embeddings and similarity search' },
        { name: 'health', description: 'System health monitoring' }
      ]
    }
  });
  
  // Swagger UI
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => {
      return swaggerObject;
    }
  });
  
  // Request logging hook
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
    
    logger.request(
      request.method, 
      request.url,
      0,
      0,
      {
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        id: request.id
      }
    );
  });
  
  // Response logging hook
  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.startTime;
    
    logger.request(
      request.method,
      request.url,
      reply.statusCode,
      duration,
      {
        responseTime: duration,
        contentLength: reply.getHeader('content-length'),
        id: request.id
      }
    );
  });
  
  // Error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.error('🚨 Request error', {
      errorId,
      method: request.method,
      url: request.url,
      statusCode,
      error: error.message,
      stack: error.stack
    });
    
    return reply.status(statusCode).send({
      success: false,
      error: statusCode >= 500 ? 'Internal server error' : error.message,
      code: error.code || 'UNKNOWN_ERROR',
      errorId,
      timestamp: new Date().toISOString()
    });
  });
  
  // 404 handler
  fastify.setNotFoundHandler(async (request, reply) => {
    logger.warn('🔍 Route not found', {
      method: request.method,
      url: request.url,
      ip: request.ip
    });
    
    return reply.status(404).send({
      success: false,
      error: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    });
  });
  
  // Register routes
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(authRoutes, { prefix: '/api/v2/auth' });
  await fastify.register(agentRoutes, { prefix: '/api/v2/agents' });
  await fastify.register(chatRoutes, { prefix: '/api/v2/chat' });
  await fastify.register(aiRoutes, { prefix: '/api/v2/ai' });
  await fastify.register(embeddingsRoutes, { prefix: '/api/v2/embeddings' });
  
  // Register Computer Use Agent routes
  const { default: computerUseRoutes } = await import('../routes/computerUse.js');
  await fastify.register(computerUseRoutes, { prefix: '/api/v2/computer-use' });
  
  // Register WebSocket handler
  await fastify.register(websocketRoutes, { prefix: '/ws' });
  
  // Root API information
  fastify.get('/api/v2', async () => {
    return {
      success: true,
      data: {
        name: 'Cartrita V2 Multi-Agent OS',
        version: '2.0.0',
        description: 'Next-generation AI operating system with multi-agent capabilities',
        documentation: '/docs',
        features: [
          'Multi-Agent Architecture',
          'Real-time WebSocket Communication',
          'Advanced OpenTelemetry Tracing',
          'GPT-4 Integration',
          'Production-Ready Security',
          'Comprehensive API Documentation',
          'Database Connection Pooling',
          'Rate Limiting & Authentication'
        ],
        endpoints: {
          health: '/health',
          documentation: '/docs',
          authentication: '/api/v2/auth',
          agents: '/api/v2/agents',
          chat: '/api/v2/chat',
          ai: '/api/v2/ai',
          embeddings: '/api/v2/embeddings',
          computerUse: '/api/v2/computer-use',
          websocket: '/ws'
        },
          authentication: '/api/v2/auth',
          agents: '/api/v2/agents',
          chat: '/api/v2/chat',
          ai: '/api/v2/ai',
          websocket: '/ws'
        }
      }
    };
  });
  
  logger.info('✅ Fastify server configured with V2 enhancements', {
    plugins: [
      'helmet',
      'cors',
      'compress',
      'rate-limit',
      'jwt',
      'multipart',
      'websocket',
      'swagger',
      'swagger-ui'
    ],
    routes: [
      'health',
      'auth',
      'agents',
      'chat',
      'ai',
      'embeddings',
      'websocket'
    ]
  });
  
  return fastify;
}

export default createServer;