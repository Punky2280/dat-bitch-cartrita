// packages/backend/index.js
// Enhanced Production Server for Cartrita AI Assistant

console.log('[Index] 🚀 Starting Cartrita backend...');
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// --- AGENT & SERVICE IMPORTS ---
import EnhancedLangChainCoreAgent from './src/agi/consciousness/EnhancedLangChainCoreAgent.js';
import initializeAgents from './src/agi/agentInitializer.js';
import ServiceInitializer from './src/services/ServiceInitializer.js';
import SensoryProcessingService from './src/system/SensoryProcessingService.js';
import authenticateTokenSocket from './src/middleware/authenticateTokenSocket.js';

// --- ROUTE IMPORTS ---
import authRoutes from './src/routes/auth.js';
import agentRoutes from './src/routes/agent.js';
import userRoutes from './src/routes/user.js';
import chatHistoryRoutes from './src/routes/chatHistory.js';
import workflowRoutes from './src/routes/workflows.js';
import knowledgeRoutes from './src/routes/knowledge.js';
import vaultRoutes from './src/routes/vault.js';
import apiKeyRoutes from './src/routes/apiKeys.js';
import monitoringRoutes from './src/routes/monitoring.js';
import voiceToTextRoutes from './src/routes/voiceToText.js';
import voiceChatRoutes from './src/routes/voiceChat.js';
import visionRoutes from './src/routes/vision.js';
import settingsRoutes from './src/routes/settings.js';
import mcpRoutes from './src/routes/mcp.js';
import calendarRoutes from './src/routes/calendar.js';
import emailRoutes from './src/routes/email.js';
import contactRoutes from './src/routes/contact.js';
import notificationRoutes from './src/routes/notifications.js';
import privacyRoutes from './src/routes/privacy.js';

// --- CONFIGURATION ---
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
}

// --- SINGLETON AGENT & SERVICE INITIALIZATION ---
const coreAgent = new EnhancedLangChainCoreAgent();
const sensoryService = new SensoryProcessingService(coreAgent);

// --- APP & SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

// --- MIDDLEWARE SETUP ---
app.use(helmet({
    contentSecurityPolicy: NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: NODE_ENV === 'production' ? 100 : 1000,
    message: { error: 'Too many requests from this IP, please try again later.', retryAfter: '15 minutes' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    if (NODE_ENV === 'development') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json') && !req.is('multipart/form-data') && !req.is('application/x-www-form-urlencoded')) {
        return res.status(400).json({ error: 'Invalid content-type. Expected application/json' });
    }
    next();
});

// --- SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});
// Socket.IO instance available for routes

// --- PERFORMANCE MONITORING ---
const performanceMetrics = {
    requests: 0, errors: 0, responseTime: [], socketConnections: 0,
    messagesProcessed: 0, startTime: Date.now(), agentErrors: 0, agentWarnings: []
};

app.use((req, res, next) => {
    const start = Date.now();
    performanceMetrics.requests++;
    res.on('finish', () => {
        const duration = Date.now() - start;
        performanceMetrics.responseTime.push(duration);
        if (performanceMetrics.responseTime.length > 1000) {
            performanceMetrics.responseTime.shift();
        }
        if (res.statusCode >= 400) {
            performanceMetrics.errors++;
        }
    });
    next();
});

// --- HEALTH CHECK & METRICS ROUTES ---
app.get('/', (req, res) => res.status(200).json({
    message: 'Cartrita backend is alive and operational.',
    version: '2.1.0', environment: NODE_ENV,
    uptime: Math.floor((Date.now() - performanceMetrics.startTime) / 1000)
}));

app.get('/health', async (req, res) => {
    try {
        const dbStart = Date.now();
        await pool.query('SELECT NOW()');
        const dbLatency = Date.now() - dbStart;
        const serviceHealth = await ServiceInitializer.healthCheck();
        const avgResponseTime = performanceMetrics.responseTime.length > 0 ? performanceMetrics.responseTime.reduce((a, b) => a + b, 0) / performanceMetrics.responseTime.length : 0;
        const health = {
            status: performanceMetrics.agentErrors > 0 ? 'degraded' : 'healthy',
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - performanceMetrics.startTime) / 1000),
            database: { status: 'connected', latency: `${dbLatency}ms` },
            services: serviceHealth,
            agents: { errors: performanceMetrics.agentErrors, warnings: performanceMetrics.agentWarnings, status: performanceMetrics.agentErrors > 0 ? 'some_failed' : 'operational' },
            performance: {
                totalRequests: performanceMetrics.requests, totalErrors: performanceMetrics.errors,
                errorRate: performanceMetrics.requests > 0 ? ((performanceMetrics.errors / performanceMetrics.requests) * 100).toFixed(2) + '%' : '0%',
                averageResponseTime: `${Math.round(avgResponseTime)}ms`,
                activeSocketConnections: performanceMetrics.socketConnections,
                messagesProcessed: performanceMetrics.messagesProcessed
            },
            memory: { used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB` }
        };
        res.status(200).json(health);
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString(), error: error.message });
    }
});

app.get('/metrics', (req, res) => {
    const avgResponseTime = performanceMetrics.responseTime.length > 0 ? performanceMetrics.responseTime.reduce((a, b) => a + b, 0) / performanceMetrics.responseTime.length : 0;
    res.json({
        requests_total: performanceMetrics.requests, errors_total: performanceMetrics.errors,
        response_time_avg_ms: Math.round(avgResponseTime),
        socket_connections_active: performanceMetrics.socketConnections,
        messages_processed_total: performanceMetrics.messagesProcessed,
        uptime_seconds: Math.floor((Date.now() - performanceMetrics.startTime) / 1000),
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        agent_errors_total: performanceMetrics.agentErrors,
        agent_warnings_total: performanceMetrics.agentWarnings.length
    });
});

// --- API ROUTE REGISTRATION ---
console.log('[Route Registration] Starting route registration...');
app.use('/api/auth', authRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatHistoryRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/voice-to-text', voiceToTextRoutes);
app.use('/api/voice-chat', voiceChatRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/privacy', privacyRoutes);

// Import and register health routes
import healthRoutes from './src/routes/health.js';
app.use('/api/health', healthRoutes);

console.log('[Route Registration] ✅ All API routes registered.');


// --- ERROR HANDLING & 404 ---
app.use((err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.path}:`, err);
    performanceMetrics.errors++;
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request too large' });
    }
    const errorResponse = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        ...(NODE_ENV === 'development' && { details: err.message, stack: err.stack })
    };
    res.status(500).json(errorResponse);
});

