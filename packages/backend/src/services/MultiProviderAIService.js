/**
 * Multi-Provider AI Inference Service
 * Implements the Hub Architecture Pattern from SPEC with layered services:
 * - Ingestion & Preprocessing Layer
 * - Task Router (Rule + ML hybrid)
 * - Model Adapters with Uniform Interface
 * - Orchestration & Composers
 * - Safety & Compliance Layer
 */

import crypto from 'crypto';

// Provider configurations with real API keys
const PROVIDERS = {
  novita: {
    name: 'Novita',
    apiKey: process.env.NOVITA_API_KEY,
    baseUrl: 'https://api.novita.ai/v3',
    models: ['llama-3.1-70b-instruct', 'flux-1-dev'],
    tasks: ['generation', 'image-generation']
  },
  cerebras: {
    name: 'Cerebras',
    apiKey: process.env.CEREBRAS_API_KEY,
    baseUrl: 'https://api.cerebras.ai/v1',
    models: ['llama-3.1-70b-instruct', 'mixtral-8x7b-instruct'],
    tasks: ['generation', 'reasoning']
  },
  fireworks: {
    name: 'Fireworks',
    apiKey: process.env.FIREWORKS_API_KEY,
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: ['qwen2.5-72b-instruct', 'llama-3.1-70b-instruct', 'flux-1-dev'],
    tasks: ['generation', 'coding', 'image-generation']
  },
  nebius: {
    name: 'Nebius AI',
    apiKey: process.env.NEBIUS_API_KEY,
    baseUrl: 'https://api.studio.nebius.ai/v1',
    models: ['llama-3.1-70b-instruct', 'mixtral-8x7b-instruct'],
    tasks: ['generation', 'reasoning']
  },
  groq: {
    name: 'Groq',
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['mixtral-8x7b-32768', 'llama-3.1-70b-versatile', 'whisper-large-v3'],
    tasks: ['generation', 'reasoning', 'asr']
  },
  together: {
    name: 'Together AI',
    apiKey: process.env.TOGETHER_API_KEY,
    baseUrl: 'https://api.together.xyz/v1',
    models: ['llama-3.1-70b-instruct', 'deepseek-r1-distill-qwen-32b', 'starcoder2-15b'],
    tasks: ['generation', 'reasoning', 'coding']
  },
  featherless: {
    name: 'Featherless AI',
    apiKey: process.env.FEATHERLESS_API_KEY,
    baseUrl: 'https://api.featherless.ai/v1',
    models: ['llama-3.1-70b-instruct', 'mixtral-8x7b-instruct'],
    tasks: ['generation', 'reasoning']
  },
  fal: {
    name: 'fal',
    apiKey: process.env.FAL_API_KEY,
    baseUrl: 'https://fal.run/fal-ai',
    models: ['flux-1-dev', 'stable-diffusion-xl-base'],
    tasks: ['image-generation']
  },
  hyperbolic: {
    name: 'Hyperbolic',
    apiKey: process.env.HYPERBOLIC_API_KEY,
    baseUrl: 'https://api.hyperbolic.xyz/v1',
    models: ['llama-3.1-70b-instruct', 'qwen2.5-72b-instruct'],
    tasks: ['generation', 'coding']
  },
  nscale: {
    name: 'Nscale',
    apiKey: process.env.NSCALE_API_KEY,
    baseUrl: 'https://api.nscale.com/v1',
    models: ['llama-3.1-70b-instruct', 'mixtral-8x7b-instruct'],
    tasks: ['generation', 'reasoning']
  },
  replicate: {
    name: 'Replicate',
    apiKey: process.env.REPLICATE_API_TOKEN,
    baseUrl: 'https://api.replicate.com/v1',
    models: ['llama-3.1-70b-instruct', 'qwen2.5-vl-72b-instruct', 'flux-1-dev', 'whisper-large-v3'],
    tasks: ['generation', 'multimodal', 'image-generation', 'asr']
  },
  sambanova: {
    name: 'SambaNova',
    apiKey: process.env.SAMBANOVA_API_KEY,
    baseUrl: 'https://api.sambanova.ai/v1',
    models: ['llama-3.1-70b-instruct', 'mixtral-8x7b-instruct'],
    tasks: ['generation', 'reasoning']
  },
  cohere: {
    name: 'Cohere',
    apiKey: process.env.COHERE_API_KEY,
    baseUrl: 'https://api.cohere.ai/v1',
    models: ['command-r-plus', 'command-r'],
    tasks: ['generation', 'classification']
  },
  huggingface: {
    name: 'Hugging Face',
    apiKey: process.env.HF_TOKEN,
    baseUrl: 'https://api-inference.huggingface.co',
    models: [
      'distilbert-base-uncased-finetuned-sst-2-english',
      'facebook/bart-large-mnli',
      'dslim/bert-base-NER',
      'deepset/roberta-base-squad2',
      'google/gemma-2-2b-it',
      'Qwen/Qwen2.5-VL-7B-Instruct',
      'openai/whisper-large-v3',
      'facebook/detr-resnet-50',
      'Falconsai/nsfw_image_detection'
    ],
    tasks: ['text-classification', 'zero-shot', 'ner', 'qa', 'generation', 'multimodal', 'asr', 'vision-detection', 'vision-nsfw']
  }
};

