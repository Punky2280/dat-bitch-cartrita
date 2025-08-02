// packages/backend/index.js

console.log('[Index] 🚀 Starting Cartrita backend...');
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');

// --- AGENT & SERVICE IMPORTS ---
const coreAgent = require('./src/agi/consciousness/CoreAgent');
const initializeAgents = require('./src/agi/agentInitializer');
const ServiceInitializer = require('./src/services/ServiceInitializer');
const SensoryProcessingService = require('./src/system/SensoryProcessingService');
const authenticateTokenSocket = require('./src/middleware/authenticateTokenSocket');

// --- ROUTE IMPORTS ---
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const chatHistoryRoutes = require('./src/routes/chatHistory');
const workflowRoutes = require('./src/routes/workflows');
const knowledgeRoutes = require('./src/routes/knowledge');
const vaultRoutes = require('./src/routes/vault');
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
const { router: agentRoutes, injectIO } = require('./src/routes/agent');

// --- APP & SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const socketConfig = require('./socket-config');
const allowedOrigins = [ 'http://localhost:5173', 'http://127.0.0.1:5173' ];
app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

const io = new Server(server, socketConfig);
injectIO(io);

// --- ROUTES & MIDDLEWARE ---
app.get('/', (req, res) => res.status(200).json({ message: 'Cartrita backend is alive.' }));
app.use('/api/auth', authRoutes);
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
app.use('/agent', agentRoutes);

// --- SOCKET.IO SETUP ---
const sensoryService = new SensoryProcessingService(coreAgent);
const chatNamespace = io.of('/');
chatNamespace.use(authenticateTokenSocket);
chatNamespace.on('connection', socket => {
  console.log(`[Socket.IO] User connected: ${socket.user.name}`);
  
  // FIX: Listen for 'user_message' from the client
  socket.on('user_message', async (payload) => {
    const text = typeof payload === 'string' ? payload : payload.text;
    if (!text) return;

    try {
      await pool.query('INSERT INTO conversations (user_id, speaker, text) VALUES ($1, $2, $3)', [socket.user.id, 'user', text]);
      const res = await coreAgent.generateResponse(text, 'en', socket.user.id);
      await pool.query('INSERT INTO conversations (user_id, speaker, text, model) VALUES ($1, $2, $3, $4)', [socket.user.id, 'cartrita', res.text, res.model]);
      
      // COMPREHENSIVE FIX: Ensure response is always natural language
      let finalResponse = res;
      
      // Validate the response has proper text field
      if (!finalResponse.text || typeof finalResponse.text !== 'string') {
        console.error('[Socket] Invalid response format:', finalResponse);
        finalResponse = {
          text: "Sorry, I had a technical hiccup. Can you try asking again?",
          speaker: 'cartrita',
          model: 'fallback',
          error: true
        };
      }
      
      // Additional check: If response looks like JSON, fallback to safe response
      try {
        JSON.parse(finalResponse.text);
        // If we can parse it as JSON, it's probably not natural language
        console.warn('[Socket] Response appears to be JSON, using fallback');
        finalResponse = {
          text: "Hey! I'm here and ready to chat. What's on your mind?",
          speaker: 'cartrita',
          model: 'fallback-json-detected',
          original_response: finalResponse.text
        };
      } catch (e) {
        // Good - it's not JSON, so it's likely natural language
      }
      
      // DEBUG: Log what we're sending to frontend
      console.log('[Socket] Emitting agent_response:', {
        text: finalResponse.text,
        speaker: finalResponse.speaker || 'cartrita',
        model: finalResponse.model
      });
      
      // FIX: Emit 'agent_response' back to the client with the final result
      socket.emit('agent_response', finalResponse);
    } catch (e) {
      console.error('Chat processing error:', e);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  socket.on('disconnect', (reason) => console.log(`[Socket.IO] User disconnected: ${socket.user.name}, reason: ${reason}`));
});

const ambientNamespace = io.of('/ambient');
ambientNamespace.use(authenticateTokenSocket);
ambientNamespace.on('connection', socket => {
  sensoryService.handleConnection(socket);
});


// --- SERVER STARTUP LOGIC ---
async function waitForDatabase() {
  const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
  let retries = 10;
  while (retries) {
    try {
      await dbPool.query('SELECT NOW()');
      console.log('✅ Database is connected and ready.');
      await dbPool.end();
      return;
    } catch (err) {
      console.log(`⏳ Database not ready, retrying... (${retries} attempts left)`);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  await dbPool.end();
  throw new Error('Could not connect to the database after multiple retries.');
}

async function startServer() {
  try {
    await waitForDatabase();
    // Initialize LangChain Core Agent first
    console.log('🧠 Initializing LangChain Core Agent...');
    const coreAgentInitialized = await coreAgent.initialize();
    if (!coreAgentInitialized) {
      throw new Error('Failed to initialize LangChain Core Agent');
    }
    console.log('✅ LangChain Core Agent initialized');
    
    initializeAgents();
    await ServiceInitializer.initializeServices();
    console.log('🎉 All services initialized successfully!');
    
    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`✅ Cartrita backend is live on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();