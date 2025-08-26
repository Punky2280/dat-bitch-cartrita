/* 
 * Cartrita V2 Server - Revolutionized Architecture
 * Built following Copilot Project Instructions and V2 Migration Guide
 * Date: August 19, 2025
 * Branch: refactor/cartrita-branding
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { body, validationResult, param, query } from 'express-validator';
import crypto from 'crypto';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import './db.js';

// V2 Architecture: Centralized imports
import { CartritaV2RouterRegistry } from './v2/routers/RouterRegistry.js';
import { CartritaV2Middleware } from './v2/middleware/index.js';
import { CartritaV2ResponseFormatter } from './v2/utils/ResponseFormatter.js';
import { CartritaV2ErrorHandler } from './v2/utils/ErrorHandler.js';
import { traceOperation } from './system/OpenTelemetryTracing.js';
import authenticateToken from './middleware/authenticateToken.js';

// Domain-specific route imports
import systemRoutes from './v2/routes/system.js';
import securityRoutes from './v2/routes/security.js';
import knowledgeRoutes from './v2/routes/knowledge.js';
import aiRoutes from './v2/routes/ai.js';
import unifiedRoutes from './v2/routes/unified.js';
import huggingfaceRoutes from './v2/routes/huggingface.js';
import communicationRoutes from './v2/routes/communication.js';
import agentsRoutes from './v2/routes/agents.js';
import lifeosRoutes from './v2/routes/lifeos.js';
import settingsRoutes from './v2/routes/settings.js';
import modelsRoutes from './v2/routes/models.js';

// Legacy V1 routes (for compatibility)
import legacyRoutes from './routes/legacy.js';

// Core services initialization
import coreAgent from './agi/consciousness/CoreAgent.js';
import { createUnifiedInferenceService } from './services/unifiedInference.js';
import AIHubService from './services/AIHubService.js';

console.log('🚀 [Cartrita V2] Initializing revolutionized server architecture...');

// Initialize unified inference service
const unifiedAI = createUnifiedInferenceService();

// V2 Application Configuration
const V2_CONFIG = {
  apiVersion: 'v2',
  serviceName: 'cartrita-backend',
  environment: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8001,
  corsOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    ...(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
  ],
  rateLimits: {
    general: { windowMs: 15 * 60 * 1000, max: 1000 },
    auth: { windowMs: 15 * 60 * 1000, max: 10 },
    api: { windowMs: 60 * 1000, max: 100 },
  }
};

// V2 Public endpoints (no authentication required)
const V2_PUBLIC_ENDPOINTS = [
  // Authentication
  '/api/auth/register',
  '/api/auth/login', 
  '/api/auth/verify',
  
  // System health (both V1 and V2)
  '/health',
  '/api/health',
  '/api/v2/system/health',
  '/api/v2/system/health/detailed',
  '/api/v2/system/metrics',
  '/api/v2/system/rotation-test',
  
  // AI Services (public endpoints)
  '/api/v2/ai/providers',
  '/api/v2/ai/health',
  '/api/v2/unified/health',
  '/api/v2/unified/metrics',
  '/api/v2/huggingface/health',
  '/api/v2/huggingface/capabilities',
  '/api/v2/huggingface/test',
  '/api/v2/huggingface/status',
  '/api/v2/huggingface/models',
  
  // Knowledge (public health check)
  '/api/v2/knowledge/health',
  
  // Communication status (public)
  '/api/v2/communication/email/status',
  '/api/v2/communication/calendar/status', 
  '/api/v2/communication/contacts/status',
  
  // Legacy V1 endpoints (maintained for compatibility)
  '/api/health/system',
  '/api/system/metrics',
  '/api/system/health',
  '/api/huggingface/health',
  '/api/huggingface/capabilities',
  '/api/huggingface/test',
  '/api/huggingface/status',
  '/api/huggingface/models',
  '/api/knowledge/health',
  '/api/ai/providers',
  '/api/ai/health',
  '/api/unified/health',
  '/api/unified/metrics',
  '/api/email/status',
  '/api/calendar/status',
  '/api/contacts/status',
];

const app = express();

// ============================================================================
// V2 MIDDLEWARE STACK
// ============================================================================

// Security middleware (enhanced for V2)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// V2 Enhanced CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || V2_CONFIG.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-API-Version',
      'X-Request-ID',
    ],
    maxAge: 600,
  })
);

// Body parsing with V2 enhancements
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf, encoding) => {
    // Add raw body for signature verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

// V2 Enhanced logging with request tracing
app.use(morgan('combined', {
  format: ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
  skip: (req, res) => req.url.includes('/health') && res.statusCode < 400
}));

// V2 Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || `v2_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-API-Version', 'v2');
  res.setHeader('X-Service', 'cartrita-backend');
  next();
});

// V2 Rate limiting with domain-specific rules
const createV2RateLimit = (options) => rateLimit({
  ...V2_CONFIG.rateLimits.general,
  ...options,
  message: CartritaV2ResponseFormatter.error(
    'Rate limit exceeded. Please try again later.',
    429,
    {
      retry_after: Math.ceil(options.windowMs / 1000) || 900,
      api_version: 'v2'
    }
  ),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}_${req.path.split('/')[3] || 'general'}`, // Domain-based keys
});

// Apply general rate limiting
app.use(createV2RateLimit(V2_CONFIG.rateLimits.general));

// V2 Authentication rate limiting
app.use('/api/v2/auth/login', createV2RateLimit(V2_CONFIG.rateLimits.auth));
app.use('/api/v2/auth/register', createV2RateLimit(V2_CONFIG.rateLimits.auth));

// Legacy auth rate limiting
app.use('/api/auth/login', createV2RateLimit(V2_CONFIG.rateLimits.auth));
app.use('/api/auth/register', createV2RateLimit(V2_CONFIG.rateLimits.auth));

// ============================================================================
// V2 CORE ENDPOINTS (Root Level)
// ============================================================================

// Root health endpoint (version-neutral)
app.get('/health', (req, res) => {
  const span = traceOperation('system.health.root');
  try {
    res.json(CartritaV2ResponseFormatter.success({
      status: 'healthy',
      service: V2_CONFIG.serviceName,
      version: V2_CONFIG.apiVersion,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: V2_CONFIG.environment
    }, {
      domain: 'system',
      request_id: req.requestId
    }));
  } finally {
    span?.end();
  }
});

// Legacy V1 health endpoint (compatibility)
app.get('/api/health', (req, res) => {
  const span = traceOperation('system.health.legacy');
  try {
    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'cartrita-backend',
    });
  } finally {
    span?.end();
  }
});

// ============================================================================
// V2 AUTHENTICATION MIDDLEWARE
// ============================================================================

// V2 Authentication gate with enhanced logging
app.use((req, res, next) => {
  const { path: requestPath } = req;
  
  // Check if endpoint is public
  const isPublic = V2_PUBLIC_ENDPOINTS.some(publicPath => 
    requestPath === publicPath || requestPath.startsWith(publicPath)
  );
  
  if (isPublic) {
    console.log(`[V2 Auth] ✅ Public endpoint: ${requestPath}`);
    return next();
  }
  
  // Require authentication for all other /api/* endpoints
  if (requestPath.startsWith('/api/')) {
    console.log(`[V2 Auth] 🔐 Protected endpoint: ${requestPath}`);
    return authenticateToken(req, res, next);
  }
  
  // Non-API routes pass through
  return next();
});

// ============================================================================
// V2 DOMAIN ROUTE REGISTRATION
// ============================================================================

console.log('[V2 Routes] 🔧 Registering domain-based V2 routes...');

// V2 System Domain
app.use('/api/v2/system', systemRoutes);
console.log('[V2 Routes] ✅ /api/v2/system/* registered');

// V2 Security Domain
app.use('/api/v2/security', securityRoutes);
console.log('[V2 Routes] ✅ /api/v2/security/* registered');

// V2 Knowledge Domain  
app.use('/api/v2/knowledge', knowledgeRoutes);
console.log('[V2 Routes] ✅ /api/v2/knowledge/* registered');

// V2 AI Domain
app.use('/api/v2/ai', aiRoutes);
console.log('[V2 Routes] ✅ /api/v2/ai/* registered');

// V2 Unified AI Domain
app.use('/api/v2/unified', unifiedRoutes);
console.log('[V2 Routes] ✅ /api/v2/unified/* registered');

// V2 HuggingFace Domain
app.use('/api/v2/huggingface', huggingfaceRoutes);
console.log('[V2 Routes] ✅ /api/v2/huggingface/* registered');

// V2 Communication Domain
app.use('/api/v2/communication', communicationRoutes);
console.log('[V2 Routes] ✅ /api/v2/communication/* registered');

// V2 Agents Domain
app.use('/api/v2/agents', agentsRoutes);
console.log('[V2 Routes] ✅ /api/v2/agents/* registered');

// V2 Life OS Domain
app.use('/api/v2/lifeos', lifeosRoutes);
console.log('[V2 Routes] ✅ /api/v2/lifeos/* registered');

// V2 Settings Domain
app.use('/api/v2/settings', settingsRoutes);
console.log('[V2 Routes] ✅ /api/v2/settings/* registered');

// V2 Models Domain
app.use('/api/v2/models', modelsRoutes);
console.log('[V2 Routes] ✅ /api/v2/models/* registered');

// ============================================================================
// LEGACY V1 ROUTE COMPATIBILITY
// ============================================================================

console.log('[V1 Routes] 🔧 Registering legacy V1 compatibility routes...');

// Import and mount all existing V1 routes with compatibility layer
import chatHistoryRoutes from './routes/chatHistory.js';
import workflowsRoutes from './routes/workflows.js';
import personalLifeOSRoutes from './routes/personalLifeOS.js';
import voiceToTextRoutes from './routes/voiceToText.js';
import registryStatusRoutes from './routes/registryStatus.js';
import authRoutes from './routes/auth.js';
import rotationSchedulingRoutes from './routes/rotationScheduling.js';
import knowledgeHubRoutes from './routes/knowledgeHub.js';
import { router as aiEnhancedRoutes } from './routes/aiEnhanced.js';
import analyticsRoutes from './routes/analytics.js';
import settingsRoutesV1 from './routes/settings.js';
import routerRoutes from './routes/router.js';
import aiHubRoutes from './routes/ai-hub.js';
import dashboardRoutes from './routes/dashboard.js';
import securityRoutesV1 from './routes/securityIntegrations.js';
import testRoutes from './routes/test.js';
import workflowTemplatesRoutes from './routes/workflowTemplates.js';
import systemMetricsRoutes from './routes/systemMetrics.js';
import validationRoutes from './routes/validation.js';
import cameraVisionTestingRoutes from './routes/cameraVisionTesting.js';

// Legacy V1 routes (with deprecation headers)
const addDeprecationHeader = (req, res, next) => {
  res.setHeader('X-API-Deprecation', 'This V1 endpoint is deprecated. Please migrate to /api/v2/*');
  res.setHeader('X-Sunset-Date', '2025-12-31');
  next();
};

app.use('/api/chat', addDeprecationHeader, chatHistoryRoutes);
app.use('/api/auth', authRoutes); // No deprecation for auth (special case)
app.use('/api/workflows', addDeprecationHeader, workflowsRoutes);
app.use('/api/analytics', addDeprecationHeader, analyticsRoutes);
app.use('/api/settings', addDeprecationHeader, settingsRoutesV1);
app.use('/api/workflow-templates', addDeprecationHeader, workflowTemplatesRoutes);
app.use('/api/personal-life-os', addDeprecationHeader, personalLifeOSRoutes);
app.use('/api/voice', addDeprecationHeader, voiceToTextRoutes);
app.use('/api/rotation-scheduling', addDeprecationHeader, rotationSchedulingRoutes);
app.use('/api/internal/registry', registryStatusRoutes);
app.use('/api/knowledge', addDeprecationHeader, knowledgeHubRoutes);
app.use('/api/ai', addDeprecationHeader, aiEnhancedRoutes);
app.use('/api/router', addDeprecationHeader, routerRoutes);
app.use('/api/ai-hub', addDeprecationHeader, aiHubRoutes);
app.use('/api/dashboard', addDeprecationHeader, dashboardRoutes);
app.use('/api/security', addDeprecationHeader, securityRoutesV1);
app.use('/api/test', testRoutes);
app.use('/api/system', addDeprecationHeader, systemMetricsRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/camera-testing', cameraVisionTestingRoutes);

console.log('[V1 Routes] ✅ Legacy V1 compatibility routes registered with deprecation headers');

// ============================================================================
// V2 INLINE ENDPOINTS (Direct Implementation)
// ============================================================================

// V2 System test endpoint
app.get('/api/v2/system/rotation-test', authenticateToken, async (req, res) => {
  const span = traceOperation('v2.system.rotation_test');
  try {
    const { default: RotationSchedulingService } = await import('./services/RotationSchedulingService.js');
    const policies = await RotationSchedulingService.getRotationPolicies(req.user.id);
    
    res.json(CartritaV2ResponseFormatter.success({
      message: 'V2 Rotation service operational',
      policies_count: policies.length,
      test_result: 'passed',
      rotation_status: 'healthy'
    }, {
      domain: 'system',
      request_id: req.requestId,
      test_type: 'rotation_policy'
    }));
  } catch (error) {
    console.error('[V2 System] Rotation test failed:', error);
    res.status(500).json(CartritaV2ResponseFormatter.error(
      'Rotation test failed',
      500,
      { domain: 'system', error_type: 'SERVICE_ERROR', request_id: req.requestId }
    ));
  } finally {
    span?.end();
  }
});

// Legacy V1 rotation test (compatibility)
app.get('/api/rotation-test', authenticateToken, async (req, res) => {
  try {
    const { default: RotationSchedulingService } = await import('./services/RotationSchedulingService.js');
    const policies = await RotationSchedulingService.getRotationPolicies(req.user.id);
    res.json({
      success: true,
      message: 'Rotation service working',
      policies_count: policies.length,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      stack: error.stack 
    });
  }
});

// ============================================================================
// V2 ERROR HANDLING
// ============================================================================

// V2 404 Handler
app.use('*', (req, res) => {
  const isV2Endpoint = req.originalUrl.startsWith('/api/v2/');
  
  if (isV2Endpoint) {
    res.status(404).json(CartritaV2ResponseFormatter.error(
      'V2 Endpoint not found',
      404,
      {
        requested_path: req.originalUrl,
        method: req.method,
        suggestion: 'Check V2 API documentation for available endpoints',
        api_version: 'v2',
        request_id: req.requestId
      }
    ));
  } else {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.originalUrl,
      suggestion: 'Consider migrating to V2 API (/api/v2/*)'
    });
  }
});

// V2 Global Error Handler
app.use(CartritaV2ErrorHandler.middleware());

// ============================================================================
// V2 SERVER INITIALIZATION
// ============================================================================

let server = null;
let io = null;

if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  console.log('[V2 Server] 🚀 Initializing HTTP server and WebSocket...');
  
  server = http.createServer(app);
  
  // V2 Enhanced WebSocket with better error handling
  io = new SocketIOServer(server, {
    cors: {
      origin: V2_CONFIG.corsOrigins,
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true
  });

  io.on('connection', (socket) => {
    console.log(`[V2 WebSocket] ✅ Client connected: ${socket.id}`);
    
    socket.emit('connected', {
      socketId: socket.id,
      apiVersion: 'v2',
      timestamp: new Date().toISOString(),
      capabilities: ['chat', 'real_time_updates', 'agent_communication']
    });

    // V2 Enhanced message handling with tracing
    socket.on('user_message', async (data) => {
      const span = traceOperation('v2.websocket.user_message');
      
      try {
        console.log(`[V2 WebSocket] 📨 Message from ${socket.id}:`, data.text?.substring(0, 100) + '...');
        
        // Enhanced typing indicator
        socket.emit('typing', { 
          agent: 'cartrita', 
          status: 'processing',
          timestamp: new Date().toISOString()
        });

        // Initialize core agent if needed
        if (!coreAgent.isInitialized) {
          console.log('[V2 WebSocket] 🔧 Initializing core agent...');
          await coreAgent.initialize();
        }

        // Generate V2 response
        const response = await coreAgent.generateResponse(
          data.text,
          data.language || 'en',
          socket.id,
          { apiVersion: 'v2', requestId: `ws_${Date.now()}` }
        );

        // Stop typing and send V2 formatted response
        socket.emit('stopTyping');
        socket.emit('agent_response', {
          text: response?.text || response || 'I apologize, but I encountered an issue processing your request.',
          timestamp: new Date().toISOString(),
          speaker: 'cartrita',
          model: response?.model || 'gpt-4o',
          tools_used: response?.tools_used || [],
          response_time_ms: response?.response_time_ms,
          request_id: response?.request_id,
          api_version: 'v2',
          confidence: response?.confidence || 0.95
        });
        
        span?.setAttributes({
          'websocket.message_length': data.text?.length || 0,
          'websocket.response_time': response?.response_time_ms || 0,
          'websocket.success': true
        });
        
      } catch (error) {
        console.error('[V2 WebSocket] ❌ Message processing error:', error);
        socket.emit('stopTyping');
        socket.emit('agent_response', {
          text: 'I apologize, but I encountered a technical issue. Please try again.',
          timestamp: new Date().toISOString(),
          speaker: 'cartrita',
          error: true,
          api_version: 'v2',
          error_type: 'PROCESSING_ERROR'
        });
        
        span?.setAttributes({
          'websocket.error': true,
          'websocket.error_message': error.message
        });
      } finally {
        span?.end();
      }
    });

    // V2 Enhanced ping/pong with latency tracking
    socket.on('ping', (startTime) => {
      const latency = Date.now() - (startTime || Date.now());
      socket.emit('pong', { 
        startTime, 
        serverTime: Date.now(), 
        latency,
        apiVersion: 'v2'
      });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[V2 WebSocket] 👋 Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  // Start V2 server
  server.listen(V2_CONFIG.port, () => {
    console.log('🎉 ============================================');
    console.log(`🚀 Cartrita V2 Server Successfully Started!`);
    console.log(`📡 Port: ${V2_CONFIG.port}`);
    console.log(`🌍 Environment: ${V2_CONFIG.environment}`);
    console.log(`📊 API Version: ${V2_CONFIG.apiVersion}`);
    console.log(`🔐 Authentication: JWT`);
    console.log(`🛡️  Rate Limiting: Enabled`);
    console.log(`📝 Request Tracing: Enabled`);
    console.log(`🔌 WebSocket: Enabled`);
    console.log(`📋 V2 Domains: 11 domains registered`);
    console.log(`🔄 V1 Compatibility: Enabled with deprecation headers`);
    console.log('============================================');
  });
  
  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('[V2 Server] 🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('[V2 Server] ✅ Server closed successfully');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[V2 Server] 🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('[V2 Server] ✅ Server closed successfully');
      process.exit(0);
    });
  });
}

// ============================================================================
// V2 EXPORTS
// ============================================================================

export default app;
export { server, io, V2_CONFIG };