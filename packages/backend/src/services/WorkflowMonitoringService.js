// WorkflowMonitoringService.js
// Component 4: Workflow Monitoring Dashboard - Backend Service
// Real-time monitoring dashboard with execution status, performance metrics, error tracking, resource utilization

import DatabaseService from './DatabaseService.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { EventEmitter } from 'events';

/**
 * Comprehensive workflow monitoring service for real-time dashboard
 * Provides performance metrics, execution tracking, error analysis, and resource monitoring
 */
class WorkflowMonitoringService extends EventEmitter {
    constructor() {
        super();
        this.metricsCache = new Map();
        this.alertThresholds = {
            executionTime: 300000, // 5 minutes in milliseconds
            errorRate: 0.1, // 10%
            queueDepth: 100,
            memoryUsage: 0.8, // 80%
            cpuUsage: 0.8 // 80%
        };
        this.alertCooldown = new Map();
        this.realTimeMetrics = {
            activeExecutions: 0,
            queuedWorkflows: 0,
            completedToday: 0,
            failedToday: 0,
            avgExecutionTime: 0,
            systemLoad: 0
        };
        
        // Only initialize periodic updates in production or when explicitly enabled
        if (process.env.NODE_ENV === 'production' || process.env.ENABLE_MONITORING_TIMERS === 'true') {
            this.initializePeriodicUpdates();
        }
    }

