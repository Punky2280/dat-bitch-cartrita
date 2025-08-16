import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import FusionAggregationEngine from '../services/FusionAggregationEngine.js';
import { body, param, query, validationResult } from 'express-validator';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Initialize fusion engine
const fusionEngine = new FusionAggregationEngine();

// Middleware for validation error handling
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * @route GET /api/fusion/status
 * @description Get fusion engine status and statistics
 * @access Private
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = await OpenTelemetryTracing.traceOperation('fusion.status', async () => {
      return fusionEngine.getEngineStatus();
    });

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting fusion engine status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fusion engine status'
    });
  }
});

/**
 * @route POST /api/fusion/sources
 * @description Register a new data source
 * @access Private
 */
router.post('/sources', [
  authenticateToken,
  body('type').isIn(['conversation', 'workflow', 'analytics', 'external']),
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('config').isObject(),
  body('priority').optional().isInt({ min: 1, max: 10 }).default(5),
  body('reliability').optional().isFloat({ min: 0, max: 1 }).default(0.8),
  handleValidationErrors
], async (req, res) => {
  try {
    const { type, name, description, config, priority = 5, reliability = 0.8 } = req.body;
    const userId = req.user.id;

    const source = await OpenTelemetryTracing.traceOperation('fusion.registerSource', async () => {
      return fusionEngine.registerSource({
        type,
        name,
        description,
        config,
        priority,
        reliability,
        userId,
        createdAt: new Date()
      });
    });

    res.status(201).json({
      success: true,
      data: source
    });
  } catch (error) {
    console.error('Error registering fusion source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register fusion source'
    });
  }
});

/**
 * @route GET /api/fusion/sources
 * @description Get all registered data sources
 * @access Private
 */
router.get('/sources', [
  authenticateToken,
  query('type').optional().isIn(['conversation', 'workflow', 'analytics', 'external']),
  query('active').optional().isBoolean(),
  query('limit').optional().isInt({ min: 1, max: 100 }).default(20),
  query('offset').optional().isInt({ min: 0 }).default(0),
  handleValidationErrors
], async (req, res) => {
  try {
    const { type, active, limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    const sources = await OpenTelemetryTracing.traceOperation('fusion.getSources', async () => {
      return fusionEngine.getDataSources({
        userId,
        type,
        active: active !== undefined ? active === 'true' : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    });

    res.json({
      success: true,
      data: sources
    });
  } catch (error) {
    console.error('Error getting fusion sources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fusion sources'
    });
  }
});

/**
 * @route PUT /api/fusion/sources/:sourceId
 * @description Update a data source configuration
 * @access Private
 */
router.put('/sources/:sourceId', [
  authenticateToken,
  param('sourceId').isUUID(),
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('config').optional().isObject(),
  body('priority').optional().isInt({ min: 1, max: 10 }),
  body('reliability').optional().isFloat({ min: 0, max: 1 }),
  body('active').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { sourceId } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    const source = await OpenTelemetryTracing.traceOperation('fusion.updateSource', async () => {
      return fusionEngine.updateDataSource(sourceId, updateData, userId);
    });

    if (!source) {
      return res.status(404).json({
        success: false,
        error: 'Data source not found'
      });
    }

    res.json({
      success: true,
      data: source
    });
  } catch (error) {
    console.error('Error updating fusion source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update fusion source'
    });
  }
});

/**
 * @route DELETE /api/fusion/sources/:sourceId
 * @description Remove a data source
 * @access Private
 */
router.delete('/sources/:sourceId', [
  authenticateToken,
  param('sourceId').isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { sourceId } = req.params;
    const userId = req.user.id;

    const deleted = await OpenTelemetryTracing.traceOperation('fusion.removeSource', async () => {
      return fusionEngine.removeDataSource(sourceId, userId);
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Data source not found'
      });
    }

    res.json({
      success: true,
      message: 'Data source removed successfully'
    });
  } catch (error) {
    console.error('Error removing fusion source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove fusion source'
    });
  }
});

/**
 * @route POST /api/fusion/aggregate
 * @description Perform data fusion and aggregation
 * @access Private
 */
router.post('/aggregate', [
  authenticateToken,
  body('query').isString().isLength({ min: 1, max: 1000 }),
  body('sourceIds').optional().isArray(),
  body('sourceIds.*').optional().isUUID(),
  body('options').optional().isObject(),
  body('options.strategy').optional().isIn(['weighted_average', 'highest_confidence', 'consensus', 'temporal_priority']),
  body('options.minConfidence').optional().isFloat({ min: 0, max: 1 }),
  body('options.maxAge').optional().isInt({ min: 0 }),
  body('options.includeMetadata').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { query, sourceIds, options = {} } = req.body;
    const userId = req.user.id;

    const result = await OpenTelemetryTracing.traceOperation('fusion.aggregate', async () => {
      return fusionEngine.performFusion({
        query,
        sourceIds,
        userId,
        options: {
          strategy: options.strategy || 'weighted_average',
          minConfidence: options.minConfidence || 0.3,
          maxAge: options.maxAge || 86400000, // 24 hours in ms
          includeMetadata: options.includeMetadata !== false,
          ...options
        }
      });
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error performing fusion aggregation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform fusion aggregation'
    });
  }
});

