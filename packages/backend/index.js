// ✅ FIX: This MUST be the absolute first line.
import './src/loadEnv.js';

console.log('[Index] 🚀 Starting Cartrita backend...');

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
import CartritaSupervisorAgent from './src/agi/consciousness/EnhancedLangChainCoreAgent.js';
import ServiceInitializer from './src/services/ServiceInitializer.js';
import Advanced2025MCPInitializer from './src/agi/orchestration/Advanced2025MCPInitializer.js';
import OpenTelemetryTracing from './src/system/OpenTelemetryTracing.js';
import openTelemetryIntegration from './src/opentelemetry/OpenTelemetryIntegrationService.js';
import TelemetryAgent from './src/agi/system/TelemetryAgent.js';
import SensoryProcessingService from './src/system/SensoryProcessingService.js';
const RedisService = {
  async initialize() {
    try {
      const { default: Redis } = await import('./src/services/RedisService.js');
      return await Redis.initialize();
    } catch (error) {
      console.warn(
        '[RedisService] Failed to load Redis service:',
        error.message
      );
      return false;
    }
  },
  async healthCheck() {
    try {
      const { default: Redis } = await import('./src/services/RedisService.js');
      return await Redis.healthCheck();
    } catch (error) {
      return { status: 'error', message: 'Redis service unavailable' };
    }
  },
  async cleanup() {
    try {
      const { default: Redis } = await import('./src/services/RedisService.js');
      return await Redis.cleanup();
    } catch (error) {
      console.warn(
        '[RedisService] Failed to cleanup Redis service:',
        error.message
      );
    }
  },
};
import authenticateTokenSocket from './src/middleware/authenticateTokenSocket.js';
import authenticateToken from './src/middleware/authenticateToken.js';
import socketConfig from './socket-config.js';

// --- ROUTE IMPORTS ---
import authRoutes from './src/routes/auth.js';
import agentRoutes from './src/routes/agent.js';
import userRoutes from './src/routes/user.js';
import chatHistoryRoutes from './src/routes/chatHistory.js';
import workflowRoutes from './src/routes/workflows.js';
import knowledgeRoutes from './src/routes/knowledge.js';
import vaultRoutes from './src/routes/vault.js';
import apiKeyRoutes from './src/routes/apiKeys.js';
import { router as monitoringRoutes } from './src/routes/monitoring.js';
import voiceToTextRoutes from './src/routes/voiceToText.js';
import { router as voiceChatRoutes } from './src/routes/voiceChat.js';
import { router as visionRoutes } from './src/routes/vision.js';
import settingsRoutes from './src/routes/settings.js';
import { router as mcpRoutes } from './src/routes/mcp.js';
import calendarRoutes from './src/routes/calendar.js';
import emailRoutes from './src/routes/email.js';
import contactRoutes from './src/routes/contact.js';
import { router as notificationRoutes } from './src/routes/notifications.js';
import { router as privacyRoutes } from './src/routes/privacy.js';
import hierarchyRoutes from './src/routes/hierarchy.js';
import healthRoutes from './src/routes/health.js';
import iteration22Routes from './src/routes/iteration22.js';
import workflowToolsRoutes from './src/routes/workflowTools.js';
import fineTuningRoutes from './src/routes/fineTuningRoutes.js';
import huggingfaceRoutes from './src/integrations/huggingface/routes/huggingfaceRoutes.js';

// --- CONFIGURATION ---
const PORT = process.env.PORT || 8001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// --- SINGLETON AGENT & SERVICE INITIALIZATION ---
const coreAgent = new CartritaSupervisorAgent();
const sensoryService = new SensoryProcessingService(coreAgent);
let advanced2025Orchestrator = null;

