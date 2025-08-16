/**
 * WebSocket Manager - Task 17: Real-time Collaboration Engine
 * Handles WebSocket connections, room management, and real-time communication
 * 
 * Features:
 * - WebSocket server lifecycle management
 * - Room-based collaboration sessions
 * - Connection state tracking and heartbeat
 * - Message routing and broadcasting
 * - Scalable connection pooling
 * - Authentication and authorization
 * - Rate limiting and throttling
 * - Graceful error handling and reconnection
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class WebSocketManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            port: options.port || 8080,
            heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds
            maxConnections: options.maxConnections || 1000,
            rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute
            rateLimitMax: options.rateLimitMax || 100, // messages per window
            authTimeout: options.authTimeout || 30000, // 30 seconds
            ...options
        };
        
        this.server = null;
        this.rooms = new Map(); // roomId -> Set of connections
        this.connections = new Map(); // connectionId -> connection info
        this.userSessions = new Map(); // userId -> Set of connectionIds
        this.rateLimiter = new Map(); // connectionId -> rate limit data
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            messagesProcessed: 0,
            roomsActive: 0,
            errorCount: 0
        };
        
        this.isRunning = false;
        this.heartbeatTimer = null;
    }

    /**
     * Start the WebSocket server
     */
    async start() {
        try {
            return await OpenTelemetryTracing.traceOperation(
                'websocket_manager.start',
                async () => {
                    if (this.isRunning) {
                        throw new Error('WebSocket server is already running');
                    }

                    this.server = new WebSocket.Server({
                        port: this.options.port,
                        verifyClient: this._verifyClient.bind(this)
                    });

                    this.server.on('connection', this._handleConnection.bind(this));
                    this.server.on('error', this._handleServerError.bind(this));

                    this.isRunning = true;
                    this._startHeartbeat();

                    this.emit('started', { port: this.options.port });
                    return {
                        success: true,
                        port: this.options.port,
                        message: 'WebSocket server started successfully'
                    };
                }
            );
        } catch (error) {
            this.metrics.errorCount++;
            throw error;
        }
    }

    /**
     * Stop the WebSocket server
     */
    async stop() {
        try {
            return await OpenTelemetryTracing.traceOperation(
                'websocket_manager.stop',
                async () => {
                    if (!this.isRunning) {
                        return { success: true, message: 'WebSocket server was not running' };
                    }

                    this._stopHeartbeat();

                    // Close all connections gracefully
                    const closePromises = Array.from(this.connections.values()).map(conn => {
                        return new Promise(resolve => {
                            conn.ws.close(1000, 'Server shutting down');
                            setTimeout(resolve, 1000); // Give clients time to close gracefully
                        });
                    });

                    await Promise.all(closePromises);

                    // Close server
                    await new Promise((resolve, reject) => {
                        this.server.close(err => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    this.isRunning = false;
                    this._clearState();

                    this.emit('stopped');
                    return {
                        success: true,
                        message: 'WebSocket server stopped successfully'
                    };
                }
            );
        } catch (error) {
            this.metrics.errorCount++;
            throw error;
        }
    }

    /**
     * Handle new WebSocket connection
     */
    _handleConnection(ws, request) {
        OpenTelemetryTracing.traceOperation(
            'websocket_manager.handle_connection',
            () => {
                const connectionId = uuidv4();
                const connection = {
                    id: connectionId,
                    ws,
                    userId: null,
                    rooms: new Set(),
                    authenticated: false,
                    lastActivity: Date.now(),
                    metadata: {
                        userAgent: request.headers['user-agent'],
                        ip: request.connection.remoteAddress,
                        connectedAt: new Date().toISOString()
                    }
                };

                this.connections.set(connectionId, connection);
                this.metrics.totalConnections++;
                this.metrics.activeConnections++;

                // Set up connection event handlers
                ws.on('message', (data) => this._handleMessage(connectionId, data));
                ws.on('close', (code, reason) => this._handleClose(connectionId, code, reason));
                ws.on('error', (error) => this._handleConnectionError(connectionId, error));
                ws.on('pong', () => this._handlePong(connectionId));

                // Initialize rate limiter for this connection
                this.rateLimiter.set(connectionId, {
                    messageCount: 0,
                    windowStart: Date.now()
                });

                // Start authentication timeout
                setTimeout(() => {
                    if (connection.authenticated === false) {
                        this._closeConnection(connectionId, 4001, 'Authentication timeout');
                    }
                }, this.options.authTimeout);

                this.emit('connection', { connectionId, connection });

                // Send welcome message
                this._sendToConnection(connectionId, {
                    type: 'welcome',
                    connectionId,
                    timestamp: new Date().toISOString()
                });
            }
        );
    }

    /**
     * Handle incoming message from client
     */
    _handleMessage(connectionId, data) {
        OpenTelemetryTracing.traceOperation(
            'websocket_manager.handle_message',
            () => {
                const connection = this.connections.get(connectionId);
                if (!connection) return;

                // Update activity timestamp
                connection.lastActivity = Date.now();

                // Check rate limiting
                if (!this._checkRateLimit(connectionId)) {
                    this._sendError(connectionId, 'RATE_LIMIT_EXCEEDED', 'Too many messages');
                    return;
                }

                try {
                    const message = JSON.parse(data.toString());
                    this.metrics.messagesProcessed++;

                    // Route message based on type
                    switch (message.type) {
                        case 'auth':
                            this._handleAuth(connectionId, message);
                            break;
                        case 'join_room':
                            this._handleJoinRoom(connectionId, message);
                            break;
                        case 'leave_room':
                            this._handleLeaveRoom(connectionId, message);
                            break;
                        case 'room_message':
                            this._handleRoomMessage(connectionId, message);
                            break;
                        case 'private_message':
                            this._handlePrivateMessage(connectionId, message);
                            break;
                        case 'ping':
                            this._handlePing(connectionId, message);
                            break;
                        default:
                            this._sendError(connectionId, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
                    }
                } catch (error) {
                    this._sendError(connectionId, 'INVALID_MESSAGE', 'Invalid JSON message');
                    this.metrics.errorCount++;
                }
            }
        );
    }

    /**
     * Handle authentication
     */
    _handleAuth(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        // Validate auth token (implement your auth logic here)
        const { token, userId } = message;
        
        // For now, simple validation - in production, verify JWT/session token
        if (token && userId) {
            connection.authenticated = true;
            connection.userId = userId;

            // Track user sessions
            if (!this.userSessions.has(userId)) {
                this.userSessions.set(userId, new Set());
            }
            this.userSessions.get(userId).add(connectionId);

            this._sendToConnection(connectionId, {
                type: 'auth_success',
                userId,
                timestamp: new Date().toISOString()
            });

            this.emit('user_authenticated', { connectionId, userId });
        } else {
            this._sendError(connectionId, 'AUTH_FAILED', 'Invalid credentials');
            setTimeout(() => {
                this._closeConnection(connectionId, 4002, 'Authentication failed');
            }, 1000);
        }
    }

    /**
     * Handle joining a room
     */
    _handleJoinRoom(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.authenticated) {
            this._sendError(connectionId, 'UNAUTHORIZED', 'Authentication required');
            return;
        }

        const { roomId } = message;
        if (!roomId) {
            this._sendError(connectionId, 'INVALID_ROOM', 'Room ID is required');
            return;
        }

        // Add connection to room
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
            this.metrics.roomsActive++;
        }

        this.rooms.get(roomId).add(connectionId);
        connection.rooms.add(roomId);

        // Notify room members
        this._broadcastToRoom(roomId, {
            type: 'user_joined',
            userId: connection.userId,
            roomId,
            timestamp: new Date().toISOString()
        }, connectionId);

        // Send success response
        this._sendToConnection(connectionId, {
            type: 'room_joined',
            roomId,
            memberCount: this.rooms.get(roomId).size,
            timestamp: new Date().toISOString()
        });

        this.emit('room_joined', { connectionId, roomId, userId: connection.userId });
    }

    /**
     * Handle leaving a room
     */
    _handleLeaveRoom(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        const { roomId } = message;
        this._removeFromRoom(connectionId, roomId);
    }

    /**
     * Handle room message
     */
    _handleRoomMessage(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.authenticated) {
            this._sendError(connectionId, 'UNAUTHORIZED', 'Authentication required');
            return;
        }

        const { roomId, payload } = message;
        if (!roomId || !connection.rooms.has(roomId)) {
            this._sendError(connectionId, 'NOT_IN_ROOM', 'Not a member of this room');
            return;
        }

        // Broadcast message to room
        this._broadcastToRoom(roomId, {
            type: 'room_message',
            roomId,
            userId: connection.userId,
            payload,
            timestamp: new Date().toISOString()
        }, connectionId);

        this.emit('room_message', { connectionId, roomId, userId: connection.userId, payload });
    }

    /**
     * Handle private message
     */
    _handlePrivateMessage(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.authenticated) {
            this._sendError(connectionId, 'UNAUTHORIZED', 'Authentication required');
            return;
        }

        const { targetUserId, payload } = message;
        if (!targetUserId) {
            this._sendError(connectionId, 'INVALID_TARGET', 'Target user ID is required');
            return;
        }

        // Send to all sessions of target user
        const targetSessions = this.userSessions.get(targetUserId);
        if (targetSessions) {
            targetSessions.forEach(targetConnectionId => {
                this._sendToConnection(targetConnectionId, {
                    type: 'private_message',
                    fromUserId: connection.userId,
                    payload,
                    timestamp: new Date().toISOString()
                });
            });
        }

        this.emit('private_message', { 
            fromConnectionId: connectionId, 
            fromUserId: connection.userId,
            targetUserId,
            payload 
        });
    }

    /**
     * Handle ping message
     */
    _handlePing(connectionId, message) {
        this._sendToConnection(connectionId, {
            type: 'pong',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Handle pong response
     */
    _handlePong(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.lastActivity = Date.now();
        }
    }

    /**
     * Handle connection close
     */
    _handleClose(connectionId, code, reason) {
        OpenTelemetryTracing.traceOperation(
            'websocket_manager.handle_close',
            () => {
                const connection = this.connections.get(connectionId);
                if (!connection) return;

                // Remove from all rooms
                connection.rooms.forEach(roomId => {
                    this._removeFromRoom(connectionId, roomId);
                });

                // Remove from user sessions
                if (connection.userId) {
                    const userSessions = this.userSessions.get(connection.userId);
                    if (userSessions) {
                        userSessions.delete(connectionId);
                        if (userSessions.size === 0) {
                            this.userSessions.delete(connection.userId);
                        }
                    }
                }

                // Clean up
                this.connections.delete(connectionId);
                this.rateLimiter.delete(connectionId);
                this.metrics.activeConnections--;

                this.emit('disconnection', { connectionId, userId: connection.userId, code, reason });
            }
        );
    }

    /**
     * Handle connection error
     */
    _handleConnectionError(connectionId, error) {
        this.metrics.errorCount++;
        this.emit('connection_error', { connectionId, error });
        this._closeConnection(connectionId, 1011, 'Unexpected condition');
    }

    /**
     * Handle server error
     */
    _handleServerError(error) {
        this.metrics.errorCount++;
        this.emit('server_error', error);
    }

    /**
     * Verify client connection
     */
    _verifyClient(info) {
        // Check if we've reached max connections
        if (this.metrics.activeConnections >= this.options.maxConnections) {
            return false;
        }

        // Add additional verification logic here (IP filtering, etc.)
        return true;
    }

    /**
     * Send message to specific connection
     */
    _sendToConnection(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            connection.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            this.metrics.errorCount++;
            return false;
        }
    }

    /**
     * Broadcast message to all connections in a room
     */
    _broadcastToRoom(roomId, message, excludeConnectionId = null) {
        const roomConnections = this.rooms.get(roomId);
        if (!roomConnections) return 0;

        let sentCount = 0;
        roomConnections.forEach(connectionId => {
            if (connectionId !== excludeConnectionId) {
                if (this._sendToConnection(connectionId, message)) {
                    sentCount++;
                }
            }
        });

        return sentCount;
    }

    /**
     * Send error message to connection
     */
    _sendError(connectionId, code, message) {
        this._sendToConnection(connectionId, {
            type: 'error',
            error: { code, message },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Close connection with code and reason
     */
    _closeConnection(connectionId, code, reason) {
        const connection = this.connections.get(connectionId);
        if (connection && connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.close(code, reason);
        }
    }

    /**
     * Remove connection from room
     */
    _removeFromRoom(connectionId, roomId) {
        const connection = this.connections.get(connectionId);
        const room = this.rooms.get(roomId);
        
        if (room && room.has(connectionId)) {
            room.delete(connectionId);
            
            if (connection) {
                connection.rooms.delete(roomId);
                
                // Notify remaining room members
                this._broadcastToRoom(roomId, {
                    type: 'user_left',
                    userId: connection.userId,
                    roomId,
                    timestamp: new Date().toISOString()
                });
            }

            // Clean up empty rooms
            if (room.size === 0) {
                this.rooms.delete(roomId);
                this.metrics.roomsActive--;
            }

            this.emit('room_left', { connectionId, roomId, userId: connection?.userId });
        }
    }

    /**
     * Check rate limiting for connection
     */
    _checkRateLimit(connectionId) {
        const rateLimitData = this.rateLimiter.get(connectionId);
        if (!rateLimitData) return false;

        const now = Date.now();
        
        // Reset window if expired
        if (now - rateLimitData.windowStart > this.options.rateLimitWindow) {
            rateLimitData.messageCount = 0;
            rateLimitData.windowStart = now;
        }

        rateLimitData.messageCount++;
        
        return rateLimitData.messageCount <= this.options.rateLimitMax;
    }

    /**
     * Start heartbeat timer
     */
    _startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this._performHeartbeat();
        }, this.options.heartbeatInterval);
    }

    /**
     * Stop heartbeat timer
     */
    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Perform heartbeat check
     */
    _performHeartbeat() {
        OpenTelemetryTracing.traceOperation(
            'websocket_manager.heartbeat',
            () => {
                const now = Date.now();
                const staleConnections = [];

                this.connections.forEach((connection, connectionId) => {
                    if (now - connection.lastActivity > this.options.heartbeatInterval * 2) {
                        staleConnections.push(connectionId);
                    } else if (connection.ws.readyState === WebSocket.OPEN) {
                        connection.ws.ping();
                    }
                });

                // Close stale connections
                staleConnections.forEach(connectionId => {
                    this._closeConnection(connectionId, 1001, 'Connection timeout');
                });
            }
        );
    }

    /**
     * Clear all state
     */
    _clearState() {
        this.rooms.clear();
        this.connections.clear();
        this.userSessions.clear();
        this.rateLimiter.clear();
        this.metrics.activeConnections = 0;
        this.metrics.roomsActive = 0;
    }

    /**
     * Public API methods
     */

    /**
     * Get server status and metrics
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.options.port,
            metrics: { ...this.metrics },
            roomCount: this.rooms.size,
            connectionCount: this.connections.size,
            userCount: this.userSessions.size
        };
    }

    /**
     * Get room information
     */
    getRoomInfo(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const members = Array.from(room).map(connectionId => {
            const connection = this.connections.get(connectionId);
            return {
                connectionId,
                userId: connection?.userId,
                connectedAt: connection?.metadata.connectedAt
            };
        }).filter(member => member.userId);

        return {
            roomId,
            memberCount: room.size,
            members
        };
    }

    /**
     * Send message to room
     */
    sendToRoom(roomId, message) {
        return this._broadcastToRoom(roomId, {
            type: 'server_message',
            payload: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send message to user (all their sessions)
     */
    sendToUser(userId, message) {
        const userSessions = this.userSessions.get(userId);
        if (!userSessions) return 0;

        let sentCount = 0;
        userSessions.forEach(connectionId => {
            if (this._sendToConnection(connectionId, {
                type: 'server_message',
                payload: message,
                timestamp: new Date().toISOString()
            })) {
                sentCount++;
            }
        });

        return sentCount;
    }

    /**
     * Disconnect user (all their sessions)
     */
    disconnectUser(userId, reason = 'Disconnected by server') {
        const userSessions = this.userSessions.get(userId);
        if (!userSessions) return 0;

        let disconnectedCount = 0;
        userSessions.forEach(connectionId => {
            this._closeConnection(connectionId, 1000, reason);
            disconnectedCount++;
        });

        return disconnectedCount;
    }

    /**
     * Get all active rooms
     */
    getActiveRooms() {
        return Array.from(this.rooms.keys()).map(roomId => this.getRoomInfo(roomId));
    }

    /**
     * Get connected users
     */
    getConnectedUsers() {
        return Array.from(this.userSessions.keys()).map(userId => ({
            userId,
            sessionCount: this.userSessions.get(userId).size,
            sessions: Array.from(this.userSessions.get(userId)).map(connectionId => {
                const connection = this.connections.get(connectionId);
                return {
                    connectionId,
                    connectedAt: connection?.metadata.connectedAt,
                    lastActivity: new Date(connection?.lastActivity).toISOString(),
                    rooms: Array.from(connection?.rooms || [])
                };
            })
        }));
    }
}

export default WebSocketManager;
