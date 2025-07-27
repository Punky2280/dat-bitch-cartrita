// packages/backend/src/routes/user.js
const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Middleware to protect all routes in this file
router.use(authenticateToken);

// GET endpoint to fetch current user's data
router.get('/me', async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json(userResult.rows[0]);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT endpoint to update user's name
router.put('/me', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Name is required.' });
  }

  try {
    const updatedUser = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email',
      [name, req.user.userId]
    );
    res.json({ message: 'Profile updated successfully.', user: updatedUser.rows[0] });
  } catch (error) {
    console.error('Error updating user name:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT endpoint to update user's password
router.put('/me/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }

  try {
    // First, get the current user's hashed password from the DB
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = userResult.rows[0];

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password.' });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the password in the database
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedNewPassword, req.user.userId]);

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
