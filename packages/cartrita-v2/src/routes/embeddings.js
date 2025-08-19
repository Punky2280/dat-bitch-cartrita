/**
 * Cartrita V2 - Embeddings Routes
 * Comprehensive text embeddings API with caching, similarity search, and bulk operations
 */

import { logger } from '../core/logger.js';
import { embeddingsService } from '../services/EmbeddingsService.js';
import db from '../database/connection.js';

export async function embeddingsRoutes(fastify, options) {
  // Initialize embeddings service
  try {
    await embeddingsService.initialize();
    logger.info('✅ Embeddings Service initialized for routes');
  } catch (error) {
    logger.error('❌ Failed to initialize Embeddings Service for routes', { error: error.message });
  }

  // Get available embedding models
  fastify.get('/models', {
    schema: {
      description: 'Get available embedding models and their specifications',
      tags: ['embeddings'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            models: { type: 'array' },
            recommendations: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const models = embeddingsService.getModelsInfo();
      
      const recommendations = {
        general: models.find(m => m.recommended === 'general')?.id || 'text-embedding-3-small',
        highAccuracy: models.find(m => m.recommended === 'high_accuracy')?.id || 'text-embedding-3-large',
        costOptimal: models.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0]?.id || 'text-embedding-3-small',
        performance: models.sort((a, b) => b.performance - a.performance)[0]?.id || 'text-embedding-3-large'
      };

      return {
        success: true,
        models,
        recommendations,
        metadata: {
          totalModels: models.length,
          defaultModel: 'text-embedding-3-small',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Failed to get embedding models', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve embedding models'
      });
    }
  });

  // Create embeddings
  fastify.post('/create', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate embeddings for text input with intelligent caching',
      tags: ['embeddings'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['input'],
        properties: {
          input: {
            oneOf: [
              { type: 'string' },
              { 
                type: 'array',
                items: { type: 'string' },
                maxItems: 100
              }
            ]
          },
          model: {
            type: 'string',
            enum: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
            default: 'text-embedding-3-small'
          },
          dimensions: {
            type: 'integer',
            minimum: 1,
            maximum: 3072
          },
          encoding_format: {
            type: 'string',
            enum: ['float', 'base64'],
            default: 'float'
          },
          useCache: {
            type: 'boolean',
            default: true
          }
        }
      }
    }
  }, async (request, reply) => {
    const { input, model = 'text-embedding-3-small', dimensions, encoding_format = 'float', useCache = true } = request.body;
    const startTime = Date.now();
    const requestId = `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.ai('embeddings-request-started', {
        requestId,
        userId: request.user.userId,
        model,
        inputType: Array.isArray(input) ? 'array' : 'string',
        inputCount: Array.isArray(input) ? input.length : 1,
        dimensions,
        useCache
      });

      // Validate input
      if (Array.isArray(input) && input.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Input array cannot be empty'
        });
      }

      // Check input text length limits
      const texts = Array.isArray(input) ? input : [input];
      const maxTokensPerModel = 8192; // All current models support 8K tokens
      
      for (const text of texts) {
        const estimatedTokens = embeddingsService.estimateTokenCount(text);
        if (estimatedTokens > maxTokensPerModel) {
          return reply.status(400).send({
            success: false,
            error: `Text too long. Estimated ${estimatedTokens} tokens, max ${maxTokensPerModel} for model ${model}`
          });
        }
      }

      // Generate embeddings
      const result = await embeddingsService.createEmbedding(input, {
        model,
        dimensions,
        operationType: 'embeddings',
        useCache,
        userId: request.user.userId
      });

      // Log interaction
      await db.query(`
        INSERT INTO ai_interactions (id, user_id, model, provider, input_tokens, output_tokens, duration_ms, created_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      `, [
        requestId,
        request.user.userId,
        model,
        'openai_embeddings',
        result.usage.prompt_tokens,
        0, // Embeddings don't generate output tokens
        Date.now() - startTime,
        JSON.stringify({
          inputCount: texts.length,
          cacheHits: result.metadata.cacheHits,
          cacheMisses: result.metadata.cacheMisses,
          dimensions: dimensions || result.data[0]?.dimensions
        })
      ]);

      logger.ai('embeddings-request-completed', {
        requestId,
        userId: request.user.userId,
        model,
        inputCount: texts.length,
        totalTokens: result.usage.total_tokens,
        cacheEfficiency: result.metadata.cacheEfficiency,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        ...result,
        requestId,
        metadata: {
          ...result.metadata,
          requestId,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Embeddings request failed', {
        requestId,
        userId: request.user.userId,
        model,
        error: error.message,
        duration: Date.now() - startTime
      });

      return reply.status(500).send({
        success: false,
        error: 'Embeddings generation failed',
        details: error.message,
        requestId
      });
    }
  });

  // Similarity search
  fastify.post('/similarity', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Find similar embeddings using cosine similarity',
      tags: ['embeddings'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'number' } }
            ]
          },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                embedding: { type: 'array', items: { type: 'number' } },
                metadata: { type: 'object' }
              }
            },
            maxItems: 1000
          },
          model: {
            type: 'string',
            enum: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
            default: 'text-embedding-3-small'
          },
          topK: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 5
          },
          threshold: {
            type: 'number',
            minimum: -1,
            maximum: 1,
            default: 0.0
          }
        }
      }
    }
  }, async (request, reply) => {
    const { query, candidates, model = 'text-embedding-3-small', topK = 5, threshold = 0.0 } = request.body;
    const startTime = Date.now();
    const requestId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.ai('similarity-search-started', {
        requestId,
        userId: request.user.userId,
        model,
        candidateCount: candidates.length,
        topK,
        threshold,
        queryType: typeof query === 'string' ? 'text' : 'embedding'
      });

      let queryEmbedding;

      // Generate embedding for text query or use provided embedding
      if (typeof query === 'string') {
        const embeddingResult = await embeddingsService.createEmbedding(query, {
          model,
          operationType: 'similarity-search',
          userId: request.user.userId
        });
        queryEmbedding = embeddingResult.data[0].embedding;
      } else {
        queryEmbedding = query;
      }

      // Validate candidates have embeddings
      for (const candidate of candidates) {
        if (!candidate.embedding || !Array.isArray(candidate.embedding)) {
          return reply.status(400).send({
            success: false,
            error: 'All candidates must have embedding arrays'
          });
        }
        
        if (candidate.embedding.length !== queryEmbedding.length) {
          return reply.status(400).send({
            success: false,
            error: `Embedding dimension mismatch. Query: ${queryEmbedding.length}, candidate: ${candidate.embedding.length}`
          });
        }
      }

      // Find most similar embeddings
      const similarities = embeddingsService.findMostSimilar(queryEmbedding, candidates, candidates.length);
      
      // Filter by threshold and limit by topK
      const results = similarities
        .filter(item => item.similarity >= threshold)
        .slice(0, topK)
        .map((item, rank) => ({
          rank: rank + 1,
          similarity: item.similarity,
          text: item.text,
          metadata: item.metadata || {},
          index: item.index
        }));

      logger.ai('similarity-search-completed', {
        requestId,
        userId: request.user.userId,
        candidateCount: candidates.length,
        resultCount: results.length,
        topSimilarity: results[0]?.similarity || 0,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        query: typeof query === 'string' ? query : '[embedding_array]',
        model,
        results,
        metadata: {
          requestId,
          candidatesEvaluated: candidates.length,
          resultsReturned: results.length,
          topK,
          threshold,
          queryEmbeddingDimensions: queryEmbedding.length,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Similarity search failed', {
        requestId,
        userId: request.user.userId,
        error: error.message,
        duration: Date.now() - startTime
      });

      return reply.status(500).send({
        success: false,
        error: 'Similarity search failed',
        details: error.message,
        requestId
      });
    }
  });

  // Bulk embeddings with batch processing
  fastify.post('/bulk', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate embeddings for large batches of text efficiently',
      tags: ['embeddings'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['inputs'],
        properties: {
          inputs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'text'],
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                metadata: { type: 'object' }
              }
            },
            minItems: 1,
            maxItems: 1000
          },
          model: {
            type: 'string',
            enum: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
            default: 'text-embedding-3-small'
          },
          dimensions: {
            type: 'integer',
            minimum: 1,
            maximum: 3072
          },
          batchSize: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50
          },
          useCache: {
            type: 'boolean',
            default: true
          }
        }
      }
    }
  }, async (request, reply) => {
    const { inputs, model = 'text-embedding-3-small', dimensions, batchSize = 50, useCache = true } = request.body;
    const startTime = Date.now();
    const requestId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.ai('bulk-embeddings-started', {
        requestId,
        userId: request.user.userId,
        model,
        inputCount: inputs.length,
        batchSize,
        useCache
      });

      const results = [];
      const errors = [];
      let totalTokens = 0;
      let cacheHits = 0;
      let cacheMisses = 0;

      // Process in batches to avoid overwhelming the API
      for (let i = 0; i < inputs.length; i += batchSize) {
        const batch = inputs.slice(i, i + batchSize);
        const batchTexts = batch.map(input => input.text);

        try {
          const batchResult = await embeddingsService.createEmbedding(batchTexts, {
            model,
            dimensions,
            operationType: 'bulk-embeddings',
            useCache,
            userId: request.user.userId
          });

          // Map results back to original input IDs
          batch.forEach((input, index) => {
            const embeddingData = batchResult.data[index];
            results.push({
              id: input.id,
              text: input.text,
              embedding: embeddingData.embedding,
              dimensions: embeddingData.dimensions,
              tokenCount: embeddingData.tokenCount,
              fromCache: embeddingData.fromCache,
              metadata: input.metadata || {}
            });
          });

          totalTokens += batchResult.usage.total_tokens;
          cacheHits += batchResult.metadata.cacheHits;
          cacheMisses += batchResult.metadata.cacheMisses;

          // Small delay between batches to respect rate limits
          if (i + batchSize < inputs.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (batchError) {
          // Handle batch errors
          batch.forEach(input => {
            errors.push({
              id: input.id,
              error: batchError.message,
              text: input.text.substring(0, 100) + '...'
            });
          });
        }
      }

      const duration = Date.now() - startTime;
      const successCount = results.length;
      const errorCount = errors.length;

      // Log bulk interaction
      await db.query(`
        INSERT INTO ai_interactions (id, user_id, model, provider, input_tokens, output_tokens, duration_ms, created_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      `, [
        requestId,
        request.user.userId,
        model,
        'openai_embeddings_bulk',
        totalTokens,
        0,
        duration,
        JSON.stringify({
          inputCount: inputs.length,
          successCount,
          errorCount,
          batchSize,
          cacheHits,
          cacheMisses,
          cacheEfficiency: inputs.length > 0 ? (cacheHits / inputs.length) * 100 : 0
        })
      ]);

      logger.ai('bulk-embeddings-completed', {
        requestId,
        userId: request.user.userId,
        inputCount: inputs.length,
        successCount,
        errorCount,
        totalTokens,
        cacheHits,
        cacheMisses,
        duration
      });

      return {
        success: errorCount === 0,
        requestId,
        model,
        results,
        errors,
        summary: {
          total: inputs.length,
          successful: successCount,
          failed: errorCount,
          totalTokens,
          cacheHits,
          cacheMisses,
          cacheEfficiency: inputs.length > 0 ? (cacheHits / inputs.length) * 100 : 0,
          duration,
          estimatedCost: embeddingsService.calculateCost(totalTokens, model)
        },
        metadata: {
          batchSize,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Bulk embeddings failed', {
        requestId,
        userId: request.user.userId,
        error: error.message,
        duration: Date.now() - startTime
      });

      return reply.status(500).send({
        success: false,
        error: 'Bulk embeddings operation failed',
        details: error.message,
        requestId
      });
    }
  });

  // Get embeddings service status and cache statistics
  fastify.get('/status', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get embeddings service health status and cache statistics',
      tags: ['embeddings'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'object' },
            cache: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const healthStatus = await embeddingsService.healthCheck();
      const cacheStats = await embeddingsService.getCacheStats();

      return {
        success: true,
        status: healthStatus,
        cache: cacheStats,
        metadata: {
          initialized: embeddingsService.initialized,
          availableModels: Object.keys(embeddingsService.models).length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Failed to get embeddings status', {
        error: error.message,
        userId: request.user.userId
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve embeddings service status'
      });
    }
  });

  // Clean embeddings cache
  fastify.post('/cache/clean', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Clean old entries from embeddings cache',
      tags: ['embeddings'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          olderThanDays: {
            type: 'integer',
            minimum: 1,
            maximum: 365,
            default: 30
          },
          minAccessCount: {
            type: 'integer',
            minimum: 0,
            default: 1
          }
        }
      }
    }
  }, async (request, reply) => {
    const { olderThanDays = 30, minAccessCount = 1 } = request.body;

    try {
      const deletedCount = await embeddingsService.cleanCache(olderThanDays, minAccessCount);

      return {
        success: true,
        deletedEntries: deletedCount,
        criteria: {
          olderThanDays,
          minAccessCount
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Cache cleanup failed', {
        error: error.message,
        userId: request.user.userId
      });

      return reply.status(500).send({
        success: false,
        error: 'Cache cleanup failed',
        details: error.message
      });
    }
  });

  logger.info('✅ Embeddings routes registered', {
    endpoints: ['/models', '/create', '/similarity', '/bulk', '/status', '/cache/clean']
  });
}