/**
 * Presence Awareness System - Task 17: Real-time Collaboration Engine
 * Manages user presence, activity tracking, and awareness features
 * 
 * Features:
 * - Real-time user presence tracking
 * - Activity status monitoring (typing, idle, away)
 * - User location awareness within documents
 * - Collaborative cursors and selections
 * - Status broadcasting and synchronization
 * - Presence expiration and cleanup
 * - Rich presence information (name, avatar, role)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import OpenTelemetryTracing from './system/OpenTelemetryTracing.js';

/**
 * Presence Status Types
 */
const PresenceStatus = {
    ONLINE: 'online',
    TYPING: 'typing',
    IDLE: 'idle',
    AWAY: 'away',
    OFFLINE: 'offline'
};

/**
 * Activity Types
 */
const ActivityType = {
    CURSOR_MOVE: 'cursor_move',
    SELECTION_CHANGE: 'selection_change',
    TYPING: 'typing',
    VIEW_CHANGE: 'view_change',
    EDIT: 'edit',
    COMMENT: 'comment'
};

/**
 * User Presence Information
 */
class UserPresence {
    constructor(userId, sessionId, metadata = {}) {
        this.userId = userId;
        this.sessionId = sessionId;
        this.status = PresenceStatus.ONLINE;
        this.lastActivity = Date.now();
        this.currentDocument = null;
        this.cursorPosition = null;
        this.selection = null;
        this.viewport = null; // visible portion of document
        this.metadata = {
            name: metadata.name || 'Anonymous',
            avatar: metadata.avatar || null,
            role: metadata.role || 'collaborator',
            color: metadata.color || this._generateUserColor(userId),
            ...metadata
        };
        this.activities = []; // Recent activity history
        this.connections = new Set(); // WebSocket connection IDs
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
    }

    /**
     * Update presence status
     */
    updateStatus(status, metadata = {}) {
        this.status = status;
        this.lastActivity = Date.now();
        this.updatedAt = Date.now();
        
        // Update metadata if provided
        Object.assign(this.metadata, metadata);
        
        // Add activity record
        this.addActivity(ActivityType.VIEW_CHANGE, { status, metadata });
    }

    /**
     * Update cursor position
     */
    updateCursor(documentId, position, selection = null) {
        this.currentDocument = documentId;
        this.cursorPosition = position;
        this.selection = selection;
        this.lastActivity = Date.now();
        this.updatedAt = Date.now();
        
        this.addActivity(ActivityType.CURSOR_MOVE, { 
            documentId, 
            position, 
            selection 
        });
    }

    /**
     * Update viewport (visible area)
     */
    updateViewport(documentId, startOffset, endOffset) {
        this.currentDocument = documentId;
        this.viewport = { startOffset, endOffset };
        this.lastActivity = Date.now();
        this.updatedAt = Date.now();
        
        this.addActivity(ActivityType.VIEW_CHANGE, { 
            documentId, 
            viewport: this.viewport 
        });
    }

    /**
     * Add activity record
     */
    addActivity(type, data = {}) {
        const activity = {
            type,
            timestamp: Date.now(),
            data
        };
        
        this.activities.unshift(activity);
        
        // Keep only last 50 activities
        if (this.activities.length > 50) {
            this.activities = this.activities.slice(0, 50);
        }
    }

    /**
     * Check if presence is expired
     */
    isExpired(timeout = 300000) { // 5 minutes default
        return (Date.now() - this.lastActivity) > timeout;
    }

    /**
     * Generate a consistent color for user
     */
    _generateUserColor(userId) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
        ];
        
        // Use hash of userId to consistently assign color
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
        }
        
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Convert to JSON for transmission
     */
    toJSON(includePrivate = false) {
        const json = {
            userId: this.userId,
            sessionId: this.sessionId,
            status: this.status,
            lastActivity: this.lastActivity,
            currentDocument: this.currentDocument,
            cursorPosition: this.cursorPosition,
            selection: this.selection,
            viewport: this.viewport,
            metadata: { ...this.metadata }
        };

        if (includePrivate) {
            json.activities = this.activities.slice(0, 10); // Recent activities only
            json.connectionCount = this.connections.size;
            json.createdAt = this.createdAt;
            json.updatedAt = this.updatedAt;
        }

        return json;
    }
}

