/**
 * Database Security Middleware
 * Automatically applies security policies during database operations
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from '../services/SecurityAuditLogger.js';

class DatabaseSecurityMiddleware {
    constructor(databaseSecurityService) {
        this.securityService = databaseSecurityService;
        this.queryCache = new Map();
        this.cacheMaxSize = 1000;
        this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes
    }

    // Main middleware function for Express
    middleware() {
        return async (req, res, next) => {
            if (!this.securityService?.isInitialized()) {
                return next();
            }

            // Add security context to request
            req.dbSecurity = {
                userId: req.user?.id,
                userRole: req.user?.role,
                sessionId: req.sessionID,
                clientIp: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                applicationName: req.get('X-Application-Name') || 'web',
                
                // Security methods
                encryptField: (data, keyName) => this.securityService.encryptField(data, keyName),
                decryptField: (encData, iv, authTag, keyName) => this.securityService.decryptField(encData, iv, authTag, keyName),
                applyMasking: (value, table, column) => this.securityService.applyDataMasking(value, table, column, req.user?.role),
                logAccess: (params) => this.securityService.logDataAccess({ ...params, ...req.dbSecurity }),
                classifyData: (table, column, tags) => this.securityService.classifyData(table, column, tags)
            };

            next();
        };
    }

    // Query interception wrapper for database pool
    wrapDatabasePool(pool) {
        const originalQuery = pool.query.bind(pool);
        
        pool.query = async (text, params, callback) => {
            // Handle different query signatures
            let queryText = text;
            let queryParams = params;
            let queryCallback = callback;

            if (typeof text === 'object') {
                queryText = text.text;
                queryParams = text.values;
                queryCallback = params;
            }

            // Create security context (when available from request)
            const context = pool.securityContext || {};
            
            try {
                // Pre-process query
                const processedQuery = await this.preProcessQuery(queryText, queryParams, context);
                
                // Execute query with monitoring
                const startTime = Date.now();
                const result = await this.executeSecureQuery(
                    originalQuery, 
                    processedQuery.text, 
                    processedQuery.params, 
                    context
                );
                const executionTime = Date.now() - startTime;

                // Post-process result
                const secureResult = await this.postProcessResult(
                    result, 
                    processedQuery, 
                    context,
                    executionTime
                );

                if (queryCallback) {
                    queryCallback(null, secureResult);
                    return;
                }

                return secureResult;

            } catch (error) {
                // Log security-related errors
                SecurityAuditLogger.log('Database query security error', {
                    error: error.message,
                    query: queryText,
                    userId: context.userId,
                    clientIp: context.clientIp
                });

                if (queryCallback) {
                    queryCallback(error);
                    return;
                }

                throw error;
            }
        };

        return pool;
    }

    async preProcessQuery(queryText, params, context) {
        return await OpenTelemetryTracing.traceOperation('db_security.preprocess_query', async (span) => {
            const queryType = this.detectQueryType(queryText);
            const tablesAccessed = this.extractTablesFromQuery(queryText);
            
            span?.setAttributes({
                query_type: queryType,
                tables_accessed: tablesAccessed.join(','),
                user_id: context.userId?.toString(),
                has_params: !!params
            });

            // Check for potential SQL injection
            await this.detectSqlInjection(queryText, params, context);
            
            // Apply query-level security policies
            const processedQuery = await this.applyQueryPolicies(queryText, params, context, queryType, tablesAccessed);
            
            return {
                text: processedQuery.text,
                params: processedQuery.params,
                type: queryType,
                tables: tablesAccessed,
                originalText: queryText
            };
        });
    }

    async executeSecureQuery(originalQuery, text, params, context) {
        return await OpenTelemetryTracing.traceOperation('db_security.execute_query', async (span) => {
            span?.setAttributes({
                user_id: context.userId?.toString(),
                has_params: !!params
            });

            const result = await originalQuery(text, params);
            
            span?.setAttributes({
                rows_affected: result.rowCount || 0,
                command: result.command
            });

            return result;
        });
    }

    async postProcessResult(result, processedQuery, context, executionTime) {
        return await OpenTelemetryTracing.traceOperation('db_security.postprocess_result', async (span) => {
            // Log query execution
            if (this.securityService && context.userId) {
                await this.securityService.logQueryExecution({
                    userId: context.userId,
                    sessionId: context.sessionId,
                    query: processedQuery.originalText,
                    queryType: processedQuery.type,
                    tablesAccessed: processedQuery.tables,
                    executionTimeMs: executionTime,
                    rowsAffected: result.rowCount || 0,
                    clientIp: context.clientIp,
                    applicationName: context.applicationName
                });
            }

            // Apply data masking to result rows
            if (result.rows && result.rows.length > 0) {
                const maskedResult = await this.applyResultMasking(result, processedQuery, context);
                
                span?.setAttributes({
                    rows_masked: maskedResult.maskedCount || 0,
                    fields_masked: maskedResult.fieldsMasked || 0
                });

                return maskedResult.result;
            }

            return result;
        });
    }

    detectQueryType(queryText) {
        const normalizedQuery = queryText.trim().toLowerCase();
        
        if (normalizedQuery.startsWith('select')) return 'SELECT';
        if (normalizedQuery.startsWith('insert')) return 'INSERT';
        if (normalizedQuery.startsWith('update')) return 'UPDATE';
        if (normalizedQuery.startsWith('delete')) return 'DELETE';
        if (normalizedQuery.startsWith('create')) return 'CREATE';
        if (normalizedQuery.startsWith('alter')) return 'ALTER';
        if (normalizedQuery.startsWith('drop')) return 'DROP';
        if (normalizedQuery.startsWith('truncate')) return 'TRUNCATE';
        if (normalizedQuery.startsWith('with')) return 'WITH';
        
        return 'OTHER';
    }

    extractTablesFromQuery(queryText) {
        const tables = [];
        const normalizedQuery = queryText.toLowerCase();
        
        // Simple regex patterns for table extraction
        const patterns = [
            /from\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            /join\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            /update\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            /into\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            /table\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(normalizedQuery)) !== null) {
                const tableName = match[1].toLowerCase();
                if (!tables.includes(tableName) && !this.isReservedWord(tableName)) {
                    tables.push(tableName);
                }
            }
        }

        return tables;
    }

    isReservedWord(word) {
        const reserved = [
            'select', 'from', 'where', 'and', 'or', 'not', 'in', 'like', 'between',
            'order', 'by', 'group', 'having', 'distinct', 'as', 'inner', 'left',
            'right', 'full', 'outer', 'cross', 'natural', 'on', 'using', 'exists',
            'all', 'any', 'some', 'union', 'intersect', 'except', 'case', 'when',
            'then', 'else', 'end', 'null', 'true', 'false'
        ];
        return reserved.includes(word.toLowerCase());
    }

    async detectSqlInjection(queryText, params, context) {
        const suspiciousPatterns = [
            /(\bUNION\b.*\bSELECT\b)/i,
            /(\bOR\b.*=.*)/i,
            /(;.*(-{2}|\/\*))/i,
            /(\bDROP\b.*\bTABLE\b)/i,
            /(\bTRUNCATE\b.*\bTABLE\b)/i,
            /(\bEXEC\b.*\()/i,
            /(\/\*.*\*\/)/i,
            /(--.*)/i
        ];

        let suspiciousCount = 0;
        const detectedPatterns = [];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(queryText)) {
                suspiciousCount++;
                detectedPatterns.push(pattern.toString());
            }
        }

        // Check for parameter manipulation attempts
        if (params && Array.isArray(params)) {
            for (const param of params) {
                if (typeof param === 'string') {
                    for (const pattern of suspiciousPatterns) {
                        if (pattern.test(param)) {
                            suspiciousCount++;
                            detectedPatterns.push(`param: ${pattern.toString()}`);
                        }
                    }
                }
            }
        }

        if (suspiciousCount > 0) {
            // Log potential SQL injection attempt
            SecurityAuditLogger.log('Potential SQL injection detected', {
                suspiciousCount,
                detectedPatterns,
                queryText: queryText.substring(0, 200) + (queryText.length > 200 ? '...' : ''),
                userId: context.userId,
                clientIp: context.clientIp,
                userAgent: context.userAgent
            });

            // For high-risk queries, you might want to block them
            if (suspiciousCount >= 3) {
                throw new Error('Query blocked due to security policy violation');
            }
        }
    }

    async applyQueryPolicies(queryText, params, context, queryType, tablesAccessed) {
        // Check if user has permission to access these tables
        await this.checkTablePermissions(context.userId, context.userRole, tablesAccessed, queryType);
        
        // Apply row-level security if configured
        const processedQuery = await this.applyRowLevelSecurity(queryText, params, context, tablesAccessed);
        
        return processedQuery;
    }

    async checkTablePermissions(userId, userRole, tables, queryType) {
        // Implementation would check against database_security_policies table
        // This is a simplified version
        
        const restrictedTables = ['api_keys', 'vault', 'user_sessions'];
        const adminRoles = ['admin', 'system', 'dba'];
        
        if (!adminRoles.includes(userRole?.toLowerCase())) {
            for (const table of tables) {
                if (restrictedTables.includes(table) && ['UPDATE', 'DELETE', 'INSERT'].includes(queryType)) {
                    throw new Error(`Insufficient permissions to ${queryType} on table: ${table}`);
                }
            }
        }
    }

    async applyRowLevelSecurity(queryText, params, context, tables) {
        // This is where you would implement row-level security
        // For now, return the original query
        return {
            text: queryText,
            params: params
        };
    }

    async applyResultMasking(result, processedQuery, context) {
        if (!this.securityService || !result.rows || result.rows.length === 0) {
            return { result, maskedCount: 0, fieldsMasked: 0 };
        }

        let maskedCount = 0;
        let fieldsMasked = 0;
        
        // Get field information from the first row
        const fields = result.fields || [];
        const fieldNames = fields.map(f => f.name);
        
        // Apply masking to each row
        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows[i];
            
            for (const fieldName of fieldNames) {
                if (row[fieldName] !== null && row[fieldName] !== undefined) {
                    // Try to determine which table this field came from
                    const tableName = this.guessTableForField(fieldName, processedQuery.tables);
                    
                    if (tableName) {
                        try {
                            const originalValue = row[fieldName];
                            const maskedValue = await this.securityService.applyDataMasking(
                                originalValue,
                                tableName,
                                fieldName,
                                context.userRole
                            );
                            
                            if (maskedValue !== originalValue) {
                                row[fieldName] = maskedValue;
                                maskedCount++;
                                fieldsMasked++;
                                
                                // Log data access
                                await this.securityService.logDataAccess({
                                    userId: context.userId,
                                    sessionId: context.sessionId,
                                    tableName: tableName,
                                    columnName: fieldName,
                                    operation: 'SELECT',
                                    recordId: row.id?.toString() || null,
                                    oldValue: null,
                                    newValue: null, // Don't log actual values for privacy
                                    clientIp: context.clientIp,
                                    userAgent: context.userAgent,
                                    riskScore: this.calculateAccessRiskScore(context, tableName, fieldName)
                                });
                            }
                        } catch (error) {
                            console.error(`Error applying masking to ${tableName}.${fieldName}:`, error);
                        }
                    }
                }
            }
        }

        return { 
            result, 
            maskedCount: maskedCount / result.rows.length, 
            fieldsMasked 
        };
    }

    guessTableForField(fieldName, tables) {
        // Simple heuristic - if there's only one table, use it
        if (tables.length === 1) {
            return tables[0];
        }
        
        // Could implement more sophisticated table guessing logic here
        // For now, just return the first table
        return tables.length > 0 ? tables[0] : null;
    }

    calculateAccessRiskScore(context, tableName, fieldName) {
        let riskScore = 0;
        
        // Base risk for sensitive tables
        const sensitiveTables = ['users', 'api_keys', 'vault', 'conversations'];
        if (sensitiveTables.includes(tableName)) {
            riskScore += 20;
        }
        
        // Risk for sensitive field patterns
        const sensitiveFields = ['password', 'secret', 'key', 'token', 'ssn', 'credit_card'];
        if (sensitiveFields.some(pattern => fieldName.toLowerCase().includes(pattern))) {
            riskScore += 30;
        }
        
        // Risk based on time of access
        const hour = new Date().getHours();
        if (hour < 6 || hour > 22) { // Outside business hours
            riskScore += 10;
        }
        
        // Risk based on user role
        if (!context.userRole || context.userRole === 'guest') {
            riskScore += 25;
        }
        
        return Math.min(riskScore, 100);
    }

    // Cache management for query patterns
    getCachedQueryInfo(queryHash) {
        const cached = this.queryCache.get(queryHash);
        if (cached && (Date.now() - cached.timestamp) < this.cacheMaxAge) {
            return cached.data;
        }
        return null;
    }

    setCachedQueryInfo(queryHash, data) {
        // Prevent cache from growing too large
        if (this.queryCache.size >= this.cacheMaxSize) {
            // Remove oldest entries
            const entries = Array.from(this.queryCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, Math.floor(this.cacheMaxSize * 0.2));
            for (const [key] of toRemove) {
                this.queryCache.delete(key);
            }
        }

        this.queryCache.set(queryHash, {
            data,
            timestamp: Date.now()
        });
    }

    // Helper method to set security context on pool
    setPoolSecurityContext(pool, context) {
        pool.securityContext = context;
        return pool;
    }

    // Cleanup method
    cleanup() {
        this.queryCache.clear();
    }
}

export default DatabaseSecurityMiddleware;
