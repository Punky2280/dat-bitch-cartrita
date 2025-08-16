/**
 * Performance Dashboard Service
 * Real-time performance monitoring dashboard
 * Task 26: System Performance Optimization - Component 6: Performance Dashboard
 */

import { EventEmitter } from 'events';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import SystemPerformanceOptimizationService from './SystemPerformanceOptimizationService.js';
import DatabasePerformanceOptimizationService from './DatabasePerformanceOptimizationService.js';
import ResourceManagementOptimizationService from './ResourceManagementOptimizationService.js';
import AdvancedCachingService from './AdvancedCachingService.js';

/**
 * Dashboard Widget Types
 */
export const WidgetType = {
    METRIC_GAUGE: 'metric_gauge',
    LINE_CHART: 'line_chart',
    BAR_CHART: 'bar_chart',
    PIE_CHART: 'pie_chart',
    TABLE: 'table',
    ALERT_LIST: 'alert_list',
    STATUS_GRID: 'status_grid',
    HEATMAP: 'heatmap'
};

/**
 * Dashboard Themes
 */
export const DashboardTheme = {
    LIGHT: 'light',
    DARK: 'dark',
    HIGH_CONTRAST: 'high_contrast'
};

/**
 * Metric Categories
 */
export const MetricCategory = {
    SYSTEM: 'system',
    APPLICATION: 'application',
    DATABASE: 'database',
    CACHE: 'cache',
    NETWORK: 'network',
    SECURITY: 'security',
    BUSINESS: 'business'
};

/**
 * Performance Dashboard Service
 */
class PerformanceDashboardService extends EventEmitter {
    constructor() {
        super();
        
        // Dashboard state
        this.dashboards = new Map();
        this.widgets = new Map();
        this.metrics = new Map();
        this.alerts = new Map();
        this.subscribers = new Map(); // WebSocket connections
        
        // Real-time data streams
        this.dataStreams = new Map();
        this.updateIntervals = new Map();
        
        // Configuration
        this.config = {
            refreshInterval: 5000,        // 5 seconds
            dataRetention: 24 * 60 * 60,  // 24 hours in seconds
            maxAlerts: 100,
            maxMetricsPerWidget: 1000,
            enableRealTime: true,
            enableAlerts: true,
            defaultTheme: DashboardTheme.DARK,
            compressionEnabled: true
        };

        this.initializeService();
    }

    /**
     * Initialize dashboard service
     */
    async initializeService() {
        return traceOperation('dashboard-initialize', async () => {
            try {
                // Create default dashboards
                await this.createDefaultDashboards();
                
                // Initialize data collection
                this.initializeDataCollection();
                
                // Start real-time updates
                if (this.config.enableRealTime) {
                    this.startRealTimeUpdates();
                }
                
                console.log('✅ Performance Dashboard Service initialized');
                this.emit('service:initialized');
                
            } catch (error) {
                console.error('❌ Failed to initialize dashboard service:', error);
                throw error;
            }
        });
    }

