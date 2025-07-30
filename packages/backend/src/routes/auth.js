const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db'); // Assuming this correctly points to your database pool
const router = express.Router();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );

    const user = result.rows[0];

    // --- FIX: Changed 'userId' to the standard 'sub' claim ---
    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name }, // Use 'sub' for user ID
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    // Find user
    const result = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // --- FIX: Changed 'userId' to the standard 'sub' claim ---
    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name }, // Use 'sub' for user ID
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//  Emergency fix endpoint to create missing user 6 (Robert Allen)
router.post('/fix-user', async (req, res) => {
  try {
    console.log('[Auth] 🔧 Emergency fix: Creating missing user 6...');
    
    // Check if user 6 exists
    const existing = await db.query('SELECT id, name, email FROM users WHERE id = 6');
    
    if (existing.rows.length > 0) {
      console.log('[Auth] ✅ User 6 already exists:', existing.rows[0]);
      return res.json({ message: 'User 6 already exists', user: existing.rows[0] });
    }
    
    // Create user 6 (Robert Allen)
    const result = await db.query(
      `INSERT INTO users (id, name, email, password_hash, created_at, updated_at) 
       VALUES (6, 'Robert Allen', 'robert@example.com', $1, NOW(), NOW()) 
       RETURNING id, name, email, created_at`,
      ['$2b$10$rHzq8QQjQHfQjKjQHfQjKe'] // placeholder password hash
    );
    
    // Update sequence
    await db.query("SELECT setval('users_id_seq', GREATEST(6, (SELECT COALESCE(MAX(id), 0) FROM users)))");
    
    console.log('[Auth] ✅ Created missing user:', result.rows[0]);
    res.json({ message: 'User 6 created successfully', user: result.rows[0] });
  } catch (error) {
    console.error('[Auth] ❌ Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
