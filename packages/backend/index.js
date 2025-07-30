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
const settingsRoutes = require('./src/routes/settings');
const mcpRoutes = require('./src/routes/mcp');
const { router: agentRoutes, injectIO } = require('./src/routes/agent'); // ✅ Updated import

const authenticateTokenSocket = require('./src/middleware/authenticateTokenSocket');
const EnhancedCoreAgent = require('./src/agi/consciousness/EnhancedCoreAgent');
const initializeAgents = require('./src/agi/agentInitializer');
const SensoryProcessingService = require('./src/system/SensoryProcessingService');
const MessageBus = require('./src/system/EnhancedMessageBus');

const app = express();
const server = http.createServer(app);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
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
app.use('/api/settings', settingsRoutes);
app.use('/api/mcp', mcpRoutes);
console.log('[Index] ✅ MCP routes registered at /api/mcp');

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

const PORT = process.env.PORT || 8000;
server.listen(PORT, () =>
  console.log(`Cartrita backend is live on port ${PORT}`)
);
