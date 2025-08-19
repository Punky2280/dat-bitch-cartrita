/**
 * Cartrita V2 - Health Check Routes
 * Comprehensive health monitoring for all system components
 */

import express from 'express';
import { healthCheck as dbHealthCheck } from '../database/connection.js';
import { healthCheck as redisHealthCheck } from '../redis/connection.js';
import { logger } from '../utils/logger.js';
import { trace } from '@opentelemetry/api';

const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
  const span = trace.getActiveTracer('cartrita-v2').startSpan('health.check');
  
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0',
      environment: process.env.NODE_ENV,
      services: {}
    };

    // Check database health
    try {
      health.services.database = await dbHealthCheck();
    } catch (error) {
      health.services.database = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Check Redis health
    try {
      health.services.redis = await redisHealthCheck();
    } catch (error) {
      health.services.redis = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    health.system = {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      cpu: {
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
      }
    };

    // Determine overall health status
    const unhealthyServices = Object.values(health.services)
      .filter(service => service.status === 'unhealthy').length;
    
    if (unhealthyServices > 0) {
      health.status = unhealthyServices === Object.keys(health.services).length ? 'unhealthy' : 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    span.setAttributes({
      'health.status': health.status,
      'health.services.count': Object.keys(health.services).length,
      'health.services.unhealthy': unhealthyServices
    });

    span.setStatus({ code: statusCode === 200 ? 1 : 2 });
    res.status(statusCode).json(health);
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    span.end();
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req, res) => {
  const span = trace.getActiveTracer('cartrita-v2').startSpan('health.readiness');
  
  try {
    // Check critical dependencies
    const [dbHealth, redisHealth] = await Promise.allSettled([
      dbHealthCheck(),
      redisHealthCheck()
    ]);

    const isReady = dbHealth.status === 'fulfilled' && 
                   redisHealth.status === 'fulfilled' &&
                   dbHealth.value?.status === 'healthy' &&
                   redisHealth.value?.status === 'healthy';

    if (isReady) {
      span.setStatus({ code: 1 });
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      span.setStatus({ code: 2, message: 'Not ready' });
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reasons: [
          ...(dbHealth.status === 'rejected' ? ['database_unavailable'] : []),
          ...(redisHealth.status === 'rejected' ? ['redis_unavailable'] : [])
        ]
      });
    }
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    span.end();
  }
});

export { router as healthRouter };