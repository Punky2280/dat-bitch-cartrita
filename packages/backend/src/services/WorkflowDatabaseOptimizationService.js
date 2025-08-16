// WorkflowDatabaseOptimizationService.js
// Component 7: Database Schema Optimization - Monitoring Service
// Service to monitor and manage database performance optimizations

import { traceOperation } from '../system/OpenTelemetryTracing.js';
import DatabaseService from './DatabaseService.js';

export class WorkflowDatabaseOptimizationService {
    constructor(database = null) {
        this.db = database || DatabaseService;
        this.isInitialized = false;
        this.optimizationSchedule = null;
    }

    async initialize() {
        try {
            await traceOperation('workflow.db.optimization.initialize', async () => {
                // Check if optimization functions exist
                const result = await this.db.query(`
                    SELECT COUNT(*) as function_count 
                    FROM pg_proc p
                    JOIN pg_namespace n ON p.pronamespace = n.oid
                    WHERE n.nspname = 'public' 
                    AND p.proname IN (
                        'analyze_workflow_system_performance',
                        'get_workflow_execution_stats', 
                        'identify_problematic_workflows',
                        'run_workflow_system_maintenance',
                        'archive_old_workflow_executions',
                        'cleanup_workflow_system_data'
                    )
                `);

                if (result.rows[0].function_count < 6) {
                    console.warn('Database optimization functions not fully available');
                }

                this.isInitialized = true;
                console.log('WorkflowDatabaseOptimizationService initialized successfully');
            });
        } catch (error) {
            console.error('Failed to initialize WorkflowDatabaseOptimizationService:', error);
            throw error;
        }
    }

