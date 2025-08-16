/**
 * @fileoverview APITestClient - HTTP client for integration testing
 * Provides authenticated API testing with session management and response validation
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

class APITestClient {
  constructor(app, testDatabase) {
    this.app = app;
    this.testDatabase = testDatabase;
    this.authToken = null;
    this.currentUser = null;
    this.baseRequest = request(app);
  }

  /**
   * Authenticate with test user credentials
   */
  async authenticate(user = null) {
    if (!user) {
      // Create a test user if none provided
      user = await this.testDatabase.createTestUser({
        name: 'API Test User',
        email: `apitest${Date.now()}@example.com`
      });
    }

    // Generate JWT token for authentication
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name 
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h' }
    );

    this.authToken = token;
    this.currentUser = user;
    
    console.log(`✅ Authenticated as: ${user.email}`);
    return { token, user };
  }

  /**
   * Create authenticated request
   */
  request() {
    const req = request(this.app);
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }
    return req;
  }

  /**
   * GET request with authentication
   */
  async get(path, expectedStatus = 200) {
    const response = await this.request().get(path).expect(expectedStatus);
    this.logRequest('GET', path, expectedStatus, response.status);
    return response;
  }

  /**
   * POST request with authentication
   */
  async post(path, data = {}, expectedStatus = 200) {
    const response = await this.request()
      .post(path)
      .send(data)
      .expect(expectedStatus);
    this.logRequest('POST', path, expectedStatus, response.status);
    return response;
  }

  /**
   * PUT request with authentication
   */
  async put(path, data = {}, expectedStatus = 200) {
    const response = await this.request()
      .put(path)
      .send(data)
      .expect(expectedStatus);
    this.logRequest('PUT', path, expectedStatus, response.status);
    return response;
  }

  /**
   * DELETE request with authentication
   */
  async delete(path, expectedStatus = 200) {
    const response = await this.request().delete(path).expect(expectedStatus);
    this.logRequest('DELETE', path, expectedStatus, response.status);
    return response;
  }

  /**
   * PATCH request with authentication
   */
  async patch(path, data = {}, expectedStatus = 200) {
    const response = await this.request()
      .patch(path)
      .send(data)
      .expect(expectedStatus);
    this.logRequest('PATCH', path, expectedStatus, response.status);
    return response;
  }

  /**
   * Upload file with authentication
   */
  async uploadFile(path, fieldName, filePath, expectedStatus = 200) {
    const response = await this.request()
      .post(path)
      .attach(fieldName, filePath)
      .expect(expectedStatus);
    this.logRequest('POST (upload)', path, expectedStatus, response.status);
    return response;
  }

  /**
   * Test API endpoint with multiple HTTP methods
   */
  async testEndpoint(path, options = {}) {
    const {
      methods = ['GET'],
      data = {},
      expectedStatuses = { GET: 200, POST: 200, PUT: 200, DELETE: 200, PATCH: 200 },
      skipAuth = false
    } = options;

    const results = {};

    for (const method of methods) {
      const methodLower = method.toLowerCase();
      const expectedStatus = expectedStatuses[method] || 200;

      try {
        let response;
        
        if (skipAuth) {
          // Test without authentication
          const req = request(this.app);
          
          switch (methodLower) {
            case 'get':
              response = await req.get(path);
              break;
            case 'post':
              response = await req.post(path).send(data);
              break;
            case 'put':
              response = await req.put(path).send(data);
              break;
            case 'delete':
              response = await req.delete(path);
              break;
            case 'patch':
              response = await req.patch(path).send(data);
              break;
            default:
              throw new Error(`Unsupported method: ${method}`);
          }
        } else {
          // Test with authentication
          switch (methodLower) {
            case 'get':
              response = await this.get(path, expectedStatus);
              break;
            case 'post':
              response = await this.post(path, data, expectedStatus);
              break;
            case 'put':
              response = await this.put(path, data, expectedStatus);
              break;
            case 'delete':
              response = await this.delete(path, expectedStatus);
              break;
            case 'patch':
              response = await this.patch(path, data, expectedStatus);
              break;
            default:
              throw new Error(`Unsupported method: ${method}`);
          }
        }

        results[method] = {
          status: response.status,
          body: response.body,
          headers: response.headers,
          success: true
        };

      } catch (error) {
        results[method] = {
          status: error.status || 500,
          error: error.message,
          success: false
        };
      }
    }

    return results;
  }

  /**
   * Test API responses for standard success format
   */
  validateSuccessResponse(response, expectedData = null) {
    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(true);
    
    if (expectedData) {
      expect(response.body).toHaveProperty('data');
      if (typeof expectedData === 'object') {
        expect(response.body.data).toMatchObject(expectedData);
      }
    }

    return response.body;
  }

  /**
   * Test API responses for standard error format
   */
  validateErrorResponse(response, expectedError = null) {
    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(false);
    expect(response.body).toHaveProperty('error');
    
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(response.body.error).toContain(expectedError);
      } else {
        expect(response.body.error).toMatchObject(expectedError);
      }
    }

    return response.body;
  }

  /**
   * Test pagination response format
   */
  validatePaginationResponse(response) {
    this.validateSuccessResponse(response);
    
    const { data } = response.body;
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('pagination');
    expect(data.pagination).toHaveProperty('page');
    expect(data.pagination).toHaveProperty('limit');
    expect(data.pagination).toHaveProperty('total');
    expect(data.pagination).toHaveProperty('hasMore');
    
    expect(Array.isArray(data.items)).toBe(true);
    expect(typeof data.pagination.page).toBe('number');
    expect(typeof data.pagination.limit).toBe('number');
    expect(typeof data.pagination.total).toBe('number');
    expect(typeof data.pagination.hasMore).toBe('boolean');

    return data;
  }

  /**
   * Test CRUD operations for a resource
   */
  async testCRUD(basePath, createData, updateData, options = {}) {
    const {
      idField = 'id',
      skipDelete = false,
      customValidation = null
    } = options;

    const results = {};

    try {
      // Create
      console.log(`Testing CREATE: POST ${basePath}`);
      const createResponse = await this.post(basePath, createData, 201);
      this.validateSuccessResponse(createResponse);
      
      const createdItem = createResponse.body.data;
      expect(createdItem).toHaveProperty(idField);
      
      results.create = { success: true, data: createdItem };
      const itemId = createdItem[idField];

      // Read (Get by ID)
      console.log(`Testing READ: GET ${basePath}/${itemId}`);
      const readResponse = await this.get(`${basePath}/${itemId}`);
      this.validateSuccessResponse(readResponse);
      
      const readItem = readResponse.body.data;
      expect(readItem[idField]).toBe(itemId);
      
      results.read = { success: true, data: readItem };

      // Update
      console.log(`Testing UPDATE: PUT ${basePath}/${itemId}`);
      const updateResponse = await this.put(`${basePath}/${itemId}`, updateData);
      this.validateSuccessResponse(updateResponse);
      
      const updatedItem = updateResponse.body.data;
      expect(updatedItem[idField]).toBe(itemId);
      
      results.update = { success: true, data: updatedItem };

      // Custom validation
      if (customValidation) {
        await customValidation(createdItem, updatedItem);
      }

      // Delete
      if (!skipDelete) {
        console.log(`Testing DELETE: DELETE ${basePath}/${itemId}`);
        const deleteResponse = await this.delete(`${basePath}/${itemId}`);
        this.validateSuccessResponse(deleteResponse);
        
        // Verify deletion
        try {
          await this.get(`${basePath}/${itemId}`, 404);
          results.delete = { success: true };
        } catch (error) {
          results.delete = { success: false, error: error.message };
        }
      }

    } catch (error) {
      console.error(`CRUD test failed: ${error.message}`);
      throw error;
    }

    return results;
  }

  /**
   * Test authentication requirements
   */
  async testAuthRequired(path, method = 'GET', data = {}) {
    // Test without authentication - should fail
    const unauthenticatedRequest = request(this.app);
    
    let response;
    switch (method.toUpperCase()) {
      case 'GET':
        response = await unauthenticatedRequest.get(path).expect(401);
        break;
      case 'POST':
        response = await unauthenticatedRequest.post(path).send(data).expect(401);
        break;
      case 'PUT':
        response = await unauthenticatedRequest.put(path).send(data).expect(401);
        break;
      case 'DELETE':
        response = await unauthenticatedRequest.delete(path).expect(401);
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }

    this.validateErrorResponse(response, 'Unauthorized');
    return response;
  }

  /**
   * Test rate limiting
   */
  async testRateLimit(path, limit = 10) {
    const requests = [];
    
    for (let i = 0; i < limit + 5; i++) {
      requests.push(this.get(path, i < limit ? 200 : 429));
    }

    const results = await Promise.allSettled(requests);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const rateLimited = results.filter(r => r.status === 'rejected').length;

    return { successful, rateLimited, total: results.length };
  }

  /**
   * Log request for debugging
   */
  logRequest(method, path, expected, actual) {
    const status = expected === actual ? '✅' : '❌';
    console.log(`${status} ${method} ${path} - Expected: ${expected}, Got: ${actual}`);
  }

  /**
   * Clear authentication
   */
  clearAuth() {
    this.authToken = null;
    this.currentUser = null;
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Test endpoint with custom headers
   */
  async customRequest(method, path, options = {}) {
    const {
      headers = {},
      data = {},
      query = {},
      expectedStatus = 200
    } = options;

    let req = this.request()[method.toLowerCase()](path);
    
    // Add custom headers
    Object.entries(headers).forEach(([key, value]) => {
      req = req.set(key, value);
    });

    // Add query parameters
    if (Object.keys(query).length > 0) {
      req = req.query(query);
    }

    // Add body data for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(method.toLowerCase()) && Object.keys(data).length > 0) {
      req = req.send(data);
    }

    const response = await req.expect(expectedStatus);
    this.logRequest(method.toUpperCase(), path, expectedStatus, response.status);
    
    return response;
  }

  /**
   * Batch test multiple endpoints
   */
  async batchTest(endpoints) {
    const results = {};
    
    for (const endpoint of endpoints) {
      const { name, path, method = 'GET', data = {}, expectedStatus = 200 } = endpoint;
      
      try {
        const response = await this[method.toLowerCase()](path, data, expectedStatus);
        results[name] = { 
          success: true, 
          status: response.status, 
          body: response.body 
        };
      } catch (error) {
        results[name] = { 
          success: false, 
          error: error.message,
          status: error.status || 500
        };
      }
    }

    return results;
  }
}

export default APITestClient;
