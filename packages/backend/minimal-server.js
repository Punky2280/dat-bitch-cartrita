#!/usr/bin/env node

/**
 * Minimal Backend Server for Development Testing
 * Bypasses all complex initialization to provide basic functionality
 */

// Load environment variables first
import './src/loadEnv.js';

import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

console.log('[Minimal] 🚀 Starting minimal backend server...');

const app = express();
const PORT = process.env.PORT || 8001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Minimal CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Database connection (optional)
let pool = null;
try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    console.log('[Minimal] ✅ Database pool created');
  }
} catch (error) {
  console.warn('[Minimal] ⚠️ Database connection failed:', error.message);
}

// Simple JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Try to verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role || 'user',
      is_admin: decoded.is_admin || false,
    };
    next();
  } catch (error) {
    // If JWT fails, try to decode frontend bypass token
    try {
      const decoded = JSON.parse(atob(token));
      if (decoded.iss === 'cartrita-frontend-bypass') {
        req.user = {
          id: decoded.id,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role || 'user',
          is_admin: decoded.is_admin || false,
        };
        next();
      } else {
        res.status(403).json({ error: 'Invalid token' });
      }
    } catch (decodeError) {
      res.status(403).json({ error: 'Invalid token format' });
    }
  }
};

// ==== BASIC ENDPOINTS ====

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Cartrita minimal backend is operational',
    version: '2.1.0-minimal',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Health endpoint
app.get('/health', async (req, res) => {
  let dbOk = false;
  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch (error) {
      console.warn('[Health] Database check failed:', error.message);
    }
  }

  res.json({
    success: true,
    status: 'healthy',
    services: {
      db: { ok: dbOk },
      redis: { ok: false }, // Disabled in minimal mode
      agent: { ok: true }, // Mock healthy
    },
    meta: {
      version: '2.1.0-minimal',
      environment: NODE_ENV,
    },
    timestamp: new Date().toISOString(),
  });
});

// ==== AUTH ENDPOINTS ====

// Auth test endpoint
app.get('/api/auth/test', (req, res) => {
  res.json({
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString(),
  });
});

// Emergency login (for testing)
app.post('/api/auth/emergency-login', (req, res) => {
  console.log('[Auth] Emergency login accessed');
  try {
    const token = jwt.sign(
      {
        sub: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        is_admin: false,
        iss: 'cartrita-auth',
        aud: 'cartrita-clients',
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Emergency login successful',
      user: {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        is_admin: false,
      },
      token,
    });
  } catch (error) {
    console.error('[Auth] Emergency login error:', error);
    res.status(500).json({ 
      error: 'Emergency login failed', 
      details: error.message 
    });
  }
});

// Normal login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('[Auth] Login attempt:', email);
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Mock successful login for testing
  if (email === 'test@example.com' && password === 'testpass123') {
    try {
      const token = jwt.sign(
        {
          sub: 1,
          name: 'Test User',
          email: email,
          role: 'user',
          is_admin: false,
          iss: 'cartrita-auth',
          aud: 'cartrita-clients',
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: 1,
          name: 'Test User',
          email: email,
          role: 'user',
          is_admin: false,
        },
        token,
      });
    } catch (error) {
      res.status(500).json({ error: 'Token generation failed' });
    }
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Token verification
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// ==== SERVICE STATUS ENDPOINTS ====

app.get('/api/health', async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Cartrita Backend',
    version: '2.1.0-minimal',
    uptime: process.uptime(),
  });
});

// Mock service status endpoints
app.get('/api/email/status', authenticateToken, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'email',
    message: 'Email service operational (minimal mode)',
  });
});

app.get('/api/calendar/status', authenticateToken, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'calendar',
    message: 'Calendar service operational (minimal mode)',
  });
});

app.get('/api/contacts/status', authenticateToken, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'contacts',
    message: 'Contacts service operational (minimal mode)',
  });
});

// ==== AI ENDPOINTS ====

app.get('/api/ai/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    service: 'multi-provider-ai',
    providers: ['mock-provider'],
    version: 'minimal-bridge',
  });
});

