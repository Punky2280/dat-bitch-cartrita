/**
 * Unified Multi-Provider Inference Service
 * Normalizes all AI inference calls behind a single HuggingFace token
 */

import { HfInference } from '@huggingface/inference';
import {
  Registry,
  getTaskModels,
  getTaskConfig,
  normalizeTaskName,
  type ProviderModel,
} from '../config/models.js';

interface UnifiedInferenceRequest {
  task: string;
  inputs: any;
  options?: {
    model?: string;
    provider?: string;
    tier?: 'primary' | 'fallback' | 'lite' | 'experimental';
    timeout?: number;
    maxRetries?: number;
    useCache?: boolean;
  };
}

interface UnifiedInferenceResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    model_used: string;
    provider: string;
    latency_ms: number;
    request_id: string;
    cached: boolean;
    attempt_count: number;
  };
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

class UnifiedInferenceService {
  private hf: HfInference;
  private requestCache: Map<
    string,
    { data: any; timestamp: number; ttl: number }
  >;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cacheHits: number;
    averageLatency: number;
    latencyHistory: number[];
  };

  constructor(hfToken: string) {
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
      latencyHistory: [],
    };

    // Clean up cache and metrics periodically
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Main inference method with fallback and retry logic
   */
  async inference(
    request: UnifiedInferenceRequest
  ): Promise<UnifiedInferenceResponse> {
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
            attempt_count: 0,
          },
        };
      }

      // Get ordered fallback models
      const models = this.getModelsForTask(normalizedTask, request.options);
      if (models.length === 0) {
        throw new Error(`No models available for task: ${request.task}`);
      }

      // Execute with fallback chain
      return await this.executeWithFallback(
        request,
        models,
        requestId,
        startTime
      );
    } catch (error: any) {
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
          attempt_count: 0,
        },
      };
    }
  }

  /**
   * Execute inference with fallback chain
   */
  private async executeWithFallback(
    request: UnifiedInferenceRequest,
    models: ProviderModel[],
    requestId: string,
    startTime: number
  ): Promise<UnifiedInferenceResponse> {
    let lastError: any = null;
    const taskConfig = getTaskConfig(normalizeTaskName(request.task));
    const maxRetries = request.options?.maxRetries ?? taskConfig.maxRetries;

    for (
      let attempt = 0;
      attempt < models.length && attempt < maxRetries + 1;
      attempt++
    ) {
      const model = models[attempt];
      const modelKey = `${model.provider}:${model.model}`;

      // Check circuit breaker
      if (!this.isCircuitBreakerClosed(modelKey)) {
        console.log(`Circuit breaker open for ${modelKey}, skipping`);
        continue;
      }

      try {
        const result = await this.callHuggingFaceModel(
          request,
          model,
          taskConfig.defaultTimeout
        );

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
            attempt_count: attempt + 1,
          },
        };
      } catch (error: any) {
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
  private async callHuggingFaceModel(
    request: UnifiedInferenceRequest,
    model: ProviderModel,
    timeout: number
  ): Promise<any> {
    const normalizedTask = normalizeTaskName(request.task);

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Request timeout after ${timeout}ms`)),
        timeout
      );
    });

    // Create inference promise based on task type
    const inferencePromise = this.createInferencePromise(
      normalizedTask,
      model,
      request.inputs
    );

    return Promise.race([inferencePromise, timeoutPromise]);
  }

  /**
   * Create appropriate inference promise based on task type
   */
  private async createInferencePromise(
    task: string,
    model: ProviderModel,
    inputs: any
  ): Promise<any> {
    const modelId = model.model;

    switch (task) {
      case 'chat':
      case 'multimodal_chat':
        return this.hf.chatCompletion({
          model: modelId,
          messages: inputs.messages || [
            { role: 'user', content: inputs.text || inputs },
          ],
          max_tokens: inputs.max_tokens || 512,
          temperature: inputs.temperature || 0.7,
        });

      case 'asr':
        return this.hf.automaticSpeechRecognition({
          model: modelId,
          data: inputs.audio || inputs,
        });

      case 'embeddings':
        return this.hf.featureExtraction({
          model: modelId,
          inputs: inputs.text || inputs,
        });

      case 'nlp_classic':
        if (model.capabilities.includes('summarization')) {
          return this.hf.summarization({
            model: modelId,
            inputs: inputs.text || inputs,
          });
        } else if (model.capabilities.includes('zero-shot')) {
          return this.hf.zeroShotClassification({
            model: modelId,
            inputs: inputs.text || inputs,
            parameters: { candidate_labels: inputs.candidate_labels || [] },
          });
        } else if (model.capabilities.includes('ner')) {
          return this.hf.tokenClassification({
            model: modelId,
            inputs: inputs.text || inputs,
          });
        } else if (model.capabilities.includes('qa')) {
          return this.hf.questionAnswering({
            model: modelId,
            inputs: {
              question: inputs.question,
              context: inputs.context,
            },
          });
        } else {
          return this.hf.textClassification({
            model: modelId,
            inputs: inputs.text || inputs,
          });
        }

      case 'image_generation':
        return this.hf.textToImage({
          model: modelId,
          inputs: inputs.prompt || inputs,
        });

      case 'image_edit':
        return this.hf.imageToImage({
          model: modelId,
          inputs: {
            image: inputs.image,
            prompt: inputs.prompt,
          },
        });

      case 'video_generation':
        // Note: Video generation might require custom handling
        throw new Error('Video generation not yet supported via HF Inference');

      case 'vision_analysis':
        if (model.capabilities.includes('image-classification')) {
          return this.hf.imageClassification({
            model: modelId,
            data: inputs.image || inputs,
          });
        } else if (model.capabilities.includes('object-detection')) {
          return this.hf.objectDetection({
            model: modelId,
            data: inputs.image || inputs,
          });
        } else {
          return this.hf.imageToText({
            model: modelId,
            data: inputs.image || inputs,
          });
        }

      default:
        throw new Error(`Unsupported task type: ${task}`);
    }
  }

  /**
   * Get ordered models for task with filtering
   */
  private getModelsForTask(
    task: string,
    options?: UnifiedInferenceRequest['options']
  ): ProviderModel[] {
    let models = getTaskModels(task as keyof typeof Registry);

    // Filter by provider if specified
    if (options?.provider) {
      models = models.filter(m => m.provider === options.provider);
    }

    // Filter by tier if specified
    if (options?.tier) {
      models = models.filter(m => m.tier === options.tier);
    }

    // Filter by specific model if specified
    if (options?.model) {
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
  private isCircuitBreakerClosed(modelKey: string): boolean {
    const breaker = this.circuitBreakers.get(modelKey);
    if (!breaker) {
      return true;
    }

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

  private recordCircuitBreakerFailure(modelKey: string): void {
    const breaker = this.circuitBreakers.get(modelKey) || {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
    };

    breaker.failures++;
    breaker.lastFailureTime = Date.now();

    // Open circuit after 3 failures
    if (breaker.failures >= 3) {
      breaker.state = 'open';
    }

    this.circuitBreakers.set(modelKey, breaker);
  }

  private resetCircuitBreaker(modelKey: string): void {
    this.circuitBreakers.set(modelKey, {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
    });
  }

  /**
   * Caching logic
   */
  private getCachedResult(request: UnifiedInferenceRequest): any | null {
    if (!getTaskConfig(normalizeTaskName(request.task)).cacheable) {
      return null;
    }

    const cacheKey = this.generateCacheKey(request);
    const cached = this.requestCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl * 1000) {
      return cached.data;
    }

    return null;
  }

  private cacheResult(
    request: UnifiedInferenceRequest,
    result: any,
    ttl: number
  ): void {
    const cacheKey = this.generateCacheKey(request);
    this.requestCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl,
    });
  }

  private generateCacheKey(request: UnifiedInferenceRequest): string {
    return `${request.task}:${JSON.stringify(request.inputs)}:${request.options?.model || 'auto'}`;
  }

  /**
   * Metrics and utilities
   */
  private updateLatencyMetrics(latency: number): void {
    this.metrics.latencyHistory.push(latency);
    if (this.metrics.latencyHistory.length > 100) {
      this.metrics.latencyHistory = this.metrics.latencyHistory.slice(-100);
    }
    this.metrics.averageLatency =
      this.metrics.latencyHistory.reduce((a, b) => a + b, 0) /
      this.metrics.latencyHistory.length;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean expired cache entries
    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.requestCache.delete(key);
      }
    }

    // Reset old circuit breakers
    for (const [key, breaker] of this.circuitBreakers.entries()) {
      if (now - breaker.lastFailureTime > 300000) {
        // 5 minutes
        this.resetCircuitBreaker(key);
      }
    }
  }

  /**
   * Public API methods for common tasks
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: any
  ): Promise<UnifiedInferenceResponse> {
    return this.inference({
      task: 'chat',
      inputs: { messages },
      options,
    });
  }

  async speechToText(
    audioData: any,
    options?: any
  ): Promise<UnifiedInferenceResponse> {
    return this.inference({
      task: 'asr',
      inputs: { audio: audioData },
      options,
    });
  }

  async embed(text: string, options?: any): Promise<UnifiedInferenceResponse> {
    return this.inference({
      task: 'embeddings',
      inputs: { text },
      options,
    });
  }

  async generateImage(
    prompt: string,
    options?: any
  ): Promise<UnifiedInferenceResponse> {
    return this.inference({
      task: 'image_generation',
      inputs: { prompt },
      options,
    });
  }

  async classifyImage(
    imageData: any,
    options?: any
  ): Promise<UnifiedInferenceResponse> {
    return this.inference({
      task: 'vision_analysis',
      inputs: { image: imageData },
      options,
    });
  }

  async summarize(
    text: string,
    options?: any
  ): Promise<UnifiedInferenceResponse> {
    return this.inference({
      task: 'nlp_classic',
      inputs: { text },
      options: { ...options, model: 'facebook/bart-large-cnn' },
    });
  }

  async classify(
    text: string,
    candidateLabels: string[],
    options?: any
  ): Promise<UnifiedInferenceResponse> {
    return this.inference({
      task: 'nlp_classic',
      inputs: { text, candidate_labels: candidateLabels },
      options: { ...options, model: 'facebook/bart-large-mnli' },
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
      uptime: process.uptime(),
    };
  }

  getHealthStatus() {
    const successRate =
      this.metrics.totalRequests > 0
        ? this.metrics.successfulRequests / this.metrics.totalRequests
        : 1;

    return {
      status: successRate > 0.8 ? 'healthy' : 'degraded',
      metrics: this.getMetrics(),
      availableModels: Object.keys(Registry).length,
      lastActivity: new Date().toISOString(),
    };
  }
}

// Singleton instance
let unifiedInferenceInstance: UnifiedInferenceService | null = null;

export function createUnifiedInferenceService(
  hfToken?: string
): UnifiedInferenceService {
  const token = hfToken || process.env.HF_TOKEN;
  if (!token) {
    throw new Error(
      'HuggingFace token not provided. Set HF_TOKEN environment variable.'
    );
  }

  if (!unifiedInferenceInstance) {
    unifiedInferenceInstance = new UnifiedInferenceService(token);
  }

  return unifiedInferenceInstance;
}

export {
  UnifiedInferenceService,
  type UnifiedInferenceRequest,
  type UnifiedInferenceResponse,
};
