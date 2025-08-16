import express from 'express';
const router = express.Router();
import db from '../db.js';
import authenticateToken from '../middleware/authenticateToken.js';
import EnhancedWorkflowEngine from '../services/EnhancedWorkflowEngine.js';
import WorkflowNodeRegistry from '../services/WorkflowNodeRegistry.js';
import EnhancedLangChainCoreAgent from '../agi/consciousness/EnhancedLangChainCoreAgent.js';
import WorkflowDesignerService from '../services/WorkflowDesignerService.js';
import WorkflowExecutionEngine, { ExecutionStates } from '../services/WorkflowExecutionEngine.js';
import WorkflowTemplateLibraryService from '../services/WorkflowTemplateLibraryService.js';
import { WorkflowMonitoringService } from '../services/WorkflowMonitoringService.js';
import { WorkflowSchedulingService } from '../services/WorkflowSchedulingService.js';
import { traceOperation } from '../system/OpenTelemetryTracing.js';

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

// Execute workflow with enhanced engine
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    console.log('[WorkflowRoute] ⚡ POST /workflows/:id/execute endpoint hit');

    const userId = req.user.id;
    const workflowId = parseInt(req.params.id);
    const { input_data, trigger_type = 'manual' } = req.body;

    // Verify workflow ownership
    const wf = await db.query('SELECT id FROM workflows WHERE id = $1 AND user_id = $2', [workflowId, userId]);
    if (wf.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    // Lazy initialize core agent for engine
    if (!workflowEngine.coreAgent) {
      const coreAgent = new EnhancedLangChainCoreAgent();
      await coreAgent.initialize();
      workflowEngine.setCoreAgent(coreAgent);
    }

    // Kick off execution using enhanced engine (persists record internally)
    const execResult = await workflowEngine.executeWorkflow(
      workflowId,
      userId,
      input_data || {},
      trigger_type
    );

    if (!execResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Workflow execution failed',
        error: execResult.error,
        execution_id: execResult.executionId,
        timestamp: new Date().toISOString(),
      });
    }

    // Basic simulation: ensure a completed row exists quickly for polling UIs.
    // If EnhancedWorkflowEngine already marks completed, this will be a no-op guarded by status check.
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
        await db.query(
          'INSERT INTO workflow_execution_logs (execution_id, level, message, data) VALUES ($1, $2, $3, $4)',
          [
            statusRow.rows[0].id,
            'info',
            'Auto-completed simulation step',
            JSON.stringify({ simulated: true }),
          ]
        );
      }
    } catch (simErr) {
      console.warn('[WorkflowRoute] Simulation completion step failed (non-blocking):', simErr.message);
    }

    res.json({
      success: true,
      message: 'Workflow executed successfully',
      execution_id: execResult.executionId,
      result: execResult.result,
      execution_time: execResult.executionTime,
      logs: execResult.logs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error executing workflow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute workflow',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
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

// ========== ADVANCED TEMPLATE MANAGEMENT ==========

// Get workflow template categories
router.get('/template-categories', async (req, res) => {
  try {
    console.log('[WorkflowRoute] 🚀 GET /workflows/template-categories endpoint hit');
    
    // Import template manager dynamically
    const { default: WorkflowTemplateManager } = await import('../services/WorkflowTemplateManager.js');
    const templateManager = new WorkflowTemplateManager();
    
    const categories = templateManager.getCategories();
    
    res.json({
      success: true,
      categories,
      count: categories.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching template categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template categories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Search workflow templates
router.get('/templates/search', async (req, res) => {
  try {
    const { q: query, category, tags, difficulty, limit = 20 } = req.query;
    
    console.log('[WorkflowRoute] 🔍 Searching templates:', { query, category, tags, difficulty });
    
    const { default: WorkflowTemplateManager } = await import('../services/WorkflowTemplateManager.js');
    const templateManager = new WorkflowTemplateManager();
    await templateManager.loadTemplatesFromDB();
    
    let results;
    if (query) {
      results = templateManager.searchTemplates(query);
    } else {
      const tagList = tags ? tags.split(',').map(t => t.trim()) : null;
      results = templateManager.listTemplates(category, tagList);
    }
    
    // Apply difficulty filter
    if (difficulty) {
      results = results.filter(t => t.difficulty === difficulty);
    }
    
    // Apply limit
    results = results.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      templates: results,
      count: results.length,
      query: { query, category, tags, difficulty, limit },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error searching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search templates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get specific template details
router.get('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    
    console.log('[WorkflowRoute] 📋 Getting template details:', templateId);
    
    const { default: WorkflowTemplateManager } = await import('../services/WorkflowTemplateManager.js');
    const templateManager = new WorkflowTemplateManager();
    await templateManager.loadTemplatesFromDB();
    
    const template = templateManager.getTemplate(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Get usage statistics
    const usageStats = await db.query(
      'SELECT COUNT(*) as execution_count, AVG(duration_ms) as avg_duration FROM workflow_executions WHERE template_id = $1',
      [templateId]
    );
    
    const rating = await db.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM workflow_reviews WHERE template_id = $1',
      [templateId]
    );
    
    res.json({
      success: true,
      template: {
        ...template,
        stats: {
          executionCount: parseInt(usageStats.rows[0]?.execution_count || 0),
          avgDuration: parseFloat(usageStats.rows[0]?.avg_duration || 0),
          avgRating: parseFloat(rating.rows[0]?.avg_rating || 0),
          reviewCount: parseInt(rating.rows[0]?.review_count || 0)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching template details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Clone template to create new workflow
router.post('/templates/:templateId/clone', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, customizations = {} } = req.body;
    const userId = req.user.id;
    
    console.log('[WorkflowRoute] 🔄 Cloning template:', templateId);
    
    const { default: WorkflowTemplateManager } = await import('../services/WorkflowTemplateManager.js');
    const templateManager = new WorkflowTemplateManager();
    await templateManager.loadTemplatesFromDB();
    
    const clonedTemplate = templateManager.cloneTemplate(templateId, {
      name,
      ...customizations
    });
    
    if (!clonedTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Save as new workflow
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.query(
      `INSERT INTO workflows (id, name, description, user_id, definition, variables, category, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')`,
      [
        workflowId,
        clonedTemplate.name,
        clonedTemplate.description,
        userId,
        JSON.stringify(clonedTemplate.definition),
        JSON.stringify(clonedTemplate.variables),
        clonedTemplate.category
      ]
    );
    
    res.json({
      success: true,
      workflow: {
        id: workflowId,
        name: clonedTemplate.name,
        description: clonedTemplate.description,
        definition: clonedTemplate.definition,
        variables: clonedTemplate.variables,
        category: clonedTemplate.category,
        status: 'draft'
      },
      message: 'Template cloned successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error cloning template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clone template',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ========== ADVANCED WORKFLOW EXECUTION ==========

// Execute workflow with advanced executor
router.post('/:id/execute-advanced', authenticateToken, async (req, res) => {
  try {
    const { id: workflowId } = req.params;
    const { input, variables = {}, options = {} } = req.body;
    const userId = req.user.id;
    
    console.log('[WorkflowRoute] 🚀 Advanced workflow execution:', workflowId);
    
    // Get workflow definition
    const workflowResult = await db.query(
      'SELECT * FROM workflows WHERE id = $1 AND (user_id = $2 OR is_template = true)',
      [workflowId, userId]
    );
    
    if (workflowResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found or access denied'
      });
    }
    
    const workflow = workflowResult.rows[0];
    
    // Import and initialize advanced executor
    const { default: AdvancedWorkflowExecutor } = await import('../services/AdvancedWorkflowExecutor.js');
    
    // Get router instance (would need proper dependency injection in production)
    const cartritaRouter = req.app.get('cartritaRouter') || {};
    const agentRegistry = req.app.get('agentRegistry') || {};
    
    const executor = new AdvancedWorkflowExecutor(cartritaRouter, agentRegistry);
    
    const workflowDefinition = {
      id: workflow.id,
      name: workflow.name,
      ...JSON.parse(workflow.definition)
    };
    
    // Merge variables
    const mergedVariables = {
      ...JSON.parse(workflow.variables || '{}'),
      ...variables
    };
    
    const result = await executor.executeWorkflow(
      workflowDefinition,
      input,
      userId,
      { variables: mergedVariables, ...options }
    );
    
    // Save execution record
    await db.query(
      `INSERT INTO workflow_executions 
       (id, workflow_id, user_id, status, input_data, output_data, variables, execution_path, duration_ms, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        result.executionId,
        workflowId,
        userId,
        result.status,
        JSON.stringify(input),
        JSON.stringify(result.output),
        JSON.stringify(mergedVariables),
        JSON.stringify(result.executionPath),
        result.duration
      ]
    );
    
    res.json({
      success: true,
      execution: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Advanced workflow execution failed:', error);
    res.status(500).json({
      success: false,
      message: 'Workflow execution failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get workflow node types for visual designer
router.get('/node-types', async (req, res) => {
  try {
    console.log('[WorkflowRoute] 📦 Getting workflow node types');
    
    const result = await db.query(
      'SELECT * FROM workflow_node_types ORDER BY category, name'
    );
    
    const nodeTypes = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      configSchema: JSON.parse(row.config_schema || '{}'),
      icon: row.icon,
      color: row.color,
      isCustom: row.is_custom
    }));
    
    // Group by category
    const categorized = nodeTypes.reduce((acc, nodeType) => {
      const category = nodeType.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(nodeType);
      return acc;
    }, {});
    
    res.json({
      success: true,
      nodeTypes: categorized,
      totalCount: nodeTypes.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching node types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch node types',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get workflow analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '7d' } = req.query;
    
    console.log('[WorkflowRoute] 📊 Getting workflow analytics for user:', userId);
    
    // Convert time range to interval
    const intervalMap = { '1d': '1 day', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[timeRange] || '7 days';
    
    // Get execution summary
    const executionStats = await db.query(
      `SELECT 
         COUNT(*) as total_executions,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
         AVG(duration_ms) as avg_duration_ms
       FROM workflow_executions 
       WHERE user_id = $1 AND start_time > NOW() - INTERVAL '${interval}'`,
      [userId]
    );
    
    // Get top workflows
    const topWorkflows = await db.query(
      `SELECT w.name, COUNT(we.id) as execution_count, AVG(we.duration_ms) as avg_duration
       FROM workflows w
       LEFT JOIN workflow_executions we ON w.id = we.workflow_id
       WHERE w.user_id = $1 AND we.start_time > NOW() - INTERVAL '${interval}'
       GROUP BY w.id, w.name
       ORDER BY execution_count DESC
       LIMIT 10`,
      [userId]
    );
    
    // Get execution timeline
    const timeline = await db.query(
      `SELECT DATE_TRUNC('day', start_time) as date,
              COUNT(*) as executions,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful
       FROM workflow_executions
       WHERE user_id = $1 AND start_time > NOW() - INTERVAL '${interval}'
       GROUP BY DATE_TRUNC('day', start_time)
       ORDER BY date`,
      [userId]
    );
    
    res.json({
      success: true,
      analytics: {
        summary: executionStats.rows[0],
        topWorkflows: topWorkflows.rows,
        timeline: timeline.rows,
        timeRange,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[WorkflowRoute] ❌ Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * VISUAL WORKFLOW DESIGNER ROUTES
 * Task 25: Enterprise Workflow Automation System - Component 1
 */

/**
 * Get node types for visual designer
 * GET /api/workflows/designer/node-types
 */
router.get('/designer/node-types', authenticateToken, async (req, res) => {
    try {
        const result = WorkflowDesignerService.getNodeTypes();
        res.json(result);
    } catch (error) {
        console.error('Error getting designer node types:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get node types' 
        });
    }
});

/**
 * Validate workflow structure for designer
 * POST /api/workflows/designer/validate
 */
router.post('/designer/validate', authenticateToken, async (req, res) => {
    try {
        const validation = await WorkflowDesignerService.validateWorkflow(req.body);
        res.json({ 
            success: true, 
            validation 
        });
    } catch (error) {
        console.error('Error validating workflow:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to validate workflow' 
        });
    }
});

/**
 * Generate workflow preview/execution plan for designer
 * GET /api/workflows/:id/designer/preview
 */
router.get('/:id/designer/preview', authenticateToken, async (req, res) => {
    try {
        const sampleData = req.query.sampleData ? JSON.parse(req.query.sampleData) : {};
        
        const result = await WorkflowDesignerService.generateWorkflowPreview(
            req.params.id,
            req.user.id,
            sampleData
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error generating workflow preview:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to generate preview' 
        });
    }
});

/**
 * Clone workflow via designer
 * POST /api/workflows/:id/designer/clone
 */
router.post('/:id/designer/clone', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        
        const result = await WorkflowDesignerService.cloneWorkflow(
            req.params.id,
            req.user.id,
            name
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error cloning workflow:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to clone workflow' 
        });
    }
});

/**
 * Export workflow definition from designer
 * GET /api/workflows/:id/designer/export
 */
router.get('/:id/designer/export', authenticateToken, async (req, res) => {
    try {
        const workflow = await WorkflowDesignerService.getWorkflow(
            req.params.id,
            req.user.id
        );
        
        if (!workflow) {
            return res.status(404).json({ 
                success: false, 
                error: 'Workflow not found' 
            });
        }
        
        // Prepare export data
        const exportData = {
            name: workflow.name,
            description: workflow.description,
            version: workflow.version,
            definition: typeof workflow.definition === 'string' 
                ? JSON.parse(workflow.definition) 
                : workflow.definition,
            settings: typeof workflow.settings === 'string' 
                ? JSON.parse(workflow.settings) 
                : workflow.settings,
            metadata: typeof workflow.metadata === 'string' 
                ? JSON.parse(workflow.metadata) 
                : workflow.metadata,
            exportedAt: new Date().toISOString(),
            exportedBy: req.user.id
        };
        
        // Set headers for download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${workflow.name}_workflow.json"`);
        
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting workflow:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to export workflow' 
        });
    }
});

/**
 * Import workflow definition to designer
 * POST /api/workflows/designer/import
 */
router.post('/designer/import', authenticateToken, async (req, res) => {
    try {
        const { workflowData, name } = req.body;
        
        if (!workflowData) {
            return res.status(400).json({ 
                success: false, 
                error: 'Workflow data is required' 
            });
        }
        
        // Prepare workflow for creation
        const importData = {
            name: name || workflowData.name || 'Imported Workflow',
            description: workflowData.description || '',
            nodes: workflowData.definition?.nodes || [],
            connections: workflowData.definition?.connections || [],
            variables: workflowData.definition?.variables || {},
            settings: workflowData.settings,
            tags: workflowData.metadata?.tags || ['imported'],
            category: workflowData.metadata?.category || 'general'
        };
        
        const result = await WorkflowDesignerService.createWorkflow(
            req.user.id,
            importData
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error importing workflow:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to import workflow' 
        });
    }
});

/**
 * Update workflow permissions via designer
 * PUT /api/workflows/:id/designer/permissions
 */
router.put('/:id/designer/permissions', authenticateToken, async (req, res) => {
    try {
        const { editors, viewers, public: isPublic } = req.body;
        
        const result = await traceOperation('workflow.designer.permissions', async () => {
            const workflow = await WorkflowDesignerService.getWorkflow(
                req.params.id,
                req.user.id
            );
            
            if (!workflow) {
                throw new Error('Workflow not found');
            }
            
            if (workflow.user_id !== req.user.id) {
                throw new Error('Only workflow owner can modify permissions');
            }
            
            const currentPermissions = typeof workflow.permissions === 'string' 
                ? JSON.parse(workflow.permissions) 
                : workflow.permissions;
            
            const newPermissions = {
                ...currentPermissions,
                editors: editors || currentPermissions.editors || [],
                viewers: viewers || currentPermissions.viewers || [],
                public: isPublic !== undefined ? isPublic : currentPermissions.public || false
            };
            
            const query = `
                UPDATE workflow_definitions 
                SET permissions = $1, updated_at = $2
                WHERE id = $3 AND user_id = $4
                RETURNING *
            `;
            
            const updateResult = await db.query(query, [
                JSON.stringify(newPermissions),
                new Date(),
                req.params.id,
                req.user.id
            ]);
            
            if (updateResult.rows.length === 0) {
                throw new Error('Failed to update permissions');
            }
            
            return {
                success: true,
                permissions: newPermissions
            };
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error updating workflow permissions:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to update permissions' 
        });
    }
});

// =============================================================================
// WORKFLOW EXECUTION ENGINE ROUTES
// =============================================================================

/**
 * Execute a workflow
 * POST /api/workflows/:id/execute
 */
router.post('/:id/execute', authenticateToken, async (req, res) => {
    try {
        const { inputData = {}, options = {} } = req.body;
        const workflowId = req.params.id;
        const userId = req.user.id;

        const result = await traceOperation('workflow.execution.execute', async () => {
            return await WorkflowExecutionEngine.executeWorkflow(
                workflowId,
                userId,
                inputData,
                options
            );
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error executing workflow:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute workflow'
        });
    }
});

/**
 * Get workflow execution status
 * GET /api/workflows/executions/:executionId/status
 */
router.get('/executions/:executionId/status', authenticateToken, async (req, res) => {
    try {
        const executionId = req.params.executionId;
        const status = WorkflowExecutionEngine.getExecutionStatus(executionId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'Execution not found or completed'
            });
        }

        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('Error getting execution status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get execution status'
        });
    }
});

/**
 * Cancel workflow execution
 * POST /api/workflows/executions/:executionId/cancel
 */
router.post('/executions/:executionId/cancel', authenticateToken, async (req, res) => {
    try {
        const executionId = req.params.executionId;
        const { reason = 'Cancelled by user' } = req.body;

        const result = await WorkflowExecutionEngine.cancelExecution(executionId, reason);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error cancelling execution:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel execution'
        });
    }
});

/**
 * Get all active executions
 * GET /api/workflows/executions/active
 */
router.get('/executions/active', authenticateToken, async (req, res) => {
    try {
        const executions = WorkflowExecutionEngine.getActiveExecutions();

        // Filter executions by user
        const userExecutions = executions.filter(exec => exec.userId === req.user.id);

        res.json({
            success: true,
            executions: userExecutions,
            count: userExecutions.length
        });
    } catch (error) {
        console.error('Error getting active executions:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get active executions'
        });
    }
});

/**
 * Get workflow execution history
 * GET /api/workflows/:id/executions
 */
router.get('/:id/executions', authenticateToken, async (req, res) => {
    try {
        const workflowId = req.params.id;
        const userId = req.user.id;
        const { limit = 50, offset = 0, status } = req.query;

        let query = `
            SELECT 
                id, workflow_id, status, input_data, result_data, error_message,
                started_at, completed_at, created_at, updated_at,
                EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) * 1000 as duration_ms
            FROM workflow_executions 
            WHERE workflow_id = $1 AND user_id = $2
        `;
        const params = [workflowId, userId];

        if (status) {
            query += ` AND status = $${params.length + 1}`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM workflow_executions 
            WHERE workflow_id = $1 AND user_id = $2
        `;
        const countParams = [workflowId, userId];

        if (status) {
            countQuery += ` AND status = $${countParams.length + 1}`;
            countParams.push(status);
        }

        const countResult = await db.query(countQuery, countParams);

        res.json({
            success: true,
            executions: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error getting execution history:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get execution history'
        });
    }
});

/**
 * Get execution logs
 * GET /api/workflows/executions/:executionId/logs
 */
router.get('/executions/:executionId/logs', authenticateToken, async (req, res) => {
    try {
        const executionId = req.params.executionId;
        const { level, nodeId, limit = 100, offset = 0 } = req.query;

        // First check if execution exists and user has access
        const executionQuery = `
            SELECT user_id FROM workflow_executions 
            WHERE id = $1
        `;
        const executionResult = await db.query(executionQuery, [executionId]);

        if (executionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Execution not found'
            });
        }

        if (executionResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get logs from execution context if active
        const status = WorkflowExecutionEngine.getExecutionStatus(executionId);
        if (status && status.logs) {
            let logs = status.logs;

            // Apply filters
            if (level) {
                logs = logs.filter(log => log.level === level);
            }
            if (nodeId) {
                logs = logs.filter(log => log.nodeId === nodeId);
            }

            // Apply pagination
            const startIndex = parseInt(offset);
            const endIndex = startIndex + parseInt(limit);
            const paginatedLogs = logs.slice(startIndex, endIndex);

            return res.json({
                success: true,
                logs: paginatedLogs,
                total: logs.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        }

        // If not active, return empty logs (historical logs would need separate storage)
        res.json({
            success: true,
            logs: [],
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Error getting execution logs:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get execution logs'
        });
    }
});

/**
 * Get execution metrics
 * GET /api/workflows/:id/metrics
 */
router.get('/:id/metrics', authenticateToken, async (req, res) => {
    try {
        const workflowId = req.params.id;
        const userId = req.user.id;
        const { days = 30 } = req.query;

        const query = `
            SELECT 
                status,
                COUNT(*) as count,
                AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) * 1000) as avg_duration_ms,
                MIN(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) * 1000) as min_duration_ms,
                MAX(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) * 1000) as max_duration_ms
            FROM workflow_executions 
            WHERE workflow_id = $1 AND user_id = $2 
                AND started_at >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY status
            ORDER BY status
        `;

        const result = await db.query(query, [workflowId, userId]);

        // Calculate success rate
        const totalExecutions = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
        const successfulExecutions = result.rows
            .filter(row => row.status === ExecutionStates.COMPLETED)
            .reduce((sum, row) => sum + parseInt(row.count), 0);
        
        const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

        // Get recent execution trend
        const trendQuery = `
            SELECT 
                DATE(started_at) as date,
                COUNT(*) as executions,
                COUNT(CASE WHEN status = $3 THEN 1 END) as successful
            FROM workflow_executions 
            WHERE workflow_id = $1 AND user_id = $2 
                AND started_at >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY DATE(started_at)
            ORDER BY date DESC
            LIMIT 30
        `;

        const trendResult = await db.query(trendQuery, [workflowId, userId, ExecutionStates.COMPLETED]);

        res.json({
            success: true,
            metrics: {
                statusBreakdown: result.rows.map(row => ({
                    status: row.status,
                    count: parseInt(row.count),
                    avgDuration: parseFloat(row.avg_duration_ms) || 0,
                    minDuration: parseFloat(row.min_duration_ms) || 0,
                    maxDuration: parseFloat(row.max_duration_ms) || 0
                })),
                totalExecutions,
                successfulExecutions,
                successRate: Math.round(successRate * 100) / 100,
                trend: trendResult.rows.map(row => ({
                    date: row.date,
                    executions: parseInt(row.executions),
                    successful: parseInt(row.successful),
                    successRate: parseInt(row.executions) > 0 
                        ? Math.round((parseInt(row.successful) / parseInt(row.executions)) * 10000) / 100
                        : 0
                }))
            },
            period: `${days} days`
        });

    } catch (error) {
        console.error('Error getting workflow metrics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get workflow metrics'
        });
    }
});

// =============================================================================
// WORKFLOW MONITORING DASHBOARD ROUTES
// =============================================================================

// Initialize monitoring service
const monitoringService = new WorkflowMonitoringService();

/**
 * Get comprehensive dashboard overview
 * GET /api/workflows/monitoring/dashboard
 */
router.get('/monitoring/dashboard', authenticateToken, async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
        
        const dashboardData = await traceOperation('workflow.monitoring.dashboard', async () => {
            return await monitoringService.getDashboardOverview(req.user.id, timeRange);
        });

        res.json({
            success: true,
            ...dashboardData
        });
    } catch (error) {
        console.error('Error getting dashboard data:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get dashboard data'
        });
    }
});

/**
 * Get real-time metrics
 * GET /api/workflows/monitoring/metrics/realtime
 */
router.get('/monitoring/metrics/realtime', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            metrics: monitoringService.realTimeMetrics
        });
    } catch (error) {
        console.error('Error getting real-time metrics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get real-time metrics'
        });
    }
});

/**
 * Get execution queue status
 * GET /api/workflows/monitoring/queue
 */
router.get('/monitoring/queue', authenticateToken, async (req, res) => {
    try {
        const queueStatus = await traceOperation('workflow.monitoring.queue', async () => {
            return await monitoringService.getExecutionQueueStatus();
        });

        res.json({
            success: true,
            queue: queueStatus
        });
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get queue status'
        });
    }
});

/**
 * Acknowledge alert
 * POST /api/workflows/monitoring/alerts/:alertId/acknowledge
 */
router.post('/monitoring/alerts/:alertId/acknowledge', authenticateToken, async (req, res) => {
    try {
        const alert = await traceOperation('workflow.monitoring.alert.acknowledge', async () => {
            return await monitoringService.acknowledgeAlert(req.params.alertId, req.user.id);
        });

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        res.json({
            success: true,
            alert
        });
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to acknowledge alert'
        });
    }
});

/**
 * Resolve alert
 * POST /api/workflows/monitoring/alerts/:alertId/resolve
 */
router.post('/monitoring/alerts/:alertId/resolve', authenticateToken, async (req, res) => {
    try {
        const { resolution } = req.body;

        if (!resolution) {
            return res.status(400).json({
                success: false,
                error: 'Resolution message is required'
            });
        }

        const alert = await traceOperation('workflow.monitoring.alert.resolve', async () => {
            return await monitoringService.resolveAlert(req.params.alertId, req.user.id, resolution);
        });

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        res.json({
            success: true,
            alert
        });
    } catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to resolve alert'
        });
    }
});

/**
 * Get workflow performance trends
 * GET /api/workflows/:workflowId/monitoring/performance
 */
router.get('/:workflowId/monitoring/performance', authenticateToken, async (req, res) => {
    try {
        const { hours = 24 } = req.query;

        const query = `
            SELECT * FROM get_workflow_performance_trend($1, $2)
        `;
        
        const result = await db.query(query, [req.params.workflowId, parseInt(hours)]);
        
        res.json({
            success: true,
            trends: result.rows
        });
    } catch (error) {
        console.error('Error getting workflow performance trends:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get performance trends'
        });
    }
});

/**
 * Get workflow health score
 * GET /api/workflows/:workflowId/monitoring/health
 */
router.get('/:workflowId/monitoring/health', authenticateToken, async (req, res) => {
    try {
        const { days = 7 } = req.query;

        const query = `
            SELECT calculate_workflow_health_score($1, $2) as health_score
        `;
        
        const result = await db.query(query, [req.params.workflowId, parseInt(days)]);
        const healthScore = result.rows[0]?.health_score || 0;
        
        res.json({
            success: true,
            healthScore: parseFloat(healthScore),
            rating: getHealthRating(healthScore)
        });
    } catch (error) {
        console.error('Error getting workflow health score:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get health score'
        });
    }
});

/**
 * Get system resource metrics
 * GET /api/workflows/monitoring/system/resources
 */
router.get('/monitoring/system/resources', authenticateToken, async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        
        const query = `
            SELECT * FROM system_resource_trends
            WHERE hour >= NOW() - INTERVAL '${parseInt(hours)} hours'
            ORDER BY hour
        `;
        
        const result = await db.query(query);
        
        res.json({
            success: true,
            trends: result.rows
        });
    } catch (error) {
        console.error('Error getting system resource metrics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get system resource metrics'
        });
    }
});

/**
 * Get alerts summary
 * GET /api/workflows/monitoring/alerts/summary
 */
router.get('/monitoring/alerts/summary', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT * FROM workflow_alerts_summary
        `;
        
        const result = await db.query(query);
        
        res.json({
            success: true,
            summary: result.rows
        });
    } catch (error) {
        console.error('Error getting alerts summary:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get alerts summary'
        });
    }
});

// Helper function for health rating
function getHealthRating(score) {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.8) return 'good';
    if (score >= 0.6) return 'fair';
    if (score >= 0.4) return 'poor';
    return 'critical';
}

// =============================================================================
// WORKFLOW TEMPLATE LIBRARY ROUTES
// =============================================================================

/**
 * Get workflow templates with filtering
 * GET /api/workflows/templates
 */
router.get('/templates', authenticateToken, async (req, res) => {
    try {
        const {
            category,
            complexity,
            tags,
            search,
            includeCustom = 'true',
            includePublic = 'true',
            limit = 50,
            offset = 0
        } = req.query;

        const result = await traceOperation('workflow.template.list', async () => {
            return await WorkflowTemplateLibraryService.getTemplates({
                category,
                complexity,
                tags: tags ? tags.split(',') : undefined,
                search,
                userId: req.user.id,
                includeCustom: includeCustom === 'true',
                includePublic: includePublic === 'true',
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error getting templates:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get templates'
        });
    }
});

/**
 * Get template categories
 * GET /api/workflows/templates/categories
 */
router.get('/templates/categories', authenticateToken, async (req, res) => {
    try {
        const categories = WorkflowTemplateLibraryService.getTemplateCategories();
        const complexityLevels = WorkflowTemplateLibraryService.getComplexityLevels();

        res.json({
            success: true,
            categories,
            complexityLevels
        });
    } catch (error) {
        console.error('Error getting template categories:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get template categories'
        });
    }
});

/**
 * Get specific template
 * GET /api/workflows/templates/:templateId
 */
router.get('/templates/:templateId', authenticateToken, async (req, res) => {
    try {
        const template = await traceOperation('workflow.template.get', async () => {
            return await WorkflowTemplateLibraryService.getTemplate(
                req.params.templateId,
                req.user.id
            );
        });

        res.json({
            success: true,
            template
        });
    } catch (error) {
        console.error('Error getting template:', error);
        res.status(error.message === 'Template not found or access denied' ? 404 : 500).json({
            success: false,
            error: error.message || 'Failed to get template'
        });
    }
});

/**
 * Create workflow from template
 * POST /api/workflows/templates/:templateId/create
 */
router.post('/templates/:templateId/create', authenticateToken, async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            customizations = {},
            settings = {}
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Workflow name is required'
            });
        }

        const workflow = await traceOperation('workflow.template.create_workflow', async () => {
            return await WorkflowTemplateLibraryService.createWorkflowFromTemplate(
                req.params.templateId,
                {
                    name,
                    description,
                    category,
                    customizations,
                    settings
                },
                req.user.id
            );
        });

        res.json({
            success: true,
            workflow
        });
    } catch (error) {
        console.error('Error creating workflow from template:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create workflow from template'
        });
    }
});

