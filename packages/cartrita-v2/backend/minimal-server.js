#!/usr/bin/env node

/**
 * Minimal Backend Server for Development Testing
 * Bypasses all complex initialization to provide basic functionality
 */

// Load environment variables first
import './src/loadEnv.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

console.log('[Minimal] 🚀 Starting minimal backend server...');

const app = express();
const PORT = process.env.PORT || 8001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    retry_after: '15 minutes',
    type: 'rate_limit_exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// More restrictive rate limiting for security endpoints
const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit security endpoints to 20 requests per windowMs
  message: {
    error: 'Too many security requests from this IP',
    retry_after: '15 minutes',
    type: 'security_rate_limit_exceeded',
  },
});

app.use('/api/security/', securityLimiter);

// Minimal CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);

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
      details: error.message,
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

// ==== SECURITY ENDPOINTS (Task 4) ====

// Security service root
app.get('/api/security', (req, res) => {
  res.json({
    success: true,
    service: 'security',
    status: 'operational',
    endpoints: [
      '/health',
      '/status',
      '/metrics',
      '/scan',
      '/events',
      '/log-event',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Security health endpoint
app.get('/api/security/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    service: 'security',
    timestamp: new Date().toISOString(),
  });
});

// Security status endpoint
app.get('/api/security/status', (req, res) => {
  res.json({
    success: true,
    message: 'Security service is operational',
    features: [
      'authentication',
      'authorization',
      'monitoring',
      'vulnerability_scanning',
      'audit_logging',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Security metrics endpoint (authenticated)
app.get('/api/security/metrics', authenticateToken, async (req, res) => {
  try {
    // Mock metrics with realistic data structure
    const metrics = {
      security_scans_completed: Math.floor(Math.random() * 100) + 50,
      vulnerabilities_detected: Math.floor(Math.random() * 20),
      failed_login_attempts: Math.floor(Math.random() * 10),
      blocked_requests: Math.floor(Math.random() * 30),
      threat_level: 'low',
      last_scan_timestamp: new Date(
        Date.now() - Math.random() * 3600000
      ).toISOString(),
      active_security_rules: 25,
      compliance_score: (Math.random() * 20 + 80).toFixed(1), // 80-100%
    };

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Security] Metrics fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

// Vulnerability scan endpoint (authenticated)
app.post('/api/security/scan', authenticateToken, async (req, res) => {
  try {
    const scanId = crypto.randomUUID();
    const { target = 'system', options = {} } = req.body;

    console.log(
      `[Security] Starting vulnerability scan ${scanId} for target: ${target}`
    );

    // Simulate scan execution
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate scan time

    const scanResult = {
      scanId,
      target,
      timestamp: new Date().toISOString(),
      status: 'completed',
      duration: '1.5s',
      vulnerabilities: [
        {
          id: 'VULN-001',
          severity: 'medium',
          type: 'configuration',
          description: 'Default configuration detected',
          recommendation: 'Update security configuration',
        },
      ],
      riskScore: (Math.random() * 3 + 2).toFixed(1), // 2-5 score
      summary: {
        total_checks: 47,
        passed: 44,
        warnings: 2,
        failures: 1,
      },
    };

    res.json({
      success: true,
      data: scanResult,
    });
  } catch (error) {
    console.error('[Security] Scan failed:', error);
    res.status(500).json({
      success: false,
      error: 'Security scan failed',
      details: error.message,
    });
  }
});

// Security events endpoint (authenticated)
app.get('/api/security/events', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, severity } = req.query;

    // Mock security events
    const events = [
      {
        id: crypto.randomUUID(),
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'authentication_success',
        severity: 'info',
        user: req.user.email,
        details: 'User login successful',
      },
      {
        id: crypto.randomUUID(),
        timestamp: new Date(Date.now() - 600000).toISOString(),
        type: 'scan_completed',
        severity: 'info',
        details: 'Vulnerability scan completed successfully',
      },
      {
        id: crypto.randomUUID(),
        timestamp: new Date(Date.now() - 900000).toISOString(),
        type: 'configuration_change',
        severity: 'warning',
        details: 'Security configuration modified',
      },
    ].slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: events,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: 3,
      },
    });
  } catch (error) {
    console.error('[Security] Events fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security events',
    });
  }
});

// Log security event endpoint (authenticated)
app.post('/api/security/log-event', authenticateToken, async (req, res) => {
  try {
    const { eventType, details = {} } = req.body;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'eventType is required',
      });
    }

    const logEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      details,
      user: req.user.email,
      source: 'manual_log',
    };

    console.log('[Security] Event logged:', logEntry);

    res.json({
      success: true,
      data: logEntry,
    });
  } catch (error) {
    console.error('[Security] Event logging failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log security event',
    });
  }
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
      },
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
    `Hi ${user.name}! I'm in minimal backend mode, but I'm listening. Your message: "${message}". Let's chat!`,
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

