// packages/backend/src/system/ApiRateLimiter.js

/**
 * API Rate Limiter to prevent OpenAI API overload errors (529)
 * Implements queue management, rate limiting, and retry logic
 */

class ApiRateLimiter {
  constructor() {
    // Rate limiting configuration
    this.maxRequestsPerMinute = parseInt(process.env.OPENAI_RPM_LIMIT) || 60;
    this.maxTokensPerMinute = parseInt(process.env.OPENAI_TPM_LIMIT) || 90000;
    this.maxConcurrentRequests =
      parseInt(process.env.OPENAI_CONCURRENT_LIMIT) || 10;

    // Tracking data
    this.requestQueue = [];
    this.activeRequests = 0;
    this.requestHistory = []; // Last minute of requests
    this.tokenHistory = []; // Last minute of token usage
    this.retryDelays = [1000, 2000, 4000, 8000]; // Exponential backoff

    // Cleanup old history every 10 seconds
    setInterval(() => this.cleanupHistory(), 10000);

    console.log('[ApiRateLimiter] Initialized with limits:', {
      requestsPerMinute: this.maxRequestsPerMinute,
      tokensPerMinute: this.maxTokensPerMinute,
      concurrent: this.maxConcurrentRequests,
    });
  }

  /**
   * Queue an API request with rate limiting
   * @param {Function} apiCall - Function that makes the API call
   * @param {number} estimatedTokens - Estimated tokens for this request
   * @returns {Promise} - Result of the API call
   */
  async queueRequest(apiCall, estimatedTokens = 1000) {
    return new Promise((resolve, reject) => {
      const request = {
        apiCall,
        estimatedTokens,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0,
      };

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  /**
   * Process the request queue based on rate limits
   */
  async processQueue() {
    // Don't process if we're at concurrent limit
    if (this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }

    // Don't process if no requests in queue
    if (this.requestQueue.length === 0) {
      return;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Check rate limits
    const recentRequests = this.requestHistory.filter(
      req => req.timestamp > oneMinuteAgo
    );
    const recentTokens = this.tokenHistory
      .filter(tok => tok.timestamp > oneMinuteAgo)
      .reduce((sum, tok) => sum + tok.tokens, 0);

    const nextRequest = this.requestQueue[0];

    // Check if we can make this request without exceeding limits
    if (recentRequests.length >= this.maxRequestsPerMinute) {
      console.log('[ApiRateLimiter] Request rate limit reached, delaying...');
      setTimeout(() => this.processQueue(), 5000);
      return;
    }

    if (recentTokens + nextRequest.estimatedTokens > this.maxTokensPerMinute) {
      console.log(
        '[ApiRateLimiter] Token rate limit would be exceeded, delaying...'
      );
      setTimeout(() => this.processQueue(), 5000);
      return;
    }

    // Remove request from queue and execute
    const request = this.requestQueue.shift();
    this.activeRequests++;

    try {
      const result = await this.executeWithRetry(request);
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      // Process next request
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Execute API call with retry logic for 529 errors
   */
  async executeWithRetry(request) {
    const { apiCall, estimatedTokens, retries } = request;

    try {
      // Record request attempt
      this.requestHistory.push({
        timestamp: Date.now(),
        estimatedTokens,
      });

      const result = await apiCall();

      // Record actual token usage if available
      if (result && result.usage && result.usage.total_tokens) {
        this.tokenHistory.push({
          timestamp: Date.now(),
          tokens: result.usage.total_tokens,
        });
      } else {
        // Use estimated tokens
        this.tokenHistory.push({
          timestamp: Date.now(),
          tokens: estimatedTokens,
        });
      }

      return result;
    } catch (error) {
      console.log('[ApiRateLimiter] API call failed:', error.message);

      // Check if it's a rate limit error (529 or rate limit related)
      const isRateLimitError =
        error.status === 529 ||
        error.code === 'rate_limit_exceeded' ||
        error.message?.toLowerCase().includes('overloaded') ||
        error.message?.toLowerCase().includes('rate limit');

      if (isRateLimitError && retries < this.retryDelays.length) {
        const delay = this.retryDelays[retries];
        console.log(
          `[ApiRateLimiter] Rate limit hit, retrying in ${delay}ms (attempt ${retries + 1})`
        );

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Update retry count and try again
        request.retries = retries + 1;
        return this.executeWithRetry(request);
      }

      // Re-throw error if not rate limit or max retries exceeded
      throw error;
    }
  }

  /**
   * Clean up old history entries (older than 1 minute)
   */
  cleanupHistory() {
    const oneMinuteAgo = Date.now() - 60000;

    this.requestHistory = this.requestHistory.filter(
      req => req.timestamp > oneMinuteAgo
    );
    this.tokenHistory = this.tokenHistory.filter(
      tok => tok.timestamp > oneMinuteAgo
    );
  }

  /**
   * Get current rate limiter statistics
   */
  getStats() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentRequests = this.requestHistory.filter(
      req => req.timestamp > oneMinuteAgo
    );
    const recentTokens = this.tokenHistory
      .filter(tok => tok.timestamp > oneMinuteAgo)
      .reduce((sum, tok) => sum + tok.tokens, 0);

    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests,
      requestsLastMinute: recentRequests.length,
      tokensLastMinute: recentTokens,
      requestLimitUtilization:
        ((recentRequests.length / this.maxRequestsPerMinute) * 100).toFixed(1) +
        '%',
      tokenLimitUtilization:
        ((recentTokens / this.maxTokensPerMinute) * 100).toFixed(1) + '%',
      limits: {
        requestsPerMinute: this.maxRequestsPerMinute,
        tokensPerMinute: this.maxTokensPerMinute,
        concurrent: this.maxConcurrentRequests,
      },
    };
  }

  /**
   * Check if the system is healthy and not overloaded
   */
  isHealthy() {
    const stats = this.getStats();
    return (
      stats.queueLength < 50 && // Queue not too long
      parseFloat(stats.requestLimitUtilization) < 90 && // Not near request limit
      parseFloat(stats.tokenLimitUtilization) < 90 // Not near token limit
    );
  }
}

module.exports = new ApiRateLimiter();
