/**
 * Unified Multi-Provider Inference Service
 * Normalizes all AI inference calls behind a single HuggingFace token
 */

import { HfInference } from '@huggingface/inference';

// Import the models registry (will need to convert it to JS too)
const Registry = {
  // Text Chat (General Instruction)
  chat: [
    { 
      provider: "together", 
      model: "openai/gpt-oss-120b", 
      capabilities: ["chat", "reasoning"], 
      tier: "primary",
      maxInputTokens: 32768,
      costTier: "high"
    },
    { 
      provider: "cerebras", 
      model: "meta-llama/Llama-4-Scout-17B-16E-Instruct", 
      capabilities: ["chat", "reasoning"], 
      tier: "primary",
      maxInputTokens: 16384,
      costTier: "medium"
    },
    { 
      provider: "fireworks-ai", 
      model: "meta-llama/Llama-4-Scout-17B-16E-Instruct", 
      capabilities: ["chat"], 
      tier: "fallback",
      maxInputTokens: 16384,
      costTier: "medium"
    },
    { 
      provider: "sambanova", 
      model: "meta-llama/Llama-3.1-8B-Instruct", 
      capabilities: ["chat"], 
      tier: "lite",
      maxInputTokens: 8192,
      costTier: "low"
    },
    { 
      provider: "hf-inference", 
      model: "HuggingFaceTB/SmolLM3-3B", 
      capabilities: ["chat"], 
      tier: "lite",
      maxInputTokens: 4096,
      costTier: "low",
      notes: "Ultra-light fallback"
    }
  ],

  // Multimodal Chat (Vision+Text)
  multimodal_chat: [
    { 
      provider: "together", 
      model: "meta-llama/Llama-4-Scout-17B-16E-Instruct", 
      capabilities: ["chat", "vision"], 
      tier: "primary",
      maxInputTokens: 16384,
      costTier: "high"
    },
    { 
      provider: "sambanova", 
      model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct", 
      capabilities: ["chat", "vision"], 
      tier: "primary",
      maxInputTokens: 32768,
      costTier: "high"
    },
    { 
      provider: "cohere", 
      model: "CohereLabs/command-a-vision-07-2025", 
      capabilities: ["chat", "vision"], 
      tier: "fallback",
      costTier: "medium"
    },
    { 
      provider: "hyperbolic", 
      model: "Qwen/Qwen2.5-VL-7B-Instruct", 
      capabilities: ["chat", "vision"], 
      tier: "lite",
      maxInputTokens: 32768,
      costTier: "medium"
    },
    { 
      provider: "novita", 
      model: "zai-org/GLM-4.1V-9B-Thinking", 
      capabilities: ["chat", "vision", "reasoning"], 
      tier: "experimental",
      costTier: "medium",
      notes: "Reasoning+vision capability"
    }
  ],

  // ASR (Speech to Text)
  asr: [
    { 
      provider: "hf-inference", 
      model: "openai/whisper-large-v3", 
      capabilities: ["asr"], 
      tier: "primary",
      costTier: "medium"
    },
    { 
      provider: "fal-ai", 
      model: "openai/whisper-large-v3", 
      capabilities: ["asr"], 
      tier: "fallback",
      costTier: "medium"
    }
  ],

  // Embeddings / Feature Extraction
  embeddings: [
    { 
      provider: "hf-inference", 
      model: "intfloat/multilingual-e5-large", 
      capabilities: ["embedding"], 
      tier: "primary",
      costTier: "low",
      notes: "Multilingual support"
    },
    { 
      provider: "sambanova", 
      model: "intfloat/e5-mistral-7b-instruct", 
      capabilities: ["embedding"], 
      tier: "fallback",
      costTier: "medium"
    },
    { 
      provider: "nebius", 
      model: "Qwen/Qwen3-Embedding-8B", 
      capabilities: ["embedding"], 
      tier: "fallback",
      costTier: "medium"
    }
  ],

  // Classical & Specialized NLP
  nlp_classic: [
    // Summarization
    { 
      provider: "hf-inference", 
      model: "facebook/bart-large-cnn", 
      capabilities: ["summarization"], 
      tier: "primary",
      costTier: "medium"
    },
    // Zero-shot classification
    { 
      provider: "hf-inference", 
      model: "facebook/bart-large-mnli", 
      capabilities: ["zero-shot"], 
      tier: "primary",
      costTier: "medium"
    },
    // Sentiment analysis (finance)
    { 
      provider: "hf-inference", 
      model: "ProsusAI/finbert", 
      capabilities: ["sentiment"], 
      tier: "primary",
      costTier: "low"
    },
    // Named Entity Recognition
    { 
      provider: "hf-inference", 
      model: "dslim/bert-base-NER", 
      capabilities: ["ner"], 
      tier: "primary",
      costTier: "low"
    },
    // Fill mask
    { 
      provider: "hf-inference", 
      model: "google-bert/bert-base-uncased", 
      capabilities: ["fill-mask"], 
      tier: "primary",
      costTier: "low"
    },
    // Question answering
    { 
      provider: "hf-inference", 
      model: "deepset/roberta-base-squad2", 
      capabilities: ["qa"], 
      tier: "primary",
      costTier: "medium"
    },
    // Table QA
    { 
      provider: "hf-inference", 
      model: "google/tapas-base-finetuned-wtq", 
      capabilities: ["table-qa"], 
      tier: "primary",
      costTier: "medium"
    },
    // Sequence-to-sequence
    { 
      provider: "hf-inference", 
      model: "google-t5/t5-small", 
      capabilities: ["seq2seq"], 
      tier: "lite",
      costTier: "low"
    }
  ],

  // Image Generation (Text->Image)
  image_generation: [
    { 
      provider: "nebius", 
      model: "black-forest-labs/FLUX.1-dev", 
      capabilities: ["image"], 
      tier: "primary",
      costTier: "high",
      notes: "High quality generation"
    },
    { 
      provider: "fal-ai", 
      model: "Qwen/Qwen-Image", 
      capabilities: ["image"], 
      tier: "fallback",
      costTier: "medium"
    },
    { 
      provider: "replicate", 
      model: "Qwen/Qwen-Image", 
      capabilities: ["image"], 
      tier: "fallback",
      costTier: "medium"
    },
    { 
      provider: "hf-inference", 
      model: "stabilityai/stable-diffusion-xl-base-1.0", 
      capabilities: ["image"], 
      tier: "lite",
      costTier: "low"
    }
  ],

  // Image-to-Image / Image Editing
  image_edit: [
    { 
      provider: "replicate", 
      model: "black-forest-labs/FLUX.1-Kontext-dev", 
      capabilities: ["image", "edit"], 
      tier: "primary",
      costTier: "high"
    }
  ],

  // Video Generation (Text->Video)
  video_generation: [
    { 
      provider: "fal-ai", 
      model: "Wan-AI/Wan2.2-T2V-A14B", 
      capabilities: ["video"], 
      tier: "primary",
      costTier: "high",
      notes: "Highest quality"
    },
    { 
      provider: "novita", 
      model: "Wan-AI/Wan2.1-T2V-14B", 
      capabilities: ["video"], 
      tier: "fallback",
      costTier: "medium"
    },
    { 
      provider: "replicate", 
      model: "Wan-AI/Wan2.2-TI2V-5B", 
      capabilities: ["video"], 
      tier: "lite",
      costTier: "medium",
      notes: "Lighter weight"
    }
  ],

  // Image Classification / Vision Analytics
  vision_analysis: [
    { 
      provider: "hf-inference", 
      model: "Falconsai/nsfw_image_detection", 
      capabilities: ["image-classification"], 
      tier: "primary",
      costTier: "low"
    },
    { 
      provider: "hf-inference", 
      model: "facebook/detr-resnet-50", 
      capabilities: ["object-detection"], 
      tier: "primary",
      costTier: "medium"
    },
    { 
      provider: "hf-inference", 
      model: "jonathandinu/face-parsing", 
      capabilities: ["segmentation"], 
      tier: "primary",
      costTier: "medium"
    }
  ]
};