    /**
     * Create default dashboards
     */
    async createDefaultDashboards() {
        // System Overview Dashboard
        const systemDashboard = {
            id: 'system-overview',
            title: 'System Performance Overview',
            description: 'Real-time system performance metrics and status',
            theme: DashboardTheme.DARK,
            layout: 'grid',
            widgets: [
                {
                    id: 'cpu-usage',
                    type: WidgetType.METRIC_GAUGE,
                    title: 'CPU Usage',
                    position: { row: 0, col: 0, width: 2, height: 2 },
                    config: {
                        metric: 'system.cpu.utilization',
                        unit: '%',
                        thresholds: { warning: 70, critical: 90 },
                        refreshRate: 1000
                    }
                },
                {
                    id: 'memory-usage',
                    type: WidgetType.METRIC_GAUGE,
                    title: 'Memory Usage',
                    position: { row: 0, col: 2, width: 2, height: 2 },
                    config: {
                        metric: 'system.memory.utilization',
                        unit: '%',
                        thresholds: { warning: 80, critical: 95 }
                    }
                },
                {
                    id: 'performance-timeline',
                    type: WidgetType.LINE_CHART,
                    title: 'Performance Timeline',
                    position: { row: 2, col: 0, width: 4, height: 3 },
                    config: {
                        metrics: [
                            'system.cpu.utilization',
                            'system.memory.utilization',
                            'database.connections.utilization'
                        ],
                        timeRange: '1h',
                        refreshRate: 5000
                    }
                },
                {
                    id: 'active-alerts',
                    type: WidgetType.ALERT_LIST,
                    title: 'Active Alerts',
                    position: { row: 0, col: 4, width: 2, height: 5 },
                    config: {
                        maxItems: 10,
                        severity: ['critical', 'high', 'medium']
                    }
                }
            ],
            created: new Date(),
            lastUpdated: new Date()
        };

        // Database Performance Dashboard
        const databaseDashboard = {
            id: 'database-performance',
            title: 'Database Performance Monitor',
            description: 'Comprehensive database performance metrics and optimization insights',
            theme: DashboardTheme.DARK,
            layout: 'grid',
            widgets: [
                {
                    id: 'query-performance',
                    type: WidgetType.LINE_CHART,
                    title: 'Query Performance',
                    position: { row: 0, col: 0, width: 3, height: 3 },
                    config: {
                        metrics: ['database.query.avg_time', 'database.query.count'],
                        timeRange: '2h'
                    }
                },
                {
                    id: 'slow-queries',
                    type: WidgetType.TABLE,
                    title: 'Top Slow Queries',
                    position: { row: 0, col: 3, width: 3, height: 3 },
                    config: {
                        source: 'database.slow_queries',
                        columns: ['query', 'avg_time', 'executions', 'last_seen'],
                        maxRows: 20
                    }
                },
                {
                    id: 'connection-pool',
                    type: WidgetType.BAR_CHART,
                    title: 'Connection Pool Status',
                    position: { row: 3, col: 0, width: 2, height: 2 },
                    config: {
                        metric: 'database.connections',
                        breakdown: ['active', 'idle', 'waiting']
                    }
                },
                {
                    id: 'index-recommendations',
                    type: WidgetType.TABLE,
                    title: 'Index Recommendations',
                    position: { row: 3, col: 2, width: 4, height: 2 },
                    config: {
                        source: 'database.index_recommendations',
                        columns: ['table', 'columns', 'benefit', 'status'],
                        maxRows: 10
                    }
                }
            ],
            created: new Date(),
            lastUpdated: new Date()
        };

        // Cache Performance Dashboard
        const cacheDashboard = {
            id: 'cache-performance',
            title: 'Cache Performance Analytics',
            description: 'Multi-layer cache performance and optimization metrics',
            theme: DashboardTheme.DARK,
            layout: 'grid',
            widgets: [
                {
                    id: 'cache-hit-rates',
                    type: WidgetType.PIE_CHART,
                    title: 'Cache Hit Rates by Layer',
                    position: { row: 0, col: 0, width: 2, height: 3 },
                    config: {
                        metric: 'cache.hit_rate',
                        breakdown: ['memory', 'redis', 'database']
                    }
                },
                {
                    id: 'cache-performance',
                    type: WidgetType.LINE_CHART,
                    title: 'Cache Performance Trends',
                    position: { row: 0, col: 2, width: 4, height: 3 },
                    config: {
                        metrics: [
                            'cache.operations_per_second',
                            'cache.avg_response_time',
                            'cache.memory_usage'
                        ],
                        timeRange: '6h'
                    }
                },
                {
                    id: 'cache-statistics',
                    type: WidgetType.STATUS_GRID,
                    title: 'Cache Layer Statistics',
                    position: { row: 3, col: 0, width: 6, height: 2 },
                    config: {
                        source: 'cache.layer_stats',
                        fields: ['layer', 'hit_rate', 'miss_rate', 'size', 'operations']
                    }
                }
            ],
            created: new Date(),
            lastUpdated: new Date()
        };

        // Store dashboards
        this.dashboards.set(systemDashboard.id, systemDashboard);
        this.dashboards.set(databaseDashboard.id, databaseDashboard);
        this.dashboards.set(cacheDashboard.id, cacheDashboard);

        console.log(`✅ Created ${this.dashboards.size} default dashboards`);
    }