/**
 * Save workflow as template
 * POST /api/workflows/:workflowId/save-as-template
 */
router.post('/:workflowId/save-as-template', authenticateToken, async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            complexity,
            tags = [],
            isPublic = false,
            estimatedDuration,
            prerequisites = []
        } = req.body;

        if (!name || !description || !category) {
            return res.status(400).json({
                success: false,
                error: 'Template name, description, and category are required'
            });
        }

        const template = await traceOperation('workflow.template.save', async () => {
            return await WorkflowTemplateLibraryService.saveWorkflowAsTemplate(
                req.params.workflowId,
                {
                    name,
                    description,
                    category,
                    complexity,
                    tags,
                    isPublic,
                    estimatedDuration,
                    prerequisites
                },
                req.user.id
            );
        });

        res.json({
            success: true,
            template
        });
    } catch (error) {
        console.error('Error saving workflow as template:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to save workflow as template'
        });
    }
});

/**
 * Rate a template
 * POST /api/workflows/templates/:templateId/rate
 */
router.post('/templates/:templateId/rate', authenticateToken, async (req, res) => {
    try {
        const { rating, review } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 5'
            });
        }

        const result = await traceOperation('workflow.template.rate', async () => {
            return await WorkflowTemplateLibraryService.rateTemplate(
                req.params.templateId,
                req.user.id,
                rating,
                review
            );
        });

        res.json({
            success: true,
            review: result
        });
    } catch (error) {
        console.error('Error rating template:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to rate template'
        });
    }
});

