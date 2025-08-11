/* global process, console */
// packages/backend/src/system/OpenAIWrapper.js

import OpenAI from 'openai';
import ApiRateLimiter from './ApiRateLimiter.js';

/**
 * Production OpenAI API Wrapper with intelligent rate limiting, error handling, and monitoring
 * Provides consistent interface for all OpenAI operations with automatic retry and queuing
 */
class OpenAIWrapper {
  constructor() {
    this.openai = null;
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (this.apiKey && this.apiKey.startsWith('sk-')) {
      this.openai = new OpenAI({ 
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        timeout: 60000, // 60 second timeout
        maxRetries: 0 // Let our rate limiter handle retries
      });
      console.log('[OpenAIWrapper] ✅ Initialized with API key');
    } else {
      this.openai = null;
      console.warn('[OpenAIWrapper] ⚠️ No valid API key provided, wrapper will return mock responses');
    }
    
    // Token estimation improvements
    this.tokenEstimator = {
      // Rough token estimates per character for different models
      'gpt-4': 0.25,
      'gpt-4o': 0.25,
      'gpt-3.5-turbo': 0.25,
      'default': 0.25
    };
  }

  /**
   * Create chat completion with intelligent rate limiting and error handling
   */
  async createChatCompletion(params, options = {}) {
    if (!this.openai) {
      // Return mock response for development/testing
      return this.getMockChatResponse(params);
    }

    // Estimate tokens for intelligent queuing
    const estimatedTokens = this.estimateTokensForChat(params);
    
    // Enhanced parameters with model defaults
    const enhancedParams = {
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 2000,
      ...params
    };

    return ApiRateLimiter.queueRequest(async () => {
      try {
        console.log(`[OpenAIWrapper] 💬 Creating chat completion (model: ${enhancedParams.model})`);
        const response = await this.openai.chat.completions.create(enhancedParams);
        
        console.log(`[OpenAIWrapper] ✅ Chat completion successful (${response.usage?.total_tokens || 'unknown'} tokens)`);
        return response;
      } catch (error) {
        console.error(`[OpenAIWrapper] ❌ Chat completion failed:`, error.message);
        throw error;
      }
    }, estimatedTokens, options);
  }

  /**
   * Create speech with rate limiting (Text-to-Speech)
   */
  async createSpeech(params, options = {}) {
    if (!this.openai) {
      return this.getMockAudioResponse();
    }

    const enhancedParams = {
      model: 'tts-1',
      voice: 'nova',
      response_format: 'mp3',
      speed: 1.0,
      ...params
    };

    return ApiRateLimiter.queueRequest(async () => {
      try {
        console.log(`[OpenAIWrapper] 🔊 Creating speech (voice: ${enhancedParams.voice})`);
        const response = await this.openai.audio.speech.create(enhancedParams);
        
        console.log(`[OpenAIWrapper] ✅ Speech generation successful`);
        return response;
      } catch (error) {
        console.error(`[OpenAIWrapper] ❌ Speech generation failed:`, error.message);
        throw error;
      }
    }, 100, options); // TTS uses fewer tokens but still counts as API call
  }

  /**
   * Create transcription with rate limiting (Speech-to-Text)
   */
  async createTranscription(params, options = {}) {
    if (!this.openai) {
      return this.getMockTranscriptionResponse();
    }

    const enhancedParams = {
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json',
      temperature: 0,
      ...params
    };

    return ApiRateLimiter.queueRequest(async () => {
      try {
        console.log(`[OpenAIWrapper] 🎤 Creating transcription (model: ${enhancedParams.model})`);
        const response = await this.openai.audio.transcriptions.create(enhancedParams);
        
        console.log(`[OpenAIWrapper] ✅ Transcription successful`);
        return response;
      } catch (error) {
        console.error(`[OpenAIWrapper] ❌ Transcription failed:`, error.message);
        throw error;
      }
    }, 200, options); // Moderate token estimate for transcription
  }

  /**
   * Create image generation with rate limiting (DALL-E)
   */
  async createImage(params, options = {}) {
    if (!this.openai) {
      return this.getMockImageResponse();
    }

    const enhancedParams = {
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
      response_format: 'url',
      n: 1,
      ...params
    };

    return ApiRateLimiter.queueRequest(async () => {
      try {
        console.log(`[OpenAIWrapper] 🎨 Creating image (model: ${enhancedParams.model}, size: ${enhancedParams.size})`);
        const response = await this.openai.images.generate(enhancedParams);
        
        console.log(`[OpenAIWrapper] ✅ Image generation successful`);
        return response;
      } catch (error) {
        console.error(`[OpenAIWrapper] ❌ Image generation failed:`, error.message);
        throw error;
      }
    }, 500, options); // Image generation is token-intensive
  }

  /**
   * Create embeddings with rate limiting
   */
  async createEmbeddings(params, options = {}) {
    if (!this.openai) {
      return this.getMockEmbeddingResponse();
    }

    const enhancedParams = {
      model: 'text-embedding-3-large',
      encoding_format: 'float',
      ...params
    };

    const estimatedTokens = this.estimateTokensForText(params.input);

    return ApiRateLimiter.queueRequest(async () => {
      try {
        console.log(`[OpenAIWrapper] 📊 Creating embeddings (model: ${enhancedParams.model})`);
        const response = await this.openai.embeddings.create(enhancedParams);
        
        console.log(`[OpenAIWrapper] ✅ Embeddings successful (${response.usage?.total_tokens || 'unknown'} tokens)`);
        return response;
      } catch (error) {
        console.error(`[OpenAIWrapper] ❌ Embeddings failed:`, error.message);
        throw error;
      }
    }, estimatedTokens, options);
  }