// --- APP & SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// --- MIDDLEWARE SETUP ---
app.use(
  helmet({
    contentSecurityPolicy: NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === 'production' ? 1000 : 5000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
// Temporarily disable rate limiting for development
// app.use('/api/', limiter);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : []),
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  if (NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  if (
    ['POST', 'PUT', 'PATCH'].includes(req.method) &&
    !req.is('application/json') &&
    !req.is('multipart/form-data') &&
    !req.is('application/x-www-form-urlencoded')
  ) {
    return res
      .status(400)
      .json({ error: 'Invalid content-type. Expected application/json' });
  }
  next();
});

// --- SOCKET.IO SETUP ---
const io = new Server(server, {
  ...socketConfig,
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// --- PERFORMANCE MONITORING ---
const performanceMetrics = {
  requests: 0,
  errors: 0,
  responseTime: [],
  socketConnections: 0,
  messagesProcessed: 0,
  startTime: Date.now(),
  agentErrors: 0,
  agentWarnings: [],
};

app.use((req, res, next) => {
  const start = Date.now();
  performanceMetrics.requests++;
  res.on('finish', () => {
    const duration = Date.now() - start;
    performanceMetrics.responseTime.push(duration);
    if (performanceMetrics.responseTime.length > 1000)
      performanceMetrics.responseTime.shift();
    if (res.statusCode >= 400) performanceMetrics.errors++;
  });
  next();
});

// --- HEALTH CHECK & METRICS ROUTES ---
app.get('/', (req, res) =>
  res.status(200).json({
    message: 'Cartrita backend is alive and operational.',
    version: '2.1.0',
    environment: NODE_ENV,
    uptime: Math.floor((Date.now() - performanceMetrics.startTime) / 1000),
  })
);

app.get('/health', async (req, res) => {
  // ... (health check logic remains the same)
});

app.get('/metrics', (req, res) => {
  // ... (metrics logic remains the same)
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
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/iteration22', iteration22Routes);
app.use('/api/workflow-tools', workflowToolsRoutes);
app.use('/api/fine-tuning', fineTuningRoutes);
app.use('/api/huggingface', huggingfaceRoutes);
console.log('[Route Registration] ✅ All API routes registered.');

// --- DELETED a large block of code from here (the old SOCKET.IO HANDLING) ---

// ✅ --- NEW CODE STARTS HERE ---

/**
 * Attaches the event handlers for Socket.IO connections.
 * This should only be called after all core services and agents are initialized.
 */
function setupSocketHandlers() {
  console.log('🔌 Setting up Socket.IO event handlers...');

  io.of('/')
    .use(authenticateTokenSocket)
    .on('connection', socket => {
      performanceMetrics.socketConnections++;
      console.log(
        `[Socket.IO] User connected: ${socket.username} (ID: ${socket.id})`
      );

      socket.on('user_message', async payload => {
        performanceMetrics.messagesProcessed++;
        try {
          // SAFETY CHECK: Politely reject messages if the agent isn't ready.
          if (!coreAgent.isInitialized) {
            console.warn(
              '[Chat] Message received before agent was fully initialized. Politely declining.'
            );
            return socket.emit('error', {
              message:
                'Cartrita is still starting up. Please try again in a moment.',
            });
          }

          if (!socket.userId) {
            return socket.emit('error', { message: 'Authentication required' });
          }

          const text = typeof payload === 'string' ? payload : payload.text;
          if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return socket.emit('error', {
              message: 'Invalid message: text is required',
            });
          }
          console.log(
            `[Chat] ${socket.username}: "${text.substring(0, 100)}..."`
          );

          // Start comprehensive user interaction tracing
          const response = await OpenTelemetryTracing.traceUserInteraction(
            socket.userId,
            text,
            async span => {
              // Get or create conversation
              let conversationResult = await pool.query(
                'SELECT id FROM conversations WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1',
                [socket.userId]
              );
              
              let conversationId;
              if (conversationResult.rows.length === 0) {
                // Create new conversation
                const newConversation = await pool.query(
                  'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
                  [socket.userId, 'Chat Session']
                );
                conversationId = newConversation.rows[0].id;
              } else {
                conversationId = conversationResult.rows[0].id;
              }

              // Record user message in database
              await pool.query(
                'INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                [conversationId, 'user', text]
              );

              // Emit typing indicator
              socket.emit('typing', { isTyping: true });

              // Generate response with advanced tracing
              span.setAttributes({
                'user.message.length': text.length,
                'user.language': payload.language || 'en',
                'system.version': '2025-mcp',
              });

              return await coreAgent.generateResponse(
                text,
                payload.language || 'en',
                String(socket.userId)
              );
            }
          );

          let finalText =
            response && typeof response.text === 'string'
              ? response.text
              : 'I seem to be having trouble thinking right now. Please try again in a moment.';

          if (socket.userId) {
            // Get the conversation ID (should be the same one from above)
            const conversationResult = await pool.query(
              'SELECT id FROM conversations WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1',
              [socket.userId]
            );
            
            if (conversationResult.rows.length > 0) {
              const conversationId = conversationResult.rows[0].id;
              // Save assistant response with metadata
              const metadata = {
                model: response.model || 'core',
                response_time_ms: response.responseTime,
                tools_used: response.tools_used || [],
                intent_analysis: response.intent_analysis,
                performance_score: response.performance_score
              };
              
              await pool.query(
                'INSERT INTO conversation_messages (conversation_id, role, content, metadata) VALUES ($1, $2, $3, $4)',
                [conversationId, 'assistant', finalText, JSON.stringify(metadata)]
              );
              
              // Update conversation timestamp
              await pool.query(
                'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
                [conversationId]
              );
            }
          }
          socket.emit('typing', { isTyping: false });
          socket.emit('agent_response', {
            ...response,
            text: finalText,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error(
            `[Chat] Error processing message from ${socket.username}:`,
            error
          );
          performanceMetrics.errors++;
          socket.emit('typing', { isTyping: false });
          socket.emit('error', {
            message: 'Failed to process your message. Please try again.',
          });
        }
      });

      socket.on('disconnect', reason => {
        performanceMetrics.socketConnections--;
        console.log(
          `[Socket.IO] User disconnected: ${socket.username}, reason: ${reason}`
        );
      });

      socket.on('error', error => {
        console.error(
          `[Socket.IO] Socket error for ${socket.username}:`,
          error
        );
        performanceMetrics.errors++;
      });
    });

  io.of('/ambient')
    .use(authenticateTokenSocket)
    .on('connection', socket => {
      console.log(`[Ambient] User connected: ${socket.username}`);
      sensoryService.handleConnection(socket);
    });

  console.log('✅ Socket.IO event handlers are now active.');
}

// --- DATABASE & SERVER LIFECYCLE ---
async function waitForDatabase(maxRetries = 10) {
  // ... (waitForDatabase logic remains the same)
}

function handleAgentError(agentName, error) {
  // ... (handleAgentError logic remains the same)
}

async function startServer() {
  try {
    console.log('🚀 Initializing Cartrita backend...');
    
    // Initialize Integrated OpenTelemetry Service with upstream components merged
    console.log('📊 Initializing Complete OpenTelemetry Integration with merged upstream components...');
    try {
      const integrationResult = await openTelemetryIntegration.initialize();
      if (integrationResult) {
        global.openTelemetryIntegration = openTelemetryIntegration; // Store globally for shutdown
        console.log('✅ Complete OpenTelemetry integration initialized successfully');
      } else {
        console.warn('⚠️ OpenTelemetry integration failed, continuing with basic service');
      }
    } catch (error) {
      console.warn('⚠️ OpenTelemetry integration error:', error.message);
      console.log('✅ Using basic OpenTelemetryTracing class as fallback');
    }
    
    await waitForDatabase();
    console.log('🔴 Initializing Redis cache...');
    const redisInitialized = await RedisService.initialize();
    if (redisInitialized) {
      console.log('✅ Redis cache initialized');
    } else {
      console.warn('⚠️ Redis initialization failed, continuing without cache');
    }
    console.log('🧠 Initializing Hierarchical Supervisor Agent...');
    await coreAgent.initialize();
    console.log('✅ Hierarchical Supervisor Agent initialized');

    console.log('🔧 Initializing services...');
    try {
      await ServiceInitializer.initializeServices();
    } catch (serviceError) {
      console.warn(
        '⚠️ Some services failed to initialize, but continuing startup...'
      );
      handleAgentError('ServiceInitializer', serviceError);

      console.log('🌟 Initializing Advanced 2025 MCP Orchestrator...');
      try {
        advanced2025Orchestrator =
          await Advanced2025MCPInitializer.initialize();
        console.log(
          '✅ Advanced 2025 MCP Orchestrator initialized with cutting-edge features'
        );
      } catch (mcpError) {
        console.warn(
          '⚠️ Advanced 2025 MCP initialization failed, continuing with fallback...'
        );
        handleAgentError('Advanced2025MCPOrchestrator', mcpError);
      }

      // Initialize new MCP System with full infrastructure
      console.log('🎛️  Initializing Hierarchical MCP System...');
      try {
        const { mcpSystem } = await import('./src/mcp/mcp-integration.js');
        
        // Get Redis client if available
        let redisClient = null;
        try {
          const { default: Redis } = await import('./src/services/RedisService.js');
          redisClient = Redis.client;
        } catch (redisError) {
          console.warn('[MCP] Redis service not available');
        }

        await mcpSystem.initialize(
          {
            coreAgent,
            researcherAgent: coreAgent.agents?.researcherAgent,
            writerAgent: coreAgent.agents?.writerAgent,
            codeWriterAgent: coreAgent.agents?.codeWriterAgent,
            analyticsAgent: coreAgent.agents?.analyticsAgent,
            multiModalFusionAgent: coreAgent.agents?.multiModalFusionAgent,
          },
          pool, // PostgreSQL connection pool
          redisClient // Redis client
        );
        console.log('✅ Hierarchical MCP System initialized successfully');
        global.mcpSystem = mcpSystem;
      } catch (mcpSystemError) {
        console.warn('⚠️ MCP System initialization failed, continuing...');
        handleAgentError('MCPSystem', mcpSystemError);
      }
    }

    // --- ✅ MODIFICATION IS HERE ---
    // Call the new function to attach socket handlers only AFTER initialization.
    setupSocketHandlers();
    console.log(
      performanceMetrics.agentErrors > 0
        ? `⚠️ System initialized with ${performanceMetrics.agentErrors} errors (degraded mode)`
        : '🎉 All systems initialized successfully!'
    );

    server.listen(PORT, () => {
      console.log(`✅ Cartrita backend is live on port ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 Allowed origins: ${allowedOrigins.join(', ')}`);
      console.log(
        `📊 Health check available at: http://localhost:${PORT}/health`
      );
    });
  } catch (error) {
    console.error('❌ Critical startup failure:', error);
    process.exit(1);
  }
}

// --- ERROR HANDLING & 404 --- (This section is moved down to group with other process handlers)
app.use((err, req, res, next) => {
  // ... (error handling logic remains the same)
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// --- PROCESS LIFECYCLE & GRACEFUL SHUTDOWN ---
async function gracefulShutdown(signal) {
  console.log(`🔄 Graceful shutdown initiated (${signal})`);

  try {
    // Shutdown Integrated OpenTelemetry Service first
    console.log('📊 Shutting down OpenTelemetry Integration...');
    if (global.openTelemetryIntegration) {
      await global.openTelemetryIntegration.shutdown();
    }
    console.log('✅ OpenTelemetry shutdown complete');

    // Shutdown Advanced 2025 MCP Orchestrator
    if (advanced2025Orchestrator) {
      console.log('🌟 Shutting down Advanced 2025 MCP Orchestrator...');
      await Advanced2025MCPInitializer.shutdown();
      console.log('✅ Advanced 2025 MCP Orchestrator shutdown complete');
    }

    // Shutdown MCP System
    if (global.mcpSystem) {
      console.log('🎛️  Shutting down Hierarchical MCP System...');
      await global.mcpSystem.shutdown();
      console.log('✅ Hierarchical MCP System shutdown complete');
    }

    // Cleanup Redis connection
    console.log('🔴 Cleaning up Redis connection...');
    await RedisService.cleanup();

    // Close database connections
    console.log('🗄️ Closing database connections...');
    await pool.end();

    // Close the server
    console.log('🔌 Closing HTTP server...');
    server.close(() => {
      console.log('✅ Cartrita backend shutdown complete');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
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

// --- START THE APPLICATION ---
startServer();
