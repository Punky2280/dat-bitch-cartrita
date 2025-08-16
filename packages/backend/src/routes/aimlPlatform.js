/**
 * AI/ML Integration Platform Routes
 * 
 * Comprehensive REST API endpoints for ML model management, training, deployment,
 * experimentation, and monitoring with full MLOps lifecycle support.
 */

import express from 'express';
import multer from 'multer';
const router = express.Router();
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

// Configure multer for file uploads
const upload = multer({
    dest: './uploads/ml-artifacts/',
    limits: {
        fileSize: 1024 * 1024 * 1024 // 1GB limit
    }
});

// Middleware to inject services (to be configured in main app)
const injectServices = (req, res, next) => {
    // Services will be attached to app.locals in main application
    req.services = {
        modelRegistry: req.app.locals.modelRegistry,
        trainingPipeline: req.app.locals.trainingPipeline,
        experimentTracker: req.app.locals.experimentTracker,
        modelServing: req.app.locals.modelServing
    };
    next();
};

router.use(injectServices);

/**
 * ML Model Registry Routes
 */

// Register a new model or model version
router.post('/models', async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('register_model');
    
    try {
        const { modelRegistry } = req.services;
        if (!modelRegistry) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model registry service not available' 
            });
        }

        const model = await modelRegistry.registerModel(req.body, {
            autoIncrementVersion: req.query.auto_increment === 'true',
            setAsPrimary: req.query.set_primary === 'true',
            parentModels: req.body.parent_models || []
        });

        span.setAttributes({
            'ml.model.id': model.id,
            'ml.model.name': model.name,
            'ml.model.framework': model.framework
        });

        res.json({
            success: true,
            data: model
        });

    } catch (error) {
        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

// Get model by ID
router.get('/models/:modelId', async (req, res) => {
    try {
        const { modelRegistry } = req.services;
        if (!modelRegistry) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model registry service not available' 
            });
        }

        const model = await modelRegistry.getModel(req.params.modelId, {
            includeArtifacts: req.query.include_artifacts === 'true',
            includeMetrics: req.query.include_metrics === 'true',
            includeLineage: req.query.include_lineage === 'true'
        });

        if (!model) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        res.json({
            success: true,
            data: model
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// List models with filtering
router.get('/models', async (req, res) => {
    try {
        const { modelRegistry } = req.services;
        if (!modelRegistry) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model registry service not available' 
            });
        }

        const filters = {
            name: req.query.name,
            framework: req.query.framework,
            model_type: req.query.model_type,
            status: req.query.status,
            visibility: req.query.visibility,
            created_by: req.query.created_by,
            tags: req.query.tags ? req.query.tags.split(',') : null,
            search: req.query.search,
            sortBy: req.query.sort_by || 'created_at',
            sortOrder: req.query.sort_order || 'DESC',
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
            includeArtifacts: req.query.include_artifacts === 'true'
        };

        const models = await modelRegistry.listModels(filters);

        res.json({
            success: true,
            data: models,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: models.length
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update model metadata
router.put('/models/:modelId', async (req, res) => {
    try {
        const { modelRegistry } = req.services;
        if (!modelRegistry) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model registry service not available' 
            });
        }

        const updatedModel = await modelRegistry.updateModel(req.params.modelId, req.body);

        res.json({
            success: true,
            data: updatedModel
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Delete model
router.delete('/models/:modelId', async (req, res) => {
    try {
        const { modelRegistry } = req.services;
        if (!modelRegistry) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model registry service not available' 
            });
        }

        await modelRegistry.deleteModel(req.params.modelId, {
            softDelete: req.query.soft !== 'false',
            deleteArtifacts: req.query.delete_artifacts === 'true'
        });

        res.json({
            success: true,
            message: 'Model deleted successfully'
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Upload model artifact
router.post('/models/:modelId/artifacts', upload.single('artifact'), async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('upload_model_artifact');

    try {
        const { modelRegistry } = req.services;
        if (!modelRegistry) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model registry service not available' 
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No artifact file provided'
            });
        }

        const artifactData = {
            artifact_type: req.body.artifact_type || 'model',
            name: req.body.name || req.file.originalname,
            content_type: req.file.mimetype,
            is_primary: req.body.is_primary === 'true',
            metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
        };

        const fileBuffer = require('fs').readFileSync(req.file.path);
        const artifact = await modelRegistry.storeArtifact(
            req.params.modelId,
            artifactData,
            fileBuffer
        );

        // Clean up temporary file
        require('fs').unlinkSync(req.file.path);

        span.setAttributes({
            'ml.artifact.id': artifact.id,
            'ml.artifact.size': fileBuffer.length
        });

        res.json({
            success: true,
            data: artifact
        });

    } catch (error) {
        // Clean up temporary file on error
        if (req.file && req.file.path) {
            try {
                require('fs').unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Failed to cleanup temporary file:', cleanupError);
            }
        }

        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

// Compare models
router.post('/models/compare', async (req, res) => {
    try {
        const { modelRegistry } = req.services;
        if (!modelRegistry) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model registry service not available' 
            });
        }

        const { model_ids, comparison_metrics = [] } = req.body;

        if (!model_ids || !Array.isArray(model_ids) || model_ids.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'At least 2 model IDs are required for comparison'
            });
        }

        const comparison = await modelRegistry.compareModels(model_ids, comparison_metrics);

        res.json({
            success: true,
            data: comparison
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Search models
router.get('/models/search', async (req, res) => {
    try {
        const { modelRegistry } = req.services;
        if (!modelRegistry) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model registry service not available' 
            });
        }

        const { q: searchQuery, limit = 20 } = req.query;

        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        const results = await modelRegistry.searchModels(searchQuery, {
            includeContent: req.query.include_content === 'true',
            includeMetadata: req.query.include_metadata !== 'false',
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            data: results
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Training Pipeline Routes
 */

// Submit training job
router.post('/training/jobs', async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('submit_training_job');

    try {
        const { trainingPipeline } = req.services;
        if (!trainingPipeline) {
            return res.status(503).json({ 
                success: false, 
                error: 'Training pipeline service not available' 
            });
        }

        const job = await trainingPipeline.submitTrainingJob(req.body.training_spec, {
            priority: req.body.priority || 'normal',
            experimentId: req.body.experiment_id,
            parentJobId: req.body.parent_job_id,
            retryOnFailure: req.body.retry_on_failure !== false,
            maxRetries: req.body.max_retries || 3,
            resourceRequirements: req.body.resource_requirements,
            userId: req.user?.id,
            metadata: req.body.metadata
        });

        span.setAttributes({
            'training.job.id': job.id,
            'training.job.priority': job.priority
        });

        res.json({
            success: true,
            data: job
        });

    } catch (error) {
        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

// Get training job details
router.get('/training/jobs/:jobId', async (req, res) => {
    try {
        const { trainingPipeline } = req.services;
        if (!trainingPipeline) {
            return res.status(503).json({ 
                success: false, 
                error: 'Training pipeline service not available' 
            });
        }

        const job = await trainingPipeline.getTrainingJob(
            req.params.jobId,
            req.query.include_metrics === 'true'
        );

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Training job not found'
            });
        }

        res.json({
            success: true,
            data: job
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// List training jobs
router.get('/training/jobs', async (req, res) => {
    try {
        const { trainingPipeline } = req.services;
        if (!trainingPipeline) {
            return res.status(503).json({ 
                success: false, 
                error: 'Training pipeline service not available' 
            });
        }

        const filters = {
            status: req.query.status ? req.query.status.split(',') : null,
            experiment_id: req.query.experiment_id,
            submitted_by: req.query.submitted_by,
            priority: req.query.priority,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
            includeMetrics: req.query.include_metrics === 'true'
        };

        const jobs = await trainingPipeline.listTrainingJobs(filters);

        res.json({
            success: true,
            data: jobs,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: jobs.length
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop training job
router.post('/training/jobs/:jobId/stop', async (req, res) => {
    try {
        const { trainingPipeline } = req.services;
        if (!trainingPipeline) {
            return res.status(503).json({ 
                success: false, 
                error: 'Training pipeline service not available' 
            });
        }

        await trainingPipeline.stopTraining(
            req.params.jobId,
            req.body.reason || 'user_requested'
        );

        res.json({
            success: true,
            message: 'Training job stopped successfully'
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Retry training job
router.post('/training/jobs/:jobId/retry', async (req, res) => {
    try {
        const { trainingPipeline } = req.services;
        if (!trainingPipeline) {
            return res.status(503).json({ 
                success: false, 
                error: 'Training pipeline service not available' 
            });
        }

        const retryJob = await trainingPipeline.retryTrainingJob(req.params.jobId, {
            priority: req.body.priority,
            trainingSpecUpdates: req.body.training_spec_updates
        });

        res.json({
            success: true,
            data: retryJob
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Get training progress
router.get('/training/jobs/:jobId/progress', async (req, res) => {
    try {
        const { trainingPipeline } = req.services;
        if (!trainingPipeline) {
            return res.status(503).json({ 
                success: false, 
                error: 'Training pipeline service not available' 
            });
        }

        const progress = await trainingPipeline.getTrainingProgress(req.params.jobId);

        if (!progress) {
            return res.status(404).json({
                success: false,
                error: 'Training progress not found'
            });
        }

        res.json({
            success: true,
            data: progress
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Run hyperparameter optimization
router.post('/training/hyperparameter-optimization', async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('run_hyperparameter_optimization');

    try {
        const { trainingPipeline } = req.services;
        if (!trainingPipeline) {
            return res.status(503).json({ 
                success: false, 
                error: 'Training pipeline service not available' 
            });
        }

        const {
            base_training_spec,
            hyperparam_space,
            strategy = 'random',
            max_trials = 50,
            metric = 'accuracy',
            direction = 'maximize',
            experiment_name
        } = req.body;

        const hpoResult = await trainingPipeline.runHyperparameterOptimization(
            base_training_spec,
            hyperparam_space,
            {
                strategy,
                maxTrials: max_trials,
                metric,
                direction,
                experimentName: experiment_name
            }
        );

        span.setAttributes({
            'hpo.strategy': strategy,
            'hpo.max_trials': max_trials,
            'hpo.experiment_id': hpoResult.experiment.id
        });

        res.json({
            success: true,
            data: hpoResult
        });

    } catch (error) {
        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Experiment Tracker Routes
 */

// Create experiment
router.post('/experiments', async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('create_experiment');

    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        const experiment = await experimentTracker.createExperiment({
            ...req.body,
            created_by: req.user?.id
        });

        span.setAttributes({
            'experiment.id': experiment.id,
            'experiment.name': experiment.name
        });

        res.json({
            success: true,
            data: experiment
        });

    } catch (error) {
        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

// Get experiment
router.get('/experiments/:experimentId', async (req, res) => {
    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        const experiment = await experimentTracker.getExperiment(
            req.params.experimentId,
            req.query.include_runs === 'true'
        );

        if (!experiment) {
            return res.status(404).json({
                success: false,
                error: 'Experiment not found'
            });
        }

        res.json({
            success: true,
            data: experiment
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// List experiments
router.get('/experiments', async (req, res) => {
    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        const filters = {
            project_id: req.query.project_id,
            type: req.query.type,
            status: req.query.status,
            created_by: req.query.created_by,
            tags: req.query.tags ? req.query.tags.split(',') : null,
            search: req.query.search,
            sortBy: req.query.sort_by || 'created_at',
            sortOrder: req.query.sort_order || 'DESC',
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const experiments = await experimentTracker.listExperiments(filters);

        res.json({
            success: true,
            data: experiments,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: experiments.length
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start experiment run
router.post('/experiments/:experimentId/runs', async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('start_experiment_run');

    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        const run = await experimentTracker.startRun(req.params.experimentId, {
            ...req.body,
            created_by: req.user?.id
        });

        span.setAttributes({
            'experiment.id': req.params.experimentId,
            'run.id': run.id
        });

        res.json({
            success: true,
            data: run
        });

    } catch (error) {
        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

// Get run details
router.get('/runs/:runId', async (req, res) => {
    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        const run = await experimentTracker.getRun(
            req.params.runId,
            req.query.include_metrics === 'true',
            req.query.include_artifacts === 'true'
        );

        if (!run) {
            return res.status(404).json({
                success: false,
                error: 'Run not found'
            });
        }

        res.json({
            success: true,
            data: run
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Log metrics for run
router.post('/runs/:runId/metrics', async (req, res) => {
    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        await experimentTracker.logMetrics(
            req.params.runId,
            req.body.metrics,
            req.body.step,
            req.body.timestamp
        );

        res.json({
            success: true,
            message: 'Metrics logged successfully'
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Log parameters for run
router.post('/runs/:runId/parameters', async (req, res) => {
    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        await experimentTracker.logParameters(req.params.runId, req.body.parameters);

        res.json({
            success: true,
            message: 'Parameters logged successfully'
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Log artifact for run
router.post('/runs/:runId/artifacts', upload.single('artifact'), async (req, res) => {
    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No artifact file provided'
            });
        }

        const artifact = await experimentTracker.logArtifact(
            req.params.runId,
            req.body.name || req.file.originalname,
            req.file.path,
            req.body.type || 'file',
            {
                size: req.file.size,
                mimetype: req.file.mimetype,
                ...JSON.parse(req.body.metadata || '{}')
            }
        );

        res.json({
            success: true,
            data: artifact
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// End experiment run
router.post('/runs/:runId/end', async (req, res) => {
    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        await experimentTracker.endRun(
            req.params.runId,
            req.body.status || 'completed',
            req.body.final_metrics || {}
        );

        res.json({
            success: true,
            message: 'Run ended successfully'
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Compare runs
router.post('/runs/compare', async (req, res) => {
    try {
        const { experimentTracker } = req.services;
        if (!experimentTracker) {
            return res.status(503).json({ 
                success: false, 
                error: 'Experiment tracker service not available' 
            });
        }

        const { run_ids, comparison_metrics = [] } = req.body;

        if (!run_ids || !Array.isArray(run_ids) || run_ids.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'At least 2 run IDs are required for comparison'
            });
        }

        const comparison = await experimentTracker.compareRuns(run_ids, comparison_metrics);

        res.json({
            success: true,
            data: comparison
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Model Serving Platform Routes
 */

// Deploy model
router.post('/deployments', async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('deploy_model');

    try {
        const { modelServing } = req.services;
        if (!modelServing) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model serving service not available' 
            });
        }

        const deployment = await modelServing.deployModel(req.body.model_id, req.body.config);

        span.setAttributes({
            'deployment.id': deployment.id,
            'deployment.model_id': req.body.model_id
        });

        res.json({
            success: true,
            data: deployment
        });

    } catch (error) {
        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

// Get deployment
router.get('/deployments/:deploymentId', async (req, res) => {
    try {
        const { modelServing } = req.services;
        if (!modelServing) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model serving service not available' 
            });
        }

        const deployment = await modelServing.getDeployment(
            req.params.deploymentId,
            req.query.include_metrics === 'true'
        );

        if (!deployment) {
            return res.status(404).json({
                success: false,
                error: 'Deployment not found'
            });
        }

        res.json({
            success: true,
            data: deployment
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// List deployments
router.get('/deployments', async (req, res) => {
    try {
        const { modelServing } = req.services;
        if (!modelServing) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model serving service not available' 
            });
        }

        const filters = {
            model_id: req.query.model_id,
            status: req.query.status ? req.query.status.split(',') : null,
            name: req.query.name,
            version: req.query.version,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const deployments = await modelServing.listDeployments(filters);

        res.json({
            success: true,
            data: deployments,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: deployments.length
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Scale deployment
router.post('/deployments/:deploymentId/scale', async (req, res) => {
    try {
        const { modelServing } = req.services;
        if (!modelServing) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model serving service not available' 
            });
        }

        const { target_replicas, reason = 'manual' } = req.body;

        if (!target_replicas || target_replicas < 1) {
            return res.status(400).json({
                success: false,
                error: 'target_replicas must be greater than 0'
            });
        }

        const deployment = await modelServing.scaleDeployment(
            req.params.deploymentId,
            target_replicas,
            reason
        );

        res.json({
            success: true,
            data: deployment
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Predict using deployed model
router.post('/deployments/:deploymentId/predict', async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('model_predict');

    try {
        const { modelServing } = req.services;
        if (!modelServing) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model serving service not available' 
            });
        }

        const { input_data, options = {} } = req.body;

        if (!input_data) {
            return res.status(400).json({
                success: false,
                error: 'input_data is required'
            });
        }

        const result = await modelServing.predict(
            req.params.deploymentId,
            input_data,
            options
        );

        span.setAttributes({
            'deployment.id': req.params.deploymentId,
            'prediction.latency': result.latency
        });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

// Create A/B test
router.post('/ab-tests', async (req, res) => {
    const span = OpenTelemetryTracing.getTracer('ml-api').startSpan('create_ab_test');

    try {
        const { modelServing } = req.services;
        if (!modelServing) {
            return res.status(503).json({ 
                success: false, 
                error: 'Model serving service not available' 
            });
        }

        const experiment = await modelServing.createABTest({
            ...req.body,
            created_by: req.user?.id
        });

        span.setAttributes({
            'ab_test.id': experiment.id,
            'ab_test.name': experiment.name
        });

        res.json({
            success: true,
            data: experiment
        });

    } catch (error) {
        span.recordException(error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Service Status and Statistics Routes
 */

// Get overall platform status
router.get('/status', async (req, res) => {
    try {
        const status = {
            model_registry: req.services.modelRegistry?.getStatistics() || { status: 'unavailable' },
            training_pipeline: req.services.trainingPipeline?.getStatistics() || { status: 'unavailable' },
            experiment_tracker: req.services.experimentTracker?.getStatistics() || { status: 'unavailable' },
            model_serving: req.services.modelServing?.getStatistics() || { status: 'unavailable' },
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        services: {
            model_registry: req.services.modelRegistry ? 'available' : 'unavailable',
            training_pipeline: req.services.trainingPipeline ? 'available' : 'unavailable',
            experiment_tracker: req.services.experimentTracker ? 'available' : 'unavailable',
            model_serving: req.services.modelServing ? 'available' : 'unavailable'
        },
        timestamp: new Date().toISOString()
    };

    res.json(health);
});

export default router;