/**
 * Document Presence - tracks presence within a specific document
 */
class DocumentPresence {
    constructor(documentId) {
        this.documentId = documentId;
        this.users = new Map(); // userId -> UserPresence
        this.cursors = new Map(); // userId -> cursor data
        this.selections = new Map(); // userId -> selection data
        this.viewports = new Map(); // userId -> viewport data
        this.activities = []; // Recent document activities
        this.metrics = {
            totalUsers: 0,
            activeUsers: 0,
            typingUsers: 0,
            peakConcurrency: 0,
            lastActivity: Date.now()
        };
    }

    /**
     * Add user to document presence
     */
    addUser(presence) {
        this.users.set(presence.userId, presence);
        this.updateMetrics();
        
        this.addActivity({
            type: 'user_joined',
            userId: presence.userId,
            metadata: presence.metadata
        });
    }

    /**
     * Remove user from document presence
     */
    removeUser(userId) {
        const presence = this.users.get(userId);
        if (presence) {
            this.users.delete(userId);
            this.cursors.delete(userId);
            this.selections.delete(userId);
            this.viewports.delete(userId);
            
            this.addActivity({
                type: 'user_left',
                userId,
                metadata: presence.metadata
            });
        }
        
        this.updateMetrics();
    }

    /**
     * Update user cursor
     */
    updateCursor(userId, position, selection = null) {
        const presence = this.users.get(userId);
        if (!presence) return;

        presence.updateCursor(this.documentId, position, selection);
        
        this.cursors.set(userId, {
            position,
            color: presence.metadata.color,
            name: presence.metadata.name
        });

        if (selection) {
            this.selections.set(userId, {
                start: selection.start,
                end: selection.end,
                color: presence.metadata.color,
                name: presence.metadata.name
            });
        } else {
            this.selections.delete(userId);
        }

        this.addActivity({
            type: 'cursor_updated',
            userId,
            position,
            selection
        });
    }

    /**
     * Update user viewport
     */
    updateViewport(userId, startOffset, endOffset) {
        const presence = this.users.get(userId);
        if (!presence) return;

        presence.updateViewport(this.documentId, startOffset, endOffset);
        
        this.viewports.set(userId, {
            startOffset,
            endOffset,
            userId,
            name: presence.metadata.name
        });

        this.addActivity({
            type: 'viewport_updated',
            userId,
            startOffset,
            endOffset
        });
    }

    /**
     * Set user typing status
     */
    setTyping(userId, isTyping) {
        const presence = this.users.get(userId);
        if (!presence) return;

        const newStatus = isTyping ? PresenceStatus.TYPING : PresenceStatus.ONLINE;
        presence.updateStatus(newStatus);

        this.addActivity({
            type: isTyping ? 'started_typing' : 'stopped_typing',
            userId
        });

        this.updateMetrics();
    }

    /**
     * Add activity to document
     */
    addActivity(activity) {
        this.activities.unshift({
            ...activity,
            timestamp: Date.now(),
            documentId: this.documentId
        });

        // Keep only last 100 activities
        if (this.activities.length > 100) {
            this.activities = this.activities.slice(0, 100);
        }

        this.metrics.lastActivity = Date.now();
    }

    /**
     * Update metrics
     */
    updateMetrics() {
        this.metrics.totalUsers = this.users.size;
        this.metrics.activeUsers = Array.from(this.users.values())
            .filter(presence => !presence.isExpired()).length;
        this.metrics.typingUsers = Array.from(this.users.values())
            .filter(presence => presence.status === PresenceStatus.TYPING).length;
        
        if (this.metrics.activeUsers > this.metrics.peakConcurrency) {
            this.metrics.peakConcurrency = this.metrics.activeUsers;
        }
    }

