import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import db from '../db.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityEventDetector from '../security/SecurityEventDetector.js';

class EnhancedRateLimitService {
  constructor() {
    this.redis = null;
    this.useRedis = process.env.REDIS_URL ? true : false;
    this.rateLimitCounters = new Map(); // In-memory fallback
    this.cleanupInterval = null;
    
    this.initialize();
  }

  async initialize() {
    if (this.useRedis) {
      try {
        this.redis = new Redis(process.env.REDIS_URL);
        console.log('Enhanced Rate Limiting: Redis connected');
      } catch (error) {
        console.warn('Enhanced Rate Limiting: Redis connection failed, using in-memory storage');
        this.useRedis = false;
      }
    }

    // Start cleanup interval for in-memory storage
    if (!this.useRedis) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredCounters();
      }, 60000); // Cleanup every minute
    }
  }

  /**
   * Create rate limiter with enhanced features
   * @param {Object} options - Rate limit options
   * @returns {Function} Express middleware
   */
  createRateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // requests per window
      message = 'Too many requests from this IP',
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      keyGenerator = null,
      handler = null,
      onLimitReached = null,
      enableDynamicLimits = true,
      trustProxy = true,
      category = 'general'
    } = options;

    const limiterOptions = {
      windowMs,
      max,
      message: { success: false, error: message },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests,
      skipFailedRequests,
      keyGenerator: keyGenerator || this.createKeyGenerator(category),
      handler: handler || this.createHandler(category),
      skip: (req) => this.shouldSkipRateLimit(req),
      onLimitReached: (req, res, options) => {
        this.handleLimitReached(req, res, options, category, onLimitReached);
      }
    };

    // Use Redis store if available
    if (this.useRedis) {
      limiterOptions.store = new RedisStore({
        sendCommand: (...args) => this.redis.call(...args),
        prefix: `cartrita:ratelimit:${category}:`
      });
    }

    // Create dynamic rate limiter if enabled
    if (enableDynamicLimits) {
      return this.createDynamicRateLimit(limiterOptions, category);
    }

    return rateLimit(limiterOptions);
  }

  /**
   * Create dynamic rate limiter that adjusts limits based on user behavior
   */
  createDynamicRateLimit(baseOptions, category) {
    return async (req, res, next) => {
      const span = OpenTelemetryTracing.traceOperation(`rate_limit.${category}`);
      
      try {
        const ip = this.getClientIP(req);
        const userId = req.user?.id;
        
        // Get dynamic limits based on user/IP reputation
        const dynamicLimits = await this.getDynamicLimits(ip, userId, category);
        
        // Create rate limiter with dynamic options
        const dynamicOptions = {
          ...baseOptions,
          max: dynamicLimits.max,
          windowMs: dynamicLimits.windowMs
        };
        
        const limiter = rateLimit(dynamicOptions);
        
        span.setAttributes({
          'rate_limit.category': category,
          'rate_limit.ip': ip,
          'rate_limit.user_id': userId,
          'rate_limit.max': dynamicLimits.max,
          'rate_limit.window_ms': dynamicLimits.windowMs
        });
        
        return limiter(req, res, next);
        
      } catch (error) {
        span.recordException(error);
        // Fall back to base rate limiting if dynamic fails
        const limiter = rateLimit(baseOptions);
        return limiter(req, res, next);
      } finally {
        span.end();
      }
    };
  }

  /**
   * Get dynamic rate limits based on reputation and behavior
   */
  async getDynamicLimits(ip, userId, category) {
    try {
      // Base limits for category
      const baseLimits = this.getBaseLimits(category);
      
      // Check IP reputation
      const ipReputation = await this.getIPReputation(ip);
      
      // Check user reputation if authenticated
      let userReputation = { score: 0.5, multiplier: 1 };
      if (userId) {
        userReputation = await this.getUserReputation(userId);
      }
      
      // Calculate dynamic limits
      const reputationMultiplier = Math.min(ipReputation.multiplier, userReputation.multiplier);
      const dynamicMax = Math.floor(baseLimits.max * reputationMultiplier);
      
      // Adjust window based on reputation (lower reputation = shorter window)
      const windowMultiplier = reputationMultiplier < 0.5 ? 0.5 : 1;
      const dynamicWindow = Math.floor(baseLimits.windowMs * windowMultiplier);
      
      return {
        max: Math.max(dynamicMax, 1), // Minimum 1 request
        windowMs: Math.max(dynamicWindow, 60000), // Minimum 1 minute window
        multiplier: reputationMultiplier
      };
      
    } catch (error) {
      console.error('Dynamic limits calculation error:', error);
      return this.getBaseLimits(category);
    }
  }

  /**
   * Get IP reputation score and multiplier
   */
  async getIPReputation(ip) {
    try {
      // Check recent security events
      const recentEventsResult = await db.query(`
        SELECT COUNT(*) as event_count,
               COUNT(*) FILTER (WHERE severity IN ('high', 'critical')) as severe_events
        FROM security_events
        WHERE ip_address = $1 
          AND timestamp > NOW() - INTERVAL '24 hours'
      `, [ip]);
      
      const events = recentEventsResult.rows[0];
      const eventCount = parseInt(events.event_count);
      const severeEvents = parseInt(events.severe_events);
      
      // Check if IP is blacklisted
      const blacklistResult = await db.query(`
        SELECT reason FROM ip_blacklist
        WHERE ip_address = $1 AND is_active = true
      `, [ip]);
      
      if (blacklistResult.rows.length > 0) {
        return { score: 0, multiplier: 0.1 }; // Heavily restricted
      }
      
      // Calculate reputation score
      let score = 1.0;
      
      // Reduce score based on events
      if (eventCount > 0) {
        score -= Math.min(eventCount * 0.1, 0.8);
      }
      
      // Additional reduction for severe events
      if (severeEvents > 0) {
        score -= Math.min(severeEvents * 0.2, 0.5);
      }
      
      score = Math.max(score, 0);
      
      // Convert score to multiplier
      let multiplier = 1.0;
      if (score < 0.3) multiplier = 0.2; // Very bad reputation
      else if (score < 0.5) multiplier = 0.4; // Bad reputation
      else if (score < 0.7) multiplier = 0.7; // Poor reputation
      else if (score > 0.9) multiplier = 1.5; // Good reputation bonus
      
      return { score, multiplier };
      
    } catch (error) {
      console.error('IP reputation check error:', error);
      return { score: 0.5, multiplier: 1 }; // Neutral default
    }
  }

  /**
   * Get user reputation score and multiplier
   */
  async getUserReputation(userId) {
    try {
      // Check user's security events and behavior
      const userEventsResult = await db.query(`
        SELECT COUNT(*) as event_count,
               COUNT(*) FILTER (WHERE severity IN ('high', 'critical')) as severe_events
        FROM security_events
        WHERE user_id = $1 
          AND timestamp > NOW() - INTERVAL '7 days'
      `, [userId]);
      
      const events = userEventsResult.rows[0];
      const eventCount = parseInt(events.event_count);
      const severeEvents = parseInt(events.severe_events);
      
      // Check user role for bonus
      const userResult = await db.query(`
        SELECT role FROM users WHERE id = $1
      `, [userId]);
      
      const userRole = userResult.rows[0]?.role;
      
      // Calculate reputation score
      let score = 0.8; // Start higher for authenticated users
      
      // Reduce score based on events
      if (eventCount > 0) {
        score -= Math.min(eventCount * 0.05, 0.6);
      }
      
      if (severeEvents > 0) {
        score -= Math.min(severeEvents * 0.1, 0.4);
      }
      
      score = Math.max(score, 0);
      
      // Convert score to multiplier with role bonuses
      let multiplier = 1.0;
      if (score < 0.3) multiplier = 0.3;
      else if (score < 0.5) multiplier = 0.6;
      else if (score < 0.7) multiplier = 0.8;
      else multiplier = 1.2; // Authenticated user bonus
      
      // Role-based bonuses
      if (userRole === 'admin') multiplier *= 2;
      else if (userRole === 'moderator') multiplier *= 1.5;
      
      return { score, multiplier };
      
    } catch (error) {
      console.error('User reputation check error:', error);
      return { score: 0.5, multiplier: 1 };
    }
  }

  /**
   * Get base limits for category
   */
  getBaseLimits(category) {
    const limits = {
      auth: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 min
      api: { max: 100, windowMs: 15 * 60 * 1000 }, // 100 per 15 min
      upload: { max: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
      search: { max: 50, windowMs: 15 * 60 * 1000 }, // 50 per 15 min
      chat: { max: 200, windowMs: 15 * 60 * 1000 }, // 200 per 15 min
      workflow: { max: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 min
      general: { max: 100, windowMs: 15 * 60 * 1000 } // Default
    };
    
    return limits[category] || limits.general;
  }

  /**
   * Create key generator for rate limiting
   */
  createKeyGenerator(category) {
    return (req) => {
      const ip = this.getClientIP(req);
      const userId = req.user?.id;
      
      // Use user ID for authenticated requests, IP for anonymous
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;
      return `${category}:${identifier}`;
    };
  }

  /**
   * Create custom handler for rate limit exceeded
   */
  createHandler(category) {
    return (req, res) => {
      const span = OpenTelemetryTracing.traceOperation(`rate_limit.exceeded.${category}`);
      
      try {
        const ip = this.getClientIP(req);
        
        span.setAttributes({
          'rate_limit.category': category,
          'rate_limit.ip': ip,
          'rate_limit.exceeded': true
        });
        
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          category,
          retryAfter: Math.ceil(res.getHeader('Retry-After') || 60)
        });
        
      } catch (error) {
        span.recordException(error);
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded'
        });
      } finally {
        span.end();
      }
    };
  }

  /**
   * Handle when rate limit is reached
   */
  async handleLimitReached(req, res, options, category, customHandler) {
    const span = OpenTelemetryTracing.traceOperation(`rate_limit.limit_reached.${category}`);
    
    try {
      const ip = this.getClientIP(req);
      const userId = req.user?.id;
      
      // Log security event for frequent rate limiting
      await SecurityEventDetector.detectRateLimitExceeded(ip, userId, category, {
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method
      });
      
      span.setAttributes({
        'rate_limit.category': category,
        'rate_limit.ip': ip,
        'rate_limit.user_id': userId,
        'rate_limit.path': req.path
      });
      
      // Call custom handler if provided
      if (customHandler) {
        customHandler(req, res, options);
      }
      
    } catch (error) {
      span.recordException(error);
      console.error('Rate limit reached handler error:', error);
    } finally {
      span.end();
    }
  }

  /**
   * Check if request should skip rate limiting
   */
  shouldSkipRateLimit(req) {
    // Skip for health checks
    if (req.path === '/health' || req.path === '/api/health') {
      return true;
    }
    
    // Skip for admin users in development
    if (process.env.NODE_ENV === 'development' && req.user?.role === 'admin') {
      return true;
    }
    
    // Skip if IP is whitelisted
    const ip = this.getClientIP(req);
    if (this.isWhitelistedIP(ip)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if IP is whitelisted
   */
  isWhitelistedIP(ip) {
    const whitelistedIPs = (process.env.WHITELISTED_IPS || '').split(',').filter(Boolean);
    return whitelistedIPs.includes(ip);
  }

  /**
   * Get client IP address
   */
  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           'unknown';
  }

  /**
   * Cleanup expired counters (for in-memory storage)
   */
  cleanupExpiredCounters() {
    const now = Date.now();
    for (const [key, data] of this.rateLimitCounters.entries()) {
      if (data.resetTime <= now) {
        this.rateLimitCounters.delete(key);
      }
    }
  }

  /**
   * Pre-configured rate limiters for common use cases
   */
  getPreConfiguredLimiters() {
    return {
      // Authentication endpoints
      auth: this.createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per window
        message: 'Too many authentication attempts',
        category: 'auth',
        skipSuccessfulRequests: true
      }),

      // Password reset
      passwordReset: this.createRateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 reset attempts per hour
        message: 'Too many password reset attempts',
        category: 'password_reset'
      }),

      // API endpoints
      api: this.createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
        message: 'API rate limit exceeded',
        category: 'api'
      }),

      // File uploads
      upload: this.createRateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 uploads per hour
        message: 'Upload rate limit exceeded',
        category: 'upload'
      }),

      // Chat/messaging
      chat: this.createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // 200 messages per window
        message: 'Chat rate limit exceeded',
        category: 'chat'
      }),

      // Search endpoints
      search: this.createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // 50 searches per window
        message: 'Search rate limit exceeded',
        category: 'search'
      }),

      // Workflow execution
      workflow: this.createRateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20, // 20 workflow executions per window
        message: 'Workflow execution rate limit exceeded',
        category: 'workflow'
      }),

      // Strict rate limiting for suspicious activity
      strict: this.createRateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 requests per hour
        message: 'Account temporarily restricted due to suspicious activity',
        category: 'strict',
        enableDynamicLimits: false
      })
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.redis) {
      this.redis.disconnect();
    }
  }
}

export default new EnhancedRateLimitService();
