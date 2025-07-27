// packages/backend/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg'); // Make sure Pool is imported
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const chatHistoryRoutes = require('./src/routes/chatHistory');
const authenticateTokenSocket = require('./src/middleware/authenticateTokenSocket');
const CoreAgent = require('./src/agi/consciousness/CoreAgent');

const app = express();
const server = http.createServer(app);
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // Create a pool instance

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];
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

const io = new Server(server, {
  cors: corsOptions // Use the same CORS options for Socket.IO
});

const coreAgent = new CoreAgent();

// Middleware
app.use(cors(corsOptions)); // Use the CORS options for Express
app.use(express.json());

// Root Route for Health Check
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: "Cartrita backend is alive and kicking.",
    status: "OK",
    timestamp: new Date().toISOString()
  });
});

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatHistoryRoutes);

// Socket.IO connection
io.use(authenticateTokenSocket);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] User connected: ${socket.user.name} (ID: ${socket.user.userId})`);

  socket.on('chat message', async (msg) => {
    console.log(`[Socket.IO] Message from ${socket.user.name}: ${msg}`);
    const userId = socket.user.userId;

    try {
      // Step 1: Save the user's message to the database
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text) VALUES ($1, $2, $3)',
        [userId, 'user', msg]
      );

      // Step 2: Get a response from the CoreAgent
      const agentResponse = await coreAgent.generateResponse(msg);
      
      // Step 3: Save the agent's response to the database
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text, model) VALUES ($1, $2, $3, $4)',
        [userId, 'cartrita', agentResponse.text, agentResponse.model]
      );

      // Step 4: Emit the response back to the client
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
