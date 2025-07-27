// packages/backend/src/routes/chatHistory.js
const express = require('express');
const { Pool } = require('pg');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// This endpoint is protected by the authenticateToken middleware
router.get('/history', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    // Fetch all messages for the logged-in user from the conversations table
    // NOTE: This assumes you have a 'conversations' table with 'user_id', 'speaker', and 'text' columns.
    // The messages are ordered by their creation time to ensure correct sequence.
    const historyResult = await pool.query(
      'SELECT speaker, text FROM conversations WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );

    res.json(historyResult.rows);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ message: 'Server error while fetching chat history.' });
  }
});

module.exports = router;
