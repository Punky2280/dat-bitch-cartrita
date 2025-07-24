require('dotenv').config();
const express = require('express');
const { createServer } = require('http'); // Import http
const { Server } = require('socket.io'); // Import socket.io
const { Pool } = require('pg');
const cors = require('cors');
const CoreAgent = require('./src/agi/consciousness/CoreAgent');
const authRoutes = require('./src/routes/auth');
const jwt = require('jsonwebtoken');

const app = express();
const httpServer = createServer(app); // Create HTTP server
const io = new Server(httpServer, { // Attach socket.io to the server
  cors: {
    origin: "http://localhost:5173", // Allow requests from our frontend
    methods: ["GET", "POST"]
  }
});

const port = 8000;
const cartrita = new CoreAgent();

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Middleware for JWT authentication (HTTP routes) ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'a_very_secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// --- Middleware to get user from token (Socket.IO) ---
const getUserFromToken = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: Token not provided"));
  }
  jwt.verify(token, process.env.JWT_SECRET || 'a_very_secret_key', (err, user) => {
    if (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
    socket.user = user;
    next();
  });
};

io.use(getUserFromToken);

// --- Socket.io Connection Logic ---
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.userId}`);

  socket.on('chat message', async (msg) => {
    const userId = socket.user.userId;
    if (!msg) return;

    try {
      // Save user message to DB
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text) VALUES ($1, $2, $3)',
        [userId, 'user', msg]
      );

      // Get response from Cartrita
      const response = await cartrita.generateResponse(msg);
      
      // Save Cartrita's response to DB
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text, model, tokens_used) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'cartrita', response.text, response.model, response.tokens_used]
      );
      
      // Send response back to the client
      socket.emit('chat message', response);

    } catch (error) {
      console.error('Socket chat error:', error);
      socket.emit('chat message', {
        text: "My circuits are fried. I can't talk right now.",
        speaker: 'cartrita',
        error: true
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.userId}`);
  });
});

// --- Standard HTTP API Endpoints ---
app.use('/api/auth', authRoutes);

// Get chat history
app.get('/api/chat/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await pool.query(`
      SELECT id, speaker, text, created_at, model, tokens_used
      FROM conversations 
      WHERE user_id = $1 
      ORDER BY created_at ASC 
      LIMIT $2
    `, [userId, limit]);

    res.json({
      messages: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get all conversations (grouped by user) - shows recent conversations
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get recent conversations grouped by date or session
    const result = await pool.query(`
      SELECT 
        DATE(created_at) as conversation_date,
        COUNT(*) as message_count,
        MAX(created_at) as last_message_time,
        string_agg(
          CASE WHEN speaker = 'user' 
          THEN substring(text, 1, 50) 
          END, ' | ' ORDER BY created_at
        ) as preview
      FROM conversations 
      WHERE user_id = $1 
      GROUP BY DATE(created_at)
      ORDER BY last_message_time DESC
      LIMIT 20
    `, [userId]);

    res.json({
      conversations: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages from a specific date/conversation
app.get('/api/conversations/:date/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { date } = req.params;
    
    const result = await pool.query(`
      SELECT id, speaker, text, created_at, model, tokens_used
      FROM conversations 
      WHERE user_id = $1 AND DATE(created_at) = $2
      ORDER BY created_at ASC
    `, [userId, date]);

    res.json({
      messages: result.rows,
      date: date,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Clear all conversations for user
app.delete('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      'DELETE FROM conversations WHERE user_id = $1',
      [userId]
    );
    
    res.json({ 
      message: 'All conversations cleared successfully',
      deleted_count: result.rowCount
    });
  } catch (error) {
    console.error('Error clearing conversations:', error);
    res.status(500).json({ error: 'Failed to clear conversations' });
  }
});

// Get conversation stats
app.get('/api/conversations/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN speaker = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN speaker = 'cartrita' THEN 1 END) as cartrita_messages,
        SUM(tokens_used) as total_tokens,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
      FROM conversations 
      WHERE user_id = $1
    `, [userId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// FIXED: Listen on 0.0.0.0 instead of localhost for Docker
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Cartrita real-time backend listening at http://0.0.0.0:${port}`);
});

