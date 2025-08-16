/**
 * Database Performance Optimization Service
 * Advanced database optimization and monitoring
 * Task 26: System Performance Optimization - Component 4: Database Optimization
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import DatabaseService from './DatabaseService.js';
import AdvancedCachingService, { CacheCategory } from './AdvancedCachingService.js';

/**
 * Query Performance Categories
 */
export const QueryPerformanceLevel = {
    EXCELLENT: 'excellent',      // < 10ms
    GOOD: 'good',               // < 50ms
    ACCEPTABLE: 'acceptable',    // < 200ms
    SLOW: 'slow',               // < 1000ms
    CRITICAL: 'critical'         // > 1000ms
};

/**
 * Optimization Strategies
 */
export const OptimizationStrategy = {
    INDEX_CREATION: 'index_creation',
    QUERY_REWRITE: 'query_rewrite',
    CONNECTION_POOLING: 'connection_pooling',
    PREPARED_STATEMENTS: 'prepared_statements',
    RESULT_CACHING: 'result_caching',
    BATCH_OPERATIONS: 'batch_operations',
    QUERY_PLANNING: 'query_planning',
    VACUUM_ANALYZE: 'vacuum_analyze'
};

/**
 * Database Performance Optimization Service
 */
class DatabasePerformanceOptimizationService extends EventEmitter {
    constructor() {
        super();
        
        this.queryStats = new Map();
        this.slowQueries = new Map();
        this.indexRecommendations = new Set();
        this.connectionMetrics = {
            activeConnections: 0,
            peakConnections: 0,
            totalQueries: 0,
            averageResponseTime: 0,
            connectionPoolSize: 20
        };
        
        // Query caching
        this.queryCache = new Map();
        this.preparedStatements = new Map();
        
        // Optimization configurations
        this.config = {
            slowQueryThreshold: 200,         // 200ms
            cacheQueryResults: true,
            enableQueryPlanAnalysis: true,
            autoIndexCreation: true,
            batchOptimization: true,
            connectionPoolOptimization: true,
            statisticsCollection: true,
            vacuumSchedule: '0 2 * * *'      // Daily at 2 AM
        };

        this.initializeService();
    }

    /**
     * Initialize database optimization service
     */
    async initializeService() {
        return traceOperation('db-optimization-initialize', async () => {
            try {
                // Create optimization tracking tables
                await this.createOptimizationTables();
                
                // Initialize query monitoring
                await this.initializeQueryMonitoring();
                
                // Set up connection pool optimization
                await this.optimizeConnectionPool();
                
                // Start background optimization tasks
                this.startBackgroundOptimization();
                
                console.log('✅ Database Performance Optimization Service initialized');
                this.emit('service:initialized');
                
            } catch (error) {
                console.error('❌ Failed to initialize database optimization service:', error);
                throw error;
            }
        });
    }

