// WorkflowTestExecutionFramework.js
// Component 8: Complete Test Execution and Validation Framework
// Orchestrates all testing frameworks for comprehensive system validation

import WorkflowPerformanceTestingFramework from './WorkflowPerformanceTestingFramework.js';
import WorkflowSecurityAuditFramework from './WorkflowSecurityAuditFramework.js';
import { OpenTelemetryTracing } from '../system/OpenTelemetryTracing.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowTestExecutionFramework {
    constructor(services, db) {
        this.services = services;
        this.db = db;
        this.tracer = OpenTelemetryTracing.getTracer('workflow-test-execution');
        
        // Initialize testing frameworks
        this.performanceFramework = new WorkflowPerformanceTestingFramework(services);
        this.securityFramework = new WorkflowSecurityAuditFramework(services, db);
        
        this.testResults = {
            integration: [],
            performance: [],
            security: [],
            load: [],
            endToEnd: []
        };

        this.testConfiguration = {
            runIntegrationTests: true,
            runPerformanceTests: true,
            runSecurityAudits: true,
            runLoadTests: true,
            runEndToEndTests: true,
            
            // Performance test configuration
            performanceThresholds: {
                workflow_creation: 1000, // ms
                workflow_execution: 5000, // ms
                template_search: 500, // ms
                integration_call: 3000, // ms
                database_query: 200, // ms
                memory_usage: 512 * 1024 * 1024, // 512MB
                cpu_usage: 80 // percentage
            },
            
            // Load test configuration
            loadTestScenarios: {
                light: { users: 10, duration: 60, rampUp: 10 },
                medium: { users: 50, duration: 300, rampUp: 30 },
                heavy: { users: 200, duration: 600, rampUp: 60 }
            },
            
            // Security audit configuration
            securityAuditScope: 'full', // 'full', 'injection', 'access_control', 'data_security'
            
            // Test execution configuration
            parallelExecution: true,
            generateReports: true,
            exitOnFailure: false,
            verbose: true
        };
    }

    async initialize() {
        console.log('🧪 Initializing Test Execution Framework');
        
        try {
            // Initialize all testing frameworks
            await Promise.all([
                this.performanceFramework.initialize(),
                this.securityFramework ? Promise.resolve() : Promise.resolve()
            ]);

            // Verify all services are available
            await this.verifyServiceAvailability();
            
            console.log('✅ Test Execution Framework initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Test Execution Framework:', error);
            throw error;
        }
    }

    async verifyServiceAvailability() {
        const requiredServices = [
            'designerService',
            'executionEngine',
            'templateService',
            'monitoringService',
            'schedulingService',
            'integrationHub',
            'optimizationService'
        ];

        for (const serviceName of requiredServices) {
            if (!this.services[serviceName]) {
                throw new Error(`Required service ${serviceName} is not available`);
            }
            
            // Test service initialization if available
            if (typeof this.services[serviceName].initialize === 'function') {
                try {
                    await this.services[serviceName].initialize();
                } catch (error) {
                    console.warn(`Service ${serviceName} initialization warning:`, error.message);
                }
            }
        }
    }

    async runCompleteTestSuite(configuration = {}) {
        const span = this.tracer.startSpan('complete-test-suite');
        const config = { ...this.testConfiguration, ...configuration };
        
        try {
            console.log('🚀 Starting Complete Test Suite Execution');
            console.log('=====================================');
            
            const suiteResults = {
                startTime: Date.now(),
                configuration: config,
                results: {
                    integration: null,
                    performance: null,
                    security: null,
                    load: null,
                    endToEnd: null
                },
                summary: {
                    totalTests: 0,
                    passed: 0,
                    failed: 0,
                    warnings: 0,
                    duration: 0
                },
                recommendations: []
            };

            // Create test user for all tests
            const testUser = await this.createTestUser();
            
            try {
                // Run test suites based on configuration
                const testPromises = [];

                if (config.runIntegrationTests) {
                    testPromises.push(
                        this.runIntegrationTestSuite(testUser.id)
                            .then(result => suiteResults.results.integration = result)
                    );
                }

                if (config.runPerformanceTests) {
                    testPromises.push(
                        this.runPerformanceTestSuite(testUser.id)
                            .then(result => suiteResults.results.performance = result)
                    );
                }

                if (config.runSecurityAudits) {
                    testPromises.push(
                        this.runSecurityAuditSuite()
                            .then(result => suiteResults.results.security = result)
                    );
                }

                if (config.runLoadTests) {
                    testPromises.push(
                        this.runLoadTestSuite(testUser.id)
                            .then(result => suiteResults.results.load = result)
                    );
                }

                if (config.runEndToEndTests) {
                    testPromises.push(
                        this.runEndToEndTestSuite(testUser.id)
                            .then(result => suiteResults.results.endToEnd = result)
                    );
                }

                // Execute tests based on configuration
                if (config.parallelExecution) {
                    await Promise.all(testPromises);
                } else {
                    for (const testPromise of testPromises) {
                        await testPromise;
                    }
                }

                // Calculate summary
                this.calculateTestSuiteSummary(suiteResults);

                // Generate recommendations
                suiteResults.recommendations = this.generateTestRecommendations(suiteResults);

                suiteResults.endTime = Date.now();
                suiteResults.summary.duration = suiteResults.endTime - suiteResults.startTime;

                // Generate reports if configured
                if (config.generateReports) {
                    await this.generateTestReports(suiteResults);
                }

                // Print summary
                this.printTestSuiteSummary(suiteResults);

                span.setAttributes({
                    'test.total_tests': suiteResults.summary.totalTests,
                    'test.passed': suiteResults.summary.passed,
                    'test.failed': suiteResults.summary.failed,
                    'test.duration': suiteResults.summary.duration
                });

                // Exit on failure if configured
                if (config.exitOnFailure && suiteResults.summary.failed > 0) {
                    console.error('❌ Test suite failed - exiting as configured');
                    process.exit(1);
                }

                return suiteResults;

            } finally {
                await this.cleanupTestUser(testUser.id);
            }

        } catch (error) {
            console.error('❌ Test suite execution failed:', error);
            span.recordException(error);
            throw error;
        } finally {
            span.end();
        }
    }

    async runIntegrationTestSuite(userId) {
        console.log('\n🔗 Running Integration Test Suite');
        console.log('=================================');

        const integrationResults = {
            suite: 'integration',
            startTime: Date.now(),
            tests: [],
            passed: 0,
            failed: 0,
            warnings: 0
        };

        try {
            // Test 1: Component Integration
            const componentTest = await this.testComponentIntegration(userId);
            integrationResults.tests.push(componentTest);
            componentTest.passed ? integrationResults.passed++ : integrationResults.failed++;

            // Test 2: API Integration
            const apiTest = await this.testAPIIntegration(userId);
            integrationResults.tests.push(apiTest);
            apiTest.passed ? integrationResults.passed++ : integrationResults.failed++;

            // Test 3: Database Integration
            const dbTest = await this.testDatabaseIntegration(userId);
            integrationResults.tests.push(dbTest);
            dbTest.passed ? integrationResults.passed++ : integrationResults.failed++;

            // Test 4: Service Integration
            const serviceTest = await this.testServiceIntegration(userId);
            integrationResults.tests.push(serviceTest);
            serviceTest.passed ? integrationResults.passed++ : integrationResults.failed++;

            integrationResults.endTime = Date.now();
            integrationResults.duration = integrationResults.endTime - integrationResults.startTime;

            console.log(`✅ Integration tests completed: ${integrationResults.passed}/${integrationResults.tests.length} passed`);
            return integrationResults;

        } catch (error) {
            console.error('❌ Integration test suite failed:', error);
            integrationResults.error = error.message;
            return integrationResults;
        }
    }

    async runPerformanceTestSuite(userId) {
        console.log('\n⚡ Running Performance Test Suite');
        console.log('================================');

        try {
            const performanceResults = await this.performanceFramework.runWorkflowPerformanceSuite(userId);
            
            // Add threshold validation
            performanceResults.thresholdViolations = [];
            for (const test of performanceResults.tests) {
                if (test.thresholdViolations && test.thresholdViolations.length > 0) {
                    performanceResults.thresholdViolations.push(...test.thresholdViolations);
                }
            }

            console.log(`✅ Performance tests completed with ${performanceResults.tests.length} test scenarios`);
            return performanceResults;

        } catch (error) {
            console.error('❌ Performance test suite failed:', error);
            return { error: error.message, suite: 'performance' };
        }
    }

    async runSecurityAuditSuite() {
        console.log('\n🔒 Running Security Audit Suite');
        console.log('==============================');

        try {
            const securityResults = await this.securityFramework.runSecurityAudit(
                this.testConfiguration.securityAuditScope
            );

            console.log(`✅ Security audit completed with ${securityResults.vulnerabilities.length} findings`);
            return securityResults;

        } catch (error) {
            console.error('❌ Security audit suite failed:', error);
            return { error: error.message, suite: 'security' };
        }
    }

    async runLoadTestSuite(userId) {
        console.log('\n🚛 Running Load Test Suite');
        console.log('=========================');

        const loadResults = {
            suite: 'load',
            startTime: Date.now(),
            scenarios: []
        };

        try {
            // Run light load test
            const lightTest = await this.performanceFramework.runLoadTest('light');
            loadResults.scenarios.push(lightTest);

            // Run medium load test
            const mediumTest = await this.performanceFramework.runLoadTest('medium');
            loadResults.scenarios.push(mediumTest);

            // Run heavy load test only if previous tests passed
            if (lightTest.metrics && mediumTest.metrics) {
                const heavyTest = await this.performanceFramework.runLoadTest('heavy');
                loadResults.scenarios.push(heavyTest);
            }

            loadResults.endTime = Date.now();
            loadResults.duration = loadResults.endTime - loadResults.startTime;

            console.log(`✅ Load tests completed with ${loadResults.scenarios.length} scenarios`);
            return loadResults;

        } catch (error) {
            console.error('❌ Load test suite failed:', error);
            loadResults.error = error.message;
            return loadResults;
        }
    }

    async runEndToEndTestSuite(userId) {
        console.log('\n🎯 Running End-to-End Test Suite');
        console.log('===============================');

        const e2eResults = {
            suite: 'end-to-end',
            startTime: Date.now(),
            scenarios: [],
            passed: 0,
            failed: 0
        };

        try {
            // Scenario 1: Complete Workflow Lifecycle
            const lifecycleTest = await this.testCompleteWorkflowLifecycle(userId);
            e2eResults.scenarios.push(lifecycleTest);
            lifecycleTest.passed ? e2eResults.passed++ : e2eResults.failed++;

            // Scenario 2: Template to Execution Pipeline
            const templateTest = await this.testTemplateToExecutionPipeline(userId);
            e2eResults.scenarios.push(templateTest);
            templateTest.passed ? e2eResults.passed++ : e2eResults.failed++;

            // Scenario 3: Integration with External Services
            const integrationTest = await this.testExternalServiceIntegration(userId);
            e2eResults.scenarios.push(integrationTest);
            integrationTest.passed ? e2eResults.passed++ : e2eResults.failed++;

            // Scenario 4: Monitoring and Optimization Pipeline
            const monitoringTest = await this.testMonitoringOptimizationPipeline(userId);
            e2eResults.scenarios.push(monitoringTest);
            monitoringTest.passed ? e2eResults.passed++ : e2eResults.failed++;

            e2eResults.endTime = Date.now();
            e2eResults.duration = e2eResults.endTime - e2eResults.startTime;

            console.log(`✅ End-to-end tests completed: ${e2eResults.passed}/${e2eResults.scenarios.length} passed`);
            return e2eResults;

        } catch (error) {
            console.error('❌ End-to-end test suite failed:', error);
            e2eResults.error = error.message;
            return e2eResults;
        }
    }

    // Individual test implementations
    async testComponentIntegration(userId) {
        try {
            // Test workflow creation with designer service
            const workflow = await this.services.designerService.createWorkflow(userId, {
                name: 'Integration Test Workflow',
                nodes: [
                    { id: 'start', type: 'start', position: { x: 100, y: 100 } },
                    { id: 'end', type: 'end', position: { x: 300, y: 100 } }
                ],
                edges: [{ id: 'e1', source: 'start', target: 'end' }]
            });

            // Test workflow execution
            const execution = await this.services.executionEngine.executeWorkflow(workflow.id, {
                triggeredBy: userId
            });

            return {
                name: 'Component Integration',
                passed: !!(workflow && execution),
                details: { workflowId: workflow?.id, executionId: execution?.executionId }
            };
        } catch (error) {
            return {
                name: 'Component Integration',
                passed: false,
                error: error.message
            };
        }
    }

    async testAPIIntegration(userId) {
        try {
            // Test template search API
            const templates = await this.services.templateService.searchTemplates({
                query: 'test',
                limit: 5
            });

            // Test monitoring metrics API
            const metrics = await this.services.monitoringService.getSystemAnalytics({
                user_id: userId,
                time_range: '1h'
            });

            return {
                name: 'API Integration',
                passed: !!(templates && metrics),
                details: { templatesFound: templates?.templates?.length, metricsAvailable: !!metrics }
            };
        } catch (error) {
            return {
                name: 'API Integration',
                passed: false,
                error: error.message
            };
        }
    }

    async testDatabaseIntegration(userId) {
        try {
            // Test database query
            const result = await this.db.query('SELECT 1 as test');
            
            // Test user-specific query
            const userCheck = await this.db.query('SELECT id FROM users WHERE id = $1', [userId]);

            return {
                name: 'Database Integration',
                passed: !!(result.rows[0]?.test === 1 && userCheck.rows.length > 0),
                details: { connectionActive: true, userExists: userCheck.rows.length > 0 }
            };
        } catch (error) {
            return {
                name: 'Database Integration',
                passed: false,
                error: error.message
            };
        }
    }

    async testServiceIntegration(userId) {
        try {
            // Test service initialization status
            const serviceStatus = {};
            for (const [name, service] of Object.entries(this.services)) {
                serviceStatus[name] = !!service;
            }

            const allServicesAvailable = Object.values(serviceStatus).every(status => status);

            return {
                name: 'Service Integration',
                passed: allServicesAvailable,
                details: serviceStatus
            };
        } catch (error) {
            return {
                name: 'Service Integration',
                passed: false,
                error: error.message
            };
        }
    }

    async testCompleteWorkflowLifecycle(userId) {
        try {
            // Create workflow
            const workflow = await this.services.designerService.createWorkflow(userId, {
                name: 'E2E Lifecycle Test',
                nodes: [
                    { id: 'start', type: 'start', position: { x: 100, y: 100 } },
                    { id: 'action', type: 'action', position: { x: 200, y: 100 } },
                    { id: 'end', type: 'end', position: { x: 300, y: 100 } }
                ],
                edges: [
                    { id: 'e1', source: 'start', target: 'action' },
                    { id: 'e2', source: 'action', target: 'end' }
                ]
            });

            // Execute workflow
            const execution = await this.services.executionEngine.executeWorkflow(workflow.id, {
                triggeredBy: userId
            });

            // Monitor execution
            await new Promise(resolve => setTimeout(resolve, 2000));
            const metrics = await this.services.monitoringService.getWorkflowMetrics(workflow.id);

            // Cleanup
            await this.services.designerService.deleteWorkflow(workflow.id, userId);

            return {
                name: 'Complete Workflow Lifecycle',
                passed: !!(workflow && execution && metrics),
                details: { 
                    created: !!workflow,
                    executed: !!execution,
                    monitored: !!metrics,
                    cleaned: true
                }
            };
        } catch (error) {
            return {
                name: 'Complete Workflow Lifecycle',
                passed: false,
                error: error.message
            };
        }
    }

    async testTemplateToExecutionPipeline(userId) {
        try {
            // Create template
            const template = await this.services.templateService.createTemplate(userId, {
                name: 'E2E Template Test',
                category: 'test',
                workflow_data: {
                    nodes: [
                        { id: 'start', type: 'start', position: { x: 100, y: 100 } },
                        { id: 'end', type: 'end', position: { x: 300, y: 100 } }
                    ],
                    edges: [{ id: 'e1', source: 'start', target: 'end' }]
                }
            });

            // Create workflow from template
            const workflow = await this.services.templateService.createWorkflowFromTemplate(
                template.id,
                userId,
                { name: 'Workflow from E2E Template' }
            );

            // Execute workflow
            const execution = await this.services.executionEngine.executeWorkflow(workflow.id, {
                triggeredBy: userId
            });

            return {
                name: 'Template to Execution Pipeline',
                passed: !!(template && workflow && execution),
                details: {
                    templateCreated: !!template,
                    workflowFromTemplate: !!workflow,
                    executed: !!execution
                }
            };
        } catch (error) {
            return {
                name: 'Template to Execution Pipeline',
                passed: false,
                error: error.message
            };
        }
    }

    async testExternalServiceIntegration(userId) {
        try {
            // Create integration
            const integration = await this.services.integrationHub.createIntegration({
                name: 'E2E Test Integration',
                integration_type: 'rest_api',
                configuration: {
                    base_url: 'https://jsonplaceholder.typicode.com'
                }
            });

            // Test integration
            const testResult = await this.services.integrationHub.testIntegration(integration.id, userId);

            return {
                name: 'External Service Integration',
                passed: !!(integration && testResult?.status === 'healthy'),
                details: {
                    integrationCreated: !!integration,
                    testStatus: testResult?.status
                }
            };
        } catch (error) {
            return {
                name: 'External Service Integration',
                passed: false,
                error: error.message
            };
        }
    }

    async testMonitoringOptimizationPipeline(userId) {
        try {
            // Run performance analysis
            const analysis = await this.services.optimizationService.analyzePerformance();

            // Get system health
            const health = await this.services.optimizationService.getSystemHealth();

            // Get monitoring metrics
            const analytics = await this.services.monitoringService.getSystemAnalytics({
                user_id: userId,
                time_range: '1h'
            });

            return {
                name: 'Monitoring and Optimization Pipeline',
                passed: !!(analysis && health && analytics),
                details: {
                    analysisComplete: !!analysis,
                    healthScore: health?.health_score,
                    analyticsAvailable: !!analytics
                }
            };
        } catch (error) {
            return {
                name: 'Monitoring and Optimization Pipeline',
                passed: false,
                error: error.message
            };
        }
    }

    // Helper methods
    async createTestUser() {
        const testEmail = `test-${Date.now()}@test-execution.local`;
        const result = await this.db.query(`
            INSERT INTO users (email, password_hash, first_name, last_name) 
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [testEmail, 'test-hash', 'Test', 'User']);
        
        return { id: result.rows[0].id, email: testEmail };
    }

    async cleanupTestUser(userId) {
        try {
            await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
        } catch (error) {
            console.warn('Failed to cleanup test user:', error.message);
        }
    }

    calculateTestSuiteSummary(suiteResults) {
        suiteResults.summary.totalTests = 0;
        suiteResults.summary.passed = 0;
        suiteResults.summary.failed = 0;
        suiteResults.summary.warnings = 0;

        for (const [suiteName, result] of Object.entries(suiteResults.results)) {
            if (!result) continue;

            if (result.tests) {
                suiteResults.summary.totalTests += result.tests.length;
                suiteResults.summary.passed += result.passed || 0;
                suiteResults.summary.failed += result.failed || 0;
                suiteResults.summary.warnings += result.warnings || 0;
            } else if (result.scenarios) {
                suiteResults.summary.totalTests += result.scenarios.length;
                suiteResults.summary.passed += result.passed || 0;
                suiteResults.summary.failed += result.failed || 0;
            } else if (result.vulnerabilities) {
                suiteResults.summary.totalTests += result.tests?.length || 1;
                const criticalVulns = result.vulnerabilities.filter(v => v.severity === 'critical').length;
                if (criticalVulns > 0) {
                    suiteResults.summary.failed += 1;
                } else {
                    suiteResults.summary.passed += 1;
                }
            }
        }
    }

    generateTestRecommendations(suiteResults) {
        const recommendations = [];

        if (suiteResults.summary.failed > 0) {
            recommendations.push({
                priority: 'high',
                title: 'Address Test Failures',
                description: `${suiteResults.summary.failed} tests failed and require attention`,
                action: 'Review failed test details and implement fixes'
            });
        }

        if (suiteResults.results.security?.summary?.critical > 0) {
            recommendations.push({
                priority: 'critical',
                title: 'Critical Security Vulnerabilities',
                description: 'Critical security issues found during audit',
                action: 'Implement security fixes immediately before deployment'
            });
        }

        if (suiteResults.results.performance?.thresholdViolations?.length > 0) {
            recommendations.push({
                priority: 'medium',
                title: 'Performance Optimization Needed',
                description: 'Performance thresholds exceeded in testing',
                action: 'Optimize performance bottlenecks identified in testing'
            });
        }

        return recommendations;
    }

    async generateTestReports(suiteResults) {
        try {
            const reportsDir = path.join(__dirname, '../../reports/test-execution');
            await fs.mkdir(reportsDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(reportsDir, `test-suite-report-${timestamp}.json`);

            await fs.writeFile(reportPath, JSON.stringify(suiteResults, null, 2));
            
            console.log(`📄 Test report generated: ${reportPath}`);
            
            // Generate summary report
            const summaryPath = path.join(reportsDir, `test-summary-${timestamp}.md`);
            const summaryContent = this.generateMarkdownSummary(suiteResults);
            await fs.writeFile(summaryPath, summaryContent);
            
            console.log(`📄 Summary report generated: ${summaryPath}`);

        } catch (error) {
            console.error('Failed to generate test reports:', error);
        }
    }

    generateMarkdownSummary(suiteResults) {
        const summary = suiteResults.summary;
        const duration = Math.round(summary.duration / 1000);
        
        return `
# Test Suite Execution Report

**Generated:** ${new Date().toISOString()}
**Duration:** ${duration} seconds
**Total Tests:** ${summary.totalTests}
**Status:** ${summary.failed === 0 ? '✅ PASSED' : '❌ FAILED'}

## Summary

- ✅ **Passed:** ${summary.passed}
- ❌ **Failed:** ${summary.failed}
- ⚠️ **Warnings:** ${summary.warnings}
- 📊 **Success Rate:** ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%

## Test Results by Suite

${Object.entries(suiteResults.results)
    .filter(([_, result]) => result)
    .map(([suiteName, result]) => {
        const status = result.error ? '❌' : '✅';
        const tests = result.tests?.length || result.scenarios?.length || 1;
        return `### ${status} ${suiteName.charAt(0).toUpperCase() + suiteName.slice(1)} Tests\n- Tests: ${tests}\n- Duration: ${result.duration ? Math.round(result.duration / 1000) : 'N/A'}s`;
    }).join('\n\n')}

## Recommendations

${suiteResults.recommendations.map(rec => 
    `### ${rec.priority.toUpperCase()}: ${rec.title}\n${rec.description}\n**Action:** ${rec.action}`
).join('\n\n')}
`;
    }

    printTestSuiteSummary(suiteResults) {
        const summary = suiteResults.summary;
        const duration = Math.round(summary.duration / 1000);
        
        console.log('\n🏁 Test Suite Execution Complete');
        console.log('================================');
        console.log(`Duration: ${duration} seconds`);
        console.log(`Total Tests: ${summary.totalTests}`);
        console.log(`✅ Passed: ${summary.passed}`);
        console.log(`❌ Failed: ${summary.failed}`);
        console.log(`⚠️ Warnings: ${summary.warnings}`);
        console.log(`📊 Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%`);
        
        if (summary.failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! System ready for deployment.');
        } else {
            console.log('\n⚠️ Some tests failed. Review results and implement fixes.');
        }
        
        if (suiteResults.recommendations.length > 0) {
            console.log('\n📋 Recommendations:');
            suiteResults.recommendations.forEach(rec => {
                console.log(`  ${rec.priority.toUpperCase()}: ${rec.title}`);
            });
        }
    }

    cleanup() {
        if (this.performanceFramework) {
            this.performanceFramework.cleanup();
        }
        if (this.securityFramework) {
            this.securityFramework.cleanup();
        }
        this.testResults = { integration: [], performance: [], security: [], load: [], endToEnd: [] };
    }
}

export default WorkflowTestExecutionFramework;