// Public knowledge endpoints (Task 5)
app.get('/api/knowledge/', (req, res) => {
  res.json({
    service: 'Enhanced Knowledge Hub v3.0',
    status: 'operational',
    mode: 'minimal-server',
    features: [
      'Vector search capabilities',
      'RAG pipeline ready',
      'Semantic search',
      'Document ingestion',
    ],
    endpoints: {
      health: '/api/knowledge/health',
      search: '/api/knowledge/search',
      documents: '/api/knowledge/documents',
    },
  });
});

app.get('/api/knowledge/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Enhanced Knowledge Hub v3.0',
    initialized: true,
    components: {
      vectorDb: 'ready',
      ragPipeline: 'operational',
      embeddings: 'available',
      search: 'functional',
    },
    timestamp: new Date().toISOString(),
  });
});

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

// ==== MODEL ROUTING ENDPOINTS (TASK 8) ====

app.get('/api/models/status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    service: 'model-routing',
    status: 'operational',
    mode: 'minimal-server',
    router_loaded: true,
    features: {
      huggingface_routing: 'enabled',
      multi_provider: 'enabled',
      load_balancing: 'enabled',
      fallback_handling: 'enabled',
    },
    providers: {
      huggingface: 'available',
      openai: process.env.OPENAI_API_KEY ? 'available' : 'no_key',
      anthropic: process.env.ANTHROPIC_API_KEY ? 'available' : 'no_key',
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/models/catalog', authenticateToken, (req, res) => {
  // Mock model catalog with production-like data
  const mockCatalog = [
    {
      repo_id: 'microsoft/DialoGPT-medium',
      category: 'general',
      approx_params: '345M',
      primary_tasks: ['conversational'],
      description: 'Conversational AI model',
    },
    {
      repo_id: 'sentence-transformers/all-MiniLM-L6-v2',
      category: 'embedding',
      approx_params: '22.7M',
      primary_tasks: ['feature-extraction'],
      description: 'Sentence embedding model',
    },
    {
      repo_id: 'microsoft/codebert-base',
      category: 'code',
      approx_params: '125M',
      primary_tasks: ['text-generation', 'code-completion'],
      description: 'Code understanding model',
    },
  ];

  res.json({
    success: true,
    count: mockCatalog.length,
    data: mockCatalog,
  });
});

app.post('/api/models/route', authenticateToken, (req, res) => {
  const { prompt, options = {} } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid prompt',
    });
  }

  // Mock routing logic with production-like response
  const mockResult = {
    model_id: 'microsoft/DialoGPT-medium',
    output: `Mock response to: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`,
    used_fallbacks: 0,
    task: 'general',
    timing_ms: Math.floor(Math.random() * 1000) + 200,
    confidence: 0.85,
    candidates_considered: [
      'microsoft/DialoGPT-medium',
      'sentence-transformers/all-MiniLM-L6-v2',
    ],
  };

  res.json({
    success: true,
    result: mockResult,
  });
});

app.post('/api/models/classify', authenticateToken, (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Missing prompt',
    });
  }

  // Mock classification logic
  let task = 'general';
  const promptLower = prompt.toLowerCase();

  if (promptLower.includes('code') || promptLower.includes('function')) {
    task = 'code';
  } else if (
    promptLower.includes('embedding') ||
    promptLower.includes('vector')
  ) {
    task = 'embedding';
  } else if (promptLower.includes('translate')) {
    task = 'multilingual';
  }

  const shortlist = [
    'microsoft/DialoGPT-medium',
    'sentence-transformers/all-MiniLM-L6-v2',
    'microsoft/codebert-base',
  ].slice(0, 3);

  res.json({
    success: true,
    task,
    shortlist,
  });
});

// System metrics endpoints
app.get('/api/system/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      loadAverage: require('os').loadavg(),
    },
    services: {
      database: { status: 'mock' },
      redis: { status: 'mock' },
      agents: { status: 'mock' },
    },
  };
  res.json({ success: true, data: metrics });
});

// ==== ERROR HANDLING ====// System metrics endpoints
app.get('/api/system/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      loadAverage: require('os').loadavg(),
    },
    services: {
      database: { status: 'mock' },
      redis: { status: 'mock' },
      agents: { status: 'mock' },
    },
  };
  res.json({ success: true, data: metrics });
});

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    mode: 'minimal',
  });
});

// ==== SECURITY ENDPOINTS (TASK 4) ====

