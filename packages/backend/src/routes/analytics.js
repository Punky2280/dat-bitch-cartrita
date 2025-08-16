import express from 'express';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from '../services/SecurityAuditLogger.js';

const router = express.Router();

/**
 * Advanced Analytics API Routes
 * 
 * Provides comprehensive analytics endpoints including:
 * - Real-time metrics collection and retrieval
 * - Dashboard data aggregation
 * - Predictive analytics and forecasting
 * - Anomaly detection and alerting
 * - User behavior analytics
 * - System performance monitoring
 * - Business intelligence reporting
 * - KPI tracking and management
 * - ETL data pipeline management
 */

// Middleware for analytics route telemetry
const analyticsMiddleware = (req, res, next) => {
  const span = OpenTelemetryTracing.getTracer('analytics-api').startSpan(`analytics_${req.method}_${req.route?.path || 'unknown'}`);
  req.span = span;
  
  res.on('finish', () => {
    span.setAttributes({
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.status_code': res.statusCode,
      'user.id': req.user?.id || 'anonymous'
    });
    
    if (res.statusCode >= 400) {
      span.setStatus({ code: 2, message: `HTTP ${res.statusCode}` });
    } else {
      span.setStatus({ code: 1, message: 'Success' });
    }
    
    span.end();
  });
  
  next();
};

router.use(analyticsMiddleware);

// =======================
// METRICS COLLECTION
// =======================

/**
 * Collect a single metric
 * POST /api/analytics/metrics
 */
router.post('/metrics', async (req, res) => {
  try {
    const { metricName, value, metadata = {} } = req.body;
    
    if (!metricName || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'metricName and value are required'
      });
    }
    
    const enrichedMetadata = {
      ...metadata,
      userId: req.user?.id,
      sessionId: req.sessionID,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    };
    
    const result = await req.app.locals.analyticsEngine.collectMetric(
      metricName,
      parseFloat(value),
      enrichedMetadata
    );
    
    await SecurityAuditLogger.logSecurityEvent(
      'analytics_metric_collected',
      `Metric ${metricName} collected`,
      { metricName, value, userId: req.user?.id }
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error collecting metric:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to collect metric'
    });
  }
});

/**
 * Collect multiple metrics in batch
 * POST /api/analytics/metrics/batch
 */
router.post('/metrics/batch', async (req, res) => {
  try {
    const { metrics } = req.body;
    
    if (!Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'metrics array is required and cannot be empty'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const metric of metrics) {
      try {
        const { metricName, value, metadata = {} } = metric;
        
        if (!metricName || value === undefined) {
          errors.push({ metric, error: 'metricName and value are required' });
          continue;
        }
        
        const enrichedMetadata = {
          ...metadata,
          userId: req.user?.id,
          sessionId: req.sessionID,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        };
        
        const result = await req.app.locals.analyticsEngine.collectMetric(
          metricName,
          parseFloat(value),
          enrichedMetadata
        );
        
        results.push(result);
        
      } catch (error) {
        errors.push({ metric, error: error.message });
      }
    }
    
    await SecurityAuditLogger.logSecurityEvent(
      'analytics_metrics_batch_collected',
      `Batch of ${metrics.length} metrics collected`,
      { totalMetrics: metrics.length, successCount: results.length, errorCount: errors.length, userId: req.user?.id }
    );
    
    res.json({
      success: true,
      data: {
        processed: results.length,
        errors: errors.length,
        results: results,
        errorDetails: errors
      }
    });
    
  } catch (error) {
    console.error('Error collecting metrics batch:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to collect metrics batch'
    });
  }
});

/**
 * Get metric analytics data
 * GET /api/analytics/metrics/:metricName
 */
router.get('/metrics/:metricName', async (req, res) => {
  try {
    const { metricName } = req.params;
    const {
      startTime = Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
      endTime = Date.now(),
      aggregation = 'average',
      includeStatistics = true,
      includePredictions = false,
      includeAnomalies = false
    } = req.query;
    
    const options = {
      startTime: parseInt(startTime),
      endTime: parseInt(endTime),
      aggregation,
      includeStatistics: includeStatistics === 'true',
      includePredictions: includePredictions === 'true',
      includeAnomalies: includeAnomalies === 'true'
    };
    
    const analytics = await req.app.locals.analyticsEngine.getMetricAnalytics(
      metricName,
      options
    );
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Error getting metric analytics:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get metric analytics'
    });
  }
});

// =======================
// PREDICTIVE ANALYTICS
// =======================

/**
 * Generate predictions for a metric
 * POST /api/analytics/predictions
 */
router.post('/predictions', async (req, res) => {
  try {
    const { metricName, options = {} } = req.body;
    
    if (!metricName) {
      return res.status(400).json({
        success: false,
        error: 'metricName is required'
      });
    }
    
    const predictions = await req.app.locals.predictiveEngine.generatePredictions(
      metricName,
      options
    );
    
    await SecurityAuditLogger.logSecurityEvent(
      'analytics_predictions_generated',
      `Predictions generated for metric ${metricName}`,
      { metricName, options, userId: req.user?.id }
    );
    
    res.json({
      success: true,
      data: predictions
    });
    
  } catch (error) {
    console.error('Error generating predictions:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate predictions'
    });
  }
});

