/**
 * Cartrita V2 - Agents API Router
 * Enhanced agent management with the 15 sophisticated agents from rebuild plan
 * Integrates with Copilot's V2 backend structure
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import { AgentOrchestrator } from '../../agents/AgentOrchestrator.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
import { AgentCapabilities } from '../../agents/BaseCartritaAgent.js';

const router = express.Router();

// Initialize the Agent Orchestrator
const orchestrator = new AgentOrchestrator();

/**
 * GET /api/v2/agents
 * List all available agents with their capabilities and status
 */
router.get('/', async (req, res, next) => {
  try {
    const agents = await orchestrator.getAllAgents();
    const agentSummaries = agents.map(agent => ({
      id: agent.agentId,
      name: agent.agentName,
      type: agent.agentType,
      capability: agent.capability,
      state: agent.state,
      metrics: agent.getMetricsSummary(),
      personality: {
        voice: agent.personality.voice,
        confidence: agent.personality.confidence,
        sass_level: agent.personality.sass_level
      },
      description: getAgentDescription(agent.agentType)
    }));

    res.json({
      success: true,
      data: {
        agents: agentSummaries,
        total: agentSummaries.length,
        capabilities: Object.values(AgentCapabilities),
        orchestrator_status: orchestrator.getStatus()
      }
    });

    logger.info('Agents list requested', { 
      count: agentSummaries.length,
      requester: req.user?.id || 'anonymous'
    });

  } catch (error) {
    logger.error('Failed to list agents', error);
    next(error);
  }
});

/**
 * GET /api/v2/agents/:id
 * Get detailed information about a specific agent
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const agent = await orchestrator.getAgent(id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
        message: `No agent found with ID: ${id}`
      });
    }

    const detailedInfo = {
      ...agent.getMetricsSummary(),
      agentId: agent.agentId,
      agentName: agent.agentName,
      agentType: agent.agentType,
      capability: agent.capability,
      state: agent.state,
      personality: agent.personality,
      tools: Array.from(agent.toolRegistry.keys()),
      stateHistory: agent.stateHistory.slice(-10), // Last 10 state changes
      promptFramework: {
        contextWindow: agent.promptFramework.contextWindow,
        temperatureRange: agent.promptFramework.temperatureRange,
        maxTokens: agent.promptFramework.maxTokens,
        reasoningChains: agent.promptFramework.reasoningChains.map(chain => chain.name)
      },
      environment: agent.environment,
      description: getAgentDescription(agent.agentType),
      examples: getAgentExamples(agent.agentType)
    };

    res.json({
      success: true,
      data: detailedInfo
    });

  } catch (error) {
    logger.error('Failed to get agent details', error, { agentId: req.params.id });
    next(error);
  }
});

/**
 * POST /api/v2/agents/:id/chat
 * Send a message to a specific agent
 */
router.post('/:id/chat', 
  authenticateToken,
  validateRequest({
    body: {
      message: { type: 'string', required: true, minLength: 1 },
      context: { type: 'object', required: false },
      options: { type: 'object', required: false }
    }
  }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { message, context = {}, options = {} } = req.body;
      const userId = req.user.id;

      const agent = await orchestrator.getAgent(id);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
          message: `No agent found with ID: ${id}`
        });
      }

      // Prepare task request
      const taskRequest = {
        taskId: `chat_${Date.now()}_${userId}`,
        taskType: 'chat.conversation',
        parameters: {
          message,
          context: {
            ...context,
            userId,
            timestamp: new Date().toISOString(),
            userPreferences: req.user.preferences || {}
          },
          options: {
            include_reasoning: options.include_reasoning || false,
            max_tokens: options.max_tokens || agent.promptFramework.maxTokens,
            temperature: options.temperature || 0.7,
            ...options
          }
        }
      };

      // Execute task
      const response = await agent.executeTask(taskRequest);

      // Track conversation for WebSocket updates
      const io = req.app.get('io');
      if (io && userId) {
        io.to(`user_${userId}`).emit('agent_response', {
          agentId: id,
          agentName: agent.agentName,
          taskId: taskRequest.taskId,
          response: response.result,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: {
          agent: {
            id: agent.agentId,
            name: agent.agentName,
            type: agent.agentType,
            personality: agent.personality.voice
          },
          conversation: {
            taskId: taskRequest.taskId,
            message,
            response: response.result,
            metadata: response.metadata,
            reasoning: options.include_reasoning ? response.result.reasoning : undefined
          },
          metrics: response.metrics
        }
      });

      logger.info('Agent chat completed', {
        agentId: id,
        userId,
        taskId: taskRequest.taskId,
        success: response.status === 'completed',
        processingTime: response.metadata?.processingTime
      });

    } catch (error) {
      logger.error('Agent chat failed', error, { 
        agentId: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/v2/agents/:id/task
 * Execute a specialized task with a specific agent
 */
router.post('/:id/task',
  authenticateToken,
  validateRequest({
    body: {
      taskType: { type: 'string', required: true },
      parameters: { type: 'object', required: true },
      priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], required: false }
    }
  }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { taskType, parameters, priority = 'normal' } = req.body;
      const userId = req.user.id;

      const agent = await orchestrator.getAgent(id);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      const taskRequest = {
        taskId: `task_${Date.now()}_${userId}`,
        taskType,
        parameters: {
          ...parameters,
          userId,
          priority,
          timestamp: new Date().toISOString()
        }
      };

      const response = await agent.executeTask(taskRequest);

      res.json({
        success: response.status === 'completed',
        data: response
      });

      logger.info('Specialized task completed', {
        agentId: id,
        taskType,
        userId,
        taskId: taskRequest.taskId,
        success: response.status === 'completed'
      });

    } catch (error) {
      logger.error('Specialized task failed', error, {
        agentId: req.params.id,
        taskType: req.body.taskType
      });
      next(error);
    }
  }
);

