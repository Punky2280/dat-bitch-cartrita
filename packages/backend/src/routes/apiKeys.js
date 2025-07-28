// packages/backend/src/routes/apiKeys.js
const express = require('express');
const { Pool } = require('pg');
const authenticateToken = require('../middleware/authenticateToken');
const EncryptionService = require('../system/EncryptionService');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Protect all routes in this file
router.use(authenticateToken);

// GET all saved API keys (names only, not the keys themselves)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, service_name, updated_at FROM user_api_keys WHERE user_id = $1',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ message: 'Server error while fetching API keys.' });
  }
});

// POST a new API key (will be encrypted)
router.post('/', async (req, res) => {
  const { service_name, api_key } = req.body;
  if (!service_name || !api_key) {
    return res.status(400).json({ message: 'Service name and API key are required.' });
  }

  try {
    const encryptedKey = EncryptionService.encrypt(api_key);
    
    // Using ON CONFLICT to handle both INSERT and UPDATE in one query (upsert)
    const result = await pool.query(
      `INSERT INTO user_api_keys (user_id, service_name, key_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, service_name)
       DO UPDATE SET key_data = EXCLUDED.key_data, updated_at = NOW()
       RETURNING id, service_name, updated_at`,
      [req.user.userId, service_name, encryptedKey]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving API key:', error);
    res.status(500).json({ message: 'Server error while saving API key.' });
  }
});

// DELETE an API key by ID
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM user_api_keys WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'API key not found or you do not have permission to delete it.' });
        }
        res.status(204).send(); // 204 No Content for successful deletion
    } catch (error) {
        console.error('Error deleting API key:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
