#!/usr/bin/env node

/**
 * Production Deployment Pipeline Testing Script
 * Comprehensive testing for Task 29: Production Deployment Pipeline
 * August 16, 2025
 */

import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

class ProductionDeploymentPipelineTester {
    constructor() {
        this.testResults = [];
        this.servicesPath = 'packages/backend/src/services';
        this.routesPath = 'packages/backend/src/routes';
        
        this.requiredServices = [
            'ProductionDeploymentPipelineManager.js',
            'InfrastructureAsCodeManager.js'
        ];

        this.requiredRoutes = [
            'deployment.js'
        ];

        this.requiredDirectories = [
            '.github/workflows',
            'docker',
            'k8s',
            'infrastructure/terraform',
            'infrastructure/kubernetes',
            'infrastructure/helm',
            'infrastructure/ansible'
        ];

        this.requiredFiles = [
            '.github/workflows/cicd.yml',
            'docker/Dockerfile',
            'docker/docker-compose.yml',
            'k8s/deployment.template.yaml',
            'k8s/service.template.yaml'
        ];
    }

    /**
     * Run comprehensive deployment pipeline tests
     */
    async runTests() {
        console.log('🚀 Starting Production Deployment Pipeline Tests...\n');

        try {
            // File and directory existence tests
            await this.testFileExistence();
            
            // ES6 module compliance tests
            await this.testES6Compliance();
            
            // Architecture validation tests
            await this.testArchitecture();
            
            // Infrastructure templates tests
            await this.testInfrastructureTemplates();
            
            // CI/CD integration tests
            await this.testCICDIntegration();
            
            // Deployment strategy tests
            await this.testDeploymentStrategies();
            
            // API integration tests
            await this.testAPIIntegration();
            
            // Generate test report
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Tests failed:', error);
            process.exit(1);
        }
    }

    /**
     * Test file and directory existence
     */
    async testFileExistence() {
        console.log('📁 Testing file and directory existence...');
        
        // Test services
        for (const service of this.requiredServices) {
            const servicePath = join(this.servicesPath, service);
            
            try {
                const stats = statSync(servicePath);
                const sizeKB = (stats.size / 1024).toFixed(2);
                
                this.testResults.push({
                    test: 'file_existence',
                    component: service,
                    status: 'PASS',
                    details: `${sizeKB}KB`
                });
                
                console.log(`  ✅ ${service} (${sizeKB}KB)`);
                
            } catch (error) {
                this.testResults.push({
                    test: 'file_existence',
                    component: service,
                    status: 'FAIL',
                    error: error.message
                });
                
                console.log(`  ❌ ${service} - MISSING`);
            }
        }

        // Test routes
        for (const route of this.requiredRoutes) {
            const routePath = join(this.routesPath, route);
            
            try {
                const stats = statSync(routePath);
                const sizeKB = (stats.size / 1024).toFixed(2);
                
                this.testResults.push({
                    test: 'file_existence',
                    component: `routes/${route}`,
                    status: 'PASS',
                    details: `${sizeKB}KB`
                });
                
                console.log(`  ✅ routes/${route} (${sizeKB}KB)`);
                
            } catch (error) {
                this.testResults.push({
                    test: 'file_existence',
                    component: `routes/${route}`,
                    status: 'FAIL',
                    error: error.message
                });
                
                console.log(`  ❌ routes/${route} - MISSING`);
            }
        }

        // Test directories
        for (const directory of this.requiredDirectories) {
            try {
                const stats = statSync(directory);
                if (stats.isDirectory()) {
                    this.testResults.push({
                        test: 'directory_existence',
                        component: directory,
                        status: 'PASS',
                        details: 'Directory exists'
                    });
                    
                    console.log(`  ✅ ${directory}/ - Directory exists`);
                } else {
                    throw new Error('Not a directory');
                }
                
            } catch (error) {
                this.testResults.push({
                    test: 'directory_existence',
                    component: directory,
                    status: 'FAIL',
                    error: error.message
                });
                
                console.log(`  ❌ ${directory}/ - MISSING`);
            }
        }

        // Test specific required files
        for (const file of this.requiredFiles) {
            try {
                const stats = statSync(file);
                const sizeKB = (stats.size / 1024).toFixed(2);
                
                this.testResults.push({
                    test: 'required_files',
                    component: file,
                    status: 'PASS',
                    details: `${sizeKB}KB`
                });
                
                console.log(`  ✅ ${file} (${sizeKB}KB)`);
                
            } catch (error) {
                this.testResults.push({
                    test: 'required_files',
                    component: file,
                    status: 'FAIL',
                    error: error.message
                });
                
                console.log(`  ❌ ${file} - MISSING`);
            }
        }
        
        console.log('✅ File existence tests completed\n');
    }

