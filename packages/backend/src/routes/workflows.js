import express from 'express';
const router = express.Router();
import db from '../db.js';
import authenticateToken from '../middleware/authenticateToken.js';
import EnhancedWorkflowEngine from '../services/EnhancedWorkflowEngine.js';
import WorkflowNodeRegistry from '../services/WorkflowNodeRegistry.js';
import EnhancedLangChainCoreAgent from '../agi/consciousness/EnhancedLangChainCoreAgent.js';

/**
 * WORKFLOW MANAGEMENT ROUTES
 *
 * These routes handle workflow creation, execution, and management
 * within the hierarchical multi-agent system.
 *
 * ENDPOINTS:
 * - GET /api/workflows - Get user's workflows with filtering
 * - POST /api/workflows - Create new workflow
 * - GET /api/workflows/:id - Get specific workflow details
 * - PUT /api/workflows/:id - Update workflow configuration
 * - DELETE /api/workflows/:id - Delete workflow
 * - POST /api/workflows/:id/execute - Execute workflow
 * - GET /api/workflows/:id/executions - Get workflow execution history
 * - GET /api/workflows/templates - Get workflow templates
 */

// Get user's workflows
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🚀 GET /workflows endpoint hit');

    const userId = req.user.id;
    const { category, is_template, status } = req.query;

    let query = 'SELECT * FROM workflows WHERE user_id = $1';
    const params = [userId];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    if (is_template !== undefined) {
      query += ` AND is_template = $${params.length + 1}`;
      params.push(is_template === 'true');
    }

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY updated_at DESC';

    const result = await db.query(query, params);

    console.log(`[WorkflowRoute] ✅ Found ${result.rows.length} workflows`);

    res.json({
      workflows: result.rows,
      count: result.rows.length,
      filters_applied: { category, is_template, status },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching workflows:', error);
    res.status(500).json({
      message: 'Failed to fetch workflows',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Initialize enhanced workflow engine and node registry
const workflowEngine = new EnhancedWorkflowEngine();
const nodeRegistry = new WorkflowNodeRegistry();

// Get available node types
router.get('/node-types', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;

    let nodes;
    if (category) {
      nodes = nodeRegistry.getNodesByCategory(category);
    } else {
      nodes = nodeRegistry.getAllNodes();
    }

    res.json({
      success: true,
      nodes,
      categories: nodeRegistry.getCategories(),
      total: nodes.length,
    });
  } catch (error) {
    console.error('[WorkflowRoute] Error fetching node types:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get node definition
router.get('/nodes/:nodeType', authenticateToken, async (req, res) => {
  try {
    const { nodeType } = req.params;
    const node = nodeRegistry.getNode(nodeType);

    if (!node) {
      return res.status(404).json({
        success: false,
        error: `Node type '${nodeType}' not found`,
      });
    }

    res.json({ success: true, node });
  } catch (error) {
    console.error('[WorkflowRoute] Error fetching node definition:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search nodes
router.get('/search-nodes', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }

    const results = nodeRegistry.searchNodes(q);

    res.json({
      success: true,
      results,
      query: q,
      total: results.length,
    });
  } catch (error) {
    console.error('[WorkflowRoute] Error searching nodes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new workflow
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🔄 POST /workflows endpoint hit');

    const userId = req.user.id;
    const { name, description, category, workflow_data, tags, is_template } =
      req.body;

    if (!name || !workflow_data) {
      return res.status(400).json({
        success: false,
        message: 'Name and workflow_data are required',
      });
    }

    // Validate workflow structure
    const { nodes = [], edges = [] } = workflow_data;

    // Validate nodes
    for (const node of nodes) {
      if (!node.id || !node.type) {
        return res.status(400).json({
          success: false,
          message: 'Each node must have id and type fields',
        });
      }

      // Validate node type exists
      const nodeDefinition = nodeRegistry.getNode(node.type);
      if (!nodeDefinition) {
        return res.status(400).json({
          success: false,
          message: `Unknown node type: ${node.type}`,
        });
      }

      // Validate node configuration
      const validation = nodeRegistry.validateNode(node.type, node.data);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: `Invalid configuration for node ${
            node.id
          }: ${validation.errors.join(', ')}`,
        });
      }
    }

    // Validate edges
    for (const edge of edges) {
      if (!edge.source || !edge.target) {
        return res.status(400).json({
          success: false,
          message: 'Each edge must have source and target',
        });
      }
    }

    const result = await db.query(
      `INSERT INTO workflows 
       (user_id, name, description, category, workflow_data, tags, is_template) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        userId,
        name,
        description,
        category || 'custom',
        JSON.stringify(workflow_data),
        tags || [],
        is_template || false,
      ]
    );

    console.log('[WorkflowRoute] ✅ Workflow created successfully');
    res.status(201).json({
      success: true,
      message: 'Workflow created successfully',
      workflow: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error creating workflow:', error);
    res.status(500).json({
      message: 'Failed to create workflow',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get specific workflow details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🚀 GET /workflows/:id endpoint hit');

    const userId = req.user.id;
    const workflowId = req.params.id;

    const result = await db.query(
      'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const workflow = result.rows[0];

    // Get execution history
    const executionsResult = await db.query(
      'SELECT * FROM workflow_executions WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT 10',
      [workflowId]
    );

    console.log('[WorkflowRoute] ✅ Workflow details retrieved');
    res.json({
      workflow: workflow,
      recent_executions: executionsResult.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching workflow details:', error);
    res.status(500).json({
      message: 'Failed to fetch workflow details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update workflow configuration
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🔄 PUT /workflows/:id endpoint hit');

    const userId = req.user.id;
    const workflowId = req.params.id;
    const { name, description, category, steps, triggers, variables, status } =
      req.body;

    // Check if workflow exists and belongs to user
    const existingResult = await db.query(
      'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Validate steps if provided
    if (steps && Array.isArray(steps)) {
      for (const step of steps) {
        if (!step.id || !step.type || !step.agent) {
          return res.status(400).json({
            message: 'Each step must have id, type, and agent fields',
          });
        }
      }
    }

    const result = await db.query(
      `UPDATE workflows 
       SET name = COALESCE($3, name),
           description = COALESCE($4, description),
           category = COALESCE($5, category),
           steps = COALESCE($6, steps),
           triggers = COALESCE($7, triggers),
           variables = COALESCE($8, variables),
           status = COALESCE($9, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [
        workflowId,
        userId,
        name,
        description,
        category,
        steps ? JSON.stringify(steps) : null,
        triggers ? JSON.stringify(triggers) : null,
        variables ? JSON.stringify(variables) : null,
        status,
      ]
    );

    console.log('[WorkflowRoute] ✅ Workflow updated successfully');
    res.json({
      message: 'Workflow updated successfully',
      workflow: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error updating workflow:', error);
    res.status(500).json({
      message: 'Failed to update workflow',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Delete workflow
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🗑️ DELETE /workflows/:id endpoint hit');

    const userId = req.user.id;
    const workflowId = req.params.id;

    const result = await db.query(
      'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING id, name',
      [workflowId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Also delete execution history
    await db.query('DELETE FROM workflow_executions WHERE workflow_id = $1', [
      workflowId,
    ]);

    console.log('[WorkflowRoute] ✅ Workflow deleted successfully');
    res.json({
      message: 'Workflow deleted successfully',
      deleted_workflow: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error deleting workflow:', error);
    res.status(500).json({
      message: 'Failed to delete workflow',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Execute workflow with enhanced engine
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] ⚡ POST /workflows/:id/execute endpoint hit');

    const userId = req.user.id;
    const workflowId = parseInt(req.params.id);
    const { input_data, trigger_type = 'manual' } = req.body;

    // Set core agent reference for the workflow engine
    if (!workflowEngine.coreAgent) {
      const coreAgent = new EnhancedLangChainCoreAgent();
      await coreAgent.initialize();
      workflowEngine.setCoreAgent(coreAgent);
    }

    // Execute workflow with enhanced engine
    const result = await workflowEngine.executeWorkflow(
      workflowId,
      userId,
      input_data || {},
      trigger_type
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Workflow executed successfully',
        execution_id: result.executionId,
        result: result.result,
        execution_time: result.executionTime,
        logs: result.logs,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Workflow execution failed',
        error: result.error,
        execution_id: result.executionId,
        execution_time: result.executionTime,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error executing workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute workflow',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
});

// Get workflow execution status
router.get(
  '/:id/execution/:executionId',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const workflowId = req.params.id;
      const executionId = req.params.executionId;

      const result = await db.query(
        `SELECT * FROM workflow_executions 
       WHERE id = $1 AND workflow_id = $2 AND user_id = $3`,
        [executionId, workflowId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Execution not found',
        });
      }

      res.json({
        success: true,
        execution: result.rows[0],
      });
    } catch (error) {
      console.error('[WorkflowRoute] Error fetching execution status:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Get workflow engine statistics
router.get('/engine/stats', authenticateToken, async (req, res) => {
  try {
    const stats = workflowEngine.getExecutionStats();
    const activeExecutions = workflowEngine.getActiveExecutions();

    res.json({
      success: true,
      engine_stats: stats,
      active_executions: activeExecutions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] Error fetching engine stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get workflow execution history
router.get('/:id/executions', authenticateToken, async (req, res) => {
  try {
    console.log(
      '[WorkflowRoute] 🚀 GET /workflows/:id/executions endpoint hit'
    );

    const userId = req.user.id;
    const workflowId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Verify workflow ownership
    const workflowResult = await db.query(
      'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const result = await db.query(
      `SELECT * FROM workflow_executions 
       WHERE workflow_id = $1 
       ORDER BY started_at DESC 
       LIMIT $2 OFFSET $3`,
      [workflowId, limit, offset]
    );

    console.log(
      `[WorkflowRoute] ✅ Retrieved ${result.rows.length} executions`
    );
    res.json({
      executions: result.rows,
      workflow_id: workflowId,
      pagination: {
        limit: limit,
        offset: offset,
        total: result.rows.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching executions:', error);
    res.status(500).json({
      message: 'Failed to fetch workflow executions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get workflow node types (available node types for workflow builder)
router.get('/node-types', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🧩 GET /workflows/node-types endpoint hit');

    // Define available node types for workflow builder
    const nodeTypes = [
      {
        id: 'start',
        name: 'Start',
        description: 'Entry point for workflow execution',
        category: 'flow',
        icon: 'play',
        inputs: [],
        outputs: ['next'],
        configurable: false,
      },
      {
        id: 'end',
        name: 'End',
        description: 'Exit point for workflow execution',
        category: 'flow',
        icon: 'stop',
        inputs: ['previous'],
        outputs: [],
        configurable: false,
      },
      {
        id: 'agent_task',
        name: 'Agent Task',
        description: 'Execute a task using a specific agent',
        category: 'agent',
        icon: 'bot',
        inputs: ['previous'],
        outputs: ['success', 'failure'],
        configurable: true,
        config_schema: {
          agent: {
            type: 'select',
            options: [
              'codewriter',
              'researcher',
              'artist',
              'writer',
              'scheduler',
              'taskmanager',
              'comedian',
              'analyst',
              'designer',
              'security',
            ],
          },
          task: { type: 'text', required: true },
          timeout: { type: 'number', default: 300 },
        },
      },
      {
        id: 'condition',
        name: 'Condition',
        description: 'Branch workflow based on conditions',
        category: 'logic',
        icon: 'branch',
        inputs: ['previous'],
        outputs: ['true', 'false'],
        configurable: true,
        config_schema: {
          condition: { type: 'text', required: true },
          variable: { type: 'text', required: true },
        },
      },
      {
        id: 'delay',
        name: 'Delay',
        description: 'Add a delay before continuing',
        category: 'utility',
        icon: 'clock',
        inputs: ['previous'],
        outputs: ['next'],
        configurable: true,
        config_schema: {
          duration: { type: 'number', required: true, min: 1 },
          unit: { type: 'select', options: ['seconds', 'minutes', 'hours'] },
        },
      },
      {
        id: 'variable_set',
        name: 'Set Variable',
        description: 'Set a workflow variable',
        category: 'data',
        icon: 'variable',
        inputs: ['previous'],
        outputs: ['next'],
        configurable: true,
        config_schema: {
          variable_name: { type: 'text', required: true },
          value: { type: 'text', required: true },
          type: { type: 'select', options: ['string', 'number', 'boolean'] },
        },
      },
      {
        id: 'http_request',
        name: 'HTTP Request',
        description: 'Make an HTTP request',
        category: 'integration',
        icon: 'globe',
        inputs: ['previous'],
        outputs: ['success', 'failure'],
        configurable: true,
        config_schema: {
          url: { type: 'url', required: true },
          method: { type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
          headers: { type: 'json' },
          body: { type: 'text' },
        },
      },
      {
        id: 'notification',
        name: 'Send Notification',
        description: 'Send a notification to the user',
        category: 'communication',
        icon: 'bell',
        inputs: ['previous'],
        outputs: ['next'],
        configurable: true,
        config_schema: {
          message: { type: 'text', required: true },
          type: {
            type: 'select',
            options: ['info', 'success', 'warning', 'error'],
          },
        },
      },
    ];

    console.log(`[WorkflowRoute] ✅ Retrieved ${nodeTypes.length} node types`);
    res.json({
      nodeTypes: nodeTypes,
      count: nodeTypes.length,
      categories: [...new Set(nodeTypes.map(n => n.category))],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching node types:', error);
    res.status(500).json({
      message: 'Failed to fetch workflow node types',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      nodeTypes: [],
    });
  }
});

// Get workflow templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🚀 GET /workflows/templates endpoint hit');

    const { category } = req.query;

    let query = 'SELECT * FROM workflows WHERE is_template = true';
    const params = [];

    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }

    query += ' ORDER BY name ASC';

    const result = await db.query(query, params);

    // If no templates found, provide default templates
    let templates = result.rows;
    if (templates.length === 0) {
      templates = [
        {
          id: 'template_1',
          name: 'Simple Research Workflow',
          description: 'Research a topic and generate a summary',
          category: 'research',
          steps: [
            { id: 'start', type: 'start', agent: 'system' },
            {
              id: 'research',
              type: 'agent_task',
              agent: 'researcher',
              config: { task: 'Research the provided topic' },
            },
            {
              id: 'summarize',
              type: 'agent_task',
              agent: 'writer',
              config: { task: 'Create a summary from research results' },
            },
            { id: 'end', type: 'end', agent: 'system' },
          ],
          triggers: [],
          variables: {},
          is_template: true,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'template_2',
          name: 'Code Review Workflow',
          description: 'Analyze code and provide feedback',
          category: 'development',
          steps: [
            { id: 'start', type: 'start', agent: 'system' },
            {
              id: 'analyze',
              type: 'agent_task',
              agent: 'codewriter',
              config: { task: 'Analyze the provided code' },
            },
            {
              id: 'security_check',
              type: 'agent_task',
              agent: 'security',
              config: { task: 'Check for security issues' },
            },
            {
              id: 'report',
              type: 'agent_task',
              agent: 'writer',
              config: { task: 'Generate code review report' },
            },
            { id: 'end', type: 'end', agent: 'system' },
          ],
          triggers: [],
          variables: {},
          is_template: true,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'template_3',
          name: 'Content Creation Workflow',
          description: 'Create and design content',
          category: 'creative',
          steps: [
            { id: 'start', type: 'start', agent: 'system' },
            {
              id: 'ideate',
              type: 'agent_task',
              agent: 'writer',
              config: { task: 'Generate content ideas' },
            },
            {
              id: 'design',
              type: 'agent_task',
              agent: 'designer',
              config: { task: 'Create visual design concepts' },
            },
            {
              id: 'create_art',
              type: 'agent_task',
              agent: 'artist',
              config: { task: 'Generate visual assets' },
            },
            {
              id: 'finalize',
              type: 'agent_task',
              agent: 'writer',
              config: { task: 'Finalize content' },
            },
            { id: 'end', type: 'end', agent: 'system' },
          ],
          triggers: [],
          variables: {},
          is_template: true,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Filter by category if provided
      if (category) {
        templates = templates.filter(t => t.category === category);
      }
    }

    console.log(`[WorkflowRoute] ✅ Retrieved ${templates.length} templates`);
    res.json({
      templates: templates,
      count: templates.length,
      category_filter: category,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching templates:', error);
    res.status(500).json({
      message: 'Failed to fetch workflow templates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