// Task configurations
const TaskConfigs = {
  chat: { defaultTimeout: 30000, maxRetries: 2, cacheable: false },
  multimodal_chat: { defaultTimeout: 45000, maxRetries: 2, cacheable: false },
  asr: { defaultTimeout: 30000, maxRetries: 2, cacheable: true, cacheTtl: 86400 },
  embeddings: { defaultTimeout: 20000, maxRetries: 3, cacheable: true, cacheTtl: 604800 },
  image_generation: { defaultTimeout: 60000, maxRetries: 1, cacheable: true, cacheTtl: 86400 },
  image_edit: { defaultTimeout: 60000, maxRetries: 1, cacheable: true, cacheTtl: 86400 },
  video_generation: { defaultTimeout: 120000, maxRetries: 1, cacheable: true, cacheTtl: 86400 },
  nlp_classic: { defaultTimeout: 20000, maxRetries: 2, cacheable: true, cacheTtl: 3600 },
  vision_analysis: { defaultTimeout: 30000, maxRetries: 2, cacheable: true, cacheTtl: 3600 }
};

// Task aliases for backward compatibility
const TaskAliases = {
  'text-classification': 'nlp_classic',
  'zero-shot': 'nlp_classic', 
  'ner': 'nlp_classic',
  'qa': 'nlp_classic',
  'generation': 'chat',
  'multimodal': 'multimodal_chat',
  'vision-detection': 'vision_analysis',
  'vision-nsfw': 'vision_analysis',
  'summarization': 'nlp_classic',
  'fill-mask': 'nlp_classic',
  'table-qa': 'nlp_classic'
};

