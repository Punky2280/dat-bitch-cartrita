/* global console, process */
import { createClient } from 'redis';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000;
  }

  async initialize() {
    try {
      const redisUrl =
        process.env.REDIS_URL ||
        `redis://${process.env.REDIS_HOST || 'localhost'}:${
          process.env.REDIS_PORT || 6379
        }`;
      console.log(`[Redis] Attempting connection to: ${redisUrl}`);

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: retries => {
            if (retries > this.maxRetries) {
              console.error('[Redis] Max reconnection retries reached');
              return false;
            }
            return Math.min(retries * this.retryDelay, 5000);
          },
        },
      });

      this.client.on('error', err => {
        console.error('[Redis] Client error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[Redis] ✅ Connected to Redis server');
        this.isConnected = true;
        this.retryCount = 0;
      });

      this.client.on('disconnect', () => {
        console.warn('[Redis] ⚠️ Disconnected from Redis server');
        this.isConnected = false;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      console.error('[Redis] ❌ Failed to initialize:', error);
      this.isConnected = false;
      return false;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected || !this.client) {
        return { status: 'disconnected', healthy: false };
      }

      const result = await this.client.ping();
      return {
        status: 'connected',
        healthy: result === 'PONG',
        ping: result,
      };
    } catch (error) {
      return {
        status: 'error',
        healthy: false,
        error: error.message,
      };
    }
  }

  // Cache operations for frontend optimization
  async setCache(key, value, ttlSeconds = 3600) {
    try {
      if (!this.isConnected) return false;

      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serializedValue);
      return true;
    } catch (error) {
      console.error('[Redis] Set cache error:', error);
      return false;
    }
  }

  async getCache(key) {
    try {
      if (!this.isConnected) return null;

      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[Redis] Get cache error:', error);
      return null;
    }
  }

  async deleteCache(key) {
    try {
      if (!this.isConnected) return false;

      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('[Redis] Delete cache error:', error);
      return false;
    }
  }

  // Session management for frontend
  async setSession(sessionId, sessionData, ttlSeconds = 7200) {
    return await this.setCache(`session:${sessionId}`, sessionData, ttlSeconds);
  }

  async getSession(sessionId) {
    return await this.getCache(`session:${sessionId}`);
  }

  async deleteSession(sessionId) {
    return await this.deleteCache(`session:${sessionId}`);
  }

  // Real-time data caching for frontend
  async setChatHistory(userId, messages, ttlSeconds = 86400) {
    return await this.setCache(`chat:${userId}`, messages, ttlSeconds);
  }

  async getChatHistory(userId) {
    return await this.getCache(`chat:${userId}`);
  }

  // Agent state caching
  async setAgentState(agentId, state, ttlSeconds = 1800) {
    return await this.setCache(`agent:${agentId}`, state, ttlSeconds);
  }

  async getAgentState(agentId) {
    return await this.getCache(`agent:${agentId}`);
  }

  // Pub/Sub for real-time frontend updates
  async publish(channel, message) {
    try {
      if (!this.isConnected) return false;

      await this.client.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[Redis] Publish error:', error);
      return false;
    }
  }

  async subscribe(channel, callback) {
    try {
      if (!this.isConnected) return false;

      const subscriber = this.client.duplicate();
      await subscriber.connect();

      await subscriber.subscribe(channel, message => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          console.error('[Redis] Message parse error:', error);
          callback(message);
        }
      });

      return subscriber;
    } catch (error) {
      console.error('[Redis] Subscribe error:', error);
      return false;
    }
  }

  // Rate limiting for API endpoints
  async checkRateLimit(key, limit, windowSeconds) {
    try {
      if (!this.isConnected) return { allowed: true, remaining: limit };

      const current = await this.client.incr(key);

      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;

      return { allowed, remaining, current };
    } catch (error) {
      console.error('[Redis] Rate limit error:', error);
      return { allowed: true, remaining: limit };
    }
  }

  // Cleanup method
  async cleanup() {
    try {
      if (this.client) {
        await this.client.quit();
        console.log('[Redis] 🔌 Connection closed');
      }
    } catch (error) {
      console.error('[Redis] Cleanup error:', error);
    }
  }

  // Getters for external use
  get connected() {
    return this.isConnected;
  }

  get redisClient() {
    return this.client;
  }
}

export default new RedisService();
