/**
 * Cartrita V2 - WebSocket Handler
 * Real-time communication for multi-agent system
 */

import { logger } from '../utils/logger.js';
import { getRedisSubscriber, getRedisPublisher } from '../redis/connection.js';
import { trace } from '@opentelemetry/api';

const connectedClients = new Map();

export function setupWebSocket(io) {
  logger.info('Setting up WebSocket server...');
  
  io.on('connection', (socket) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan('websocket.connection');
    
    try {
      logger.info('Client connected', {
        socketId: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Store client connection info
      connectedClients.set(socket.id, {
        socket,
        connectedAt: new Date(),
        userId: null // Will be set after authentication
      });

      // Authentication handler
      socket.on('authenticate', async (data) => {
        const authSpan = trace.getActiveTracer('cartrita-v2').startSpan('websocket.authenticate');
        
        try {
          // TODO: Implement JWT token validation
          const { token } = data;
          
          if (!token) {
            socket.emit('auth_error', { message: 'Token required' });
            authSpan.setStatus({ code: 2, message: 'No token provided' });
            return;
          }

          // Validate token and get user info
          // const user = await validateJWTToken(token);
          const user = { id: 1, name: 'Demo User' }; // TODO: Replace with actual validation
          
          // Update client info
          const clientInfo = connectedClients.get(socket.id);
          if (clientInfo) {
            clientInfo.userId = user.id;
            clientInfo.user = user;
          }

          // Join user-specific room
          socket.join(`user:${user.id}`);
          
          socket.emit('authenticated', { 
            user: { id: user.id, name: user.name }
          });

          logger.info('Client authenticated', {
            socketId: socket.id,
            userId: user.id,
            userName: user.name
          });

          authSpan.setStatus({ code: 1 });
        } catch (error) {
          authSpan.recordException(error);
          authSpan.setStatus({ code: 2, message: error.message });
          
          logger.error('WebSocket authentication failed', {
            socketId: socket.id,
            error: error.message
          });
          
          socket.emit('auth_error', { message: 'Authentication failed' });
        } finally {
          authSpan.end();
        }
      });

      // Agent communication handler
      socket.on('agent_message', async (data) => {
        const msgSpan = trace.getActiveTracer('cartrita-v2').startSpan('websocket.agent_message');
        
        try {
          const clientInfo = connectedClients.get(socket.id);
          if (!clientInfo?.userId) {
            socket.emit('error', { message: 'Authentication required' });
            msgSpan.setStatus({ code: 2, message: 'Not authenticated' });
            return;
          }

          logger.info('Agent message received', {
            socketId: socket.id,
            userId: clientInfo.userId,
            agent: data.agent,
            type: data.type
          });

          // Broadcast to Redis for agent processing
          const redisPublisher = getRedisPublisher();
          await redisPublisher.publish('agent_messages', JSON.stringify({
            userId: clientInfo.userId,
            socketId: socket.id,
            message: data,
            timestamp: new Date().toISOString()
          }));

          msgSpan.setAttributes({
            'websocket.user_id': clientInfo.userId,
            'websocket.agent': data.agent || 'unknown',
            'websocket.message_type': data.type || 'unknown'
          });

          msgSpan.setStatus({ code: 1 });
        } catch (error) {
          msgSpan.recordException(error);
          msgSpan.setStatus({ code: 2, message: error.message });
          
          logger.error('WebSocket message handling failed', {
            socketId: socket.id,
            error: error.message
          });
          
          socket.emit('error', { message: 'Message processing failed' });
        } finally {
          msgSpan.end();
        }
      });

      // Real-time agent status updates
      socket.on('subscribe_agent_status', (data) => {
        const clientInfo = connectedClients.get(socket.id);
        if (!clientInfo?.userId) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        // Join agent status room for this user
        socket.join(`agent_status:${clientInfo.userId}`);
        
        logger.debug('Client subscribed to agent status', {
          socketId: socket.id,
          userId: clientInfo.userId
        });
      });

      // Workflow execution updates
      socket.on('subscribe_workflow', (data) => {
        const clientInfo = connectedClients.get(socket.id);
        if (!clientInfo?.userId) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        const { workflowId } = data;
        if (workflowId) {
          socket.join(`workflow:${workflowId}`);
          logger.debug('Client subscribed to workflow', {
            socketId: socket.id,
            userId: clientInfo.userId,
            workflowId
          });
        }
      });

      // Real-time analytics subscription
      socket.on('subscribe_analytics', (data) => {
        const clientInfo = connectedClients.get(socket.id);
        if (!clientInfo?.userId) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        // Join analytics room for this user
        socket.join(`analytics:${clientInfo.userId}`);
        
        // Send initial analytics data
        sendAnalyticsData(socket, data.timeRange || 'day');
        
        logger.debug('Client subscribed to analytics', {
          socketId: socket.id,
          userId: clientInfo.userId,
          timeRange: data.timeRange || 'day'
        });
      });

      // Start real-time data streaming
      socket.on('stream:start', (data) => {
        const clientInfo = connectedClients.get(socket.id);
        if (!clientInfo?.userId) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        const { type, interval = 5000 } = data;
        
        // Clear existing interval if any
        if (clientInfo.streamInterval) {
          clearInterval(clientInfo.streamInterval);
        }

        // Start streaming based on type
        switch (type) {
          case 'system:stats':
            clientInfo.streamInterval = setInterval(async () => {
              const stats = await generateSystemStats();
              socket.emit('system:stats', stats);
            }, Math.max(interval, 1000)); // Minimum 1 second interval
            break;

          case 'agent:status':
            clientInfo.streamInterval = setInterval(async () => {
              const agentStatus = await generateAgentStatuses();
              agentStatus.forEach(agent => {
                socket.emit('agent:status', agent);
              });
            }, Math.max(interval, 5000)); // Minimum 5 second interval
            break;

          case 'activity:feed':
            clientInfo.streamInterval = setInterval(async () => {
              const activity = await generateRecentActivity();
              if (activity) {
                socket.emit('activity:new', activity);
              }
            }, Math.max(interval, 2000)); // Minimum 2 second interval
            break;
        }

        logger.debug('Started data streaming', {
          socketId: socket.id,
          userId: clientInfo.userId,
          type,
          interval
        });
      });

      // Stop data streaming
      socket.on('stream:stop', (data) => {
        const clientInfo = connectedClients.get(socket.id);
        if (clientInfo?.streamInterval) {
          clearInterval(clientInfo.streamInterval);
          clientInfo.streamInterval = null;
          
          logger.debug('Stopped data streaming', {
            socketId: socket.id,
            type: data.type
          });
        }
      });

      // Stop all streaming
      socket.on('stream:stop:all', () => {
        const clientInfo = connectedClients.get(socket.id);
        if (clientInfo?.streamInterval) {
          clearInterval(clientInfo.streamInterval);
          clientInfo.streamInterval = null;
          
          logger.debug('Stopped all data streaming', {
            socketId: socket.id
          });
        }
      });

      // Unsubscribe from analytics
      socket.on('unsubscribe_analytics', () => {
        const clientInfo = connectedClients.get(socket.id);
        if (clientInfo?.userId) {
          socket.leave(`analytics:${clientInfo.userId}`);
          logger.debug('Client unsubscribed from analytics', {
            socketId: socket.id,
            userId: clientInfo.userId
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        const clientInfo = connectedClients.get(socket.id);
        
        // Clean up streaming intervals
        if (clientInfo?.streamInterval) {
          clearInterval(clientInfo.streamInterval);
        }
        
        logger.info('Client disconnected', {
          socketId: socket.id,
          reason,
          userId: clientInfo?.userId
        });
        
        connectedClients.delete(socket.id);
        span.setStatus({ code: 1 });
        span.end();
      });

      span.setAttributes({
        'websocket.socket_id': socket.id,
        'websocket.client_ip': socket.handshake.address
      });
      
      span.setStatus({ code: 1 });
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      logger.error('WebSocket connection setup failed', {
        error: error.message,
        socketId: socket.id
      });
    }
  });

  // Setup Redis subscription for broadcasting
  setupRedisSubscription(io);
  
  logger.info('✅ WebSocket server setup complete');
}

async function setupRedisSubscription(io) {
  try {
    const redisSubscriber = getRedisSubscriber();
    
    // Subscribe to agent responses and analytics updates
    const channels = ['agent_responses', 'analytics_updates'];
    redisSubscriber.subscribe(channels, (err, count) => {
      if (err) {
        logger.error('Failed to subscribe to Redis channels', { error: err.message });
      } else {
        logger.info(`Subscribed to ${count} Redis channels`);
      }
    });

    redisSubscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        
        switch (channel) {
          case 'agent_responses':
            // Send response back to specific user
            if (data.socketId && data.response) {
              io.to(data.socketId).emit('agent_response', data.response);
            } else if (data.userId) {
              io.to(`user:${data.userId}`).emit('agent_response', data.response);
            }
            break;
            
          case 'agent_status':
            // Broadcast agent status updates
            if (data.userId) {
              io.to(`agent_status:${data.userId}`).emit('agent_status_update', data);
            }
            break;
            
          case 'workflow_updates':
            // Send workflow progress updates
            if (data.workflowId) {
              io.to(`workflow:${data.workflowId}`).emit('workflow_update', data);
            }
            break;
            
          case 'analytics_updates':
            // Broadcast analytics updates to subscribed users
            if (data.userId) {
              io.to(`analytics:${data.userId}`).emit('analytics_update', data);
            } else {
              // Broadcast to all analytics subscribers
              io.to('analytics_global').emit('analytics_update', data);
            }
            break;
        }
      } catch (error) {
        logger.error('Failed to process Redis message', {
          channel,
          error: error.message
        });
      }
    });
  } catch (error) {
    logger.error('Failed to setup Redis subscription', { error: error.message });
  }
}

// Utility functions
export function getConnectedClients() {
  return Array.from(connectedClients.values()).map(client => ({
    socketId: client.socket.id,
    userId: client.userId,
    connectedAt: client.connectedAt,
    userName: client.user?.name
  }));
}

export function broadcastToUser(userId, event, data) {
  const io = global.socketIO;
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
    logger.debug('Broadcast to user', { userId, event });
  }
}

