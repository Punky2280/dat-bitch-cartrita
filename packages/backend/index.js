console.log('[Index] 🚀 Starting Cartrita backend...');

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');

console.log('[Index] 🚀 Loading route modules...');

const authRoutes = require('./src/routes/auth');
console.log('[Index] ✅ Auth routes loaded');

let userRoutes;
try {
  userRoutes = require('./src/routes/user');
  console.log('[Index] ✅ User routes loaded successfully');
} catch (error) {
  console.error('[Index] ❌ Error loading user routes:', error);
  userRoutes = require('express').Router(); // fallback empty router
}

const chatHistoryRoutes = require('./src/routes/chatHistory');
console.log('[Index] ✅ Chat history routes loaded');
const workflowRoutes = require('./src/routes/workflows');
const knowledgeRoutes = require('./src/routes/knowledge');
console.log('[Index] ✅ Knowledge routes loaded');
const vaultRoutes = require('./src/routes/vault');
console.log('[Index] ✅ Vault routes loaded');
const apiKeyRoutes = require('./src/routes/apiKeys');
const monitoringRoutes = require('./src/routes/monitoring');
const voiceToTextRoutes = require('./src/routes/voiceToText');
const voiceChatRoutes = require('./src/routes/voiceChat');
const visionRoutes = require('./src/routes/vision');
const settingsRoutes = require('./src/routes/settings');
const mcpRoutes = require('./src/routes/mcp');
const calendarRoutes = require('./src/routes/calendar');
const emailRoutes = require('./src/routes/email');
const contactRoutes = require('./src/routes/contact');
const notificationRoutes = require('./src/routes/notifications');
const privacyRoutes = require('./src/routes/privacy');
const { router: agentRoutes, injectIO } = require('./src/routes/agent'); // ✅ Updated import

// Initialize Cartrita Iteration 21 services
const ServiceInitializer = require('./src/services/ServiceInitializer');

const authenticateTokenSocket = require('./src/middleware/authenticateTokenSocket');
const EnhancedCoreAgent = require('./src/agi/consciousness/EnhancedCoreAgent');
const initializeAgents = require('./src/agi/agentInitializer');
const SensoryProcessingService = require('./src/system/SensoryProcessingService');
const MessageBus = require('./src/system/EnhancedMessageBus');
const NotificationEngine = require('./src/services/NotificationEngine');
const PrivacyControlService = require('./src/services/PrivacyControlService');

const app = express();
const server = http.createServer(app);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const allowedOrigins = [
  'http://localhost:5173', 
  'http://127.0.0.1:5173',
  'http://localhost:5174', 
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
};

const io = new Server(server, { 
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});
injectIO(io); // ✅ Inject Socket.IO into /agent/message

const coreAgent = new EnhancedCoreAgent();
const sensoryService = new SensoryProcessingService(coreAgent);

initializeAgents();
app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) =>
  res.status(200).json({ message: 'Cartrita backend is alive and kicking.' })
);

// Test direct route to verify Express routing is working
app.get('/api/test-direct', (req, res) => {
  console.log('[Index] 🧪 Direct test route hit');
  res.json({ message: 'Direct route working', timestamp: new Date().toISOString() });
});

console.log('[Index] 🚀 Starting route registration...');

app.use('/api/auth', authRoutes);
console.log('[Index] ✅ Auth routes registered at /api/auth');

app.use('/api/user', userRoutes);
console.log('[Index] ✅ User routes registered at /api/user');

app.use('/api/chat', chatHistoryRoutes);
console.log('[Index] ✅ Chat routes registered at /api/chat');
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
console.log('[Index] ✅ MCP routes registered at /api/mcp');
console.log('[Index] ✅ Voice chat routes registered at /api/voice-chat');
console.log('[Index] ✅ Vision routes registered at /api/vision');
console.log('[Index] ✅ Calendar routes registered at /api/calendar');
console.log('[Index] ✅ Email routes registered at /api/email');
console.log('[Index] ✅ Contact routes registered at /api/contacts');
console.log('[Index] ✅ Notification routes registered at /api/notifications');
console.log('[Index] ✅ Privacy routes registered at /api/privacy');

app.use('/agent', agentRoutes); // ✅ Now emits responses via WebSocket

const chatNamespace = io.of('/');
chatNamespace.use(authenticateTokenSocket);
chatNamespace.on('connection', socket => {
  console.log(`[Socket.IO] User connected: ${socket.user.name}`);

  const handleChatMessage = async payload => {
    const text = typeof payload === 'string' ? payload : payload.text;
    const lang = typeof payload === 'string' ? 'en' : payload.language || 'en';
    if (!text) return;

    try {
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text) VALUES ($1, $2, $3)',
        [socket.user.id, 'user', text]
      );

      const res = await coreAgent.generateResponse(
        text,
        lang,
socket.user.id
      );

      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text, model) VALUES ($1, $2, $3, $4)',
        [socket.user.id, 'cartrita', res.text, res.model]
      );

      socket.emit('chat message', res);
    } catch (e) {
      console.error('Chat processing error:', e);
      socket.emit('error', { message: 'Failed to process message' });
    }
  };

  socket.on('chat message', handleChatMessage);
  socket.on('message', handleChatMessage);

  // Handle ping/pong for latency monitoring
  socket.on('ping', startTime => {
    socket.emit('pong', startTime);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] User disconnected: ${socket.user.name}`);
  });
});

const ambientNamespace = io.of('/ambient');
ambientNamespace.use(authenticateTokenSocket);
ambientNamespace.on('connection', socket => {
  sensoryService.handleConnection(socket);
});

MessageBus.on('proactive:response', async ({ userId, response }) => {
  const sockets = await chatNamespace.fetchSockets();
  const userSocket = sockets.find(s => s.user.id === userId);

  if (userSocket) {
    userSocket.emit('chat message', response);
    await pool.query(
      'INSERT INTO conversations (user_id, speaker, text, model) VALUES ($1, $2, $3, $4)',
      [userId, 'cartrita', response.text, response.model]
    );
  }
});

// Service status and health routes
app.get('/api/status', (req, res) => {
  const status = ServiceInitializer.getServiceStatus();
  res.json({
    message: 'Dat Bitch Cartrita API is running!',
    services: status,
    timestamp: new Date()
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const health = await ServiceInitializer.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      overall: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, async () => {
  console.log(`Cartrita backend is live on port ${PORT}`);
  
  // Initialize Cartrita Iteration 21 services
  try {
    await ServiceInitializer.initializeServices();
    
    // Initialize NotificationEngine
    await NotificationEngine.initialize();
    console.log('🔔 Notification Engine initialized');
    
    // Initialize PrivacyControlService
    await PrivacyControlService.initialize();
    console.log('🔒 Privacy Control Service initialized');
    
    console.log('🎉 Cartrita Iteration 21 is fully operational!');
  } catch (error) {
    console.error('❌ Failed to initialize Cartrita services:', error);
    console.warn('⚠️ Server will continue running with limited functionality');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  NotificationEngine.cleanup();
  PrivacyControlService.cleanup();
  await ServiceInitializer.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  NotificationEngine.cleanup();
  PrivacyControlService.cleanup();
  await ServiceInitializer.cleanup();
  process.exit(0);
});
