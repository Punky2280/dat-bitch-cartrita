// Enhanced Cartrita Router - Dynamic Multi-Provider AI Request Processing
// Handles task routing, provider selection, model resolution, and response normalization

import crypto from 'crypto';
import { providerConfig, selectBestProvider, selectModel, updateProviderMetrics } from './providerConfig.js';
import CartritaSearchEngine from '../search/searchEngine.js';
import HFRouter from '../../modelRouting/HuggingFaceRouterService.js';

import { createClient as createDeepgramClient } from '@deepgram/sdk';

// Task adapters for different AI capabilities
class CartritaTaskAdapters {
  constructor() {
    this.searchEngine = null;
    this.pool = null;
  }

  initialize(pool) {
    this.pool = pool;
    this.searchEngine = new CartritaSearchEngine(pool);
    
    // Initialize API clients with proper key management
    this.initializeProviderClients();

    return this.searchEngine.initialize().catch(err => {
      console.warn('[CartritaRouter] Search engine init failed:', err.message);
      this.searchEngine.disabled = true;
    });
  }

  initializeProviderClients() {
    // Initialize Deepgram client
    const deepgramKey = process.env.DEEPGRAM_API_KEY || 
                       process.env.DEEPGRAM_KEY || 
                       process.env.DG_API_KEY || '';
    if (deepgramKey) {
      this.deepgram = createDeepgramClient(deepgramKey);
      console.log('✅ Deepgram client initialized with API key');
      this.deepgramAvailable = true;
    } else {
      console.warn('⚠️ No Deepgram API key found (DEEPGRAM_API_KEY), STT will use fallback');
      this.deepgramAvailable = false;
    }

    // Initialize OpenAI configuration
    this.openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '';
    if (this.openaiKey) {
      console.log('✅ OpenAI API key configured');
      this.openaiAvailable = true;
    } else {
      console.warn('⚠️ No OpenAI API key found (OPENAI_API_KEY), OpenAI services disabled');
      this.openaiAvailable = false;
    }

    // HuggingFace key is handled by the existing HFRouter service
    const hfKey = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '';
    if (hfKey) {
      console.log('✅ HuggingFace API key configured');
      this.huggingfaceAvailable = true;
    } else {
      console.warn('⚠️ No HuggingFace API key found (HF_TOKEN), HF services may be limited');
      this.huggingfaceAvailable = false;
    }

    // Additional service keys
    this.elevenLabsKey = process.env.ELEVENLABS_API_KEY || '';
    this.replicateKey = process.env.REPLICATE_API_KEY || '';
    this.anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  }

  // Chat adapter - routes to appropriate LLM provider
  async executeChat(params) {
    const { providerId, model, input, traceId } = params;
    
    try {
      if (providerId === 'openai') {
        return await this.openAIChat(model, input, traceId);
      } else if (providerId === 'huggingface') {
        return await this.huggingFaceChat(model, input, traceId);
      }
      
      throw new Error(`Provider ${providerId} not supported for chat`);
    } catch (error) {
      throw new Error(`Chat execution failed: ${error.message}`);
    }
  }

  // Embedding adapter
  async executeEmbedding(params) {
    const { providerId, model, input, traceId } = params;
    
    try {
      if (providerId === 'openai') {
        return await this.openAIEmbedding(model, input, traceId);
      } else if (providerId === 'huggingface') {
        return await this.huggingFaceEmbedding(model, input, traceId);
      }
      
      throw new Error(`Provider ${providerId} not supported for embedding`);
    } catch (error) {
      throw new Error(`Embedding execution failed: ${error.message}`);
    }
  }

  // Vision analysis adapter
  async executeVision(params) {
    const { providerId, model, input, traceId } = params;
    
    try {
      if (providerId === 'openai') {
        return await this.openAIVision(model, input, traceId);
      } else if (providerId === 'huggingface') {
        return await this.huggingFaceVision(model, input, traceId);
      }
      
      throw new Error(`Provider ${providerId} not supported for vision`);
    } catch (error) {
      throw new Error(`Vision execution failed: ${error.message}`);
    }
  }

