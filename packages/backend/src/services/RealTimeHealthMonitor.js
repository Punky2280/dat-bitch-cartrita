/**
 * Real-Time Health Monitor - WebSocket-based health metrics broadcasting
 * Provides live system health updates to connected clients
 */

import os from 'os';
import db from '../db.js';

class RealTimeHealthMonitor {
  constructor(io) {
    this.io = io;
    this.healthMetrics = new Map();
    this.lastMetrics = null;
    this.broadcastInterval = null;
    this.updateInterval = 5000; // 5 seconds
    this.connectedClients = new Set();
    
    this.metricsHistory = {
      cpu: [],
      memory: [],
      database: [],
      apiLatency: [],
      errorRate: []
    };
    
    this.maxHistorySize = 60; // Keep 5 minutes of data
  }

  startMonitoring() {
    console.log('🔬 [RealTimeHealthMonitor] Starting real-time health monitoring...');
    
    // Start collecting metrics
    this.broadcastInterval = setInterval(() => {
      this.collectAndBroadcastMetrics();
    }, this.updateInterval);
    
    // Setup WebSocket namespace for health monitoring
    this.setupHealthSocket();
  }

  stopMonitoring() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    console.log('⏹️ [RealTimeHealthMonitor] Health monitoring stopped');
  }

  setupHealthSocket() {
    const healthNamespace = this.io.of('/health');
    
    healthNamespace.on('connection', (socket) => {
      console.log(`[RealTimeHealth] Client connected: ${socket.id}`);
      this.connectedClients.add(socket.id);
      
      // Send current metrics immediately
      if (this.lastMetrics) {
        socket.emit('health_update', this.lastMetrics);
      }
      
      // Send historical data
      socket.emit('health_history', this.metricsHistory);
      
      socket.on('disconnect', () => {
        console.log(`[RealTimeHealth] Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
      
      socket.on('request_metrics', () => {
        if (this.lastMetrics) {
          socket.emit('health_update', this.lastMetrics);
        }
      });
    });
  }

  async collectAndBroadcastMetrics() {
    try {
      const metrics = await this.collectMetrics();
      this.updateMetricsHistory(metrics);
      this.lastMetrics = metrics;
      
      // Broadcast to all connected clients
      if (this.connectedClients.size > 0) {
        this.io.of('/health').emit('health_update', metrics);
      }
    } catch (error) {
      console.error('[RealTimeHealth] Error collecting metrics:', error);
    }
  }

  async collectMetrics() {
    const timestamp = Date.now();
    
    // System metrics
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // Database metrics
    const dbMetrics = await this.getDatabaseMetrics();
    
    // API metrics (from performance tracking)
    const apiMetrics = this.getAPIMetrics();
    
    return {
      timestamp,
      system: {
        cpu: Math.round(cpuUsage * 100) / 100,
        memory: Math.round(memoryUsage * 100) / 100,
        uptime: process.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      },
      database: dbMetrics,
      api: apiMetrics,
      health_score: this.calculateHealthScore(cpuUsage, memoryUsage, dbMetrics, apiMetrics)
    };
  }

  async getDatabaseMetrics() {
    try {
      // Get database connection count
      const connectionResult = await db.query(
        "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'"
      );
      
      // Get database size
      const sizeResult = await db.query(
        "SELECT pg_database_size(current_database()) as database_size"
      );
      
      // Get table statistics
      const tableStatsResult = await db.query(`
        SELECT 
          schemaname,
          relname as tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          seq_scan as sequential_scans,
          idx_scan as index_scans
        FROM pg_stat_user_tables 
        ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC 
        LIMIT 5
      `);
      
      return {
        active_connections: parseInt(connectionResult.rows[0]?.active_connections || 0),
        database_size: parseInt(sizeResult.rows[0]?.database_size || 0),
        table_stats: tableStatsResult.rows || [],
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('[RealTimeHealth] Database metrics error:', error);
      return {
        active_connections: 0,
        database_size: 0,
        table_stats: [],
        error: error.message,
        last_updated: new Date().toISOString()
      };
    }
  }

  getAPIMetrics() {
    // This would integrate with the existing performance metrics from index.js
    return {
      total_requests: global.performanceMetrics?.requestsProcessed || 0,
      active_socket_connections: global.performanceMetrics?.socketConnections || 0,
      messages_processed: global.performanceMetrics?.messagesProcessed || 0,
      errors: global.performanceMetrics?.errors || 0,
      average_response_time: this.calculateAverageResponseTime(),
      error_rate: this.calculateErrorRate()
    };
  }

  calculateAverageResponseTime() {
    // This would be enhanced with actual response time tracking
    return Math.random() * 100 + 50; // Mock for now - would integrate with real metrics
  }

  calculateErrorRate() {
    const metrics = global.performanceMetrics;
    if (!metrics || !metrics.requestsProcessed) return 0;
    return (metrics.errors / metrics.requestsProcessed) * 100;
  }

  calculateHealthScore(cpu, memory, dbMetrics, apiMetrics) {
    let score = 100;
    
    // Deduct points for high resource usage
    if (cpu > 80) score -= 20;
    else if (cpu > 60) score -= 10;
    
    if (memory > 90) score -= 25;
    else if (memory > 70) score -= 10;
    
    // Deduct points for database issues
    if (dbMetrics.active_connections > 50) score -= 15;
    if (dbMetrics.error) score -= 30;
    
    // Deduct points for API issues
    if (apiMetrics.error_rate > 5) score -= 20;
    else if (apiMetrics.error_rate > 1) score -= 10;
    
    return Math.max(0, Math.round(score));
  }

  updateMetricsHistory(metrics) {
    // Update CPU history
    this.metricsHistory.cpu.push({
      timestamp: metrics.timestamp,
      value: metrics.system.cpu
    });
    
    // Update memory history
    this.metricsHistory.memory.push({
      timestamp: metrics.timestamp,
      value: metrics.system.memory
    });
    
    // Update database connections history
    this.metricsHistory.database.push({
      timestamp: metrics.timestamp,
      value: metrics.database.active_connections
    });
    
    // Update API latency history (mock for now)
    this.metricsHistory.apiLatency.push({
      timestamp: metrics.timestamp,
      value: metrics.api.average_response_time
    });
    
    // Update error rate history
    this.metricsHistory.errorRate.push({
      timestamp: metrics.timestamp,
      value: metrics.api.error_rate
    });
    
    // Trim history to max size
    Object.keys(this.metricsHistory).forEach(key => {
      if (this.metricsHistory[key].length > this.maxHistorySize) {
        this.metricsHistory[key] = this.metricsHistory[key].slice(-this.maxHistorySize);
      }
    });
  }

  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  getCurrentMetrics() {
    return this.lastMetrics;
  }

  getMetricsHistory() {
    return this.metricsHistory;
  }
}

export default RealTimeHealthMonitor;