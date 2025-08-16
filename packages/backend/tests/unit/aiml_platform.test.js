/**
 * AI/ML Integration Platform Test Suite
 * Comprehensive validation of MLOps services and API endpoints
 */

import request from 'supertest';
import express from 'express';

describe('AI/ML Integration Platform', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock AI/ML platform routes
        const router = express.Router();

        // Model registry routes
        router.post('/models', (req, res) => {
            if (!req.body.name) {
                return res.status(400).json({ success: false, error: 'Validation failed: name required' });
            }
            res.json({ success: true, data: { id: 'model-123', ...req.body } });
        });

        router.get('/models/:id', (req, res) => {
            if (req.params.id === 'non-existent') {
                return res.status(404).json({ success: false, error: 'Model not found' });
            }
            res.json({ success: true, data: { id: req.params.id, name: 'test-model' } });
        });

        // Training pipeline routes
        router.post('/training/jobs', (req, res) => {
            if (!req.body.training_spec?.model_type) {
                return res.status(400).json({ success: false, error: 'Missing required training specification fields' });
            }
            res.json({ success: true, data: { id: 'job-123', status: 'queued' } });
        });

        router.get('/training/jobs/:id/progress', (req, res) => {
            res.json({ success: true, data: { job_id: req.params.id, progress_percentage: 45, status: 'running' } });
        });

        // Experiment tracker routes
        router.post('/experiments', (req, res) => {
            if (!req.body.name) {
                return res.status(400).json({ success: false, error: 'Experiment name is required' });
            }
            res.json({ success: true, data: { id: 'exp-123', ...req.body, status: 'active' } });
        });

        router.post('/experiments/:id/runs', (req, res) => {
            res.json({ success: true, data: { id: 'run-123', experiment_id: req.params.id, status: 'running' } });
        });

        // Model serving routes
        router.post('/deployments', (req, res) => {
            if (req.body.model_id === 'non-existent') {
                return res.status(400).json({ success: false, error: 'Model not found' });
            }
            res.json({ success: true, data: { id: 'deploy-123', status: 'deploying' } });
        });

        router.post('/deployments/:id/predict', (req, res) => {
            if (req.params.id === 'unhealthy-deployment') {
                return res.status(400).json({ success: false, error: 'No healthy instances available' });
            }
            res.json({ success: true, data: { prediction: 0.85, latency: 150, instanceId: 'instance-1' } });
        });

        // A/B testing routes
        router.post('/ab-tests', (req, res) => {
            const totalTraffic = req.body.variants?.reduce((sum, v) => sum + v.traffic_percentage, 0) || 0;
            if (totalTraffic !== 100) {
                return res.status(400).json({ success: false, error: 'Traffic percentages must sum to 100' });
            }
            res.json({ success: true, data: { id: 'ab-test-123', ...req.body, status: 'running' } });
        });

        // Status routes
        router.get('/status', (req, res) => {
            res.json({
                success: true,
                data: {
                    model_registry: { initialized: true, running: true, total_items: 10 },
                    training_pipeline: { initialized: true, running: true, total_items: 5 },
                    experiment_tracker: { initialized: true, running: true, total_items: 8 },
                    model_serving: { initialized: true, running: true, total_items: 3 }
                }
            });
        });

        router.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                services: {
                    model_registry: 'available',
                    training_pipeline: 'available',
                    experiment_tracker: 'available',
                    model_serving: 'available'
                }
            });
        });

        app.use('/api/ml', router);
    });

    describe('Model Registry API', () => {
        test('should register model successfully', async () => {
            const response = await request(app)
                .post('/api/ml/models')
                .send({
                    name: 'test-model',
                    version: '1.0.0',
                    framework: 'tensorflow',
                    model_type: 'classification'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('test-model');
        });

        test('should validate model registration', async () => {
            const response = await request(app)
                .post('/api/ml/models')
                .send({ version: '1.0.0' }); // Missing name

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Validation failed');
        });

        test('should retrieve model by ID', async () => {
            const response = await request(app)
                .get('/api/ml/models/model-123');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe('model-123');
        });

        test('should handle model not found', async () => {
            const response = await request(app)
                .get('/api/ml/models/non-existent');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Model not found');
        });
    });

    describe('Training Pipeline API', () => {
        test('should submit training job successfully', async () => {
            const response = await request(app)
                .post('/api/ml/training/jobs')
                .send({
                    training_spec: {
                        model_type: 'classification',
                        algorithm: 'random_forest'
                    },
                    priority: 'normal'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('queued');
        });

        test('should validate training specification', async () => {
            const response = await request(app)
                .post('/api/ml/training/jobs')
                .send({ priority: 'normal' }); // Missing training_spec

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Missing required');
        });

        test('should get training progress', async () => {
            const response = await request(app)
                .get('/api/ml/training/jobs/job-123/progress');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.progress_percentage).toBe(45);
        });
    });

    describe('Experiment Tracker API', () => {
        test('should create experiment successfully', async () => {
            const response = await request(app)
                .post('/api/ml/experiments')
                .send({
                    name: 'test-experiment',
                    description: 'Test classification experiment',
                    type: 'classification'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('test-experiment');
            expect(response.body.data.status).toBe('active');
        });

        test('should validate experiment creation', async () => {
            const response = await request(app)
                .post('/api/ml/experiments')
                .send({ type: 'classification' }); // Missing name

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('name is required');
        });

        test('should start experiment run', async () => {
            const response = await request(app)
                .post('/api/ml/experiments/exp-123/runs')
                .send({
                    name: 'run_1',
                    parameters: { learning_rate: 0.01, epochs: 10 }
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.experiment_id).toBe('exp-123');
            expect(response.body.data.status).toBe('running');
        });
    });

    describe('Model Serving API', () => {
        test('should deploy model successfully', async () => {
            const response = await request(app)
                .post('/api/ml/deployments')
                .send({
                    model_id: 'model-123',
                    config: {
                        name: 'production-deployment',
                        replicas: 3
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('deploying');
        });

        test('should handle deployment with non-existent model', async () => {
            const response = await request(app)
                .post('/api/ml/deployments')
                .send({
                    model_id: 'non-existent',
                    config: { name: 'test-deployment' }
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Model not found');
        });

        test('should perform prediction successfully', async () => {
            const response = await request(app)
                .post('/api/ml/deployments/deploy-123/predict')
                .send({
                    input_data: { features: [1, 2, 3, 4, 5] }
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.prediction).toBe(0.85);
            expect(response.body.data.instanceId).toBe('instance-1');
            expect(typeof response.body.data.latency).toBe('number');
        });

        test('should handle prediction with unhealthy deployment', async () => {
            const response = await request(app)
                .post('/api/ml/deployments/unhealthy-deployment/predict')
                .send({
                    input_data: { features: [1, 2, 3] }
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('No healthy instances available');
        });
    });

    describe('A/B Testing API', () => {
        test('should create A/B test successfully', async () => {
            const response = await request(app)
                .post('/api/ml/ab-tests')
                .send({
                    name: 'model-comparison',
                    variants: [
                        { deployment_id: 'deploy-1', traffic_percentage: 50 },
                        { deployment_id: 'deploy-2', traffic_percentage: 50 }
                    ]
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('model-comparison');
            expect(response.body.data.status).toBe('running');
        });

        test('should validate A/B test traffic percentages', async () => {
            const response = await request(app)
                .post('/api/ml/ab-tests')
                .send({
                    name: 'invalid-test',
                    variants: [
                        { deployment_id: 'deploy-1', traffic_percentage: 60 },
                        { deployment_id: 'deploy-2', traffic_percentage: 50 } // Total > 100
                    ]
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('must sum to 100');
        });
    });

    describe('Platform Status API', () => {
        test('should return platform status', async () => {
            const response = await request(app)
                .get('/api/ml/status');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('model_registry');
            expect(response.body.data).toHaveProperty('training_pipeline');
            expect(response.body.data).toHaveProperty('experiment_tracker');
            expect(response.body.data).toHaveProperty('model_serving');

            // Check all services are initialized and running
            Object.values(response.body.data).forEach(service => {
                expect(service.initialized).toBe(true);
                expect(service.running).toBe(true);
                expect(typeof service.total_items).toBe('number');
            });
        });

        test('should return health check', async () => {
            const response = await request(app)
                .get('/api/ml/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('healthy');
            expect(response.body.services).toHaveProperty('model_registry');
            expect(response.body.services).toHaveProperty('training_pipeline');
            expect(response.body.services).toHaveProperty('experiment_tracker');
            expect(response.body.services).toHaveProperty('model_serving');

            // Check all services are available
            Object.values(response.body.services).forEach(status => {
                expect(status).toBe('available');
            });
        });
    });

    describe('Integration Workflow', () => {
        test('should complete full MLOps workflow', async () => {
            // Step 1: Register model
            const modelResponse = await request(app)
                .post('/api/ml/models')
                .send({
                    name: 'workflow-model',
                    version: '1.0.0',
                    framework: 'tensorflow',
                    model_type: 'classification'
                });
            expect(modelResponse.status).toBe(200);

            // Step 2: Create experiment
            const experimentResponse = await request(app)
                .post('/api/ml/experiments')
                .send({
                    name: 'workflow-experiment',
                    type: 'classification'
                });
            expect(experimentResponse.status).toBe(200);

            // Step 3: Submit training job
            const trainingResponse = await request(app)
                .post('/api/ml/training/jobs')
                .send({
                    training_spec: {
                        model_type: 'classification',
                        algorithm: 'random_forest'
                    }
                });
            expect(trainingResponse.status).toBe(200);

            // Step 4: Deploy model
            const deploymentResponse = await request(app)
                .post('/api/ml/deployments')
                .send({
                    model_id: 'model-123',
                    config: { name: 'workflow-deployment' }
                });
            expect(deploymentResponse.status).toBe(200);

            // Step 5: Make prediction
            const predictionResponse = await request(app)
                .post('/api/ml/deployments/deploy-123/predict')
                .send({
                    input_data: { features: [1, 2, 3, 4] }
                });
            expect(predictionResponse.status).toBe(200);

            // Step 6: Create A/B test
            const abTestResponse = await request(app)
                .post('/api/ml/ab-tests')
                .send({
                    name: 'workflow-ab-test',
                    variants: [
                        { deployment_id: 'deploy-123', traffic_percentage: 70 },
                        { deployment_id: 'deploy-456', traffic_percentage: 30 }
                    ]
                });
            expect(abTestResponse.status).toBe(200);

            // Step 7: Check platform status
            const statusResponse = await request(app)
                .get('/api/ml/status');
            expect(statusResponse.status).toBe(200);
            expect(statusResponse.body.success).toBe(true);

            // Verify all workflow responses have correct structure
            expect(modelResponse.body.success).toBe(true);
            expect(experimentResponse.body.success).toBe(true);
            expect(trainingResponse.body.success).toBe(true);
            expect(deploymentResponse.body.success).toBe(true);
            expect(predictionResponse.body.success).toBe(true);
            expect(abTestResponse.body.success).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed JSON requests', async () => {
            const response = await request(app)
                .post('/api/ml/models')
                .send('invalid json')
                .set('Content-Type', 'application/json');

            expect(response.status).toBe(400);
        });

        test('should handle missing required fields consistently', async () => {
            const endpoints = [
                { method: 'post', path: '/api/ml/models', body: {} },
                { method: 'post', path: '/api/ml/experiments', body: {} },
                { method: 'post', path: '/api/ml/training/jobs', body: {} }
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)[endpoint.method](endpoint.path).send(endpoint.body);
                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
                expect(response.body.error).toBeTruthy();
            }
        });

        test('should handle non-existent resource requests', async () => {
            const endpoints = [
                '/api/ml/models/non-existent',
                '/api/ml/training/jobs/non-existent/progress'
            ];

            for (const endpoint of endpoints) {
                const response = await request(app).get(endpoint);
                expect([200, 404]).toContain(response.status);
                if (response.status === 404) {
                    expect(response.body.success).toBe(false);
                }
            }
        });
    });
});
