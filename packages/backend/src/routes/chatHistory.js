const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const db = require('../db');
const router = express.Router();

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
      `SELECT id, speaker, text, model, created_at 
       FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
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
         COUNT(*) as total_messages,
         COUNT(CASE WHEN speaker = 'user' THEN 1 END) as user_messages,
         COUNT(CASE WHEN speaker = 'cartrita' THEN 1 END) as cartrita_messages,
         MIN(created_at) as first_conversation,
         MAX(created_at) as latest_conversation
       FROM conversations 
       WHERE user_id = $1`,
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

module.exports = router;