    /**
     * Get document presence summary
     */
    getSummary() {
        this.updateMetrics();
        
        return {
            documentId: this.documentId,
            users: Array.from(this.users.values()).map(p => p.toJSON()),
            cursors: Array.from(this.cursors.entries()).map(([userId, cursor]) => ({
                userId,
                ...cursor
            })),
            selections: Array.from(this.selections.entries()).map(([userId, selection]) => ({
                userId,
                ...selection
            })),
            viewports: Array.from(this.viewports.values()),
            metrics: { ...this.metrics },
            recentActivities: this.activities.slice(0, 20)
        };
    }
}

/**
 * Presence Awareness System - Main class
 */
class PresenceAwarenessSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            presenceTimeout: options.presenceTimeout || 300000, // 5 minutes
            cleanupInterval: options.cleanupInterval || 60000, // 1 minute
            maxActivitiesPerUser: options.maxActivitiesPerUser || 50,
            maxDocumentActivities: options.maxDocumentActivities || 100,
            ...options
        };
        
        this.globalPresence = new Map(); // userId -> UserPresence
        this.documentPresence = new Map(); // documentId -> DocumentPresence
        this.sessionMapping = new Map(); // sessionId -> userId
        this.connectionMapping = new Map(); // connectionId -> { userId, sessionId }
        
        this.metrics = {
            totalUsers: 0,
            activeUsers: 0,
            totalDocuments: 0,
            activeDocuments: 0,
            totalActivities: 0
        };

        this.cleanupTimer = null;
        this.isRunning = false;
    }

    /**
     * Start the presence system
     */
    start() {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.start',
            () => {
                if (this.isRunning) return { success: true, message: 'Already running' };

                this.isRunning = true;
                this._startCleanupTimer();

                this.emit('started');
                return { success: true, message: 'Presence awareness system started' };
            }
        );
    }

    /**
     * Stop the presence system
     */
    stop() {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.stop',
            () => {
                if (!this.isRunning) return { success: true, message: 'Already stopped' };

                this.isRunning = false;
                this._stopCleanupTimer();
                this._clearAllPresence();

                this.emit('stopped');
                return { success: true, message: 'Presence awareness system stopped' };
            }
        );
    }

    /**
     * Register user presence
     */
    registerPresence(userId, sessionId, connectionId, metadata = {}) {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.register_presence',
            () => {
                let presence = this.globalPresence.get(userId);
                
                if (!presence) {
                    presence = new UserPresence(userId, sessionId, metadata);
                    this.globalPresence.set(userId, presence);
                    this.metrics.totalUsers++;
                }

                // Update session mapping
                this.sessionMapping.set(sessionId, userId);
                this.connectionMapping.set(connectionId, { userId, sessionId });
                presence.connections.add(connectionId);

                this._updateMetrics();

                this.emit('presence_registered', { 
                    userId, 
                    sessionId, 
                    connectionId,
                    presence: presence.toJSON() 
                });

                return { 
                    success: true, 
                    presence: presence.toJSON(true) 
                };
            }
        );
    }

    /**
     * Unregister user presence
     */
    unregisterPresence(connectionId) {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.unregister_presence',
            () => {
                const mapping = this.connectionMapping.get(connectionId);
                if (!mapping) return { success: true };

                const { userId, sessionId } = mapping;
                const presence = this.globalPresence.get(userId);
                
                if (presence) {
                    presence.connections.delete(connectionId);
                    
                    // If no more connections, remove from all documents
                    if (presence.connections.size === 0) {
                        this._removeFromAllDocuments(userId);
                        this.globalPresence.delete(userId);
                        this.sessionMapping.delete(sessionId);
                        this.metrics.totalUsers--;
                    }
                }

                this.connectionMapping.delete(connectionId);
                this._updateMetrics();

                this.emit('presence_unregistered', { 
                    userId, 
                    sessionId, 
                    connectionId 
                });

                return { success: true };
            }
        );
    }

    /**
     * Join document
     */
    joinDocument(userId, documentId) {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.join_document',
            () => {
                const presence = this.globalPresence.get(userId);
                if (!presence) {
                    throw new Error('User presence not registered');
                }

                // Get or create document presence
                if (!this.documentPresence.has(documentId)) {
                    this.documentPresence.set(documentId, new DocumentPresence(documentId));
                    this.metrics.totalDocuments++;
                }

                const docPresence = this.documentPresence.get(documentId);
                docPresence.addUser(presence);

                // Update user's current document
                presence.currentDocument = documentId;
                presence.updateStatus(PresenceStatus.ONLINE);

                this._updateMetrics();

                this.emit('document_joined', { 
                    userId, 
                    documentId, 
                    documentPresence: docPresence.getSummary() 
                });

                return { 
                    success: true, 
                    documentPresence: docPresence.getSummary() 
                };
            }
        );
    }

    /**
     * Leave document
     */
    leaveDocument(userId, documentId) {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.leave_document',
            () => {
                const docPresence = this.documentPresence.get(documentId);
                if (!docPresence) return { success: true };

                docPresence.removeUser(userId);

                // Update user's current document
                const presence = this.globalPresence.get(userId);
                if (presence && presence.currentDocument === documentId) {
                    presence.currentDocument = null;
                    presence.cursorPosition = null;
                    presence.selection = null;
                    presence.viewport = null;
                }

                // Clean up empty document presence
                if (docPresence.users.size === 0) {
                    this.documentPresence.delete(documentId);
                    this.metrics.totalDocuments--;
                }

                this._updateMetrics();

                this.emit('document_left', { userId, documentId });

                return { success: true };
            }
        );
    }

    /**
     * Update cursor position
     */
    updateCursor(userId, documentId, position, selection = null) {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.update_cursor',
            () => {
                const docPresence = this.documentPresence.get(documentId);
                if (!docPresence) {
                    throw new Error('Document not found in presence system');
                }

                docPresence.updateCursor(userId, position, selection);

                this.emit('cursor_updated', { 
                    userId, 
                    documentId, 
                    position, 
                    selection 
                });

                return { success: true };
            }
        );
    }

    /**
     * Update viewport
     */
    updateViewport(userId, documentId, startOffset, endOffset) {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.update_viewport',
            () => {
                const docPresence = this.documentPresence.get(documentId);
                if (!docPresence) {
                    throw new Error('Document not found in presence system');
                }

                docPresence.updateViewport(userId, startOffset, endOffset);

                this.emit('viewport_updated', { 
                    userId, 
                    documentId, 
                    startOffset, 
                    endOffset 
                });

                return { success: true };
            }
        );
    }

    /**
     * Set typing status
     */
    setTyping(userId, documentId, isTyping) {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.set_typing',
            () => {
                const docPresence = this.documentPresence.get(documentId);
                if (!docPresence) {
                    throw new Error('Document not found in presence system');
                }

                docPresence.setTyping(userId, isTyping);

                this.emit('typing_status_changed', { 
                    userId, 
                    documentId, 
                    isTyping 
                });

                return { success: true };
            }
        );
    }

    /**
     * Update user status
     */
    updateStatus(userId, status, metadata = {}) {
        return OpenTelemetryTracing.traceOperation(
            'presence_awareness.update_status',
            () => {
                const presence = this.globalPresence.get(userId);
                if (!presence) {
                    throw new Error('User presence not registered');
                }

                presence.updateStatus(status, metadata);

                this.emit('status_updated', { 
                    userId, 
                    status, 
                    metadata,
                    presence: presence.toJSON() 
                });

                return { success: true, presence: presence.toJSON() };
            }
        );
    }

    /**
     * Get document presence
     */
    getDocumentPresence(documentId) {
        const docPresence = this.documentPresence.get(documentId);
        return docPresence ? docPresence.getSummary() : null;
    }

    /**
     * Get user presence
     */
    getUserPresence(userId) {
        const presence = this.globalPresence.get(userId);
        return presence ? presence.toJSON(true) : null;
    }

    /**
     * Get all active users
     */
    getActiveUsers() {
        return Array.from(this.globalPresence.values())
            .filter(presence => !presence.isExpired(this.options.presenceTimeout))
            .map(presence => presence.toJSON());
    }

    /**
     * Get active documents
     */
    getActiveDocuments() {
        return Array.from(this.documentPresence.values())
            .filter(docPresence => docPresence.metrics.activeUsers > 0)
            .map(docPresence => docPresence.getSummary());
    }

    /**
     * Get system status
     */
    getStatus() {
        this._updateMetrics();
        
        return {
            isRunning: this.isRunning,
            metrics: { ...this.metrics },
            options: { ...this.options }
        };
    }

    /**
     * Private methods
     */

    /**
     * Remove user from all documents
     */
    _removeFromAllDocuments(userId) {
        for (const [documentId, docPresence] of this.documentPresence) {
            if (docPresence.users.has(userId)) {
                this.leaveDocument(userId, documentId);
            }
        }
    }

    /**
     * Update system metrics
     */
    _updateMetrics() {
        this.metrics.activeUsers = Array.from(this.globalPresence.values())
            .filter(presence => !presence.isExpired(this.options.presenceTimeout)).length;
        
        this.metrics.activeDocuments = Array.from(this.documentPresence.values())
            .filter(docPresence => docPresence.metrics.activeUsers > 0).length;
        
        this.metrics.totalActivities = Array.from(this.documentPresence.values())
            .reduce((total, docPresence) => total + docPresence.activities.length, 0);
    }

    /**
     * Start cleanup timer
     */
    _startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this._performCleanup();
        }, this.options.cleanupInterval);
    }

    /**
     * Stop cleanup timer
     */
    _stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Perform cleanup of expired presence
     */
    _performCleanup() {
        OpenTelemetryTracing.traceOperation(
            'presence_awareness.cleanup',
            () => {
                const expiredUsers = [];
                
                // Find expired users
                for (const [userId, presence] of this.globalPresence) {
                    if (presence.isExpired(this.options.presenceTimeout)) {
                        expiredUsers.push(userId);
                    }
                }

                // Remove expired users
                for (const userId of expiredUsers) {
                    const presence = this.globalPresence.get(userId);
                    if (presence) {
                        // Close all connections
                        for (const connectionId of presence.connections) {
                            this.connectionMapping.delete(connectionId);
                        }
                        
                        // Remove from documents
                        this._removeFromAllDocuments(userId);
                        
                        // Remove global presence
                        this.globalPresence.delete(userId);
                        this.sessionMapping.delete(presence.sessionId);
                        this.metrics.totalUsers--;

                        this.emit('presence_expired', { userId });
                    }
                }

                // Clean up empty documents
                const emptyDocuments = [];
                for (const [documentId, docPresence] of this.documentPresence) {
                    if (docPresence.users.size === 0) {
                        emptyDocuments.push(documentId);
                    }
                }

                for (const documentId of emptyDocuments) {
                    this.documentPresence.delete(documentId);
                    this.metrics.totalDocuments--;
                    this.emit('document_presence_cleaned', { documentId });
                }

                if (expiredUsers.length > 0 || emptyDocuments.length > 0) {
                    this.emit('cleanup_performed', { 
                        expiredUsers: expiredUsers.length,
                        cleanedDocuments: emptyDocuments.length 
                    });
                }
            }
        );
    }

    /**
     * Clear all presence data
     */
    _clearAllPresence() {
        this.globalPresence.clear();
        this.documentPresence.clear();
        this.sessionMapping.clear();
        this.connectionMapping.clear();
        this.metrics = {
            totalUsers: 0,
            activeUsers: 0,
            totalDocuments: 0,
            activeDocuments: 0,
            totalActivities: 0
        };
    }
}

export {
    PresenceAwarenessSystem,
    DocumentPresence,
    UserPresence,
    PresenceStatus,
    ActivityType
};
