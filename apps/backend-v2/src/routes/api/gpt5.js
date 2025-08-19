/**
 * GPT-5 Advanced Features Routes for Cartrita V2 (Fastify)
 * Provides access to verbosity control, freeform function calling, CFG support, minimal reasoning
 * Created: January 27, 2025
 */

import GPT5Service from '../../../../packages/backend/src/services/GPT5Service.js';
import { getOptimalModelForAgent, getAllAgentAssignments } from '../../../../packages/backend/src/config/gpt5-models.js';

let gpt5Service = null;

// Initialize service
const initializeService = async () => {
  if (!gpt5Service) {
    gpt5Service = new GPT5Service();
    await gpt5Service.initialize();
  }
};

export async function gpt5Router(fastify, options) {
  // GPT-5 Routes Plugin for Fastify
  
  /**
   * Generate text with GPT-5 advanced features
   * POST /api/v2/gpt5/generate
   */
  fastify.post('/generate', {
    schema: {
      description: 'Generate text with GPT-5 advanced features',
      tags: ['GPT-5'],
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' },
          model: { type: 'string', default: 'gpt-5' },
          verbosity: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
          reasoning: { type: 'string', enum: ['minimal', 'standard', 'high'], default: 'standard' },
          enableFreeformCalling: { type: 'boolean', default: false },
          cfgConstraints: { type: 'string' },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          maxTokens: { type: 'number', minimum: 1, maximum: 8000 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const {
        prompt,
        model = 'gpt-5',
        verbosity = 'medium',
        reasoning = 'standard',
        enableFreeformCalling = false,
        cfgConstraints = null,
        temperature = 0.7,
        maxTokens = null
      } = request.body;

      const userId = request.user?.id || request.headers['user-id'];

      const result = await gpt5Service.generateWithAdvancedFeatures(prompt, {
        model,
        verbosity,
        reasoning,
        enableFreeformCalling,
        cfgConstraints,
        temperature,
        maxTokens,
        userId
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      request.log.error('GPT-5 generation failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Generation failed',
        details: error.message
      };
    }
  });

  /**
   * Get verbosity-adjusted response
   * POST /api/v2/gpt5/verbosity
   */
  fastify.post('/verbosity', {
    schema: {
      description: 'Get verbosity-adjusted response',
      tags: ['GPT-5'],
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' },
          verbosity: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const { prompt, verbosity = 'medium', ...options } = request.body;

      const result = await gpt5Service.getVerbosityAdjustedResponse(prompt, verbosity, options);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      request.log.error('GPT-5 verbosity adjustment failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Verbosity adjustment failed',
        details: error.message
      };
    }
  });

  /**
   * Execute freeform function calling
   * POST /api/v2/gpt5/freeform
   */
  fastify.post('/freeform', {
    schema: {
      description: 'Execute freeform function calling',
      tags: ['GPT-5'],
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' },
          tools: { type: 'array', items: { type: 'object' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const { prompt, tools = [], ...options } = request.body;

      const result = await gpt5Service.executeFreeformFunctionCalling(prompt, {
        tools,
        ...options
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      request.log.error('GPT-5 freeform calling failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Freeform calling failed',
        details: error.message
      };
    }
  });

  /**
   * Generate with Context-Free Grammar constraints
   * POST /api/v2/gpt5/cfg
   */
  fastify.post('/cfg', {
    schema: {
      description: 'Generate with Context-Free Grammar constraints',
      tags: ['GPT-5'],
      body: {
        type: 'object',
        required: ['prompt', 'grammar'],
        properties: {
          prompt: { type: 'string' },
          grammar: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const { prompt, grammar, ...options } = request.body;

      const result = await gpt5Service.generateWithCFGConstraints(prompt, grammar, options);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      request.log.error('GPT-5 CFG generation failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'CFG generation failed',
        details: error.message
      };
    }
  });

  /**
   * Get minimal reasoning response for speed
   * POST /api/v2/gpt5/minimal
   */
  fastify.post('/minimal', {
    schema: {
      description: 'Get minimal reasoning response for speed',
      tags: ['GPT-5'],
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const { prompt, ...options } = request.body;

      const result = await gpt5Service.getMinimalReasoningResponse(prompt, options);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      request.log.error('GPT-5 minimal reasoning failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Minimal reasoning failed',
        details: error.message
      };
    }
  });

  /**
   * Get optimal model for agent
   * GET /api/v2/gpt5/models/:agentName
   */
  fastify.get('/models/:agentName', {
    schema: {
      description: 'Get optimal model configuration for agent',
      tags: ['GPT-5'],
      params: {
        type: 'object',
        properties: {
          agentName: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { agentName } = request.params;
      const modelConfig = getOptimalModelForAgent(agentName);

      return {
        success: true,
        data: {
          agent: agentName,
          ...modelConfig
        }
      };

    } catch (error) {
      request.log.error('Model retrieval failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Model retrieval failed',
        details: error.message
      };
    }
  });

  /**
   * Get all agent model assignments
   * GET /api/v2/gpt5/models
   */
  fastify.get('/models', {
    schema: {
      description: 'Get all agent model assignments',
      tags: ['GPT-5']
    }
  }, async (request, reply) => {
    try {
      const assignments = getAllAgentAssignments();

      return {
        success: true,
        data: assignments
      };

    } catch (error) {
      request.log.error('Model assignments retrieval failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Model assignments retrieval failed',
        details: error.message
      };
    }
  });

  /**
   * Get supported features for a model
   * GET /api/v2/gpt5/features/:model
   */
  fastify.get('/features/:model', {
    schema: {
      description: 'Get supported features for a model',
      tags: ['GPT-5'],
      params: {
        type: 'object',
        properties: {
          model: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const { model } = request.params;
      const features = gpt5Service.getSupportedFeatures(model);

      return {
        success: true,
        data: {
          model,
          features
        }
      };

    } catch (error) {
      request.log.error('Features retrieval failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Features retrieval failed',
        details: error.message
      };
    }
  });

  /**
   * Get GPT-5 service metrics
   * GET /api/v2/gpt5/metrics
   */
  fastify.get('/metrics', {
    schema: {
      description: 'Get GPT-5 service metrics',
      tags: ['GPT-5']
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const metrics = gpt5Service.getMetrics();

      return {
        success: true,
        data: metrics
      };

    } catch (error) {
      request.log.error('Metrics retrieval failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Metrics retrieval failed',
        details: error.message
      };
    }
  });

  /**
   * Health check endpoint
   * GET /api/v2/gpt5/health
   */
  fastify.get('/health', {
    schema: {
      description: 'GPT-5 service health check',
      tags: ['GPT-5']
    }
  }, async (request, reply) => {
    try {
      await initializeService();
      
      const isHealthy = gpt5Service.initialized;
      const metrics = gpt5Service.getMetrics();

      return {
        success: true,
        data: {
          healthy: isHealthy,
          initialized: gpt5Service.initialized,
          supportedModels: metrics.supportedModels,
          totalRequests: metrics.totalRequests,
          successfulRequests: metrics.successfulRequests,
          averageResponseTime: metrics.averageResponseTime
        }
      };

    } catch (error) {
      request.log.error('Health check failed', error);
      reply.status(500);
      return {
        success: false,
        error: 'Health check failed',
        details: error.message
      };
    }
  });

  console.log('✅ GPT-5 advanced features routes configured');
}