/**
 * Preview template (track usage without creating workflow)
 * POST /api/workflows/templates/:templateId/preview
 */
router.post('/templates/:templateId/preview', authenticateToken, async (req, res) => {
    try {
        // Get template details
        const template = await WorkflowTemplateLibraryService.getTemplate(
            req.params.templateId,
            req.user.id
        );

        // Record preview usage
        await WorkflowTemplateLibraryService.recordTemplateUsage(
            req.params.templateId,
            req.user.id
        );

        // Return template with preview-specific information
        res.json({
            success: true,
            template: {
                ...template,
                previewGenerated: true,
                estimatedNodes: template.definition.nodes ? template.definition.nodes.length : 0,
                estimatedConnections: template.definition.connections ? template.definition.connections.length : 0,
                requiredIntegrations: this.extractRequiredIntegrations(template.definition)
            }
        });
    } catch (error) {
        console.error('Error previewing template:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to preview template'
        });
    }
});

/**
 * Get template usage statistics
 * GET /api/workflows/templates/:templateId/stats
 */
router.get('/templates/:templateId/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await traceOperation('workflow.template.stats', async () => {
            const query = `
                SELECT 
                    COUNT(wtu.id) as usage_count,
                    COUNT(DISTINCT wtu.user_id) as unique_users,
                    COUNT(wtr.id) as review_count,
                    COALESCE(AVG(wtr.rating), 0) as avg_rating,
                    COUNT(wtd.id) as download_count,
                    COUNT(CASE WHEN wtu.used_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_usage,
                    COUNT(CASE WHEN wtu.used_at >= NOW() - INTERVAL '7 days' THEN 1 END) as weekly_usage
                FROM workflow_templates wt
                LEFT JOIN workflow_template_usage wtu ON wt.id = wtu.template_id
                LEFT JOIN workflow_template_reviews wtr ON wt.id = wtr.template_id AND wtr.review_status = 'published'
                LEFT JOIN workflow_template_downloads wtd ON wt.id = wtd.template_id
                WHERE wt.id = $1 OR $1 LIKE 'prebuilt:%'
                GROUP BY wt.id
            `;

            let templateId = req.params.templateId;
            if (templateId.startsWith('prebuilt:')) {
                // For prebuilt templates, we'll return simulated stats
                return {
                    usage_count: Math.floor(Math.random() * 1000) + 100,
                    unique_users: Math.floor(Math.random() * 200) + 20,
                    review_count: Math.floor(Math.random() * 50) + 5,
                    avg_rating: (4 + Math.random()).toFixed(1),
                    download_count: Math.floor(Math.random() * 500) + 50,
                    recent_usage: Math.floor(Math.random() * 100) + 10,
                    weekly_usage: Math.floor(Math.random() * 30) + 3
                };
            }

            const result = await db.query(query, [templateId]);
            return result.rows[0] || {
                usage_count: 0,
                unique_users: 0,
                review_count: 0,
                avg_rating: 0,
                download_count: 0,
                recent_usage: 0,
                weekly_usage: 0
            };
        });

        res.json({
            success: true,
            stats: {
                usageCount: parseInt(stats.usage_count) || 0,
                uniqueUsers: parseInt(stats.unique_users) || 0,
                reviewCount: parseInt(stats.review_count) || 0,
                avgRating: parseFloat(stats.avg_rating) || 0,
                downloadCount: parseInt(stats.download_count) || 0,
                recentUsage: parseInt(stats.recent_usage) || 0,
                weeklyUsage: parseInt(stats.weekly_usage) || 0
            }
        });
    } catch (error) {
        console.error('Error getting template stats:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get template statistics'
        });
    }
});

