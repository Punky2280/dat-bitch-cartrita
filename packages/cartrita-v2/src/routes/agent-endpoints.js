/**
 * V2 Agent Management Endpoints
 * Advanced agent coordination, monitoring, and control
 */

import { logger } from '../core/logger.js';
import AdvancedMCPService from '../services/AdvancedMCPService.js';
import LangChainIntegrationService from '../services/LangChainIntegrationService.js';

export async function agentEndpoints(fastify, options) {
  let mcpService, langchainService;
  
  fastify.addHook('onReady', async () => {
    try {
      mcpService = fastify.services?.mcpService || new AdvancedMCPService();
      langchainService = fastify.services?.langchainService || new LangChainIntegrationService();
      
      if (!mcpService.initialized) await mcpService.initialize();
      if (!langchainService.initialized) await langchainService.initialize();
      
      fastify.log.info('✅ Agent endpoints services initialized');
    } catch (error) {
      fastify.log.error('❌ Failed to initialize agent services:', error);
    }
  });

  // GET /agents - List all available agents
  fastify.get('/agents', {
    schema: {
      tags: ['agents'],
      summary: 'List all available agents and their capabilities',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                agents: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string' },
                      capabilities: { type: 'array' },
                      status: { type: 'string' },
                      load: { type: 'number' },
                      metrics: { type: 'object' }
                    }
                  }
                },
                total: { type: 'number' },
                active: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const mcpStatus = mcpService?.getStatus() || {};
      const langchainStatus = langchainService?.getStatus() || {};
      
      // Combine agents from both services
      const mcpAgents = Array.from(mcpService?.agents?.entries() || []).map(([id, agent]) => ({
        id,
        name: agent.metadata?.name || `Agent ${id}`,
        role: agent.metadata?.role || 'mcp_agent',
        capabilities: agent.capabilities || [],
        status: agent.status || 'unknown',
        load: agent.load || 0,
        metrics: {
          messageCount: agent.metadata?.messageCount || 0,
          averageResponseTime: agent.metadata?.averageResponseTime || 0,
          errorCount: agent.metadata?.errorCount || 0
        },
        source: 'mcp'
      }));
      
      const langchainAgents = Array.from(langchainService?.agents?.entries() || []).map(([id, agent]) => ({
        id,
        name: agent.name || `Agent ${id}`,
        role: agent.role || 'langchain_agent',
        capabilities: agent.capabilities || [],
        status: 'active',
        load: 0,
        metrics: {
          invocations: 0,
          averageResponseTime: 0,
          successRate: 1.0
        },
        source: 'langchain'
      }));
      
      const allAgents = [...mcpAgents, ...langchainAgents];
      const activeAgents = allAgents.filter(agent => agent.status === 'active').length;
      
      return {
        success: true,
        data: {
          agents: allAgents,
          total: allAgents.length,
          active: activeAgents
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to list agents:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve agents'
      });
    }
  });

  // GET /agents/:agentId/status - Get specific agent status
  fastify.get('/agents/:agentId/status', {
    schema: {
      tags: ['agents'],
      summary: 'Get detailed status of a specific agent',
      params: {
        type: 'object',
        required: ['agentId'],
        properties: {
          agentId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { agentId } = request.params;
    
    try {
      // Check MCP service first
      const mcpAgent = mcpService?.agents?.get(agentId);
      if (mcpAgent) {
        return {
          success: true,
          data: {
            agent: {
              id: agentId,
              ...mcpAgent,
              source: 'mcp',
              uptime: Date.now() - new Date(mcpAgent.metadata?.registeredAt || 0).getTime()
            }
          }
        };
      }
      
      // Check LangChain service
      const langchainAgent = langchainService?.agents?.get(agentId);
      if (langchainAgent) {
        return {
          success: true,
          data: {
            agent: {
              id: agentId,
              ...langchainAgent,
              source: 'langchain',
              uptime: Date.now() - (langchainAgent.createdAt || Date.now())
            }
          }
        };
      }
      
      return reply.status(404).send({
        success: false,
        error: 'Agent not found'
      });
    } catch (error) {
      fastify.log.error(`❌ Failed to get agent status for ${agentId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve agent status'
      });
    }
  });

  // POST /agents/register - Register a new agent
  fastify.post('/agents/register', {
    schema: {
      tags: ['agents'],
      summary: 'Register a new agent with the system',
      security: [{ BearerAuth: [] }],
      body: {
        type: 'object',
        required: ['agentId', 'capabilities'],
        properties: {
          agentId: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
          serviceType: { type: 'string', enum: ['mcp', 'langchain'], default: 'mcp' }
        }
      }
    }
  }, async (request, reply) => {
    const { agentId, capabilities, metadata = {}, serviceType = 'mcp' } = request.body;
    
    try {
      let result;
      
      if (serviceType === 'mcp' && mcpService) {
        result = await mcpService.registerAgent(agentId, capabilities, metadata);
      } else if (serviceType === 'langchain' && langchainService) {
        // Create agent configuration for LangChain
        const agentConfig = {
          name: metadata.name || agentId,
          role: metadata.role || 'general',
          capabilities,
          model: metadata.model || 'gpt-4',
          temperature: metadata.temperature || 0.7,
          tools: metadata.tools || []
        };
        
        const agent = await langchainService.createAgent(agentId, agentConfig);
        langchainService.agents.set(agentId, agent);
        result = true;
      } else {
        throw new Error(`Service type '${serviceType}' not available`);
      }
      
      fastify.log.info('🤖 New agent registered', {
        agentId,
        serviceType,
        capabilities: capabilities.length
      });
      
      return {
        success: true,
        data: {
          agentId,
          registered: result,
          serviceType,
          capabilities: capabilities.length
        }
      };
    } catch (error) {
      fastify.log.error(`❌ Failed to register agent ${agentId}:`, error);
      return reply.status(500).send({
        success: false,
        error: `Failed to register agent: ${error.message}`
      });
    }
  });

  // POST /agents/:agentId/message - Send direct message to agent
  fastify.post('/agents/:agentId/message', {
    schema: {
      tags: ['agents'],
      summary: 'Send a direct message to a specific agent',
      params: {
        type: 'object',
        required: ['agentId'],
        properties: {
          agentId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          context: { type: 'object' },
          options: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { agentId } = request.params;
    const { message, context = {}, options = {} } = request.body;
    const startTime = Date.now();
    
    try {
      let response;
      
      // Try LangChain first
      const langchainAgent = langchainService?.agents?.get(agentId);
      if (langchainAgent) {
        response = await langchainService.invokeAgent(agentId, { message }, context);
      }
      // Fall back to MCP
      else if (mcpService?.agents?.has(agentId)) {
        response = await mcpService.sendMessage('system', agentId, { message, context }, {
          ...options,
          requiresResponse: true,
          timeout: options.timeout || 30000
        });
      } else {
        return reply.status(404).send({
          success: false,
          error: 'Agent not found'
        });
      }
      
      const processingTime = Date.now() - startTime;
      
      fastify.log.info('💬 Direct agent message processed', {
        agentId,
        messageLength: message.length,
        processingTime: `${processingTime}ms`
      });
      
      return {
        success: true,
        data: {
          response: response.content || response.response || response,
          agentId,
          processingTime
        }
      };
    } catch (error) {
      fastify.log.error(`❌ Failed to send message to agent ${agentId}:`, error);
      return reply.status(500).send({
        success: false,
        error: `Failed to communicate with agent: ${error.message}`
      });
    }
  });

  // GET /agents/metrics - System-wide agent metrics
  fastify.get('/agents/metrics', {
    schema: {
      tags: ['agents'],
      summary: 'Get comprehensive agent system metrics'
    }
  }, async (request, reply) => {
    try {
      const mcpMetrics = mcpService?.getStatus()?.performanceMetrics || {};
      const langchainMetrics = langchainService?.getStatus()?.metrics || {};
      
      return {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          mcp: {
            messagesProcessed: mcpMetrics.messagesProcessed || 0,
            averageLatency: mcpMetrics.averageLatency || 0,
            errorRate: mcpMetrics.errorRate || 0,
            agentUtilization: mcpMetrics.agentUtilization || {}
          },
          langchain: {
            workflowsExecuted: langchainMetrics.workflowsExecuted || 0,
            averageExecutionTime: langchainMetrics.averageExecutionTime || 0,
            successRate: langchainMetrics.successRate || 0,
            agentInvocations: langchainMetrics.agentInvocations || 0,
            toolUsages: langchainMetrics.toolUsages || 0
          },
          system: {
            totalAgents: (mcpService?.agents?.size || 0) + (langchainService?.agents?.size || 0),
            activeWorkflows: langchainService?.activeWorkflows?.size || 0,
            messageQueueSize: mcpService?.messageQueue?.length || 0
          }
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to get agent metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve metrics'
      });
    }
  });

  // POST /agents/broadcast - Broadcast message to multiple agents
  fastify.post('/agents/broadcast', {
    schema: {
      tags: ['agents'],
      summary: 'Broadcast a message to multiple agents',
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          targetAgents: { type: 'array', items: { type: 'string' } },
          targetCapabilities: { type: 'array', items: { type: 'string' } },
          context: { type: 'object' },
          options: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { 
      message, 
      targetAgents = [], 
      targetCapabilities = [], 
      context = {}, 
      options = {} 
    } = request.body;
    
    try {
      let selectedAgents = [];
      
      // Select agents based on IDs
      if (targetAgents.length > 0) {
        selectedAgents = targetAgents;
      }
      // Select agents based on capabilities
      else if (targetCapabilities.length > 0) {
        const mcpAgents = Array.from(mcpService?.agents?.entries() || [])
          .filter(([id, agent]) => 
            targetCapabilities.some(cap => agent.capabilities?.includes(cap))
          )
          .map(([id]) => id);
        
        const langchainAgents = Array.from(langchainService?.agents?.entries() || [])
          .filter(([id, agent]) => 
            targetCapabilities.some(cap => agent.capabilities?.includes(cap))
          )
          .map(([id]) => id);
        
        selectedAgents = [...mcpAgents, ...langchainAgents];
      }
      // Default to all agents
      else {
        const mcpAgentIds = Array.from(mcpService?.agents?.keys() || []);
        const langchainAgentIds = Array.from(langchainService?.agents?.keys() || []);
        selectedAgents = [...mcpAgentIds, ...langchainAgentIds];
      }
      
      // Send messages to all selected agents
      const promises = selectedAgents.map(async (agentId) => {
        try {
          // Try LangChain first
          if (langchainService?.agents?.has(agentId)) {
            const response = await langchainService.invokeAgent(agentId, { message }, context);
            return { agentId, success: true, response: response.content || response };
          }
          // Fall back to MCP
          else if (mcpService?.agents?.has(agentId)) {
            const response = await mcpService.sendMessage('system', agentId, { message, context }, {
              ...options,
              requiresResponse: true,
              timeout: 15000
            });
            return { agentId, success: true, response: response.response || response };
          }
          
          return { agentId, success: false, error: 'Agent not accessible' };
        } catch (error) {
          return { agentId, success: false, error: error.message };
        }
      });
      
      const results = await Promise.allSettled(promises);
      const responses = results.map(result => 
        result.status === 'fulfilled' ? result.value : 
        { agentId: 'unknown', success: false, error: result.reason }
      );
      
      const successCount = responses.filter(r => r.success).length;
      
      fastify.log.info('📢 Broadcast message processed', {
        totalAgents: selectedAgents.length,
        successCount,
        messageLength: message.length
      });
      
      return {
        success: true,
        data: {
          totalSent: selectedAgents.length,
          successCount,
          responses
        }
      };
    } catch (error) {
      fastify.log.error('❌ Failed to broadcast message:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to broadcast message'
      });
    }
  });

  logger.info('✅ Agent management endpoints registered');
}