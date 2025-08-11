/* global process, console */
// packages/backend/src/system/ApiRateLimiter.js

/**
 * Production API Rate Limiter for OpenAI and other APIs
 * Implements token bucket algorithm with exponential backoff and queue management
 * Prevents 429/529 rate limit errors while maximizing throughput
 */

class ApiRateLimiter {
  constructor(options = {}) {
    // Rate limits from environment or defaults
    this.maxRequestsPerMinute = parseInt(process.env.OPENAI_RPM_LIMIT) || 60;
    this.maxTokensPerMinute = parseInt(process.env.OPENAI_TPM_LIMIT) || 90000;
    this.maxConcurrentRequests = parseInt(process.env.OPENAI_CONCURRENT_LIMIT) || 10;
    
    // Token bucket implementation
    this.requestTokens = this.maxRequestsPerMinute;
    this.tokenTokens = this.maxTokensPerMinute;
    this.lastRefill = Date.now();
    
    // Request tracking
    this.requestQueue = [];
    this.activeRequests = 0;
    this.requestHistory = []; // Last minute of requests
    this.tokenHistory = []; // Last minute of token usage
    this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      totalTokensUsed: 0
    };
    
    // Refill tokens every second
    setInterval(() => this.refillTokens(), 1000);
    
    // Cleanup old history every 30 seconds
    setInterval(() => this.cleanupHistory(), 30000);
    