    /**
     * Create optimization tracking tables
     */
    async createOptimizationTables() {
        const createTablesSQL = `
            -- Query performance tracking
            CREATE TABLE IF NOT EXISTS query_performance_log (
                id SERIAL PRIMARY KEY,
                query_hash VARCHAR(64) NOT NULL,
                query_text TEXT NOT NULL,
                execution_time_ms DECIMAL(10,3) NOT NULL,
                rows_examined INTEGER,
                rows_returned INTEGER,
                index_usage JSONB,
                query_plan JSONB,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                performance_level VARCHAR(20) NOT NULL
            );

            -- Slow query analysis
            CREATE TABLE IF NOT EXISTS slow_query_analysis (
                id SERIAL PRIMARY KEY,
                query_hash VARCHAR(64) NOT NULL,
                query_pattern TEXT NOT NULL,
                total_executions INTEGER DEFAULT 1,
                avg_execution_time_ms DECIMAL(10,3) NOT NULL,
                max_execution_time_ms DECIMAL(10,3) NOT NULL,
                min_execution_time_ms DECIMAL(10,3) NOT NULL,
                total_execution_time_ms DECIMAL(15,3) NOT NULL,
                optimization_suggestions JSONB,
                optimization_applied BOOLEAN DEFAULT FALSE,
                first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Index recommendations
            CREATE TABLE IF NOT EXISTS index_recommendations (
                id SERIAL PRIMARY KEY,
                table_name VARCHAR(100) NOT NULL,
                column_names TEXT[] NOT NULL,
                index_type VARCHAR(50) DEFAULT 'btree',
                estimated_benefit_percent DECIMAL(5,2),
                query_patterns TEXT[],
                priority INTEGER DEFAULT 1,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                applied_at TIMESTAMP WITH TIME ZONE
            );

            -- Database optimization history
            CREATE TABLE IF NOT EXISTS db_optimizations_applied (
                id SERIAL PRIMARY KEY,
                optimization_type VARCHAR(50) NOT NULL,
                target_object VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                before_metrics JSONB,
                after_metrics JSONB,
                improvement_percent DECIMAL(5,2),
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'active'
            );

            -- Create indexes for optimization tables
            CREATE INDEX IF NOT EXISTS idx_query_perf_hash ON query_performance_log(query_hash);
            CREATE INDEX IF NOT EXISTS idx_query_perf_time ON query_performance_log(execution_time_ms);
            CREATE INDEX IF NOT EXISTS idx_slow_query_hash ON slow_query_analysis(query_hash);
            CREATE INDEX IF NOT EXISTS idx_index_recommendations_table ON index_recommendations(table_name);
        `;

        await DatabaseService.query(createTablesSQL);
    }

    /**
     * Initialize query monitoring
     */
    async initializeQueryMonitoring() {
        // Override DatabaseService.query to add monitoring
        const originalQuery = DatabaseService.query.bind(DatabaseService);
        
        DatabaseService.query = async (text, params = []) => {
            const startTime = performance.now();
            
            try {
                const result = await originalQuery(text, params);
                const executionTime = performance.now() - startTime;
                
                // Track query performance
                await this.trackQueryPerformance(text, params, executionTime, result.rowCount);
                
                return result;
                
            } catch (error) {
                const executionTime = performance.now() - startTime;
                await this.trackQueryPerformance(text, params, executionTime, 0, error);
                throw error;
            }
        };

        console.log('✅ Query monitoring initialized');
    }

    /**
     * Track individual query performance
     */
    async trackQueryPerformance(queryText, params, executionTime, rowCount, error = null) {
        try {
            if (!this.config.statisticsCollection) return;

            const queryHash = this.generateQueryHash(queryText);
            const performanceLevel = this.categorizeQueryPerformance(executionTime);
            
            // Update in-memory stats
            const stats = this.queryStats.get(queryHash) || {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0,
                minTime: Infinity
            };
            
            stats.count++;
            stats.totalTime += executionTime;
            stats.avgTime = stats.totalTime / stats.count;
            stats.maxTime = Math.max(stats.maxTime, executionTime);
            stats.minTime = Math.min(stats.minTime, executionTime);
            
            this.queryStats.set(queryHash, stats);

            // Log slow queries
            if (executionTime > this.config.slowQueryThreshold) {
                await this.handleSlowQuery(queryHash, queryText, executionTime, rowCount);
            }

            // Record in database (async, don't block)
            this.recordQueryPerformance(queryHash, queryText, executionTime, rowCount, performanceLevel, error)
                .catch(err => console.warn('Failed to record query performance:', err));

        } catch (err) {
            console.warn('Error in query performance tracking:', err);
        }
    }