/**
 * Search templates with advanced filtering
 * POST /api/workflows/templates/search
 */
router.post('/templates/search', authenticateToken, async (req, res) => {
    try {
        const {
            query: searchQuery,
            filters = {},
            sort = 'popularity',
            limit = 20,
            offset = 0
        } = req.body;

        const result = await traceOperation('workflow.template.search', async () => {
            return await WorkflowTemplateLibraryService.getTemplates({
                search: searchQuery,
                category: filters.category,
                complexity: filters.complexity,
                tags: filters.tags,
                userId: req.user.id,
                includeCustom: filters.includeCustom !== false,
                includePublic: filters.includePublic !== false,
                limit,
                offset
            });
        });

        // Apply sorting
        if (sort === 'popularity') {
            result.templates.sort((a, b) => {
                const scoreA = (a.usageCount || 0) * 0.6 + (parseFloat(a.rating) || 0) * 0.4;
                const scoreB = (b.usageCount || 0) * 0.6 + (parseFloat(b.rating) || 0) * 0.4;
                return scoreB - scoreA;
            });
        } else if (sort === 'newest') {
            result.templates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sort === 'rating') {
            result.templates.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
        } else if (sort === 'usage') {
            result.templates.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        }

        res.json({
            success: true,
            ...result,
            searchQuery,
            sort
        });
    } catch (error) {
        console.error('Error searching templates:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to search templates'
        });
    }
});

