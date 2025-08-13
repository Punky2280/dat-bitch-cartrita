/**
 * @fileoverview Analytics Agent - Wrapper for existing analytics functionality
 * Integrates with packages/backend/src/agi/agents/AnalyticsAgent.js
 */
import { Logger, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';
// Import existing AnalyticsAgent from backend
const { AnalyticsAgent: BackendAnalyticsAgent } = await import('../../../../backend/src/agi/agents/AnalyticsAgent.js');
/**
 * Analytics Agent - performs data analysis and reporting tasks
 */
export class AnalyticsAgent {
    config;
    logger;
    tracer = trace.getTracer('analytics-agent');
    analyticsAgent;
    isInitialized = false;
    constructor(config) {
        this.config = config;
        this.logger = Logger.create('AnalyticsAgent');
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            this.logger.info('Initializing Analytics Agent...');
            // Initialize the existing AnalyticsAgent
            this.analyticsAgent = new BackendAnalyticsAgent({
                database: {
                    host: this.config.database?.host || process.env.DB_HOST || 'localhost',
                    port: this.config.database?.port || parseInt(process.env.DB_PORT || '5432'),
                    username: this.config.database?.username || process.env.DB_USERNAME,
                    password: this.config.database?.password || process.env.DB_PASSWORD,
                    database: this.config.database?.database || process.env.DB_NAME,
                },
                redis: {
                    host: this.config.redis?.host || process.env.REDIS_HOST || 'localhost',
                    port: this.config.redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
                    password: this.config.redis?.password || process.env.REDIS_PASSWORD,
                },
            });
            await this.analyticsAgent.initialize();
            this.isInitialized = true;
            this.logger.info('Analytics Agent initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize Analytics Agent', error);
            throw error;
        }
    }
    /**
     * Execute analytics task
     */
    async execute(request, context) {
        const span = this.tracer.startSpan('analytics.agent.execute', {
            kind: SpanKind.INTERNAL,
            attributes: {
                'task.type': request.taskType,
                'task.id': request.taskId,
            },
        });
        const startTime = performance.now();
        try {
            this.logger.info('Executing analytics task', {
                taskId: request.taskId,
                taskType: request.taskType,
            });
            let result;
            switch (request.taskType) {
                case 'analytics.data.query':
                    result = await this.queryData(request.parameters);
                    break;
                case 'analytics.report.generate':
                    result = await this.generateReport(request.parameters);
                    break;
                case 'analytics.metrics.calculate':
                    result = await this.calculateMetrics(request.parameters);
                    break;
                case 'analytics.trend.analyze':
                    result = await this.analyzeTrend(request.parameters);
                    break;
                default:
                    throw new Error(`Unsupported analytics task type: ${request.taskType}`);
            }
            const processingTime = performance.now() - startTime;
            return {
                taskId: request.taskId,
                status: TaskStatus.COMPLETED,
                result,
                metrics: {
                    processingTimeMs: Math.round(processingTime),
                    queueTimeMs: 0,
                    retryCount: 0,
                    costUsd: this.estimateCost(request.taskType, result),
                    tokensUsed: this.estimateTokens(result),
                    customMetrics: {
                        dataPointsProcessed: result?.dataPoints?.length || 0,
                    },
                },
                warnings: [],
            };
        }
        catch (error) {
            const processingTime = performance.now() - startTime;
            span.recordException(error);
            this.logger.error('Analytics task failed', error, {
                taskId: request.taskId,
                taskType: request.taskType,
            });
            return {
                taskId: request.taskId,
                status: TaskStatus.FAILED,
                errorMessage: error.message,
                errorCode: 'ANALYTICS_ERROR',
                metrics: {
                    processingTimeMs: Math.round(processingTime),
                    queueTimeMs: 0,
                    retryCount: 0,
                    costUsd: 0,
                    tokensUsed: 0,
                    customMetrics: {},
                },
                warnings: [],
            };
        }
        finally {
            span.end();
        }
    }
    /**
     * Query data
     */
    async queryData(parameters) {
        const { query, source = 'database', filters = {} } = parameters;
        if (!query) {
            throw new Error('Query is required for data querying');
        }
        return await this.analyticsAgent.queryData({
            query,
            source,
            filters,
        });
    }
    /**
     * Generate report
     */
    async generateReport(parameters) {
        const { reportType, dateRange, filters = {}, format = 'json' } = parameters;
        if (!reportType) {
            throw new Error('Report type is required');
        }
        return await this.analyticsAgent.generateReport({
            reportType,
            dateRange,
            filters,
            format,
        });
    }
    /**
     * Calculate metrics
     */
    async calculateMetrics(parameters) {
        const { metrics, dataset, timeframe } = parameters;
        if (!metrics || !dataset) {
            throw new Error('Metrics and dataset are required');
        }
        return await this.analyticsAgent.calculateMetrics({
            metrics,
            dataset,
            timeframe,
        });
    }
    /**
     * Analyze trend
     */
    async analyzeTrend(parameters) {
        const { dataset, trendType = 'linear', period = '30d' } = parameters;
        if (!dataset) {
            throw new Error('Dataset is required for trend analysis');
        }
        return await this.analyticsAgent.analyzeTrend({
            dataset,
            trendType,
            period,
        });
    }
    /**
     * Estimate cost for analytics task
     */
    estimateCost(taskType, result) {
        const baseCosts = {
            'analytics.data.query': 0.01,
            'analytics.report.generate': 0.02,
            'analytics.metrics.calculate': 0.015,
            'analytics.trend.analyze': 0.018,
        };
        return baseCosts[taskType] || 0.015;
    }
    /**
     * Estimate tokens used
     */
    estimateTokens(result) {
        if (!result)
            return 0;
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        return Math.ceil(text.length / 4);
    }
}
