/* global console */
import RedisService from '../services/RedisService.js';

// Cache middleware for API responses
export function cacheResponse(ttlSeconds = 300) {
  return async (req, res, next) => {
    if (!RedisService.connected) {
      return next();
    }

    const cacheKey = `api:${req.method}:${req.originalUrl}:${JSON.stringify(
      req.query
    )}`;

    try {
      const cachedResponse = await RedisService.getCache(cacheKey);

      if (cachedResponse) {
        console.log(`[Cache] ✅ Cache hit for ${req.originalUrl}`);
        return res.json(cachedResponse);
      }

      // Store original res.json
      const originalJson = res.json;

      // Override res.json to cache the response
      res.json = function (data) {
        // Cache the response data
        RedisService.setCache(cacheKey, data, ttlSeconds).catch(err => {
          console.error('[Cache] Failed to cache response:', err);
        });

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('[Cache] Cache middleware error:', error);
      next();
    }
  };
}

// Rate limiting middleware using Redis
export function rateLimitMiddleware(limit = 100, windowSeconds = 900) {
  return async (req, res, next) => {
    if (!RedisService.connected) {
      return next();
    }

    const clientId = req.ip || 'unknown';
    const key = `rate_limit:${clientId}`;

    try {
      const { allowed, remaining } = await RedisService.checkRateLimit(
        key,
        limit,
        windowSeconds
      );

      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': new Date(
          Date.now() + windowSeconds * 1000
        ).toISOString(),
      });

      if (!allowed) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: windowSeconds,
        });
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Rate limit middleware error:', error);
      next();
    }
  };
}

// Session-based cache for user-specific data
export async function setCachedUserData(userId, key, data, ttlSeconds = 1800) {
  const cacheKey = `user:${userId}:${key}`;
  return await RedisService.setCache(cacheKey, data, ttlSeconds);
}

export async function getCachedUserData(userId, key) {
  const cacheKey = `user:${userId}:${key}`;
  return await RedisService.getCache(cacheKey);
}

export async function invalidateUserCache(userId, key = '*') {
  if (!RedisService.connected) return false;

  try {
    const pattern = `user:${userId}:${key}`;
    const keys = await RedisService.redisClient.keys(pattern);

    if (keys.length > 0) {
      await RedisService.redisClient.del(keys);
    }

    return true;
  } catch (error) {
    console.error('[Cache] Failed to invalidate user cache:', error);
    return false;
  }
}
