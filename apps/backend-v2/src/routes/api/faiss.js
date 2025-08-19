/**
 * Cartrita V2 - FAISS Vector Search Integration (Fastify)
 * Bridges Fastify backend with Python FAISS service
 */

import { logger } from '../../utils/logger.js';
import axios from 'axios';

// FAISS service configuration
const FAISS_SERVICE_URL = process.env.FAISS_SERVICE_URL || 'http://localhost:8002';
const FAISS_TIMEOUT = parseInt(process.env.FAISS_TIMEOUT || '30000');

// Create axios instance for FAISS service
const faissClient = axios.create({
  baseURL: FAISS_SERVICE_URL,
  timeout: FAISS_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Cartrita-V2-Backend/2.0.0'
  }
});

// Request/Response schemas
const searchRequestSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1 },
    top_k: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
    threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
    filters: { type: 'object' },
    hybrid_alpha: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
    rerank: { type: 'boolean', default: true }
  },
  required: ['query']
};

const indexRequestSchema = {
  type: 'object',
  properties: {
    documents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string', minLength: 1 },
          metadata: { type: 'object' }
        },
        required: ['text']
      },
      minItems: 1,
      maxItems: 1000
    },
    batch_size: { type: 'integer', minimum: 1, maximum: 5000, default: 1000 }
  },
  required: ['documents']
};

// Fastify FAISS Router Plugin
export async function faissRouter(fastify, options) {
  // Add FAISS service health check hook
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip health check for status endpoints
    if (request.url.includes('/status') || request.url.includes('/health')) {
      return;
    }
  });

  // FAISS Service Status
  fastify.get('/status', {
    schema: {
      description: 'Get FAISS service status',
      tags: ['faiss'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                service_url: { type: 'string' },
                index_size: { type: 'number' },
                version: { type: 'string' },
                timestamp: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const response = await faissClient.get('/health');
      
      return {
        success: true,
        data: {
          status: 'connected',
          service_url: FAISS_SERVICE_URL,
          faiss_health: response.data,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('FAISS service health check failed', {
        error: error.message,
        service_url: FAISS_SERVICE_URL
      });
      
      return reply.code(503).send({
        success: false,
        error: {
          message: 'FAISS service unavailable',
          details: error.message,
          service_url: FAISS_SERVICE_URL
        }
      });
    }
  });

  // Vector Search
  fastify.post('/search', {
    schema: {
      description: 'Perform vector similarity search',
      tags: ['faiss'],
      body: searchRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      text: { type: 'string' },
                      score: { type: 'number' },
                      metadata: { type: 'object' }
                    }
                  }
                },
                query_id: { type: 'string' },
                total_results: { type: 'number' },
                search_time_ms: { type: 'number' },
                method: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    
    try {
      logger.info('Processing vector search request', {
        query: request.body.query.substring(0, 100),
        top_k: request.body.top_k || 10,
        user_id: request.user?.id
      });

      const response = await faissClient.post('/search', request.body);
      const processingTime = Date.now() - startTime;
      
      logger.info('Vector search completed', {
        query_id: response.data.query_id,
        results_count: response.data.total_results,
        search_time_ms: response.data.search_time_ms,
        processing_time_ms: processingTime
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Vector search failed', {
        error: error.message,
        query: request.body.query?.substring(0, 100),
        processing_time_ms: processingTime,
        status: error.response?.status
      });

      const statusCode = error.response?.status || 500;
      return reply.code(statusCode).send({
        success: false,
        error: {
          message: 'Vector search failed',
          details: error.response?.data?.detail || error.message
        }
      });
    }
  });

  // Index Documents
  fastify.post('/index', {
    schema: {
      description: 'Index documents for vector search',
      tags: ['faiss'],
      body: indexRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                indexed_count: { type: 'number' },
                total_documents: { type: 'number' },
                processing_time_ms: { type: 'number' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    
    try {
      logger.info('Processing document indexing request', {
        document_count: request.body.documents.length,
        batch_size: request.body.batch_size || 1000,
        user_id: request.user?.id
      });

      const response = await faissClient.post('/index', request.body);
      const processingTime = Date.now() - startTime;
      
      logger.info('Document indexing completed', {
        indexed_count: response.data.indexed_count,
        total_documents: response.data.total_documents,
        processing_time_ms: processingTime
      });

      return {
        success: true,
        data: {
          ...response.data,
          processing_time_ms: processingTime
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Document indexing failed', {
        error: error.message,
        document_count: request.body.documents?.length,
        processing_time_ms: processingTime,
        status: error.response?.status
      });

      const statusCode = error.response?.status || 500;
      return reply.code(statusCode).send({
        success: false,
        error: {
          message: 'Document indexing failed',
          details: error.response?.data?.detail || error.message
        }
      });
    }
  });

  // Get FAISS Statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get FAISS service statistics',
      tags: ['faiss'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                index_size: { type: 'number' },
                total_searches: { type: 'number' },
                cache_hits: { type: 'number' },
                cache_misses: { type: 'number' },
                average_search_time: { type: 'number' },
                memory_usage_mb: { type: 'number' },
                model_name: { type: 'string' },
                embedding_dim: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const response = await faissClient.get('/stats');
      
      return {
        success: true,
        data: response.data.stats
      };
    } catch (error) {
      logger.error('Failed to get FAISS statistics', {
        error: error.message,
        status: error.response?.status
      });

      const statusCode = error.response?.status || 500;
      return reply.code(statusCode).send({
        success: false,
        error: {
          message: 'Failed to get FAISS statistics',
          details: error.response?.data?.detail || error.message
        }
      });
    }
  });

  // RAG Pipeline Integration
  fastify.post('/rag-search', {
    schema: {
      description: 'Enhanced RAG search with context retrieval',
      tags: ['faiss', 'rag'],
      body: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1 },
          context_count: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
          threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
          include_metadata: { type: 'boolean', default: true },
          filters: { type: 'object' }
        },
        required: ['query']
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    
    try {
      const { query, context_count = 5, threshold = 0.7, include_metadata = true, filters } = request.body;
      
      logger.info('Processing RAG search request', {
        query: query.substring(0, 100),
        context_count,
        user_id: request.user?.id
      });

      // Perform vector search for context retrieval
      const searchResponse = await faissClient.post('/search', {
        query,
        top_k: context_count,
        threshold,
        filters,
        rerank: true
      });

      // Format results for RAG pipeline
      const contexts = searchResponse.data.results.map(result => ({
        id: result.id,
        content: result.text,
        score: result.score,
        ...(include_metadata && { metadata: result.metadata })
      }));

      const processingTime = Date.now() - startTime;
      
      logger.info('RAG search completed', {
        query_id: searchResponse.data.query_id,
        contexts_found: contexts.length,
        processing_time_ms: processingTime
      });

      return {
        success: true,
        data: {
          query,
          contexts,
          query_id: searchResponse.data.query_id,
          search_time_ms: searchResponse.data.search_time_ms,
          processing_time_ms: processingTime,
          method: 'rag_hybrid'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('RAG search failed', {
        error: error.message,
        query: request.body.query?.substring(0, 100),
        processing_time_ms: processingTime
      });

      const statusCode = error.response?.status || 500;
      return reply.code(statusCode).send({
        success: false,
        error: {
          message: 'RAG search failed',
          details: error.response?.data?.detail || error.message
        }
      });
    }
  });

  logger.info('✅ FAISS vector search routes configured', {
    service_url: FAISS_SERVICE_URL,
    timeout: FAISS_TIMEOUT
  });
}