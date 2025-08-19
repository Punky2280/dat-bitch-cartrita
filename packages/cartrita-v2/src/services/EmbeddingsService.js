/**
 * Cartrita V2 - Enhanced Embeddings Service
 * Comprehensive text embeddings with OpenAI's latest models and intelligent caching
 */

import { logger } from '../core/logger.js';
import { openAIService } from './OpenAIService.js';
import db from '../database/connection.js';
import crypto from 'crypto';

export class EmbeddingsService {
  constructor() {
    this.models = {
      'text-embedding-3-small': {
        name: 'Text Embedding 3 Small',
        dimensions: 1536,
        maxTokens: 8192,
        costPer1kTokens: 0.00002, // $0.02 per 1M tokens
        performance: 62.3,
        multilingual: true,
        recommended: 'general'
      },
      'text-embedding-3-large': {
        name: 'Text Embedding 3 Large',
        dimensions: 3072,
        maxTokens: 8192,
        costPer1kTokens: 0.00013, // $0.13 per 1M tokens
        performance: 64.6,
        multilingual: true,
        recommended: 'high_accuracy'
      },
      'text-embedding-ada-002': {
        name: 'Text Embedding Ada 002 (Legacy)',
        dimensions: 1536,
        maxTokens: 8192,
        costPer1kTokens: 0.00010, // $0.10 per 1M tokens
        performance: 61.0,
        multilingual: false,
        recommended: 'legacy'
      }
    };
    
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    this.initialized = false;
  }

  /**
   * Initialize embeddings service
   */
  async initialize() {
    try {
      // Ensure OpenAI service is initialized
      if (!openAIService.initialized) {
        await openAIService.initialize();
      }

      // Create embeddings cache table if it doesn't exist
      await this.ensureEmbeddingsCacheTable();
      
      this.initialized = true;
      logger.info('✅ Embeddings Service initialized', {
        availableModels: Object.keys(this.models),
        cacheEnabled: true,
        persistentCache: true
      });
    } catch (error) {
      logger.error('❌ Failed to initialize Embeddings Service', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Embeddings Service initialization failed: ${error.message}`);
    }
  }

  /**
   * Create embeddings cache table if it doesn't exist
   */
  async ensureEmbeddingsCacheTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_hash VARCHAR(64) UNIQUE NOT NULL,
        model VARCHAR(50) NOT NULL,
        dimensions INTEGER NOT NULL,
        text_content TEXT NOT NULL,
        embedding_vector TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_accessed TIMESTAMP DEFAULT NOW(),
        access_count INTEGER DEFAULT 1
      )
    `);

    // Create index for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_embedding_cache_hash_model 
      ON embedding_cache(content_hash, model)
    `);

    // Create index for cleanup operations
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_embedding_cache_last_accessed 
      ON embedding_cache(last_accessed)
    `);
  }

