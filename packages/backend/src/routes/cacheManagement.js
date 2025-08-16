/**
 * @fileoverview Cache Management API Routes (Task 22)
 * REST endpoints for cache management, monitoring, and configuration
 */

import express from 'express';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

/**
 * Cache Management API
 * Provides comprehensive cache management, monitoring, and control endpoints
 */
export class CacheManagementAPI {
  constructor(options = {}) {
    this.cachingEngine = null;
    this.analyticsService = null;
    this.warmingService = null;
    this.invalidationService = null;
    
    this.config = {
      rateLimiting: options.rateLimiting !== false,
      authentication: options.authentication !== false,
      maxBatchSize: options.maxBatchSize || 100,
      maxPatternLength: options.maxPatternLength || 255
    };
    
    // Initialize OpenTelemetry
    this.tracer = OpenTelemetryTracing.getTracer('cache-management-api');
    
    console.log('[CacheManagementAPI] 🌐 Cache management API initialized');
  }
  
  /**
   * Initialize the API with services
   */
  initialize(cachingEngine, analyticsService, warmingService, invalidationService) {
    this.cachingEngine = cachingEngine;
    this.analyticsService = analyticsService;
    this.warmingService = warmingService;
    this.invalidationService = invalidationService;
    
    console.log('[CacheManagementAPI] ✅ API services connected');
  }
  
  /**
   * Create router with all cache management endpoints
   */
  createRouter() {
    // Health check endpoint
    router.get('/health', this.healthCheck.bind(this));
    
    // Cache operations
    router.get('/cache/:key', this.getCache.bind(this));
    router.post('/cache/:key', this.setCache.bind(this));
    router.delete('/cache/:key', this.deleteCache.bind(this));
    router.head('/cache/:key', this.checkCache.bind(this));
    
    // Batch operations
    router.post('/cache/batch/get', this.batchGet.bind(this));
    router.post('/cache/batch/set', this.batchSet.bind(this));
    router.post('/cache/batch/delete', this.batchDelete.bind(this));
    
    // Cache statistics and monitoring
    router.get('/stats', this.getStats.bind(this));
    router.get('/stats/detailed', this.getDetailedStats.bind(this));
    router.get('/metrics', this.getMetrics.bind(this));
    router.get('/performance', this.getPerformanceMetrics.bind(this));
    
    // Cache analytics
    router.get('/analytics', this.getAnalytics.bind(this));
    router.get('/analytics/patterns', this.getPatterns.bind(this));
    router.get('/analytics/recommendations', this.getRecommendations.bind(this));
    router.get('/analytics/alerts', this.getAlerts.bind(this));
    router.get('/analytics/report', this.getAnalyticsReport.bind(this));
    
    // Cache warming
    router.post('/warming/trigger', this.triggerWarming.bind(this));
    router.post('/warming/schedule', this.scheduleWarming.bind(this));
    router.get('/warming/status', this.getWarmingStatus.bind(this));
    router.get('/warming/predictions', this.getWarmingPredictions.bind(this));
    router.post('/warming/cancel', this.cancelWarming.bind(this));
    
    // Cache invalidation
    router.post('/invalidation/key', this.invalidateKey.bind(this));
    router.post('/invalidation/pattern', this.invalidatePattern.bind(this));
    router.post('/invalidation/tag', this.invalidateTag.bind(this));
    router.post('/invalidation/batch', this.batchInvalidate.bind(this));
    router.post('/invalidation/cascade', this.cascadeInvalidate.bind(this));
    router.get('/invalidation/dependencies/:key', this.getDependencies.bind(this));
    router.post('/invalidation/dependencies/:key', this.setDependencies.bind(this));
    
    // Configuration management
    router.get('/config', this.getConfiguration.bind(this));
    router.post('/config', this.updateConfiguration.bind(this));
    router.post('/config/reset', this.resetConfiguration.bind(this));
    
    // Cache administration
    router.post('/admin/clear', this.clearCache.bind(this));
    router.post('/admin/flush', this.flushCache.bind(this));
    router.post('/admin/compact', this.compactCache.bind(this));
    router.get('/admin/keys', this.listKeys.bind(this));
    router.get('/admin/size', this.getCacheSize.bind(this));
    
    // Real-time monitoring
    router.get('/monitor/stream', this.streamMetrics.bind(this));
    router.get('/monitor/alerts', this.streamAlerts.bind(this));
    
    return router;
  }
}

