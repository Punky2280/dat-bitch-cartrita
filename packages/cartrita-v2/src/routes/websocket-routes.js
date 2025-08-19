/**
 * V2 WebSocket Real-Time Communication Routes
 * Advanced real-time agent communication and live updates
 */

import { logger } from '../core/logger.js';

export async function websocketRoutes(fastify, options) {
  // WebSocket connection tracking
  const connections = new Map();
  const rooms = new Map();
  const agentChannels = new Map();

  // Register WebSocket support
  await fastify.register(async function (fastify) {
    // Main WebSocket endpoint for real-time communication
    fastify.get('/ws', { websocket: true }, (connection, request) => {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const clientInfo = {
        id: connectionId,
        socket: connection.socket,
        connectedAt: Date.now(),
        subscriptions: new Set(),
        user: request.user || null,
        metadata: {
          userAgent: request.headers['user-agent'],
          ip: request.ip
        }
      };

      connections.set(connectionId, clientInfo);
      
      logger.info('🔌 WebSocket connection established', {
        connectionId,
        totalConnections: connections.size,
        userAgent: clientInfo.metadata.userAgent
      });

      // Send welcome message
      connection.socket.send(JSON.stringify({
        type: 'connection_established',
        connectionId,
        timestamp: new Date().toISOString(),
        serverInfo: {
          version: '2.0.0',
          capabilities: [
            'real_time_chat',
            'agent_updates',
            'system_monitoring',
            'collaborative_sessions'
          ]
        }
      }));

      // Handle incoming messages
      connection.socket.on('message', async (rawMessage) => {
        try {
          const message = JSON.parse(rawMessage.toString());
          await handleWebSocketMessage(connectionId, message, clientInfo);
        } catch (error) {
          logger.error('❌ WebSocket message parsing failed:', error);
          connection.socket.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format',
            timestamp: new Date().toISOString()
          }));
        }
      });

      // Handle connection close
      connection.socket.on('close', () => {
        handleConnectionClose(connectionId);
      });

      // Handle connection errors
      connection.socket.on('error', (error) => {
        logger.error('❌ WebSocket connection error:', error);
        handleConnectionClose(connectionId);
      });
    });

    // Agent-specific WebSocket endpoint
    fastify.get('/ws/agents/:agentId', { websocket: true }, (connection, request) => {
      const { agentId } = request.params;
      const connectionId = `agent_conn_${agentId}_${Date.now()}`;
      
      const clientInfo = {
        id: connectionId,
        socket: connection.socket,
        agentId,
        connectedAt: Date.now(),
        type: 'agent_channel'
      };

      if (!agentChannels.has(agentId)) {
        agentChannels.set(agentId, new Set());
      }
      agentChannels.get(agentId).add(connectionId);
      connections.set(connectionId, clientInfo);

      logger.info('🤖 Agent WebSocket channel connected', {
        agentId,
        connectionId,
        agentConnections: agentChannels.get(agentId).size
      });

      connection.socket.send(JSON.stringify({
        type: 'agent_channel_connected',
        agentId,
        connectionId,
        timestamp: new Date().toISOString()
      }));

      connection.socket.on('message', async (rawMessage) => {
        try {
          const message = JSON.parse(rawMessage.toString());
          await handleAgentChannelMessage(agentId, connectionId, message);
        } catch (error) {
          logger.error('❌ Agent channel message failed:', error);
        }
      });

      connection.socket.on('close', () => {
        agentChannels.get(agentId)?.delete(connectionId);
        connections.delete(connectionId);
        
        if (agentChannels.get(agentId)?.size === 0) {
          agentChannels.delete(agentId);
        }
      });
    });

    // System monitoring WebSocket endpoint
    fastify.get('/ws/monitoring', { websocket: true }, (connection, request) => {
      const connectionId = `monitor_${Date.now()}`;
      const clientInfo = {
        id: connectionId,
        socket: connection.socket,
        type: 'monitoring',
        connectedAt: Date.now()
      };

      connections.set(connectionId, clientInfo);

      // Send initial system status
      connection.socket.send(JSON.stringify({
        type: 'system_status',
        data: {
          totalConnections: connections.size,
          activeRooms: rooms.size,
          agentChannels: agentChannels.size,
          timestamp: new Date().toISOString()
        }
      }));

      // Send periodic system updates
      const monitoringInterval = setInterval(() => {
        if (connection.socket.readyState === 1) { // OPEN
          connection.socket.send(JSON.stringify({
            type: 'system_metrics',
            data: getSystemMetrics(),
            timestamp: new Date().toISOString()
          }));
        }
      }, 5000);

      connection.socket.on('close', () => {
        clearInterval(monitoringInterval);
        connections.delete(connectionId);
      });
    });
  });

  // Handle main WebSocket messages
  async function handleWebSocketMessage(connectionId, message, clientInfo) {
    const { type, data, room, target } = message;

    try {
      switch (type) {
        case 'subscribe':
          await handleSubscription(connectionId, data, clientInfo);
          break;

        case 'unsubscribe':
          await handleUnsubscription(connectionId, data, clientInfo);
          break;

        case 'join_room':
          await handleJoinRoom(connectionId, data.roomId, clientInfo);
          break;

        case 'leave_room':
          await handleLeaveRoom(connectionId, data.roomId, clientInfo);
          break;

        case 'broadcast_to_room':
          await handleRoomBroadcast(connectionId, data.roomId, data.message, clientInfo);
          break;

        case 'direct_message':
          await handleDirectMessage(connectionId, data.targetConnectionId, data.message, clientInfo);
          break;

        case 'agent_command':
          await handleAgentCommand(connectionId, data, clientInfo);
          break;

        case 'system_query':
          await handleSystemQuery(connectionId, data, clientInfo);
          break;

        case 'ping':
          clientInfo.socket.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;

        default:
          clientInfo.socket.send(JSON.stringify({
            type: 'error',
            error: `Unknown message type: ${type}`,
            timestamp: new Date().toISOString()
          }));
      }
    } catch (error) {
      logger.error('❌ WebSocket message handling failed:', error);
      clientInfo.socket.send(JSON.stringify({
        type: 'error',
        error: 'Message processing failed',
        timestamp: new Date().toISOString()
      }));
    }
  }

  // Handle agent channel messages
  async function handleAgentChannelMessage(agentId, connectionId, message) {
    const { type, data } = message;
    
    // Broadcast to all connections on this agent channel
    const agentConnections = agentChannels.get(agentId);
    if (agentConnections) {
      const broadcastMessage = JSON.stringify({
        type: 'agent_broadcast',
        agentId,
        originalMessage: message,
        timestamp: new Date().toISOString()
      });

      for (const connId of agentConnections) {
        const conn = connections.get(connId);
        if (conn && conn.socket.readyState === 1) {
          conn.socket.send(broadcastMessage);
        }
      }
    }
  }

  // Subscription management
  async function handleSubscription(connectionId, subscriptionData, clientInfo) {
    const { channels = [] } = subscriptionData;
    
    for (const channel of channels) {
      clientInfo.subscriptions.add(channel);
    }

    clientInfo.socket.send(JSON.stringify({
      type: 'subscription_confirmed',
      channels: Array.from(clientInfo.subscriptions),
      timestamp: new Date().toISOString()
    }));

    logger.debug('📡 Client subscribed to channels', {
      connectionId,
      channels,
      totalSubscriptions: clientInfo.subscriptions.size
    });
  }

  async function handleUnsubscription(connectionId, unsubscriptionData, clientInfo) {
    const { channels = [] } = unsubscriptionData;
    
    for (const channel of channels) {
      clientInfo.subscriptions.delete(channel);
    }

    clientInfo.socket.send(JSON.stringify({
      type: 'unsubscription_confirmed',
      channels,
      remainingChannels: Array.from(clientInfo.subscriptions),
      timestamp: new Date().toISOString()
    }));
  }

  // Room management
  async function handleJoinRoom(connectionId, roomId, clientInfo) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        members: new Set(),
        createdAt: Date.now(),
        messageCount: 0
      });
    }

    const room = rooms.get(roomId);
    room.members.add(connectionId);

    clientInfo.socket.send(JSON.stringify({
      type: 'room_joined',
      roomId,
      memberCount: room.members.size,
      timestamp: new Date().toISOString()
    }));

    // Notify other room members
    broadcastToRoom(roomId, {
      type: 'member_joined',
      roomId,
      connectionId,
      memberCount: room.members.size,
      timestamp: new Date().toISOString()
    }, connectionId);

    logger.info('🏠 Client joined room', {
      connectionId,
      roomId,
      memberCount: room.members.size
    });
  }

  async function handleLeaveRoom(connectionId, roomId, clientInfo) {
    const room = rooms.get(roomId);
    if (room) {
      room.members.delete(connectionId);
      
      if (room.members.size === 0) {
        rooms.delete(roomId);
      } else {
        // Notify remaining members
        broadcastToRoom(roomId, {
          type: 'member_left',
          roomId,
          connectionId,
          memberCount: room.members.size,
          timestamp: new Date().toISOString()
        });
      }
    }

    clientInfo.socket.send(JSON.stringify({
      type: 'room_left',
      roomId,
      timestamp: new Date().toISOString()
    }));
  }

  // Room broadcasting
  async function handleRoomBroadcast(connectionId, roomId, message, clientInfo) {
    const room = rooms.get(roomId);
    if (!room || !room.members.has(connectionId)) {
      clientInfo.socket.send(JSON.stringify({
        type: 'error',
        error: 'Not a member of this room',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    room.messageCount++;
    
    broadcastToRoom(roomId, {
      type: 'room_message',
      roomId,
      fromConnectionId: connectionId,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // Direct messaging
  async function handleDirectMessage(connectionId, targetConnectionId, message, clientInfo) {
    const targetClient = connections.get(targetConnectionId);
    
    if (!targetClient) {
      clientInfo.socket.send(JSON.stringify({
        type: 'error',
        error: 'Target connection not found',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    targetClient.socket.send(JSON.stringify({
      type: 'direct_message',
      fromConnectionId: connectionId,
      message,
      timestamp: new Date().toISOString()
    }));

    // Send confirmation to sender
    clientInfo.socket.send(JSON.stringify({
      type: 'message_sent',
      targetConnectionId,
      timestamp: new Date().toISOString()
    }));
  }

  // Agent command handling
  async function handleAgentCommand(connectionId, commandData, clientInfo) {
    const { agentId, command, parameters } = commandData;

    // This would integrate with the agent system
    const response = {
      type: 'agent_response',
      agentId,
      command,
      response: 'Command processed successfully', // Mock response
      timestamp: new Date().toISOString()
    };

    clientInfo.socket.send(JSON.stringify(response));

    // Broadcast to agent channel if it exists
    const agentConnections = agentChannels.get(agentId);
    if (agentConnections) {
      const notification = JSON.stringify({
        type: 'agent_command_executed',
        agentId,
        command,
        executedBy: connectionId,
        timestamp: new Date().toISOString()
      });

      for (const connId of agentConnections) {
        const conn = connections.get(connId);
        if (conn && conn.socket.readyState === 1) {
          conn.socket.send(notification);
        }
      }
    }
  }

  // System query handling
  async function handleSystemQuery(connectionId, queryData, clientInfo) {
    const { query } = queryData;
    let response;

    switch (query) {
      case 'connections':
        response = {
          totalConnections: connections.size,
          activeRooms: rooms.size,
          agentChannels: agentChannels.size
        };
        break;

      case 'rooms':
        response = Array.from(rooms.entries()).map(([id, room]) => ({
          id,
          memberCount: room.members.size,
          messageCount: room.messageCount,
          createdAt: room.createdAt
        }));
        break;

      case 'agents':
        response = Array.from(agentChannels.entries()).map(([agentId, connections]) => ({
          agentId,
          connectionCount: connections.size
        }));
        break;

      default:
        response = { error: 'Unknown query' };
    }

    clientInfo.socket.send(JSON.stringify({
      type: 'system_query_response',
      query,
      response,
      timestamp: new Date().toISOString()
    }));
  }

  // Connection cleanup
  function handleConnectionClose(connectionId) {
    const clientInfo = connections.get(connectionId);
    if (!clientInfo) return;

    // Remove from rooms
    for (const [roomId, room] of rooms) {
      if (room.members.has(connectionId)) {
        room.members.delete(connectionId);
        
        if (room.members.size === 0) {
          rooms.delete(roomId);
        } else {
          broadcastToRoom(roomId, {
            type: 'member_disconnected',
            roomId,
            connectionId,
            memberCount: room.members.size,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Remove from agent channels
    if (clientInfo.agentId) {
      const agentConnections = agentChannels.get(clientInfo.agentId);
      if (agentConnections) {
        agentConnections.delete(connectionId);
        if (agentConnections.size === 0) {
          agentChannels.delete(clientInfo.agentId);
        }
      }
    }

    connections.delete(connectionId);
    
    logger.info('🔌 WebSocket connection closed', {
      connectionId,
      totalConnections: connections.size,
      sessionDuration: Date.now() - clientInfo.connectedAt
    });
  }

  // Utility functions
  function broadcastToRoom(roomId, message, excludeConnectionId = null) {
    const room = rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    
    for (const connectionId of room.members) {
      if (connectionId === excludeConnectionId) continue;
      
      const client = connections.get(connectionId);
      if (client && client.socket.readyState === 1) {
        client.socket.send(messageStr);
      }
    }
  }

  function broadcastToSubscribers(channel, message) {
    const messageStr = JSON.stringify({
      ...message,
      channel,
      type: 'channel_broadcast'
    });

    for (const [connectionId, clientInfo] of connections) {
      if (clientInfo.subscriptions.has(channel) && clientInfo.socket.readyState === 1) {
        clientInfo.socket.send(messageStr);
      }
    }
  }

  function getSystemMetrics() {
    return {
      connections: {
        total: connections.size,
        byType: {
          client: Array.from(connections.values()).filter(c => !c.type || c.type === 'client').length,
          agent: Array.from(connections.values()).filter(c => c.type === 'agent_channel').length,
          monitoring: Array.from(connections.values()).filter(c => c.type === 'monitoring').length
        }
      },
      rooms: {
        total: rooms.size,
        totalMembers: Array.from(rooms.values()).reduce((sum, room) => sum + room.members.size, 0),
        totalMessages: Array.from(rooms.values()).reduce((sum, room) => sum + room.messageCount, 0)
      },
      agents: {
        totalChannels: agentChannels.size,
        totalConnections: Array.from(agentChannels.values()).reduce((sum, connections) => sum + connections.size, 0)
      },
      uptime: process.uptime() * 1000
    };
  }

  // Expose broadcasting functions for use by other services
  fastify.decorate('broadcast', {
    toRoom: broadcastToRoom,
    toSubscribers: broadcastToSubscribers,
    toAll: (message) => {
      const messageStr = JSON.stringify(message);
      for (const [connectionId, clientInfo] of connections) {
        if (clientInfo.socket.readyState === 1) {
          clientInfo.socket.send(messageStr);
        }
      }
    },
    toAgent: (agentId, message) => {
      const agentConnections = agentChannels.get(agentId);
      if (agentConnections) {
        const messageStr = JSON.stringify(message);
        for (const connId of agentConnections) {
          const conn = connections.get(connId);
          if (conn && conn.socket.readyState === 1) {
            conn.socket.send(messageStr);
          }
        }
      }
    }
  });

  logger.info('✅ WebSocket routes registered with advanced real-time capabilities');
}