  /**
   * Generate embeddings for text input
   */
  async createEmbedding(input, options = {}) {
    if (!this.initialized) {
      throw new Error('Embeddings Service not initialized. Call initialize() first.');
    }

    const {
      model = 'text-embedding-3-small',
      dimensions = null,
      operationType = 'embeddings',
      useCache = true,
      userId = null
    } = options;

    // Validate model
    if (!this.models[model]) {
      throw new Error(`Model '${model}' is not supported. Available models: ${Object.keys(this.models).join(', ')}`);
    }

    const modelInfo = this.models[model];
    const startTime = Date.now();
    
    // Normalize input
    const texts = Array.isArray(input) ? input : [input];
    const results = [];
    const cacheHits = [];
    const cacheMisses = [];

    try {
      logger.ai('embeddings-batch-started', {
        model,
        inputCount: texts.length,
        dimensions: dimensions || modelInfo.dimensions,
        operationType,
        userId
      });

      for (const text of texts) {
        // Clean text
        const cleanText = text.replace(/\n/g, ' ').trim();
        
        // Generate cache key
        const cacheKey = this.generateCacheKey(cleanText, model, dimensions);
        
        let embedding = null;
        let fromCache = false;

        // Check cache first
        if (useCache) {
          embedding = await this.getCachedEmbedding(cacheKey, model);
          if (embedding) {
            fromCache = true;
            cacheHits.push(cacheKey);
          }
        }

        // Generate embedding if not cached
        if (!embedding) {
          cacheMisses.push(cacheKey);
          embedding = await this.generateEmbedding(cleanText, model, dimensions, operationType);
          
          // Cache the result
          if (useCache) {
            await this.cacheEmbedding(cacheKey, model, cleanText, embedding, dimensions || modelInfo.dimensions);
          }
        }

        results.push({
          text: cleanText,
          embedding: embedding.embedding,
          index: results.length,
          model,
          dimensions: dimensions || modelInfo.dimensions,
          tokenCount: embedding.tokenCount || this.estimateTokenCount(cleanText),
          fromCache,
          metadata: {
            cacheKey: useCache ? cacheKey : null,
            operationType
          }
        });
      }

      const duration = Date.now() - startTime;
      const totalTokens = results.reduce((sum, r) => sum + r.tokenCount, 0);

      logger.ai('embeddings-batch-completed', {
        model,
        inputCount: texts.length,
        cacheHits: cacheHits.length,
        cacheMisses: cacheMisses.length,
        totalTokens,
        duration,
        operationType,
        userId
      });

      return {
        object: 'list',
        model,
        data: results,
        usage: {
          prompt_tokens: totalTokens,
          total_tokens: totalTokens
        },
        metadata: {
          cacheHits: cacheHits.length,
          cacheMisses: cacheMisses.length,
          cacheEfficiency: texts.length > 0 ? (cacheHits.length / texts.length) * 100 : 0,
          duration,
          operationType,
          estimatedCost: this.calculateCost(totalTokens, model)
        }
      };

    } catch (error) {
      logger.error('Embeddings generation failed', {
        model,
        inputCount: texts.length,
        error: error.message,
        duration: Date.now() - startTime,
        operationType,
        userId
      });
      throw error;
    }
  }

  /**
   * Generate a single embedding using OpenAI API
   */
  async generateEmbedding(text, model, dimensions, operationType) {
    const client = openAIService.getClient(operationType);
    
    const requestOptions = {
      input: text,
      model,
      encoding_format: 'float'
    };

    // Add dimensions parameter for new models that support it
    if (dimensions && (model === 'text-embedding-3-small' || model === 'text-embedding-3-large')) {
      requestOptions.dimensions = dimensions;
    }

    const response = await client.embeddings.create(requestOptions);
    
    return {
      embedding: response.data[0].embedding,
      tokenCount: response.usage.total_tokens
    };
  }