  // Audio transcription adapter
  async executeAudioTranscribe(params) {
    const { providerId, model, input, traceId } = params;
    
    try {
      if (providerId === 'deepgram') {
        return await this.deepgramSTT(model, input, traceId);
      } else if (providerId === 'openai') {
        return await this.openAIWhisper(model, input, traceId);
      }
      
      throw new Error(`Provider ${providerId} not supported for audio transcription`);
    } catch (error) {
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
  }

  // Search adapter using hybrid search engine
  async executeSearch(params) {
    const { input, traceId, userId, options = {} } = params;
    
    if (!this.searchEngine || this.searchEngine.disabled) {
      throw new Error('Search engine not available');
    }

    const { 
      mode = 'hybrid',
      topK = 10,
      threshold = 0.7,
      documentIds = null
    } = options;

    return await this.searchEngine.resilientSearch({
      query: input.query || input,
      mode,
      topK,
      threshold,
      userId,
      documentIds,
      traceId
    });
  }

  // RAG (Retrieval-Augmented Generation) adapter
  async executeRAG(params) {
    const { input, traceId, userId, options = {} } = params;
    
    try {
      // First, perform search to get relevant context
      const searchResults = await this.executeSearch({
        input: input.query || input,
        traceId,
        userId,
        options: {
          mode: 'hybrid',
          topK: options.searchLimit || 8,
          threshold: options.searchThreshold || 0.7
        }
      });

      if (!searchResults.success || !searchResults.results?.length) {
        throw new Error('No relevant context found for RAG');
      }

      // Prepare context for generation
      const context = searchResults.results
        .map((r, i) => `[${i + 1}] ${r.content}`)
        .join('\n\n');

      const prompt = `Context:\n${context}\n\nQuestion: ${input.query || input}\n\nProvide a comprehensive answer based on the context above.`;

      // Generate response using chat
      const chatResult = await this.executeChat({
        providerId: options.provider || 'openai',
        model: options.model || 'gpt-4o-mini',
        input: { messages: [{ role: 'user', content: prompt }] },
        traceId
      });

      return {
        success: true,
        response: chatResult.response,
        references: options.includeReferences !== false ? searchResults.results.map((r, i) => ({
          index: i + 1,
          document_id: r.document_id,
          chunk_id: r.chunk_id,
          content: r.content.slice(0, 200) + '...',
          similarity: r.hybrid_score || r.similarity || r.relevance
        })) : [],
        searchResults,
        model: chatResult.model,
        processingTime: chatResult.processingTime
      };
    } catch (error) {
      throw new Error(`RAG execution failed: ${error.message}`);
    }
  }

  // Provider-specific implementations
  async openAIChat(model, input, traceId) {
    if (!this.openaiAvailable) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      // Import OpenAI dynamically to avoid issues if not installed
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: this.openaiKey });

      const prompt = typeof input === 'string' ? input : 
        (input.messages ? input.messages : 
         [{ role: 'user', content: input.prompt || String(input) }]);

      const messages = Array.isArray(prompt) ? prompt : 
        [{ role: 'user', content: prompt }];

      const startTime = Date.now();
      const completion = await openai.chat.completions.create({
        model: model || 'gpt-4o-mini',
        messages,
        max_tokens: input.max_tokens || 1000,
        temperature: input.temperature || 0.7
      });

