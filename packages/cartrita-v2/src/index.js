/**
 * Cartrita V2 - Hybrid Backend Entry Point
 * Node.js + Python FastAPI Multi-Agent System
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');

// Cartrita V2 Core
const CartritaCoreOrchestrator = require('./services/CartritaCoreOrchestrator');
const NodeMCPCopilotBridge = require('./mcp-copilot-integration');

// Load environment variables
require('dotenv').config();

class CartritaV2Server {
    constructor() {
        this.app = express();
        this.server = null;
        this.io = null;
        this.orchestrator = null;
        this.mcpCopilotBridge = null;
        this.isShuttingDown = false;
        
        // Configuration
        this.config = {
            port: process.env.PORT || 8001,
            nodeEnv: process.env.NODE_ENV || 'development',
            enablePythonAgents: process.env.ENABLE_PYTHON_AGENTS !== 'false',
            enableNodeAgents: process.env.ENABLE_NODE_AGENTS !== 'false',
            pythonServerUrl: process.env.PYTHON_SERVER_URL || 'http://localhost:8002',
            corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
            rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
            rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100
        };
        
        this.logger = console; // Will be replaced with proper logger
    }
    
    /**
     * Initialize the server
     */
    async initialize() {
        try {
            this.logger.info('🚀 Initializing Cartrita V2 Hybrid Backend');
            
            // Setup Express middleware
            this.setupMiddleware();
            
            // Initialize Cartrita Core Orchestrator
            this.logger.info('🎭 Initializing Core Orchestrator');
            this.orchestrator = new CartritaCoreOrchestrator({
                pythonServerUrl: this.config.pythonServerUrl,
                enableNodeAgents: this.config.enableNodeAgents,
                enablePythonAgents: this.config.enablePythonAgents,
                defaultRoutingStrategy: 'intelligent'
            });
            
            await this.orchestrator.initialize(this.logger);
            
            // Initialize MCP Copilot Bridge
            this.logger.info('🌉 Initializing MCP Copilot Bridge');
            this.mcpCopilotBridge = new NodeMCPCopilotBridge({
                pythonServiceUrl: this.config.pythonServerUrl
            });
            
            // Setup routes
            this.setupRoutes();
            
            // Create HTTP server and Socket.IO
            this.server = createServer(this.app);
            this.setupSocketIO();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
            this.logger.info('✅ Cartrita V2 initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Cartrita V2:', error);
            throw error;
        }
    }
    
    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Security
        this.app.use(helmet({
            contentSecurityPolicy: false, // Disable for development
            crossOriginEmbedderPolicy: false
        }));
        
        // CORS
        this.app.use(cors({
            origin: this.config.corsOrigins,
            credentials: true,
            optionsSuccessStatus: 200
        }));
        
        // Compression
        this.app.use(compression());
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: this.config.rateLimitWindow,
            max: this.config.rateLimitMax,
            message: {
                success: false,
                error: 'Too many requests, please try again later.',
                retryAfter: this.config.rateLimitWindow
            }
        });
        this.app.use('/api/', limiter);
        
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }
    
    /**
     * Setup API routes
     */
    setupRoutes() {
        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Cartrita V2 - Multi-Agent AI Operating System',
                version: '2.0.0',
                status: 'active',
                architecture: 'hybrid',
                backends: {
                    node: this.config.enableNodeAgents,
                    python: this.config.enablePythonAgents
                },
                timestamp: new Date().toISOString()
            });
        });
        
        // Health check
        this.app.get('/health', async (req, res) => {
            try {
                const orchestratorStatus = await this.orchestrator.getStatus();
                
                const health = {
                    status: 'healthy',
                    version: '2.0.0',
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    orchestrator: orchestratorStatus,
                    timestamp: new Date().toISOString()
                };
                
                res.json(health);
            } catch (error) {
                this.logger.error('❌ Health check failed:', error);
                res.status(503).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Main chat endpoint - routes through orchestrator
        this.app.post('/api/chat', async (req, res) => {
            try {
                const { message, user_id, session_id, priority, preferred_agent, context } = req.body;
                
                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required'
                    });
                }
                
                const request = {
                    message,
                    userId: user_id || 'anonymous',
                    sessionId: session_id,
                    priority: priority || 'medium',
                    preferredAgent: preferred_agent,
                    context: context || {},
                    type: 'chat'
                };
                
                const response = await this.orchestrator.processRequest(request);
                
                res.json({
                    success: response.success,
                    ...response
                });
                
            } catch (error) {
                this.logger.error('❌ Chat request failed:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        // Computer use endpoint
        this.app.post('/api/computer', async (req, res) => {
            try {
                const { 
                    task_description, 
                    user_id, 
                    session_id, 
                    max_iterations,
                    display_width,
                    display_height,
                    environment 
                } = req.body;
                
                if (!task_description) {
                    return res.status(400).json({
                        success: false,
                        error: 'Task description is required'
                    });
                }
                
                const request = {
                    message: task_description,
                    userId: user_id || 'anonymous',
                    sessionId: session_id,
                    maxIterations: max_iterations || 10,
                    displayWidth: display_width || 1024,
                    displayHeight: display_height || 768,
                    environment: environment || 'ubuntu',
                    type: 'computer_use',
                    preferredAgent: 'computer_use_agent_v2'
                };
                
                const response = await this.orchestrator.processRequest(request);
                
                res.json({
                    success: response.success,
                    ...response
                });
                
            } catch (error) {
                this.logger.error('❌ Computer use request failed:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        // Agent status
        this.app.get('/api/agents/status', async (req, res) => {
            try {
                const status = await this.orchestrator.getStatus();
                res.json({ success: true, ...status });
            } catch (error) {
                this.logger.error('❌ Agent status request failed:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        // Register MCP Copilot Bridge routes
        this.logger.info('📡 Registering MCP Copilot routes');
        this.mcpCopilotBridge.registerRoutes(this.app);
        
        // Fallback for unknown routes
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                path: req.originalUrl,
                method: req.method,
                available_endpoints: [
                    'GET /',
                    'GET /health',
                    'POST /api/chat',
                    'POST /api/computer',
                    'GET /api/agents/status',
                    'POST /api/mcp/copilot/start-session',
                    'POST /api/mcp/copilot/analyze-project',
                    'POST /api/mcp/copilot/create-instructions',
                    'POST /api/mcp/copilot/simulate-delegation',
                    'GET /api/mcp/copilot/status',
                    'GET /api/mcp/copilot/manifest'
                ]
            });
        });
        
        // Error handler
        this.app.use((error, req, res, next) => {
            this.logger.error('❌ Unhandled error:', error);
            
            if (res.headersSent) {
                return next(error);
            }
            
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        });
    }
    
    /**
     * Setup Socket.IO for real-time communication
     */
    setupSocketIO() {
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: this.config.corsOrigins,
                methods: ['GET', 'POST']
            }
        });
        
        this.io.on('connection', (socket) => {
            this.logger.info(`🔌 Client connected: ${socket.id}`);
            
            socket.on('chat', async (data) => {
                try {
                    const request = {
                        message: data.message,
                        userId: data.user_id || socket.id,
                        sessionId: data.session_id || socket.id,
                        priority: data.priority || 'medium',
                        preferredAgent: data.preferred_agent,
                        context: data.context || {},
                        type: 'chat'
                    };
                    
                    const response = await this.orchestrator.processRequest(request);
                    
                    socket.emit('chat_response', {
                        success: response.success,
                        ...response,
                        socket_id: socket.id
                    });
                    
                } catch (error) {
                    this.logger.error('❌ Socket chat failed:', error);
                    socket.emit('error', {
                        success: false,
                        error: error.message
                    });
                }
            });
            
            socket.on('disconnect', () => {
                this.logger.info(`🔌 Client disconnected: ${socket.id}`);
            });
        });
        
        this.logger.info('✅ Socket.IO configured');
    }
    
    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;
            
            this.logger.info(`🛑 Received ${signal}, starting graceful shutdown`);
            
            // Stop accepting new connections
            this.server.close(() => {
                this.logger.info('📡 HTTP server closed');
            });
            
            // Close Socket.IO
            if (this.io) {
                this.io.close();
                this.logger.info('🔌 Socket.IO closed');
            }
            
            // Shutdown orchestrator
            if (this.orchestrator) {
                await this.orchestrator.shutdown();
            }
            
            this.logger.info('✅ Graceful shutdown completed');
            process.exit(0);
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.logger.error('❌ Uncaught exception:', error);
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('❌ Unhandled rejection:', reason);
            gracefulShutdown('UNHANDLED_REJECTION');
        });
    }
    
    /**
     * Start the server
     */
    async start() {
        try {
            await this.initialize();
            
            this.server.listen(this.config.port, () => {
                this.logger.info(`🚀 Cartrita V2 running on port ${this.config.port}`);
                this.logger.info(`🌐 Environment: ${this.config.nodeEnv}`);
                this.logger.info(`🔗 Python Backend: ${this.config.enablePythonAgents ? 'Enabled' : 'Disabled'}`);
                this.logger.info(`📦 Node Backend: ${this.config.enableNodeAgents ? 'Enabled' : 'Disabled'}`);
                this.logger.info(`✅ Server ready for requests`);
            });
            
        } catch (error) {
            this.logger.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Start server if called directly
if (require.main === module) {
    const server = new CartritaV2Server();
    server.start().catch(error => {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    });
}

module.exports = CartritaV2Server;