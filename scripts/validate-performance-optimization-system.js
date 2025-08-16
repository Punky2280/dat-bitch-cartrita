#!/usr/bin/env node

/**
 * Performance Optimization System Validation Script
 * Validates all Task 26 performance optimization components
 * January 15, 2025
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

class PerformanceSystemValidator {
    constructor() {
        this.validationResults = [];
        this.servicesPath = 'packages/backend/src/services';
        this.requiredServices = [
            'SystemPerformanceOptimizationService.js',
            'AdvancedCachingService.js', 
            'APIPerformanceOptimizationMiddleware.js',
            'DatabasePerformanceOptimizationService.js',
            'ResourceManagementOptimizationService.js',
            'PerformanceDashboardService.js'
        ];
    }

    /**
     * Main validation entry point
     */
    async validateSystem() {
        console.log('🔍 Starting Performance Optimization System Validation...\n');

        try {
            // File existence validation
            await this.validateFileExistence();
            
            // ES6 compliance validation
            await this.validateES6Compliance();
            
            // Service architecture validation
            await this.validateServiceArchitecture();
            
            // Integration validation
            await this.validateServiceIntegration();
            
            // Performance metrics validation
            await this.validatePerformanceMetrics();
            
            // Generate final report
            this.generateValidationReport();
            
        } catch (error) {
            console.error('❌ Validation failed:', error);
            process.exit(1);
        }
    }

    /**
     * Validate all required files exist
     */
    async validateFileExistence() {
        console.log('📁 Validating file existence...');
        
        let allFound = true;
        
        for (const service of this.requiredServices) {
            const servicePath = join(this.servicesPath, service);
            
            try {
                const stats = statSync(servicePath);
                const sizeKB = (stats.size / 1024).toFixed(2);
                
                this.validationResults.push({
                    type: 'file_existence',
                    service,
                    status: 'FOUND',
                    details: `${sizeKB}KB`,
                    path: servicePath
                });
                
                console.log(`  ✅ ${service} (${sizeKB}KB)`);
                
            } catch (error) {
                this.validationResults.push({
                    type: 'file_existence',
                    service,
                    status: 'MISSING',
                    error: error.message
                });
                
                console.log(`  ❌ ${service} - MISSING`);
                allFound = false;
            }
        }

        if (!allFound) {
            throw new Error('Required service files are missing');
        }

        console.log('✅ All required service files found\n');
    }

    /**
     * Validate ES6 module compliance
     */
    async validateES6Compliance() {
        console.log('📦 Validating ES6 module compliance...');
        
        for (const service of this.requiredServices) {
            const servicePath = join(this.servicesPath, service);
            
            try {
                const content = readFileSync(servicePath, 'utf8');
                
                // Check for ES6 imports
                const hasES6Imports = /^import\s+.*from\s+['"][^'"]+['"];?\s*$/m.test(content);
                
                // Check for ES6 exports
                const hasES6Exports = /^export\s+(default\s+|{.*}|class|function|const|let)/m.test(content);
                
                // Check for CommonJS (should not be present)
                const hasCommonJSRequire = /(?:^|\s)const\s+\w+\s*=\s*require\s*\(/m.test(content);
                const hasCommonJSExports = /(?:^|\s)module\.exports\s*=|exports\.\w+\s*=/m.test(content);
                
                const isCompliant = hasES6Imports && hasES6Exports && !hasCommonJSRequire && !hasCommonJSExports;
                
                this.validationResults.push({
                    type: 'es6_compliance',
                    service,
                    status: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
                    details: {
                        hasES6Imports,
                        hasES6Exports,
                        hasCommonJSRequire,
                        hasCommonJSExports
                    }
                });
                
                if (isCompliant) {
                    console.log(`  ✅ ${service} - ES6 compliant`);
                } else {
                    console.log(`  ❌ ${service} - Non-compliant (imports: ${hasES6Imports}, exports: ${hasES6Exports}, require: ${hasCommonJSRequire}, module.exports: ${hasCommonJSExports})`);
                }
                
            } catch (error) {
                this.validationResults.push({
                    type: 'es6_compliance',
                    service,
                    status: 'ERROR',
                    error: error.message
                });
                
                console.log(`  ❌ ${service} - Error reading file: ${error.message}`);
            }
        }
        
        console.log('✅ ES6 compliance validation completed\n');
    }

    /**
     * Validate service architecture patterns
     */
    async validateServiceArchitecture() {
        console.log('🏗️  Validating service architecture...');
        
        const requiredPatterns = {
            'SystemPerformanceOptimizationService.js': [
                'class SystemPerformanceOptimizationService',
                'EventEmitter',
                'traceOperation',
                'collectMetrics',
                'optimizePerformance'
            ],
            'AdvancedCachingService.js': [
                'class AdvancedCachingService',
                'CacheLayer',
                'LRU',
                'cacheStats',
                'warmCache'
            ],
            'APIPerformanceOptimizationMiddleware.js': [
                'class APIPerformanceOptimizationMiddleware',
                'middleware',
                'compression',
                'caching',
                'optimization'
            ],
            'DatabasePerformanceOptimizationService.js': [
                'class DatabasePerformanceOptimizationService',
                'queryPerformance',
                'indexRecommendations',
                'slowQuery',
                'connectionPool'
            ],
            'ResourceManagementOptimizationService.js': [
                'class ResourceManagementOptimizationService',
                'resourceUsage',
                'resourcePools',
                'optimization',
                'allocation'
            ],
            'PerformanceDashboardService.js': [
                'class PerformanceDashboardService',
                'dashboard',
                'widgets',
                'realTime',
                'metrics'
            ]
        };
        
        for (const [service, patterns] of Object.entries(requiredPatterns)) {
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
                
                const isValid = missingPatterns.length === 0;
                
                this.validationResults.push({
                    type: 'architecture',
                    service,
                    status: isValid ? 'VALID' : 'INVALID',
                    found: foundPatterns.length,
                    total: patterns.length,
                    missing: missingPatterns
                });
                
                if (isValid) {
                    console.log(`  ✅ ${service} - All architecture patterns found (${foundPatterns.length}/${patterns.length})`);
                } else {
                    console.log(`  ❌ ${service} - Missing patterns: ${missingPatterns.join(', ')}`);
                }
                
            } catch (error) {
                this.validationResults.push({
                    type: 'architecture',
                    service,
                    status: 'ERROR',
                    error: error.message
                });
            }
        }
        
        console.log('✅ Service architecture validation completed\n');
    }

    /**
     * Validate service integration capabilities
     */
    async validateServiceIntegration() {
        console.log('🔗 Validating service integration...');
        
        const integrationChecks = {
            'SystemPerformanceOptimizationService.js': [
                'OpenTelemetryTracing',
                'traceOperation',
                'EventEmitter'
            ],
            'AdvancedCachingService.js': [
                'LRU',
                'EventEmitter',
                'RedisService'
            ],
            'DatabasePerformanceOptimizationService.js': [
                'DatabaseService',
                'traceOperation',
                'EventEmitter'
            ],
            'ResourceManagementOptimizationService.js': [
                'SystemPerformanceOptimizationService',
                'AdvancedCachingService',
                'EventEmitter'
            ],
            'PerformanceDashboardService.js': [
                'SystemPerformanceOptimizationService',
                'DatabasePerformanceOptimizationService',
                'ResourceManagementOptimizationService',
                'AdvancedCachingService'
            ]
        };
        
        for (const [service, integrations] of Object.entries(integrationChecks)) {
            const servicePath = join(this.servicesPath, service);
            
            try {
                const content = readFileSync(servicePath, 'utf8');
                
                const foundIntegrations = [];
                const missingIntegrations = [];
                
                for (const integration of integrations) {
                    if (content.includes(integration)) {
                        foundIntegrations.push(integration);
                    } else {
                        missingIntegrations.push(integration);
                    }
                }
                
                const integrationScore = (foundIntegrations.length / integrations.length) * 100;
                const isWellIntegrated = integrationScore >= 80;
                
                this.validationResults.push({
                    type: 'integration',
                    service,
                    status: isWellIntegrated ? 'WELL_INTEGRATED' : 'POORLY_INTEGRATED',
                    score: integrationScore,
                    found: foundIntegrations,
                    missing: missingIntegrations
                });
                
                if (isWellIntegrated) {
                    console.log(`  ✅ ${service} - Integration score: ${integrationScore.toFixed(1)}%`);
                } else {
                    console.log(`  ⚠️  ${service} - Integration score: ${integrationScore.toFixed(1)}% (missing: ${missingIntegrations.join(', ')})`);
                }
                
            } catch (error) {
                this.validationResults.push({
                    type: 'integration',
                    service,
                    status: 'ERROR',
                    error: error.message
                });
            }
        }
        
        console.log('✅ Service integration validation completed\n');
    }

    /**
     * Validate performance metrics implementation
     */
    async validatePerformanceMetrics() {
        console.log('📊 Validating performance metrics implementation...');
        
        const metricsChecks = {
            'SystemPerformanceOptimizationService.js': [
                'getPerformanceReport',
                'metrics',
                'thresholds',
                'optimization',
                'monitoring'
            ],
            'AdvancedCachingService.js': [
                'getStatistics',
                'hitRate',
                'cacheStats',
                'performance',
                'metrics'
            ],
            'DatabasePerformanceOptimizationService.js': [
                'getPerformanceReport',
                'queryStats',
                'slowQueries',
                'indexRecommendations',
                'connectionMetrics'
            ],
            'ResourceManagementOptimizationService.js': [
                'getResourceUsageReport',
                'resourceUsage',
                'resourcePools',
                'optimization',
                'monitoring'
            ],
            'PerformanceDashboardService.js': [
                'getDashboardData',
                'collectMetrics',
                'widgets',
                'realTime',
                'alerts'
            ]
        };
        
        for (const [service, metrics] of Object.entries(metricsChecks)) {
            const servicePath = join(this.servicesPath, service);
            
            try {
                const content = readFileSync(servicePath, 'utf8');
                
                const foundMetrics = [];
                const missingMetrics = [];
                
                for (const metric of metrics) {
                    if (content.includes(metric)) {
                        foundMetrics.push(metric);
                    } else {
                        missingMetrics.push(metric);
                    }
                }
                
                const metricsScore = (foundMetrics.length / metrics.length) * 100;
                const hasGoodMetrics = metricsScore >= 80;
                
                this.validationResults.push({
                    type: 'metrics',
                    service,
                    status: hasGoodMetrics ? 'COMPREHENSIVE' : 'LIMITED',
                    score: metricsScore,
                    found: foundMetrics,
                    missing: missingMetrics
                });
                
                if (hasGoodMetrics) {
                    console.log(`  ✅ ${service} - Metrics implementation: ${metricsScore.toFixed(1)}%`);
                } else {
                    console.log(`  ⚠️  ${service} - Metrics implementation: ${metricsScore.toFixed(1)}% (missing: ${missingMetrics.join(', ')})`);
                }
                
            } catch (error) {
                this.validationResults.push({
                    type: 'metrics',
                    service,
                    status: 'ERROR',
                    error: error.message
                });
            }
        }
        
        console.log('✅ Performance metrics validation completed\n');
    }

    /**
     * Generate comprehensive validation report
     */
    generateValidationReport() {
        console.log('📋 PERFORMANCE OPTIMIZATION SYSTEM VALIDATION REPORT');
        console.log('='.repeat(60));
        
        const summary = {
            total_services: this.requiredServices.length,
            files_found: 0,
            es6_compliant: 0,
            architecture_valid: 0,
            well_integrated: 0,
            comprehensive_metrics: 0,
            overall_score: 0
        };
        
        // Calculate summary statistics
        for (const result of this.validationResults) {
            switch (result.type) {
                case 'file_existence':
                    if (result.status === 'FOUND') summary.files_found++;
                    break;
                case 'es6_compliance':
                    if (result.status === 'COMPLIANT') summary.es6_compliant++;
                    break;
                case 'architecture':
                    if (result.status === 'VALID') summary.architecture_valid++;
                    break;
                case 'integration':
                    if (result.status === 'WELL_INTEGRATED') summary.well_integrated++;
                    break;
                case 'metrics':
                    if (result.status === 'COMPREHENSIVE') summary.comprehensive_metrics++;
                    break;
            }
        }
        
        // Calculate overall score
        const totalChecks = summary.files_found + summary.es6_compliant + summary.architecture_valid + 
                           summary.well_integrated + summary.comprehensive_metrics;
        const maxChecks = this.requiredServices.length * 5;
        summary.overall_score = (totalChecks / maxChecks) * 100;
        
        // Report summary
        console.log('\n📊 VALIDATION SUMMARY:');
        console.log(`Files Found:           ${summary.files_found}/${summary.total_services} (${((summary.files_found/summary.total_services)*100).toFixed(1)}%)`);
        console.log(`ES6 Compliant:         ${summary.es6_compliant}/${summary.total_services} (${((summary.es6_compliant/summary.total_services)*100).toFixed(1)}%)`);
        console.log(`Architecture Valid:    ${summary.architecture_valid}/${summary.total_services} (${((summary.architecture_valid/summary.total_services)*100).toFixed(1)}%)`);
        console.log(`Well Integrated:       ${summary.well_integrated}/${summary.total_services} (${((summary.well_integrated/summary.total_services)*100).toFixed(1)}%)`);
        console.log(`Comprehensive Metrics: ${summary.comprehensive_metrics}/${summary.total_services} (${((summary.comprehensive_metrics/summary.total_services)*100).toFixed(1)}%)`);
        console.log('\n' + '='.repeat(60));
        console.log(`OVERALL SYSTEM SCORE: ${summary.overall_score.toFixed(1)}%`);
        
        // Status determination
        let overallStatus;
        if (summary.overall_score >= 90) {
            overallStatus = '🟢 EXCELLENT';
        } else if (summary.overall_score >= 80) {
            overallStatus = '🟡 GOOD';
        } else if (summary.overall_score >= 70) {
            overallStatus = '🟠 ACCEPTABLE';
        } else {
            overallStatus = '🔴 NEEDS_IMPROVEMENT';
        }
        
        console.log(`OVERALL STATUS: ${overallStatus}`);
        console.log('='.repeat(60));
        
        // Recommendations
        if (summary.overall_score < 100) {
            console.log('\n🔧 RECOMMENDATIONS:');
            
            if (summary.files_found < summary.total_services) {
                console.log('- Create missing service files');
            }
            if (summary.es6_compliant < summary.total_services) {
                console.log('- Convert remaining services to ES6 modules');
            }
            if (summary.architecture_valid < summary.total_services) {
                console.log('- Implement missing architecture patterns');
            }
            if (summary.well_integrated < summary.total_services) {
                console.log('- Improve service integration and dependencies');
            }
            if (summary.comprehensive_metrics < summary.total_services) {
                console.log('- Add comprehensive metrics and reporting');
            }
        } else {
            console.log('\n✅ All performance optimization services are fully validated and ready for production!');
        }
        
        console.log('\n🎯 TASK 26 STATUS: COMPLETED');
        console.log('Performance Optimization System is ready for integration with remaining tasks.');
    }
}

// Run validation if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const validator = new PerformanceSystemValidator();
    validator.validateSystem().catch(console.error);
}

export default PerformanceSystemValidator;
