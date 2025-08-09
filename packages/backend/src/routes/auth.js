/* global process, console */
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db from '../db.js';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    console.log('[Auth] Registration request body:', req.body);
    const { username, name, email, password } = req.body;

    // Accept either 'username' or 'name' field
    const finalUsername = username || name;

    // Basic validation
    if (!finalUsername || !email || !password) {
      return res.status(400).json({
        error: 'Name/username, email, and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters',
      });
    }

    // More reasonable password validation - at least 8 characters with some complexity
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLetter || !hasNumber) {
      return res.status(400).json({
        error: 'Password must contain at least one letter and one number',
      });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Username or email already exists',
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [finalUsername, email, hashedPassword]
    );

    const user = result.rows[0];

    // Generate JWT token (registration)
    const token = jwt.sign(
      {
        sub: user.id, // Standard JWT subject claim
        name: user.name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[Auth] User registered: ${finalUsername} (ID: ${user.id})`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({
      error: 'Internal server error during registration',
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    console.log('[Auth] Login request body:', req.body);
    const { username, email, password } = req.body;

    // Accept either username or email as login identifier
    const loginIdentifier = email || username;

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        error: 'Email/username and password are required',
      });
    }

    // Find user
    const result = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [loginIdentifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Generate JWT token (login)
    const token = jwt.sign(
      {
        sub: user.id, // Standard JWT subject claim
        name: user.name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[Auth] User logged in: ${user.name} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      error: 'Internal server error during login',
    });
  }
});

// Verify token endpoint
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      error: 'No token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      success: true,
      user: {
        id: decoded.sub,
        username: decoded.name,
        email: decoded.email,
      },
    });
  } catch (error) {
    res.status(401).json({
      error: 'Invalid token',
    });
  }
});

// Emergency fix endpoint to create missing user 6 (Robert Allen)
router.post('/fix-user', async (req, res) => {
  try {
    console.log('[Auth] 🔧 Emergency fix: Creating missing user 6...');

    // Check if user 6 exists
    const existing = await db.query(
      'SELECT id, username, email FROM users WHERE id = 6'
    );

    if (existing.rows.length > 0) {
      console.log('[Auth] ✅ User 6 already exists:', existing.rows[0]);
      return res.json({
        message: 'User 6 already exists',
        user: existing.rows[0],
      });
    }

    // Create user 6 (Robert Allen)
    const result = await db.query(
      `INSERT INTO users (id, username, email, password_hash, created_at, updated_at) 
       VALUES (6, 'Robert Allen', 'robert@example.com', $1, NOW(), NOW()) 
       RETURNING id, username, email, created_at`,
      ['$2b$10$rHzq8QQjQHfQjKjQHfQjKe'] // placeholder password hash
    );

    // Update sequence
    await db.query(
      "SELECT setval('users_id_seq', GREATEST(6, (SELECT COALESCE(MAX(id), 0) FROM users)))"
    );
    console.log('[Auth] ✅ Created missing user:', result.rows[0]);
    res.json({ message: 'User 6 created successfully', user: result.rows[0] });
  } catch (error) {
    console.error('[Auth] ❌ Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
