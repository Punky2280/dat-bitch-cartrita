/**
 * Security Testing API Routes
 * RESTful endpoints for comprehensive security testing suite management
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import express from 'express';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from '../services/SecurityAuditLogger.js';

const router = express.Router();

// Initialize telemetry counter for security testing operations
const securityTestingCounter = OpenTelemetryTracing.createCounter(
    'security_testing_operations_total',
    'Total number of security testing operations'
);

/**
 * Get available security test suites
 * GET /api/security-testing/suites
 */
router.get('/suites', async (req, res) => {
    try {
        const securityTestingSuite = req.app.locals.securityTestingSuite;
        if (!securityTestingSuite?.isInitialized()) {
            return res.status(503).json({
                success: false,
                error: 'Security testing suite not available'
            });
        }

        const suites = securityTestingSuite.getAvailableTestSuites();
        
        securityTestingCounter.add(1, { operation: 'list_suites' });
        
        res.json({
            success: true,
            data: {
                suites,
                activeTestCount: securityTestingSuite.getActiveTestCount()
            }
        });

    } catch (error) {
        console.error('Failed to get security test suites:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve security test suites'
        });
    }
});

/**
 * Run a security test suite
 * POST /api/security-testing/suites/:suiteId/run
 */
router.post('/suites/:suiteId/run', async (req, res) => {
    try {
        const { suiteId } = req.params;
        const options = req.body || {};
        
        const securityTestingSuite = req.app.locals.securityTestingSuite;
        if (!securityTestingSuite?.isInitialized()) {
            return res.status(503).json({
                success: false,
                error: 'Security testing suite not available'
            });
        }

        // Start test suite execution (async)
        const testRunPromise = securityTestingSuite.runTestSuite(suiteId, {
            ...options,
            triggeredBy: req.user?.id || 'api',
            userAgent: req.get('User-Agent'),
            sourceIp: req.ip
        });

        // Get initial test run info
        const testRun = await Promise.race([
            testRunPromise,
            new Promise(resolve => setTimeout(() => resolve(null), 1000)) // 1s timeout for initial response
        ]);

        if (testRun) {
            // Test completed quickly
            securityTestingCounter.add(1, { 
                operation: 'run_suite',
                suite_id: suiteId,
                status: 'completed'
            });
            
            await SecurityAuditLogger.logSecurityEvent('security_test_completed', {
                suiteId,
                testRunId: testRun.id,
                status: testRun.status,
                duration: testRun.duration,
                vulnerabilitiesFound: testRun.vulnerabilities?.length || 0,
                triggeredBy: req.user?.id || 'api'
            });

            res.json({
                success: true,
                data: {
                    testRun,
                    message: 'Security test suite completed'
                }
            });
        } else {
            // Test still running, return test run ID for polling
            const activeTests = securityTestingSuite.getActiveTestCount();
            
            securityTestingCounter.add(1, { 
                operation: 'run_suite',
                suite_id: suiteId,
                status: 'started'
            });

            res.json({
                success: true,
                data: {
                    message: 'Security test suite started',
                    status: 'running',
                    activeTests,
                    pollUrl: `/api/security-testing/runs/status`
                }
            });
        }

    } catch (error) {
        console.error('Failed to run security test suite:', error);
        securityTestingCounter.add(1, { 
            operation: 'run_suite',
            suite_id: req.params.suiteId,
            status: 'error'
        });
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to run security test suite'
        });
    }
});

/**
 * Run an ad-hoc security test
 * POST /api/security-testing/tests/:testId/run
 */
router.post('/tests/:testId/run', async (req, res) => {
    try {
        const { testId } = req.params;
        const options = req.body || {};
        
        const securityTestingSuite = req.app.locals.securityTestingSuite;
        if (!securityTestingSuite?.isInitialized()) {
            return res.status(503).json({
                success: false,
                error: 'Security testing suite not available'
            });
        }

        const testResult = await securityTestingSuite.runAdHocTest(testId, {
            ...options,
            triggeredBy: req.user?.id || 'api'
        });

        securityTestingCounter.add(1, { 
            operation: 'run_adhoc_test',
            test_id: testId,
            status: testResult.status
        });

        res.json({
            success: true,
            data: {
                testResult,
                message: `Ad-hoc test ${testId} completed`
            }
        });

    } catch (error) {
        console.error('Failed to run ad-hoc security test:', error);
        securityTestingCounter.add(1, { 
            operation: 'run_adhoc_test',
            test_id: req.params.testId,
            status: 'error'
        });
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to run security test'
        });
    }
});

/**
 * Get security test run status
 * GET /api/security-testing/runs/:testRunId/status
 */
router.get('/runs/:testRunId/status', async (req, res) => {
    try {
        const { testRunId } = req.params;
        
        const securityTestingSuite = req.app.locals.securityTestingSuite;
        if (!securityTestingSuite?.isInitialized()) {
            return res.status(503).json({
                success: false,
                error: 'Security testing suite not available'
            });
        }

        const testStatus = await securityTestingSuite.getTestRunStatus(testRunId);
        
        if (!testStatus) {
            return res.status(404).json({
                success: false,
                error: 'Test run not found'
            });
        }

        res.json({
            success: true,
            data: {
                testRun: testStatus,
                isActive: testStatus.status === 'running'
            }
        });

    } catch (error) {
        console.error('Failed to get test run status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve test run status'
        });
    }
});

