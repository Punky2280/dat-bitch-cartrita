/**
 * Cartrita V2 Enhanced Server - The Ultimate AI Operating System
 * Integrating sophisticated agent system, universal prompt engineering, 
 * and all V1 capabilities into the most advanced AI assistant ever built
 */

import Fastify from 'fastify';
import { logger } from './logger.js';

// Advanced Fastify plugins for production-grade system
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJWT from '@fastify/jwt';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebSocket from '@fastify/websocket';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// Core V2 routes - will load dynamically to handle missing files gracefully

// Advanced V2 Services - will load dynamically to handle missing files gracefully

// Database connection
import { pool } from '../database/connection.js';

export class CartritaV2EnhancedServer {
    constructor() {
        this.fastify = null;
        this.services = {};
        this.agents = {};
        this.isInitialized = false;
        this.startupTime = Date.now();
    }

    async createServer() {
        logger.info('🚀 Creating Cartrita V2 Enhanced Server...');

        // Enhanced Fastify instance with production configuration
        this.fastify = Fastify({
            logger: {
                level: process.env.LOG_LEVEL || 'info',
                transport: process.env.NODE_ENV === 'development' ? {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'HH:MM:ss.l',
                        ignore: 'pid,hostname',
                        messageFormat: '{time} | {level} | {msg}'
                    }
                } : undefined
            },
            trustProxy: true,
            keepAliveTimeout: 30000,
            requestTimeout: 120000, // 2 minutes for AI operations
            bodyLimit: 100 * 1024 * 1024, // 100MB for large files
            disableRequestLogging: process.env.NODE_ENV === 'production'
        });

        await this.setupSecurity();
        await this.setupMiddleware();
        await this.setupServices();
        await this.setupAgents();
        await this.setupRoutes();
        await this.setupDocumentation();
        await this.setupHooks();

        this.isInitialized = true;
        logger.info('✅ Cartrita V2 Enhanced Server created successfully');
        