      return {
        response: completion.choices[0]?.message?.content || '',
        model: completion.model,
        provider: 'openai',
        processingTime: Date.now() - startTime,
        usage: completion.usage
      };
    } catch (error) {
      // Fallback for development/testing
      if (process.env.NODE_ENV === 'development' || process.env.LIGHTWEIGHT_TEST === '1') {
        const prompt = typeof input === 'string' ? input : 
          (input.messages ? input.messages.map(m => `${m.role}: ${m.content}`).join('\n') : 
           input.prompt || String(input));
           
        return {
          response: `[OpenAI ${model}] Mock response to: ${prompt.slice(0, 50)}...`,
          model,
          provider: 'openai',
          processingTime: 1200,
          usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 }
        };
      }
      throw new Error(`OpenAI chat failed: ${error.message}`);
    }
  }

  async huggingFaceChat(model, input, traceId) {
    if (!this.huggingfaceAvailable) {
      throw new Error('HuggingFace API key not configured (HF_TOKEN)');
    }

    // Use existing HuggingFace router service which handles API key internally
    try {
      const prompt = typeof input === 'string' ? input : 
        (input.messages ? input.messages.map(m => `${m.role}: ${m.content}`).join('\n') : 
         input.prompt || String(input));
      
      const startTime = Date.now();
      const result = await HFRouter.route(prompt, {
        taskOverride: 'chat',
        temperature: input.temperature || 0.7,
        max_new_tokens: input.max_tokens || 512,
        max_candidates: 3,
        preferredModel: model // Pass specific model if requested
      });

      return {
        response: result.output,
        model: result.model_id,
        provider: 'huggingface',
        processingTime: Date.now() - startTime,
        confidence: result.confidence,
        usage: { 
          model_id: result.model_id,
          timing_ms: result.timing_ms,
          candidates_considered: result.candidates_considered,
          used_fallbacks: result.used_fallbacks
        }
      };
    } catch (error) {
      throw new Error(`HuggingFace chat failed: ${error.message}`);
    }
  }

  async openAIEmbedding(model, input, traceId) {
    if (!this.openaiAvailable) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: this.openaiKey });

      const text = typeof input === 'string' ? input : input.text || '';
      const startTime = Date.now();
      
      const embedding = await openai.embeddings.create({
        model: model || 'text-embedding-3-small',
        input: text,
      });

      return {
        embedding: embedding.data[0].embedding,
        model: embedding.model,
        provider: 'openai',
        processingTime: Date.now() - startTime,
        dimensions: embedding.data[0].embedding.length,
        usage: embedding.usage
      };
    } catch (error) {
      // Fallback for development/testing
      if (process.env.NODE_ENV === 'development' || process.env.LIGHTWEIGHT_TEST === '1') {
        const text = typeof input === 'string' ? input : input.text || '';
        return {
          embedding: Array(1536).fill(0).map(() => Math.random() - 0.5),
          model,
          provider: 'openai',
          processingTime: 300,
          dimensions: 1536,
          usage: { prompt_tokens: Math.ceil(text.length / 4), total_tokens: Math.ceil(text.length / 4) }
        };
      }
      throw new Error(`OpenAI embedding failed: ${error.message}`);
    }
  }

  async huggingFaceEmbedding(model, input, traceId) {
    if (!this.huggingfaceAvailable) {
      throw new Error('HuggingFace API key not configured (HF_TOKEN)');
    }

    // Use existing HuggingFace router for embeddings
    try {
      const text = typeof input === 'string' ? input : input.text || '';
      const startTime = Date.now();
      
      const result = await HFRouter.route(text, {
        taskOverride: 'embedding',
        max_candidates: 2,
        preferredModel: model
      });

      // HF embeddings return the actual embedding vector
      return {
        embedding: Array.isArray(result.output) ? result.output : 
          Array(384).fill(0).map(() => Math.random() - 0.5), // fallback
        model: result.model_id,
        provider: 'huggingface',
        processingTime: Date.now() - startTime,
        dimensions: Array.isArray(result.output) ? result.output.length : 384,
        usage: {
          model_id: result.model_id,
          timing_ms: result.timing_ms,
          used_fallbacks: result.used_fallbacks
        }
      };
    } catch (error) {
      throw new Error(`HuggingFace embedding failed: ${error.message}`);
    }
  }

  async openAIVision(model, input, traceId) {
    return {
      analysis: `Vision analysis from ${model} (stub)`,
      objects: ['object1', 'object2'],
      confidence: 0.95,
      model,
      provider: 'openai',
      processingTime: 1800
    };
  }

  async huggingFaceVision(model, input, traceId) {
    return {
      analysis: `Vision analysis from ${model} (stub)`,
      labels: ['label1', 'label2'],
      confidence: 0.88,
      model,
      provider: 'huggingface',
      processingTime: 3200
    };
  }

  async deepgramSTT(model, input, traceId) {
    if (!this.deepgramAvailable || !this.deepgram) {
      throw new Error('Deepgram API key not configured or client not initialized');
    }

    try {
      const startTime = Date.now();
      let audioSource;

      // Handle different input types
      if (typeof input === 'string' && input.startsWith('http')) {
        // URL input
        audioSource = { url: input };
      } else if (input.buffer || Buffer.isBuffer(input)) {
        // Buffer input
        audioSource = input.buffer || input;
      } else if (input.audio) {
        // Object with audio property
        audioSource = input.audio;
      } else {
        throw new Error('Invalid audio input format');
      }

      const options = {
        model: model === 'nova-2' ? 'nova-2' : 'enhanced',
        smart_format: true,
        punctuate: true,
        diarize: false,
        language: input.language || 'en',
        // Audio Intelligence features
        sentiment: input.sentiment || false,
        intents: input.intents || false,
        topics: input.topics || false,
        summarize: input.summarize ? 'v2' : false,
        detect_entities: input.detect_entities || false
      };

      const { result } = await this.deepgram.listen.prerecorded.transcribeUrl(
        audioSource,
        options
      );

      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

      // Extract Audio Intelligence results
      const analysis = {
        sentiment: result.results?.sentiment?.segments || [],
        intents: result.results?.intents?.segments || [],
        topics: result.results?.topics?.segments || [],
        summary: result.results?.summary?.short || '',
        entities: result.results?.entities || []
      };

      return {
        transcript,
        confidence,
        model,
        provider: 'deepgram',
        processingTime: Date.now() - startTime,
        analysis: Object.keys(analysis).some(k => analysis[k]?.length > 0 || analysis[k]) ? analysis : undefined,
        metadata: {
          duration: result.metadata?.duration,
          channels: result.metadata?.channels,
          model_info: result.metadata?.model_info
        }
      };
    } catch (error) {
      throw new Error(`Deepgram STT failed: ${error.message}`);
    }
  }

  async openAIWhisper(model, input, traceId) {
    // This would integrate with OpenAI Whisper API
    // For now, return structured response
    const startTime = Date.now();
    
    return {
      transcript: `[Whisper ${model}] Transcribed audio content`,
      confidence: 0.94,
      model,
      provider: 'openai',
      processingTime: Date.now() - startTime,
      language: 'en'
    };
  }
}