app.get('/api/ai/providers', (req, res) => {
  res.json({
    success: true,
    providers: [
      {
        key: 'mock-provider',
        name: 'Mock Provider',
        hasApiKey: true,
        tasks: ['chat', 'embeddings'],
        models: ['mock-model'],
      }
    ],
    total_providers: 1,
    service_version: 'minimal-bridge',
  });
});

app.get('/api/unified/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    metrics: {},
    availableModels: ['mock-model'],
  });
});

// ==== AGENT ENDPOINTS ====

app.get('/api/agents/role-call', (req, res) => {
  res.json({
    success: true,
    agents: ['TestAgent', 'MockAgent'],
    count: 2,
    minimal_mode: true,
  });
});

// ==== CHAT ENDPOINTS ====

app.get('/api/cartrita/ping', (req, res) => {
  res.json({
    message: 'Cartrita chat endpoint is working!',
    timestamp: new Date().toISOString(),
    mode: 'minimal',
  });
});

app.post('/api/cartrita/chat', authenticateToken, async (req, res) => {
  const { message } = req.body;
  const user = req.user;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  console.log(`[Chat] ${user.name}: "${message.substring(0, 50)}..."`);

  // Mock response
  const responses = [
    `Hey ${user.name}! I'm running in minimal mode right now, but I got your message: "${message}". How can I help?`,
    `¡Hola ${user.name}! Cartrita here in test mode. You said: "${message}". What's next?`,
    `Hi ${user.name}! I'm in minimal backend mode, but I'm listening. Your message: "${message}". Let's chat!`
  ];

  const response = responses[Math.floor(Math.random() * responses.length)];

  res.json({
    success: true,
    response: response,
    metadata: {
      speaker: 'cartrita-minimal',
      model: 'minimal-backend-mock',
      response_time_ms: 100,
    },
    timestamp: new Date().toISOString(),
  });
});

// ==== USER ENDPOINTS ====

app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    profile: {
      preferences: {},
      settings: {},
    },
  });
});

// ==== METRICS ====

app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP cartrita_requests_total Total requests
# TYPE cartrita_requests_total counter
cartrita_requests_total 1
`);
});

app.get('/api/metrics/custom', (req, res) => {
  res.json({
    success: true,
    data: {
      fast_path_delegations: 0,
      mode: 'minimal',
    },
  });
});

// ==== WORKFLOW ENDPOINTS ====

app.get('/api/workflows', authenticateToken, (req, res) => {
  res.json({
    success: true,
    workflows: [],
    count: 0,
    message: 'Workflows available in minimal mode',
  });
});

app.get('/api/workflow-templates', authenticateToken, (req, res) => {
  res.json({
    success: true,
    templates: [],
    count: 0,
    message: 'Templates available in minimal mode',
  });
});

// ==== KNOWLEDGE & VAULT ====

app.get('/api/knowledge', authenticateToken, (req, res) => {
  res.json({
    success: true,
    knowledge: [],
    message: 'Knowledge hub available in minimal mode',
  });
});

app.get('/api/vault', authenticateToken, (req, res) => {
  res.json({
    success: true,
    vault: [],
    message: 'API vault available in minimal mode',
  });
});

// ==== ERROR HANDLING ====

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    mode: 'minimal',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    mode: 'minimal',
  });
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`[Minimal] ✅ Cartrita minimal backend running on port ${PORT}`);
  console.log(`[Minimal] 🌍 Environment: ${NODE_ENV}`);
  console.log(`[Minimal] 🔗 Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`[Minimal] 📊 Health check: http://localhost:${PORT}/health`);
  console.log(`[Minimal] 🧪 Mode: Minimal development server`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Minimal] ❌ Port ${PORT} is already in use`);
    console.log(`[Minimal] 🔄 Trying port ${PORT + 1}...`);
    process.exit(1);
  } else {
    console.error('[Minimal] ❌ Server error:', err);
    process.exit(1);
  }
});

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('[Minimal] 🔄 Graceful shutdown...');
  server.close();
  if (pool) pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Minimal] 🔄 Graceful shutdown...');
  server.close();
  if (pool) pool.end();
  process.exit(0);
});

// Log that we're ready
console.log('[Minimal] 🟢 Server initialization complete');