    /**
     * Analyze overall database performance for workflows
     */
    async analyzePerformance() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return await traceOperation('workflow.db.optimization.analyze', async () => {
            try {
                // Get basic table statistics
                const tableStats = await this.db.query(`
                    SELECT 
                        schemaname,
                        relname as tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size,
                        pg_size_pretty(pg_indexes_size(schemaname||'.'||relname)) as index_size,
                        n_tup_ins + n_tup_upd + n_tup_del as total_activity,
                        last_vacuum,
                        last_autovacuum,
                        last_analyze,
                        last_autoanalyze
                    FROM pg_stat_user_tables 
                    WHERE relname IN ('workflows', 'workflow_executions', 'service_integrations', 'integration_executions', 'workflow_schedules')
                    ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
                `);

                // Get index usage statistics
                const indexStats = await this.db.query(`
                    SELECT 
                        schemaname,
                        tablename,
                        indexname,
                        idx_tup_read,
                        idx_tup_fetch,
                        idx_scan,
                        pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size
                    FROM pg_stat_user_indexes 
                    WHERE tablename IN ('workflows', 'workflow_executions', 'service_integrations', 'integration_executions', 'workflow_schedules')
                    ORDER BY idx_scan DESC
                `);

                // Get connection statistics
                const connectionStats = await this.db.query(`
                    SELECT 
                        datname as database_name,
                        COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
                        COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections,
                        COUNT(*) as total_connections
                    FROM pg_stat_activity 
                    WHERE datname = current_database()
                    GROUP BY datname
                `);

                // Get row counts for each table
                const rowCounts = await Promise.all([
                    this.db.query('SELECT COUNT(*) as count FROM workflows'),
                    this.db.query('SELECT COUNT(*) as count FROM workflow_executions'),
                    this.db.query('SELECT COUNT(*) as count FROM service_integrations'),
                    this.db.query('SELECT COUNT(*) as count FROM integration_executions'),
                    this.db.query('SELECT COUNT(*) as count FROM workflow_schedules')
                ]);

                const tableNames = ['workflows', 'workflow_executions', 'service_integrations', 'integration_executions', 'workflow_schedules'];
                const tableRowCounts = {};
                rowCounts.forEach((result, index) => {
                    tableRowCounts[tableNames[index]] = parseInt(result.rows[0].count);
                });

                return {
                    table_statistics: tableStats.rows,
                    index_statistics: indexStats.rows,
                    connection_statistics: connectionStats.rows[0] || {},
                    table_row_counts: tableRowCounts,
                    analysis_timestamp: new Date().toISOString(),
                    recommendations: this.generateRecommendations(tableStats.rows, indexStats.rows, tableRowCounts)
                };
            } catch (error) {
                console.error('Error analyzing database performance:', error);
                throw error;
            }
        });
    }

    /**
     * Get workflow execution statistics for specified number of days
     */
    async getExecutionStats(days = 7) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return await traceOperation('workflow.db.optimization.execution_stats', async () => {
            const result = await this.db.query(`
                SELECT 
                    DATE(we.started_at) as date,
                    COUNT(*) as total_executions,
                    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
                    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
                    COUNT(CASE WHEN we.status IN ('pending', 'running') THEN 1 END) as running_executions,
                    ROUND(AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))), 2) as avg_duration_seconds,
                    ROUND(MAX(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))), 2) as max_duration_seconds
                FROM workflow_executions we
                WHERE we.started_at >= CURRENT_DATE - INTERVAL '${days} days'
                GROUP BY DATE(we.started_at)
                ORDER BY date DESC
            `);

            return result.rows;
        });
    }

    /**
     * Identify workflows with performance issues
     */
    async identifyProblematicWorkflows() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return await traceOperation('workflow.db.optimization.problematic_workflows', async () => {
            const result = await this.db.query(`
                WITH workflow_issues AS (
                    SELECT 
                        w.id as workflow_id,
                        w.name as workflow_name,
                        w.user_id,
                        COUNT(CASE WHEN we.status = 'failed' AND we.started_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_failures,
                        AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at)) * 1000) as avg_duration_ms,
                        MAX(CASE WHEN we.status = 'completed' THEN we.started_at END) as last_success,
                        COUNT(*) as total_executions
                    FROM workflows w
                    LEFT JOIN workflow_executions we ON w.id = we.workflow_id
                    WHERE w.is_active = true
                    GROUP BY w.id, w.name, w.user_id
                )
                SELECT 
                    workflow_id,
                    workflow_name,
                    user_id,
                    recent_failures,
                    ROUND(avg_duration_ms, 2) as avg_duration_ms,
                    last_success,
                    total_executions,
                    CASE 
                        WHEN recent_failures >= 5 THEN 'High Failure Rate'
                        WHEN avg_duration_ms > 60000 THEN 'Slow Execution'
                        WHEN last_success IS NULL AND total_executions > 0 THEN 'Never Successful'
                        WHEN last_success < CURRENT_DATE - INTERVAL '7 days' THEN 'Inactive'
                        WHEN total_executions = 0 THEN 'No Executions'
                        ELSE 'OK'
                    END as issue_type
                FROM workflow_issues
                WHERE recent_failures >= 2
                   OR avg_duration_ms > 30000 
                   OR (last_success IS NULL AND total_executions > 0)
                   OR last_success < CURRENT_DATE - INTERVAL '7 days'
                ORDER BY recent_failures DESC, avg_duration_ms DESC NULLS LAST
            `);

            return result.rows;
        });
    }

    /**
     * Run comprehensive database maintenance
     */
    async runMaintenance(options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const {
            archiveDays = 90,
            cleanupDays = 30,
            analyzeOnly = false
        } = options;

        return await traceOperation('workflow.db.optimization.maintenance', async () => {
            const maintenanceResults = [];

            try {
                // Update table statistics
                if (!analyzeOnly) {
                    const analyzeStart = Date.now();
                    await this.db.query('ANALYZE workflows, workflow_executions, service_integrations, integration_executions, workflow_schedules');
                    const analyzeDuration = Date.now() - analyzeStart;
                    
                    maintenanceResults.push({
                        task: 'Update Statistics',
                        status: 'SUCCESS',
                        duration: `${analyzeDuration}ms`,
                        details: 'Table statistics updated'
                    });
                }

                // Archive old executions
                if (!analyzeOnly) {
                    const archiveStart = Date.now();
                    const archiveResult = await this.db.query(`
                        WITH archived_executions AS (
                            DELETE FROM workflow_executions 
                            WHERE started_at < CURRENT_DATE - INTERVAL '${archiveDays} days' 
                            AND status IN ('completed', 'failed', 'cancelled')
                            RETURNING id
                        )
                        SELECT COUNT(*) as archived_count FROM archived_executions
                    `);
                    const archiveDuration = Date.now() - archiveStart;

                    maintenanceResults.push({
                        task: 'Archive Old Executions',
                        status: 'SUCCESS',
                        duration: `${archiveDuration}ms`,
                        details: `Archived ${archiveResult.rows[0].archived_count} old executions`
                    });
                }

                // Clean up integration data
                if (!analyzeOnly) {
                    const cleanupStart = Date.now();
                    const cleanupResults = await Promise.all([
                        this.db.query(`DELETE FROM integration_webhook_events WHERE received_at < CURRENT_DATE - INTERVAL '${cleanupDays} days'`),
                        this.db.query(`DELETE FROM integration_health_checks WHERE checked_at < CURRENT_DATE - INTERVAL '${cleanupDays} days'`),
                        this.db.query(`DELETE FROM integration_rate_limits WHERE time_window_start < CURRENT_DATE - INTERVAL '7 days'`)
                    ]);
                    const cleanupDuration = Date.now() - cleanupStart;

                    const totalCleaned = cleanupResults.reduce((sum, result) => sum + result.rowCount, 0);

                    maintenanceResults.push({
                        task: 'Cleanup Old Data',
                        status: 'SUCCESS',
                        duration: `${cleanupDuration}ms`,
                        details: `Cleaned up ${totalCleaned} old records`
                    });
                }

                // Refresh materialized views if they exist
                const refreshStart = Date.now();
                try {
                    const viewsResult = await this.db.query(`
                        SELECT matviewname FROM pg_matviews 
                        WHERE matviewname IN ('integration_performance_overview', 'integration_usage_analytics')
                    `);

                    for (const view of viewsResult.rows) {
                        await this.db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view.matviewname}`);
                    }

                    const refreshDuration = Date.now() - refreshStart;
                    maintenanceResults.push({
                        task: 'Refresh Views',
                        status: 'SUCCESS',
                        duration: `${refreshDuration}ms`,
                        details: `Refreshed ${viewsResult.rows.length} materialized views`
                    });
                } catch (error) {
                    const refreshDuration = Date.now() - refreshStart;
                    maintenanceResults.push({
                        task: 'Refresh Views',
                        status: 'WARNING',
                        duration: `${refreshDuration}ms`,
                        details: 'Some materialized views may not exist yet'
                    });
                }

                return {
                    maintenance_completed: true,
                    total_tasks: maintenanceResults.length,
                    results: maintenanceResults,
                    timestamp: new Date().toISOString()
                };

            } catch (error) {
                maintenanceResults.push({
                    task: 'Maintenance Error',
                    status: 'ERROR',
                    duration: '0ms',
                    details: error.message
                });

                return {
                    maintenance_completed: false,
                    total_tasks: maintenanceResults.length,
                    results: maintenanceResults,
                    timestamp: new Date().toISOString(),
                    error: error.message
                };
            }
        });
    }

    /**
     * Get database performance recommendations
     */
    async getPerformanceRecommendations() {
        const analysis = await this.analyzePerformance();
        const problematicWorkflows = await this.identifyProblematicWorkflows();
        
        const recommendations = [];

        // Check for large tables needing archiving
        for (const [tableName, rowCount] of Object.entries(analysis.table_row_counts)) {
            if (rowCount > 100000) {
                recommendations.push({
                    category: 'Maintenance',
                    recommendation: `Table ${tableName} has ${rowCount.toLocaleString()} rows - consider archiving old data`,
                    priority: rowCount > 500000 ? 'High' : 'Medium',
                    impact: 'Reduced storage and faster queries'
                });
            }
        }

        // Check for high failure rate workflows
        const highFailureWorkflows = problematicWorkflows.filter(w => w.issue_type === 'High Failure Rate');
        if (highFailureWorkflows.length > 0) {
            recommendations.push({
                category: 'Workflow Health',
                recommendation: `${highFailureWorkflows.length} workflows have high failure rates - investigate and fix`,
                priority: 'High',
                impact: 'Improved workflow reliability and performance'
            });
        }

        // Check for slow workflows
        const slowWorkflows = problematicWorkflows.filter(w => w.issue_type === 'Slow Execution');
        if (slowWorkflows.length > 0) {
            recommendations.push({
                category: 'Performance',
                recommendation: `${slowWorkflows.length} workflows have slow execution times - optimize workflow logic`,
                priority: 'Medium',
                impact: 'Faster workflow execution and better user experience'
            });
        }

        // Check for unused indexes
        const unusedIndexes = analysis.index_statistics.filter(idx => idx.idx_scan === 0 || idx.idx_scan === '0');
        if (unusedIndexes.length > 0) {
            recommendations.push({
                category: 'Indexing',
                recommendation: `${unusedIndexes.length} indexes are unused - consider dropping to save space`,
                priority: 'Low',
                impact: 'Reduced storage overhead and faster writes'
            });
        }

        // Check vacuum/analyze status
        const needsVacuum = analysis.table_statistics.filter(table => {
            const lastVacuum = table.last_vacuum || table.last_autovacuum;
            return !lastVacuum || new Date(lastVacuum) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        });

        if (needsVacuum.length > 0) {
            recommendations.push({
                category: 'Maintenance',
                recommendation: `${needsVacuum.length} tables need vacuum - run maintenance procedure`,
                priority: 'Medium',
                impact: 'Improved query performance and space reclamation'
            });
        }

        return recommendations;
    }

    /**
     * Generate optimization recommendations based on analysis
     */
    generateRecommendations(tableStats, indexStats, rowCounts) {
        const recommendations = [];

        // Check for tables that need vacuum
        const needsVacuum = tableStats.filter(table => {
            const lastVacuum = table.last_vacuum || table.last_autovacuum;
            return !lastVacuum || new Date(lastVacuum) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        });

        if (needsVacuum.length > 0) {
            recommendations.push({
                type: 'maintenance',
                priority: 'medium',
                message: `${needsVacuum.length} tables need vacuum maintenance`,
                action: 'Run VACUUM ANALYZE on affected tables'
            });
        }

        // Check for large tables
        Object.entries(rowCounts).forEach(([tableName, count]) => {
            if (count > 100000) {
                recommendations.push({
                    type: 'archiving',
                    priority: count > 500000 ? 'high' : 'medium',
                    message: `Table ${tableName} has ${count.toLocaleString()} rows`,
                    action: 'Consider archiving old records'
                });
            }
        });

        // Check for unused indexes
        const unusedIndexes = indexStats.filter(idx => idx.idx_scan === 0 || idx.idx_scan === '0');
        if (unusedIndexes.length > 3) {
            recommendations.push({
                type: 'indexing',
                priority: 'low',
                message: `${unusedIndexes.length} indexes are unused`,
                action: 'Review and consider dropping unused indexes'
            });
        }

        return recommendations;
    }

    /**
     * Schedule automatic maintenance
     */
    scheduleAutomaticMaintenance(intervalHours = 24) {
        if (this.optimizationSchedule) {
            clearInterval(this.optimizationSchedule);
        }

        this.optimizationSchedule = setInterval(async () => {
            try {
                console.log('Running scheduled database maintenance...');
                const result = await this.runMaintenance({ analyzeOnly: false });
                console.log('Scheduled maintenance completed:', result);
            } catch (error) {
                console.error('Scheduled maintenance failed:', error);
            }
        }, intervalHours * 60 * 60 * 1000);

        console.log(`Database maintenance scheduled every ${intervalHours} hours`);
    }

    /**
     * Cancel scheduled maintenance
     */
    cancelScheduledMaintenance() {
        if (this.optimizationSchedule) {
            clearInterval(this.optimizationSchedule);
            this.optimizationSchedule = null;
            console.log('Scheduled database maintenance cancelled');
        }
    }

    /**
     * Get system health metrics
     */
    async getSystemHealth() {
        return await traceOperation('workflow.db.optimization.health', async () => {
            const analysis = await this.analyzePerformance();
            const problematicWorkflows = await this.identifyProblematicWorkflows();
            const recommendations = await this.getPerformanceRecommendations();

            const healthScore = this.calculateHealthScore(analysis, problematicWorkflows, recommendations);

            return {
                health_score: healthScore,
                status: healthScore >= 90 ? 'excellent' : healthScore >= 75 ? 'good' : healthScore >= 50 ? 'fair' : 'poor',
                database_size: analysis.table_statistics.reduce((total, table) => {
                    // Extract numeric value from size strings like "1024 kB"
                    const sizeMatch = table.table_size.match(/(\d+)/);
                    return total + (sizeMatch ? parseInt(sizeMatch[1]) : 0);
                }, 0),
                total_workflows: analysis.table_row_counts.workflows || 0,
                total_executions: analysis.table_row_counts.workflow_executions || 0,
                problematic_workflows: problematicWorkflows.length,
                high_priority_recommendations: recommendations.filter(r => r.priority === 'High').length,
                last_analysis: analysis.analysis_timestamp
            };
        });
    }

    /**
     * Calculate overall system health score
     */
    calculateHealthScore(analysis, problematicWorkflows, recommendations) {
        let score = 100;

        // Deduct for problematic workflows
        const highFailureWorkflows = problematicWorkflows.filter(w => w.issue_type === 'High Failure Rate').length;
        const slowWorkflows = problematicWorkflows.filter(w => w.issue_type === 'Slow Execution').length;
        
        score -= highFailureWorkflows * 10; // -10 per high failure workflow
        score -= slowWorkflows * 5; // -5 per slow workflow

        // Deduct for high priority recommendations
        const highPriorityRecs = recommendations.filter(r => r.priority === 'High').length;
        score -= highPriorityRecs * 15; // -15 per high priority recommendation

        // Deduct for maintenance issues
        const needsVacuum = analysis.table_statistics.filter(table => {
            const lastVacuum = table.last_vacuum || table.last_autovacuum;
            return !lastVacuum || new Date(lastVacuum) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }).length;

        score -= needsVacuum * 5; // -5 per table needing vacuum

        // Ensure score doesn't go below 0
        return Math.max(0, Math.round(score));
    }
}

export default WorkflowDatabaseOptimizationService;
