/**
 * @fileoverview MCP Tier-0 Orchestrator
 * Gateway and routing service for the Cartrita hierarchical agent system
 * Integrates with existing Cartrita infrastructure (PostgreSQL, Redis, OpenTelemetry)
 */
import fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';
import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { trace, SpanKind } from '@opentelemetry/api';
import { MCPInProcessTransport, Logger, MCPValidator } from '../core/index.js';
import { MCPRouter } from './routing/router.js';
import { MCPSecurityManager } from './security/security-manager.js';
import { MCPHealthManager } from './health/health-manager.js';
import { MCPBridge } from './bridge/mcp-bridge.js';
import { connectToDatabase } from './database/connection.js';
/**
 * MCP Orchestrator - Tier 0 gateway service
 * Provides HTTP/WebSocket API, routing, authentication, and backwards compatibility
 */
export class MCPOrchestrator {
  logger;
  config;
  transport;
  router;
  security;
  health;
  bridge;
  tracer = trace.getTracer('mcp-orchestrator');
  app;
  httpServer;
  io;
  isInitialized = false;
  isShuttingDown = false;
  constructor(config = {}) {
    this.logger = Logger.create('MCPOrchestrator');
    this.config = {
      port: config.port ?? parseInt(process.env.MCP_PORT || '8002'),
      host: config.host ?? process.env.MCP_HOST ?? '0.0.0.0',
      cors: {
        origin: config.cors?.origin ?? process.env.CORS_ORIGIN ?? true,
        credentials: config.cors?.credentials ?? true,
      },
      rateLimit: {
        max: config.rateLimit?.max ?? 100,
        timeWindow: config.rateLimit?.timeWindow ?? 60000, // 1 minute
      },
      jwt: {
        secret:
          config.jwt?.secret ??
          process.env.JWT_SECRET ??
          'cartrita-mcp-secret-2025',
        expiry: config.jwt?.expiry ?? '24h',
      },
      redis: {
        host: config.redis?.host ?? process.env.REDIS_HOST ?? 'redis',
        port: config.redis?.port ?? parseInt(process.env.REDIS_PORT || '6379'),
        password: config.redis?.password ?? process.env.REDIS_PASSWORD,
      },
      postgres: {
        host: config.postgres?.host ?? process.env.POSTGRES_HOST ?? 'postgres',
        port:
          config.postgres?.port ??
          parseInt(process.env.POSTGRES_PORT || '5432'),
        database:
          config.postgres?.database ??
          process.env.POSTGRES_DB ??
          'dat-bitch-cartrita',
        username:
          config.postgres?.username ?? process.env.POSTGRES_USER ?? 'robert',
        password:
          config.postgres?.password ??
          process.env.POSTGRES_PASSWORD ??
          'punky1',
      },
      enableMetrics: config.enableMetrics ?? true,
      enableTracing: config.enableTracing ?? true,
      logLevel: config.logLevel ?? process.env.LOG_LEVEL ?? 'info',
    };
    // Initialize components
    this.transport = MCPInProcessTransport.getInstance();
    this.router = new MCPRouter(this.transport);
    this.security = new MCPSecurityManager(this.config.jwt);
    this.health = new MCPHealthManager();
    this.bridge = new MCPBridge(this.transport);
    this.logger.info('MCP Orchestrator created', {
      config: {
        ...this.config,
        jwt: { ...this.config.jwt, secret: '[REDACTED]' },
        postgres: { ...this.config.postgres, password: '[REDACTED]' },
      },
    });
  }
  /**
   * Initialize the orchestrator
   */
  async initialize() {
    if (this.isInitialized) {
      throw new Error('Orchestrator already initialized');
    }
    const span = this.tracer.startSpan('mcp.orchestrator.initialize');
    try {
      this.logger.info('Initializing MCP Orchestrator...');
      // Initialize database connection
      await this.initializeDatabase();
      // Create Fastify app
      await this.createApp();
      // Initialize Socket.IO
      await this.initializeSocketIO();
      // Set up routing and middleware
      await this.setupRoutes();
      // Register signal handlers
      this.setupSignalHandlers();
      this.isInitialized = true;
      span.setAttributes({ 'mcp.orchestrator.initialized': true });
      this.logger.info('MCP Orchestrator initialized successfully');
    } catch (error) {
      span.recordException(error);
      this.logger.error('Failed to initialize orchestrator', error);
      throw error;
    } finally {
      span.end();
    }
  }
  /**
   * Start the orchestrator server
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    const span = this.tracer.startSpan('mcp.orchestrator.start');
    try {
      await this.app.listen({
        port: this.config.port,
        host: this.config.host,
      });
      this.logger.info('MCP Orchestrator started', {
        port: this.config.port,
        host: this.config.host,
        swagger: `http://${this.config.host}:${this.config.port}/docs`,
      });
      // Start health monitoring
      await this.health.start();
      span.setAttributes({
        'mcp.orchestrator.started': true,
        'mcp.orchestrator.port': this.config.port,
      });
    } catch (error) {
      span.recordException(error);
      this.logger.error('Failed to start orchestrator', error);
      throw error;
    } finally {
      span.end();
    }
  }
  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.logger.info('Shutting down MCP Orchestrator...');
    // Stop health monitoring
    await this.health.stop();
    // Close Socket.IO connections
    if (this.io) {
      this.io.close();
    }
    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close();
    }
    // Close Fastify
    if (this.app) {
      await this.app.close();
    }
    // Shutdown transport
    await this.transport.shutdown();
    this.logger.info('MCP Orchestrator shutdown complete');
  }
  async initializeDatabase() {
    try {
      await connectToDatabase(this.config.postgres);
      this.logger.info('Database connection established');
    } catch (error) {
      this.logger.error('Database connection failed', error);
      throw error;
    }
  }
  async createApp() {
    this.app = fastify({
      logger: {
        level: this.config.logLevel,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      },
      trustProxy: true,
    });
    // Register plugins
    await this.app.register(fastifyCors, this.config.cors);
    await this.app.register(fastifyHelmet, {
      contentSecurityPolicy: false, // Needed for WebSocket connections
    });
    await this.app.register(fastifyRateLimit, {
      max: this.config.rateLimit.max,
      timeWindow: this.config.rateLimit.timeWindow,
    });
    await this.app.register(fastifyJwt, {
      secret: this.config.jwt.secret,
    });
    await this.app.register(fastifyRedis, {
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
    });
    await this.app.register(fastifyWebsocket);
    // API documentation
    await this.app.register(fastifySwagger, {
      swagger: {
        info: {
          title: 'Cartrita MCP API',
          description: 'Master Control Program API for Cartrita AI System',
          version: '1.0.0',
        },
        host: `${this.config.host}:${this.config.port}`,
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { name: 'auth', description: 'Authentication endpoints' },
          { name: 'agents', description: 'Agent management' },
          { name: 'tasks', description: 'Task execution' },
          { name: 'health', description: 'System health' },
          { name: 'legacy', description: 'Legacy v2 endpoints' },
        ],
      },
    });
    await this.app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });
    this.logger.info('Fastify app created with plugins');
  }
  async initializeSocketIO() {
    this.httpServer = createServer();
    this.io = new SocketIOServer(this.httpServer, {
      cors: this.config.cors,
      transports: ['websocket', 'polling'],
    });
    // Socket.IO middleware for authentication
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('No authentication token provided');
        }
        const decoded = await this.security.verifyToken(token);
        socket.data.user = decoded;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
    // Handle WebSocket connections
    this.io.on('connection', socket => {
      this.handleSocketConnection(socket);
    });
    this.logger.info('Socket.IO initialized');
  }
  async setupRoutes() {
    // Health check endpoint
    this.app.get(
      '/health',
      {
        schema: {
          tags: ['health'],
          summary: 'Health check',
          response: {
            200: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                timestamp: { type: 'string' },
                version: { type: 'string' },
                uptime: { type: 'number' },
              },
            },
          },
        },
      },
      async (request, reply) => {
        const health = await this.health.getHealth();
        return reply.send({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          uptime: process.uptime(),
          ...health,
        });
      }
    );
    // Authentication endpoints
    await this.setupAuthRoutes();
    // MCP v3 API routes
    await this.setupMCPRoutes();
    // Legacy v2 bridge routes
    await this.setupLegacyRoutes();
    // WebSocket upgrade
    this.app.register(async function (fastify) {
      await fastify.get('/ws', { websocket: true }, (connection, req) => {
        connection.socket.on('message', message => {
          // Handle WebSocket messages
          connection.socket.send(JSON.stringify({ echo: message }));
        });
      });
    });
    this.logger.info('Routes configured');
  }
  async setupAuthRoutes() {
    // Login endpoint
    this.app.post(
      '/auth/login',
      {
        schema: {
          tags: ['auth'],
          summary: 'User authentication',
          body: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 1 },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      async (request, reply) => {
        return this.bridge.handleAuthRequest(request, reply);
      }
    );
    // Token refresh
    this.app.post(
      '/auth/refresh',
      {
        schema: {
          tags: ['auth'],
          summary: 'Refresh authentication token',
          security: [{ bearerAuth: [] }],
        },
      },
      {
        preHandler: async (request, reply) => {
          await this.security.authenticate(request, reply);
        },
      },
      async (request, reply) => {
        const newToken = await this.security.generateToken(request.user);
        return { token: newToken };
      }
    );
  }
  async setupMCPRoutes() {
    // Task execution endpoint
    this.app.post(
      '/v3/tasks',
      {
        schema: {
          tags: ['tasks'],
          summary: 'Execute MCP task',
          security: [{ bearerAuth: [] }],
          body: {
            type: 'object',
            required: ['taskType', 'parameters'],
            properties: {
              taskType: { type: 'string' },
              parameters: { type: 'object' },
              priority: { type: 'integer', minimum: 1, maximum: 10 },
              timeout: { type: 'integer', minimum: 1000 },
            },
          },
        },
      },
      {
        preHandler: async (request, reply) => {
          await this.security.authenticate(request, reply);
        },
      },
      async (request, reply) => {
        return this.handleTaskRequest(request, reply);
      }
    );
    // Agent registration
    this.app.post(
      '/v3/agents/register',
      {
        schema: {
          tags: ['agents'],
          summary: 'Register MCP agent',
          security: [{ bearerAuth: [] }],
        },
      },
      {
        preHandler: async (request, reply) => {
          await this.security.authenticate(request, reply);
        },
      },
      async (request, reply) => {
        return this.router.registerAgent(request.body);
      }
    );
    // Agent status
    this.app.get(
      '/v3/agents/:agentId/status',
      {
        schema: {
          tags: ['agents'],
          summary: 'Get agent status',
          security: [{ bearerAuth: [] }],
        },
      },
      {
        preHandler: async (request, reply) => {
          await this.security.authenticate(request, reply);
        },
      },
      async (request, reply) => {
        return this.router.getAgentStatus(request.params.agentId);
      }
    );
  }
  async setupLegacyRoutes() {
    // Bridge all v2 routes to MCP
    this.app.all(
      '/api/*',
      {
        schema: {
          tags: ['legacy'],
          summary: 'Legacy v2 API bridge',
        },
      },
      async (request, reply) => {
        return this.bridge.handleLegacyRequest(request, reply);
      }
    );
  }
  async handleTaskRequest(request, reply) {
    const span = this.tracer.startSpan('mcp.orchestrator.task', {
      kind: SpanKind.SERVER,
      attributes: {
        'mcp.task.type': request.body.taskType,
        'user.id': request.user.id,
      },
    });
    try {
      const taskRequest = {
        taskType: request.body.taskType,
        taskId: crypto.randomUUID(),
        parameters: request.body.parameters,
        metadata: {
          'user.id': request.user.id,
          'request.ip': request.ip,
        },
        priority: request.body.priority || 5,
        deadline: request.body.timeout
          ? new Date(Date.now() + request.body.timeout)
          : undefined,
      };
      // Validate task request
      const validation = MCPValidator.safeValidate(
        MCPValidator.validateTaskRequest,
        taskRequest
      );
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid task request',
          details: validation.errors,
        });
      }
      // Route to appropriate supervisor
      const supervisor = MCPValidator.getSupervisorForTask(
        taskRequest.taskType
      );
      const response = await this.router.routeTask(taskRequest, supervisor);
      span.setAttributes({
        'mcp.task.status': response.status,
        'mcp.task.supervisor': supervisor,
      });
      return response;
    } catch (error) {
      span.recordException(error);
      this.logger.error('Task execution failed', error);
      return reply.status(500).send({
        error: 'Task execution failed',
        message: error.message,
      });
    } finally {
      span.end();
    }
  }
  handleSocketConnection(socket) {
    const span = this.tracer.startSpan('mcp.orchestrator.socket.connection');
    this.logger.info('Socket.IO client connected', {
      socketId: socket.id,
      userId: socket.data.user?.id,
    });
    // Handle MCP messages over WebSocket
    socket.on('mcp:message', async data => {
      const childSpan = this.tracer.startSpan(
        'mcp.orchestrator.socket.message',
        {
          parent: span.spanContext(),
        }
      );
      try {
        const message = MCPValidator.validateMessage(data);
        const result = await this.router.handleMessage(message);
        socket.emit('mcp:response', result);
        childSpan.setAttributes({ 'mcp.message.handled': true });
      } catch (error) {
        childSpan.recordException(error);
        socket.emit('mcp:error', { error: error.message });
      } finally {
        childSpan.end();
      }
    });
    // Handle legacy events for backwards compatibility
    socket.on('chat', async data => {
      const legacyResponse = await this.bridge.handleLegacySocketEvent(
        'chat',
        data
      );
      socket.emit('chat_response', legacyResponse);
    });
    socket.on('disconnect', reason => {
      this.logger.info('Socket.IO client disconnected', {
        socketId: socket.id,
        reason,
      });
      span.end();
    });
  }
  setupSignalHandlers() {
    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, shutting down gracefully');
      this.shutdown().catch(error => {
        this.logger.error('Error during shutdown', error);
        process.exit(1);
      });
    });
    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, shutting down gracefully');
      this.shutdown().catch(error => {
        this.logger.error('Error during shutdown', error);
        process.exit(1);
      });
    });
  }
}
// Export factory function
export function createMCPOrchestrator(config) {
  return new MCPOrchestrator(config);
}
// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const orchestrator = createMCPOrchestrator();
  orchestrator.start().catch(error => {
    console.error('Failed to start MCP Orchestrator:', error);
    process.exit(1);
  });
}
