const express = require('express');
const bcrypt = require('bcrypt');
const authenticateToken = require('../middleware/authenticateToken');
const db = require('../db');
const router = express.Router();

// Test route to verify user routes are loading
router.get('/test', (req, res) => {
  console.log('[UserRoute] 🧪 Test route hit');
  res.json({ message: 'User routes are working', timestamp: new Date().toISOString() });
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    console.log('[UserRoute] 🚀 GET /me endpoint hit');
    console.log('[UserRoute] 🔍 req.user exists:', !!req.user);
    
    if (!req.user || !req.user.id) {
      console.log('[UserRoute] ❌ No user object or user ID in request');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const userId = req.user.id;
    console.log('[UserRoute] 🔍 Looking up user with ID:', userId, 'typeof:', typeof userId);
    console.log('[UserRoute] 🔍 req.user object:', JSON.stringify(req.user));

    // Test database connection first
    try {
      await db.query('SELECT 1');
      console.log('[UserRoute] ✅ Database connection test passed');
    } catch (dbError) {
      console.error('[UserRoute] ❌ Database connection test failed:', dbError);
      return res.status(500).json({ message: 'Database connection error' });
    }

    const result = await db.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    console.log('[UserRoute] 🔍 Database query result:', result.rows.length, 'rows');
    console.log('[UserRoute] 🔍 Raw result:', JSON.stringify(result.rows));

    if (result.rows.length === 0) {
      console.log('[UserRoute] ❌ No user found with ID:', userId);
      
      // Check if any users exist with similar ID
      const allUsers = await db.query('SELECT id, name, email FROM users ORDER BY id');
      console.log('[UserRoute] 🔍 All users in database:', JSON.stringify(allUsers.rows));
      
      return res.status(404).json({ 
        message: 'User not found',
        details: 'Your session is valid but your user account no longer exists. Please log in again.',
        code: 'USER_NOT_FOUND_IN_DB',
        userId: userId,
        totalUsers: allUsers.rows.length
      });
    }

    console.log('[UserRoute] ✅ User found, returning profile');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[UserRoute] ❌ Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile', error: error.message });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    if (!name && !email) {
      return res
        .status(400)
        .json({ message: 'Name or email is required for update' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (email) {
      // Check if email is already taken by another user
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ message: 'Email already in use' });
      }

      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    values.push(userId);

    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount} 
       RETURNING id, name, email, updated_at`,
      values
    );

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Failed to update user profile' });
  }
});

// Update password
router.put('/me/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Current password and new password are required' });
    }

    // Get current password hash
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );
    if (!validPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Failed to update password' });
  }
});

// Temporary fix endpoint to create missing user 6 (Robert Allen)
router.post('/fix-missing-user', async (req, res) => {
  try {
    console.log('[UserRoute] 🔧 Attempting to fix missing user issue...');
    
    // Check if user 6 exists
    const existing = await db.query('SELECT id FROM users WHERE id = 6');
    
    if (existing.rows.length > 0) {
      return res.json({ message: 'User 6 already exists', user: existing.rows[0] });
    }
    
    // Create user 6 (Robert Allen)
    const result = await db.query(
      `INSERT INTO users (id, name, email, password_hash, created_at, updated_at) 
       VALUES (6, 'Robert Allen', 'robert@example.com', $1, NOW(), NOW()) 
       RETURNING id, name, email, created_at`,
      ['$2b$10$rHzq8QQjQHfQjKjQHfQjKjQHfQjKe'] // placeholder password hash
    );
    
    // Update sequence
    await db.query("SELECT setval('users_id_seq', GREATEST(6, (SELECT COALESCE(MAX(id), 0) FROM users)))");
    
    console.log('[UserRoute] ✅ Created missing user:', result.rows[0]);
    res.json({ message: 'User 6 created successfully', user: result.rows[0] });
  } catch (error) {
    console.error('[UserRoute] ❌ Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