export function broadcastToWorkflow(workflowId, event, data) {
  const io = global.socketIO;
  if (io) {
    io.to(`workflow:${workflowId}`).emit(event, data);
    logger.debug('Broadcast to workflow', { workflowId, event });
  }
}

export function broadcastAnalyticsUpdate(userId, data) {
  const io = global.socketIO;
  if (io) {
    if (userId) {
      io.to(`analytics:${userId}`).emit('analytics_update', data);
    } else {
      io.to('analytics_global').emit('analytics_update', data);
    }
    logger.debug('Broadcast analytics update', { userId, type: data.type });
  }
}

// Send analytics data to a specific socket
async function sendAnalyticsData(socket, timeRange = 'week') {
  try {
    // Generate real-time analytics data
    const analyticsData = await generateAnalyticsData(timeRange);
    socket.emit('analytics_data', analyticsData);
  } catch (error) {
    logger.error('Failed to send analytics data', { error: error.message });
    socket.emit('analytics_error', { message: 'Failed to fetch analytics data' });
  }
}

// Generate analytics data based on time range
async function generateAnalyticsData(timeRange) {
  // In a real implementation, this would query the database
  // For now, we'll generate realistic mock data
  
  const now = new Date();
  const dataPoints = timeRange === 'day' ? 24 : 
                    timeRange === 'week' ? 7 : 
                    timeRange === 'month' ? 30 : 365;
  
  const interactions = [];
  const users = [];
  const responseTime = [];
  const successRate = [];
  
  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(now);
    if (timeRange === 'day') {
      date.setHours(date.getHours() - i);
    } else {
      date.setDate(date.getDate() - i);
    }
    
    interactions.push({
      name: date.toISOString(),
      value: Math.floor(Math.random() * 100) + 50,
      change: Math.random() > 0.5 ? '+' + (Math.random() * 20).toFixed(1) + '%' : '-' + (Math.random() * 10).toFixed(1) + '%'
    });
    
    users.push({
      name: date.toISOString(),
      value: Math.floor(Math.random() * 50) + 10,
      change: Math.random() > 0.5 ? '+' + (Math.random() * 15).toFixed(1) + '%' : '-' + (Math.random() * 8).toFixed(1) + '%'
    });
    
    responseTime.push({
      name: date.toISOString(),
      value: (Math.random() * 2 + 0.5).toFixed(2),
      change: Math.random() > 0.5 ? '+' + (Math.random() * 10).toFixed(1) + '%' : '-' + (Math.random() * 15).toFixed(1) + '%'
    });
    
    successRate.push({
      name: date.toISOString(),
      value: (Math.random() * 5 + 95).toFixed(1),
      change: Math.random() > 0.5 ? '+' + (Math.random() * 2).toFixed(1) + '%' : '-' + (Math.random() * 1).toFixed(1) + '%'
    });
  }
  
  return {
    interactions: interactions.reverse(),
    users: users.reverse(),
    responseTime: responseTime.reverse(),
    successRate: successRate.reverse(),
    lastUpdated: new Date().toISOString(),
    timeRange
  };
}

