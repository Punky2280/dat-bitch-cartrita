/**
 * @fileoverview Cache Invalidation Strategies Service (Task 22)
 * Sophisticated invalidation system with dependency tracking and event-driven updates
 */

import EventEmitter from 'events';
import { performance } from 'perf_hooks';
import OpenTelemetryTracing from './OpenTelemetryTracing.js';

/**
 * Cache Invalidation Strategies Service
 * Provides intelligent cache invalidation with dependency tracking and conflict resolution
 */
export class CacheInvalidationService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Invalidation configuration
      batchSize: options.batchSize || 50,
      batchDelay: options.batchDelay || 100, // ms
      maxConcurrentInvalidations: options.maxConcurrentInvalidations || 10,
      
      // Dependency tracking
      dependencies: {
        enabled: options.dependencyTracking !== false,
        maxDepth: options.maxDependencyDepth || 5,
        circularDetection: options.circularDetection !== false,
        autoCleanup: options.autoCleanup !== false,
        cleanupInterval: options.cleanupInterval || 60 * 60 * 1000 // 1 hour
      },
      
      // Event-driven invalidation
      events: {
        enabled: options.eventDrivenInvalidation !== false,
        bufferTime: options.eventBufferTime || 1000, // ms
        maxBufferSize: options.maxEventBufferSize || 100
      },
      
      // Conflict resolution
      conflicts: {
        strategy: options.conflictStrategy || 'timestamp', // 'timestamp', 'priority', 'manual'
        retryAttempts: options.conflictRetryAttempts || 3,
        retryDelay: options.conflictRetryDelay || 500 // ms
      },
      
      // Pattern matching
      patterns: {
        enabled: options.patternMatching !== false,
        wildcards: options.wildcardSupport !== false,
        regex: options.regexSupport !== false,
        tags: options.tagSupport !== false
      }
    };

    // Invalidation state
    this.state = {
      dependencies: new Map(), // key -> Set of dependent keys
      reverseDependencies: new Map(), // key -> Set of keys this depends on
      eventBuffer: new Map(), // eventType -> buffered invalidations
      invalidationQueue: [],
      activeInvalidations: new Set(),
      conflictResolution: new Map(),
      
      // Statistics
      stats: {
        totalInvalidations: 0,
        cascadeInvalidations: 0,
        conflictResolutions: 0,
        patternMatches: 0,
        eventDrivenInvalidations: 0,
        batchInvalidations: 0,
        averageLatency: 0,
        errors: 0
      }
    };
    
    // Invalidation strategies
    this.strategies = new Map([
      ['immediate', this.immediateInvalidation.bind(this)],
      ['batch', this.batchInvalidation.bind(this)],
      ['cascade', this.cascadeInvalidation.bind(this)],
      ['pattern', this.patternInvalidation.bind(this)],
      ['event-driven', this.eventDrivenInvalidation.bind(this)],
      ['conditional', this.conditionalInvalidation.bind(this)],
      ['lazy', this.lazyInvalidation.bind(this)],
      ['smart', this.smartInvalidation.bind(this)]
    ]);
    
    // Pattern matchers
    this.patternMatchers = new Map([
      ['wildcard', this.matchWildcard.bind(this)],
      ['regex', this.matchRegex.bind(this)],
      ['tag', this.matchTag.bind(this)],
      ['prefix', this.matchPrefix.bind(this)],
      ['suffix', this.matchSuffix.bind(this)],
      ['contains', this.matchContains.bind(this)]
    ]);
    
    // Event handlers for different invalidation triggers
    this.eventHandlers = new Map([
      ['data-update', this.handleDataUpdate.bind(this)],
      ['user-action', this.handleUserAction.bind(this)],
      ['system-event', this.handleSystemEvent.bind(this)],
      ['time-based', this.handleTimeBased.bind(this)],
      ['external-change', this.handleExternalChange.bind(this)]
    ]);

    // Initialize OpenTelemetry
    this.tracer = OpenTelemetryTracing.getTracer('cache-invalidation-service');
    this.meter = OpenTelemetryTracing.getMeter('cache-invalidation-service');
    
    // Create metrics
    this.invalidationCounter = this.meter?.createCounter('cache_invalidations_total', {
      description: 'Total number of cache invalidations performed'
    });
    
    this.cascadeGauge = this.meter?.createGauge('cache_cascade_depth', {
      description: 'Depth of cascade invalidations'
    });
    
    this.conflictCounter = this.meter?.createCounter('cache_invalidation_conflicts', {
      description: 'Number of invalidation conflicts encountered'
    });
    
    this.latencyHistogram = this.meter?.createHistogram('cache_invalidation_latency', {
      description: 'Latency of cache invalidation operations'
    });

    console.log('[CacheInvalidationService] 🗑️ Cache invalidation service initialized');
  }

  /**
   * Initialize the invalidation service
   */
  async initialize(cachingEngine) {
    this.cachingEngine = cachingEngine;
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start background processes
    this.startInvalidationProcessor();
    this.startDependencyCleanup();
    
    console.log('[CacheInvalidationService] ✅ Invalidation service started');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen to cache events
    if (this.cachingEngine) {
      this.cachingEngine.on('cacheSet', this.handleCacheSet.bind(this));
      this.cachingEngine.on('cacheUpdate', this.handleCacheUpdate.bind(this));
      this.cachingEngine.on('dataChange', this.handleDataChange.bind(this));
    }
  }

  /**
   * Handle cache set events
   */
  handleCacheSet(data) {
    // Update dependency tracking when new cache entries are created
    if (data.dependencies) {
      this.addDependencies(data.key, data.dependencies);
    }
  }

  /**
   * Handle cache update events
   */
  handleCacheUpdate(data) {
    // Trigger dependency-based invalidation
    this.invalidateByKey(data.key, { strategy: 'cascade', source: 'update' });
  }

  /**
   * Handle data change events
   */
  handleDataChange(data) {
    this.bufferEventInvalidation('data-update', data);
  }

  /**
   * Add dependency relationships
   */
  addDependencies(key, dependencies) {
    if (!this.config.dependencies.enabled) return;
    
    // Validate dependencies to prevent circular references
    if (this.config.dependencies.circularDetection) {
      const validated = this.validateDependencies(key, dependencies);
      if (!validated.valid) {
        console.warn('[CacheInvalidationService] Circular dependency detected:', validated.cycle);
        return;
      }
    }
    
    // Add forward dependencies (key -> dependents)
    if (!this.state.dependencies.has(key)) {
      this.state.dependencies.set(key, new Set());
    }
    
    dependencies.forEach(dep => {
      this.state.dependencies.get(key).add(dep);
      
      // Add reverse dependencies (dependent -> key)
      if (!this.state.reverseDependencies.has(dep)) {
        this.state.reverseDependencies.set(dep, new Set());
      }
      this.state.reverseDependencies.get(dep).add(key);
    });
    
    console.log(`[CacheInvalidationService] 🔗 Added ${dependencies.length} dependencies for ${key}`);
  }

  /**
   * Remove dependency relationships
   */
  removeDependencies(key, dependencies = null) {
    if (!this.config.dependencies.enabled) return;
    
    if (dependencies === null) {
      // Remove all dependencies for the key
      const keyDeps = this.state.dependencies.get(key);
      if (keyDeps) {
        keyDeps.forEach(dep => {
          const reverseDeps = this.state.reverseDependencies.get(dep);
          if (reverseDeps) {
            reverseDeps.delete(key);
            if (reverseDeps.size === 0) {
              this.state.reverseDependencies.delete(dep);
            }
          }
        });
        this.state.dependencies.delete(key);
      }
    } else {
      // Remove specific dependencies
      const keyDeps = this.state.dependencies.get(key);
      if (keyDeps) {
        dependencies.forEach(dep => {
          keyDeps.delete(dep);
          const reverseDeps = this.state.reverseDependencies.get(dep);
          if (reverseDeps) {
            reverseDeps.delete(key);
            if (reverseDeps.size === 0) {
              this.state.reverseDependencies.delete(dep);
            }
          }
        });
        
        if (keyDeps.size === 0) {
          this.state.dependencies.delete(key);
        }
      }
    }
  }

  /**
   * Validate dependencies for circular references
   */
  validateDependencies(key, dependencies) {
    const visited = new Set();
    const recursionStack = new Set();
    
    function hasCycle(currentKey, deps, state) {
      if (recursionStack.has(currentKey)) {
        return { valid: false, cycle: Array.from(recursionStack) };
      }
      
      if (visited.has(currentKey)) {
        return { valid: true };
      }
      
      visited.add(currentKey);
      recursionStack.add(currentKey);
      
      const keyDeps = deps.get(currentKey) || new Set();
      for (const dep of keyDeps) {
        const result = hasCycle(dep, deps, state);
        if (!result.valid) {
          return result;
        }
      }
      
      recursionStack.delete(currentKey);
      return { valid: true };
    }
    
    // Create temporary dependency map with new dependencies
    const tempDeps = new Map(this.state.dependencies);
    tempDeps.set(key, new Set(dependencies));
    
    return hasCycle(key, tempDeps, this.state);
  }

  /**
   * Buffer event-driven invalidation
   */
  bufferEventInvalidation(eventType, data) {
    if (!this.config.events.enabled) return;
    
    if (!this.state.eventBuffer.has(eventType)) {
      this.state.eventBuffer.set(eventType, []);
    }
    
    const buffer = this.state.eventBuffer.get(eventType);
    buffer.push({
      ...data,
      timestamp: Date.now()
    });
    
    // Process buffer if it's full or after buffer time
    if (buffer.length >= this.config.events.maxBufferSize) {
      this.processEventBuffer(eventType);
    } else if (buffer.length === 1) {
      // Set timer for first item in buffer
      setTimeout(() => {
        this.processEventBuffer(eventType);
      }, this.config.events.bufferTime);
    }
  }

  /**
   * Process buffered events
   */
  async processEventBuffer(eventType) {
    const buffer = this.state.eventBuffer.get(eventType);
    if (!buffer || buffer.length === 0) return;
    
    // Clear buffer
    this.state.eventBuffer.set(eventType, []);
    
    // Group events by target and process
    const groupedEvents = this.groupEventsByTarget(buffer);
    
    for (const [target, events] of groupedEvents) {
      await this.processGroupedEvents(eventType, target, events);
    }
  }

  /**
   * Group events by invalidation target
   */
  groupEventsByTarget(events) {
    const grouped = new Map();
    
    events.forEach(event => {
      const target = this.determineInvalidationTarget(event);
      if (target) {
        if (!grouped.has(target)) {
          grouped.set(target, []);
        }
        grouped.get(target).push(event);
      }
    });
    
    return grouped;
  }

  /**
   * Determine invalidation target from event
   */
  determineInvalidationTarget(event) {
    // Logic to determine which cache keys should be invalidated
    if (event.key) return event.key;
    if (event.pattern) return event.pattern;
    if (event.tag) return `tag:${event.tag}`;
    if (event.prefix) return `prefix:${event.prefix}`;
    
    return null;
  }

  /**
   * Process grouped events for invalidation
   */
  async processGroupedEvents(eventType, target, events) {
    const handler = this.eventHandlers.get(eventType) || this.eventHandlers.get('system-event');
    
    try {
      await handler(target, events);
      this.state.stats.eventDrivenInvalidations++;
    } catch (error) {
      console.error('[CacheInvalidationService] Event processing error:', eventType, error);
      this.state.stats.errors++;
    }
  }

  /**
   * Start invalidation processor
   */
  startInvalidationProcessor() {
    const processQueue = async () => {
      if (this.state.invalidationQueue.length > 0) {
        await this.processBatchInvalidations();
      }
    };
    
    // Process queue periodically
    setInterval(processQueue, this.config.batchDelay);
    
    console.log('[CacheInvalidationService] 🔄 Invalidation processor started');
  }

  /**
   * Start dependency cleanup
   */
  startDependencyCleanup() {
    if (!this.config.dependencies.autoCleanup) return;
    
    const cleanup = () => {
      this.cleanupStaleDepencies();
    };
    
    setInterval(cleanup, this.config.dependencies.cleanupInterval);
    
    console.log('[CacheInvalidationService] 🧹 Dependency cleanup started');
  }

  /**
   * Clean up stale dependencies
   */
  async cleanupStaleDepencies() {
    const span = this.tracer?.startSpan('cache.invalidation.cleanup');
    let cleaned = 0;
    
    try {
      // Check for stale dependencies (keys that no longer exist in cache)
      for (const [key, dependencies] of this.state.dependencies) {
        const exists = await this.cachingEngine.exists(key);
        if (!exists.hit) {
          this.removeDependencies(key);
          cleaned++;
        }
      }
      
      console.log(`[CacheInvalidationService] 🧹 Cleaned up ${cleaned} stale dependencies`);
    } catch (error) {
      console.error('[CacheInvalidationService] Cleanup error:', error);
      span?.recordException(error);
    } finally {
      span?.end();
    }
  }

  /**
   * Invalidate cache by key
   */
  async invalidateByKey(key, options = {}) {
    const strategy = options.strategy || 'immediate';
    const strategyFn = this.strategies.get(strategy);
    
    if (!strategyFn) {
      throw new Error(`Unknown invalidation strategy: ${strategy}`);
    }
    
    return strategyFn(key, options);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern, options = {}) {
    return this.patternInvalidation(pattern, options);
  }

  /**
   * Invalidate cache by event
   */
  async invalidateByEvent(eventType, data, options = {}) {
    this.bufferEventInvalidation(eventType, { ...data, ...options });
  }

  /**
   * Invalidation Strategy Implementations
   */

  /**
   * Immediate invalidation strategy
   */
  async immediateInvalidation(key, options = {}) {
    const span = this.tracer?.startSpan('cache.invalidation.immediate', {
      attributes: { 'cache.key': key }
    });
    const startTime = performance.now();
    
    try {
      const result = await this.cachingEngine.delete(key);
      
      this.state.stats.totalInvalidations++;
      this.state.stats.averageLatency = this.updateAverageLatency(performance.now() - startTime);
      
      this.invalidationCounter?.add(1, { strategy: 'immediate' });
      this.latencyHistogram?.record(performance.now() - startTime);
      
      this.emit('invalidated', {
        key,
        strategy: 'immediate',
        result,
        options
      });
      
      return { success: true, key, result };
    } catch (error) {
      console.error('[CacheInvalidationService] Immediate invalidation error:', key, error);
      this.state.stats.errors++;
      span?.recordException(error);
      return { success: false, key, error: error.message };
    } finally {
      span?.end();
    }
  }

  /**
   * Batch invalidation strategy
   */
  async batchInvalidation(key, options = {}) {
    // Add to batch queue
    this.state.invalidationQueue.push({
      key,
      options,
      timestamp: Date.now()
    });
    
    // Process immediately if queue is full
    if (this.state.invalidationQueue.length >= this.config.batchSize) {
      return this.processBatchInvalidations();
    }
    
    return { success: true, key, queued: true };
  }

  /**
   * Process batch invalidations
   */
  async processBatchInvalidations() {
    if (this.state.invalidationQueue.length === 0) return;
    
    const span = this.tracer?.startSpan('cache.invalidation.batch');
    const startTime = performance.now();
    const batch = this.state.invalidationQueue.splice(0, this.config.batchSize);
    
    try {
      const keys = batch.map(item => item.key);
      const results = await Promise.allSettled(
        keys.map(key => this.cachingEngine.delete(key))
      );
      
      let successful = 0;
      const processedItems = batch.map((item, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          successful++;
          return { ...item, success: true, result: result.value };
        } else {
          this.state.stats.errors++;
          return { ...item, success: false, error: result.reason?.message };
        }
      });
      
      this.state.stats.totalInvalidations += successful;
      this.state.stats.batchInvalidations++;
      this.state.stats.averageLatency = this.updateAverageLatency(performance.now() - startTime);
      
      this.invalidationCounter?.add(successful, { strategy: 'batch' });
      this.latencyHistogram?.record(performance.now() - startTime);
      
      this.emit('batchInvalidated', {
        total: batch.length,
        successful,
        failed: batch.length - successful,
        items: processedItems
      });
      
      console.log(`[CacheInvalidationService] 📦 Batch invalidated ${successful}/${batch.length} keys`);
      
      return { success: true, total: batch.length, successful };
    } catch (error) {
      console.error('[CacheInvalidationService] Batch invalidation error:', error);
      this.state.stats.errors++;
      span?.recordException(error);
      return { success: false, error: error.message };
    } finally {
      span?.end();
    }
  }

  /**
   * Cascade invalidation strategy
   */
  async cascadeInvalidation(key, options = {}, depth = 0) {
    if (depth >= this.config.dependencies.maxDepth) {
      console.warn('[CacheInvalidationService] Max cascade depth reached for:', key);
      return { success: false, error: 'Max cascade depth exceeded' };
    }
    
    const span = this.tracer?.startSpan('cache.invalidation.cascade', {
      attributes: { 
        'cache.key': key,
        'cascade.depth': depth
      }
    });
    
    try {
      // First invalidate the key itself
      const selfResult = await this.immediateInvalidation(key, options);
      
      // Get dependent keys
      const dependencies = this.state.dependencies.get(key);
      if (!dependencies || dependencies.size === 0) {
        return selfResult;
      }
      
      // Recursively invalidate dependencies
      const cascadeResults = await Promise.allSettled(
        Array.from(dependencies).map(depKey => 
          this.cascadeInvalidation(depKey, options, depth + 1)
        )
      );
      
      let successfulCascades = 0;
      cascadeResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successfulCascades++;
        }
      });
      
      this.state.stats.cascadeInvalidations++;
      this.cascadeGauge?.record(depth + 1);
      
      this.emit('cascadeInvalidated', {
        key,
        depth: depth + 1,
        dependencies: dependencies.size,
        successful: successfulCascades,
        selfResult,
        cascadeResults
      });
      
      console.log(`[CacheInvalidationService] 🌊 Cascade invalidated ${key} with ${successfulCascades}/${dependencies.size} dependencies (depth: ${depth + 1})`);
      
      return {
        success: true,
        key,
        depth: depth + 1,
        selfResult,
        cascadeCount: successfulCascades
      };
    } catch (error) {
      console.error('[CacheInvalidationService] Cascade invalidation error:', key, error);
      this.state.stats.errors++;
      span?.recordException(error);
      return { success: false, key, error: error.message };
    } finally {
      span?.end();
    }
  }

  /**
   * Pattern invalidation strategy
   */
  async patternInvalidation(pattern, options = {}) {
    const span = this.tracer?.startSpan('cache.invalidation.pattern', {
      attributes: { 'cache.pattern': pattern }
    });
    const startTime = performance.now();
    
    try {
      const matchType = options.matchType || this.detectPatternType(pattern);
      const matcher = this.patternMatchers.get(matchType);
      
      if (!matcher) {
        throw new Error(`Unknown pattern match type: ${matchType}`);
      }
      
      // Get all cache keys (this would need to be implemented in the caching engine)
      const allKeys = await this.cachingEngine.getAllKeys();
      const matchingKeys = allKeys.filter(key => matcher(key, pattern));
      
      if (matchingKeys.length === 0) {
        return { success: true, pattern, matches: 0 };
      }
      
      // Invalidate matching keys
      const results = await Promise.allSettled(
        matchingKeys.map(key => this.cachingEngine.delete(key))
      );
      
      let successful = 0;
      results.forEach(result => {
        if (result.status === 'fulfilled') successful++;
      });
      
      this.state.stats.totalInvalidations += successful;
      this.state.stats.patternMatches++;
      this.state.stats.averageLatency = this.updateAverageLatency(performance.now() - startTime);
      
      this.invalidationCounter?.add(successful, { strategy: 'pattern', matchType });
      this.latencyHistogram?.record(performance.now() - startTime);
      
      this.emit('patternInvalidated', {
        pattern,
        matchType,
        total: matchingKeys.length,
        successful,
        failed: matchingKeys.length - successful
      });
      
      console.log(`[CacheInvalidationService] 🎯 Pattern invalidated ${successful}/${matchingKeys.length} keys for pattern: ${pattern}`);
      
      return { success: true, pattern, matches: successful };
    } catch (error) {
      console.error('[CacheInvalidationService] Pattern invalidation error:', pattern, error);
      this.state.stats.errors++;
      span?.recordException(error);
      return { success: false, pattern, error: error.message };
    } finally {
      span?.end();
    }
  }

  /**
   * Event-driven invalidation strategy
   */
  async eventDrivenInvalidation(eventType, data, options = {}) {
    const handler = this.eventHandlers.get(eventType);
    if (!handler) {
      console.warn('[CacheInvalidationService] No handler for event type:', eventType);
      return { success: false, error: `No handler for event type: ${eventType}` };
    }
    
    try {
      const result = await handler(data, options);
      this.state.stats.eventDrivenInvalidations++;
      return result;
    } catch (error) {
      console.error('[CacheInvalidationService] Event-driven invalidation error:', eventType, error);
      this.state.stats.errors++;
      return { success: false, error: error.message };
    }
  }

  /**
   * Conditional invalidation strategy
   */
  async conditionalInvalidation(key, condition, options = {}) {
    try {
      const shouldInvalidate = await this.evaluateCondition(key, condition);
      
      if (shouldInvalidate) {
        return this.immediateInvalidation(key, options);
      } else {
        return { success: true, key, skipped: true, reason: 'Condition not met' };
      }
    } catch (error) {
      console.error('[CacheInvalidationService] Conditional invalidation error:', key, error);
      this.state.stats.errors++;
      return { success: false, key, error: error.message };
    }
  }

  /**
   * Lazy invalidation strategy
   */
  async lazyInvalidation(key, options = {}) {
    // Mark key for lazy invalidation (invalidate on next access)
    if (this.cachingEngine.markForLazyInvalidation) {
      return this.cachingEngine.markForLazyInvalidation(key, options);
    } else {
      // Fallback to immediate invalidation
      return this.immediateInvalidation(key, options);
    }
  }

  /**
   * Smart invalidation strategy
   */
  async smartInvalidation(key, options = {}) {
    // Choose optimal strategy based on context
    const context = await this.analyzeInvalidationContext(key, options);
    
    let strategy = 'immediate'; // default
    
    if (context.hasDependencies && context.dependencyCount > 10) {
      strategy = 'cascade';
    } else if (context.isFrequentlyAccessed) {
      strategy = 'lazy';
    } else if (context.canBatch) {
      strategy = 'batch';
    }
    
    console.log(`[CacheInvalidationService] 🧠 Smart strategy selected: ${strategy} for ${key}`);
    
    const strategyFn = this.strategies.get(strategy);
    return strategyFn(key, { ...options, smartContext: context });
  }

  /**
   * Pattern Matchers
   */
  matchWildcard(key, pattern) {
    const regex = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(key);
  }

  matchRegex(key, pattern) {
    try {
      return new RegExp(pattern).test(key);
    } catch (error) {
      console.warn('[CacheInvalidationService] Invalid regex pattern:', pattern);
      return false;
    }
  }

  matchTag(key, pattern) {
    // Assuming keys can have tags like "key:tag1,tag2"
    const tagPart = key.split(':').pop();
    if (!tagPart) return false;
    
    const tags = tagPart.split(',');
    return tags.includes(pattern);
  }

  matchPrefix(key, pattern) {
    return key.startsWith(pattern);
  }

  matchSuffix(key, pattern) {
    return key.endsWith(pattern);
  }

  matchContains(key, pattern) {
    return key.includes(pattern);
  }

  /**
   * Event Handlers
   */
  async handleDataUpdate(data, options) {
    // Invalidate caches related to data updates
    if (data.table || data.entity) {
      const pattern = `${data.table || data.entity}:*`;
      return this.patternInvalidation(pattern, { ...options, matchType: 'wildcard' });
    }
    return { success: false, error: 'No invalidation target specified' };
  }

  async handleUserAction(data, options) {
    // Invalidate user-specific caches
    if (data.userId) {
      const pattern = `user:${data.userId}:*`;
      return this.patternInvalidation(pattern, { ...options, matchType: 'wildcard' });
    }
    return { success: false, error: 'No user ID specified' };
  }

  async handleSystemEvent(data, options) {
    // Handle general system events
    if (data.pattern) {
      return this.patternInvalidation(data.pattern, options);
    } else if (data.key) {
      return this.immediateInvalidation(data.key, options);
    }
    return { success: false, error: 'No invalidation target specified' };
  }

  async handleTimeBased(data, options) {
    // Handle time-based invalidations (TTL expiry, scheduled invalidations)
    if (data.keys) {
      const results = await Promise.allSettled(
        data.keys.map(key => this.immediateInvalidation(key, options))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      return { success: true, total: data.keys.length, successful };
    }
    return { success: false, error: 'No keys specified' };
  }

  async handleExternalChange(data, options) {
    // Handle external system changes (API updates, database changes)
    if (data.affectedKeys) {
      return this.batchInvalidation(data.affectedKeys, options);
    }
    return { success: false, error: 'No affected keys specified' };
  }

  /**
   * Utility Methods
   */
  detectPatternType(pattern) {
    if (pattern.includes('*') || pattern.includes('?')) return 'wildcard';
    if (pattern.startsWith('/') && pattern.endsWith('/')) return 'regex';
    if (pattern.startsWith('tag:')) return 'tag';
    if (pattern.endsWith(':*')) return 'prefix';
    if (pattern.startsWith('*:')) return 'suffix';
    return 'contains';
  }

  async evaluateCondition(key, condition) {
    // Evaluate invalidation condition
    if (typeof condition === 'function') {
      return condition(key, this.cachingEngine);
    }
    
    if (typeof condition === 'object') {
      // Handle condition objects
      if (condition.ttl) {
        const ttl = await this.cachingEngine.getTTL(key);
        return ttl <= condition.ttl;
      }
      
      if (condition.accessCount) {
        const stats = await this.cachingEngine.getKeyStats(key);
        return stats.accessCount >= condition.accessCount;
      }
      
      if (condition.lastAccess) {
        const stats = await this.cachingEngine.getKeyStats(key);
        return Date.now() - stats.lastAccess >= condition.lastAccess;
      }
    }
    
    return true; // Default to true
  }

  async analyzeInvalidationContext(key, options) {
    const context = {
      hasDependencies: this.state.dependencies.has(key),
      dependencyCount: this.state.dependencies.get(key)?.size || 0,
      isFrequentlyAccessed: false,
      canBatch: true
    };
    
    // Analyze access patterns if available
    if (this.cachingEngine.getKeyStats) {
      const stats = await this.cachingEngine.getKeyStats(key);
      context.isFrequentlyAccessed = stats.accessCount > 100; // Arbitrary threshold
    }
    
    return context;
  }

  updateAverageLatency(latency) {
    const alpha = 0.1; // Smoothing factor
    return this.state.stats.averageLatency * (1 - alpha) + latency * alpha;
  }

  /**
   * Get invalidation statistics
   */
  getStatistics() {
    return {
      ...this.state.stats,
      dependencies: this.state.dependencies.size,
      reverseDependencies: this.state.reverseDependencies.size,
      queueSize: this.state.invalidationQueue.length,
      activeInvalidations: this.state.activeInvalidations.size,
      eventBuffers: Object.fromEntries(
        Array.from(this.state.eventBuffer.entries()).map(([type, buffer]) => 
          [type, buffer.length]
        )
      )
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: 'healthy',
      config: this.config,
      statistics: this.getStatistics(),
      strategies: Array.from(this.strategies.keys()),
      patternMatchers: Array.from(this.patternMatchers.keys()),
      eventHandlers: Array.from(this.eventHandlers.keys()),
      timestamp: Date.now()
    };
  }
}

export default CacheInvalidationService;
