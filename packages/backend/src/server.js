/* Backend bootstrap server: mounts all API routes and middleware */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Load env vars first before other imports

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import './db.js';

// Route imports
import chatHistoryRoutes from './routes/chatHistory.js';
import workflowsRoutes from './routes/workflows.js';
import personalLifeOSRoutes from './routes/personalLifeOS.js';
import voiceToTextRoutes from './routes/voiceToText.js';
import registryStatusRoutes from './routes/registryStatus.js';
import authRoutes from './routes/auth.js';
import authenticateToken from './middleware/authenticateToken.js';
import coreAgent from './agi/consciousness/CoreAgent.js';

// Public (unauthenticated) path prefixes - everything else under /api will require JWT
const PUBLIC_API_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/verify', // verify just needs a token presented explicitly; we treat as public to allow explicit token introspection
  '/health',
  '/api/health',
  '/api/health/system',
  '/api/huggingface/health',
  '/api/huggingface/capabilities',
  '/api/huggingface/test',
  '/api/huggingface/chat/completions',
  '/api/huggingface/text-to-image',
  '/api/huggingface/vision/chat',
  '/api/huggingface/audio',
  '/api/huggingface/embeddings',
  '/api/huggingface/rag'
];

const app = express();
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
];

app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  maxAge: 600
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

// Health endpoints
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'cartrita-backend' }));

// Mount routes under /api
// Global auth gate: apply after basic middleware, before mounting routes. We only guard /api/*
app.use((req, res, next) => {
  // Allow public endpoints
  const path = req.path;
  if (PUBLIC_API_PATHS.some(p => path.startsWith(p))) {
    return next();
  }
  if (path.startsWith('/api/')) {
    return authenticateToken(req, res, next);
  }
  return next();
});

