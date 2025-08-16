import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import StructuredOutputService from '../services/StructuredOutputService.js';
import db from '../db.js';
const router = express.Router();

// Simple test route to verify route registration
router.get('/test', (req, res) => {
  res.json({
    message: 'Chat history routes are working!',
    timestamp: new Date().toISOString(),
  });
});

// Get chat history for authenticated user
router.get('/history', authenticateToken, async (req, res) => {
  try {
    console.log('[ChatHistory] 🔍 req.user:', JSON.stringify(req.user));
    const userId = req.user?.id;

    if (!userId) {
      console.warn('[ChatHistory] ❌ Missing userId in request object');
      console.warn('[ChatHistory] 🔍 req.user was:', JSON.stringify(req.user));
      return res
        .status(400)
        .json({ error: 'Missing userId in request context' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(
      `SELECT cm.id, cm.role as speaker, cm.content as text, cm.created_at,
              cs.title as conversation_title
       FROM chat_messages cm
       JOIN chat_sessions cs ON cs.id = cm.session_id
       WHERE cs.user_id = $1 
       ORDER BY cm.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const conversations = result.rows.reverse();

    if (conversations.length === 0) {
      console.log(`[ChatHistory] 📭 No messages found for user ${userId}`);
    }

    res.json({ conversations, count: conversations.length, limit, offset });
  } catch (error) {
    console.error('[ChatHistory] ❌ Error fetching chat history:', error);
    console.error('[ChatHistory] ❌ Error stack:', error.stack);
    console.error('[ChatHistory] ❌ Error message:', error.message);
    res.status(500).json({ message: 'Failed to fetch chat history', error: error.message });
  }
});

// GET /api/chat/structured - retrieve structured outputs with optional task/status filters & pagination
router.get('/structured', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ error: 'Missing userId in request context' });
    
    const { task, status, agent, confidence_min } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // Try to use the new structured_outputs table first, fall back to conversation_messages metadata
    let results = null;
    
    try {
      const structuredService = new StructuredOutputService();
      
      // Build query for structured_outputs table
      const params = [userId];
      let filterSql = '';
      
      if (task) {
        params.push(task);
        filterSql += ` AND task = $${params.length}`;
      }
      
      if (status) {
        params.push(status);
        filterSql += ` AND status = $${params.length}`;
      }
      
      if (agent) {
        params.push(agent);
        filterSql += ` AND agent = $${params.length}`;
      }
      
      if (confidence_min) {
        params.push(parseFloat(confidence_min));
        filterSql += ` AND confidence >= $${params.length}`;
      }
      
      params.push(limit, offset);
      
      const sql = `
        SELECT id, agent, task, status, confidence, data, metadata, created_at
        FROM structured_outputs
        WHERE user_id = $1 ${filterSql}
        ORDER BY created_at DESC 
        LIMIT $${params.length-1} OFFSET $${params.length}
      `;
      
      const result = await db.query(sql, params);
      
      if (result.rows.length > 0) {
        // Process results through the validation service for consistency
        const processedResults = result.rows.map(row => {
          try {
            const structured = {
              id: row.id,
              agent: row.agent,
              task: row.task,
              status: row.status,
              confidence: row.confidence,
              data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
              metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
              timestamp: row.created_at
            };
            
            // Validate the output
            const validation = structuredService.validate(structured);
            if (validation.valid) {
              return structured;
            } else {
              console.warn('[StructuredOutput] Invalid stored output:', validation.errors);
              return null;
            }
          } catch (error) {
            console.error('[StructuredOutput] Error processing stored output:', error);
            return null;
          }
        }).filter(Boolean);
        
        results = {
          success: true,
          count: processedResults.length,
          total: result.rows.length,
          limit,
          offset,
          data: processedResults,
          source: 'structured_outputs_table',
          schemas: structuredService.getAvailableSchemas()
        };
      }
    } catch (error) {
      console.warn('[StructuredOutput] Table query failed, falling back to conversation metadata:', error.message);
    }
    
    // Fall back to original conversation_messages metadata query if structured_outputs table doesn't exist or is empty
    if (!results) {
      const params = [userId];
      let filterSql = '';
      
      if (task) {
        params.push(task);
        filterSql += ` AND (cm.metadata->'structured')::jsonb @> to_jsonb(ARRAY[json_build_object('task', $${params.length})]::json)`;
      }
      
      if (status) {
        params.push(status);
        filterSql += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements(cm.metadata->'structured') elem WHERE elem->>'status' = $${params.length})`;
      }
      
      if (agent) {
        params.push(agent);
        filterSql += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements(cm.metadata->'structured') elem WHERE elem->>'agent' = $${params.length})`;
      }
      
      params.push(limit, offset);
      
      const sql = `
        SELECT cm.id, cm.created_at, cm.metadata->'structured' AS structured
        FROM conversation_messages cm
        JOIN conversations c ON c.id = cm.conversation_id
        WHERE c.user_id = $1 AND cm.role = 'assistant' AND cm.metadata ? 'structured' ${filterSql}
        ORDER BY cm.created_at DESC 
        LIMIT $${params.length-1} OFFSET $${params.length}
      `;
      
      const result = await db.query(sql, params);
      
      results = {
        success: true,
        count: result.rows.length,
        limit,
        offset,
        data: result.rows,
        source: 'conversation_metadata',
        note: 'Using legacy conversation metadata storage'
      };
    }
    
    res.json(results);
    
  } catch (err) {
    console.error('[ChatHistory] ❌ Error fetching structured outputs:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch structured outputs',
      details: err.message 
    });
  }
});

// GET /api/chat/structured/analytics - get analytics for structured outputs
router.get('/structured/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ error: 'Missing userId in request context' });

    const structuredService = new StructuredOutputService();
    
    try {
      // Get analytics from structured_outputs table
      const analyticsQuery = `
        SELECT 
          agent,
          task,
          status,
          COUNT(*) as count,
          AVG(confidence) as avg_confidence,
          MIN(created_at) as first_output,
          MAX(created_at) as last_output
        FROM structured_outputs 
        WHERE user_id = $1 
        GROUP BY agent, task, status 
        ORDER BY count DESC
      `;
      
      const analytics = await db.query(analyticsQuery, [userId]);
      
      // Get summary statistics
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_outputs,
          COUNT(DISTINCT agent) as unique_agents,
          COUNT(DISTINCT task) as unique_tasks,
          COUNT(DISTINCT conversation_id) as unique_conversations,
          AVG(confidence) as avg_confidence,
          MIN(created_at) as first_output,
          MAX(created_at) as last_output
        FROM structured_outputs 
        WHERE user_id = $1
      `;
      
      const summary = await db.query(summaryQuery, [userId]);
      
      res.json({
        success: true,
        summary: summary.rows[0] || {},
        analytics: analytics.rows || [],
        available_schemas: structuredService.getAvailableSchemas(),
        validation_stats: structuredService.getValidationStats()
      });
      
    } catch (error) {
      console.warn('[StructuredOutput] Analytics table query failed:', error.message);
      
      // Fall back to conversation metadata analysis
      const fallbackQuery = `
        SELECT 
          COUNT(*) as total_messages_with_structured,
          MIN(cm.created_at) as first_output,
          MAX(cm.created_at) as last_output
        FROM conversation_messages cm
        JOIN conversations c ON c.id = cm.conversation_id
        WHERE c.user_id = $1 AND cm.metadata ? 'structured'
      `;
      
      const fallback = await db.query(fallbackQuery, [userId]);
      
      res.json({
        success: true,
        summary: fallback.rows[0] || {},
        analytics: [],
        source: 'conversation_metadata_fallback',
        available_schemas: structuredService.getAvailableSchemas(),
        note: 'Limited analytics available from conversation metadata'
      });
    }
    
  } catch (error) {
    console.error('[StructuredOutput] ❌ Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch structured output analytics',
      details: error.message
    });
  }
});

// POST /api/chat/structured/validate - validate structured output data
router.post('/structured/validate', authenticateToken, async (req, res) => {
  try {
    const { data, task } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing data to validate'
      });
    }
    
    const structuredService = new StructuredOutputService();
    
    // If task is provided, validate against specific schema
    let validation;
    if (task) {
      const envelope = structuredService.createEnvelope(task, 'validation', data);
      validation = structuredService.validate(envelope);
    } else {
      // Try to validate as-is
      validation = structuredService.validate(data);
    }
    
    res.json({
      success: true,
      validation: {
        valid: validation.valid,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        schema_used: validation.schema || 'auto-detected'
      },
      available_schemas: structuredService.getAvailableSchemas()
    });
    
  } catch (error) {
    console.error('[StructuredOutput] ❌ Error validating data:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed',
      details: error.message
    });
  }
});

