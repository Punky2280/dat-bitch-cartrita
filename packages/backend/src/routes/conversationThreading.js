/**
 * Conversation Threading API Routes
 * 
 * RESTful API endpoints for managing multi-agent conversation threads,
 * context transfers, decision chains, and analytics.
 * 
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import ConversationThreadingService from '../services/ConversationThreadingService.js';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import db from '../db.js';

const router = express.Router();
const threadingService = new ConversationThreadingService();

// Test route
router.get('/test', (req, res) => {
  res.json({
    message: 'Conversation threading routes are working!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * POST /api/threading/initialize
 * Initialize a new conversation thread
 */
router.post('/initialize', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.initialize', async (span) => {
    try {
      const { conversationId, initialContext = {} } = req.body;
      const userId = req.user.id;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'conversationId is required'
        });
      }

      const threadId = await threadingService.initializeThread(
        userId,
        conversationId,
        initialContext
      );

      span.setAttributes({
        'thread.id': threadId,
        'user.id': userId,
        'conversation.id': conversationId
      });

      res.json({
        success: true,
        threadId,
        message: 'Conversation thread initialized successfully'
      });

    } catch (error) {
      console.error('[ConversationThreading] Initialize error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize conversation thread',
        details: error.message
      });
    }
  });
});

/**
 * GET /api/threading/:threadId/context/:agentName
 * Get enhanced context for an agent in a specific thread
 */
router.get('/:threadId/context/:agentName', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.get_context', async (span) => {
    try {
      const { threadId, agentName } = req.params;
      const { contextDepth = 10 } = req.query;
      const userId = req.user.id;

      // Verify user has access to this thread
      const threadCheck = await db.query(
        'SELECT user_id FROM conversation_threads WHERE thread_id = $1',
        [threadId]
      );

      if (threadCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
      }

      if (threadCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this thread'
        });
      }

      const context = await threadingService.getAgentContext(
        threadId,
        agentName,
        parseInt(contextDepth)
      );

      span.setAttributes({
        'thread.id': threadId,
        'agent.name': agentName,
        'context.depth': parseInt(contextDepth),
        'context.messages': context.messages.length
      });

      res.json({
        success: true,
        context
      });

    } catch (error) {
      console.error('[ConversationThreading] Get context error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to get agent context',
        details: error.message
      });
    }
  });
});

/**
 * POST /api/threading/:threadId/message
 * Add a message to the conversation thread
 */
router.post('/:threadId/message', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.add_message', async (span) => {
    try {
      const { threadId } = req.params;
      const { message, agentName, metadata = {} } = req.body;
      const userId = req.user.id;

      // Verify user has access to this thread
      const threadCheck = await db.query(
        'SELECT user_id FROM conversation_threads WHERE thread_id = $1',
        [threadId]
      );

      if (threadCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
      }

      if (threadCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this thread'
        });
      }

      if (!message || !message.content) {
        return res.status(400).json({
          success: false,
          error: 'Message content is required'
        });
      }

      const messageData = await threadingService.addMessage(
        threadId,
        {
          role: message.role || (agentName ? 'assistant' : 'user'),
          content: message.content,
          metadata,
          structured: message.structured,
          stateUpdates: message.stateUpdates
        },
        agentName
      );

      span.setAttributes({
        'thread.id': threadId,
        'message.id': messageData.id,
        'message.role': messageData.role,
        'agent.name': agentName || 'none'
      });

      res.json({
        success: true,
        message: messageData,
        threadId
      });

    } catch (error) {
      console.error('[ConversationThreading] Add message error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to add message to thread',
        details: error.message
      });
    }
  });
});

/**
 * POST /api/threading/:threadId/decision
 * Track an agent decision in the thread
 */
router.post('/:threadId/decision', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.track_decision', async (span) => {
    try {
      const { threadId } = req.params;
      const { agentName, decision, reasoning, context = {} } = req.body;
      const userId = req.user.id;

      // Verify user has access to this thread
      const threadCheck = await db.query(
        'SELECT user_id FROM conversation_threads WHERE thread_id = $1',
        [threadId]
      );

      if (threadCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
      }

      if (threadCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this thread'
        });
      }

      if (!agentName || !decision) {
        return res.status(400).json({
          success: false,
          error: 'agentName and decision are required'
        });
      }

      const decisionData = await threadingService.trackAgentDecision(
        threadId,
        agentName,
        decision,
        reasoning || 'Agent decision',
        context
      );

      span.setAttributes({
        'thread.id': threadId,
        'decision.id': decisionData.id,
        'agent.name': agentName,
        'decision.confidence': context.confidence || null
      });

      res.json({
        success: true,
        decision: decisionData
      });

    } catch (error) {
      console.error('[ConversationThreading] Track decision error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to track agent decision',
        details: error.message
      });
    }
  });
});

/**
 * POST /api/threading/:threadId/transfer
 * Transfer context between agents
 */
