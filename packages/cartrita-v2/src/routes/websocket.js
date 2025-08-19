/**
 * Cartrita V2 - WebSocket Routes & Real-time Communication
 * Enhanced from V1 with improved performance and multi-channel support
 */

import { logger } from '../core/logger.js';
import db from '../database/connection.js';

export async function websocketRoutes(fastify, options) {
  // WebSocket connection handler
  fastify.register(async function (fastify) {
    // Main WebSocket endpoint
    fastify.get('/ws', { websocket: true }, async (connection, request) => {
      const startTime = Date.now();
      const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store connection metadata
      const connectionInfo = {
        id: connectionId,
        userId: null, // Will be set after authentication
        channels: new Set(),
        connectedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      };
      
      logger.websocket('connection-established', {
        connectionId,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      // Send welcome message
      connection.socket.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        connectionId,
        timestamp: new Date().toISOString(),
        message: 'Welcome to Cartrita V2 WebSocket'
      }));
      
      // Handle incoming messages
      connection.socket.on('message', async (message) => {
        const messageTime = Date.now();
        connectionInfo.lastActivity = new Date();
        connectionInfo.messageCount++;
        
        try {
          const data = JSON.parse(message.toString());
          
          logger.websocket('message-received', {
            connectionId,
            userId: connectionInfo.userId,
            type: data.type,
            messageId: data.id
          });
          
          // Handle different message types
          switch (data.type) {
            case 'authenticate':
              await handleAuthentication(connection, data, connectionInfo);
              break;
              
            case 'join_channel':
              await handleJoinChannel(connection, data, connectionInfo);
              break;
              
            case 'leave_channel':
              await handleLeaveChannel(connection, data, connectionInfo);
              break;
              
            case 'chat_message':
              await handleChatMessage(connection, data, connectionInfo);
              break;
              
            case 'agent_task':
              await handleAgentTask(connection, data, connectionInfo);
              break;
              
            case 'typing_indicator':
              await handleTypingIndicator(connection, data, connectionInfo);
              break;
              
            case 'ping':
              connection.socket.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
                messageId: data.id
              }));
              break;
              
            default:
              connection.socket.send(JSON.stringify({
                type: 'error',
                error: `Unknown message type: ${data.type}`,
                messageId: data.id
              }));
          }
        } catch (error) {
          logger.error('WebSocket message processing error', {
            connectionId,
            error: error.message,
            message: message.toString().substring(0, 100)
          });
          
          connection.socket.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format',
            details: error.message
          }));
        }
      });
      
      // Handle connection close
      connection.socket.on('close', (code, reason) => {
        logger.websocket('connection-closed', {
          connectionId,
          userId: connectionInfo.userId,
          code,
          reason: reason?.toString(),
          duration: Date.now() - startTime,
          messageCount: connectionInfo.messageCount
        });
        
        // Clean up connection from all channels
        connectionInfo.channels.forEach(channel => {
          // In full implementation, remove from channel subscribers
        });
      });
      
      // Handle connection errors
      connection.socket.on('error', (error) => {
        logger.error('WebSocket connection error', {
          connectionId,
          userId: connectionInfo.userId,
          error: error.message
        });
      });
    });
    
    // Chat-specific WebSocket endpoint
    fastify.get('/ws/chat/:conversationId', { websocket: true }, async (connection, request) => {
      const { conversationId } = request.params;
      const connectionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.websocket('chat-connection-established', {
        connectionId,
        conversationId,
        ip: request.ip
      });
      
      connection.socket.send(JSON.stringify({
        type: 'chat_connection',
        conversationId,
        connectionId,
        status: 'connected',
        timestamp: new Date().toISOString()
      }));
      
      connection.socket.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'chat_message') {
            // Simulate real-time chat processing
            const processingTime = Math.random() * 1000 + 500;
            
            // Send typing indicator
            connection.socket.send(JSON.stringify({
              type: 'typing_indicator',
              isTyping: true,
              agent: 'cartrita',
              timestamp: new Date().toISOString()
            }));
            
            // Process message (simulate AI response)
            await new Promise(resolve => setTimeout(resolve, processingTime));
            
            // Send AI response
            const aiResponse = generateStreamingResponse(data.content);
            
            connection.socket.send(JSON.stringify({
              type: 'typing_indicator',
              isTyping: false,
              agent: 'cartrita'
            }));
            
            // Stream response chunks
            for (const chunk of aiResponse.chunks) {
              await new Promise(resolve => setTimeout(resolve, 100)); // Simulate typing delay
              connection.socket.send(JSON.stringify({
                type: 'message_chunk',
                conversationId,
                messageId: aiResponse.messageId,
                chunk,
                isComplete: chunk === aiResponse.chunks[aiResponse.chunks.length - 1]
              }));
            }
            
            // Send complete message
            connection.socket.send(JSON.stringify({
              type: 'message_complete',
              conversationId,
              messageId: aiResponse.messageId,
              content: aiResponse.fullContent,
              metadata: {
                processingTime: Math.round(processingTime),
                confidence: 0.95,
                model: 'cartrita-v2'
              }
            }));
          }
        } catch (error) {
          logger.error('Chat WebSocket error', {
            connectionId,
            conversationId,
            error: error.message
          });
        }
      });
    });
    
    // Agent monitoring WebSocket endpoint
    fastify.get('/ws/agents', { websocket: true }, async (connection, request) => {
      const connectionId = `agents_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.websocket('agent-monitoring-connection', {
        connectionId,
        ip: request.ip
      });
      
      // Send periodic agent status updates
      const statusInterval = setInterval(() => {
        const agentStatus = {
          type: 'agent_status_update',
          timestamp: new Date().toISOString(),
          agents: {
            supervisor: {
              status: 'active',
              tasksInQueue: Math.floor(Math.random() * 5),
              averageResponseTime: Math.floor(Math.random() * 500 + 100),
              uptime: process.uptime()
            },
            analytics: {
              status: 'active',
              tasksInQueue: Math.floor(Math.random() * 3),
              averageResponseTime: Math.floor(Math.random() * 800 + 200),
              memoryUsage: Math.floor(Math.random() * 100 + 50)
            },
            conversation: {
              status: 'active',
              activeConversations: Math.floor(Math.random() * 10 + 1),
              averageResponseTime: Math.floor(Math.random() * 300 + 50)
            }
          }
        };
        
        if (connection.socket.readyState === connection.socket.OPEN) {
          connection.socket.send(JSON.stringify(agentStatus));
        }
      }, 5000); // Update every 5 seconds
      
      connection.socket.on('close', () => {
        clearInterval(statusInterval);
        logger.websocket('agent-monitoring-disconnected', { connectionId });
      });
    });
  });
  
  // REST endpoint to broadcast messages to WebSocket clients
  fastify.post('/broadcast', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Broadcast message to WebSocket clients',
      tags: ['websocket'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: { type: 'string' },
          data: { type: 'object' },
          channel: { type: 'string' },
          targetUsers: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    const { type, data, channel, targetUsers } = request.body;
    
    try {
      // In full V2 implementation, this would broadcast to actual WebSocket connections
      // Mock implementation for now
      const broadcastResult = {
        messageId: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        timestamp: new Date().toISOString(),
        recipientCount: targetUsers?.length || 0,
        channel: channel || 'global'
      };
      
      logger.websocket('message-broadcast', {
        messageId: broadcastResult.messageId,
        type,
        channel: broadcastResult.channel,
        recipientCount: broadcastResult.recipientCount,
        userId: request.user.userId
      });
      
      return {
        success: true,
        broadcast: broadcastResult
      };
    } catch (error) {
      logger.error('Broadcast failed', {
        error: error.message,
        type,
        channel
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to broadcast message'
      });
    }
  });
  
  // Get WebSocket connection statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get WebSocket connection statistics',
      tags: ['websocket'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            stats: {
              type: 'object',
              properties: {
                activeConnections: { type: 'number' },
                totalConnections: { type: 'number' },
                messagesSent: { type: 'number' },
                messagesReceived: { type: 'number' },
                channels: { type: 'object' },
                uptime: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Mock WebSocket statistics (in full V2, these would be real metrics)
      const stats = {
        activeConnections: Math.floor(Math.random() * 50 + 10),
        totalConnections: Math.floor(Math.random() * 1000 + 500),
        messagesSent: Math.floor(Math.random() * 10000 + 5000),
        messagesReceived: Math.floor(Math.random() * 8000 + 4000),
        channels: {
          general: Math.floor(Math.random() * 20 + 5),
          chat: Math.floor(Math.random() * 30 + 10),
          agents: Math.floor(Math.random() * 10 + 2)
        },
        uptime: process.uptime(),
        lastReset: new Date(Date.now() - process.uptime() * 1000).toISOString()
      };
      
      return {
        success: true,
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get WebSocket stats', {
        error: error.message
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve WebSocket statistics'
      });
    }
  });
  
  logger.info('✅ WebSocket routes registered');
}

// Helper functions for WebSocket message handling

async function handleAuthentication(connection, data, connectionInfo) {
  try {
    // In full V2, this would validate JWT token
    const { token } = data;
    
    if (token && token.startsWith('valid_')) {
      connectionInfo.userId = 'user_12345'; // Mock user ID
      
      connection.socket.send(JSON.stringify({
        type: 'authentication_success',
        userId: connectionInfo.userId,
        timestamp: new Date().toISOString(),
        messageId: data.id
      }));
      
      logger.websocket('authentication-success', {
        connectionId: connectionInfo.id,
        userId: connectionInfo.userId
      });
    } else {
      connection.socket.send(JSON.stringify({
        type: 'authentication_failed',
        error: 'Invalid token',
        messageId: data.id
      }));
    }
  } catch (error) {
    connection.socket.send(JSON.stringify({
      type: 'error',
      error: 'Authentication failed',
      messageId: data.id
    }));
  }
}

async function handleJoinChannel(connection, data, connectionInfo) {
  const { channel } = data;
  
  if (!channel) {
    connection.socket.send(JSON.stringify({
      type: 'error',
      error: 'Channel name required',
      messageId: data.id
    }));
    return;
  }
  
  connectionInfo.channels.add(channel);
  
  connection.socket.send(JSON.stringify({
    type: 'channel_joined',
    channel,
    memberCount: Math.floor(Math.random() * 50 + 1), // Mock member count
    timestamp: new Date().toISOString(),
    messageId: data.id
  }));
  
  logger.websocket('channel-joined', {
    connectionId: connectionInfo.id,
    userId: connectionInfo.userId,
    channel
  });
}

async function handleLeaveChannel(connection, data, connectionInfo) {
  const { channel } = data;
  
  connectionInfo.channels.delete(channel);
  
  connection.socket.send(JSON.stringify({
    type: 'channel_left',
    channel,
    timestamp: new Date().toISOString(),
    messageId: data.id
  }));
  
  logger.websocket('channel-left', {
    connectionId: connectionInfo.id,
    userId: connectionInfo.userId,
    channel
  });
}

async function handleChatMessage(connection, data, connectionInfo) {
  const { content, conversationId } = data;
  
  // Simulate message processing
  const processingTime = Math.random() * 1000 + 200;
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  connection.socket.send(JSON.stringify({
    type: 'message_received',
    messageId: `msg_${Date.now()}`,
    conversationId,
    content,
    timestamp: new Date().toISOString(),
    messageId: data.id
  }));
}

async function handleAgentTask(connection, data, connectionInfo) {
  const { task, agent } = data;
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Send task acknowledgment
  connection.socket.send(JSON.stringify({
    type: 'task_started',
    taskId,
    agent: agent || 'cartrita',
    timestamp: new Date().toISOString(),
    messageId: data.id
  }));
  
  // Simulate task processing
  const processingTime = Math.random() * 3000 + 1000;
  setTimeout(() => {
    connection.socket.send(JSON.stringify({
      type: 'task_completed',
      taskId,
      result: `Task completed: ${task}`,
      confidence: 0.95,
      processingTime: Math.round(processingTime),
      timestamp: new Date().toISOString()
    }));
  }, processingTime);
}

async function handleTypingIndicator(connection, data, connectionInfo) {
  const { isTyping, conversationId } = data;
  
  // Broadcast typing indicator to other participants (mock implementation)
  connection.socket.send(JSON.stringify({
    type: 'typing_indicator_broadcast',
    conversationId,
    userId: connectionInfo.userId,
    isTyping,
    timestamp: new Date().toISOString()
  }));
}

function generateStreamingResponse(userMessage) {
  const responses = [
    "I understand your request. Let me process this information and provide you with a comprehensive response.",
    "Based on your input, I can analyze the context and generate relevant insights for you.",
    "Thank you for your message. I'm processing the details and will provide detailed assistance.",
    "I've received your request and I'm analyzing the best approach to help you with this task."
  ];
  
  const fullContent = responses[Math.floor(Math.random() * responses.length)];
  const words = fullContent.split(' ');
  
  // Split into chunks for streaming effect
  const chunks = [];
  let currentChunk = '';
  
  words.forEach((word, index) => {
    currentChunk += (currentChunk ? ' ' : '') + word;
    
    // Create chunk every 3-5 words
    if ((index + 1) % Math.floor(Math.random() * 3 + 3) === 0 || index === words.length - 1) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
  });
  
  return {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fullContent,
    chunks
  };
}