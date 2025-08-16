import { Server } from 'socket.io';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from '../system/SecurityAuditLogger.js';

/**
 * Real-Time Analytics WebSocket Handler
 * 
 * Provides real-time streaming of analytics data including:
 * - Live metrics updates
 * - Dashboard data streaming
 * - Alert notifications
 * - System health monitoring
 * - User behavior tracking
 * - Performance metrics
 * 
 * Features:
 * - Secure WebSocket connections
 * - Subscription-based data streaming
 * - Rate limiting and throttling
 * - Connection monitoring
 * - Error handling and recovery
 */

class AnalyticsWebSocketHandler {
  constructor() {
    this.io = null;
    this.analyticsEngine = null;
    this.connections = new Map();
    this.subscriptions = new Map();
    this.updateInterval = null;
    this.isInitialized = false;
    
    // Rate limiting
    this.rateLimits = new Map();
    this.maxUpdatesPerSecond = 10;
    
    // Metrics
    this.metrics = {
      connections: 0,
      subscriptions: 0,
      messagesPerSecond: 0,
      errors: 0
    };
    
    this.startMetricsCollection();
  }
  
  /**
   * Initialize WebSocket server with Express app
   */
  initialize(server, analyticsEngine) {
    try {
      this.analyticsEngine = analyticsEngine;
      
      // Initialize Socket.IO server
      this.io = new Server(server, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:3000",
          methods: ["GET", "POST"],
          credentials: true
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
      });
      
      // Create analytics namespace
      const analyticsNamespace = this.io.of('/analytics');
      
      analyticsNamespace.on('connection', (socket) => {
        this.handleConnection(socket);
      });
      
      // Start periodic updates
      this.startPeriodicUpdates();
      
      this.isInitialized = true;
      console.log('Analytics WebSocket handler initialized');
      
      return this.io;
      
    } catch (error) {
      console.error('Error initializing Analytics WebSocket handler:', error);
      throw error;
    }
  }
  
  /**
   * Handle new WebSocket connection
   */
  handleConnection(socket) {
    const span = OpenTelemetryTracing.getTracer('analytics-websocket')
      .startSpan('analytics_websocket_connection');
    
    try {
      const connectionId = socket.id;
      const userId = socket.handshake.auth?.userId || 'anonymous';
      const userAgent = socket.handshake.headers['user-agent'];
      
      // Store connection info
      this.connections.set(connectionId, {
        socket,
        userId,
        userAgent,
        connectedAt: Date.now(),
        subscriptions: new Set(),
        lastActivity: Date.now(),
        rateLimitCount: 0,
        rateLimitWindow: Date.now()
      });
      
      this.metrics.connections++;
      
      // Log connection
      SecurityAuditLogger.logSecurityEvent(
        'analytics_websocket_connected',
        `WebSocket connection established`,
        { connectionId, userId, userAgent }
      );
      
      // Set up event handlers
      this.setupSocketHandlers(socket, connectionId);
      
      // Send initial connection acknowledgment
      socket.emit('connected', {
        connectionId,
        timestamp: Date.now(),
        status: 'connected'
      });
      
      span.setAttributes({
        'connection.id': connectionId,
        'user.id': userId,
        'connection.count': this.metrics.connections
      });
      
    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      span.setStatus({ code: 2, message: error.message });
      socket.emit('error', { message: 'Connection setup failed' });
    } finally {
      span.end();
    }
  }
  
  /**
   * Set up socket event handlers
   */
  setupSocketHandlers(socket, connectionId) {
    const connection = this.connections.get(connectionId);
    
    // Handle subscription requests
    socket.on('subscribe', (data) => {
      this.handleSubscription(connectionId, data);
    });
    
    // Handle unsubscribe requests
    socket.on('unsubscribe', (data) => {
      this.handleUnsubscription(connectionId, data);
    });
    
    // Handle metric requests
    socket.on('get_metrics', (data) => {
      this.handleMetricRequest(connectionId, data);
    });
    
    // Handle dashboard data requests
    socket.on('get_dashboard_data', (data) => {
      this.handleDashboardRequest(connectionId, data);
    });
    
    // Handle ping for connection health
    socket.on('ping', () => {
      if (connection) {
        connection.lastActivity = Date.now();
      }
      socket.emit('pong', { timestamp: Date.now() });
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(connectionId, reason);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error(`WebSocket error for ${connectionId}:`, error);
      this.metrics.errors++;
      
      SecurityAuditLogger.logSecurityEvent(
        'analytics_websocket_error',
        `WebSocket error: ${error.message}`,
        { connectionId, error: error.message }
      );
    });
  }
  
  /**
   * Handle subscription requests
   */
  handleSubscription(connectionId, data) {
    const span = OpenTelemetryTracing.getTracer('analytics-websocket')
      .startSpan('analytics_websocket_subscribe');
    
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }
      
      // Rate limiting check
      if (!this.checkRateLimit(connectionId)) {
        connection.socket.emit('error', { 
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }
      
      const { metrics = [], options = {} } = data;
      
      // Validate metrics
      const validMetrics = metrics.filter(metric => 
        typeof metric === 'string' && metric.length > 0
      );
      
      if (validMetrics.length === 0) {
        connection.socket.emit('error', {
          message: 'No valid metrics specified',
          code: 'INVALID_METRICS'
        });
        return;
      }
      
      // Update subscriptions
      validMetrics.forEach(metric => {
        connection.subscriptions.add(metric);
        
        if (!this.subscriptions.has(metric)) {
          this.subscriptions.set(metric, new Set());
        }
        this.subscriptions.get(metric).add(connectionId);
      });
      
      this.metrics.subscriptions = Array.from(this.subscriptions.values())
        .reduce((total, connections) => total + connections.size, 0);
      
      // Send confirmation
      connection.socket.emit('subscribed', {
        metrics: validMetrics,
        timestamp: Date.now()
      });
      
      // Send initial data for subscribed metrics
      this.sendInitialData(connectionId, validMetrics, options);
      
      span.setAttributes({
        'subscription.connection_id': connectionId,
        'subscription.metrics_count': validMetrics.length,
        'subscription.total_subscriptions': this.metrics.subscriptions
      });
      
      SecurityAuditLogger.logSecurityEvent(
        'analytics_websocket_subscribed',
        `Subscribed to ${validMetrics.length} metrics`,
        { connectionId, metrics: validMetrics }
      );
      
    } catch (error) {
      console.error('Error handling subscription:', error);
      span.setStatus({ code: 2, message: error.message });
      
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.socket.emit('error', {
          message: 'Subscription failed',
          code: 'SUBSCRIPTION_ERROR'
        });
      }
    } finally {
      span.end();
    }
  }
  
  /**
   * Handle unsubscription requests
   */
  handleUnsubscription(connectionId, data) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
      
      const { metrics = [] } = data;
      
      metrics.forEach(metric => {
        connection.subscriptions.delete(metric);
        
        if (this.subscriptions.has(metric)) {
          this.subscriptions.get(metric).delete(connectionId);
          
          // Remove empty subscription lists
          if (this.subscriptions.get(metric).size === 0) {
            this.subscriptions.delete(metric);
          }
        }
      });
      
      this.metrics.subscriptions = Array.from(this.subscriptions.values())
        .reduce((total, connections) => total + connections.size, 0);
      
      connection.socket.emit('unsubscribed', {
        metrics: metrics,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error handling unsubscription:', error);
    }
  }
  
  /**
   * Handle metric requests
   */
  async handleMetricRequest(connectionId, data) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
      
      if (!this.checkRateLimit(connectionId)) {
        connection.socket.emit('error', { 
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }
      
      const { metricName, options = {} } = data;
      
      if (!metricName) {
        connection.socket.emit('error', {
          message: 'Metric name is required',
          code: 'MISSING_METRIC_NAME'
        });
        return;
      }
      
      // Get metric data from analytics engine
      const metricData = await this.analyticsEngine.getMetricAnalytics(
        metricName,
        options
      );
      
      connection.socket.emit('metric_data', {
        metricName,
        data: metricData,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error handling metric request:', error);
      
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.socket.emit('error', {
          message: 'Failed to get metric data',
          code: 'METRIC_REQUEST_ERROR'
        });
      }
    }
  }
  
  /**
   * Handle dashboard data requests
   */
  async handleDashboardRequest(connectionId, data) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
      
      if (!this.checkRateLimit(connectionId)) {
        connection.socket.emit('error', { 
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }
      
      const { options = {} } = data;
      
      // Get dashboard data from analytics engine
      const dashboardData = await this.analyticsEngine.getDashboardData(
        connection.userId,
        options
      );
      
      connection.socket.emit('dashboard_data', {
        data: dashboardData,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error handling dashboard request:', error);
      
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.socket.emit('error', {
          message: 'Failed to get dashboard data',
          code: 'DASHBOARD_REQUEST_ERROR'
        });
      }
    }
  }
  
  /**
   * Handle disconnection
   */
  handleDisconnection(connectionId, reason) {
    const span = OpenTelemetryTracing.getTracer('analytics-websocket')
      .startSpan('analytics_websocket_disconnection');
    
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
      
      // Clean up subscriptions
      connection.subscriptions.forEach(metric => {
        if (this.subscriptions.has(metric)) {
          this.subscriptions.get(metric).delete(connectionId);
          
          if (this.subscriptions.get(metric).size === 0) {
            this.subscriptions.delete(metric);
          }
        }
      });
      
      // Remove connection
      this.connections.delete(connectionId);
      this.metrics.connections--;
      this.metrics.subscriptions = Array.from(this.subscriptions.values())
        .reduce((total, connections) => total + connections.size, 0);
      
      SecurityAuditLogger.logSecurityEvent(
        'analytics_websocket_disconnected',
        `WebSocket connection closed: ${reason}`,
        { 
          connectionId, 
          userId: connection.userId,
          reason,
          duration: Date.now() - connection.connectedAt
        }
      );
      
      span.setAttributes({
        'disconnection.connection_id': connectionId,
        'disconnection.reason': reason,
        'disconnection.remaining_connections': this.metrics.connections
      });
      
    } catch (error) {
      console.error('Error handling disconnection:', error);
      span.setStatus({ code: 2, message: error.message });
    } finally {
      span.end();
    }
  }
  
  /**
   * Send initial data for subscribed metrics
   */
  async sendInitialData(connectionId, metrics, options) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
      
      for (const metric of metrics) {
        try {
          const data = await this.analyticsEngine.getMetricAnalytics(metric, options);
          
          connection.socket.emit('metrics_update', {
            [metric]: data
          });
          
        } catch (error) {
          console.error(`Error getting initial data for ${metric}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }
  
  /**
   * Start periodic updates for all subscriptions
   */
  startPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(async () => {
      await this.broadcastUpdates();
    }, 5000); // Update every 5 seconds
  }
  
  /**
   * Broadcast updates to all subscribed connections
   */
  async broadcastUpdates() {
    if (!this.analyticsEngine || this.subscriptions.size === 0) {
      return;
    }
    
    const span = OpenTelemetryTracing.getTracer('analytics-websocket')
      .startSpan('analytics_websocket_broadcast');
    
    try {
      // Get updates for all subscribed metrics
      const metricUpdates = {};
      
      for (const metric of this.subscriptions.keys()) {
        try {
          const data = await this.analyticsEngine.getRealtimeMetricData(metric);
          if (data) {
            metricUpdates[metric] = data;
          }
        } catch (error) {
          console.error(`Error getting realtime data for ${metric}:`, error);
        }
      }
      
      // Broadcast to subscribed connections
      for (const [metric, data] of Object.entries(metricUpdates)) {
        const subscribers = this.subscriptions.get(metric);
        if (subscribers) {
          subscribers.forEach(connectionId => {
            const connection = this.connections.get(connectionId);
            if (connection) {
              connection.socket.emit('metrics_update', {
                [metric]: data
              });
            }
          });
        }
      }
      
      // Broadcast system health to all connections
      if (this.connections.size > 0) {
        const systemHealth = await this.analyticsEngine.getSystemHealth();
        this.connections.forEach(connection => {
          connection.socket.emit('system_health', systemHealth);
        });
      }
      
      span.setAttributes({
        'broadcast.metrics_count': Object.keys(metricUpdates).length,
        'broadcast.connections_count': this.connections.size
      });
      
    } catch (error) {
      console.error('Error broadcasting updates:', error);
      span.setStatus({ code: 2, message: error.message });
    } finally {
      span.end();
    }
  }
  
  /**
   * Check rate limiting for a connection
   */
  checkRateLimit(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;
    
    const now = Date.now();
    const windowDuration = 1000; // 1 second
    
    // Reset window if expired
    if (now - connection.rateLimitWindow > windowDuration) {
      connection.rateLimitCount = 0;
      connection.rateLimitWindow = now;
    }
    
    // Check if within limits
    if (connection.rateLimitCount >= this.maxUpdatesPerSecond) {
      return false;
    }
    
    connection.rateLimitCount++;
    return true;
  }
  
  /**
   * Broadcast alert to relevant connections
   */
  broadcastAlert(alert) {
    if (!this.connections.size) return;
    
    try {
      this.connections.forEach(connection => {
        connection.socket.emit('alert', {
          ...alert,
          timestamp: Date.now()
        });
      });
      
      SecurityAuditLogger.logSecurityEvent(
        'analytics_alert_broadcast',
        `Alert broadcast to ${this.connections.size} connections`,
        { alert, connectionsCount: this.connections.size }
      );
      
    } catch (error) {
      console.error('Error broadcasting alert:', error);
    }
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      // Reset per-second counters
      this.metrics.messagesPerSecond = 0;
    }, 1000);
  }
  
  /**
   * Get handler status and metrics
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      metrics: { ...this.metrics },
      connections: this.connections.size,
      subscriptions: this.subscriptions.size,
      activeMetrics: Array.from(this.subscriptions.keys())
    };
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.connections.clear();
    this.subscriptions.clear();
    this.rateLimits.clear();
    
    if (this.io) {
      this.io.close();
    }
    
    this.isInitialized = false;
  }
}

export default AnalyticsWebSocketHandler;
