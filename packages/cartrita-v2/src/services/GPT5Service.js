/**
 * GPT-5 Service for Cartrita V2
 * Implements advanced GPT-5 capabilities: Verbosity, Freeform Function Calling, 
 * Context-Free Grammar, Minimal Reasoning
 * Created: January 27, 2025
 */

import { ChatOpenAI } from '@langchain/openai';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

export default class GPT5Service {
  constructor() {
    this.initialized = false;
    this.models = new Map();
    this.featureSupport = new Map();
    this.requestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      featureUsage: {}
    };
  }

  /**
   * Initialize GPT-5 service with feature detection
   */
  async initialize() {
    try {
      console.log('[GPT5Service] 🚀 Initializing GPT-5 advanced capabilities...');
      
      // Initialize model instances
      this.models.set('gpt-5', new ChatOpenAI({
        model: 'gpt-5',
        apiKey: process.env.OPENAI_API_KEY,
      }));

      this.models.set('gpt-5-fast', new ChatOpenAI({
        model: 'gpt-5-fast',
        apiKey: process.env.OPENAI_API_KEY,
      }));

      this.models.set('gpt-5-mini', new ChatOpenAI({
        model: 'gpt-5-mini',
        apiKey: process.env.OPENAI_API_KEY,
      }));

      this.models.set('gpt-5-nano', new ChatOpenAI({
        model: 'gpt-5-nano',
        apiKey: process.env.OPENAI_API_KEY,
      }));

      // Set up feature support mappings
      this.setupFeatureSupport();
      
      this.initialized = true;
      console.log('[GPT5Service] ✅ GPT-5 service initialized with advanced features');
      
      return true;
    } catch (error) {
      console.error('[GPT5Service] ❌ Failed to initialize GPT-5 service:', error);
      return false;
    }
  }

  /**
   * Set up feature support mapping for each model
   */
  setupFeatureSupport() {
    this.featureSupport.set('gpt-5', [
      'verbosity_control',
      'freeform_function_calling',
      'context_free_grammar',
      'minimal_reasoning',
      'high_reasoning'
    ]);

    this.featureSupport.set('gpt-5-fast', [
      'verbosity_control',
      'minimal_reasoning',
      'speed_optimization'
    ]);

    this.featureSupport.set('gpt-5-mini', [
      'verbosity_control',
      'balanced_performance',
      'cost_effective'
    ]);

    this.featureSupport.set('gpt-5-nano', [
      'minimal_reasoning',
      'ultra_lightweight',
      'fast_response'
    ]);
  }

  /**
   * Generate response with GPT-5 advanced features
   * @param {string} prompt - The input prompt
   * @param {object} options - Configuration options
   * @returns {object} Enhanced response with GPT-5 features
   */
  async generateWithAdvancedFeatures(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('GPT5Service not initialized');
    }

    const startTime = Date.now();
    
    return await OpenTelemetryTracing.traceOperation('gpt5.generate', {
      'gpt5.model': options.model || 'gpt-5',
      'gpt5.verbosity': options.verbosity || 'medium',
      'gpt5.reasoning': options.reasoning || 'standard'
    }, async () => {
      try {
        const {
          model = 'gpt-5',
          verbosity = 'medium',
          reasoning = 'standard',
          enableFreeformCalling = false,
          cfgConstraints = null,
          temperature = 0.7,
          maxTokens = null,
          userId = null
        } = options;

        const modelInstance = this.models.get(model);
        if (!modelInstance) {
          throw new Error(`Unsupported model: ${model}`);
        }

        // Build enhanced prompt with GPT-5 features
        const enhancedPrompt = this.buildEnhancedPrompt(prompt, {
          verbosity,
          reasoning,
          cfgConstraints
        });

        // Prepare request options
        const requestOptions = {
          temperature,
          ...maxTokens && { max_tokens: maxTokens }
        };

        // Add GPT-5 specific parameters
        if (enableFreeformCalling) {
          requestOptions.function_calling = 'freeform';
        }

        if (cfgConstraints) {
          requestOptions.context_free_grammar = cfgConstraints;
        }

        if (reasoning === 'minimal') {
          requestOptions.reasoning_mode = 'minimal';
        }

        // Execute request
        const response = await modelInstance.invoke([{ role: 'user', content: enhancedPrompt }]);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Update metrics
        this.updateMetrics(model, responseTime, true);

        // Track feature usage
        await this.trackFeatureUsage(userId, {
          model,
          verbosity,
          reasoning,
          freeformCalling: enableFreeformCalling,
          cfgUsed: !!cfgConstraints,
          responseTime
        });

        return {
          content: response.content,
          model,
          features: {
            verbosity,
            reasoning,
            freeformCalling: enableFreeformCalling,
            cfgConstraints: !!cfgConstraints
          },
          performance: {
            responseTime,
            tokensUsed: response.usage?.total_tokens || 0
          },
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        this.updateMetrics(options.model || 'gpt-5', Date.now() - startTime, false);
        throw error;
      }
    });
  }

  /**
   * Build enhanced prompt with GPT-5 features
   * @param {string} originalPrompt - Original user prompt
   * @param {object} features - Feature configuration
   * @returns {string} Enhanced prompt
   */
  buildEnhancedPrompt(originalPrompt, features) {
    let enhancedPrompt = originalPrompt;

    // Add verbosity instructions
    if (features.verbosity === 'low') {
      enhancedPrompt = `Be concise and direct. ${enhancedPrompt}`;
    } else if (features.verbosity === 'high') {
      enhancedPrompt = `Provide detailed explanations and comprehensive coverage. ${enhancedPrompt}`;
    }

    // Add reasoning mode instructions
    if (features.reasoning === 'minimal') {
      enhancedPrompt = `Use minimal reasoning steps for efficiency. ${enhancedPrompt}`;
    } else if (features.reasoning === 'high') {
      enhancedPrompt = `Use comprehensive reasoning and analysis. ${enhancedPrompt}`;
    }

    // Add CFG constraints if specified
    if (features.cfgConstraints) {
      enhancedPrompt += `\n\nConstraints: ${features.cfgConstraints}`;
    }

    return enhancedPrompt;
  }

  /**
   * Update service metrics
   * @param {string} model - Model used
   * @param {number} responseTime - Response time in ms
   * @param {boolean} success - Whether request succeeded
   */
  updateMetrics(model, responseTime, success) {
    this.requestMetrics.totalRequests++;
    if (success) {
      this.requestMetrics.successfulRequests++;
    }

    // Update average response time
    const currentAvg = this.requestMetrics.averageResponseTime;
    const totalRequests = this.requestMetrics.totalRequests;
    this.requestMetrics.averageResponseTime = 
      ((currentAvg * (totalRequests - 1)) + responseTime) / totalRequests;
  }

  /**
   * Track feature usage for analytics
   * @param {number} userId - User ID
   * @param {object} usageData - Usage data
   */
  async trackFeatureUsage(userId, usageData) {
    if (!userId) return;

    try {
      // This would integrate with database to track usage
      // For now, we'll just log it
      console.log(`[GPT5Service] Feature usage tracked for user ${userId}:`, usageData);
      
      // Update feature usage metrics
      Object.keys(usageData).forEach(feature => {
        if (!this.requestMetrics.featureUsage[feature]) {
          this.requestMetrics.featureUsage[feature] = 0;
        }
        this.requestMetrics.featureUsage[feature]++;
      });
    } catch (error) {
      console.error('[GPT5Service] Failed to track feature usage:', error);
    }
  }

  /**
   * Get verbosity-adjusted response
   * @param {string} prompt - Input prompt
   * @param {string} verbosity - Verbosity level (low/medium/high)
   * @param {object} options - Additional options
   * @returns {object} Response adjusted for verbosity
   */
  async getVerbosityAdjustedResponse(prompt, verbosity = 'medium', options = {}) {
    return this.generateWithAdvancedFeatures(prompt, {
      ...options,
      verbosity
    });
  }

  /**
   * Execute freeform function calling
   * @param {string} prompt - Input prompt
   * @param {object} options - Options including tools
   * @returns {object} Response with function calling results
   */
  async executeFreeformFunctionCalling(prompt, options = {}) {
    return this.generateWithAdvancedFeatures(prompt, {
      ...options,
      enableFreeformCalling: true,
      reasoning: 'high' // Function calling benefits from high reasoning
    });
  }

  /**
   * Generate with Context-Free Grammar constraints
   * @param {string} prompt - Input prompt
   * @param {string} grammar - CFG constraints
   * @param {object} options - Additional options
   * @returns {object} Constrained response
   */
  async generateWithCFGConstraints(prompt, grammar, options = {}) {
    return this.generateWithAdvancedFeatures(prompt, {
      ...options,
      cfgConstraints: grammar
    });
  }

  /**
   * Get minimal reasoning response for speed
   * @param {string} prompt - Input prompt
   * @param {object} options - Additional options
   * @returns {object} Fast response with minimal reasoning
   */
  async getMinimalReasoningResponse(prompt, options = {}) {
    return this.generateWithAdvancedFeatures(prompt, {
      ...options,
      model: options.model || 'gpt-5-fast',
      reasoning: 'minimal',
      verbosity: 'low'
    });
  }

  /**
   * Get service metrics for monitoring
   * @returns {object} Current service metrics
   */
  getMetrics() {
    return {
      ...this.requestMetrics,
      initialized: this.initialized,
      supportedModels: Array.from(this.models.keys()),
      featureSupport: Object.fromEntries(this.featureSupport)
    };
  }

  /**
   * Get supported features for a model
   * @param {string} model - Model name
   * @returns {array} Array of supported features
   */
  getSupportedFeatures(model) {
    return this.featureSupport.get(model) || [];
  }

  /**
   * Check if a feature is supported by a model
   * @param {string} model - Model name
   * @param {string} feature - Feature name
   * @returns {boolean} Whether feature is supported
   */
  isFeatureSupported(model, feature) {
    const features = this.featureSupport.get(model) || [];
    return features.includes(feature);
  }
}