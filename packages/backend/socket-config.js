// packages/backend/socket-config.js

/**
 * Socket.IO configuration for improved connection stability
 */

const socketConfig = {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Improve connection stability
  pingTimeout: 60000,        // How long to wait for ping response
  pingInterval: 25000,       // How often to send ping
  transports: ['polling', 'websocket'], // Try polling first
  allowEIO3: true,          // Support older clients
  upgradeTimeout: 30000,    // Timeout for WebSocket upgrade
  maxHttpBufferSize: 1e6,   // 1MB max message size
  // Additional stability options
  connectTimeout: 45000,    // Connection timeout
  serveClient: false,       // Don't serve client files
  cookie: false,            // Disable cookies for simpler setup
  // Enhanced error handling
  allowRequest: (req, callback) => {
    console.log('[Socket.IO] Incoming connection request from:', req.headers.origin);
    callback(null, true);
  }
};

module.exports = socketConfig;