    console.log('[ApiRateLimiter] ✅ Initialized with limits:', {
      requestsPerMinute: this.maxRequestsPerMinute,
      tokensPerMinute: this.maxTokensPerMinute,
      concurrent: this.maxConcurrentRequests
    });
  }

  /**
   * Refill token buckets based on time elapsed
   */
  refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const secondsPassed = timePassed / 1000;
    
    // Refill request tokens (RPM / 60 per second)
    const requestRefill = (this.maxRequestsPerMinute / 60) * secondsPassed;
    this.requestTokens = Math.min(
      this.maxRequestsPerMinute,
      this.requestTokens + requestRefill
    );
    
    // Refill token tokens (TPM / 60 per second)  
    const tokenRefill = (this.maxTokensPerMinute / 60) * secondsPassed;
    this.tokenTokens = Math.min(
      this.maxTokensPerMinute,
      this.tokenTokens + tokenRefill
    );
    
    this.lastRefill = now;
    
    // Process queue if we have tokens available
    if (this.requestQueue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Queue an API request with intelligent rate limiting
   * @param {Function} apiCall - Function that makes the API call
   * @param {number} estimatedTokens - Estimated tokens for this request
   * @param {Object} options - Additional options
   * @returns {Promise} - Result of the API call
   */
  async queueRequest(apiCall, estimatedTokens = 1000, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        apiCall,
        estimatedTokens,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0,
        priority: options.priority || 0,
        maxRetries: options.maxRetries || 4,
        id: Math.random().toString(36).substr(2, 9)
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.requestQueue.findIndex(r => r.priority < request.priority);
      if (insertIndex === -1) {
        this.requestQueue.push(request);
      } else {
        this.requestQueue.splice(insertIndex, 0, request);
      }
      
      console.log(`[ApiRateLimiter] 📝 Queued request ${request.id} (${this.requestQueue.length} in queue)`);
      this.processQueue();
    });
  }

  /**
   * Process the request queue with intelligent throttling
   */
  async processQueue() {
    if (this.requestQueue.length === 0 || this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }

    this.refillTokens(); // Ensure tokens are current
    
    const nextRequest = this.requestQueue[0];
    
    // Check if we have enough tokens for this request
    if (this.requestTokens < 1) {
      console.log('[ApiRateLimiter] ⏳ Insufficient request tokens, waiting...');
      return;
    }
    
    if (this.tokenTokens < nextRequest.estimatedTokens) {
      console.log(`[ApiRateLimiter] ⏳ Insufficient token capacity (need ${nextRequest.estimatedTokens}, have ${Math.floor(this.tokenTokens)})`);
      return;
    }

    // Remove request from queue and consume tokens
    const request = this.requestQueue.shift();
    this.requestTokens -= 1;
    this.tokenTokens -= request.estimatedTokens;
    this.activeRequests++;
    
    console.log(`[ApiRateLimiter] 🚀 Executing request ${request.id} (${this.activeRequests} active)`);

    try {
      const result = await this.executeWithRetry(request);
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      // Process next request after a small delay
      setTimeout(() => this.processQueue(), 50);
    }
  }

  /**
   * Execute API call with intelligent retry logic
   */
  async executeWithRetry(request) {
    const { apiCall, estimatedTokens, retries, maxRetries, id } = request;
    this.stats.totalRequests++;

    try {
      // Record request attempt
      this.requestHistory.push({
        timestamp: Date.now(),
        estimatedTokens,
        requestId: id
      });

      const result = await apiCall();
      
      // Record actual token usage if available
      const actualTokens = result?.usage?.total_tokens || estimatedTokens;
      this.tokenHistory.push({
        timestamp: Date.now(),
        tokens: actualTokens,
        requestId: id
      });
      
      this.stats.successfulRequests++;
      this.stats.totalTokensUsed += actualTokens;
      
      console.log(`[ApiRateLimiter] ✅ Request ${id} completed (${actualTokens} tokens)`);
      return result;
      
    } catch (error) {
      console.log(`[ApiRateLimiter] ❌ Request ${id} failed:`, error.message);
      
      // Check if it's a rate limit error that we should retry
      const isRateLimitError = 
        error.status === 429 ||
        error.status === 529 ||
        error.code === 'rate_limit_exceeded' ||
        error.message?.toLowerCase().includes('rate limit') ||
        error.message?.toLowerCase().includes('overloaded') ||
        error.message?.toLowerCase().includes('too many requests');

      if (isRateLimitError && retries < maxRetries) {
        const delay = this.retryDelays[retries] || 16000;
        console.log(`[ApiRateLimiter] 🔄 Rate limit hit, retrying ${id} in ${delay}ms (attempt ${retries + 1}/${maxRetries + 1})`);
        
        this.stats.retriedRequests++;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Update retry count and try again
        request.retries = retries + 1;
        return this.executeWithRetry(request);
      }
      
      this.stats.failedRequests++;
      throw error;
    }
  }

  /**
   * Clean up old history entries (older than 2 minutes for safety buffer)
   */
  cleanupHistory() {
    const cutoff = Date.now() - 120000; // 2 minutes ago
    
    const beforeReq = this.requestHistory.length;
    const beforeTok = this.tokenHistory.length;
    
    this.requestHistory = this.requestHistory.filter(item => item.timestamp > cutoff);
    this.tokenHistory = this.tokenHistory.filter(item => item.timestamp > cutoff);
    
    if (beforeReq > this.requestHistory.length || beforeTok > this.tokenHistory.length) {
      console.log(`[ApiRateLimiter] 🧹 Cleaned up history: ${beforeReq - this.requestHistory.length} requests, ${beforeTok - this.tokenHistory.length} tokens`);
    }
  }

  /**
   * Get comprehensive rate limiter statistics
   */
  getStats() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = this.requestHistory.filter(item => item.timestamp > oneMinuteAgo);
    const recentTokens = this.tokenHistory
      .filter(item => item.timestamp > oneMinuteAgo)
      .reduce((sum, item) => sum + item.tokens, 0);
    
    return {
      // Queue status
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests,
      
      // Current capacity
      requestTokensAvailable: Math.floor(this.requestTokens),
      tokenTokensAvailable: Math.floor(this.tokenTokens),
      
      // Recent usage (last minute)
      requestsLastMinute: recentRequests.length,
      tokensLastMinute: recentTokens,
      
      // Utilization percentages
      requestUtilization: ((recentRequests.length / this.maxRequestsPerMinute) * 100).toFixed(1) + '%',
      tokenUtilization: ((recentTokens / this.maxTokensPerMinute) * 100).toFixed(1) + '%',
      
      // Overall statistics
      totalStats: { ...this.stats },
      
      // Rate limits
      limits: {
        requestsPerMinute: this.maxRequestsPerMinute,
        tokensPerMinute: this.maxTokensPerMinute,
        concurrent: this.maxConcurrentRequests
      },
      
      // Health indicators
      isHealthy: this.isHealthy(),
      lastRefill: new Date(this.lastRefill).toISOString()
    };
  }

  /**
   * Check if the rate limiter is operating healthily
   */
  isHealthy() {
    const stats = this.getStats();
    return (
      stats.queueLength < 100 && // Queue not too long
      parseFloat(stats.requestUtilization) < 95 && // Not near request limit
      parseFloat(stats.tokenUtilization) < 95 && // Not near token limit
      this.activeRequests < this.maxConcurrentRequests // Not at concurrent limit
    );
  }

  /**
   * Get a quick status summary for monitoring
   */
  getStatusSummary() {
    const stats = this.getStats();
    return `Queue: ${stats.queueLength}, Active: ${stats.activeRequests}, Req: ${stats.requestUtilization}, Tokens: ${stats.tokenUtilization}`;
  }

  /**
   * Force process the queue (useful for testing)
   */
  forceProcessQueue() {
    setImmediate(() => this.processQueue());
  }
}

export default new ApiRateLimiter();