app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// --- SOCKET.IO HANDLING ---
io.of('/').use(authenticateTokenSocket).on('connection', socket => {
    performanceMetrics.socketConnections++;
    console.log(`[Socket.IO] User connected: ${socket.username} (ID: ${socket.id})`);
    
    socket.on('user_message', async payload => {
        performanceMetrics.messagesProcessed++;
        try {
            const text = typeof payload === 'string' ? payload : payload.text;
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                return socket.emit('error', { message: 'Invalid message: text is required' });
            }
            console.log(`[Chat] ${socket.username}: "${text.substring(0, 100)}..."`);
            await pool.query(
                'INSERT INTO conversations (user_id, speaker, text) VALUES ($1, $2, $3)',
                [socket.userId, 'user', text]
            );
            socket.emit('typing', { isTyping: true });
            const response = await coreAgent.generateResponse(text, payload.language || 'en', String(socket.userId));
            
            // Basic validation
            let finalText = (response && typeof response.text === 'string') ? response.text : "I seem to be having trouble thinking right now. Please try again in a moment.";
            
            await pool.query(
                'INSERT INTO conversations (user_id, speaker, text, model, response_time_ms) VALUES ($1, $2, $3, $4, $5)',
                [socket.userId, 'cartrita', finalText, response.model || 'core', response.responseTime]
            );
            socket.emit('typing', { isTyping: false });
            socket.emit('agent_response', { ...response, text: finalText, timestamp: new Date().toISOString() });
        } catch (error) {
            console.error(`[Chat] Error processing message from ${socket.username}:`, error);
            performanceMetrics.errors++;
            socket.emit('typing', { isTyping: false });
            socket.emit('error', { message: 'Failed to process your message. Please try again.' });
        }
    });

    socket.on('disconnect', reason => {
        performanceMetrics.socketConnections--;
        console.log(`[Socket.IO] User disconnected: ${socket.username}, reason: ${reason}`);
    });

    socket.on('error', error => {
        console.error(`[Socket.IO] Socket error for ${socket.username}:`, error);
        performanceMetrics.errors++;
    });
});

io.of('/ambient').use(authenticateTokenSocket).on('connection', socket => {
    console.log(`[Ambient] User connected: ${socket.username}`);
    sensoryService.handleConnection(socket);
});


// --- DATABASE & SERVER LIFECYCLE ---
async function waitForDatabase(maxRetries = 10) {
    console.log('🔄 Waiting for database connection...');
    for (let i = 0; i < maxRetries; i++) {
        try {
            const client = await pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            console.log('✅ Database connection established');
            return;
        } catch (error) {
            console.log(`⏳ Database not ready, retrying... (${maxRetries - i - 1} attempts left)`);
            if (i === maxRetries - 1) throw error;
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}

function handleAgentError(agentName, error) {
    console.error(`⚠️ Agent ${agentName} failed:`, error.message);
    performanceMetrics.agentErrors++;
    performanceMetrics.agentWarnings.push({ agent: agentName, error: error.message, timestamp: new Date().toISOString() });
    if (performanceMetrics.agentWarnings.length > 50) {
        performanceMetrics.agentWarnings.shift();
    }
}

async function startServer() {
    try {
        console.log('🚀 Initializing Cartrita backend...');
        await waitForDatabase();
        
        console.log('🧠 Initializing LangChain Core Agent...');
        await coreAgent.initialize();
        console.log('✅ LangChain Core Agent initialized');

        console.log('🤖 Initializing agent systems...');
        try {
            await initializeAgents();
        } catch (agentError) {
            console.warn('⚠️ Some agents failed to initialize, continuing startup...');
            handleAgentError('AgentSystem', agentError);
        }

        console.log('🔧 Initializing services...');
        try {
            await ServiceInitializer.initializeServices();
        } catch (serviceError) {
            console.warn('⚠️ Some services failed to initialize, but continuing startup...');
            handleAgentError('ServiceInitializer', serviceError);
        }
        
        console.log(performanceMetrics.agentErrors > 0 ? `⚠️ System initialized with ${performanceMetrics.agentErrors} errors (degraded mode)` : '🎉 All systems initialized successfully!');

        server.listen(PORT, () => {
            console.log(`✅ Cartrita backend is live on port ${PORT}`);
            console.log(`🌍 Environment: ${NODE_ENV}`);
            console.log(`🔗 Allowed origins: ${allowedOrigins.join(', ')}`);
            console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Critical startup failure:', error);
        process.exit(1);
    }
}

async function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
    server.close(() => console.log('📡 HTTP server closed'));
    io.close(() => console.log('🔌 Socket.IO server closed'));
    try {
        await ServiceInitializer.cleanup();
    } catch (cleanupError) {
        console.warn('⚠️ Some services failed to cleanup properly:', cleanupError.message);
    }
    await pool.end();
    console.log('🗄️ Database connections closed.');
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', error => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

startServer();
