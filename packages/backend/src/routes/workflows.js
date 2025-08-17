import express from 'express';
const router = express.Router();
import db from '../db.js';
import authenticateToken from '../middleware/authenticateToken.js';
import EnhancedWorkflowEngine from '../services/EnhancedWorkflowEngine.js';
import WorkflowNodeRegistry from '../services/WorkflowNodeRegistry.js';
import EnhancedLangChainCoreAgent from '../agi/consciousness/EnhancedLangChainCoreAgent.js';
// Phase A imports
import PhaseAWorkflowRunner from '../services/PhaseAWorkflowRunner.js';
import workflowStreamer from '../services/WorkflowExecutionStreamer.js';

/**
 * WORKFLOW MANAGEMENT ROUTES - Enhanced with Phase A Features
 *
 * These routes handle workflow creation, execution, and management
 * within the hierarchical multi-agent system, now with Phase A
 * workflow automation platform capabilities.
 *
 * ENDPOINTS:
 * - GET /api/workflows - Get user's workflows with filtering
 * - POST /api/workflows - Create new workflow
 * - GET /api/workflows/:id - Get specific workflow details
 * - PUT /api/workflows/:id - Update workflow configuration
 * - DELETE /api/workflows/:id - Delete workflow
 * - POST /api/workflows/:id/execute - Execute workflow (Phase A)
 * - GET /api/workflows/:id/executions - Get workflow execution history
 * - GET /api/workflows/templates - Get workflow templates
 * - GET /api/workflows/stream/:executionId - SSE streaming endpoint
 * - POST /api/workflows/:id/validate - Validate workflow
 * - POST /api/workflows/:id/cancel - Cancel execution
 * - GET /api/workflows/node-types - Get available node types (Phase A)
 */