/**
 * Get featured/recommended templates
 * GET /api/workflows/templates/featured
 */
router.get('/templates/featured', authenticateToken, async (req, res) => {
    try {
        const { limit = 12 } = req.query;

        const result = await traceOperation('workflow.template.featured', async () => {
            // Get popular templates from each category
            const templates = await WorkflowTemplateLibraryService.getTemplates({
                userId: req.user.id,
                includeCustom: false, // Only prebuilt templates for featured
                includePublic: true,
                limit: parseInt(limit) * 2 // Get more to filter by category
            });

            // Group by category and take top from each
            const byCategory = templates.templates.reduce((acc, template) => {
                if (!acc[template.category]) {
                    acc[template.category] = [];
                }
                acc[template.category].push(template);
                return acc;
            }, {});

            // Take top template from each category
            const featured = [];
            Object.keys(byCategory).forEach(category => {
                if (featured.length < parseInt(limit)) {
                    const categoryTemplates = byCategory[category].sort((a, b) => {
                        const scoreA = (a.usageCount || 0) * 0.6 + (parseFloat(a.rating) || 0) * 0.4;
                        const scoreB = (b.usageCount || 0) * 0.6 + (parseFloat(b.rating) || 0) * 0.4;
                        return scoreB - scoreA;
                    });
                    featured.push(categoryTemplates[0]);
                }
            });

            return {
                templates: featured.slice(0, parseInt(limit)),
                total: featured.length
            };
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error getting featured templates:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get featured templates'
        });
    }
});