    /**
     * Handle slow query detection and analysis
     */
    async handleSlowQuery(queryHash, queryText, executionTime, rowCount) {
        const slowQuery = this.slowQueries.get(queryHash) || {
            pattern: this.extractQueryPattern(queryText),
            executions: 0,
            totalTime: 0,
            maxTime: 0,
            avgTime: 0
        };

        slowQuery.executions++;
        slowQuery.totalTime += executionTime;
        slowQuery.maxTime = Math.max(slowQuery.maxTime, executionTime);
        slowQuery.avgTime = slowQuery.totalTime / slowQuery.executions;

        this.slowQueries.set(queryHash, slowQuery);

        // Analyze and generate optimization suggestions
        const suggestions = await this.generateOptimizationSuggestions(queryText, executionTime);
        
        // Update slow query analysis table
        await this.updateSlowQueryAnalysis(queryHash, queryText, slowQuery, suggestions);

        // Emit slow query event
        this.emit('slow-query-detected', {
            queryHash,
            queryText,
            executionTime,
            rowCount,
            suggestions
        });

        console.warn(`🐌 Slow query detected (${executionTime.toFixed(2)}ms): ${queryText.substring(0, 100)}...`);
    }

    /**
     * Generate optimization suggestions for slow queries
     */
    async generateOptimizationSuggestions(queryText, executionTime) {
        const suggestions = [];

        try {
            // Get query execution plan
            const explainResult = await DatabaseService.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${queryText}`);
            const plan = explainResult.rows[0]['QUERY PLAN'][0];

            // Analyze for missing indexes
            const indexSuggestions = this.analyzeForMissingIndexes(plan, queryText);
            suggestions.push(...indexSuggestions);

            // Analyze for query structure improvements
            const queryStructureSuggestions = this.analyzeQueryStructure(queryText, plan);
            suggestions.push(...queryStructureSuggestions);

            // Analyze for join optimizations
            const joinSuggestions = this.analyzeJoinOptimization(plan);
            suggestions.push(...joinSuggestions);

        } catch (error) {
            console.warn('Error generating optimization suggestions:', error);
            suggestions.push({
                type: 'general',
                suggestion: 'Consider reviewing query structure and adding appropriate indexes',
                confidence: 0.5
            });
        }

        return suggestions;
    }

    /**
     * Analyze query plan for missing indexes
     */
    analyzeForMissingIndexes(plan, queryText) {
        const suggestions = [];

        // Recursive function to traverse query plan
        const traversePlan = (node) => {
            if (node['Node Type'] === 'Seq Scan') {
                const relation = node['Relation Name'];
                const filter = node['Filter'];
                
                if (filter && relation) {
                    suggestions.push({
                        type: OptimizationStrategy.INDEX_CREATION,
                        suggestion: `Consider creating an index on table '${relation}' for filter conditions`,
                        table: relation,
                        confidence: 0.8,
                        estimatedImprovement: '50-80%'
                    });

                    // Add to index recommendations
                    this.addIndexRecommendation(relation, this.extractFilterColumns(filter));
                }
            }

            if (node.Plans) {
                node.Plans.forEach(traversePlan);
            }
        };

        traversePlan(plan.Plan);
        return suggestions;
    }

    /**
     * Analyze query structure for improvements
     */
    analyzeQueryStructure(queryText, plan) {
        const suggestions = [];
        const upperQuery = queryText.toUpperCase();

        // Check for SELECT * usage
        if (upperQuery.includes('SELECT *')) {
            suggestions.push({
                type: OptimizationStrategy.QUERY_REWRITE,
                suggestion: 'Replace SELECT * with specific column names to reduce data transfer',
                confidence: 0.7,
                estimatedImprovement: '20-40%'
            });
        }

        // Check for unnecessary subqueries
        if (upperQuery.includes('WHERE') && upperQuery.includes('SELECT')) {
            const subqueryCount = (upperQuery.match(/SELECT/g) || []).length - 1;
            if (subqueryCount > 2) {
                suggestions.push({
                    type: OptimizationStrategy.QUERY_REWRITE,
                    suggestion: 'Consider rewriting complex subqueries as JOINs for better performance',
                    confidence: 0.6,
                    estimatedImprovement: '30-60%'
                });
            }
        }

        // Check for LIKE patterns
        if (upperQuery.includes("LIKE '%")) {
            suggestions.push({
                type: OptimizationStrategy.INDEX_CREATION,
                suggestion: 'Leading wildcard LIKE patterns cannot use indexes effectively. Consider full-text search or trigram indexes',
                confidence: 0.8,
                estimatedImprovement: '70-90%'
            });
        }

        return suggestions;
    }

    /**
     * Analyze join optimization opportunities
     */
    analyzeJoinOptimization(plan) {
        const suggestions = [];

        const traversePlan = (node) => {
            if (node['Node Type'] === 'Nested Loop' && node['Total Cost'] > 1000) {
                suggestions.push({
                    type: OptimizationStrategy.QUERY_REWRITE,
                    suggestion: 'High-cost nested loop detected. Consider adding indexes on join conditions',
                    confidence: 0.7,
                    estimatedImprovement: '40-70%'
                });
            }

            if (node['Node Type'] === 'Hash Join' && node['Hash Buckets'] > 100000) {
                suggestions.push({
                    type: OptimizationStrategy.QUERY_PLANNING,
                    suggestion: 'Large hash join detected. Consider increasing work_mem or restructuring the query',
                    confidence: 0.6,
                    estimatedImprovement: '20-50%'
                });
            }

            if (node.Plans) {
                node.Plans.forEach(traversePlan);
            }
        };

        traversePlan(plan.Plan);
        return suggestions;
    }

    /**
     * Add index recommendation
     */
    async addIndexRecommendation(tableName, columns, indexType = 'btree') {
        if (!columns || columns.length === 0) return;

        const key = `${tableName}:${columns.join(',')}`;
        if (this.indexRecommendations.has(key)) return;

        this.indexRecommendations.add(key);

        const query = `
            INSERT INTO index_recommendations (table_name, column_names, index_type, estimated_benefit_percent, priority)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
        `;

        await DatabaseService.query(query, [
            tableName,
            columns,
            indexType,
            60.0, // Default estimated benefit
            1     // Default priority
        ]);
    }

    /**
     * Optimize connection pool settings
     */
    async optimizeConnectionPool() {
        return traceOperation('optimize-connection-pool', async () => {
            if (!this.config.connectionPoolOptimization) return;

            // Analyze current connection usage patterns
            const connectionStats = await this.analyzeConnectionUsage();
            
            // Optimize pool size based on usage patterns
            const optimalPoolSize = this.calculateOptimalPoolSize(connectionStats);
            
            if (optimalPoolSize !== this.connectionMetrics.connectionPoolSize) {
                console.log(`🔧 Optimizing connection pool size: ${this.connectionMetrics.connectionPoolSize} → ${optimalPoolSize}`);
                
                // Update pool configuration (this would typically involve reconfiguring the actual pool)
                this.connectionMetrics.connectionPoolSize = optimalPoolSize;
                
                this.emit('connection-pool-optimized', {
                    oldSize: this.connectionMetrics.connectionPoolSize,
                    newSize: optimalPoolSize,
                    improvement: connectionStats
                });
            }
        });
    }

    /**
     * Start background optimization tasks
     */
    startBackgroundOptimization() {
        // Analyze and apply optimizations every 15 minutes
        setInterval(() => {
            this.runOptimizationCycle().catch(console.error);
        }, 15 * 60 * 1000);

        // Update statistics every 5 minutes
        setInterval(() => {
            this.updateDatabaseStatistics().catch(console.error);
        }, 5 * 60 * 1000);

        // Cleanup old performance logs daily
        setInterval(() => {
            this.cleanupPerformanceLogs().catch(console.error);
        }, 24 * 60 * 60 * 1000);

        console.log('✅ Background optimization tasks started');
    }

    /**
     * Run optimization cycle
     */
    async runOptimizationCycle() {
        return traceOperation('db-optimization-cycle', async () => {
            console.log('🔄 Starting database optimization cycle...');

            // Apply pending index recommendations
            await this.applyIndexRecommendations();

            // Optimize frequently used queries
            await this.optimizeFrequentQueries();

            // Run maintenance tasks
            await this.runMaintenanceTasks();

            console.log('✅ Database optimization cycle completed');
        });
    }

    /**
     * Apply index recommendations
     */
    async applyIndexRecommendations() {
        if (!this.config.autoIndexCreation) return;

        const query = `
            SELECT * FROM index_recommendations 
            WHERE status = 'pending' AND priority <= 2
            ORDER BY estimated_benefit_percent DESC 
            LIMIT 5
        `;

        const result = await DatabaseService.query(query);
        
        for (const recommendation of result.rows) {
            try {
                await this.createRecommendedIndex(recommendation);
            } catch (error) {
                console.error(`Failed to create recommended index for table ${recommendation.table_name}:`, error);
            }
        }
    }

    /**
     * Create recommended index
     */
    async createRecommendedIndex(recommendation) {
        const indexName = `idx_${recommendation.table_name}_${recommendation.column_names.join('_')}`;
        const columns = recommendation.column_names.join(', ');
        
        const createIndexSQL = `
            CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} 
            ON ${recommendation.table_name} USING ${recommendation.index_type} (${columns})
        `;

        console.log(`🏗️  Creating index: ${indexName}`);
        
        const beforeMetrics = await this.measureTablePerformance(recommendation.table_name);
        
        await DatabaseService.query(createIndexSQL);
        
        // Wait a bit for index to be built and used
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const afterMetrics = await this.measureTablePerformance(recommendation.table_name);
        const improvement = this.calculateImprovement(beforeMetrics, afterMetrics);

        // Update recommendation status
        await DatabaseService.query(
            'UPDATE index_recommendations SET status = $1, applied_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['applied', recommendation.id]
        );

        // Record optimization
        await this.recordOptimizationApplication(
            OptimizationStrategy.INDEX_CREATION,
            indexName,
            `Created index ${indexName} on ${recommendation.table_name}`,
            beforeMetrics,
            afterMetrics,
            improvement
        );

        console.log(`✅ Index created: ${indexName} (${improvement.toFixed(2)}% improvement)`);
    }

    // Utility methods
    generateQueryHash(queryText) {
        // Simple hash function for query text
        const crypto = require('crypto');
        return crypto.createHash('md5').update(this.normalizeQuery(queryText)).digest('hex');
    }

    normalizeQuery(queryText) {
        // Normalize query by removing parameter values and extra whitespace
        return queryText
            .replace(/\$\d+/g, '$?')           // Replace parameters
            .replace(/'\w+'/g, "'?'")          // Replace string literals
            .replace(/\d+/g, '?')              // Replace numbers
            .replace(/\s+/g, ' ')              // Normalize whitespace
            .trim()
            .toLowerCase();
    }

    extractQueryPattern(queryText) {
        // Extract the basic pattern of the query
        return queryText
            .replace(/\s+/g, ' ')
            .substring(0, 200)
            .toLowerCase();
    }

    extractFilterColumns(filter) {
        // Simple extraction of column names from filter conditions
        const columns = [];
        const matches = filter.match(/\((\w+)\s*[><=]/g);
        if (matches) {
            matches.forEach(match => {
                const column = match.replace(/[()><=\s]/g, '');
                if (column) columns.push(column);
            });
        }
        return columns;
    }

    categorizeQueryPerformance(executionTime) {
        if (executionTime < 10) return QueryPerformanceLevel.EXCELLENT;
        if (executionTime < 50) return QueryPerformanceLevel.GOOD;
        if (executionTime < 200) return QueryPerformanceLevel.ACCEPTABLE;
        if (executionTime < 1000) return QueryPerformanceLevel.SLOW;
        return QueryPerformanceLevel.CRITICAL;
    }

    async analyzeConnectionUsage() {
        // This would typically analyze actual connection pool metrics
        return {
            averageActiveConnections: 8,
            peakConnections: 15,
            averageWaitTime: 50,
            connectionTurnover: 0.8
        };
    }

    calculateOptimalPoolSize(stats) {
        // Simple algorithm to calculate optimal pool size
        const baseSize = Math.ceil(stats.peakConnections * 1.2);
        return Math.max(10, Math.min(50, baseSize)); // Between 10 and 50
    }

    async measureTablePerformance(tableName) {
        // Measure basic performance metrics for a table
        const query = `
            SELECT 
                schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
            FROM pg_stat_user_tables 
            WHERE tablename = $1
        `;
        
        const result = await DatabaseService.query(query, [tableName]);
        return result.rows[0] || {};
    }

    calculateImprovement(before, after) {
        // Calculate performance improvement percentage
        const beforeScore = (before.seq_scan || 0) + (before.idx_scan || 0);
        const afterScore = (after.seq_scan || 0) + (after.idx_scan || 0);
        
        if (beforeScore === 0) return 0;
        return ((afterScore - beforeScore) / beforeScore) * 100;
    }

    async recordOptimizationApplication(type, target, description, beforeMetrics, afterMetrics, improvement) {
        const query = `
            INSERT INTO db_optimizations_applied 
            (optimization_type, target_object, description, before_metrics, after_metrics, improvement_percent)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        await DatabaseService.query(query, [
            type, target, description,
            JSON.stringify(beforeMetrics),
            JSON.stringify(afterMetrics),
            improvement
        ]);
    }

