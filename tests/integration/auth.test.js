/**
 * @fileoverview API Integration Tests - Authentication Endpoints
 * Comprehensive testing of user authentication and authorization
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import TestDatabase from '../utils/TestDatabase.js';
import APITestClient from '../utils/APITestClient.js';
import MockServices from '../utils/MockServices.js';
import app from '../../packages/backend/src/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Authentication API Integration Tests', () => {
  let testDb;
  let apiClient;
  let mockServices;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.initialize();
    
    mockServices = new MockServices();
    apiClient = new APITestClient(app, testDb);
    
    console.log('✅ Auth API test environment initialized');
  });

  afterAll(async () => {
    await testDb.cleanup();
    mockServices.resetAll();
    console.log('✅ Auth API test environment cleaned up');
  });

  beforeEach(async () => {
    await testDb.clearData();
    mockServices.resetAll();
  });

  describe('POST /api/auth/register', () => {
    test('should register new user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'SecurePassword123!'
      };

      const response = await apiClient.post('/api/auth/register', userData, 201);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('token');
      
      const { user, token } = data;
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('password_hash');
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret');
      expect(decoded.userId).toBe(user.id);
      expect(decoded.email).toBe(user.email);

      // Verify user stored in database
      const userCount = await testDb.getTableCount('users');
      expect(userCount).toBe(1);
      
      // Verify password is hashed
      const dbUser = await testDb.query(
        'SELECT password_hash FROM users WHERE email = $1',
        [userData.email]
      );
      expect(dbUser.rows[0].password_hash).toBeDefined();
      expect(dbUser.rows[0].password_hash).not.toBe(userData.password);
      
      // Verify password hash is valid
      const isValidPassword = await bcrypt.compare(userData.password, dbUser.rows[0].password_hash);
      expect(isValidPassword).toBe(true);
    });

    test('should reject registration with duplicate email', async () => {
      const userData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'Password123!'
      };

      // Register first user
      await apiClient.post('/api/auth/register', userData, 201);

      // Try to register with same email
      const duplicateData = {
        name: 'Jane Duplicate',
        email: 'jane@example.com',
        password: 'DifferentPassword123!'
      };

      const response = await apiClient.post('/api/auth/register', duplicateData, 400);
      apiClient.validateErrorResponse(response, 'Email already exists');
    });

    test('should validate required fields', async () => {
      const incompleteData = {
        name: 'John Doe'
        // Missing email and password
      };

      const response = await apiClient.post('/api/auth/register', incompleteData, 400);
      apiClient.validateErrorResponse(response);
    });

    test('should validate email format', async () => {
      const invalidEmailData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123!'
      };

      const response = await apiClient.post('/api/auth/register', invalidEmailData, 400);
      apiClient.validateErrorResponse(response, 'Invalid email format');
    });

    test('should validate password strength', async () => {
      const weakPasswordData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123' // Too weak
      };

      const response = await apiClient.post('/api/auth/register', weakPasswordData, 400);
      apiClient.validateErrorResponse(response, 'Password too weak');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      // Create test user with known password
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const testUser = await testDb.createTestUser({
        name: 'Test User',
        email: 'testuser@example.com',
        password_hash: hashedPassword
      });

      const loginData = {
        email: testUser.email,
        password: password
      };

      const response = await apiClient.post('/api/auth/login', loginData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('token');
      
      const { user, token } = data;
      expect(user.id).toBe(testUser.id);
      expect(user.email).toBe(testUser.email);
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('password_hash');
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret');
      expect(decoded.userId).toBe(user.id);
    });

    test('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'AnyPassword123!'
      };

      const response = await apiClient.post('/api/auth/login', loginData, 401);
      apiClient.validateErrorResponse(response, 'Invalid credentials');
    });

    test('should reject login with invalid password', async () => {
      const password = 'CorrectPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const testUser = await testDb.createTestUser({
        email: 'testuser@example.com',
        password_hash: hashedPassword
      });

      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!'
      };

      const response = await apiClient.post('/api/auth/login', loginData, 401);
      apiClient.validateErrorResponse(response, 'Invalid credentials');
    });

    test('should validate required fields', async () => {
      const incompleteData = {
        email: 'test@example.com'
        // Missing password
      };

      const response = await apiClient.post('/api/auth/login', incompleteData, 400);
      apiClient.validateErrorResponse(response);
    });
  });

  describe('GET /api/auth/profile', () => {
    test('should get authenticated user profile', async () => {
      const testUser = await testDb.createTestUser({
        name: 'Profile Test User',
        email: 'profiletest@example.com'
      });

      await apiClient.authenticate(testUser);

      const response = await apiClient.get('/api/auth/profile');
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data.id).toBe(testUser.id);
      expect(data.name).toBe(testUser.name);
      expect(data.email).toBe(testUser.email);
      expect(data).not.toHaveProperty('password');
      expect(data).not.toHaveProperty('password_hash');
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/auth/profile');
    });
  });

  describe('PUT /api/auth/profile', () => {
    test('should update user profile', async () => {
      const testUser = await testDb.createTestUser({
        name: 'Original Name',
        email: 'original@example.com'
      });

      await apiClient.authenticate(testUser);

      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      const response = await apiClient.put('/api/auth/profile', updateData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data.name).toBe(updateData.name);
      expect(data.email).toBe(updateData.email);

      // Verify update in database
      const dbUser = await testDb.query(
        'SELECT name, email FROM users WHERE id = $1',
        [testUser.id]
      );
      expect(dbUser.rows[0].name).toBe(updateData.name);
      expect(dbUser.rows[0].email).toBe(updateData.email);
    });

    test('should prevent duplicate email updates', async () => {
      // Create two users
      const user1 = await testDb.createTestUser({
        email: 'user1@example.com'
      });

      const user2 = await testDb.createTestUser({
        email: 'user2@example.com'
      });

      await apiClient.authenticate(user1);

      // Try to update to user2's email
      const updateData = {
        email: 'user2@example.com'
      };

      const response = await apiClient.put('/api/auth/profile', updateData, 400);
      apiClient.validateErrorResponse(response, 'Email already exists');
    });

    test('should validate email format in updates', async () => {
      const testUser = await testDb.createTestUser();
      await apiClient.authenticate(testUser);

      const updateData = {
        email: 'invalid-email-format'
      };

      const response = await apiClient.put('/api/auth/profile', updateData, 400);
      apiClient.validateErrorResponse(response, 'Invalid email format');
    });

    test('should require authentication', async () => {
      const updateData = { name: 'New Name' };
      await apiClient.testAuthRequired('/api/auth/profile', 'PUT', updateData);
    });
  });

  describe('POST /api/auth/change-password', () => {
    test('should change password with valid current password', async () => {
      const currentPassword = 'CurrentPassword123!';
      const newPassword = 'NewPassword456!';
      const hashedCurrentPassword = await bcrypt.hash(currentPassword, 10);
      
      const testUser = await testDb.createTestUser({
        password_hash: hashedCurrentPassword
      });

      await apiClient.authenticate(testUser);

      const changeData = {
        currentPassword: currentPassword,
        newPassword: newPassword
      };

      const response = await apiClient.post('/api/auth/change-password', changeData);
      
      apiClient.validateSuccessResponse(response);

      // Verify new password is stored
      const dbUser = await testDb.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [testUser.id]
      );
      
      const isValidNewPassword = await bcrypt.compare(newPassword, dbUser.rows[0].password_hash);
      expect(isValidNewPassword).toBe(true);
      
      const isOldPasswordStillValid = await bcrypt.compare(currentPassword, dbUser.rows[0].password_hash);
      expect(isOldPasswordStillValid).toBe(false);
    });

    test('should reject change with invalid current password', async () => {
      const currentPassword = 'CurrentPassword123!';
      const hashedCurrentPassword = await bcrypt.hash(currentPassword, 10);
      
      const testUser = await testDb.createTestUser({
        password_hash: hashedCurrentPassword
      });

      await apiClient.authenticate(testUser);

      const changeData = {
        currentPassword: 'WrongCurrentPassword!',
        newPassword: 'NewPassword456!'
      };

      const response = await apiClient.post('/api/auth/change-password', changeData, 400);
      apiClient.validateErrorResponse(response, 'Current password is incorrect');
    });

    test('should validate new password strength', async () => {
      const currentPassword = 'CurrentPassword123!';
      const hashedCurrentPassword = await bcrypt.hash(currentPassword, 10);
      
      const testUser = await testDb.createTestUser({
        password_hash: hashedCurrentPassword
      });

      await apiClient.authenticate(testUser);

      const changeData = {
        currentPassword: currentPassword,
        newPassword: '123' // Too weak
      };

      const response = await apiClient.post('/api/auth/change-password', changeData, 400);
      apiClient.validateErrorResponse(response, 'New password too weak');
    });

    test('should require authentication', async () => {
      const changeData = {
        currentPassword: 'current123!',
        newPassword: 'new123!'
      };
      await apiClient.testAuthRequired('/api/auth/change-password', 'POST', changeData);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout authenticated user', async () => {
      const testUser = await testDb.createTestUser();
      await apiClient.authenticate(testUser);

      const response = await apiClient.post('/api/auth/logout');
      
      apiClient.validateSuccessResponse(response);
      
      // Note: In a real implementation, this might invalidate the token
      // by adding it to a blacklist or using token versioning
    });

    test('should work without authentication (idempotent)', async () => {
      // Logout should be idempotent - not fail if already logged out
      const response = await apiClient.post('/api/auth/logout');
      apiClient.validateSuccessResponse(response);
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should refresh valid token', async () => {
      const testUser = await testDb.createTestUser();
      const { token } = await apiClient.authenticate(testUser);

      const refreshData = { token };

      const response = await apiClient.post('/api/auth/refresh', refreshData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data).toHaveProperty('token');
      expect(data.token).not.toBe(token); // Should be a new token
      
      // Verify new token is valid
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'test-jwt-secret');
      expect(decoded.userId).toBe(testUser.id);
    });

    test('should reject invalid token', async () => {
      const refreshData = { token: 'invalid.jwt.token' };

      const response = await apiClient.post('/api/auth/refresh', refreshData, 401);
      apiClient.validateErrorResponse(response, 'Invalid token');
    });

    test('should reject expired token', async () => {
      // Create an expired token
      const testUser = await testDb.createTestUser();
      const expiredToken = jwt.sign(
        { userId: testUser.id, email: testUser.email },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const refreshData = { token: expiredToken };

      const response = await apiClient.post('/api/auth/refresh', refreshData, 401);
      apiClient.validateErrorResponse(response, 'Token expired');
    });
  });

  describe('Token Validation Middleware', () => {
    test('should accept valid Bearer token', async () => {
      const testUser = await testDb.createTestUser();
      await apiClient.authenticate(testUser);

      // Test any authenticated endpoint
      const response = await apiClient.get('/api/auth/profile');
      apiClient.validateSuccessResponse(response);
    });

    test('should reject malformed Authorization header', async () => {
      // Test with custom header (not Bearer format)
      const response = await apiClient.customRequest('GET', '/api/auth/profile', {
        headers: { Authorization: 'InvalidFormat token' },
        expectedStatus: 401
      });

      apiClient.validateErrorResponse(response, 'Invalid authorization format');
    });

    test('should reject missing Authorization header', async () => {
      await apiClient.testAuthRequired('/api/auth/profile');
    });

    test('should handle token for non-existent user', async () => {
      // Create token for non-existent user
      const fakeToken = jwt.sign(
        { userId: 99999, email: 'fake@example.com' },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h' }
      );

      const response = await apiClient.customRequest('GET', '/api/auth/profile', {
        headers: { Authorization: `Bearer ${fakeToken}` },
        expectedStatus: 401
      });

      apiClient.validateErrorResponse(response, 'User not found');
    });
  });
});
