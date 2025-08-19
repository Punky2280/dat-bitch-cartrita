/**
 * Enhanced Chat Routes - Sophisticated conversational interface with full V2 capabilities
 * Integrates all advanced systems: MCP, RAG, LangChain, Universal Prompt Engineering
 */

import { logger } from '../core/logger.js';
import AdvancedMCPService from '../services/AdvancedMCPService.js';
import AdvancedRAGService from '../services/AdvancedRAGService.js';
import LangChainIntegrationService from '../services/LangChainIntegrationService.js';

export async function enhancedChatRoutes(fastify, options) {
  // Initialize advanced services
  let mcpService, ragService, langchainService;
  
  fastify.addHook('onReady', async () => {
    try {
      mcpService = new AdvancedMCPService();
      ragService = new AdvancedRAGService();
      langchainService = new LangChainIntegrationService();
      
      await mcpService.initialize();
      await ragService.initialize();
      await langchainService.initialize();
      
      fastify.log.info('✅ Advanced chat services initialized');
    } catch (error) {
      fastify.log.error('❌ Failed to initialize chat services:', error);
    }
  });

  // POST /enhanced/chat - Enhanced main chat endpoint with full V2 capabilities
  fastify.post('/enhanced/chat', {
    schema: {
      tags: ['chat'],
      summary: 'Send a message to Cartrita with advanced AI capabilities',
      description: `
        Advanced chat endpoint featuring:
        - Sophisticated prompt engineering
        - Multi-agent coordination
        - RAG-enhanced responses
        - Context-aware conversations
        - Intelligent agent delegation
      `,
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 10000,
            description: 'The user message to process'
          },
          conversation_id: { 
            type: 'string',
            description: 'Unique conversation identifier for context tracking'
          },
          context: { 
            type: 'object',
            description: 'Additional context for enhanced processing',
            properties: {
              user_preferences: { type: 'object' },
              conversation_history: { type: 'array' },
              domain: { type: 'string' },
              urgency: { type: 'string', enum: ['low', 'normal', 'high'] }
            }
          },
          agent_preference: { 
            type: 'string',
            description: 'Preferred agent for handling this request'
          },
          options: {
            type: 'object',
            description: 'Advanced processing options',
            properties: {
              use_rag: { type: 'boolean', default: true },
              use_agent_delegation: { type: 'boolean', default: true },
              complexity_level: { type: 'string', enum: ['simple', 'medium', 'complex'] },
              response_style: { type: 'string', enum: ['concise', 'detailed', 'creative'] },
              enable_tools: { type: 'boolean', default: true }
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                response: { 
                  type: 'string',
                  description: 'Cartrita\'s response'
                },
                conversation_id: { type: 'string' },
                agent_used: { type: 'string' },
                processing_time: { type: 'number' },
                complexity_analysis: { type: 'object' },
                rag_sources: { type: 'array' },
                agent_coordination: { type: 'object' },
                cartrita_personality_score: { type: 'number' }
              }
            },
            metadata: {
              type: 'object',
              properties: {
                prompt_strategy: { type: 'string' },
                reasoning_chain: { type: 'array' },
                performance_metrics: { type: 'object' }
              }
            }
          }
        },
        400: { $ref: '#/components/schemas/ErrorResponse' },
        500: { $ref: '#/components/schemas/ErrorResponse' }
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    const correlationId = request.correlationId;
    
    try {
      const { 
        message, 
        conversation_id, 
        context = {}, 
        agent_preference, 
        options = {} 
      } = request.body;
      
      fastify.log.info('💬 Processing advanced chat request', {
        correlationId,
        messageLength: message.length,
        hasContext: Object.keys(context).length > 0,
        agentPreference: agent_preference,
        options
      });

      // Step 1: Generate sophisticated prompt using Universal Prompt System
      const promptSystem = fastify.services?.promptSystem;
      if (!promptSystem) {
        throw new Error('Universal Prompt System not available');
      }

      const sophisticatedPrompt = promptSystem.selectOptimalPrompt(
        message,
        { 
          personality: context.user_preferences?.personality || 'adaptive',
          expertLevel: context.user_preferences?.expertLevel || 'intermediate',
          history: context.conversation_history
        },
        {
          availableAgents: Array.from(fastify.agents?.keys() || []),
          errorRecovery: false
        }
      );

      // Step 2: Analyze message complexity and determine processing strategy
      const complexityAnalysis = analyzeMessageComplexity(message, context);
      
      // Step 3: RAG Enhancement (if enabled)
      let ragSources = [];
      if (options.use_rag !== false && ragService) {
        try {
          ragSources = await ragService.retrieve(message, context, {
            strategy: 'hybrid',
            limit: 5,
            threshold: 0.7
          });
          fastify.log.debug('🧠 RAG sources retrieved', { count: ragSources.length });
        } catch (error) {
          fastify.log.warn('⚠️ RAG retrieval failed, continuing without:', error.message);
        }
      }

      // Step 4: Determine if agent delegation is needed
      let agentCoordination = { strategy: 'direct', agents: ['cartrita_primary'] };
      
      if (options.use_agent_delegation !== false && complexityAnalysis.complexity === 'high') {
        agentCoordination = await determineAgentStrategy(
          message, 
          context, 
          complexityAnalysis,
          fastify.agents
        );
      }

      // Step 5: Execute the conversation based on strategy
      let response, agentUsed, reasoningChain = [];

      if (agentCoordination.strategy === 'workflow' && langchainService) {
        // Use LangChain workflow for complex multi-step processing
        const workflowResult = await langchainService.executeWorkflow(
          'complex_query_workflow',
          {
            query: message,
            context,
            rag_sources: ragSources,
            sophisticatedPrompt
          }
        );
        
        response = workflowResult.result.final_answer;
        agentUsed = 'langchain_workflow';
        reasoningChain = workflowResult.execution?.steps || [];
        
      } else if (agentCoordination.strategy === 'delegation' && mcpService) {
        // Use MCP for agent delegation
        const delegationResult = await mcpService.sendMessage(
          'cartrita_primary',
          agentCoordination.primaryAgent,
          {
            message,
            context,
            rag_sources: ragSources,
            sophisticatedPrompt
          },
          {
            requiresResponse: true,
            timeout: 60000,
            routingStrategy: 'capability_based'
          }
        );
        
        response = delegationResult.response;
        agentUsed = agentCoordination.primaryAgent;
        
      } else {
        // Direct processing with Cartrita primary agent
        const cartritaAgent = fastify.agents?.cartrita;
        if (!cartritaAgent) {
          throw new Error('Cartrita primary agent not available');
        }

        const enhancedContext = {
          ...context,
          rag_sources: ragSources,
          sophisticatedPrompt,
          complexity: complexityAnalysis
        };

        const agentResponse = await cartritaAgent.invoke({ message }, enhancedContext);
        response = agentResponse.content || agentResponse;
        agentUsed = 'cartrita_primary';
      }

      // Step 6: Apply Cartrita personality enhancement
      const personalityEnhancedResponse = await enhanceWithCartritaPersonality(
        response,
        message,
        context,
        complexityAnalysis
      );

      // Step 7: Calculate metrics and prepare response
      const processingTime = Date.now() - startTime;
      const conversationId = conversation_id || generateConversationId();

      // Calculate Cartrita personality score (how authentic the response feels)
      const personalityScore = calculatePersonalityScore(personalityEnhancedResponse);

      const responseData = {
        response: personalityEnhancedResponse,
        conversation_id: conversationId,
        agent_used: agentUsed,
        processing_time: processingTime,
        complexity_analysis: complexityAnalysis,
        rag_sources: ragSources.map(source => ({
          content: source.content.substring(0, 200) + '...',
          similarity: source.similarity,
          retrievalMethod: source.retrievalMethod
        })),
        agent_coordination: agentCoordination,
        cartrita_personality_score: personalityScore
      };

      const metadata = {
        prompt_strategy: sophisticatedPrompt ? 'universal_excellence' : 'standard',
        reasoning_chain: reasoningChain,
        performance_metrics: {
          rag_retrieval_time: ragSources.length > 0 ? 'included' : 'skipped',
          agent_delegation_time: agentCoordination.strategy !== 'direct' ? 'included' : 'skipped',
          total_processing_time: processingTime
        }
      };

      fastify.log.info('✅ Chat request processed successfully', {
        correlationId,
        agentUsed,
        processingTime: `${processingTime}ms`,
        complexity: complexityAnalysis.complexity,
        ragSources: ragSources.length,
        personalityScore
      });

      return {
        success: true,
        data: responseData,
        metadata
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      fastify.log.error('❌ Chat processing failed', {
        correlationId,
        error: error.message,
        stack: error.stack,
        processingTime
      });

      // Graceful degradation with Cartrita personality
      const fallbackResponse = await generateFallbackResponse(error, message);

      return reply.status(500).send({
        success: false,
        error: 'Chat processing failed',
        data: {
          response: fallbackResponse,
          agent_used: 'fallback_handler',
          processing_time: processingTime,
          error_handled: true
        },
        cartrita_note: "Something went sideways on my end, but I'm still here to help! 💪"
      });
    }
  });

  // GET /enhanced/status - Get enhanced chat service status and capabilities
  fastify.get('/enhanced/status', {
    schema: {
      tags: ['chat'],
      summary: 'Get enhanced chat service status and capabilities'
    }
  }, async (request, reply) => {
    return {
      success: true,
      data: {
        status: 'operational',
        version: '2.0.0-enhanced',
        capabilities: {
          universal_prompt_engineering: !!fastify.services?.promptSystem,
          advanced_rag: !!ragService,
          mcp_coordination: !!mcpService,
          langchain_workflows: !!langchainService,
          multi_agent_delegation: !!fastify.agents,
          personality_enhancement: true
        },
        agents: Object.keys(fastify.agents || {}),
        performance: {
          mcp_status: mcpService?.getStatus() || 'not_available',
          rag_status: ragService?.getStatus() || 'not_available',
          langchain_status: langchainService?.getStatus() || 'not_available'
        },
        cartrita_message: "I'm locked, loaded, and ready to dominate some conversations! 🚀"
      }
    };
  });

  // POST /enhanced/agent/:agentName - Direct agent invocation
  fastify.post('/enhanced/agent/:agentName', {
    schema: {
      tags: ['chat'],
      summary: 'Directly invoke a specific agent',
      params: {
        type: 'object',
        required: ['agentName'],
        properties: {
          agentName: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1 },
          context: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { agentName } = request.params;
    const { message, context = {} } = request.body;
    const startTime = Date.now();
    
    try {
      if (!langchainService) {
        throw new Error('LangChain service not available');
      }
      
      const result = await langchainService.invokeAgent(agentName, { message }, context);
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: {
          response: result.content || result,
          agent_used: agentName,
          processing_time: processingTime
        }
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: `Failed to invoke agent ${agentName}: ${error.message}`
      });
    }
  });

  // POST /enhanced/workflow/:workflowName - Execute LangChain workflow
  fastify.post('/enhanced/workflow/:workflowName', {
    schema: {
      tags: ['chat'],
      summary: 'Execute a specific LangChain workflow',
      params: {
        type: 'object',
        required: ['workflowName'],
        properties: {
          workflowName: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['input'],
        properties: {
          input: { type: 'object' },
          context: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { workflowName } = request.params;
    const { input, context = {} } = request.body;
    
    try {
      if (!langchainService) {
        throw new Error('LangChain service not available');
      }
      
      const result = await langchainService.executeWorkflow(workflowName, input, context);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: `Failed to execute workflow ${workflowName}: ${error.message}`
      });
    }
  });
}

/**
 * Utility functions for advanced chat processing
 */

function analyzeMessageComplexity(message, context) {
  let complexity = 'simple';
  let score = 1;
  let factors = [];

  // Length-based complexity
  if (message.length > 500) {
    score += 2;
    factors.push('long_message');
  } else if (message.length > 100) {
    score += 1;
    factors.push('medium_message');
  }

  // Content-based complexity
  const complexityPatterns = {
    'analyze': 2,
    'compare': 2,
    'explain': 1,
    'create': 2,
    'design': 2,
    'code': 2,
    'research': 2,
    'multiple steps': 3,
    'detailed': 1
  };

  const lowerMessage = message.toLowerCase();
  for (const [pattern, points] of Object.entries(complexityPatterns)) {
    if (lowerMessage.includes(pattern)) {
      score += points;
      factors.push(pattern);
    }
  }

  // Context-based complexity
  if (context.conversation_history?.length > 5) {
    score += 1;
    factors.push('long_conversation');
  }

  // Determine complexity level
  if (score >= 6) complexity = 'high';
  else if (score >= 3) complexity = 'medium';

  return {
    complexity,
    score,
    factors,
    reasoning: `Score: ${score}, Factors: ${factors.join(', ')}`
  };
}

async function determineAgentStrategy(message, context, complexityAnalysis, agents) {
  const lowerMessage = message.toLowerCase();
  
  // Determine if we need specialized agents
  if (lowerMessage.includes('code') || lowerMessage.includes('programming')) {
    return {
      strategy: 'delegation',
      primaryAgent: 'technical_agent',
      reason: 'Technical/coding content detected'
    };
  }
  
  if (lowerMessage.includes('research') || lowerMessage.includes('analyze')) {
    return {
      strategy: 'delegation', 
      primaryAgent: 'research_agent',
      reason: 'Research/analysis content detected'
    };
  }
  
  if (lowerMessage.includes('creative') || lowerMessage.includes('design')) {
    return {
      strategy: 'delegation',
      primaryAgent: 'creative_agent', 
      reason: 'Creative content detected'
    };
  }
  
  if (complexityAnalysis.complexity === 'high' && complexityAnalysis.factors.includes('multiple steps')) {
    return {
      strategy: 'workflow',
      workflow: 'complex_query_workflow',
      reason: 'Multi-step complex query detected'
    };
  }
  
  return {
    strategy: 'direct',
    agent: 'cartrita_primary',
    reason: 'Standard conversation'
  };
}

async function enhanceWithCartritaPersonality(response, originalMessage, context, complexityAnalysis) {
  // Add Cartrita's signature personality touches
  let enhanced = response;
  
  // Add personality based on complexity and context
  if (complexityAnalysis.complexity === 'high') {
    // For complex queries, show confidence
    if (!enhanced.toLowerCase().includes('alright') && !enhanced.toLowerCase().includes('let me')) {
      enhanced = `Alright, ${enhanced}`;
    }
  }
  
  // Add encouraging notes for challenging requests
  if (originalMessage.toLowerCase().includes('help') || originalMessage.toLowerCase().includes('difficult')) {
    if (!enhanced.includes('💪') && !enhanced.includes('🚀')) {
      enhanced = `${enhanced} We got this! 💪`;
    }
  }
  
  return enhanced;
}

function calculatePersonalityScore(response) {
  let score = 0.5; // Base score
  
  const personalityIndicators = [
    'alright', 'let me', 'we got this', 'i\'m gonna', 'that\'s what i\'m talking about',
    'no doubt', 'absolutely', 'for sure', 'you know what'
  ];
  
  const emojiIndicators = ['💪', '🚀', '🔥', '✨', '👌', '💯'];
  
  const lowerResponse = response.toLowerCase();
  
  // Check for personality language
  for (const indicator of personalityIndicators) {
    if (lowerResponse.includes(indicator)) {
      score += 0.1;
    }
  }
  
  // Check for emojis
  for (const emoji of emojiIndicators) {
    if (response.includes(emoji)) {
      score += 0.05;
    }
  }
  
  // Check for confidence and directness
  if (lowerResponse.includes('i can') || lowerResponse.includes('i\'ll')) {
    score += 0.1;
  }
  
  return Math.min(1.0, score);
}

async function generateFallbackResponse(error, originalMessage) {
  const fallbacks = [
    "Yo, something went sideways on my end, but I'm still here to help! What do you need?",
    "Had a little hiccup there, but I'm back! Let me try that again for you.",
    "My bad - hit a snag, but that's not gonna stop me from helping you out!",
    "Alright, ran into a technical issue, but I'm resilient like that. What can I do for you?"
  ];
  
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}