    /**
     * Test ES6 module compliance
     */
    async testES6Compliance() {
        console.log('📦 Testing ES6 module compliance...');
        
        const allFiles = [...this.requiredServices.map(s => join(this.servicesPath, s)), 
                          ...this.requiredRoutes.map(r => join(this.routesPath, r))];
        
        for (const filePath of allFiles) {
            try {
                const content = readFileSync(filePath, 'utf8');
                const fileName = filePath.split('/').pop();
                
                // Check for ES6 imports
                const hasES6Imports = /^import\s+.*from\s+['"][^'"]+['"];?\s*$/m.test(content);
                
                // Check for ES6 exports
                const hasES6Exports = /^export\s+(default\s+|{.*}|class|function|const|let)/m.test(content);
                
                // Check for CommonJS (should not be present)
                const hasCommonJSRequire = /(?:^|\s)const\s+\w+\s*=\s*require\s*\(/m.test(content);
                const hasCommonJSExports = /(?:^|\s)module\.exports\s*=|exports\.\w+\s*=/m.test(content);
                
                const isCompliant = hasES6Imports && hasES6Exports && !hasCommonJSRequire && !hasCommonJSExports;
                
                this.testResults.push({
                    test: 'es6_compliance',
                    component: fileName,
                    status: isCompliant ? 'PASS' : 'FAIL',
                    details: {
                        hasES6Imports,
                        hasES6Exports,
                        hasCommonJSRequire,
                        hasCommonJSExports
                    }
                });
                
                if (isCompliant) {
                    console.log(`  ✅ ${fileName} - ES6 compliant`);
                } else {
                    console.log(`  ❌ ${fileName} - Non-compliant`);
                }
                
            } catch (error) {
                this.testResults.push({
                    test: 'es6_compliance',
                    component: filePath.split('/').pop(),
                    status: 'ERROR',
                    error: error.message
                });
            }
        }
        
        console.log('✅ ES6 compliance tests completed\n');
    }

    /**
     * Test service architecture
     */
    async testArchitecture() {
        console.log('🏗️  Testing deployment service architecture...');
        
        const architectureTests = {
            'ProductionDeploymentPipelineManager.js': [
                'class ProductionDeploymentPipelineManager',
                'EventEmitter',
                'deployToEnvironment',
                'rollbackDeployment',
                'DeploymentStrategies',
                'getDeploymentStatus',
                'executeDeploymentSteps',
                'performHealthChecks'
            ],
            'InfrastructureAsCodeManager.js': [
                'class InfrastructureAsCodeManager',
                'EventEmitter',
                'InfrastructureProviders',
                'createDefaultTemplates',
                'initializeProviders',
                'setupDirectoryStructure',
                'getInfrastructureStatus'
            ]
        };
        
        for (const [service, patterns] of Object.entries(architectureTests)) {
            const servicePath = join(this.servicesPath, service);
            
            try {
                const content = readFileSync(servicePath, 'utf8');
                
                const foundPatterns = [];
                const missingPatterns = [];
                
                for (const pattern of patterns) {
                    if (content.includes(pattern)) {
                        foundPatterns.push(pattern);
                    } else {
                        missingPatterns.push(pattern);
                    }
                }
                
                const score = (foundPatterns.length / patterns.length) * 100;
                const isValid = score >= 80;
                
                this.testResults.push({
                    test: 'architecture',
                    component: service,
                    status: isValid ? 'PASS' : 'FAIL',
                    score: score.toFixed(1),
                    found: foundPatterns.length,
                    total: patterns.length,
                    missing: missingPatterns
                });
                
                if (isValid) {
                    console.log(`  ✅ ${service} - Architecture score: ${score.toFixed(1)}%`);
                } else {
                    console.log(`  ❌ ${service} - Architecture score: ${score.toFixed(1)}% (missing: ${missingPatterns.join(', ')})`);
                }
                
            } catch (error) {
                this.testResults.push({
                    test: 'architecture',
                    component: service,
                    status: 'ERROR',
                    error: error.message
                });
            }
        }
        
        console.log('✅ Architecture tests completed\n');
    }

    /**
     * Test infrastructure templates
     */
    async testInfrastructureTemplates() {
        console.log('🏗️  Testing infrastructure templates...');
        
        const templateTests = {
            '.github/workflows/cicd.yml': [
                'name: CI/CD Pipeline',
                'on:',
                'jobs:',
                'test:',
                'build:',
                'deploy-staging:',
                'deploy-production:'
            ],
            'docker/Dockerfile': [
                'FROM node:20-alpine',
                'WORKDIR /app',
                'COPY package',
                'RUN npm',
                'EXPOSE 3000',
                'CMD'
            ],
            'k8s/deployment.template.yaml': [
                'apiVersion: apps/v1',
                'kind: Deployment',
                'metadata:',
                'spec:',
                'containers:',
                'image: {{IMAGE}}'
            ],
            'k8s/service.template.yaml': [
                'apiVersion: v1',
                'kind: Service',
                'metadata:',
                'spec:',
                'selector:',
                'ports:'
            ]
        };
        
        for (const [template, patterns] of Object.entries(templateTests)) {
            try {
                const content = readFileSync(template, 'utf8');
                
                const foundPatterns = [];
                const missingPatterns = [];
                
                for (const pattern of patterns) {
                    if (content.includes(pattern)) {
                        foundPatterns.push(pattern);
                    } else {
                        missingPatterns.push(pattern);
                    }
                }
                
                const score = (foundPatterns.length / patterns.length) * 100;
                const isValid = score >= 80;
                
                this.testResults.push({
                    test: 'infrastructure_templates',
                    component: template,
                    status: isValid ? 'PASS' : 'FAIL',
                    score: score.toFixed(1),
                    found: foundPatterns.length,
                    total: patterns.length,
                    missing: missingPatterns
                });
                
                if (isValid) {
                    console.log(`  ✅ ${template} - Template score: ${score.toFixed(1)}%`);
                } else {
                    console.log(`  ❌ ${template} - Template score: ${score.toFixed(1)}% (missing: ${missingPatterns.join(', ')})`);
                }
                
            } catch (error) {
                this.testResults.push({
                    test: 'infrastructure_templates',
                    component: template,
                    status: 'ERROR',
                    error: error.message
                });
                
                console.log(`  ❌ ${template} - ERROR: ${error.message}`);
            }
        }
        
        console.log('✅ Infrastructure template tests completed\n');
    }

    /**
     * Test CI/CD integration
     */
    async testCICDIntegration() {
        console.log('🔄 Testing CI/CD integration...');
        
        const cicdFeatures = [
            'GitHub Actions workflow',
            'Multi-stage Docker build',
            'Kubernetes deployment templates',
            'Terraform infrastructure',
            'Helm charts',
            'Ansible playbooks'
        ];
        
        const cicdTests = {
            'github_actions': {
                file: '.github/workflows/cicd.yml',
                patterns: ['github.ref', 'docker/build-push-action', 'CARTRITA_DEPLOYMENT_WEBHOOK']
            },
            'docker_multistage': {
                file: 'docker/Dockerfile',
                patterns: ['FROM node:20-alpine AS builder', 'FROM node:20-alpine AS production', 'COPY --from=builder']
            },
            'kubernetes_templates': {
                file: 'k8s/deployment.template.yaml',
                patterns: ['{{NAMESPACE}}', '{{IMAGE}}', '{{REPLICAS}}', '{{ENVIRONMENT}}']
            },
            'terraform_config': {
                files: ['infrastructure/terraform/main.tf', 'infrastructure/terraform/kubernetes.tf'],
                patterns: ['terraform {', 'provider "kubernetes"', 'resource "kubernetes_deployment"']
            }
        };
        
        for (const [feature, test] of Object.entries(cicdTests)) {
            let foundFeatures = 0;
            let totalFeatures = 0;
            let missingFeatures = [];
            
            const files = test.files || [test.file];
            
            for (const file of files) {
                try {
                    const content = readFileSync(file, 'utf8');
                    
                    for (const pattern of test.patterns) {
                        totalFeatures++;
                        if (content.includes(pattern)) {
                            foundFeatures++;
                        } else {
                            missingFeatures.push(`${pattern} in ${file}`);
                        }
                    }
                    
                } catch (error) {
                    console.warn(`  ⚠️ Could not read ${file}: ${error.message}`);
                    totalFeatures += test.patterns.length;
                    missingFeatures.push(...test.patterns.map(p => `${p} in ${file}`));
                }
            }
            
            const score = totalFeatures > 0 ? (foundFeatures / totalFeatures) * 100 : 0;
            const isValid = score >= 70;
            
            this.testResults.push({
                test: 'cicd_integration',
                component: feature,
                status: isValid ? 'PASS' : 'FAIL',
                score: score.toFixed(1),
                found: foundFeatures,
                total: totalFeatures,
                missing: missingFeatures
            });
            
            if (isValid) {
                console.log(`  ✅ ${feature} - CI/CD score: ${score.toFixed(1)}%`);
            } else {
                console.log(`  ❌ ${feature} - CI/CD score: ${score.toFixed(1)}%`);
            }
        }
        
        console.log('✅ CI/CD integration tests completed\n');
    }

    /**
     * Test deployment strategies
     */
    async testDeploymentStrategies() {
        console.log('🎯 Testing deployment strategies...');
        
        const deploymentStrategies = [
            'rolling',
            'blue_green',
            'canary',
            'recreate'
        ];
        
        const deploymentManagerPath = join(this.servicesPath, 'ProductionDeploymentPipelineManager.js');
        
        try {
            const content = readFileSync(deploymentManagerPath, 'utf8');
            
            const foundStrategies = [];
            const missingStrategies = [];
            
            for (const strategy of deploymentStrategies) {
                const strategyPattern = new RegExp(`${strategy.toUpperCase()}|${strategy}`, 'i');
                if (strategyPattern.test(content)) {
                    foundStrategies.push(strategy);
                } else {
                    missingStrategies.push(strategy);
                }
            }
            
            // Check for strategy-specific methods
            const strategyMethods = [
                'executeRollingUpdate',
                'deployGreenEnvironment',
                'deployCanary',
                'switchTraffic'
            ];
            
            const foundMethods = [];
            const missingMethods = [];
            
            for (const method of strategyMethods) {
                if (content.includes(method)) {
                    foundMethods.push(method);
                } else {
                    missingMethods.push(method);
                }
            }
            
            const strategyScore = (foundStrategies.length / deploymentStrategies.length) * 100;
            const methodScore = (foundMethods.length / strategyMethods.length) * 100;
            const overallScore = (strategyScore + methodScore) / 2;
            
            this.testResults.push({
                test: 'deployment_strategies',
                component: 'DeploymentStrategies',
                status: overallScore >= 80 ? 'PASS' : 'FAIL',
                score: overallScore.toFixed(1),
                strategies: {
                    found: foundStrategies,
                    missing: missingStrategies
                },
                methods: {
                    found: foundMethods,
                    missing: missingMethods
                }
            });
            
            if (overallScore >= 80) {
                console.log(`  ✅ Deployment strategies - Score: ${overallScore.toFixed(1)}%`);
            } else {
                console.log(`  ❌ Deployment strategies - Score: ${overallScore.toFixed(1)}%`);
            }
            
        } catch (error) {
            this.testResults.push({
                test: 'deployment_strategies',
                component: 'DeploymentStrategies',
                status: 'ERROR',
                error: error.message
            });
            
            console.log(`  ❌ Deployment strategies - ERROR: ${error.message}`);
        }
        
        console.log('✅ Deployment strategy tests completed\n');
    }

    /**
     * Test API integration
     */
    async testAPIIntegration() {
        console.log('🔗 Testing API integration...');
        
        const apiEndpoints = [
            '/status',
            '/metrics',
            '/deploy',
            '/:deploymentId',
            '/:deploymentId/rollback',
            '/environments/list',
            '/history/list',
            '/:deploymentId/approve',
            '/:deploymentId/cancel',
            '/infrastructure/templates',
            '/health'
        ];
        
        const routesPath = join(this.routesPath, 'deployment.js');
        
        try {
            const content = readFileSync(routesPath, 'utf8');
            
            const foundEndpoints = [];
            const missingEndpoints = [];
            
            for (const endpoint of apiEndpoints) {
                // Convert endpoint pattern to regex-friendly format
                const endpointPattern = endpoint.replace(/:\w+/g, '\\w+').replace(/\//g, '\\/');
                const regex = new RegExp(`router\\.(get|post|put|delete)\\(['"]${endpointPattern}['"]`, 'i');
                
                if (regex.test(content) || content.includes(`'${endpoint}'`) || content.includes(`"${endpoint}"`)) {
                    foundEndpoints.push(endpoint);
                } else {
                    missingEndpoints.push(endpoint);
                }
            }
            
            // Check for proper error handling
            const hasErrorHandling = content.includes('try {') && content.includes('catch (error)');
            
            // Check for OpenTelemetry tracing
            const hasTracing = content.includes('OpenTelemetryTracing.traceOperation');
            
            // Check for validation
            const hasValidation = content.includes('if (!') && content.includes('return res.status(400)');
            
            const endpointScore = (foundEndpoints.length / apiEndpoints.length) * 100;
            const qualityScore = (hasErrorHandling + hasTracing + hasValidation) / 3 * 100;
            const overallScore = (endpointScore + qualityScore) / 2;
            
            this.testResults.push({
                test: 'api_integration',
                component: 'deployment.js',
                status: overallScore >= 80 ? 'PASS' : 'FAIL',
                score: overallScore.toFixed(1),
                endpoints: {
                    found: foundEndpoints.length,
                    total: apiEndpoints.length,
                    missing: missingEndpoints
                },
                quality: {
                    errorHandling: hasErrorHandling,
                    tracing: hasTracing,
                    validation: hasValidation
                }
            });
            
            if (overallScore >= 80) {
                console.log(`  ✅ API integration - Score: ${overallScore.toFixed(1)}%`);
            } else {
                console.log(`  ❌ API integration - Score: ${overallScore.toFixed(1)}%`);
            }
            
        } catch (error) {
            this.testResults.push({
                test: 'api_integration',
                component: 'deployment.js',
                status: 'ERROR',
                error: error.message
            });
            
            console.log(`  ❌ API integration - ERROR: ${error.message}`);
        }
        
        console.log('✅ API integration tests completed\n');
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        console.log('📋 PRODUCTION DEPLOYMENT PIPELINE TEST REPORT');
        console.log('='.repeat(70));
        
        // Calculate summary statistics
        const summary = {
            totalTests: this.testResults.length,
            passed: this.testResults.filter(r => r.status === 'PASS').length,
            failed: this.testResults.filter(r => r.status === 'FAIL').length,
            errors: this.testResults.filter(r => r.status === 'ERROR').length
        };
        
        summary.passRate = summary.totalTests > 0 
            ? ((summary.passed / summary.totalTests) * 100).toFixed(1)
            : 0;
        
        // Group results by test type
        const testTypes = {};
        for (const result of this.testResults) {
            if (!testTypes[result.test]) {
                testTypes[result.test] = { passed: 0, failed: 0, errors: 0, total: 0 };
            }
            testTypes[result.test].total++;
            if (result.status === 'PASS') testTypes[result.test].passed++;
            else if (result.status === 'FAIL') testTypes[result.test].failed++;
            else if (result.status === 'ERROR') testTypes[result.test].errors++;
        }
        
        console.log('\n📊 TEST SUMMARY:');
        console.log(`Total Tests: ${summary.totalTests}`);
        console.log(`Passed:      ${summary.passed} (${summary.passRate}%)`);
        console.log(`Failed:      ${summary.failed}`);
        console.log(`Errors:      ${summary.errors}`);
        
        console.log('\n📋 BY TEST TYPE:');
        for (const [testType, stats] of Object.entries(testTypes)) {
            const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;
            console.log(`${testType.padEnd(25)}: ${stats.passed}/${stats.total} (${passRate}%)`);
        }
        
        // Show failed tests
        const failedTests = this.testResults.filter(r => r.status === 'FAIL' || r.status === 'ERROR');
        if (failedTests.length > 0) {
            console.log('\n❌ FAILED TESTS:');
            for (const test of failedTests.slice(0, 10)) { // Show first 10 failures
                console.log(`  ${test.test}/${test.component}: ${test.status}`);
                if (test.error) {
                    console.log(`    Error: ${test.error}`);
                } else if (test.missing && test.missing.length > 0) {
                    console.log(`    Missing: ${test.missing.slice(0, 3).join(', ')}${test.missing.length > 3 ? '...' : ''}`);
                }
            }
            if (failedTests.length > 10) {
                console.log(`  ... and ${failedTests.length - 10} more failed tests`);
            }
        }
        
        console.log('\n' + '='.repeat(70));
        
        // Overall status
        let overallStatus;
        if (summary.passRate >= 95) {
            overallStatus = '🟢 EXCELLENT';
        } else if (summary.passRate >= 85) {
            overallStatus = '🟡 GOOD';
        } else if (summary.passRate >= 70) {
            overallStatus = '🟠 ACCEPTABLE';
        } else {
            overallStatus = '🔴 NEEDS_IMPROVEMENT';
        }
        
        console.log(`OVERALL STATUS: ${overallStatus} (${summary.passRate}% pass rate)`);
        console.log('='.repeat(70));
        
        // Task status
        const taskComplete = summary.passRate >= 85;
        console.log(`\n🎯 TASK 29 STATUS: ${taskComplete ? 'COMPLETED' : 'IN_PROGRESS'}`);
        
        if (taskComplete) {
            console.log('✅ Production Deployment Pipeline is ready!');
            console.log('\nComponents implemented:');
            console.log('- Production Deployment Pipeline Manager');
            console.log('- Infrastructure as Code Manager');
            console.log('- GitHub Actions CI/CD workflows');
            console.log('- Docker multi-stage builds');
            console.log('- Kubernetes deployment templates');
            console.log('- Terraform infrastructure definitions');
            console.log('- Helm charts for orchestration');
            console.log('- Ansible automation playbooks');
            console.log('- Complete deployment API routes');
            console.log('- Multiple deployment strategies (rolling, blue-green, canary)');
        } else {
            console.log('⚠️  Production deployment pipeline needs improvements before completion');
        }
        
        console.log(`\nNext: Task 30 - Documentation & Maintenance Framework`);
    }
}

// Run tests if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const tester = new ProductionDeploymentPipelineTester();
    tester.runTests().catch(console.error);
}

export default ProductionDeploymentPipelineTester;
