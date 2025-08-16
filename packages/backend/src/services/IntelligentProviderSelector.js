/**
 * Intelligent Provider Selector - Advanced AI provider selection with cost/latency optimization
 * Implements dynamic provider selection based on performance, cost, and availability
 */

import db from '../db.js';

class IntelligentProviderSelector {
  constructor() {
    this.providerMetrics = new Map();
    this.costTable = new Map();
    this.latencyHistory = new Map();
    this.availabilityStatus = new Map();
    this.updateInterval = null;
    this.selectionStrategies = new Map();
    
    this.initializeProviderData();
    this.setupSelectionStrategies();
  }

  initializeProviderData() {
    // Initialize provider cost data (per 1M tokens/requests)
    this.costTable.set('openai', {
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002,
      'text-embedding-3-large': 0.00013,
      'dall-e-3': 0.040,
      'whisper-1': 0.006
    });

    this.costTable.set('huggingface', {
      'chat': 0.001,
      'embedding': 0.00005,
      'image-generation': 0.002,
      'audio-transcription': 0.003
    });

    this.costTable.set('deepgram', {
      'nova-2': 0.0043,
      'base': 0.0025,
      'enhanced': 0.0059
    });

    // Initialize availability status
    ['openai', 'huggingface', 'deepgram'].forEach(provider => {
      this.availabilityStatus.set(provider, {
        available: true,
        lastChecked: Date.now(),
        consecutiveFailures: 0,
        responseTime: 0,
        errorRate: 0
      });
    });
  }

  setupSelectionStrategies() {
    // Cost-optimized strategy
    this.selectionStrategies.set('cost', (providers, task, context) => {
      return providers.sort((a, b) => {
        const costA = this.getProviderCost(a, task, context);
        const costB = this.getProviderCost(b, task, context);
        return costA - costB;
      });
    });

    // Latency-optimized strategy  
    this.selectionStrategies.set('latency', (providers, task, context) => {
      return providers.sort((a, b) => {
        const latencyA = this.getAverageLatency(a, task);
        const latencyB = this.getAverageLatency(b, task);
        return latencyA - latencyB;
      });
    });

    // Balanced strategy (default)
    this.selectionStrategies.set('balanced', (providers, task, context) => {
      return providers.sort((a, b) => {
        const scoreA = this.calculateProviderScore(a, task, context);
        const scoreB = this.calculateProviderScore(b, task, context);
        return scoreB - scoreA; // Higher score is better
      });
    });

    // Quality-optimized strategy
    this.selectionStrategies.set('quality', (providers, task, context) => {
      return providers.sort((a, b) => {
        const qualityA = this.getProviderQuality(a, task);
        const qualityB = this.getProviderQuality(b, task);
        return qualityB - qualityA; // Higher quality is better
      });
    });
  }

  async selectOptimalProvider(availableProviders, task, options = {}) {
    const {
      strategy = 'balanced',
      maxCost = null,
      maxLatency = null,
      requireHighQuality = false,
      userId = null
    } = options;

    // Filter providers based on availability
    const availableOnly = availableProviders.filter(provider => 
      this.isProviderAvailable(provider)
    );

    if (availableOnly.length === 0) {
      throw new Error('No providers currently available');
    }

    // Apply constraints
    let candidates = availableOnly;

    if (maxCost !== null) {
      candidates = candidates.filter(provider => 
        this.getProviderCost(provider, task, options) <= maxCost
      );
    }

    if (maxLatency !== null) {
      candidates = candidates.filter(provider => 
        this.getAverageLatency(provider, task) <= maxLatency
      );
    }

    if (requireHighQuality) {
      candidates = candidates.filter(provider => 
        this.getProviderQuality(provider, task) >= 0.8
      );
    }

    if (candidates.length === 0) {
      throw new Error('No providers meet the specified constraints');
    }

    // Apply selection strategy
    const selectionStrategy = this.selectionStrategies.get(strategy) || 
                             this.selectionStrategies.get('balanced');
    
    const sortedCandidates = selectionStrategy(candidates, task, options);

    // Log selection decision
    await this.logProviderSelection({
      task,
      strategy,
      selectedProvider: sortedCandidates[0],
      alternatives: sortedCandidates.slice(1, 3),
      userId,
      timestamp: new Date().toISOString(),
      constraints: { maxCost, maxLatency, requireHighQuality }
    });

    return {
      provider: sortedCandidates[0],
      confidence: this.calculateSelectionConfidence(sortedCandidates[0], task, options),
      estimatedCost: this.getProviderCost(sortedCandidates[0], task, options),
      estimatedLatency: this.getAverageLatency(sortedCandidates[0], task),
      qualityScore: this.getProviderQuality(sortedCandidates[0], task),
      alternatives: sortedCandidates.slice(1, 3).map(p => ({
        provider: p,
        cost: this.getProviderCost(p, task, options),
        latency: this.getAverageLatency(p, task),
        quality: this.getProviderQuality(p, task)
      }))
    };
  }

