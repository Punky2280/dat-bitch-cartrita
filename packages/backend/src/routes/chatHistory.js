import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
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
              c.title as conversation_title
       FROM conversation_messages cm
       JOIN conversations c ON c.id = cm.conversation_id
       WHERE c.user_id = $1 
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
    res.status(500).json({ message: 'Failed to fetch chat history' });
  }
});

// GET /api/chat/structured - retrieve structured outputs with optional task/status filters & pagination
router.get('/structured', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ error: 'Missing userId in request context' });
    const { task, status } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const params = [userId];
    let filterSql = '';
    if (task) { params.push(task); filterSql += ` AND (cm.metadata->'structured')::jsonb @> to_jsonb(ARRAY[json_build_object('task', $${params.length})]::json)`; }
    if (status) { params.push(status); filterSql += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements(cm.metadata->'structured') elem WHERE elem->>'status' = $${params.length})`; }
    params.push(limit, offset);
    const sql = `SELECT cm.id, cm.created_at, cm.metadata->'structured' AS structured
                 FROM conversation_messages cm
                 JOIN conversations c ON c.id = cm.conversation_id
                 WHERE c.user_id = $1 AND cm.role = 'assistant' AND cm.metadata ? 'structured' ${filterSql}
                 ORDER BY cm.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`;
    const result = await db.query(sql, params);
    res.json({ success: true, count: result.rows.length, limit, offset, data: result.rows });
  } catch (err) {
    console.error('[ChatHistory] ❌ Error fetching structured outputs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch structured outputs' });
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