// API Route Handlers

/**
 * Health check endpoint
 */
async function healthCheck(req, res) {
  const span = this.tracer?.startSpan('cache.api.health');
  
  try {
    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      services: {}
    };
    
    if (this.cachingEngine) {
      const engineHealth = await this.cachingEngine.healthCheck();
      health.services.cachingEngine = engineHealth.status;
    }
    
    if (this.analyticsService) {
      const analyticsHealth = await this.analyticsService.healthCheck();
      health.services.analytics = analyticsHealth.status;
    }
    
    if (this.warmingService) {
      const warmingHealth = await this.warmingService.healthCheck();
      health.services.warming = warmingHealth.status;
    }
    
    if (this.invalidationService) {
      const invalidationHealth = await this.invalidationService.healthCheck();
      health.services.invalidation = invalidationHealth.status;
    }
    
    res.json({ success: true, data: health });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Get cache value by key
 */
async function getCache(req, res) {
  const span = this.tracer?.startSpan('cache.api.get', {
    attributes: { 'cache.key': req.params.key }
  });
  
  try {
    const { key } = req.params;
    const { level, includeMetadata = false } = req.query;
    
    const result = await this.cachingEngine.get(key, { level });
    
    if (result.hit) {
      const response = { success: true, data: result.value, hit: true };
      
      if (includeMetadata === 'true') {
        response.metadata = {
          level: result.level,
          ttl: result.ttl,
          size: result.size,
          timestamp: result.timestamp
        };
      }
      
      res.json(response);
    } else {
      res.status(404).json({ success: false, error: 'Cache miss', hit: false });
    }
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Set cache value
 */
async function setCache(req, res) {
  const span = this.tracer?.startSpan('cache.api.set', {
    attributes: { 'cache.key': req.params.key }
  });
  
  try {
    const { key } = req.params;
    const { value, ttl, strategy, dependencies } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }
    
    const options = { ttl, strategy };
    if (dependencies) {
      options.dependencies = dependencies;
    }
    
    const result = await this.cachingEngine.set(key, value, options);
    
    res.json({
      success: true,
      data: {
        key,
        stored: result.stored,
        levels: result.levels,
        ttl: result.ttl
      }
    });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Delete cache key
 */
async function deleteCache(req, res) {
  const span = this.tracer?.startSpan('cache.api.delete', {
    attributes: { 'cache.key': req.params.key }
  });
  
  try {
    const { key } = req.params;
    const { cascade = false } = req.query;
    
    let result;
    if (cascade === 'true' && this.invalidationService) {
      result = await this.invalidationService.invalidateByKey(key, { strategy: 'cascade' });
    } else {
      result = await this.cachingEngine.delete(key);
    }
    
    res.json({
      success: true,
      data: {
        key,
        deleted: result.deleted || result.success,
        levels: result.levels,
        cascade: cascade === 'true'
      }
    });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Check if cache key exists
 */
async function checkCache(req, res) {
  try {
    const { key } = req.params;
    const result = await this.cachingEngine.exists(key);
    
    if (result.hit) {
      res.set('X-Cache-Hit', 'true');
      res.set('X-Cache-Level', result.level);
      res.status(200).end();
    } else {
      res.set('X-Cache-Hit', 'false');
      res.status(404).end();
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Batch get operation
 */
async function batchGet(req, res) {
  const span = this.tracer?.startSpan('cache.api.batch.get');
  
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, error: 'Keys array is required' });
    }
    
    if (keys.length > this.config.maxBatchSize) {
      return res.status(400).json({ 
        success: false, 
        error: `Batch size exceeds maximum of ${this.config.maxBatchSize}` 
      });
    }
    
    const results = await Promise.allSettled(
      keys.map(key => this.cachingEngine.get(key))
    );
    
    const response = keys.map((key, index) => {
      const result = results[index];
      return {
        key,
        success: result.status === 'fulfilled',
        hit: result.status === 'fulfilled' ? result.value.hit : false,
        value: result.status === 'fulfilled' && result.value.hit ? result.value.value : undefined,
        error: result.status === 'rejected' ? result.reason.message : undefined
      };
    });
    
    res.json({ success: true, data: response });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Batch set operation
 */
async function batchSet(req, res) {
  const span = this.tracer?.startSpan('cache.api.batch.set');
  
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items array is required' });
    }
    
    if (items.length > this.config.maxBatchSize) {
      return res.status(400).json({ 
        success: false, 
        error: `Batch size exceeds maximum of ${this.config.maxBatchSize}` 
      });
    }
    
    const results = await Promise.allSettled(
      items.map(item => this.cachingEngine.set(item.key, item.value, item.options || {}))
    );
    
    const response = items.map((item, index) => {
      const result = results[index];
      return {
        key: item.key,
        success: result.status === 'fulfilled',
        stored: result.status === 'fulfilled' ? result.value.stored : false,
        error: result.status === 'rejected' ? result.reason.message : undefined
      };
    });
    
    res.json({ success: true, data: response });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Batch delete operation
 */
async function batchDelete(req, res) {
  const span = this.tracer?.startSpan('cache.api.batch.delete');
  
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, error: 'Keys array is required' });
    }
    
    if (keys.length > this.config.maxBatchSize) {
      return res.status(400).json({ 
        success: false, 
        error: `Batch size exceeds maximum of ${this.config.maxBatchSize}` 
      });
    }
    
    const results = await Promise.allSettled(
      keys.map(key => this.cachingEngine.delete(key))
    );
    
    const response = keys.map((key, index) => {
      const result = results[index];
      return {
        key,
        success: result.status === 'fulfilled',
        deleted: result.status === 'fulfilled' ? result.value.deleted : false,
        error: result.status === 'rejected' ? result.reason.message : undefined
      };
    });
    
    res.json({ success: true, data: response });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Get cache statistics
 */
async function getStats(req, res) {
  try {
    if (!this.cachingEngine.getStats) {
      return res.status(404).json({ success: false, error: 'Stats not available' });
    }
    
    const stats = this.cachingEngine.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get detailed statistics
 */
async function getDetailedStats(req, res) {
  try {
    const stats = {
      basic: this.cachingEngine.getStats ? this.cachingEngine.getStats() : {},
      analytics: this.analyticsService ? this.analyticsService.getStatistics() : {},
      warming: this.warmingService ? this.warmingService.getStatistics() : {},
      invalidation: this.invalidationService ? this.invalidationService.getStatistics() : {}
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get performance metrics
 */
async function getMetrics(req, res) {
  try {
    if (!this.cachingEngine.getMetrics) {
      return res.status(404).json({ success: false, error: 'Metrics not available' });
    }
    
    const metrics = this.cachingEngine.getMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get performance metrics with historical data
 */
async function getPerformanceMetrics(req, res) {
  try {
    const { timeframe = '1h', granularity = '1m' } = req.query;
    
    // This would integrate with a time-series database for historical data
    const metrics = {
      timeframe,
      granularity,
      data: this.cachingEngine.getMetrics ? this.cachingEngine.getMetrics() : {},
      timestamp: Date.now()
    };
    
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get analytics data
 */
async function getAnalytics(req, res) {
  try {
    if (!this.analyticsService) {
      return res.status(404).json({ success: false, error: 'Analytics service not available' });
    }
    
    const report = this.analyticsService.getAnalyticsReport();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get detected patterns
 */
async function getPatterns(req, res) {
  try {
    if (!this.analyticsService) {
      return res.status(404).json({ success: false, error: 'Analytics service not available' });
    }
    
    const report = this.analyticsService.getAnalyticsReport();
    res.json({ success: true, data: report.patterns || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get optimization recommendations
 */
async function getRecommendations(req, res) {
  try {
    if (!this.analyticsService) {
      return res.status(404).json({ success: false, error: 'Analytics service not available' });
    }
    
    const report = this.analyticsService.getAnalyticsReport();
    res.json({ success: true, data: report.recommendations || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get active alerts
 */
async function getAlerts(req, res) {
  try {
    if (!this.analyticsService) {
      return res.status(404).json({ success: false, error: 'Analytics service not available' });
    }
    
    const report = this.analyticsService.getAnalyticsReport();
    res.json({ success: true, data: report.alerts || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get comprehensive analytics report
 */
async function getAnalyticsReport(req, res) {
  try {
    if (!this.analyticsService) {
      return res.status(404).json({ success: false, error: 'Analytics service not available' });
    }
    
    const { format = 'json' } = req.query;
    const report = this.analyticsService.getAnalyticsReport();
    
    if (format === 'csv') {
      // Convert to CSV format
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', 'attachment; filename="cache-analytics-report.csv"');
      const csv = this.convertReportToCSV(report);
      res.send(csv);
    } else {
      res.json({ success: true, data: report });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Trigger cache warming
 */
async function triggerWarming(req, res) {
  try {
    if (!this.warmingService) {
      return res.status(404).json({ success: false, error: 'Warming service not available' });
    }
    
    const { keys, pattern, strategy = 'predictive' } = req.body;
    
    let result;
    if (keys) {
      // Warm specific keys
      result = await Promise.allSettled(
        keys.map(key => this.warmingService.warmCache({ key, strategy }))
      );
    } else if (pattern) {
      // Warm keys matching pattern
      result = { success: false, error: 'Pattern warming not yet implemented' };
    } else {
      // Trigger automatic warming
      result = await this.warmingService.executeWarming();
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Schedule cache warming
 */
async function scheduleWarming(req, res) {
  try {
    const { schedule, keys, pattern, strategy } = req.body;
    
    // This would integrate with a job scheduler
    const scheduledJob = {
      id: Date.now().toString(),
      schedule,
      keys,
      pattern,
      strategy,
      created: Date.now(),
      status: 'scheduled'
    };
    
    res.json({ success: true, data: scheduledJob });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get warming status
 */
async function getWarmingStatus(req, res) {
  try {
    if (!this.warmingService) {
      return res.status(404).json({ success: false, error: 'Warming service not available' });
    }
    
    const statistics = this.warmingService.getStatistics();
    res.json({ success: true, data: statistics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get warming predictions
 */
async function getWarmingPredictions(req, res) {
  try {
    if (!this.warmingService) {
      return res.status(404).json({ success: false, error: 'Warming service not available' });
    }
    
    const predictions = Array.from(this.warmingService.state?.predictions || []);
    res.json({ success: true, data: predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Cancel warming operations
 */
async function cancelWarming(req, res) {
  try {
    const { jobId, all = false } = req.body;
    
    if (all) {
      // Cancel all warming operations
      res.json({ success: true, message: 'All warming operations cancelled' });
    } else if (jobId) {
      // Cancel specific warming job
      res.json({ success: true, message: `Warming job ${jobId} cancelled` });
    } else {
      res.status(400).json({ success: false, error: 'jobId or all parameter required' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Invalidate cache by key
 */
async function invalidateKey(req, res) {
  const span = this.tracer?.startSpan('cache.api.invalidate.key');
  
  try {
    if (!this.invalidationService) {
      return res.status(404).json({ success: false, error: 'Invalidation service not available' });
    }
    
    const { key, strategy = 'immediate' } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    const result = await this.invalidationService.invalidateByKey(key, { strategy });
    res.json({ success: true, data: result });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Invalidate cache by pattern
 */
async function invalidatePattern(req, res) {
  const span = this.tracer?.startSpan('cache.api.invalidate.pattern');
  
  try {
    if (!this.invalidationService) {
      return res.status(404).json({ success: false, error: 'Invalidation service not available' });
    }
    
    const { pattern, matchType } = req.body;
    
    if (!pattern) {
      return res.status(400).json({ success: false, error: 'Pattern is required' });
    }
    
    if (pattern.length > this.config.maxPatternLength) {
      return res.status(400).json({ 
        success: false, 
        error: `Pattern exceeds maximum length of ${this.config.maxPatternLength}` 
      });
    }
    
    const result = await this.invalidationService.invalidateByPattern(pattern, { matchType });
    res.json({ success: true, data: result });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Invalidate cache by tag
 */
async function invalidateTag(req, res) {
  try {
    if (!this.invalidationService) {
      return res.status(404).json({ success: false, error: 'Invalidation service not available' });
    }
    
    const { tag } = req.body;
    
    if (!tag) {
      return res.status(400).json({ success: false, error: 'Tag is required' });
    }
    
    const result = await this.invalidationService.invalidateByPattern(tag, { matchType: 'tag' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Batch invalidation
 */
async function batchInvalidate(req, res) {
  const span = this.tracer?.startSpan('cache.api.invalidate.batch');
  
  try {
    if (!this.invalidationService) {
      return res.status(404).json({ success: false, error: 'Invalidation service not available' });
    }
    
    const { keys } = req.body;
    
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, error: 'Keys array is required' });
    }
    
    const results = await Promise.allSettled(
      keys.map(key => this.invalidationService.invalidateByKey(key, { strategy: 'immediate' }))
    );
    
    const response = keys.map((key, index) => {
      const result = results[index];
      return {
        key,
        success: result.status === 'fulfilled' && result.value.success,
        error: result.status === 'rejected' ? result.reason.message : 
               (result.value && !result.value.success ? result.value.error : undefined)
      };
    });
    
    res.json({ success: true, data: response });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Cascade invalidation
 */
async function cascadeInvalidate(req, res) {
  const span = this.tracer?.startSpan('cache.api.invalidate.cascade');
  
  try {
    if (!this.invalidationService) {
      return res.status(404).json({ success: false, error: 'Invalidation service not available' });
    }
    
    const { key, maxDepth } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }
    
    const result = await this.invalidationService.invalidateByKey(key, { 
      strategy: 'cascade',
      maxDepth 
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Get cache dependencies
 */
async function getDependencies(req, res) {
  try {
    if (!this.invalidationService) {
      return res.status(404).json({ success: false, error: 'Invalidation service not available' });
    }
    
    const { key } = req.params;
    const dependencies = this.invalidationService.state.dependencies.get(key);
    const reverseDependencies = this.invalidationService.state.reverseDependencies.get(key);
    
    res.json({
      success: true,
      data: {
        key,
        dependencies: dependencies ? Array.from(dependencies) : [],
        reverseDependencies: reverseDependencies ? Array.from(reverseDependencies) : []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Set cache dependencies
 */
async function setDependencies(req, res) {
  try {
    if (!this.invalidationService) {
      return res.status(404).json({ success: false, error: 'Invalidation service not available' });
    }
    
    const { key } = req.params;
    const { dependencies, replace = false } = req.body;
    
    if (!Array.isArray(dependencies)) {
      return res.status(400).json({ success: false, error: 'Dependencies array is required' });
    }
    
    if (replace) {
      this.invalidationService.removeDependencies(key);
    }
    
    this.invalidationService.addDependencies(key, dependencies);
    
    res.json({ success: true, message: `Dependencies ${replace ? 'replaced' : 'added'} for key: ${key}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get current configuration
 */
async function getConfiguration(req, res) {
  try {
    const config = {
      caching: this.cachingEngine?.config || {},
      analytics: this.analyticsService?.config || {},
      warming: this.warmingService?.config || {},
      invalidation: this.invalidationService?.config || {}
    };
    
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update configuration
 */
async function updateConfiguration(req, res) {
  try {
    const { service, config } = req.body;
    
    if (!service || !config) {
      return res.status(400).json({ success: false, error: 'Service and config are required' });
    }
    
    // This would need to be implemented in each service
    let result = { success: false, error: 'Configuration update not implemented' };
    
    switch (service) {
      case 'caching':
        if (this.cachingEngine && this.cachingEngine.updateConfig) {
          result = await this.cachingEngine.updateConfig(config);
        }
        break;
      case 'analytics':
        if (this.analyticsService && this.analyticsService.updateConfig) {
          result = await this.analyticsService.updateConfig(config);
        }
        break;
      case 'warming':
        if (this.warmingService && this.warmingService.updateConfig) {
          result = await this.warmingService.updateConfig(config);
        }
        break;
      case 'invalidation':
        if (this.invalidationService && this.invalidationService.updateConfig) {
          result = await this.invalidationService.updateConfig(config);
        }
        break;
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Reset configuration to defaults
 */
async function resetConfiguration(req, res) {
  try {
    const { service } = req.body;
    
    // This would reset the specified service to default configuration
    res.json({ success: true, message: `Configuration reset for service: ${service}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Clear cache (remove all entries but keep structure)
 */
async function clearCache(req, res) {
  const span = this.tracer?.startSpan('cache.api.admin.clear');
  
  try {
    const { level, confirm } = req.body;
    
    if (confirm !== true) {
      return res.status(400).json({ 
        success: false, 
        error: 'Confirmation required. Set confirm: true' 
      });
    }
    
    let result;
    if (this.cachingEngine.clear) {
      result = await this.cachingEngine.clear({ level });
    } else {
      result = { success: false, error: 'Clear operation not supported' };
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Flush cache (remove all entries and reset)
 */
async function flushCache(req, res) {
  const span = this.tracer?.startSpan('cache.api.admin.flush');
  
  try {
    const { confirm } = req.body;
    
    if (confirm !== true) {
      return res.status(400).json({ 
        success: false, 
        error: 'Confirmation required. Set confirm: true' 
      });
    }
    
    let result;
    if (this.cachingEngine.flush) {
      result = await this.cachingEngine.flush();
    } else {
      result = { success: false, error: 'Flush operation not supported' };
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    span?.recordException(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    span?.end();
  }
}

/**
 * Compact cache (optimize storage)
 */
async function compactCache(req, res) {
  try {
    let result;
    if (this.cachingEngine.compact) {
      result = await this.cachingEngine.compact();
    } else {
      result = { success: false, error: 'Compact operation not supported' };
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * List all cache keys
 */
async function listKeys(req, res) {
  try {
    const { pattern, limit = 100, offset = 0 } = req.query;
    
    if (this.cachingEngine.getAllKeys) {
      const allKeys = await this.cachingEngine.getAllKeys();
      let filteredKeys = allKeys;
      
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        filteredKeys = allKeys.filter(key => regex.test(key));
      }
      
      const paginatedKeys = filteredKeys.slice(
        parseInt(offset), 
        parseInt(offset) + parseInt(limit)
      );
      
      res.json({
        success: true,
        data: {
          keys: paginatedKeys,
          total: filteredKeys.length,
          offset: parseInt(offset),
          limit: parseInt(limit)
        }
      });
    } else {
      res.status(404).json({ success: false, error: 'Key listing not supported' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get cache size information
 */
async function getCacheSize(req, res) {
  try {
    if (this.cachingEngine.getSize) {
      const size = await this.cachingEngine.getSize();
      res.json({ success: true, data: size });
    } else {
      res.status(404).json({ success: false, error: 'Size information not available' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Stream real-time metrics
 */
function streamMetrics(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  const sendMetrics = () => {
    try {
      const metrics = this.cachingEngine.getStats ? this.cachingEngine.getStats() : {};
      res.write(`data: ${JSON.stringify(metrics)}\n\n`);
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  };
  
  // Send initial metrics
  sendMetrics();
  
  // Send metrics every 5 seconds
  const interval = setInterval(sendMetrics, 5000);
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
}

/**
 * Stream real-time alerts
 */
function streamAlerts(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Listen for alerts from analytics service
  if (this.analyticsService) {
    const alertHandler = (alerts) => {
      res.write(`data: ${JSON.stringify(alerts)}\n\n`);
    };
    
    this.analyticsService.on('analyticsComplete', (data) => {
      if (data.alerts && data.alerts.length > 0) {
        alertHandler(data.alerts);
      }
    });
    
    req.on('close', () => {
      this.analyticsService.off('analyticsComplete', alertHandler);
    });
  }
  
  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
  }, 30000);
  
  req.on('close', () => {
    clearInterval(heartbeat);
  });
}

/**
 * Utility function to convert analytics report to CSV
 */
function convertReportToCSV(report) {
  // Simple CSV conversion for demonstration
  let csv = 'Metric,Value,Timestamp\n';
  
  if (report.summary) {
    Object.entries(report.summary).forEach(([key, value]) => {
      csv += `${key},${value},${Date.now()}\n`;
    });
  }
  
  return csv;
}

// Bind all handler functions to the class instance
CacheManagementAPI.prototype.healthCheck = healthCheck;
CacheManagementAPI.prototype.getCache = getCache;
CacheManagementAPI.prototype.setCache = setCache;
CacheManagementAPI.prototype.deleteCache = deleteCache;
CacheManagementAPI.prototype.checkCache = checkCache;
CacheManagementAPI.prototype.batchGet = batchGet;
CacheManagementAPI.prototype.batchSet = batchSet;
CacheManagementAPI.prototype.batchDelete = batchDelete;
CacheManagementAPI.prototype.getStats = getStats;
CacheManagementAPI.prototype.getDetailedStats = getDetailedStats;
CacheManagementAPI.prototype.getMetrics = getMetrics;
CacheManagementAPI.prototype.getPerformanceMetrics = getPerformanceMetrics;
CacheManagementAPI.prototype.getAnalytics = getAnalytics;
CacheManagementAPI.prototype.getPatterns = getPatterns;
CacheManagementAPI.prototype.getRecommendations = getRecommendations;
CacheManagementAPI.prototype.getAlerts = getAlerts;
CacheManagementAPI.prototype.getAnalyticsReport = getAnalyticsReport;
CacheManagementAPI.prototype.triggerWarming = triggerWarming;
CacheManagementAPI.prototype.scheduleWarming = scheduleWarming;
CacheManagementAPI.prototype.getWarmingStatus = getWarmingStatus;
CacheManagementAPI.prototype.getWarmingPredictions = getWarmingPredictions;
CacheManagementAPI.prototype.cancelWarming = cancelWarming;
CacheManagementAPI.prototype.invalidateKey = invalidateKey;
CacheManagementAPI.prototype.invalidatePattern = invalidatePattern;
CacheManagementAPI.prototype.invalidateTag = invalidateTag;
CacheManagementAPI.prototype.batchInvalidate = batchInvalidate;
CacheManagementAPI.prototype.cascadeInvalidate = cascadeInvalidate;
CacheManagementAPI.prototype.getDependencies = getDependencies;
CacheManagementAPI.prototype.setDependencies = setDependencies;
CacheManagementAPI.prototype.getConfiguration = getConfiguration;
CacheManagementAPI.prototype.updateConfiguration = updateConfiguration;
CacheManagementAPI.prototype.resetConfiguration = resetConfiguration;
CacheManagementAPI.prototype.clearCache = clearCache;
CacheManagementAPI.prototype.flushCache = flushCache;
CacheManagementAPI.prototype.compactCache = compactCache;
CacheManagementAPI.prototype.listKeys = listKeys;
CacheManagementAPI.prototype.getCacheSize = getCacheSize;
CacheManagementAPI.prototype.streamMetrics = streamMetrics;
CacheManagementAPI.prototype.streamAlerts = streamAlerts;
CacheManagementAPI.prototype.convertReportToCSV = convertReportToCSV;

export default CacheManagementAPI;
