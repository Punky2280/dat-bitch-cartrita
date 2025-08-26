/**
 * @fileoverview MCP (Master Control Program) routes for the Cartrita Hierarchical Agent System.
 * @description Provides supervisor-level control and insight into the multi-agent architecture,
 * as described in the "Hierarchical Agent System" section of the README.md.
 */

import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import { mcpSystem } from '../mcp/mcp-integration.js';

const router = express.Router();

/**
 * @route   GET /api/mcp/agent-hierarchy
 * @desc    Get the current status and structure of the entire agent hierarchy.
 * @access  Private (Admin/Supervisor)
 */
router.get('/agent-hierarchy', authenticateToken, (req, res) => {
  console.log('[MCP] Fetching agent hierarchy status.');

  try {
    const mcpStatus = mcpSystem.getStatus();

    res.status(200).json({
      mcp_system: {
        initialized: mcpStatus.initialized,
        orchestrator: mcpStatus.orchestrator,
        supervisors: mcpStatus.supervisors,
      },
      hierarchy: {
        tier_0: {
          name: 'MCP Orchestrator',
          status: mcpStatus.orchestrator,
          role: 'Task routing and coordination',
        },
        tier_1: {
          intelligence_supervisor: {
            name: 'Intelligence Supervisor',
            status: mcpStatus.supervisors.intelligence.status,
            agents: mcpStatus.supervisors.intelligence.activeAgents || 0,
          },
          multimodal_supervisor: {
            name: 'MultiModal Supervisor',
            status: mcpStatus.supervisors.multimodal.status,
            capabilities:
              mcpStatus.supervisors.multimodal.multiModalCapabilities || [],
          },
        },
        tier_2: {
          supported_agents: [
            'WriterAgent',
            'CodeWriterAgent',
            'AnalyticsAgent',
            'ResearchAgent',
            'LangChainExecutor',
            'HuggingFaceLanguageAgent',
            'DeepgramAgent',
          ],
        },
      },
      supported_task_types: mcpStatus.supportedTaskTypes || [],
      message: mcpStatus.initialized
        ? 'MCP system is operational. All supervisors ready for tasks.'
        : 'MCP system initializing...',
    });
  } catch (error) {
    console.error('[MCP] Error fetching hierarchy:', error);
    res.status(500).json({
      error: 'Failed to fetch agent hierarchy',
      details: error.message,
    });
  }
});

/**
 * @route   POST /api/mcp/supervisor/override
 * @desc    Allow the Master Supervisor to execute a complex task directly, bypassing normal agent routing.
 * @access  Private (Admin/Supervisor Only)
 */
router.post('/supervisor/override', authenticateToken, async (req, res) => {
  const { task_description, task_type, parameters, priority } = req.body;

  if (!task_description && !task_type) {
    return res.status(400).json({
      error: 'Task description or task type is required.',
    });
  }

  try {
    console.log(
      `[MCP] SUPERVISOR OVERRIDE ACTIVATED. Task: ${task_description || task_type}`
    );

    const taskId = `override-${Date.now()}`;

    // Process task through MCP system
    const result = await mcpSystem.processTask(
      task_type || 'general.task',
      {
        description: task_description,
        priority: priority || 'high',
        override: true,
        ...parameters,
      },
      {
        userId: req.user?.id,
        sessionId: req.sessionID,
        isOverride: true,
      }
    );

    res.status(202).json({
      message: 'MCP Orchestrator handling supervisor override task.',
      task_id: taskId,
      status: 'ACCEPTED',
      mcp_result: result,
    });
  } catch (error) {
    console.error('[MCP] Supervisor override error:', error);
    res.status(500).json({
      error: 'Failed to process supervisor override',
      details: error.message,
    });
  }
});

/**
 * @route   GET /api/mcp/tool-registry
 * @desc    List all 40+ functional tools available across the entire system.
 * @access  Private
 */
router.get('/tool-registry', authenticateToken, (req, res) => {
  // TODO: Fetch the list of registered tools from the LangChain Tool Registry.
  console.log('[MCP] Fetching tool registry.');
  res.status(200).json({
    total_tools: 42, // Example count
    agents_and_tools: {
      ResearcherAgent: [
        'Tavily Search',
        'Wikipedia',
        'arXiv Search',
        'URL Scraper',
      ],
      CodeWriterAgent: ['AI Code Reviewer', 'GitHub Search', 'Calculator'],
      ArtistAgent: ['DALL-E 3', 'GPT-4 Vision'],
      SupervisorAgent: ['ALL_TOOLS_ACCESS'],
      // ... etc.
    },
    message: 'The whole toolbox. Ready to get to work.',
  });
});

/**
 * @route   POST /api/mcp/task
 * @desc    Process a task through the MCP system
 * @access  Private
 */
router.post('/task', authenticateToken, async (req, res) => {
  const { taskType, parameters } = req.body;

  if (!taskType) {
    return res.status(400).json({
      error: 'taskType is required',
    });
  }

  try {
    console.log(`[MCP] Processing task: ${taskType}`);

    const result = await mcpSystem.processTask(taskType, parameters, {
      userId: req.user?.id,
      sessionId: req.sessionID,
    });

    res.json(result);
  } catch (error) {
    console.error('[MCP] Task processing error:', error);
    res.status(500).json({
      error: 'Task processing failed',
      details: error.message,
    });
  }
});

/**
 * @route   GET /api/mcp/status
 * @desc    Get MCP system status
 * @access  Private
 */
router.get('/status', authenticateToken, (req, res) => {
  try {
    const status = mcpSystem.getStatus();
    res.json(status);
  } catch (error) {
    console.error('[MCP] Status error:', error);
    res.status(500).json({
      error: 'Failed to get MCP status',
      details: error.message,
    });
  }
});

/**
 * @route   GET /api/mcp/health
 * @desc    MCP health check
 * @access  Public
 */
router.get('/health', (req, res) => {
  try {
    const status = mcpSystem.getStatus();
    const isHealthy = status.initialized && status.orchestrator === 'active';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      ...status,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

export { router };