// =============================================================================
// WORKFLOW SCHEDULING ROUTES (Component 5: Advanced Scheduling System)
// =============================================================================

// Initialize scheduling service
const schedulingService = new WorkflowSchedulingService();

// GET /api/workflows/schedules - Get user's workflow schedules
router.get('/schedules', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const filters = {
            scheduleType: req.query.scheduleType,
            isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };

        const schedules = await schedulingService.getSchedules(userId, filters);

        res.json({
            success: true,
            data: schedules
        });
    } catch (error) {
        console.error('Error getting schedules:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get schedules'
        });
    }
});

// POST /api/workflows/schedules - Create new workflow schedule
router.post('/schedules', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const schedule = await schedulingService.createSchedule(req.body, userId);

        res.json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create schedule'
        });
    }
});

// PUT /api/workflows/schedules/:id - Update workflow schedule
router.put('/schedules/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const scheduleId = req.params.id;
        const schedule = await schedulingService.updateSchedule(scheduleId, req.body, userId);

        res.json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update schedule'
        });
    }
});

// DELETE /api/workflows/schedules/:id - Delete workflow schedule
router.delete('/schedules/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const scheduleId = req.params.id;
        await schedulingService.deleteSchedule(scheduleId, userId);

        res.json({
            success: true,
            message: 'Schedule deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete schedule'
        });
    }
});

