/**
 * @fileoverview Performance Monitoring Service
 * Service layer for performance monitoring integration
 */

import { getPerformanceMonitoringSuite } from '../system/PerformanceMonitoringSuite.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

export class PerformanceMonitoringService {
  constructor() {
    this.performanceMonitoring = null;
    this.initialized = false;
    
    console.log('[PerformanceMonitoringService] ✅ Service created');
  }
  
  /**
   * Initialize performance monitoring service
   */
  async initialize(options = {}) {
    try {
      // Get performance monitoring suite instance
      this.performanceMonitoring = getPerformanceMonitoringSuite({
        thresholds: {
          responseTime: 2000, // 2s
          errorRate: 0.05, // 5%
          memoryUsage: 0.85, // 85%
          cpuUsage: 0.80, // 80%
          diskUsage: 0.90, // 90%
          dbConnectionTimeout: 5000, // 5s
          ...options.thresholds
        },
        
        alerts: {
          enabled: true,
          channels: ['console', 'webhook'],
          cooldown: 300000, // 5 minutes
          ...options.alerts
        },
        
        ...options
      });
      
      // Initialize with OpenTelemetry integration
      const otelTracing = await OpenTelemetryTracing.getStatus();
      await this.performanceMonitoring.initialize(
        otelTracing.initialized ? OpenTelemetryTracing : null
      );
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      
      console.log('[PerformanceMonitoringService] 🚀 Service initialized');
      return true;
      
    } catch (error) {
      console.error('[PerformanceMonitoringService] ❌ Initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Set up event listeners for performance monitoring
   */
  setupEventListeners() {
    if (!this.performanceMonitoring) return;
    
    this.performanceMonitoring.on('alert:triggered', (alert) => {
      console.warn(`[PerformanceMonitoringService] 🚨 Alert: ${alert.metric} = ${alert.value} (threshold: ${alert.threshold})`);
      
      // Here you could integrate with external alerting systems
      // this.sendSlackAlert(alert);
      // this.sendEmailAlert(alert);
      // this.sendWebhookAlert(alert);
    });
    
    this.performanceMonitoring.on('alert:resolved', (alert) => {
      console.log(`[PerformanceMonitoringService] ✅ Alert resolved: ${alert.metric}`);
    });
    
    this.performanceMonitoring.on('optimization:recommendations', (recommendations) => {
      console.log(`[PerformanceMonitoringService] 💡 Optimization recommendations:`, 
        recommendations.map(r => r.recommendation));
    });
    
    this.performanceMonitoring.on('metric:recorded', (metric) => {
      // Optional: Log high-priority metrics
      if (['system.cpu_usage', 'system.memory_usage', 'app.error_rate'].includes(metric.name) && 
          metric.value > 80) {
        console.warn(`[PerformanceMonitoringService] ⚠️ High ${metric.name}: ${metric.value}${metric.unit}`);
      }
    });
    
    console.log('[PerformanceMonitoringService] ✅ Event listeners configured');
  }
  
  /**
   * Record a custom performance metric
   */
  recordMetric(name, value, unit = '', labels = {}) {
    if (!this.initialized || !this.performanceMonitoring) {
      console.warn('[PerformanceMonitoringService] Service not initialized, metric recording skipped');
      return false;
    }
    
    try {
      this.performanceMonitoring.recordMetric(name, value, unit, labels);
      return true;
    } catch (error) {
      console.error('[PerformanceMonitoringService] Metric recording failed:', error);
      return false;
    }
  }
  
  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method, path, statusCode, duration, userId = null) {
    this.recordMetric('http.requests', 1, 'requests', { 
      method, 
      path: this.sanitizePath(path), 
      status_code: statusCode,
      user_id: userId 
    });
    
    this.recordMetric('http.response_time', duration, 'ms', { 
      method, 
      path: this.sanitizePath(path), 
      status_code: statusCode 
    });
    
    // Track error rates
    if (statusCode >= 400) {
      this.recordMetric('http.errors', 1, 'errors', { 
        method, 
        path: this.sanitizePath(path), 
        status_code: statusCode 
      });
    }
  }
  
  /**
   * Record agent operation metrics
   */
  recordAgentOperation(agentType, operation, duration, success = true, userId = null) {
    this.recordMetric('agent.operations', 1, 'operations', {
      agent_type: agentType,
      operation,
      success: success.toString(),
      user_id: userId
    });
    
    this.recordMetric('agent.execution_time', duration, 'ms', {
      agent_type: agentType,
      operation
    });
    
    if (!success) {
      this.recordMetric('agent.errors', 1, 'errors', {
        agent_type: agentType,
        operation
      });
    }
  }
  
  /**
   * Record database operation metrics
   */
  recordDatabaseOperation(operation, table, duration, success = true) {
    this.recordMetric('db.operations', 1, 'operations', {
      operation,
      table,
      success: success.toString()
    });
    
    this.recordMetric('db.query_duration', duration, 'ms', {
      operation,
      table
    });
    
    if (!success) {
      this.recordMetric('db.errors', 1, 'errors', {
        operation,
        table
      });
    }
  }
  
  /**
   * Record WebSocket metrics
   */
  recordWebSocketMetrics(event, connectionCount, latency = null) {
    this.recordMetric('websocket.events', 1, 'events', { event });
    this.recordMetric('websocket.connections', connectionCount, 'connections');
    
    if (latency !== null) {
      this.recordMetric('websocket.latency', latency, 'ms', { event });
    }
  }
  
  /**
   * Record workflow execution metrics
   */
  recordWorkflowExecution(workflowId, duration, nodeCount, success = true, userId = null) {
    this.recordMetric('workflow.executions', 1, 'executions', {
      workflow_id: workflowId,
      success: success.toString(),
      user_id: userId
    });
    
    this.recordMetric('workflow.execution_time', duration, 'ms', {
      workflow_id: workflowId
    });
    
    this.recordMetric('workflow.node_count', nodeCount, 'nodes', {
      workflow_id: workflowId
    });
    
    if (!success) {
      this.recordMetric('workflow.errors', 1, 'errors', {
        workflow_id: workflowId
      });
    }
  }
  
  /**
   * Get performance dashboard data
   */
  async getDashboardData() {
    if (!this.initialized || !this.performanceMonitoring) {
      return {
        status: 'not_initialized',
        message: 'Performance monitoring service not initialized'
      };
    }
    
    try {
      const dashboardData = await this.performanceMonitoring.getDashboardData();
      
      return {
        status: 'active',
        data: dashboardData,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[PerformanceMonitoringService] Dashboard data retrieval failed:', error);
      return {
        status: 'error',
        message: 'Failed to retrieve dashboard data',
        error: error.message
      };
    }
  }
  
  /**
   * Get system health status
   */
  async getSystemHealth() {
    if (!this.initialized || !this.performanceMonitoring) {
      return {
        status: 'unknown',
        health: 'not_monitored'
      };
    }
    
    try {
      const dashboardData = await this.performanceMonitoring.getDashboardData();
      const metrics = dashboardData.metrics;
      
      // Calculate overall health score (0-100)
      let healthScore = 100;
      let status = 'healthy';
      
      // CPU health
      if (metrics.system.cpu > 90) {
        healthScore -= 30;
        status = 'critical';
      } else if (metrics.system.cpu > 80) {
        healthScore -= 15;
        status = status === 'healthy' ? 'warning' : status;
      }
      
      // Memory health
      if (metrics.system.memory > 90) {
        healthScore -= 30;
        status = 'critical';
      } else if (metrics.system.memory > 85) {
        healthScore -= 15;
        status = status === 'healthy' ? 'warning' : status;
      }
      
      // Error rate health
      if (metrics.application.errorRate > 10) {
        healthScore -= 40;
        status = 'critical';
      } else if (metrics.application.errorRate > 5) {
        healthScore -= 20;
        status = status === 'healthy' ? 'warning' : status;
      }
      
      // Response time health
      if (metrics.application.responseTime > 5000) {
        healthScore -= 25;
        status = status === 'healthy' ? 'warning' : status;
      } else if (metrics.application.responseTime > 2000) {
        healthScore -= 10;
        status = status === 'healthy' ? 'warning' : status;
      }
      
      return {
        status,
        health: Math.max(0, healthScore),
        metrics: {
          cpu: metrics.system.cpu,
          memory: metrics.system.memory,
          disk: metrics.system.disk,
          responseTime: metrics.application.responseTime,
          errorRate: metrics.application.errorRate,
          throughput: metrics.application.throughput
        },
        alerts: dashboardData.alerts.count,
        uptime: dashboardData.uptime
      };
      
    } catch (error) {
      console.error('[PerformanceMonitoringService] System health check failed:', error);
      return {
        status: 'error',
        health: 0,
        message: 'Health check failed'
      };
    }
  }
  
  /**
   * Get active alerts
   */
  async getActiveAlerts() {
    if (!this.initialized || !this.performanceMonitoring) {
      return [];
    }
    
    try {
      const dashboardData = await this.performanceMonitoring.getDashboardData();
      return dashboardData.alerts.active || [];
    } catch (error) {
      console.error('[PerformanceMonitoringService] Active alerts retrieval failed:', error);
      return [];
    }
  }
  
  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations() {
    if (!this.initialized || !this.performanceMonitoring) {
      return [];
    }
    
    try {
      const dashboardData = await this.performanceMonitoring.getDashboardData();
      return dashboardData.recommendations || [];
    } catch (error) {
      console.error('[PerformanceMonitoringService] Recommendations retrieval failed:', error);
      return [];
    }
  }
  
  /**
   * Update monitoring configuration
   */
  async updateConfiguration(config) {
    if (!this.initialized || !this.performanceMonitoring) {
      return false;
    }
    
    try {
      // Update thresholds
      if (config.thresholds) {
        Object.assign(this.performanceMonitoring.config.thresholds, config.thresholds);
      }
      
      // Update alert configuration
      if (config.alerts) {
        Object.assign(this.performanceMonitoring.config.alerts, config.alerts);
      }
      
      console.log('[PerformanceMonitoringService] ✅ Configuration updated');
      return true;
      
    } catch (error) {
      console.error('[PerformanceMonitoringService] Configuration update failed:', error);
      return false;
    }
  }
  
  /**
   * Sanitize path for metrics (remove IDs, etc.)
   */
  sanitizePath(path) {
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9]{24}/g, '/:id')
      .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, '/:uuid');
  }
  
  /**
   * Get monitoring status
   */
  getStatus() {
    if (!this.performanceMonitoring) {
      return {
        initialized: false,
        active: false,
        message: 'Performance monitoring not initialized'
      };
    }
    
    return {
      initialized: this.initialized,
      ...this.performanceMonitoring.getStatus()
    };
  }
  
  /**
   * Stop performance monitoring
   */
  async stop() {
    if (!this.performanceMonitoring) {
      return true;
    }
    
    try {
      await this.performanceMonitoring.stop();
      this.initialized = false;
      
      console.log('[PerformanceMonitoringService] 🛑 Service stopped');
      return true;
      
    } catch (error) {
      console.error('[PerformanceMonitoringService] Stop failed:', error);
      return false;
    }
  }
}

// Export singleton instance
let performanceServiceInstance = null;

export function getPerformanceMonitoringService() {
  if (!performanceServiceInstance) {
    performanceServiceInstance = new PerformanceMonitoringService();
  }
  return performanceServiceInstance;
}

export default PerformanceMonitoringService;
