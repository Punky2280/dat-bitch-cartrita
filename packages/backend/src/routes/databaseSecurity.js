/**
 * Database Security Management Routes
 * RESTful API for managing database security configuration
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import express from 'express';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

/**
 * GET /api/database-security/metrics
 * Get comprehensive database security metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        if (!req.app.locals.databaseSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Database security service not available'
            });
        }

        const metrics = await req.app.locals.databaseSecurityService.collectSecurityMetrics();
        
        res.json({
            success: true,
            data: {
                metrics,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Database security metrics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to collect security metrics'
        });
    }
});

/**
 * GET /api/database-security/health
 * Get database security health status
 */
router.get('/health', async (req, res) => {
    try {
        if (!req.app.locals.databaseSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Database security service not available'
            });
        }

        const healthCheck = await req.app.locals.databaseSecurityService.performSecurityHealthCheck();
        
        res.json({
            success: true,
            data: {
                ...healthCheck,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Database security health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform health check'
        });
    }
});

/**
 * GET /api/database-security/config/:tableName
 * Get security configuration for table
 */
router.get('/config/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;

        if (!req.app.locals.databaseSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Database security service not available'
            });
        }

        const config = await req.app.locals.databaseSecurityService.getSecurityConfiguration(tableName);
        
        res.json({
            success: true,
            data: {
                tableName,
                configuration: config,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Database security config error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get security configuration'
        });
    }
});

/**
 * GET /api/database-security/config/:tableName/:columnName
 * Get security configuration for table/column
 */
router.get('/config/:tableName/:columnName', async (req, res) => {
    try {
        const { tableName, columnName } = req.params;

        if (!req.app.locals.databaseSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Database security service not available'
            });
        }

        const config = await req.app.locals.databaseSecurityService.getSecurityConfiguration(
            tableName,
            columnName
        );
        
        res.json({
            success: true,
            data: {
                tableName,
                columnName: columnName || null,
                configuration: config,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Database security config retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve security configuration'
        });
    }
});

/**
 * PUT /api/database-security/config/:tableName/:columnName
 * Update security configuration for table/column
 */
router.put('/config/:tableName/:columnName', async (req, res) => {
    try {
        const { tableName, columnName } = req.params;
        const config = req.body;

        // Validate required user role
        if (!req.user || !['admin', 'security_officer', 'dba'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to modify security configuration'
            });
        }

        if (!req.app.locals.databaseSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Database security service not available'
            });
        }

        await req.app.locals.databaseSecurityService.updateSecurityConfiguration(
            tableName,
            columnName,
            config
        );

        // Log security configuration change
        if (req.dbSecurity) {
            await req.dbSecurity.logAccess({
                tableName: 'database_security_config',
                columnName: 'configuration',
                operation: 'UPDATE',
                recordId: `${tableName}.${columnName}`,
                riskScore: 40 // Security config changes are medium risk
            });
        }
        
        res.json({
            success: true,
            data: {
                tableName,
                columnName,
                updated: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Database security config update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update security configuration'
        });
    }
});

/**
 * POST /api/database-security/scan-sensitive/:tableName
 * Scan table for sensitive data patterns
 */
router.post('/scan-sensitive/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;

        // Validate required user role
        if (!req.user || !['admin', 'security_officer', 'dba'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to scan for sensitive data'
            });
        }

        if (!req.app.locals.databaseSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Database security service not available'
            });
        }

        const results = await OpenTelemetryTracing.traceOperation('db_security.api.scan_sensitive', async (span) => {
            span?.setAttributes({
                table_name: tableName,
                user_id: req.user?.id?.toString(),
                user_role: req.user?.role
            });

            return await req.app.locals.databaseSecurityService.scanTableForSensitiveData(tableName);
        });

        // Log sensitive data scan
        if (req.dbSecurity) {
            await req.dbSecurity.logAccess({
                tableName: tableName,
                columnName: '*',
                operation: 'SCAN',
                recordId: null,
                riskScore: 30 // Data scanning is medium-low risk
            });
        }
        
        res.json({
            success: true,
            data: {
                tableName,
                sensitiveDataFound: results,
                scanDate: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Sensitive data scan error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scan for sensitive data'
        });
    }
});

/**
 * POST /api/database-security/classify/:tableName/:columnName
 * Classify data with security tags
 */
router.post('/classify/:tableName/:columnName', async (req, res) => {
    try {
        const { tableName, columnName } = req.params;
        const { tags } = req.body;

        if (!Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                error: 'Tags must be provided as an array'
            });
        }

        // Validate required user role
        if (!req.user || !['admin', 'security_officer', 'dba'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to classify data'
            });
        }

        if (!req.app.locals.databaseSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Database security service not available'
            });
        }

        await OpenTelemetryTracing.traceOperation('db_security.api.classify_data', async (span) => {
            span?.setAttributes({
                table_name: tableName,
                column_name: columnName,
                tag_count: tags.length,
                user_id: req.user?.id?.toString()
            });

            await req.app.locals.databaseSecurityService.classifyData(tableName, columnName, tags);
        });

        // Log data classification
        if (req.dbSecurity) {
            await req.dbSecurity.logAccess({
                tableName: 'data_classification_assignments',
                columnName: 'tag_id',
                operation: 'INSERT',
                recordId: `${tableName}.${columnName}`,
                riskScore: 20 // Data classification is low-medium risk
            });
        }
        
        res.json({
            success: true,
            data: {
                tableName,
                columnName,
                tags,
                classified: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Data classification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to classify data'
        });
    }
});