  calculateProviderScore(provider, task, context) {
    const availability = this.isProviderAvailable(provider) ? 1.0 : 0.0;
    const cost = 1.0 / (this.getProviderCost(provider, task, context) + 0.001); // Inverse cost
    const latency = 1.0 / (this.getAverageLatency(provider, task) + 50); // Inverse latency
    const quality = this.getProviderQuality(provider, task);
    const reliability = 1.0 - this.getProviderErrorRate(provider, task);

    // Weighted scoring
    const weights = {
      availability: 0.3,
      cost: 0.2,
      latency: 0.25,
      quality: 0.15,
      reliability: 0.1
    };

    return (
      availability * weights.availability +
      cost * weights.cost +
      latency * weights.latency +
      quality * weights.quality +
      reliability * weights.reliability
    );
  }

  getProviderCost(provider, task, context) {
    const providerCosts = this.costTable.get(provider) || {};
    const estimatedTokens = this.estimateTokenUsage(task, context);
    
    // Default cost per provider type
    let unitCost = 0.01; // Default fallback
    
    if (provider === 'openai') {
      if (task === 'chat' || task === 'completion') {
        unitCost = providerCosts['gpt-4'] || 0.03;
      } else if (task === 'embedding') {
        unitCost = providerCosts['text-embedding-3-large'] || 0.00013;
      } else if (task === 'image-generation') {
        unitCost = providerCosts['dall-e-3'] || 0.040;
      } else if (task === 'audio-transcription') {
        unitCost = providerCosts['whisper-1'] || 0.006;
      }
    } else if (provider === 'huggingface') {
      unitCost = providerCosts[task] || 0.001;
    } else if (provider === 'deepgram') {
      unitCost = providerCosts['nova-2'] || 0.0043;
    }

    return (estimatedTokens / 1000000) * unitCost;
  }

  estimateTokenUsage(task, context) {
    const { input = '', options = {} } = context || {};
    const inputLength = input.length || 0;
    
    switch (task) {
      case 'chat':
      case 'completion':
        // Estimate tokens as roughly 4 characters per token
        return Math.max(inputLength / 4, 10) + (options.max_tokens || 150);
      
      case 'embedding':
        return Math.max(inputLength / 4, 10);
      
      case 'image-generation':
        return 1; // Flat rate per image
      
      case 'audio-transcription':
        return Math.max(inputLength / 100, 1); // Estimate based on audio length
      
      default:
        return Math.max(inputLength / 4, 50);
    }
  }

  getAverageLatency(provider, task) {
    const key = `${provider}:${task}`;
    const history = this.latencyHistory.get(key) || [];
    
    if (history.length === 0) {
      // Default latencies by provider
      const defaults = {
        'openai': 800,
        'huggingface': 1200,
        'deepgram': 400
      };
      return defaults[provider] || 1000;
    }

    return history.reduce((sum, latency) => sum + latency, 0) / history.length;
  }

  getProviderQuality(provider, task) {
    // Quality scores based on provider capabilities and task type
    const qualityMatrix = {
      'openai': {
        'chat': 0.95,
        'completion': 0.95,
        'embedding': 0.90,
        'image-generation': 0.95,
        'audio-transcription': 0.90,
        'vision': 0.92
      },
      'huggingface': {
        'chat': 0.85,
        'completion': 0.85,
        'embedding': 0.88,
        'image-generation': 0.80,
        'audio-transcription': 0.75,
        'classification': 0.90
      },
      'deepgram': {
        'audio-transcription': 0.95,
        'speech-analytics': 0.90
      }
    };

    return qualityMatrix[provider]?.[task] || 0.75;
  }

