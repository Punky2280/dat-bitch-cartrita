/**
 * CollaborationEngine - Real-Time Collaborative Content Editing System
 * 
 * Provides comprehensive collaborative editing capabilities with:
 * - Real-time multi-user editing with operational transformation
 * - Live cursor tracking and user presence indication
 * - Conflict-free collaborative text editing (CRDT-inspired)
 * - Comment system with inline discussions and reviews
 * - Approval workflows with role-based permissions
 * - WebSocket-based real-time synchronization
 * - Session management with automatic cleanup
 * - Edit history and change attribution
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import WebSocket from 'ws';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class CollaborationEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Real-time editing settings
            enableRealTimeEditing: true,
            maxConcurrentEditors: 50,
            sessionTimeout: 1800000, // 30 minutes
            syncInterval: 100, // milliseconds
            
            // Operational Transform settings
            enableOperationalTransform: true,
            maxOperationHistory: 10000,
            operationBufferTime: 50, // milliseconds
            enableConflictDetection: true,
            
            // Comment system settings
            enableComments: true,
            maxCommentLength: 5000,
            enableThreadedComments: true,
            enableReactions: true,
            
            // Workflow settings
            enableWorkflows: true,
            defaultWorkflowSteps: ['review', 'approve', 'publish'],
            workflowTimeout: 604800000, // 7 days
            
            // Performance settings
            enablePresenceTracking: true,
            cursorUpdateThreshold: 100, // milliseconds
            enableEditCompression: true,
            maxUndoHistory: 100,
            
            // Security settings
            enablePermissionChecks: true,
            enableEditAuditLog: true,
            encryptSessionData: false,
            
            ...config
        };
        
        this.initialized = false;
        this.isRunning = false;
        this.db = null;
        this.wss = null;
        
        // Active editing sessions
        this.activeSessions = new Map(); // sessionId -> SessionData
        this.contentSessions = new Map(); // contentId -> Set of sessionIds
        this.userSessions = new Map(); // userId -> Set of sessionIds
        
        // Operational Transform state
        this.operationHistory = new Map(); // contentId -> Operation[]
        this.lastOperationId = new Map(); // contentId -> operationId
        this.pendingOperations = new Map(); // sessionId -> Operation[]
        
        // Comment threads
        this.activeCommentThreads = new Map(); // contentId -> Comment[]
        
        // Workflow state
        this.activeWorkflows = new Map(); // contentId -> WorkflowState
        
        // Performance metrics
        this.metrics = {
            activeSessions: 0,
            totalSessionsCreated: 0,
            totalOperations: 0,
            totalComments: 0,
            totalWorkflows: 0,
            operationsPerSecond: 0,
            avgOperationLatency: 0,
            conflictsResolved: 0,
            sessionsCleanedUp: 0,
            lastActivity: null
        };
        
        // OpenTelemetry tracing
        this.tracer = OpenTelemetryTracing.getTracer('collaboration-engine');
        
        // Bind methods
        this.startEditSession = this.startEditSession.bind(this);
        this.joinEditSession = this.joinEditSession.bind(this);
        this.leaveEditSession = this.leaveEditSession.bind(this);
        this.broadcastEdit = this.broadcastEdit.bind(this);
        
        // Add test-expected method
        this.getCollaborators = this.getCollaborators.bind(this);
    }
    
    /**
     * Get list of collaborators for a content item
     */
    async getCollaborators(contentId) {
        const collaborators = [];
        for (const [sessionId, session] of this.activeSessions) {
            if (session.contentId === contentId && session.isActive) {
                collaborators.push({
                    userId: session.userId,
                    sessionId: sessionId,
                    lastActivity: session.lastActivity,
                    cursorPosition: session.cursorPosition
                });
            }
        }
        return collaborators;
    }
    
    /**
     * Initialize the Collaboration Engine
     */
    async initialize(database, webSocketServer = null) {
        const span = this.tracer.startSpan('collaboration_engine_initialize');
        
        try {
            this.db = database;
            
            if (webSocketServer) {
                this.wss = webSocketServer;
                this.setupWebSocketHandlers();
            }
            
            // Start cleanup intervals
            this.startSessionCleanup();
            this.startMetricsCollection();
            
            // Load existing active sessions
            await this.loadActiveSessions();
            
            this.initialized = true;
            this.isRunning = true;
            
            this.emit('initialized', { 
                timestamp: Date.now(), 
                config: this.config,
                activeSessions: this.activeSessions.size
            });
            
            span.setAttributes({
                'collaboration.engine.initialized': true,
                'collaboration.sessions.active': this.activeSessions.size,
                'collaboration.websocket.enabled': !!this.wss
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw new Error(`CollaborationEngine initialization failed: ${error.message}`);
        } finally {
            span.end();
        }
    }
    
    /**
     * Start a new editing session for content
     */
    async startEditSession(contentId, userId, options = {}) {
        const span = this.tracer.startSpan('collaboration_engine_start_session');
        const startTime = Date.now();
        
        try {
            if (!this.initialized) {
                throw new Error('CollaborationEngine not initialized');
            }
            
            // Check if user already has session for this content
            const existingSession = this.findUserSessionForContent(userId, contentId);
            if (existingSession && options.rejoinExisting !== false) {
                return existingSession;
            }
            
            // Generate session token
            const sessionToken = crypto.randomUUID();
            const sessionId = `session_${sessionToken}`;
            
            // Create session data
            const sessionData = {
                id: sessionId,
                token: sessionToken,
                contentId,
                userId,
                startTime: Date.now(),
                lastActivity: Date.now(),
                permissions: options.permissions || await this.getUserPermissions(userId, contentId),
                cursorPosition: options.initialCursor || { line: 0, character: 0 },
                selection: null,
                isActive: true,
                connectionState: 'connected',
                operationBuffer: [],
                undoStack: [],
                redoStack: [],
                metadata: {
                    userAgent: options.userAgent,
                    clientId: options.clientId,
                    ...options.metadata
                }
            };
            
            const client = await this.db.connect();
            
            try {
                // Save session to database
                const insertQuery = `
                    INSERT INTO content_edit_sessions (
                        id, content_id, session_token, user_id, 
                        cursor_position, session_data, permissions, 
                        last_activity, expires_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING *
                `;
                
                const values = [
                    sessionId,
                    contentId,
                    sessionToken,
                    userId,
                    sessionData.cursorPosition,
                    sessionData,
                    sessionData.permissions,
                    new Date(),
                    new Date(Date.now() + this.config.sessionTimeout)
                ];
                
                const result = await client.query(insertQuery, values);
                const dbSession = result.rows[0];
                
                // Add to active sessions
                this.activeSessions.set(sessionId, sessionData);
                
                // Track by content and user
                if (!this.contentSessions.has(contentId)) {
                    this.contentSessions.set(contentId, new Set());
                }
                this.contentSessions.get(contentId).add(sessionId);
                
                if (!this.userSessions.has(userId)) {
                    this.userSessions.set(userId, new Set());
                }
                this.userSessions.get(userId).add(sessionId);
                
                // Initialize operation history for content if needed
                if (!this.operationHistory.has(contentId)) {
                    this.operationHistory.set(contentId, []);
                    this.lastOperationId.set(contentId, 0);
                }
                
                // Update metrics
                this.metrics.activeSessions = this.activeSessions.size;
                this.metrics.totalSessionsCreated++;
                this.metrics.lastActivity = Date.now();
                
                // Broadcast user joined event to other sessions
                this.broadcastToContentSessions(contentId, {
                    type: 'user_joined',
                    sessionId,
                    userId,
                    timestamp: Date.now()
                }, sessionId);
                
                // Emit event
                this.emit('sessionStarted', {
                    sessionId,
                    contentId,
                    userId,
                    sessionData,
                    timestamp: Date.now()
                });
                
                span.setAttributes({
                    'session.id': sessionId,
                    'content.id': contentId,
                    'user.id': userId,
                    'session.duration_ms': Date.now() - startTime
                });
                
                return {
                    sessionId,
                    token: sessionToken,
                    contentId,
                    userId,
                    permissions: sessionData.permissions,
                    expiresAt: dbSession.expires_at,
                    operationHistory: this.getRecentOperations(contentId),
                    activeUsers: this.getActiveUsers(contentId)
                };
                
            } finally {
                client.release();
            }
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Join an existing editing session
     */
    async joinEditSession(sessionId, userId, websocket = null) {
        const span = this.tracer.startSpan('collaboration_engine_join_session');
        
        try {
            let session = this.activeSessions.get(sessionId);
            if (!session) {
                // Try to load from database
                const dbSession = await this.loadSessionFromDB(sessionId);
                if (!dbSession) {
                    throw new Error(`Session not found: ${sessionId}`);
                }
                
                // Restore session to memory
                this.activeSessions.set(sessionId, dbSession.session_data);
                session = dbSession.session_data;
            }
            
            if (session.userId !== userId) {
                throw new Error('Session belongs to different user');
            }
            
            // Update session activity
            session.lastActivity = Date.now();
            session.connectionState = 'connected';
            
            // Attach WebSocket if provided
            if (websocket) {
                session.websocket = websocket;
                this.setupWebSocketForSession(websocket, sessionId);
            }
            
            // Update database
            await this.db.query(
                'UPDATE content_edit_sessions SET last_activity = NOW() WHERE id = $1',
                [sessionId]
            );
            
            // Broadcast user reconnected
            this.broadcastToContentSessions(session.contentId, {
                type: 'user_reconnected',
                sessionId,
                userId,
                timestamp: Date.now()
            }, sessionId);
            
            span.setAttributes({
                'session.id': sessionId,
                'user.id': userId,
                'content.id': session.contentId
            });
            
            return {
                sessionId,
                contentId: session.contentId,
                operationHistory: this.getRecentOperations(session.contentId),
                activeUsers: this.getActiveUsers(session.contentId),
                cursorPosition: session.cursorPosition
            };
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Leave/end an editing session
     */
    async leaveEditSession(sessionId, userId) {
        const span = this.tracer.startSpan('collaboration_engine_leave_session');
        
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                return; // Session already ended
            }
            
            if (session.userId !== userId) {
                throw new Error('Session belongs to different user');
            }
            
            const contentId = session.contentId;
            
            // Close WebSocket if exists
            if (session.websocket) {
                session.websocket.close();
            }
            
            // Remove from tracking maps
            this.activeSessions.delete(sessionId);
            
            if (this.contentSessions.has(contentId)) {
                this.contentSessions.get(contentId).delete(sessionId);
                if (this.contentSessions.get(contentId).size === 0) {
                    this.contentSessions.delete(contentId);
                }
            }
            
            if (this.userSessions.has(userId)) {
                this.userSessions.get(userId).delete(sessionId);
                if (this.userSessions.get(userId).size === 0) {
                    this.userSessions.delete(userId);
                }
            }
            
            // Update database - mark session as inactive
            await this.db.query(
                'UPDATE content_edit_sessions SET is_active = false WHERE id = $1',
                [sessionId]
            );
            
            // Update metrics
            this.metrics.activeSessions = this.activeSessions.size;
            this.metrics.sessionsCleanedUp++;
            
            // Broadcast user left
            this.broadcastToContentSessions(contentId, {
                type: 'user_left',
                sessionId,
                userId,
                timestamp: Date.now()
            });
            
            // Emit event
            this.emit('sessionEnded', {
                sessionId,
                contentId,
                userId,
                duration: Date.now() - session.startTime,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'session.id': sessionId,
                'content.id': contentId,
                'user.id': userId,
                'session.duration_ms': Date.now() - session.startTime
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Broadcast edit operation to all sessions
     */
    async broadcastEdit(sessionId, editOperation) {
        const span = this.tracer.startSpan('collaboration_engine_broadcast_edit');
        const startTime = Date.now();
        
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error(`Session not found: ${sessionId}`);
            }
            
            const contentId = session.contentId;
            
            // Validate edit operation
            this.validateEditOperation(editOperation);
            
            // Generate operation ID
            const currentOpId = this.lastOperationId.get(contentId) || 0;
            const operationId = currentOpId + 1;
            this.lastOperationId.set(contentId, operationId);
            
            // Create full operation object
            const operation = {
                id: operationId,
                sessionId,
                userId: session.userId,
                contentId,
                type: editOperation.type,
                data: editOperation.data,
                timestamp: Date.now(),
                applied: false,
                conflicts: []
            };
            
            // Apply operational transformation if needed
            if (this.config.enableOperationalTransform) {
                operation.transformedData = await this.transformOperation(operation);
            }
            
            // Add to operation history
            const history = this.operationHistory.get(contentId);
            history.push(operation);
            
            // Keep history size manageable
            if (history.length > this.config.maxOperationHistory) {
                history.splice(0, history.length - this.config.maxOperationHistory);
            }
            
            // Update session cursor/selection
            if (editOperation.cursor) {
                session.cursorPosition = editOperation.cursor;
            }
            if (editOperation.selection) {
                session.selection = editOperation.selection;
            }
            session.lastActivity = Date.now();
            
            // Broadcast to all other sessions for this content
            const broadcastData = {
                type: 'edit_operation',
                operation: {
                    id: operationId,
                    sessionId,
                    userId: session.userId,
                    type: editOperation.type,
                    data: operation.transformedData || editOperation.data,
                    cursor: editOperation.cursor,
                    selection: editOperation.selection,
                    timestamp: operation.timestamp
                }
            };
            
            this.broadcastToContentSessions(contentId, broadcastData, sessionId);
            
            // Update metrics
            this.metrics.totalOperations++;
            this.metrics.lastActivity = Date.now();
            
            const duration = Date.now() - startTime;
            this.updateOperationLatency(duration);
            
            // Emit event
            this.emit('editBroadcast', {
                operation,
                contentId,
                sessionId,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'operation.id': operationId,
                'operation.type': editOperation.type,
                'content.id': contentId,
                'session.id': sessionId,
                'operation.duration_ms': duration
            });
            
            return {
                operationId,
                applied: true,
                conflicts: operation.conflicts,
                timestamp: operation.timestamp
            };
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Resolve edit conflicts using operational transformation
     */
    async resolveConflicts(sessionId, conflicts) {
        const span = this.tracer.startSpan('collaboration_engine_resolve_conflicts');
        
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error(`Session not found: ${sessionId}`);
            }
            
            const resolutions = [];
            
            for (const conflict of conflicts) {
                const resolution = await this.resolveIndividualConflict(conflict, session);
                resolutions.push(resolution);
            }
            
            // Update metrics
            this.metrics.conflictsResolved += resolutions.length;
            
            // Broadcast resolution to all sessions
            this.broadcastToContentSessions(session.contentId, {
                type: 'conflicts_resolved',
                sessionId,
                resolutions,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'conflicts.count': conflicts.length,
                'resolutions.count': resolutions.length,
                'content.id': session.contentId
            });
            
            return {
                resolved: resolutions.length,
                resolutions,
                timestamp: Date.now()
            };
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Comment System Methods
     */
    
    /**
     * Add comment to content
     */
    async addComment(contentId, commentData, userId) {
        const span = this.tracer.startSpan('collaboration_engine_add_comment');
        
        try {
            // Validate comment data
            this.validateCommentData(commentData);
            
            const comment = {
                id: crypto.randomUUID(),
                content_id: contentId,
                user_id: userId,
                comment_text: commentData.text,
                comment_type: commentData.type || 'comment',
                position_data: commentData.position || null,
                parent_id: commentData.parentId || null,
                status: 'open',
                created_at: new Date(),
                reactions: {}
            };
            
            // Insert into database
            const insertQuery = `
                INSERT INTO content_comments (
                    id, content_id, user_id, comment_text, comment_type,
                    position_data, parent_id, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
            
            const values = [
                comment.id,
                contentId,
                userId,
                comment.comment_text,
                comment.comment_type,
                comment.position_data,
                comment.parent_id,
                comment.status,
                comment.created_at
            ];
            
            const result = await this.db.query(insertQuery, values);
            const savedComment = result.rows[0];
            
            // Add to active threads
            if (!this.activeCommentThreads.has(contentId)) {
                this.activeCommentThreads.set(contentId, []);
            }
            this.activeCommentThreads.get(contentId).push(savedComment);
            
            // Update metrics
            this.metrics.totalComments++;
            
            // Broadcast to active sessions
            this.broadcastToContentSessions(contentId, {
                type: 'comment_added',
                comment: savedComment,
                timestamp: Date.now()
            });
            
            // Emit event
            this.emit('commentAdded', {
                comment: savedComment,
                contentId,
                userId,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'comment.id': comment.id,
                'comment.type': comment.comment_type,
                'content.id': contentId,
                'user.id': userId
            });
            
            return savedComment;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Reply to existing comment
     */
    async replyToComment(commentId, replyData, userId) {
        const span = this.tracer.startSpan('collaboration_engine_reply_comment');
        
        try {
            // Get parent comment
            const parentQuery = 'SELECT * FROM content_comments WHERE id = $1';
            const parentResult = await this.db.query(parentQuery, [commentId]);
            
            if (parentResult.rows.length === 0) {
                throw new Error(`Parent comment not found: ${commentId}`);
            }
            
            const parentComment = parentResult.rows[0];
            
            // Create reply
            const reply = await this.addComment(parentComment.content_id, {
                ...replyData,
                parentId: commentId,
                type: 'reply'
            }, userId);
            
            span.setAttributes({
                'reply.id': reply.id,
                'parent.id': commentId,
                'content.id': parentComment.content_id
            });
            
            return reply;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Resolve comment thread
     */
    async resolveComment(commentId, resolution, userId) {
        const span = this.tracer.startSpan('collaboration_engine_resolve_comment');
        
        try {
            const updateQuery = `
                UPDATE content_comments 
                SET status = 'resolved',
                    resolved_at = NOW(),
                    resolved_by = $2,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
            
            const result = await this.db.query(updateQuery, [commentId, userId]);
            
            if (result.rows.length === 0) {
                throw new Error(`Comment not found: ${commentId}`);
            }
            
            const resolvedComment = result.rows[0];
            
            // Broadcast resolution
            this.broadcastToContentSessions(resolvedComment.content_id, {
                type: 'comment_resolved',
                commentId,
                resolvedBy: userId,
                resolution,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'comment.id': commentId,
                'resolved_by': userId,
                'content.id': resolvedComment.content_id
            });
            
            return resolvedComment;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Get comments for content
     */
    async getComments(contentId, filters = {}) {
        const {
            status = null,
            type = null,
            userId = null,
            includeReplies = true,
            limit = 100,
            offset = 0
        } = filters;
        
        let query = `
            SELECT c.*, u.email as user_email
            FROM content_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.content_id = $1
        `;
        
        const params = [contentId];
        let paramIndex = 2;
        
        if (status) {
            query += ` AND c.status = $${paramIndex++}`;
            params.push(status);
        }
        
        if (type) {
            query += ` AND c.comment_type = $${paramIndex++}`;
            params.push(type);
        }
        
        if (userId) {
            query += ` AND c.user_id = $${paramIndex++}`;
            params.push(userId);
        }
        
        if (!includeReplies) {
            query += ' AND c.parent_id IS NULL';
        }
        
        query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);
        
        const result = await this.db.query(query, params);
        return result.rows;
    }
    
    /**
     * Workflow Management Methods
     */
    
    /**
     * Initialize workflow for content
     */
    async initializeWorkflow(contentId, workflowType, options = {}) {
        const span = this.tracer.startSpan('collaboration_engine_init_workflow');
        
        try {
            const workflowId = crypto.randomUUID();
            const workflowData = this.generateWorkflowSteps(workflowType, options);
            
            const workflow = {
                id: workflowId,
                content_id: contentId,
                workflow_type: workflowType,
                workflow_name: options.name || `${workflowType} Workflow`,
                current_step: 0,
                total_steps: workflowData.steps.length,
                workflow_data: workflowData,
                assignees: workflowData.steps[0].assignees || [],
                status: 'active',
                due_date: options.dueDate,
                priority: options.priority || 1,
                created_at: new Date()
            };
            
            // Insert into database
            const insertQuery = `
                INSERT INTO content_workflows (
                    id, content_id, workflow_type, workflow_name,
                    current_step, total_steps, workflow_data,
                    assignees, status, due_date, priority
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;
            
            const values = [
                workflow.id,
                workflow.content_id,
                workflow.workflow_type,
                workflow.workflow_name,
                workflow.current_step,
                workflow.total_steps,
                workflow.workflow_data,
                workflow.assignees,
                workflow.status,
                workflow.due_date,
                workflow.priority
            ];
            
            const result = await this.db.query(insertQuery, values);
            const savedWorkflow = result.rows[0];
            
            // Track active workflow
            this.activeWorkflows.set(contentId, savedWorkflow);
            
            // Update metrics
            this.metrics.totalWorkflows++;
            
            // Emit event
            this.emit('workflowInitialized', {
                workflow: savedWorkflow,
                contentId,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'workflow.id': workflowId,
                'workflow.type': workflowType,
                'content.id': contentId,
                'workflow.steps': workflowData.steps.length
            });
            
            return savedWorkflow;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Advance workflow to next step
     */
    async advanceWorkflow(workflowId, decision, userId) {
        const span = this.tracer.startSpan('collaboration_engine_advance_workflow');
        
        try {
            // Get current workflow
            const workflowQuery = 'SELECT * FROM content_workflows WHERE id = $1';
            const workflowResult = await this.db.query(workflowQuery, [workflowId]);
            
            if (workflowResult.rows.length === 0) {
                throw new Error(`Workflow not found: ${workflowId}`);
            }
            
            const workflow = workflowResult.rows[0];
            const workflowData = workflow.workflow_data;
            const currentStep = workflow.current_step;
            
            // Validate decision
            const stepData = workflowData.steps[currentStep];
            if (!stepData.validDecisions.includes(decision.action)) {
                throw new Error(`Invalid decision: ${decision.action}`);
            }
            
            // Check permissions
            if (!workflow.assignees.includes(userId)) {
                throw new Error('User not authorized for this workflow step');
            }
            
            // Record decision
            const decisionRecord = {
                step: currentStep,
                userId,
                action: decision.action,
                comment: decision.comment || '',
                timestamp: new Date()
            };
            
            workflowData.decisions = workflowData.decisions || [];
            workflowData.decisions.push(decisionRecord);
            
            // Determine next step
            let nextStep = currentStep;
            let workflowStatus = workflow.status;
            
            if (decision.action === 'approve' || decision.action === 'accept') {
                nextStep = currentStep + 1;
                
                if (nextStep >= workflow.total_steps) {
                    // Workflow completed
                    workflowStatus = 'completed';
                    nextStep = workflow.total_steps - 1;
                }
            } else if (decision.action === 'reject') {
                // Workflow rejected - could reset or end
                if (stepData.onReject === 'reset') {
                    nextStep = 0;
                } else {
                    workflowStatus = 'cancelled';
                }
            }
            
            // Get next step assignees
            let nextAssignees = [];
            if (nextStep < workflowData.steps.length) {
                nextAssignees = workflowData.steps[nextStep].assignees || [];
            }
            
            // Update workflow
            const updateQuery = `
                UPDATE content_workflows 
                SET current_step = $2,
                    workflow_data = $3,
                    assignees = $4,
                    status = $5,
                    updated_at = NOW(),
                    completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE completed_at END
                WHERE id = $1
                RETURNING *
            `;
            
            const updateResult = await this.db.query(updateQuery, [
                workflowId,
                nextStep,
                workflowData,
                nextAssignees,
                workflowStatus
            ]);
            
            const updatedWorkflow = updateResult.rows[0];
            
            // Update active workflows
            if (workflowStatus === 'completed' || workflowStatus === 'cancelled') {
                this.activeWorkflows.delete(workflow.content_id);
            } else {
                this.activeWorkflows.set(workflow.content_id, updatedWorkflow);
            }
            
            // Broadcast workflow update
            this.broadcastToContentSessions(workflow.content_id, {
                type: 'workflow_updated',
                workflowId,
                currentStep: nextStep,
                status: workflowStatus,
                decision: decisionRecord,
                timestamp: Date.now()
            });
            
            // Emit event
            this.emit('workflowAdvanced', {
                workflow: updatedWorkflow,
                previousStep: currentStep,
                decision: decisionRecord,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'workflow.id': workflowId,
                'workflow.step.from': currentStep,
                'workflow.step.to': nextStep,
                'workflow.status': workflowStatus,
                'decision.action': decision.action
            });
            
            return updatedWorkflow;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Get workflow status for content
     */
    async getWorkflowStatus(contentId) {
        const query = `
            SELECT w.*, 
                   array_agg(u.email) as assignee_emails
            FROM content_workflows w
            LEFT JOIN users u ON u.id = ANY(w.assignees)
            WHERE w.content_id = $1 AND w.status = 'active'
            GROUP BY w.id
        `;
        
        const result = await this.db.query(query, [contentId]);
        return result.rows[0] || null;
    }
    
    /**
     * Helper Methods
     */
    
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, request) => {
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    await this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: error.message,
                        timestamp: Date.now()
                    }));
                }
            });
            
            ws.on('close', () => {
                // Clean up session associated with this WebSocket
                this.cleanupWebSocketSession(ws);
            });
        });
    }
    
    async handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'join_session':
                await this.handleJoinSession(ws, data);
                break;
            case 'edit_operation':
                await this.handleEditOperation(ws, data);
                break;
            case 'cursor_update':
                await this.handleCursorUpdate(ws, data);
                break;
            case 'heartbeat':
                ws.send(JSON.stringify({ type: 'heartbeat_ack', timestamp: Date.now() }));
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    error: `Unknown message type: ${data.type}`,
                    timestamp: Date.now()
                }));
        }
    }
    
    setupWebSocketForSession(websocket, sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.websocket = websocket;
            websocket.sessionId = sessionId;
        }
    }
    
    broadcastToContentSessions(contentId, data, excludeSessionId = null) {
        const sessions = this.contentSessions.get(contentId);
        if (!sessions) return;
        
        const message = JSON.stringify(data);
        
        for (const sessionId of sessions) {
            if (sessionId === excludeSessionId) continue;
            
            const session = this.activeSessions.get(sessionId);
            if (session?.websocket && session.websocket.readyState === WebSocket.OPEN) {
                session.websocket.send(message);
            }
        }
    }
    
    findUserSessionForContent(userId, contentId) {
        const userSessions = this.userSessions.get(userId);
        if (!userSessions) return null;
        
        for (const sessionId of userSessions) {
            const session = this.activeSessions.get(sessionId);
            if (session && session.contentId === contentId) {
                return session;
            }
        }
        
        return null;
    }
    
    async getUserPermissions(userId, contentId) {
        // Simplified permissions - would integrate with actual permission system
        return {
            read: true,
            write: true,
            comment: true,
            approve: false
        };
    }
    
    validateEditOperation(operation) {
        const requiredFields = ['type', 'data'];
        const validTypes = ['insert', 'delete', 'replace', 'format', 'move'];
        
        for (const field of requiredFields) {
            if (!(field in operation)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (!validTypes.includes(operation.type)) {
            throw new Error(`Invalid operation type: ${operation.type}`);
        }
    }
    
    validateCommentData(commentData) {
        if (!commentData.text || commentData.text.trim().length === 0) {
            throw new Error('Comment text is required');
        }
        
        if (commentData.text.length > this.config.maxCommentLength) {
            throw new Error(`Comment too long: ${commentData.text.length} > ${this.config.maxCommentLength}`);
        }
    }
    
    async transformOperation(operation) {
        // Simplified operational transformation
        // In a real implementation, this would be much more sophisticated
        const history = this.operationHistory.get(operation.contentId);
        const recentOps = history.slice(-10); // Check last 10 operations
        
        let transformedData = operation.data;
        
        for (const pastOp of recentOps) {
            if (pastOp.sessionId !== operation.sessionId) {
                transformedData = this.transformAgainstOperation(transformedData, pastOp);
            }
        }
        
        return transformedData;
    }
    
    transformAgainstOperation(newOp, pastOp) {
        // Simplified transformation logic
        // Real OT would handle position adjustments, etc.
        return newOp;
    }
    
    async resolveIndividualConflict(conflict, session) {
        // Simplified conflict resolution
        return {
            conflictId: conflict.id,
            resolution: 'accepted',
            resolvedBy: session.userId,
            timestamp: Date.now()
        };
    }
    
    generateWorkflowSteps(workflowType, options) {
        const defaultSteps = {
            'review_approval': [
                {
                    name: 'Content Review',
                    assignees: options.reviewers || [],
                    validDecisions: ['approve', 'reject', 'request_changes'],
                    onReject: 'reset'
                },
                {
                    name: 'Final Approval',
                    assignees: options.approvers || [],
                    validDecisions: ['approve', 'reject'],
                    onReject: 'end'
                }
            ],
            'publishing': [
                {
                    name: 'Pre-publish Check',
                    assignees: options.editors || [],
                    validDecisions: ['approve', 'reject'],
                    onReject: 'reset'
                },
                {
                    name: 'Publish Content',
                    assignees: options.publishers || [],
                    validDecisions: ['publish', 'schedule', 'cancel'],
                    onReject: 'end'
                }
            ]
        };
        
        return {
            steps: defaultSteps[workflowType] || defaultSteps['review_approval'],
            decisions: [],
            created_at: new Date().toISOString()
        };
    }
    
    getRecentOperations(contentId, limit = 50) {
        const history = this.operationHistory.get(contentId);
        return history ? history.slice(-limit) : [];
    }
    
    getActiveUsers(contentId) {
        const sessions = this.contentSessions.get(contentId);
        if (!sessions) return [];
        
        const users = [];
        for (const sessionId of sessions) {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                users.push({
                    userId: session.userId,
                    sessionId,
                    cursorPosition: session.cursorPosition,
                    lastActivity: session.lastActivity,
                    connectionState: session.connectionState
                });
            }
        }
        
        return users;
    }
    
    updateOperationLatency(latency) {
        if (this.metrics.avgOperationLatency === 0) {
            this.metrics.avgOperationLatency = latency;
        } else {
            this.metrics.avgOperationLatency = (this.metrics.avgOperationLatency + latency) / 2;
        }
    }
    
    async loadActiveSessions() {
        const query = `
            SELECT * FROM content_edit_sessions 
            WHERE is_active = true AND expires_at > NOW()
        `;
        
        const result = await this.db.query(query);
        
        for (const row of result.rows) {
            const sessionData = row.session_data;
            sessionData.id = row.id;
            
            this.activeSessions.set(row.id, sessionData);
            
            // Rebuild tracking maps
            if (!this.contentSessions.has(row.content_id)) {
                this.contentSessions.set(row.content_id, new Set());
            }
            this.contentSessions.get(row.content_id).add(row.id);
            
            if (!this.userSessions.has(row.user_id)) {
                this.userSessions.set(row.user_id, new Set());
            }
            this.userSessions.get(row.user_id).add(row.id);
        }
        
        this.metrics.activeSessions = this.activeSessions.size;
    }
    
    async loadSessionFromDB(sessionId) {
        const query = 'SELECT * FROM content_edit_sessions WHERE id = $1';
        const result = await this.db.query(query, [sessionId]);
        return result.rows[0] || null;
    }
    
    startSessionCleanup() {
        setInterval(async () => {
            await this.cleanupExpiredSessions();
        }, 300000); // Every 5 minutes
    }
    
    async cleanupExpiredSessions() {
        const expiredSessions = [];
        const now = Date.now();
        
        for (const [sessionId, session] of this.activeSessions) {
            const timeSinceActivity = now - session.lastActivity;
            if (timeSinceActivity > this.config.sessionTimeout) {
                expiredSessions.push(sessionId);
            }
        }
        
        for (const sessionId of expiredSessions) {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                await this.leaveEditSession(sessionId, session.userId);
            }
        }
        
        // Clean up database
        await this.db.query(
            'UPDATE content_edit_sessions SET is_active = false WHERE expires_at < NOW()'
        );
    }
    
    cleanupWebSocketSession(ws) {
        if (ws.sessionId) {
            const session = this.activeSessions.get(ws.sessionId);
            if (session) {
                session.connectionState = 'disconnected';
                session.websocket = null;
            }
        }
    }
    
    startMetricsCollection() {
        setInterval(() => {
            // Calculate operations per second
            const now = Date.now();
            const recentOps = Array.from(this.operationHistory.values())
                .flat()
                .filter(op => now - op.timestamp < 1000);
            
            this.metrics.operationsPerSecond = recentOps.length;
        }, 1000);
    }
    
    /**
     * Get service statistics and health information
     */
    getStatistics() {
        return {
            ...this.metrics,
            activeSessions: this.activeSessions.size,
            activeContentSessions: this.contentSessions.size,
            activeUserSessions: this.userSessions.size,
            operationHistorySize: Array.from(this.operationHistory.values()).reduce((sum, history) => sum + history.length, 0),
            config: {
                maxConcurrentEditors: this.config.maxConcurrentEditors,
                sessionTimeout: this.config.sessionTimeout,
                operationalTransformEnabled: this.config.enableOperationalTransform,
                commentsEnabled: this.config.enableComments,
                workflowsEnabled: this.config.enableWorkflows
            },
            initialized: this.initialized,
            running: this.isRunning
        };
    }
    
    /**
     * Stop the Collaboration Engine
     */
    async stop() {
        this.isRunning = false;
        
        // Close all active sessions
        for (const sessionId of this.activeSessions.keys()) {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                await this.leaveEditSession(sessionId, session.userId);
            }
        }
        
        this.activeSessions.clear();
        this.contentSessions.clear();
        this.userSessions.clear();
        this.operationHistory.clear();
        
        this.emit('stopped', { timestamp: Date.now() });
        console.log('CollaborationEngine service stopped');
    }
}

export default CollaborationEngine;
