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
const authenticateTokenSocket = require('./src/middleware/authenticateTokenSocket');
const CoreAgent = require('./src/agi/consciousness/CoreAgent');

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
  methods: ["GET", "POST", "PUT"]
};

const io = new Server(server, { cors: corsOptions });
const coreAgent = new CoreAgent();

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ message: "Cartrita backend is alive and kicking." });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatHistoryRoutes);

io.use(authenticateTokenSocket);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] User connected: ${socket.user.name} (ID: ${socket.user.userId})`);

  // FIXED: The handler now expects an object { text, language }
  socket.on('chat message', async (messagePayload) => {
    const { text, language } = messagePayload;
    console.log(`[Socket.IO] Message from ${socket.user.name} in ${language}: ${text}`);
    const userId = socket.user.userId;

    try {
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text) VALUES ($1, $2, $3)',
        [userId, 'user', text]
      );

      // Pass both the text and language to the CoreAgent
      const agentResponse = await coreAgent.generateResponse(text, language);
      
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text, model) VALUES ($1, $2, $3, $4)',
        [userId, 'cartrita', agentResponse.text, agentResponse.model]
      );

      socket.emit('chat message', agentResponse);

    } catch (error) {
      console.error("Error processing chat message:", error);
      socket.emit('chat message', {
        text: "I've hit a snag in my core processing. Give me a moment.",
        speaker: 'cartrita',
        error: true
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] User disconnected: ${socket.user.name}`);
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Cartrita backend is live on port ${PORT}`);
});
