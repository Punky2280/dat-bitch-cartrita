/**
 * @fileoverview Analytics Agent - Wrapper for existing analytics functionality
 * Integrates with packages/backend/src/agi/agents/AnalyticsAgent.js
 */

import { Logger, TaskRequest, TaskResponse, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';

// Import existing AnalyticsAgent from backend
const { AnalyticsAgent: BackendAnalyticsAgent } = await import('../../../../backend/src/agi/agents/AnalyticsAgent.js');

export interface AnalyticsAgentConfig {
  database?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
  };
  redis?: {
    host?: string;
    port?: number;
    password?: string;
  };
}

/**
 * Analytics Agent - performs data analysis and reporting tasks
 */
export class AnalyticsAgent {
  private readonly logger: Logger;
  private readonly tracer = trace.getTracer('analytics-agent');
  private analyticsAgent: any;
  private isInitialized = false;

  constructor(private config: AnalyticsAgentConfig) {
    this.logger = Logger.create('AnalyticsAgent');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

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
    } catch (error) {
      this.logger.error('Failed to initialize Analytics Agent', error as Error);
      throw error;
    }
  }

  /**
   * Execute analytics task
   */
  async execute(request: TaskRequest, context: any): Promise<TaskResponse> {
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

      let result: any;

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
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      span.recordException(error as Error);
      this.logger.error('Analytics task failed', error as Error, {
        taskId: request.taskId,
        taskType: request.taskType,
      });

      return {
        taskId: request.taskId,
        status: TaskStatus.FAILED,
        errorMessage: (error as Error).message,
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
    } finally {
      span.end();
    }
  }

  /**
   * Query data
   */
  private async queryData(parameters: any): Promise<any> {
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
  private async generateReport(parameters: any): Promise<any> {
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
  private async calculateMetrics(parameters: any): Promise<any> {
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
  private async analyzeTrend(parameters: any): Promise<any> {
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
  private estimateCost(taskType: string, result: any): number {
    const baseCosts = {
      'analytics.data.query': 0.01,
      'analytics.report.generate': 0.02,
      'analytics.metrics.calculate': 0.015,
      'analytics.trend.analyze': 0.018,
    };

    return baseCosts[taskType as keyof typeof baseCosts] || 0.015;
  }

  /**
   * Estimate tokens used
   */
  private estimateTokens(result: any): number {
    if (!result) return 0;
    
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    return Math.ceil(text.length / 4);
  }
}