router.post('/:threadId/transfer', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.transfer_context', async (span) => {
    try {
      const { threadId } = req.params;
      const { fromAgent, toAgent, transferData = {} } = req.body;
      const userId = req.user.id;

      // Verify user has access to this thread
      const threadCheck = await db.query(
        'SELECT user_id FROM conversation_threads WHERE thread_id = $1',
        [threadId]
      );

      if (threadCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
      }

      if (threadCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this thread'
        });
      }

      if (!fromAgent || !toAgent) {
        return res.status(400).json({
          success: false,
          error: 'fromAgent and toAgent are required'
        });
      }

      const transfer = await threadingService.transferContext(
        threadId,
        fromAgent,
        toAgent,
        transferData
      );

      span.setAttributes({
        'thread.id': threadId,
        'transfer.id': transfer.id,
        'transfer.from_agent': fromAgent,
        'transfer.to_agent': toAgent
      });

      res.json({
        success: true,
        transfer
      });

    } catch (error) {
      console.error('[ConversationThreading] Transfer context error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to transfer context between agents',
        details: error.message
      });
    }
  });
});

/**
 * GET /api/threading/:threadId/analytics
 * Get comprehensive analytics for a conversation thread
 */
router.get('/:threadId/analytics', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.analytics', async (span) => {
    try {
      const { threadId } = req.params;
      const userId = req.user.id;

      // Verify user has access to this thread
      const threadCheck = await db.query(
        'SELECT user_id FROM conversation_threads WHERE thread_id = $1',
        [threadId]
      );

      if (threadCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
      }

      if (threadCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this thread'
        });
      }

      const analytics = await threadingService.getThreadAnalytics(threadId);

      span.setAttributes({
        'thread.id': threadId,
        'analytics.duration': analytics.basic.duration,
        'analytics.participants': analytics.basic.participantCount,
        'analytics.decisions': analytics.basic.decisionCount
      });

      res.json({
        success: true,
        analytics
      });

    } catch (error) {
      console.error('[ConversationThreading] Analytics error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to get thread analytics',
        details: error.message
      });
    }
  });
});

/**
 * GET /api/threading/user/threads
 * Get all threads for the authenticated user
 */
router.get('/user/threads', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.user_threads', async (span) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, active_only = false } = req.query;

      let sql = `
        SELECT 
          ct.thread_id,
          ct.conversation_id,
          ct.title,
          ct.participants,
          ct.metadata,
          ct.is_active,
          ct.created_at,
          ct.updated_at,
          COUNT(DISTINCT ctm.id) as message_count,
          COUNT(DISTINCT ctd.id) as decision_count,
          COUNT(DISTINCT cah.id) as handoff_count
        FROM conversation_threads ct
        LEFT JOIN conversation_thread_messages ctm ON ct.thread_id = ctm.thread_id
        LEFT JOIN conversation_thread_decisions ctd ON ct.thread_id = ctd.thread_id
        LEFT JOIN conversation_agent_handoffs cah ON ct.thread_id = cah.thread_id
        WHERE ct.user_id = $1
      `;

      const params = [userId];

      if (active_only === 'true') {
        sql += ` AND ct.is_active = true`;
      }

      sql += `
        GROUP BY ct.thread_id, ct.conversation_id, ct.title, ct.participants, ct.metadata, ct.is_active, ct.created_at, ct.updated_at
        ORDER BY ct.updated_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(parseInt(limit), parseInt(offset));

      const result = await db.query(sql, params);

      span.setAttributes({
        'user.id': userId,
        'threads.count': result.rows.length,
        'query.limit': parseInt(limit),
        'query.offset': parseInt(offset)
      });

      res.json({
        success: true,
        threads: result.rows,
        count: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

    } catch (error) {
      console.error('[ConversationThreading] User threads error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user threads',
        details: error.message
      });
    }
  });
});

/**
 * GET /api/threading/user/analytics
 * Get conversation threading analytics for the user
 */
router.get('/user/analytics', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.user_analytics', async (span) => {
    try {
      const userId = req.user.id;
      const { days = 30 } = req.query;

      const cutoffDate = new Date(Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000));

      // Get basic threading statistics
      const threadsQuery = `
        SELECT 
          COUNT(*) as total_threads,
          COUNT(CASE WHEN is_active THEN 1 END) as active_threads,
          AVG(jsonb_array_length(participants)) as avg_participants,
          MIN(created_at) as first_thread,
          MAX(updated_at) as last_activity
        FROM conversation_threads 
        WHERE user_id = $1 AND created_at >= $2
      `;

      const threadsResult = await db.query(threadsQuery, [userId, cutoffDate]);

      // Get message statistics
      const messagesQuery = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT agent) as unique_agents,
          AVG(processing_time_ms) as avg_processing_time
        FROM conversation_thread_messages ctm
        JOIN conversation_threads ct ON ctm.thread_id = ct.thread_id
        WHERE ct.user_id = $1 AND ctm.created_at >= $2
      `;

      const messagesResult = await db.query(messagesQuery, [userId, cutoffDate]);

      // Get decision statistics
      const decisionsQuery = `
        SELECT 
          COUNT(*) as total_decisions,
          AVG(confidence) as avg_confidence,
          COUNT(DISTINCT agent) as decision_making_agents
        FROM conversation_thread_decisions ctd
        JOIN conversation_threads ct ON ctd.thread_id = ct.thread_id
        WHERE ct.user_id = $1 AND ctd.created_at >= $2
      `;

      const decisionsResult = await db.query(decisionsQuery, [userId, cutoffDate]);

      // Get handoff statistics
      const handoffsQuery = `
        SELECT 
          COUNT(*) as total_handoffs,
          AVG(CASE WHEN handoff_success THEN 1.0 ELSE 0.0 END) as success_rate,
          COUNT(DISTINCT from_agent) as agents_initiating_handoffs,
          COUNT(DISTINCT to_agent) as agents_receiving_handoffs
        FROM conversation_agent_handoffs cah
        JOIN conversation_threads ct ON cah.thread_id = ct.thread_id
        WHERE ct.user_id = $1 AND cah.created_at >= $2
      `;

      const handoffsResult = await db.query(handoffsQuery, [userId, cutoffDate]);

      // Get agent participation
      const agentsQuery = `
        SELECT 
          agent,
          COUNT(*) as message_count,
          COUNT(DISTINCT ctm.thread_id) as thread_participation,
          AVG(processing_time_ms) as avg_response_time
        FROM conversation_thread_messages ctm
        JOIN conversation_threads ct ON ctm.thread_id = ct.thread_id
        WHERE ct.user_id = $1 AND ctm.created_at >= $2 AND agent IS NOT NULL
        GROUP BY agent
        ORDER BY message_count DESC
        LIMIT 10
      `;

      const agentsResult = await db.query(agentsQuery, [userId, cutoffDate]);

      const analytics = {
        period: {
          days: parseInt(days),
          start_date: cutoffDate.toISOString(),
          end_date: new Date().toISOString()
        },
        threads: threadsResult.rows[0] || {},
        messages: messagesResult.rows[0] || {},
        decisions: decisionsResult.rows[0] || {},
        handoffs: handoffsResult.rows[0] || {},
        agents: agentsResult.rows || []
      };

      span.setAttributes({
        'user.id': userId,
        'analytics.days': parseInt(days),
        'analytics.threads': analytics.threads.total_threads || 0,
        'analytics.messages': analytics.messages.total_messages || 0
      });

      res.json({
        success: true,
        analytics
      });

    } catch (error) {
      console.error('[ConversationThreading] User analytics error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user threading analytics',
        details: error.message
      });
    }
  });
});

