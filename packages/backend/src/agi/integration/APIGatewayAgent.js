// packages/backend/src/agi/integration/APIGatewayAgent.js

const BaseAgent = require('../../system/BaseAgent');
const MessageBus = require('../../system/EnhancedMessageBus');

class APIGatewayAgent extends BaseAgent {
  constructor() {
    super('APIGatewayAgent', 'main', [
      'api_integration',
      'request_routing',
      'authentication_management',
      'rate_limiting',
      'request_transformation',
      'response_caching'
    ]);

    this.setupMessageHandlers();
    this.initializeGatewayEngine();
    this.status = 'ready';
    console.log('[APIGatewayAgent.main] Agent initialized and ready');
  }

  setupMessageHandlers() {
    MessageBus.subscribe('api.request', this.handleAPIRequest.bind(this));
    MessageBus.subscribe('api.register', this.registerAPI.bind(this));
    MessageBus.subscribe('api.configure', this.configureAPI.bind(this));
    MessageBus.subscribe('webhook.handle', this.handleWebhook.bind(this));
    MessageBus.subscribe('auth.validate', this.validateAuthentication.bind(this));
    MessageBus.subscribe(`${this.agentId}.health`, this.healthCheck.bind(this));
  }

  initializeGatewayEngine() {
    // Registered APIs and their configurations
    this.registeredAPIs = new Map([
      ['openai', {
        baseUrl: 'https://api.openai.com/v1',
        authentication: { type: 'bearer', key: process.env.OPENAI_API_KEY },
        rateLimit: { requests: 60, window: 60000 }, // 60 requests per minute
        timeout: 30000,
        retries: 3,
        cache: { enabled: false, ttl: 0 },
        transformations: {
          request: null,
          response: null
        }
      }],
      ['deepgram', {
        baseUrl: 'https://api.deepgram.com/v1',
        authentication: { type: 'token', key: process.env.DEEPGRAM_API_KEY },
        rateLimit: { requests: 100, window: 60000 },
        timeout: 45000,
        retries: 2,
        cache: { enabled: false, ttl: 0 },
        transformations: {
          request: null,
          response: null
        }
      }],
      ['github', {
        baseUrl: 'https://api.github.com',
        authentication: { type: 'token', key: process.env.GITHUB_TOKEN },
        rateLimit: { requests: 5000, window: 3600000 }, // 5000 per hour
        timeout: 10000,
        retries: 3,
        cache: { enabled: true, ttl: 300000 }, // 5 minutes
        transformations: {
          request: null,
          response: null
        }
      }],
      ['google_cloud', {
        baseUrl: 'https://googleapis.com',
        authentication: { type: 'oauth', credentials: process.env.GOOGLE_CREDENTIALS },
        rateLimit: { requests: 1000, window: 60000 },
        timeout: 20000,
        retries: 2,
        cache: { enabled: true, ttl: 600000 }, // 10 minutes
        transformations: {
          request: null,
          response: null
        }
      }]
    ]);

    // Request routing rules
    this.routingRules = new Map([
      ['/chat/completions', { api: 'openai', path: '/chat/completions' }],
      ['/transcription', { api: 'deepgram', path: '/listen' }],
      ['/repos', { api: 'github', path: '/repos' }],
      ['/search/repositories', { api: 'github', path: '/search/repositories' }],
      ['/translate', { api: 'google_cloud', path: '/language/translate/v2' }]
    ]);

    // Rate limiting counters
    this.rateLimitCounters = new Map();
    
    // Response cache
    this.responseCache = new Map();
    
    // Webhook configurations
    this.webhookEndpoints = new Map();
    
    // Request/response transformers
    this.transformers = new Map();
    
    // Authentication validators
    this.authValidators = new Map();

    // Metrics
    this.gatewayMetrics = {
      requests_processed: 0,
      requests_successful: 0,
      requests_failed: 0,
      requests_cached: 0,
      rate_limited_requests: 0,
      authentication_failures: 0,
      average_response_time: 0,
      apis_registered: this.registeredAPIs.size
    };

    // Initialize built-in transformers and validators
    this.initializeTransformers();
    this.initializeAuthValidators();
    
    // Start background tasks
    this.startCacheCleanup();
    this.startRateLimitReset();
  }

