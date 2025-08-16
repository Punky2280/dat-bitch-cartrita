import express from 'express';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import PerformanceOptimizationEngine from '../services/PerformanceOptimizationEngine.js';
import ResourceMonitor from '../services/ResourceMonitor.js';
import BottleneckDetector from '../services/BottleneckDetector.js';
import AutoScaler from '../services/AutoScaler.js';
import { getPerformanceMonitoringService } from '../services/PerformanceMonitoringService.js';
import authenticateToken from '../middleware/authenticateToken.js';
import { traceOperation } from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Initialize performance services (these would typically be initialized at app startup)
let performanceEngine = null;
let resourceMonitor = null;
let bottleneckDetector = null;
let autoScaler = null;

// Get performance monitoring service
const performanceService = getPerformanceMonitoringService();

// Helper to get or create service instances
function getPerformanceEngine() {
  if (!performanceEngine) {
    performanceEngine = new PerformanceOptimizationEngine();
  }
  return performanceEngine;
}

function getResourceMonitor() {
  if (!resourceMonitor) {
    resourceMonitor = new ResourceMonitor();
  }
  return resourceMonitor;
}

function getBottleneckDetector() {
  if (!bottleneckDetector) {
    bottleneckDetector = new BottleneckDetector();
  }
  return bottleneckDetector;
}

function getAutoScaler() {
  if (!autoScaler) {
    autoScaler = new AutoScaler();
  }
  return autoScaler;
}

/**
 * @route GET /api/performance/status
 * @desc Get overall performance system status
 */