/**
 * DELETE /api/threading/:threadId
 * Deactivate a conversation thread
 */
router.delete('/:threadId', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.deactivate', async (span) => {
    try {
      const { threadId } = req.params;
      const userId = req.user.id;

      // Verify user has access to this thread
      const threadCheck = await db.query(
        'SELECT user_id FROM conversation_threads WHERE thread_id = $1',
        [threadId]
      );

      if (threadCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Thread not found'
        });
      }

      if (threadCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this thread'
        });
      }

      // Deactivate the thread
      const updateQuery = `
        UPDATE conversation_threads 
        SET is_active = false, updated_at = NOW() 
        WHERE thread_id = $1
      `;

      await db.query(updateQuery, [threadId]);

      span.setAttributes({
        'thread.id': threadId,
        'user.id': userId
      });

      res.json({
        success: true,
        message: 'Thread deactivated successfully'
      });

    } catch (error) {
      console.error('[ConversationThreading] Deactivate error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate thread',
        details: error.message
      });
    }
  });
});

/**
 * GET /api/threading/stats
 * Get system-wide threading statistics (admin only for now)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  return traceOperation('threading.api.stats', async (span) => {
    try {
      const serviceStats = threadingService.getStats();

      // Get database statistics
      const dbStatsQuery = `
        SELECT 
          COUNT(DISTINCT thread_id) as total_threads,
          COUNT(DISTINCT user_id) as users_with_threads,
          SUM(jsonb_array_length(participants)) as total_agent_participations,
          COUNT(CASE WHEN is_active THEN 1 END) as active_threads
        FROM conversation_threads
      `;

      const dbStatsResult = await db.query(dbStatsQuery);

      const stats = {
        service: serviceStats,
        database: dbStatsResult.rows[0] || {},
        timestamp: new Date().toISOString()
      };

      span.setAttributes({
        'stats.active_threads': serviceStats.activeThreads,
        'stats.db_total_threads': stats.database.total_threads || 0
      });

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('[ConversationThreading] Stats error:', error);
      span.recordException(error);
      res.status(500).json({
        success: false,
        error: 'Failed to get threading statistics',
        details: error.message
      });
    }
  });
});

export default router;
