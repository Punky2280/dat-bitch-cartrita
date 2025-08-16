/**
 * @fileoverview E2E Tests - API Endpoints
 * Direct API testing using Playwright's request context
 */

import { test, expect } from '@playwright/test';

test.describe('API Endpoints E2E', () => {
  let apiContext;
  let authToken;

  test.beforeAll(async ({ playwright }) => {
    // Create API request context
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000/api',
      extraHTTPHeaders: {
        'Content-Type': 'application/json'
      }
    });

    // Authenticate and get token
    const loginResponse = await apiContext.post('/auth/login', {
      data: {
        email: 'e2etest@example.com',
        password: 'TestPassword123!'
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    authToken = loginData.data.token;

    // Set auth header for subsequent requests
    await apiContext.dispose();
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000/api',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Authentication Endpoints', () => {
    test('POST /auth/register - should register new user', async () => {
      const timestamp = Date.now();
      const userData = {
        name: `API Test User ${timestamp}`,
        email: `apitest${timestamp}@example.com`,
        password: 'ApiTestPassword123!'
      };

      const response = await apiContext.post('/auth/register', {
        data: userData
      });

      expect(response.status()).toBe(201);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(userData.email);
      expect(data.data.user.name).toBe(userData.name);
      expect(data.data.token).toBeDefined();
    });

    test('POST /auth/login - should login with valid credentials', async () => {
      const response = await apiContext.post('/auth/login', {
        data: {
          email: 'e2etest@example.com',
          password: 'TestPassword123!'
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.token).toBeDefined();
    });

    test('GET /auth/profile - should get authenticated user profile', async () => {
      const response = await apiContext.get('/auth/profile');

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe('e2etest@example.com');
    });

    test('POST /auth/logout - should logout user', async () => {
      const response = await apiContext.post('/auth/logout');

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  test.describe('Chat Endpoints', () => {
    test('POST /chat - should create new conversation', async () => {
      const response = await apiContext.post('/chat', {
        data: {
          message: 'Hello, this is a test message from API E2E test',
          conversationId: null
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.conversationId).toBeDefined();
      expect(data.data.messageId).toBeDefined();
      expect(data.data.response).toBeDefined();
    });

    test('GET /chat/conversations - should list user conversations', async () => {
      const response = await apiContext.get('/chat/conversations');

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.items).toBeDefined();
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.pagination).toBeDefined();
    });

    test('GET /chat/conversations/:id - should get conversation details', async () => {
      // First create a conversation
      const createResponse = await apiContext.post('/chat', {
        data: {
          message: 'Test message for conversation detail test',
          conversationId: null
        }
      });

      const createData = await createResponse.json();
      const conversationId = createData.data.conversationId;

      // Now get conversation details
      const response = await apiContext.get(`/chat/conversations/${conversationId}`);

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(conversationId);
      expect(data.data.messages).toBeDefined();
      expect(Array.isArray(data.data.messages)).toBe(true);
    });

    test('DELETE /chat/conversations/:id - should delete conversation', async () => {
      // Create conversation to delete
      const createResponse = await apiContext.post('/chat', {
        data: {
          message: 'Test message for deletion test',
          conversationId: null
        }
      });

      const createData = await createResponse.json();
      const conversationId = createData.data.conversationId;

      // Delete conversation
      const response = await apiContext.delete(`/chat/conversations/${conversationId}`);

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify conversation is deleted
      const getResponse = await apiContext.get(`/chat/conversations/${conversationId}`);
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Workflow Endpoints', () => {
    let testWorkflowId;

    test('POST /workflows - should create new workflow', async () => {
      const workflowData = {
        name: 'API Test Workflow',
        description: 'A test workflow created via API E2E test',
        definition: {
          nodes: [
            {
              id: 'trigger',
              type: 'manual',
              position: { x: 100, y: 100 },
              config: {}
            },
            {
              id: 'action',
              type: 'log',
              position: { x: 300, y: 100 },
              config: { message: 'Hello from API test workflow' }
            }
          ],
          edges: [
            { source: 'trigger', target: 'action' }
          ]
        }
      };

      const response = await apiContext.post('/workflows', {
        data: workflowData
      });

      expect(response.status()).toBe(201);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(workflowData.name);
      expect(data.data.id).toBeDefined();
      
      testWorkflowId = data.data.id;
    });

    test('GET /workflows - should list user workflows', async () => {
      const response = await apiContext.get('/workflows');

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.items).toBeDefined();
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.pagination).toBeDefined();
    });

    test('GET /workflows/:id - should get workflow details', async () => {
      const response = await apiContext.get(`/workflows/${testWorkflowId}`);

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testWorkflowId);
      expect(data.data.definition).toBeDefined();
    });

    test('PUT /workflows/:id - should update workflow', async () => {
      const updateData = {
        name: 'Updated API Test Workflow',
        description: 'Updated description via API E2E test'
      };

      const response = await apiContext.put(`/workflows/${testWorkflowId}`, {
        data: updateData
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(updateData.name);
      expect(data.data.description).toBe(updateData.description);
    });

    test('POST /workflows/:id/execute - should execute workflow', async () => {
      const response = await apiContext.post(`/workflows/${testWorkflowId}/execute`, {
        data: {
          input: { test: 'data' },
          config: { async: false }
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.execution_id).toBeDefined();
    });

    test('POST /workflows/:id/toggle - should toggle workflow status', async () => {
      const response = await apiContext.post(`/workflows/${testWorkflowId}/toggle`);

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.is_active).toBeDefined();
    });

    test('DELETE /workflows/:id - should delete workflow', async () => {
      const response = await apiContext.delete(`/workflows/${testWorkflowId}`);

      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify workflow is deleted
      const getResponse = await apiContext.get(`/workflows/${testWorkflowId}`);
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Error Handling', () => {
    test('should return 401 for unauthenticated requests', async ({ playwright }) => {
      const unauthContext = await playwright.request.newContext({
        baseURL: 'http://localhost:3000/api'
      });

      const response = await unauthContext.get('/auth/profile');
      
      expect(response.status()).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unauthorized');

      await unauthContext.dispose();
    });

    test('should return 404 for non-existent resources', async () => {
      const response = await apiContext.get('/workflows/999999');
      
      expect(response.status()).toBe(404);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });

    test('should return 400 for invalid request data', async () => {
      const response = await apiContext.post('/workflows', {
        data: {
          // Missing required fields
          description: 'Invalid workflow without name'
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test('should handle rate limiting', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array.from({ length: 20 }, () => 
        apiContext.get('/auth/profile')
      );

      const responses = await Promise.all(promises);
      
      // Some responses might be rate limited (429) depending on implementation
      const rateLimited = responses.filter(r => r.status() === 429);
      
      // If rate limiting is implemented, we should see some 429 responses
      // If not implemented yet, all should be 200
      const successful = responses.filter(r => r.ok());
      
      expect(successful.length + rateLimited.length).toBe(20);
    });

    test('should handle malformed JSON gracefully', async ({ playwright }) => {
      const rawContext = await playwright.request.newContext({
        baseURL: 'http://localhost:3000/api',
        extraHTTPHeaders: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const response = await rawContext.post('/chat', {
        data: 'invalid json string'
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);

      await rawContext.dispose();
    });
  });

  test.describe('Performance and Load', () => {
    test('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        apiContext.post('/chat', {
          data: {
            message: `Concurrent test message ${i + 1}`,
            conversationId: null
          }
        })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.ok()).toBeTruthy();
      });

      // Verify all responses are valid
      const dataPromises = responses.map(r => r.json());
      const allData = await Promise.all(dataPromises);
      
      allData.forEach((data, index) => {
        expect(data.success).toBe(true);
        expect(data.data.conversationId).toBeDefined();
      });
    });

    test('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const response = await apiContext.get('/auth/profile');
      
      const duration = Date.now() - startTime;
      
      expect(response.ok()).toBeTruthy();
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });
});