// Helper functions
function getTaskModels(task) {
  return Registry[task] || [];
}

function getTaskConfig(task) {
  return TaskConfigs[task] || TaskConfigs.chat;
}

function normalizeTaskName(task) {
  return TaskAliases[task] || task;
}

class UnifiedInferenceService {
  constructor(hfToken) {
    if (!hfToken) {
      throw new Error('HuggingFace token is required for unified inference');
    }
    
    this.hf = new HfInference(hfToken);
    this.requestCache = new Map();
    this.circuitBreakers = new Map();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averageLatency: 0,
      latencyHistory: []
    };

    // Clean up cache and metrics periodically
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Main inference method with fallback and retry logic
   */
  async inference(request) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    const normalizedTask = normalizeTaskName(request.task);

    this.metrics.totalRequests++;

    try {
      // Check cache first
      const cachedResult = this.getCachedResult(request);
      if (cachedResult) {
        this.metrics.cacheHits++;
        return {
          success: true,
          data: cachedResult,
          metadata: {
            model_used: 'cached',
            provider: 'cache',
            latency_ms: Date.now() - startTime,
            request_id: requestId,
            cached: true,
            attempt_count: 0
          }
        };
      }

      // Get ordered fallback models
      const models = this.getModelsForTask(normalizedTask, request.options);
      if (models.length === 0) {
        throw new Error(`No models available for task: ${request.task}`);
      }

      // Execute with fallback chain
      return await this.executeWithFallback(request, models, requestId, startTime);

    } catch (error) {
      this.metrics.failedRequests++;
      return {
        success: false,
        error: error.message || 'Inference failed',
        metadata: {
          model_used: 'none',
          provider: 'none',
          latency_ms: Date.now() - startTime,
          request_id: requestId,
          cached: false,
          attempt_count: 0
        }
      };
    }
  }

  /**
   * Execute inference with fallback chain
   */
  async executeWithFallback(request, models, requestId, startTime) {
    let lastError = null;
    const taskConfig = getTaskConfig(normalizeTaskName(request.task));
    const maxRetries = request.options?.maxRetries ?? taskConfig.maxRetries;

    for (let attempt = 0; attempt < models.length && attempt < maxRetries + 1; attempt++) {
      const model = models[attempt];
      const modelKey = `${model.provider}:${model.model}`;

      // Check circuit breaker
      if (!this.isCircuitBreakerClosed(modelKey)) {
        console.log(`Circuit breaker open for ${modelKey}, skipping`);
        continue;
      }

      try {
        const result = await this.callHuggingFaceModel(request, model, taskConfig.defaultTimeout);
        
        // Success - reset circuit breaker and update metrics
        this.resetCircuitBreaker(modelKey);
        this.metrics.successfulRequests++;
        this.updateLatencyMetrics(Date.now() - startTime);

        // Cache result if cacheable
        if (taskConfig.cacheable && request.options?.useCache !== false) {
          this.cacheResult(request, result, taskConfig.cacheTtl || 3600);
        }

        return {
          success: true,
          data: result,
          metadata: {
            model_used: model.model,
            provider: model.provider,
            latency_ms: Date.now() - startTime,
            request_id: requestId,
            cached: false,
            attempt_count: attempt + 1
          }
        };

      } catch (error) {
        console.error(`Model ${modelKey} failed:`, error.message);
        this.recordCircuitBreakerFailure(modelKey);
        lastError = error;

        // Continue to next model in fallback chain
        continue;
      }
    }

    // All models failed
    this.metrics.failedRequests++;
    throw lastError || new Error('All fallback models failed');
  }

  /**
   * Call HuggingFace model with unified interface
   */
  async callHuggingFaceModel(request, model, timeout) {
    const normalizedTask = normalizeTaskName(request.task);

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout);
    });

    // Create inference promise based on task type
    const inferencePromise = this.createInferencePromise(normalizedTask, model, request.inputs);

    return Promise.race([inferencePromise, timeoutPromise]);
  }

  /**
   * Create appropriate inference promise based on task type
   */
  async createInferencePromise(task, model, inputs) {
    const modelId = model.model;

    try {
      switch (task) {
        case 'chat':
        case 'multimodal_chat':
          return await this.hf.chatCompletion({
            model: modelId,
            messages: inputs.messages || [{ role: 'user', content: inputs.text || inputs }],
            max_tokens: inputs.max_tokens || 512,
            temperature: inputs.temperature || 0.7
          });

        case 'asr':
          return await this.hf.automaticSpeechRecognition({
            model: modelId,
            data: inputs.audio || inputs
          });

        case 'embeddings':
          return await this.hf.featureExtraction({
            model: modelId,
            inputs: inputs.text || inputs
          });

        case 'nlp_classic':
          if (model.capabilities.includes('summarization')) {
            return await this.hf.summarization({
              model: modelId,
              inputs: inputs.text || inputs
            });
          } else if (model.capabilities.includes('zero-shot')) {
            return await this.hf.zeroShotClassification({
              model: modelId,
              inputs: inputs.text || inputs,
              parameters: { candidate_labels: inputs.candidate_labels || [] }
            });
          } else if (model.capabilities.includes('ner')) {
            return await this.hf.tokenClassification({
              model: modelId,
              inputs: inputs.text || inputs
            });
          } else if (model.capabilities.includes('qa')) {
            return await this.hf.questionAnswering({
              model: modelId,
              inputs: {
                question: inputs.question,
                context: inputs.context
              }
            });
          } else {
            return await this.hf.textClassification({
              model: modelId,
              inputs: inputs.text || inputs
            });
          }

        case 'image_generation':
          return await this.hf.textToImage({
            model: modelId,
            inputs: inputs.prompt || inputs
          });

        case 'image_edit':
          return await this.hf.imageToImage({
            model: modelId,
            inputs: {
              image: inputs.image,
              prompt: inputs.prompt
            }
          });

        case 'video_generation':
          // Note: Video generation might require custom handling
          throw new Error('Video generation not yet supported via HF Inference');

        case 'vision_analysis':
          if (model.capabilities.includes('image-classification')) {
            return await this.hf.imageClassification({
              model: modelId,
              data: inputs.image || inputs
            });
          } else if (model.capabilities.includes('object-detection')) {
            return await this.hf.objectDetection({
              model: modelId,
              data: inputs.image || inputs
            });
          } else {
            return await this.hf.imageToText({
              model: modelId,
              data: inputs.image || inputs
            });
          }

        default:
          throw new Error(`Unsupported task type: ${task}`);
      }
    } catch (error) {
      // Enhanced error handling with better context
      throw new Error(`HF API Error (${modelId}): ${error.message || error}`);
    }
  }

  /**
   * Get ordered models for task with filtering
   */
  getModelsForTask(task, options = {}) {
    let models = getTaskModels(task);

    // Filter by provider if specified
    if (options.provider) {
      models = models.filter(m => m.provider === options.provider);
    }

    // Filter by tier if specified
    if (options.tier) {
      models = models.filter(m => m.tier === options.tier);
    }

    // Filter by specific model if specified
    if (options.model) {
      models = models.filter(m => m.model === options.model);
    }

    // Sort by tier priority: primary > fallback > lite > experimental
    const tierOrder = { primary: 1, fallback: 2, lite: 3, experimental: 4 };
    models.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

    return models;
  }

  /**
   * Circuit breaker logic
   */
  isCircuitBreakerClosed(modelKey) {
    const breaker = this.circuitBreakers.get(modelKey);
    if (!breaker) return true;

    const now = Date.now();
    const timeSinceLastFailure = now - breaker.lastFailureTime;

    switch (breaker.state) {
      case 'closed':
        return true;
      case 'open':
        // Try to move to half-open after 60 seconds
        if (timeSinceLastFailure > 60000) {
          breaker.state = 'half-open';
          return true;
        }
        return false;
      case 'half-open':
        return true;
      default:
        return true;
    }
  }

  recordCircuitBreakerFailure(modelKey) {
    const breaker = this.circuitBreakers.get(modelKey) || {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed'
    };

    breaker.failures++;
    breaker.lastFailureTime = Date.now();

    // Open circuit after 3 failures
    if (breaker.failures >= 3) {
      breaker.state = 'open';
    }

    this.circuitBreakers.set(modelKey, breaker);
  }

  resetCircuitBreaker(modelKey) {
    this.circuitBreakers.set(modelKey, {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed'
    });
  }

  /**
   * Caching logic
   */
  getCachedResult(request) {
    if (!getTaskConfig(normalizeTaskName(request.task)).cacheable) return null;
    
    const cacheKey = this.generateCacheKey(request);
    const cached = this.requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl * 1000) {
      return cached.data;
    }
    
    return null;
  }

  cacheResult(request, result, ttl) {
    const cacheKey = this.generateCacheKey(request);
    this.requestCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl
    });
  }

  generateCacheKey(request) {
    return `${request.task}:${JSON.stringify(request.inputs)}:${request.options?.model || 'auto'}`;
  }

  /**
   * Metrics and utilities
   */
  updateLatencyMetrics(latency) {
    this.metrics.latencyHistory.push(latency);
    if (this.metrics.latencyHistory.length > 100) {
      this.metrics.latencyHistory = this.metrics.latencyHistory.slice(-100);
    }
    this.metrics.averageLatency = 
      this.metrics.latencyHistory.reduce((a, b) => a + b, 0) / this.metrics.latencyHistory.length;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  cleanup() {
    const now = Date.now();
    
    // Clean expired cache entries
    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.requestCache.delete(key);
      }
    }

    // Reset old circuit breakers
    for (const [key, breaker] of this.circuitBreakers.entries()) {
      if (now - breaker.lastFailureTime > 300000) { // 5 minutes
        this.resetCircuitBreaker(key);
      }
    }
  }

  /**
   * Public API methods for common tasks
   */
  async chat(messages, options = {}) {
    return this.inference({
      task: 'chat',
      inputs: { messages },
      options
    });
  }

  async speechToText(audioData, options = {}) {
    return this.inference({
      task: 'asr',
      inputs: { audio: audioData },
      options
    });
  }

  async embed(text, options = {}) {
    return this.inference({
      task: 'embeddings',
      inputs: { text },
      options
    });
  }

  async generateImage(prompt, options = {}) {
    return this.inference({
      task: 'image_generation',
      inputs: { prompt },
      options
    });
  }

  async classifyImage(imageData, options = {}) {
    return this.inference({
      task: 'vision_analysis',
      inputs: { image: imageData },
      options
    });
  }

  async summarize(text, options = {}) {
    return this.inference({
      task: 'nlp_classic',
      inputs: { text },
      options: { ...options, model: 'facebook/bart-large-cnn' }
    });
  }

  async classify(text, candidateLabels, options = {}) {
    return this.inference({
      task: 'nlp_classic',
      inputs: { text, candidate_labels: candidateLabels },
      options: { ...options, model: 'facebook/bart-large-mnli' }
    });
  }

  /**
   * Service health and metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.requestCache.size,
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      uptime: process.uptime()
    };
  }

  getHealthStatus() {
    const successRate = this.metrics.totalRequests > 0 
      ? this.metrics.successfulRequests / this.metrics.totalRequests 
      : 1;

    return {
      status: successRate > 0.8 ? 'healthy' : 'degraded',
      metrics: this.getMetrics(),
      availableModels: Object.keys(Registry).length,
      lastActivity: new Date().toISOString()
    };
  }
}

// Singleton instance
let unifiedInferenceInstance = null;

export function createUnifiedInferenceService(hfToken) {
  const token = hfToken || process.env.HF_TOKEN;
  if (!token) {
    throw new Error('HuggingFace token not provided. Set HF_TOKEN environment variable.');
  }

  if (!unifiedInferenceInstance) {
    unifiedInferenceInstance = new UnifiedInferenceService(token);
  }
  
  return unifiedInferenceInstance;
}

export { UnifiedInferenceService };