/**
 * GET /api/database-security/audit-log
 * Get database access audit log with filtering
 */
router.get('/audit-log', async (req, res) => {
    try {
        const {
            table_name,
            user_id,
            operation,
            start_date,
            end_date,
            risk_level,
            limit = '100',
            offset = '0'
        } = req.query;

        // Validate required user role
        if (!req.user || !['admin', 'security_officer', 'auditor'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to view audit logs'
            });
        }

        if (!req.app.locals.databasePool) {
            return res.status(503).json({
                success: false,
                error: 'Database not available'
            });
        }

        // Build dynamic query
        let query = `
            SELECT dal.*, u.username
            FROM data_access_audit_log dal
            LEFT JOIN users u ON dal.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (table_name) {
            query += ` AND dal.table_name = $${paramIndex}`;
            params.push(table_name);
            paramIndex++;
        }

        if (user_id) {
            query += ` AND dal.user_id = $${paramIndex}`;
            params.push(parseInt(user_id));
            paramIndex++;
        }

        if (operation) {
            query += ` AND dal.operation = $${paramIndex}`;
            params.push(operation.toUpperCase());
            paramIndex++;
        }

        if (start_date) {
            query += ` AND dal.timestamp >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND dal.timestamp <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        if (risk_level) {
            const riskThresholds = {
                low: 25,
                medium: 50,
                high: 75,
                critical: 90
            };
            const threshold = riskThresholds[risk_level.toLowerCase()];
            if (threshold) {
                query += ` AND dal.risk_score >= $${paramIndex}`;
                params.push(threshold);
                paramIndex++;
            }
        }

        query += `
            ORDER BY dal.timestamp DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(parseInt(limit), parseInt(offset));

        const result = await req.app.locals.databasePool.query(query, params);

        // Get total count for pagination
        let countQuery = query.replace(
            /SELECT dal\.\*, u\.username[\s\S]*ORDER BY[\s\S]*LIMIT[\s\S]*$/,
            'SELECT COUNT(*)'
        );
        countQuery = countQuery.replace('LEFT JOIN users u ON dal.user_id = u.id', '');
        
        const countResult = await req.app.locals.databasePool.query(
            countQuery, 
            params.slice(0, -2) // Remove limit and offset params
        );

        res.json({
            success: true,
            data: {
                logs: result.rows,
                pagination: {
                    total: parseInt(countResult.rows[0].count),
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: (parseInt(offset) + parseInt(limit)) < parseInt(countResult.rows[0].count)
                },
                filters: { table_name, user_id, operation, start_date, end_date, risk_level }
            }
        });

    } catch (error) {
        console.error('Audit log retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit logs'
        });
    }
});

/**
 * GET /api/database-security/query-log
 * Get query monitoring log with filtering
 */
router.get('/query-log', async (req, res) => {
    try {
        const {
            user_id,
            query_type,
            risk_level,
            anomaly_detected,
            start_date,
            end_date,
            limit = '50',
            offset = '0'
        } = req.query;

        // Validate required user role
        if (!req.user || !['admin', 'security_officer', 'dba'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to view query logs'
            });
        }

        if (!req.app.locals.databasePool) {
            return res.status(503).json({
                success: false,
                error: 'Database not available'
            });
        }

        // Build dynamic query
        let query = `
            SELECT qml.*, u.username
            FROM query_monitoring_log qml
            LEFT JOIN users u ON qml.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (user_id) {
            query += ` AND qml.user_id = $${paramIndex}`;
            params.push(parseInt(user_id));
            paramIndex++;
        }

        if (query_type) {
            query += ` AND qml.query_type = $${paramIndex}`;
            params.push(query_type.toUpperCase());
            paramIndex++;
        }

        if (risk_level) {
            query += ` AND qml.risk_level = $${paramIndex}`;
            params.push(risk_level.toLowerCase());
            paramIndex++;
        }

        if (anomaly_detected === 'true') {
            query += ` AND qml.anomaly_detected = TRUE`;
        } else if (anomaly_detected === 'false') {
            query += ` AND qml.anomaly_detected = FALSE`;
        }

        if (start_date) {
            query += ` AND qml.timestamp >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND qml.timestamp <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        query += `
            ORDER BY qml.timestamp DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(parseInt(limit), parseInt(offset));

        const result = await req.app.locals.databasePool.query(query, params);

        res.json({
            success: true,
            data: {
                queries: result.rows,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    count: result.rows.length
                },
                filters: { user_id, query_type, risk_level, anomaly_detected, start_date, end_date }
            }
        });

    } catch (error) {
        console.error('Query log retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve query logs'
        });
    }
});

export default router;
