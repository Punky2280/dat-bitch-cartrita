/**
 * Microservices Communication API Routes
 * 
 * Comprehensive REST API for managing service mesh, gRPC operations, message queues,
 * event sourcing, circuit breakers, and all microservices communication features.
 */

import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

function createMicroservicesCommRoutes(
    serviceMeshController,
    grpcTransport,
    messageQueueEngine,
    eventSourcingPlatform,
    circuitBreakerManager
) {
    const router = express.Router();
    const tracer = OpenTelemetryTracing.getTracer('microservices-comm-api');

    /**
     * Validation middleware
     */
    const validateRequest = (req, res, next) => {
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
     * Error handling middleware
     */
    const handleError = (error, req, res, next) => {
        console.error(`[MicroservicesCommAPI] ${req.method} ${req.path}:`, error);
        
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            error: error.message || 'Internal server error',
            timestamp: new Date().toISOString()
        });
    };

    /**
     * Tracing middleware
     */
    const traceRequest = (spanName) => {
        return (req, res, next) => {
            const span = tracer.startSpan(`microservices-comm-api.${spanName}`);
            req.span = span;
            
            span.setAttributes({
                'http.method': req.method,
                'http.url': req.originalUrl,
                'user.id': req.user?.id || 'anonymous'
            });

            res.on('finish', () => {
                span.setAttributes({
                    'http.status_code': res.statusCode,
                    'http.response_size': res.get('content-length') || 0
                });
                
                if (res.statusCode >= 400) {
                    span.setStatus({ code: 2, message: `HTTP ${res.statusCode}` });
                }
                
                span.end();
            });

            next();
        };
    };

    // ==================== SERVICE MESH ROUTES ====================

    /**
     * Get service mesh status
     */
    router.get('/service-mesh/status', traceRequest('get-service-mesh-status'), async (req, res, next) => {
        try {
            const status = serviceMeshController.getStatus();
            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Register service with mesh
     */
    router.post('/service-mesh/services',
        traceRequest('register-service'),
        [
            body('name').isString().notEmpty(),
            body('address').isString().notEmpty(),
            body('port').isInt({ min: 1, max: 65535 }),
            body('protocol').isIn(['http', 'https', 'grpc', 'tcp']),
            body('healthCheckPath').optional().isString(),
            body('tags').optional().isArray(),
            body('metadata').optional().isObject()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await serviceMeshController.registerService(req.body);
                
                req.span.setAttributes({
                    'service.name': req.body.name,
                    'service.address': req.body.address,
                    'service.port': req.body.port,
                    'service.protocol': req.body.protocol
                });

                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Get all registered services
     */
    router.get('/service-mesh/services',
        traceRequest('get-services'),
        [
            query('protocol').optional().isIn(['http', 'https', 'grpc', 'tcp']),
            query('healthy').optional().isBoolean(),
            query('tags').optional().isString()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const filters = {};
                if (req.query.protocol) filters.protocol = req.query.protocol;
                if (req.query.healthy !== undefined) filters.healthy = req.query.healthy === 'true';
                if (req.query.tags) filters.tags = req.query.tags.split(',');

                const services = await serviceMeshController.getServices(filters);
                
                res.json({
                    success: true,
                    data: services
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Get specific service details
     */
    router.get('/service-mesh/services/:serviceId',
        traceRequest('get-service'),
        param('serviceId').isString().notEmpty(),
        validateRequest,
        async (req, res, next) => {
            try {
                const service = await serviceMeshController.getService(req.params.serviceId);
                
                if (!service) {
                    return res.status(404).json({
                        success: false,
                        error: 'Service not found'
                    });
                }

                res.json({
                    success: true,
                    data: service
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Update service configuration
     */
    router.put('/service-mesh/services/:serviceId',
        traceRequest('update-service'),
        [
            param('serviceId').isString().notEmpty(),
            body('healthCheckPath').optional().isString(),
            body('tags').optional().isArray(),
            body('metadata').optional().isObject(),
            body('loadBalancingWeight').optional().isInt({ min: 1, max: 100 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await serviceMeshController.updateService(req.params.serviceId, req.body);
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Deregister service
     */
    router.delete('/service-mesh/services/:serviceId',
        traceRequest('deregister-service'),
        param('serviceId').isString().notEmpty(),
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await serviceMeshController.deregisterService(req.params.serviceId);
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Configure traffic splitting
     */
    router.post('/service-mesh/traffic-split',
        traceRequest('configure-traffic-split'),
        [
            body('serviceName').isString().notEmpty(),
            body('rules').isArray().notEmpty(),
            body('rules.*.version').isString().notEmpty(),
            body('rules.*.weight').isInt({ min: 0, max: 100 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await serviceMeshController.configureTrafficSplit(
                    req.body.serviceName,
                    req.body.rules
                );
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Get load balancing statistics
     */
    router.get('/service-mesh/load-balancing/stats',
        traceRequest('get-load-balancing-stats'),
        async (req, res, next) => {
            try {
                const stats = await serviceMeshController.getLoadBalancingStats();
                
                res.json({
                    success: true,
                    data: stats
                });
            } catch (error) {
                next(error);
            }
        }
    );

    // ==================== GRPC TRANSPORT ROUTES ====================

    /**
     * Get gRPC transport status
     */
    router.get('/grpc/status', traceRequest('get-grpc-status'), async (req, res, next) => {
        try {
            const status = grpcTransport.getStatus();
            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Create gRPC connection
     */
    router.post('/grpc/connections',
        traceRequest('create-grpc-connection'),
        [
            body('target').isString().notEmpty(),
            body('options').optional().isObject(),
            body('credentials').optional().isIn(['insecure', 'ssl']),
            body('poolSize').optional().isInt({ min: 1, max: 50 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await grpcTransport.createConnection(
                    req.body.target,
                    req.body.options || {},
                    req.body.poolSize
                );
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Get gRPC connection details
     */
    router.get('/grpc/connections/:connectionId',
        traceRequest('get-grpc-connection'),
        param('connectionId').isString().notEmpty(),
        validateRequest,
        async (req, res, next) => {
            try {
                const connection = await grpcTransport.getConnection(req.params.connectionId);
                
                if (!connection) {
                    return res.status(404).json({
                        success: false,
                        error: 'Connection not found'
                    });
                }

                res.json({
                    success: true,
                    data: connection
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Execute gRPC call
     */
    router.post('/grpc/call',
        traceRequest('execute-grpc-call'),
        [
            body('target').isString().notEmpty(),
            body('method').isString().notEmpty(),
            body('data').optional().isObject(),
            body('metadata').optional().isObject(),
            body('timeout').optional().isInt({ min: 1000, max: 300000 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await grpcTransport.makeCall(
                    req.body.target,
                    req.body.method,
                    req.body.data || {},
                    {
                        metadata: req.body.metadata,
                        timeout: req.body.timeout
                    }
                );
                
                req.span.setAttributes({
                    'grpc.target': req.body.target,
                    'grpc.method': req.body.method,
                    'grpc.success': true
                });

                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                req.span.setAttributes({
                    'grpc.target': req.body.target,
                    'grpc.method': req.body.method,
                    'grpc.success': false,
                    'grpc.error': error.message
                });
                next(error);
            }
        }
    );

    /**
     * Get gRPC performance metrics
     */
    router.get('/grpc/metrics',
        traceRequest('get-grpc-metrics'),
        async (req, res, next) => {
            try {
                const metrics = await grpcTransport.getMetrics();
                
                res.json({
                    success: true,
                    data: metrics
                });
            } catch (error) {
                next(error);
            }
        }
    );

    // ==================== MESSAGE QUEUE ROUTES ====================

    /**
     * Get message queue status
     */
    router.get('/message-queue/status', traceRequest('get-queue-status'), async (req, res, next) => {
        try {
            const status = messageQueueEngine.getStatus();
            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Create queue
     */
    router.post('/message-queue/queues',
        traceRequest('create-queue'),
        [
            body('name').isString().notEmpty(),
            body('priority').optional().isIn(['low', 'normal', 'high', 'critical']),
            body('durable').optional().isBoolean(),
            body('maxSize').optional().isInt({ min: 1 }),
            body('ttl').optional().isInt({ min: 1000 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await messageQueueEngine.createQueue(req.body.name, req.body);
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Get queue details
     */
    router.get('/message-queue/queues/:queueName',
        traceRequest('get-queue'),
        param('queueName').isString().notEmpty(),
        validateRequest,
        async (req, res, next) => {
            try {
                const queue = await messageQueueEngine.getQueueInfo(req.params.queueName);
                
                if (!queue) {
                    return res.status(404).json({
                        success: false,
                        error: 'Queue not found'
                    });
                }

                res.json({
                    success: true,
                    data: queue
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Send message to queue
     */
    router.post('/message-queue/queues/:queueName/messages',
        traceRequest('send-message'),
        [
            param('queueName').isString().notEmpty(),
            body('data').notEmpty(),
            body('priority').optional().isIn(['low', 'normal', 'high', 'critical']),
            body('delay').optional().isInt({ min: 0 }),
            body('ttl').optional().isInt({ min: 1000 }),
            body('headers').optional().isObject()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await messageQueueEngine.sendMessage(
                    req.params.queueName,
                    req.body.data,
                    {
                        priority: req.body.priority,
                        delay: req.body.delay,
                        ttl: req.body.ttl,
                        headers: req.body.headers
                    }
                );
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Consume messages from queue
     */
    router.post('/message-queue/queues/:queueName/consume',
        traceRequest('consume-messages'),
        [
            param('queueName').isString().notEmpty(),
            body('maxMessages').optional().isInt({ min: 1, max: 100 }),
            body('waitTimeout').optional().isInt({ min: 0, max: 60000 }),
            body('autoAck').optional().isBoolean()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const messages = await messageQueueEngine.consumeMessages(
                    req.params.queueName,
                    {
                        maxMessages: req.body.maxMessages || 10,
                        waitTimeout: req.body.waitTimeout || 5000,
                        autoAck: req.body.autoAck !== false
                    }
                );
                
                res.json({
                    success: true,
                    data: { messages }
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Create topic for pub/sub
     */
    router.post('/message-queue/topics',
        traceRequest('create-topic'),
        [
            body('name').isString().notEmpty(),
            body('durable').optional().isBoolean(),
            body('partitions').optional().isInt({ min: 1, max: 100 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await messageQueueEngine.createTopic(req.body.name, req.body);
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Subscribe to topic
     */
    router.post('/message-queue/topics/:topicName/subscriptions',
        traceRequest('subscribe-topic'),
        [
            param('topicName').isString().notEmpty(),
            body('subscriberId').isString().notEmpty(),
            body('callback').optional().isString() // URL for webhook
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await messageQueueEngine.subscribe(
                    req.params.topicName,
                    req.body.subscriberId,
                    req.body.callback
                );
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Publish message to topic
     */
    router.post('/message-queue/topics/:topicName/publish',
        traceRequest('publish-message'),
        [
            param('topicName').isString().notEmpty(),
            body('data').notEmpty(),
            body('headers').optional().isObject(),
            body('partition').optional().isString()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await messageQueueEngine.publish(
                    req.params.topicName,
                    req.body.data,
                    {
                        headers: req.body.headers,
                        partition: req.body.partition
                    }
                );
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    // ==================== EVENT SOURCING ROUTES ====================

    /**
     * Get event sourcing status
     */
    router.get('/event-sourcing/status', traceRequest('get-event-sourcing-status'), async (req, res, next) => {
        try {
            const status = eventSourcingPlatform.getStatus();
            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Store event
     */
    router.post('/event-sourcing/events',
        traceRequest('store-event'),
        [
            body('type').isString().notEmpty(),
            body('aggregateId').isString().notEmpty(),
            body('data').optional().isObject(),
            body('version').optional().isInt({ min: 1 }),
            body('metadata').optional().isObject()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await eventSourcingPlatform.storeEvent(req.body, {
                    userId: req.user?.id,
                    correlationId: req.headers['x-correlation-id']
                });
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Load aggregate
     */
    router.get('/event-sourcing/aggregates/:aggregateId',
        traceRequest('load-aggregate'),
        [
            param('aggregateId').isString().notEmpty(),
            query('aggregateType').isString().notEmpty()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const aggregate = await eventSourcingPlatform.loadAggregate(
                    req.params.aggregateId,
                    req.query.aggregateType
                );
                
                res.json({
                    success: true,
                    data: aggregate
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Process command
     */
    router.post('/event-sourcing/commands',
        traceRequest('process-command'),
        [
            body('type').isString().notEmpty(),
            body('aggregateId').isString().notEmpty(),
            body('data').optional().isObject()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await eventSourcingPlatform.processCommand(req.body, {
                    userId: req.user?.id,
                    correlationId: req.headers['x-correlation-id']
                });
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Execute query
     */
    router.post('/event-sourcing/queries',
        traceRequest('execute-query'),
        [
            body('type').isString().notEmpty(),
            body('criteria').optional().isObject()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await eventSourcingPlatform.executeQuery(req.body, {
                    userId: req.user?.id,
                    correlationId: req.headers['x-correlation-id']
                });
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Create snapshot
     */
    router.post('/event-sourcing/aggregates/:aggregateId/snapshots',
        traceRequest('create-snapshot'),
        [
            param('aggregateId').isString().notEmpty(),
            body('force').optional().isBoolean()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await eventSourcingPlatform.createSnapshot(
                    req.params.aggregateId,
                    { force: req.body.force }
                );
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Replay events
     */
    router.post('/event-sourcing/aggregates/:aggregateId/replay',
        traceRequest('replay-events'),
        [
            param('aggregateId').isString().notEmpty(),
            body('fromVersion').optional().isInt({ min: 0 }),
            body('toVersion').optional().isInt({ min: 1 }),
            body('aggregateType').optional().isString()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await eventSourcingPlatform.replayEvents(
                    req.params.aggregateId,
                    req.body.fromVersion,
                    req.body.toVersion,
                    { aggregateType: req.body.aggregateType }
                );
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Subscribe to event stream
     */
    router.post('/event-sourcing/streams/:streamName/subscriptions',
        traceRequest('subscribe-event-stream'),
        [
            param('streamName').isString().notEmpty(),
            body('callback').isString().notEmpty(), // URL for webhook
            body('fromPosition').optional().isInt({ min: 0 }),
            body('batchSize').optional().isInt({ min: 1, max: 1000 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                // For API, we'd typically use webhooks for event stream subscriptions
                // This is a simplified implementation
                const result = await eventSourcingPlatform.subscribeToEventStream(
                    req.params.streamName,
                    async (event, subscriptionId) => {
                        // In practice, this would make HTTP requests to the callback URL
                        console.log(`Event received for subscription ${subscriptionId}:`, event);
                    },
                    {
                        fromPosition: req.body.fromPosition,
                        batchSize: req.body.batchSize
                    }
                );
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    // ==================== CIRCUIT BREAKER ROUTES ====================

    /**
     * Get circuit breaker status
     */
    router.get('/circuit-breaker/status', traceRequest('get-circuit-breaker-status'), async (req, res, next) => {
        try {
            const status = circuitBreakerManager.getStatus();
            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Create circuit breaker
     */
    router.post('/circuit-breaker/circuits',
        traceRequest('create-circuit-breaker'),
        [
            body('name').isString().notEmpty(),
            body('timeout').optional().isInt({ min: 1000, max: 300000 }),
            body('failureThreshold').optional().isInt({ min: 1, max: 100 }),
            body('successThreshold').optional().isInt({ min: 1, max: 50 }),
            body('recoveryTimeout').optional().isInt({ min: 5000, max: 600000 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await circuitBreakerManager.createCircuitBreaker(req.body.name, req.body);
                
                res.status(201).json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Get all circuit breakers
     */
    router.get('/circuit-breaker/circuits', traceRequest('get-all-circuits'), async (req, res, next) => {
        try {
            const circuits = circuitBreakerManager.getAllCircuitsStatus();
            res.json({
                success: true,
                data: circuits
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Get specific circuit breaker
     */
    router.get('/circuit-breaker/circuits/:circuitName',
        traceRequest('get-circuit-breaker'),
        param('circuitName').isString().notEmpty(),
        validateRequest,
        async (req, res, next) => {
            try {
                const circuit = circuitBreakerManager.getCircuitStatus(req.params.circuitName);
                
                if (!circuit) {
                    return res.status(404).json({
                        success: false,
                        error: 'Circuit breaker not found'
                    });
                }

                res.json({
                    success: true,
                    data: circuit
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Execute call through circuit breaker
     */
    router.post('/circuit-breaker/circuits/:circuitName/execute',
        traceRequest('execute-circuit-call'),
        [
            param('circuitName').isString().notEmpty(),
            body('operation').isString().notEmpty(), // URL or operation identifier
            body('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE']),
            body('data').optional().isObject(),
            body('headers').optional().isObject()
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                // This is a simplified example - in practice, you'd have different operation types
                const operation = async () => {
                    // Execute the actual operation (HTTP call, database query, etc.)
                    return { 
                        operation: req.body.operation,
                        executed: true,
                        timestamp: new Date()
                    };
                };

                const result = await circuitBreakerManager.executeCall(
                    req.params.circuitName,
                    operation,
                    {
                        operation: req.body.operation,
                        method: req.body.method,
                        data: req.body.data,
                        headers: req.body.headers
                    }
                );
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Reset circuit breaker
     */
    router.post('/circuit-breaker/circuits/:circuitName/reset',
        traceRequest('reset-circuit-breaker'),
        param('circuitName').isString().notEmpty(),
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await circuitBreakerManager.resetCircuit(req.params.circuitName);
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    /**
     * Update circuit breaker configuration
     */
    router.put('/circuit-breaker/circuits/:circuitName',
        traceRequest('update-circuit-config'),
        [
            param('circuitName').isString().notEmpty(),
            body('timeout').optional().isInt({ min: 1000, max: 300000 }),
            body('failureThreshold').optional().isInt({ min: 1, max: 100 }),
            body('successThreshold').optional().isInt({ min: 1, max: 50 }),
            body('recoveryTimeout').optional().isInt({ min: 5000, max: 600000 })
        ],
        validateRequest,
        async (req, res, next) => {
            try {
                const result = await circuitBreakerManager.updateCircuitConfig(
                    req.params.circuitName,
                    req.body
                );
                
                res.json({
                    success: true,
                    data: result
                });
            } catch (error) {
                next(error);
            }
        }
    );

    // ==================== SYSTEM-WIDE ROUTES ====================

    /**
     * Get comprehensive system status
     */
    router.get('/system/status', traceRequest('get-system-status'), async (req, res, next) => {
        try {
            const systemStatus = {
                serviceMesh: serviceMeshController.getStatus(),
                grpcTransport: grpcTransport.getStatus(),
                messageQueue: messageQueueEngine.getStatus(),
                eventSourcing: eventSourcingPlatform.getStatus(),
                circuitBreaker: circuitBreakerManager.getStatus(),
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                data: systemStatus
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Get system metrics
     */
    router.get('/system/metrics', traceRequest('get-system-metrics'), async (req, res, next) => {
        try {
            const metrics = {
                serviceMesh: {
                    totalServices: serviceMeshController.getServiceCount(),
                    healthyServices: serviceMeshController.getHealthyServiceCount(),
                    requestsPerSecond: serviceMeshController.getRequestsPerSecond()
                },
                grpc: {
                    activeConnections: grpcTransport.getActiveConnectionCount(),
                    totalCalls: grpcTransport.getTotalCalls(),
                    averageResponseTime: grpcTransport.getAverageResponseTime()
                },
                messageQueue: {
                    totalQueues: messageQueueEngine.getQueueCount(),
                    totalMessages: messageQueueEngine.getTotalMessageCount(),
                    messagesPerSecond: messageQueueEngine.getMessagesPerSecond()
                },
                eventSourcing: {
                    totalEvents: eventSourcingPlatform.getEventCount(),
                    totalAggregates: eventSourcingPlatform.getAggregateCount(),
                    eventsPerSecond: eventSourcingPlatform.getEventsPerSecond()
                },
                circuitBreaker: {
                    totalCircuits: circuitBreakerManager.getCircuitCount(),
                    openCircuits: circuitBreakerManager.getOpenCircuitCount(),
                    successRate: circuitBreakerManager.getOverallSuccessRate()
                }
            };

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Health check endpoint
     */
    router.get('/health', traceRequest('health-check'), async (req, res, next) => {
        try {
            const health = {
                status: 'healthy',
                components: {
                    serviceMesh: serviceMeshController.isHealthy(),
                    grpcTransport: grpcTransport.isHealthy(),
                    messageQueue: messageQueueEngine.isHealthy(),
                    eventSourcing: eventSourcingPlatform.isHealthy(),
                    circuitBreaker: circuitBreakerManager.isHealthy()
                },
                timestamp: new Date().toISOString()
            };

            const allHealthy = Object.values(health.components).every(h => h);
            if (!allHealthy) {
                health.status = 'degraded';
            }

            const statusCode = allHealthy ? 200 : 503;
            res.status(statusCode).json({
                success: allHealthy,
                data: health
            });
        } catch (error) {
            next(error);
        }
    });

    // Apply error handling middleware
    router.use(handleError);

    return router;
}

export default createMicroservicesCommRoutes;
