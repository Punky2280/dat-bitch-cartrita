/**
 * V2 System Monitoring & Health Endpoints
 * Comprehensive system monitoring, metrics, and health checks
 */

import { logger } from '../core/logger.js';
import os from 'os';
import process from 'process';

export async function systemMonitoringEndpoints(fastify, options) {
  const startTime = Date.now();
  
  // System metrics collection
  const systemMetrics = {
    requests: {
      total: 0,
      successful: 0,
      failed: 0,
      averageResponseTime: 0,
      responseTimeHistory: []
    },
    performance: {
      cpuUsage: [],
      memoryUsage: [],
      eventLoopDelay: []
    },
    services: {
      rag: { status: 'unknown', lastCheck: null },
      mcp: { status: 'unknown', lastCheck: null },
      langchain: { status: 'unknown', lastCheck: null },
      database: { status: 'unknown', lastCheck: null }
    }
  };

  // Add request tracking hooks
  fastify.addHook('onRequest', async (request, reply) => {
    request.startTime = Date.now();
    systemMetrics.requests.total++;
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = Date.now() - request.startTime;
    
    // Update response time metrics
    const currentAvg = systemMetrics.requests.averageResponseTime;
    const total = systemMetrics.requests.total;
    systemMetrics.requests.averageResponseTime = 
      (currentAvg * (total - 1) + responseTime) / total;
    
    // Keep last 100 response times
    systemMetrics.requests.responseTimeHistory.push(responseTime);
    if (systemMetrics.requests.responseTimeHistory.length > 100) {
      systemMetrics.requests.responseTimeHistory.shift();
    }
    
    // Track success/failure
    if (reply.statusCode < 400) {
      systemMetrics.requests.successful++;
    } else {
      systemMetrics.requests.failed++;
    }
  });

  // Periodic system metrics collection
  const metricsInterval = setInterval(() => {
    collectSystemMetrics();
  }, 5000); // Every 5 seconds

  fastify.addHook('onClose', () => {
    clearInterval(metricsInterval);
  });

  // GET /health - Basic health check
  fastify.get('/health', {
    schema: {
      tags: ['monitoring'],
      summary: 'Basic health check endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      version: '2.0.0'
    };
  });

  // GET /health/detailed - Comprehensive health check
  fastify.get('/health/detailed', {
    schema: {
      tags: ['monitoring'],
      summary: 'Detailed health check with service status'
    }
  }, async (request, reply) => {
    try {
      // Check all services
      const serviceChecks = await Promise.allSettled([
        checkRAGService(fastify),
        checkMCPService(fastify),
        checkLangChainService(fastify),
        checkDatabaseService(fastify)
      ]);

      const services = {
        rag: serviceChecks[0].status === 'fulfilled' ? serviceChecks[0].value : { status: 'error', error: serviceChecks[0].reason },
        mcp: serviceChecks[1].status === 'fulfilled' ? serviceChecks[1].value : { status: 'error', error: serviceChecks[1].reason },
        langchain: serviceChecks[2].status === 'fulfilled' ? serviceChecks[2].value : { status: 'error', error: serviceChecks[2].reason },
        database: serviceChecks[3].status === 'fulfilled' ? serviceChecks[3].value : { status: 'error', error: serviceChecks[3].reason }
      };

      const allHealthy = Object.values(services).every(service => service.status === 'healthy');
      const overallStatus = allHealthy ? 'healthy' : 'degraded';

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        version: '2.0.0',
        services,
        system: {
          memory: process.memoryUsage(),
          cpu: os.loadavg(),
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version
        }
      };
    } catch (error) {
      fastify.log.error('❌ Detailed health check failed:', error);
      return reply.status(503).send({
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /metrics - Prometheus-style metrics
  fastify.get('/metrics', {
    schema: {
      tags: ['monitoring'],
      summary: 'System metrics in Prometheus format'
    }
  }, async (request, reply) => {
    const metrics = [];
    const timestamp = Date.now();

    // Request metrics
    metrics.push(`# HELP cartrita_requests_total Total number of HTTP requests`);
    metrics.push(`# TYPE cartrita_requests_total counter`);
    metrics.push(`cartrita_requests_total ${systemMetrics.requests.total} ${timestamp}`);

    metrics.push(`# HELP cartrita_requests_successful_total Total number of successful HTTP requests`);
    metrics.push(`# TYPE cartrita_requests_successful_total counter`);
    metrics.push(`cartrita_requests_successful_total ${systemMetrics.requests.successful} ${timestamp}`);

    metrics.push(`# HELP cartrita_requests_failed_total Total number of failed HTTP requests`);
    metrics.push(`# TYPE cartrita_requests_failed_total counter`);
    metrics.push(`cartrita_requests_failed_total ${systemMetrics.requests.failed} ${timestamp}`);

    metrics.push(`# HELP cartrita_response_time_avg Average response time in milliseconds`);
    metrics.push(`# TYPE cartrita_response_time_avg gauge`);
    metrics.push(`cartrita_response_time_avg ${systemMetrics.requests.averageResponseTime} ${timestamp}`);

    // System metrics
    const memoryUsage = process.memoryUsage();
    metrics.push(`# HELP cartrita_memory_usage_bytes Memory usage by type`);
    metrics.push(`# TYPE cartrita_memory_usage_bytes gauge`);
    metrics.push(`cartrita_memory_usage_bytes{type="rss"} ${memoryUsage.rss} ${timestamp}`);
    metrics.push(`cartrita_memory_usage_bytes{type="heapUsed"} ${memoryUsage.heapUsed} ${timestamp}`);
    metrics.push(`cartrita_memory_usage_bytes{type="heapTotal"} ${memoryUsage.heapTotal} ${timestamp}`);
    metrics.push(`cartrita_memory_usage_bytes{type="external"} ${memoryUsage.external} ${timestamp}`);

    metrics.push(`# HELP cartrita_uptime_seconds System uptime in seconds`);
    metrics.push(`# TYPE cartrita_uptime_seconds gauge`);
    metrics.push(`cartrita_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)} ${timestamp}`);

    // Service status metrics
    for (const [serviceName, serviceData] of Object.entries(systemMetrics.services)) {
      const status = serviceData.status === 'healthy' ? 1 : 0;
      metrics.push(`cartrita_service_status{service="${serviceName}"} ${status} ${timestamp}`);
    }

    reply.header('Content-Type', 'text/plain');
    return metrics.join('\n');
  });

  // GET /metrics/detailed - Detailed JSON metrics
  fastify.get('/metrics/detailed', {
    schema: {
      tags: ['monitoring'],
      summary: 'Detailed system metrics in JSON format'
    }
  }, async (request, reply) => {
    const currentMetrics = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      requests: {
        ...systemMetrics.requests,
        successRate: systemMetrics.requests.total > 0 ? 
          (systemMetrics.requests.successful / systemMetrics.requests.total) * 100 : 0,
        errorRate: systemMetrics.requests.total > 0 ? 
          (systemMetrics.requests.failed / systemMetrics.requests.total) * 100 : 0
      },
      system: {
        memory: {
          process: process.memoryUsage(),
          system: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
          }
        },
        cpu: {
          usage: process.cpuUsage(),
          loadAverage: os.loadavg(),
          cores: os.cpus().length
        },
        platform: {
          type: os.type(),
          platform: os.platform(),
          arch: os.arch(),
          release: os.release(),
          hostname: os.hostname()
        },
        node: {
          version: process.version,
          pid: process.pid,
          title: process.title
        }
      },
      services: systemMetrics.services,
      performance: {
        responseTimePercentiles: calculatePercentiles(systemMetrics.requests.responseTimeHistory),
        cpuTrend: systemMetrics.performance.cpuUsage.slice(-20), // Last 20 measurements
        memoryTrend: systemMetrics.performance.memoryUsage.slice(-20)
      }
    };

    return {
      success: true,
      data: currentMetrics
    };
  });

  // GET /status/services - Service status overview
  fastify.get('/status/services', {
    schema: {
      tags: ['monitoring'],
      summary: 'Overview of all service statuses'
    }
  }, async (request, reply) => {
    try {
      // Get status from all services
      const ragService = fastify.services?.ragService;
      const mcpService = fastify.services?.mcpService;
      const langchainService = fastify.services?.langchainService;

      const serviceStatuses = {
        rag: ragService ? ragService.getStatus() : { status: 'not_available' },
        mcp: mcpService ? mcpService.getStatus() : { status: 'not_available' },
        langchain: langchainService ? langchainService.getStatus() : { status: 'not_available' },
        webSocket: fastify.broadcast ? { status: 'available' } : { status: 'not_available' },
        database: { status: 'checking...' } // Will be updated by health check
      };

      // Update database status
      try {
        await checkDatabaseService(fastify);
        serviceStatuses.database = { status: 'healthy' };
      } catch (error) {
        serviceStatuses.database = { status: 'error', error: error.message };
      }

      const healthyServices = Object.values(serviceStatuses).filter(
        service => service.status === 'healthy' || service.status === 'available'
      ).length;

      return {
        success: true,
        data: {
          services: serviceStatuses,
          summary: {
            total: Object.keys(serviceStatuses).length,
            healthy: healthyServices,
            degraded: Object.keys(serviceStatuses).length - healthyServices
          },
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      fastify.log.error('❌ Service status check failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check service status'
      });
    }
  });

  // GET /logs/recent - Recent application logs
  fastify.get('/logs/recent', {
    schema: {
      tags: ['monitoring'],
      summary: 'Get recent application logs',
      querystring: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
          since: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    const { level, limit = 100, since } = request.query;
    
    try {
      // In a real implementation, this would read from log files or log aggregation service
      // For now, return mock recent logs
      const mockLogs = Array.from({ length: Math.min(limit, 50) }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        level: ['info', 'warn', 'error', 'debug'][Math.floor(Math.random() * 4)],
        message: `Sample log message ${i + 1}`,
        service: ['api', 'rag', 'mcp', 'langchain'][Math.floor(Math.random() * 4)],
        metadata: { requestId: `req_${i}`, userId: 'user123' }
      })).filter(log => !level || log.level === level);

      return {
        success: true,
        data: {
          logs: mockLogs,
          total: mockLogs.length,
          filters: { level, limit, since },
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to retrieve logs:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve logs'
      });
    }
  });

  // POST /admin/gc - Trigger garbage collection (admin only)
  fastify.post('/admin/gc', {
    schema: {
      tags: ['monitoring'],
      summary: 'Trigger garbage collection (admin only)',
      security: [{ BearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      if (global.gc) {
        const beforeMemory = process.memoryUsage();
        global.gc();
        const afterMemory = process.memoryUsage();
        
        fastify.log.info('🧹 Manual garbage collection triggered', {
          beforeHeapUsed: beforeMemory.heapUsed,
          afterHeapUsed: afterMemory.heapUsed,
          memoryFreed: beforeMemory.heapUsed - afterMemory.heapUsed
        });
        
        return {
          success: true,
          data: {
            memoryBefore: beforeMemory,
            memoryAfter: afterMemory,
            memoryFreed: beforeMemory.heapUsed - afterMemory.heapUsed,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        return reply.status(503).send({
          success: false,
          error: 'Garbage collection not available (start with --expose-gc)'
        });
      }
    } catch (error) {
      fastify.log.error('❌ Garbage collection failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Garbage collection failed'
      });
    }
  });

  // Helper functions
  function collectSystemMetrics() {
    // CPU usage
    const cpuUsage = process.cpuUsage();
    systemMetrics.performance.cpuUsage.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    systemMetrics.performance.memoryUsage.push({
      timestamp: Date.now(),
      ...memoryUsage
    });
    
    // Keep only last 100 measurements
    if (systemMetrics.performance.cpuUsage.length > 100) {
      systemMetrics.performance.cpuUsage.shift();
    }
    if (systemMetrics.performance.memoryUsage.length > 100) {
      systemMetrics.performance.memoryUsage.shift();
    }
  }

  async function checkRAGService(fastify) {
    try {
      const ragService = fastify.services?.ragService;
      if (!ragService) {
        return { status: 'not_available', message: 'RAG service not initialized' };
      }
      
      const status = ragService.getStatus();
      return {
        status: status.initialized ? 'healthy' : 'initializing',
        details: {
          version: status.version,
          knowledgeBaseSize: status.metrics?.knowledgeBaseSize || 0,
          cacheSize: status.cacheSize || 0
        }
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  async function checkMCPService(fastify) {
    try {
      const mcpService = fastify.services?.mcpService;
      if (!mcpService) {
        return { status: 'not_available', message: 'MCP service not initialized' };
      }
      
      const status = mcpService.getStatus();
      return {
        status: status.initialized ? 'healthy' : 'initializing',
        details: {
          agents: status.agents || 0,
          queueSize: status.queueSize || 0,
          messagesProcessed: status.performanceMetrics?.messagesProcessed || 0
        }
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  async function checkLangChainService(fastify) {
    try {
      const langchainService = fastify.services?.langchainService;
      if (!langchainService) {
        return { status: 'not_available', message: 'LangChain service not initialized' };
      }
      
      const status = langchainService.getStatus();
      return {
        status: status.initialized ? 'healthy' : 'initializing',
        details: {
          workflows: status.components?.workflows || 0,
          agents: status.components?.agents || 0,
          activeWorkflows: status.activeWorkflows?.length || 0
        }
      };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  async function checkDatabaseService(fastify) {
    try {
      // Simple database connectivity check
      const db = fastify.db || fastify.pool;
      if (!db) {
        return { status: 'not_available', message: 'Database connection not available' };
      }
      
      // Try a simple query
      await db.query('SELECT 1 as health_check');
      return { status: 'healthy', message: 'Database connection successful' };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  function calculatePercentiles(values) {
    if (values.length === 0) return {};
    
    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      p50: sorted[Math.floor(len * 0.5)],
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      min: sorted[0],
      max: sorted[len - 1]
    };
  }

  logger.info('✅ System monitoring endpoints registered');
}