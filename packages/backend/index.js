// packages/backend/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const chatHistoryRoutes = require('./src/routes/chatHistory');
const workflowRoutes = require('./src/routes/workflows');
const apiKeyRoutes = require('./src/routes/apiKeys');
const authenticateTokenSocket = require('./src/middleware/authenticateTokenSocket');
const CoreAgent = require('./src/agi/consciousness/CoreAgent');
const initializeAgents = require('./src/agi/agentInitializer');
const SensoryProcessingService = require('./src/system/SensoryProcessingService');
const MessageBus = require('./src/system/MessageBus'); // Import the MessageBus

const app = express();
const server = http.createServer(app);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"]
};

const io = new Server(server, { cors: corsOptions });
const coreAgent = new CoreAgent();
const sensoryService = new SensoryProcessingService(coreAgent);

initializeAgents();

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ message: "Cartrita backend is alive and kicking." });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatHistoryRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/keys', apiKeyRoutes);

// Main chat namespace
const chatNamespace = io.of('/');
chatNamespace.use(authenticateTokenSocket);
chatNamespace.on('connection', (socket) => {
  console.log(`[Socket.IO] User connected to chat: ${socket.user.name}`);
  
  socket.on('chat message', async (messagePayload) => {
    const { text, language } = messagePayload;
    const userId = socket.user.userId;
    console.log(`[Socket.IO] Message from ${socket.user.name} in ${language}: ${text}`);
    try {
      await pool.query('INSERT INTO conversations (user_id, speaker, text) VALUES ($1, $2, $3)', [userId, 'user', text]);
      const agentResponse = await coreAgent.generateResponse(text, language, userId);
      await pool.query('INSERT INTO conversations (user_id, speaker, text, model) VALUES ($1, $2, $3, $4)', [userId, 'cartrita', agentResponse.text, agentResponse.model]);
      socket.emit('chat message', agentResponse);
    } catch (error) {
      console.error("Error processing chat message:", error);
      socket.emit('chat message', { text: "I've hit a snag in my core processing. Give me a moment.", speaker: 'cartrita', error: true });
    }
  });

  socket.on('disconnect', () => console.log(`[Socket.IO] User disconnected from chat: ${socket.user.name}`));
});

// Dedicated namespace for ambient audio streams
const ambientNamespace = io.of('/ambient');
ambientNamespace.use(authenticateTokenSocket);
ambientNamespace.on('connection', (socket) => {
  sensoryService.handleConnection(socket);
});

// --- NEW: Listen for proactive responses from the MessageBus ---
MessageBus.on('proactive:response', async ({ userId, response }) => {
  console.log(`[Proactive] Received proactive response for user ID: ${userId}`);
  
  // Find the right user's socket in the main chat namespace
  const sockets = await chatNamespace.fetchSockets();
  const userSocket = sockets.find(s => s.user.userId === userId);

  if (userSocket) {
    console.log(`[Proactive] Found user socket. Emitting message.`);
    userSocket.emit('chat message', response);
    // Also save the proactive message to the database
    await pool.query(
      'INSERT INTO conversations (user_id, speaker, text, model) VALUES ($1, $2, $3, $4)',
      [userId, 'cartrita', response.text, response.model]
    );
  } else {
    console.log(`[Proactive] Could not find active socket for user ID: ${userId}. Message not sent.`);
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Cartrita backend is live on port ${PORT}`);
});