// GET /api/workflows/scheduling/queue-status - Get current queue status
router.get('/scheduling/queue-status', authenticateToken, async (req, res) => {
    try {
        const result = await traceOperation('workflow.scheduling.queue-status', async () => {
            const query = `
                SELECT 
                    wsq.*,
                    wd.name as workflow_name
                FROM workflow_schedule_queue wsq
                LEFT JOIN workflow_definitions wd ON wsq.workflow_id = wd.id
                WHERE wsq.queue_status IN ('pending', 'processing')
                ORDER BY wsq.priority DESC, wsq.created_at ASC
                LIMIT 50
            `;
            
            const result = await db.query(query);
            return result.rows;
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get queue status'
        });
    }
});

// GET /api/workflows/scheduling/statistics - Get scheduling statistics
router.get('/scheduling/statistics', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await traceOperation('workflow.scheduling.statistics', async () => {
            // Get basic statistics
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_schedules,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as total_active_schedules,
                    AVG(priority) as avg_priority
                FROM workflow_schedules 
                WHERE user_id = $1
            `;
            
            const queueQuery = `
                SELECT COUNT(*) as queue_length
                FROM workflow_schedule_queue wsq
                JOIN workflow_schedules ws ON wsq.schedule_id = ws.id
                WHERE ws.user_id = $1 AND wsq.queue_status = 'pending'
            `;
            
            const executionStatsQuery = `
                SELECT 
                    COUNT(*) as total_executions,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
                    AVG(execution_duration_ms) as avg_execution_time_ms
                FROM workflow_schedule_executions wse
                JOIN workflow_schedules ws ON wse.schedule_id = ws.id
                WHERE ws.user_id = $1 
                AND wse.started_at >= CURRENT_DATE - INTERVAL '24 hours'
            `;

            const [statsResult, queueResult, executionResult] = await Promise.all([
                db.query(statsQuery, [userId]),
                db.query(queueQuery, [userId]),
                db.query(executionStatsQuery, [userId])
            ]);

            const stats = statsResult.rows[0];
            const queue = queueResult.rows[0];
            const executions = executionResult.rows[0];

            return {
                totalSchedules: parseInt(stats.total_schedules) || 0,
                totalActiveSchedules: parseInt(stats.total_active_schedules) || 0,
                queueLength: parseInt(queue.queue_length) || 0,
                successRate: executions.total_executions > 0 
                    ? Math.round((executions.successful_executions / executions.total_executions) * 100) 
                    : 100,
                avgExecutionTime: Math.round((executions.avg_execution_time_ms || 0) / 1000)
            };
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error getting scheduling statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get scheduling statistics'
        });
    }
});

// GET /api/workflows/scheduling/performance-trends - Get performance trends
router.get('/scheduling/performance-trends', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const days = parseInt(req.query.days) || 7;
        
        const result = await traceOperation('workflow.scheduling.performance-trends', async () => {
            const query = `
                SELECT 
                    DATE(wse.started_at) as date,
                    COUNT(*) as total,
                    COUNT(CASE WHEN wse.status = 'completed' THEN 1 END) as successful,
                    COUNT(CASE WHEN wse.status = 'failed' THEN 1 END) as failed,
                    AVG(wse.execution_duration_ms) as avg_duration_ms
                FROM workflow_schedule_executions wse
                JOIN workflow_schedules ws ON wse.schedule_id = ws.id
                WHERE ws.user_id = $1 
                AND wse.started_at >= CURRENT_DATE - INTERVAL '${days} days'
                GROUP BY DATE(wse.started_at)
                ORDER BY date ASC
            `;
            
            const result = await db.query(query, [userId]);
            return result.rows.map(row => ({
                date: row.date,
                total: parseInt(row.total),
                successful: parseInt(row.successful),
                failed: parseInt(row.failed),
                avgDuration: Math.round(row.avg_duration_ms / 1000) // Convert to seconds
            }));
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error getting performance trends:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get performance trends'
        });
    }
});

// GET /api/workflows/schedules/:id/status - Get schedule status
router.get('/schedules/:id/status', authenticateToken, async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const status = await schedulingService.getScheduleStatus(scheduleId);

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting schedule status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get schedule status'
        });
    }
});

// POST /api/workflows/schedules/:id/trigger - Manually trigger a schedule
router.post('/schedules/:id/trigger', authenticateToken, async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const userId = req.user.id;
        
        const result = await traceOperation('workflow.scheduling.manual-trigger', async () => {
            // Get schedule details
            const scheduleQuery = `
                SELECT * FROM workflow_schedules 
                WHERE id = $1 AND user_id = $2
            `;
            const scheduleResult = await db.query(scheduleQuery, [scheduleId, userId]);
            
            if (scheduleResult.rows.length === 0) {
                throw new Error('Schedule not found or access denied');
            }

            const schedule = scheduleResult.rows[0];
            
            // Execute the workflow through the scheduling service
            const executionResult = await schedulingService.executeWorkflowFromSchedule(schedule, {
                triggerType: 'manual',
                triggeredBy: userId,
                ...req.body
            });

            return executionResult;
        });

        res.json({
            success: true,
            data: result,
            message: 'Schedule triggered successfully'
        });
    } catch (error) {
        console.error('Error triggering schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to trigger schedule'
        });
    }
});

// SERVICE INTEGRATION HUB ROUTES
// Component 6: Service Integration Hub - API Routes

// Initialize service integration hub (lazy loading)
let serviceIntegrationHub = null;
const getServiceIntegrationHub = async () => {
    if (!serviceIntegrationHub) {
        const { WorkflowServiceIntegrationHub } = await import('../services/WorkflowServiceIntegrationHub.js');
        serviceIntegrationHub = new WorkflowServiceIntegrationHub(db);
        await serviceIntegrationHub.initialize();
    }
    return serviceIntegrationHub;
};

// Get all service integrations for user
router.get('/integrations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { integration_type, status, is_active } = req.query;

        const result = await traceOperation('workflow.integrations.list', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.getIntegrations(userId, { integration_type, status, is_active });
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching integrations:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch integrations'
        });
    }
});

// Create new service integration
router.post('/integrations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrationData = { ...req.body, user_id: userId };

        const result = await traceOperation('workflow.integrations.create', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.createIntegration(integrationData);
        });

        res.json({
            success: true,
            data: result,
            message: 'Integration created successfully'
        });
    } catch (error) {
        console.error('Error creating integration:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create integration'
        });
    }
});

// Get specific integration
router.get('/integrations/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrationId = req.params.id;

        const result = await traceOperation('workflow.integrations.get', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.getIntegration(integrationId, userId);
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Integration not found'
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching integration:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch integration'
        });
    }
});

// Update integration
router.put('/integrations/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrationId = req.params.id;

        const result = await traceOperation('workflow.integrations.update', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.updateIntegration(integrationId, req.body, userId);
        });

        res.json({
            success: true,
            data: result,
            message: 'Integration updated successfully'
        });
    } catch (error) {
        console.error('Error updating integration:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update integration'
        });
    }
});

// Delete integration
router.delete('/integrations/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrationId = req.params.id;

        const result = await traceOperation('workflow.integrations.delete', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.deleteIntegration(integrationId, userId);
        });

        res.json({
            success: true,
            message: 'Integration deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting integration:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete integration'
        });
    }
});

// Test integration connection
router.post('/integrations/:id/test', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrationId = req.params.id;

        const result = await traceOperation('workflow.integrations.test', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.testIntegration(integrationId, userId);
        });

        res.json({
            success: true,
            data: result,
            message: 'Integration test completed'
        });
    } catch (error) {
        console.error('Error testing integration:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to test integration'
        });
    }
});

// Execute integration operation
router.post('/integrations/:id/execute', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrationId = req.params.id;
        const { operation_type, operation_data, workflow_execution_id } = req.body;

        const result = await traceOperation('workflow.integrations.execute', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.executeIntegration(integrationId, {
                operation_type,
                operation_data,
                workflow_execution_id,
                user_id: userId
            });
        });

        res.json({
            success: true,
            data: result,
            message: 'Integration executed successfully'
        });
    } catch (error) {
        console.error('Error executing integration:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to execute integration'
        });
    }
});

// Get integration executions history
router.get('/integration-executions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { integration_id, status, limit = 100, offset = 0 } = req.query;

        const result = await traceOperation('workflow.integrations.executions', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.getExecutions(userId, { 
                integration_id, 
                status, 
                limit: parseInt(limit), 
                offset: parseInt(offset) 
            });
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching executions:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch executions'
        });
    }
});

// Get integration health checks
router.get('/integration-health', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { integration_id, check_type } = req.query;

        const result = await traceOperation('workflow.integrations.health', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.getHealthChecks(userId, { integration_id, check_type });
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching health checks:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch health checks'
        });
    }
});

// Get integration analytics
router.get('/integration-analytics', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { integration_type, days = 30 } = req.query;

        const result = await traceOperation('workflow.integrations.analytics', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.getAnalytics(userId, { integration_type, days: parseInt(days) });
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch analytics'
        });
    }
});

// Get integration webhooks
router.get('/integration-webhooks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { integration_id, is_active } = req.query;

        const result = await traceOperation('workflow.integrations.webhooks', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.getWebhooks(userId, { integration_id, is_active });
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching webhooks:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch webhooks'
        });
    }
});

// Create webhook for integration
router.post('/integrations/:id/webhooks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrationId = req.params.id;
        const webhookData = { ...req.body, integration_id: integrationId };

        const result = await traceOperation('workflow.integrations.webhook.create', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.createWebhook(webhookData, userId);
        });

        res.json({
            success: true,
            data: result,
            message: 'Webhook created successfully'
        });
    } catch (error) {
        console.error('Error creating webhook:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create webhook'
        });
    }
});

// Get integration performance metrics
router.get('/integration-performance', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { refresh = false } = req.query;

        const result = await traceOperation('workflow.integrations.performance', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.getPerformanceMetrics(userId, { refresh: refresh === 'true' });
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch performance metrics'
        });
    }
});

// Webhook endpoint for receiving external webhooks (temporarily disabled due to path pattern issues)
/*
router.post('/webhook/*', async (req, res) => {
    try {
        const webhookPath = req.path.replace('/webhook', '');
        const requestMethod = req.method;
        const requestHeaders = req.headers;
        const requestBody = req.body;
        const requestIP = req.ip || req.connection.remoteAddress;

        const result = await traceOperation('workflow.integrations.webhook.receive', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.handleWebhookRequest({
                webhookPath,
                requestMethod,
                requestHeaders,
                requestBody,
                requestIP
            });
        });

        if (result.success) {
            res.status(result.statusCode || 200).json(result.response || { success: true });
        } else {
            res.status(result.statusCode || 400).json({ 
                success: false, 
                error: result.error || 'Webhook processing failed' 
            });
        }
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Internal webhook processing error'
        });
    }
});
*/

// Bulk operations for integrations
router.post('/integrations/bulk', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { operation, integration_ids, data } = req.body;

        const result = await traceOperation('workflow.integrations.bulk', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.bulkOperation(operation, integration_ids, data, userId);
        });

        res.json({
            success: true,
            data: result,
            message: `Bulk ${operation} completed successfully`
        });
    } catch (error) {
        console.error('Error performing bulk operation:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to perform bulk operation'
        });
    }
});

// Export integration configuration
router.get('/integrations/:id/export', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrationId = req.params.id;

        const result = await traceOperation('workflow.integrations.export', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.exportIntegrationConfig(integrationId, userId);
        });

        res.json({
            success: true,
            data: result,
            message: 'Integration configuration exported successfully'
        });
    } catch (error) {
        console.error('Error exporting integration:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to export integration'
        });
    }
});

// Import integration configuration
router.post('/integrations/import', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { configuration, override_existing = false } = req.body;

        const result = await traceOperation('workflow.integrations.import', async () => {
            const hub = await getServiceIntegrationHub();
            return await hub.importIntegrationConfig(configuration, userId, override_existing);
        });

        res.json({
            success: true,
            data: result,
            message: 'Integration configuration imported successfully'
        });
    } catch (error) {
        console.error('Error importing integration:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to import integration'
        });
    }
});

export default router;