    async recordQueryPerformance(queryHash, queryText, executionTime, rowCount, performanceLevel, error) {
        const query = `
            INSERT INTO query_performance_log 
            (query_hash, query_text, execution_time_ms, rows_returned, performance_level)
            VALUES ($1, $2, $3, $4, $5)
        `;
        
        await DatabaseService.query(query, [
            queryHash, 
            queryText.substring(0, 2000), // Limit query text length
            executionTime, 
            rowCount || 0, 
            performanceLevel
        ]);
    }

    async updateSlowQueryAnalysis(queryHash, queryText, slowQuery, suggestions) {
        const query = `
            INSERT INTO slow_query_analysis 
            (query_hash, query_pattern, total_executions, avg_execution_time_ms, 
             max_execution_time_ms, min_execution_time_ms, total_execution_time_ms, optimization_suggestions)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (query_hash) DO UPDATE SET
                total_executions = $3,
                avg_execution_time_ms = $4,
                max_execution_time_ms = GREATEST(slow_query_analysis.max_execution_time_ms, $5),
                min_execution_time_ms = LEAST(slow_query_analysis.min_execution_time_ms, $6),
                total_execution_time_ms = $7,
                optimization_suggestions = $8,
                last_seen = CURRENT_TIMESTAMP
        `;
        
        await DatabaseService.query(query, [
            queryHash,
            slowQuery.pattern,
            slowQuery.executions,
            slowQuery.avgTime,
            slowQuery.maxTime,
            slowQuery.avgTime, // Using avg as min for simplicity
            slowQuery.totalTime,
            JSON.stringify(suggestions)
        ]);
    }

