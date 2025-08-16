/**
 * Scalability Management API Routes
 * REST API for managing scalability components and monitoring
 * Task 28: Scalability Enhancements - API Routes
 */

import { Router } from 'express';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import ScalabilityIntegrationManager from '../services/ScalabilityIntegrationManager.js';
import RedisClusterConfigService from '../services/RedisClusterConfigService.js';
import ConnectionPoolManagerService from '../services/ConnectionPoolManagerService.js';
import LoadBalancerConfigService from '../services/LoadBalancerConfigService.js';
import MessageQueueService from '../services/MessageQueueService.js';

const router = Router();

/**
 * Get overall scalability status
 */
router.get('/status', async (req, res) => {
    try {
        const status = await traceOperation('scalability-status', async () => {
            return await ScalabilityIntegrationManager.getScalingStatus();
        });

        res.json({
            success: true,
            data: status,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('Error getting scalability status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scalability status'
        });
    }
});

/**
 * Get scaling metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const { timeRange = '1h' } = req.query;
        
        const metrics = await traceOperation('scalability-metrics', async () => {
            return await ScalabilityIntegrationManager.getScalingMetrics(timeRange);
        });

        res.json({
            success: true,
            data: {
                metrics,
                timeRange,
                totalPoints: metrics.length
            }
        });

    } catch (error) {
        console.error('Error getting scaling metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scaling metrics'
        });
    }
});

/**
 * Enable/disable auto-scaling
 */
router.post('/auto-scaling', async (req, res) => {
    try {
        const { enabled } = req.body;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'enabled must be a boolean value'
            });
        }

        await traceOperation('toggle-auto-scaling', async () => {
            if (enabled) {
                await ScalabilityIntegrationManager.enableAutoScaling();
            } else {
                await ScalabilityIntegrationManager.disableAutoScaling();
            }
        });

        res.json({
            success: true,
            message: `Auto-scaling ${enabled ? 'enabled' : 'disabled'}`,
            data: { autoScaling: enabled }
        });

    } catch (error) {
        console.error('Error toggling auto-scaling:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle auto-scaling'
        });
    }
});

/**
 * Update scaling thresholds
 */
router.put('/thresholds', async (req, res) => {
    try {
        const thresholds = req.body;
        
        await traceOperation('update-thresholds', async () => {
            await ScalabilityIntegrationManager.updateScalingThresholds(thresholds);
        });

        res.json({
            success: true,
            message: 'Scaling thresholds updated',
            data: thresholds
        });

    } catch (error) {
        console.error('Error updating scaling thresholds:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update scaling thresholds'
        });
    }
});

/**
 * Manual scaling operations
 */
router.post('/scale/redis', async (req, res) => {
    try {
        const { nodeCount } = req.body;
        
        if (typeof nodeCount !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'nodeCount must be a number'
            });
        }

        const result = await traceOperation('manual-scale-redis', async () => {
            return await ScalabilityIntegrationManager.scaleRedisCluster(nodeCount);
        });

        res.json({
            success: true,
            message: `Redis cluster scaling initiated`,
            data: result
        });

    } catch (error) {
        console.error('Error scaling Redis cluster:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scale Redis cluster'
        });
    }
});

router.post('/scale/connections', async (req, res) => {
    try {
        const { factor } = req.body;
        
        if (typeof factor !== 'number' || factor <= 0) {
            return res.status(400).json({
                success: false,
                error: 'factor must be a positive number'
            });
        }

        const result = await traceOperation('manual-scale-connections', async () => {
            return await ScalabilityIntegrationManager.scaleConnectionPools(factor);
        });

        res.json({
            success: true,
            message: `Connection pools scaling initiated`,
            data: result
        });

    } catch (error) {
        console.error('Error scaling connection pools:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scale connection pools'
        });
    }
});