/**
 * Get security test run results
 * GET /api/security-testing/runs/:testRunId/results
 */
router.get('/runs/:testRunId/results', async (req, res) => {
    try {
        const { testRunId } = req.params;
        
        const securityTestingSuite = req.app.locals.securityTestingSuite;
        if (!securityTestingSuite?.isInitialized()) {
            return res.status(503).json({
                success: false,
                error: 'Security testing suite not available'
            });
        }

        const testResults = await securityTestingSuite.getTestRunResults(testRunId);
        
        if (!testResults) {
            return res.status(404).json({
                success: false,
                error: 'Test run results not found'
            });
        }

        res.json({
            success: true,
            data: {
                testRun: testResults,
                report: testResults.report
            }
        });

    } catch (error) {
        console.error('Failed to get test run results:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve test run results'
        });
    }
});

/**
 * Get active test runs status
 * GET /api/security-testing/runs/status
 */
router.get('/runs/status', async (req, res) => {
    try {
        const securityTestingSuite = req.app.locals.securityTestingSuite;
        if (!securityTestingSuite?.isInitialized()) {
            return res.status(503).json({
                success: false,
                error: 'Security testing suite not available'
            });
        }

        const activeTestCount = securityTestingSuite.getActiveTestCount();
        
        // Get recent test runs from database if available
        let recentRuns = [];
        if (req.app.locals.pool) {
            const result = await req.app.locals.pool.query(`
                SELECT id, suite_id, suite_name, status, started_at, 
                       completed_at, duration_ms, vulnerabilities_found
                FROM security_test_runs 
                ORDER BY started_at DESC 
                LIMIT 10
            `);
            recentRuns = result.rows;
        }

        res.json({
            success: true,
            data: {
                activeTestCount,
                recentRuns,
                timestamp: new Date()
            }
        });

    } catch (error) {
        console.error('Failed to get active test status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve active test status'
        });
    }
});

/**
 * Get security testing dashboard metrics
 * GET /api/security-testing/metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        return await OpenTelemetryTracing.traceOperation('security_testing.get_metrics', async (span) => {
            if (!req.app.locals.pool) {
                return res.status(503).json({
                    success: false,
                    error: 'Database not available'
                });
            }

            const { timeframe = '30d' } = req.query;
            
            // Calculate date range based on timeframe
            let startDate;
            switch (timeframe) {
                case '24h':
                    startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                default:
                    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    break;
            }

            const pool = req.app.locals.pool;

            // Get dashboard stats
            const dashboardStats = await pool.query(`
                SELECT * FROM security_testing_dashboard_stats
            `);

            // Get vulnerability summary
            const vulnSummary = await pool.query(`
                SELECT * FROM security_vulnerabilities_summary
                WHERE first_detected >= $1
                ORDER BY severity DESC, count DESC
            `, [startDate]);

            // Get suite performance
            const suitePerformance = await pool.query(`
                SELECT * FROM security_test_suite_performance
                WHERE last_run_at >= $1
                ORDER BY total_runs DESC
            `, [startDate]);

            // Get testing trends
            const trends = await pool.query(`
                SELECT * FROM security_testing_trends
                WHERE date >= $1
                ORDER BY date DESC
                LIMIT 30
            `, [startDate]);

            // Get recent metrics
            const metrics = await pool.query(`
                SELECT * FROM get_security_testing_metrics($1, $2)
            `, [startDate, new Date()]);

            span?.setAttributes({
                timeframe,
                dashboard_stats_count: dashboardStats.rows.length,
                vulnerability_types: vulnSummary.rows.length,
                metrics_count: metrics.rows.length
            });

            securityTestingCounter.add(1, { operation: 'get_metrics' });

            res.json({
                success: true,
                data: {
                    timeframe,
                    dashboardStats: dashboardStats.rows[0] || {},
                    vulnerabilitySummary: vulnSummary.rows,
                    suitePerformance: suitePerformance.rows,
                    trends: trends.rows,
                    metrics: metrics.rows,
                    generatedAt: new Date()
                }
            });
        });

    } catch (error) {
        console.error('Failed to get security testing metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve security testing metrics'
        });
    }
});

/**
 * Get vulnerability findings
 * GET /api/security-testing/vulnerabilities
 */