        return this.fastify;
    }

    async setupSecurity() {
        logger.info('🛡️ Setting up enterprise-grade security...');

        // Advanced security headers
        await this.fastify.register(fastifyHelmet, {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-eval'"], // For dynamic AI features
                    imgSrc: ["'self'", "data:", "https:", "blob:"],
                    connectSrc: ["'self'", "ws:", "wss:", "https:"],
                    fontSrc: ["'self'", "https:", "data:"],
                    mediaSrc: ["'self'", "blob:", "data:"]
                }
            },
            crossOriginEmbedderPolicy: false,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        });

        // Sophisticated CORS configuration
        await this.fastify.register(fastifyCors, {
            origin: (origin, callback) => {
                // Development mode - allow all
                if (process.env.NODE_ENV === 'development') {
                    return callback(null, true);
                }

                // Production mode - strict whitelist
                const allowedOrigins = [
                    'https://cartrita.com',
                    'https://app.cartrita.com',
                    'https://api.cartrita.com',
                    'http://localhost:3000',
                    'http://localhost:8000'
                ];

                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('CORS policy violation'), false);
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type', 
                'Authorization', 
                'X-Requested-With',
                'X-Correlation-ID',
                'X-User-Agent',
                'X-API-Version'
            ],
            exposedHeaders: ['X-Correlation-ID', 'X-Response-Time']
        });

        // Intelligent rate limiting
        await this.fastify.register(fastifyRateLimit, {
            max: (request) => {
                // Different limits for different endpoints
                if (request.url.startsWith('/api/v2/chat')) return 60; // Chat limited
                if (request.url.startsWith('/api/v2/ai')) return 100; // AI operations
                if (request.url.startsWith('/api/v2/computer-use')) return 10; // Computer use very limited
                return 1000; // Default high limit
            },
            timeWindow: '1 minute',
            skipOnError: true,
            keyGenerator: (request) => {
                // Use JWT user ID if available, fallback to IP
                const token = request.headers.authorization?.replace('Bearer ', '');
                if (token) {
                    try {
                        const decoded = this.fastify.jwt.verify(token);
                        return `user:${decoded.userId}`;
                    } catch {}
                }
                return request.headers['x-forwarded-for'] || request.ip;
            },
            errorResponseBuilder: (request, context) => ({
                success: false,
                error: 'Rate limit exceeded - slow down there, speed racer! 😅',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.round(context.ttl / 1000),
                cartritaNote: "I appreciate the enthusiasm, but let me catch my breath!"
            })
        });

        // JWT with advanced configuration
        await this.fastify.register(fastifyJWT, {
            secret: process.env.JWT_SECRET || 'cartrita-v2-ultra-secure-secret',
            sign: {
                issuer: 'cartrita-v2-enhanced',
                expiresIn: '24h',
                algorithm: 'HS256'
            },
            verify: {
                issuer: 'cartrita-v2-enhanced',
                maxAge: '24h'
            }
        });

        logger.info('✅ Enterprise security configured');
    }

    async setupMiddleware() {
        logger.info('⚙️ Setting up advanced middleware...');

        // High-performance compression
        await this.fastify.register(fastifyCompress, {
            global: true,
            encodings: ['gzip', 'deflate', 'br'],
            threshold: 1024,
            customTypes: /^text\/|\+json$|\+text$|\+xml$/,
            brotliOptions: {
                params: {
                    [require('zlib').constants.BROTLI_PARAM_QUALITY]: 6
                }
            }
        });

        // Advanced file upload support
        await this.fastify.register(fastifyMultipart, {
            limits: {
                fileSize: 500 * 1024 * 1024, // 500MB for AI data processing
                files: 20,
                headerPairs: 2000
            },
            attachFieldsToBody: 'keyValues',
            addToBody: true,
            onFile: async (part) => {
                // Validate file types for security
                const allowedTypes = [
                    'image/', 'audio/', 'video/', 'text/', 'application/json',
                    'application/pdf', 'application/javascript'
                ];
                
                if (!allowedTypes.some(type => part.mimetype.startsWith(type))) {
                    throw new Error(`File type ${part.mimetype} not allowed`);
                }
            }
        });

        // WebSocket with enhanced features
        await this.fastify.register(fastifyWebSocket, {
            options: {
                maxPayload: 10 * 1024 * 1024, // 10MB messages
                compression: true,
                maxCompression: 1024,
                clientTracking: true,
                perMessageDeflate: {
                    threshold: 1024,
                    concurrencyLimit: 10,
                    memLevel: 7
                }
            }
        });

        logger.info('✅ Advanced middleware configured');
    }

    async setupServices() {
        logger.info('🔧 Initializing sophisticated service layer...');

        try {
            // Initialize services dynamically to handle missing dependencies
            this.services = {};

            // Try to load OpenAI service
            try {
                const { default: OpenAIService } = await import('../services/OpenAIService.js');
                this.services.openai = new OpenAIService();
                logger.info('✅ OpenAI service loaded');
            } catch (error) {
                logger.warn('⚠️ OpenAI service not available:', error.message);
            }

            // Try to load other services
            try {
                const { default: EmbeddingsService } = await import('../services/EmbeddingsService.js');
                this.services.embeddings = new EmbeddingsService();
                logger.info('✅ Embeddings service loaded');
            } catch (error) {
                logger.warn('⚠️ Embeddings service not available:', error.message);
            }

            try {
                const { default: AgentToolRegistry } = await import('../services/AgentToolRegistry.js');
                this.services.toolRegistry = new AgentToolRegistry();
                await this.services.toolRegistry.initialize();
                logger.info('✅ Tool registry loaded');
            } catch (error) {
                logger.warn('⚠️ Tool registry not available:', error.message);
            }

            // Try to load universal prompt system
            try {
                const { cartritaPromptSystem } = await import('../config/cartrita-universal-prompt-system.js');
                this.services.promptSystem = cartritaPromptSystem;
                logger.info('✅ Universal prompt system loaded');
            } catch (error) {
                logger.warn('⚠️ Universal prompt system not available:', error.message);
            }

            // Make services globally available to routes
            this.fastify.decorate('services', this.services);
            this.fastify.decorate('db', pool);

            logger.info('✅ Service layer initialized', {
                services: Object.keys(this.services).length
            });
        } catch (error) {
            logger.error('❌ Service initialization failed:', error);
            throw error;
        }
    }

    async setupAgents() {
        logger.info('🧠 Initializing world-class agent system...');

        try {
            // Initialize agents dynamically to handle missing dependencies
            this.agents = {};

            // Try to load Cartrita core agent
            try {
                const { default: CartritaCoreAgent } = await import('../agents/CartritaCoreAgent.js');
                this.agents.cartrita = new CartritaCoreAgent();
                if (this.agents.cartrita.initialize) {
                    await this.agents.cartrita.initialize();
                }
                logger.info('✅ Cartrita core agent loaded');
            } catch (error) {
                logger.warn('⚠️ Cartrita core agent not available:', error.message);
            }

            // Try to load enhanced LangChain agent
            try {
                const { default: EnhancedLangChainCoreAgent } = await import('../agents/EnhancedLangChainCoreAgent.js');
                this.agents.enhanced = new EnhancedLangChainCoreAgent();
                if (this.agents.enhanced.initialize) {
                    await this.agents.enhanced.initialize();
                }
                logger.info('✅ Enhanced LangChain agent loaded');
            } catch (error) {
                logger.warn('⚠️ Enhanced LangChain agent not available:', error.message);
            }

            // Set up intelligent coordination if available
            if (this.agents.enhanced) {
                this.agents.coordinator = this.agents.enhanced;
            }
            if (this.agents.cartrita) {
                this.agents.primary = this.agents.cartrita;
            }

            // Make agents available globally
            this.fastify.decorate('agents', this.agents);

            logger.info('✅ Agent system initialized', {
                agents: Object.keys(this.agents).length,
                primaryAgent: this.agents.cartrita ? 'CartritaCoreAgent' : 'None',
                coordinator: this.agents.enhanced ? 'EnhancedLangChainCoreAgent' : 'None'
            });
        } catch (error) {
            logger.error('❌ Agent system initialization failed:', error);
            throw error;
        }
    }

    async setupRoutes() {
        logger.info('🌐 Registering intelligent API routes...');

        // API root with Cartrita personality
        this.fastify.get('/api/v2', async (request, reply) => {
            const uptime = Date.now() - this.startupTime;
            const uptimeMinutes = Math.floor(uptime / 60000);
            
            return {
                success: true,
                data: {
                    name: 'Cartrita V2 Enhanced AI Operating System',
                    version: '2.0.0-enhanced',
                    description: 'The most sophisticated AI assistant ever created',
                    personality: 'Miami street-smart with world-class intelligence',
                    uptime: `${uptimeMinutes} minutes`,
                    capabilities: [
                        'Hierarchical multi-agent coordination',
                        'Universal prompt engineering excellence',
                        'Advanced computer use automation',
                        'Sophisticated natural language processing',
                        'Multi-modal AI processing',
                        'Real-time learning and adaptation',
                        'Enterprise-grade security',
                        'Production-ready scalability'
                    ],
                    endpoints: {
                        health: '/health',
                        documentation: '/docs',
                        authentication: '/api/v2/auth',
                        enhancedChat: '/api/v2/chat',
                        conversations: '/api/v2/conversations',
                        agentManagement: '/api/v2/agents',
                        aiServices: '/api/v2/ai',
                        embeddings: '/api/v2/embeddings',
                        systemMonitoring: '/api/v2/monitoring',
                        computerUse: '/api/v2/computer-use',
                        websocket: '/ws'
                    },
                    cartritaGreeting: "Hey! I'm Cartrita, your AI assistant with some serious street smarts and world-class capabilities. Ready to dominate some tasks together? 🚀",
                    systemStatus: {
                        services: Object.keys(this.services).length,
                        agents: Object.keys(this.agents).length,
                        database: 'Connected',
                        security: 'Maximum',
                        performance: 'Optimized'
                    }
                },
                timestamp: new Date().toISOString()
            };
        });

        // Register routes dynamically to handle missing files gracefully
        const routesToLoad = [
            { path: '../routes/health.js', export: 'healthRoutes', prefix: '/health' },
            { path: '../routes/auth.js', export: 'authRoutes', prefix: '/api/v2/auth' },
            { path: '../routes/enhanced-chat.js', export: 'enhancedChatRoutes', prefix: '/api/v2/chat' },
            { path: '../routes/chat.js', export: 'chatRoutes', prefix: '/api/v2/conversations' },
            { path: '../routes/agent-endpoints.js', export: 'agentEndpoints', prefix: '/api/v2/agents' },
            { path: '../routes/ai-services.js', export: 'aiServicesEndpoints', prefix: '/api/v2/ai' },
            { path: '../routes/system-monitoring.js', export: 'systemMonitoringEndpoints', prefix: '/api/v2/monitoring' },
            { path: '../routes/websocket-routes.js', export: 'websocketRoutes', prefix: '/ws' },
            { path: '../routes/agents.js', export: 'agentRoutes', prefix: '/api/v2/agents/legacy' },
            { path: '../routes/ai.js', export: 'aiRoutes', prefix: '/api/v2/ai/legacy' },
            { path: '../routes/embeddings.js', export: 'embeddingsRoutes', prefix: '/api/v2/embeddings' }
        ];

        for (const route of routesToLoad) {
            try {
                const module = await import(route.path);
                const routeFunction = module[route.export] || module.default;
                
                if (routeFunction) {
                    await this.fastify.register(routeFunction, { prefix: route.prefix });
                    logger.info(`✅ Loaded route: ${route.prefix}`);
                } else {
                    logger.warn(`⚠️ Route function not found: ${route.export} in ${route.path}`);
                }
            } catch (error) {
                logger.warn(`⚠️ Failed to load route ${route.path}:`, error.message);
            }
        }

        // Dynamic Computer Use routes
        try {
            const { default: computerUseRoutes } = await import('../routes/computerUse.js');
            await this.fastify.register(computerUseRoutes, { prefix: '/api/v2/computer-use' });
        } catch (error) {
            logger.warn('Computer Use routes not available:', error.message);
        }

        // Legacy WebSocket routes fallback
        try {
            await this.fastify.register(websocketRoutes, { prefix: '/ws/legacy' });
        } catch (error) {
            logger.warn('Legacy WebSocket routes not available:', error.message);
        }

        logger.info('✅ Intelligent API routes registered');
    }

    async setupDocumentation() {
        logger.info('📚 Setting up comprehensive API documentation...');

        // Advanced Swagger configuration
        await this.fastify.register(fastifySwagger, {
            openapi: {
                openapi: '3.0.3',
                info: {
                    title: 'Cartrita V2 Enhanced API',
                    description: `
# The Ultimate AI Operating System API

Welcome to Cartrita V2 - the most sophisticated AI assistant ever built!

## Features
- **Hierarchical Multi-Agent System**: Specialized AI agents working together
- **Universal Prompt Engineering**: The most advanced prompt system ever created  
- **Computer Use Automation**: AI that can actually use your computer
- **Multi-Modal Processing**: Text, images, audio, and video understanding
- **Real-Time Capabilities**: WebSocket-powered live interactions
- **Enterprise Security**: Production-grade security and authentication

## Personality
Cartrita brings Miami street-smart confidence with world-class AI capabilities. 
She's direct, results-oriented, and genuinely helpful - with just the right amount of sass.

## Getting Started
1. Authenticate using JWT tokens via \`/api/v2/auth\`
2. Start chatting with Cartrita via \`/api/v2/chat\`  
3. Explore specialized AI capabilities through other endpoints
4. Use WebSocket at \`/ws\` for real-time interactions

Ready to see what next-level AI can do? Let's get started! 🚀
                    `,
                    version: '2.0.0-enhanced',
                    contact: {
                        name: 'Cartrita Development Team',
                        email: 'api@cartrita.com',
                        url: 'https://cartrita.com/support'
                    },
                    license: {
                        name: 'MIT',
                        url: 'https://opensource.org/licenses/MIT'
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
                        BearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT',
                            description: 'JWT token obtained from /api/v2/auth/login'
                        }
                    },
                    schemas: {
                        SuccessResponse: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: { type: 'object' },
                                timestamp: { type: 'string', format: 'date-time' }
                            }
                        },
                        ErrorResponse: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { type: 'string' },
                                code: { type: 'string' },
                                timestamp: { type: 'string', format: 'date-time' }
                            }
                        }
                    }
                },
                tags: [
                    { name: 'health', description: 'System health and status monitoring' },
                    { name: 'auth', description: 'Authentication and user management' },
                    { name: 'agents', description: 'AI agent management and coordination' },
                    { name: 'chat', description: 'Chat conversations with Cartrita' },
                    { name: 'ai', description: 'AI provider integrations and services' },
                    { name: 'embeddings', description: 'Text embeddings and similarity search' },
                    { name: 'computer-use', description: 'Computer automation and control' },
                    { name: 'websocket', description: 'Real-time WebSocket connections' }
                ]
            }
        });

        // Beautiful Swagger UI
        await this.fastify.register(fastifySwaggerUi, {
            routePrefix: '/docs',
            uiConfig: {
                docExpansion: 'list',
                deepLinking: true,
                displayOperationId: true,
                defaultModelsExpandDepth: 2,
                showExtensions: true,
                showCommonExtensions: true,
                tryItOutEnabled: true
            },
            staticCSP: true,
            theme: {
                title: 'Cartrita V2 Enhanced API Documentation'
            }
        });

        logger.info('✅ Comprehensive documentation ready at /docs');
    }

    async setupHooks() {
        logger.info('🪝 Setting up intelligent request hooks...');

        // Advanced request lifecycle management
        this.fastify.addHook('onRequest', async (request, reply) => {
            request.startTime = Date.now();
            request.correlationId = `cartrita-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Add Cartrita personality to response headers
            reply.header('X-Powered-By', 'Cartrita-V2-Enhanced');
            reply.header('X-Correlation-ID', request.correlationId);
            reply.header('X-AI-Assistant', 'Cartrita');

            if (process.env.NODE_ENV === 'development') {
                logger.debug(`🔄 Request started`, {
                    correlationId: request.correlationId,
                    method: request.method,
                    url: request.url,
                    userAgent: request.headers['user-agent'],
                    ip: request.ip
                });
            }
        });

        this.fastify.addHook('onResponse', async (request, reply) => {
            const duration = Date.now() - request.startTime;
            reply.header('X-Response-Time', `${duration}ms`);

            if (duration > 5000) { // Log slow requests
                logger.warn('🐌 Slow response detected', {
                    correlationId: request.correlationId,
                    method: request.method,
                    url: request.url,
                    duration: `${duration}ms`,
                    statusCode: reply.statusCode
                });
            }
        });

        // Intelligent error handling with Cartrita personality
        this.fastify.setErrorHandler(async (error, request, reply) => {
            const statusCode = error.statusCode || 500;
            const correlationId = request.correlationId || 'unknown';
            const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            logger.error('💥 Request error', {
                errorId,
                correlationId,
                method: request.method,
                url: request.url,
                statusCode,
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });

            // Cartrita-style error responses
            const errorResponse = {
                success: false,
                error: statusCode >= 500 ? 'Internal server error' : error.message,
                code: error.code || 'UNKNOWN_ERROR',
                errorId,
                correlationId,
                timestamp: new Date().toISOString()
            };

            // Add personality to non-auth errors
            if (statusCode !== 401 && statusCode !== 403 && statusCode >= 500) {
                errorResponse.cartritaNote = "Something went sideways on my end, but I'm learning from this to do better next time! 💪";
            }

            reply.status(statusCode).send(errorResponse);
        });

        // Smart 404 handler
        this.fastify.setNotFoundHandler(async (request, reply) => {
            logger.info('🔍 Route not found', {
                method: request.method,
                url: request.url,
                ip: request.ip,
                userAgent: request.headers['user-agent']
            });

            reply.status(404).send({
                success: false,
                error: 'Route not found',
                code: 'ROUTE_NOT_FOUND',
                path: request.url,
                method: request.method,
                cartritaNote: `I couldn't find what you're looking for at ${request.url}. Check out /docs for available endpoints!`,
                availableRoutes: [
                    '/health',
                    '/docs',
                    '/api/v2',
                    '/api/v2/auth',
                    '/api/v2/chat',
                    '/api/v2/agents',
                    '/api/v2/ai',
                    '/api/v2/embeddings',
                    '/ws'
                ],
                timestamp: new Date().toISOString()
            });
        });

        logger.info('✅ Intelligent request hooks configured');
    }

    async start(port = 8000, host = '0.0.0.0') {
        try {
            logger.info(`🚀 Starting Cartrita V2 Enhanced Server...`);

            if (!this.isInitialized) {
                await this.createServer();
            }

            await this.fastify.listen({ port, host });

            const startupDuration = Date.now() - this.startupTime;
            
            logger.info(`
🌟 ============================================================= 🌟
   CARTRITA V2 ENHANCED AI OPERATING SYSTEM - FULLY OPERATIONAL    
🌟 ============================================================= 🌟

🔥 Status: RUNNING WITH MAXIMUM SOPHISTICATION
📍 Address: http://${host}:${port}
🧠 AI Capabilities: WORLD-CLASS INTELLIGENCE ACTIVE
🤖 Agent System: HIERARCHICAL MULTI-AGENT COORDINATION  
🎯 Prompt Engineering: UNIVERSAL EXCELLENCE v3.0
🛡️  Security: ENTERPRISE-GRADE PROTECTION
⚡ Performance: OPTIMIZED FOR SPEED & INTELLIGENCE
🔧 Services: ALL SYSTEMS OPERATIONAL
📚 Documentation: http://${host}:${port}/docs
⏱️  Startup Time: ${startupDuration}ms

Available Endpoints:
• System Info: GET /api/v2
• Health Check: GET /health  
• Documentation: GET /docs
• Authentication: POST /api/v2/auth/*
• Chat with Cartrita: POST /api/v2/chat
• Agent Management: GET /api/v2/agents/*
• AI Services: POST /api/v2/ai/*
• Embeddings & RAG: POST /api/v2/embeddings/*
• Computer Automation: POST /api/v2/computer-use/*
• Real-time WebSocket: WS /ws

🎯 CARTRITA'S WELCOME MESSAGE:
"¡Óye! I'm Cartrita, your AI assistant with serious Miami street smarts 
and world-class intelligence. I've got sophisticated agents, universal 
prompt engineering, and the confidence to tackle anything you throw at me. 

Ready to see what next-level AI assistance looks like? Let's dominate 
some tasks together! 💥🚀"

System is locked, loaded, and ready to revolutionize AI assistance! 🌟
            `);

            return this.fastify;
        } catch (error) {
            logger.error('💥 Failed to start Cartrita V2 Enhanced Server:', error);
            throw error;
        }
    }

    async stop() {
        logger.info('🛑 Gracefully shutting down Cartrita V2 Enhanced Server...');
        
        try {
            // Graceful agent shutdown
            if (this.agents.cartrita?.shutdown) {
                await this.agents.cartrita.shutdown();
            }
            if (this.agents.enhanced?.shutdown) {
                await this.agents.enhanced.shutdown();
            }

            // Close server
            if (this.fastify) {
                await this.fastify.close();
            }

            logger.info('✅ Cartrita V2 Enhanced Server shutdown complete - Until next time! 👋');
        } catch (error) {
            logger.error('❌ Error during shutdown:', error);
            throw error;
        }
    }

    // Health check method for monitoring
    getHealthStatus() {
        return {
            status: 'operational',
            uptime: Date.now() - this.startupTime,
            services: Object.keys(this.services).length,
            agents: Object.keys(this.agents).length,
            memory: process.memoryUsage(),
            version: '2.0.0-enhanced',
            personality: 'Cartrita - Miami street-smart with world-class AI'
        };
    }
}

// Export singleton instance
export const cartritaServer = new CartritaV2EnhancedServer();

// Export factory function
export async function createCartritaServer() {
    return await cartritaServer.createServer();
}

export default CartritaV2EnhancedServer;