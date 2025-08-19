/**
 * Cartrita V2 - Chat & Conversation Routes
 * Enhanced from V1 with real-time capabilities and improved context management
 */

import { logger } from '../core/logger.js';
import db from '../database/connection.js';

export async function chatRoutes(fastify, options) {
  // Start a new conversation
  fastify.post('/conversations', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Start a new conversation',
      tags: ['chat'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 255 },
          type: { type: 'string', enum: ['general', 'task', 'support', 'analysis'] },
          context: { type: 'object' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            conversation: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                type: { type: 'string' },
                createdAt: { type: 'string' },
                messageCount: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { title, type = 'general', context = {} } = request.body;
    const startTime = Date.now();
    
    try {
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await db.query(`
        INSERT INTO conversations (id, user_id, title, type, context, created_at, updated_at, is_active)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), true)
        RETURNING id, title, type, created_at
      `, [conversationId, request.user.userId, title || 'New Conversation', type, JSON.stringify(context)]);
      
      const conversation = result.rows[0];
      
      logger.agent('conversation-created', {
        conversationId,
        userId: request.user.userId,
        type,
        duration: Date.now() - startTime
      });
      
      return reply.status(201).send({
        success: true,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          type: conversation.type,
          createdAt: conversation.created_at,
          messageCount: 0
        }
      });
    } catch (error) {
      logger.error('Failed to create conversation', {
        error: error.message,
        userId: request.user.userId
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to create conversation'
      });
    }
  });
  
  // Get user's conversations
  fastify.get('/conversations', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get user conversations',
      tags: ['chat'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          type: { type: 'string' },
          active: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { limit = 20, offset = 0, type, active } = request.query;
    
    try {
      let whereClause = 'WHERE user_id = $1';
      const params = [request.user.userId];
      let paramCount = 1;
      
      if (type) {
        whereClause += ` AND type = $${++paramCount}`;
        params.push(type);
      }
      
      if (active !== undefined) {
        whereClause += ` AND is_active = $${++paramCount}`;
        params.push(active);
      }
      
      const result = await db.query(`
        SELECT 
          c.id, c.title, c.type, c.created_at, c.updated_at, c.is_active,
          COUNT(m.id) as message_count,
          MAX(m.created_at) as last_message_at
        FROM conversations c
        LEFT JOIN conversation_messages m ON c.id = m.conversation_id
        ${whereClause}
        GROUP BY c.id, c.title, c.type, c.created_at, c.updated_at, c.is_active
        ORDER BY c.updated_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...params, limit, offset]);
      
      const conversations = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        type: row.type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isActive: row.is_active,
        messageCount: parseInt(row.message_count),
        lastMessageAt: row.last_message_at
      }));
      
      logger.agent('conversations-retrieved', {
        userId: request.user.userId,
        count: conversations.length,
        filters: { type, active }
      });
      
      return {
        success: true,
        conversations,
        pagination: {
          limit,
          offset,
          total: conversations.length,
          hasMore: conversations.length === limit
        }
      };
    } catch (error) {
      logger.error('Failed to get conversations', {
        error: error.message,
        userId: request.user.userId
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve conversations'
      });
    }
  });
  
  // Send message in conversation
  fastify.post('/conversations/:conversationId/messages', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Send a message in a conversation',
      tags: ['chat'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['conversationId'],
        properties: {
          conversationId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['text', 'image', 'audio', 'file'], default: 'text' },
          metadata: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const { conversationId } = request.params;
    const { content, type = 'text', metadata = {} } = request.body;
    const startTime = Date.now();
    
    try {
      // Verify conversation belongs to user
      const convResult = await db.query(`
        SELECT id, is_active FROM conversations 
        WHERE id = $1 AND user_id = $2
      `, [conversationId, request.user.userId]);
      
      if (convResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found'
        });
      }
      
      if (!convResult.rows[0].is_active) {
        return reply.status(400).send({
          success: false,
          error: 'Conversation is not active'
        });
      }
      
      // Create user message
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const messageResult = await db.query(`
        INSERT INTO conversation_messages (id, conversation_id, role, content, type, metadata, created_at)
        VALUES ($1, $2, 'user', $3, $4, $5, NOW())
        RETURNING id, content, type, created_at
      `, [messageId, conversationId, content, type, JSON.stringify(metadata)]);
      
      const userMessage = messageResult.rows[0];
      
      // Generate AI response (simulated for now - in full V2, this would call the agent system)
      const aiProcessingTime = Math.random() * 1500 + 500;
      await new Promise(resolve => setTimeout(resolve, aiProcessingTime));
      
      const aiResponseContent = generateAIResponse(content, type);
      const aiMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const aiResult = await db.query(`
        INSERT INTO conversation_messages (id, conversation_id, role, content, type, metadata, created_at)
        VALUES ($1, $2, 'assistant', $3, 'text', $4, NOW())
        RETURNING id, content, type, created_at
      `, [aiMessageId, conversationId, aiResponseContent, JSON.stringify({
        processingTime: Math.round(aiProcessingTime),
        confidence: 0.95,
        model: 'cartrita-v2'
      })]);
      
      const aiMessage = aiResult.rows[0];
      
      // Update conversation timestamp
      await db.query(`
        UPDATE conversations SET updated_at = NOW() WHERE id = $1
      `, [conversationId]);
      
      logger.agent('message-exchange', {
        conversationId,
        userId: request.user.userId,
        messageType: type,
        contentLength: content.length,
        aiProcessingTime: Math.round(aiProcessingTime),
        duration: Date.now() - startTime
      });
      
      return {
        success: true,
        messages: [
          {
            id: userMessage.id,
            role: 'user',
            content: userMessage.content,
            type: userMessage.type,
            createdAt: userMessage.created_at
          },
          {
            id: aiMessage.id,
            role: 'assistant',
            content: aiMessage.content,
            type: aiMessage.type,
            createdAt: aiMessage.created_at,
            metadata: {
              processingTime: Math.round(aiProcessingTime),
              confidence: 0.95,
              model: 'cartrita-v2'
            }
          }
        ]
      };
    } catch (error) {
      logger.error('Failed to send message', {
        error: error.message,
        conversationId,
        userId: request.user.userId
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to send message'
      });
    }
  });
  
  // Get messages from conversation
  fastify.get('/conversations/:conversationId/messages', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get messages from a conversation',
      tags: ['chat'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['conversationId'],
        properties: {
          conversationId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          since: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    const { conversationId } = request.params;
    const { limit = 50, offset = 0, since } = request.query;
    
    try {
      // Verify conversation belongs to user
      const convResult = await db.query(`
        SELECT id FROM conversations 
        WHERE id = $1 AND user_id = $2
      `, [conversationId, request.user.userId]);
      
      if (convResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found'
        });
      }
      
      let whereClause = 'WHERE conversation_id = $1';
      const params = [conversationId];
      let paramCount = 1;
      
      if (since) {
        whereClause += ` AND created_at > $${++paramCount}`;
        params.push(since);
      }
      
      const result = await db.query(`
        SELECT id, role, content, type, metadata, created_at
        FROM conversation_messages
        ${whereClause}
        ORDER BY created_at ASC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `, [...params, limit, offset]);
      
      const messages = result.rows.map(row => ({
        id: row.id,
        role: row.role,
        content: row.content,
        type: row.type,
        metadata: row.metadata,
        createdAt: row.created_at
      }));
      
      logger.agent('messages-retrieved', {
        conversationId,
        userId: request.user.userId,
        messageCount: messages.length
      });
      
      return {
        success: true,
        messages,
        pagination: {
          limit,
          offset,
          total: messages.length,
          hasMore: messages.length === limit
        }
      };
    } catch (error) {
      logger.error('Failed to get messages', {
        error: error.message,
        conversationId,
        userId: request.user.userId
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve messages'
      });
    }
  });
  
  // Archive/close conversation
  fastify.patch('/conversations/:conversationId', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update conversation status',
      tags: ['chat'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['conversationId'],
        properties: {
          conversationId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean' },
          title: { type: 'string', maxLength: 255 }
        }
      }
    }
  }, async (request, reply) => {
    const { conversationId } = request.params;
    const { isActive, title } = request.body;
    
    try {
      const updates = [];
      const values = [conversationId, request.user.userId];
      let paramCount = 2;
      
      if (isActive !== undefined) {
        updates.push(`is_active = $${++paramCount}`);
        values.push(isActive);
      }
      
      if (title !== undefined) {
        updates.push(`title = $${++paramCount}`);
        values.push(title);
      }
      
      if (updates.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No updates provided'
        });
      }
      
      updates.push(`updated_at = NOW()`);
      
      const result = await db.query(`
        UPDATE conversations 
        SET ${updates.join(', ')}
        WHERE id = $1 AND user_id = $2
        RETURNING id, title, is_active, updated_at
      `, values);
      
      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found'
        });
      }
      
      const conversation = result.rows[0];
      
      logger.agent('conversation-updated', {
        conversationId,
        userId: request.user.userId,
        updates: Object.keys(request.body)
      });
      
      return {
        success: true,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          isActive: conversation.is_active,
          updatedAt: conversation.updated_at
        }
      };
    } catch (error) {
      logger.error('Failed to update conversation', {
        error: error.message,
        conversationId,
        userId: request.user.userId
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to update conversation'
      });
    }
  });
  
  logger.info('✅ Chat routes registered');
}

// Helper function to generate AI responses (mock - in full V2, this would use real AI)
function generateAIResponse(userContent, messageType) {
  const responses = [
    "I understand your request. Let me help you with that.",
    "That's an interesting question. Based on my analysis, I can provide the following insights:",
    "I've processed your input and here's what I found:",
    "Thank you for sharing that information. Here's my response:",
    "I can help you with that task. Let me break it down:",
    "Based on the context, here's what I recommend:",
    "I've analyzed your request and here are the key points:",
    "That's a great question! Here's what I think:"
  ];
  
  const baseResponse = responses[Math.floor(Math.random() * responses.length)];
  
  if (messageType === 'image') {
    return `${baseResponse} I can see the image you've shared. This appears to be a visual content that I can analyze for objects, text, and context.`;
  } else if (messageType === 'audio') {
    return `${baseResponse} I've processed the audio content you provided. The audio contains speech patterns that I can analyze and transcribe.`;
  } else if (messageType === 'file') {
    return `${baseResponse} I've reviewed the file you uploaded. I can analyze its contents and provide insights based on the data structure.`;
  }
  
  return `${baseResponse} Regarding "${userContent.substring(0, 50)}${userContent.length > 50 ? '...' : ''}", I can provide detailed assistance based on your specific needs.`;
}