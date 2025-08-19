/**
 * V2 AI Services Endpoints
 * Advanced AI capabilities including embeddings, completions, and specialized AI tools
 */

import { logger } from '../core/logger.js';
import AdvancedRAGService from '../services/AdvancedRAGService.js';

export async function aiServicesEndpoints(fastify, options) {
  let ragService;
  
  fastify.addHook('onReady', async () => {
    try {
      ragService = fastify.services?.ragService || new AdvancedRAGService();
      
      if (!ragService.initialized) await ragService.initialize();
      
      fastify.log.info('✅ AI services endpoints initialized');
    } catch (error) {
      fastify.log.error('❌ Failed to initialize AI services:', error);
    }
  });

  // POST /ai/embeddings - Generate embeddings for text
  fastify.post('/ai/embeddings', {
    schema: {
      tags: ['ai'],
      summary: 'Generate embeddings for text content',
      body: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 1 },
          model: { type: 'string', default: 'text-embedding-3-large' },
          dimensions: { type: 'number' },
          encoding_format: { type: 'string', enum: ['float', 'base64'], default: 'float' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                embedding: { type: 'array' },
                dimensions: { type: 'number' },
                model: { type: 'string' },
                usage: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { text, model = 'text-embedding-3-large', dimensions, encoding_format = 'float' } = request.body;
    const startTime = Date.now();
    
    try {
      if (!ragService?.embeddings) {
        throw new Error('Embeddings service not available');
      }
      
      const embedding = await ragService.embeddings.generateEmbedding(text, {
        model,
        dimensions,
        encoding_format
      });
      
      const processingTime = Date.now() - startTime;
      
      fastify.log.info('🧠 Embedding generated', {
        textLength: text.length,
        dimensions: embedding.length,
        model,
        processingTime: `${processingTime}ms`
      });
      
      return {
        success: true,
        data: {
          embedding,
          dimensions: embedding.length,
          model,
          usage: {
            prompt_tokens: Math.ceil(text.length / 4),
            total_tokens: Math.ceil(text.length / 4)
          },
          processingTime
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to generate embeddings:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate embeddings'
      });
    }
  });

  // POST /ai/completions - Generate AI text completions
  fastify.post('/ai/completions', {
    schema: {
      tags: ['ai'],
      summary: 'Generate AI text completions',
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string', minLength: 1 },
          model: { type: 'string', default: 'gpt-4' },
          max_tokens: { type: 'number', default: 500 },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          top_p: { type: 'number', minimum: 0, maximum: 1, default: 1 },
          frequency_penalty: { type: 'number', minimum: -2, maximum: 2, default: 0 },
          presence_penalty: { type: 'number', minimum: -2, maximum: 2, default: 0 },
          stop: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    const { 
      prompt, 
      model = 'gpt-4',
      max_tokens = 500,
      temperature = 0.7,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      stop = []
    } = request.body;
    
    const startTime = Date.now();
    
    try {
      if (!ragService?.openai) {
        throw new Error('OpenAI service not available');
      }
      
      const completion = await ragService.openai.createChatCompletion({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens,
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        stop: stop.length > 0 ? stop : undefined
      });
      
      const processingTime = Date.now() - startTime;
      
      fastify.log.info('💭 AI completion generated', {
        model,
        promptLength: prompt.length,
        responseLength: completion.choices[0].message.content.length,
        processingTime: `${processingTime}ms`
      });
      
      return {
        success: true,
        data: {
          completion: completion.choices[0].message.content,
          model,
          usage: completion.usage,
          processingTime,
          finish_reason: completion.choices[0].finish_reason
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to generate completion:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate completion'
      });
    }
  });

  // POST /ai/analyze - Analyze content with AI
  fastify.post('/ai/analyze', {
    schema: {
      tags: ['ai'],
      summary: 'Analyze content using AI',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1 },
          analysis_type: { 
            type: 'string', 
            enum: ['sentiment', 'entities', 'topics', 'summary', 'classification', 'comprehensive'],
            default: 'comprehensive'
          },
          options: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { content, analysis_type = 'comprehensive', options = {} } = request.body;
    const startTime = Date.now();
    
    try {
      const analysisPrompts = {
        sentiment: `Analyze the sentiment of the following text. Provide a sentiment score from -1 (very negative) to 1 (very positive) and explain your reasoning:\n\n${content}`,
        entities: `Extract and categorize all named entities from the following text:\n\n${content}`,
        topics: `Identify the main topics and themes in the following text:\n\n${content}`,
        summary: `Provide a concise summary of the following text:\n\n${content}`,
        classification: `Classify the following text into appropriate categories:\n\n${content}`,
        comprehensive: `Perform a comprehensive analysis of the following text including sentiment, entities, topics, and key insights:\n\n${content}`
      };
      
      const prompt = analysisPrompts[analysis_type];
      if (!prompt) {
        throw new Error(`Invalid analysis type: ${analysis_type}`);
      }
      
      if (!ragService?.openai) {
        throw new Error('OpenAI service not available');
      }
      
      const response = await ragService.openai.createChatCompletion({
        model: options.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content analyst. Provide detailed, accurate, and structured analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        max_tokens: options.max_tokens || 1000
      });
      
      const analysis = response.choices[0].message.content;
      const processingTime = Date.now() - startTime;
      
      // Try to parse structured data if comprehensive analysis
      let structuredAnalysis = {};
      if (analysis_type === 'comprehensive') {
        try {
          // Attempt to extract structured insights
          structuredAnalysis = {
            contentLength: content.length,
            wordCount: content.split(/\s+/).length,
            readabilityScore: calculateReadabilityScore(content),
            keyPhrases: extractKeyPhrases(content)
          };
        } catch (error) {
          // Continue with unstructured analysis
        }
      }
      
      fastify.log.info('🔍 Content analysis completed', {
        analysisType: analysis_type,
        contentLength: content.length,
        processingTime: `${processingTime}ms`
      });
      
      return {
        success: true,
        data: {
          analysis,
          analysisType: analysis_type,
          structuredData: structuredAnalysis,
          processingTime,
          usage: response.usage
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to analyze content:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to analyze content'
      });
    }
  });

  // POST /ai/knowledge/add - Add knowledge to RAG system
  fastify.post('/ai/knowledge/add', {
    schema: {
      tags: ['ai', 'knowledge'],
      summary: 'Add knowledge to the RAG system',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1 },
          metadata: { type: 'object' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          source: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { content, metadata = {}, category, tags = [], source } = request.body;
    
    try {
      if (!ragService) {
        throw new Error('RAG service not available');
      }
      
      const enrichedMetadata = {
        ...metadata,
        category,
        tags,
        source,
        addedAt: new Date().toISOString(),
        contentLength: content.length,
        wordCount: content.split(/\s+/).length
      };
      
      const knowledgeId = await ragService.addKnowledge(content, enrichedMetadata);
      
      fastify.log.info('📚 Knowledge added to RAG system', {
        knowledgeId,
        contentLength: content.length,
        category,
        tags: tags.length
      });
      
      return {
        success: true,
        data: {
          knowledgeId,
          content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          metadata: enrichedMetadata
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to add knowledge:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to add knowledge'
      });
    }
  });

  // POST /ai/knowledge/search - Search knowledge base
  fastify.post('/ai/knowledge/search', {
    schema: {
      tags: ['ai', 'knowledge'],
      summary: 'Search the knowledge base using RAG',
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          strategy: { 
            type: 'string',
            enum: ['semantic', 'hybrid', 'contextual', 'graph_based', 'multi_modal'],
            default: 'hybrid'
          },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
          threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
          context: { type: 'object' },
          filters: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { 
      query, 
      strategy = 'hybrid', 
      limit = 10, 
      threshold = 0.7, 
      context = {}, 
      filters = {} 
    } = request.body;
    
    const startTime = Date.now();
    
    try {
      if (!ragService) {
        throw new Error('RAG service not available');
      }
      
      const results = await ragService.retrieve(query, context, {
        strategy,
        limit,
        threshold,
        ...filters
      });
      
      const processingTime = Date.now() - startTime;
      
      fastify.log.info('🔍 Knowledge search completed', {
        query: query.substring(0, 50) + '...',
        strategy,
        resultsCount: results.length,
        processingTime: `${processingTime}ms`
      });
      
      return {
        success: true,
        data: {
          query,
          results: results.map(result => ({
            content: result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''),
            metadata: result.metadata,
            similarity: result.similarity || result.relevanceScore,
            retrievalMethod: result.retrievalMethod
          })),
          totalResults: results.length,
          strategy,
          processingTime
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to search knowledge:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to search knowledge'
      });
    }
  });

  // GET /ai/models - List available AI models
  fastify.get('/ai/models', {
    schema: {
      tags: ['ai'],
      summary: 'List all available AI models and their capabilities'
    }
  }, async (request, reply) => {
    try {
      const models = {
        completions: [
          {
            id: 'gpt-4',
            name: 'GPT-4',
            description: 'Most capable model for complex tasks',
            capabilities: ['text_generation', 'reasoning', 'coding', 'analysis'],
            maxTokens: 8192,
            pricing: { input: 0.03, output: 0.06 }
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            description: 'Fast and efficient for most tasks',
            capabilities: ['text_generation', 'conversation', 'summarization'],
            maxTokens: 4096,
            pricing: { input: 0.0015, output: 0.002 }
          }
        ],
        embeddings: [
          {
            id: 'text-embedding-3-large',
            name: 'Text Embedding 3 Large',
            description: 'Highest performance embedding model',
            dimensions: 3072,
            pricing: { input: 0.00013, output: 0 }
          },
          {
            id: 'text-embedding-3-small',
            name: 'Text Embedding 3 Small',
            description: 'Efficient embedding model',
            dimensions: 1536,
            pricing: { input: 0.00002, output: 0 }
          }
        ],
        specialized: [
          {
            id: 'cartrita-v2',
            name: 'Cartrita V2',
            description: 'Custom fine-tuned model with Miami personality',
            capabilities: ['conversation', 'personality', 'multi_agent', 'rag'],
            maxTokens: 8192,
            pricing: { input: 0.05, output: 0.1 }
          }
        ]
      };
      
      return {
        success: true,
        data: {
          models,
          totalModels: Object.values(models).flat().length,
          categories: Object.keys(models)
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to list models:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve models'
      });
    }
  });

  // GET /ai/status - AI services status
  fastify.get('/ai/status', {
    schema: {
      tags: ['ai'],
      summary: 'Get AI services status and health'
    }
  }, async (request, reply) => {
    try {
      const ragStatus = ragService?.getStatus() || {};
      
      return {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          services: {
            rag: {
              initialized: ragStatus.initialized || false,
              version: ragStatus.version || '0.0.0',
              knowledgeBaseSize: ragStatus.metrics?.knowledgeBaseSize || 0,
              cacheSize: ragStatus.cacheSize || 0,
              averageLatency: ragStatus.metrics?.averageLatency || 0
            },
            embeddings: {
              available: !!ragService?.embeddings,
              model: 'text-embedding-3-large'
            },
            completions: {
              available: !!ragService?.openai,
              defaultModel: 'gpt-4'
            }
          },
          capabilities: [
            'embeddings_generation',
            'semantic_search',
            'hybrid_retrieval',
            'knowledge_storage',
            'content_analysis',
            'ai_completions'
          ],
          health: ragStatus.initialized ? 'healthy' : 'initializing'
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to get AI status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve AI status'
      });
    }
  });

  logger.info('✅ AI services endpoints registered');
}

// Helper functions
function calculateReadabilityScore(text) {
  // Simple readability calculation (Flesch-Kincaid approximation)
  const sentences = text.split(/[.!?]+/).length;
  const words = text.split(/\s+/).length;
  const syllables = text.toLowerCase().match(/[aeiouy]+/g)?.length || words;
  
  const avgSentenceLength = words / sentences;
  const avgSyllablesPerWord = syllables / words;
  
  return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
}

function extractKeyPhrases(text) {
  // Simple key phrase extraction
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
}