/**
 * GET /api/v2/agents/:id/metrics
 * Get detailed metrics for a specific agent
 */
router.get('/:id/metrics', async (req, res, next) => {
  try {
    const { id } = req.params;
    const agent = await orchestrator.getAgent(id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const metrics = agent.getMetricsSummary();
    const detailedMetrics = {
      ...metrics,
      toolUsage: Object.fromEntries(agent.toolUsageMetrics),
      performance: {
        tasksPerMinute: metrics.tasksCompleted / (metrics.uptime / 60000),
        errorRate: metrics.tasksFailed / Math.max(metrics.tasksCompleted, 1),
        averageQuality: metrics.qualityScore,
        efficiency: metrics.successRate * (1 - (metrics.averageResponseTime / 10000))
      },
      personality: {
        voice: agent.personality.voice,
        traits: {
          confidence: agent.personality.confidence,
          sass_level: agent.personality.sass_level,
          helpfulness: agent.personality.helpfulness
        }
      }
    };

    res.json({
      success: true,
      data: detailedMetrics
    });

  } catch (error) {
    logger.error('Failed to get agent metrics', error);
    next(error);
  }
});

/**
 * POST /api/v2/agents/orchestrate
 * Execute a complex task that may require multiple agents (orchestration)
 */
router.post('/orchestrate',
  authenticateToken,
  validateRequest({
    body: {
      task: { type: 'string', required: true },
      requirements: { type: 'object', required: false },
      preferences: { type: 'object', required: false }
    }
  }),
  async (req, res, next) => {
    try {
      const { task, requirements = {}, preferences = {} } = req.body;
      const userId = req.user.id;

      const orchestrationResult = await orchestrator.orchestrateTask({
        task,
        requirements,
        preferences,
        userId,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        data: orchestrationResult
      });

      logger.info('Task orchestration completed', {
        userId,
        task: task.substring(0, 100),
        agentsInvolved: orchestrationResult.agentsUsed?.length || 0,
        success: orchestrationResult.status === 'completed'
      });

    } catch (error) {
      logger.error('Task orchestration failed', error);
      next(error);
    }
  }
);

/**
 * Helper functions for agent descriptions and examples
 */
function getAgentDescription(agentType) {
  const descriptions = {
    'CartritaCoreAgent': 'Primary interface with Miami street-smart personality. Handles conversation flow and delegates to specialists.',
    'CodeMaestroAgent': 'Full-stack development expert with architecture design and code review capabilities.',
    'DataScienceWizardAgent': 'Analytics and ML intelligence specialist for data processing and insights.',
    'CreativeDirectorAgent': 'Design and content excellence expert with brand consistency focus.',
    'ResearchIntelligenceAgent': 'Knowledge discovery specialist with multi-source research capabilities.',
    'ProductivityMasterAgent': 'Task and project management expert with workflow optimization.',
    'CommunicationExpertAgent': 'Multi-channel engagement specialist for messaging and presentations.',
    'SecurityGuardianAgent': 'Cybersecurity and privacy protection specialist.',
    'BusinessStrategyAgent': 'Market intelligence and strategic planning expert.',
    'AutomationArchitectAgent': 'Workflow and process optimization specialist.',
    'MultimodalFusionAgent': 'Unified experience orchestrator for multimedia content.',
    'PersonalizationExpertAgent': 'User experience customization and preference learning specialist.',
    'IntegrationMasterAgent': 'System connectivity and API integration expert.',
    'QualityAssuranceAgent': 'Excellence and standards guardian with testing capabilities.',
    'EmergencyResponseAgent': 'Crisis management and system recovery specialist.'
  };
  
  return descriptions[agentType] || 'Specialized AI agent with advanced capabilities.';
}

function getAgentExamples(agentType) {
  const examples = {
    'CartritaCoreAgent': [
      'Natural conversation management',
      'Task delegation to specialists',
      'Context preservation across interactions'
    ],
    'CodeMaestroAgent': [
      'Full-stack application development',
      'Code review and optimization',
      'Architecture design and planning'
    ],
    'DataScienceWizardAgent': [
      'Data analysis and visualization',
      'ML model development',
      'Statistical insights generation'
    ]
    // Add more examples as needed
  };
  
  return examples[agentType] || ['Specialized task execution', 'Expert-level analysis', 'Solution optimization'];
}

logger.info('✅ Agents API routes configured');

export { router as agentsRouter };