    /**
     * Initialize data collection from performance services
     */
    initializeDataCollection() {
        // System metrics collection
        this.dataStreams.set('system', {
            source: SystemPerformanceOptimizationService,
            collector: () => this.collectSystemMetrics(),
            interval: 1000
        });

        // Database metrics collection
        this.dataStreams.set('database', {
            source: DatabasePerformanceOptimizationService,
            collector: () => this.collectDatabaseMetrics(),
            interval: 5000
        });

        // Resource metrics collection
        this.dataStreams.set('resources', {
            source: ResourceManagementOptimizationService,
            collector: () => this.collectResourceMetrics(),
            interval: 2000
        });

        // Cache metrics collection
        this.dataStreams.set('cache', {
            source: AdvancedCachingService,
            collector: () => this.collectCacheMetrics(),
            interval: 3000
        });

        console.log(`✅ Initialized ${this.dataStreams.size} data collection streams`);
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        for (const [streamId, stream] of this.dataStreams) {
            const interval = setInterval(async () => {
                try {
                    const data = await stream.collector();
                    if (data) {
                        this.processMetricData(streamId, data);
                        this.broadcastUpdate(streamId, data);
                    }
                } catch (error) {
                    console.warn(`Failed to collect ${streamId} metrics:`, error);
                }
            }, stream.interval);

            this.updateIntervals.set(streamId, interval);
        }

        console.log('📡 Real-time updates started');
    }

    /**
     * Collect system metrics
     */
    async collectSystemMetrics() {
        return traceOperation('collect-system-metrics', async () => {
            const performanceReport = await SystemPerformanceOptimizationService.getPerformanceReport();
            const timestamp = new Date();

            return {
                timestamp,
                metrics: {
                    'system.cpu.utilization': performanceReport.system?.cpu?.utilization || 0,
                    'system.memory.utilization': performanceReport.system?.memory?.utilization || 0,
                    'system.disk.utilization': performanceReport.system?.disk?.utilization || 0,
                    'system.network.connections': performanceReport.system?.network?.connections || 0,
                    'system.performance.score': performanceReport.overallScore || 0,
                    'system.optimization.active': performanceReport.activeOptimizations || 0
                }
            };
        });
    }

    /**
     * Collect database metrics
     */
    async collectDatabaseMetrics() {
        return traceOperation('collect-database-metrics', async () => {
            const dbReport = await DatabasePerformanceOptimizationService.getPerformanceReport();
            const timestamp = new Date();

            return {
                timestamp,
                metrics: {
                    'database.connections.active': dbReport.connectionMetrics?.activeConnections || 0,
                    'database.connections.utilization': (dbReport.connectionMetrics?.activeConnections / (dbReport.connectionMetrics?.maxConnections || 1)) * 100,
                    'database.query.avg_time': dbReport.connectionMetrics?.averageResponseTime || 0,
                    'database.query.count': dbReport.connectionMetrics?.totalQueries || 0,
                    'database.slow_queries.count': dbReport.slowQueryCount || 0,
                    'database.optimizations.applied': dbReport.optimizationsSuggested?.length || 0
                },
                details: {
                    slow_queries: await DatabasePerformanceOptimizationService.getSlowQueries(10),
                    index_recommendations: dbReport.indexRecommendations || 0
                }
            };
        });
    }

    /**
     * Collect resource metrics
     */
    async collectResourceMetrics() {
        return traceOperation('collect-resource-metrics', async () => {
            const resourceReport = await ResourceManagementOptimizationService.getResourceUsageReport();
            const timestamp = new Date();

            return {
                timestamp,
                metrics: {
                    'resources.cpu.load': resourceReport.current?.cpu?.utilization || 0,
                    'resources.memory.used': resourceReport.current?.memory?.utilization || 0,
                    'resources.threads.active': resourceReport.current?.threads?.utilization || 0,
                    'resources.pools.database': resourceReport.pools?.connections?.database?.utilization || 0,
                    'resources.pressure.level': resourceReport.pressure?.length || 0
                }
            };
        });
    }