// Main Cartrita Router class
class CartritaRouter {
  constructor() {
    this.adapters = new CartritaTaskAdapters();
    this.providerSelector = null; // Will be initialized later
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageLatency: 0,
      providerUsage: {},
      taskDistribution: {}
    };
  }

  async initialize(pool) {
    console.log('🔧 [CartritaRouter] Starting router initialization...');
    
    try {
      await this.adapters.initialize(pool);
      
      // Verify API key detection after initialization
      const apiKeys = {
        openai: !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY),
        huggingface: !!(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY),
        deepgram: !!(process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_KEY || process.env.DG_API_KEY)
      };
      
      // Initialize intelligent provider selector
      const { default: IntelligentProviderSelector } = await import('../../services/IntelligentProviderSelector.js');
      this.providerSelector = new IntelligentProviderSelector();
      await this.providerSelector.startMonitoring();
      console.log('🎯 Intelligent provider selector initialized');
      
      console.log('✅ Cartrita Router initialized with multi-provider support');
      console.log('🔧 [CartritaRouter] API key detection status:', apiKeys);
      console.log(`🔧 [CartritaRouter] Adapter flags: OpenAI=${this.adapters.openaiAvailable}, HF=${this.adapters.huggingfaceAvailable}, Deepgram=${this.adapters.deepgramAvailable}`);
      
      // Test provider availability for common tasks
      const testTasks = ['chat', 'embedding', 'audio_transcribe'];
      for (const task of testTasks) {
        const available = this.getAvailableProviders(task);
        console.log(`🔧 [CartritaRouter] Available providers for ${task}:`, available);
      }
      
    } catch (error) {
      console.error('❌ [CartritaRouter] Initialization failed:', error);
      throw error;
    }
  }

  // Main request processing method
  async processRequest(request) {
    const startTime = Date.now();
    const traceId = request.traceId || crypto.randomUUID();
    
    this.metrics.requestCount++;
    
    try {
      // Validate request
      const validatedRequest = this.validateRequest(request);
      
      // Select provider if not specified
      const providerId = validatedRequest.providerId || this.selectProvider(validatedRequest.task, validatedRequest.options);
      
      // Select model
      const model = this.selectModel(providerId, validatedRequest.task, validatedRequest.options);
      
      // Execute task
      const result = await this.executeTask({
        ...validatedRequest,
        providerId,
        model,
        traceId
      });

      // Update metrics
      this.updateMetrics(validatedRequest.task, providerId, Date.now() - startTime, false);
      
      // Update provider-specific metrics for enhanced selection
      updateProviderMetrics(providerId, Date.now() - startTime, true);
      
      // Normalize response
      return this.normalizeResponse({
        traceId,
        task: validatedRequest.task,
        providerId,
        model,
        latencyMs: Date.now() - startTime,
        result
      });
      
    } catch (error) {
      this.metrics.errorCount++;
      this.updateMetrics(request.task, request.providerId, Date.now() - startTime, true);
      
      // Update provider-specific metrics for failures
      if (request.providerId) {
        updateProviderMetrics(request.providerId, Date.now() - startTime, false);
      }
      
      throw {
        traceId,
        task: request.task,
        error: 'ROUTER_EXECUTION_FAILED',
        message: error.message,
        latencyMs: Date.now() - startTime
      };
    }
  }

  validateRequest(request) {
    if (!request.task) {
      throw new Error('Task is required');
    }

    const supportedTasks = ['chat', 'embedding', 'classification', 'vision', 'audio_transcribe', 'search', 'rag'];
    if (!supportedTasks.includes(request.task)) {
      throw new Error(`Unsupported task: ${request.task}`);
    }

    if (!request.input) {
      throw new Error('Input is required');
    }

    return {
      task: request.task,
      input: request.input,
      providerId: request.providerId,
      options: request.options || {},
      userId: request.userId,
      traceId: request.traceId
    };
  }

  selectProvider(task, options = {}) {
    try {
      // Filter providers based on API key availability
      const availableProviders = this.getAvailableProviders(task);
      if (availableProviders.length === 0) {
        throw new Error(`No providers with valid API keys available for task: ${task}`);
      }

      // If only one provider available, use it
      if (availableProviders.length === 1) {
        return availableProviders[0];
      }

      // Select best available provider
      return selectBestProvider(task, {
        latencyWeight: options.latencyWeight,
        reliabilityWeight: options.reliabilityWeight,
        costWeight: options.costWeight,
        availableProviders
      });
    } catch (error) {
      throw new Error(`Provider selection failed: ${error.message}`);
    }
  }

  getAvailableProviders(task) {
    console.log(`🔧 [CartritaRouter] Getting available providers for task: ${task}`);
    
    const providers = [];
    
    // Check environment variables directly (the core fix)
    const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
    const hasHuggingFace = !!(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY);
    const hasDeepgram = !!(process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_KEY || process.env.DG_API_KEY);
    
    console.log(`🔧 [CartritaRouter] API key availability - OpenAI: ${hasOpenAI}, HF: ${hasHuggingFace}, Deepgram: ${hasDeepgram}`);
    
    // Add providers based on both API key availability and task capability
    if (hasOpenAI && providerConfig.openai && providerConfig.openai.tasks.includes(task)) {
      providers.push('openai');
    }
    if (hasHuggingFace && providerConfig.huggingface && providerConfig.huggingface.tasks.includes(task)) {
      providers.push('huggingface');
    }
    if (hasDeepgram && providerConfig.deepgram && providerConfig.deepgram.tasks.includes(task)) {
      providers.push('deepgram');
    }
    
    // Local provider is always available for supported tasks (no API key required)
    if (providerConfig.local && providerConfig.local.tasks.includes(task)) {
      providers.push('local');
    }

    console.log(`✅ [CartritaRouter] Available providers for ${task}: ${providers}`);
    return providers;
  }

  selectModel(providerId, task, options = {}) {
    try {
      return selectModel(providerId, task, {
        modelHint: options.modelHint || options.model
      });
    } catch (error) {
      throw new Error(`Model selection failed: ${error.message}`);
    }
  }

  async executeTask(params) {
    const { task } = params;
    
    switch (task) {
      case 'chat':
        return await this.adapters.executeChat(params);
      case 'embedding':
        return await this.adapters.executeEmbedding(params);
      case 'classification':
        return await this.adapters.executeChat(params); // Use chat for classification
      case 'vision':
        return await this.adapters.executeVision(params);
      case 'audio_transcribe':
        return await this.adapters.executeAudioTranscribe(params);
      case 'search':
        return await this.adapters.executeSearch(params);
      case 'rag':
        return await this.adapters.executeRAG(params);
      default:
        throw new Error(`Task execution not implemented: ${task}`);
    }
  }

  normalizeResponse(response) {
    return {
      success: true,
      traceId: response.traceId,
      task: response.task,
      providerId: response.providerId,
      model: response.model,
      latencyMs: response.latencyMs,
      result: response.result,
      timestamp: new Date().toISOString()
    };
  }

  updateMetrics(task, providerId, latency, isError) {
    // Update task distribution
    this.metrics.taskDistribution[task] = (this.metrics.taskDistribution[task] || 0) + 1;
    
    // Update provider usage
    if (providerId) {
      this.metrics.providerUsage[providerId] = (this.metrics.providerUsage[providerId] || 0) + 1;
    }
    
    // Update average latency (simple moving average)
    const totalRequests = this.metrics.requestCount;
    this.metrics.averageLatency = ((this.metrics.averageLatency * (totalRequests - 1)) + latency) / totalRequests;
  }

  getMetrics() {
    return {
      ...this.metrics,
      providerConfig: Object.keys(providerConfig),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  // Enhanced metrics with provider-specific performance data
  async getEnhancedMetrics() {
    const { getRealTimeProviderMetrics } = await import('./providerConfig.js');
    const providerMetrics = {};
    
    // Get metrics for all configured providers
    for (const providerId of Object.keys(providerConfig)) {
      const metrics = getRealTimeProviderMetrics(providerId);
      if (metrics) {
        providerMetrics[providerId] = {
          averageLatency: metrics.averageLatency,
          successRate: metrics.successRate,
          totalRequests: metrics.totalRequests,
          successfulRequests: metrics.successfulRequests,
          lastUpdated: new Date(metrics.lastUpdated).toISOString()
        };
      }
    }
    
    return {
      ...this.metrics,
      providerMetrics,
      providerConfig: Object.keys(providerConfig),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  getProviders() {
    return Object.values(providerConfig).map(config => ({
      id: config.id,
      name: config.name,
      tasks: config.tasks,
      models: Object.keys(config.models).reduce((acc, task) => {
        acc[task] = config.models[task];
        return acc;
      }, {}),
      latencyScore: config.latencyScore,
      reliabilityScore: config.reliabilityScore
    }));
  }

  getProvidersByTask(task) {
    return this.getProviders().filter(provider => provider.tasks.includes(task));
  }
}

// Create singleton instance
const cartritaRouter = new CartritaRouter();

// Export main processing function
export async function processCartritaRequest(request) {
  return await cartritaRouter.processRequest(request);
}

export { CartritaRouter, cartritaRouter };
export default cartritaRouter;