/**
 * 🚀 CARTRITA WORKFLOW API V1 - Phase B Implementation
 * 
 * Complete RESTful API for workflow management with:
 * - Full CRUD operations for workflows
 * - Advanced execution with Phase B features
 * - Real-time monitoring via Server-Sent Events
 * - Connector management and registry
 * - Execution history and analytics
 * - Dry run capabilities and testing
 */

import express from 'express';
import { EventEmitter } from 'events';
import db from '../db.js';
import authenticateToken from '../middleware/authenticateToken.js';
import WorkflowExecutionEngine from '../services/WorkflowExecutionEngine.js';
import ExpressionEngine from '../services/ExpressionEngine.js';
import ConnectorRegistryService from '../services/ConnectorRegistryService.js';

const router = express.Router();

// Initialize Phase B services
const workflowEngine = new WorkflowExecutionEngine();
const expressionEngine = new ExpressionEngine();
const connectorRegistry = new ConnectorRegistryService();

// Event emitter for real-time monitoring
const workflowEvents = new EventEmitter();

// Store active SSE connections
const sseConnections = new Map();

/**
 * WORKFLOW CRUD OPERATIONS
 */

// GET /api/v1/workflows - List workflows with advanced filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      category,
      is_template,
      status,
      page = 1,
      limit = 20,
      sort = 'updated_at',
      order = 'desc',
      search
    } = req.query;

    let whereClause = 'WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    // Add filters
    if (category) {
      whereClause += ` AND category = $${++paramCount}`;
      params.push(category);
    }

    if (is_template !== undefined) {
      whereClause += ` AND is_template = $${++paramCount}`;
      params.push(is_template === 'true');
    }

    if (status) {
      whereClause += ` AND status = $${++paramCount}`;
      params.push(status);
    }

    if (search) {
      whereClause += ` AND (name ILIKE $${++paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Pagination
    const offset = (page - 1) * limit;
    const orderClause = `ORDER BY ${sort} ${order.toUpperCase()}`;
    const limitClause = `LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    // Get workflows with execution stats
    const query = `
      SELECT 
        w.*,
        COUNT(we.id) as execution_count,
        MAX(we.started_at) as last_execution,
        AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))) as avg_execution_time
      FROM workflows w
      LEFT JOIN workflow_executions we ON w.id = we.workflow_id
      ${whereClause}
      GROUP BY w.id
      ${orderClause}
      ${limitClause}
    `;

    const result = await db.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM workflows ${whereClause}`;
    const countResult = await db.query(countQuery, params.slice(0, paramCount - 2));

    res.json({
      success: true,
      workflows: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      },
      filters: { category, is_template, status, search }
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error listing workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/workflows - Create new workflow
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      category,
      is_template = false,
      definition,
      tags = [],
      settings = {}
    } = req.body;

    if (!name || !definition) {
      return res.status(400).json({
        success: false,
        error: 'Name and definition are required'
      });
    }

    // Validate workflow definition
    const validation = await validateWorkflowDefinition(definition);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow definition',
        details: validation.errors
      });
    }

    const query = `
      INSERT INTO workflows (name, description, category, is_template, definition, tags, settings, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await db.query(query, [
      name,
      description,
      category,
      is_template,
      JSON.stringify(definition),
      JSON.stringify(tags),
      JSON.stringify(settings),
      userId
    ]);

    res.status(201).json({
      success: true,
      workflow: result.rows[0],
      validation
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error creating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/workflows/:id - Get workflow details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowId = req.params.id;

    const query = `
      SELECT 
        w.*,
        COUNT(we.id) as execution_count,
        MAX(we.started_at) as last_execution,
        AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))) as avg_execution_time,
        COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions
      FROM workflows w
      LEFT JOIN workflow_executions we ON w.id = we.workflow_id
      WHERE w.id = $1 AND w.user_id = $2
      GROUP BY w.id
    `;

    const result = await db.query(query, [workflowId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    const workflow = result.rows[0];
    
    // Parse JSON fields
    try {
      workflow.definition = JSON.parse(workflow.definition);
      workflow.tags = JSON.parse(workflow.tags);
      workflow.settings = JSON.parse(workflow.settings);
    } catch (parseError) {
      console.warn('[WorkflowAPI] Error parsing workflow JSON fields:', parseError);
    }

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error getting workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/v1/workflows/:id - Update workflow
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowId = req.params.id;
    const {
      name,
      description,
      category,
      is_template,
      definition,
      tags,
      settings,
      status
    } = req.body;

    // Verify ownership
    const ownership = await db.query(
      'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    // Validate definition if provided
    if (definition) {
      const validation = await validateWorkflowDefinition(definition);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid workflow definition',
          details: validation.errors
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (name !== undefined) {
      updates.push(`name = $${++paramCount}`);
      params.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${++paramCount}`);
      params.push(description);
    }

    if (category !== undefined) {
      updates.push(`category = $${++paramCount}`);
      params.push(category);
    }

    if (is_template !== undefined) {
      updates.push(`is_template = $${++paramCount}`);
      params.push(is_template);
    }

    if (definition !== undefined) {
      updates.push(`definition = $${++paramCount}`);
      params.push(JSON.stringify(definition));
    }

    if (tags !== undefined) {
      updates.push(`tags = $${++paramCount}`);
      params.push(JSON.stringify(tags));
    }

    if (settings !== undefined) {
      updates.push(`settings = $${++paramCount}`);
      params.push(JSON.stringify(settings));
    }

    if (status !== undefined) {
      updates.push(`status = $${++paramCount}`);
      params.push(status);
    }

    updates.push(`updated_at = NOW()`);
    params.push(workflowId, userId);

    const query = `
      UPDATE workflows
      SET ${updates.join(', ')}
      WHERE id = $${++paramCount} AND user_id = $${++paramCount}
      RETURNING *
    `;

    const result = await db.query(query, params);

    res.json({
      success: true,
      workflow: result.rows[0]
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error updating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/v1/workflows/:id - Delete workflow
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowId = req.params.id;

    const result = await db.query(
      'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING id',
      [workflowId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      message: 'Workflow deleted successfully',
      workflowId
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error deleting workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * WORKFLOW EXECUTION
 */

// POST /api/v1/workflows/:id/execute - Execute workflow with Phase B features
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowId = req.params.id;
    const {
      inputData = {},
      dryRun = false,
      realTimeMonitoring = true,
      executionOptions = {}
    } = req.body;

    // Get workflow definition
    const workflowQuery = await db.query(
      'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (workflowQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    const workflow = workflowQuery.rows[0];
    let definition;
    
    try {
      definition = JSON.parse(workflow.definition);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow definition format'
      });
    }

    // Execute workflow using Phase B engine
    const executionResult = await workflowEngine.executeWorkflow(
      { id: workflowId, ...definition },
      inputData,
      {
        dryRun,
        realTimeMonitoring,
        userId,
        ...executionOptions
      }
    );

    res.json({
      success: true,
      ...executionResult,
      workflow: {
        id: workflowId,
        name: workflow.name
      }
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error executing workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/workflows/:id/executions - Get execution history
router.get('/:id/executions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowId = req.params.id;
    const { page = 1, limit = 20, status } = req.query;

    // Verify workflow ownership
    const ownership = await db.query(
      'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (ownership.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    let whereClause = 'WHERE workflow_id = $1';
    const params = [workflowId];
    let paramCount = 1;

    if (status) {
      whereClause += ` AND status = $${++paramCount}`;
      params.push(status);
    }

    const offset = (page - 1) * limit;
    const query = `
      SELECT *
      FROM workflow_executions
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM workflow_executions ${whereClause}`,
      params.slice(0, paramCount - 2)
    );

    res.json({
      success: true,
      executions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error getting executions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/workflows/executions/:executionId/logs - Get execution logs
router.get('/executions/:executionId/logs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const executionId = req.params.executionId;
    const { level, page = 1, limit = 100 } = req.query;

    // Verify execution ownership through workflow
    const ownership = await db.query(`
      SELECT we.id
      FROM workflow_executions we
      JOIN workflows w ON we.workflow_id = w.id
      WHERE we.id = $1 AND w.user_id = $2
    `, [executionId, userId]);

    if (ownership.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    let whereClause = 'WHERE execution_id = $1';
    const params = [executionId];
    let paramCount = 1;

    if (level) {
      whereClause += ` AND level = $${++paramCount}`;
      params.push(level);
    }

    const offset = (page - 1) * limit;
    const query = `
      SELECT *
      FROM workflow_execution_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      logs: result.rows,
      executionId
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error getting execution logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * REAL-TIME MONITORING via Server-Sent Events
 */

// GET /api/v1/workflows/:id/monitor - Start real-time monitoring
router.get('/:id/monitor', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const workflowId = req.params.id;
  const connectionId = `${userId}-${workflowId}-${Date.now()}`;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    workflowId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Store connection
  sseConnections.set(connectionId, { res, userId, workflowId });

  // Setup event listeners
  const onExecutionStarted = (data) => {
    if (data.workflowId === workflowId) {
      res.write(`data: ${JSON.stringify({
        type: 'execution-started',
        ...data
      })}\n\n`);
    }
  };

  const onNodeStarted = (data) => {
    if (sseConnections.has(connectionId)) {
      res.write(`data: ${JSON.stringify({
        type: 'node-started',
        ...data
      })}\n\n`);
    }
  };

  const onNodeCompleted = (data) => {
    if (sseConnections.has(connectionId)) {
      res.write(`data: ${JSON.stringify({
        type: 'node-completed',
        ...data
      })}\n\n`);
    }
  };

  const onExecutionCompleted = (data) => {
    if (sseConnections.has(connectionId)) {
      res.write(`data: ${JSON.stringify({
        type: 'execution-completed',
        ...data
      })}\n\n`);
    }
  };

  // Register event listeners
  workflowEngine.on('executionStarted', onExecutionStarted);
  workflowEngine.on('nodeStarted', onNodeStarted);
  workflowEngine.on('nodeCompleted', onNodeCompleted);
  workflowEngine.on('executionCompleted', onExecutionCompleted);

  // Handle client disconnect
  req.on('close', () => {
    sseConnections.delete(connectionId);
    workflowEngine.off('executionStarted', onExecutionStarted);
    workflowEngine.off('nodeStarted', onNodeStarted);
    workflowEngine.off('nodeCompleted', onNodeCompleted);
    workflowEngine.off('executionCompleted', onExecutionCompleted);
  });

  // Keep connection alive
  const keepAlive = setInterval(() => {
    if (sseConnections.has(connectionId)) {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    } else {
      clearInterval(keepAlive);
    }
  }, 30000);
});

/**
 * CONNECTOR MANAGEMENT
 */

// GET /api/v1/workflows/connectors - List available connectors
router.get('/connectors', authenticateToken, (req, res) => {
  try {
    const { category } = req.query;
    
    let connectors;
    if (category) {
      connectors = connectorRegistry.getConnectorsByCategory(category);
    } else {
      connectors = connectorRegistry.getAllConnectors();
    }

    res.json({
      success: true,
      connectors,
      statistics: connectorRegistry.getConnectorStatistics()
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error listing connectors:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/workflows/connectors/:type - Get connector details
router.get('/connectors/:type', authenticateToken, (req, res) => {
  try {
    const connectorType = req.params.type;
    const connector = connectorRegistry.getConnector(connectorType);

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Connector not found'
      });
    }

    const statistics = connectorRegistry.getConnectorStatistics()[connectorType];

    res.json({
      success: true,
      connector: {
        type: connectorType,
        ...connector,
        statistics
      }
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error getting connector:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * EXPRESSION TESTING
 */

// POST /api/v1/workflows/test-expression - Test expression evaluation
router.post('/test-expression', authenticateToken, async (req, res) => {
  try {
    const { expression, variables = {}, template } = req.body;

    if (!expression && !template) {
      return res.status(400).json({
        success: false,
        error: 'Expression or template is required'
      });
    }

    let result;
    if (template) {
      result = await expressionEngine.evaluateTemplate(template, variables);
    } else {
      const testResult = await expressionEngine.testExpression(expression, variables);
      result = testResult;
    }

    res.json({
      success: true,
      result,
      variables,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error testing expression:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * WORKFLOW TEMPLATES
 */

// GET /api/v1/workflows/templates - Get workflow templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    
    let whereClause = 'WHERE is_template = true';
    const params = [];
    let paramCount = 0;

    if (category) {
      whereClause += ` AND category = $${++paramCount}`;
      params.push(category);
    }

    const query = `
      SELECT id, name, description, category, definition, tags, created_at, updated_at
      FROM workflows
      ${whereClause}
      ORDER BY updated_at DESC
    `;

    const result = await db.query(query, params);

    res.json({
      success: true,
      templates: result.rows.map(template => ({
        ...template,
        definition: JSON.parse(template.definition),
        tags: JSON.parse(template.tags)
      }))
    });
  } catch (error) {
    console.error('[WorkflowAPI] Error getting templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * HELPER FUNCTIONS
 */

async function validateWorkflowDefinition(definition) {
  const errors = [];

  if (!definition || typeof definition !== 'object') {
    errors.push('Definition must be an object');
    return { valid: false, errors };
  }

  if (!definition.nodes || !Array.isArray(definition.nodes)) {
    errors.push('Definition must contain nodes array');
  }

  if (definition.nodes) {
    for (const [index, node] of definition.nodes.entries()) {
      if (!node.id) {
        errors.push(`Node ${index} missing id`);
      }
      if (!node.type) {
        errors.push(`Node ${index} missing type`);
      }
      // Add more validation as needed
    }
  }

  return { valid: errors.length === 0, errors };
}

export default router;