/**
 * Gemini Embedding Service
 * Integration with Google's Gemini text-embedding-004 model for 768-dimensional vectors
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import keyVaultService from './security/keyVaultService.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

export default class GeminiEmbeddingService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.vectorDimension = 768;
    this.modelName = 'text-embedding-004';
    this.initialized = false;
  }

  async initialize() {
    try {
      const apiKey = await this.getGeminiAPIKey();
      if (!apiKey) {
        console.warn('[GeminiEmbedding] No API key available, service disabled');
        return false;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      this.initialized = true;
      
      console.log(`[GeminiEmbedding] ✅ Service initialized with ${this.modelName}`);
      return true;
    } catch (error) {
      console.error('[GeminiEmbedding] ❌ Initialization failed:', error.message);
      return false;
    }
  }

  async getGeminiAPIKey() {
    try {
      // Try to get from key vault first
      const keyRecord = await keyVaultService.get('gemini_api_key');
      if (keyRecord && keyRecord.decryptedKey) {
        return keyRecord.decryptedKey;
      }
      
      // Fallback to environment variable
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    } catch (error) {
      console.warn('[GeminiEmbedding] Key retrieval failed:', error.message);
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }
  }

  /**
   * Generate embeddings for text using Gemini's text-embedding-004 model
   */
  async generateEmbeddings(texts) {
    return OpenTelemetryTracing.traceOperation('gemini.embeddings.generate', {}, async () => {
      if (!this.initialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Gemini embedding service not available');
        }
      }

      const textArray = Array.isArray(texts) ? texts : [texts];
      const embeddings = [];

      try {
        for (const text of textArray) {
          if (!text || text.trim().length === 0) {
            // Return zero vector for empty text
            embeddings.push(new Array(this.vectorDimension).fill(0));
            continue;
          }

          const result = await this.model.embedContent(text);
          const embedding = result.embedding.values;

          // Ensure proper dimension
          if (embedding.length !== this.vectorDimension) {
            console.warn(`[GeminiEmbedding] Expected ${this.vectorDimension}D but got ${embedding.length}D`);
          }

          embeddings.push(embedding);
        }

        return Array.isArray(texts) ? embeddings : embeddings[0];
      } catch (error) {
        console.error('[GeminiEmbedding] ❌ Generation failed:', error.message);
        throw new Error(`Failed to generate embeddings: ${error.message}`);
      }
    });
  }

  /**
   * Get service status and configuration
   */
  getStatus() {
    return {
      initialized: this.initialized,
      modelName: this.modelName,
      vectorDimension: this.vectorDimension,
      available: this.initialized && !!this.model
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      return 0;
    }

    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
}