  /**
   * Enhanced token estimation for chat completions
   */
  estimateTokensForChat(params) {
    if (!params.messages || !Array.isArray(params.messages)) {
      return 1000; // Default fallback
    }

    let totalTokens = 0;
    const model = params.model || 'gpt-4o';
    const tokensPerChar = this.tokenEstimator[model] || this.tokenEstimator.default;

    // Count input tokens
    params.messages.forEach(message => {
      if (typeof message.content === 'string') {
        totalTokens += Math.ceil(message.content.length * tokensPerChar);
      } else if (Array.isArray(message.content)) {
        // Handle multimodal content
        message.content.forEach(item => {
          if (item.type === 'text' && item.text) {
            totalTokens += Math.ceil(item.text.length * tokensPerChar);
          } else if (item.type === 'image_url') {
            totalTokens += 765; // Fixed cost for image analysis
          }
        });
      }
      
      // Add role/system tokens
      totalTokens += 10;
    });

    // Add response tokens estimate
    const maxTokens = params.max_tokens || 2000;
    totalTokens += maxTokens;

    // Add system overhead
    totalTokens += 50;

    return Math.max(100, totalTokens); // Minimum estimate
  }

  /**
   * Estimate tokens for text input
   */
  estimateTokensForText(text) {
    if (typeof text === 'string') {
      return Math.ceil(text.length * 0.25) + 50;
    } else if (Array.isArray(text)) {
      return text.reduce((total, item) => {
        return total + Math.ceil(String(item).length * 0.25);
      }, 50);
    }
    return 100;
  }

  /**
   * Mock responses for development/testing when no API key
   */
  getMockChatResponse(params) {
    const message = params.messages?.[params.messages.length - 1]?.content || 'Hello';
    return {
      id: 'mock-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: params.model || 'gpt-4o',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `[MOCK RESPONSE] I understand you said: "${typeof message === 'string' ? message.substring(0, 50) : 'multimodal input'}". This is a mock response because no OpenAI API key is configured.`
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 30,
        total_tokens: 80
      }
    };
  }

  getMockAudioResponse() {
    return {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      blob: () => Promise.resolve(new Blob(['mock audio data'], { type: 'audio/mpeg' }))
    };
  }

  getMockTranscriptionResponse() {
    return {
      text: '[MOCK TRANSCRIPTION] This is a mock transcription response.',
      task: 'transcribe',
      language: 'english',
      duration: 2.5,
      segments: [{
        id: 0,
        seek: 0,
        start: 0.0,
        end: 2.5,
        text: '[MOCK TRANSCRIPTION] This is a mock transcription response.',
        tokens: [1, 2, 3],
        temperature: 0.0,
        avg_logprob: -0.5,
        compression_ratio: 1.2,
        no_speech_prob: 0.1
      }]
    };
  }

  getMockImageResponse() {
    return {
      created: Math.floor(Date.now() / 1000),
      data: [{
        url: 'https://via.placeholder.com/1024x1024/4A90E2/FFFFFF?text=MOCK+IMAGE',
        revised_prompt: '[MOCK] A mock generated image placeholder'
      }]
    };
  }

  getMockEmbeddingResponse() {
    return {
      object: 'list',
      data: [{
        object: 'embedding',
        index: 0,
        embedding: new Array(1536).fill(0).map(() => Math.random() * 2 - 1)
      }],
      model: 'text-embedding-3-large',
      usage: {
        prompt_tokens: 50,
        total_tokens: 50
      }
    };
  }

  /**
   * Check if OpenAI client is available and functional
   */
  isAvailable() {
    return this.openai !== null;
  }

  /**
   * Get comprehensive status and statistics
   */
  getStats() {
    return {
      available: this.isAvailable(),
      apiKey: this.apiKey ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(-4)}` : null,
      baseURL: this.baseURL,
      rateLimiter: ApiRateLimiter.getStats(),
      healthy: this.isHealthy()
    };
  }

  /**
   * Health check for the wrapper
   */
  isHealthy() {
    return this.isAvailable() && ApiRateLimiter.isHealthy();
  }

  /**
   * Test the OpenAI connection with a simple request
   */
  async testConnection() {
    if (!this.isAvailable()) {
      return { success: false, error: 'No API key configured' };
    }

    try {
      const response = await this.createChatCompletion({
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5,
        model: 'gpt-4o'
      }, { priority: 10 });

      return { 
        success: true, 
        response: response.choices?.[0]?.message?.content,
        tokens: response.usage?.total_tokens
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get detailed usage summary
   */
  getUsageSummary() {
    const rateLimiterStats = ApiRateLimiter.getStats();
    return {
      wrapper: {
        available: this.isAvailable(),
        healthy: this.isHealthy()
      },
      usage: rateLimiterStats.totalStats,
      currentLoad: {
        queueLength: rateLimiterStats.queueLength,
        activeRequests: rateLimiterStats.activeRequests,
        requestUtilization: rateLimiterStats.requestUtilization,
        tokenUtilization: rateLimiterStats.tokenUtilization
      }
    };
  }
}

export default new OpenAIWrapper();