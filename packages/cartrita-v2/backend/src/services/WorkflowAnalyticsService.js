// PHASE_A_WORKFLOW_IMPLEMENTATION: Workflow Analytics and Performance Monitoring
// Comprehensive metrics collection, performance analysis, and execution insights

import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { Pool } from 'pg';

export default class WorkflowAnalyticsService {
  constructor(dbPool) {
    this.dbPool =
      dbPool ||
      new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

    // Initialize counters
    this.executionCounter = OpenTelemetryTracing.createCounter(
      'workflow_executions_total',
      'Total number of workflow executions'
    );

    this.stepCounter = OpenTelemetryTracing.createCounter(
      'workflow_steps_total',
      'Total number of workflow steps executed'
    );

    this.performanceHistogram = OpenTelemetryTracing.createHistogram(
      'workflow_execution_duration_ms',
      'Workflow execution duration in milliseconds'
    );
  }

  /**
   * Initialize the analytics service
   */
  async initialize() {
    try {
      console.log(
        '[WorkflowAnalyticsService] 🚀 Initializing workflow analytics...'
      );

      // Test database connection
      await this.dbPool.query('SELECT 1');

      // Create analytics views if they don't exist
      await this.createAnalyticsViews();

      console.log(
        '[WorkflowAnalyticsService] ✅ Analytics service initialized successfully'
      );
      return true;
    } catch (error) {
      console.error(
        '[WorkflowAnalyticsService] ❌ Initialization failed:',
        error
      );
      return false;
    }
  }

  /**
   * Create database views for analytics
   */
  async createAnalyticsViews() {
    const views = [
      `
      CREATE OR REPLACE VIEW workflow_execution_summary AS
      SELECT 
        w.id as workflow_id,
        w.name as workflow_name,
        COUNT(*) as total_executions,
        COUNT(CASE WHEN wal.status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN wal.status = 'failed' THEN 1 END) as failed_executions,
        ROUND(AVG(wal.execution_time_ms), 2) as avg_execution_time_ms,
        MAX(wal.execution_time_ms) as max_execution_time_ms,
        MIN(wal.execution_time_ms) as min_execution_time_ms,
        MAX(wal.started_at) as last_execution
      FROM workflows w
      LEFT JOIN workflow_automation_logs wal ON w.id = wal.workflow_id
      GROUP BY w.id, w.name
      `,
      `
      CREATE OR REPLACE VIEW workflow_performance_trends AS
      SELECT 
        workflow_id,
        DATE_TRUNC('hour', started_at) as hour_bucket,
        COUNT(*) as executions_per_hour,
        ROUND(AVG(execution_time_ms), 2) as avg_execution_time,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failure_count
      FROM workflow_automation_logs
      WHERE started_at >= NOW() - INTERVAL '24 hours'
      GROUP BY workflow_id, DATE_TRUNC('hour', started_at)
      ORDER BY hour_bucket DESC
      `,
    ];

    for (const viewSql of views) {
      try {
        await this.dbPool.query(viewSql);
      } catch (error) {
        console.warn(
          '[WorkflowAnalyticsService] View creation warning:',
          error.message
        );
      }
    }
  }

  /**
   * Record workflow execution metrics
   */
  async recordExecution(workflowId, executionData) {
    return await OpenTelemetryTracing.traceOperation(
      'workflow.analytics.record_execution',
      {
        attributes: {
          'workflow.id': workflowId,
          'execution.status': executionData.status,
          'execution.duration_ms': executionData.duration_ms || 0,
        },
      },
      async span => {
        try {
          // Update OpenTelemetry counters
          this.executionCounter.add(1, {
            'workflow.id': workflowId,
            'execution.status': executionData.status,
          });

          if (executionData.duration_ms) {
            this.performanceHistogram.record(executionData.duration_ms, {
              'workflow.id': workflowId,
              'execution.status': executionData.status,
            });
          }

          if (executionData.steps_completed) {
            this.stepCounter.add(executionData.steps_completed, {
              'workflow.id': workflowId,
            });
          }

          return { success: true };
        } catch (error) {
          console.error('[WorkflowAnalyticsService] Recording error:', error);
          span.recordException(error);
          return { success: false, error: error.message };
        }
      }
    );
  }

