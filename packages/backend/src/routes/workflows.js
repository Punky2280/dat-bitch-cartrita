// packages/backend/src/routes/workflows.js
const express = require('express');
const { Pool } = require('pg');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Protect all workflow routes
router.use(authenticateToken);

// GET all workflows for the logged-in user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, updated_at FROM workflows WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ message: 'Server error while fetching workflows.' });
  }
});

// POST a new workflow for the logged-in user
router.post('/', async (req, res) => {
  const { name, definition } = req.body;
  if (!name || !definition || !Array.isArray(definition)) {
    return res.status(400).json({ message: 'Workflow name and a valid definition array are required.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO workflows (user_id, name, definition) VALUES ($1, $2, $3) RETURNING *',
      [req.user.userId, name, JSON.stringify(definition)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ message: 'Server error while creating workflow.' });
  }
});

// GET a single workflow by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Workflow not found.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching workflow:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT (update) a workflow by ID
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, definition } = req.body;
    if (!name || !definition || !Array.isArray(definition)) {
        return res.status(400).json({ message: 'Workflow name and a valid definition array are required.' });
    }

    try {
        const result = await pool.query(
            'UPDATE workflows SET name = $1, definition = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
            [name, JSON.stringify(definition), id, req.user.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Workflow not found or you do not have permission to edit it.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// DELETE a workflow by ID
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM workflows WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Workflow not found or you do not have permission to delete it.' });
        }
        res.status(204).send(); // 204 No Content for successful deletion
    } catch (error) {
        console.error('Error deleting workflow:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});


module.exports = router;
