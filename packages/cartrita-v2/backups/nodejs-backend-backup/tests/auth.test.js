/**
 * Authentication endpoint tests
 * Tests registration, login, token verification, and admin endpoints
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../src/server.js';
import db from '../src/db.js';

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

describe('Authentication Endpoints', () => {
  let testUserId;
  let adminUserId;
  let userToken;
  let adminToken;

  beforeAll(async () => {
    // Create test database tables if they don't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clean up any existing test users
    await db.query("DELETE FROM users WHERE email LIKE '%@test.com'");
  });

  afterAll(async () => {
    // Clean up test data
    await db.query("DELETE FROM users WHERE email LIKE '%@test.com'");
    await db.end();
  });

  beforeEach(async () => {
    // Clean up between tests
    await db.query("DELETE FROM users WHERE email LIKE '%@test.com'");
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'user@test.com',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('user');
      expect(response.body.user.is_admin).toBe(false);
      expect(response.body.token).toBeDefined();

      // Verify token contains correct claims
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.sub).toBeDefined();
      expect(decoded.email).toBe(userData.email);
      expect(decoded.role).toBe('user');
      expect(decoded.is_admin).toBe(false);
      expect(decoded.iss).toBe('cartrita-auth');
      expect(decoded.aud).toBe('cartrita-clients');

      testUserId = response.body.user.id;
      userToken = response.body.token;
    });

    test('should register admin user for admin email patterns', async () => {
      const adminData = {
        name: 'Admin User',
        email: 'admin@cartrita.com',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(adminData)
        .expect(201);

      expect(response.body.user.role).toBe('admin');
      expect(response.body.user.is_admin).toBe(true);

      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded.role).toBe('admin');
      expect(decoded.is_admin).toBe(true);

      adminUserId = response.body.user.id;
      adminToken = response.body.token;
    });

    test('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    test('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@test.com',
          password: '123',
        })
        .expect(400);

      expect(response.body.error).toContain('8 characters');
    });

    test('should reject duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@test.com',
        password: 'password123',
      };

      // First registration
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create test user for login tests
      const hashedPassword = await bcrypt.hash('password123', 12);
      const result = await db.query(
        'INSERT INTO users (name, email, password_hash, role, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        ['Test User', 'login@test.com', hashedPassword, 'user', false]
      );
      testUserId = result.rows[0].id;
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('login@test.com');
      expect(response.body.token).toBeDefined();

      userToken = response.body.token;
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@test.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/verify', () => {
    beforeEach(async () => {
      // Create a valid token for testing
      userToken = jwt.sign(
        {
          sub: 1,
          name: 'Test User',
          email: 'verify@test.com',
          role: 'user',
          is_admin: false,
          iss: 'cartrita-auth',
          aud: 'cartrita-clients',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    test('should verify valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('verify@test.com');
      expect(response.body.user.role).toBe('user');
    });

    test('should reject missing token', async () => {
      const response = await request(app).get('/api/auth/verify').expect(401);

      expect(response.body.error).toContain('No token provided');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Admin Endpoints', () => {
    beforeEach(async () => {
      // Create admin token
      adminToken = jwt.sign(
        {
          sub: 1,
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'admin',
          is_admin: true,
          iss: 'cartrita-auth',
          aud: 'cartrita-clients',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Create regular user token
      userToken = jwt.sign(
        {
          sub: 2,
          name: 'Regular User',
          email: 'user@test.com',
          role: 'user',
          is_admin: false,
          iss: 'cartrita-auth',
          aud: 'cartrita-clients',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Create test users in database
      await db.query(`
        INSERT INTO users (id, name, email, password_hash, role, is_admin) VALUES 
        (1, 'Admin User', 'admin@test.com', 'hash', 'admin', true),
        (2, 'Regular User', 'user@test.com', 'hash', 'user', false)
        ON CONFLICT (id) DO NOTHING
      `);
    });

    afterEach(async () => {
      await db.query('DELETE FROM users WHERE id IN (1, 2)');
    });

    describe('POST /api/auth/admin/validate-all', () => {
      test('should validate all users with admin token', async () => {
        const response = await request(app)
          .post('/api/auth/admin/validate-all')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.total).toBeGreaterThan(0);
        expect(response.body.summary).toBeInstanceOf(Array);
        expect(response.body.issues).toBeInstanceOf(Array);
      });

      test('should reject non-admin user', async () => {
        const response = await request(app)
          .post('/api/auth/admin/validate-all')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.error).toContain('admin only');
      });

      test('should reject unauthenticated request', async () => {
        const response = await request(app)
          .post('/api/auth/admin/validate-all')
          .expect(401);

        expect(response.body.error).toContain('Unauthorized');
      });
    });

    describe('POST /api/auth/admin/reissue', () => {
      test('should reissue tokens for specified users', async () => {
        const response = await request(app)
          .post('/api/auth/admin/reissue')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ user_ids: [1, 2] })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.tokens).toBeInstanceOf(Array);
        expect(response.body.tokens.length).toBe(2);

        // Verify tokens are valid
        for (const tokenData of response.body.tokens) {
          expect(tokenData.token).toBeDefined();
          const decoded = jwt.verify(tokenData.token, process.env.JWT_SECRET);
          expect(decoded.sub).toBeDefined();
          expect(decoded.iss).toBe('cartrita-auth');
        }
      });

      test('should reject request without user_ids', async () => {
        const response = await request(app)
          .post('/api/auth/admin/reissue')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(400);

        expect(response.body.error).toContain('user_ids array required');
      });

      test('should reject non-admin user', async () => {
        const response = await request(app)
          .post('/api/auth/admin/reissue')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ user_ids: [1] })
          .expect(403);

        expect(response.body.error).toContain('admin only');
      });
    });
  });

  describe('Global Auth Middleware', () => {
    test('should protect /api routes with valid token', async () => {
      const token = jwt.sign(
        {
          sub: 1,
          name: 'Test User',
          email: 'test@test.com',
          role: 'user',
          is_admin: false,
          iss: 'cartrita-auth',
          aud: 'cartrita-clients',
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Test protected route (assuming /api/models/catalog exists)
      const response = await request(app)
        .get('/api/models/catalog')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject /api routes without token', async () => {
      const response = await request(app)
        .get('/api/models/catalog')
        .expect(401);

      expect(response.body.error).toContain('Unauthorized');
    });

    test('should allow public auth endpoints without token', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
    });
  });
});
