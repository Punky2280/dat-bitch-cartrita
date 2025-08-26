/**
 * Language Router Service - Intelligent task distribution between Node.js and Python
 * Determines optimal language runtime based on task characteristics and agent capabilities
 */

import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Intelligent router for determining optimal language runtime for tasks
 */
class LanguageRouter {
  constructor(config = {}) {
    this.config = {
      // Scoring weights for different factors
      performanceWeight: 0.3,
      capabilityWeight: 0.4,
      resourceWeight: 0.2,
      availabilityWeight: 0.1,
      
      // Language preferences for different task types
      languagePreferences: {
        // Python-favored tasks
        'ml_inference': { python: 0.9, nodejs: 0.1 },
        'data_analysis': { python: 0.85, nodejs: 0.15 },
        'vector_search': { python: 0.8, nodejs: 0.2 },
        'nlp_processing': { python: 0.75, nodejs: 0.25 },
        'scientific_computing': { python: 0.9, nodejs: 0.1 },
        'image_processing': { python: 0.8, nodejs: 0.2 },
        'audio_processing': { python: 0.7, nodejs: 0.3 },
        'neural_network': { python: 0.95, nodejs: 0.05 },
        
        // Node.js-favored tasks
        'real_time_api': { nodejs: 0.9, python: 0.1 },
        'websocket_handling': { nodejs: 0.85, python: 0.15 },
        'frontend_integration': { nodejs: 0.9, python: 0.1 },
        'auth_management': { nodejs: 0.7, python: 0.3 },
        'session_handling': { nodejs: 0.8, python: 0.2 },
        'api_orchestration': { nodejs: 0.75, python: 0.25 },
        'event_streaming': { nodejs: 0.8, python: 0.2 },
        'json_processing': { nodejs: 0.6, python: 0.4 },
        
        // Balanced tasks
        'database_query': { nodejs: 0.5, python: 0.5 },
        'file_processing': { nodejs: 0.4, python: 0.6 },
        'http_requests': { nodejs: 0.6, python: 0.4 },
        'text_processing': { nodejs: 0.3, python: 0.7 },
        'caching': { nodejs: 0.6, python: 0.4 }
      },
      
      // Capability scoring for languages
      capabilityScoring: {
        python: {
          'machine_learning': 10,
          'data_science': 10,
          'scientific_computing': 10,
          'neural_networks': 10,
          'computer_vision': 9,
          'natural_language': 8,
          'vector_operations': 9,
          'statistical_analysis': 10,
          'deep_learning': 10,
          'image_processing': 8,
          'audio_analysis': 7,
          'graph_algorithms': 7
        },
        nodejs: {
          'real_time_communication': 10,
          'api_development': 9,
          'event_handling': 10,
          'websocket': 10,
          'json_manipulation': 9,
          'frontend_integration': 10,
          'authentication': 8,
          'session_management': 9,
          'middleware': 9,
          'routing': 9,
          'streaming': 8,
          'concurrent_processing': 7
        }
      },
      
      ...config
    };

    // Performance tracking
    this.performanceHistory = new Map(); // language -> performance metrics
    this.routingDecisions = [];
    this.decisionCache = new Map();

    // Initialize performance tracking
    this.performanceHistory.set('python', {
      avgResponseTime: 500,  // ms
      successRate: 0.95,
      throughput: 100,       // tasks/minute
      resourceUsage: 0.6     // 0-1 scale
    });

    this.performanceHistory.set('nodejs', {
      avgResponseTime: 150,  // ms
      successRate: 0.98,
      throughput: 300,       // tasks/minute
      resourceUsage: 0.3     // 0-1 scale
    });

    this.tracer = OpenTelemetryTracing.getTracer('language-router');
    
    console.log('[LanguageRouter] Initialized with configuration');
  }

