const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Initialize Cartrita services
const ServiceInitializer = require('./services/ServiceInitializer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const chatHistoryRoutes = require('./routes/chatHistory');
const userRoutes = require('./routes/user');
const settingsRoutes = require('./routes/settings');
const voiceToTextRoutes = require('./routes/voiceToText');
const voiceChatRoutes = require('./routes/voiceChat');
const visionRoutes = require('./routes/vision');
const workflowRoutes = require('./routes/workflows');
const apiKeysRoutes = require('./routes/apiKeys');

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatHistoryRoutes);
app.use('/api/user', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/voice-to-text', voiceToTextRoutes);
app.use('/api/voice-chat', voiceChatRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/keys', apiKeysRoutes);

// Service status route
app.get('/api/status', (req, res) => {
  const status = ServiceInitializer.getServiceStatus();
  res.json({
    message: 'Dat Bitch Cartrita API is running!',
    services: status
  });
});

// Service health check route
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

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Dat Bitch Cartrita API is running!' });
});

// Socket.io authentication middleware
const authenticateTokenSocket = require('./middleware/authenticateTokenSocket');

// Socket.io connection handling
io.use(authenticateTokenSocket);

io.on('connection', socket => {
  // --- FIX: Use socket.user.id which will be set correctly by the socket middleware ---
  console.log(
    `🔗 User ${socket.user.name} (${socket.user.email}) connected - Socket ID: ${socket.id}`
  );

  // Send connection confirmation
  socket.emit('connected', { 
    id: socket.id, 
    user: socket.user.name,
    timestamp: new Date()
  });

  // Handle ping/pong for latency monitoring
  socket.on('ping', startTime => {
    socket.emit('pong', startTime);
  });

  // Handle incoming messages
  socket.on('message', async data => {
    try {
      const { text, timestamp } = data;
      // --- FIX: Use socket.user.id ---
      const userId = socket.user.id;

      console.log(
        `📨 Message from ${socket.user.name}: "${text.substring(0, 50)}..."`
      );

      // Emit typing indicator
      socket.emit('typing');

      // Store user message in database
      const db = require('./db');
      await db.query(
        'INSERT INTO conversations (user_id, speaker, text, model, created_at) VALUES ($1, $2, $3, $4, $5)',
        [
          userId,
          'user',
          text,
          'user-input',
          timestamp || new Date().toISOString(),
        ]
      );

      // Simulate thinking time (1-3 seconds)
      const thinkingTime = Math.random() * 2000 + 1000;

      setTimeout(async () => {
        try {
          // Stop typing indicator
          socket.emit('stopTyping');

          // Generate a more sophisticated response based on the input
          let response;
          const lowerText = text.toLowerCase();

          if (
            lowerText.includes('hello') ||
            lowerText.includes('hi') ||
            lowerText.includes('hey')
          ) {
            response = `Hey there, ${socket.user.name}! 👋 I'm Cartrita, your sassy AI companion. What's on your mind today?`;
          } else if (
            lowerText.includes('how are you') ||
            lowerText.includes("what's up")
          ) {
            response =
              "I'm doing fantastic, thanks for asking! 💫 Ready to tackle whatever you throw at me. I'm feeling particularly witty today. 😏";
          } else if (
            lowerText.includes('help') ||
            lowerText.includes('what can you do')
          ) {
            response = `I'm here to help with all sorts of things! 🚀 I can chat, answer questions, help with coding, provide analysis, and much more. I'm particularly good at being honest and direct - sometimes brutally so. What would you like to explore?`;
          } else if (lowerText.includes('thank')) {
            response =
              "You're welcome! 😊 Always happy to help out. That's what I'm here for!";
          } else if (
            lowerText.includes('code') ||
            lowerText.includes('programming') ||
            lowerText.includes('debug')
          ) {
            response =
              "Ah, a fellow coder! 💻 I love helping with programming challenges. Whether it's debugging, architecture advice, or writing new features, I'm your girl. What are you working on?";
          } else if (
            lowerText.includes('joke') ||
            lowerText.includes('funny')
          ) {
            response =
              "Why don't scientists trust atoms? Because they make up everything! 😄 But seriously, I've got plenty more where that came from. Want another?";
          } else if (lowerText.length < 10) {
            response = `"${text}" - short and sweet! I like your style. Care to elaborate, or are we doing the strong, silent type thing? 😉`;
          } else {
            // Default response for longer messages
            const responses = [
              `Interesting perspective on "${text.substring(0, 30)}..." Let me think about that. 🤔 You've got me curious - tell me more!`,
              `I hear you! That's quite something to consider. What made you think about this particular topic?`,
              `Hmm, that's a good point about "${text.substring(0, 25)}..." I appreciate how you're thinking about this. What's your take on it?`,
              `You know what? That actually makes a lot of sense. I'm impressed by your thinking here. Want to dive deeper into this?`,
              `Fascinating! You've touched on something I find really compelling. There's definitely more to unpack here, don't you think?`,
            ];
            response = responses[Math.floor(Math.random() * responses.length)];
          }

          // Store AI response in database
          const aiTimestamp = new Date().toISOString();
          await db.query(
            'INSERT INTO conversations (user_id, speaker, text, model, created_at) VALUES ($1, $2, $3, $4, $5)',
            [userId, 'cartrita', response, 'cartrita-v1-echo', aiTimestamp]
          );

          console.log(
            `🤖 Response to ${socket.user.name}: "${response.substring(0, 50)}..."`
          );

          // Send response back to client
          socket.emit('message', {
            speaker: 'cartrita',
            text: response,
            timestamp: aiTimestamp,
            model: 'cartrita-v1-echo',
          });
        } catch (error) {
          console.error('❌ Error generating response:', error);
          socket.emit('error', { message: 'Failed to generate response' });
        }
      }, thinkingTime);
    } catch (error) {
      console.error('❌ Error handling message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  // Handle client disconnection
  socket.on('disconnect', reason => {
    console.log(`🔌 User ${socket.user.name} disconnected - Reason: ${reason}`);
  });

  // Handle connection errors
  socket.on('error', error => {
    console.error(`🚨 Socket error for user ${socket.user.name}:`, error);
  });

  // Welcome message when user first connects
  setTimeout(() => {
    if (socket.connected) {
      socket.emit('message', {
        speaker: 'cartrita',
        text: `Welcome back, ${socket.user.name}! 🎉 I'm ready to chat whenever you are. What's on your mind?`,
        timestamp: new Date().toISOString(),
        model: 'system-welcome',
      });
    }
  }, 1000);
});

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  
  // Initialize Cartrita services
  try {
    await ServiceInitializer.initializeServices();
    console.log('🎉 Cartrita Iteration 21 is fully operational!');
  } catch (error) {
    console.error('❌ Failed to initialize Cartrita services:', error);
    console.warn('⚠️ Server will continue running with limited functionality');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await ServiceInitializer.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await ServiceInitializer.cleanup();
  process.exit(0);
});