    async optimizeFrequentQueries() {
        // Implement caching for frequently executed queries
        const frequentQueries = await this.getFrequentQueries();
        
        for (const query of frequentQueries) {
            if (this.shouldCacheQuery(query)) {
                await this.enableQueryCaching(query);
            }
        }
    }

    async getFrequentQueries() {
        const query = `
            SELECT query_hash, query_text, COUNT(*) as execution_count,
                   AVG(execution_time_ms) as avg_time
            FROM query_performance_log 
            WHERE executed_at >= NOW() - INTERVAL '1 hour'
            GROUP BY query_hash, query_text
            HAVING COUNT(*) > 10
            ORDER BY COUNT(*) DESC
            LIMIT 20
        `;
        
        const result = await DatabaseService.query(query);
        return result.rows;
    }

    shouldCacheQuery(queryInfo) {
        // Don't cache INSERT/UPDATE/DELETE queries
        const upperQuery = queryInfo.query_text.toUpperCase();
        return upperQuery.startsWith('SELECT') && 
               queryInfo.avg_time > 100 && 
               queryInfo.execution_count > 20;
    }

    async enableQueryCaching(queryInfo) {
        // This would implement query result caching
        console.log(`🗄️ Enabling caching for frequently executed query: ${queryInfo.query_hash}`);
    }