/**
 * @route POST /api/fusion/synthesize
 * @description Synthesize information from multiple sources
 * @access Private
 */
router.post('/synthesize', [
  authenticateToken,
  body('topic').isString().isLength({ min: 1, max: 500 }),
  body('sources').isArray({ min: 1 }),
  body('sources.*.data').exists(),
  body('sources.*.confidence').isFloat({ min: 0, max: 1 }),
  body('sources.*.timestamp').isISO8601(),
  body('sources.*.sourceId').isUUID(),
  body('outputFormat').optional().isIn(['summary', 'detailed', 'structured', 'insights']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { topic, sources, outputFormat = 'summary' } = req.body;
    const userId = req.user.id;

    const synthesis = await OpenTelemetryTracing.traceOperation('fusion.synthesize', async () => {
      return fusionEngine.synthesizeInformation({
        topic,
        sources,
        outputFormat,
        userId
      });
    });

    res.json({
      success: true,
      data: synthesis
    });
  } catch (error) {
    console.error('Error synthesizing information:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to synthesize information'
    });
  }
});

/**
 * @route GET /api/fusion/conflicts
 * @description Get conflict resolution history
 * @access Private
 */
router.get('/conflicts', [
  authenticateToken,
  query('limit').optional().isInt({ min: 1, max: 100 }).default(20),
  query('offset').optional().isInt({ min: 0 }).default(0),
  query('resolved').optional().isBoolean(),
  query('sourceId').optional().isUUID(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { limit = 20, offset = 0, resolved, sourceId } = req.query;
    const userId = req.user.id;

    const conflicts = await OpenTelemetryTracing.traceOperation('fusion.getConflicts', async () => {
      return fusionEngine.getConflictHistory({
        userId,
        limit: parseInt(limit),
        offset: parseInt(offset),
        resolved: resolved !== undefined ? resolved === 'true' : undefined,
        sourceId
      });
    });

    res.json({
      success: true,
      data: conflicts
    });
  } catch (error) {
    console.error('Error getting conflict history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conflict history'
    });
  }
});

/**
 * @route POST /api/fusion/conflicts/:conflictId/resolve
 * @description Manually resolve a data conflict
 * @access Private
 */
router.post('/conflicts/:conflictId/resolve', [
  authenticateToken,
  param('conflictId').isUUID(),
  body('resolution').isIn(['accept_source1', 'accept_source2', 'manual_merge', 'ignore']),
  body('mergedData').optional().exists(),
  body('reason').optional().isString().isLength({ max: 1000 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { conflictId } = req.params;
    const { resolution, mergedData, reason } = req.body;
    const userId = req.user.id;

    const result = await OpenTelemetryTracing.traceOperation('fusion.resolveConflict', async () => {
      return fusionEngine.resolveConflict(conflictId, {
        resolution,
        mergedData,
        reason,
        userId
      });
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error resolving conflict:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve conflict'
    });
  }
});

/**
 * @route GET /api/fusion/analytics
 * @description Get fusion analytics and metrics
 * @access Private
 */
router.get('/analytics', [
  authenticateToken,
  query('period').optional().isIn(['1h', '24h', '7d', '30d']).default('24h'),
  query('metric').optional().isIn(['accuracy', 'conflicts', 'sources', 'performance']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { period = '24h', metric } = req.query;
    const userId = req.user.id;

    const analytics = await OpenTelemetryTracing.traceOperation('fusion.getAnalytics', async () => {
      return fusionEngine.getFusionAnalytics({
        userId,
        period,
        metric
      });
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting fusion analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get fusion analytics'
    });
  }
});

/**
 * @route POST /api/fusion/export
 * @description Export fusion data and results
 * @access Private
 */
router.post('/export', [
  authenticateToken,
  body('type').isIn(['sources', 'conflicts', 'results', 'analytics']),
  body('format').optional().isIn(['json', 'csv', 'xlsx']).default('json'),
  body('dateRange').optional().isObject(),
  body('dateRange.start').optional().isISO8601(),
  body('dateRange.end').optional().isISO8601(),
  body('filters').optional().isObject(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { type, format = 'json', dateRange, filters } = req.body;
    const userId = req.user.id;

    const exportData = await OpenTelemetryTracing.traceOperation('fusion.export', async () => {
      return fusionEngine.exportFusionData({
        type,
        format,
        userId,
        dateRange,
        filters
      });
    });

    // Set appropriate headers for file download
    const contentType = {
      json: 'application/json',
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }[format];

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `fusion_${type}_${timestamp}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'json') {
      res.json(exportData);
    } else {
      res.send(exportData);
    }
  } catch (error) {
    console.error('Error exporting fusion data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export fusion data'
    });
  }
});

export default router;
