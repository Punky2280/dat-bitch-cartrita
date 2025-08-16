/**
 * Model Serving Platform
 * 
 * Production-ready model deployment and inference service with auto-scaling,
 * A/B testing, performance monitoring, and multi-framework support.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class ModelServingPlatform {
    constructor(db, modelRegistry, config = {}) {
        this.db = db;
        this.modelRegistry = modelRegistry;
        this.config = {
            defaultReplicas: config.defaultReplicas || 1,
            maxReplicas: config.maxReplicas || 10,
            minReplicas: config.minReplicas || 1,
            autoScaling: {
                enabled: config.autoScaling?.enabled !== false,
                targetCpu: config.autoScaling?.targetCpu || 70,
                targetMemory: config.autoScaling?.targetMemory || 80,
                targetLatency: config.autoScaling?.targetLatency || 1000, // ms
                scaleUpCooldown: config.autoScaling?.scaleUpCooldown || 60000, // 1 min
                scaleDownCooldown: config.autoScaling?.scaleDownCooldown || 300000 // 5 min
            },
            loadBalancing: {
                strategy: config.loadBalancing?.strategy || 'round_robin', // round_robin, weighted, least_connections
                healthCheckInterval: config.loadBalancing?.healthCheckInterval || 30000,
                unhealthyThreshold: config.loadBalancing?.unhealthyThreshold || 3
            },
            monitoring: {
                enabled: config.monitoring?.enabled !== false,
                metricsInterval: config.monitoring?.metricsInterval || 60000,
                enableDriftDetection: config.monitoring?.enableDriftDetection || false,
                driftThreshold: config.monitoring?.driftThreshold || 0.1
            },
            abTesting: {
                enabled: config.abTesting?.enabled !== false,
                maxExperiments: config.abTesting?.maxExperiments || 10
            },
            canaryDeployment: {
                enabled: config.canaryDeployment?.enabled !== false,
                initialTraffic: config.canaryDeployment?.initialTraffic || 5,
                maxTraffic: config.canaryDeployment?.maxTraffic || 50,
                promotionThreshold: config.canaryDeployment?.promotionThreshold || 0.95
            },
            ...config
        };

        this.tracer = OpenTelemetryTracing.getTracer('model-serving-platform');
        this.events = new EventEmitter();

        // Runtime state
        this.activeDeployments = new Map();
        this.modelInstances = new Map();
        this.loadBalancers = new Map();
        this.performanceMetrics = new Map();
        this.abTests = new Map();

        // Background workers
        this.healthCheckWorker = null;
        this.metricsCollector = null;
        this.autoScaler = null;

        this.initialized = false;
        this.isRunning = false;
    }

    /**
     * Initialize the Model Serving Platform
     */
    async initialize() {
        const span = this.tracer.startSpan('model_serving_platform_initialize');

        try {
            console.log('Initializing Model Serving Platform...');

            // Load existing deployments
            await this.loadExistingDeployments();

            // Start background workers
            this.startHealthCheckWorker();
            
            if (this.config.monitoring.enabled) {
                this.startMetricsCollector();
            }

            if (this.config.autoScaling.enabled) {
                this.startAutoScaler();
            }

            this.initialized = true;
            this.isRunning = true;

            span.setAttributes({
                'serving.platform.initialized': true,
                'serving.platform.deployments_loaded': this.activeDeployments.size,
                'serving.platform.auto_scaling_enabled': this.config.autoScaling.enabled
            });

            console.log('Model Serving Platform initialized successfully');
            this.events.emit('initialized', { timestamp: Date.now() });

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Deploy a model for serving
     */
    async deployModel(modelId, deploymentConfig = {}) {
        const span = this.tracer.startSpan('model_serving_platform_deploy_model');

        try {
            if (!this.isRunning) {
                throw new Error('ModelServingPlatform is not running');
            }

            // Get model information from registry
            const model = await this.modelRegistry.getModel(modelId, { includeArtifacts: true });
            if (!model) {
                throw new Error(`Model not found: ${modelId}`);
            }

            const deploymentId = uuidv4();
            const {
                name = `${model.name}-v${model.version}`,
                replicas = this.config.defaultReplicas,
                resources = {
                    cpu: '1',
                    memory: '2Gi',
                    gpu: model.framework.includes('tensorflow') || model.framework.includes('pytorch') ? 1 : 0
                },
                environment = {},
                routing = {
                    path: `/models/${model.name}`,
                    headers: {}
                },
                autoscaling = this.config.autoScaling.enabled,
                version = 'v1'
            } = deploymentConfig;

            const deployment = {
                id: deploymentId,
                model_id: modelId,
                name,
                version,
                status: 'deploying',
                replicas: {
                    desired: replicas,
                    ready: 0,
                    available: 0
                },
                resources,
                environment,
                routing,
                autoscaling_enabled: autoscaling,
                health_check: {
                    path: '/health',
                    interval: this.config.loadBalancing.healthCheckInterval,
                    timeout: 5000
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: deploymentConfig.metadata || {}
            };

            // Store deployment in database
            const insertQuery = `
                INSERT INTO model_deployments (
                    id, model_id, name, version, status, desired_replicas,
                    ready_replicas, available_replicas, resources, environment,
                    routing_config, autoscaling_enabled, health_check_config,
                    created_at, updated_at, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `;

            const values = [
                deployment.id, deployment.model_id, deployment.name, deployment.version,
                deployment.status, deployment.replicas.desired, deployment.replicas.ready,
                deployment.replicas.available, deployment.resources, deployment.environment,
                deployment.routing, deployment.autoscaling_enabled, deployment.health_check,
                deployment.created_at, deployment.updated_at, deployment.metadata
            ];

            const result = await this.db.query(insertQuery, values);
            const savedDeployment = result.rows[0];

            // Start deployment process
            await this.startDeploymentProcess(savedDeployment, model);

            // Add to active deployments
            this.activeDeployments.set(deploymentId, {
                ...savedDeployment,
                model,
                instances: new Map(),
                loadBalancer: null,
                metrics: {
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0,
                    averageLatency: 0,
                    p99Latency: 0,
                    throughput: 0
                }
            });

            span.setAttributes({
                'deployment.id': deploymentId,
                'deployment.model_id': modelId,
                'deployment.name': deployment.name,
                'deployment.replicas': replicas
            });

            this.events.emit('deploymentStarted', {
                deployment: savedDeployment,
                model,
                timestamp: Date.now()
            });

            console.log(`Model deployment started: ${deployment.name} (${deploymentId})`);
            return savedDeployment;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Scale deployment replicas
     */
    async scaleDeployment(deploymentId, targetReplicas, reason = 'manual') {
        const span = this.tracer.startSpan('model_serving_platform_scale_deployment');

        try {
            const deployment = this.activeDeployments.get(deploymentId);
            if (!deployment) {
                throw new Error(`Active deployment not found: ${deploymentId}`);
            }

            const currentReplicas = deployment.desired_replicas;
            const clampedReplicas = Math.max(
                this.config.minReplicas,
                Math.min(this.config.maxReplicas, targetReplicas)
            );

            if (clampedReplicas === currentReplicas) {
                return deployment;
            }

            // Update database
            await this.db.query(`
                UPDATE model_deployments 
                SET desired_replicas = $1, updated_at = NOW() 
                WHERE id = $2
            `, [clampedReplicas, deploymentId]);

            // Update deployment state
            deployment.desired_replicas = clampedReplicas;

            // Scale instances
            if (clampedReplicas > currentReplicas) {
                // Scale up
                await this.scaleUp(deployment, clampedReplicas - currentReplicas);
            } else {
                // Scale down
                await this.scaleDown(deployment, currentReplicas - clampedReplicas);
            }

            span.setAttributes({
                'deployment.id': deploymentId,
                'deployment.scale.from': currentReplicas,
                'deployment.scale.to': clampedReplicas,
                'deployment.scale.reason': reason
            });

            this.events.emit('deploymentScaled', {
                deploymentId,
                previousReplicas: currentReplicas,
                newReplicas: clampedReplicas,
                reason,
                timestamp: Date.now()
            });

            console.log(`Deployment scaled: ${deployment.name} ${currentReplicas} -> ${clampedReplicas} (${reason})`);
            return deployment;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Perform inference on a deployed model
     */
    async predict(deploymentId, inputData, options = {}) {
        const span = this.tracer.startSpan('model_serving_platform_predict');
        const requestId = uuidv4();
        const startTime = Date.now();

        try {
            const deployment = this.activeDeployments.get(deploymentId);
            if (!deployment) {
                throw new Error(`Deployment not found: ${deploymentId}`);
            }

            if (deployment.status !== 'running') {
                throw new Error(`Deployment is not running: ${deployment.status}`);
            }

            // Select instance using load balancing strategy
            const instance = this.selectInstance(deployment);
            if (!instance) {
                throw new Error('No healthy instances available');
            }

            // Track request
            deployment.metrics.totalRequests++;

            // Simulate prediction (in production, this would call the actual model)
            const prediction = await this.runInference(instance, inputData, options);

            const latency = Date.now() - startTime;

            // Log inference request
            await this.logInferenceRequest({
                id: requestId,
                deployment_id: deploymentId,
                instance_id: instance.id,
                input_data: this.config.monitoring.logInputs ? inputData : null,
                output_data: this.config.monitoring.logOutputs ? prediction : null,
                latency,
                timestamp: new Date().toISOString(),
                metadata: options.metadata || {}
            });

            // Update metrics
            deployment.metrics.successfulRequests++;
            this.updateLatencyMetrics(deployment, latency);

            span.setAttributes({
                'deployment.id': deploymentId,
                'request.id': requestId,
                'request.latency': latency,
                'instance.id': instance.id
            });

            this.events.emit('predictionCompleted', {
                deploymentId,
                requestId,
                latency,
                timestamp: Date.now()
            });

            return {
                requestId,
                prediction,
                latency,
                instanceId: instance.id,
                modelVersion: deployment.model.version
            };

        } catch (error) {
            const latency = Date.now() - startTime;
            
            // Update error metrics
            const deployment = this.activeDeployments.get(deploymentId);
            if (deployment) {
                deployment.metrics.failedRequests++;
            }

            // Log failed request
            await this.logInferenceRequest({
                id: requestId,
                deployment_id: deploymentId,
                input_data: this.config.monitoring.logInputs ? inputData : null,
                error: error.message,
                latency,
                timestamp: new Date().toISOString(),
                metadata: options.metadata || {}
            });

            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Create A/B test experiment
     */
    async createABTest(experimentConfig) {
        const span = this.tracer.startSpan('model_serving_platform_create_ab_test');

        try {
            if (!this.config.abTesting.enabled) {
                throw new Error('A/B testing is not enabled');
            }

            this.validateABTestConfig(experimentConfig);

            const experimentId = uuidv4();
            const experiment = {
                id: experimentId,
                name: experimentConfig.name,
                description: experimentConfig.description || null,
                status: 'running',
                variants: experimentConfig.variants, // Array of {deployment_id, traffic_percentage}
                traffic_allocation: experimentConfig.traffic_allocation || 'random',
                success_metric: experimentConfig.success_metric || 'accuracy',
                minimum_sample_size: experimentConfig.minimum_sample_size || 1000,
                confidence_level: experimentConfig.confidence_level || 0.95,
                start_time: new Date().toISOString(),
                end_time: null,
                created_by: experimentConfig.created_by || null,
                metadata: experimentConfig.metadata || {}
            };

            // Store in database
            const insertQuery = `
                INSERT INTO ab_test_experiments (
                    id, name, description, status, variants, traffic_allocation,
                    success_metric, minimum_sample_size, confidence_level,
                    start_time, created_by, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const values = [
                experiment.id, experiment.name, experiment.description, experiment.status,
                experiment.variants, experiment.traffic_allocation, experiment.success_metric,
                experiment.minimum_sample_size, experiment.confidence_level,
                experiment.start_time, experiment.created_by, experiment.metadata
            ];

            const result = await this.db.query(insertQuery, values);
            const savedExperiment = result.rows[0];

            // Add to active A/B tests
            this.abTests.set(experimentId, {
                ...savedExperiment,
                samples: new Map(),
                results: null
            });

            span.setAttributes({
                'ab_test.id': experimentId,
                'ab_test.name': experiment.name,
                'ab_test.variants': experiment.variants.length
            });

            this.events.emit('abTestCreated', {
                experiment: savedExperiment,
                timestamp: Date.now()
            });

            console.log(`A/B test created: ${experiment.name} (${experimentId})`);
            return savedExperiment;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Get deployment details
     */
    async getDeployment(deploymentId, includeMetrics = false) {
        const deployment = this.activeDeployments.get(deploymentId);
        
        if (!deployment) {
            // Try to load from database
            const result = await this.db.query(
                'SELECT * FROM model_deployments WHERE id = $1',
                [deploymentId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        }

        const deploymentInfo = {
            ...deployment,
            instances: Array.from(deployment.instances.values()),
            live_metrics: deployment.metrics
        };

        if (includeMetrics) {
            deploymentInfo.detailed_metrics = await this.getDetailedMetrics(deploymentId);
        }

        return deploymentInfo;
    }

    /**
     * List deployments with filtering
     */
    async listDeployments(filters = {}) {
        const {
            model_id = null,
            status = null,
            name = null,
            version = null,
            limit = 50,
            offset = 0
        } = filters;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        let query = `
            SELECT md.*, m.name as model_name, m.version as model_version
            FROM model_deployments md
            LEFT JOIN ml_models m ON md.model_id = m.id
        `;

        // Build where conditions
        if (model_id) {
            whereConditions.push(`md.model_id = $${paramIndex++}`);
            params.push(model_id);
        }

        if (status) {
            if (Array.isArray(status)) {
                whereConditions.push(`md.status = ANY($${paramIndex++})`);
                params.push(status);
            } else {
                whereConditions.push(`md.status = $${paramIndex++}`);
                params.push(status);
            }
        }

        if (name) {
            whereConditions.push(`md.name ILIKE $${paramIndex++}`);
            params.push(`%${name}%`);
        }

        if (version) {
            whereConditions.push(`md.version = $${paramIndex++}`);
            params.push(version);
        }

        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        query += ` ORDER BY md.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await this.db.query(query, params);
        return result.rows;
    }

    /**
     * Helper Methods
     */

    async startDeploymentProcess(deployment, model) {
        // Simulate deployment process
        setTimeout(async () => {
            try {
                // Create initial instances
                await this.createInstances(deployment, deployment.desired_replicas);
                
                // Update deployment status
                await this.updateDeploymentStatus(deployment.id, 'running');
                
                console.log(`Deployment ready: ${deployment.name}`);
                
                this.events.emit('deploymentReady', {
                    deploymentId: deployment.id,
                    timestamp: Date.now()
                });
                
            } catch (error) {
                console.error(`Deployment failed: ${deployment.name}`, error);
                await this.updateDeploymentStatus(deployment.id, 'failed');
                
                this.events.emit('deploymentFailed', {
                    deploymentId: deployment.id,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }, 5000); // Simulate 5 second deployment time
    }

    async createInstances(deployment, count) {
        const activeDeployment = this.activeDeployments.get(deployment.id);
        if (!activeDeployment) return;

        for (let i = 0; i < count; i++) {
            const instanceId = uuidv4();
            const instance = {
                id: instanceId,
                deployment_id: deployment.id,
                status: 'running',
                health: 'healthy',
                created_at: new Date().toISOString(),
                last_health_check: new Date().toISOString(),
                metrics: {
                    cpu: 0,
                    memory: 0,
                    requests: 0,
                    latency: 0
                }
            };

            // Store in database
            await this.db.query(`
                INSERT INTO deployment_replicas (
                    id, deployment_id, status, health, created_at, last_health_check
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                instance.id, instance.deployment_id, instance.status,
                instance.health, instance.created_at, instance.last_health_check
            ]);

            activeDeployment.instances.set(instanceId, instance);
        }

        // Update replica counts
        activeDeployment.ready_replicas = activeDeployment.instances.size;
        activeDeployment.available_replicas = Array.from(activeDeployment.instances.values())
            .filter(i => i.health === 'healthy').length;

        await this.db.query(`
            UPDATE model_deployments 
            SET ready_replicas = $1, available_replicas = $2 
            WHERE id = $3
        `, [
            activeDeployment.ready_replicas,
            activeDeployment.available_replicas,
            deployment.id
        ]);
    }

    async scaleUp(deployment, additionalReplicas) {
        await this.createInstances(deployment, additionalReplicas);
        console.log(`Scaled up deployment ${deployment.name} by ${additionalReplicas} replicas`);
    }

    async scaleDown(deployment, replicasToRemove) {
        const instances = Array.from(deployment.instances.values());
        const instancesToRemove = instances.slice(0, replicasToRemove);

        for (const instance of instancesToRemove) {
            // Remove from database
            await this.db.query(
                'DELETE FROM deployment_replicas WHERE id = $1',
                [instance.id]
            );

            deployment.instances.delete(instance.id);
        }

        // Update replica counts
        deployment.ready_replicas = deployment.instances.size;
        deployment.available_replicas = Array.from(deployment.instances.values())
            .filter(i => i.health === 'healthy').length;

        await this.db.query(`
            UPDATE model_deployments 
            SET ready_replicas = $1, available_replicas = $2 
            WHERE id = $3
        `, [
            deployment.ready_replicas,
            deployment.available_replicas,
            deployment.id
        ]);

        console.log(`Scaled down deployment ${deployment.name} by ${replicasToRemove} replicas`);
    }

    selectInstance(deployment) {
        const healthyInstances = Array.from(deployment.instances.values())
            .filter(instance => instance.health === 'healthy');

        if (healthyInstances.length === 0) {
            return null;
        }

        // Simple round-robin load balancing
        const instanceIndex = deployment.metrics.totalRequests % healthyInstances.length;
        return healthyInstances[instanceIndex];
    }

    async runInference(instance, inputData, options) {
        // Simulate inference based on framework and model type
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50)); // 50-150ms

        // Generate realistic prediction based on model type
        const modelType = options.modelType || 'classification';
        
        switch (modelType) {
            case 'classification':
                return {
                    prediction: Math.floor(Math.random() * 10),
                    confidence: Math.random() * 0.3 + 0.7,
                    probabilities: Array.from({length: 10}, () => Math.random()).map(x => x / 10)
                };
            
            case 'regression':
                return {
                    prediction: Math.random() * 100,
                    confidence_interval: [Math.random() * 80, Math.random() * 20 + 80]
                };
            
            case 'nlp':
                return {
                    prediction: 'positive',
                    confidence: 0.85,
                    tokens: ['sample', 'response', 'text']
                };
            
            default:
                return {
                    prediction: Math.random(),
                    metadata: { model_version: instance.deployment_id }
                };
        }
    }

    async logInferenceRequest(requestData) {
        try {
            await this.db.query(`
                INSERT INTO inference_requests (
                    id, deployment_id, instance_id, input_data, output_data,
                    error, latency, timestamp, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                requestData.id, requestData.deployment_id, requestData.instance_id,
                requestData.input_data, requestData.output_data, requestData.error || null,
                requestData.latency, requestData.timestamp, requestData.metadata
            ]);
        } catch (error) {
            console.error('Failed to log inference request:', error);
        }
    }

    updateLatencyMetrics(deployment, latency) {
        const metrics = deployment.metrics;
        
        // Simple moving average for demonstration
        if (metrics.averageLatency === 0) {
            metrics.averageLatency = latency;
        } else {
            metrics.averageLatency = (metrics.averageLatency * 0.9) + (latency * 0.1);
        }

        // Approximate p99 (simplified)
        metrics.p99Latency = Math.max(metrics.p99Latency, latency);
    }

    async updateDeploymentStatus(deploymentId, status) {
        await this.db.query(
            'UPDATE model_deployments SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, deploymentId]
        );

        const deployment = this.activeDeployments.get(deploymentId);
        if (deployment) {
            deployment.status = status;
        }
    }

    validateABTestConfig(config) {
        if (!config.name || config.name.trim() === '') {
            throw new Error('A/B test name is required');
        }

        if (!config.variants || !Array.isArray(config.variants) || config.variants.length < 2) {
            throw new Error('At least 2 variants are required for A/B testing');
        }

        const totalTraffic = config.variants.reduce((sum, variant) => sum + variant.traffic_percentage, 0);
        if (Math.abs(totalTraffic - 100) > 0.01) {
            throw new Error('Variant traffic percentages must sum to 100');
        }
    }

    async loadExistingDeployments() {
        const result = await this.db.query(`
            SELECT md.*, m.*
            FROM model_deployments md
            LEFT JOIN ml_models m ON md.model_id = m.id
            WHERE md.status IN ('running', 'deploying')
            ORDER BY md.created_at DESC
        `);

        for (const row of result.rows) {
            // Extract deployment and model data
            const deployment = {
                id: row.id,
                model_id: row.model_id,
                name: row.name,
                version: row.version,
                status: row.status,
                // ... other deployment fields
            };

            const model = {
                id: row.model_id,
                name: row.model_name || row.name,
                // ... other model fields
            };

            this.activeDeployments.set(deployment.id, {
                ...deployment,
                model,
                instances: new Map(),
                metrics: {
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0,
                    averageLatency: 0,
                    p99Latency: 0,
                    throughput: 0
                }
            });

            // Load instances for this deployment
            const instancesResult = await this.db.query(
                'SELECT * FROM deployment_replicas WHERE deployment_id = $1',
                [deployment.id]
            );

            const activeDeployment = this.activeDeployments.get(deployment.id);
            for (const instance of instancesResult.rows) {
                activeDeployment.instances.set(instance.id, instance);
            }
        }

        console.log(`Loaded ${result.rows.length} existing deployments`);
    }

    startHealthCheckWorker() {
        this.healthCheckWorker = setInterval(async () => {
            try {
                for (const deployment of this.activeDeployments.values()) {
                    await this.performHealthChecks(deployment);
                }
            } catch (error) {
                console.error('Health check worker error:', error);
            }
        }, this.config.loadBalancing.healthCheckInterval);
    }

    async performHealthChecks(deployment) {
        for (const instance of deployment.instances.values()) {
            // Simulate health check
            const isHealthy = Math.random() > 0.05; // 95% healthy
            const newHealth = isHealthy ? 'healthy' : 'unhealthy';

            if (instance.health !== newHealth) {
                instance.health = newHealth;
                instance.last_health_check = new Date().toISOString();

                await this.db.query(
                    'UPDATE deployment_replicas SET health = $1, last_health_check = $2 WHERE id = $3',
                    [newHealth, instance.last_health_check, instance.id]
                );

                if (!isHealthy) {
                    this.events.emit('instanceUnhealthy', {
                        deploymentId: deployment.id,
                        instanceId: instance.id,
                        timestamp: Date.now()
                    });
                }
            }
        }

        // Update available replicas count
        const availableCount = Array.from(deployment.instances.values())
            .filter(i => i.health === 'healthy').length;

        if (deployment.available_replicas !== availableCount) {
            deployment.available_replicas = availableCount;
            await this.db.query(
                'UPDATE model_deployments SET available_replicas = $1 WHERE id = $2',
                [availableCount, deployment.id]
            );
        }
    }

    startMetricsCollector() {
        this.metricsCollector = setInterval(async () => {
            try {
                for (const deployment of this.activeDeployments.values()) {
                    await this.collectMetrics(deployment);
                }
            } catch (error) {
                console.error('Metrics collector error:', error);
            }
        }, this.config.monitoring.metricsInterval);
    }

    async collectMetrics(deployment) {
        // Calculate throughput (requests per second)
        const now = Date.now();
        const timeWindow = this.config.monitoring.metricsInterval / 1000; // seconds
        deployment.metrics.throughput = deployment.metrics.totalRequests / timeWindow;

        // Store metrics snapshot
        try {
            await this.db.query(`
                INSERT INTO model_performance_metrics (
                    deployment_id, total_requests, successful_requests, failed_requests,
                    average_latency, p99_latency, throughput, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [
                deployment.id, deployment.metrics.totalRequests,
                deployment.metrics.successfulRequests, deployment.metrics.failedRequests,
                deployment.metrics.averageLatency, deployment.metrics.p99Latency,
                deployment.metrics.throughput
            ]);
        } catch (error) {
            console.error('Failed to store metrics:', error);
        }
    }

    startAutoScaler() {
        this.autoScaler = setInterval(async () => {
            try {
                for (const deployment of this.activeDeployments.values()) {
                    if (deployment.autoscaling_enabled) {
                        await this.evaluateAutoScaling(deployment);
                    }
                }
            } catch (error) {
                console.error('Auto scaler error:', error);
            }
        }, 30000); // Check every 30 seconds
    }

    async evaluateAutoScaling(deployment) {
        const metrics = deployment.metrics;
        const config = this.config.autoScaling;

        let shouldScale = false;
        let targetReplicas = deployment.desired_replicas;
        let reason = '';

        // Scale based on latency
        if (metrics.averageLatency > config.targetLatency) {
            targetReplicas = Math.min(
                deployment.desired_replicas + 1,
                this.config.maxReplicas
            );
            reason = 'high_latency';
            shouldScale = true;
        } else if (metrics.averageLatency < config.targetLatency * 0.5 && 
                   deployment.desired_replicas > this.config.minReplicas) {
            targetReplicas = Math.max(
                deployment.desired_replicas - 1,
                this.config.minReplicas
            );
            reason = 'low_latency';
            shouldScale = true;
        }

        if (shouldScale && targetReplicas !== deployment.desired_replicas) {
            await this.scaleDeployment(deployment.id, targetReplicas, `autoscale_${reason}`);
        }
    }

    async getDetailedMetrics(deploymentId) {
        const result = await this.db.query(`
            SELECT * FROM model_performance_metrics 
            WHERE deployment_id = $1 
            ORDER BY timestamp DESC 
            LIMIT 100
        `, [deploymentId]);

        return result.rows;
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        const totalInstances = Array.from(this.activeDeployments.values())
            .reduce((sum, deployment) => sum + deployment.instances.size, 0);

        const totalRequests = Array.from(this.activeDeployments.values())
            .reduce((sum, deployment) => sum + deployment.metrics.totalRequests, 0);

        return {
            active_deployments: this.activeDeployments.size,
            total_instances: totalInstances,
            total_requests: totalRequests,
            active_ab_tests: this.abTests.size,
            config: {
                auto_scaling_enabled: this.config.autoScaling.enabled,
                monitoring_enabled: this.config.monitoring.enabled,
                ab_testing_enabled: this.config.abTesting.enabled,
                canary_deployment_enabled: this.config.canaryDeployment.enabled
            },
            runtime: {
                initialized: this.initialized,
                running: this.isRunning
            }
        };
    }

    /**
     * Stop the Model Serving Platform
     */
    async stop() {
        console.log('Stopping Model Serving Platform...');

        this.isRunning = false;

        // Stop background workers
        if (this.healthCheckWorker) {
            clearInterval(this.healthCheckWorker);
            this.healthCheckWorker = null;
        }

        if (this.metricsCollector) {
            clearInterval(this.metricsCollector);
            this.metricsCollector = null;
        }

        if (this.autoScaler) {
            clearInterval(this.autoScaler);
            this.autoScaler = null;
        }

        // Clear state
        this.activeDeployments.clear();
        this.modelInstances.clear();
        this.loadBalancers.clear();
        this.performanceMetrics.clear();
        this.abTests.clear();

        this.events.emit('stopped', { timestamp: Date.now() });
        console.log('Model Serving Platform stopped');
    }
}

export default ModelServingPlatform;
