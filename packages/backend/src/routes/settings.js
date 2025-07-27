const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db.js');

const router = express.Router();

/**
 * @route   GET /api/settings/profile
 * @desc    Get user profile information
 * @access  Private
 */
router.get('/profile', async (req, res) => {
  try {
    const userQuery = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(userQuery.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * @route   PUT /api/settings/profile
 * @desc    Update user profile information (name)
 * @access  Private
 */
router.put('/profile', async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ msg: 'Name cannot be empty' });
  }

  try {
    const updatedUser = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email',
      [name, req.user.id]
    );

    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({ msg: 'Profile updated successfully', user: updatedUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * @route   PUT /api/settings/password
 * @desc    Change user password
 * @access  Private
 */
router.put('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ msg: 'Please provide both current and new passwords' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ msg: 'New password must be at least 6 characters long' });
  }

  try {
    // 1. Get user from DB
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }
    const user = userResult.rows[0];

    // 2. Check if current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Incorrect current password' });
    }

    // 3. Hash new password and update DB
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({ msg: 'Password updated successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


module.exports = router;