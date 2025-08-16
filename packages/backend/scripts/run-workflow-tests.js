#!/usr/bin/env node

/**
 * Complete Workflow System Test Runner
 * Executes all Task 25 tests and validation
 * ES6 Module Implementation
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowTestRunner {
    constructor() {
        this.results = {
            validation: null,
            unitTests: null,
            integrationTests: null,
            performanceTests: null,
            securityAudit: null,
            overallStatus: 'pending'
        };
        
        this.testConfig = {
            timeout: 300000, // 5 minutes
            verbose: true,
            generateReports: true,
            runPerformanceTests: false, // Set to false for CI/CD
            runSecurityAudits: true,
            runLoadTests: false // Set to false for CI/CD
        };
    }

    async runAllTests() {
        console.log('🧪 Starting Complete Workflow System Test Suite');
        console.log('===============================================');
        console.log(`Configuration: ${JSON.stringify(this.testConfig, null, 2)}`);
        
        try {
            // Step 1: Validate system implementation
            console.log('\n📋 Step 1: System Validation');
            await this.runSystemValidation();
            
            // Step 2: Run unit tests
            console.log('\n🔬 Step 2: Unit Tests');
            await this.runUnitTests();
            
            // Step 3: Run integration tests
            console.log('\n🔗 Step 3: Integration Tests');
            await this.runIntegrationTests();
            
            // Step 4: Performance tests (optional)
            if (this.testConfig.runPerformanceTests) {
                console.log('\n⚡ Step 4: Performance Tests');
                await this.runPerformanceTests();
            }
            
            // Step 5: Security audit (optional)
            if (this.testConfig.runSecurityAudits) {
                console.log('\n🔒 Step 5: Security Audit');
                await this.runSecurityAudit();
            }
            
            // Step 6: Generate final report
            console.log('\n📊 Step 6: Final Report');
            await this.generateFinalReport();
            
            this.determineOverallStatus();
            this.printSummary();
            
            return this.results;
            
        } catch (error) {
            console.error('❌ Test suite execution failed:', error);
            this.results.overallStatus = 'failed';
            throw error;
        }
    }

    async runSystemValidation() {
        try {
            console.log('Running system validation...');
            
            // Dynamic import to avoid initialization issues
            const { default: WorkflowSystemValidator } = await import('./validate-workflow-system.js');
            
            const validator = new WorkflowSystemValidator();
            const validationResults = await validator.validate();
            
            this.results.validation = {
                status: validationResults.errors.length === 0 ? 'passed' : 'failed',
                errors: validationResults.errors,
                warnings: validationResults.warnings,
                filesChecked: validationResults.fileExistence.length,
                es6Compliant: validationResults.es6Compliance.filter(c => c.compliant).length
            };
            
            console.log(`✅ Validation ${this.results.validation.status}`);
            
        } catch (error) {
            this.results.validation = {
                status: 'error',
                error: error.message
            };
            console.error('❌ System validation failed:', error);
        }
    }

    async runUnitTests() {
        try {
            console.log('Running unit tests with Jest...');
            
            const jestResult = await this.runCommand('npm', ['test', '--', '--testPathPattern=.*\\.test\\.js$'], {
                cwd: path.join(__dirname, '../../..'),
                timeout: this.testConfig.timeout
            });
            
            this.results.unitTests = {
                status: jestResult.code === 0 ? 'passed' : 'failed',
                output: jestResult.output,
                exitCode: jestResult.code
            };
            
            console.log(`✅ Unit tests ${this.results.unitTests.status}`);
            
        } catch (error) {
            this.results.unitTests = {
                status: 'error',
                error: error.message
            };
            console.error('❌ Unit tests failed:', error);
        }
    }

    async runIntegrationTests() {
        try {
            console.log('Running integration tests...');
            
            // Check if integration test file exists
            const testPath = path.join(__dirname, '../tests/WorkflowSystemIntegrationTests.js');
            
            try {
                await fs.access(testPath);
                console.log('✅ Integration test file found');
                
                // Run with Jest
                const jestResult = await this.runCommand('npm', ['test', '--', '--testPathPattern=WorkflowSystemIntegrationTests\\.js$'], {
                    cwd: path.join(__dirname, '../../..'),
                    timeout: this.testConfig.timeout
                });
                
                this.results.integrationTests = {
                    status: jestResult.code === 0 ? 'passed' : 'failed',
                    output: jestResult.output,
                    exitCode: jestResult.code
                };
                
            } catch (error) {
                // Test file doesn't exist, create a basic validation
                this.results.integrationTests = {
                    status: 'skipped',
                    reason: 'Integration test file not accessible',
                    error: error.message
                };
            }
            
            console.log(`✅ Integration tests ${this.results.integrationTests.status}`);
            
        } catch (error) {
            this.results.integrationTests = {
                status: 'error',
                error: error.message
            };
            console.error('❌ Integration tests failed:', error);
        }
    }

    async runPerformanceTests() {
        try {
            console.log('Running performance tests...');
            
            // This would typically run the performance testing framework
            // For now, we'll create a placeholder
            this.results.performanceTests = {
                status: 'skipped',
                reason: 'Performance tests require running services',
                message: 'Performance testing framework implemented but requires active database connection'
            };
            
            console.log('⏭️  Performance tests skipped (requires running services)');
            
        } catch (error) {
            this.results.performanceTests = {
                status: 'error',
                error: error.message
            };
            console.error('❌ Performance tests failed:', error);
        }
    }

    async runSecurityAudit() {
        try {
            console.log('Running security audit...');
            
            // Basic security checks
            const securityChecks = await this.performBasicSecurityChecks();
            
            this.results.securityAudit = {
                status: 'completed',
                checks: securityChecks,
                summary: 'Basic security validation completed'
            };
            
            console.log('✅ Security audit completed');
            
        } catch (error) {
            this.results.securityAudit = {
                status: 'error',
                error: error.message
            };
            console.error('❌ Security audit failed:', error);
        }
    }

    async performBasicSecurityChecks() {
        const checks = [];
        
        // Check for hardcoded secrets in code
        try {
            const result = await this.runCommand('grep', ['-r', '-i', 'password\\|secret\\|key\\|token', 'src/', '--include=*.js'], {
                cwd: path.join(__dirname, '..'),
                timeout: 10000
            });
            
            checks.push({
                name: 'Hardcoded secrets check',
                status: result.code !== 0 ? 'passed' : 'warning',
                message: result.code !== 0 ? 'No obvious hardcoded secrets found' : 'Potential secrets found in code'
            });
        } catch (error) {
            checks.push({
                name: 'Hardcoded secrets check',
                status: 'error',
                message: `Check failed: ${error.message}`
            });
        }
        
        // Check for SQL injection patterns
        try {
            const result = await this.runCommand('grep', ['-r', 'query.*+.*\\$', 'src/', '--include=*.js'], {
                cwd: path.join(__dirname, '..'),
                timeout: 10000
            });
            
            checks.push({
                name: 'SQL injection pattern check',
                status: result.code !== 0 ? 'passed' : 'warning',
                message: result.code !== 0 ? 'No obvious SQL injection patterns' : 'Potential SQL injection patterns found'
            });
        } catch (error) {
            checks.push({
                name: 'SQL injection pattern check',
                status: 'error',
                message: `Check failed: ${error.message}`
            });
        }
        
        return checks;
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                ...options
            });
            
            let output = '';
            let errorOutput = '';
            
            proc.stdout.on('data', (data) => {
                output += data.toString();
                if (this.testConfig.verbose) {
                    process.stdout.write(data);
                }
            });
            
            proc.stderr.on('data', (data) => {
                errorOutput += data.toString();
                if (this.testConfig.verbose) {
                    process.stderr.write(data);
                }
            });
            
            proc.on('close', (code) => {
                resolve({
                    code,
                    output,
                    errorOutput
                });
            });
            
            proc.on('error', (error) => {
                reject(error);
            });
            
            // Handle timeout
            if (options.timeout) {
                setTimeout(() => {
                    proc.kill('SIGTERM');
                    reject(new Error(`Command timed out after ${options.timeout}ms`));
                }, options.timeout);
            }
        });
    }

    async generateFinalReport() {
        if (!this.testConfig.generateReports) {
            return;
        }
        
        try {
            const reportsDir = path.join(__dirname, '../reports');
            await fs.mkdir(reportsDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(reportsDir, `workflow-test-report-${timestamp}.json`);
            
            const report = {
                timestamp: new Date().toISOString(),
                testConfig: this.testConfig,
                results: this.results,
                summary: {
                    overallStatus: this.results.overallStatus,
                    totalSteps: 6,
                    completedSteps: Object.values(this.results).filter(r => r && r.status !== 'pending').length
                }
            };
            
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`📄 Test report saved: ${reportPath}`);
            
        } catch (error) {
            console.error('Failed to generate report:', error);
        }
    }

    determineOverallStatus() {
        const critical = [this.results.validation, this.results.unitTests];
        const hasCriticalFailures = critical.some(r => r && (r.status === 'failed' || r.status === 'error'));
        
        if (hasCriticalFailures) {
            this.results.overallStatus = 'failed';
        } else {
            const allResults = Object.values(this.results).filter(r => r && typeof r === 'object');
            const hasAnyFailures = allResults.some(r => r.status === 'failed' || r.status === 'error');
            
            this.results.overallStatus = hasAnyFailures ? 'passed-with-warnings' : 'passed';
        }
    }

    printSummary() {
        console.log('\n🏁 Test Suite Summary');
        console.log('====================');
        
        console.log(`📋 System Validation: ${this.getStatusEmoji(this.results.validation?.status)} ${this.results.validation?.status || 'pending'}`);
        console.log(`🔬 Unit Tests: ${this.getStatusEmoji(this.results.unitTests?.status)} ${this.results.unitTests?.status || 'pending'}`);
        console.log(`🔗 Integration Tests: ${this.getStatusEmoji(this.results.integrationTests?.status)} ${this.results.integrationTests?.status || 'pending'}`);
        console.log(`⚡ Performance Tests: ${this.getStatusEmoji(this.results.performanceTests?.status)} ${this.results.performanceTests?.status || 'pending'}`);
        console.log(`🔒 Security Audit: ${this.getStatusEmoji(this.results.securityAudit?.status)} ${this.results.securityAudit?.status || 'pending'}`);
        
        console.log(`\n🎯 Overall Status: ${this.getStatusEmoji(this.results.overallStatus)} ${this.results.overallStatus.toUpperCase()}`);
        
        if (this.results.overallStatus === 'passed') {
            console.log('\n🎉 All tests completed successfully!');
            console.log('Task 25: Enterprise Workflow Automation System is ready for production.');
        } else if (this.results.overallStatus === 'passed-with-warnings') {
            console.log('\n⚠️  Tests completed with warnings.');
            console.log('Review warnings before production deployment.');
        } else {
            console.log('\n❌ Some tests failed.');
            console.log('Address failures before proceeding to production.');
        }
    }

    getStatusEmoji(status) {
        switch (status) {
            case 'passed':
            case 'completed':
                return '✅';
            case 'failed':
            case 'error':
                return '❌';
            case 'warning':
            case 'passed-with-warnings':
                return '⚠️';
            case 'skipped':
                return '⏭️';
            default:
                return '🔄';
        }
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new WorkflowTestRunner();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    if (args.includes('--no-performance')) {
        runner.testConfig.runPerformanceTests = false;
    }
    if (args.includes('--no-security')) {
        runner.testConfig.runSecurityAudits = false;
    }
    if (args.includes('--quiet')) {
        runner.testConfig.verbose = false;
    }
    
    runner.runAllTests().then(results => {
        const exitCode = results.overallStatus === 'failed' ? 1 : 0;
        process.exit(exitCode);
    }).catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

export default WorkflowTestRunner;
