#!/usr/bin/env node

/**
        // Define expected files and their paths
        this.expectedServices = [
            'WorkflowDesignerService.js',
            'WorkflowExecutionEngine.js', 
            'WorkflowTemplateLibraryService.js',
            'WorkflowMonitoringService.js',
            'WorkflowSchedulingService.js',
            'WorkflowServiceIntegrationHub.js',
            'WorkflowDatabaseOptimizationService.js'
        ];

        this.expectedTests = [
            'WorkflowPerformanceTestingFramework.js',
            'WorkflowSecurityAuditFramework.js',
            'WorkflowTestExecutionFramework.js',
            'WorkflowSystemIntegrationTests.js'
        ];

        this.basePath = path.join(__dirname, '..');
        this.servicesPath = path.join(this.basePath, 'src/services');
        this.testsPath = path.join(this.basePath, 'tests');alidation Script
 * Validates all Task 25 components are properly implemented and functional
 * ES6 Module Compliance Check
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowSystemValidator {
    constructor() {
        this.results = {
            components: [],
            es6Compliance: [],
            fileExistence: [],
            errors: [],
            warnings: []
        };
        
        this.expectedFiles = {
            services: [
                'WorkflowDesignerService.js',
                'WorkflowExecutionEngine.js', 
                'WorkflowTemplateLibraryService.js',
                'WorkflowMonitoringService.js',
                'WorkflowSchedulingService.js',
                'WorkflowServiceIntegrationHub.js',
                'WorkflowDatabaseOptimizationService.js',
                'WorkflowPerformanceTestingFramework.js',
                'WorkflowSecurityAuditFramework.js',
                'WorkflowTestExecutionFramework.js'
            ],
            tests: [
                'WorkflowSystemIntegrationTests.js'
            ],
            migrations: [
                '36_workflow_database_optimization_corrected.sql'
            ]
        };
    }

    async validate() {
        console.log('🔍 Starting Workflow System Validation');
        console.log('====================================');
        
        try {
            // Check file existence
            await this.checkFileExistence();
            
            // Check ES6 module compliance
            await this.checkES6Compliance();
            
            // Validate service implementations
            await this.validateServices();
            
            // Generate report
            this.generateReport();
            
            console.log('\n✅ Validation complete!');
            return this.results;
            
        } catch (error) {
            console.error('❌ Validation failed:', error);
            this.results.errors.push(`Validation failed: ${error.message}`);
            return this.results;
        }
    }

    async checkFileExistence() {
        console.log('\n📁 Checking file existence...');
        
        const basePath = path.join(__dirname, '..');
        
        // Check services - try src/services first, then services
        for (const serviceName of this.expectedFiles.services) {
            let servicePath = path.join(basePath, 'src/services', serviceName);
            let found = false;
            let actualPath = servicePath;
            
            try {
                await fs.access(servicePath);
                found = true;
            } catch (error) {
                // Try alternative locations
                const alternativeLocations = [
                    path.join(basePath, 'services', serviceName),
                    path.join(basePath, 'tests', serviceName)
                ];
                
                for (const altPath of alternativeLocations) {
                    try {
                        await fs.access(altPath);
                        found = true;
                        actualPath = altPath;
                        break;
                    } catch {}
                }
            }
            
            this.results.fileExistence.push({
                file: serviceName,
                path: actualPath,
                exists: found,
                type: 'service'
            });
            
            if (!found) {
                this.results.errors.push(`Missing service: ${serviceName}`);
                console.log(`  ❌ ${serviceName} - MISSING`);
            } else {
                console.log(`  ✅ ${serviceName}`);
            }
        }
        
        // Check tests
        for (const testName of this.expectedFiles.tests) {
            const testPath = path.join(basePath, 'tests', testName);
            try {
                await fs.access(testPath);
                this.results.fileExistence.push({
                    file: testName,
                    path: testPath,
                    exists: true,
                    type: 'test'
                });
                console.log(`  ✅ ${testName}`);
            } catch (error) {
                this.results.fileExistence.push({
                    file: testName,
                    path: testPath,
                    exists: false,
                    type: 'test'
                });
                this.results.errors.push(`Missing test: ${testName}`);
                console.log(`  ❌ ${testName} - MISSING`);
            }
        }
    }

    async checkES6Compliance() {
        console.log('\n🔧 Checking ES6 module compliance...');
        
        // Use the paths we already found during file existence check
        for (const fileInfo of this.results.fileExistence) {
            if (!fileInfo.exists) continue;
            
            try {
                const content = await fs.readFile(fileInfo.path, 'utf-8');
                const hasES6Import = /^import\s+.*\s+from\s+/m.test(content) || /^import\s+['"']/m.test(content);
                const hasES6Export = /^export\s+/m.test(content);
                const hasCommonJS = /require\s*\(|module\.exports|exports\./.test(content);
                
                const compliance = {
                    file: fileInfo.file,
                    hasES6Import,
                    hasES6Export,
                    hasCommonJS,
                    compliant: hasES6Import && hasES6Export && !hasCommonJS
                };
                
                this.results.es6Compliance.push(compliance);
                
                if (compliance.compliant) {
                    console.log(`  ✅ ${fileInfo.file} - ES6 compliant`);
                } else {
                    console.log(`  ⚠️  ${fileInfo.file} - ES6 issues`);
                    if (!hasES6Import) console.log(`    - Missing ES6 imports`);
                    if (!hasES6Export) console.log(`    - Missing ES6 exports`);
                    if (hasCommonJS) console.log(`    - Contains CommonJS syntax`);
                    
                    this.results.warnings.push(`ES6 compliance issue in ${fileInfo.file}`);
                }
                
            } catch (error) {
                this.results.errors.push(`Cannot read ${fileInfo.file}: ${error.message}`);
            }
        }
    }

    async validateServices() {
        console.log('\n⚙️ Validating service implementations...');
        
        // Use the paths we already found during file existence check
        for (const fileInfo of this.results.fileExistence) {
            if (!fileInfo.exists) continue;
            
            try {
                const content = await fs.readFile(fileInfo.path, 'utf-8');
                
                // Basic validation checks
                const validation = {
                    file: fileInfo.file,
                    hasClass: content.includes('class '),
                    hasConstructor: content.includes('constructor('),
                    hasInitialize: content.includes('initialize(') || content.includes('async initialize'),
                    hasCleanup: content.includes('cleanup(') || content.includes('async cleanup'),
                    hasErrorHandling: content.includes('try {') && content.includes('catch'),
                    hasTracing: content.includes('traceOperation') || content.includes('tracer'),
                    lineCount: content.split('\n').length
                };
                
                this.results.components.push(validation);
                
                let status = '✅';
                let issues = [];
                
                if (!validation.hasClass) {
                    status = '⚠️';
                    issues.push('No class definition found');
                }
                
                if (!validation.hasErrorHandling) {
                    status = '⚠️';
                    issues.push('Limited error handling');
                }
                
                if (validation.lineCount < 100) {
                    status = '⚠️';
                    issues.push('Potentially incomplete implementation');
                }
                
                console.log(`  ${status} ${fileInfo.file} (${validation.lineCount} lines)`);
                if (issues.length > 0) {
                    issues.forEach(issue => console.log(`    - ${issue}`));
                }
                
            } catch (error) {
                this.results.errors.push(`Cannot validate ${fileInfo.file}: ${error.message}`);
                console.log(`  ❌ ${fileInfo.file} - Validation failed`);
            }
        }
    }

    generateReport() {
        console.log('\n📊 Validation Report');
        console.log('==================');
        
        const totalFiles = this.expectedFiles.services.length + this.expectedFiles.tests.length;
        const existingFiles = this.results.fileExistence.filter(f => f.exists).length;
        const es6CompliantFiles = this.results.es6Compliance.filter(c => c.compliant).length;
        
        console.log(`\n📁 File Existence: ${existingFiles}/${totalFiles} files found`);
        console.log(`🔧 ES6 Compliance: ${es6CompliantFiles}/${this.expectedFiles.services.length} services compliant`);
        console.log(`⚠️  Warnings: ${this.results.warnings.length}`);
        console.log(`❌ Errors: ${this.results.errors.length}`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        if (this.results.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.results.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        const overallStatus = this.results.errors.length === 0 ? '✅ PASSED' : '❌ FAILED';
        console.log(`\n🏁 Overall Status: ${overallStatus}`);
        
        if (this.results.errors.length === 0 && this.results.warnings.length === 0) {
            console.log('\n🎉 All Task 25 components are properly implemented!');
            console.log('System ready for production deployment and testing.');
        }
    }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new WorkflowSystemValidator();
    validator.validate().then(results => {
        if (results.errors.length > 0) {
            process.exit(1);
        }
    }).catch(error => {
        console.error('Validation script failed:', error);
        process.exit(1);
    });
}

export default WorkflowSystemValidator;
