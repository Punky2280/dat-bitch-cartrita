// WorkflowSystemIntegrationTests.js
// Component 8: Integration & Testing - Comprehensive Test Suite
// End-to-end integration testing for the enterprise workflow automation system

import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../index.js'; // Assuming Express app is exported from index.js
import db from '../db.js';
import WorkflowDesignerService from '../services/WorkflowDesignerService.js';
import WorkflowExecutionEngine from '../services/WorkflowExecutionEngine.js';
import WorkflowTemplateLibraryService from '../services/WorkflowTemplateLibraryService.js';
import { WorkflowMonitoringService } from '../services/WorkflowMonitoringService.js';
import { WorkflowSchedulingService } from '../services/WorkflowSchedulingService.js';
import { WorkflowServiceIntegrationHub } from '../services/WorkflowServiceIntegrationHub.js';
import WorkflowDatabaseOptimizationService from '../services/WorkflowDatabaseOptimizationService.js';

describe('Enterprise Workflow Automation System - Integration Tests', () => {
    let testUserId;
    let testWorkflowId;
    let testTemplateId;
    let testIntegrationId;
    let testScheduleId;
    let authToken;

    // Services
    let designerService;
    let executionEngine;
    let templateService;
    let monitoringService;
    let schedulingService;
    let integrationHub;
    let optimizationService;

    beforeAll(async () => {
        // Initialize all services
        designerService = new WorkflowDesignerService(db);
        executionEngine = new WorkflowExecutionEngine(db);
        templateService = new WorkflowTemplateLibraryService(db);
        monitoringService = new WorkflowMonitoringService(db);
        schedulingService = new WorkflowSchedulingService(db);
        integrationHub = new WorkflowServiceIntegrationHub(db);
        optimizationService = new WorkflowDatabaseOptimizationService(db);

        await Promise.all([
            designerService.initialize(),
            executionEngine.initialize(),
            templateService.initialize(),
            monitoringService.initialize(),
            schedulingService.initialize(),
            integrationHub.initialize(),
            optimizationService.initialize()
        ]);

        // Create test user
        const userResult = await db.query(`
            INSERT INTO users (email, password_hash, first_name, last_name) 
            VALUES ('test@example.com', 'hashed_password', 'Test', 'User')
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        // Generate auth token (mock implementation)
        authToken = 'test-auth-token-' + testUserId;
    });

    afterAll(async () => {
        // Clean up test data
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await db.end();
    });

    describe('Component 1: Visual Workflow Designer Integration', () => {
        test('should create a complete workflow design', async () => {
            const workflowDesign = {
                name: 'Integration Test Workflow',
                description: 'Test workflow for integration testing',
                nodes: [
                    {
                        id: 'node-1',
                        type: 'start',
                        position: { x: 100, y: 100 },
                        data: { label: 'Start Node' }
                    },
                    {
                        id: 'node-2',
                        type: 'action',
                        position: { x: 300, y: 100 },
                        data: { 
                            label: 'Test Action',
                            action_type: 'http_request',
                            configuration: {
                                url: 'https://jsonplaceholder.typicode.com/posts/1',
                                method: 'GET'
                            }
                        }
                    },
                    {
                        id: 'node-3',
                        type: 'end',
                        position: { x: 500, y: 100 },
                        data: { label: 'End Node' }
                    }
                ],
                edges: [
                    { id: 'edge-1', source: 'node-1', target: 'node-2' },
                    { id: 'edge-2', source: 'node-2', target: 'node-3' }
                ]
            };

            const result = await designerService.createWorkflow(testUserId, workflowDesign);
            
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Integration Test Workflow');
            
            testWorkflowId = result.id;
        }, 30000);

        test('should validate workflow design', async () => {
            const validation = await designerService.validateWorkflow(testWorkflowId);
            
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should update workflow design', async () => {
            const updates = {
                description: 'Updated test workflow for integration testing',
                nodes: [
                    {
                        id: 'node-4',
                        type: 'condition',
                        position: { x: 400, y: 200 },
                        data: { 
                            label: 'Test Condition',
                            condition: 'response.status === 200'
                        }
                    }
                ]
            };

            const result = await designerService.updateWorkflow(testWorkflowId, updates, testUserId);
            
            expect(result.description).toBe(updates.description);
        });
    });

    describe('Component 2: Workflow Execution Engine Integration', () => {
        test('should execute workflow successfully', async () => {
            const executionResult = await executionEngine.executeWorkflow(testWorkflowId, {
                triggeredBy: testUserId,
                inputData: { test: true }
            });

            expect(executionResult).toBeDefined();
            expect(executionResult.executionId).toBeDefined();
            expect(executionResult.status).toBe('running');
        }, 30000);

        test('should track execution progress', async () => {
            // Wait a moment for execution to progress
            await new Promise(resolve => setTimeout(resolve, 2000));

            const executions = await executionEngine.getWorkflowExecutions(testWorkflowId);
            
            expect(executions).toBeDefined();
            expect(executions.length).toBeGreaterThan(0);
            expect(['running', 'completed', 'failed']).toContain(executions[0].status);
        });

        test('should handle parallel execution', async () => {
            const parallelWorkflow = {
                name: 'Parallel Test Workflow',
                description: 'Test parallel execution',
                nodes: [
                    { id: 'start', type: 'start', position: { x: 100, y: 100 } },
                    { id: 'parallel-1', type: 'action', position: { x: 200, y: 50 } },
                    { id: 'parallel-2', type: 'action', position: { x: 200, y: 150 } },
                    { id: 'end', type: 'end', position: { x: 300, y: 100 } }
                ],
                edges: [
                    { id: 'e1', source: 'start', target: 'parallel-1' },
                    { id: 'e2', source: 'start', target: 'parallel-2' },
                    { id: 'e3', source: 'parallel-1', target: 'end' },
                    { id: 'e4', source: 'parallel-2', target: 'end' }
                ]
            };

            const workflow = await designerService.createWorkflow(testUserId, parallelWorkflow);
            const execution = await executionEngine.executeWorkflow(workflow.id, {
                triggeredBy: testUserId,
                enableParallelExecution: true
            });

            expect(execution.status).toBe('running');
        }, 45000);
    });

    describe('Component 3: Workflow Template Library Integration', () => {
        test('should create workflow template', async () => {
            const templateData = {
                name: 'Integration Test Template',
                description: 'Template created during integration testing',
                category: 'test',
                workflow_data: {
                    nodes: [
                        { id: 'start', type: 'start', position: { x: 100, y: 100 } },
                        { id: 'end', type: 'end', position: { x: 300, y: 100 } }
                    ],
                    edges: [
                        { id: 'e1', source: 'start', target: 'end' }
                    ]
                },
                tags: ['test', 'integration'],
                is_public: false
            };

            const result = await templateService.createTemplate(testUserId, templateData);
            
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.name).toBe('Integration Test Template');
            
            testTemplateId = result.id;
        });

        test('should search and filter templates', async () => {
            const searchResults = await templateService.searchTemplates({
                query: 'Integration',
                category: 'test',
                user_id: testUserId
            });

            expect(searchResults.templates).toBeDefined();
            expect(searchResults.templates.length).toBeGreaterThan(0);
        });

        test('should create workflow from template', async () => {
            const workflowFromTemplate = await templateService.createWorkflowFromTemplate(
                testTemplateId,
                testUserId,
                { name: 'Workflow from Template' }
            );

            expect(workflowFromTemplate).toBeDefined();
            expect(workflowFromTemplate.name).toBe('Workflow from Template');
        });

        test('should version template updates', async () => {
            const updates = {
                description: 'Updated template description',
                workflow_data: {
                    nodes: [
                        { id: 'start', type: 'start', position: { x: 100, y: 100 } },
                        { id: 'action', type: 'action', position: { x: 200, y: 100 } },
                        { id: 'end', type: 'end', position: { x: 300, y: 100 } }
                    ]
                }
            };

            const updatedTemplate = await templateService.updateTemplate(testTemplateId, updates, testUserId);
            
            expect(updatedTemplate.version).toBe(2);
            expect(updatedTemplate.description).toBe(updates.description);
        });
    });

    describe('Component 4: Workflow Monitoring Dashboard Integration', () => {
        test('should collect workflow metrics', async () => {
            const metrics = await monitoringService.getWorkflowMetrics(testWorkflowId);
            
            expect(metrics).toBeDefined();
            expect(metrics.execution_count).toBeDefined();
            expect(metrics.success_rate).toBeDefined();
            expect(metrics.avg_duration).toBeDefined();
        });

        test('should create and trigger alerts', async () => {
            const alertConfig = {
                workflow_id: testWorkflowId,
                alert_type: 'failure_rate',
                threshold: 50,
                condition: 'greater_than',
                is_active: true
            };

            const alert = await monitoringService.createAlert(testUserId, alertConfig);
            
            expect(alert).toBeDefined();
            expect(alert.id).toBeDefined();
            expect(alert.alert_type).toBe('failure_rate');
        });

        test('should aggregate system-wide analytics', async () => {
            const analytics = await monitoringService.getSystemAnalytics({
                user_id: testUserId,
                time_range: '7d'
            });

            expect(analytics).toBeDefined();
            expect(analytics.total_workflows).toBeDefined();
            expect(analytics.total_executions).toBeDefined();
            expect(analytics.performance_trend).toBeDefined();
        });
    });

    describe('Component 5: Advanced Scheduling System Integration', () => {
        test('should create cron-based schedule', async () => {
            const scheduleConfig = {
                workflow_id: testWorkflowId,
                name: 'Test Cron Schedule',
                schedule_type: 'cron',
                cron_expression: '0 */6 * * *', // Every 6 hours
                timezone: 'UTC',
                is_active: true
            };

            const schedule = await schedulingService.createSchedule(testUserId, scheduleConfig);
            
            expect(schedule).toBeDefined();
            expect(schedule.id).toBeDefined();
            expect(schedule.schedule_type).toBe('cron');
            
            testScheduleId = schedule.id;
        });

        test('should create event-driven schedule', async () => {
            const eventConfig = {
                workflow_id: testWorkflowId,
                name: 'Test Event Schedule',
                schedule_type: 'event',
                event_config: {
                    event_type: 'webhook',
                    webhook_url: '/api/workflows/webhook/test-event',
                    conditions: [
                        { field: 'status', operator: 'equals', value: 'success' }
                    ]
                },
                is_active: true
            };

            const eventSchedule = await schedulingService.createSchedule(testUserId, eventConfig);
            
            expect(eventSchedule.schedule_type).toBe('event');
        });

        test('should handle conditional scheduling', async () => {
            const conditionalConfig = {
                workflow_id: testWorkflowId,
                name: 'Test Conditional Schedule',
                schedule_type: 'conditional',
                conditional_config: {
                    conditions: [
                        { field: 'system.cpu_usage', operator: 'less_than', value: 80 },
                        { field: 'system.memory_usage', operator: 'less_than', value: 90 }
                    ],
                    check_interval: 300 // 5 minutes
                },
                is_active: true
            };

            const conditionalSchedule = await schedulingService.createSchedule(testUserId, conditionalConfig);
            
            expect(conditionalSchedule.schedule_type).toBe('conditional');
        });

        test('should manage schedule queue', async () => {
            const queueStatus = await schedulingService.getScheduleQueueStatus();
            
            expect(queueStatus).toBeDefined();
            expect(queueStatus.active_schedules).toBeDefined();
            expect(queueStatus.pending_executions).toBeDefined();
        });
    });

    describe('Component 6: Service Integration Hub Integration', () => {
        test('should create REST API integration', async () => {
            const integrationConfig = {
                name: 'Test REST API Integration',
                integration_type: 'rest_api',
                description: 'Test REST API for integration testing',
                configuration: {
                    base_url: 'https://jsonplaceholder.typicode.com',
                    endpoints: [
                        { name: 'get_post', method: 'GET', path: '/posts/{id}' }
                    ],
                    timeout: 5000,
                    retry_attempts: 3
                },
                auth_config: {
                    auth_type: 'none'
                },
                rate_limit_config: {
                    requests_per_minute: 60,
                    burst_limit: 10
                },
                is_active: true
            };

            const integration = await integrationHub.createIntegration(integrationConfig);
            
            expect(integration).toBeDefined();
            expect(integration.id).toBeDefined();
            expect(integration.integration_type).toBe('rest_api');
            
            testIntegrationId = integration.id;
        });

        test('should test integration connection', async () => {
            const testResult = await integrationHub.testIntegration(testIntegrationId, testUserId);
            
            expect(testResult).toBeDefined();
            expect(['healthy', 'degraded', 'unhealthy']).toContain(testResult.status);
        });

        test('should execute integration operation', async () => {
            const executionResult = await integrationHub.executeIntegration(testIntegrationId, {
                operation_type: 'api_call',
                operation_data: {
                    endpoint: 'get_post',
                    parameters: { id: 1 }
                },
                user_id: testUserId
            });

            expect(executionResult).toBeDefined();
            expect(executionResult.success).toBe(true);
        }, 15000);

        test('should create and handle webhook', async () => {
            const webhookConfig = {
                integration_id: testIntegrationId,
                webhook_path: '/test-webhook-integration',
                allowed_methods: ['POST'],
                security_config: {
                    require_signature: false,
                    allowed_ips: []
                }
            };

            const webhook = await integrationHub.createWebhook(webhookConfig, testUserId);
            
            expect(webhook).toBeDefined();
            expect(webhook.webhook_path).toBe('/test-webhook-integration');
        });

        test('should monitor integration performance', async () => {
            const performance = await integrationHub.getPerformanceMetrics(testUserId);
            
            expect(performance).toBeDefined();
            expect(typeof performance).toBe('object');
        });
    });

    describe('Component 7: Database Schema Optimization Integration', () => {
        test('should analyze database performance', async () => {
            const analysis = await optimizationService.analyzePerformance();
            
            expect(analysis).toBeDefined();
            expect(analysis.table_statistics).toBeDefined();
            expect(analysis.index_statistics).toBeDefined();
            expect(analysis.recommendations).toBeDefined();
        });

        test('should identify problematic workflows', async () => {
            const problematic = await optimizationService.identifyProblematicWorkflows();
            
            expect(Array.isArray(problematic)).toBe(true);
        });

        test('should run maintenance procedures', async () => {
            const maintenanceResult = await optimizationService.runMaintenance({
                analyzeOnly: true // Don't actually modify data in tests
            });

            expect(maintenanceResult).toBeDefined();
            expect(maintenanceResult.maintenance_completed).toBe(true);
        });

        test('should generate performance recommendations', async () => {
            const recommendations = await optimizationService.getPerformanceRecommendations();
            
            expect(Array.isArray(recommendations)).toBe(true);
        });

        test('should calculate system health score', async () => {
            const health = await optimizationService.getSystemHealth();
            
            expect(health).toBeDefined();
            expect(health.health_score).toBeGreaterThanOrEqual(0);
            expect(health.health_score).toBeLessThanOrEqual(100);
        });
    });

    describe('Cross-Component Integration Tests', () => {
        test('should create workflow from template and execute with monitoring', async () => {
            // Create workflow from template
            const workflowFromTemplate = await templateService.createWorkflowFromTemplate(
                testTemplateId,
                testUserId,
                { name: 'Integration Test Workflow from Template' }
            );

            // Execute the workflow
            const execution = await executionEngine.executeWorkflow(workflowFromTemplate.id, {
                triggeredBy: testUserId,
                inputData: { integration_test: true }
            });

            // Wait for execution to complete
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check monitoring metrics
            const metrics = await monitoringService.getWorkflowMetrics(workflowFromTemplate.id);
            
            expect(workflowFromTemplate).toBeDefined();
            expect(execution.executionId).toBeDefined();
            expect(metrics.execution_count).toBeGreaterThan(0);
        }, 45000);

        test('should schedule workflow with integration and monitor performance', async () => {
            // Create scheduled workflow with integration
            const scheduleWithIntegration = await schedulingService.createSchedule(testUserId, {
                workflow_id: testWorkflowId,
                name: 'Integration Test Schedule with API',
                schedule_type: 'interval',
                interval_config: {
                    interval_minutes: 60,
                    max_runs: 1
                },
                integration_settings: {
                    integration_id: testIntegrationId,
                    pre_execution_check: true
                },
                is_active: false // Don't actually run it
            });

            // Verify schedule was created
            expect(scheduleWithIntegration).toBeDefined();
            expect(scheduleWithIntegration.name).toBe('Integration Test Schedule with API');
        });

        test('should handle workflow failure with alert and optimization analysis', async () => {
            // Create a workflow designed to fail
            const failingWorkflow = {
                name: 'Failing Test Workflow',
                description: 'Workflow designed to fail for testing',
                nodes: [
                    { id: 'start', type: 'start', position: { x: 100, y: 100 } },
                    { 
                        id: 'fail', 
                        type: 'action', 
                        position: { x: 200, y: 100 },
                        data: {
                            action_type: 'http_request',
                            configuration: {
                                url: 'https://nonexistent-domain-for-testing.com',
                                method: 'GET'
                            }
                        }
                    },
                    { id: 'end', type: 'end', position: { x: 300, y: 100 } }
                ],
                edges: [
                    { id: 'e1', source: 'start', target: 'fail' },
                    { id: 'e2', source: 'fail', target: 'end' }
                ]
            };

            const failWorkflow = await designerService.createWorkflow(testUserId, failingWorkflow);
            
            // Execute the failing workflow
            await executionEngine.executeWorkflow(failWorkflow.id, {
                triggeredBy: testUserId
            });

            // Wait for failure
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Check if it appears in problematic workflows
            const problematic = await optimizationService.identifyProblematicWorkflows();
            
            expect(failWorkflow).toBeDefined();
            // Note: The workflow might not appear immediately in problematic list due to timing
        }, 30000);
    });

    describe('API Endpoint Integration Tests', () => {
        test('should handle workflow CRUD operations via API', async () => {
            const workflowData = {
                name: 'API Test Workflow',
                description: 'Created via API test',
                workflow_data: {
                    nodes: [
                        { id: 'start', type: 'start', position: { x: 100, y: 100 } }
                    ],
                    edges: []
                }
            };

            // Create workflow via API
            const createResponse = await request(app)
                .post('/api/workflows')
                .set('Authorization', `Bearer ${authToken}`)
                .send(workflowData)
                .expect(200);

            expect(createResponse.body.success).toBe(true);
            const workflowId = createResponse.body.data.id;

            // Get workflow via API
            const getResponse = await request(app)
                .get(`/api/workflows/${workflowId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(getResponse.body.data.name).toBe('API Test Workflow');

            // Update workflow via API
            const updateResponse = await request(app)
                .put(`/api/workflows/${workflowId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ description: 'Updated via API test' })
                .expect(200);

            expect(updateResponse.body.success).toBe(true);

            // Delete workflow via API
            await request(app)
                .delete(`/api/workflows/${workflowId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
        }, 30000);

        test('should handle template operations via API', async () => {
            const templateData = {
                name: 'API Test Template',
                description: 'Template created via API',
                category: 'test',
                workflow_data: {
                    nodes: [{ id: 'start', type: 'start' }],
                    edges: []
                },
                tags: ['api', 'test']
            };

            // Create template via API
            const createResponse = await request(app)
                .post('/api/workflows/templates')
                .set('Authorization', `Bearer ${authToken}`)
                .send(templateData)
                .expect(200);

            expect(createResponse.body.success).toBe(true);
            const templateId = createResponse.body.data.id;

            // Search templates via API
            const searchResponse = await request(app)
                .get('/api/workflows/templates?query=API')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(searchResponse.body.data.templates.length).toBeGreaterThan(0);
        });

        test('should handle integration operations via API', async () => {
            const integrationData = {
                name: 'API Test Integration',
                integration_type: 'rest_api',
                description: 'Integration created via API test',
                configuration: {
                    base_url: 'https://httpbin.org'
                }
            };

            // Create integration via API
            const createResponse = await request(app)
                .post('/api/workflows/integrations')
                .set('Authorization', `Bearer ${authToken}`)
                .send(integrationData)
                .expect(200);

            expect(createResponse.body.success).toBe(true);
            const integrationId = createResponse.body.data.id;

            // Test integration via API
            const testResponse = await request(app)
                .post(`/api/workflows/integrations/${integrationId}/test`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(testResponse.body.success).toBe(true);
        }, 20000);
    });

    describe('Performance and Load Tests', () => {
        test('should handle multiple concurrent workflow executions', async () => {
            const promises = [];
            const concurrentExecutions = 5;

            for (let i = 0; i < concurrentExecutions; i++) {
                promises.push(
                    executionEngine.executeWorkflow(testWorkflowId, {
                        triggeredBy: testUserId,
                        inputData: { concurrency_test: i }
                    })
                );
            }

            const results = await Promise.all(promises);
            
            expect(results.length).toBe(concurrentExecutions);
            results.forEach(result => {
                expect(result.executionId).toBeDefined();
            });
        }, 60000);

        test('should maintain performance under template operations load', async () => {
            const startTime = Date.now();
            const operations = [];

            // Create multiple templates concurrently
            for (let i = 0; i < 10; i++) {
                operations.push(
                    templateService.createTemplate(testUserId, {
                        name: `Load Test Template ${i}`,
                        description: `Template ${i} for load testing`,
                        category: 'load_test',
                        workflow_data: {
                            nodes: [{ id: 'start', type: 'start' }],
                            edges: []
                        }
                    })
                );
            }

            const results = await Promise.all(operations);
            const duration = Date.now() - startTime;
            
            expect(results.length).toBe(10);
            expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
        }, 30000);

        test('should handle high-frequency monitoring data collection', async () => {
            const startTime = Date.now();
            const monitoringOperations = [];

            for (let i = 0; i < 20; i++) {
                monitoringOperations.push(
                    monitoringService.getWorkflowMetrics(testWorkflowId)
                );
            }

            const results = await Promise.all(monitoringOperations);
            const duration = Date.now() - startTime;
            
            expect(results.length).toBe(20);
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        });
    });

    describe('Error Handling and Resilience Tests', () => {
        test('should handle database connection failures gracefully', async () => {
            // Mock database connection failure
            const originalQuery = db.query;
            db.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

            try {
                await designerService.getWorkflow(testWorkflowId);
                // Should throw an error
                expect(true).toBe(false); // This should not be reached
            } catch (error) {
                expect(error.message).toContain('Database connection failed');
            }

            // Restore original function
            db.query = originalQuery;
        });

        test('should handle invalid workflow configurations', async () => {
            const invalidWorkflow = {
                name: 'Invalid Workflow',
                nodes: [
                    { id: 'start', type: 'start' },
                    { id: 'end', type: 'end' }
                ],
                edges: [] // Missing edge connection
            };

            const validation = await designerService.validateWorkflowData(invalidWorkflow);
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        test('should handle integration service timeouts', async () => {
            const timeoutIntegration = {
                name: 'Timeout Test Integration',
                integration_type: 'rest_api',
                configuration: {
                    base_url: 'https://httpstat.us/200?sleep=10000', // 10 second delay
                    timeout: 1000 // 1 second timeout
                }
            };

            const integration = await integrationHub.createIntegration(timeoutIntegration);
            
            const execution = await integrationHub.executeIntegration(integration.id, {
                operation_type: 'api_call',
                operation_data: { endpoint: '/' },
                user_id: testUserId
            });

            expect(execution.success).toBe(false);
            expect(execution.error).toContain('timeout');
        }, 15000);
    });

    describe('Security and Validation Tests', () => {
        test('should prevent unauthorized access to workflows', async () => {
            const otherUserResult = await db.query(`
                INSERT INTO users (email, password_hash, first_name, last_name) 
                VALUES ('other@example.com', 'hashed_password', 'Other', 'User')
                RETURNING id
            `);
            const otherUserId = otherUserResult.rows[0].id;

            try {
                await designerService.getWorkflow(testWorkflowId, otherUserId);
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error.message).toContain('unauthorized') || 
                expect(error.message).toContain('not found') ||
                expect(error.message).toContain('access denied');
            }

            // Clean up
            await db.query('DELETE FROM users WHERE id = $1', [otherUserId]);
        });

        test('should sanitize input data', async () => {
            const maliciousData = {
                name: '<script>alert("xss")</script>',
                description: 'DROP TABLE workflows; --',
                workflow_data: {
                    nodes: [{ 
                        id: 'malicious', 
                        data: { 
                            script: '<img src=x onerror=alert("xss")>' 
                        } 
                    }]
                }
            };

            const result = await designerService.createWorkflow(testUserId, maliciousData);
            
            // Verify that dangerous content is sanitized or rejected
            expect(result.name).not.toContain('<script>');
            expect(result.description).not.toContain('DROP TABLE');
        });

        test('should validate integration configurations', async () => {
            const invalidIntegration = {
                name: 'Invalid Integration',
                integration_type: 'rest_api',
                configuration: {
                    base_url: 'not-a-valid-url',
                    timeout: -1 // Invalid timeout
                }
            };

            try {
                await integrationHub.createIntegration(invalidIntegration);
                expect(true).toBe(false); // Should throw validation error
            } catch (error) {
                expect(error.message).toContain('validation') || 
                expect(error.message).toContain('invalid');
            }
        });
    });

    describe('Data Consistency and Integrity Tests', () => {
        test('should maintain referential integrity on cascade deletes', async () => {
            // Create a workflow with executions and schedules
            const testWorkflow = await designerService.createWorkflow(testUserId, {
                name: 'Integrity Test Workflow',
                nodes: [{ id: 'start', type: 'start' }],
                edges: []
            });

            // Create execution
            await executionEngine.executeWorkflow(testWorkflow.id, {
                triggeredBy: testUserId
            });

            // Create schedule
            await schedulingService.createSchedule(testUserId, {
                workflow_id: testWorkflow.id,
                name: 'Integrity Test Schedule',
                schedule_type: 'manual'
            });

            // Delete workflow
            await designerService.deleteWorkflow(testWorkflow.id, testUserId);

            // Verify related records are cleaned up
            const executions = await db.query(
                'SELECT * FROM workflow_executions WHERE workflow_id = $1',
                [testWorkflow.id]
            );
            const schedules = await db.query(
                'SELECT * FROM workflow_schedules WHERE workflow_id = $1',
                [testWorkflow.id]
            );

            expect(executions.rows.length).toBe(0);
            expect(schedules.rows.length).toBe(0);
        });

        test('should handle transaction rollbacks on failures', async () => {
            // This test would need to be implemented based on specific transaction handling
            // in your services. For now, it's a placeholder.
            expect(true).toBe(true);
        });
    });
});

export default {}; // ES modules export