    /**
     * Initialize periodic metric updates and monitoring
     */
    initializePeriodicUpdates() {
        // Update real-time metrics every 10 seconds
        setInterval(() => {
            this.updateRealTimeMetrics();
        }, 10000);

        // Update hourly aggregate metrics every hour
        setInterval(() => {
            this.updateHourlyMetrics();
        }, 3600000);

        // Check for alerts every 30 seconds
        setInterval(() => {
            this.checkAlerts();
        }, 30000);

        // Clean up old metrics every day
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 86400000);
    }

    /**
     * Get comprehensive dashboard overview
     */
    async getDashboardOverview(userId, timeRange = '24h') {
        return await OpenTelemetryTracing.traceOperation('workflow.monitoring.dashboard_overview', async () => {
            const now = new Date();
            const startTime = this.getStartTimeForRange(timeRange);

            const [
                executionStats,
                performanceMetrics,
                errorAnalysis,
                resourceUtilization,
                topWorkflows,
                recentExecutions,
                alerts
            ] = await Promise.all([
                this.getExecutionStatistics(userId, startTime, now),
                this.getPerformanceMetrics(userId, startTime, now),
                this.getErrorAnalysis(userId, startTime, now),
                this.getResourceUtilization(startTime, now),
                this.getTopWorkflows(userId, startTime, now),
                this.getRecentExecutions(userId, 10),
                this.getActiveAlerts(userId)
            ]);

            return {
                executionStats,
                performanceMetrics,
                errorAnalysis,
                resourceUtilization,
                topWorkflows,
                recentExecutions,
                alerts,
                realTimeMetrics: this.realTimeMetrics,
                timeRange,
                generatedAt: now.toISOString()
            };
        });
    }

    /**
     * Get execution statistics for time range
     */
    async getExecutionStatistics(userId, startTime, endTime) {
        const query = `
            SELECT 
                COUNT(*) as total_executions,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_executions,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
                COUNT(CASE WHEN status = 'running' THEN 1 END) as running_executions,
                COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_executions,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_executions,
                AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_execution_time_seconds,
                MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_execution_time_seconds,
                MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_execution_time_seconds,
                COUNT(DISTINCT workflow_id) as unique_workflows_executed,
                SUM(nodes_executed) as total_nodes_executed,
                AVG(nodes_executed) as avg_nodes_per_execution
            FROM workflow_executions we
            LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
            WHERE we.started_at BETWEEN $1 AND $2
                AND ($3 IS NULL OR wd.created_by = $3)
        `;

        const result = await DatabaseService.query(query, [startTime, endTime, userId]);
        const stats = result.rows[0];

        // Calculate success rate and other derived metrics
        const totalExecutions = parseInt(stats.total_executions) || 0;
        const completedExecutions = parseInt(stats.completed_executions) || 0;
        const failedExecutions = parseInt(stats.failed_executions) || 0;

        return {
            totalExecutions,
            completedExecutions,
            failedExecutions,
            runningExecutions: parseInt(stats.running_executions) || 0,
            pausedExecutions: parseInt(stats.paused_executions) || 0,
            cancelledExecutions: parseInt(stats.cancelled_executions) || 0,
            successRate: totalExecutions > 0 ? (completedExecutions / totalExecutions) : 0,
            failureRate: totalExecutions > 0 ? (failedExecutions / totalExecutions) : 0,
            avgExecutionTime: parseFloat(stats.avg_execution_time_seconds) || 0,
            minExecutionTime: parseFloat(stats.min_execution_time_seconds) || 0,
            maxExecutionTime: parseFloat(stats.max_execution_time_seconds) || 0,
            uniqueWorkflowsExecuted: parseInt(stats.unique_workflows_executed) || 0,
            totalNodesExecuted: parseInt(stats.total_nodes_executed) || 0,
            avgNodesPerExecution: parseFloat(stats.avg_nodes_per_execution) || 0
        };
    }

    /**
     * Get performance metrics with time series data
     */
    async getPerformanceMetrics(userId, startTime, endTime) {
        const query = `
            SELECT 
                DATE_TRUNC('hour', started_at) as hour,
                COUNT(*) as executions_count,
                AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_execution_time,
                MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_execution_time,
                MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_execution_time,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
                AVG(nodes_executed) as avg_nodes_executed,
                SUM(COALESCE(memory_usage_mb, 0)) as total_memory_usage,
                AVG(COALESCE(cpu_usage_percent, 0)) as avg_cpu_usage
            FROM workflow_executions we
            LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
            WHERE we.started_at BETWEEN $1 AND $2
                AND ($3 IS NULL OR wd.created_by = $3)
            GROUP BY DATE_TRUNC('hour', started_at)
            ORDER BY hour
        `;

        const result = await DatabaseService.query(query, [startTime, endTime, userId]);
        
        const timeSeries = result.rows.map(row => ({
            timestamp: row.hour,
            executionsCount: parseInt(row.executions_count) || 0,
            avgExecutionTime: parseFloat(row.avg_execution_time) || 0,
            maxExecutionTime: parseFloat(row.max_execution_time) || 0,
            minExecutionTime: parseFloat(row.min_execution_time) || 0,
            successfulExecutions: parseInt(row.successful_executions) || 0,
            failedExecutions: parseInt(row.failed_executions) || 0,
            successRate: row.executions_count > 0 ? 
                (parseInt(row.successful_executions) || 0) / parseInt(row.executions_count) : 0,
            avgNodesExecuted: parseFloat(row.avg_nodes_executed) || 0,
            totalMemoryUsage: parseFloat(row.total_memory_usage) || 0,
            avgCpuUsage: parseFloat(row.avg_cpu_usage) || 0
        }));

        // Calculate performance trends
        const performance = this.calculatePerformanceTrends(timeSeries);

        return {
            timeSeries,
            trends: performance.trends,
            averages: performance.averages,
            peaks: performance.peaks
        };
    }

    /**
     * Get comprehensive error analysis
     */
    async getErrorAnalysis(userId, startTime, endTime) {
        const errorTypesQuery = `
            SELECT 
                error_type,
                COUNT(*) as count,
                COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
            FROM workflow_execution_logs wel
            LEFT JOIN workflow_executions we ON wel.execution_id = we.id
            LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
            WHERE wel.level = 'error' 
                AND wel.timestamp BETWEEN $1 AND $2
                AND ($3 IS NULL OR wd.created_by = $3)
                AND error_type IS NOT NULL
            GROUP BY error_type
            ORDER BY count DESC
            LIMIT 10
        `;

        const errorPatternsQuery = `
            SELECT 
                node_id,
                node_type,
                COUNT(*) as error_count,
                ARRAY_AGG(DISTINCT error_message) as error_messages,
                AVG(EXTRACT(EPOCH FROM (timestamp - we.started_at))) as avg_time_to_error
            FROM workflow_execution_logs wel
            LEFT JOIN workflow_executions we ON wel.execution_id = we.id
            LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
            WHERE wel.level = 'error' 
                AND wel.timestamp BETWEEN $1 AND $2
                AND ($3 IS NULL OR wd.created_by = $3)
            GROUP BY node_id, node_type
            HAVING COUNT(*) > 1
            ORDER BY error_count DESC
            LIMIT 10
        `;

        const errorTimelineQuery = `
            SELECT 
                DATE_TRUNC('hour', timestamp) as hour,
                COUNT(*) as error_count,
                COUNT(DISTINCT wel.execution_id) as executions_with_errors,
                ARRAY_AGG(DISTINCT error_type) as error_types
            FROM workflow_execution_logs wel
            LEFT JOIN workflow_executions we ON wel.execution_id = we.id
            LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
            WHERE wel.level = 'error' 
                AND wel.timestamp BETWEEN $1 AND $2
                AND ($3 IS NULL OR wd.created_by = $3)
            GROUP BY DATE_TRUNC('hour', timestamp)
            ORDER BY hour
        `;

        const [errorTypesResult, errorPatternsResult, errorTimelineResult] = await Promise.all([
            DatabaseService.query(errorTypesQuery, [startTime, endTime, userId]),
            DatabaseService.query(errorPatternsQuery, [startTime, endTime, userId]),
            DatabaseService.query(errorTimelineQuery, [startTime, endTime, userId])
        ]);

        const errorTypes = errorTypesResult.rows.map(row => ({
            type: row.error_type,
            count: parseInt(row.count),
            percentage: parseFloat(row.percentage)
        }));

        const errorPatterns = errorPatternsResult.rows.map(row => ({
            nodeId: row.node_id,
            nodeType: row.node_type,
            errorCount: parseInt(row.error_count),
            errorMessages: row.error_messages,
            avgTimeToError: parseFloat(row.avg_time_to_error)
        }));

        const errorTimeline = errorTimelineResult.rows.map(row => ({
            timestamp: row.hour,
            errorCount: parseInt(row.error_count),
            executionsWithErrors: parseInt(row.executions_with_errors),
            errorTypes: row.error_types
        }));

        return {
            errorTypes,
            errorPatterns,
            errorTimeline,
            totalErrors: errorTypes.reduce((sum, type) => sum + type.count, 0),
            mostCommonError: errorTypes[0]?.type || 'N/A',
            errorRate: this.calculateErrorRate(errorTimeline)
        };
    }

    /**
     * Get resource utilization metrics
     */
    async getResourceUtilization(startTime, endTime) {
        const query = `
            SELECT 
                DATE_TRUNC('hour', started_at) as hour,
                AVG(COALESCE(memory_usage_mb, 0)) as avg_memory_usage,
                MAX(COALESCE(memory_usage_mb, 0)) as max_memory_usage,
                AVG(COALESCE(cpu_usage_percent, 0)) as avg_cpu_usage,
                MAX(COALESCE(cpu_usage_percent, 0)) as max_cpu_usage,
                COUNT(CASE WHEN status = 'running' THEN 1 END) as concurrent_executions,
                COUNT(*) as total_executions
            FROM workflow_executions
            WHERE started_at BETWEEN $1 AND $2
            GROUP BY DATE_TRUNC('hour', started_at)
            ORDER BY hour
        `;

        const result = await DatabaseService.query(query, [startTime, endTime]);
        
        const utilization = result.rows.map(row => ({
            timestamp: row.hour,
            avgMemoryUsage: parseFloat(row.avg_memory_usage) || 0,
            maxMemoryUsage: parseFloat(row.max_memory_usage) || 0,
            avgCpuUsage: parseFloat(row.avg_cpu_usage) || 0,
            maxCpuUsage: parseFloat(row.max_cpu_usage) || 0,
            concurrentExecutions: parseInt(row.concurrent_executions) || 0,
            totalExecutions: parseInt(row.total_executions) || 0
        }));

        const systemMetrics = await this.getSystemMetrics();

        return {
            timeline: utilization,
            currentSystemLoad: systemMetrics,
            averages: {
                memoryUsage: utilization.reduce((sum, u) => sum + u.avgMemoryUsage, 0) / utilization.length || 0,
                cpuUsage: utilization.reduce((sum, u) => sum + u.avgCpuUsage, 0) / utilization.length || 0,
                concurrentExecutions: utilization.reduce((sum, u) => sum + u.concurrentExecutions, 0) / utilization.length || 0
            },
            peaks: {
                memoryUsage: Math.max(...utilization.map(u => u.maxMemoryUsage), 0),
                cpuUsage: Math.max(...utilization.map(u => u.maxCpuUsage), 0),
                concurrentExecutions: Math.max(...utilization.map(u => u.concurrentExecutions), 0)
            }
        };
    }

    /**
     * Get top performing workflows
     */
    async getTopWorkflows(userId, startTime, endTime) {
        const query = `
            SELECT 
                wd.id,
                wd.name,
                wd.category,
                COUNT(we.id) as execution_count,
                COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
                COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
                AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))) as avg_execution_time,
                SUM(COALESCE(we.nodes_executed, 0)) as total_nodes_executed,
                AVG(COALESCE(we.memory_usage_mb, 0)) as avg_memory_usage,
                MAX(we.started_at) as last_execution
            FROM workflow_definitions wd
            LEFT JOIN workflow_executions we ON wd.id = we.workflow_id 
                AND we.started_at BETWEEN $1 AND $2
            WHERE ($3 IS NULL OR wd.created_by = $3)
                AND we.id IS NOT NULL
            GROUP BY wd.id, wd.name, wd.category
            HAVING COUNT(we.id) > 0
            ORDER BY execution_count DESC, successful_executions DESC
            LIMIT 20
        `;

        const result = await DatabaseService.query(query, [startTime, endTime, userId]);
        
        return result.rows.map(row => ({
            workflowId: row.id,
            name: row.name,
            category: row.category,
            executionCount: parseInt(row.execution_count) || 0,
            successfulExecutions: parseInt(row.successful_executions) || 0,
            failedExecutions: parseInt(row.failed_executions) || 0,
            successRate: row.execution_count > 0 ? 
                (parseInt(row.successful_executions) || 0) / parseInt(row.execution_count) : 0,
            avgExecutionTime: parseFloat(row.avg_execution_time) || 0,
            totalNodesExecuted: parseInt(row.total_nodes_executed) || 0,
            avgMemoryUsage: parseFloat(row.avg_memory_usage) || 0,
            lastExecution: row.last_execution,
            performance: this.calculateWorkflowPerformance(row)
        }));
    }

    /**
     * Get recent workflow executions
     */
    async getRecentExecutions(userId, limit = 50) {
        const query = `
            SELECT 
                we.id,
                we.workflow_id,
                wd.name as workflow_name,
                we.status,
                we.started_at,
                we.completed_at,
                we.nodes_executed,
                we.current_node_id,
                EXTRACT(EPOCH FROM (COALESCE(we.completed_at, NOW()) - we.started_at)) as duration_seconds,
                we.memory_usage_mb,
                we.cpu_usage_percent,
                we.trigger_type,
                (
                    SELECT COUNT(*) 
                    FROM workflow_execution_logs wel 
                    WHERE wel.execution_id = we.id AND wel.level = 'error'
                ) as error_count,
                (
                    SELECT COUNT(*) 
                    FROM workflow_execution_logs wel 
                    WHERE wel.execution_id = we.id AND wel.level = 'warn'
                ) as warning_count
            FROM workflow_executions we
            LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
            WHERE ($1 IS NULL OR wd.created_by = $1)
            ORDER BY we.started_at DESC
            LIMIT $2
        `;

        const result = await DatabaseService.query(query, [userId, limit]);
        
        return result.rows.map(row => ({
            executionId: row.id,
            workflowId: row.workflow_id,
            workflowName: row.workflow_name,
            status: row.status,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            duration: parseFloat(row.duration_seconds) || 0,
            nodesExecuted: parseInt(row.nodes_executed) || 0,
            currentNodeId: row.current_node_id,
            memoryUsage: parseFloat(row.memory_usage_mb) || 0,
            cpuUsage: parseFloat(row.cpu_usage_percent) || 0,
            triggerType: row.trigger_type,
            errorCount: parseInt(row.error_count) || 0,
            warningCount: parseInt(row.warning_count) || 0,
            healthStatus: this.calculateExecutionHealthStatus(row)
        }));
    }

    /**
     * Get active alerts
     */
    async getActiveAlerts(userId) {
        const query = `
            SELECT 
                id,
                alert_type,
                severity,
                title,
                message,
                workflow_id,
                execution_id,
                created_at,
                acknowledged_at,
                resolved_at,
                metadata
            FROM workflow_monitoring_alerts
            WHERE resolved_at IS NULL
                AND ($1 IS NULL OR user_id = $1)
            ORDER BY severity DESC, created_at DESC
            LIMIT 50
        `;

        const result = await DatabaseService.query(query, [userId]);
        
        return result.rows.map(row => ({
            id: row.id,
            type: row.alert_type,
            severity: row.severity,
            title: row.title,
            message: row.message,
            workflowId: row.workflow_id,
            executionId: row.execution_id,
            createdAt: row.created_at,
            acknowledgedAt: row.acknowledged_at,
            isAcknowledged: !!row.acknowledged_at,
            metadata: row.metadata,
            age: Date.now() - new Date(row.created_at).getTime()
        }));
    }

    /**
     * Update real-time metrics
     */
    async updateRealTimeMetrics() {
        try {
            const activeExecutionsQuery = `
                SELECT COUNT(*) as active_count
                FROM workflow_executions
                WHERE status IN ('running', 'paused')
            `;

            const queuedWorkflowsQuery = `
                SELECT COUNT(*) as queued_count
                FROM workflow_execution_queue
                WHERE status = 'queued'
            `;

            const todayStatsQuery = `
                SELECT 
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_today,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_today,
                    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_execution_time
                FROM workflow_executions
                WHERE DATE(started_at) = CURRENT_DATE
            `;

            const [activeResult, queuedResult, todayResult] = await Promise.all([
                DatabaseService.query(activeExecutionsQuery),
                DatabaseService.query(queuedWorkflowsQuery),
                DatabaseService.query(todayStatsQuery)
            ]);

            const systemMetrics = await this.getSystemMetrics();

            this.realTimeMetrics = {
                activeExecutions: parseInt(activeResult.rows[0].active_count) || 0,
                queuedWorkflows: parseInt(queuedResult.rows[0].queued_count) || 0,
                completedToday: parseInt(todayResult.rows[0].completed_today) || 0,
                failedToday: parseInt(todayResult.rows[0].failed_today) || 0,
                avgExecutionTime: parseFloat(todayResult.rows[0].avg_execution_time) || 0,
                systemLoad: systemMetrics.loadAverage,
                memoryUsage: systemMetrics.memoryUsage,
                cpuUsage: systemMetrics.cpuUsage,
                lastUpdated: new Date().toISOString()
            };

            // Emit real-time update event
            this.emit('metrics-updated', this.realTimeMetrics);

        } catch (error) {
            console.error('Error updating real-time metrics:', error);
        }
    }

    /**
     * Check for alerts based on thresholds
     */
    async checkAlerts() {
        try {
            const checks = [
                this.checkExecutionTimeAlerts(),
                this.checkErrorRateAlerts(),
                this.checkQueueDepthAlerts(),
                this.checkResourceAlerts(),
                this.checkFailurePatternAlerts()
            ];

            await Promise.all(checks);
        } catch (error) {
            console.error('Error checking alerts:', error);
        }
    }

    /**
     * Check for long-running execution alerts
     */
    async checkExecutionTimeAlerts() {
        const query = `
            SELECT 
                we.id,
                we.workflow_id,
                wd.name as workflow_name,
                we.started_at,
                EXTRACT(EPOCH FROM (NOW() - we.started_at)) as duration_seconds
            FROM workflow_executions we
            LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
            WHERE we.status = 'running'
                AND EXTRACT(EPOCH FROM (NOW() - we.started_at)) > $1
                AND NOT EXISTS (
                    SELECT 1 FROM workflow_monitoring_alerts wma 
                    WHERE wma.execution_id = we.id 
                        AND wma.alert_type = 'long_execution'
                        AND wma.resolved_at IS NULL
                )
        `;

        const result = await DatabaseService.query(query, [this.alertThresholds.executionTime / 1000]);
        
        for (const row of result.rows) {
            await this.createAlert({
                type: 'long_execution',
                severity: 'warning',
                title: 'Long Running Execution',
                message: `Workflow "${row.workflow_name}" has been running for ${Math.round(row.duration_seconds / 60)} minutes`,
                workflowId: row.workflow_id,
                executionId: row.id,
                metadata: {
                    duration: row.duration_seconds,
                    threshold: this.alertThresholds.executionTime / 1000
                }
            });
        }
    }

    /**
     * Check error rate alerts
     */
    async checkErrorRateAlerts() {
        const query = `
            SELECT 
                we.workflow_id,
                wd.name as workflow_name,
                COUNT(*) as total_executions,
                COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
                COUNT(CASE WHEN we.status = 'failed' THEN 1 END)::float / COUNT(*) as error_rate
            FROM workflow_executions we
            LEFT JOIN workflow_definitions wd ON we.workflow_id = wd.id
            WHERE we.started_at >= NOW() - INTERVAL '1 hour'
            GROUP BY we.workflow_id, wd.name
            HAVING COUNT(*) >= 5 
                AND COUNT(CASE WHEN we.status = 'failed' THEN 1 END)::float / COUNT(*) > $1
        `;

        const result = await DatabaseService.query(query, [this.alertThresholds.errorRate]);
        
        for (const row of result.rows) {
            const alertKey = `error_rate_${row.workflow_id}`;
            if (this.isInCooldown(alertKey)) continue;

            await this.createAlert({
                type: 'high_error_rate',
                severity: 'critical',
                title: 'High Error Rate',
                message: `Workflow "${row.workflow_name}" has ${(row.error_rate * 100).toFixed(1)}% error rate (${row.failed_executions}/${row.total_executions})`,
                workflowId: row.workflow_id,
                metadata: {
                    errorRate: row.error_rate,
                    failedExecutions: parseInt(row.failed_executions),
                    totalExecutions: parseInt(row.total_executions),
                    threshold: this.alertThresholds.errorRate
                }
            });

            this.setCooldown(alertKey, 3600000); // 1 hour cooldown
        }
    }

    /**
     * Create alert record
     */
    async createAlert(alert) {
        const query = `
            INSERT INTO workflow_monitoring_alerts 
                (alert_type, severity, title, message, workflow_id, execution_id, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id
        `;

        const result = await DatabaseService.query(query, [
            alert.type,
            alert.severity,
            alert.title,
            alert.message,
            alert.workflowId,
            alert.executionId,
            JSON.stringify(alert.metadata)
        ]);

        const alertId = result.rows[0].id;

        // Emit alert event
        this.emit('alert-created', {
            id: alertId,
            ...alert,
            createdAt: new Date().toISOString()
        });

        return alertId;
    }

    /**
     * Helper methods
     */
    getStartTimeForRange(range) {
        const now = new Date();
        switch (range) {
            case '1h':
                return new Date(now.getTime() - 3600000);
            case '6h':
                return new Date(now.getTime() - 21600000);
            case '24h':
                return new Date(now.getTime() - 86400000);
            case '7d':
                return new Date(now.getTime() - 604800000);
            case '30d':
                return new Date(now.getTime() - 2592000000);
            default:
                return new Date(now.getTime() - 86400000);
        }
    }

    calculatePerformanceTrends(timeSeries) {
        if (timeSeries.length < 2) {
            return { trends: {}, averages: {}, peaks: {} };
        }

        const latest = timeSeries.slice(-5); // Last 5 data points
        const earlier = timeSeries.slice(0, -5);

        return {
            trends: {
                executionTime: this.calculateTrend(earlier.map(t => t.avgExecutionTime), latest.map(t => t.avgExecutionTime)),
                successRate: this.calculateTrend(earlier.map(t => t.successRate), latest.map(t => t.successRate)),
                throughput: this.calculateTrend(earlier.map(t => t.executionsCount), latest.map(t => t.executionsCount))
            },
            averages: {
                executionTime: timeSeries.reduce((sum, t) => sum + t.avgExecutionTime, 0) / timeSeries.length,
                successRate: timeSeries.reduce((sum, t) => sum + t.successRate, 0) / timeSeries.length,
                throughput: timeSeries.reduce((sum, t) => sum + t.executionsCount, 0) / timeSeries.length
            },
            peaks: {
                executionTime: Math.max(...timeSeries.map(t => t.maxExecutionTime)),
                throughput: Math.max(...timeSeries.map(t => t.executionsCount)),
                concurrency: Math.max(...timeSeries.map(t => t.executionsCount))
            }
        };
    }

    calculateTrend(earlier, latest) {
        if (earlier.length === 0 || latest.length === 0) return 0;
        
        const earlierAvg = earlier.reduce((sum, val) => sum + val, 0) / earlier.length;
        const latestAvg = latest.reduce((sum, val) => sum + val, 0) / latest.length;
        
        if (earlierAvg === 0) return 0;
        return ((latestAvg - earlierAvg) / earlierAvg) * 100;
    }

    calculateErrorRate(timeline) {
        if (timeline.length === 0) return 0;
        
        const totalErrors = timeline.reduce((sum, t) => sum + t.errorCount, 0);
        const totalExecutions = timeline.reduce((sum, t) => sum + t.executionsWithErrors, 0);
        
        return totalExecutions > 0 ? totalErrors / totalExecutions : 0;
    }

    calculateWorkflowPerformance(row) {
        const successRate = row.execution_count > 0 ? 
            (parseInt(row.successful_executions) || 0) / parseInt(row.execution_count) : 0;
        const avgTime = parseFloat(row.avg_execution_time) || 0;
        
        // Performance score based on success rate and execution time
        let score = successRate * 0.7; // Success rate contributes 70%
        
        // Penalize long execution times (normalized to 0-1 scale)
        const timeScore = Math.max(0, 1 - (avgTime / 3600)); // 1 hour = 0 score
        score += timeScore * 0.3; // Execution time contributes 30%
        
        return {
            score: Math.min(1, Math.max(0, score)),
            rating: this.getPerformanceRating(score)
        };
    }

    getPerformanceRating(score) {
        if (score >= 0.9) return 'excellent';
        if (score >= 0.8) return 'good';
        if (score >= 0.6) return 'fair';
        if (score >= 0.4) return 'poor';
        return 'critical';
    }

    calculateExecutionHealthStatus(row) {
        const errorCount = parseInt(row.error_count) || 0;
        const warningCount = parseInt(row.warning_count) || 0;
        const duration = parseFloat(row.duration_seconds) || 0;
        
        if (row.status === 'failed' || errorCount > 5) return 'critical';
        if (errorCount > 0 || warningCount > 3 || duration > 1800) return 'warning'; // 30 min
        if (row.status === 'completed') return 'healthy';
        if (row.status === 'running') return 'active';
        return 'unknown';
    }

    async getSystemMetrics() {
        // In a real implementation, these would come from system monitoring
        // For now, return simulated metrics
        return {
            loadAverage: Math.random() * 2,
            memoryUsage: Math.random() * 0.8,
            cpuUsage: Math.random() * 0.6,
            diskUsage: Math.random() * 0.5
        };
    }

    isInCooldown(key) {
        const cooldownEnd = this.alertCooldown.get(key);
        return cooldownEnd && Date.now() < cooldownEnd;
    }

    setCooldown(key, duration) {
        this.alertCooldown.set(key, Date.now() + duration);
    }

    async cleanupOldMetrics() {
        const queries = [
            `DELETE FROM workflow_execution_logs WHERE timestamp < NOW() - INTERVAL '90 days'`,
            `DELETE FROM workflow_monitoring_alerts WHERE resolved_at < NOW() - INTERVAL '30 days'`,
            `DELETE FROM workflow_execution_metrics WHERE recorded_at < NOW() - INTERVAL '180 days'`
        ];

        for (const query of queries) {
            try {
                await DatabaseService.query(query);
            } catch (error) {
                console.error('Error cleaning up old metrics:', error);
            }
        }
    }

    /**
     * Acknowledge alert
     */
    async acknowledgeAlert(alertId, userId) {
        const query = `
            UPDATE workflow_monitoring_alerts 
            SET acknowledged_at = NOW(), acknowledged_by = $2
            WHERE id = $1
            RETURNING *
        `;

        const result = await DatabaseService.query(query, [alertId, userId]);
        
        if (result.rows.length > 0) {
            this.emit('alert-acknowledged', {
                alertId,
                acknowledgedBy: userId,
                acknowledgedAt: new Date().toISOString()
            });
        }

        return result.rows[0];
    }

    /**
     * Resolve alert
     */
    async resolveAlert(alertId, userId, resolution) {
        const query = `
            UPDATE workflow_monitoring_alerts 
            SET resolved_at = NOW(), resolved_by = $2, resolution = $3
            WHERE id = $1
            RETURNING *
        `;

        const result = await DatabaseService.query(query, [alertId, userId, resolution]);
        
        if (result.rows.length > 0) {
            this.emit('alert-resolved', {
                alertId,
                resolvedBy: userId,
                resolvedAt: new Date().toISOString(),
                resolution
            });
        }

        return result.rows[0];
    }

    /**
     * Get execution queue status
     */
    async getExecutionQueueStatus() {
        const query = `
            SELECT 
                status,
                COUNT(*) as count,
                AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_wait_time
            FROM workflow_execution_queue
            GROUP BY status
            ORDER BY 
                CASE status 
                    WHEN 'running' THEN 1
                    WHEN 'queued' THEN 2
                    WHEN 'paused' THEN 3
                    ELSE 4
                END
        `;

        const result = await DatabaseService.query(query);
        
        return {
            queue: result.rows.map(row => ({
                status: row.status,
                count: parseInt(row.count),
                avgWaitTime: parseFloat(row.avg_wait_time) || 0
            })),
            totalQueued: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
        };
    }
}

export { WorkflowMonitoringService };
