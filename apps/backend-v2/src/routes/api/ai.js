/**
 * Cartrita V2 - AI/ML Integration Routes
 * Proxies AI workloads to FastAPI service
 */

import { fastAPIClient } from '../../services/FastAPIClient.js';
import { logger } from '../../utils/logger.js';
import { trace } from '@opentelemetry/api';

export async function aiRouter(fastify, options) {
  // AI text generation endpoint
  fastify.post('/generate', {
    schema: {
      description: 'Generate AI response using FastAPI service',
      tags: ['ai'],
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' },
          model: { type: 'string', default: 'gpt-3.5-turbo' },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          max_tokens: { type: 'integer', minimum: 1, maximum: 4000, default: 1000 },
          metadata: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan('ai.generate');
    
    try {
      const { prompt, model, temperature, max_tokens, metadata } = request.body;
      
      span.setAttributes({
        'ai.model': model || 'gpt-3.5-turbo',
        'ai.prompt_length': prompt.length,
        'ai.max_tokens': max_tokens || 1000
      });

      const result = await fastAPIClient.generateAIResponse(prompt, {
        model,
        temperature,
        max_tokens,
        metadata
      });

      span.setAttributes({
        'ai.tokens_used': result.tokens_used,
        'ai.processing_time': result.processing_time
      });

      reply.send({
        success: true,
        data: result
      });

      span.setStatus({ code: 1 });
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      
      logger.error('AI generation failed', { error: error.message });
      
      reply.status(500).send({
        success: false,
        error: 'AI generation failed',
        message: error.message
      });
    } finally {
      span.end();
    }
  });

  // RAG search endpoint
  fastify.post('/rag/search', {
    schema: {
      description: 'Perform vector-based RAG search',
      tags: ['ai', 'rag'],
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          collection: { type: 'string', default: 'default' },
          top_k: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
          threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 }
        }
      }
    }
  }, async (request, reply) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan('ai.rag.search');
    
    try {
      const { query, collection, top_k, threshold } = request.body;
      
      span.setAttributes({
        'rag.query_length': query.length,
        'rag.collection': collection || 'default',
        'rag.top_k': top_k || 5
      });

      const result = await fastAPIClient.ragSearch(query, {
        collection,
        top_k,
        threshold
      });

      span.setAttributes({
        'rag.results_count': result.results.length,
        'rag.processing_time': result.processing_time
      });

      reply.send({
        success: true,
        data: result
      });

      span.setStatus({ code: 1 });
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      
      logger.error('RAG search failed', { error: error.message });
      
      reply.status(500).send({
        success: false,
        error: 'RAG search failed',
        message: error.message
      });
    } finally {
      span.end();
    }
  });

  // Agent processing endpoint
  fastify.post('/agents/:agentId/process', {
    schema: {
      description: 'Process agent request via FastAPI',
      tags: ['ai', 'agents'],
      params: {
        type: 'object',
        properties: {
          agentId: { type: 'string' }
        },
        required: ['agentId']
      }
    }
  }, async (request, reply) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan('ai.agent.process');
    
    try {
      const { agentId } = request.params;
      const requestData = request.body || {};
      
      span.setAttributes({
        'agent.id': agentId,
        'agent.request_size': JSON.stringify(requestData).length
      });

      const result = await fastAPIClient.processAgentRequest(agentId, requestData);

      span.setAttributes({
        'agent.status': result.status
      });

      reply.send({
        success: true,
        data: result
      });

      span.setStatus({ code: 1 });
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      
      logger.error('Agent processing failed', { 
        agentId: request.params.agentId, 
        error: error.message 
      });
      
      reply.status(500).send({
        success: false,
        error: 'Agent processing failed',
        message: error.message
      });
    } finally {
      span.end();
    }
  });

  // FastAPI health check proxy
  fastify.get('/health', async (request, reply) => {
    try {
      const health = await fastAPIClient.healthCheck();
      reply.send({
        success: true,
        data: health
      });
    } catch (error) {
      reply.status(503).send({
        success: false,
        error: 'FastAPI service unavailable',
        message: error.message
      });
    }
  });

  // FastAPI metrics proxy
  fastify.get('/metrics', async (request, reply) => {
    try {
      const metrics = await fastAPIClient.getMetrics();
      reply.send({
        success: true,
        data: metrics
      });
    } catch (error) {
      reply.status(503).send({
        success: false,
        error: 'FastAPI metrics unavailable',
        message: error.message
      });
    }
  });

  logger.info('✅ AI/ML routes configured with FastAPI integration');
}