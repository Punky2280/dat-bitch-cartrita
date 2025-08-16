/**
 * Compliance Monitoring Routes
 * REST API endpoints for automated compliance monitoring and reporting
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import AutomatedComplianceEngine from '../services/AutomatedComplianceEngine.js';

const router = express.Router();

// Initialize compliance engine
const complianceEngine = new AutomatedComplianceEngine({
    enabledStandards: ['SOC2', 'ISO27001', 'GDPR', 'HIPAA'],
    continuousMonitoring: true,
    checkInterval: 3600000, // 1 hour
    generateReports: true,
    autoRemediation: true
});

// Middleware to ensure compliance engine is ready
const ensureComplianceReady = (req, res, next) => {
    if (!complianceEngine) {
        return res.status(503).json({
            success: false,
            error: 'Compliance engine not available'
        });
    }
    next();
};

/**
 * Get compliance overview and status
 */
router.get('/overview', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.overview');
    
    try {
        // Perform quick compliance check
        const results = await complianceEngine.performComplianceCheck();
        
        // Calculate overview metrics
        const overview = {
            timestamp: new Date().toISOString(),
            enabled_standards: complianceEngine.options.enabledStandards,
            total_standards: results.size,
            overall_status: 'unknown',
            compliance_scores: {},
            total_violations: 0,
            critical_violations: 0,
            last_check: new Date().toISOString(),
            next_check: new Date(Date.now() + complianceEngine.options.checkInterval).toISOString()
        };

        let totalScore = 0;
        for (const [standard, standardResult] of results) {
            overview.compliance_scores[standard] = {
                score: Math.round(standardResult.overall_score * 100),
                status: standardResult.overall_score >= 0.9 ? 'compliant' : 
                       standardResult.overall_score >= 0.7 ? 'mostly_compliant' : 'non_compliant',
                violations: standardResult.violations.length,
                categories: standardResult.categories.size
            };
            
            totalScore += standardResult.overall_score;
            overview.total_violations += standardResult.violations.length;
            overview.critical_violations += standardResult.violations.filter(v => v.risk_level === 'critical').length;
        }

        const averageScore = results.size > 0 ? totalScore / results.size : 0;
        overview.overall_status = averageScore >= 0.9 ? 'compliant' : 
                                 averageScore >= 0.7 ? 'mostly_compliant' : 'non_compliant';
        overview.overall_score = Math.round(averageScore * 100);

        span.setAttributes({
            'compliance.overview.total_standards': overview.total_standards,
            'compliance.overview.overall_score': overview.overall_score,
            'compliance.overview.total_violations': overview.total_violations
        });

        res.json({
            success: true,
            data: overview
        });

    } catch (error) {
        console.error('[Compliance] Overview error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to get compliance overview',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Get detailed compliance check results for specific standard
 */
router.get('/check/:standard', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.check_standard');
    
    try {
        const { standard } = req.params;
        
        if (!complianceEngine.options.enabledStandards.includes(standard)) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported compliance standard',
                available_standards: complianceEngine.options.enabledStandards
            });
        }

        const results = await complianceEngine.performComplianceCheck(standard);
        const standardResult = results.get(standard);

        if (!standardResult) {
            return res.status(404).json({
                success: false,
                error: 'Standard results not found'
            });
        }

        span.setAttributes({
            'compliance.check.standard': standard,
            'compliance.check.score': standardResult.overall_score,
            'compliance.check.violations': standardResult.violations.length
        });

        res.json({
            success: true,
            data: {
                standard,
                ...standardResult,
                categories: Object.fromEntries(standardResult.categories)
            }
        });

    } catch (error) {
        console.error('[Compliance] Standard check error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to check compliance standard',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Get all compliance violations with filtering
 */
router.get('/violations', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.violations');
    
    try {
        const { 
            standard, 
            risk_level, 
            category,
            limit = 50,
            offset = 0 
        } = req.query;

        const results = await complianceEngine.performComplianceCheck(standard);
        let allViolations = [];

        // Collect all violations
        for (const [std, standardResult] of results) {
            for (const violation of standardResult.violations) {
                allViolations.push({
                    standard: std,
                    framework: standardResult.framework,
                    ...violation,
                    timestamp: standardResult.timestamp
                });
            }
        }

        // Apply filters
        if (risk_level) {
            allViolations = allViolations.filter(v => v.risk_level === risk_level);
        }
        if (category) {
            allViolations = allViolations.filter(v => v.category === category);
        }

        // Sort by risk level and timestamp
        allViolations.sort((a, b) => {
            const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const riskDiff = riskOrder[a.risk_level] - riskOrder[b.risk_level];
            if (riskDiff !== 0) return riskDiff;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        // Paginate results
        const paginatedViolations = allViolations.slice(offset, offset + limit);
        
        span.setAttributes({
            'compliance.violations.total': allViolations.length,
            'compliance.violations.returned': paginatedViolations.length,
            'compliance.violations.filters_applied': !!(risk_level || category)
        });

        res.json({
            success: true,
            data: {
                violations: paginatedViolations,
                total: allViolations.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
                filters: { standard, risk_level, category }
            }
        });

    } catch (error) {
        console.error('[Compliance] Violations retrieval error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve compliance violations',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Get compliance recommendations
 */
router.get('/recommendations', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.recommendations');
    
    try {
        const { standard, priority } = req.query;

        const results = await complianceEngine.performComplianceCheck(standard);
        let allRecommendations = [];

        // Collect recommendations from all standards
        for (const [std, standardResult] of results) {
            for (const recommendation of standardResult.recommendations) {
                allRecommendations.push({
                    standard: std,
                    ...recommendation
                });
            }
        }

        // Filter by priority if specified
        if (priority) {
            allRecommendations = allRecommendations.filter(r => r.priority === priority);
        }

        // Sort by priority
        allRecommendations.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        span.setAttributes({
            'compliance.recommendations.total': allRecommendations.length,
            'compliance.recommendations.priority_filter': priority || 'none'
        });

        res.json({
            success: true,
            data: {
                recommendations: allRecommendations,
                total: allRecommendations.length,
                priority_counts: {
                    critical: allRecommendations.filter(r => r.priority === 'critical').length,
                    high: allRecommendations.filter(r => r.priority === 'high').length,
                    medium: allRecommendations.filter(r => r.priority === 'medium').length,
                    low: allRecommendations.filter(r => r.priority === 'low').length
                }
            }
        });

    } catch (error) {
        console.error('[Compliance] Recommendations retrieval error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve compliance recommendations',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Generate compliance report
 */
router.post('/reports/generate', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.generate_report');
    
    try {
        const { standard, format = 'json' } = req.body;

        if (format && !['json', 'html', 'pdf'].includes(format)) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported report format',
                supported_formats: ['json', 'html', 'pdf']
            });
        }

        const report = await complianceEngine.generateComplianceReport(standard, format);

        span.setAttributes({
            'compliance.report.format': format,
            'compliance.report.standard': standard || 'all',
            'compliance.report.id': report.id
        });

        res.json({
            success: true,
            data: {
                report_id: report.id,
                generated_at: report.generated_at,
                format,
                standards: report.standards,
                ...(format === 'json' ? { report } : {})
            }
        });

    } catch (error) {
        console.error('[Compliance] Report generation error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate compliance report',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Get list of generated compliance reports
 */
router.get('/reports', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.list_reports');
    
    try {
        const { limit = 20, offset = 0 } = req.query;

        const allReports = Array.from(complianceEngine.complianceReports.values());
        
        // Sort by generation date (newest first)
        allReports.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));

        // Paginate
        const paginatedReports = allReports.slice(offset, offset + limit);

        // Return summary information (not full reports)
        const reportSummaries = paginatedReports.map(report => ({
            id: report.id,
            generated_at: report.generated_at,
            report_type: report.report_type,
            standards: report.standards,
            overall_score: report.executive_summary?.overall_compliance_score,
            total_violations: report.executive_summary?.total_violations,
            compliance_status: report.executive_summary?.compliance_status
        }));

        span.setAttributes({
            'compliance.reports.total': allReports.length,
            'compliance.reports.returned': reportSummaries.length
        });

        res.json({
            success: true,
            data: {
                reports: reportSummaries,
                total: allReports.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('[Compliance] Reports listing error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve compliance reports',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Get specific compliance report
 */
router.get('/reports/:reportId', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.get_report');
    
    try {
        const { reportId } = req.params;

        const report = complianceEngine.complianceReports.get(reportId);
        
        if (!report) {
            return res.status(404).json({
                success: false,
                error: 'Compliance report not found'
            });
        }

        span.setAttributes({
            'compliance.report.id': reportId,
            'compliance.report.standards': report.standards.length
        });

        res.json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('[Compliance] Report retrieval error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve compliance report',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Get available compliance frameworks and standards
 */
router.get('/frameworks', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.frameworks');
    
    try {
        const frameworks = {};
        
        for (const [standardId, framework] of complianceEngine.controlFrameworks) {
            frameworks[standardId] = {
                name: framework.name,
                version: framework.version,
                description: framework.description,
                categories: Object.keys(framework.categories),
                total_controls: Object.values(framework.categories)
                    .reduce((sum, cat) => sum + cat.controls.length, 0),
                enabled: complianceEngine.options.enabledStandards.includes(standardId)
            };
        }

        span.setAttributes({
            'compliance.frameworks.total': Object.keys(frameworks).length,
            'compliance.frameworks.enabled': complianceEngine.options.enabledStandards.length
        });

        res.json({
            success: true,
            data: {
                frameworks,
                enabled_standards: complianceEngine.options.enabledStandards
            }
        });

    } catch (error) {
        console.error('[Compliance] Frameworks retrieval error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve compliance frameworks',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Trigger manual compliance check
 */
router.post('/check', authenticateToken, ensureComplianceReady, async (req, res) => {
    const span = OpenTelemetryTracing.tracer.startSpan('compliance.api.manual_check');
    
    try {
        const { standard, force = false } = req.body;

        if (standard && !complianceEngine.options.enabledStandards.includes(standard)) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported compliance standard',
                available_standards: complianceEngine.options.enabledStandards
            });
        }

        const results = await complianceEngine.performComplianceCheck(standard);
        
        const summary = {
            timestamp: new Date().toISOString(),
            standards_checked: Array.from(results.keys()),
            results: {}
        };

        for (const [std, standardResult] of results) {
            summary.results[std] = {
                score: Math.round(standardResult.overall_score * 100),
                status: standardResult.overall_score >= 0.9 ? 'compliant' : 
                       standardResult.overall_score >= 0.7 ? 'mostly_compliant' : 'non_compliant',
                violations: standardResult.violations.length,
                categories_checked: standardResult.categories.size
            };
        }

        span.setAttributes({
            'compliance.manual_check.standards': summary.standards_checked.length,
            'compliance.manual_check.forced': force
        });

        res.json({
            success: true,
            data: {
                check_initiated: true,
                summary,
                detailed_results_available: true
            }
        });

    } catch (error) {
        console.error('[Compliance] Manual check error:', error);
        span.recordException(error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform manual compliance check',
            details: error.message
        });
    } finally {
        span.end();
    }
});

/**
 * Health check endpoint for compliance service
 */
router.get('/health', (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            compliance_engine: !!complianceEngine,
            enabled_standards: complianceEngine?.options.enabledStandards || [],
            continuous_monitoring: complianceEngine?.options.continuousMonitoring || false,
            check_interval: complianceEngine?.options.checkInterval || 0,
            last_check: 'Not available' // Would be tracked in real implementation
        };

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Compliance service health check failed',
            details: error.message
        });
    }
});

export default router;
