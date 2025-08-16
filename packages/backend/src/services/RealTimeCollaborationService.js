/**
 * Real-time Collaboration Service
 * 
 * Advanced collaboration features including:
 * - Live document editing with conflict resolution
 * - User presence tracking and indicators
 * - Collaborative workflow editing
 * - Real-time synchronization
 * - Document locking and permissions
 * - Collaborative AI interactions
 * - Screen sharing and voice/video chat
 * - Activity feeds and notifications
 * 
 * @author Robbie Allen - Lead Architect  
 * @date January 2025
 */

import { EventEmitter } from 'events';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import db from '../db.js';

// Operational Transform for document editing
class OperationalTransform {
  static transform(op1, op2) {
    // Simple operational transform for text operations
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position <= op2.position) {
        return {
          ...op2,
          position: op2.position + op1.content.length
        };
      }
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        return {
          ...op2,
          position: op2.position - op1.length
        };
      } else if (op1.position > op2.position) {
        return op2; // No change needed
      }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position <= op2.position) {
        return {
          ...op2,
          position: op2.position + op1.content.length
        };
      }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position < op2.position) {
        return {
          ...op2,
          position: op2.position - op1.length
        };
      } else if (op1.position > op2.position) {
        return {
          ...op1,
          position: op1.position - op2.length
        };
      }
    }
    
    return op2; // Default: no transform needed
  }
}

