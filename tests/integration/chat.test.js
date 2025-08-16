/**
 * @fileoverview API Integration Tests - Chat Endpoints
 * Comprehensive testing of chat/conversation API endpoints
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import TestDatabase from '../utils/TestDatabase.js';
import APITestClient from '../utils/APITestClient.js';
import MockServices from '../utils/MockServices.js';
import app from '../../packages/backend/src/index.js';

describe('Chat API Integration Tests', () => {
  let testDb;
  let apiClient;
  let mockServices;
  let testUser;

  beforeAll(async () => {
    // Initialize test environment
    testDb = new TestDatabase();
    await testDb.initialize();
    
    mockServices = new MockServices();
    apiClient = new APITestClient(app, testDb);
    
    // Create and authenticate test user
    testUser = await testDb.createTestUser({
      name: 'Chat Test User',
      email: 'chattest@example.com'
    });
    
    await apiClient.authenticate(testUser);
    
    console.log('✅ Chat API test environment initialized');
  });

  afterAll(async () => {
    await testDb.cleanup();
    mockServices.resetAll();
    console.log('✅ Chat API test environment cleaned up');
  });

  beforeEach(async () => {
    await testDb.clearData();
    mockServices.resetAll();
    
    // Re-create test user for each test
    testUser = await testDb.createTestUser({
      name: 'Chat Test User',
      email: 'chattest@example.com'
    });
    
    await apiClient.authenticate(testUser);
  });

  describe('POST /api/chat', () => {
    test('should create new conversation and send message', async () => {
      const messageData = {
        message: 'Hello, how can you help me with AI development?',
        conversationId: null
      };

      mockServices.openai.mockChatCompletion('I can help you with AI development by providing guidance on machine learning, neural networks, and implementation strategies.');

      const response = await apiClient.post('/api/chat', messageData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data).toHaveProperty('conversationId');
      expect(data).toHaveProperty('response');
      expect(data).toHaveProperty('messageId');
      
      // Verify conversation was created in database
      const conversationCount = await testDb.getTableCount('conversations');
      expect(conversationCount).toBe(1);
      
      // Verify messages were stored
      const messageCount = await testDb.getTableCount('conversation_messages');
      expect(messageCount).toBe(2); // User message + AI response
    });

    test('should add message to existing conversation', async () => {
      // Create existing conversation
      const conversation = await testDb.createTestConversation(testUser.id, {
        title: 'Existing AI Discussion'
      });

      const messageData = {
        message: 'Can you explain neural networks?',
        conversationId: conversation.id
      };

      mockServices.openai.mockChatCompletion('Neural networks are computational models inspired by biological neural networks...');

      const response = await apiClient.post('/api/chat', messageData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data.conversationId).toBe(conversation.id);
      
      // Verify no new conversation was created
      const conversationCount = await testDb.getTableCount('conversations');
      expect(conversationCount).toBe(1);
      
      // Verify messages were added
      const messageCount = await testDb.getTableCount('conversation_messages');
      expect(messageCount).toBe(2);
    });

    test('should handle streaming responses', async () => {
      const messageData = {
        message: 'Tell me about machine learning',
        stream: true
      };

      // Mock streaming response
      const chunks = ['Machine', ' learning', ' is', ' a', ' subset', ' of', ' AI'];
      mockServices.openai.mockStreamingCompletion(chunks);

      const response = await apiClient.post('/api/chat', messageData);
      
      apiClient.validateSuccessResponse(response);
      expect(response.body.data).toHaveProperty('stream');
      expect(response.body.data.stream).toBe(true);
    });

    test('should require authentication', async () => {
      apiClient.clearAuth();
      
      const messageData = {
        message: 'Hello AI',
        conversationId: null
      };

      await apiClient.testAuthRequired('/api/chat', 'POST', messageData);
    });

    test('should validate message content', async () => {
      const invalidData = {
        message: '', // Empty message
        conversationId: null
      };

      const response = await apiClient.post('/api/chat', invalidData, 400);
      apiClient.validateErrorResponse(response, 'Message content is required');
    });

    test('should handle AI service errors gracefully', async () => {
      const messageData = {
        message: 'Test message',
        conversationId: null
      };

      // Mock AI service error
      mockServices.openai.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API rate limit exceeded')
      );

      const response = await apiClient.post('/api/chat', messageData, 500);
      apiClient.validateErrorResponse(response);
    });
  });

  describe('GET /api/chat/conversations', () => {
    test('should list user conversations with pagination', async () => {
      // Create test conversations
      const conversation1 = await testDb.createTestConversation(testUser.id, {
        title: 'AI Development Chat',
        created_at: new Date(Date.now() - 86400000) // 1 day ago
      });

      const conversation2 = await testDb.createTestConversation(testUser.id, {
        title: 'Machine Learning Discussion',
        created_at: new Date() // Now
      });

      // Add messages to conversations
      await testDb.createTestMessage(conversation1.id, {
        role: 'user',
        content: 'How do I build AI agents?'
      });

      await testDb.createTestMessage(conversation2.id, {
        role: 'user',
        content: 'Explain deep learning'
      });

      const response = await apiClient.get('/api/chat/conversations');
      
      const data = apiClient.validatePaginationResponse(response);
      
      expect(data.items).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
      
      // Verify conversation structure
      const conversations = data.items;
      expect(conversations[0]).toHaveProperty('id');
      expect(conversations[0]).toHaveProperty('title');
      expect(conversations[0]).toHaveProperty('created_at');
      expect(conversations[0]).toHaveProperty('updated_at');
      expect(conversations[0]).toHaveProperty('message_count');
      
      // Should be ordered by most recent first
      expect(new Date(conversations[0].created_at) >= new Date(conversations[1].created_at)).toBe(true);
    });

    test('should support pagination parameters', async () => {
      // Create multiple conversations
      for (let i = 0; i < 5; i++) {
        await testDb.createTestConversation(testUser.id, {
          title: `Test Conversation ${i + 1}`,
          created_at: new Date(Date.now() - (i * 3600000)) // Spaced by hours
        });
      }

      const response = await apiClient.get('/api/chat/conversations?page=1&limit=3');
      
      const data = apiClient.validatePaginationResponse(response);
      
      expect(data.items).toHaveLength(3);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(3);
      expect(data.pagination.total).toBe(5);
      expect(data.pagination.hasMore).toBe(true);
    });

    test('should only return user own conversations', async () => {
      // Create another user and their conversation
      const otherUser = await testDb.createTestUser({
        name: 'Other User',
        email: 'other@example.com'
      });

      await testDb.createTestConversation(otherUser.id, {
        title: 'Other User Conversation'
      });

      // Create conversation for current user
      await testDb.createTestConversation(testUser.id, {
        title: 'My Conversation'
      });

      const response = await apiClient.get('/api/chat/conversations');
      
      const data = apiClient.validatePaginationResponse(response);
      
      expect(data.items).toHaveLength(1);
      expect(data.items[0].title).toBe('My Conversation');
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/chat/conversations');
    });
  });

  describe('GET /api/chat/conversations/:id', () => {
    test('should get conversation with messages', async () => {
      const conversation = await testDb.createTestConversation(testUser.id, {
        title: 'Test Conversation with Messages'
      });

      // Add test messages
      await testDb.createTestMessage(conversation.id, {
        role: 'user',
        content: 'What is artificial intelligence?'
      });

      await testDb.createTestMessage(conversation.id, {
        role: 'assistant',
        content: 'Artificial intelligence (AI) is the simulation of human intelligence...'
      });

      const response = await apiClient.get(`/api/chat/conversations/${conversation.id}`);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data).toHaveProperty('id', conversation.id);
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('messages');
      expect(Array.isArray(data.messages)).toBe(true);
      expect(data.messages).toHaveLength(2);
      
      // Verify message structure
      const messages = data.messages;
      expect(messages[0]).toHaveProperty('id');
      expect(messages[0]).toHaveProperty('role');
      expect(messages[0]).toHaveProperty('content');
      expect(messages[0]).toHaveProperty('created_at');
    });

    test('should return 404 for non-existent conversation', async () => {
      const nonExistentId = 99999;
      const response = await apiClient.get(`/api/chat/conversations/${nonExistentId}`, 404);
      apiClient.validateErrorResponse(response, 'Conversation not found');
    });

    test('should prevent access to other user conversations', async () => {
      // Create conversation for different user
      const otherUser = await testDb.createTestUser({
        name: 'Other User',
        email: 'other@example.com'
      });

      const otherConversation = await testDb.createTestConversation(otherUser.id, {
        title: 'Other User Conversation'
      });

      const response = await apiClient.get(`/api/chat/conversations/${otherConversation.id}`, 403);
      apiClient.validateErrorResponse(response, 'Access denied');
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/chat/conversations/1');
    });
  });

  describe('DELETE /api/chat/conversations/:id', () => {
    test('should delete conversation and associated messages', async () => {
      const conversation = await testDb.createTestConversation(testUser.id, {
        title: 'Conversation to Delete'
      });

      // Add test messages
      await testDb.createTestMessage(conversation.id, {
        role: 'user',
        content: 'Test message 1'
      });

      await testDb.createTestMessage(conversation.id, {
        role: 'assistant',
        content: 'Test response 1'
      });

      const response = await apiClient.delete(`/api/chat/conversations/${conversation.id}`);
      
      apiClient.validateSuccessResponse(response);

      // Verify conversation is deleted
      const conversationCount = await testDb.getTableCount('conversations');
      expect(conversationCount).toBe(0);

      // Verify messages are deleted (cascade)
      const messageCount = await testDb.getTableCount('conversation_messages');
      expect(messageCount).toBe(0);
    });

    test('should return 404 for non-existent conversation', async () => {
      const nonExistentId = 99999;
      const response = await apiClient.delete(`/api/chat/conversations/${nonExistentId}`, 404);
      apiClient.validateErrorResponse(response, 'Conversation not found');
    });

    test('should prevent deletion of other user conversations', async () => {
      const otherUser = await testDb.createTestUser({
        name: 'Other User',
        email: 'other@example.com'
      });

      const otherConversation = await testDb.createTestConversation(otherUser.id, {
        title: 'Other User Conversation'
      });

      const response = await apiClient.delete(`/api/chat/conversations/${otherConversation.id}`, 403);
      apiClient.validateErrorResponse(response, 'Access denied');
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/chat/conversations/1', 'DELETE');
    });
  });

  describe('PUT /api/chat/conversations/:id', () => {
    test('should update conversation title', async () => {
      const conversation = await testDb.createTestConversation(testUser.id, {
        title: 'Original Title'
      });

      const updateData = {
        title: 'Updated Conversation Title'
      };

      const response = await apiClient.put(`/api/chat/conversations/${conversation.id}`, updateData);
      
      apiClient.validateSuccessResponse(response);
      
      const { data } = response.body;
      expect(data.title).toBe(updateData.title);
      expect(data.id).toBe(conversation.id);

      // Verify update in database
      const result = await testDb.query(
        'SELECT title FROM conversations WHERE id = $1',
        [conversation.id]
      );
      expect(result.rows[0].title).toBe(updateData.title);
    });

    test('should validate title length', async () => {
      const conversation = await testDb.createTestConversation(testUser.id);

      const updateData = {
        title: 'x'.repeat(201) // Too long
      };

      const response = await apiClient.put(`/api/chat/conversations/${conversation.id}`, updateData, 400);
      apiClient.validateErrorResponse(response, 'Title too long');
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/chat/conversations/1', 'PUT', { title: 'New Title' });
    });
  });

  describe('GET /api/chat/structured', () => {
    test('should retrieve structured outputs with filtering', async () => {
      // This endpoint would be implemented to return structured AI outputs
      // For now, test the basic endpoint structure
      const response = await apiClient.get('/api/chat/structured');
      
      // Should return paginated results even if empty
      const data = apiClient.validatePaginationResponse(response);
      expect(data.items).toBeDefined();
    });

    test('should support task filtering', async () => {
      const response = await apiClient.get('/api/chat/structured?task=vision');
      
      const data = apiClient.validatePaginationResponse(response);
      expect(data.items).toBeDefined();
    });

    test('should require authentication', async () => {
      await apiClient.testAuthRequired('/api/chat/structured');
    });
  });
});
