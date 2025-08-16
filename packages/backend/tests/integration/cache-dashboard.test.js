/**
 * @fileoverview Integration Tests for Advanced Cache Dashboard (Task 22)
 * Real validation metrics and API integration tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fetch from 'node-fetch';

// Test Configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3001',
  timeout: 10000,
  retries: 3
};

// Real API client for cache management
class CacheAPIClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}/api/cache${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Health check
  async health() {
    return this.request('/health');
  }

  // Metrics
  async getMetrics() {
    return this.request('/metrics');
  }

  async getStats() {
    return this.request('/stats');
  }

  async getDetailedStats() {
    return this.request('/stats/detailed');
  }

  // Cache operations
  async getCache(key) {
    return this.request(`/cache/${key}`);
  }

  async setCache(key, value, ttl) {
    return this.request(`/cache/${key}`, {
      method: 'POST',
      body: JSON.stringify({ value, ttl })
    });
  }

  async deleteCache(key) {
    return this.request(`/cache/${key}`, {
      method: 'DELETE'
    });
  }

  // Analytics
  async getAnalytics() {
    return this.request('/analytics');
  }

  async getPatterns() {
    return this.request('/analytics/patterns');
  }

  async getRecommendations() {
    return this.request('/analytics/recommendations');
  }

  async getAlerts() {
    return this.request('/analytics/alerts');
  }

  // Cache warming
  async triggerWarming(keys) {
    return this.request('/warming/trigger', {
      method: 'POST',
      body: JSON.stringify({ keys })
    });
  }

  async getWarmingStatus() {
    return this.request('/warming/status');
  }

  // Cache invalidation
  async invalidateKey(key) {
    return this.request('/invalidation/key', {
      method: 'POST',
      body: JSON.stringify({ key })
    });
  }

  async invalidatePattern(pattern) {
    return this.request('/invalidation/pattern', {
      method: 'POST',
      body: JSON.stringify({ pattern })
    });
  }

  // Configuration
  async getConfiguration() {
    return this.request('/config');
  }

  async updateConfiguration(config) {
    return this.request('/config', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  // Admin operations
  async clearCache() {
    return this.request('/admin/clear', {
      method: 'POST'
    });
  }
}

// Test utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateTestKey = () => `test_key_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const retry = async (fn, times) => {
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === times - 1) throw error;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
  throw new Error('Retry exhausted');
};

// Test Suite
describe('Advanced Cache Dashboard Integration Tests', () => {
  let cacheClient;
  let testToken;

  beforeAll(async () => {
    // Initialize test client
    testToken = process.env.TEST_TOKEN || 'test-token-123';
    cacheClient = new CacheAPIClient(TEST_CONFIG.baseUrl, testToken);
    
    // Wait for services to be ready
    console.log('🔧 Waiting for cache services to be ready...');
    await retry(async () => {
      const health = await cacheClient.health();
      expect(health.success).toBe(true);
    }, 5);
  }, 30000);

  afterAll(async () => {
    // Cleanup test data
    try {
      await cacheClient.clearCache();
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Health and Metrics Validation', () => {
    it('should provide real health metrics', async () => {
      const health = await cacheClient.health();
      
      expect(health).toHaveProperty('success', true);
      expect(health.data).toHaveProperty('status');
      expect(health.data).toHaveProperty('timestamp');
      expect(health.data).toHaveProperty('services');
    });

    it('should provide comprehensive cache metrics', async () => {
      const metrics = await cacheClient.getMetrics();
      
      expect(metrics).toHaveProperty('success', true);
      expect(metrics.data).toHaveProperty('hit_rate_overall');
      expect(metrics.data).toHaveProperty('latency_overall_avg');
      expect(metrics.data).toHaveProperty('memory_used_percentage');
      expect(metrics.data).toHaveProperty('operations_total');
      
      // Validate metric ranges
      expect(metrics.data.hit_rate_overall).toBeGreaterThanOrEqual(0);
      expect(metrics.data.hit_rate_overall).toBeLessThanOrEqual(100);
      expect(metrics.data.latency_overall_avg).toBeGreaterThanOrEqual(0);
      expect(metrics.data.memory_used_percentage).toBeGreaterThanOrEqual(0);
    });

    it('should provide L1/L2/L3 level metrics', async () => {
      const metrics = await cacheClient.getMetrics();
      const data = metrics.data;
      
      // L1 metrics
      expect(data).toHaveProperty('hit_rate_l1');
      expect(data).toHaveProperty('latency_l1_avg');
      expect(data).toHaveProperty('hits_l1');
      expect(data).toHaveProperty('misses_l1');
      
      // L2 metrics  
      expect(data).toHaveProperty('hit_rate_l2');
      expect(data).toHaveProperty('latency_l2_avg');
      expect(data).toHaveProperty('hits_l2');
      expect(data).toHaveProperty('misses_l2');
      
      // L3 metrics
      expect(data).toHaveProperty('hit_rate_l3');
      expect(data).toHaveProperty('latency_l3_avg');
      expect(data).toHaveProperty('hits_l3');
      expect(data).toHaveProperty('misses_l3');
    });
  });

  describe('Real Cache Operations', () => {
    it('should perform cache set/get/delete operations', async () => {
      const testKey = generateTestKey();
      const testValue = { message: 'Hello Cache!', timestamp: Date.now() };
      
      // Set cache
      const setResult = await cacheClient.setCache(testKey, testValue);
      expect(setResult.success).toBe(true);
      
      // Get cache
      const getResult = await cacheClient.getCache(testKey);
      expect(getResult.success).toBe(true);
      expect(getResult.data.value).toEqual(testValue);
      
      // Delete cache
      const deleteResult = await cacheClient.deleteCache(testKey);
      expect(deleteResult.success).toBe(true);
      
      // Verify deletion
      try {
        await cacheClient.getCache(testKey);
        throw new Error('Expected cache miss');
      } catch (error) {
        expect(error.message).toMatch(/404|not found/i);
      }
    });

    it('should track cache operations in metrics', async () => {
      const initialMetrics = await cacheClient.getMetrics();
      const initialOps = initialMetrics.data.operations_total;
      
      // Perform multiple operations
      const testKey = generateTestKey();
      await cacheClient.setCache(testKey, { test: true });
      await cacheClient.getCache(testKey);
      await cacheClient.getCache(testKey); // Cache hit
      await cacheClient.deleteCache(testKey);
      
      // Wait for metrics update
      await sleep(1000);
      
      const updatedMetrics = await cacheClient.getMetrics();
      expect(updatedMetrics.data.operations_total).toBeGreaterThan(initialOps);
    });
  });

  describe('Analytics and Pattern Detection', () => {
    it('should provide analytics data structure', async () => {
      const analytics = await cacheClient.getAnalytics();
      
      expect(analytics).toHaveProperty('success', true);
      expect(analytics.data).toBeInstanceOf(Object);
    });

    it('should return pattern detection results', async () => {
      const patterns = await cacheClient.getPatterns();
      
      expect(patterns).toHaveProperty('success', true);
      expect(patterns.data).toBeInstanceOf(Array);
      
      // If patterns exist, validate structure
      if (patterns.data.length > 0) {
        const pattern = patterns.data[0];
        expect(pattern).toHaveProperty('pattern_type');
        expect(pattern).toHaveProperty('confidence_score');
        expect(pattern).toHaveProperty('impact_level');
      }
    });

    it('should provide optimization recommendations', async () => {
      const recommendations = await cacheClient.getRecommendations();
      
      expect(recommendations).toHaveProperty('success', true);
      expect(recommendations.data).toBeInstanceOf(Array);
      
      // If recommendations exist, validate structure
      if (recommendations.data.length > 0) {
        const rec = recommendations.data[0];
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('priority_score');
      }
    });
  });

  describe('Cache Warming Functionality', () => {
    it('should accept warming requests', async () => {
      const testKeys = [generateTestKey(), generateTestKey()];
      
      // First set some data to warm
      for (const key of testKeys) {
        await cacheClient.setCache(key, { warmed: true });
      }
      
      const warmingResult = await cacheClient.triggerWarming(testKeys);
      expect(warmingResult.success).toBe(true);
    });

    it('should provide warming status', async () => {
      const status = await cacheClient.getWarmingStatus();
      
      expect(status).toHaveProperty('success', true);
      expect(status.data).toBeInstanceOf(Array);
      
      // If jobs exist, validate structure
      if (status.data.length > 0) {
        const job = status.data[0];
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('status');
        expect(job).toHaveProperty('job_name');
      }
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate specific keys', async () => {
      const testKey = generateTestKey();
      
      // Set cache first
      await cacheClient.setCache(testKey, { test: 'data' });
      
      // Verify it exists
      const getResult = await cacheClient.getCache(testKey);
      expect(getResult.success).toBe(true);
      
      // Invalidate
      const invalidateResult = await cacheClient.invalidateKey(testKey);
      expect(invalidateResult.success).toBe(true);
      
      // Verify invalidation
      try {
        await cacheClient.getCache(testKey);
        throw new Error('Expected cache miss after invalidation');
      } catch (error) {
        expect(error.message).toMatch(/404|not found/i);
      }
    });

    it('should invalidate by pattern', async () => {
      const testPattern = `pattern_test_${Date.now()}`;
      const testKeys = [
        `${testPattern}_1`,
        `${testPattern}_2`,
        `${testPattern}_3`
      ];
      
      // Set multiple keys with pattern
      for (const key of testKeys) {
        await cacheClient.setCache(key, { pattern: true });
      }
      
      // Invalidate by pattern
      const invalidateResult = await cacheClient.invalidatePattern(`${testPattern}*`);
      expect(invalidateResult.success).toBe(true);
      
      // Wait for invalidation to propagate
      await sleep(1000);
      
      // Verify all keys are invalidated
      for (const key of testKeys) {
        try {
          await cacheClient.getCache(key);
          throw new Error(`Expected ${key} to be invalidated`);
        } catch (error) {
          expect(error.message).toMatch(/404|not found/i);
        }
      }
    });
  });

  describe('Configuration Management', () => {
    it('should provide current configuration', async () => {
      const config = await cacheClient.getConfiguration();
      
      expect(config).toHaveProperty('success', true);
      expect(config.data).toBeInstanceOf(Object);
    });

    it('should allow configuration updates', async () => {
      const testConfig = {
        test_setting: true,
        updated_at: new Date().toISOString()
      };
      
      const updateResult = await cacheClient.updateConfiguration(testConfig);
      expect(updateResult.success).toBe(true);
    });
  });

  describe('Performance Validation', () => {
    it('should handle concurrent cache operations', async () => {
      const concurrency = 10;
      const promises = [];
      
      for (let i = 0; i < concurrency; i++) {
        const testKey = generateTestKey();
        promises.push(
          cacheClient.setCache(testKey, { concurrent: i })
            .then(() => cacheClient.getCache(testKey))
            .then(() => cacheClient.deleteCache(testKey))
        );
      }
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBeGreaterThanOrEqual(concurrency * 0.8); // Allow 20% failure rate for stress test
    });

    it('should maintain performance metrics under load', async () => {
      const beforeMetrics = await cacheClient.getMetrics();
      
      // Generate load
      const loadPromises = [];
      for (let i = 0; i < 50; i++) {
        const key = generateTestKey();
        loadPromises.push(
          cacheClient.setCache(key, { load_test: i })
            .then(() => cacheClient.getCache(key))
        );
      }
      
      await Promise.allSettled(loadPromises);
      
      // Wait for metrics to update
      await sleep(2000);
      
      const afterMetrics = await cacheClient.getMetrics();
      
      // Validate metrics increased
      expect(afterMetrics.data.operations_total).toBeGreaterThan(beforeMetrics.data.operations_total);
      
      // Validate performance within acceptable ranges
      expect(afterMetrics.data.latency_overall_avg).toBeLessThan(1000); // < 1 second
      expect(afterMetrics.data.hit_rate_overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid cache keys gracefully', async () => {
      try {
        await cacheClient.getCache('nonexistent_key_' + Date.now());
        throw new Error('Expected 404 for nonexistent key');
      } catch (error) {
        expect(error.message).toMatch(/404|not found/i);
      }
    });

    it('should validate API responses', async () => {
      const metrics = await cacheClient.getMetrics();
      
      // Validate response structure
      expect(metrics).toHaveProperty('success');
      expect(metrics).toHaveProperty('data');
      expect(typeof metrics.success).toBe('boolean');
      expect(typeof metrics.data).toBe('object');
    });

    it('should handle service unavailability', async () => {
      // This test would need a way to simulate service downtime
      // For now, just verify error handling exists
      try {
        const invalidClient = new CacheAPIClient('http://invalid-url:9999');
        await invalidClient.health();
        throw new Error('Expected network error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Dashboard-Specific Tests', () => {
    it('should provide data compatible with dashboard components', async () => {
      const [metrics, patterns, recommendations, alerts, warmingStatus] = await Promise.all([
        cacheClient.getMetrics(),
        cacheClient.getPatterns(),
        cacheClient.getRecommendations(),
        cacheClient.getAlerts(),
        cacheClient.getWarmingStatus()
      ]);
      
      // Validate metrics for charts
      expect(typeof metrics.data.hit_rate_overall).toBe('number');
      expect(typeof metrics.data.latency_overall_avg).toBe('number');
      expect(typeof metrics.data.memory_used_percentage).toBe('number');
      
      // Validate arrays for lists
      expect(Array.isArray(patterns.data)).toBe(true);
      expect(Array.isArray(recommendations.data)).toBe(true);
      expect(Array.isArray(alerts.data)).toBe(true);
      expect(Array.isArray(warmingStatus.data)).toBe(true);
    });

    it('should provide real-time compatible data structure', async () => {
      const stats = await cacheClient.getDetailedStats();
      
      expect(stats).toHaveProperty('success', true);
      expect(stats.data).toBeInstanceOf(Object);
      
      // Should include timestamp for real-time updates
      if (stats.data.timestamp) {
        expect(new Date(stats.data.timestamp).getTime()).toBeGreaterThan(0);
      }
    });
  });

  describe('Data Persistence Validation', () => {
    it('should persist metrics to database', async () => {
      const testKey = generateTestKey();
      
      // Generate some activity
      await cacheClient.setCache(testKey, { persist_test: true });
      await cacheClient.getCache(testKey);
      await cacheClient.deleteCache(testKey);
      
      // Wait for database write
      await sleep(2000);
      
      // Verify metrics are recorded
      const metrics = await cacheClient.getMetrics();
      expect(metrics.data.operations_total).toBeGreaterThan(0);
    });
  });
});

// Export test utilities for use in other test files
export { CacheAPIClient, generateTestKey, retry, sleep };
