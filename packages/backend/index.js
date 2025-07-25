require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const CoreAgent = require('./src/agi/consciousness/CoreAgent.js');
const authRoutes = require('./src/routes/auth.js');
const fractalVisualizer = require('./src/agi/consciousness/FractalVisualizer.js');
const jwt = require('jsonwebtoken');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const port = 8000;
const cartrita = new CoreAgent();

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Middleware to protect routes ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error("JWT Verification Error:", err);
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// --- Socket.io Middleware & Connection Logic ---
const getUserFromToken = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Auth error: Token not provided"));
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error("Auth error: Invalid token"));
    socket.user = user;
    next();
  });
};

io.use(getUserFromToken);

io.on('connection', (socket) => {
  console.log(`User connected via WebSocket: ${socket.user.userId}`); 

  socket.on('chat message', async (msg) => {
    const userId = socket.user.userId;
    if (!msg) return;

    try {
      const response = await cartrita.generateResponse(msg);
      
      // Save user message
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text) VALUES ($1, $2, $3)',
        [userId, 'user', msg]
      );
      
      // Save Cartrita's response
      await pool.query(
        'INSERT INTO conversations (user_id, speaker, text, model, tokens_used) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'cartrita', response.text, response.model, response.tokens_used]
      );
      
      socket.emit('chat message', response);

    } catch (error) {
      console.error('Socket chat error:', error);
      socket.emit('chat message', { text: "My circuits are fried. I can't talk right now.", speaker: 'cartrita', error: true });
    }
  });
});

// --- API Endpoints ---
app.use('/api/auth', authRoutes);

app.get('/api/chat/history', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const history = await pool.query(
            'SELECT speaker, text, model, tokens_used FROM conversations WHERE user_id = $1 ORDER BY created_at ASC',
            [userId]
        );
        res.json(history.rows);
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json({ error: 'Could not retrieve chat history.' });
    }
});

app.get('/', (req, res) => res.send('Cartrita Backend is alive!'));

httpServer.listen(port, () => {
  console.log(`Cartrita real-time backend listening at http://localhost:${port}`); 
});
