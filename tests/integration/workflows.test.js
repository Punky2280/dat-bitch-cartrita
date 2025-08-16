/**
 * @fileoverview API Integration Tests - Workflow Management
 * Comprehensive testing of workflow creation, execution, and management endpoints
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import TestDatabase from '../utils/TestDatabase.js';
import APITestClient from '../utils/APITestClient.js';
import MockServices from '../utils/MockServices.js';
import app from '../../packages/backend/src/index.js';

describe('Workflow API Integration Tests', () => {
  let testDb;
  let apiClient;
  let mockServices;
  let testUser;

  beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.initialize();
    
    mockServices = new MockServices();
    apiClient = new APITestClient(app, testDb);
    
    console.log('✅ Workflow API test environment initialized');
  });

  afterAll(async () => {
    await testDb.cleanup();
    mockServices.resetAll();
    console.log('✅ Workflow API test environment cleaned up');
  });

  beforeEach(async () => {
    await testDb.clearData();
    mockServices.resetAll();
    
    testUser = await testDb.createTestUser({
      name: 'Workflow Test User',
      email: 'workflowtest@example.com'
    });
    
    await apiClient.authenticate(testUser);
  });

  describe('POST /api/workflows', () => {
    test('should create new workflow with valid definition', async () => {
      const workflowData = {
        name: 'Email Processing Workflow',
        description: 'Automatically categorize and respond to emails',
        definition: {
          nodes: [
            {
              id: 'trigger',
              type: 'email_received',
              position: { x: 100, y: 100 },
              config: {
                filters: ['inbox']
              }
            },
            {
              id: 'classify',
              type: 'ai_classify',
              position: { x: 300, y: 100 },
              config: {
                categories: ['urgent', 'routine', 'spam']
              }
            },
            {
              id: 'respond',
              type: 'auto_reply',
              position: { x: 500, y: 100 },
              config: {
                templates: {
                  urgent: 'immediate_response',
                  routine: 'standard_response'
                }
              }
            }
          ],
          edges: [
            { source: 'trigger', target: 'classify' },
            { source: 'classify', target: 'respond' }
          ]
        },
        tags: ['automation', 'email', 'ai']
      };

      const response = await apiClient.post('/api/workflows', workflowData, 201);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data).toHaveProperty('id');
      expect(data.name).toBe(workflowData.name);
      expect(data.description).toBe(workflowData.description);
      expect(data).toHaveProperty('definition');
      expect(data.is_active).toBe(true); // Default to active
      expect(data.user_id).toBe(testUser.id);
      expect(Array.isArray(data.tags)).toBe(true);

      // Verify workflow stored in database
      const workflowCount = await testDb.getTableCount('workflows');
      expect(workflowCount).toBe(1);
    });

    test('should validate workflow definition schema', async () => {
      const invalidWorkflowData = {
        name: 'Invalid Workflow',
        description: 'This has an invalid definition',
        definition: {
          nodes: [] // Missing required trigger node
          // Missing edges array
        }
      };

      const response = await apiClient.post('/api/workflows', invalidWorkflowData, 400);
      apiClient.validateErrorResponse(response, 'Invalid workflow definition');
    });

    test('should require name and definition', async () => {
      const incompleteData = {
        description: 'Missing name and definition'
      };

      const response = await apiClient.post('/api/workflows', incompleteData, 400);
      apiClient.validateErrorResponse(response);
    });

    test('should validate workflow name length', async () => {
      const workflowData = {
        name: 'x'.repeat(256), // Too long
        description: 'Test workflow',
        definition: {
          nodes: [{ id: 'trigger', type: 'manual', position: { x: 0, y: 0 } }],
          edges: []
        }
      };

      const response = await apiClient.post('/api/workflows', workflowData, 400);
      apiClient.validateErrorResponse(response, 'Name too long');
    });

    test('should require authentication', async () => {
      const workflowData = { name: 'Test', definition: {} };
      await apiClient.testAuthRequired('/api/workflows', 'POST', workflowData);
    });
  });

  describe('GET /api/workflows', () => {
    test('should list user workflows with pagination', async () => {
      // Create test workflows
      const workflow1 = await testDb.createTestWorkflow(testUser.id, {
        name: 'Data Processing Pipeline',
        description: 'Process and analyze data files',
        created_at: new Date(Date.now() - 86400000) // 1 day ago
      });

      const workflow2 = await testDb.createTestWorkflow(testUser.id, {
        name: 'Social Media Automation',
        description: 'Automate social media posts',
        created_at: new Date() // Now
      });

      const response = await apiClient.get('/api/workflows');
      
      const data = apiClient.validatePaginationResponse(response);
      
      expect(data.items).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
      
      // Verify workflow structure
      const workflows = data.items;
      expect(workflows[0]).toHaveProperty('id');
      expect(workflows[0]).toHaveProperty('name');
      expect(workflows[0]).toHaveProperty('description');
      expect(workflows[0]).toHaveProperty('is_active');
      expect(workflows[0]).toHaveProperty('created_at');
      expect(workflows[0]).toHaveProperty('execution_count');
      
      // Should be ordered by most recent first
      expect(new Date(workflows[0].created_at) >= new Date(workflows[1].created_at)).toBe(true);
    });

    test('should support filtering by status', async () => {
      // Create active and inactive workflows
      await testDb.createTestWorkflow(testUser.id, {
        name: 'Active Workflow',
        is_active: true
      });

      await testDb.createTestWorkflow(testUser.id, {
        name: 'Inactive Workflow',
        is_active: false
      });

      const response = await apiClient.get('/api/workflows?status=active');
      
      const data = apiClient.validatePaginationResponse(response);
      
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe('Active Workflow');
      expect(data.items[0].is_active).toBe(true);
    });

    test('should support search by name', async () => {
      await testDb.createTestWorkflow(testUser.id, {
        name: 'Email Processing Workflow'
      });

      await testDb.createTestWorkflow(testUser.id, {
        name: 'Data Analysis Pipeline'
      });

      const response = await apiClient.get('/api/workflows?search=email');
      
      const data = apiClient.validatePaginationResponse(response);
      
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toContain('Email');
    });

    test('should only return user own workflows', async () => {
      // Create workflow for another user
      const otherUser = await testDb.createTestUser({
        name: 'Other User',
        email: 'other@example.com'
      });

      await testDb.createTestWorkflow(otherUser.id, {
        name: 'Other User Workflow'
      });

      // Create workflow for current user
      await testDb.createTestWorkflow(testUser.id, {
        name: 'My Workflow'
      });

      const response = await apiClient.get('/api/workflows');
      
      const data = apiClient.validatePaginationResponse(response);
      
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe('My Workflow');
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/workflows');
    });
  });

  describe('GET /api/workflows/:id', () => {
    test('should get workflow with full details', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id, {
        name: 'Detailed Test Workflow',
        description: 'A workflow with full details',
        definition: JSON.stringify({
          nodes: [
            { id: 'start', type: 'trigger', position: { x: 0, y: 0 } },
            { id: 'process', type: 'transform', position: { x: 200, y: 0 } }
          ],
          edges: [{ source: 'start', target: 'process' }]
        })
      });

      const response = await apiClient.get(`/api/workflows/${workflow.id}`);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data.id).toBe(workflow.id);
      expect(data.name).toBe(workflow.name);
      expect(data.description).toBe(workflow.description);
      expect(data).toHaveProperty('definition');
      expect(data).toHaveProperty('execution_stats');
      expect(data).toHaveProperty('recent_executions');
      
      // Verify definition is parsed JSON
      expect(typeof data.definition).toBe('object');
      expect(Array.isArray(data.definition.nodes)).toBe(true);
    });

    test('should return 404 for non-existent workflow', async () => {
      const nonExistentId = 99999;
      const response = await apiClient.get(`/api/workflows/${nonExistentId}`, 404);
      apiClient.validateErrorResponse(response, 'Workflow not found');
    });

    test('should prevent access to other user workflows', async () => {
      const otherUser = await testDb.createTestUser({
        name: 'Other User',
        email: 'other@example.com'
      });

      const otherWorkflow = await testDb.createTestWorkflow(otherUser.id, {
        name: 'Other User Workflow'
      });

      const response = await apiClient.get(`/api/workflows/${otherWorkflow.id}`, 403);
      apiClient.validateErrorResponse(response, 'Access denied');
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/workflows/1');
    });
  });

  describe('PUT /api/workflows/:id', () => {
    test('should update workflow details', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id, {
        name: 'Original Workflow Name',
        description: 'Original description'
      });

      const updateData = {
        name: 'Updated Workflow Name',
        description: 'Updated description with new features',
        definition: {
          nodes: [
            { id: 'new-trigger', type: 'webhook', position: { x: 0, y: 0 } }
          ],
          edges: []
        }
      };

      const response = await apiClient.put(`/api/workflows/${workflow.id}`, updateData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data.name).toBe(updateData.name);
      expect(data.description).toBe(updateData.description);
      expect(data.definition).toMatchObject(updateData.definition);

      // Verify update in database
      const dbResult = await testDb.query(
        'SELECT name, description, definition FROM workflows WHERE id = $1',
        [workflow.id]
      );
      
      const dbWorkflow = dbResult.rows[0];
      expect(dbWorkflow.name).toBe(updateData.name);
      expect(dbWorkflow.description).toBe(updateData.description);
      expect(JSON.parse(dbWorkflow.definition)).toMatchObject(updateData.definition);
    });

    test('should validate updated workflow definition', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id);

      const updateData = {
        definition: {
          nodes: [], // Invalid - no nodes
          edges: 'invalid' // Should be array
        }
      };

      const response = await apiClient.put(`/api/workflows/${workflow.id}`, updateData, 400);
      apiClient.validateErrorResponse(response, 'Invalid workflow definition');
    });

    test('should require authentication', async () => {
      const updateData = { name: 'Updated Name' };
      await apiClient.testAuthRequired('/api/workflows/1', 'PUT', updateData);
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    test('should delete workflow and associated data', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id, {
        name: 'Workflow to Delete'
      });

      const response = await apiClient.delete(`/api/workflows/${workflow.id}`);
      
      apiClient.validateSuccessResponse(response);

      // Verify workflow is deleted
      const workflowCount = await testDb.getTableCount('workflows');
      expect(workflowCount).toBe(0);
    });

    test('should prevent deletion of other user workflows', async () => {
      const otherUser = await testDb.createTestUser({
        email: 'other@example.com'
      });

      const otherWorkflow = await testDb.createTestWorkflow(otherUser.id);

      const response = await apiClient.delete(`/api/workflows/${otherWorkflow.id}`, 403);
      apiClient.validateErrorResponse(response, 'Access denied');
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/workflows/1', 'DELETE');
    });
  });

  describe('POST /api/workflows/:id/execute', () => {
    test('should execute workflow with input data', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id, {
        name: 'Executable Workflow',
        definition: JSON.stringify({
          nodes: [
            {
              id: 'trigger',
              type: 'manual',
              position: { x: 0, y: 0 },
              config: { input_schema: { type: 'object' } }
            },
            {
              id: 'process',
              type: 'transform',
              position: { x: 200, y: 0 },
              config: { operation: 'uppercase' }
            }
          ],
          edges: [{ source: 'trigger', target: 'process' }]
        })
      });

      const executionData = {
        input: { text: 'hello world' },
        config: { async: false }
      };

      // Mock workflow execution service
      mockServices.resetAll();

      const response = await apiClient.post(`/api/workflows/${workflow.id}/execute`, executionData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data).toHaveProperty('execution_id');
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('running');
    });

    test('should handle async workflow execution', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id);

      const executionData = {
        input: { data: 'test' },
        config: { async: true }
      };

      const response = await apiClient.post(`/api/workflows/${workflow.id}/execute`, executionData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data).toHaveProperty('execution_id');
      expect(data.status).toBe('queued');
    });

    test('should validate workflow is active', async () => {
      const inactiveWorkflow = await testDb.createTestWorkflow(testUser.id, {
        name: 'Inactive Workflow',
        is_active: false
      });

      const executionData = { input: {} };

      const response = await apiClient.post(
        `/api/workflows/${inactiveWorkflow.id}/execute`,
        executionData,
        400
      );
      
      apiClient.validateErrorResponse(response, 'Workflow is not active');
    });

    test('should require authentication', async () => {
      const executionData = { input: {} };
      await apiClient.testAuthRequired('/api/workflows/1/execute', 'POST', executionData);
    });
  });

  describe('GET /api/workflows/:id/executions', () => {
    test('should list workflow execution history', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id);

      // Would create execution records in a real implementation
      // For now, test the endpoint structure
      const response = await apiClient.get(`/api/workflows/${workflow.id}/executions`);
      
      const data = apiClient.validatePaginationResponse(response);
      expect(data.items).toBeDefined();
    });

    test('should support status filtering', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id);

      const response = await apiClient.get(`/api/workflows/${workflow.id}/executions?status=completed`);
      
      const data = apiClient.validatePaginationResponse(response);
      expect(data.items).toBeDefined();
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/workflows/1/executions');
    });
  });

  describe('POST /api/workflows/:id/toggle', () => {
    test('should toggle workflow active status', async () => {
      const workflow = await testDb.createTestWorkflow(testUser.id, {
        is_active: true
      });

      const response = await apiClient.post(`/api/workflows/${workflow.id}/toggle`);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data.is_active).toBe(false);

      // Verify in database
      const dbResult = await testDb.query(
        'SELECT is_active FROM workflows WHERE id = $1',
        [workflow.id]
      );
      expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/workflows/1/toggle', 'POST');
    });
  });

  describe('POST /api/workflows/import', () => {
    test('should import workflow from definition', async () => {
      const importData = {
        workflow: {
          name: 'Imported Workflow',
          description: 'A workflow imported from external source',
          definition: {
            nodes: [
              { id: 'start', type: 'webhook', position: { x: 0, y: 0 } }
            ],
            edges: []
          }
        },
        source: 'external_system'
      };

      const response = await apiClient.post('/api/workflows/import', importData, 201);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data.name).toBe(importData.workflow.name);
      expect(data).toHaveProperty('id');
    });

    test('should validate imported workflow definition', async () => {
      const invalidImportData = {
        workflow: {
          name: 'Invalid Import',
          definition: {} // Missing required fields
        }
      };

      const response = await apiClient.post('/api/workflows/import', invalidImportData, 400);
      apiClient.validateErrorResponse(response, 'Invalid workflow definition');
    });

    test('should require authentication', async () => {
      const importData = { workflow: { name: 'Test' } };
      await apiClient.testAuthRequired('/api/workflows/import', 'POST', importData);
    });
  });
});