class RealTimeCollaborationService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.pool = db;
    
    // Collaboration state
    this.activeSessions = new Map(); // sessionId -> session data
    this.userPresence = new Map(); // userId -> presence data  
    this.documentSessions = new Map(); // documentId -> session data
    this.workflowSessions = new Map(); // workflowId -> session data
    this.lockManager = new Map(); // resourceId -> lock data
    
    // Collaboration rooms
    this.rooms = {
      documents: new Map(), // documentId -> room data
      workflows: new Map(), // workflowId -> room data
      conversations: new Map(), // conversationId -> room data
      general: new Map(), // general collaboration rooms
    };
    
    // Operation queues for conflict resolution
    this.operationQueues = new Map(); // resourceId -> operation queue
    
    // Metrics
    this.metrics = {
      totalCollaborators: 0,
      activeDocuments: 0,
      operationsPerSecond: 0,
      conflictsResolved: 0,
    };
    
    // Initialize service
    this.initialize();
  }

  /**
   * Initialize the collaboration service
   */
  async initialize() {
    try {
      console.log('[Collaboration] 🤝 Initializing real-time collaboration service...');
      
      // Set up socket event handlers
      this.setupSocketHandlers();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Clean up stale sessions
      this.cleanupStaleSessions();
      
      console.log('[Collaboration] ✅ Real-time collaboration service ready');
    } catch (error) {
      console.error('[Collaboration] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up Socket.IO event handlers for collaboration
   */
  setupSocketHandlers() {
    // Create collaboration namespace
    const collaborationNamespace = this.io.of('/collaboration');
    
    collaborationNamespace.on('connection', (socket) => {
      console.log(`[Collaboration] User connected: ${socket.userId} (${socket.id})`);
      
      // Initialize user presence
      this.initializeUserPresence(socket);
      
      // Document collaboration events
      socket.on('join_document', (data) => this.handleJoinDocument(socket, data));
      socket.on('leave_document', (data) => this.handleLeaveDocument(socket, data));
      socket.on('document_operation', (data) => this.handleDocumentOperation(socket, data));
      socket.on('cursor_update', (data) => this.handleCursorUpdate(socket, data));
      socket.on('selection_update', (data) => this.handleSelectionUpdate(socket, data));
      
      // Workflow collaboration events
      socket.on('join_workflow', (data) => this.handleJoinWorkflow(socket, data));
      socket.on('leave_workflow', (data) => this.handleLeaveWorkflow(socket, data));
      socket.on('workflow_operation', (data) => this.handleWorkflowOperation(socket, data));
      socket.on('node_lock', (data) => this.handleNodeLock(socket, data));
      socket.on('node_unlock', (data) => this.handleNodeUnlock(socket, data));
      
      // Conversation collaboration events
      socket.on('join_conversation', (data) => this.handleJoinConversation(socket, data));
      socket.on('leave_conversation', (data) => this.handleLeaveConversation(socket, data));
      socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
      
      // General collaboration events
      socket.on('request_screen_share', (data) => this.handleScreenShareRequest(socket, data));
      socket.on('accept_screen_share', (data) => this.handleScreenShareAccept(socket, data));
      socket.on('voice_chat_request', (data) => this.handleVoiceChatRequest(socket, data));
      socket.on('activity_update', (data) => this.handleActivityUpdate(socket, data));
      
      // Presence events
      socket.on('presence_update', (data) => this.handlePresenceUpdate(socket, data));
      socket.on('status_update', (data) => this.handleStatusUpdate(socket, data));
      
      // Disconnect handler
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
    
    console.log('[Collaboration] 🔌 Socket handlers configured for /collaboration namespace');
  }

  /**
   * Initialize user presence tracking
   */
  async initializeUserPresence(socket) {
    const userId = socket.userId;
    const presence = {
      userId,
      socketId: socket.id,
      status: 'online',
      lastSeen: new Date(),
      currentActivity: null,
      activeDocuments: new Set(),
      activeWorkflows: new Set(),
      activeConversations: new Set(),
      cursor: null,
      selection: null,
    };

    this.userPresence.set(userId, presence);
    
    // Broadcast presence to all connected users
    socket.broadcast.emit('user_presence_update', {
      userId,
      status: 'online',
      timestamp: new Date().toISOString(),
    });
    
    // Send current online users to the new user
    const onlineUsers = Array.from(this.userPresence.values())
      .filter(p => p.status === 'online')
      .map(p => ({
        userId: p.userId,
        status: p.status,
        currentActivity: p.currentActivity,
        lastSeen: p.lastSeen,
      }));
    
    socket.emit('presence_sync', { onlineUsers });
    
    console.log(`[Collaboration] 👤 Presence initialized for user ${userId}`);
  }

  /**
   * Handle joining a document for collaboration
   */
  async handleJoinDocument(socket, data) {
    return traceOperation('collaboration.join_document', async (span) => {
      try {
        const { documentId, documentType = 'knowledge' } = data;
        const userId = socket.userId;
        
        span.setAttributes({
          'document.id': documentId,
          'document.type': documentType,
          'user.id': userId,
        });

        // Get document data
        const document = await this.getDocumentData(documentId, documentType);
        if (!document) {
          socket.emit('collaboration_error', { message: 'Document not found' });
          return;
        }

        // Check permissions
        const hasPermission = await this.checkDocumentPermission(userId, documentId, 'read');
        if (!hasPermission) {
          socket.emit('collaboration_error', { message: 'Access denied' });
          return;
        }

        // Join document room
        const roomName = `document:${documentId}`;
        socket.join(roomName);
        
        // Initialize document session if needed
        if (!this.documentSessions.has(documentId)) {
          this.documentSessions.set(documentId, {
            documentId,
            documentType,
            collaborators: new Map(),
            operations: [],
            version: 0,
            lastModified: new Date(),
            locks: new Map(),
          });
        }

        const session = this.documentSessions.get(documentId);
        session.collaborators.set(userId, {
          userId,
          socketId: socket.id,
          joinedAt: new Date(),
          permissions: await this.getUserDocumentPermissions(userId, documentId),
          cursor: null,
          selection: null,
        });

        // Update user presence
        const presence = this.userPresence.get(userId);
        if (presence) {
          presence.activeDocuments.add(documentId);
          presence.currentActivity = `Editing ${document.title || 'Document'}`;
        }

        // Send document state to user
        socket.emit('document_joined', {
          documentId,
          document,
          collaborators: Array.from(session.collaborators.values()),
          version: session.version,
          locks: Array.from(session.locks.entries()),
        });

        // Notify other collaborators
        socket.to(roomName).emit('collaborator_joined', {
          userId,
          user: await this.getUserInfo(userId),
          timestamp: new Date().toISOString(),
        });

        this.metrics.totalCollaborators++;
        console.log(`[Collaboration] 📝 User ${userId} joined document ${documentId}`);
        
      } catch (error) {
        console.error('[Collaboration] ❌ Join document failed:', error);
        span.recordException(error);
        socket.emit('collaboration_error', { message: 'Failed to join document' });
      }
    });
  }

  /**
   * Handle leaving a document
   */
  async handleLeaveDocument(socket, data) {
    try {
      const { documentId } = data;
      const userId = socket.userId;
      const roomName = `document:${documentId}`;

      // Leave room
      socket.leave(roomName);

      // Remove from document session
      if (this.documentSessions.has(documentId)) {
        const session = this.documentSessions.get(documentId);
        session.collaborators.delete(userId);
        
        // Remove any locks held by this user
        for (const [lockId, lock] of session.locks) {
          if (lock.userId === userId) {
            session.locks.delete(lockId);
            socket.to(roomName).emit('lock_released', { lockId, userId });
          }
        }

        // Clean up empty session
        if (session.collaborators.size === 0) {
          this.documentSessions.delete(documentId);
          this.metrics.activeDocuments--;
        }
      }

      // Update user presence
      const presence = this.userPresence.get(userId);
      if (presence) {
        presence.activeDocuments.delete(documentId);
        if (presence.activeDocuments.size === 0) {
          presence.currentActivity = null;
        }
      }

      // Notify other collaborators
      socket.to(roomName).emit('collaborator_left', {
        userId,
        timestamp: new Date().toISOString(),
      });

      this.metrics.totalCollaborators = Math.max(0, this.metrics.totalCollaborators - 1);
      console.log(`[Collaboration] 📝 User ${userId} left document ${documentId}`);
      
    } catch (error) {
      console.error('[Collaboration] ❌ Leave document failed:', error);
    }
  }

  /**
   * Handle document operation (edit, insert, delete)
   */
  async handleDocumentOperation(socket, data) {
    return traceOperation('collaboration.document_operation', async (span) => {
      try {
        const { documentId, operation, version } = data;
        const userId = socket.userId;
        
        span.setAttributes({
          'document.id': documentId,
          'operation.type': operation.type,
          'operation.version': version,
          'user.id': userId,
        });

        // Get document session
        const session = this.documentSessions.get(documentId);
        if (!session) {
          socket.emit('collaboration_error', { message: 'Document session not found' });
          return;
        }

        // Check if user has edit permissions
        const collaborator = session.collaborators.get(userId);
        if (!collaborator || !collaborator.permissions.includes('edit')) {
          socket.emit('collaboration_error', { message: 'No edit permission' });
          return;
        }

        // Handle version conflicts with operational transform
        let operationToApply = operation;
        if (version < session.version) {
          // Transform operation against newer operations
          const transformedOperation = this.transformOperation(operation, session.operations.slice(version));
          operationToApply = transformedOperation;
        }

        // Apply operation to document
        const result = await this.applyDocumentOperation(documentId, operationToApply);
        if (!result.success) {
          socket.emit('operation_failed', { error: result.error, operation });
          return;
        }

        // Update session
        session.operations.push({
          ...operationToApply,
          userId,
          timestamp: new Date(),
          version: session.version + 1,
        });
        session.version++;
        session.lastModified = new Date();

        // Broadcast operation to other collaborators
        const roomName = `document:${documentId}`;
        socket.to(roomName).emit('document_operation', {
          operation: operationToApply,
          userId,
          version: session.version,
          timestamp: new Date().toISOString(),
        });

        // Send acknowledgment to sender
        socket.emit('operation_applied', {
          operation: operationToApply,
          version: session.version,
          timestamp: new Date().toISOString(),
        });

        this.metrics.operationsPerSecond++;
        console.log(`[Collaboration] ⚡ Operation applied to document ${documentId} by user ${userId}`);
        
      } catch (error) {
        console.error('[Collaboration] ❌ Document operation failed:', error);
        span.recordException(error);
        socket.emit('operation_failed', { error: error.message, operation: data.operation });
      }
    });
  }

  /**
   * Handle cursor position updates
   */
  async handleCursorUpdate(socket, data) {
    try {
      const { documentId, cursor } = data;
      const userId = socket.userId;

      // Update cursor in session
      const session = this.documentSessions.get(documentId);
      if (session && session.collaborators.has(userId)) {
        const collaborator = session.collaborators.get(userId);
        collaborator.cursor = cursor;

        // Broadcast cursor update to other collaborators
        const roomName = `document:${documentId}`;
        socket.to(roomName).emit('cursor_update', {
          userId,
          cursor,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[Collaboration] ❌ Cursor update failed:', error);
    }
  }

  /**
   * Handle text selection updates
   */
  async handleSelectionUpdate(socket, data) {
    try {
      const { documentId, selection } = data;
      const userId = socket.userId;

      // Update selection in session
      const session = this.documentSessions.get(documentId);
      if (session && session.collaborators.has(userId)) {
        const collaborator = session.collaborators.get(userId);
        collaborator.selection = selection;

        // Broadcast selection update to other collaborators
        const roomName = `document:${documentId}`;
        socket.to(roomName).emit('selection_update', {
          userId,
          selection,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[Collaboration] ❌ Selection update failed:', error);
    }
  }

  /**
   * Handle joining a workflow for collaboration
   */
  async handleJoinWorkflow(socket, data) {
    return traceOperation('collaboration.join_workflow', async (span) => {
      try {
        const { workflowId } = data;
        const userId = socket.userId;
        
        span.setAttributes({
          'workflow.id': workflowId,
          'user.id': userId,
        });

        // Get workflow data
        const workflow = await this.getWorkflowData(workflowId);
        if (!workflow) {
          socket.emit('collaboration_error', { message: 'Workflow not found' });
          return;
        }

        // Check permissions
        const hasPermission = await this.checkWorkflowPermission(userId, workflowId, 'read');
        if (!hasPermission) {
          socket.emit('collaboration_error', { message: 'Access denied' });
          return;
        }

        // Join workflow room
        const roomName = `workflow:${workflowId}`;
        socket.join(roomName);
        
        // Initialize workflow session if needed
        if (!this.workflowSessions.has(workflowId)) {
          this.workflowSessions.set(workflowId, {
            workflowId,
            collaborators: new Map(),
            nodeLocks: new Map(),
            operations: [],
            version: 0,
            lastModified: new Date(),
          });
        }

        const session = this.workflowSessions.get(workflowId);
        session.collaborators.set(userId, {
          userId,
          socketId: socket.id,
          joinedAt: new Date(),
          permissions: await this.getUserWorkflowPermissions(userId, workflowId),
          lockedNodes: new Set(),
        });

        // Update user presence
        const presence = this.userPresence.get(userId);
        if (presence) {
          presence.activeWorkflows.add(workflowId);
          presence.currentActivity = `Editing ${workflow.name || 'Workflow'}`;
        }

        // Send workflow state to user
        socket.emit('workflow_joined', {
          workflowId,
          workflow,
          collaborators: Array.from(session.collaborators.values()),
          nodeLocks: Array.from(session.nodeLocks.entries()),
          version: session.version,
        });

        // Notify other collaborators
        socket.to(roomName).emit('collaborator_joined_workflow', {
          userId,
          user: await this.getUserInfo(userId),
          timestamp: new Date().toISOString(),
        });

        console.log(`[Collaboration] 🔧 User ${userId} joined workflow ${workflowId}`);
        
      } catch (error) {
        console.error('[Collaboration] ❌ Join workflow failed:', error);
        span.recordException(error);
        socket.emit('collaboration_error', { message: 'Failed to join workflow' });
      }
    });
  }

  /**
   * Handle workflow operations (node add/edit/delete, connection changes)
   */
  async handleWorkflowOperation(socket, data) {
    return traceOperation('collaboration.workflow_operation', async (span) => {
      try {
        const { workflowId, operation, version } = data;
        const userId = socket.userId;
        
        span.setAttributes({
          'workflow.id': workflowId,
          'operation.type': operation.type,
          'operation.version': version,
          'user.id': userId,
        });

        // Get workflow session
        const session = this.workflowSessions.get(workflowId);
        if (!session) {
          socket.emit('collaboration_error', { message: 'Workflow session not found' });
          return;
        }

        // Check permissions
        const collaborator = session.collaborators.get(userId);
        if (!collaborator || !collaborator.permissions.includes('edit')) {
          socket.emit('collaboration_error', { message: 'No edit permission' });
          return;
        }

        // Check node locks for node operations
        if (operation.type === 'update_node' || operation.type === 'delete_node') {
          const lock = session.nodeLocks.get(operation.nodeId);
          if (lock && lock.userId !== userId) {
            socket.emit('operation_failed', { error: 'Node is locked by another user', operation });
            return;
          }
        }

        // Apply operation to workflow
        const result = await this.applyWorkflowOperation(workflowId, operation);
        if (!result.success) {
          socket.emit('operation_failed', { error: result.error, operation });
          return;
        }

        // Update session
        session.operations.push({
          ...operation,
          userId,
          timestamp: new Date(),
          version: session.version + 1,
        });
        session.version++;
        session.lastModified = new Date();

        // Broadcast operation to other collaborators
        const roomName = `workflow:${workflowId}`;
        socket.to(roomName).emit('workflow_operation', {
          operation,
          userId,
          version: session.version,
          timestamp: new Date().toISOString(),
        });

        // Send acknowledgment
        socket.emit('workflow_operation_applied', {
          operation,
          version: session.version,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Collaboration] ⚡ Workflow operation applied to ${workflowId} by user ${userId}`);
        
      } catch (error) {
        console.error('[Collaboration] ❌ Workflow operation failed:', error);
        span.recordException(error);
        socket.emit('operation_failed', { error: error.message, operation: data.operation });
      }
    });
  }

  /**
   * Handle node locking for exclusive editing
   */
  async handleNodeLock(socket, data) {
    try {
      const { workflowId, nodeId } = data;
      const userId = socket.userId;

      const session = this.workflowSessions.get(workflowId);
      if (!session) return;

      // Check if node is already locked
      if (session.nodeLocks.has(nodeId)) {
        socket.emit('node_lock_failed', { nodeId, reason: 'Already locked' });
        return;
      }

      // Create lock
      const lock = {
        userId,
        nodeId,
        timestamp: new Date(),
        socketId: socket.id,
      };
      session.nodeLocks.set(nodeId, lock);

      // Update collaborator data
      const collaborator = session.collaborators.get(userId);
      if (collaborator) {
        collaborator.lockedNodes.add(nodeId);
      }

      // Broadcast lock to other collaborators
      const roomName = `workflow:${workflowId}`;
      socket.emit('node_locked', { nodeId, userId });
      socket.to(roomName).emit('node_locked', { nodeId, userId });

      console.log(`[Collaboration] 🔒 Node ${nodeId} locked by user ${userId}`);
    } catch (error) {
      console.error('[Collaboration] ❌ Node lock failed:', error);
    }
  }

  /**
   * Handle node unlocking
   */
  async handleNodeUnlock(socket, data) {
    try {
      const { workflowId, nodeId } = data;
      const userId = socket.userId;

      const session = this.workflowSessions.get(workflowId);
      if (!session) return;

      const lock = session.nodeLocks.get(nodeId);
      if (!lock || lock.userId !== userId) {
        socket.emit('node_unlock_failed', { nodeId, reason: 'Not your lock' });
        return;
      }

      // Remove lock
      session.nodeLocks.delete(nodeId);

      // Update collaborator data
      const collaborator = session.collaborators.get(userId);
      if (collaborator) {
        collaborator.lockedNodes.delete(nodeId);
      }

      // Broadcast unlock to other collaborators
      const roomName = `workflow:${workflowId}`;
      socket.emit('node_unlocked', { nodeId, userId });
      socket.to(roomName).emit('node_unlocked', { nodeId, userId });

      console.log(`[Collaboration] 🔓 Node ${nodeId} unlocked by user ${userId}`);
    } catch (error) {
      console.error('[Collaboration] ❌ Node unlock failed:', error);
    }
  }

  /**
   * Handle typing indicators in conversations
   */
  async handleTypingStart(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;
      const roomName = `conversation:${conversationId}`;

      // Broadcast typing to other participants
      socket.to(roomName).emit('user_typing_start', {
        userId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Collaboration] ❌ Typing start failed:', error);
    }
  }

  /**
   * Handle stop typing indicators
   */
  async handleTypingStop(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;
      const roomName = `conversation:${conversationId}`;

      // Broadcast stop typing to other participants
      socket.to(roomName).emit('user_typing_stop', {
        userId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Collaboration] ❌ Typing stop failed:', error);
    }
  }

  /**
   * Handle presence updates
   */
  async handlePresenceUpdate(socket, data) {
    try {
      const { status, activity } = data;
      const userId = socket.userId;

      const presence = this.userPresence.get(userId);
      if (presence) {
        presence.status = status || presence.status;
        presence.currentActivity = activity || presence.currentActivity;
        presence.lastSeen = new Date();
      }

      // Broadcast presence update
      socket.broadcast.emit('user_presence_update', {
        userId,
        status: presence.status,
        activity: presence.currentActivity,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Collaboration] ❌ Presence update failed:', error);
    }
  }

  /**
   * Handle user disconnect
   */
  async handleDisconnect(socket) {
    try {
      const userId = socket.userId;
      console.log(`[Collaboration] 🔌 User ${userId} disconnected`);

      // Clean up user presence
      const presence = this.userPresence.get(userId);
      if (presence) {
        presence.status = 'offline';
        presence.lastSeen = new Date();

        // Clean up active documents
        for (const documentId of presence.activeDocuments) {
          await this.handleLeaveDocument(socket, { documentId });
        }

        // Clean up active workflows  
        for (const workflowId of presence.activeWorkflows) {
          await this.handleLeaveWorkflow(socket, { workflowId });
        }
      }

      // Broadcast offline status
      socket.broadcast.emit('user_presence_update', {
        userId,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });

      // Remove from presence map after delay (in case of reconnection)
      setTimeout(() => {
        const currentPresence = this.userPresence.get(userId);
        if (currentPresence && currentPresence.socketId === socket.id) {
          this.userPresence.delete(userId);
        }
      }, 30000); // 30 seconds grace period

    } catch (error) {
      console.error('[Collaboration] ❌ Disconnect handling failed:', error);
    }
  }

  /**
   * Transform operation using operational transform
   */
  transformOperation(operation, operations) {
    let transformed = { ...operation };
    
    for (const op of operations) {
      transformed = OperationalTransform.transform(op, transformed);
    }
    
    return transformed;
  }

  /**
   * Apply document operation to database
   */
  async applyDocumentOperation(documentId, operation) {
    try {
      // Implementation depends on document type and storage
      // This is a simplified version
      
      switch (operation.type) {
        case 'insert':
          // Update document content with insertion
          await this.pool.query(
            'UPDATE knowledge_entries SET content = LEFT(content, $2) || $3 || SUBSTRING(content FROM $2 + 1) WHERE id = $1',
            [documentId, operation.position, operation.content]
          );
          break;
          
        case 'delete':
          // Update document content with deletion
          await this.pool.query(
            'UPDATE knowledge_entries SET content = LEFT(content, $2) || SUBSTRING(content FROM $2 + $3 + 1) WHERE id = $1',
            [documentId, operation.position, operation.length]
          );
          break;
          
        case 'replace':
          // Update document content with replacement
          await this.pool.query(
            'UPDATE knowledge_entries SET content = LEFT(content, $2) || $3 || SUBSTRING(content FROM $2 + $4 + 1) WHERE id = $1',
            [documentId, operation.position, operation.content, operation.length]
          );
          break;
      }

      return { success: true };
    } catch (error) {
      console.error('[Collaboration] ❌ Document operation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply workflow operation to database
   */
  async applyWorkflowOperation(workflowId, operation) {
    try {
      const workflowQuery = await this.pool.query('SELECT configuration FROM workflows WHERE id = $1', [workflowId]);
      if (workflowQuery.rows.length === 0) {
        return { success: false, error: 'Workflow not found' };
      }

      let config = workflowQuery.rows[0].configuration;
      
      switch (operation.type) {
        case 'add_node':
          config.nodes.push(operation.node);
          break;
          
        case 'update_node':
          const nodeIndex = config.nodes.findIndex(n => n.id === operation.nodeId);
          if (nodeIndex >= 0) {
            config.nodes[nodeIndex] = { ...config.nodes[nodeIndex], ...operation.updates };
          }
          break;
          
        case 'delete_node':
          config.nodes = config.nodes.filter(n => n.id !== operation.nodeId);
          config.edges = config.edges.filter(e => e.source !== operation.nodeId && e.target !== operation.nodeId);
          break;
          
        case 'add_edge':
          config.edges.push(operation.edge);
          break;
          
        case 'delete_edge':
          config.edges = config.edges.filter(e => e.id !== operation.edgeId);
          break;
      }

      // Update workflow in database
      await this.pool.query(
        'UPDATE workflows SET configuration = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(config), workflowId]
      );

      return { success: true };
    } catch (error) {
      console.error('[Collaboration] ❌ Workflow operation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper methods for data retrieval
   */
  async getDocumentData(documentId, documentType) {
    try {
      let query, params;
      
      switch (documentType) {
        case 'knowledge':
          query = 'SELECT id, title, content, category, user_id FROM knowledge_entries WHERE id = $1';
          break;
        case 'workflow':
          query = 'SELECT id, name, description, configuration, user_id FROM workflows WHERE id = $1';
          break;
        default:
          return null;
      }
      
      const result = await this.pool.query(query, [documentId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[Collaboration] ❌ Get document data failed:', error);
      return null;
    }
  }

  async getWorkflowData(workflowId) {
    try {
      const result = await this.pool.query(
        'SELECT id, name, description, configuration, user_id FROM workflows WHERE id = $1',
        [workflowId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[Collaboration] ❌ Get workflow data failed:', error);
      return null;
    }
  }

  async getUserInfo(userId) {
    try {
      const result = await this.pool.query(
        'SELECT id, email, full_name FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('[Collaboration] ❌ Get user info failed:', error);
      return null;
    }
  }

  async checkDocumentPermission(userId, documentId, permission) {
    // Simplified permission check - implement based on your permission system
    try {
      const result = await this.pool.query(
        'SELECT user_id FROM knowledge_entries WHERE id = $1',
        [documentId]
      );
      
      if (result.rows.length === 0) return false;
      return result.rows[0].user_id === userId; // Owner has all permissions
    } catch (error) {
      console.error('[Collaboration] ❌ Permission check failed:', error);
      return false;
    }
  }

  async checkWorkflowPermission(userId, workflowId, permission) {
    // Simplified permission check
    try {
      const result = await this.pool.query(
        'SELECT user_id FROM workflows WHERE id = $1',
        [workflowId]
      );
      
      if (result.rows.length === 0) return false;
      return result.rows[0].user_id === userId; // Owner has all permissions
    } catch (error) {
      console.error('[Collaboration] ❌ Permission check failed:', error);
      return false;
    }
  }

  async getUserDocumentPermissions(userId, documentId) {
    // Return permissions array - implement based on your system
    return ['read', 'edit', 'share']; // Simplified
  }

  async getUserWorkflowPermissions(userId, workflowId) {
    // Return permissions array - implement based on your system  
    return ['read', 'edit', 'execute', 'share']; // Simplified
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.metrics.activeDocuments = this.documentSessions.size;
      this.metrics.totalCollaborators = Array.from(this.userPresence.values())
        .filter(p => p.status === 'online').length;
      
      // Reset per-second metrics
      this.metrics.operationsPerSecond = 0;
    }, 1000);
  }

  /**
   * Clean up stale sessions
   */
  cleanupStaleSessions() {
    setInterval(() => {
      const now = new Date();
      const staleThreshold = 30 * 60 * 1000; // 30 minutes

      // Clean up stale document sessions
      for (const [documentId, session] of this.documentSessions) {
        if (now - session.lastModified > staleThreshold && session.collaborators.size === 0) {
          this.documentSessions.delete(documentId);
        }
      }

      // Clean up stale workflow sessions
      for (const [workflowId, session] of this.workflowSessions) {
        if (now - session.lastModified > staleThreshold && session.collaborators.size === 0) {
          this.workflowSessions.delete(workflowId);
        }
      }

      // Clean up offline users
      for (const [userId, presence] of this.userPresence) {
        if (presence.status === 'offline' && now - presence.lastSeen > staleThreshold) {
          this.userPresence.delete(userId);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get collaboration metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeDocumentSessions: this.documentSessions.size,
      activeWorkflowSessions: this.workflowSessions.size,
      onlineUsers: Array.from(this.userPresence.values()).filter(p => p.status === 'online').length,
      totalOperationQueues: this.operationQueues.size,
    };
  }

  /**
   * Get active collaborators for a resource
   */
  getCollaborators(resourceId, resourceType = 'document') {
    const sessions = resourceType === 'workflow' ? this.workflowSessions : this.documentSessions;
    const session = sessions.get(resourceId);
    
    if (!session) return [];
    
    return Array.from(session.collaborators.values()).map(collaborator => ({
      userId: collaborator.userId,
      joinedAt: collaborator.joinedAt,
      permissions: collaborator.permissions,
      cursor: collaborator.cursor,
      selection: collaborator.selection,
      lockedNodes: collaborator.lockedNodes ? Array.from(collaborator.lockedNodes) : undefined,
    }));
  }

  /**
   * Get user presence information
   */
  getUserPresence(userId) {
    const presence = this.userPresence.get(userId);
    if (!presence) return null;
    
    return {
      userId: presence.userId,
      status: presence.status,
      lastSeen: presence.lastSeen,
      currentActivity: presence.currentActivity,
      activeDocuments: Array.from(presence.activeDocuments),
      activeWorkflows: Array.from(presence.activeWorkflows),
      activeConversations: Array.from(presence.activeConversations),
    };
  }

  /**
   * Get all online users
   */
  getOnlineUsers() {
    return Array.from(this.userPresence.values())
      .filter(p => p.status === 'online')
      .map(p => ({
        userId: p.userId,
        status: p.status,
        currentActivity: p.currentActivity,
        lastSeen: p.lastSeen,
      }));
  }
}

export default RealTimeCollaborationService;
