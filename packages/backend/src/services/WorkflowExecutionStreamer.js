/**
 * Workflow Execution Streaming Service
 * 
 * Provides Server-Sent Events (SSE) streaming for real-time workflow
 * execution updates with proper heartbeat protocol.
 */

import { EventEmitter } from 'events';

class WorkflowExecutionStreamer extends EventEmitter {
  constructor() {
    super();
    this.activeConnections = new Map();
    this.executionStates = new Map();
    this.heartbeatInterval = 30000; // 30 seconds
    this.cleanupInterval = 60000; // 1 minute
    
    // Start cleanup process
    this.startCleanup();
  }

  /**
   * Create SSE connection for workflow execution streaming
   */
  createSSEConnection(req, res, executionId) {
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    const connectionId = `${executionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connection = {
      id: connectionId,
      res,
      executionId,
      userId: req.user?.id,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      isActive: true
    };

    // Store connection
    this.activeConnections.set(connectionId, connection);

    // Send initial connection event
    this.sendSSEMessage(connectionId, {
      type: 'connection',
      data: {
        connectionId,
        executionId,
        timestamp: new Date().toISOString(),
        message: 'Connected to workflow execution stream'
      }
    });

    // Send current execution state if available
    const currentState = this.executionStates.get(executionId);
    if (currentState) {
      this.sendSSEMessage(connectionId, {
        type: 'state',
        data: currentState
      });
    }

    // Handle client disconnect
    req.on('close', () => {
      this.closeConnection(connectionId);
    });

    req.on('error', () => {
      this.closeConnection(connectionId);
    });

    // Start heartbeat for this connection
    this.startHeartbeat(connectionId);

    return connectionId;
  }

  /**
   * Send workflow execution event to all relevant connections
   */
  broadcastExecutionEvent(executionId, event) {
    const relevantConnections = Array.from(this.activeConnections.values())
      .filter(conn => conn.executionId === executionId && conn.isActive);

    for (const connection of relevantConnections) {
      this.sendSSEMessage(connection.id, {
        type: 'execution_event',
        data: {
          ...event,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update execution state
    this.updateExecutionState(executionId, event);
  }

  /**
   * Send node execution update
   */
  sendNodeUpdate(executionId, nodeId, status, data = {}) {
    this.broadcastExecutionEvent(executionId, {
      eventType: 'node_update',
      nodeId,
      status, // 'started', 'completed', 'failed', 'skipped'
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send workflow status update
   */
  sendWorkflowUpdate(executionId, status, data = {}) {
    this.broadcastExecutionEvent(executionId, {
      eventType: 'workflow_update',
      status, // 'started', 'running', 'completed', 'failed', 'cancelled'
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send log message
   */
  sendLogMessage(executionId, level, message, nodeId = null, metadata = {}) {
    this.broadcastExecutionEvent(executionId, {
      eventType: 'log',
      level, // 'info', 'warn', 'error', 'debug', 'success'
      message,
      nodeId,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send progress update
   */
  sendProgressUpdate(executionId, progress) {
    this.broadcastExecutionEvent(executionId, {
      eventType: 'progress',
      progress: {
        current: progress.current || 0,
        total: progress.total || 100,
        percentage: progress.percentage || Math.round((progress.current / progress.total) * 100),
        message: progress.message || '',
        completedNodes: progress.completedNodes || [],
        currentNode: progress.currentNode || null
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send variable update
   */
  sendVariableUpdate(executionId, variables) {
    this.broadcastExecutionEvent(executionId, {
      eventType: 'variables',
      variables,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send error event
   */
  sendError(executionId, error, nodeId = null) {
    this.broadcastExecutionEvent(executionId, {
      eventType: 'error',
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN_ERROR',
        nodeId,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send SSE message to specific connection
   */
  sendSSEMessage(connectionId, message) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection || !connection.isActive) {
      return false;
    }

    try {
      const eventData = JSON.stringify(message.data);
      const sseMessage = `event: ${message.type}\ndata: ${eventData}\n\n`;
      
      connection.res.write(sseMessage);
      return true;
    } catch (error) {
      console.error(`Failed to send SSE message to connection ${connectionId}:`, error);
      this.closeConnection(connectionId);
      return false;
    }
  }

  /**
   * Start heartbeat for connection
   */
  startHeartbeat(connectionId) {
    const sendHeartbeat = () => {
      const connection = this.activeConnections.get(connectionId);
      if (!connection || !connection.isActive) {
        return;
      }

      const success = this.sendSSEMessage(connectionId, {
        type: 'heartbeat',
        data: {
          timestamp: new Date().toISOString(),
          connectionId
        }
      });

      if (success) {
        connection.lastHeartbeat = new Date();
        setTimeout(sendHeartbeat, this.heartbeatInterval);
      }
    };

    // Start heartbeat after initial delay
    setTimeout(sendHeartbeat, this.heartbeatInterval);
  }

  /**
   * Close connection
   */
  closeConnection(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      connection.isActive = false;
      
      try {
        connection.res.end();
      } catch (error) {
        // Connection already closed
      }

      this.activeConnections.delete(connectionId);
      
      console.log(`SSE connection closed: ${connectionId}`);
    }
  }

  /**
   * Update execution state
   */
  updateExecutionState(executionId, event) {
    if (!this.executionStates.has(executionId)) {
      this.executionStates.set(executionId, {
        executionId,
        status: 'running',
        startedAt: new Date().toISOString(),
        nodes: {},
        variables: {},
        logs: [],
        progress: { current: 0, total: 100 }
      });
    }

    const state = this.executionStates.get(executionId);

    switch (event.eventType) {
      case 'workflow_update':
        state.status = event.status;
        if (event.status === 'completed' || event.status === 'failed') {
          state.completedAt = new Date().toISOString();
        }
        break;

      case 'node_update':
        state.nodes[event.nodeId] = {
          status: event.status,
          data: event.data,
          timestamp: event.timestamp
        };
        break;

      case 'log':
        state.logs.push({
          level: event.level,
          message: event.message,
          nodeId: event.nodeId,
          timestamp: event.timestamp
        });
        // Keep only last 100 logs in memory
        if (state.logs.length > 100) {
          state.logs = state.logs.slice(-100);
        }
        break;

      case 'progress':
        state.progress = event.progress;
        break;

      case 'variables':
        state.variables = { ...state.variables, ...event.variables };
        break;

      case 'error':
        state.lastError = event.error;
        break;
    }

    state.lastUpdated = new Date().toISOString();
  }

  /**
   * Get execution state
   */
  getExecutionState(executionId) {
    return this.executionStates.get(executionId) || null;
  }

  /**
   * Clean up finished executions and dead connections
   */
  startCleanup() {
    const cleanup = () => {
      const now = new Date();
      
      // Clean up dead connections
      for (const [connectionId, connection] of this.activeConnections.entries()) {
        const timeSinceHeartbeat = now - connection.lastHeartbeat;
        if (timeSinceHeartbeat > this.heartbeatInterval * 3) {
          console.log(`Cleaning up dead connection: ${connectionId}`);
          this.closeConnection(connectionId);
        }
      }

      // Clean up old execution states (keep for 1 hour after completion)
      for (const [executionId, state] of this.executionStates.entries()) {
        if (state.completedAt) {
          const timeSinceCompletion = now - new Date(state.completedAt);
          if (timeSinceCompletion > 3600000) { // 1 hour
            this.executionStates.delete(executionId);
            console.log(`Cleaned up execution state: ${executionId}`);
          }
        } else {
          // Clean up running executions older than 24 hours
          const timeSinceStart = now - new Date(state.startedAt);
          if (timeSinceStart > 86400000) { // 24 hours
            this.executionStates.delete(executionId);
            console.log(`Cleaned up stale execution state: ${executionId}`);
          }
        }
      }

      setTimeout(cleanup, this.cleanupInterval);
    };

    setTimeout(cleanup, this.cleanupInterval);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const activeConnections = Array.from(this.activeConnections.values())
      .filter(conn => conn.isActive);

    return {
      activeConnections: activeConnections.length,
      totalExecutions: this.executionStates.size,
      connectionsPerExecution: activeConnections.reduce((acc, conn) => {
        acc[conn.executionId] = (acc[conn.executionId] || 0) + 1;
        return acc;
      }, {}),
      oldestConnection: activeConnections.length > 0 
        ? Math.min(...activeConnections.map(c => c.connectedAt))
        : null
    };
  }

  /**
   * Close all connections for an execution
   */
  closeExecutionConnections(executionId) {
    const connections = Array.from(this.activeConnections.values())
      .filter(conn => conn.executionId === executionId);

    for (const connection of connections) {
      this.closeConnection(connection.id);
    }
  }

  /**
   * Shutdown streamer
   */
  shutdown() {
    for (const connectionId of this.activeConnections.keys()) {
      this.closeConnection(connectionId);
    }
    this.executionStates.clear();
  }
}

// Singleton instance
const workflowStreamer = new WorkflowExecutionStreamer();

export default workflowStreamer;