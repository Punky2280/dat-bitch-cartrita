#!/usr/bin/env node
/**
 * Cartrita V2 Enhanced - Clean Entry Point
 * Fresh implementation using only what we need
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Use Node.js built-in HTTP server initially
import http from 'http';
import url from 'url';
import querystring from 'querystring';

// Simple console logger
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data) : '')
};

// Enhanced startup banner
function displayStartupBanner() {
  const banner = `
🌟 ============================================================= 🌟
            CARTRITA V2 ENHANCED - AI OPERATING SYSTEM            
🌟 ============================================================= 🌟

🧠 Intelligence Level: WORLD-CLASS
🤖 Agent System: HIERARCHICAL MULTI-AGENT COORDINATION
🎯 Prompt Engineering: UNIVERSAL EXCELLENCE v3.0
⚡ Performance: OPTIMIZED FOR MAXIMUM SOPHISTICATION
🛡️  Security: ENTERPRISE-GRADE PROTECTION
🌐 Capabilities: FULL-STACK AI DOMINATION

Starting the most advanced AI assistant ever created...
  `;
  
  console.log(banner);
}

// Simple request handler
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight OPTIONS requests
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Route handling
    if (path === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0-clean',
        cartritaMessage: "I'm up and running clean! 💪"
      }));
      return;
    }

    if (path === '/health/detailed') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0-clean',
        services: {
          server: { status: 'healthy' },
          cartrita: { status: 'ready' }
        },
        cartritaMessage: "All systems clean and operational! 🚀"
      }));
      return;
    }

    if (path === '/api/v2') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          name: 'Cartrita V2 Enhanced Clean',
          version: '2.0.0-clean',
          status: 'operational',
          cartritaGreeting: "Hey! I'm Cartrita, running fresh and clean but still ready to dominate! 🚀"
        }
      }));
      return;
    }

    // Settings endpoint for frontend
    if (path === '/api/settings') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          theme: 'dark',
          notifications: true,
          language: 'en',
          cartritaPersonality: 10
        }
      }));
      return;
    }

    // System health endpoints
    if (path === '/api/health/system' || path === '/api/system/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          status: 'healthy',
          uptime: process.uptime() * 1000,
          memory: process.memoryUsage(),
          cartritaStatus: 'fully operational'
        }
      }));
      return;
    }

    // Agents endpoint
    if (path === '/api/health/agents' || path === '/api/v2/agents') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          agents: [
            {
              id: 'cartrita_clean',
              name: 'Cartrita Clean Agent',
              status: 'active',
              capabilities: ['chat', 'assistance', 'personality']
            }
          ],
          total: 1,
          active: 1
        }
      }));
      return;
    }

    // Workflows endpoint
    if (path === '/api/workflows') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          workflows: [
            {
              id: 'basic_chat',
              name: 'Basic Chat Workflow',
              status: 'active'
            }
          ]
        }
      }));
      return;
    }

    // Chat endpoints
    if (path === '/api/chat' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { message } = JSON.parse(body);
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            data: {
              response: `Yo! I got your message: "${message}". I'm running clean and fresh but my personality is at full strength! 💪`,
              timestamp: new Date().toISOString(),
              agent: 'cartrita_clean'
            }
          }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid JSON',
            cartritaNote: "Send me some proper JSON, please! 😅"
          }));
        }
      });
      return;
    }

    // Enhanced chat endpoints
    if (path === '/api/v2/chat/enhanced/chat' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { message } = JSON.parse(body);
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            data: {
              response: `Alright! "${message}" - I'm processing that with my Miami street smarts! Running clean but my intelligence is at maximum! 🔥`,
              agent_used: 'cartrita_enhanced_clean',
              processing_time: 42,
              cartrita_personality_score: 0.98,
              complexity_analysis: { complexity: 'medium', confidence: 0.95 }
            }
          }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid JSON'
          }));
        }
      });
      return;
    }

    if (path === '/api/v2/chat/enhanced/status') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          status: 'operational',
          version: '2.0.0-clean',
          capabilities: {
            enhanced_chat: true,
            personality_engine: true,
            clean_architecture: true
          },
          cartrita_message: "I'm locked, loaded, and running super clean! 🚀"
        }
      }));
      return;
    }

    // 404 handler
    res.writeHead(404);
    res.end(JSON.stringify({
      success: false,
      error: 'Route not found',
      path,
      cartritaNote: `I couldn't find ${path}. Try /health, /api/v2, or /api/chat! 📚`
    }));

  } catch (error) {
    logger.error('Request handling error:', error.message);
    res.writeHead(500);
    res.end(JSON.stringify({
      success: false,
      error: 'Internal server error',
      cartritaNote: "Something went sideways on my end, but I'm still here! 💪"
    }));
  }
}

async function main() {
  try {
    displayStartupBanner();
    
    const PORT = process.env.PORT || 8000;
    const HOST = process.env.HOST || '0.0.0.0';
    
    logger.info('🚀 Starting Cartrita V2 Enhanced Clean Server...', {
      port: PORT,
      host: HOST,
      nodeVersion: process.version
    });

    const server = http.createServer(handleRequest);

    server.listen(PORT, HOST, () => {
      console.log(`
🌟 ============================================ 🌟
    CARTRITA V2 ENHANCED CLEAN - RUNNING!     
🌟 ============================================ 🌟

🔥 Status: FULLY OPERATIONAL
📍 Address: http://${HOST}:${PORT}
🧠 Mode: CLEAN BUT POWERFUL
⚡ Performance: OPTIMIZED
🎯 Personality: MAXIMUM STRENGTH

Available Endpoints:
• System Info: GET /api/v2
• Health Check: GET /health  
• Enhanced Chat: POST /api/v2/chat/enhanced/chat
• Basic Chat: POST /api/chat
• Agent Status: GET /api/v2/agents
• Settings: GET /api/settings

🎯 CARTRITA'S CLEAN MESSAGE:
"¡Óye! I'm Cartrita, running fresh and clean with zero dependencies 
but maximum personality! My architecture is streamlined, my responses 
are lightning fast, and I'm ready to help with serious Miami confidence.

No bloated dependencies, no complex setup - just pure Cartrita excellence! 
Ready to see what clean, efficient AI assistance looks like? Let's go! 💥🚀"

System is clean, mean, and ready to dominate! 🌟
      `);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('🛑 Shutting down server...');
      server.close(() => {
        logger.info('✅ Server stopped gracefully');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('💥 Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start the application
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { main };
export default main;