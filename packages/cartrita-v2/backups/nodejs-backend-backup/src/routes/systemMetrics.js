import express from 'express';
import os from 'os';

const router = express.Router();

// Simple fallback tracing function
const traceOperation = (name, fn) => {
  console.log(`[SystemMetrics] Executing: ${name}`);
  return fn();
};

// System metrics collection service
class SystemMetricsService {
  constructor() {
    this.startTime = Date.now();
    this.lastMetricsCollection = null;
  }

  async collectSystemMetrics() {
    return await traceOperation('system.metrics.collect', async () => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAverage = os.loadavg();
      const freeMemory = os.freemem();
      const totalMemory = os.totalmem();
      const uptime = process.uptime();

      const metrics = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: uptime,
          loadAverage: {
            '1m': loadAverage[0],
            '5m': loadAverage[1],
            '15m': loadAverage[2],
          },
          memory: {
            total: totalMemory,
            free: freeMemory,
            used: totalMemory - freeMemory,
            usagePercent: (
              ((totalMemory - freeMemory) / totalMemory) *
              100
            ).toFixed(2),
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
            cores: os.cpus().length,
          },
        },
        process: {
          memory: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external,
            arrayBuffers: memoryUsage.arrayBuffers,
          },
          pid: process.pid,
          version: process.version,
          uptime: uptime,
        },
        services: {
          database: { status: 'checking' },
          redis: { status: 'checking' },
          agents: { status: 'checking' },
        },
      };

      this.lastMetricsCollection = metrics;
      return metrics;
    });
  }

  getLastMetrics() {
    return this.lastMetricsCollection;
  }
}

const metricsService = new SystemMetricsService();

// GET /api/system/metrics - Comprehensive system metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsService.collectSystemMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('System metrics collection failed:', error);
    res
      .status(500)
      .json({ success: false, error: 'Metrics collection failed' });
  }
});

// GET /api/system/health - Enhanced health check
router.get('/health', (req, res) => {
  const lastMetrics = metricsService.getLastMetrics();
  const basicHealth = {
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    services: lastMetrics?.services || {
      database: { status: 'unknown' },
      redis: { status: 'unknown' },
      agents: { status: 'unknown' },
    },
  };
  res.json(basicHealth);
});

export default router;
