/**
 * AI/ML Integration Platform Test Suite
 * 
 * Comprehensive tests for MLOps platform components:
 * - MLModelRegistry
 * - TrainingPipelineEngine  
 * - ExperimentTracker
 * - ModelServingPlatform
 * - API Routes
 */

const request = require('supertest');
const express = require('express');
const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;
const path = require('path');

// Import services
const MLModelRegistry = require('../../src/services/MLModelRegistry');
const TrainingPipelineEngine = require('../../src/services/TrainingPipelineEngine');
const ExperimentTracker = require('../../src/services/ExperimentTracker');
const ModelServingPlatform = require('../../src/services/ModelServingPlatform');
const aimlRoutes = require('../../src/routes/aimlPlatform');

describe('AI/ML Integration Platform', function() {
    this.timeout(30000); // Increase timeout for complex operations

    let mockDb, app, services;

    beforeEach(async () => {
        // Mock database
        mockDb = {
            query: sinon.stub(),
            connect: sinon.stub().resolves({
                query: sinon.stub(),
                release: sinon.stub()
            })
        };

        // Create test app
        app = express();
        app.use(express.json());
        
        // Initialize services with mocked database
        services = {
            modelRegistry: new MLModelRegistry(mockDb, { artifactStoragePath: './test-artifacts' }),
            trainingPipeline: new TrainingPipelineEngine(mockDb, { 
                checkpointPath: './test-checkpoints',
                logPath: './test-logs',
                artifactPath: './test-training-artifacts'
            }),
            experimentTracker: new ExperimentTracker(mockDb),
            modelServing: null // Will be initialized after modelRegistry
        };

        services.modelServing = new ModelServingPlatform(mockDb, services.modelRegistry);

        // Attach services to app
        app.locals.modelRegistry = services.modelRegistry;
        app.locals.trainingPipeline = services.trainingPipeline;
        app.locals.experimentTracker = services.experimentTracker;
        app.locals.modelServing = services.modelServing;

        app.use('/api/ml', aimlRoutes);

        // Mock service initialization
        for (const service of Object.values(services)) {
            if (service) {
                service.initialized = true;
                service.isRunning = true;
            }
        }
    });

    afterEach(async () => {
        sinon.restore();
        
        // Cleanup test directories
        const testDirs = ['./test-artifacts', './test-checkpoints', './test-logs', './test-training-artifacts'];
        for (const dir of testDirs) {
            try {
                await fs.rmdir(dir, { recursive: true });
            } catch (error) {
                // Directory might not exist
            }
        }
    });

    describe('MLModelRegistry Service', () => {
        describe('Model Registration', () => {
            it('should register a new model successfully', async () => {
                const mockModel = {
                    id: 'model-123',
                    name: 'test-model',
                    version: '1.0.0',
                    framework: 'tensorflow',
                    model_type: 'classification',
                    status: 'draft',
                    created_at: new Date().toISOString()
                };

                mockDb.query.resolves({ rows: [mockModel] });

                const modelData = {
                    name: 'test-model',
                    version: '1.0.0',
                    framework: 'tensorflow',
                    model_type: 'classification',
                    description: 'Test model for classification'
                };

                const result = await services.modelRegistry.registerModel(modelData);

                expect(result).to.deep.include({
                    name: 'test-model',
                    version: '1.0.0',
                    framework: 'tensorflow'
                });
                expect(mockDb.query.calledOnce).to.be.true;
            });

            it('should validate model data before registration', async () => {
                const invalidModelData = {
                    name: '', // Invalid: empty name
                    version: '1.0.0',
                    framework: 'invalid-framework' // Invalid: unsupported framework
                };

                try {
                    await services.modelRegistry.registerModel(invalidModelData);
                    expect.fail('Should have thrown validation error');
                } catch (error) {
                    expect(error.message).to.include('Validation failed');
                }
            });

            it('should handle duplicate model registration', async () => {
                // First, mock existing model
                mockDb.query.onFirstCall().resolves({ 
                    rows: [{ id: 'existing-model', name: 'test-model', version: '1.0.0' }] 
                });

                const modelData = {
                    name: 'test-model',
                    version: '1.0.0',
                    framework: 'tensorflow',
                    model_type: 'classification'
                };

                try {
                    await services.modelRegistry.registerModel(modelData, { skipDuplicateCheck: false });
                    expect.fail('Should have thrown duplicate error');
                } catch (error) {
                    expect(error.message).to.include('already exists');
                }
            });
        });

        describe('Model Retrieval', () => {
            it('should retrieve model by ID with artifacts', async () => {
                const mockModel = {
                    id: 'model-123',
                    name: 'test-model',
                    version: '1.0.0',
                    framework: 'tensorflow'
                };

                const mockArtifacts = [
                    { id: 'artifact-1', name: 'model.h5', artifact_type: 'model', is_primary: true },
                    { id: 'artifact-2', name: 'weights.json', artifact_type: 'weights', is_primary: false }
                ];

                mockDb.query.onFirstCall().resolves({ rows: [mockModel] });
                mockDb.query.onSecondCall().resolves({ rows: mockArtifacts });

                // Add to cache
                services.modelRegistry.modelCache.set('model-123', mockModel);

                const result = await services.modelRegistry.getModel('model-123', { includeArtifacts: true });

                expect(result.id).to.equal('model-123');
                expect(result.artifacts).to.be.an('array').with.length(2);
                expect(result.artifacts[0].is_primary).to.be.true;
            });

            it('should return null for non-existent model', async () => {
                mockDb.query.resolves({ rows: [] });

                const result = await services.modelRegistry.getModel('non-existent');

                expect(result).to.be.null;
            });
        });

        describe('Model Comparison', () => {
            it('should compare multiple models', async () => {
                const models = [
                    {
                        id: 'model-1',
                        name: 'model-a',
                        version: '1.0.0',
                        metrics: { accuracy: 0.95, precision: 0.93 },
                        input_schema: { features: 10 },
                        output_schema: { classes: 2 }
                    },
                    {
                        id: 'model-2', 
                        name: 'model-b',
                        version: '1.0.0',
                        metrics: { accuracy: 0.92, precision: 0.94 },
                        input_schema: { features: 10 },
                        output_schema: { classes: 2 }
                    }
                ];

                // Mock getModel calls
                services.modelRegistry.getModel = sinon.stub()
                    .onFirstCall().resolves(models[0])
                    .onSecondCall().resolves(models[1]);

                const comparison = await services.modelRegistry.compareModels(['model-1', 'model-2']);

                expect(comparison.models).to.have.length(2);
                expect(comparison.metrics_comparison).to.have.property('accuracy');
                expect(comparison.metrics_comparison.accuracy).to.have.length(2);
                expect(comparison.schema_compatibility.input_schema_compatible).to.be.true;
            });
        });
    });

    describe('TrainingPipelineEngine Service', () => {
        describe('Job Submission', () => {
            it('should submit training job successfully', async () => {
                const mockJob = {
                    id: 'job-123',
                    status: 'queued',
                    training_spec: { model_type: 'classification', algorithm: 'random_forest' },
                    priority: 'normal',
                    created_at: new Date().toISOString()
                };

                mockDb.query.resolves({ rows: [mockJob] });

                const trainingSpec = {
                    model_type: 'classification',
                    algorithm: 'random_forest',
                    training_config: {
                        epochs: 10,
                        batch_size: 32
                    }
                };

                const result = await services.trainingPipeline.submitTrainingJob(trainingSpec);

                expect(result.status).to.equal('queued');
                expect(result.training_spec.model_type).to.equal('classification');
                expect(mockDb.query.calledOnce).to.be.true;
            });

            it('should validate training specification', async () => {
                const invalidSpec = {
                    // Missing required fields
                    training_config: { epochs: -1 } // Invalid epochs
                };

                try {
                    await services.trainingPipeline.submitTrainingJob(invalidSpec);
                    expect.fail('Should have thrown validation error');
                } catch (error) {
                    expect(error.message).to.include('Missing required training specification fields');
                }
            });

            it('should handle priority queue correctly', async () => {
                const normalJob = { id: 'job-1', priority: 'normal' };
                const highJob = { id: 'job-2', priority: 'high' };

                mockDb.query.onFirstCall().resolves({ rows: [normalJob] });
                mockDb.query.onSecondCall().resolves({ rows: [highJob] });

                await services.trainingPipeline.submitTrainingJob(
                    { model_type: 'classification', algorithm: 'svm' },
                    { priority: 'normal' }
                );

                await services.trainingPipeline.submitTrainingJob(
                    { model_type: 'regression', algorithm: 'linear' },
                    { priority: 'high' }
                );

                expect(services.trainingPipeline.priorityQueue).to.have.length(1);
                expect(services.trainingPipeline.trainingQueue).to.have.length(1);
            });
        });

        describe('Hyperparameter Optimization', () => {
            it('should run HPO successfully', async () => {
                const baseSpec = {
                    model_type: 'classification',
                    algorithm: 'xgboost'
                };

                const hyperparamSpace = {
                    learning_rate: { type: 'float', min: 0.01, max: 0.3 },
                    max_depth: { type: 'int', min: 3, max: 10 },
                    n_estimators: { type: 'choice', choices: [100, 200, 300] }
                };

                // Mock experiment creation
                services.trainingPipeline.createExperiment = sinon.stub().resolves({
                    id: 'exp-123',
                    name: 'HPO-test',
                    type: 'hyperparameter_optimization'
                });

                // Mock job submission
                services.trainingPipeline.submitTrainingJob = sinon.stub().resolves({
                    id: 'trial-job-1',
                    status: 'queued'
                });

                const result = await services.trainingPipeline.runHyperparameterOptimization(
                    baseSpec, 
                    hyperparamSpace,
                    { strategy: 'random', maxTrials: 5 }
                );

                expect(result.experiment).to.exist;
                expect(result.trialJobs).to.be.an('array');
                expect(result.summary.strategy).to.equal('random');
            });
        });

        describe('Training Management', () => {
            it('should start training successfully', async () => {
                const mockJob = {
                    id: 'job-123',
                    status: 'queued',
                    resource_requirements: { memory: 4096, cpu: 2, gpu: 1 }
                };

                mockDb.query.resolves({ rows: [mockJob] });
                services.trainingPipeline.getTrainingJob = sinon.stub().resolves(mockJob);
                services.trainingPipeline.checkResourceAvailability = sinon.stub().resolves(true);
                services.trainingPipeline.allocateResources = sinon.stub().resolves();
                services.trainingPipeline.updateJobStatus = sinon.stub().resolves();
                services.trainingPipeline.createTrainingEnvironment = sinon.stub().resolves({
                    id: 'env-123',
                    path: './test-env'
                });
                services.trainingPipeline.startTrainingWorker = sinon.stub().resolves({
                    on: sinon.stub(),
                    postMessage: sinon.stub()
                });
                services.trainingPipeline.setupTrainingMonitoring = sinon.stub();

                const result = await services.trainingPipeline.startTraining('job-123');

                expect(result).to.be.true;
                expect(services.trainingPipeline.activeTrainings.has('job-123')).to.be.true;
            });

            it('should handle resource constraints', async () => {
                const mockJob = {
                    id: 'job-123',
                    status: 'queued',
                    resource_requirements: { memory: 32768, cpu: 16, gpu: 8 }
                };

                services.trainingPipeline.getTrainingJob = sinon.stub().resolves(mockJob);
                services.trainingPipeline.checkResourceAvailability = sinon.stub().resolves(false);

                try {
                    await services.trainingPipeline.startTraining('job-123');
                    expect.fail('Should have thrown resource error');
                } catch (error) {
                    expect(error.message).to.include('Insufficient resources');
                }
            });
        });
    });

    describe('ExperimentTracker Service', () => {
        describe('Experiment Management', () => {
            it('should create experiment successfully', async () => {
                const mockExperiment = {
                    id: 'exp-123',
                    name: 'test-experiment',
                    type: 'classification',
                    status: 'active',
                    created_at: new Date().toISOString()
                };

                mockDb.query.resolves({ rows: [mockExperiment] });

                const experimentData = {
                    name: 'test-experiment',
                    description: 'Testing classification models',
                    type: 'classification',
                    config: { max_trials: 10 }
                };

                const result = await services.experimentTracker.createExperiment(experimentData);

                expect(result.name).to.equal('test-experiment');
                expect(result.type).to.equal('classification');
                expect(result.status).to.equal('active');
                expect(mockDb.query.calledOnce).to.be.true;
            });

            it('should validate experiment data', async () => {
                const invalidData = {
                    name: '', // Invalid: empty name
                    type: 'classification'
                };

                try {
                    await services.experimentTracker.createExperiment(invalidData);
                    expect.fail('Should have thrown validation error');
                } catch (error) {
                    expect(error.message).to.include('Experiment name is required');
                }
            });

            it('should generate auto tags', () => {
                const experiment = {
                    name: 'test-exp',
                    type: 'regression',
                    config: { framework: 'tensorflow' }
                };

                const autoTags = services.experimentTracker.generateAutoTags(experiment);

                expect(autoTags).to.include('type:regression');
                expect(autoTags).to.include('config:framework:tensorflow');
                expect(autoTags.some(tag => tag.startsWith('year:'))).to.be.true;
            });
        });

        describe('Run Management', () => {
            it('should start and track run successfully', async () => {
                const mockRun = {
                    id: 'run-123',
                    experiment_id: 'exp-123',
                    name: 'run_1',
                    status: 'running',
                    start_time: new Date().toISOString()
                };

                mockDb.query.onFirstCall().resolves({ rows: [{ id: 'exp-123' }] }); // Experiment exists
                mockDb.query.onSecondCall().resolves({ rows: [mockRun] });

                services.experimentTracker.getExperiment = sinon.stub().resolves({ id: 'exp-123', name: 'test-exp' });

                const result = await services.experimentTracker.startRun('exp-123', {
                    name: 'run_1',
                    parameters: { learning_rate: 0.01, epochs: 10 }
                });

                expect(result.status).to.equal('running');
                expect(result.experiment_id).to.equal('exp-123');
                expect(services.experimentTracker.activeRuns.has('run-123')).to.be.true;
            });

            it('should log metrics correctly', async () => {
                // Setup active run
                services.experimentTracker.activeRuns.set('run-123', {
                    id: 'run-123',
                    metrics: new Map(),
                    parameters: {}
                });

                const metrics = {
                    loss: 0.5,
                    accuracy: 0.85,
                    val_loss: 0.6
                };

                await services.experimentTracker.logMetrics('run-123', metrics, 1);

                const activeRun = services.experimentTracker.activeRuns.get('run-123');
                expect(activeRun.metrics.has('loss')).to.be.true;
                expect(activeRun.metrics.has('accuracy')).to.be.true;
                expect(activeRun.metrics.get('loss')).to.have.length(1);
            });

            it('should end run successfully', async () => {
                // Setup active run with metrics buffer
                services.experimentTracker.activeRuns.set('run-123', {
                    id: 'run-123',
                    start_time: new Date().toISOString()
                });
                services.experimentTracker.metricsBuffer.set('run-123', []);

                mockDb.query.resolves();
                services.experimentTracker.flushMetricsBuffer = sinon.stub().resolves();

                await services.experimentTracker.endRun('run-123', 'completed', { final_accuracy: 0.92 });

                expect(services.experimentTracker.activeRuns.has('run-123')).to.be.false;
                expect(services.experimentTracker.metricsBuffer.has('run-123')).to.be.false;
            });
        });

        describe('Run Comparison', () => {
            it('should compare runs successfully', async () => {
                const runs = [
                    {
                        id: 'run-1',
                        parameters: { learning_rate: 0.01, epochs: 10 },
                        metrics: { 
                            accuracy: { values: [0.8, 0.85, 0.87] },
                            loss: { values: [0.5, 0.4, 0.35] }
                        }
                    },
                    {
                        id: 'run-2',
                        parameters: { learning_rate: 0.05, epochs: 10 },
                        metrics: { 
                            accuracy: { values: [0.75, 0.82, 0.84] },
                            loss: { values: [0.6, 0.45, 0.4] }
                        }
                    }
                ];

                services.experimentTracker.getRun = sinon.stub()
                    .onFirstCall().resolves(runs[0])
                    .onSecondCall().resolves(runs[1]);

                const comparison = await services.experimentTracker.compareRuns(['run-1', 'run-2']);

                expect(comparison.runs).to.have.length(2);
                expect(comparison.metrics_comparison).to.have.property('accuracy');
                expect(comparison.parameter_differences).to.have.property('learning_rate');
            });
        });
    });

    describe('ModelServingPlatform Service', () => {
        describe('Model Deployment', () => {
            it('should deploy model successfully', async () => {
                const mockModel = {
                    id: 'model-123',
                    name: 'test-model',
                    version: '1.0.0',
                    framework: 'tensorflow'
                };

                const mockDeployment = {
                    id: 'deploy-123',
                    model_id: 'model-123',
                    name: 'test-model-v1.0.0',
                    status: 'deploying',
                    desired_replicas: 2
                };

                services.modelServing.modelRegistry.getModel = sinon.stub().resolves(mockModel);
                mockDb.query.resolves({ rows: [mockDeployment] });
                services.modelServing.startDeploymentProcess = sinon.stub().resolves();

                const result = await services.modelServing.deployModel('model-123', {
                    name: 'test-deployment',
                    replicas: 2
                });

                expect(result.model_id).to.equal('model-123');
                expect(result.status).to.equal('deploying');
                expect(services.modelServing.activeDeployments.has('deploy-123')).to.be.true;
            });

            it('should handle model not found', async () => {
                services.modelServing.modelRegistry.getModel = sinon.stub().resolves(null);

                try {
                    await services.modelServing.deployModel('non-existent', {});
                    expect.fail('Should have thrown model not found error');
                } catch (error) {
                    expect(error.message).to.include('Model not found');
                }
            });
        });

        describe('Model Scaling', () => {
            it('should scale deployment successfully', async () => {
                // Setup active deployment
                const mockDeployment = {
                    id: 'deploy-123',
                    desired_replicas: 2,
                    instances: new Map()
                };

                services.modelServing.activeDeployments.set('deploy-123', mockDeployment);
                mockDb.query.resolves();
                services.modelServing.scaleUp = sinon.stub().resolves();

                const result = await services.modelServing.scaleDeployment('deploy-123', 4, 'manual');

                expect(mockDeployment.desired_replicas).to.equal(4);
            });

            it('should respect scaling limits', async () => {
                const mockDeployment = {
                    id: 'deploy-123',
                    desired_replicas: 5,
                    instances: new Map()
                };

                services.modelServing.activeDeployments.set('deploy-123', mockDeployment);
                services.modelServing.config.maxReplicas = 3;
                mockDb.query.resolves();
                services.modelServing.scaleDown = sinon.stub().resolves();

                await services.modelServing.scaleDeployment('deploy-123', 10, 'manual');

                expect(mockDeployment.desired_replicas).to.equal(3); // Clamped to maxReplicas
            });
        });

        describe('Model Prediction', () => {
            it('should perform prediction successfully', async () => {
                const mockDeployment = {
                    id: 'deploy-123',
                    status: 'running',
                    instances: new Map([
                        ['instance-1', { id: 'instance-1', health: 'healthy' }]
                    ]),
                    metrics: { totalRequests: 0, successfulRequests: 0 }
                };

                services.modelServing.activeDeployments.set('deploy-123', mockDeployment);
                services.modelServing.selectInstance = sinon.stub().returns({ id: 'instance-1' });
                services.modelServing.runInference = sinon.stub().resolves({ prediction: 0.85 });
                services.modelServing.logInferenceRequest = sinon.stub().resolves();
                services.modelServing.updateLatencyMetrics = sinon.stub();

                const result = await services.modelServing.predict('deploy-123', { features: [1, 2, 3] });

                expect(result.prediction).to.equal(0.85);
                expect(result.instanceId).to.equal('instance-1');
                expect(result.latency).to.be.a('number');
            });

            it('should handle no healthy instances', async () => {
                const mockDeployment = {
                    id: 'deploy-123',
                    status: 'running',
                    instances: new Map([
                        ['instance-1', { id: 'instance-1', health: 'unhealthy' }]
                    ])
                };

                services.modelServing.activeDeployments.set('deploy-123', mockDeployment);
                services.modelServing.selectInstance = sinon.stub().returns(null);

                try {
                    await services.modelServing.predict('deploy-123', { features: [1, 2, 3] });
                    expect.fail('Should have thrown no instances error');
                } catch (error) {
                    expect(error.message).to.include('No healthy instances available');
                }
            });
        });

        describe('A/B Testing', () => {
            it('should create A/B test successfully', async () => {
                const mockExperiment = {
                    id: 'ab-test-123',
                    name: 'model-comparison',
                    variants: [
                        { deployment_id: 'deploy-1', traffic_percentage: 50 },
                        { deployment_id: 'deploy-2', traffic_percentage: 50 }
                    ],
                    status: 'running'
                };

                mockDb.query.resolves({ rows: [mockExperiment] });

                const config = {
                    name: 'model-comparison',
                    variants: [
                        { deployment_id: 'deploy-1', traffic_percentage: 50 },
                        { deployment_id: 'deploy-2', traffic_percentage: 50 }
                    ]
                };

                const result = await services.modelServing.createABTest(config);

                expect(result.name).to.equal('model-comparison');
                expect(result.variants).to.have.length(2);
                expect(services.modelServing.abTests.has('ab-test-123')).to.be.true;
            });

            it('should validate A/B test configuration', async () => {
                const invalidConfig = {
                    name: 'test',
                    variants: [
                        { deployment_id: 'deploy-1', traffic_percentage: 60 },
                        { deployment_id: 'deploy-2', traffic_percentage: 50 } // Total > 100
                    ]
                };

                try {
                    await services.modelServing.createABTest(invalidConfig);
                    expect.fail('Should have thrown validation error');
                } catch (error) {
                    expect(error.message).to.include('must sum to 100');
                }
            });
        });
    });

    describe('API Routes', () => {
        describe('Model Registry Routes', () => {
            it('should register model via API', async () => {
                const mockModel = {
                    id: 'model-123',
                    name: 'api-test-model',
                    version: '1.0.0',
                    framework: 'tensorflow'
                };

                services.modelRegistry.registerModel = sinon.stub().resolves(mockModel);

                const response = await request(app)
                    .post('/api/ml/models')
                    .send({
                        name: 'api-test-model',
                        version: '1.0.0',
                        framework: 'tensorflow',
                        model_type: 'classification'
                    });

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data.name).to.equal('api-test-model');
            });

            it('should handle model registration errors', async () => {
                services.modelRegistry.registerModel = sinon.stub().rejects(new Error('Validation failed'));

                const response = await request(app)
                    .post('/api/ml/models')
                    .send({ name: '' }); // Invalid data

                expect(response.status).to.equal(400);
                expect(response.body.success).to.be.false;
                expect(response.body.error).to.include('Validation failed');
            });

            it('should get model by ID via API', async () => {
                const mockModel = {
                    id: 'model-123',
                    name: 'test-model',
                    version: '1.0.0'
                };

                services.modelRegistry.getModel = sinon.stub().resolves(mockModel);

                const response = await request(app)
                    .get('/api/ml/models/model-123');

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data.id).to.equal('model-123');
            });

            it('should handle model not found', async () => {
                services.modelRegistry.getModel = sinon.stub().resolves(null);

                const response = await request(app)
                    .get('/api/ml/models/non-existent');

                expect(response.status).to.equal(404);
                expect(response.body.success).to.be.false;
                expect(response.body.error).to.include('Model not found');
            });
        });

        describe('Training Pipeline Routes', () => {
            it('should submit training job via API', async () => {
                const mockJob = {
                    id: 'job-123',
                    status: 'queued',
                    priority: 'normal'
                };

                services.trainingPipeline.submitTrainingJob = sinon.stub().resolves(mockJob);

                const response = await request(app)
                    .post('/api/ml/training/jobs')
                    .send({
                        training_spec: {
                            model_type: 'classification',
                            algorithm: 'random_forest'
                        },
                        priority: 'normal'
                    });

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data.status).to.equal('queued');
            });

            it('should get training progress via API', async () => {
                const mockProgress = {
                    job_id: 'job-123',
                    status: 'running',
                    progress_percentage: 45,
                    current_epoch: 5
                };

                services.trainingPipeline.getTrainingProgress = sinon.stub().resolves(mockProgress);

                const response = await request(app)
                    .get('/api/ml/training/jobs/job-123/progress');

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data.progress_percentage).to.equal(45);
            });
        });

        describe('Experiment Tracker Routes', () => {
            it('should create experiment via API', async () => {
                const mockExperiment = {
                    id: 'exp-123',
                    name: 'api-experiment',
                    status: 'active'
                };

                services.experimentTracker.createExperiment = sinon.stub().resolves(mockExperiment);

                const response = await request(app)
                    .post('/api/ml/experiments')
                    .send({
                        name: 'api-experiment',
                        description: 'Test experiment via API',
                        type: 'classification'
                    });

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data.name).to.equal('api-experiment');
            });

            it('should start run via API', async () => {
                const mockRun = {
                    id: 'run-123',
                    experiment_id: 'exp-123',
                    status: 'running'
                };

                services.experimentTracker.startRun = sinon.stub().resolves(mockRun);

                const response = await request(app)
                    .post('/api/ml/experiments/exp-123/runs')
                    .send({
                        name: 'api-run',
                        parameters: { learning_rate: 0.01 }
                    });

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data.status).to.equal('running');
            });
        });

        describe('Model Serving Routes', () => {
            it('should deploy model via API', async () => {
                const mockDeployment = {
                    id: 'deploy-123',
                    model_id: 'model-123',
                    status: 'deploying'
                };

                services.modelServing.deployModel = sinon.stub().resolves(mockDeployment);

                const response = await request(app)
                    .post('/api/ml/deployments')
                    .send({
                        model_id: 'model-123',
                        config: {
                            name: 'api-deployment',
                            replicas: 2
                        }
                    });

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data.status).to.equal('deploying');
            });

            it('should perform prediction via API', async () => {
                const mockResult = {
                    requestId: 'req-123',
                    prediction: 0.92,
                    latency: 150,
                    instanceId: 'instance-1'
                };

                services.modelServing.predict = sinon.stub().resolves(mockResult);

                const response = await request(app)
                    .post('/api/ml/deployments/deploy-123/predict')
                    .send({
                        input_data: { features: [1, 2, 3, 4] }
                    });

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data.prediction).to.equal(0.92);
            });
        });

        describe('Service Status Routes', () => {
            it('should return platform status', async () => {
                // Mock service statistics
                for (const service of Object.values(services)) {
                    if (service) {
                        service.getStatistics = sinon.stub().returns({
                            initialized: true,
                            running: true,
                            total_items: 10
                        });
                    }
                }

                const response = await request(app)
                    .get('/api/ml/status');

                expect(response.status).to.equal(200);
                expect(response.body.success).to.be.true;
                expect(response.body.data).to.have.property('model_registry');
                expect(response.body.data).to.have.property('training_pipeline');
                expect(response.body.data).to.have.property('experiment_tracker');
                expect(response.body.data).to.have.property('model_serving');
            });

            it('should return health check', async () => {
                const response = await request(app)
                    .get('/api/ml/health');

                expect(response.status).to.equal(200);
                expect(response.body.status).to.equal('healthy');
                expect(response.body.services).to.have.property('model_registry');
                expect(response.body.services.model_registry).to.equal('available');
            });
        });
    });

    describe('Integration Tests', () => {
        it('should complete full MLOps workflow', async () => {
            // This test simulates a complete MLOps workflow from model registration to deployment

            // Step 1: Register model
            const mockModel = {
                id: 'model-workflow',
                name: 'workflow-model',
                version: '1.0.0',
                framework: 'tensorflow'
            };
            services.modelRegistry.registerModel = sinon.stub().resolves(mockModel);

            // Step 2: Create experiment
            const mockExperiment = {
                id: 'exp-workflow',
                name: 'workflow-experiment',
                status: 'active'
            };
            services.experimentTracker.createExperiment = sinon.stub().resolves(mockExperiment);

            // Step 3: Submit training job
            const mockJob = {
                id: 'job-workflow',
                experiment_id: 'exp-workflow',
                status: 'queued'
            };
            services.trainingPipeline.submitTrainingJob = sinon.stub().resolves(mockJob);

            // Step 4: Deploy model
            const mockDeployment = {
                id: 'deploy-workflow',
                model_id: 'model-workflow',
                status: 'running'
            };
            services.modelServing.deployModel = sinon.stub().resolves(mockDeployment);

            // Execute workflow via API
            const modelResponse = await request(app)
                .post('/api/ml/models')
                .send({
                    name: 'workflow-model',
                    version: '1.0.0',
                    framework: 'tensorflow',
                    model_type: 'classification'
                });

            const experimentResponse = await request(app)
                .post('/api/ml/experiments')
                .send({
                    name: 'workflow-experiment',
                    type: 'classification'
                });

            const trainingResponse = await request(app)
                .post('/api/ml/training/jobs')
                .send({
                    training_spec: {
                        model_type: 'classification',
                        algorithm: 'random_forest'
                    },
                    experiment_id: 'exp-workflow'
                });

            const deploymentResponse = await request(app)
                .post('/api/ml/deployments')
                .send({
                    model_id: 'model-workflow',
                    config: { name: 'workflow-deployment' }
                });

            // Verify all steps completed successfully
            expect(modelResponse.status).to.equal(200);
            expect(experimentResponse.status).to.equal(200);
            expect(trainingResponse.status).to.equal(200);
            expect(deploymentResponse.status).to.equal(200);

            // Verify services were called in correct order
            expect(services.modelRegistry.registerModel.calledOnce).to.be.true;
            expect(services.experimentTracker.createExperiment.calledOnce).to.be.true;
            expect(services.trainingPipeline.submitTrainingJob.calledOnce).to.be.true;
            expect(services.modelServing.deployModel.calledOnce).to.be.true;
        });
    });
});