  /**
   * Generate cache key for embedding
   */
  generateCacheKey(text, model, dimensions) {
    const content = `${text}|${model}|${dimensions || 'default'}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get cached embedding
   */
  async getCachedEmbedding(cacheKey, model) {
    try {
      const result = await db.query(`
        UPDATE embedding_cache 
        SET last_accessed = NOW(), access_count = access_count + 1
        WHERE content_hash = $1 AND model = $2
        RETURNING embedding_vector, dimensions, token_count
      `, [cacheKey, model]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          embedding: JSON.parse(row.embedding_vector),
          dimensions: row.dimensions,
          tokenCount: row.token_count
        };
      }
      
      return null;
    } catch (error) {
      logger.warn('Cache lookup failed', { error: error.message, cacheKey });
      return null;
    }
  }

  /**
   * Cache embedding result
   */
  async cacheEmbedding(cacheKey, model, text, embeddingData, dimensions) {
    try {
      await db.query(`
        INSERT INTO embedding_cache (content_hash, model, dimensions, text_content, embedding_vector, token_count)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (content_hash) DO UPDATE SET
          last_accessed = NOW(),
          access_count = embedding_cache.access_count + 1
      `, [
        cacheKey,
        model,
        dimensions,
        text,
        JSON.stringify(embeddingData.embedding),
        embeddingData.tokenCount
      ]);
    } catch (error) {
      logger.warn('Failed to cache embedding', { error: error.message, cacheKey });
      // Don't throw - caching failure shouldn't break the main operation
    }
  }

  /**
   * Calculate similarity between two embeddings using cosine similarity
   */
  calculateCosineSimilarity(embeddingA, embeddingB) {
    if (embeddingA.length !== embeddingB.length) {
      throw new Error('Embedding dimensions must match for similarity calculation');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < embeddingA.length; i++) {
      dotProduct += embeddingA[i] * embeddingB[i];
      normA += embeddingA[i] * embeddingA[i];
      normB += embeddingB[i] * embeddingB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0; // Handle zero vectors
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Find most similar embeddings from a list
   */
  findMostSimilar(targetEmbedding, candidateEmbeddings, topK = 5) {
    const similarities = candidateEmbeddings.map((candidate, index) => ({
      index,
      similarity: this.calculateCosineSimilarity(targetEmbedding, candidate.embedding),
      ...candidate
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  estimateTokenCount(text) {
    // Rough approximation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate estimated cost for embeddings
   */
  calculateCost(tokenCount, model) {
    const modelInfo = this.models[model];
    if (!modelInfo) return 0;
    
    return (tokenCount / 1000) * modelInfo.costPer1kTokens;
  }

  /**
   * Get embedding models information
   */
  getModelsInfo() {
    return Object.entries(this.models).map(([id, info]) => ({
      id,
      ...info,
      available: true
    }));
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const result = await db.query(`
      SELECT 
        model,
        COUNT(*) as cached_count,
        SUM(access_count) as total_accesses,
        AVG(access_count) as avg_accesses,
        MIN(created_at) as oldest_entry,
        MAX(last_accessed) as newest_access
      FROM embedding_cache
      GROUP BY model
    `);

    const totalSize = await db.query(`
      SELECT COUNT(*) as total_entries,
        SUM(LENGTH(embedding_vector)) as total_storage_bytes
      FROM embedding_cache
    `);

    return {
      byModel: result.rows.map(row => ({
        model: row.model,
        cachedCount: parseInt(row.cached_count),
        totalAccesses: parseInt(row.total_accesses),
        avgAccesses: parseFloat(row.avg_accesses),
        oldestEntry: row.oldest_entry,
        newestAccess: row.newest_access
      })),
      total: {
        entries: parseInt(totalSize.rows[0].total_entries || 0),
        storageBytesEstimate: parseInt(totalSize.rows[0].total_storage_bytes || 0)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clean old cache entries
   */
  async cleanCache(olderThanDays = 30, minAccessCount = 1) {
    const result = await db.query(`
      DELETE FROM embedding_cache
      WHERE last_accessed < NOW() - INTERVAL '${olderThanDays} days'
        AND access_count <= $1
      RETURNING COUNT(*) as deleted_count
    `, [minAccessCount]);

    const deletedCount = result.rowCount || 0;
    
    logger.info('Embeddings cache cleanup completed', {
      deletedEntries: deletedCount,
      olderThanDays,
      minAccessCount
    });

    return deletedCount;
  }

  /**
   * Health check for embeddings service
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return { status: 'not_initialized' };
      }

      // Test with a simple embedding
      const testText = 'Hello, world!';
      const startTime = Date.now();
      
      await this.createEmbedding(testText, {
        model: 'text-embedding-3-small',
        useCache: false
      });
      
      const responseTime = Date.now() - startTime;
      const cacheStats = await this.getCacheStats();
      
      return {
        status: 'healthy',
        responseTime,
        availableModels: Object.keys(this.models).length,
        cacheStats: {
          totalEntries: cacheStats.total.entries,
          storageBytes: cacheStats.total.storageBytesEstimate
        },
        openAIServiceStatus: await openAIService.healthCheck()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Singleton instance
export const embeddingsService = new EmbeddingsService();

// Initialize on import (will be called when service is first used)
export const initializeEmbeddings = () => embeddingsService.initialize();