// Initialize engines
const legacyWorkflowEngine = new EnhancedWorkflowEngine();
const nodeRegistry = new WorkflowNodeRegistry();
const phaseARunner = new PhaseAWorkflowRunner(); // Phase A runner

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
      success: true,
      data: {
        workflows: result.rows,
        count: result.rows.length,
        filters_applied: { category, is_template, status },
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch workflows'
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
      `SELECT id, status, trigger_type, started_at, completed_at, execution_time_ms, error_message 
       FROM workflow_executions 
       WHERE workflow_id = $1 AND user_id = $2 
       ORDER BY started_at DESC LIMIT 10`,
      [workflowId, userId]
    );

    console.log('[WorkflowRoute] ✅ Workflow details retrieved');
    res.json({
      workflow: workflow,
      recent_executions: executionsResult.rows.map(r => ({
        id: r.id,
        status: r.status,
        trigger_type: r.trigger_type,
        started_at: r.started_at,
        completed_at: r.completed_at,
        execution_time_ms: r.execution_time_ms,
        error: r.error_message,
      })),
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

// Execute workflow with enhanced engine - Phase A Implementation
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] ⚡ POST /workflows/:id/execute endpoint hit (Phase A)');

    const userId = req.user.id;
    const workflowId = parseInt(req.params.id);
    const { input_data, trigger_type = 'manual', use_phase_a = true } = req.body;

    if (use_phase_a) {
      // Use Phase A workflow runner
      const result = await phaseARunner.executeWorkflow(
        workflowId,
        userId,
        input_data || {},
        trigger_type
      );

      return res.json(result);
    }

    // Legacy execution path (preserving existing functionality)
    const wf = await db.query('SELECT id FROM workflows WHERE id = $1 AND user_id = $2', [workflowId, userId]);
    if (wf.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Workflow not found or access denied'
      });
    }

    // Lazy initialize core agent for legacy engine
    if (!legacyWorkflowEngine.coreAgent) {
      const coreAgent = new EnhancedLangChainCoreAgent();
      await coreAgent.initialize();
      legacyWorkflowEngine.setCoreAgent(coreAgent);
    }

    // Kick off execution using legacy enhanced engine
    const execResult = await legacyWorkflowEngine.executeWorkflow(
      workflowId,
      userId,
      input_data || {},
      trigger_type
    );

    if (!execResult.success) {
      return res.status(500).json({
        success: false,
        error: execResult.error,
        execution_id: execResult.executionId,
        timestamp: new Date().toISOString(),
      });
    }

    // Basic simulation for legacy mode
    try {
      const statusRow = await db.query(
        'SELECT id, status, completed_at FROM workflow_executions WHERE workflow_id = $1 AND user_id = $2 ORDER BY started_at DESC LIMIT 1',
        [workflowId, userId]
      );
      if (statusRow.rows.length && statusRow.rows[0].status === 'running') {
        await db.query(
          'UPDATE workflow_executions SET status = $1, completed_at = NOW(), execution_time_ms = COALESCE(execution_time_ms, 0) WHERE id = $2',
          ['completed', statusRow.rows[0].id]
        );
      }
    } catch (simErr) {
      console.warn('[WorkflowRoute] Simulation completion step failed (non-blocking):', simErr.message);
    }

    res.json({
      success: true,
      data: {
        execution_id: execResult.executionId,
        result: execResult.result,
        execution_time: execResult.executionTime,
        logs: execResult.logs,
        legacy_mode: true
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error executing workflow:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// SSE Streaming endpoint for real-time workflow execution updates (Phase A)
router.get('/stream/:executionId', authenticateToken, async (req, res) => {
  try {
    const { executionId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this execution
    const execution = await db.query(
      'SELECT id FROM workflow_executions WHERE id = $1 AND user_id = $2',
      [executionId, userId]
    );

    if (execution.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found or access denied'
      });
    }

    // Create SSE connection
    const connectionId = workflowStreamer.createSSEConnection(req, res, executionId);
    
    console.log(`[WorkflowRoute] SSE connection created: ${connectionId} for execution: ${executionId}`);

  } catch (error) {
    console.error('[WorkflowRoute] Error creating SSE connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Validate workflow without executing (Phase A)
router.post('/:id/validate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowId = req.params.id;

    // Get workflow data
    const result = await db.query(
      'SELECT workflow_data FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found or access denied'
      });
    }

    const validation = phaseARunner.validateWorkflow(result.rows[0].workflow_data);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('[WorkflowRoute] Error validating workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel workflow execution (Phase A)
router.post('/:id/executions/:executionId/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { executionId } = req.params;

    const result = await phaseARunner.cancelExecution(executionId, userId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[WorkflowRoute] Error cancelling execution:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test node execution (Phase A)
router.post('/test-node', authenticateToken, async (req, res) => {
  try {
    const { nodeConfig, testContext = {} } = req.body;

    if (!nodeConfig || !nodeConfig.type) {
      return res.status(400).json({
        success: false,
        error: 'Node configuration with type is required'
      });
    }

    const result = await phaseARunner.testNode(nodeConfig, testContext);
    res.json(result);

  } catch (error) {
    console.error('[WorkflowRoute] Error testing node:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get workflow engine statistics (Phase A Enhanced)
router.get('/engine/stats', authenticateToken, async (req, res) => {
  try {
    const phaseAStats = phaseARunner.getExecutionStats();
    const legacyStats = legacyWorkflowEngine.getExecutionStats();
    const legacyActiveExecutions = legacyWorkflowEngine.getActiveExecutions();

    res.json({
      success: true,
      data: {
        phaseA: phaseAStats,
        legacy: {
          stats: legacyStats,
          activeExecutions: legacyActiveExecutions
        },
        timestamp: new Date().toISOString(),
      }
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
  const { status, trigger_type, since, until, latency_bucket } = req.query;

    // Verify workflow ownership
    const workflowResult = await db.query(
      'SELECT id FROM workflows WHERE id = $1 AND user_id = $2',
      [workflowId, userId]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Dynamic filters
    const filters = ['workflow_id = $1', 'user_id = $2'];
    const params = [workflowId, userId];
    let pIndex = params.length;
    if (status) {
      pIndex += 1; filters.push(`status = $${pIndex}`); params.push(status);
    }
    if (trigger_type) {
      pIndex += 1; filters.push(`trigger_type = $${pIndex}`); params.push(trigger_type);
    }
    if (latency_bucket) {
      pIndex += 1; filters.push(`latency_bucket = $${pIndex}`); params.push(latency_bucket);
    }
    if (since) {
      pIndex += 1; filters.push(`started_at >= $${pIndex}`); params.push(new Date(since));
    }
    if (until) {
      pIndex += 1; filters.push(`started_at <= $${pIndex}`); params.push(new Date(until));
    }

    pIndex += 1; params.push(limit);
    pIndex += 1; params.push(offset);

    const sql = `SELECT id, workflow_id, user_id, status, trigger_type, started_at, completed_at, execution_time_ms, error_message, input_data, output_data, node_count, success_node_count, failed_node_count, latency_bucket 
                 FROM workflow_executions
                 WHERE ${filters.join(' AND ')}
                 ORDER BY started_at DESC
                 LIMIT $${pIndex-1} OFFSET $${pIndex}`;

    const result = await db.query(sql, params);

    console.log(
      `[WorkflowRoute] ✅ Retrieved ${result.rows.length} executions`
    );
    res.json({
      executions: result.rows.map(r => ({
        id: r.id,
        workflow_id: r.workflow_id,
        status: r.status,
        trigger_type: r.trigger_type,
        started_at: r.started_at,
        completed_at: r.completed_at,
        execution_time_ms: r.execution_time_ms,
        error: r.error_message,
      })),
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

// Aggregate execution stats
router.get('/:id/executions/aggregate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowId = req.params.id;
    const { since, until } = req.query;

    // Ownership check
    const wf = await db.query('SELECT id FROM workflows WHERE id = $1 AND user_id = $2', [workflowId, userId]);
    if (wf.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    const filters = ['workflow_id = $1', 'user_id = $2'];
    const params = [workflowId, userId];
    let idx = 2;
    if (since) { idx += 1; filters.push(`started_at >= $${idx}`); params.push(new Date(since)); }
    if (until) { idx += 1; filters.push(`started_at <= $${idx}`); params.push(new Date(until)); }

    const baseWhere = filters.join(' AND ');

    const statusSql = `SELECT status, COUNT(*)::int AS count FROM workflow_executions WHERE ${baseWhere} GROUP BY status`;
    const durationSql = `SELECT AVG(execution_time_ms)::float AS avg_ms FROM workflow_executions WHERE ${baseWhere} AND execution_time_ms IS NOT NULL`;
    const latencySql = `SELECT latency_bucket, COUNT(*)::int AS count FROM workflow_executions WHERE ${baseWhere} AND latency_bucket IS NOT NULL GROUP BY latency_bucket`;

    const [statusResult, durationResult, latencyResult] = await Promise.all([
      db.query(statusSql, params),
      db.query(durationSql, params),
      db.query(latencySql, params),
    ]);

    res.json({
      success: true,
      workflow_id: workflowId,
      status_counts: statusResult.rows.reduce((acc, r) => { acc[r.status] = r.count; return acc; }, {}),
      average_duration_ms: durationResult.rows[0]?.avg_ms || null,
      latency_histogram: latencyResult.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] Error aggregate executions:', error);
    res.status(500).json({ success: false, message: 'Failed to compute aggregates', error: process.env.NODE_ENV==='development'? error.message: undefined });
  }
});

// Time-series execution metrics (fixed interval buckets)
router.get('/:id/executions/timeseries', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const workflowId = req.params.id;
    const { since, until, interval } = req.query;

    // Ownership check
    const wf = await db.query('SELECT id FROM workflows WHERE id = $1 AND user_id = $2', [workflowId, userId]);
    if (wf.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    // Determine time range
    const endTs = until ? new Date(until) : new Date();
    const startTs = since ? new Date(since) : new Date(endTs.getTime() - 6 * 60 * 60 * 1000); // default last 6h

    if (isNaN(startTs) || isNaN(endTs) || startTs >= endTs) {
      return res.status(400).json({ success: false, message: 'Invalid since/until range' });
    }

    // Interval parsing (supports: 1m,5m,15m,1h)
    const intervalMap = { '1m': 60_000, '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 60 * 60_000 };
    const intervalKey = interval && intervalMap[interval] ? interval : '5m';
    const stepMs = intervalMap[intervalKey];

    const bucketCount = Math.ceil((endTs - startTs) / stepMs);
    if (bucketCount > 2000) {
      return res.status(400).json({ success: false, message: 'Requested range produces too many buckets' });
    }

    // Fetch executions in range
    const execs = await db.query(
      `SELECT started_at, status, execution_time_ms FROM workflow_executions
       WHERE workflow_id = $1 AND user_id = $2 AND started_at >= $3 AND started_at <= $4`,
      [workflowId, userId, startTs, endTs]
    );

    // Initialize buckets
    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = new Date(startTs.getTime() + i * stepMs);
      const bucketEnd = new Date(Math.min(startTs.getTime() + (i + 1) * stepMs, endTs.getTime()));
      buckets.push({
        start: bucketStart.toISOString(),
        end: bucketEnd.toISOString(),
        count: 0,
        completed: 0,
        failed: 0,
        running: 0,
        avg_duration_ms: null,
        p50_duration_ms: null,
        p95_duration_ms: null,
        durations: [], // internal aggregation, removed in response
      });
    }

    // Assign executions to buckets
    for (const row of execs.rows) {
      const ts = new Date(row.started_at).getTime();
      const index = Math.min(Math.floor((ts - startTs.getTime()) / stepMs), bucketCount - 1);
      if (index < 0 || index >= buckets.length) continue;
      const b = buckets[index];
      b.count += 1;
      if (row.status === 'completed') {
        b.completed += 1; if (row.execution_time_ms != null) b.durations.push(row.execution_time_ms);
      } else if (row.status === 'failed') {
        b.failed += 1; if (row.execution_time_ms != null) b.durations.push(row.execution_time_ms);
      } else if (row.status === 'running') {
        b.running += 1;
      }
    }

    // Compute aggregates per bucket
    for (const b of buckets) {
      if (b.durations.length) {
        const sorted = b.durations.slice().sort((a, z) => a - z);
        const sum = sorted.reduce((acc, v) => acc + v, 0);
        b.avg_duration_ms = Math.round(sum / sorted.length);
        const p50Idx = Math.floor(sorted.length * 0.5);
        const p95Idx = Math.floor(sorted.length * 0.95);
        b.p50_duration_ms = sorted[p50Idx] || sorted[sorted.length - 1];
        b.p95_duration_ms = sorted[p95Idx] || sorted[sorted.length - 1];
      }
      delete b.durations;
    }

    res.json({
      success: true,
      workflow_id: workflowId,
      interval: intervalKey,
      range: { since: startTs.toISOString(), until: endTs.toISOString() },
      buckets,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] Error timeseries executions:', error);
    res.status(500).json({ success: false, message: 'Failed to compute timeseries', error: process.env.NODE_ENV==='development'? error.message: undefined });
  }
});

// Get workflow node types (Phase A Enhanced)
router.get('/node-types', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🧩 GET /workflows/node-types endpoint hit (Phase A)');

    // Phase A node types - four foundational types
    const phaseANodeTypes = [
      {
        id: 'transform',
        name: 'Transform',
        description: 'Data manipulation and processing with advanced transformations',
        category: 'data',
        icon: '🔄',
        inputs: ['input'],
        outputs: ['output'],
        configurable: true,
        config_schema: {
          input: { type: 'text', default: 'input', description: 'Input data path' },
          transformations: {
            type: 'array',
            items: {
              type: { type: 'select', options: ['map', 'filter', 'extract', 'format'] },
              config: { type: 'object' }
            },
            description: 'Array of transformations to apply'
          },
          outputField: { type: 'text', default: 'output', description: 'Output field name' }
        },
        phaseA: true
      },
      {
        id: 'http-request',
        name: 'HTTP Request',
        description: 'External API integration with retry logic and error handling',
        category: 'integration',
        icon: '🌐',
        inputs: ['previous'],
        outputs: ['success', 'failure'],
        configurable: true,
        config_schema: {
          method: { type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
          url: { type: 'url', required: true, description: 'API endpoint URL (supports templates)' },
          headers: { type: 'object', description: 'HTTP headers' },
          body: { type: 'text', description: 'Request body (for POST/PUT/PATCH)' },
          timeout: { type: 'number', default: 10000, description: 'Timeout in milliseconds' },
          retries: { type: 'number', default: 0, description: 'Number of retry attempts' },
          responseType: { type: 'select', options: ['json', 'text'], default: 'json' }
        },
        phaseA: true
      },
      {
        id: 'delay',
        name: 'Delay',
        description: 'Workflow timing and scheduling control with conditional waits',
        category: 'utility',
        icon: '⏰',
        inputs: ['previous'],
        outputs: ['next'],
        configurable: true,
        config_schema: {
          duration: { type: 'number', required: true, min: 1, description: 'Delay duration' },
          unit: { type: 'select', options: ['milliseconds', 'seconds', 'minutes', 'hours'], default: 'seconds' },
          condition: { type: 'text', description: 'Optional condition to wait for (template)' },
          maxWait: { type: 'number', default: 30000, description: 'Maximum wait time in milliseconds' }
        },
        phaseA: true
      },
      {
        id: 'set-variable',
        name: 'Set Variable',
        description: 'Context and state management with type conversion',
        category: 'data',
        icon: '📝',
        inputs: ['previous'],
        outputs: ['next'],
        configurable: true,
        config_schema: {
          variableName: { type: 'text', required: true, description: 'Variable name (valid identifier)' },
          value: { type: 'text', required: true, description: 'Variable value (supports templates)' },
          type: { type: 'select', options: ['string', 'number', 'boolean', 'json'], default: 'string' },
          scope: { type: 'select', options: ['local', 'global'], default: 'local', description: 'Variable scope' }
        },
        phaseA: true
      }
    ];

    // Legacy node types (preserved for backward compatibility)
    const legacyNodeTypes = [
      {
        id: 'start',
        name: 'Start',
        description: 'Entry point for workflow execution',
        category: 'flow',
        icon: '▶️',
        inputs: [],
        outputs: ['next'],
        configurable: false,
        legacy: true
      },
      {
        id: 'end',
        name: 'End',
        description: 'Exit point for workflow execution',
        category: 'flow',
        icon: '⏹️',
        inputs: ['previous'],
        outputs: [],
        configurable: false,
        legacy: true
      },
      {
        id: 'agent_task',
        name: 'Agent Task',
        description: 'Execute a task using a specific agent',
        category: 'agent',
        icon: '🤖',
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
        legacy: true
      },
      {
        id: 'condition',
        name: 'Condition',
        description: 'Branch workflow based on conditions',
        category: 'logic',
        icon: '🔀',
        inputs: ['previous'],
        outputs: ['true', 'false'],
        configurable: true,
        config_schema: {
          condition: { type: 'text', required: true },
          variable: { type: 'text', required: true },
        },
        legacy: true
      },
      {
        id: 'notification',
        name: 'Send Notification',
        description: 'Send a notification to the user',
        category: 'communication',
        icon: '🔔',
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
        legacy: true
      },
    ];

    const allNodeTypes = [...phaseANodeTypes, ...legacyNodeTypes];
    const categories = [...new Set(allNodeTypes.map(n => n.category))];

    console.log(`[WorkflowRoute] ✅ Retrieved ${allNodeTypes.length} node types (${phaseANodeTypes.length} Phase A, ${legacyNodeTypes.length} Legacy)`);
    
    res.json({
      success: true,
      data: {
        nodeTypes: allNodeTypes,
        phaseANodeTypes,
        legacyNodeTypes,
        count: allNodeTypes.length,
        categories,
        capabilities: {
          phaseA: ['expression-engine', 'graph-validation', 'real-time-streaming'],
          security: ['no-eval', 'whitelist-functions', 'input-validation'],
          reliability: ['error-boundaries', 'retry-logic', 'cycle-detection']
        },
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching node types:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch node types',
      data: {
        nodeTypes: [],
        count: 0,
        categories: []
      }
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
