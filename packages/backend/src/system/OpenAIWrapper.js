// packages/backend/src/system/OpenAIWrapper.js

const OpenAI = require('openai');
const ApiRateLimiter = require('./ApiRateLimiter');

/**
 * Wrapper for OpenAI API that includes rate limiting and error handling
 */
class OpenAIWrapper {
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null;
      console.warn(
        '[OpenAIWrapper] No API key provided, wrapper will return null'
      );
    }
  }

  /**
   * Create chat completion with rate limiting
   */
  async createChatCompletion(params) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - missing API key');
    }

    // Estimate tokens for rate limiting
    const estimatedTokens = this.estimateTokens(params);

    return ApiRateLimiter.queueRequest(async () => {
      return await this.openai.chat.completions.create(params);
    }, estimatedTokens);
  }

  /**
   * Create speech with rate limiting
   */
  async createSpeech(params) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - missing API key');
    }

    // Speech requests typically use fewer tokens but are still API calls
    return ApiRateLimiter.queueRequest(async () => {
      return await this.openai.audio.speech.create(params);
    }, 100); // Low token estimate for TTS
  }

  /**
   * Create transcription with rate limiting
   */
  async createTranscription(params) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - missing API key');
    }

    return ApiRateLimiter.queueRequest(async () => {
      return await this.openai.audio.transcriptions.create(params);
    }, 200); // Moderate token estimate for transcription
  }

  /**
   * Create image generation with rate limiting
   */
  async createImage(params) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - missing API key');
    }

    return ApiRateLimiter.queueRequest(async () => {
      return await this.openai.images.generate(params);
    }, 500); // Moderate token estimate for image generation
  }

  /**
   * Estimate token usage for rate limiting
   * This is a rough estimation - actual usage may vary
   */
  estimateTokens(params) {
    let totalTokens = 0;

    // Estimate tokens from messages
    if (params.messages) {
      params.messages.forEach(message => {
        if (message.content) {
          // Rough estimation: ~1 token per 4 characters
          totalTokens += Math.ceil(message.content.length / 4);
        }
      });
    }

    // Add buffer for response tokens
    const maxTokens = params.max_tokens || 1000;
    totalTokens += maxTokens;

    // Add buffer for system overhead
    totalTokens += 100;

    return totalTokens;
  }

  /**
   * Check if OpenAI client is available
   */
  isAvailable() {
    return !!this.openai;
  }

  /**
   * Get rate limiter statistics
   */
  getStats() {
    return {
      available: this.isAvailable(),
      rateLimiter: ApiRateLimiter.getStats(),
      healthy: ApiRateLimiter.isHealthy(),
    };
  }
}

module.exports = new OpenAIWrapper();