router.get('/vulnerabilities', async (req, res) => {
    try {
        if (!req.app.locals.pool) {
            return res.status(503).json({
                success: false,
                error: 'Database not available'
            });
        }

        const {
            severity,
            status = 'open',
            type,
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT v.*, tr.suite_name, tr.started_at as test_run_date
            FROM security_test_vulnerabilities v
            JOIN security_test_runs tr ON v.test_run_id = tr.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (severity) {
            query += ` AND v.severity = $${paramIndex}`;
            params.push(severity);
            paramIndex++;
        }

        if (status) {
            query += ` AND v.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (type) {
            query += ` AND v.vulnerability_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        query += ` ORDER BY v.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await req.app.locals.pool.query(query, params);
        
        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total
            FROM security_test_vulnerabilities v
            WHERE 1=1
        `;
        const countParams = [];
        let countParamIndex = 1;

        if (severity) {
            countQuery += ` AND v.severity = $${countParamIndex}`;
            countParams.push(severity);
            countParamIndex++;
        }

        if (status) {
            countQuery += ` AND v.status = $${countParamIndex}`;
            countParams.push(status);
            countParamIndex++;
        }

        if (type) {
            countQuery += ` AND v.vulnerability_type = $${countParamIndex}`;
            countParams.push(type);
        }

        const countResult = await req.app.locals.pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);

        res.json({
            success: true,
            data: {
                vulnerabilities: result.rows,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: (parseInt(offset) + parseInt(limit)) < total
                }
            }
        });

    } catch (error) {
        console.error('Failed to get vulnerabilities:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve vulnerabilities'
        });
    }
});

/**
 * Update vulnerability status
 * PATCH /api/security-testing/vulnerabilities/:vulnerabilityId
 */
router.patch('/vulnerabilities/:vulnerabilityId', async (req, res) => {
    try {
        const { vulnerabilityId } = req.params;
        const { status, assignedTo, fixPriority, notes } = req.body;

        if (!req.app.locals.pool) {
            return res.status(503).json({
                success: false,
                error: 'Database not available'
            });
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (status) {
            updates.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (assignedTo) {
            updates.push(`assigned_to = $${paramIndex}`);
            params.push(assignedTo);
            paramIndex++;
        }

        if (fixPriority) {
            updates.push(`fix_priority = $${paramIndex}`);
            params.push(parseInt(fixPriority));
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid updates provided'
            });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(vulnerabilityId);

        const query = `
            UPDATE security_test_vulnerabilities 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await req.app.locals.pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vulnerability not found'
            });
        }

        // Log the vulnerability status change
        await SecurityAuditLogger.logSecurityEvent('vulnerability_status_changed', {
            vulnerabilityId,
            oldStatus: result.rows[0].status,
            newStatus: status,
            assignedTo,
            fixPriority,
            updatedBy: req.user?.id || 'api'
        });

        securityTestingCounter.add(1, { 
            operation: 'update_vulnerability',
            status: status || 'unknown'
        });

        res.json({
            success: true,
            data: {
                vulnerability: result.rows[0],
                message: 'Vulnerability updated successfully'
            }
        });

    } catch (error) {
        console.error('Failed to update vulnerability:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update vulnerability'
        });
    }
});

/**
 * Get security test report
 * GET /api/security-testing/reports/:testRunId
 */
router.get('/reports/:testRunId', async (req, res) => {
    try {
        const { testRunId } = req.params;
        const { format = 'json' } = req.query;

        if (!req.app.locals.pool) {
            return res.status(503).json({
                success: false,
                error: 'Database not available'
            });
        }

        const result = await req.app.locals.pool.query(`
            SELECT str.*, strep.report_data, strep.generated_at as report_generated_at
            FROM security_test_runs str
            LEFT JOIN security_test_reports strep ON str.id = strep.test_run_id
            WHERE str.id = $1
        `, [testRunId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Test run or report not found'
            });
        }

        const testRun = result.rows[0];
        let reportData = null;

        if (testRun.report_data) {
            reportData = JSON.parse(testRun.report_data);
        }

        if (format === 'json') {
            res.json({
                success: true,
                data: {
                    testRun: {
                        id: testRun.id,
                        suiteId: testRun.suite_id,
                        suiteName: testRun.suite_name,
                        status: testRun.status,
                        startedAt: testRun.started_at,
                        completedAt: testRun.completed_at,
                        duration: testRun.duration_ms,
                        vulnerabilitiesFound: testRun.vulnerabilities_found
                    },
                    report: reportData,
                    reportGeneratedAt: testRun.report_generated_at
                }
            });
        } else {
            // For other formats (PDF, HTML), would implement file serving
            res.status(501).json({
                success: false,
                error: 'Report format not yet implemented'
            });
        }

    } catch (error) {
        console.error('Failed to get security test report:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve security test report'
        });
    }
});

/**
 * Health check endpoint
 * GET /api/security-testing/health
 */
router.get('/health', (req, res) => {
    try {
        const securityTestingSuite = req.app.locals.securityTestingSuite;
        
        const healthStatus = {
            status: 'healthy',
            initialized: securityTestingSuite?.isInitialized() || false,
            activeTests: securityTestingSuite?.getActiveTestCount() || 0,
            timestamp: new Date()
        };

        if (!securityTestingSuite?.isInitialized()) {
            healthStatus.status = 'degraded';
            healthStatus.message = 'Security testing suite not initialized';
        }

        res.json({
            success: true,
            data: healthStatus
        });

    } catch (error) {
        console.error('Security testing health check failed:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed'
        });
    }
});

export default router;