  getProviderErrorRate(provider, task) {
    const status = this.availabilityStatus.get(provider);
    return status?.errorRate || 0.0;
  }

  isProviderAvailable(provider) {
    const status = this.availabilityStatus.get(provider);
    if (!status) return false;

    // Check if provider has been failing recently
    if (status.consecutiveFailures >= 3) {
      const timeSinceLastCheck = Date.now() - status.lastChecked;
      const backoffTime = Math.min(status.consecutiveFailures * 30000, 300000); // Max 5 minutes
      
      if (timeSinceLastCheck < backoffTime) {
        return false;
      }
    }

    return status.available;
  }

  calculateSelectionConfidence(provider, task, options) {
    const score = this.calculateProviderScore(provider, task, options);
    const availability = this.isProviderAvailable(provider) ? 1.0 : 0.0;
    const recentSuccess = 1.0 - this.getProviderErrorRate(provider, task);
    
    return Math.min(score * availability * recentSuccess, 1.0);
  }

  async updateProviderMetrics(provider, task, metrics) {
    const { latency, success, cost } = metrics;
    
    // Update latency history
    const key = `${provider}:${task}`;
    if (!this.latencyHistory.has(key)) {
      this.latencyHistory.set(key, []);
    }
    
    const history = this.latencyHistory.get(key);
    history.push(latency);
    
    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }

    // Update availability status
    const status = this.availabilityStatus.get(provider);
    if (status) {
      status.lastChecked = Date.now();
      status.responseTime = latency;
      
      if (success) {
        status.consecutiveFailures = 0;
        status.available = true;
        status.errorRate = Math.max(0, status.errorRate - 0.1);
      } else {
        status.consecutiveFailures++;
        status.errorRate = Math.min(1.0, status.errorRate + 0.1);
        
        if (status.consecutiveFailures >= 3) {
          status.available = false;
        }
      }
    }

    // Store metrics in database for historical analysis
    try {
      await db.query(`
        INSERT INTO provider_metrics 
        (provider, task, latency_ms, success, cost, timestamp)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [provider, task, latency, success, cost]);
    } catch (error) {
      console.warn('[ProviderSelector] Failed to store metrics:', error.message);
    }
  }

  async logProviderSelection(selection) {
    try {
      await db.query(`
        INSERT INTO provider_selections 
        (task, strategy, selected_provider, alternatives, user_id, constraints, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        selection.task,
        selection.strategy,
        selection.selectedProvider,
        JSON.stringify(selection.alternatives),
        selection.userId,
        JSON.stringify(selection.constraints),
        selection.timestamp
      ]);
    } catch (error) {
      console.warn('[ProviderSelector] Failed to log selection:', error.message);
    }
  }

  async getProviderAnalytics(timeRange = '24h') {
    try {
      const query = `
        SELECT 
          provider,
          task,
          COUNT(*) as request_count,
          AVG(latency_ms) as avg_latency,
          AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
          SUM(cost) as total_cost
        FROM provider_metrics 
        WHERE timestamp > NOW() - INTERVAL '${timeRange}'
        GROUP BY provider, task
        ORDER BY request_count DESC
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.warn('[ProviderSelector] Failed to get analytics:', error.message);
      return [];
    }
  }

  getRealtimeMetrics() {
    return {
      availabilityStatus: Object.fromEntries(this.availabilityStatus),
      latencyHistory: Object.fromEntries(this.latencyHistory),
      lastUpdate: Date.now()
    };
  }

  async startMonitoring() {
    // Periodic health checks for all providers
    this.updateInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 60000); // Check every minute

    console.log('🎯 Intelligent provider selector monitoring started');
  }

  async performHealthChecks() {
    for (const provider of this.availabilityStatus.keys()) {
      try {
        const startTime = Date.now();
        const isHealthy = await this.checkProviderHealth(provider);
        const latency = Date.now() - startTime;
        
        await this.updateProviderMetrics(provider, 'health_check', {
          latency,
          success: isHealthy,
          cost: 0
        });
      } catch (error) {
        console.warn(`[ProviderSelector] Health check failed for ${provider}:`, error.message);
      }
    }
  }

  async checkProviderHealth(provider) {
    // Implement basic health checks for each provider
    // This would typically make a lightweight API call to each service
    return true; // Simplified for now
  }

  stopMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('🎯 Provider selector monitoring stopped');
  }
}

export default IntelligentProviderSelector;