router.post('/scale/load-balancer', async (req, res) => {
    try {
        const { backendCount } = req.body;
        
        if (typeof backendCount !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'backendCount must be a number'
            });
        }

        const result = await traceOperation('manual-scale-load-balancer', async () => {
            return await ScalabilityIntegrationManager.scaleLoadBalancer(backendCount);
        });

        res.json({
            success: true,
            message: `Load balancer scaling initiated`,
            data: result
        });

    } catch (error) {
        console.error('Error scaling load balancer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scale load balancer'
        });
    }
});

router.post('/scale/message-queue', async (req, res) => {
    try {
        const { workerCount } = req.body;
        
        if (typeof workerCount !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'workerCount must be a number'
            });
        }

        const result = await traceOperation('manual-scale-queue', async () => {
            return await ScalabilityIntegrationManager.scaleMessageQueue(workerCount);
        });

        res.json({
            success: true,
            message: `Message queue scaling initiated`,
            data: result
        });

    } catch (error) {
        console.error('Error scaling message queue:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scale message queue'
        });
    }
});

/**
 * Component-specific routes
 */

// Redis cluster management
router.get('/redis/status', async (req, res) => {
    try {
        const status = await RedisClusterConfigService.getStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/redis/metrics', async (req, res) => {
    try {
        const metrics = await RedisClusterConfigService.getClusterMetrics();
        res.json({ success: true, data: metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/redis/nodes/add', async (req, res) => {
    try {
        const { count = 1 } = req.body;
        const result = await RedisClusterConfigService.addNodes(count);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/redis/nodes/remove', async (req, res) => {
    try {
        const { count = 1 } = req.body;
        const result = await RedisClusterConfigService.removeNodes(count);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Connection pool management
router.get('/connections/status', async (req, res) => {
    try {
        const status = await ConnectionPoolManagerService.getStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/connections/metrics', async (req, res) => {
    try {
        const metrics = await ConnectionPoolManagerService.getPoolMetrics();
        res.json({ success: true, data: metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/connections/pools/:poolName/scale', async (req, res) => {
    try {
        const { poolName } = req.params;
        const { factor } = req.body;
        const result = await ConnectionPoolManagerService.scalePool(poolName, factor);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Load balancer management
router.get('/load-balancer/status', async (req, res) => {
    try {
        const status = await LoadBalancerConfigService.getStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/load-balancer/metrics', async (req, res) => {
    try {
        const metrics = await LoadBalancerConfigService.getBalancerMetrics();
        res.json({ success: true, data: metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/load-balancer/backends/add', async (req, res) => {
    try {
        const { backend } = req.body;
        const result = await LoadBalancerConfigService.addBackend(backend);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/load-balancer/backends/:backendId', async (req, res) => {
    try {
        const { backendId } = req.params;
        const result = await LoadBalancerConfigService.removeBackend(backendId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Message queue management
router.get('/message-queue/status', async (req, res) => {
    try {
        const status = await MessageQueueService.getStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/message-queue/metrics', async (req, res) => {
    try {
        const metrics = await MessageQueueService.getQueueMetrics();
        res.json({ success: true, data: metrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/message-queue/workers/scale', async (req, res) => {
    try {
        const { factor } = req.body;
        const result = await MessageQueueService.scaleWorkers(factor);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/message-queue/jobs', async (req, res) => {
    try {
        const { status, limit = 20 } = req.query;
        const jobs = await MessageQueueService.getJobs(status, parseInt(limit));
        res.json({ success: true, data: jobs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const health = await traceOperation('scalability-health-check', async () => {
            return {
                manager: 'healthy',
                components: {
                    redis: await RedisClusterConfigService.healthCheck(),
                    connections: await ConnectionPoolManagerService.healthCheck(),
                    loadBalancer: await LoadBalancerConfigService.healthCheck(),
                    messageQueue: await MessageQueueService.healthCheck()
                }
            };
        });

        res.json({
            success: true,
            data: health,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('Scalability health check failed:', error);
        res.status(503).json({
            success: false,
            error: 'Scalability health check failed'
        });
    }
});

export default router;
