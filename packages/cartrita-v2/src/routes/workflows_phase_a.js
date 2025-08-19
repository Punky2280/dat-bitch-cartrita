// PHASE_A_WORKFLOW_IMPLEMENTATION: Workflow Automation Platform Routes
// RESTful API endpoints for unified workflow automation platform (n8n/Zapier parity)
// Provides CRUD operations, execution management, and real-time SSE streaming

import express from 'express';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import db from '../db.js';

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
  console.log('[Phase A Workflows] Services initialized successfully');
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
    
    await OpenTelemetryTracing.traceOperation('workflow.api.list_workflows', {}, async (span) => {
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
        query += ` AND w.owner_id = $${paramIndex++}`;
        params.push(owner_id);
      }
      
      if (is_active !== undefined) {
        query += ` AND w.is_active = $${paramIndex++}`;
        params.push(is_active === 'true');
      }
      
      if (trigger_type) {
        query += ` AND w.trigger_type = $${paramIndex++}`;
        params.push(trigger_type);
      }
      
      query += ` ORDER BY w.updated_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      
      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM workflow_automation_definitions w
        WHERE 1=1
      `;
      const countParams = [];
      let countParamIndex = 1;
      
      if (owner_id) {
        countQuery += ` AND w.owner_id = $${countParamIndex++}`;
        countParams.push(owner_id);
      }
      
      if (is_active !== undefined) {
        countQuery += ` AND w.is_active = $${countParamIndex++}`;
        countParams.push(is_active === 'true');
      }
      
      if (trigger_type) {
        countQuery += ` AND w.trigger_type = $${countParamIndex++}`;
        countParams.push(trigger_type);
      }
      
      const countResult = await db.query(countQuery, countParams);
      
      span.setAttributes({
        'workflow.count': result.rows.length,
        'workflow.total': parseInt(countResult.rows[0].total),
        'workflow.limit': limit,
        'workflow.offset': offset
      });
      
      res.json({
        success: true,
        data: {
          workflows: result.rows,
          pagination: {
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
          }
        }
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error listing workflows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflows - Create new workflow definition
 */
router.post('/', requireServices, async (req, res) => {
  try {
    const { name, description, trigger_type, steps, settings } = req.body;
    const owner_id = req.user?.id || 1; // Default for testing
    
    if (!name || !steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: 'name and steps (array) are required'
      });
    }
    
    await OpenTelemetryTracing.traceOperation('workflow.api.create_workflow', {}, async (span) => {
      const result = await db.query(`
        INSERT INTO workflow_automation_definitions (
          name, description, owner_id, trigger_type, steps, settings, 
          is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
        RETURNING *
      `, [
        name,
        description || '',
        owner_id,
        trigger_type || 'manual',
        JSON.stringify(steps),
        JSON.stringify(settings || {})
      ]);
      
      span.setAttributes({
        'workflow.id': result.rows[0].id,
        'workflow.name': name,
        'workflow.trigger_type': trigger_type || 'manual',
        'workflow.steps_count': steps.length
      });
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error creating workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/workflows/:id - Update workflow definition
 */
router.put('/:id', requireServices, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, trigger_type, steps, settings, is_active } = req.body;
    
    await OpenTelemetryTracing.traceOperation('workflow.api.update_workflow', {}, async (span) => {
      const result = await db.query(`
        UPDATE workflow_automation_definitions 
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            trigger_type = COALESCE($3, trigger_type),
            steps = COALESCE($4, steps),
            settings = COALESCE($5, settings),
            is_active = COALESCE($6, is_active),
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [
        name,
        description,
        trigger_type,
        steps ? JSON.stringify(steps) : null,
        settings ? JSON.stringify(settings) : null,
        is_active,
        id
      ]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
      }
      
      span.setAttributes({
        'workflow.id': id,
        'workflow.updated': true
      });
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error updating workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/workflows/:id - Delete workflow definition
 */
router.delete('/:id', requireServices, async (req, res) => {
  try {
    const { id } = req.params;
    
    await OpenTelemetryTracing.traceOperation('workflow.api.delete_workflow', {}, async (span) => {
      // Soft delete by marking as inactive
      const result = await db.query(`
        UPDATE workflow_automation_definitions 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
      }
      
      span.setAttributes({
        'workflow.id': id,
        'workflow.deleted': true
      });
      
      res.json({
        success: true,
        message: 'Workflow deactivated successfully'
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error deleting workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// WORKFLOW EXECUTION ENDPOINTS
// =============================================================================

/**
 * POST /api/workflows/:id/execute - Execute workflow manually
 */
router.post('/:id/execute', requireServices, async (req, res) => {
  try {
    const { id } = req.params;
    const { input_data } = req.body;
    const user_id = req.user?.id || 1; // Default for testing
    
    await OpenTelemetryTracing.traceOperation('workflow.api.execute_workflow', {}, async (span) => {
      // Get workflow definition
      const workflowResult = await db.query(
        'SELECT * FROM workflow_automation_definitions WHERE id = $1 AND is_active = true',
        [id]
      );
      
      if (workflowResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found or inactive'
        });
      }
      
      const workflow = workflowResult.rows[0];
      
      // Execute workflow using WorkflowRunnerService
      const execution = await workflowRunnerService.executeWorkflow(
        workflow,
        input_data || {},
        user_id
      );
      
      span.setAttributes({
        'workflow.id': id,
        'workflow.name': workflow.name,
        'execution.id': execution.id,
        'execution.status': execution.status
      });
      
      res.json({
        success: true,
        data: {
          execution_id: execution.id,
          status: execution.status,
          workflow_name: workflow.name,
          started_at: execution.started_at
        }
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error executing workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workflows/:id/executions - Get workflow execution history
 */
router.get('/:id/executions', requireServices, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    await OpenTelemetryTracing.traceOperation('workflow.api.list_executions', {}, async (span) => {
      const result = await db.query(`
        SELECT * FROM workflow_automation_logs
        WHERE workflow_id = $1
        ORDER BY started_at DESC
        LIMIT $2 OFFSET $3
      `, [id, limit, offset]);
      
      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM workflow_automation_logs WHERE workflow_id = $1',
        [id]
      );
      
      span.setAttributes({
        'workflow.id': id,
        'executions.count': result.rows.length,
        'executions.total': parseInt(countResult.rows[0].total)
      });
      
      res.json({
        success: true,
        data: {
          executions: result.rows,
          pagination: {
            total: parseInt(countResult.rows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
          }
        }
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error listing executions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// CONNECTOR REGISTRY ENDPOINTS
// =============================================================================

/**
 * GET /api/workflows/connectors - Get available connectors
 */
router.get('/connectors', requireServices, async (req, res) => {
  try {
    const { category, search } = req.query;
    
    await OpenTelemetryTracing.traceOperation('workflow.api.list_connectors', {}, async (span) => {
      const connectors = await connectorRegistryService.getConnectors({
        category,
        search
      });
      
      span.setAttributes({
        'connectors.count': connectors.length,
        'connectors.category': category || 'all',
        'connectors.search': search || ''
      });
      
      res.json({
        success: true,
        data: connectors
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error listing connectors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflows/connectors/:id/test - Test connector configuration
 */
router.post('/connectors/:id/test', requireServices, async (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body;
    
    await OpenTelemetryTracing.traceOperation('workflow.api.test_connector', {}, async (span) => {
      const result = await connectorRegistryService.testConnector(id, config);
      
      span.setAttributes({
        'connector.id': id,
        'connector.test_success': result.success,
        'connector.test_duration_ms': result.duration_ms || 0
      });
      
      res.json({
        success: true,
        data: result
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error testing connector:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// EXPRESSION ENGINE ENDPOINTS
// =============================================================================

/**
 * POST /api/workflows/expressions/evaluate - Evaluate expression
 */
router.post('/expressions/evaluate', requireServices, async (req, res) => {
  try {
    const { expression, context } = req.body;
    
    if (!expression) {
      return res.status(400).json({
        success: false,
        error: 'expression is required'
      });
    }
    
    await OpenTelemetryTracing.traceOperation('workflow.api.evaluate_expression', {}, async (span) => {
      const result = await expressionEngine.evaluate(expression, context || {});
      
      span.setAttributes({
        'expression.length': expression.length,
        'expression.context_keys': Object.keys(context || {}).length,
        'expression.success': result.success
      });
      
      res.json({
        success: true,
        data: result
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error evaluating expression:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflows/expressions/validate - Validate expression syntax
 */
router.post('/expressions/validate', requireServices, async (req, res) => {
  try {
    const { expression } = req.body;
    
    if (!expression) {
      return res.status(400).json({
        success: false,
        error: 'expression is required'
      });
    }
    
    await OpenTelemetryTracing.traceOperation('workflow.api.validate_expression', {}, async (span) => {
      const result = await expressionEngine.validateExpression(expression);
      
      span.setAttributes({
        'expression.length': expression.length,
        'expression.valid': result.valid
      });
      
      res.json({
        success: true,
        data: result
      });
    });
    
  } catch (error) {
    console.error('[Phase A Workflows] Error validating expression:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export router as default
export default router;