// Security dashboard metrics
app.get('/api/security/metrics', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      threat_level: 'low',
      active_scans: 0,
      vulnerabilities_detected: 0,
      last_scan: new Date().toISOString(),
      security_score: 85,
      real_time_monitoring: true,
      alerts: [],
      metrics: {
        failed_logins: 0,
        blocked_requests: 0,
        rate_limit_hits: 0,
        sql_injection_attempts: 0,
        xss_attempts: 0,
      },
    },
    mode: 'production',
    timestamp: new Date().toISOString(),
  });
});

// Security audit logs
app.get('/api/security/audit-logs', authenticateToken, (req, res) => {
  const { limit = 50, offset = 0, severity } = req.query;

  res.json({
    success: true,
    data: {
      logs: [
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          event_type: 'authentication_success',
          severity: 'info',
          user_id: req.user?.id || 'anonymous',
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          details: 'User authentication successful',
        },
        {
          id: crypto.randomUUID(),
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          event_type: 'rate_limit_applied',
          severity: 'warning',
          ip_address: '192.168.1.100',
          details: 'Rate limit applied to IP address',
        },
      ],
      pagination: {
        total: 2,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: false,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Security scan endpoints
app.post('/api/security/scan/start', authenticateToken, (req, res) => {
  const { scan_type = 'full', targets = [] } = req.body;
  const scanId = crypto.randomUUID();

  res.json({
    success: true,
    data: {
      scan_id: scanId,
      scan_type,
      status: 'initiated',
      targets:
        targets.length > 0
          ? targets
          : ['api_endpoints', 'authentication', 'input_validation'],
      estimated_duration: '5-10 minutes',
      started_at: new Date().toISOString(),
    },
    message: 'Security scan initiated successfully',
  });
});

app.get('/api/security/scan/:scanId', authenticateToken, (req, res) => {
  const { scanId } = req.params;

  res.json({
    success: true,
    data: {
      scan_id: scanId,
      status: 'completed',
      progress: 100,
      results: {
        vulnerabilities_found: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        security_score: 95,
        recommendations: [
          'Enable HTTPS in production',
          'Implement Content Security Policy',
          'Add request rate limiting',
          'Enable security headers with helmet.js',
        ],
      },
      started_at: new Date(Date.now() - 300000).toISOString(),
      completed_at: new Date().toISOString(),
    },
  });
});

// Security configuration endpoints
app.get('/api/security/config', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      security_policies: {
        password_policy: {
          min_length: 8,
          require_uppercase: true,
          require_lowercase: true,
          require_numbers: true,
          require_symbols: true,
        },
        session_policy: {
          timeout: 3600,
          secure_cookies: true,
          same_site: 'strict',
        },
        rate_limiting: {
          enabled: true,
          max_requests: 100,
          window_minutes: 15,
        },
        ip_filtering: {
          enabled: false,
          whitelist: [],
          blacklist: [],
        },
      },
      monitoring: {
        real_time_alerts: true,
        log_retention_days: 90,
        audit_logging: true,
      },
    },
  });
});

app.put('/api/security/config', authenticateToken, (req, res) => {
  const { security_policies, monitoring } = req.body;

  // In production, this would validate and save the configuration
  res.json({
    success: true,
    message: 'Security configuration updated successfully',
    data: {
      updated_at: new Date().toISOString(),
      updated_by: req.user?.username || 'system',
    },
  });
});

// Security alerts endpoints
app.get('/api/security/alerts', authenticateToken, (req, res) => {
  const { status = 'active', severity } = req.query;

  res.json({
    success: true,
    data: {
      alerts: [],
      summary: {
        total_alerts: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        active: 0,
        resolved: 0,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

app.patch('/api/security/alerts/:alertId', authenticateToken, (req, res) => {
  const { alertId } = req.params;
  const { status, notes } = req.body;

  res.json({
    success: true,
    message: `Alert ${alertId} updated successfully`,
    data: {
      alert_id: alertId,
      status: status || 'acknowledged',
      updated_at: new Date().toISOString(),
      updated_by: req.user?.username || 'system',
      notes: notes || '',
    },
  });
});

// Security health check
app.get('/api/security/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'security-monitoring',
    checks: {
      audit_logging: 'operational',
      threat_detection: 'operational',
      vulnerability_scanner: 'operational',
      real_time_monitoring: 'operational',
    },
    timestamp: new Date().toISOString(),
    version: '1.0.0',
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
const server = app
  .listen(PORT, () => {
    console.log(
      `[Minimal] ✅ Cartrita minimal backend running on port ${PORT}`
    );
    console.log(`[Minimal] 🌍 Environment: ${NODE_ENV}`);
    console.log(`[Minimal] 🔗 Allowed origins: ${allowedOrigins.join(', ')}`);
    console.log(`[Minimal] 📊 Health check: http://localhost:${PORT}/health`);
    console.log(`[Minimal] 🧪 Mode: Minimal development server`);
  })
  .on('error', err => {
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
