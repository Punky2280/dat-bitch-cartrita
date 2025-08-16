import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import SecurityEventDetector from './SecurityEventDetector.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Real-time Security Monitoring WebSocket Server
 * Provides live security event streaming and dashboard updates
 */
class SecurityWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.eventBuffer = [];
    this.bufferSize = 1000;
    this.broadcastInterval = null;
    this.isStarted = false;
  }

  /**
   * Start WebSocket server
   * @param {Object} server - HTTP server instance
   * @param {string} path - WebSocket path
   */
  start(server, path = '/ws/security') {
    const span = OpenTelemetryTracing.traceOperation('security.websocket.start');
    
    try {
      this.wss = new WebSocketServer({
        server,
        path,
        verifyClient: this.verifyClient.bind(this)
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleError.bind(this));

      // Start periodic updates
      this.startPeriodicUpdates();

      // Listen to security events
      this.subscribeToSecurityEvents();

      this.isStarted = true;
      console.log(`Security WebSocket server started on ${path}`);
      
      span.setAttributes({
        'websocket.path': path,
        'websocket.started': true
      });

    } catch (error) {
      span.recordException(error);
      console.error('Failed to start security WebSocket server:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Verify WebSocket client authentication
   */
  verifyClient(info) {
    try {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Only allow admin users to connect to security monitoring
      return decoded.role === 'admin';
      
    } catch (error) {
      console.error('WebSocket client verification failed:', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws, req) {
    const span = OpenTelemetryTracing.traceOperation('security.websocket.connection');
    
    try {
      // Extract user info from token
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const clientId = `${decoded.userId}-${Date.now()}`;
      const clientInfo = {
        id: clientId,
        userId: decoded.userId,
        ws,
        connectedAt: new Date(),
        lastPing: new Date(),
        subscriptions: new Set(['all']) // Default subscription
      };

      this.clients.set(clientId, clientInfo);
      
      console.log(`Security monitoring client connected: ${clientId} (User: ${decoded.userId})`);
      
      // Send initial dashboard data
      await this.sendInitialData(clientId);
      
      // Setup message handling
      ws.on('message', (data) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleDisconnection(clientId));
      ws.on('error', (error) => this.handleClientError(clientId, error));
      
      // Send welcome message
      this.sendMessage(clientId, {
        type: 'connection_established',
        data: {
          clientId,
          timestamp: new Date().toISOString(),
          subscriptions: Array.from(clientInfo.subscriptions)
        }
      });

      span.setAttributes({
        'websocket.client_id': clientId,
        'websocket.user_id': decoded.userId,
        'websocket.connected': true
      });

    } catch (error) {
      span.recordException(error);
      console.error('WebSocket connection handling failed:', error);
      ws.close();
    } finally {
      span.end();
    }
  }

  /**
   * Send initial dashboard data to new client
   */
  async sendInitialData(clientId) {
    try {
      // Get recent security events
      const recentEventsResult = await db.query(`
        SELECT type, severity, ip_address, timestamp, metadata
        FROM security_events
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY timestamp DESC
        LIMIT 50
      `);

      // Get active alerts
      const activeAlertsResult = await db.query(`
        SELECT id, type, severity, ip_address, timestamp, metadata
        FROM security_alerts
        WHERE status = 'active'
        ORDER BY severity DESC, timestamp DESC
        LIMIT 20
      `);

      // Get current statistics
      const stats = SecurityEventDetector.getStats();

      // Get recent metrics
      const metricsResult = await db.query(`
        SELECT timestamp, total_events, high_severity_events, critical_severity_events,
               unique_ips, event_types
        FROM security_metrics
        WHERE timestamp > NOW() - INTERVAL '24 hours'
        ORDER BY timestamp DESC
        LIMIT 24
      `);

      // Send comprehensive initial data
      this.sendMessage(clientId, {
        type: 'initial_data',
        data: {
          recentEvents: recentEventsResult.rows,
          activeAlerts: activeAlertsResult.rows,
          statistics: stats,
          metrics: metricsResult.rows,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Failed to send initial data:', error);
      this.sendMessage(clientId, {
        type: 'error',
        data: { message: 'Failed to load initial dashboard data' }
      });
    }
  }

  /**
   * Handle WebSocket message from client
   */
  handleMessage(clientId, data) {
    const span = OpenTelemetryTracing.traceOperation('security.websocket.message');
    
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (!client) return;

      client.lastPing = new Date();

      switch (message.type) {
        case 'ping':
          this.sendMessage(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'subscribe':
          this.handleSubscription(clientId, message.data);
          break;

        case 'unsubscribe':
          this.handleUnsubscription(clientId, message.data);
          break;

        case 'get_dashboard_data':
          this.sendDashboardUpdate(clientId);
          break;

        case 'acknowledge_alert':
          this.handleAlertAcknowledgment(clientId, message.data);
          break;

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }

      span.setAttributes({
        'websocket.client_id': clientId,
        'websocket.message_type': message.type
      });

    } catch (error) {
      span.recordException(error);
      console.error('WebSocket message handling failed:', error);
      this.sendMessage(clientId, {
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    } finally {
      span.end();
    }
  }

  /**
   * Handle client subscription updates
   */
  handleSubscription(clientId, subscriptionData) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = subscriptionData;
    
    if (Array.isArray(channels)) {
      channels.forEach(channel => client.subscriptions.add(channel));
    }

    this.sendMessage(clientId, {
      type: 'subscription_updated',
      data: {
        subscriptions: Array.from(client.subscriptions),
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle client unsubscription
   */
  handleUnsubscription(clientId, subscriptionData) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = subscriptionData;
    
    if (Array.isArray(channels)) {
      channels.forEach(channel => client.subscriptions.delete(channel));
    }

    this.sendMessage(clientId, {
      type: 'subscription_updated',
      data: {
        subscriptions: Array.from(client.subscriptions),
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle alert acknowledgment from client
   */
  async handleAlertAcknowledgment(clientId, alertData) {
    try {
      const { alertId, notes } = alertData;
      const client = this.clients.get(clientId);
      
      if (!client || !alertId) return;

      // Update alert in database
      await db.query(`
        UPDATE security_alerts
        SET status = 'investigating',
            acknowledged_by = $1,
            acknowledged_at = NOW(),
            resolution_notes = $2
        WHERE id = $3 AND status = 'active'
      `, [client.userId, notes, alertId]);

      // Broadcast alert update to all clients
      this.broadcast({
        type: 'alert_acknowledged',
        data: {
          alertId,
          acknowledgedBy: client.userId,
          notes,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Alert acknowledgment failed:', error);
      this.sendMessage(clientId, {
        type: 'error',
        data: { message: 'Failed to acknowledge alert' }
      });
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`Security monitoring client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    }
  }

  /**
   * Handle client error
   */
  handleClientError(clientId, error) {
    console.error(`WebSocket client error (${clientId}):`, error);
    this.clients.delete(clientId);
  }

  /**
   * Handle WebSocket server error
   */
  handleError(error) {
    console.error('Security WebSocket server error:', error);
  }

  /**
   * Subscribe to security events
   */
  subscribeToSecurityEvents() {
    // Hook into SecurityEventDetector events
    SecurityEventDetector.on('event', this.handleSecurityEvent.bind(this));
    SecurityEventDetector.on('alert', this.handleSecurityAlert.bind(this));
  }

  /**
   * Handle new security event
   */
  handleSecurityEvent(eventData) {
    // Add to buffer
    this.eventBuffer.push({
      ...eventData,
      timestamp: new Date().toISOString()
    });

    // Keep buffer size manageable
    if (this.eventBuffer.length > this.bufferSize) {
      this.eventBuffer.shift();
    }

    // Broadcast high/critical events immediately
    if (eventData.severity === 'high' || eventData.severity === 'critical') {
      this.broadcast({
        type: 'security_event',
        data: eventData,
        immediate: true
      });
    }
  }

  /**
   * Handle new security alert
   */
  handleSecurityAlert(alertData) {
    // Broadcast alerts immediately
    this.broadcast({
      type: 'security_alert',
      data: alertData,
      immediate: true
    });
  }

  /**
   * Send dashboard update to specific client
   */
  async sendDashboardUpdate(clientId) {
    try {
      const stats = SecurityEventDetector.getStats();
      
      // Get latest metrics
      const metricsResult = await db.query(`
        SELECT timestamp, total_events, high_severity_events, critical_severity_events
        FROM security_metrics
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      this.sendMessage(clientId, {
        type: 'dashboard_update',
        data: {
          statistics: stats,
          latestMetrics: metricsResult.rows[0] || null,
          recentEvents: this.eventBuffer.slice(-10), // Last 10 events
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Dashboard update failed:', error);
    }
  }

  /**
   * Start periodic updates
   */
  startPeriodicUpdates() {
    // Send dashboard updates every 30 seconds
    this.broadcastInterval = setInterval(async () => {
      if (this.clients.size > 0) {
        await this.broadcastDashboardUpdate();
      }
    }, 30000);
  }

  /**
   * Broadcast dashboard update to all clients
   */
  async broadcastDashboardUpdate() {
    try {
      const stats = SecurityEventDetector.getStats();
      
      this.broadcast({
        type: 'periodic_update',
        data: {
          statistics: stats,
          eventBuffer: this.eventBuffer.slice(-5), // Last 5 events
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Periodic dashboard update failed:', error);
    }
  }

  /**
   * Send message to specific client
   */
  sendMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (client && client.ws.readyState === client.ws.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message, filter = null) {
    const span = OpenTelemetryTracing.traceOperation('security.websocket.broadcast');
    
    try {
      let sentCount = 0;
      
      this.clients.forEach((client, clientId) => {
        // Apply filter if provided
        if (filter && !filter(client)) {
          return;
        }

        // Check if client is subscribed to this message type
        if (!this.isClientSubscribed(client, message)) {
          return;
        }

        if (client.ws.readyState === client.ws.OPEN) {
          try {
            client.ws.send(JSON.stringify(message));
            sentCount++;
          } catch (error) {
            console.error(`Failed to broadcast to client ${clientId}:`, error);
            this.clients.delete(clientId);
          }
        } else {
          // Clean up closed connections
          this.clients.delete(clientId);
        }
      });

      span.setAttributes({
        'websocket.broadcast.sent_count': sentCount,
        'websocket.broadcast.message_type': message.type
      });

    } catch (error) {
      span.recordException(error);
      console.error('Broadcast failed:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Check if client is subscribed to message type
   */
  isClientSubscribed(client, message) {
    // Always send error and connection messages
    if (['error', 'connection_established', 'pong'].includes(message.type)) {
      return true;
    }

    // Check subscriptions
    if (client.subscriptions.has('all')) {
      return true;
    }

    if (message.type === 'security_event' && client.subscriptions.has('events')) {
      return true;
    }

    if (message.type === 'security_alert' && client.subscriptions.has('alerts')) {
      return true;
    }

    if (message.type.includes('dashboard') && client.subscriptions.has('dashboard')) {
      return true;
    }

    return false;
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.isStarted,
      connectedClients: this.clients.size,
      eventBufferSize: this.eventBuffer.length,
      uptime: this.broadcastInterval ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    console.log('Shutting down Security WebSocket server...');
    
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      client.ws.close();
    });
    
    this.clients.clear();

    // Close server
    if (this.wss) {
      this.wss.close();
    }

    this.isStarted = false;
    console.log('Security WebSocket server shutdown completed');
  }
}

export default new SecurityWebSocketServer();