// Generate real-time system stats
async function generateSystemStats() {
  const memUsage = process.memoryUsage();
  const totalMem = 8589934592; // 8GB in bytes
  const freeMem = totalMem - memUsage.heapUsed;
  const usedMem = totalMem - freeMem;
  
  const cpuUsage = process.cpuUsage();
  const cpuPercent = Math.min((cpuUsage.user + cpuUsage.system) / 10000, 100);
  
  const aiLoad = Math.min((memUsage.heapUsed / memUsage.heapTotal) * 100, 100);
  const powerEfficiency = Math.max(90 - (cpuPercent * 0.2) - (aiLoad * 0.1), 60);
  
  return {
    cpu: Math.round(cpuPercent * 100) / 100,
    memory: Math.round((usedMem / totalMem) * 10000) / 100,
    aiLoad: Math.round(aiLoad * 100) / 100,
    powerEfficiency: Math.round(powerEfficiency * 100) / 100,
    timestamp: new Date().toISOString()
  };
}

// Generate agent status updates
async function generateAgentStatuses() {
  const agentIds = [
    'cartrita_core', 'code_maestro', 'data_science_wizard', 'creative_director',
    'productivity_master', 'security_guardian', 'business_strategy', 'research_intelligence',
    'communication_expert', 'multimodal_fusion', 'personalization_expert', 'integration_master',
    'quality_assurance', 'emergency_response', 'automation_architect'
  ];

  return agentIds.map(id => {
    const statusOptions = ['active', 'inactive', 'busy', 'error'];
    const weights = [0.6, 0.2, 0.15, 0.05];
    const randomValue = Math.random();
    let status = 'active';
    
    let cumulativeWeight = 0;
    for (let i = 0; i < statusOptions.length; i++) {
      cumulativeWeight += weights[i];
      if (randomValue <= cumulativeWeight) {
        status = statusOptions[i];
        break;
      }
    }

    return {
      agentId: id,
      status,
      tasksInProgress: status === 'busy' ? Math.floor(Math.random() * 5) + 1 : 
                      status === 'active' ? Math.floor(Math.random() * 3) : 0,
      lastActivity: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      performance: {
        successRate: Math.round((90 + Math.random() * 10) * 100) / 100,
        averageResponseTime: Math.round((1 + Math.random() * 5) * 100) / 100,
        tasksCompleted: Math.floor(Math.random() * 1000) + 50
      }
    };
  });
}

// Generate recent activity
async function generateRecentActivity() {
  const activityTypes = [
    { type: 'chat', messages: ['New conversation started', 'Agent responded to query', 'Chat session completed'] },
    { type: 'agent', messages: ['Agent completed task', 'Agent started processing', 'Agent updated status'] },
    { type: 'system', messages: ['System health check passed', 'Database optimization completed', 'Cache updated'] },
    { type: 'workflow', messages: ['Workflow executed', 'Pipeline completed', 'Process started'] },
    { type: 'alert', messages: ['Performance threshold reached', 'Warning resolved', 'Update applied'] }
  ];

  // Only generate activity 30% of the time to make it realistic
  if (Math.random() > 0.3) {
    return null;
  }

  const typeData = activityTypes[Math.floor(Math.random() * activityTypes.length)];
  const message = typeData.messages[Math.floor(Math.random() * typeData.messages.length)];
  
  return {
    id: `activity_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: typeData.type,
    message,
    timestamp: new Date().toISOString(),
    metadata: {
      source: 'cartrita-v2',
      priority: Math.random() > 0.8 ? 'high' : 'normal'
    }
  };
}