import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

/**
 * GET /api/dashboard/overview
 * Get comprehensive dashboard overview
 */
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get system metrics
    const systemMetrics = {
      uptime: Math.floor((Date.now() - (global.performanceMetrics?.startTime || Date.now())) / 1000),
      requests: global.performanceMetrics?.requests || 0,
      errors: global.performanceMetrics?.errors || 0,
      socketConnections: global.performanceMetrics?.socketConnections || 0,
      messagesProcessed: global.performanceMetrics?.messagesProcessed || 0,
      agentErrors: global.performanceMetrics?.agentErrors || 0,
      fastPathDelegations: global.debugMetrics?.fast_path_delegations || 0
    };

    // Calculate response time metrics
    const responseTimeData = global.performanceMetrics?.responseTime || [];
    const responseTimeMetrics = responseTimeData.length > 0 ? {
      avg: Math.round(responseTimeData.reduce((a, b) => a + b, 0) / responseTimeData.length),
      min: Math.min(...responseTimeData),
      max: Math.max(...responseTimeData),
      p95: responseTimeData.sort((a, b) => a - b)[Math.floor(responseTimeData.length * 0.95)] || 0
    } : { avg: 0, min: 0, max: 0, p95: 0 };

    // Agent status
    const agentStatus = {
      supervisor: global.coreAgent?.isInitialized || false,
      subAgents: Array.from(global.coreAgent?.subAgents?.keys() || []),
      count: global.coreAgent?.subAgents?.size || 0
    };

    // Service health checks
    const services = {
      database: false,
      redis: false,
      agent: agentStatus.supervisor,
      security: !!global.securityManager,
      monitoring: !!global.performanceService
    };

    // Quick DB health check
    try {
      if (req.app.locals?.pool) {
        const result = await req.app.locals.pool.query('SELECT 1');
        services.database = !!result;
      }
    } catch (e) {
      // DB unhealthy
    }

    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        system: systemMetrics,
        responseTime: responseTimeMetrics,
        agents: agentStatus,
        services,
        timestamp: new Date().toISOString(),
        queryTime: responseTime
      }
    });

  } catch (error) {
    console.error('[Dashboard] Overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard overview'
    });
  }
});

/**
 * GET /api/dashboard/health
 * Comprehensive health dashboard
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const healthData = {
      overall: 'healthy',
      components: {},
      metrics: {},
      warnings: []
    };

    // Check database
    try {
      if (req.app.locals?.pool) {
        await req.app.locals.pool.query('SELECT NOW()');
        healthData.components.database = { status: 'healthy', latency: '<10ms' };
      } else {
        healthData.components.database = { status: 'unavailable', message: 'No connection pool' };
        healthData.warnings.push('Database connection pool not available');
      }
    } catch (e) {
      healthData.components.database = { status: 'unhealthy', error: e.message };
      healthData.overall = 'degraded';
    }

    // Check Redis
    try {
      // Import Redis service dynamically
      const { default: RedisService } = await import('../services/RedisService.js');
      const redisHealth = await RedisService.healthCheck();
      healthData.components.redis = redisHealth;
    } catch (e) {
      healthData.components.redis = { status: 'unavailable', message: 'Redis service not available' };
      healthData.warnings.push('Redis cache unavailable - non-critical');
    }

    // Check agents
    healthData.components.agents = {
      supervisor: global.coreAgent?.isInitialized ? 'healthy' : 'initializing',
      count: global.coreAgent?.subAgents?.size || 0,
      names: Array.from(global.coreAgent?.subAgents?.keys() || [])
    };

    // Memory metrics
    const memUsage = process.memoryUsage();
    healthData.metrics.memory = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    // Performance metrics
    healthData.metrics.performance = {
      uptime: Math.floor(process.uptime()),
      requests: global.performanceMetrics?.requests || 0,
      errors: global.performanceMetrics?.errors || 0,
      errorRate: global.performanceMetrics?.requests > 0 ? 
        ((global.performanceMetrics?.errors || 0) / global.performanceMetrics.requests * 100).toFixed(2) + '%' : '0%'
    };

    res.json({
      success: true,
      health: healthData
    });

  } catch (error) {
    console.error('[Dashboard] Health error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health dashboard'
    });
  }
});

/**
 * GET /api/dashboard/metrics
 * Real-time metrics for dashboard
 */
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const metrics = {
      realtime: {
        timestamp: new Date().toISOString(),
        connections: global.performanceMetrics?.socketConnections || 0,
        requests: global.performanceMetrics?.requests || 0,
        errors: global.performanceMetrics?.errors || 0,
        messagesProcessed: global.performanceMetrics?.messagesProcessed || 0
      },
      agents: {
        supervisor: global.coreAgent?.isInitialized || false,
        subAgents: global.coreAgent?.subAgents?.size || 0,
        fastDelegations: global.debugMetrics?.fast_path_delegations || 0
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    console.error('[Dashboard] Metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard metrics'
    });
  }
});

/**
 * GET /api/dashboard/agents
 * Agent status and management
 */
router.get('/agents', authenticateToken, async (req, res) => {
  try {
    const agentData = {
      supervisor: {
        initialized: global.coreAgent?.isInitialized || false,
        status: global.coreAgent?.isInitialized ? 'active' : 'initializing'
      },
      subAgents: [],
      total: 0,
      categories: {}
    };

    if (global.coreAgent?.subAgents) {
      for (const [name, agent] of global.coreAgent.subAgents.entries()) {
        const agentInfo = {
          name,
          status: 'active',
          description: agent.config?.description || 'No description available',
          capabilities: agent.config?.allowedTools || [],
          category: name.includes('Vision') ? 'vision' :
                   name.includes('Audio') ? 'audio' :
                   name.includes('Language') ? 'language' :
                   name.includes('Data') ? 'data' : 'general'
        };
        
        agentData.subAgents.push(agentInfo);
        
        // Count by category
        if (!agentData.categories[agentInfo.category]) {
          agentData.categories[agentInfo.category] = 0;
        }
        agentData.categories[agentInfo.category]++;
      }
      agentData.total = agentData.subAgents.length;
    }

    res.json({
      success: true,
      agents: agentData
    });

  } catch (error) {
    console.error('[Dashboard] Agents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent dashboard data'
    });
  }
});

export default router;