  async handleAPIRequest(message) {
    try {
      const {
        endpoint,
        method = 'GET',
        headers = {},
        body = null,
        params = {},
        options = {}
      } = message.payload;

      const startTime = Date.now();
      
      const response = await this.processAPIRequest({
        endpoint,
        method,
        headers,
        body,
        params,
        options,
        requestId: message.id
      });

      const responseTime = Date.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
      this.gatewayMetrics.requests_processed++;
      this.gatewayMetrics.requests_successful++;

      MessageBus.publish(`api.response.${message.id}`, {
        status: 'completed',
        response,
        response_time: responseTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[APIGatewayAgent] Error processing API request:', error);
      this.gatewayMetrics.requests_processed++;
      this.gatewayMetrics.requests_failed++;
      
      MessageBus.publish(`api.error.${message.id}`, {
        status: 'error',
        error: error.message,
        error_code: error.code || 'UNKNOWN_ERROR'
      });
    }
  }

  async processAPIRequest(requestData) {
    const { endpoint, method, headers, body, params, options, requestId } = requestData;
    
    // Route the request
    const route = this.routeRequest(endpoint);
    if (!route) {
      throw new Error(`No route found for endpoint: ${endpoint}`);
    }

    const apiConfig = this.registeredAPIs.get(route.api);
    if (!apiConfig) {
      throw new Error(`API configuration not found: ${route.api}`);
    }

    // Check rate limits
    if (!this.checkRateLimit(route.api, requestId)) {
      this.gatewayMetrics.rate_limited_requests++;
      throw new Error(`Rate limit exceeded for API: ${route.api}`);
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(route, method, params, body);
    if (apiConfig.cache.enabled && method === 'GET') {
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        this.gatewayMetrics.requests_cached++;
        return {
          ...cachedResponse,
          cached: true,
          cache_timestamp: cachedResponse.timestamp
        };
      }
    }

    // Transform request if needed
    const transformedRequest = await this.transformRequest(route.api, {
      method,
      headers,
      body,
      params
    });

    // Build final request
    const finalRequest = this.buildFinalRequest(
      apiConfig,
      route.path,
      transformedRequest
    );

    // Execute request with retries
    const response = await this.executeRequest(apiConfig, finalRequest);

    // Transform response if needed
    const transformedResponse = await this.transformResponse(route.api, response);

    // Cache response if applicable
    if (apiConfig.cache.enabled && method === 'GET' && response.status === 200) {
      this.cacheResponse(cacheKey, transformedResponse, apiConfig.cache.ttl);
    }

    return transformedResponse;
  }

  routeRequest(endpoint) {
    // Find matching route
    for (const [pattern, route] of this.routingRules) {
      if (endpoint.startsWith(pattern) || this.matchRoute(pattern, endpoint)) {
        return route;
      }
    }
    return null;
  }

  matchRoute(pattern, endpoint) {
    // Simple pattern matching (could be enhanced with regex)
    const patternParts = pattern.split('/');
    const endpointParts = endpoint.split('/');
    
    if (patternParts.length !== endpointParts.length) {
      return false;
    }

    return patternParts.every((part, index) => {
      return part.startsWith(':') || part === endpointParts[index];
    });
  }

  checkRateLimit(apiName, requestId) {
    const apiConfig = this.registeredAPIs.get(apiName);
    if (!apiConfig.rateLimit) return true;

    const now = Date.now();
    const windowStart = now - apiConfig.rateLimit.window;
    
    if (!this.rateLimitCounters.has(apiName)) {
      this.rateLimitCounters.set(apiName, []);
    }

    const counter = this.rateLimitCounters.get(apiName);
    
    // Remove expired entries
    const validEntries = counter.filter(timestamp => timestamp > windowStart);
    this.rateLimitCounters.set(apiName, validEntries);

    // Check if under limit
    if (validEntries.length < apiConfig.rateLimit.requests) {
      validEntries.push(now);
      return true;
    }

    return false;
  }

  generateCacheKey(route, method, params, body) {
    const keyData = {
      api: route.api,
      path: route.path,
      method,
      params,
      body: method !== 'GET' ? body : null
    };
    
    return `cache_${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  getCachedResponse(cacheKey) {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;

    if (Date.now() > cached.expires) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  cacheResponse(cacheKey, response, ttl) {
    this.responseCache.set(cacheKey, {
      response,
      timestamp: new Date().toISOString(),
      expires: Date.now() + ttl
    });
  }

  async transformRequest(apiName, request) {
    const transformer = this.transformers.get(`${apiName}_request`);
    if (transformer) {
      return await transformer(request);
    }
    return request;
  }

  async transformResponse(apiName, response) {
    const transformer = this.transformers.get(`${apiName}_response`);
    if (transformer) {
      return await transformer(response);
    }
    return response;
  }

  buildFinalRequest(apiConfig, path, transformedRequest) {
    const { method, headers, body, params } = transformedRequest;
    
    // Build URL
    let url = `${apiConfig.baseUrl}${path}`;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    // Build headers
    const finalHeaders = { ...headers };
    
    // Add authentication
    if (apiConfig.authentication) {
      switch (apiConfig.authentication.type) {
        case 'bearer':
          finalHeaders['Authorization'] = `Bearer ${apiConfig.authentication.key}`;
          break;
        case 'token':
          finalHeaders['Authorization'] = `Token ${apiConfig.authentication.key}`;
          break;
        case 'api_key':
          finalHeaders['X-API-Key'] = apiConfig.authentication.key;
          break;
      }
    }

    // Set content type for POST/PUT requests
    if (body && !finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    return {
      url,
      method,
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : null,
      timeout: apiConfig.timeout
    };
  }

  async executeRequest(apiConfig, request) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= apiConfig.retries; attempt++) {
      try {
        const response = await this.makeHTTPRequest(request);
        return response;
      } catch (error) {
        lastError = error;
        
        if (attempt < apiConfig.retries) {
          const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }
    
    throw lastError;
  }

  async makeHTTPRequest(request) {
    // Simulate HTTP request (in production, would use fetch or axios)
    console.log(`[APIGatewayAgent] Making ${request.method} request to ${request.url}`);
    
    // Simulate response delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { 
        message: 'Simulated API response',
        request_url: request.url,
        request_method: request.method,
        timestamp: new Date().toISOString()
      }
    };
  }

  async registerAPI(message) {
    try {
      const { apiName, configuration } = message.payload;
      
      // Validate configuration
      this.validateAPIConfiguration(configuration);
      
      // Register the API
      this.registeredAPIs.set(apiName, {
        ...configuration,
        registered_at: new Date().toISOString()
      });

      this.gatewayMetrics.apis_registered = this.registeredAPIs.size;

      MessageBus.publish(`api.registered.${message.id}`, {
        status: 'completed',
        api_name: apiName,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[APIGatewayAgent] Error registering API:', error);
      MessageBus.publish(`api.registration.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  validateAPIConfiguration(config) {
    const required = ['baseUrl', 'authentication'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (config.authentication && !config.authentication.type) {
      throw new Error('Authentication type is required');
    }
  }

  async handleWebhook(message) {
    try {
      const { webhookId, payload, headers, source } = message.payload;
      
      const webhook = this.webhookEndpoints.get(webhookId);
      if (!webhook) {
        throw new Error(`Webhook not found: ${webhookId}`);
      }

      // Validate webhook if needed
      if (webhook.validation) {
        const isValid = await this.validateWebhook(webhook, payload, headers);
        if (!isValid) {
          throw new Error('Webhook validation failed');
        }
      }

      // Process webhook
      const result = await this.processWebhook(webhook, payload, headers, source);

      MessageBus.publish(`webhook.processed.${message.id}`, {
        status: 'completed',
        result,
        webhook_id: webhookId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[APIGatewayAgent] Error handling webhook:', error);
      MessageBus.publish(`webhook.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async processWebhook(webhook, payload, headers, source) {
    // Transform webhook payload if needed
    let processedPayload = payload;
    if (webhook.transformer) {
      processedPayload = await webhook.transformer(payload, headers);
    }

    // Route to appropriate handler
    if (webhook.handler) {
      return await webhook.handler(processedPayload, headers, source);
    }

    // Default processing - just forward to message bus
    MessageBus.publish(`webhook.${webhook.event_type}`, {
      payload: processedPayload,
      headers,
      source,
      timestamp: new Date().toISOString()
    });

    return { processed: true, event_type: webhook.event_type };
  }

  initializeTransformers() {
    // OpenAI request transformer
    this.transformers.set('openai_request', async (request) => {
      // Add default model if not specified
      if (request.body && !request.body.model) {
        request.body.model = 'gpt-4o';
      }
      return request;
    });

    // GitHub response transformer
    this.transformers.set('github_response', async (response) => {
      // Simplify GitHub API responses
      if (response.data && Array.isArray(response.data.items)) {
        response.data = response.data.items.map(item => ({
          name: item.name,
          full_name: item.full_name,
          description: item.description,
          stars: item.stargazers_count,
          language: item.language,
          url: item.html_url
        }));
      }
      return response;
    });
  }

  initializeAuthValidators() {
    // JWT validator
    this.authValidators.set('jwt', async (token, config) => {
      // Simplified JWT validation
      if (!token) return false;
      
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload.exp > Date.now() / 1000;
      } catch {
        return false;
      }
    });

    // API key validator
    this.authValidators.set('api_key', async (apiKey, config) => {
      return apiKey && apiKey === config.valid_key;
    });
  }

  updateResponseTimeMetrics(responseTime) {
    if (this.gatewayMetrics.average_response_time === 0) {
      this.gatewayMetrics.average_response_time = responseTime;
    } else {
      this.gatewayMetrics.average_response_time = 
        (this.gatewayMetrics.average_response_time + responseTime) / 2;
    }
  }

  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.responseCache) {
        if (now > cached.expires) {
          this.responseCache.delete(key);
        }
      }
    }, 300000); // Clean up every 5 minutes
  }

  startRateLimitReset() {
    setInterval(() => {
      // Clean old rate limit entries
      const now = Date.now();
      for (const [api, counter] of this.rateLimitCounters) {
        const apiConfig = this.registeredAPIs.get(api);
        if (apiConfig) {
          const windowStart = now - apiConfig.rateLimit.window;
          const validEntries = counter.filter(timestamp => timestamp > windowStart);
          this.rateLimitCounters.set(api, validEntries);
        }
      }
    }, 60000); // Clean up every minute
  }

  healthCheck() {
    return {
      status: this.status,
      agentId: this.agentId,
      capabilities: this.capabilities,
      metrics: {
        requests_processed: this.gatewayMetrics.requests_processed,
        requests_successful: this.gatewayMetrics.requests_successful,
        requests_failed: this.gatewayMetrics.requests_failed,
        success_rate: this.gatewayMetrics.requests_processed > 0 ? 
          (this.gatewayMetrics.requests_successful / this.gatewayMetrics.requests_processed * 100).toFixed(2) + '%' : '0%',
        requests_cached: this.gatewayMetrics.requests_cached,
        cache_hit_rate: this.gatewayMetrics.requests_processed > 0 ?
          (this.gatewayMetrics.requests_cached / this.gatewayMetrics.requests_processed * 100).toFixed(2) + '%' : '0%',
        rate_limited_requests: this.gatewayMetrics.rate_limited_requests,
        average_response_time: Math.round(this.gatewayMetrics.average_response_time),
        apis_registered: this.gatewayMetrics.apis_registered,
        cache_size: this.responseCache.size,
        webhook_endpoints: this.webhookEndpoints.size
      },
      registered_apis: Array.from(this.registeredAPIs.keys()),
      routing_rules: Array.from(this.routingRules.keys()),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new APIGatewayAgent();