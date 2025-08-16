/**
 * Training Pipeline Engine
 * 
 * Orchestrates distributed ML training workflows with resource management,
 * hyperparameter optimization, and experiment tracking integration.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class TrainingPipelineEngine {
    constructor(db, config = {}) {
        this.db = db;
        this.config = {
            maxConcurrentTrainings: config.maxConcurrentTrainings || 5,
            defaultTimeout: config.defaultTimeout || 3600000, // 1 hour
            resourceLimits: {
                memory: config.resourceLimits?.memory || 8192, // MB
                cpu: config.resourceLimits?.cpu || 4, // cores
                gpu: config.resourceLimits?.gpu || 1 // GPU count
            },
            storageConfig: {
                checkpointPath: config.checkpointPath || './training-checkpoints',
                logPath: config.logPath || './training-logs',
                artifactPath: config.artifactPath || './training-artifacts'
            },
            distributedTraining: {
                enabled: config.distributedTraining?.enabled || false,
                maxNodes: config.distributedTraining?.maxNodes || 4,
                backend: config.distributedTraining?.backend || 'pytorch' // pytorch, tensorflow, horovod
            },
            hyperparameterOptimization: {
                enabled: config.hyperparameterOptimization?.enabled || true,
                defaultStrategy: config.hyperparameterOptimization?.strategy || 'random', // random, bayesian, grid
                maxTrials: config.hyperparameterOptimization?.maxTrials || 50
            },
            autoML: {
                enabled: config.autoML?.enabled || false,
                maxTime: config.autoML?.maxTime || 7200000 // 2 hours
            },
            ...config
        };

        this.tracer = OpenTelemetryTracing.getTracer('training-pipeline-engine');
        this.events = new EventEmitter();
        
        // Active training state
        this.activeTrainings = new Map();
        this.trainingWorkers = new Map();
        this.resourceAllocations = new Map();
        
        // Queues
        this.trainingQueue = [];
        this.priorityQueue = [];
        
        // Statistics
        this.stats = {
            totalTrainings: 0,
            successfulTrainings: 0,
            failedTrainings: 0,
            averageTrainingTime: 0,
            totalGpuHours: 0
        };

        this.initialized = false;
        this.isRunning = false;
        
        // Process management
        this.queueProcessor = null;
        this.resourceMonitor = null;
    }

    /**
     * Initialize the Training Pipeline Engine
     */
    async initialize() {
        const span = this.tracer.startSpan('training_pipeline_initialize');

        try {
            console.log('Initializing Training Pipeline Engine...');

            // Ensure storage directories exist
            await this.ensureStorageDirectories();

            // Load existing training jobs
            await this.loadExistingTrainings();

            // Initialize resource monitoring
            await this.initializeResourceMonitoring();

            // Start queue processor
            this.startQueueProcessor();

            // Initialize hyperparameter optimization engines
            if (this.config.hyperparameterOptimization.enabled) {
                await this.initializeHyperparameterOptimization();
            }

            this.initialized = true;
            this.isRunning = true;

            span.setAttributes({
                'training.pipeline.initialized': true,
                'training.pipeline.max_concurrent': this.config.maxConcurrentTrainings,
                'training.pipeline.distributed_enabled': this.config.distributedTraining.enabled
            });

            console.log('Training Pipeline Engine initialized successfully');
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
     * Submit a training job
     */
    async submitTrainingJob(trainingSpec, options = {}) {
        const span = this.tracer.startSpan('training_pipeline_submit_job');

        try {
            if (!this.isRunning) {
                throw new Error('TrainingPipelineEngine is not running');
            }

            // Validate training specification
            this.validateTrainingSpec(trainingSpec);

            const jobId = uuidv4();
            const {
                priority = 'normal',
                experimentId = null,
                parentJobId = null,
                retryOnFailure = true,
                maxRetries = 3,
                resourceRequirements = {}
            } = options;

            // Merge resource requirements with defaults
            const resources = {
                ...this.config.resourceLimits,
                ...resourceRequirements
            };

            const trainingJob = {
                id: jobId,
                experiment_id: experimentId,
                parent_job_id: parentJobId,
                status: 'queued',
                training_spec: trainingSpec,
                resource_requirements: resources,
                priority,
                retry_count: 0,
                max_retries: maxRetries,
                retry_on_failure: retryOnFailure,
                created_at: new Date().toISOString(),
                submitted_by: options.userId || null,
                metadata: options.metadata || {}
            };

            // Store in database
            const insertQuery = `
                INSERT INTO training_jobs (
                    id, experiment_id, parent_job_id, status, training_spec,
                    resource_requirements, priority, retry_count, max_retries,
                    retry_on_failure, created_at, submitted_by, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `;

            const values = [
                jobId, experimentId, parentJobId, trainingJob.status,
                trainingJob.training_spec, trainingJob.resource_requirements,
                priority, 0, maxRetries, retryOnFailure,
                trainingJob.created_at, trainingJob.submitted_by, trainingJob.metadata
            ];

            const result = await this.db.query(insertQuery, values);
            const savedJob = result.rows[0];

            // Add to appropriate queue
            if (priority === 'high' || priority === 'urgent') {
                this.priorityQueue.push(savedJob);
                this.priorityQueue.sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a));
            } else {
                this.trainingQueue.push(savedJob);
            }

            // Update statistics
            this.stats.totalTrainings++;

            // Emit event
            this.events.emit('jobSubmitted', {
                job: savedJob,
                queuePosition: this.getQueuePosition(jobId),
                timestamp: Date.now()
            });

            span.setAttributes({
                'training.job.id': jobId,
                'training.job.priority': priority,
                'training.job.experiment_id': experimentId || 'none',
                'training.job.queue_size': this.trainingQueue.length + this.priorityQueue.length
            });

            console.log(`Training job submitted: ${jobId} (priority: ${priority})`);
            return savedJob;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Start training execution
     */
    async startTraining(jobId) {
        const span = this.tracer.startSpan('training_pipeline_start_training');

        try {
            const job = await this.getTrainingJob(jobId);
            if (!job) {
                throw new Error(`Training job not found: ${jobId}`);
            }

            if (job.status !== 'queued') {
                throw new Error(`Job ${jobId} is not in queued status: ${job.status}`);
            }

            // Check resource availability
            const resourcesAvailable = await this.checkResourceAvailability(job.resource_requirements);
            if (!resourcesAvailable) {
                throw new Error(`Insufficient resources for job ${jobId}`);
            }

            // Allocate resources
            await this.allocateResources(jobId, job.resource_requirements);

            // Update job status
            await this.updateJobStatus(jobId, 'running', {
                started_at: new Date().toISOString()
            });

            // Create training environment
            const trainingEnv = await this.createTrainingEnvironment(job);

            // Start training process
            const worker = await this.startTrainingWorker(job, trainingEnv);
            this.trainingWorkers.set(jobId, worker);
            this.activeTrainings.set(jobId, {
                job,
                worker,
                environment: trainingEnv,
                startTime: Date.now(),
                metrics: {}
            });

            // Set up monitoring
            this.setupTrainingMonitoring(jobId, worker);

            span.setAttributes({
                'training.job.id': jobId,
                'training.job.started': true,
                'training.job.resources.memory': job.resource_requirements.memory,
                'training.job.resources.cpu': job.resource_requirements.cpu,
                'training.job.resources.gpu': job.resource_requirements.gpu
            });

            this.events.emit('trainingStarted', {
                jobId,
                job,
                timestamp: Date.now()
            });

            console.log(`Training started: ${jobId}`);
            return true;

        } catch (error) {
            // Release resources if allocation failed
            await this.releaseResources(jobId);
            
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Stop training job
     */
    async stopTraining(jobId, reason = 'user_requested') {
        const span = this.tracer.startSpan('training_pipeline_stop_training');

        try {
            const activeTraining = this.activeTrainings.get(jobId);
            if (!activeTraining) {
                throw new Error(`No active training found for job: ${jobId}`);
            }

            const { worker, job } = activeTraining;

            // Terminate worker process
            if (worker && !worker.killed) {
                await worker.terminate();
            }

            // Update job status
            await this.updateJobStatus(jobId, 'stopped', {
                stopped_at: new Date().toISOString(),
                stop_reason: reason
            });

            // Clean up resources
            await this.releaseResources(jobId);
            await this.cleanupTrainingEnvironment(jobId);

            // Remove from active trainings
            this.activeTrainings.delete(jobId);
            this.trainingWorkers.delete(jobId);

            span.setAttributes({
                'training.job.id': jobId,
                'training.job.stop_reason': reason
            });

            this.events.emit('trainingStopped', {
                jobId,
                reason,
                timestamp: Date.now()
            });

            console.log(`Training stopped: ${jobId} (reason: ${reason})`);

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Get training job details
     */
    async getTrainingJob(jobId, includeMetrics = false) {
        const query = includeMetrics 
            ? `SELECT tj.*, tm.metrics_data, tm.last_updated as metrics_updated
               FROM training_jobs tj
               LEFT JOIN training_metrics tm ON tj.id = tm.job_id
               WHERE tj.id = $1`
            : `SELECT * FROM training_jobs WHERE id = $1`;

        const result = await this.db.query(query, [jobId]);
        
        if (result.rows.length === 0) {
            return null;
        }

        const job = result.rows[0];

        // Add real-time metrics for active trainings
        if (this.activeTrainings.has(jobId)) {
            const activeTraining = this.activeTrainings.get(jobId);
            job.realtime_metrics = activeTraining.metrics;
            job.runtime_seconds = Math.floor((Date.now() - activeTraining.startTime) / 1000);
        }

        return job;
    }

    /**
     * List training jobs with filtering
     */
    async listTrainingJobs(filters = {}) {
        const {
            status = null,
            experiment_id = null,
            submitted_by = null,
            priority = null,
            limit = 50,
            offset = 0,
            includeMetrics = false
        } = filters;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        let query = includeMetrics 
            ? `SELECT tj.*, tm.metrics_data, tm.last_updated as metrics_updated
               FROM training_jobs tj
               LEFT JOIN training_metrics tm ON tj.id = tm.job_id`
            : `SELECT * FROM training_jobs tj`;

        // Build where conditions
        if (status) {
            if (Array.isArray(status)) {
                whereConditions.push(`tj.status = ANY($${paramIndex++})`);
                params.push(status);
            } else {
                whereConditions.push(`tj.status = $${paramIndex++}`);
                params.push(status);
            }
        }

        if (experiment_id) {
            whereConditions.push(`tj.experiment_id = $${paramIndex++}`);
            params.push(experiment_id);
        }

        if (submitted_by) {
            whereConditions.push(`tj.submitted_by = $${paramIndex++}`);
            params.push(submitted_by);
        }

        if (priority) {
            whereConditions.push(`tj.priority = $${paramIndex++}`);
            params.push(priority);
        }

        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        query += ` ORDER BY tj.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await this.db.query(query, params);
        return result.rows;
    }

    /**
     * Retry failed training job
     */
    async retryTrainingJob(jobId, options = {}) {
        const job = await this.getTrainingJob(jobId);
        if (!job) {
            throw new Error(`Training job not found: ${jobId}`);
        }

        if (job.status !== 'failed') {
            throw new Error(`Job ${jobId} is not in failed status: ${job.status}`);
        }

        if (job.retry_count >= job.max_retries) {
            throw new Error(`Job ${jobId} has exceeded maximum retries (${job.max_retries})`);
        }

        // Create new job as retry
        const retryJobId = uuidv4();
        const retrySpec = {
            ...job.training_spec,
            ...options.trainingSpecUpdates || {}
        };

        const retryJob = {
            id: retryJobId,
            experiment_id: job.experiment_id,
            parent_job_id: job.id,
            status: 'queued',
            training_spec: retrySpec,
            resource_requirements: job.resource_requirements,
            priority: options.priority || job.priority,
            retry_count: job.retry_count + 1,
            max_retries: job.max_retries,
            retry_on_failure: job.retry_on_failure,
            created_at: new Date().toISOString(),
            submitted_by: job.submitted_by,
            metadata: { 
                ...job.metadata, 
                is_retry: true, 
                original_job_id: job.id 
            }
        };

        // Store retry job
        const insertQuery = `
            INSERT INTO training_jobs (
                id, experiment_id, parent_job_id, status, training_spec,
                resource_requirements, priority, retry_count, max_retries,
                retry_on_failure, created_at, submitted_by, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const values = [
            retryJobId, retryJob.experiment_id, retryJob.parent_job_id,
            retryJob.status, retryJob.training_spec, retryJob.resource_requirements,
            retryJob.priority, retryJob.retry_count, retryJob.max_retries,
            retryJob.retry_on_failure, retryJob.created_at, retryJob.submitted_by,
            retryJob.metadata
        ];

        const result = await this.db.query(insertQuery, values);
        const savedRetryJob = result.rows[0];

        // Add to queue
        this.trainingQueue.push(savedRetryJob);

        this.events.emit('jobRetried', {
            originalJobId: jobId,
            retryJobId,
            retryCount: retryJob.retry_count,
            timestamp: Date.now()
        });

        console.log(`Training job retried: ${jobId} -> ${retryJobId} (attempt ${retryJob.retry_count + 1})`);
        return savedRetryJob;
    }

    /**
     * Run hyperparameter optimization
     */
    async runHyperparameterOptimization(baseTrainingSpec, hyperparamSpace, options = {}) {
        const span = this.tracer.startSpan('training_pipeline_hyperparameter_optimization');

        try {
            if (!this.config.hyperparameterOptimization.enabled) {
                throw new Error('Hyperparameter optimization is not enabled');
            }

            const {
                strategy = this.config.hyperparameterOptimization.defaultStrategy,
                maxTrials = this.config.hyperparameterOptimization.maxTrials,
                metric = 'accuracy',
                direction = 'maximize',
                experimentId = uuidv4()
            } = options;

            // Create parent experiment
            const experiment = await this.createExperiment({
                id: experimentId,
                name: options.experimentName || `HPO-${Date.now()}`,
                description: `Hyperparameter optimization using ${strategy} strategy`,
                type: 'hyperparameter_optimization',
                config: {
                    strategy,
                    maxTrials,
                    metric,
                    direction,
                    hyperparamSpace
                }
            });

            // Generate trial configurations based on strategy
            const trialConfigs = await this.generateTrialConfigurations(
                hyperparamSpace, 
                strategy, 
                maxTrials
            );

            const trialJobs = [];

            // Submit training jobs for each trial
            for (let i = 0; i < trialConfigs.length; i++) {
                const trialSpec = {
                    ...baseTrainingSpec,
                    hyperparameters: trialConfigs[i]
                };

                const trialJob = await this.submitTrainingJob(trialSpec, {
                    experimentId,
                    priority: 'normal',
                    metadata: {
                        trial_index: i,
                        hyperparameter_trial: true,
                        target_metric: metric,
                        optimization_direction: direction
                    }
                });

                trialJobs.push(trialJob);
            }

            span.setAttributes({
                'hpo.experiment_id': experimentId,
                'hpo.strategy': strategy,
                'hpo.max_trials': maxTrials,
                'hpo.trials_submitted': trialJobs.length
            });

            this.events.emit('hpoStarted', {
                experimentId,
                strategy,
                maxTrials,
                trialJobs: trialJobs.length,
                timestamp: Date.now()
            });

            return {
                experiment,
                trialJobs,
                summary: {
                    strategy,
                    maxTrials,
                    trialsSubmitted: trialJobs.length,
                    targetMetric: metric,
                    direction
                }
            };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Monitor training progress
     */
    async getTrainingProgress(jobId) {
        const activeTraining = this.activeTrainings.get(jobId);
        if (!activeTraining) {
            // Get final metrics from database
            const result = await this.db.query(
                'SELECT * FROM training_metrics WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
                [jobId]
            );

            return result.rows[0] || null;
        }

        // Return real-time metrics for active training
        return {
            job_id: jobId,
            status: 'running',
            progress_percentage: activeTraining.metrics.progress || 0,
            current_epoch: activeTraining.metrics.epoch || 0,
            current_loss: activeTraining.metrics.loss || null,
            current_accuracy: activeTraining.metrics.accuracy || null,
            elapsed_time: Math.floor((Date.now() - activeTraining.startTime) / 1000),
            estimated_remaining: activeTraining.metrics.eta || null,
            metrics_data: activeTraining.metrics,
            last_updated: new Date().toISOString()
        };
    }

    /**
     * Helper Methods
     */

    validateTrainingSpec(spec) {
        const required = ['model_type', 'algorithm'];
        const missing = required.filter(field => !spec[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required training specification fields: ${missing.join(', ')}`);
        }

        // Validate training configuration
        if (spec.training_config) {
            if (spec.training_config.epochs && spec.training_config.epochs <= 0) {
                throw new Error('Epochs must be greater than 0');
            }

            if (spec.training_config.batch_size && spec.training_config.batch_size <= 0) {
                throw new Error('Batch size must be greater than 0');
            }
        }
    }

    async ensureStorageDirectories() {
        const directories = [
            this.config.storageConfig.checkpointPath,
            this.config.storageConfig.logPath,
            this.config.storageConfig.artifactPath
        ];

        for (const dir of directories) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async loadExistingTrainings() {
        // Load running training jobs that were interrupted
        const result = await this.db.query(`
            SELECT * FROM training_jobs 
            WHERE status = 'running' 
            ORDER BY created_at DESC
        `);

        // Mark interrupted jobs as failed
        for (const job of result.rows) {
            await this.updateJobStatus(job.id, 'failed', {
                stopped_at: new Date().toISOString(),
                stop_reason: 'system_restart'
            });
        }

        console.log(`Marked ${result.rows.length} interrupted training jobs as failed`);
    }

    async checkResourceAvailability(requirements) {
        const activeCount = this.activeTrainings.size;
        
        if (activeCount >= this.config.maxConcurrentTrainings) {
            return false;
        }

        // Check if resources are available
        let totalMemory = 0;
        let totalCpu = 0;
        let totalGpu = 0;

        for (const allocation of this.resourceAllocations.values()) {
            totalMemory += allocation.memory || 0;
            totalCpu += allocation.cpu || 0;
            totalGpu += allocation.gpu || 0;
        }

        // Simplified resource check (in production, integrate with actual resource manager)
        const memoryLimit = this.config.resourceLimits.memory * this.config.maxConcurrentTrainings;
        const cpuLimit = this.config.resourceLimits.cpu * this.config.maxConcurrentTrainings;
        const gpuLimit = this.config.resourceLimits.gpu * this.config.maxConcurrentTrainings;

        return (totalMemory + requirements.memory <= memoryLimit) &&
               (totalCpu + requirements.cpu <= cpuLimit) &&
               (totalGpu + requirements.gpu <= gpuLimit);
    }

    async allocateResources(jobId, requirements) {
        this.resourceAllocations.set(jobId, {
            memory: requirements.memory,
            cpu: requirements.cpu,
            gpu: requirements.gpu,
            allocated_at: Date.now()
        });

        console.log(`Resources allocated for job ${jobId}:`, requirements);
    }

    async releaseResources(jobId) {
        const allocation = this.resourceAllocations.get(jobId);
        if (allocation) {
            this.resourceAllocations.delete(jobId);
            console.log(`Resources released for job ${jobId}`);
        }
    }

    async createTrainingEnvironment(job) {
        const envId = `env_${job.id}`;
        const envPath = path.join(this.config.storageConfig.artifactPath, envId);
        
        await fs.mkdir(envPath, { recursive: true });

        return {
            id: envId,
            path: envPath,
            job_id: job.id,
            config: job.training_spec,
            checkpointPath: path.join(this.config.storageConfig.checkpointPath, envId),
            logPath: path.join(this.config.storageConfig.logPath, envId)
        };
    }

    async startTrainingWorker(job, environment) {
        // In production, this would start actual training processes
        // For now, simulate with a worker thread
        const workerData = {
            jobId: job.id,
            trainingSpec: job.training_spec,
            environment: environment,
            resourceRequirements: job.resource_requirements
        };

        // This would be replaced with actual training framework integration
        const worker = new Worker(path.join(__dirname, '../workers/trainingWorker.js'), {
            workerData
        });

        return worker;
    }

    setupTrainingMonitoring(jobId, worker) {
        worker.on('message', async (message) => {
            try {
                const { type, data } = message;

                switch (type) {
                    case 'metrics':
                        await this.updateTrainingMetrics(jobId, data);
                        break;
                    case 'progress':
                        await this.updateTrainingProgress(jobId, data);
                        break;
                    case 'checkpoint':
                        await this.saveCheckpoint(jobId, data);
                        break;
                    case 'completion':
                        await this.handleTrainingCompletion(jobId, data);
                        break;
                    case 'error':
                        await this.handleTrainingError(jobId, data);
                        break;
                }
            } catch (error) {
                console.error(`Error processing worker message for job ${jobId}:`, error);
            }
        });

        worker.on('error', async (error) => {
            console.error(`Worker error for job ${jobId}:`, error);
            await this.handleTrainingError(jobId, { error: error.message });
        });

        worker.on('exit', async (code) => {
            if (code !== 0) {
                await this.handleTrainingError(jobId, { 
                    error: `Worker exited with code ${code}` 
                });
            }
        });
    }

    async updateJobStatus(jobId, status, additionalData = {}) {
        const updateData = {
            status,
            updated_at: new Date().toISOString(),
            ...additionalData
        };

        const fields = Object.keys(updateData);
        const values = [jobId, ...Object.values(updateData)];
        const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

        await this.db.query(
            `UPDATE training_jobs SET ${setClause} WHERE id = $1`,
            values
        );

        this.events.emit('jobStatusUpdated', {
            jobId,
            status,
            additionalData,
            timestamp: Date.now()
        });
    }

    async updateTrainingMetrics(jobId, metrics) {
        // Update real-time metrics
        const activeTraining = this.activeTrainings.get(jobId);
        if (activeTraining) {
            activeTraining.metrics = { ...activeTraining.metrics, ...metrics };
        }

        // Store in database
        await this.db.query(`
            INSERT INTO training_metrics (job_id, metrics_data, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (job_id) 
            DO UPDATE SET 
                metrics_data = $2,
                last_updated = NOW()
        `, [jobId, metrics]);
    }

    async handleTrainingCompletion(jobId, data) {
        const activeTraining = this.activeTrainings.get(jobId);
        if (!activeTraining) return;

        const duration = Date.now() - activeTraining.startTime;

        await this.updateJobStatus(jobId, 'completed', {
            completed_at: new Date().toISOString(),
            final_metrics: data.metrics || {},
            training_duration: Math.floor(duration / 1000)
        });

        // Clean up
        await this.releaseResources(jobId);
        this.activeTrainings.delete(jobId);
        this.trainingWorkers.delete(jobId);

        // Update statistics
        this.stats.successfulTrainings++;
        this.updateAverageTrainingTime(duration);

        this.events.emit('trainingCompleted', {
            jobId,
            duration,
            finalMetrics: data.metrics,
            timestamp: Date.now()
        });

        console.log(`Training completed: ${jobId} (${Math.floor(duration / 1000)}s)`);
    }

    async handleTrainingError(jobId, errorData) {
        const activeTraining = this.activeTrainings.get(jobId);
        const job = activeTraining ? activeTraining.job : await this.getTrainingJob(jobId);

        await this.updateJobStatus(jobId, 'failed', {
            failed_at: new Date().toISOString(),
            error_message: errorData.error || 'Unknown error',
            error_details: errorData
        });

        // Clean up
        await this.releaseResources(jobId);
        this.activeTrainings.delete(jobId);
        this.trainingWorkers.delete(jobId);

        // Update statistics
        this.stats.failedTrainings++;

        // Auto-retry if configured
        if (job && job.retry_on_failure && job.retry_count < job.max_retries) {
            setTimeout(() => {
                this.retryTrainingJob(jobId).catch(error => {
                    console.error(`Auto-retry failed for job ${jobId}:`, error);
                });
            }, 5000); // Retry after 5 seconds
        }

        this.events.emit('trainingFailed', {
            jobId,
            error: errorData.error,
            retryScheduled: job?.retry_on_failure && job?.retry_count < job?.max_retries,
            timestamp: Date.now()
        });

        console.error(`Training failed: ${jobId} - ${errorData.error}`);
    }

    startQueueProcessor() {
        this.queueProcessor = setInterval(async () => {
            try {
                if (this.activeTrainings.size >= this.config.maxConcurrentTrainings) {
                    return;
                }

                // Process priority queue first
                let job = this.priorityQueue.shift();
                if (!job) {
                    job = this.trainingQueue.shift();
                }

                if (job && job.status === 'queued') {
                    await this.startTraining(job.id);
                }
            } catch (error) {
                console.error('Queue processor error:', error);
            }
        }, 5000); // Check every 5 seconds
    }

    getPriorityScore(job) {
        const priorityScores = {
            urgent: 100,
            high: 75,
            normal: 50,
            low: 25
        };

        return priorityScores[job.priority] || 50;
    }

    getQueuePosition(jobId) {
        const priorityPosition = this.priorityQueue.findIndex(job => job.id === jobId);
        if (priorityPosition !== -1) {
            return priorityPosition + 1;
        }

        const normalPosition = this.trainingQueue.findIndex(job => job.id === jobId);
        if (normalPosition !== -1) {
            return this.priorityQueue.length + normalPosition + 1;
        }

        return -1; // Not found in queue
    }

    updateAverageTrainingTime(newDuration) {
        const totalCompleted = this.stats.successfulTrainings + this.stats.failedTrainings;
        this.stats.averageTrainingTime = (
            (this.stats.averageTrainingTime * (totalCompleted - 1)) + newDuration
        ) / totalCompleted;
    }

    async initializeResourceMonitoring() {
        // Initialize resource monitoring
        console.log('Resource monitoring initialized');
    }

    async initializeHyperparameterOptimization() {
        // Initialize HPO engines
        console.log('Hyperparameter optimization engines initialized');
    }

    async createExperiment(experimentData) {
        // This would integrate with the experiment tracking system
        return experimentData;
    }

    async generateTrialConfigurations(hyperparamSpace, strategy, maxTrials) {
        // Generate trial configurations based on optimization strategy
        const trials = [];
        
        for (let i = 0; i < maxTrials; i++) {
            const config = {};
            
            // Simple random sampling for demo
            for (const [param, space] of Object.entries(hyperparamSpace)) {
                if (space.type === 'float') {
                    config[param] = Math.random() * (space.max - space.min) + space.min;
                } else if (space.type === 'int') {
                    config[param] = Math.floor(Math.random() * (space.max - space.min + 1)) + space.min;
                } else if (space.type === 'choice') {
                    config[param] = space.choices[Math.floor(Math.random() * space.choices.length)];
                }
            }
            
            trials.push(config);
        }

        return trials;
    }

    async cleanupTrainingEnvironment(jobId) {
        // Clean up training environment
        console.log(`Cleaning up training environment for job ${jobId}`);
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            active_trainings: this.activeTrainings.size,
            queued_jobs: this.trainingQueue.length + this.priorityQueue.length,
            priority_queue_size: this.priorityQueue.length,
            normal_queue_size: this.trainingQueue.length,
            resource_allocations: this.resourceAllocations.size,
            config: {
                max_concurrent_trainings: this.config.maxConcurrentTrainings,
                distributed_training_enabled: this.config.distributedTraining.enabled,
                hyperparameter_optimization_enabled: this.config.hyperparameterOptimization.enabled,
                automl_enabled: this.config.autoML.enabled
            },
            runtime: {
                initialized: this.initialized,
                running: this.isRunning
            }
        };
    }

    /**
     * Stop the Training Pipeline Engine
     */
    async stop() {
        console.log('Stopping Training Pipeline Engine...');
        
        this.isRunning = false;

        // Stop queue processor
        if (this.queueProcessor) {
            clearInterval(this.queueProcessor);
            this.queueProcessor = null;
        }

        // Stop all active trainings
        const stopPromises = Array.from(this.activeTrainings.keys()).map(jobId =>
            this.stopTraining(jobId, 'system_shutdown').catch(error =>
                console.error(`Failed to stop training ${jobId}:`, error)
            )
        );

        await Promise.all(stopPromises);

        // Clear state
        this.activeTrainings.clear();
        this.trainingWorkers.clear();
        this.resourceAllocations.clear();
        this.trainingQueue.length = 0;
        this.priorityQueue.length = 0;

        this.events.emit('stopped', { timestamp: Date.now() });
        console.log('Training Pipeline Engine stopped');
    }
}

export default TrainingPipelineEngine;
