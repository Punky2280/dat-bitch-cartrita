/**
 * Enhanced Database Security Service
 * Comprehensive database security with encryption, masking, audit trails
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import crypto from 'crypto';
import { Pool } from 'pg';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from './SecurityAuditLogger.js';

class EnhancedDatabaseSecurityService {
    constructor(pool) {
        this.pool = pool;
        this.encryptionKeys = new Map();
        this.maskingRules = new Map();
        this.securityPolicies = new Map();
        this.sensitiveDataPatterns = new Map();
        this.initialized = false;
        
        this.init();
    }

    async init() {
        try {
            await this.loadEncryptionKeys();
            await this.loadMaskingRules();
            await this.loadSecurityPolicies();
            await this.loadSensitiveDataPatterns();
            await this.startSecurityMonitoring();
            
            this.initialized = true;
            console.log('Enhanced Database Security Service initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Enhanced Database Security Service:', error);
            throw error;
        }
    }

    async loadEncryptionKeys() {
        const result = await this.pool.query(`
            SELECT key_id, key_name, algorithm, encrypted_key, salt, iterations, status
            FROM encryption_keys 
            WHERE status = 'active'
            ORDER BY created_at DESC
        `);

        for (const row of result.rows) {
            this.encryptionKeys.set(row.key_name, {
                keyId: row.key_id,
                algorithm: row.algorithm,
                encryptedKey: row.encrypted_key,
                salt: row.salt,
                iterations: row.iterations,
                status: row.status
            });
        }
    }

    async loadMaskingRules() {
        const result = await this.pool.query(`
            SELECT rule_name, table_name, column_name, masking_method, masking_config, priority
            FROM data_masking_rules 
            WHERE enabled = TRUE
            ORDER BY priority ASC
        `);

        for (const row of result.rows) {
            const key = `${row.table_name}.${row.column_name}`;
            this.maskingRules.set(key, {
                ruleName: row.rule_name,
                method: row.masking_method,
                config: row.masking_config,
                priority: row.priority
            });
        }
    }

    async loadSecurityPolicies() {
        const result = await this.pool.query(`
            SELECT policy_name, policy_type, scope_type, scope_value, policy_rules, priority, enforcement_level
            FROM database_security_policies 
            WHERE enabled = TRUE
            ORDER BY priority ASC
        `);

        for (const row of result.rows) {
            this.securityPolicies.set(row.policy_name, {
                type: row.policy_type,
                scopeType: row.scope_type,
                scopeValue: row.scope_value,
                rules: row.policy_rules,
                priority: row.priority,
                enforcementLevel: row.enforcement_level
            });
        }
    }

    async loadSensitiveDataPatterns() {
        // Load patterns for automatic sensitive data detection
        this.sensitiveDataPatterns.set('SSN', {
            pattern: /^\d{3}-\d{2}-\d{4}$/,
            type: 'PII',
            confidence: 0.95
        });
        
        this.sensitiveDataPatterns.set('EMAIL', {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            type: 'PII',
            confidence: 0.9
        });
        
        this.sensitiveDataPatterns.set('CREDIT_CARD', {
            pattern: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
            type: 'PCI',
            confidence: 0.95
        });
        
        this.sensitiveDataPatterns.set('PHONE', {
            pattern: /^\+?1?[\s-]?\(?[0-9]{3}\)?[\s-]?[0-9]{3}[\s-]?[0-9]{4}$/,
            type: 'PII',
            confidence: 0.85
        });
    }

    // Field-level encryption methods
    async encryptField(plaintext, keyName = 'master_key_v1') {
        return await OpenTelemetryTracing.traceOperation('db_security.encrypt_field', async (span) => {
            const keyInfo = this.encryptionKeys.get(keyName);
            if (!keyInfo) {
                throw new Error(`Encryption key ${keyName} not found`);
            }

            // Generate a random IV for each encryption
            const iv = crypto.randomBytes(16);
            
            // Derive key from master key (simplified - use proper key derivation in production)
            const key = crypto.pbkdf2Sync(keyInfo.encryptedKey, keyInfo.salt, keyInfo.iterations, 32, 'sha512');
            
            const cipher = crypto.createCipher('aes-256-gcm', key);
            cipher.setAAD(Buffer.from(keyName)); // Additional authenticated data
            
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            span?.setAttributes({
                key_name: keyName,
                algorithm: keyInfo.algorithm,
                data_length: plaintext.length
            });

            // Update key usage
            await this.updateKeyUsage(keyInfo.keyId);
            
            return {
                encryptedData: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                keyName
            };
        });
    }

    async decryptField(encryptedData, iv, authTag, keyName) {
        return await OpenTelemetryTracing.traceOperation('db_security.decrypt_field', async (span) => {
            const keyInfo = this.encryptionKeys.get(keyName);
            if (!keyInfo) {
                throw new Error(`Encryption key ${keyName} not found`);
            }

            // Derive key from master key
            const key = crypto.pbkdf2Sync(keyInfo.encryptedKey, keyInfo.salt, keyInfo.iterations, 32, 'sha512');
            
            const decipher = crypto.createDecipher('aes-256-gcm', key);
            decipher.setAAD(Buffer.from(keyName));
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            span?.setAttributes({
                key_name: keyName,
                algorithm: keyInfo.algorithm
            });

            return decrypted;
        });
    }

    async updateKeyUsage(keyId) {
        await this.pool.query(`
            UPDATE encryption_keys 
            SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [keyId]);
    }

    // Data masking methods
    async applyDataMasking(value, tableName, columnName, userRole = null) {
        return await OpenTelemetryTracing.traceOperation('db_security.apply_masking', async (span) => {
            if (!value) return value;

            // Check if masking should be applied
            const shouldMask = await this.shouldMaskColumn(tableName, columnName, userRole);
            if (!shouldMask) return value;

            const key = `${tableName}.${columnName}`;
            let maskingRule = this.maskingRules.get(key);
            
            // Check for wildcard rules
            if (!maskingRule) {
                maskingRule = this.maskingRules.get(`*.${columnName}`);
            }

            if (!maskingRule) {
                return value; // No masking rule found
            }

            span?.setAttributes({
                table_name: tableName,
                column_name: columnName,
                masking_method: maskingRule.method,
                user_role: userRole || 'unknown'
            });

            return this.performMasking(value, maskingRule);
        });
    }

    async shouldMaskColumn(tableName, columnName, userRole) {
        // Check if user role is exempt from masking
        const exemptRoles = ['admin', 'system', 'security_officer', 'dba'];
        if (userRole && exemptRoles.includes(userRole.toLowerCase())) {
            return false;
        }

        // Check database configuration
        const result = await this.pool.query(`
            SELECT masking_enabled FROM database_security_config
            WHERE (table_name = $1 OR table_name = '*') AND column_name = $2
            ORDER BY CASE WHEN table_name = $1 THEN 1 ELSE 2 END
            LIMIT 1
        `, [tableName, columnName]);

        return result.rows.length > 0 ? result.rows[0].masking_enabled : false;
    }

    performMasking(value, maskingRule) {
        const { method, config } = maskingRule;
        const maskChar = config?.mask_character || '*';
        const visibleChars = config?.visible_chars || 2;
        const preserveFormat = config?.preserve_format || false;

        switch (method) {
            case 'full':
                return preserveFormat ? 
                    value.replace(/./g, maskChar) : 
                    maskChar.repeat(value.length);

            case 'partial':
                if (value.length <= visibleChars * 2) {
                    return maskChar.repeat(value.length);
                }
                
                const start = value.substring(0, visibleChars);
                const end = value.substring(value.length - visibleChars);
                const middle = maskChar.repeat(value.length - (visibleChars * 2));
                return start + middle + end;

            case 'hash':
                return crypto.createHash('sha256')
                    .update(value + 'masking_salt')
                    .digest('hex')
                    .substring(0, 16);

            case 'random':
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                return Array.from({ length: value.length }, () => 
                    chars.charAt(Math.floor(Math.random() * chars.length))
                ).join('');

            case 'email':
                const emailParts = value.split('@');
                if (emailParts.length !== 2) return value;
                const maskedLocal = this.performMasking(emailParts[0], { method: 'partial', config });
                return config?.preserve_domain ? 
                    `${maskedLocal}@${emailParts[1]}` : 
                    `${maskedLocal}@${maskChar.repeat(emailParts[1].length)}`;

            default:
                return value;
        }
    }

    // Audit logging methods
    async logDataAccess(params) {
        return await OpenTelemetryTracing.traceOperation('db_security.log_data_access', async (span) => {
            const {
                userId,
                sessionId,
                tableName,
                columnName,
                operation,
                recordId,
                oldValue,
                newValue,
                clientIp,
                userAgent,
                riskScore = 0
            } = params;

            await this.pool.query(`
                INSERT INTO data_access_audit_log (
                    user_id, session_id, table_name, column_name, operation,
                    record_id, old_value, new_value, client_ip, user_agent, risk_score
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                userId, sessionId, tableName, columnName, operation,
                recordId, oldValue, newValue, clientIp, userAgent, riskScore
            ]);

            span?.setAttributes({
                user_id: userId?.toString(),
                table_name: tableName,
                operation,
                risk_score: riskScore
            });

            // Check for high-risk access patterns
            if (riskScore >= 80) {
                await this.handleHighRiskAccess(params);
            }
        });
    }

    async handleHighRiskAccess(params) {
        // Log security alert
        SecurityAuditLogger.log('High-risk database access detected', {
            userId: params.userId,
            tableName: params.tableName,
            operation: params.operation,
            riskScore: params.riskScore,
            clientIp: params.clientIp
        });

        // Could trigger additional security measures here
        // - Send alerts
        // - Require additional authentication
        // - Temporarily lock account
        // - etc.
    }

    async logQueryExecution(params) {
        return await OpenTelemetryTracing.traceOperation('db_security.log_query', async (span) => {
            const {
                userId,
                sessionId,
                query,
                queryType,
                tablesAccessed,
                executionTimeMs,
                rowsAffected,
                clientIp,
                applicationName
            } = params;

            const queryHash = crypto.createHash('sha256').update(query).digest('hex');
            const riskLevel = await this.assessQueryRisk(query, queryType, tablesAccessed);
            const anomalyDetected = await this.detectQueryAnomaly(userId, query, queryType);

            await this.pool.query(`
                INSERT INTO query_monitoring_log (
                    user_id, session_id, query_hash, query_text, query_type,
                    tables_accessed, execution_time_ms, rows_affected, client_ip,
                    application_name, risk_level, anomaly_detected
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
                userId, sessionId, queryHash, query, queryType,
                tablesAccessed, executionTimeMs, rowsAffected, clientIp,
                applicationName, riskLevel, anomalyDetected
            ]);

            span?.setAttributes({
                user_id: userId?.toString(),
                query_type: queryType,
                risk_level: riskLevel,
                anomaly_detected: anomalyDetected,
                execution_time_ms: executionTimeMs
            });
        });
    }

    async assessQueryRisk(query, queryType, tablesAccessed) {
        let riskScore = 0;
        const queryLower = query.toLowerCase();

        // Risk factors
        if (queryType === 'DELETE' && !queryLower.includes('where')) {
            riskScore += 40; // DELETE without WHERE
        }

        if (queryType === 'UPDATE' && !queryLower.includes('where')) {
            riskScore += 35; // UPDATE without WHERE
        }

        if (queryLower.includes('drop table') || queryLower.includes('truncate')) {
            riskScore += 50; // Destructive operations
        }

        if (tablesAccessed?.some(table => ['users', 'vault', 'api_keys'].includes(table))) {
            riskScore += 20; // Sensitive tables
        }

        if (queryLower.includes('union') && queryLower.includes('select')) {
            riskScore += 15; // Potential SQL injection
        }

        if (queryLower.match(/--|\*\/|\/\*/)) {
            riskScore += 10; // SQL comments (potential injection)
        }

        // Determine risk level
        if (riskScore >= 60) return 'critical';
        if (riskScore >= 40) return 'high';
        if (riskScore >= 20) return 'medium';
        return 'low';
    }

    async detectQueryAnomaly(userId, query, queryType) {
        // Simple anomaly detection based on user behavior patterns
        const recentQueries = await this.pool.query(`
            SELECT query_type, COUNT(*) as count
            FROM query_monitoring_log
            WHERE user_id = $1 AND timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
            GROUP BY query_type
        `, [userId]);

        const userPatterns = new Map();
        for (const row of recentQueries.rows) {
            userPatterns.set(row.query_type, row.count);
        }

        // Check for unusual query types or volumes
        const currentCount = userPatterns.get(queryType) || 0;
        const avgCount = Array.from(userPatterns.values()).reduce((a, b) => a + b, 0) / userPatterns.size || 0;

        // Anomaly if this query type is 3x above average
        return currentCount > (avgCount * 3) && avgCount > 0;
    }

    // Sensitive data detection methods
    async scanTableForSensitiveData(tableName) {
        return await OpenTelemetryTracing.traceOperation('db_security.scan_sensitive_data', async (span) => {
            const results = [];

            // Get table schema
            const schemaResult = await this.pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1 AND table_schema = 'public'
            `, [tableName]);

            for (const column of schemaResult.rows) {
                // Sample data from the column
                const sampleResult = await this.pool.query(`
                    SELECT ${column.column_name}
                    FROM ${tableName}
                    WHERE ${column.column_name} IS NOT NULL
                    LIMIT 100
                `);

                for (const [patternName, patternInfo] of this.sensitiveDataPatterns) {
                    let matchCount = 0;
                    let sampleMatches = [];

                    for (const row of sampleResult.rows) {
                        const value = row[column.column_name]?.toString();
                        if (value && patternInfo.pattern.test(value)) {
                            matchCount++;
                            if (sampleMatches.length < 3) {
                                // Store masked sample for verification
                                sampleMatches.push(this.performMasking(value, { 
                                    method: 'partial', 
                                    config: { mask_character: '*', visible_chars: 2 } 
                                }));
                            }
                        }
                    }

                    if (matchCount > 0) {
                        const confidence = Math.min(
                            patternInfo.confidence * (matchCount / sampleResult.rows.length),
                            1.0
                        );

                        results.push({
                            tableName,
                            columnName: column.column_name,
                            dataType: patternInfo.type,
                            confidenceScore: confidence,
                            detectionMethod: 'pattern_match',
                            matchCount,
                            sampleData: sampleMatches.join(', ')
                        });

                        // Store detection result
                        await this.storeSensitiveDataDetection({
                            tableName,
                            columnName: column.column_name,
                            dataType: patternInfo.type,
                            confidenceScore: confidence,
                            detectionMethod: 'pattern_match',
                            sampleData: sampleMatches.join(', ')
                        });
                    }
                }
            }

            span?.setAttributes({
                table_name: tableName,
                columns_scanned: schemaResult.rows.length,
                sensitive_fields_found: results.length
            });

            return results;
        });
    }

    async storeSensitiveDataDetection(detection) {
        await this.pool.query(`
            INSERT INTO sensitive_data_detection (
                table_name, column_name, data_type, confidence_score, 
                detection_method, sample_data
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (table_name, column_name, data_type) 
            DO UPDATE SET 
                confidence_score = EXCLUDED.confidence_score,
                detection_method = EXCLUDED.detection_method,
                sample_data = EXCLUDED.sample_data
        `, [
            detection.tableName,
            detection.columnName,
            detection.dataType,
            detection.confidenceScore,
            detection.detectionMethod,
            detection.sampleData
        ]);
    }

    // Data classification methods
    async classifyData(tableName, columnName, tags) {
        return await OpenTelemetryTracing.traceOperation('db_security.classify_data', async (span) => {
            for (const tagName of tags) {
                // Get tag ID
                const tagResult = await this.pool.query(`
                    SELECT id FROM data_classification_tags WHERE tag_name = $1
                `, [tagName]);

                if (tagResult.rows.length > 0) {
                    const tagId = tagResult.rows[0].id;

                    // Assign classification
                    await this.pool.query(`
                        INSERT INTO data_classification_assignments (
                            table_name, column_name, tag_id, assignment_method
                        ) VALUES ($1, $2, $3, 'manual')
                        ON CONFLICT (table_name, column_name, tag_id) DO NOTHING
                    `, [tableName, columnName, tagId]);
                }
            }

            span?.setAttributes({
                table_name: tableName,
                column_name: columnName,
                tag_count: tags.length
            });
        });
    }

    // Security metrics and monitoring
    async collectSecurityMetrics() {
        return await OpenTelemetryTracing.traceOperation('db_security.collect_metrics', async (span) => {
            const metrics = {};

            // Get metrics from the security dashboard view
            const result = await this.pool.query(`
                SELECT metric_name, metric_value, metric_unit 
                FROM security_dashboard_metrics
            `);

            for (const row of result.rows) {
                metrics[row.metric_name] = {
                    value: parseFloat(row.metric_value),
                    unit: row.metric_unit
                };
            }

            // Additional real-time metrics
            const riskDistribution = await this.pool.query(`
                SELECT risk_level, COUNT(*) as count
                FROM query_monitoring_log
                WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                GROUP BY risk_level
            `);

            metrics.risk_distribution = {};
            for (const row of riskDistribution.rows) {
                metrics.risk_distribution[row.risk_level] = parseInt(row.count);
            }

            span?.setAttributes({
                metrics_collected: Object.keys(metrics).length
            });

            return metrics;
        });
    }

    async startSecurityMonitoring() {
        // Start background monitoring processes
        setInterval(async () => {
            try {
                await this.performSecurityHealthCheck();
            } catch (error) {
                console.error('Security health check failed:', error);
            }
        }, 5 * 60 * 1000); // Every 5 minutes

        setInterval(async () => {
            try {
                await this.checkForSecurityViolations();
            } catch (error) {
                console.error('Security violation check failed:', error);
            }
        }, 10 * 60 * 1000); // Every 10 minutes

        console.log('Database security monitoring started');
    }

    async performSecurityHealthCheck() {
        return await OpenTelemetryTracing.traceOperation('db_security.health_check', async (span) => {
            const issues = [];

            // Check for unencrypted sensitive data
            const unencryptedSensitive = await this.pool.query(`
                SELECT DISTINCT dsc.table_name, dsc.column_name
                FROM database_security_config dsc
                JOIN data_classification_assignments dca ON 
                    dsc.table_name = dca.table_name AND dsc.column_name = dca.column_name
                JOIN data_classification_tags dct ON dca.tag_id = dct.id
                WHERE dct.tag_name IN ('Restricted', 'PII', 'PHI', 'PCI')
                AND dsc.encryption_enabled = FALSE
            `);

            if (unencryptedSensitive.rows.length > 0) {
                issues.push({
                    type: 'unencrypted_sensitive_data',
                    count: unencryptedSensitive.rows.length,
                    details: unencryptedSensitive.rows
                });
            }

            // Check for high-risk queries in the last hour
            const highRiskQueries = await this.pool.query(`
                SELECT COUNT(*) as count
                FROM query_monitoring_log
                WHERE risk_level IN ('high', 'critical')
                AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
            `);

            if (highRiskQueries.rows[0].count > 10) {
                issues.push({
                    type: 'excessive_high_risk_queries',
                    count: parseInt(highRiskQueries.rows[0].count)
                });
            }

            span?.setAttributes({
                issues_found: issues.length,
                unencrypted_fields: unencryptedSensitive.rows.length
            });

            return {
                healthy: issues.length === 0,
                issues
            };
        });
    }

    async checkForSecurityViolations() {
        // Check for policy violations
        const violations = [];

        // Check audit log for suspicious patterns
        const suspiciousActivity = await this.pool.query(`
            SELECT user_id, COUNT(*) as access_count, 
                   COUNT(DISTINCT table_name) as tables_accessed
            FROM data_access_audit_log
            WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
            AND risk_score > 50
            GROUP BY user_id
            HAVING COUNT(*) > 50 OR COUNT(DISTINCT table_name) > 10
        `);

        for (const row of suspiciousActivity.rows) {
            violations.push({
                type: 'suspicious_access_pattern',
                userId: row.user_id,
                accessCount: row.access_count,
                tablesAccessed: row.tables_accessed
            });

            // Log security violation
            SecurityAuditLogger.log('Suspicious database access pattern detected', {
                userId: row.user_id,
                accessCount: row.access_count,
                tablesAccessed: row.tables_accessed
            });
        }

        return violations;
    }

    // Utility methods
    isInitialized() {
        return this.initialized;
    }

    async getSecurityConfiguration(tableName, columnName = null) {
        const query = columnName 
            ? 'SELECT * FROM database_security_config WHERE table_name = $1 AND column_name = $2'
            : 'SELECT * FROM database_security_config WHERE table_name = $1';
        
        const params = columnName ? [tableName, columnName] : [tableName];
        const result = await this.pool.query(query, params);
        
        return result.rows;
    }

    async updateSecurityConfiguration(tableName, columnName, config) {
        await this.pool.query(`
            INSERT INTO database_security_config (
                table_name, column_name, security_classification, 
                encryption_enabled, masking_enabled, audit_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (table_name, column_name) 
            DO UPDATE SET 
                security_classification = EXCLUDED.security_classification,
                encryption_enabled = EXCLUDED.encryption_enabled,
                masking_enabled = EXCLUDED.masking_enabled,
                audit_enabled = EXCLUDED.audit_enabled,
                updated_at = CURRENT_TIMESTAMP
        `, [
            tableName,
            columnName,
            config.securityClassification || 'public',
            config.encryptionEnabled || false,
            config.maskingEnabled || false,
            config.auditEnabled || true
        ]);

        // Reload configuration
        await this.loadMaskingRules();
    }
}

export default EnhancedDatabaseSecurityService;