    async runMaintenanceTasks() {
        // Run ANALYZE on frequently accessed tables
        const query = `
            SELECT schemaname, tablename, n_tup_ins + n_tup_upd + n_tup_del as modifications
            FROM pg_stat_user_tables 
            WHERE n_tup_ins + n_tup_upd + n_tup_del > 1000
            ORDER BY modifications DESC
            LIMIT 10
        `;
        
        const result = await DatabaseService.query(query);
        
        for (const table of result.rows) {
            try {
                await DatabaseService.query(`ANALYZE ${table.schemaname}.${table.tablename}`);
                console.log(`📊 Analyzed table: ${table.schemaname}.${table.tablename}`);
            } catch (error) {
                console.warn(`Failed to analyze table ${table.tablename}:`, error);
            }
        }
    }

    async updateDatabaseStatistics() {
        // Update connection metrics and other statistics
        this.connectionMetrics.totalQueries = this.queryStats.size;
        
        let totalTime = 0;
        let totalCount = 0;
        
        for (const [_, stats] of this.queryStats) {
            totalTime += stats.totalTime;
            totalCount += stats.count;
        }
        
        this.connectionMetrics.averageResponseTime = totalCount > 0 ? totalTime / totalCount : 0;
    }

    async cleanupPerformanceLogs() {
        // Remove old performance logs to prevent table bloat
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        
        const query = `
            DELETE FROM query_performance_log 
            WHERE executed_at < $1
        `;
        
        const result = await DatabaseService.query(query, [cutoffDate]);
        
        if (result.rowCount > 0) {
            console.log(`🧹 Cleaned up ${result.rowCount} old performance log entries`);
        }
    }

