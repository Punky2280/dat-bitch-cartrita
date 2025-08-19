/**
 * Cartrita V2 - Production-Ready Fastify Application
 * Enhanced architecture with security, observability, and AI capabilities
 */

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJWT from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './utils/logger.js';
import { getDatabase, healthCheck as dbHealthCheck } from './database/connection.js';
import { getRedis, healthCheck as redisHealthCheck } from './redis/connection.js';
import { trace } from '@opentelemetry/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info'
      // Disabled pino-pretty for now to avoid dependency issues
      // transport: process.env.NODE_ENV === 'development' ? {
      //   target: 'pino-pretty',
      //   options: {
      //     translateTime: 'HH:MM:ss Z',
      //     ignore: 'pid,hostname',
      //   }
      // } : undefined
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    trustProxy: process.env.NODE_ENV === 'production',
    bodyLimit: 10 * 1024 * 1024, // 10MB
    keepAliveTimeout: 30000,
    maxParamLength: 1000
  });

  // Security middleware
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
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  // CORS configuration
  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      const {hostname} = new URL(origin || 'http://localhost');
      
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        const allowedHosts = [
          'localhost',
          '127.0.0.1',
          ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
        ];
        
        callback(null, allowedHosts.includes(hostname));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
  });

  // Response compression
  await fastify.register(fastifyCompress, {
    global: true,
    encodings: ['gzip', 'deflate']
  });

  // Rate limiting
  await fastify.register(fastifyRateLimit, {
    max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 1000,
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    cache: 10000,
    allowList: ['127.0.0.1', 'localhost'],
    redis: getRedis(), // Use Redis for distributed rate limiting
    nameSpace: 'cartrita_rate_limit',
    continueExceeding: true,
    skipOnError: true,
    keyGenerator: (request) => {
      return request.user?.id || request.ip;
    }
  });

  // JWT authentication
  await fastify.register(fastifyJWT, {
    secret: process.env.JWT_SECRET || 'cartrita-v2-development-secret-key',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },
    verify: {
      maxAge: process.env.JWT_MAX_AGE || '24h'
    }
  });

  // Multipart form support
  await fastify.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1000000, // 1MB
      fields: 10,
      fileSize: 10000000, // 10MB
      files: 5,
      headerPairs: 2000
    }
  });

  // WebSocket support
  await fastify.register(fastifyWebSocket, {
    options: {
      maxPayload: 1048576, // 1MB
      verifyClient: (info, callback) => {
        // Basic WebSocket connection validation
        callback(true);
      }
    }
  });

  // Static file serving
  await fastify.register(fastifyStatic, {
    root: join(__dirname, '../public'),
    prefix: '/public/',
    decorateReply: false
  });

  // Request logging and tracing
  fastify.addHook('onRequest', async (request, reply) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan(`HTTP ${request.method} ${request.url}`);
    
    span.setAttributes({
      'http.method': request.method,
      'http.url': request.url,
      'http.user_agent': request.headers['user-agent'] || '',
      'http.remote_addr': request.ip
    });

    request.span = span;
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.startTime;
    
    if (request.span) {
      request.span.setAttributes({
        'http.status_code': reply.statusCode,
        'http.response_time': duration
      });
      
      if (reply.statusCode >= 400) {
        request.span.setStatus({ 
          code: 2, // ERROR
          message: `HTTP ${reply.statusCode}` 
        });
      } else {
        request.span.setStatus({ code: 1 }); // OK
      }
      
      request.span.end();
    }

    // Log requests (excluding health checks in production)
    if (process.env.NODE_ENV !== 'production' || !request.url.includes('/health')) {
      logger.info('HTTP Request', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
        ip: request.ip,
        userAgent: request.headers['user-agent']?.substring(0, 100),
        userId: request.user?.id
      });
    }
  });

  // Authentication decorator
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ 
        success: false, 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }
  });

  // Health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            uptime: { type: 'number' },
            checks: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const checks = {
      database: await dbHealthCheck(),
      redis: await redisHealthCheck()
    };

    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');

    reply.status(allHealthy ? 200 : 503).send({
      success: allHealthy,
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      uptime: process.uptime(),
      checks
    });
  });

  // Metrics endpoint for monitoring
  fastify.get('/metrics', async (request, reply) => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      eventLoop: {
        delay: 0 // Would need to implement event loop lag measurement
      }
    };

    reply.send(metrics);
  });

  // API routes
  await fastify.register(async function(fastify) {
    const { apiV2Router } = await import('./routes/api/index.js');
    await fastify.register(apiV2Router);
  }, { prefix: '/api' });

  // Error handling
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      statusCode,
      method: request.method,
      url: request.url,
      ip: request.ip
    });

    reply.status(statusCode).send({
      success: false,
      error: statusCode === 500 ? 'Internal server error' : error.message,
      code: error.code || 'UNKNOWN_ERROR',
      requestId: request.id
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: 'Route not found',
      code: 'NOT_FOUND',
      path: request.url
    });
  });

  logger.info('✅ Fastify application configured', {
    plugins: [
      'helmet', 'cors', 'compress', 'rate-limit', 
      'jwt', 'multipart', 'websocket', 'static'
    ],
    features: [
      'security-headers', 'rate-limiting', 'compression',
      'authentication', 'file-upload', 'websockets',
      'request-logging', 'error-handling', 'health-checks'
    ]
  });

  return fastify;
}