class MultiProviderAIService {
  constructor() {
    this.providers = PROVIDERS;
    this.requestCache = new Map();
    this.rateLimits = new Map();
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0,
      byProvider: new Map(),
      byTask: new Map()
    };
    
    console.log('[MultiProviderAI] 🤖 Multi-Provider AI Service initialized with 14 providers');
    this.validateApiKeys();
  }

  /**
   * Validate all API keys are present (SPEC: Security, Safety & Compliance)
   */
  validateApiKeys() {
    const missing = [];
    Object.entries(this.providers).forEach(([key, provider]) => {
      if (!provider.apiKey || provider.apiKey.trim() === '') {
        missing.push(`${provider.name} (${key.toUpperCase()}_API_KEY)`);
      }
    });
    
    if (missing.length > 0) {
      console.warn('[MultiProviderAI] ⚠️ Missing API keys:', missing.join(', '));
    } else {
      console.log('[MultiProviderAI] ✅ All 14 provider API keys validated');
    }
  }

  /**
   * Ingestion & Preprocessing Layer (SPEC: Section 0)
   * Detect modality and normalize input
   */
  preprocessInput(input) {
    const processed = {
      modality: 'text',
      normalized: input,
      metadata: {
        length: 0,
        language: 'en',
        contentType: 'text/plain'
      }
    };

    // Detect modality
    if (typeof input === 'string') {
      processed.modality = 'text';
      processed.metadata.length = input.length;
      processed.normalized = input.trim().replace(/\s+/g, ' '); // Normalize whitespace
    } else if (input.audio) {
      processed.modality = 'audio';
      processed.metadata.contentType = 'audio/wav';
    } else if (input.image) {
      processed.modality = 'image';
      processed.metadata.contentType = 'image/jpeg';
    } else if (input.image && input.textPrompt) {
      processed.modality = 'multimodal';
    }

    return processed;
  }

  /**
   * Task Router (SPEC: Rule + ML hybrid)
   * Route based on input patterns and task requirements
   */
  routeTask(input) {
    const processed = this.preprocessInput(input);
    
    // Rule-based routing from SPEC
    if (processed.modality === 'audio') return 'asr';
    if (processed.modality === 'image' && input.textPrompt) return 'vl-chat';
    if (processed.modality === 'image' && input.request === 'segment') return 'vision-segmentation';
    if (processed.modality === 'image' && input.request === 'detect') return 'vision-detection';
    if (input.candidate_labels) {
      return input.candidate_labels.length <= 10 ? 'zero-shot' : 'hier-zero-shot';
    }
    if (input.question && input.context) return 'qa';
    if (/translate\s/i.test(input.prompt) || input.forceTranslate) return 'translation';
    if (input.intent === 'finance_sentiment') return 'text-classification-finance';
    if (input.intent === 'ner') return 'ner';
    if (input.prompt || input.messages) return 'generation';
    
    return 'fallback';
  }

  /**
   * Select optimal provider for task (SPEC: Model Adapters)
   */
  selectProvider(task, preferredProviders = []) {
    // Check preferred providers first
    for (const providerKey of preferredProviders) {
      const provider = this.providers[providerKey];
      if (provider && provider.tasks.includes(task)) {
        return providerKey;
      }
    }

    // Task-specific provider selection based on SPEC recommendations
    const taskProviderMap = {
      'generation': ['groq', 'together', 'fireworks', 'cerebras', 'hyperbolic'],
      'reasoning': ['together', 'fireworks', 'cerebras', 'groq'],
      'coding': ['together', 'fireworks', 'hyperbolic', 'huggingface'],
      'multimodal': ['replicate', 'huggingface'],
      'asr': ['groq', 'replicate', 'huggingface'],
      'image-generation': ['fal', 'replicate', 'fireworks', 'novita'],
      'text-classification': ['huggingface'],
      'zero-shot': ['huggingface'],
      'ner': ['huggingface'],
      'qa': ['huggingface'],
      'vision-detection': ['huggingface'],
      'vision-nsfw': ['huggingface']
    };

    const candidates = taskProviderMap[task] || Object.keys(this.providers);
    
    // Select first available provider with valid API key
    for (const providerKey of candidates) {
      const provider = this.providers[providerKey];
      if (provider && provider.apiKey && provider.tasks.includes(task)) {
        return providerKey;
      }
    }

    return 'huggingface'; // Fallback to HuggingFace
  }

  /**
   * Generic fetch wrapper with error handling (SPEC: Section 2.2)
   */
  async hfJsonModel(model, payload) {
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HF Error ${res.status}: ${txt}`);
    }
    
    return res.json();
  }

  /**
   * Execute inference with fallback chain (SPEC: Section 2.4)
   */
  async runWithFallback(task, primary, backups, execFn) {
    const models = [primary, ...backups];
    
    for (const model of models) {
      try {
        const t0 = performance.now();
        const result = await execFn(model);
        const latencyMs = performance.now() - t0;
        
        this.updateMetrics(task, model, latencyMs, true);
        
        return {
          success: true,
          model,
          latencyMs,
          result
        };
      } catch (e) {
        console.warn(`[MultiProviderAI] Model ${model} failed:`, e.message);
        this.updateMetrics(task, model, 0, false);
      }
    }
    
    return { success: false, error: "All models failed" };
  }

  /**
   * Main inference interface (SPEC: InferenceRequest/InferenceResult)
   */
  async inference(request) {
    const startTime = performance.now();
    
    // Generate request ID and validate
    const requestId = crypto.randomUUID();
    if (!request.task || !request.input) {
      throw new Error('Invalid request: task and input are required');
    }

    // Auto-route if task not specified
    if (request.task === 'auto') {
      request.task = this.routeTask(request.input);
    }

    // Select provider
    const providerKey = this.selectProvider(
      request.task, 
      request.preferredModels || []
    );
    
    const provider = this.providers[providerKey];
    if (!provider) {
      throw new Error(`No provider available for task: ${request.task}`);
    }

    console.log(`[MultiProviderAI] 🎯 Routing ${request.task} to ${provider.name}`);

    try {
      let result;
      const latencyMs = performance.now() - startTime;

      // Task-specific execution logic
      switch (request.task) {
        case 'text-classification':
          result = await this.executeTextClassification(provider, request);
          break;
        case 'zero-shot':
          result = await this.executeZeroShot(provider, request);
          break;
        case 'ner':
          result = await this.executeNER(provider, request);
          break;
        case 'qa':
          result = await this.executeQA(provider, request);
          break;
        case 'generation':
          result = await this.executeGeneration(provider, request);
          break;
        case 'asr':
          result = await this.executeASR(provider, request);
          break;
        case 'vision-detection':
          result = await this.executeVisionDetection(provider, request);
          break;
        case 'vision-nsfw':
          result = await this.executeVisionNSFW(provider, request);
          break;
        default:
          throw new Error(`Unsupported task: ${request.task}`);
      }

      // Return standardized result
      return {
        id: requestId,
        task: request.task,
        model: result.model || 'unknown',
        latencyMs,
        payload: result,
        confidence: result.confidence || 0.8,
        warnings: result.warnings || []
      };

    } catch (error) {
      console.error(`[MultiProviderAI] ❌ Inference failed:`, error);
      
      // Return error result
      return {
        id: requestId,
        task: request.task,
        model: provider.name,
        latencyMs: performance.now() - startTime,
        payload: { error: error.message },
        confidence: 0,
        warnings: ['Inference failed']
      };
    }
  }

  /**
   * Execute text classification task
   */
  async executeTextClassification(provider, request) {
    if (provider.name === 'Hugging Face') {
      return await this.hfJsonModel(
        'distilbert/distilbert-base-uncased-finetuned-sst-2-english',
        { inputs: request.input }
      );
    }
    throw new Error(`Text classification not supported by ${provider.name}`);
  }

  /**
   * Execute zero-shot classification
   */
  async executeZeroShot(provider, request) {
    if (provider.name === 'Hugging Face') {
      return await this.hfJsonModel(
        'facebook/bart-large-mnli',
        {
          inputs: request.input,
          parameters: {
            candidate_labels: request.params?.candidate_labels || [],
            multi_label: request.params?.multi_label || false
          }
        }
      );
    }
    throw new Error(`Zero-shot classification not supported by ${provider.name}`);
  }

  /**
   * Execute Named Entity Recognition
   */
  async executeNER(provider, request) {
    if (provider.name === 'Hugging Face') {
      return await this.hfJsonModel(
        'dslim/bert-base-NER',
        {
          inputs: request.input,
          parameters: { aggregation_strategy: "simple" }
        }
      );
    }
    throw new Error(`NER not supported by ${provider.name}`);
  }

  /**
   * Execute Question Answering
   */
  async executeQA(provider, request) {
    if (provider.name === 'Hugging Face') {
      return await this.hfJsonModel(
        'deepset/roberta-base-squad2',
        {
          inputs: {
            question: request.input.question,
            context: request.input.context
          }
        }
      );
    }
    throw new Error(`QA not supported by ${provider.name}`);
  }

  /**
   * Execute text generation
   */
  async executeGeneration(provider, request) {
    // OpenAI-compatible providers
    if (['Groq', 'Together AI', 'Fireworks', 'Cerebras', 'Hyperbolic', 'Featherless AI', 'Nebius AI', 'Nscale', 'SambaNova'].includes(provider.name)) {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.params?.model || provider.models[0],
          messages: request.input.messages || [{ role: 'user', content: request.input }],
          max_tokens: request.params?.max_tokens || 256,
          temperature: request.params?.temperature || 0.4
        })
      });
      
      if (!response.ok) {
        throw new Error(`${provider.name} API error: ${response.status}`);
      }
      
      return await response.json();
    }

    if (provider.name === 'Hugging Face') {
      return await this.hfJsonModel(
        'google/gemma-2-2b-it',
        { 
          inputs: request.input.messages?.[0]?.content || request.input,
          parameters: request.params || {}
        }
      );
    }

    throw new Error(`Generation not supported by ${provider.name}`);
  }

  /**
   * Execute Automatic Speech Recognition
   */
  async executeASR(provider, request) {
    if (provider.name === 'Hugging Face') {
      return await this.hfJsonModel(
        'openai/whisper-large-v3',
        {
          inputs: request.input,
          parameters: { return_timestamps: true }
        }
      );
    }
    throw new Error(`ASR not supported by ${provider.name}`);
  }

  /**
   * Execute vision object detection
   */
  async executeVisionDetection(provider, request) {
    if (provider.name === 'Hugging Face') {
      return await this.hfJsonModel(
        'facebook/detr-resnet-50',
        { inputs: request.input }
      );
    }
    throw new Error(`Vision detection not supported by ${provider.name}`);
  }

  /**
   * Execute NSFW image classification
   */
  async executeVisionNSFW(provider, request) {
    if (provider.name === 'Hugging Face') {
      return await this.hfJsonModel(
        'Falconsai/nsfw_image_detection',
        { inputs: request.input }
      );
    }
    throw new Error(`NSFW detection not supported by ${provider.name}`);
  }

  /**
   * Update metrics (SPEC: Analytics & Evaluation)
   */
  updateMetrics(task, model, latencyMs, success) {
    this.metrics.requests++;
    if (success) {
      this.metrics.successes++;
      this.metrics.avgLatency = (this.metrics.avgLatency + latencyMs) / 2;
    } else {
      this.metrics.failures++;
    }

    // Track by task
    if (!this.metrics.byTask.has(task)) {
      this.metrics.byTask.set(task, { requests: 0, successes: 0, failures: 0, avgLatency: 0 });
    }
    const taskMetrics = this.metrics.byTask.get(task);
    taskMetrics.requests++;
    if (success) {
      taskMetrics.successes++;
      taskMetrics.avgLatency = (taskMetrics.avgLatency + latencyMs) / 2;
    } else {
      taskMetrics.failures++;
    }
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      service: 'MultiProviderAIService',
      version: '1.0.0',
      providers: Object.keys(this.providers).length,
      metrics: {
        ...this.metrics,
        byTask: Object.fromEntries(this.metrics.byTask),
        successRate: this.metrics.requests > 0 ? (this.metrics.successes / this.metrics.requests) : 0
      },
      availableProviders: Object.entries(this.providers).map(([key, provider]) => ({
        key,
        name: provider.name,
        hasApiKey: !!provider.apiKey,
        tasks: provider.tasks,
        models: provider.models.slice(0, 3) // Show first 3 models
      }))
    };
  }

  /**
   * Cache management with SHA256 hashing (SPEC: Section 3)
   */
  getCacheKey(model, params, content) {
    const normalized = {
      model,
      params: JSON.stringify(params || {}),
      content: content.toString().trim()
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Rate limiting check (SPEC: Section 5)
   */
  checkRateLimit(providerKey) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    
    if (!this.rateLimits.has(providerKey)) {
      this.rateLimits.set(providerKey, { requests: 0, resetTime: now + windowMs });
      return true;
    }
    
    const limit = this.rateLimits.get(providerKey);
    if (now > limit.resetTime) {
      limit.requests = 0;
      limit.resetTime = now + windowMs;
    }
    
    const maxRequests = 60; // 60 requests per minute default
    if (limit.requests >= maxRequests) {
      return false;
    }
    
    limit.requests++;
    return true;
  }
}

export default new MultiProviderAIService();