    // Public API methods
    async getPerformanceReport() {
        return {
            queryStats: Object.fromEntries(this.queryStats),
            slowQueryCount: this.slowQueries.size,
            connectionMetrics: this.connectionMetrics,
            indexRecommendations: this.indexRecommendations.size,
            optimizationsSuggested: await this.getOptimizationsSummary()
        };
    }

    async getSlowQueries(limit = 20) {
        const query = `
            SELECT * FROM slow_query_analysis 
            ORDER BY avg_execution_time_ms DESC 
            LIMIT $1
        `;
        
        const result = await DatabaseService.query(query, [limit]);
        return result.rows;
    }

    async getOptimizationsSummary() {
        const query = `
            SELECT optimization_type, COUNT(*) as count, 
                   AVG(improvement_percent) as avg_improvement
            FROM db_optimizations_applied 
            WHERE applied_at >= NOW() - INTERVAL '30 days'
            GROUP BY optimization_type
        `;
        
        const result = await DatabaseService.query(query);
        return result.rows;
    }

    async cleanup() {
        this.queryStats.clear();
        this.slowQueries.clear();
        this.indexRecommendations.clear();
        this.queryCache.clear();
        this.preparedStatements.clear();
        
        console.log('✅ Database Performance Optimization Service cleaned up');
    }
}

export default new DatabasePerformanceOptimizationService();
