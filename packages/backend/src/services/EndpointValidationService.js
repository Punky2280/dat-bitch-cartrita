/**
 * Comprehensive Endpoint Validation Service
 * Provides automated validation and monitoring for all system endpoints
 */
import http from 'http';
import https from 'https';
import { URL } from 'url';

class EndpointValidationService {
  constructor() {
    this.endpoints = [];
    this.validationResults = new Map();
    this.lastValidation = null;
    this.validationInProgress = false;
  }

  // Initialize with all known endpoints
  initialize() {
    console.log('[EndpointValidation] 🔍 Initializing endpoint validation service...');
    
    // Public endpoints (no auth required)
    this.endpoints = [
      { path: '/health', method: 'GET', category: 'system', auth: false, expected: 200 },
      { path: '/api/system/health', method: 'GET', category: 'system', auth: false, expected: 200 },
      { path: '/api/system/metrics', method: 'GET', category: 'system', auth: false, expected: 200 },
      { path: '/api/huggingface/health', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/huggingface/test', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/huggingface/status', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/huggingface/models', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/huggingface/capabilities', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/ai-hub/health', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/ai-hub/status', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/ai-hub/models', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/ai-hub/test', method: 'GET', category: 'ai', auth: false, expected: 200 },
      { path: '/api/knowledge/health', method: 'GET', category: 'knowledge', auth: false, expected: 200 },
      { path: '/api/auth/verify', method: 'GET', category: 'auth', auth: false, expected: 401 }, // Expected 401 without token
      
      // Authenticated endpoints (require JWT)
      { path: '/api/chat/history', method: 'GET', category: 'chat', auth: true, expected: 200 },
      { path: '/api/workflows/templates', method: 'GET', category: 'workflows', auth: true, expected: 200 },
      { path: '/api/personal-life-os/profile', method: 'GET', category: 'life-os', auth: true, expected: 200 },
      { path: '/api/security/dashboard', method: 'GET', category: 'security', auth: true, expected: 200 },
      { path: '/api/ai-hub/analytics', method: 'GET', category: 'ai', auth: true, expected: 200 }
    ];
    
    console.log(`[EndpointValidation] ✅ Initialized with ${this.endpoints.length} endpoints`);
  }

  // Validate a single endpoint
  async validateEndpoint(endpoint, baseUrl = 'http://localhost:8001') {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const url = new URL(endpoint.path, baseUrl);
      const options = {
        method: endpoint.method,
        timeout: 5000,
        headers: {
          'User-Agent': 'Cartrita-Endpoint-Validator/1.0',
          'Accept': 'application/json'
        }
      };

      // Add authentication if required
      if (endpoint.auth && process.env.TEST_JWT_TOKEN) {
        options.headers.Authorization = `Bearer ${process.env.TEST_JWT_TOKEN}`;
      }

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          const result = {
            ...endpoint,
            status: res.statusCode === endpoint.expected ? 'pass' : 'fail',
            responseCode: res.statusCode,
            expectedCode: endpoint.expected,
            responseTime,
            contentType: res.headers['content-type'],
            contentLength: data.length,
            timestamp: new Date().toISOString(),
            error: null
          };

          // Try to parse JSON response
          try {
            if (res.headers['content-type']?.includes('application/json') && data) {
              result.jsonResponse = JSON.parse(data);
            }
          } catch (e) {
            // Non-JSON response is okay
          }

          resolve(result);
        });
      });

      req.on('error', (error) => {
        resolve({
          ...endpoint,
          status: 'error',
          responseCode: 0,
          expectedCode: endpoint.expected,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          ...endpoint,
          status: 'timeout',
          responseCode: 0,
          expectedCode: endpoint.expected,
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }

  // Validate all endpoints
  async validateAllEndpoints() {
    if (this.validationInProgress) {
      console.log('[EndpointValidation] ⏳ Validation already in progress');
      return this.getLastValidationResults();
    }

    this.validationInProgress = true;
    console.log(`[EndpointValidation] 🚀 Starting validation of ${this.endpoints.length} endpoints...`);
    
    const results = [];
    const startTime = Date.now();

    // Validate endpoints in parallel (but limit concurrency)
    const concurrencyLimit = 5;
    for (let i = 0; i < this.endpoints.length; i += concurrencyLimit) {
      const batch = this.endpoints.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(endpoint => this.validateEndpoint(endpoint))
      );
      results.push(...batchResults);
    }

    const totalTime = Date.now() - startTime;
    
    // Calculate health score
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const errors = results.filter(r => r.status === 'error').length;
    const timeouts = results.filter(r => r.status === 'timeout').length;
    const healthScore = Math.round((passed / results.length) * 100);

    const summary = {
      timestamp: new Date().toISOString(),
      totalEndpoints: results.length,
      passed,
      failed,
      errors,
      timeouts,
      healthScore,
      totalValidationTime: totalTime,
      averageResponseTime: Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)
    };

    this.validationResults.set(Date.now(), { summary, results });
    this.lastValidation = { summary, results };
    this.validationInProgress = false;

    console.log(`[EndpointValidation] ✅ Validation complete: ${passed}/${results.length} passed (${healthScore}% health score)`);
    return this.lastValidation;
  }

  // Get last validation results
  getLastValidationResults() {
    return this.lastValidation || { summary: null, results: [] };
  }

  // Get validation history
  getValidationHistory(limit = 10) {
    const entries = Array.from(this.validationResults.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, limit);
    return entries.map(([timestamp, data]) => ({ timestamp, ...data }));
  }
}

export default new EndpointValidationService();