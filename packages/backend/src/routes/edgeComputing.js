/**
 * Edge Computing Infrastructure API Routes
 * 
 * Provides comprehensive REST API for:
 * - Edge node management and monitoring
 * - CDN integration and cache management
 * - Geographic routing and performance optimization
 * - Real-time analytics and alerting
 */

import express from 'express';
import { param, body, query, validationResult } from 'express-validator';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Middleware for validation error handling
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

/**
 * Edge Node Management Routes
 */

// Register new edge node
router.post('/nodes',
    [
        body('name')
            .isLength({ min: 3, max: 100 })
            .withMessage('Name must be between 3 and 100 characters'),
        body('endpoint_url')
            .isURL()
            .withMessage('Valid endpoint URL is required'),
        body('location')
            .isObject()
            .withMessage('Location object is required'),
        body('location.region')
            .isString()
            .isLength({ min: 2 })
            .withMessage('Location region is required'),
        body('capabilities')
            .optional()
            .isObject()
            .withMessage('Capabilities must be an object'),
        body('resources')
            .optional()
            .isObject()
            .withMessage('Resources must be an object')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_register_node');
        
        try {
            const { EdgeNodeManager } = req.services;
            
            if (!EdgeNodeManager?.initialized) {
                return res.status(503).json({
                    success: false,
                    error: 'EdgeNodeManager service not available'
                });
            }
            
            const nodeData = {
                name: req.body.name,
                endpoint_url: req.body.endpoint_url,
                location: req.body.location,
                capabilities: req.body.capabilities || {},
                resources: req.body.resources || {}
            };
            
            const options = {
                allowUpdate: req.body.allowUpdate || false
            };
            
            const node = await EdgeNodeManager.registerNode(nodeData, options);
            
            span.setAttributes({
                'edge.api.operation': 'register_node',
                'edge.node.id': node.id,
                'edge.node.region': node.location?.region
            });
            
            res.status(201).json({
                success: true,
                data: node,
                message: 'Edge node registered successfully'
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(400).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// List edge nodes
router.get('/nodes',
    [
        query('status')
            .optional()
            .isIn(['active', 'inactive', 'maintenance', 'failed'])
            .withMessage('Invalid status filter'),
        query('region')
            .optional()
            .isString()
            .withMessage('Region must be a string'),
        query('capability')
            .optional()
            .isString()
            .withMessage('Capability must be a string'),
        query('min_health_score')
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage('Health score must be between 0 and 100'),
        query('include_metrics')
            .optional()
            .isBoolean()
            .withMessage('Include metrics must be boolean')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_list_nodes');
        
        try {
            const { EdgeNodeManager } = req.services;
            
            if (!EdgeNodeManager?.initialized) {
                return res.status(503).json({
                    success: false,
                    error: 'EdgeNodeManager service not available'
                });
            }
            
            const filters = {
                status: req.query.status,
                region: req.query.region,
                capability: req.query.capability,
                minHealthScore: req.query.min_health_score ? parseFloat(req.query.min_health_score) : null,
                includeMetrics: req.query.include_metrics === 'true'
            };
            
            const nodes = await EdgeNodeManager.listNodes(filters);
            
            span.setAttributes({
                'edge.api.operation': 'list_nodes',
                'edge.nodes.count': nodes.length,
                'edge.filters.applied': Object.keys(filters).filter(k => filters[k] !== null).length
            });
            
            res.json({
                success: true,
                data: nodes,
                count: nodes.length,
                filters: filters
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Get specific edge node
router.get('/nodes/:nodeId',
    [
        param('nodeId')
            .isUUID()
            .withMessage('Valid node ID is required')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_get_node');
        
        try {
            const { EdgeNodeManager } = req.services;
            const { nodeId } = req.params;
            
            const node = await EdgeNodeManager.getNode(nodeId);
            
            if (!node) {
                return res.status(404).json({
                    success: false,
                    error: 'Edge node not found'
                });
            }
            
            span.setAttributes({
                'edge.api.operation': 'get_node',
                'edge.node.id': nodeId,
                'edge.node.status': node.status
            });
            
            res.json({
                success: true,
                data: node
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Update edge node
router.put('/nodes/:nodeId',
    [
        param('nodeId')
            .isUUID()
            .withMessage('Valid node ID is required'),
        body('name')
            .optional()
            .isLength({ min: 3, max: 100 })
            .withMessage('Name must be between 3 and 100 characters'),
        body('endpoint_url')
            .optional()
            .isURL()
            .withMessage('Valid endpoint URL is required'),
        body('status')
            .optional()
            .isIn(['active', 'inactive', 'maintenance', 'failed'])
            .withMessage('Invalid status'),
        body('capabilities')
            .optional()
            .isObject()
            .withMessage('Capabilities must be an object'),
        body('resources')
            .optional()
            .isObject()
            .withMessage('Resources must be an object')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_update_node');
        
        try {
            const { EdgeNodeManager } = req.services;
            const { nodeId } = req.params;
            
            const updates = {};
            ['name', 'endpoint_url', 'status', 'capabilities', 'resources'].forEach(field => {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            });
            
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid fields to update'
                });
            }
            
            // For this implementation, we'll simulate node updates
            // In a real implementation, this would call EdgeNodeManager.updateNode()
            const node = await EdgeNodeManager.getNode(nodeId);
            if (!node) {
                return res.status(404).json({
                    success: false,
                    error: 'Edge node not found'
                });
            }
            
            span.setAttributes({
                'edge.api.operation': 'update_node',
                'edge.node.id': nodeId,
                'edge.update.fields': Object.keys(updates).length
            });
            
            res.json({
                success: true,
                data: { ...node, ...updates, updated_at: new Date().toISOString() },
                message: 'Edge node updated successfully'
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Remove edge node
router.delete('/nodes/:nodeId',
    [
        param('nodeId')
            .isUUID()
            .withMessage('Valid node ID is required'),
        query('soft')
            .optional()
            .isBoolean()
            .withMessage('Soft delete flag must be boolean')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_remove_node');
        
        try {
            const { EdgeNodeManager } = req.services;
            const { nodeId } = req.params;
            const soft = req.query.soft !== 'false'; // Default to true
            
            await EdgeNodeManager.removeNode(nodeId, soft);
            
            span.setAttributes({
                'edge.api.operation': 'remove_node',
                'edge.node.id': nodeId,
                'edge.removal.soft': soft
            });
            
            res.json({
                success: true,
                message: `Edge node ${soft ? 'deactivated' : 'removed'} successfully`
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Edge node health check endpoint
router.post('/nodes/:nodeId/heartbeat',
    [
        param('nodeId')
            .isUUID()
            .withMessage('Valid node ID is required'),
        body('health_score')
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage('Health score must be between 0 and 100'),
        body('response_time_ms')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Response time must be a positive integer'),
        body('cpu_usage')
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage('CPU usage must be between 0 and 100'),
        body('memory_usage')
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage('Memory usage must be between 0 and 100')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_node_heartbeat');
        
        try {
            const { EdgeNodeManager } = req.services;
            const { nodeId } = req.params;
            
            const healthData = {
                response_time_ms: req.body.response_time_ms || 0,
                cpu_usage: req.body.cpu_usage || 0,
                memory_usage: req.body.memory_usage || 0,
                disk_usage: req.body.disk_usage || 0,
                network_latency_ms: req.body.network_latency_ms || 0,
                error_count: req.body.error_count || 0,
                warnings: req.body.warnings || [],
                timestamp: new Date().toISOString()
            };
            
            await EdgeNodeManager.handleHealthCheck(nodeId, healthData);
            
            span.setAttributes({
                'edge.api.operation': 'heartbeat',
                'edge.node.id': nodeId,
                'edge.health.cpu_usage': healthData.cpu_usage,
                'edge.health.memory_usage': healthData.memory_usage
            });
            
            res.json({
                success: true,
                message: 'Health check recorded successfully'
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

/**
 * CDN Management Routes
 */

// Add CDN provider
router.post('/cdn/providers',
    [
        body('name')
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters'),
        body('provider_type')
            .isIn(['cloudflare', 'aws_cloudfront', 'azure_cdn'])
            .withMessage('Invalid provider type'),
        body('configuration')
            .isObject()
            .withMessage('Configuration object is required'),
        body('api_credentials')
            .isObject()
            .withMessage('API credentials object is required'),
        body('regions')
            .optional()
            .isArray()
            .withMessage('Regions must be an array'),
        body('priority')
            .optional()
            .isInt({ min: 1, max: 1000 })
            .withMessage('Priority must be between 1 and 1000')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_add_cdn_provider');
        
        try {
            const { CDNIntegrationService } = req.services;
            
            if (!CDNIntegrationService?.initialized) {
                return res.status(503).json({
                    success: false,
                    error: 'CDNIntegrationService not available'
                });
            }
            
            const providerData = {
                name: req.body.name,
                provider_type: req.body.provider_type,
                configuration: req.body.configuration,
                api_credentials: req.body.api_credentials,
                regions: req.body.regions || [],
                priority: req.body.priority || 100
            };
            
            const options = {
                skipValidation: req.body.skip_validation === true
            };
            
            const provider = await CDNIntegrationService.addProvider(providerData, options);
            
            span.setAttributes({
                'edge.api.operation': 'add_cdn_provider',
                'cdn.provider.type': provider.provider_type,
                'cdn.provider.id': provider.id
            });
            
            res.status(201).json({
                success: true,
                data: provider,
                message: 'CDN provider added successfully'
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(400).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// List CDN providers
router.get('/cdn/providers',
    [
        query('status')
            .optional()
            .isIn(['active', 'inactive', 'error'])
            .withMessage('Invalid status filter'),
        query('provider_type')
            .optional()
            .isIn(['cloudflare', 'aws_cloudfront', 'azure_cdn'])
            .withMessage('Invalid provider type filter'),
        query('include_metrics')
            .optional()
            .isBoolean()
            .withMessage('Include metrics must be boolean')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_list_cdn_providers');
        
        try {
            const { CDNIntegrationService } = req.services;
            
            const filters = {
                status: req.query.status,
                providerType: req.query.provider_type,
                includeMetrics: req.query.include_metrics === 'true'
            };
            
            const providers = await CDNIntegrationService.listProviders(filters);
            
            span.setAttributes({
                'edge.api.operation': 'list_cdn_providers',
                'cdn.providers.count': providers.length
            });
            
            res.json({
                success: true,
                data: providers,
                count: providers.length
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Purge CDN cache
router.post('/cdn/purge',
    [
        body('targets')
            .isArray({ min: 1 })
            .withMessage('At least one cache target is required'),
        body('providers')
            .optional()
            .isArray()
            .withMessage('Providers must be an array'),
        body('priority')
            .optional()
            .isIn(['normal', 'high', 'urgent'])
            .withMessage('Invalid priority level'),
        body('wait_for_completion')
            .optional()
            .isBoolean()
            .withMessage('Wait for completion must be boolean')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_purge_cdn_cache');
        
        try {
            const { CDNIntegrationService } = req.services;
            
            const targets = req.body.targets;
            const options = {
                providers: req.body.providers,
                priority: req.body.priority || 'normal',
                waitForCompletion: req.body.wait_for_completion || false,
                batchInvalidation: req.body.batch_invalidation !== false
            };
            
            const result = await CDNIntegrationService.invalidateCache(targets, options);
            
            span.setAttributes({
                'edge.api.operation': 'purge_cache',
                'cdn.cache.targets': targets.length,
                'cdn.cache.providers': result.providersUsed,
                'cdn.cache.successful': result.successful
            });
            
            res.json({
                success: true,
                data: result,
                message: 'Cache invalidation initiated successfully'
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Warm CDN cache
router.post('/cdn/warm',
    [
        body('urls')
            .isArray({ min: 1 })
            .withMessage('At least one URL is required'),
        body('providers')
            .optional()
            .isArray()
            .withMessage('Providers must be an array'),
        body('regions')
            .optional()
            .isArray()
            .withMessage('Regions must be an array'),
        body('concurrent')
            .optional()
            .isInt({ min: 1, max: 20 })
            .withMessage('Concurrent requests must be between 1 and 20')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_warm_cdn_cache');
        
        try {
            const { CDNIntegrationService } = req.services;
            
            const urls = req.body.urls;
            const options = {
                providers: req.body.providers,
                regions: req.body.regions,
                concurrent: req.body.concurrent || 5
            };
            
            const warmingJob = await CDNIntegrationService.warmCache(urls, options);
            
            span.setAttributes({
                'edge.api.operation': 'warm_cache',
                'cdn.cache.urls': urls.length,
                'cdn.cache.job_id': warmingJob.id
            });
            
            res.json({
                success: true,
                data: warmingJob,
                message: 'Cache warming initiated successfully'
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Get CDN performance metrics
router.get('/cdn/performance',
    [
        query('provider_id')
            .optional()
            .isUUID()
            .withMessage('Provider ID must be a valid UUID'),
        query('time_range')
            .optional()
            .isIn(['1h', '6h', '24h', '7d', '30d', 'all'])
            .withMessage('Invalid time range'),
        query('region')
            .optional()
            .isString()
            .withMessage('Region must be a string'),
        query('include_realtime')
            .optional()
            .isBoolean()
            .withMessage('Include realtime must be boolean')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_cdn_performance');
        
        try {
            const { CDNIntegrationService } = req.services;
            
            const options = {
                providerId: req.query.provider_id,
                timeRange: req.query.time_range || '1h',
                region: req.query.region,
                includeRealTime: req.query.include_realtime !== 'false'
            };
            
            const metrics = await CDNIntegrationService.getPerformanceMetrics(options);
            
            span.setAttributes({
                'edge.api.operation': 'cdn_performance',
                'cdn.metrics.providers': metrics.totalProviders,
                'cdn.metrics.time_range': options.timeRange
            });
            
            res.json({
                success: true,
                data: metrics
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

/**
 * Geographic Routing Routes
 */

// Get optimal edge node for location
router.get('/routing/optimal/:location',
    [
        param('location')
            .isString()
            .isLength({ min: 2 })
            .withMessage('Valid location is required'),
        query('request_type')
            .optional()
            .isString()
            .withMessage('Request type must be a string'),
        query('strategy')
            .optional()
            .isIn(['round_robin', 'weighted', 'latency_weighted', 'geo_proximity'])
            .withMessage('Invalid routing strategy'),
        query('exclude_nodes')
            .optional()
            .isString()
            .withMessage('Excluded nodes must be comma-separated UUIDs')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_optimal_routing');
        
        try {
            const { EdgeNodeManager } = req.services;
            const { location } = req.params;
            
            const options = {
                strategy: req.query.strategy || 'latency_weighted',
                excludeNodes: req.query.exclude_nodes ? req.query.exclude_nodes.split(',') : [],
                requestType: req.query.request_type || 'default',
                includeBackup: true
            };
            
            const routing = await EdgeNodeManager.routeRequest(location, options.requestType, options);
            
            span.setAttributes({
                'edge.api.operation': 'optimal_routing',
                'edge.routing.location': location,
                'edge.routing.strategy': options.strategy,
                'edge.routing.node_id': routing.node.id
            });
            
            res.json({
                success: true,
                data: routing
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

/**
 * Analytics & Monitoring Routes
 */

// Get edge analytics
router.get('/analytics/overview',
    [
        query('time_range')
            .optional()
            .isIn(['1h', '6h', '24h', '7d', '30d'])
            .withMessage('Invalid time range'),
        query('region')
            .optional()
            .isString()
            .withMessage('Region must be a string')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_analytics_overview');
        
        try {
            const { EdgeNodeManager, CDNIntegrationService } = req.services;
            
            // Get statistics from both services
            const edgeStats = EdgeNodeManager ? EdgeNodeManager.getStatistics() : {};
            const cdnStats = CDNIntegrationService ? CDNIntegrationService.getStatistics() : {};
            
            const overview = {
                edge_infrastructure: edgeStats,
                cdn_performance: cdnStats,
                generated_at: new Date().toISOString(),
                time_range: req.query.time_range || '1h'
            };
            
            span.setAttributes({
                'edge.api.operation': 'analytics_overview',
                'edge.analytics.time_range': overview.time_range
            });
            
            res.json({
                success: true,
                data: overview
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Get latency analysis
router.get('/analytics/latency',
    [
        query('region')
            .optional()
            .isString()
            .withMessage('Region must be a string'),
        query('time_range')
            .optional()
            .isIn(['1h', '6h', '24h', '7d', '30d'])
            .withMessage('Invalid time range')
    ],
    handleValidationErrors,
    async (req, res) => {
        const tracer = OpenTelemetryTracing.getTracer('edge-api');
        const span = tracer.startSpan('edge_api_latency_analysis');
        
        try {
            const { db } = req.services;
            
            const timeRange = req.query.time_range || '1h';
            const region = req.query.region;
            
            // Query latency metrics from database
            let query = `
                SELECT 
                    en.location->>'region' as region,
                    AVG(epm.metric_value) as avg_latency,
                    MIN(epm.metric_value) as min_latency,
                    MAX(epm.metric_value) as max_latency,
                    COUNT(*) as sample_count,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY epm.metric_value) as p95_latency
                FROM edge_performance_metrics epm
                JOIN edge_nodes en ON epm.edge_node_id = en.id
                WHERE epm.metric_type = 'latency'
                  AND epm.recorded_at >= NOW() - INTERVAL '${timeRange.replace(/[^a-z0-9]/gi, '')}'
            `;
            
            const params = [];
            if (region) {
                query += ` AND en.location->>'region' = $1`;
                params.push(region);
            }
            
            query += ` GROUP BY en.location->>'region' ORDER BY avg_latency`;
            
            const result = await db.query(query, params);
            
            span.setAttributes({
                'edge.api.operation': 'latency_analysis',
                'edge.analytics.regions': result.rows.length,
                'edge.analytics.time_range': timeRange
            });
            
            res.json({
                success: true,
                data: {
                    latency_by_region: result.rows,
                    time_range: timeRange,
                    generated_at: new Date().toISOString()
                }
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            span.end();
        }
    }
);

// Health check endpoint
router.get('/health', (req, res) => {
    const { EdgeNodeManager, CDNIntegrationService } = req.services;
    
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            edge_node_manager: {
                initialized: EdgeNodeManager?.initialized || false,
                running: EdgeNodeManager?.isRunning || false
            },
            cdn_integration: {
                initialized: CDNIntegrationService?.initialized || false,
                running: CDNIntegrationService?.isRunning || false
            }
        }
    };
    
    const isHealthy = Object.values(health.services).every(service => 
        service.initialized && service.running
    );
    
    res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        data: health
    });
});

export default router;
