// create-user.js
// Script to create a user and generate a fresh token for testing

require('dotenv').config({ path: './packages/backend/.env' });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'robert',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
  port: process.env.POSTGRES_PORT || 5432,
});

async function createUserAndToken() {
  try {
    console.log('🔌 Connecting to database...');

    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');

    // User details
    const username = 'testuser';
    const email = 'test@cartrita.dev';
    const password = 'test123456';

    console.log('🔐 Hashing password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    console.log('👤 Creating user...');

    // Check if user table exists and create if needed
    const createUserTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createUserTableQuery);
    console.log('✅ User table ready');

    // Delete existing user if exists
    await pool.query('DELETE FROM users WHERE username = $1 OR email = $2', [
      username,
      email,
    ]);

    // Insert new user
    const insertUserQuery = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, created_at;
    `;

    const result = await pool.query(insertUserQuery, [
      username,
      email,
      hashedPassword,
    ]);
    const user = result.rows[0];

    console.log('✅ User created successfully:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Created: ${user.created_at}`);

    console.log('🔑 Generating JWT token...');

    // Generate JWT token
    const tokenPayload = {
      user_id: user.id,
      username: user.username,
      email: user.email,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    console.log('✅ JWT Token generated successfully!');
    console.log('');
    console.log('📋 User Credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Email: ${email}`);
    console.log('');
    console.log('🔑 JWT Token:');
    console.log(token);
    console.log('');
    console.log('📝 Token Details:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Expires: 24 hours from now`);
    console.log('');
    console.log('🧪 Test Commands:');
    console.log(
      `   curl -H "Authorization: Bearer ${token}" http://localhost:8001/api/health`
    );
    console.log('');
    console.log('🌐 Frontend Usage:');
    console.log(`   localStorage.setItem('token', '${token}');`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('');
    console.log('🔒 Database connection closed');
  }
}

createUserAndToken();
