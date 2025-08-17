// PHASE_A_WORKFLOW_IMPLEMENTATION: Workflow Automation Platform Routes
// RESTful API endpoints for unified workflow automation platform (n8n/Zapier parity)
// Provides CRUD operations, execution management, and real-time SSE streaming

import express from 'express';
import { traceOperation } from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Import services (will be initialized by app startup)
let workflowRunnerService;
let connectorRegistryService; 
let expressionEngine;

// Service initialization
export const initializeServices = (services) => {
  workflowRunnerService = services.workflowRunnerService;
  connectorRegistryService = services.connectorRegistryService;
  expressionEngine = services.expressionEngine;
};

// Middleware for service availability check
const requireServices = (req, res, next) => {
  if (!workflowRunnerService || !connectorRegistryService || !expressionEngine) {
    return res.status(503).json({
      success: false,
      error: 'Workflow services not available'
    });
  }
  next();
};

// =============================================================================
// WORKFLOW DEFINITIONS ENDPOINTS
// =============================================================================

/**
 * GET /api/workflows - Get all workflow definitions
 */
router.get('/', requireServices, async (req, res) => {
  try {
    const { owner_id, is_active, trigger_type, limit = 50, offset = 0 } = req.query;
    
    await traceOperation('workflow.api.list_workflows', async (span) => {
      let query = `
        SELECT w.*, u.email as owner_email,
               (SELECT COUNT(*) FROM workflow_executions WHERE workflow_id = w.id) as execution_count
        FROM workflow_automation_definitions w
        LEFT JOIN users u ON w.owner_id = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (owner_id) {
        query += ` AND w.owner_id = $${paramIndex}`;
        params.push(owner_id);
        paramIndex++;
      }

      if (is_active !== undefined) {
        query += ` AND w.is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (trigger_type) {
        query += ` AND w.trigger_type = $${paramIndex}`;
        params.push(trigger_type);
        paramIndex++;
      }

      query += ` ORDER BY w.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await req.dbPool.query(query, params);
      
      span.setAttributes({
        'workflow.count': result.rows.length,
        'workflow.limit': parseInt(limit),
        'workflow.offset': parseInt(offset)
      });

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rows.length
        }
      });
    });
  } catch (error) {
    console.error('[WORKFLOW_API] Error listing workflows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list workflows'
    });
  }
});

/**
 * POST /api/workflows - Create new workflow definition
 */
router.post('/', requireServices, async (req, res) => {
  try {
    const { name, description, trigger_type, trigger_config = {}, definition = {}, settings = {}, tags = [] } = req.body;

    if (!name || !trigger_type) {
      return res.status(400).json({
        success: false,
        error: 'Name and trigger_type are required'
      });
    }

    await traceOperation('workflow.api.create_workflow', async (span) => {
      // TODO: Get owner_id from authenticated user context
      const owner_id = req.user?.id || null;

      const result = await req.dbPool.query(`
        INSERT INTO workflow_automation_definitions (name, description, trigger_type, trigger_config, definition, settings, tags, owner_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [name, description, trigger_type, JSON.stringify(trigger_config), JSON.stringify(definition), JSON.stringify(settings), tags, owner_id]);

      const newWorkflow = result.rows[0];
      
      span.setAttributes({
        'workflow.id': newWorkflow.id,
        'workflow.name': name,
        'workflow.trigger_type': trigger_type
      });

      res.status(201).json({
        success: true,
        data: newWorkflow
      });
    });
  } catch (error) {
    console.error('[WORKFLOW_API] Error creating workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create workflow'
    });
  }
});

/**
 * POST /api/workflows/:id/execute - Execute workflow
 */
router.post('/:id/execute', requireServices, async (req, res) => {
  try {
    const { id } = req.params;
    const { trigger_data = {}, options = {} } = req.body;

    const result = await workflowRunnerService.executeWorkflow(id, trigger_data, options);
    
    res.json(result);
  } catch (error) {
    console.error('[WORKFLOW_API] Error executing workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/executions/:executionId/stream - Server-Sent Events for execution progress
 */
router.get('/executions/:executionId/stream', requireServices, (req, res) => {
  const { executionId } = req.params;

  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  console.log(`[WORKFLOW_API] SSE stream started for execution: ${executionId}`);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    execution_id: executionId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Event handlers for workflow runner events
  const eventHandlers = {
    execution_started: (data) => {
      if (data.execution_id === executionId) {
        res.write(`data: ${JSON.stringify({ type: 'execution_started', ...data })}\n\n`);
      }
    },
    step_started: (data) => {
      if (data.execution_id === executionId) {
        res.write(`data: ${JSON.stringify({ type: 'step_started', ...data })}\n\n`);
      }
    },
    step_completed: (data) => {
      if (data.execution_id === executionId) {
        res.write(`data: ${JSON.stringify({ type: 'step_completed', ...data })}\n\n`);
      }
    },
    execution_completed: (data) => {
      if (data.execution_id === executionId) {
        res.write(`data: ${JSON.stringify({ type: 'execution_completed', ...data })}\n\n`);
        res.end(); // Close stream on completion
      }
    }
  };

  // Register event listeners
  Object.entries(eventHandlers).forEach(([event, handler]) => {
    workflowRunnerService.on(event, handler);
  });

  // Cleanup on client disconnect
  req.on('close', () => {
    console.log(`[WORKFLOW_API] SSE stream closed for execution: ${executionId}`);
    
    // Remove event listeners
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      workflowRunnerService.removeListener(event, handler);
    });
  });
});

/**
 * GET /api/workflows/connectors - Get available connectors
 */
router.get('/connectors', requireServices, async (req, res) => {
  try {
    const { category } = req.query;
    const result = await connectorRegistryService.getConnectors(category);
    res.json(result);
  } catch (error) {
    console.error('[WORKFLOW_API] Error getting connectors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflows/expressions/evaluate - Evaluate expression
 */
router.post('/expressions/evaluate', requireServices, async (req, res) => {
  try {
    const { expression, context = {}, options = {} } = req.body;

    if (!expression) {
      return res.status(400).json({
        success: false,
        error: 'Expression is required'
      });
    }

    const result = await expressionEngine.evaluate(expression, context, options);
    res.json(result);
  } catch (error) {
    console.error('[WORKFLOW_API] Error evaluating expression:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Export router as default
export default router;