app.use('/api/chat', chatHistoryRoutes);
// Authentication (register, login, verify)
app.use('/api/auth', authRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/personal-life-os', personalLifeOSRoutes);
app.use('/api/voice', voiceToTextRoutes);
app.use('/api/internal/registry', registryStatusRoutes);

// Models catalog stub
app.get('/api/models/catalog', (req, res) => {
  res.json({ success: true, models: [], timestamp: new Date().toISOString() });
});

// Knowledge stubs
app.get('/api/knowledge/entries', (req, res) => {
  res.json({ success: true, entries: [], pagination: { total: 0 } });
});
app.get('/api/knowledge/graph', (req, res) => {
  res.json({ success: true, nodes: [], edges: [] });
});
app.get('/api/knowledge/clusters', (req, res) => {
  res.json({ success: true, clusters: [] });
});

// Ambient voice with real wake word detection and VAD
import AmbientVoiceService from './services/AmbientVoiceService.js';

app.post('/api/voice/ambient/start', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const options = req.body || {};
    const result = await AmbientVoiceService.startSession(userId, options);
    res.json(result);
  } catch (error) {
    console.error('[API] Ambient voice start failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/voice/ambient/stop', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ success: false, error: 'session_id required' });
    }
    const result = await AmbientVoiceService.stopSession(session_id);
    res.json(result);
  } catch (error) {
    console.error('[API] Ambient voice stop failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/voice/ambient/status', (req, res) => {
  try {
    const { session_id } = req.query;
    const result = AmbientVoiceService.getSessionStatus(session_id);
    res.json(result);
  } catch (error) {
    console.error('[API] Ambient voice status failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/voice/ambient/audio', async (req, res) => {
  try {
    const { session_id, audio_data, metadata } = req.body;
    if (!session_id || !audio_data) {
      return res.status(400).json({ success: false, error: 'session_id and audio_data required' });
    }
    const result = await AmbientVoiceService.processAudioChunk(session_id, audio_data, metadata);
    res.json(result);
  } catch (error) {
    console.error('[API] Ambient audio processing failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/voice/ambient/stats', (req, res) => {
  try {
    const stats = AmbientVoiceService.getServiceStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('[API] Ambient voice stats failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vision analysis with GPT-4V and DALL-E
import VisionAnalysisService from './services/VisionAnalysisService.js';

app.post('/api/vision/analyze', async (req, res) => {
  try {
    const { images, options } = req.body;
    if (!images) {
      return res.status(400).json({ success: false, error: 'images array required' });
    }
    const result = await VisionAnalysisService.analyzeImage(images, options || {});
    res.json(result);
  } catch (error) {
    console.error('[API] Vision analysis failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/vision/generate', async (req, res) => {
  try {
    const { prompt, options } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt required' });
    }
    const result = await VisionAnalysisService.generateImage(prompt, options || {});
    res.json(result);
  } catch (error) {
    console.error('[API] Image generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/vision/compare', async (req, res) => {
  try {
    const { images, options } = req.body;
    if (!images || images.length < 2) {
      return res.status(400).json({ success: false, error: 'at least 2 images required for comparison' });
    }
    const result = await VisionAnalysisService.compareImages(images, options || {});
    res.json(result);
  } catch (error) {
    console.error('[API] Image comparison failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/vision/extract-text', async (req, res) => {
  try {
    const { images, options } = req.body;
    if (!images) {
      return res.status(400).json({ success: false, error: 'images array required' });
    }
    const result = await VisionAnalysisService.extractText(images, options || {});
    res.json(result);
  } catch (error) {
    console.error('[API] Text extraction failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/vision/capabilities', (req, res) => {
  try {
    const capabilities = VisionAnalysisService.getCapabilities();
    res.json({ success: true, ...capabilities });
  } catch (error) {
    console.error('[API] Vision capabilities failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Email service stubs
app.get('/api/email/status', (req, res) => {
  res.json({ success: true, status: 'operational', service: 'email' });
});

// Calendar service stubs
app.get('/api/calendar/status', (req, res) => {
  res.json({ success: true, status: 'operational', service: 'calendar' });
});

// Contacts service stubs
app.get('/api/contacts/status', (req, res) => {
  res.json({ success: true, status: 'operational', service: 'contacts' });
});

// Agent metrics stubs
app.get('/api/agent/metrics', (req, res) => {
  res.json({ success: true, metrics: { active_agents: 0, total_requests: 0, uptime: Date.now() } });
});

// System health endpoint
app.get('/api/health/system', (req, res) => {
  res.json({ success: true, status: 'operational', system: 'cartrita-core', uptime: process.uptime() });
});

// HuggingFace Router Service API (JavaScript fetch approach)
import HuggingFaceRouterService from './services/HuggingFaceRouterService.js';

app.get('/api/huggingface/health', (req, res) => {
  try {
    const stats = HuggingFaceRouterService.getServiceStats();
    res.json({ 
      success: true, 
      status: stats.healthy ? 'operational' : 'degraded', 
      service: 'huggingface-inference-providers',
      authenticated: stats.authenticated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/huggingface/stats', (req, res) => {
  try {
    const stats = HuggingFaceRouterService.getServiceStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/huggingface/capabilities', (req, res) => {
  try {
    const models = HuggingFaceRouterService.getAvailableModels();
    res.json({ 
      success: true, 
      capabilities: { 
        chat: true, 
        vision: true, 
        textToImage: true, 
        speechToText: true, 
        embeddings: true,
        rag: true 
      },
      ...models
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat completion endpoint
app.post('/api/huggingface/chat/completions', async (req, res) => {
  try {
    const { messages, model, provider, temperature, max_tokens, stream } = req.body;
    if (!messages) {
      return res.status(400).json({ success: false, error: 'messages array required' });
    }
    
    const result = await HuggingFaceRouterService.chatCompletion({
      messages, model, provider, temperature, max_tokens, stream
    });
    res.json(result);
  } catch (error) {
    console.error('[API] HF chat completion failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vision chat completion endpoint
app.post('/api/huggingface/vision/chat', async (req, res) => {
  try {
    const { messages, model, provider, temperature, max_tokens } = req.body;
    if (!messages) {
      return res.status(400).json({ success: false, error: 'messages array required' });
    }
    
    const result = await HuggingFaceRouterService.visionChatCompletion({
      messages, model, provider, temperature, max_tokens
    });
    res.json(result);
  } catch (error) {
    console.error('[API] HF vision chat failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Text-to-image generation endpoint
app.post('/api/huggingface/text-to-image', async (req, res) => {
  try {
    const { prompt, model, provider, width, height, num_inference_steps, guidance_scale, negative_prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt required' });
    }
    
    const result = await HuggingFaceRouterService.textToImage({
      prompt, model, provider, width, height, num_inference_steps, guidance_scale, negative_prompt
    });
    res.json(result);
  } catch (error) {
    console.error('[API] HF text-to-image failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Speech-to-text endpoint (updated)
app.post('/api/huggingface/audio', async (req, res) => {
  try {
    const { audio, model } = req.body;
    if (!audio) {
      return res.status(400).json({ success: false, error: 'audio data required' });
    }
    
    const result = await HuggingFaceRouterService.speechToText({ audio, model });
    res.json(result);
  } catch (error) {
    console.error('[API] HF speech-to-text failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Embeddings endpoint
app.post('/api/huggingface/embeddings', async (req, res) => {
  try {
    const { inputs, model } = req.body;
    if (!inputs) {
      return res.status(400).json({ success: false, error: 'inputs required' });
    }
    
    const result = await HuggingFaceRouterService.createEmbeddings({ inputs, model });
    res.json(result);
  } catch (error) {
    console.error('[API] HF embeddings failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test connection endpoint
app.post('/api/huggingface/test', async (req, res) => {
  try {
    const result = await HuggingFaceRouterService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('[API] HF test failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// RAG endpoint (enhanced)
app.post('/api/huggingface/rag', async (req, res) => {
  try {
    const { query, context, model } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'query required' });
    }
    
    // Enhanced RAG with embeddings and chat completion
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Use the provided context to answer the user\'s question accurately.'
      },
      {
        role: 'user',
        content: context ? `Context: ${context}\n\nQuestion: ${query}` : query
      }
    ];
    
    const result = await HuggingFaceRouterService.chatCompletion({
      messages,
      model: model || 'deepseek-v3',
      temperature: 0.3,
      max_tokens: 1500
    });
    
    res.json({
      success: result.success,
      response: result.success ? result.response.choices[0].message.content : result.error,
      model: result.model,
      processingTime: result.processingTime,
      type: 'rag'
    });
  } catch (error) {
    console.error('[API] HF RAG failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found', path: req.originalUrl });
});

let server = null;
let io = null;
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  const port = process.env.PORT || 8001;
  server = http.createServer(app);
  io = new SocketIOServer(server, { 
    cors: { 
      origin: allowedOrigins,
      credentials: true 
    } 
  });
  io.on('connection', socket => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);
    socket.emit('connected', { socketId: socket.id });
    
    socket.on('user_message', async (data) => {
      console.log(`[Socket.IO] Message from ${socket.id}:`, data.text);
      
      try {
        // Emit typing indicator
        socket.emit('typing');
        
        // Initialize core agent if not already done
        if (!coreAgent.isInitialized) {
          console.log('[Socket.IO] Initializing core agent...');
          await coreAgent.initialize();
        }
        
        // Generate response using the real core agent
        const response = await coreAgent.generateResponse(
          data.text, 
          data.language || 'en',
          socket.id // Use socket ID as user ID for now
        );
        
        // Stop typing and send response
        socket.emit('stopTyping');
        socket.emit('agent_response', {
          text: response?.text || response || 'I apologize, but I encountered an issue processing your request.',
          timestamp: new Date().toISOString(),
          speaker: 'cartrita',
          model: response?.model || 'gpt-4o',
          tools_used: response?.tools_used || [],
          response_time_ms: response?.response_time_ms,
          request_id: response?.request_id
        });
        
      } catch (error) {
        console.error('[Socket.IO] Error processing message:', error);
        socket.emit('stopTyping');
        socket.emit('agent_response', {
          text: 'I apologize, but I encountered a technical issue. Please try again.',
          timestamp: new Date().toISOString(),
          speaker: 'cartrita',
          error: true
        });
      }
    });
    
    socket.on('ping', (startTime) => {
      socket.emit('pong', startTime);
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });
  server.listen(port, () => {
    console.log(`[server] Listening on port ${port}`);
  });
}

export default app;