  /**
   * Determine optimal language for a given task
   */
  async determineOptimalLanguage(task, context = {}) {
    return OpenTelemetryTracing.traceOperation('language.router.determine_optimal', async (span) => {
      span.setAttributes({
        'router.task.type': task.task_type || 'unknown',
        'router.task.id': task.task_id || 'unknown',
        'router.context.priority': context.priority || 'normal'
      });

      try {
        const startTime = Date.now();
        
        // Check cache first
        const cacheKey = this._generateCacheKey(task, context);
        if (this.decisionCache.has(cacheKey) && !context.bypassCache) {
          const cachedDecision = this.decisionCache.get(cacheKey);
          span.setAttributes({
            'router.decision.cached': true,
            'router.decision.language': cachedDecision.language
          });
          return cachedDecision;
        }

        // Calculate scores for each language
        const pythonScore = await this._calculateLanguageScore('python', task, context);
        const nodejsScore = await this._calculateLanguageScore('nodejs', task, context);

        // Make routing decision
        const decision = {
          language: pythonScore > nodejsScore ? 'python' : 'nodejs',
          confidence: Math.abs(pythonScore - nodejsScore) / Math.max(pythonScore, nodejsScore),
          scores: { python: pythonScore, nodejs: nodejsScore },
          reasoning: this._generateReasoning(task, pythonScore, nodejsScore),
          timestamp: new Date().toISOString(),
          decisionTime: Date.now() - startTime
        };

        // Cache the decision
        this.decisionCache.set(cacheKey, decision);
        
        // Track routing decision
        this.routingDecisions.push({
          ...decision,
          taskType: task.task_type,
          taskId: task.task_id
        });

        // Limit cache size
        if (this.decisionCache.size > 1000) {
          const oldestKey = this.decisionCache.keys().next().value;
          this.decisionCache.delete(oldestKey);
        }

        span.setAttributes({
          'router.decision.language': decision.language,
          'router.decision.confidence': decision.confidence,
          'router.decision.python_score': pythonScore,
          'router.decision.nodejs_score': nodejsScore,
          'router.decision.time_ms': decision.decisionTime
        });

        console.log(`[LanguageRouter] Task ${task.task_id} routed to ${decision.language} (confidence: ${decision.confidence.toFixed(2)})`);
        
        return decision;

      } catch (error) {
        span.recordException(error);
        console.error('[LanguageRouter] Routing decision failed:', error);
        
        // Fallback to Node.js for reliability
        return {
          language: 'nodejs',
          confidence: 0.0,
          scores: { python: 0, nodejs: 1 },
          reasoning: 'Fallback due to routing error',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    });
  }

  /**
   * Calculate language score for a specific task
   */
  async _calculateLanguageScore(language, task, context) {
    let totalScore = 0;
    let factorCount = 0;

    // 1. Task type preference score
    const taskTypeScore = this._getTaskTypeScore(language, task.task_type);
    totalScore += taskTypeScore * this.config.performanceWeight;
    factorCount++;

    // 2. Capability matching score
    const capabilityScore = this._getCapabilityScore(language, task.required_capabilities || []);
    totalScore += capabilityScore * this.config.capabilityWeight;
    factorCount++;

    // 3. Performance score
    const performanceScore = this._getPerformanceScore(language, context);
    totalScore += performanceScore * this.config.performanceWeight;
    factorCount++;

    // 4. Resource availability score
    const resourceScore = this._getResourceScore(language, context);
    totalScore += resourceScore * this.config.resourceWeight;
    factorCount++;

    // 5. Agent availability score
    const availabilityScore = await this._getAvailabilityScore(language, task);
    totalScore += availabilityScore * this.config.availabilityWeight;
    factorCount++;

    return factorCount > 0 ? totalScore / factorCount : 0;
  }

  /**
   * Get task type preference score
   */
  _getTaskTypeScore(language, taskType) {
    const preferences = this.config.languagePreferences[taskType];
    if (!preferences) {
      // Default equal preference for unknown task types
      return 0.5;
    }
    return preferences[language] || 0;
  }

  /**
   * Get capability matching score
   */
  _getCapabilityScore(language, requiredCapabilities) {
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return 0.5; // Neutral score if no specific capabilities required
    }

    const languageCapabilities = this.config.capabilityScoring[language] || {};
    let totalScore = 0;
    let matchedCapabilities = 0;

    for (const capability of requiredCapabilities) {
      const score = languageCapabilities[capability];
      if (score !== undefined) {
        totalScore += score / 10; // Normalize to 0-1
        matchedCapabilities++;
      }
    }

    // Return average score for matched capabilities, penalty for unmatched
    if (matchedCapabilities === 0) {
      return 0.1; // Low score if no capabilities match
    }

    const avgScore = totalScore / matchedCapabilities;
    const coverageRatio = matchedCapabilities / requiredCapabilities.length;
    
    return avgScore * coverageRatio;
  }

  /**
   * Get performance score based on historical data
   */
  _getPerformanceScore(language, context) {
    const performance = this.performanceHistory.get(language);
    if (!performance) {
      return 0.5; // Neutral score if no performance data
    }

    let score = 0;

    // Response time score (lower is better)
    const responseTimeScore = Math.max(0, 1 - (performance.avgResponseTime / 2000)); // 2s max
    score += responseTimeScore * 0.3;

    // Success rate score
    score += performance.successRate * 0.4;

    // Throughput score (relative)
    const maxThroughput = 500; // tasks/minute
    const throughputScore = Math.min(1, performance.throughput / maxThroughput);
    score += throughputScore * 0.2;

    // Resource usage score (lower is better for efficiency)
    const resourceScore = Math.max(0, 1 - performance.resourceUsage);
    score += resourceScore * 0.1;

    return score;
  }

  /**
   * Get resource availability score
   */
  _getResourceScore(language, context) {
    // This would integrate with actual resource monitoring
    // For now, return mock scores based on general characteristics
    
    if (context.requiresGPU && language === 'python') {
      return 0.8; // Python better for GPU tasks
    }

    if (context.requiresLowLatency && language === 'nodejs') {
      return 0.9; // Node.js better for low-latency tasks
    }

    if (context.resourceIntensive && language === 'python') {
      return 0.7; // Python better for resource-intensive tasks
    }

    return 0.5; // Neutral score
  }

  /**
   * Get agent availability score
   */
  async _getAvailabilityScore(language, task) {
    // This would check actual agent availability
    // Mock implementation for now
    
    if (language === 'python') {
      // Simulate Python agent availability check
      return 0.8;
    } else {
      // Node.js agents (always available as they're part of the same process)
      return 0.9;
    }
  }

  /**
   * Generate reasoning explanation for the routing decision
   */
  _generateReasoning(task, pythonScore, nodejsScore) {
    const winner = pythonScore > nodejsScore ? 'Python' : 'Node.js';
    const loser = pythonScore > nodejsScore ? 'Node.js' : 'Python';
    const winnerScore = Math.max(pythonScore, nodejsScore);
    const loserScore = Math.min(pythonScore, nodejsScore);
    
    const factors = [];
    
    // Task type reasoning
    const taskTypePrefs = this.config.languagePreferences[task.task_type];
    if (taskTypePrefs) {
      const pythonPref = taskTypePrefs.python || 0;
      const nodejsPref = taskTypePrefs.nodejs || 0;
      
      if (pythonPref > nodejsPref) {
        factors.push(`Task type '${task.task_type}' favors Python (${pythonPref.toFixed(2)} vs ${nodejsPref.toFixed(2)})`);
      } else if (nodejsPref > pythonPref) {
        factors.push(`Task type '${task.task_type}' favors Node.js (${nodejsPref.toFixed(2)} vs ${pythonPref.toFixed(2)})`);
      }
    }

    // Capability reasoning
    if (task.required_capabilities && task.required_capabilities.length > 0) {
      factors.push(`Required capabilities: ${task.required_capabilities.join(', ')}`);
    }

    return {
      decision: `${winner} selected over ${loser}`,
      scoreDifference: (winnerScore - loserScore).toFixed(3),
      factors,
      confidence: Math.abs(pythonScore - nodejsScore) / Math.max(pythonScore, nodejsScore)
    };
  }

  /**
   * Generate cache key for routing decisions
   */
  _generateCacheKey(task, context) {
    const keyComponents = [
      task.task_type || 'unknown',
      (task.required_capabilities || []).sort().join(','),
      context.priority || 'normal',
      context.requiresGPU ? 'gpu' : 'nogpu',
      context.requiresLowLatency ? 'lowlat' : 'normal'
    ];
    
    return keyComponents.join('|');
  }

  /**
   * Update performance metrics for a language
   */
  updatePerformanceMetrics(language, metrics) {
    const currentMetrics = this.performanceHistory.get(language) || {};
    
    // Update with exponential moving average
    const alpha = 0.1; // Smoothing factor
    
    const updatedMetrics = {
      avgResponseTime: currentMetrics.avgResponseTime * (1 - alpha) + (metrics.responseTime || 0) * alpha,
      successRate: currentMetrics.successRate * (1 - alpha) + (metrics.successRate || 1) * alpha,
      throughput: currentMetrics.throughput * (1 - alpha) + (metrics.throughput || 0) * alpha,
      resourceUsage: currentMetrics.resourceUsage * (1 - alpha) + (metrics.resourceUsage || 0) * alpha
    };

    this.performanceHistory.set(language, updatedMetrics);
    
    console.log(`[LanguageRouter] Updated performance metrics for ${language}:`, updatedMetrics);
  }

  /**
   * Get routing statistics
   */
  getRoutingStats() {
    const recentDecisions = this.routingDecisions.slice(-100); // Last 100 decisions
    
    const stats = {
      totalDecisions: this.routingDecisions.length,
      recentDecisions: recentDecisions.length,
      languageDistribution: {},
      averageDecisionTime: 0,
      averageConfidence: 0,
      cacheHitRate: 0
    };

    // Calculate distributions and averages
    let totalDecisionTime = 0;
    let totalConfidence = 0;

    for (const decision of recentDecisions) {
      const lang = decision.language;
      stats.languageDistribution[lang] = (stats.languageDistribution[lang] || 0) + 1;
      totalDecisionTime += decision.decisionTime || 0;
      totalConfidence += decision.confidence || 0;
    }

    if (recentDecisions.length > 0) {
      stats.averageDecisionTime = totalDecisionTime / recentDecisions.length;
      stats.averageConfidence = totalConfidence / recentDecisions.length;
    }

    // Performance history
    stats.performanceHistory = Object.fromEntries(this.performanceHistory);

    return stats;
  }

  /**
   * Clear decision cache
   */
  clearCache() {
    this.decisionCache.clear();
    console.log('[LanguageRouter] Decision cache cleared');
  }

  /**
   * Add custom task type preference
   */
  addTaskTypePreference(taskType, preferences) {
    this.config.languagePreferences[taskType] = preferences;
    console.log(`[LanguageRouter] Added task type preference: ${taskType}`, preferences);
  }

  /**
   * Add capability scoring for a language
   */
  addCapabilityScoring(language, capability, score) {
    if (!this.config.capabilityScoring[language]) {
      this.config.capabilityScoring[language] = {};
    }
    this.config.capabilityScoring[language][capability] = score;
    console.log(`[LanguageRouter] Added capability scoring: ${language}.${capability} = ${score}`);
  }
}

export default LanguageRouter;