router.get('/status', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.get_status');
  
  try {
    const status = {
      performanceEngine: getPerformanceEngine().getStatus(),
      resourceMonitor: getResourceMonitor().getStatus(),
      bottleneckDetector: getBottleneckDetector().getStatus(),
      autoScaler: getAutoScaler().getStatus(),
      timestamp: Date.now()
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting performance status:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance status'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route POST /api/performance/start
 * @desc Start all performance monitoring services
 */
router.post('/start', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.start_monitoring');
  
  try {
    const results = {
      performanceEngine: await getPerformanceEngine().startMonitoring(),
      resourceMonitor: await getResourceMonitor().startMonitoring(),
      bottleneckDetector: await getBottleneckDetector().startAnalysis(),
      autoScaler: await getAutoScaler().startScaling()
    };

    res.json({
      success: true,
      message: 'Performance monitoring started',
      data: results
    });

  } catch (error) {
    console.error('Error starting performance monitoring:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start performance monitoring'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route POST /api/performance/stop
 * @desc Stop all performance monitoring services
 */
router.post('/stop', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.stop_monitoring');
  
  try {
    const results = {};
    
    if (performanceEngine) {
      results.performanceEngine = await performanceEngine.stopMonitoring();
    }
    if (resourceMonitor) {
      results.resourceMonitor = await resourceMonitor.stopMonitoring();
    }
    if (bottleneckDetector) {
      results.bottleneckDetector = await bottleneckDetector.stopAnalysis();
    }
    if (autoScaler) {
      results.autoScaler = await autoScaler.stopScaling();
    }

    res.json({
      success: true,
      message: 'Performance monitoring stopped',
      data: results
    });

  } catch (error) {
    console.error('Error stopping performance monitoring:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop performance monitoring'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route GET /api/performance/metrics/current
 * @desc Get current performance metrics
 */
router.get('/metrics/current', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.get_current_metrics');
  
  try {
    const resourceStatus = await getResourceMonitor().getCurrentStatus();
    
    res.json({
      success: true,
      data: resourceStatus
    });

  } catch (error) {
    console.error('Error getting current metrics:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current metrics'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route GET /api/performance/metrics/history
 * @desc Get performance metrics history
 */
router.get('/metrics/history', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.get_metrics_history');
  
  try {
    const { timeRange = '1h' } = req.query;
    
    const statistics = getResourceMonitor().getResourceStatistics(timeRange);

    res.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting metrics history:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics history'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route GET /api/performance/report
 * @desc Get comprehensive performance report
 */
router.get('/report', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.get_performance_report');
  
  try {
    const { timeRange = '1h' } = req.query;
    
    const report = await getPerformanceEngine().getPerformanceReport(timeRange);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error getting performance report:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance report'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route GET /api/performance/bottlenecks
 * @desc Get detected bottlenecks
 */
router.get('/bottlenecks', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.get_bottlenecks');
  
  try {
    const { timeRange = '1h' } = req.query;
    
    const report = await getBottleneckDetector().getBottleneckReport(timeRange);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error getting bottlenecks:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bottlenecks'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route POST /api/performance/bottlenecks/analyze
 * @desc Trigger bottleneck analysis on provided performance data
 */
router.post('/bottlenecks/analyze', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.analyze_bottlenecks');
  
  try {
    const { performanceData } = req.body;
    
    if (!performanceData) {
      return res.status(400).json({
        success: false,
        error: 'Performance data is required'
      });
    }

    const bottlenecks = await getBottleneckDetector().analyzePerformanceData(performanceData);

    res.json({
      success: true,
      data: {
        bottlenecks,
        timestamp: Date.now(),
        analysisCount: bottlenecks.length
      }
    });

  } catch (error) {
    console.error('Error analyzing bottlenecks:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze bottlenecks'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route GET /api/performance/scaling/status
 * @desc Get auto-scaling status and history
 */
router.get('/scaling/status', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.get_scaling_status');
  
  try {
    const { timeRange = '1h' } = req.query;
    
    const report = await getAutoScaler().getScalingReport(timeRange);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error getting scaling status:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scaling status'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route GET /api/performance/scaling/recommendations
 * @desc Get scaling recommendations
 */
router.get('/scaling/recommendations', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.get_scaling_recommendations');
  
  try {
    const recommendations = await getAutoScaler().getScalingRecommendations();

    res.json({
      success: true,
      data: recommendations
    });

  } catch (error) {
    console.error('Error getting scaling recommendations:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scaling recommendations'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route POST /api/performance/scaling/strategy
 * @desc Update auto-scaling strategy
 */
router.post('/scaling/strategy', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.update_scaling_strategy');
  
  try {
    const { strategy } = req.body;
    
    if (!strategy) {
      return res.status(400).json({
        success: false,
        error: 'Scaling strategy is required'
      });
    }

    const result = getAutoScaler().setScalingStrategy(strategy);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error updating scaling strategy:', error);
    span?.recordException(error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update scaling strategy'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route POST /api/performance/scaling/policies
 * @desc Update scaling policies
 */
router.post('/scaling/policies', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.update_scaling_policies');
  
  try {
    const { policies } = req.body;
    
    if (!policies || typeof policies !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Valid policies object is required'
      });
    }

    const result = getAutoScaler().updateScalingPolicies(policies);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error updating scaling policies:', error);
    span?.recordException(error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update scaling policies'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route POST /api/performance/scaling/evaluate
 * @desc Manually trigger scaling evaluation
 */
router.post('/scaling/evaluate', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.evaluate_scaling');
  
  try {
    const { performanceMetrics } = req.body;
    
    const decision = await getAutoScaler().evaluateScalingDecision(performanceMetrics);

    res.json({
      success: true,
      data: decision
    });

  } catch (error) {
    console.error('Error evaluating scaling:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to evaluate scaling'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route POST /api/performance/optimize
 * @desc Apply performance optimizations
 */
router.post('/optimize', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.apply_optimizations');
  
  try {
    const { optimizations = [] } = req.body;
    
    const results = await getPerformanceEngine().applyOptimizations(optimizations);

    res.json({
      success: true,
      data: {
        results,
        timestamp: Date.now(),
        optimizationsApplied: results.filter(r => r.success).length,
        optimizationsFailed: results.filter(r => !r.success).length
      }
    });

  } catch (error) {
    console.error('Error applying optimizations:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to apply optimizations'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route GET /api/performance/alerts
 * @desc Get performance alerts
 */
router.get('/alerts', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.get_alerts');
  
  try {
    const { timeRange = '1h' } = req.query;
    const endTime = Date.now();
    const startTime = endTime - parseTimeRange(timeRange);
    
    const resourceStats = getResourceMonitor().getResourceStatistics(timeRange);
    const bottleneckReport = await getBottleneckDetector().getBottleneckReport(timeRange);
    
    // Combine alerts from different sources
    const alerts = [];
    
    // Add resource alerts
    if (resourceStats.alerts) {
      alerts.push(...resourceStats.alerts.map(alert => ({
        ...alert,
        source: 'resource_monitor',
        type: 'resource_alert'
      })));
    }
    
    // Add bottleneck alerts
    if (bottleneckReport.bottlenecksByImpact?.critical) {
      bottleneckReport.bottlenecksByImpact.critical.forEach(bottleneck => {
        alerts.push({
          source: 'bottleneck_detector',
          type: 'bottleneck_alert',
          severity: 'critical',
          resource: bottleneck.resource,
          message: bottleneck.description,
          timestamp: bottleneck.detectedAt,
          recommendations: bottleneck.recommendations
        });
      });
    }
    
    // Sort alerts by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      data: {
        alerts,
        timeRange,
        period: { start: startTime, end: endTime },
        summary: {
          total: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        }
      }
    });

  } catch (error) {
    console.error('Error getting performance alerts:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance alerts'
    });
  } finally {
    span?.end();
  }
});

/**
 * @route GET /api/performance/health
 * @desc Get performance system health check
 */
router.get('/health', async (req, res) => {
  const span = OpenTelemetryTracing.tracer?.startSpan('performance_api.health_check');
  
  try {
    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      services: {
        performanceEngine: {
          status: getPerformanceEngine().getStatus().isMonitoring ? 'running' : 'stopped',
          uptime: process.uptime()
        },
        resourceMonitor: {
          status: getResourceMonitor().getStatus().isMonitoring ? 'running' : 'stopped',
          samplesCollected: getResourceMonitor().getStatus().counters.samples_collected
        },
        bottleneckDetector: {
          status: getBottleneckDetector().getStatus().isAnalyzing ? 'running' : 'stopped',
          bottlenecksDetected: getBottleneckDetector().getStatus().counters.bottlenecks_detected
        },
        autoScaler: {
          status: getAutoScaler().getStatus().isScaling ? 'running' : 'stopped',
          currentInstances: getAutoScaler().getStatus().currentInstances
        }
      }
    };
    
    // Check if any critical services are down
    const serviceStates = Object.values(health.services).map(s => s.status);
    if (serviceStates.includes('error')) {
      health.status = 'error';
    } else if (serviceStates.some(s => s === 'stopped')) {
      health.status = 'degraded';
    }

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    console.error('Error getting performance health:', error);
    span?.recordException(error);
    res.status(500).json({
      success: false,
      error: 'Performance health check failed',
      data: {
        status: 'error',
        timestamp: Date.now(),
        error: error.message
      }
    });
  } finally {
    span?.end();
  }
});

/**
 * Helper function to parse time range
 */
function parseTimeRange(timeRange) {
  const unit = timeRange.slice(-1);
  const value = parseInt(timeRange.slice(0, -1));
  
  const multipliers = {
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };
  
  return value * (multipliers[unit] || multipliers['h']);
}

// Cleanup function for graceful shutdown
const cleanup = async () => {
  try {
    if (performanceEngine) {
      await performanceEngine.shutdown();
    }
    if (resourceMonitor) {
      await resourceMonitor.shutdown();
    }
    if (bottleneckDetector) {
      await bottleneckDetector.shutdown();
    }
    if (autoScaler) {
      await autoScaler.shutdown();
    }
  } catch (error) {
    console.error('Error during performance services cleanup:', error);
  }
};

// ==== NEW PERFORMANCE MONITORING SUITE ROUTES (Task 19) ====

/**
 * @route   GET /api/performance/dashboard
 * @desc    Get comprehensive performance dashboard data
 * @access  Private
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  await traceOperation('performance.dashboard.get', async (span) => {
    try {
      span.setAttributes({
        'user.id': req.user?.id || 'anonymous',
        'performance.request_type': 'dashboard'
      });

      const dashboardData = await performanceService.getDashboardData();
      
      span.setAttributes({
        'performance.status': dashboardData.status,
        'performance.metrics_count': dashboardData.data?.metrics ? 
          Object.keys(dashboardData.data.metrics).length : 0,
        'performance.active_alerts': dashboardData.data?.alerts?.count || 0
      });

      res.status(200).json({
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Performance API] Dashboard data retrieval failed:', error);
      span.recordException(error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard data',
        message: error.message
      });
    }
  });
});

/**
 * @route   GET /api/performance/health
 * @desc    Get system health status
 * @access  Private
 */
router.get('/health', authenticateToken, async (req, res) => {
  await traceOperation('performance.health.get', async (span) => {
    try {
      span.setAttributes({
        'user.id': req.user?.id || 'anonymous',
        'performance.request_type': 'health'
      });

      const healthData = await performanceService.getSystemHealth();
      
      span.setAttributes({
        'performance.health_score': healthData.health || 0,
        'performance.health_status': healthData.status || 'unknown',
        'performance.active_alerts': healthData.alerts || 0
      });

      res.status(200).json({
        success: true,
        data: healthData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Performance API] Health check failed:', error);
      span.recordException(error);
      
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  });
});

/**
 * @route   GET /api/performance/alerts
 * @desc    Get active performance alerts
 * @access  Private
 */
router.get('/alerts', authenticateToken, async (req, res) => {
  await traceOperation('performance.alerts.get', async (span) => {
    try {
      const { severity, limit } = req.query;
      
      span.setAttributes({
        'user.id': req.user?.id || 'anonymous',
        'performance.request_type': 'alerts',
        'performance.severity_filter': severity || 'all',
        'performance.limit': limit || 'unlimited'
      });

      let alerts = await performanceService.getActiveAlerts();
      
      // Filter by severity if specified
      if (severity && severity !== 'all') {
        alerts = alerts.filter(alert => alert.severity === severity);
      }
      
      // Apply limit if specified
      if (limit && !isNaN(parseInt(limit))) {
        alerts = alerts.slice(0, parseInt(limit));
      }

      span.setAttributes({
        'performance.alert_count': alerts.length,
        'performance.critical_alerts': alerts.filter(a => a.severity === 'critical').length
      });

      res.status(200).json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
          criticalCount: alerts.filter(a => a.severity === 'critical').length,
          highCount: alerts.filter(a => a.severity === 'high').length,
          mediumCount: alerts.filter(a => a.severity === 'medium').length,
          lowCount: alerts.filter(a => a.severity === 'low').length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Performance API] Alerts retrieval failed:', error);
      span.recordException(error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alerts',
        message: error.message
      });
    }
  });
});

/**
 * @route   GET /api/performance/recommendations
 * @desc    Get optimization recommendations
 * @access  Private
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  await traceOperation('performance.recommendations.get', async (span) => {
    try {
      const { severity, limit } = req.query;
      
      span.setAttributes({
        'user.id': req.user?.id || 'anonymous',
        'performance.request_type': 'recommendations',
        'performance.severity_filter': severity || 'all'
      });

      let recommendations = await performanceService.getOptimizationRecommendations();
      
      // Filter by severity if specified
      if (severity && severity !== 'all') {
        recommendations = recommendations.filter(rec => rec.severity === severity);
      }
      
      // Apply limit if specified
      if (limit && !isNaN(parseInt(limit))) {
        recommendations = recommendations.slice(0, parseInt(limit));
      }

      span.setAttributes({
        'performance.recommendation_count': recommendations.length,
        'performance.critical_recommendations': recommendations.filter(r => r.severity === 'critical').length
      });

      res.status(200).json({
        success: true,
        data: {
          recommendations,
          count: recommendations.length,
          criticalCount: recommendations.filter(r => r.severity === 'critical').length,
          highCount: recommendations.filter(r => r.severity === 'high').length,
          mediumCount: recommendations.filter(r => r.severity === 'medium').length,
          lowCount: recommendations.filter(r => r.severity === 'low').length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Performance API] Recommendations retrieval failed:', error);
      span.recordException(error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recommendations',
        message: error.message
      });
    }
  });
});

/**
 * @route   POST /api/performance/metric
 * @desc    Record a custom performance metric
 * @access  Private
 */
router.post('/metric', authenticateToken, async (req, res) => {
  await traceOperation('performance.metric.record', async (span) => {
    try {
      const { name, value, unit, labels } = req.body;
      
      if (!name || value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name and value'
        });
      }
      
      span.setAttributes({
        'user.id': req.user?.id || 'anonymous',
        'performance.request_type': 'record_metric',
        'performance.metric_name': name,
        'performance.metric_value': value,
        'performance.metric_unit': unit || ''
      });

      const recorded = performanceService.recordMetric(
        name, 
        parseFloat(value), 
        unit || '', 
        { ...labels, recorded_by: req.user?.id }
      );
      
      span.setAttributes({
        'performance.recording_success': recorded
      });

      if (recorded) {
        res.status(201).json({
          success: true,
          message: 'Metric recorded successfully',
          data: {
            name,
            value: parseFloat(value),
            unit: unit || '',
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to record metric'
        });
      }

    } catch (error) {
      console.error('[Performance API] Metric recording failed:', error);
      span.recordException(error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to record metric',
        message: error.message
      });
    }
  });
});

// Export cleanup function for use in app shutdown
router.cleanup = cleanup;

export { router };