/**
 * Detect anomalies for a metric
 * POST /api/analytics/anomalies/detect
 */
router.post('/anomalies/detect', async (req, res) => {
  try {
    const { metricName, options = {} } = req.body;
    
    if (!metricName) {
      return res.status(400).json({
        success: false,
        error: 'metricName is required'
      });
    }
    
    const anomalies = await req.app.locals.predictiveEngine.detectAnomalies(
      metricName,
      options
    );
    
    await SecurityAuditLogger.logSecurityEvent(
      'analytics_anomalies_detected',
      `Anomaly detection run for metric ${metricName}`,
      { metricName, anomaliesFound: anomalies.length, options, userId: req.user?.id }
    );
    
    res.json({
      success: true,
      data: {
        metricName,
        anomalies,
        totalAnomalies: anomalies.length
      }
    });
    
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to detect anomalies'
    });
  }
});

// =======================
// ETL DATA PIPELINE
// =======================

/**
 * Create new ETL pipeline
 * POST /api/analytics/etl/pipelines
 */
router.post('/etl/pipelines', async (req, res) => {
  try {
    const { name, config, schedule } = req.body;
    
    if (!name || !config) {
      return res.status(400).json({
        success: false,
        error: 'name and config are required'
      });
    }
    
    const pipeline = await req.app.locals.etlEngine.createPipeline(name, config, {
      schedule,
      createdBy: req.user?.id
    });
    
    res.json({
      success: true,
      data: pipeline
    });
    
  } catch (error) {
    console.error('Error creating ETL pipeline:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to create ETL pipeline'
    });
  }
});

/**
 * Execute ETL pipeline
 * POST /api/analytics/etl/pipelines/:pipelineId/execute
 */
router.post('/etl/pipelines/:pipelineId/execute', async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const { options = {} } = req.body;
    
    const execution = await req.app.locals.etlEngine.executePipeline(pipelineId, {
      ...options,
      executedBy: req.user?.id
    });
    
    res.json({
      success: true,
      data: execution
    });
    
  } catch (error) {
    console.error('Error executing ETL pipeline:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to execute ETL pipeline'
    });
  }
});

// =======================
// USER BEHAVIOR ANALYTICS
// =======================

/**
 * Track user behavior event
 * POST /api/analytics/behavior/track
 */
router.post('/behavior/track', async (req, res) => {
  try {
    const { eventType, eventData } = req.body;
    
    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'eventType is required'
      });
    }
    
    const result = await req.app.locals.userBehaviorEngine.trackEvent({
      userId: req.user?.id,
      sessionId: req.sessionID,
      eventType,
      eventData,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error tracking user behavior:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to track user behavior'
    });
  }
});

/**
 * Get user behavior analytics
 * GET /api/analytics/behavior/analytics
 */
router.get('/behavior/analytics', async (req, res) => {
  try {
    const {
      timeRange = '7d',
      userId,
      includeJourney = false,
      includeFunnels = false
    } = req.query;
    
    const analytics = await req.app.locals.userBehaviorEngine.getAnalytics({
      timeRange,
      userId: userId || req.user?.id,
      includeJourney: includeJourney === 'true',
      includeFunnels: includeFunnels === 'true'
    });
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Error getting behavior analytics:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get behavior analytics'
    });
  }
});

// =======================
// DASHBOARD DATA
// =======================

/**
 * Get comprehensive dashboard data
 * GET /api/analytics/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const {
      timeRange = '24h',
      includeRealTime = true,
      includeKPIs = true,
      includeTrends = true,
      includeAlerts = true
    } = req.query;
    
    const options = {
      timeRange,
      includeRealTime: includeRealTime === 'true',
      includeKPIs: includeKPIs === 'true',
      includeTrends: includeTrends === 'true',
      includeAlerts: includeAlerts === 'true'
    };
    
    const dashboardData = await req.app.locals.analyticsEngine.getDashboardData(
      req.user?.id,
      options
    );
    
    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

/**
 * Get analytics engine status
 * GET /api/analytics/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      analyticsEngine: req.app.locals.analyticsEngine?.getStatus() || { isInitialized: false },
      predictiveEngine: req.app.locals.predictiveEngine?.getStatus() || { isInitialized: false },
      etlEngine: req.app.locals.etlEngine?.getStatus() || { isInitialized: false },
      userBehaviorEngine: req.app.locals.userBehaviorEngine?.getStatus() || { isInitialized: false },
      biEngine: req.app.locals.biEngine?.getStatus() || { isInitialized: false }
    };
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('Error getting analytics status:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics status'
    });
  }
});

export default router;