  /**
   * Get workflow execution analytics
   */
  async getWorkflowAnalytics(workflowId, timeRange = '24h') {
    return await OpenTelemetryTracing.traceOperation(
      'workflow.analytics.get_analytics',
      {
        attributes: {
          'workflow.id': workflowId,
          'analytics.time_range': timeRange,
        },
      },
      async span => {
        try {
          const timeCondition = this.getTimeCondition(timeRange);

          // Get basic metrics
          const metricsQuery = `
            SELECT 
              COUNT(*) as total_executions,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
              ROUND(AVG(execution_time_ms), 2) as avg_execution_time,
              MAX(execution_time_ms) as max_execution_time,
              MIN(execution_time_ms) as min_execution_time,
              ROUND(
                (COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / 
                 NULLIF(COUNT(*), 0) * 100), 2
              ) as success_rate
            FROM workflow_automation_logs 
            WHERE workflow_id = $1 ${timeCondition}
          `;

          const metricsResult = await this.dbPool.query(metricsQuery, [
            workflowId,
          ]);
          const metrics = metricsResult.rows[0];

          // Get hourly trends
          const trendsQuery = `
            SELECT 
              DATE_TRUNC('hour', started_at) as hour,
              COUNT(*) as executions,
              ROUND(AVG(execution_time_ms), 2) as avg_time,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as successes,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as failures
            FROM workflow_automation_logs 
            WHERE workflow_id = $1 ${timeCondition}
            GROUP BY DATE_TRUNC('hour', started_at)
            ORDER BY hour DESC
            LIMIT 24
          `;

          const trendsResult = await this.dbPool.query(trendsQuery, [
            workflowId,
          ]);

          // Get error patterns
          const errorsQuery = `
            SELECT 
              error_message,
              COUNT(*) as occurrence_count,
              MAX(started_at) as last_occurrence
            FROM workflow_automation_logs 
            WHERE workflow_id = $1 AND status = 'failed' AND error_message IS NOT NULL ${timeCondition}
            GROUP BY error_message
            ORDER BY occurrence_count DESC
            LIMIT 10
          `;

          const errorsResult = await this.dbPool.query(errorsQuery, [
            workflowId,
          ]);

          span.setAttributes({
            'analytics.total_executions':
              parseInt(metrics.total_executions) || 0,
            'analytics.success_rate': parseFloat(metrics.success_rate) || 0,
            'analytics.trends_count': trendsResult.rows.length,
          });

          return {
            metrics: {
              total_executions: parseInt(metrics.total_executions) || 0,
              successful_executions:
                parseInt(metrics.successful_executions) || 0,
              failed_executions: parseInt(metrics.failed_executions) || 0,
              success_rate: parseFloat(metrics.success_rate) || 0,
              avg_execution_time: parseFloat(metrics.avg_execution_time) || 0,
              max_execution_time: parseInt(metrics.max_execution_time) || 0,
              min_execution_time: parseInt(metrics.min_execution_time) || 0,
            },
            trends: trendsResult.rows.map(row => ({
              hour: row.hour,
              executions: parseInt(row.executions),
              avg_time: parseFloat(row.avg_time) || 0,
              successes: parseInt(row.successes),
              failures: parseInt(row.failures),
            })),
            error_patterns: errorsResult.rows.map(row => ({
              message: row.error_message,
              count: parseInt(row.occurrence_count),
              last_occurrence: row.last_occurrence,
            })),
            time_range: timeRange,
          };
        } catch (error) {
          console.error(
            '[WorkflowAnalyticsService] Analytics query error:',
            error
          );
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  /**
   * Get system-wide workflow analytics
   */
  async getSystemAnalytics(timeRange = '24h') {
    return await OpenTelemetryTracing.traceOperation(
      'workflow.analytics.get_system_analytics',
      {
        attributes: {
          'analytics.time_range': timeRange,
          'analytics.scope': 'system',
        },
      },
      async span => {
        try {
          const timeCondition = this.getTimeCondition(timeRange);

          // System-wide metrics
          const systemQuery = `
            SELECT 
              COUNT(DISTINCT workflow_id) as active_workflows,
              COUNT(*) as total_executions,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
              ROUND(AVG(execution_time_ms), 2) as avg_execution_time,
              ROUND(
                (COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / 
                 NULLIF(COUNT(*), 0) * 100), 2
              ) as system_success_rate
            FROM workflow_automation_logs 
            WHERE 1=1 ${timeCondition}
          `;

          const systemResult = await this.dbPool.query(systemQuery);
          const systemMetrics = systemResult.rows[0];

          // Top performing workflows
          const topWorkflowsQuery = `
            SELECT 
              w.id,
              w.name,
              COUNT(*) as executions,
              ROUND(AVG(wal.execution_time_ms), 2) as avg_time,
              COUNT(CASE WHEN wal.status = 'completed' THEN 1 END) as successes
            FROM workflows w
            JOIN workflow_automation_logs wal ON w.id = wal.workflow_id
            WHERE 1=1 ${timeCondition}
            GROUP BY w.id, w.name
            ORDER BY executions DESC
            LIMIT 10
          `;

          const topWorkflowsResult = await this.dbPool.query(topWorkflowsQuery);

          span.setAttributes({
            'system.active_workflows':
              parseInt(systemMetrics.active_workflows) || 0,
            'system.total_executions':
              parseInt(systemMetrics.total_executions) || 0,
            'system.success_rate':
              parseFloat(systemMetrics.system_success_rate) || 0,
          });

          return {
            system_metrics: {
              active_workflows: parseInt(systemMetrics.active_workflows) || 0,
              total_executions: parseInt(systemMetrics.total_executions) || 0,
              successful_executions:
                parseInt(systemMetrics.successful_executions) || 0,
              failed_executions: parseInt(systemMetrics.failed_executions) || 0,
              success_rate: parseFloat(systemMetrics.system_success_rate) || 0,
              avg_execution_time:
                parseFloat(systemMetrics.avg_execution_time) || 0,
            },
            top_workflows: topWorkflowsResult.rows.map(row => ({
              id: row.id,
              name: row.name,
              executions: parseInt(row.executions),
              avg_time: parseFloat(row.avg_time) || 0,
              successes: parseInt(row.successes),
            })),
            time_range: timeRange,
          };
        } catch (error) {
          console.error(
            '[WorkflowAnalyticsService] System analytics error:',
            error
          );
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  /**
   * Get performance recommendations
   */
  async getPerformanceRecommendations(workflowId) {
    return await OpenTelemetryTracing.traceOperation(
      'workflow.analytics.get_recommendations',
      {
        attributes: {
          'workflow.id': workflowId,
        },
      },
      async span => {
        try {
          const analytics = await this.getWorkflowAnalytics(workflowId, '7d');
          const recommendations = [];

          // Performance recommendations based on metrics
          if (analytics.metrics.success_rate < 80) {
            recommendations.push({
              type: 'reliability',
              severity: 'high',
              message: `Success rate is ${analytics.metrics.success_rate}%. Consider reviewing error patterns and adding retry logic.`,
              suggestion:
                'Review error patterns and implement retry mechanisms',
            });
          }

          if (analytics.metrics.avg_execution_time > 30000) {
            recommendations.push({
              type: 'performance',
              severity: 'medium',
              message: `Average execution time is ${analytics.metrics.avg_execution_time}ms. Consider optimizing slow steps.`,
              suggestion: 'Profile individual steps and optimize bottlenecks',
            });
          }

          if (analytics.error_patterns.length > 5) {
            recommendations.push({
              type: 'error_handling',
              severity: 'medium',
              message: `${analytics.error_patterns.length} different error types detected. Consider implementing better error handling.`,
              suggestion: 'Add comprehensive error handling and validation',
            });
          }

          return {
            workflow_id: workflowId,
            recommendations,
            analysis_period: '7d',
            generated_at: new Date().toISOString(),
          };
        } catch (error) {
          console.error(
            '[WorkflowAnalyticsService] Recommendations error:',
            error
          );
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  /**
   * Get time condition for SQL queries
   */
  getTimeCondition(timeRange) {
    const conditions = {
      '1h': "AND started_at >= NOW() - INTERVAL '1 hour'",
      '6h': "AND started_at >= NOW() - INTERVAL '6 hours'",
      '24h': "AND started_at >= NOW() - INTERVAL '24 hours'",
      '7d': "AND started_at >= NOW() - INTERVAL '7 days'",
      '30d': "AND started_at >= NOW() - INTERVAL '30 days'",
    };

    return conditions[timeRange] || conditions['24h'];
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      counters: {
        executions_tracked: this.executionCounter._value || 0,
        steps_tracked: this.stepCounter._value || 0,
      },
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.dbPool) {
      await this.dbPool.end();
    }
  }
}