    /**
     * Collect cache metrics
     */
    async collectCacheMetrics() {
        return traceOperation('collect-cache-metrics', async () => {
            const cacheStats = await AdvancedCachingService.getStatistics();
            const timestamp = new Date();

            return {
                timestamp,
                metrics: {
                    'cache.hit_rate.overall': cacheStats.overall?.hitRate || 0,
                    'cache.hit_rate.memory': cacheStats.layers?.memory?.hitRate || 0,
                    'cache.hit_rate.redis': cacheStats.layers?.redis?.hitRate || 0,
                    'cache.operations_per_second': cacheStats.overall?.operationsPerSecond || 0,
                    'cache.avg_response_time': cacheStats.overall?.averageResponseTime || 0,
                    'cache.memory_usage': cacheStats.overall?.memoryUsage || 0
                },
                details: {
                    layer_stats: cacheStats.layers || {}
                }
            };
        });
    }

    /**
     * Process and store metric data
     */
    processMetricData(streamId, data) {
        for (const [metricName, value] of Object.entries(data.metrics)) {
            if (!this.metrics.has(metricName)) {
                this.metrics.set(metricName, []);
            }

            const metricHistory = this.metrics.get(metricName);
            metricHistory.push({
                timestamp: data.timestamp,
                value,
                source: streamId
            });

            // Trim old data
            const cutoff = new Date(Date.now() - (this.config.dataRetention * 1000));
            while (metricHistory.length > 0 && metricHistory[0].timestamp < cutoff) {
                metricHistory.shift();
            }
        }

        // Process alerts
        this.processAlerts(streamId, data);
    }

    /**
     * Process alerts from metric data
     */
    processAlerts(streamId, data) {
        if (!this.config.enableAlerts) return;

        for (const [metricName, value] of Object.entries(data.metrics)) {
            const thresholds = this.getMetricThresholds(metricName);
            if (!thresholds) continue;

            const alertId = `${streamId}.${metricName}`;
            const existingAlert = this.alerts.get(alertId);

            if (value >= thresholds.critical) {
                this.createOrUpdateAlert(alertId, {
                    severity: 'critical',
                    metric: metricName,
                    value,
                    threshold: thresholds.critical,
                    message: `Critical: ${metricName} is at ${value.toFixed(2)} (threshold: ${thresholds.critical})`,
                    timestamp: data.timestamp,
                    source: streamId
                });
            } else if (value >= thresholds.warning) {
                this.createOrUpdateAlert(alertId, {
                    severity: 'warning',
                    metric: metricName,
                    value,
                    threshold: thresholds.warning,
                    message: `Warning: ${metricName} is at ${value.toFixed(2)} (threshold: ${thresholds.warning})`,
                    timestamp: data.timestamp,
                    source: streamId
                });
            } else if (existingAlert) {
                // Clear alert if value is back to normal
                this.clearAlert(alertId);
            }
        }
    }

    /**
     * Get metric thresholds
     */
    getMetricThresholds(metricName) {
        const thresholds = {
            'system.cpu.utilization': { warning: 70, critical: 90 },
            'system.memory.utilization': { warning: 80, critical: 95 },
            'database.connections.utilization': { warning: 80, critical: 95 },
            'database.query.avg_time': { warning: 200, critical: 1000 },
            'resources.cpu.load': { warning: 70, critical: 90 },
            'resources.memory.used': { warning: 80, critical: 95 },
            'cache.hit_rate.overall': { warning: 80, critical: 70 } // Lower is worse for hit rate
        };

        return thresholds[metricName];
    }

    /**
     * Create or update alert
     */
    createOrUpdateAlert(alertId, alertData) {
        const existingAlert = this.alerts.get(alertId);

        if (existingAlert && existingAlert.severity === alertData.severity) {
            // Update existing alert
            existingAlert.lastSeen = alertData.timestamp;
            existingAlert.count = (existingAlert.count || 1) + 1;
        } else {
            // Create new alert
            this.alerts.set(alertId, {
                id: alertId,
                ...alertData,
                firstSeen: alertData.timestamp,
                lastSeen: alertData.timestamp,
                count: 1,
                status: 'active'
            });

            // Emit alert event
            this.emit('alert:created', this.alerts.get(alertId));
        }

        // Trim alerts if needed
        if (this.alerts.size > this.config.maxAlerts) {
            const oldestAlert = Array.from(this.alerts.values())
                .sort((a, b) => a.firstSeen - b.firstSeen)[0];
            this.alerts.delete(oldestAlert.id);
        }
    }

