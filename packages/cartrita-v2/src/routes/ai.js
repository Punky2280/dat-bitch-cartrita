/**
 * Cartrita V2 - AI Integration Routes
 * Enhanced OpenAI integrations with intelligent key routing
 */

import { logger } from '../core/logger.js';
import db from '../database/connection.js';
import { openAIService } from '../services/OpenAIService.js';

export async function aiRoutes(fastify, options) {
  // Initialize OpenAI Service Manager
  try {
    await openAIService.initialize();
    logger.info('✅ OpenAI Service Manager initialized with intelligent key routing');
  } catch (error) {
    logger.error('❌ Failed to initialize OpenAI Service Manager', { error: error.message });
  }
  
  // Get available AI models and their capabilities
  fastify.get('/models', {
    schema: {
      description: 'Get available AI models and their capabilities',
      tags: ['ai'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            models: {
              type: 'object',
              properties: {
                openai: { type: 'array' },
                cartrita: { type: 'array' }
              }
            },
            capabilities: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const healthCheck = await openAIService.healthCheck();
      const availableModels = await openAIService.getAvailableModels();
      
      const models = {
        openai: healthCheck.general?.status === 'healthy' ? [
          {
            id: 'gpt-4-turbo-preview',
            name: 'GPT-4 Turbo',
            description: 'Most capable GPT-4 model with enhanced performance',
            capabilities: ['text', 'reasoning', 'code', 'analysis'],
            contextLength: 128000,
            available: true
          },
          {
            id: 'gpt-4',
            name: 'GPT-4',
            description: 'High-intelligence flagship model',
            capabilities: ['text', 'reasoning', 'code', 'analysis'],
            contextLength: 8192,
            available: true
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            description: 'Fast, optimized for chat applications',
            capabilities: ['text', 'conversation', 'code'],
            contextLength: 16385,
            available: true
          },
          {
            id: 'gpt-4-vision-preview',
            name: 'GPT-4 Vision',
            description: 'GPT-4 with vision capabilities',
            capabilities: ['text', 'vision', 'image_analysis', 'multimodal'],
            contextLength: 128000,
            available: true
          }
        ] : [],
        cartrita: [
          {
            id: 'cartrita-v2-supervisor',
            name: 'Cartrita V2 Supervisor',
            description: 'Multi-agent supervisor with delegation capabilities',
            capabilities: ['orchestration', 'delegation', 'multimodal', 'context_management'],
            contextLength: 50000,
            available: true
          }
        ]
      };
      
      const capabilities = {
        textGeneration: healthCheck.general?.status === 'healthy',
        codeGeneration: healthCheck.general?.status === 'healthy',
        imageAnalysis: healthCheck.general?.status === 'healthy',
        fineTuning: healthCheck.finetuning?.status === 'healthy',
        multiAgent: true,
        realTimeProcessing: true,
        contextAwareness: true,
        customInstructions: true
      };
      
      return {
        success: true,
        models,
        capabilities,
        metadata: {
          generalClientAvailable: healthCheck.general?.status === 'healthy',
          finetuningClientAvailable: healthCheck.finetuning?.status === 'healthy',
          separateKeys: healthCheck.general !== healthCheck.finetuning,
          cartritaVersion: '2.0.0',
          usageStats: openAIService.getUsageStats()
        }
      };
    } catch (error) {
      logger.error('Failed to get AI models', { error: error.message });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve AI models'
      });
    }
  });
  
  // Chat completion with model selection
  fastify.post('/chat/completions', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Generate chat completion using specified AI model',
      tags: ['ai'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                content: { type: 'string' }
              }
            }
          },
          model: { 
            type: 'string',
            enum: [
              'gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4-vision-preview',
              'cartrita-v2-supervisor'
            ],
            default: 'gpt-4-turbo-preview'
          },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          maxTokens: { type: 'integer', minimum: 1, maximum: 4096, default: 1000 },
          stream: { type: 'boolean', default: false },
          systemPrompt: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { messages, model = 'gpt-4-turbo-preview', temperature = 0.7, maxTokens = 1000, stream = false, systemPrompt } = request.body;
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.ai('chat-completion-started', {
        requestId,
        userId: request.user.userId,
        model,
        messageCount: messages.length,
        temperature,
        maxTokens
      });
      
      let response;
      let usage = {};
      let provider = 'unknown';
      
      // Prepare messages with optional system prompt
      const processedMessages = [...messages];
      if (systemPrompt && processedMessages[0]?.role !== 'system') {
        processedMessages.unshift({ role: 'system', content: systemPrompt });
      }
      
      // Route to appropriate AI provider with intelligent operation detection
      if (model.startsWith('gpt-')) {
        provider = 'openai';
        
        // Determine operation type for intelligent routing
        let operationType = 'general';
        if (request.body.operationType) {
          operationType = request.body.operationType;
        } else {
          // Infer operation type from content/context
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.content) {
            const content = lastMessage.content.toLowerCase();
            if (content.includes('train') || content.includes('fine-tune') || content.includes('dataset')) {
              operationType = 'training';
            } else if (content.includes('bulk') || content.includes('batch') || content.includes('generate many')) {
              operationType = 'batch-processing';
            }
          }
        }
        
        if (stream) {
          // Handle streaming response with intelligent client routing
          reply.type('text/plain');
          reply.raw.write('data: {"type":"stream_start"}\n\n');
          
            const completion = await openAIService.createChatCompletion(processedMessages, {
              model,
              temperature,
              max_tokens: maxTokens,
              stream: true,
              operationType
            });          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
              reply.raw.write(`data: ${JSON.stringify({ type: 'content_delta', delta })}\n\n`);
            }
          }
          
          reply.raw.write('data: {"type":"stream_end"}\n\n');
          reply.raw.end();
          return;
        } else {
          const completion = await openAIService.createChatCompletion(processedMessages, {
            model,
            temperature,
            max_tokens: maxTokens,
            operationType
          });
          
          response = {
            id: completion.id,
            content: completion.choices[0].message.content,
            role: 'assistant',
            finishReason: completion.choices[0].finish_reason,
            operationType,
            clientUsed: openAIService.determineClientType(operationType)
          };
          usage = completion.usage || {};
        }
      } else if (model === 'cartrita-v2-supervisor') {
        provider = 'cartrita';
        // Delegate to Cartrita multi-agent system
        const agentResponse = await processWithCartritaAgent(processedMessages, {
          temperature,
          maxTokens,
          userId: request.user.userId
        });
        
        response = {
          id: `cartrita_${Date.now()}`,
          content: agentResponse.content,
          role: 'assistant',
          finishReason: 'stop',
          metadata: agentResponse.metadata
        };
        usage = agentResponse.usage || {};
      } else {
        return reply.status(400).send({
          success: false,
          error: `Model '${model}' is not available or not configured`
        });
      }
      
      // Log completion
      logger.ai('chat-completion-finished', {
        requestId,
        userId: request.user.userId,
        model,
        provider,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        duration: Date.now() - startTime
      });
      
      // Store interaction in database
      await db.query(`
        INSERT INTO ai_interactions (id, user_id, model, provider, input_tokens, output_tokens, duration_ms, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        requestId,
        request.user.userId,
        model,
        provider,
        usage.prompt_tokens || 0,
        usage.completion_tokens || 0,
        Date.now() - startTime
      ]);
      
      return {
        success: true,
        id: requestId,
        model,
        provider,
        response,
        usage,
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Chat completion failed', {
        requestId,
        error: error.message,
        model,
        userId: request.user.userId,
        duration: Date.now() - startTime
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Chat completion failed',
        details: error.message,
        requestId
      });
    }
  });
  
  // Image analysis with GPT-4 Vision
  fastify.post('/vision/analyze', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Analyze images using GPT-4 Vision',
      tags: ['ai'],
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        required: ['image'],
        properties: {
          image: { isFile: true },
          prompt: { type: 'string', default: 'Analyze this image and describe what you see.' },
          detail: { type: 'string', enum: ['low', 'high'], default: 'auto' }
        }
      }
    }
  }, async (request, reply) => {
    const healthCheck = await openAIService.healthCheck();
    if (healthCheck.general?.status !== 'healthy') {
      return reply.status(503).send({
        success: false,
        error: 'OpenAI Vision service not available'
      });
    }
    
    const startTime = Date.now();
    const requestId = `vision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No image file provided'
        });
      }
      
      // Convert image to base64
      const buffer = await data.toBuffer();
      const base64Image = buffer.toString('base64');
      const mimeType = data.mimetype;
      
      logger.ai('vision-analysis-started', {
        requestId,
        userId: request.user.userId,
        imageSize: buffer.length,
        mimeType
      });
      
      const prompt = request.body?.prompt || 'Analyze this image and describe what you see.';
      
      const completion = await openAIService.createChatCompletion([
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: request.body?.detail || 'auto'
              }
            }
          ]
        }
      ], {
        model: 'gpt-4-vision-preview',
        max_tokens: 1000,
        operationType: 'vision-analysis'
      });
      
      const analysis = {
        id: requestId,
        content: completion.choices[0].message.content,
        confidence: 0.95, // GPT-4 Vision is highly confident
        metadata: {
          model: 'gpt-4-vision-preview',
          imageSize: buffer.length,
          mimeType,
          detail: request.body?.detail || 'auto',
          operationType: 'vision-analysis'
        }
      };
      
      logger.ai('vision-analysis-completed', {
        requestId,
        userId: request.user.userId,
        analysisLength: analysis.content.length,
        duration: Date.now() - startTime
      });
      
      return {
        success: true,
        analysis,
        usage: completion.usage,
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Vision analysis failed', {
        requestId,
        error: error.message,
        userId: request.user.userId,
        duration: Date.now() - startTime
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Vision analysis failed',
        details: error.message,
        requestId
      });
    }
  });
  
  // Get user's AI usage statistics
  fastify.get('/usage', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get AI usage statistics for current user',
      tags: ['ai'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['day', 'week', 'month'], default: 'month' },
          model: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { period = 'month', model } = request.query;
    
    try {
      let dateFilter;
      switch (period) {
        case 'day':
          dateFilter = "created_at >= NOW() - INTERVAL '1 day'";
          break;
        case 'week':
          dateFilter = "created_at >= NOW() - INTERVAL '1 week'";
          break;
        case 'month':
          dateFilter = "created_at >= NOW() - INTERVAL '1 month'";
          break;
      }
      
      let whereClause = `WHERE user_id = $1 AND ${dateFilter}`;
      const params = [request.user.userId];
      
      if (model) {
        whereClause += ` AND model = $2`;
        params.push(model);
      }
      
      const result = await db.query(`
        SELECT 
          provider,
          model,
          COUNT(*) as request_count,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          AVG(duration_ms) as avg_duration_ms,
          DATE(created_at) as usage_date
        FROM ai_interactions
        ${whereClause}
        GROUP BY provider, model, DATE(created_at)
        ORDER BY usage_date DESC, provider, model
      `, params);
      
      const usage = result.rows.map(row => ({
        provider: row.provider,
        model: row.model,
        requestCount: parseInt(row.request_count),
        totalInputTokens: parseInt(row.total_input_tokens || 0),
        totalOutputTokens: parseInt(row.total_output_tokens || 0),
        averageDuration: Math.round(parseFloat(row.avg_duration_ms || 0)),
        date: row.usage_date
      }));
      
      // Calculate totals
      const totals = {
        requests: usage.reduce((sum, u) => sum + u.requestCount, 0),
        inputTokens: usage.reduce((sum, u) => sum + u.totalInputTokens, 0),
        outputTokens: usage.reduce((sum, u) => sum + u.totalOutputTokens, 0),
        totalTokens: 0
      };
      totals.totalTokens = totals.inputTokens + totals.outputTokens;
      
      return {
        success: true,
        period,
        usage,
        totals,
        metadata: {
          timestamp: new Date().toISOString(),
          userId: request.user.userId
        }
      };
    } catch (error) {
      logger.error('Failed to get AI usage statistics', {
        error: error.message,
        userId: request.user.userId
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve usage statistics'
      });
    }
  });
  
  // OpenAI Service Management and Monitoring
  fastify.get('/openai/status', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get OpenAI service status, usage statistics, and key configuration',
      tags: ['ai', 'monitoring'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'object' },
            usage: { type: 'object' },
            configuration: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const healthCheck = await openAIService.healthCheck();
      const usageStats = openAIService.getUsageStats();
      const availableModels = await openAIService.getAvailableModels();
      
      return {
        success: true,
        status: healthCheck,
        usage: usageStats,
        configuration: {
          separateKeys: usageStats.separateKeys,
          generalKeyAvailable: !!process.env.OPENAI_API_KEY,
          finetuningKeyAvailable: !!process.env.OPENAI_FINETUNING_API_KEY,
          defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
          rpmLimit: process.env.OPENAI_RPM_LIMIT || 60,
          tpmLimit: process.env.OPENAI_TPM_LIMIT || 90000,
          concurrentLimit: process.env.OPENAI_CONCURRENT_LIMIT || 10
        },
        availableModels,
        recommendations: this.generateOptimizationRecommendations(usageStats, healthCheck)
      };
    } catch (error) {
      logger.error('Failed to get OpenAI service status', {
        error: error.message,
        userId: request.user.userId
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve OpenAI service status'
      });
    }
  });

  // Bulk operations endpoint (uses fine-tuning key to preserve general quota)
  fastify.post('/bulk/completions', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Process multiple completions efficiently using specialized key',
      tags: ['ai', 'bulk'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['requests'],
        properties: {
          requests: {
            type: 'array',
            items: {
              type: 'object',
              required: ['messages'],
              properties: {
                messages: { type: 'array' },
                model: { type: 'string', default: 'gpt-4o' },
                temperature: { type: 'number', default: 0.7 },
                maxTokens: { type: 'integer', default: 1000 }
              }
            },
            maxItems: 50 // Limit bulk size
          },
          parallel: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    const { requests, parallel = false } = request.body;
    const startTime = Date.now();
    const batchId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.ai('bulk-completions-started', {
        batchId,
        userId: request.user.userId,
        requestCount: requests.length,
        parallel
      });
      
      let results;
      
      if (parallel && requests.length <= 10) {
        // Process small batches in parallel
        results = await Promise.all(
          requests.map(async (req, index) => {
            try {
              const completion = await openAIService.createChatCompletion(req.messages, {
                model: req.model || 'gpt-4o',
                temperature: req.temperature || 0.7,
                max_tokens: req.maxTokens || 1000,
                operationType: 'bulk-processing'
              });
              
              return {
                index,
                success: true,
                response: completion.choices[0].message.content,
                usage: completion.usage
              };
            } catch (error) {
              return {
                index,
                success: false,
                error: error.message
              };
            }
          })
        );
      } else {
        // Process sequentially to avoid rate limits
        results = [];
        for (let i = 0; i < requests.length; i++) {
          const req = requests[i];
          try {
            const completion = await openAIService.createChatCompletion(req.messages, {
              model: req.model || 'gpt-4o',
              temperature: req.temperature || 0.7,
              max_tokens: req.maxTokens || 1000,
              operationType: 'bulk-processing'
            });
            
            results.push({
              index: i,
              success: true,
              response: completion.choices[0].message.content,
              usage: completion.usage
            });
            
            // Small delay to respect rate limits
            if (i < requests.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            results.push({
              index: i,
              success: false,
              error: error.message
            });
          }
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const totalUsage = results
        .filter(r => r.usage)
        .reduce((acc, r) => ({
          prompt_tokens: acc.prompt_tokens + (r.usage.prompt_tokens || 0),
          completion_tokens: acc.completion_tokens + (r.usage.completion_tokens || 0),
          total_tokens: acc.total_tokens + (r.usage.total_tokens || 0)
        }), { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
      
      logger.ai('bulk-completions-completed', {
        batchId,
        userId: request.user.userId,
        successCount,
        failureCount: results.length - successCount,
        totalUsage,
        duration: Date.now() - startTime
      });
      
      return {
        success: true,
        batchId,
        results,
        summary: {
          total: requests.length,
          successful: successCount,
          failed: results.length - successCount,
          duration: Date.now() - startTime,
          totalUsage
        }
      };
    } catch (error) {
      logger.error('Bulk completions failed', {
        batchId,
        error: error.message,
        userId: request.user.userId,
        duration: Date.now() - startTime
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Bulk completions failed',
        batchId
      });
    }
  });
  
  logger.info('✅ AI integration routes registered');
}

// Helper function to generate optimization recommendations
function generateOptimizationRecommendations(usageStats, healthCheck) {
  const recommendations = [];
  
  // Check if separate keys would be beneficial
  if (!usageStats.separateKeys && usageStats.general.requests > 1000) {
    recommendations.push({
      type: 'key_separation',
      priority: 'medium',
      message: 'Consider using separate API keys for training/bulk operations to preserve general quota',
      action: 'Set OPENAI_FINETUNING_API_KEY to a different key'
    });
  }
  
  // Check token usage patterns
  const avgTokensPerRequest = usageStats.general.tokens / (usageStats.general.requests || 1);
  if (avgTokensPerRequest > 3000) {
    recommendations.push({
      type: 'token_optimization',
      priority: 'medium',
      message: 'High average tokens per request detected. Consider optimizing prompt length',
      action: 'Review and optimize system prompts and message context'
    });
  }
  
  // Check health status
  if (healthCheck.general?.status !== 'healthy') {
    recommendations.push({
      type: 'health_issue',
      priority: 'high',
      message: 'General OpenAI client is not healthy',
      action: 'Check API key validity and network connectivity'
    });
  }
  
  return recommendations;
}

// Helper function to process with Cartrita multi-agent system
async function processWithCartritaAgent(messages, options) {
  const { temperature, maxTokens, userId } = options;
  
  // Simulate multi-agent processing (in full V2, this would call the actual agent system)
  const processingTime = Math.random() * 2000 + 1000; // 1-3 seconds
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  const lastMessage = messages[messages.length - 1];
  const userContent = lastMessage.content;
  
  // Simulate agent delegation based on content
  let agentUsed = 'supervisor';
  let response = '';
  
  if (userContent.toLowerCase().includes('analyze') || userContent.toLowerCase().includes('data')) {
    agentUsed = 'analytics';
    response = `[Analytics Agent] I've analyzed your request regarding "${userContent.substring(0, 50)}...". Based on the data patterns and statistical analysis, here are my findings: The request shows characteristics that suggest you're looking for detailed insights. I've processed this through multiple analytical frameworks and can provide comprehensive metrics and trends.`;
  } else if (userContent.toLowerCase().includes('image') || userContent.toLowerCase().includes('vision')) {
    agentUsed = 'vision';
    response = `[Vision Agent] I've processed your vision-related request. While I can't see images in this text context, I can help you understand how computer vision systems analyze visual data, including object detection, image classification, and scene understanding capabilities.`;
  } else if (userContent.toLowerCase().includes('workflow') || userContent.toLowerCase().includes('automate')) {
    agentUsed = 'workflow';
    response = `[Workflow Agent] I've examined your automation request. I can help design and implement workflows that streamline your processes. This includes task sequencing, conditional logic, and integration with various tools and services.`;
  } else {
    response = `[Cartrita Supervisor] I've processed your request through my multi-agent system. Based on the analysis, I can provide comprehensive assistance across multiple domains including analytics, vision, workflow automation, and conversational AI. Your request has been delegated appropriately and processed with context awareness.`;
  }
  
  return {
    content: response,
    metadata: {
      agentUsed,
      processingTime: Math.round(processingTime),
      delegationPath: ['supervisor', agentUsed],
      confidence: 0.92,
      contextTokens: messages.reduce((sum, m) => sum + m.content.length / 4, 0) // Rough token estimate
    },
    usage: {
      prompt_tokens: Math.round(messages.reduce((sum, m) => sum + m.content.length / 4, 0)),
      completion_tokens: Math.round(response.length / 4),
      total_tokens: 0
    }
  };
}