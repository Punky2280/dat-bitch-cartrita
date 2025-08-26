/**
 * Node.js MCP Python Bridge Service - Iteration 1
 * Seamless communication with Python agents via MCP protocol
 */

import { EventEmitter } from 'events';
import net from 'net';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import msgpack from 'msgpack-lite';
import { v4 as uuidv4 } from 'uuid';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Bridge service for communication with Python MCP agents
 */
class MCPPythonBridge extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      socketPath: config.socketPath || '/tmp/cartrita_mcp.sock',
      pythonServiceUrl: config.pythonServiceUrl || 'http://localhost:8003',
      heartbeatInterval: config.heartbeatInterval || 30000,
      reconnectDelay: config.reconnectDelay || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      messageTimeout: config.messageTimeout || 30000,
      ...config
    };

    // Connection management
    this.server = null;
    this.pythonConnection = null;
    this.isListening = false;
    this.reconnectAttempts = 0;
    
    // Python agent registry
    this.pythonAgents = new Map();
    this.capabilityIndex = new Map(); // capability -> agent names
    this.agentLoadMap = new Map(); // agent -> current load
    
    // Task management
    this.activeTasks = new Map();
    this.taskQueue = [];
    this.pendingResponses = new Map();
    
    // Statistics and monitoring
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      tasksRouted: 0,
      pythonAgentsRegistered: 0,
      connectionFailures: 0,
      avgResponseTime: 0,
      lastHeartbeat: null,
      uptime: Date.now()
    };

    // Telemetry
    this.tracer = OpenTelemetryTracing.getTracer('mcp-python-bridge');
    
    console.log('[MCPPythonBridge] Initialized with config:', {
      socketPath: this.config.socketPath,
      pythonServiceUrl: this.config.pythonServiceUrl
    });
  }

  /**
   * Initialize the bridge and start listening for Python connections
   */
  async initialize() {
    try {
      await this._setupUnixSocket();
      this._startHeartbeatLoop();
      
      console.log('[MCPPythonBridge] Successfully initialized');
      return true;
    } catch (error) {
      console.error('[MCPPythonBridge] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Setup Unix socket server for Python communication
   */
  async _setupUnixSocket() {
    return OpenTelemetryTracing.traceOperation('mcp.python.bridge.setup_socket', async (span) => {
      try {
        // Remove existing socket file if it exists
        try {
          await fs.unlink(this.config.socketPath);
        } catch (err) {
          // Socket file doesn't exist, that's fine
        }

        this.server = net.createServer((socket) => {
          console.log('[MCPPythonBridge] Python service connected');
          this._handlePythonConnection(socket);
        });

        return new Promise((resolve, reject) => {
          this.server.listen(this.config.socketPath, () => {
            this.isListening = true;
            span.setAttributes({
              'mcp.socket.path': this.config.socketPath,
              'mcp.socket.listening': true
            });
            console.log(`[MCPPythonBridge] Listening on ${this.config.socketPath}`);
            resolve();
          });

          this.server.on('error', (error) => {
            console.error('[MCPPythonBridge] Socket server error:', error);
            span.recordException(error);
            this.stats.connectionFailures++;
            reject(error);
          });
        });
      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Handle new Python service connection
   */
  _handlePythonConnection(socket) {
    this.pythonConnection = socket;
    this.reconnectAttempts = 0;

    // Setup message handling
    let buffer = Buffer.alloc(0);
    
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      this._processMessages(buffer);
    });

    socket.on('close', () => {
      console.log('[MCPPythonBridge] Python service disconnected');
      this.pythonConnection = null;
      this._handleReconnection();
    });

    socket.on('error', (error) => {
      console.error('[MCPPythonBridge] Python connection error:', error);
      this.stats.connectionFailures++;
      this._handleReconnection();
    });

    // Send welcome handshake
    this._sendHandshake();
  }

  /**
   * Process incoming messages from Python bridge
   */
  _processMessages(buffer) {
    while (buffer.length >= 4) {
      // Read message length (4 bytes, big-endian)
      const messageLength = buffer.readUInt32BE(0);
      
      if (buffer.length < 4 + messageLength) {
        // Not enough data for complete message
        break;
      }

      // Extract message data
      const messageData = buffer.subarray(4, 4 + messageLength);
      buffer = buffer.subarray(4 + messageLength);

      try {
        // Deserialize with msgpack
        const message = msgpack.decode(messageData);
        this._handleMessage(message);
        this.stats.messagesReceived++;
      } catch (error) {
        console.error('[MCPPythonBridge] Message deserialization failed:', error);
      }
    }
  }

  /**
   * Handle incoming message from Python bridge
   */
  async _handleMessage(message) {
    const span = this.tracer.startSpan(`mcp.python.bridge.handle_${message.type}`);
    
    try {
      span.setAttributes({
        'mcp.message.type': message.type,
        'mcp.message.source': message.source || 'unknown',
        'mcp.message.id': message.id || 'unknown'
      });

      switch (message.type) {
        case 'handshake':
          await this._handleHandshake(message);
          break;
          
        case 'agent_registration':
          await this._handleAgentRegistration(message);
          break;
          
        case 'task_response':
          await this._handleTaskResponse(message);
          break;
          
        case 'heartbeat':
          await this._handleHeartbeat(message);
          break;
          
        case 'heartbeat_response':
          await this._handleHeartbeatResponse(message);
          break;
          
        case 'agent_query_response':
          await this._handleAgentQueryResponse(message);
          break;
          
        case 'status_response':
          await this._handleStatusResponse(message);
          break;
          
        default:
          console.warn('[MCPPythonBridge] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error(`[MCPPythonBridge] Error handling ${message.type}:`, error);
      span.recordException(error);
    } finally {
      span.end();
    }
  }

  /**
   * Send handshake to Python bridge
   */
  async _sendHandshake() {
    const handshakeMessage = {
      id: uuidv4(),
      type: 'handshake',
      source: 'node-orchestrator',
      target: 'python-bridge',
      payload: {
        version: '1.0.0',
        capabilities: ['task_routing', 'agent_management', 'load_balancing'],
        nodeServiceUrl: process.env.VITE_BACKEND_URL || 'http://localhost:8000'
      },
      timestamp: new Date().toISOString()
    };

    await this._sendMessage(handshakeMessage);
  }

  /**
   * Handle handshake from Python bridge
   */
  async _handleHandshake(message) {
    console.log('[MCPPythonBridge] Received handshake from Python bridge:', message.payload);
    
    // Send handshake response
    const response = {
      id: uuidv4(),
      type: 'handshake_response',
      source: 'node-orchestrator',
      target: 'python-bridge',
      payload: {
        status: 'accepted',
        nodeCapabilities: ['mcp_orchestration', 'langchain_integration', 'real_time_api'],
        version: '1.0.0'
      },
      correlation_id: message.id,
      timestamp: new Date().toISOString()
    };

    await this._sendMessage(response);
  }

  /**
   * Handle Python agent registration
   */
  async _handleAgentRegistration(message) {
    const agentInfo = message.payload;
    const agentName = agentInfo.agent_name;

    // Store agent information
    this.pythonAgents.set(agentName, {
      ...agentInfo,
      registeredAt: new Date(),
      lastSeen: new Date(),
      taskCount: 0,
      avgResponseTime: 0
    });

    // Update capability index
    if (agentInfo.capabilities) {
      agentInfo.capabilities.forEach(cap => {
        if (!this.capabilityIndex.has(cap.name)) {
          this.capabilityIndex.set(cap.name, new Set());
        }
        this.capabilityIndex.get(cap.name).add(agentName);
      });
    }

    // Initialize load tracking
    this.agentLoadMap.set(agentName, 0);

    this.stats.pythonAgentsRegistered++;
    
    console.log(`[MCPPythonBridge] Registered Python agent: ${agentName}`);
    console.log(`[MCPPythonBridge] Agent capabilities:`, agentInfo.capabilities?.map(c => c.name));

    // Emit registration event for other services
    this.emit('agentRegistered', {
      name: agentName,
      language: 'python',
      capabilities: agentInfo.capabilities,
      type: agentInfo.agent_type
    });
  }

  /**
   * Route task to appropriate Python agent
   */
  async routeTaskToPython(task, requiredCapabilities = []) {
    return OpenTelemetryTracing.traceOperation('mcp.python.bridge.route_task', async (span) => {
      span.setAttributes({
        'mcp.task.id': task.task_id || 'unknown',
        'mcp.task.type': task.task_type || 'unknown',
        'mcp.required_capabilities': requiredCapabilities.join(',')
      });

      try {
        // Find capable agents
        const capableAgents = this._findCapableAgents(requiredCapabilities);
        
        if (capableAgents.length === 0) {
          throw new Error(`No Python agents found with required capabilities: ${requiredCapabilities.join(', ')}`);
        }

        // Select best agent (load balancing)
        const selectedAgent = this._selectBestAgent(capableAgents);
        span.setAttributes({
          'mcp.selected_agent': selectedAgent,
          'mcp.capable_agents_count': capableAgents.length
        });

        // Create task request message
        const taskMessage = {
          id: uuidv4(),
          type: 'task_request',
          source: 'node-orchestrator', 
          target: 'python-bridge',
          payload: task,
          timestamp: new Date().toISOString()
        };

        // Send task to Python bridge
        await this._sendMessage(taskMessage);

        // Track active task
        this.activeTasks.set(task.task_id, {
          taskId: task.task_id,
          agentName: selectedAgent,
          startTime: Date.now(),
          messageId: taskMessage.id
        });

        // Update agent load
        const currentLoad = this.agentLoadMap.get(selectedAgent) || 0;
        this.agentLoadMap.set(selectedAgent, currentLoad + 1);

        this.stats.tasksRouted++;

        console.log(`[MCPPythonBridge] Routed task ${task.task_id} to Python agent: ${selectedAgent}`);
        
        return {
          success: true,
          assignedAgent: selectedAgent,
          agentLanguage: 'python',
          taskId: task.task_id
        };

      } catch (error) {
        span.recordException(error);
        console.error('[MCPPythonBridge] Task routing failed:', error);
        throw error;
      }
    });
  }

  /**
   * Find agents capable of handling required capabilities
   */
  _findCapableAgents(requiredCapabilities) {
    const capableAgents = new Set();

    for (const capability of requiredCapabilities) {
      const agentsWithCapability = this.capabilityIndex.get(capability);
      if (agentsWithCapability) {
        agentsWithCapability.forEach(agentName => {
          // Check if agent is still registered and healthy
          if (this.pythonAgents.has(agentName)) {
            capableAgents.add(agentName);
          }
        });
      }
    }

    return Array.from(capableAgents);
  }

  /**
   * Select best agent based on load balancing
   */
  _selectBestAgent(capableAgents) {
    // Simple load-based selection (least loaded agent)
    let bestAgent = capableAgents[0];
    let lowestLoad = this.agentLoadMap.get(bestAgent) || 0;

    for (const agentName of capableAgents) {
      const agentLoad = this.agentLoadMap.get(agentName) || 0;
      if (agentLoad < lowestLoad) {
        lowestLoad = agentLoad;
        bestAgent = agentName;
      }
    }

    return bestAgent;
  }

  /**
   * Handle task response from Python agent
   */
  async _handleTaskResponse(message) {
    const taskResponse = message.payload;
    const taskId = taskResponse.task_id;

    // Find and remove active task
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      this.activeTasks.delete(taskId);

      // Update agent load
      const agentLoad = this.agentLoadMap.get(activeTask.agentName) || 1;
      this.agentLoadMap.set(activeTask.agentName, Math.max(0, agentLoad - 1));

      // Calculate response time
      const responseTime = Date.now() - activeTask.startTime;
      
      // Update agent statistics
      const agent = this.pythonAgents.get(activeTask.agentName);
      if (agent) {
        agent.taskCount++;
        agent.avgResponseTime = (agent.avgResponseTime + responseTime) / 2;
        agent.lastSeen = new Date();
      }

      // Update global statistics
      this.stats.avgResponseTime = (this.stats.avgResponseTime + responseTime) / 2;
    }

    // Emit task completion event
    this.emit('taskCompleted', {
      taskId,
      response: taskResponse,
      agentName: activeTask?.agentName,
      language: 'python'
    });

    console.log(`[MCPPythonBridge] Received task response for ${taskId} from Python agent`);
  }

  /**
   * Handle heartbeat from Python bridge
   */
  async _handleHeartbeat(message) {
    this.stats.lastHeartbeat = new Date();

    // Send heartbeat response
    const response = {
      id: uuidv4(),
      type: 'heartbeat_response',
      source: 'node-orchestrator',
      target: 'python-bridge',
      payload: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeTasks: this.activeTasks.size,
        registeredAgents: this.pythonAgents.size
      },
      correlation_id: message.id,
      timestamp: new Date().toISOString()
    };

    await this._sendMessage(response);
  }

  /**
   * Handle heartbeat response from Python bridge
   */
  async _handleHeartbeatResponse(message) {
    this.stats.lastHeartbeat = new Date();
    console.log('[MCPPythonBridge] Python bridge heartbeat:', message.payload.status);
  }

  /**
   * Send message to Python bridge
   */
  async _sendMessage(message) {
    if (!this.pythonConnection) {
      throw new Error('No Python connection available');
    }

    try {
      // Serialize with msgpack
      const messageData = msgpack.encode(message);
      
      // Create length-prefixed message
      const lengthBuffer = Buffer.allocUnsafe(4);
      lengthBuffer.writeUInt32BE(messageData.length, 0);
      
      const fullMessage = Buffer.concat([lengthBuffer, messageData]);
      
      // Send message
      this.pythonConnection.write(fullMessage);
      this.stats.messagesSent++;

      console.log(`[MCPPythonBridge] Sent ${message.type} message to Python bridge`);
      
    } catch (error) {
      console.error('[MCPPythonBridge] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Start heartbeat loop
   */
  _startHeartbeatLoop() {
    setInterval(async () => {
      if (this.pythonConnection) {
        try {
          const heartbeat = {
            id: uuidv4(),
            type: 'heartbeat',
            source: 'node-orchestrator',
            target: 'python-bridge',
            payload: {
              timestamp: new Date().toISOString(),
              stats: this.getStats()
            },
            timestamp: new Date().toISOString()
          };

          await this._sendMessage(heartbeat);
        } catch (error) {
          console.error('[MCPPythonBridge] Heartbeat failed:', error);
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle reconnection logic
   */
  _handleReconnection() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[MCPPythonBridge] Max reconnection attempts reached');
      this.emit('connectionLost');
      return;
    }

    this.reconnectAttempts++;
    
    setTimeout(() => {
      console.log(`[MCPPythonBridge] Attempting reconnection ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`);
      // Python service will reconnect to us
    }, this.config.reconnectDelay);
  }

  /**
   * Get Python agents list
   */
  getPythonAgents() {
    return Array.from(this.pythonAgents.entries()).map(([name, info]) => ({
      name,
      ...info,
      currentLoad: this.agentLoadMap.get(name) || 0
    }));
  }

  /**
   * Get bridge statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.uptime,
      pythonAgentsCount: this.pythonAgents.size,
      activeTasksCount: this.activeTasks.size,
      connectionStatus: this.pythonConnection ? 'connected' : 'disconnected'
    };
  }

  /**
   * Query Python agents by capabilities
   */
  async queryPythonAgents(capabilities) {
    const message = {
      id: uuidv4(),
      type: 'agent_query',
      source: 'node-orchestrator',
      target: 'python-bridge',
      payload: {
        capabilities,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    await this._sendMessage(message);

    // Return promise that resolves when response is received
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Agent query timeout'));
      }, this.config.messageTimeout);

      const responseHandler = (response) => {
        if (response.correlation_id === message.id) {
          clearTimeout(timeout);
          this.off('agentQueryResponse', responseHandler);
          resolve(response.payload);
        }
      };

      this.on('agentQueryResponse', responseHandler);
    });
  }

  /**
   * Handle agent query response
   */
  async _handleAgentQueryResponse(message) {
    this.emit('agentQueryResponse', message);
  }

  /**
   * Handle status response
   */
  async _handleStatusResponse(message) {
    this.emit('statusResponse', message);
  }

  /**
   * Shutdown the bridge gracefully
   */
  async shutdown() {
    try {
      // Send shutdown notification to Python bridge
      if (this.pythonConnection) {
        const shutdownMessage = {
          id: uuidv4(),
          type: 'shutdown',
          source: 'node-orchestrator',
          target: 'python-bridge',
          payload: { reason: 'graceful_shutdown' },
          timestamp: new Date().toISOString()
        };

        await this._sendMessage(shutdownMessage);
      }

      // Close server
      if (this.server) {
        this.server.close();
      }

      // Close Python connection
      if (this.pythonConnection) {
        this.pythonConnection.destroy();
      }

      // Remove socket file
      try {
        await fs.unlink(this.config.socketPath);
      } catch (err) {
        // File might already be removed
      }

      console.log('[MCPPythonBridge] Gracefully shut down');
      
    } catch (error) {
      console.error('[MCPPythonBridge] Shutdown error:', error);
    }
  }
}

export default MCPPythonBridge;