    /**
     * Clear alert
     */
    clearAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.status = 'resolved';
            alert.resolvedAt = new Date();
            this.emit('alert:resolved', alert);
            this.alerts.delete(alertId);
        }
    }

    /**
     * Broadcast update to subscribers
     */
    broadcastUpdate(streamId, data) {
        const message = {
            type: 'metric_update',
            source: streamId,
            timestamp: data.timestamp,
            data: data.metrics
        };

        // Broadcast to all subscribers
        for (const [subscriberId, subscriber] of this.subscribers) {
            try {
                if (subscriber.readyState === 1) { // WebSocket.OPEN
                    const payload = this.config.compressionEnabled 
                        ? this.compressMessage(message)
                        : JSON.stringify(message);
                    
                    subscriber.send(payload);
                }
            } catch (error) {
                console.warn(`Failed to send update to subscriber ${subscriberId}:`, error);
                this.subscribers.delete(subscriberId);
            }
        }
    }

    /**
     * Subscribe to real-time updates
     */
    subscribe(subscriberId, connection) {
        this.subscribers.set(subscriberId, connection);
        
        // Send initial data
        const initialData = {
            type: 'initial_data',
            dashboards: Array.from(this.dashboards.values()),
            metrics: this.getRecentMetrics(300), // Last 5 minutes
            alerts: Array.from(this.alerts.values())
        };

        connection.send(JSON.stringify(initialData));
        
        this.emit('subscriber:connected', subscriberId);
        console.log(`📡 New dashboard subscriber: ${subscriberId}`);
    }

    /**
     * Unsubscribe from updates
     */
    unsubscribe(subscriberId) {
        this.subscribers.delete(subscriberId);
        this.emit('subscriber:disconnected', subscriberId);
        console.log(`📡 Dashboard subscriber disconnected: ${subscriberId}`);
    }

    /**
     * Get recent metrics
     */
    getRecentMetrics(seconds = 300) {
        const cutoff = new Date(Date.now() - (seconds * 1000));
        const recentMetrics = {};

        for (const [metricName, history] of this.metrics) {
            const recent = history.filter(entry => entry.timestamp >= cutoff);
            if (recent.length > 0) {
                recentMetrics[metricName] = recent;
            }
        }

        return recentMetrics;
    }

    /**
     * Get dashboard data
     */
    async getDashboardData(dashboardId) {
        return traceOperation('get-dashboard-data', async () => {
            const dashboard = this.dashboards.get(dashboardId);
            if (!dashboard) {
                throw new Error(`Dashboard not found: ${dashboardId}`);
            }

            // Collect widget data
            const widgetData = {};
            
            for (const widget of dashboard.widgets) {
                widgetData[widget.id] = await this.getWidgetData(widget);
            }

            return {
                dashboard,
                widgetData,
                lastUpdated: new Date()
            };
        });
    }

    /**
     * Get widget data
     */
    async getWidgetData(widget) {
        switch (widget.type) {
            case WidgetType.METRIC_GAUGE:
                return this.getGaugeData(widget);
                
            case WidgetType.LINE_CHART:
                return this.getLineChartData(widget);
                
            case WidgetType.TABLE:
                return this.getTableData(widget);
                
            case WidgetType.ALERT_LIST:
                return this.getAlertListData(widget);
                
            case WidgetType.STATUS_GRID:
                return this.getStatusGridData(widget);
                
            default:
                return { error: `Unsupported widget type: ${widget.type}` };
        }
    }

    /**
     * Get gauge widget data
     */
    getGaugeData(widget) {
        const metricName = widget.config.metric;
        const history = this.metrics.get(metricName) || [];
        
        if (history.length === 0) {
            return { value: 0, status: 'no-data' };
        }

        const latest = history[history.length - 1];
        const thresholds = widget.config.thresholds || {};
        
        let status = 'normal';
        if (latest.value >= (thresholds.critical || 100)) {
            status = 'critical';
        } else if (latest.value >= (thresholds.warning || 80)) {
            status = 'warning';
        }

        return {
            value: latest.value,
            timestamp: latest.timestamp,
            status,
            unit: widget.config.unit || '',
            thresholds
        };
    }

    /**
     * Get line chart data
     */
    getLineChartData(widget) {
        const metrics = widget.config.metrics || [];
        const timeRange = widget.config.timeRange || '1h';
        const rangeDuration = this.parseTimeRange(timeRange);
        
        const cutoff = new Date(Date.now() - rangeDuration);
        const series = {};

        for (const metricName of metrics) {
            const history = this.metrics.get(metricName) || [];
            const filtered = history.filter(entry => entry.timestamp >= cutoff);
            
            series[metricName] = filtered.map(entry => ({
                x: entry.timestamp,
                y: entry.value
            }));
        }

        return {
            series,
            timeRange,
            lastUpdated: new Date()
        };
    }

    /**
     * Get table data
     */
    async getTableData(widget) {
        const source = widget.config.source;
        let data = [];

        switch (source) {
            case 'database.slow_queries':
                data = await DatabasePerformanceOptimizationService.getSlowQueries(widget.config.maxRows || 20);
                break;
                
            case 'database.index_recommendations':
                // This would fetch index recommendations
                data = [];
                break;
                
            default:
                data = [];
        }

        return {
            columns: widget.config.columns || [],
            data,
            totalRows: data.length
        };
    }

    /**
     * Get alert list data
     */
    getAlertListData(widget) {
        const maxItems = widget.config.maxItems || 10;
        const severityFilter = widget.config.severity || ['critical', 'warning'];
        
        const alerts = Array.from(this.alerts.values())
            .filter(alert => severityFilter.includes(alert.severity))
            .sort((a, b) => b.lastSeen - a.lastSeen)
            .slice(0, maxItems);

        return {
            alerts,
            totalCount: this.alerts.size
        };
    }

    /**
     * Get status grid data
     */
    getStatusGridData(widget) {
        // This would return status grid data based on the source
        return {
            items: [],
            fields: widget.config.fields || []
        };
    }

    // Utility methods
    parseTimeRange(timeRange) {
        const match = timeRange.match(/^(\d+)([smhd])$/);
        if (!match) return 60 * 60 * 1000; // Default 1 hour

        const value = parseInt(match[1]);
        const unit = match[2];

        const multipliers = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        };

        return value * (multipliers[unit] || multipliers.h);
    }

    compressMessage(message) {
        // Simple compression - in production, use actual compression library
        return JSON.stringify(message);
    }

    // Public API methods
    async getAllDashboards() {
        return Array.from(this.dashboards.values());
    }

    async createDashboard(dashboardConfig) {
        const dashboard = {
            id: dashboardConfig.id || `dashboard_${Date.now()}`,
            title: dashboardConfig.title,
            description: dashboardConfig.description || '',
            theme: dashboardConfig.theme || this.config.defaultTheme,
            layout: dashboardConfig.layout || 'grid',
            widgets: dashboardConfig.widgets || [],
            created: new Date(),
            lastUpdated: new Date()
        };

        this.dashboards.set(dashboard.id, dashboard);
        this.emit('dashboard:created', dashboard);
        
        return dashboard;
    }

    async updateDashboard(dashboardId, updates) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard not found: ${dashboardId}`);
        }

        Object.assign(dashboard, updates, { lastUpdated: new Date() });
        this.emit('dashboard:updated', dashboard);
        
        return dashboard;
    }

    async deleteDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (dashboard) {
            this.dashboards.delete(dashboardId);
            this.emit('dashboard:deleted', { id: dashboardId, dashboard });
        }
    }

    async getMetricHistory(metricName, timeRange = '1h') {
        const history = this.metrics.get(metricName) || [];
        const rangeDuration = this.parseTimeRange(timeRange);
        const cutoff = new Date(Date.now() - rangeDuration);
        
        return history.filter(entry => entry.timestamp >= cutoff);
    }

    async getActiveAlerts() {
        return Array.from(this.alerts.values())
            .filter(alert => alert.status === 'active');
    }

    async cleanup() {
        // Clear intervals
        for (const interval of this.updateIntervals.values()) {
            clearInterval(interval);
        }
        
        // Clear data structures
        this.dashboards.clear();
        this.widgets.clear();
        this.metrics.clear();
        this.alerts.clear();
        this.subscribers.clear();
        this.dataStreams.clear();
        this.updateIntervals.clear();
        
        console.log('✅ Performance Dashboard Service cleaned up');
    }
}

export default new PerformanceDashboardService();