// Clear chat history for authenticated user
router.delete('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      console.warn('[ChatHistory] ❌ Missing userId in request object');
      return res
        .status(400)
        .json({ error: 'Missing userId in request context' });
    }

    const result = await db.query(
      'DELETE FROM conversations WHERE user_id = $1',
      [userId]
    );

    console.log(
      `[ChatHistory] 🧹 Deleted ${result.rowCount} rows for user ${userId}`
    );

    res.json({
      message: 'Chat history cleared',
      deletedCount: result.rowCount,
    });
  } catch (error) {
    console.error('[ChatHistory] ❌ Error clearing chat history:', error);
    res.status(500).json({ message: 'Failed to clear chat history' });
  }
});

// Get conversation statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      console.warn('[ChatHistory] ❌ Missing userId in request object');
      return res
        .status(400)
        .json({ error: 'Missing userId in request context' });
    }

    const result = await db.query(
      `SELECT 
         COUNT(cm.*) as total_messages,
         COUNT(CASE WHEN cm.role = 'user' THEN 1 END) as user_messages,
         COUNT(CASE WHEN cm.role = 'assistant' THEN 1 END) as cartrita_messages,
         MIN(cm.created_at) as first_conversation,
         MAX(cm.created_at) as latest_conversation
       FROM conversation_messages cm
       JOIN conversations c ON c.id = cm.conversation_id 
       WHERE c.user_id = $1`,
      [userId]
    );

    console.log(`[ChatHistory] 📊 Stats for user ${userId}:`, result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[ChatHistory] ❌ Error fetching conversation stats:', error);
    res
      .status(500)
      .json({ message: 'Failed to fetch conversation statistics' });
  }
});

export default router;
