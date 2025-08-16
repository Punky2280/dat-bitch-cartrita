/**
 * Real-time Collaboration API Routes - Task 17: Real-time Collaboration Engine
 * Express routes for WebSocket management, collaborative editing, and presence awareness
 * 
 * Routes:
 * - WebSocket server management
 * - Document collaboration sessions
 * - Real-time presence tracking
 * - Conflict resolution controls
 * - Collaboration analytics
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

// Import collaboration services
import WebSocketManager from '../WebSocketManager.js';
import { CollaborativeDocumentEngine, DocumentChange, Operation, OperationType } from '../CollaborativeDocumentEngine.js';
import { PresenceAwarenessSystem, PresenceStatus } from '../PresenceAwarenessSystem.js';
import { ConflictResolutionEngine, ResolutionStrategy } from '../ConflictResolutionEngine.js';

const router = express.Router();

// Global collaboration instances
let webSocketManager = null;
let documentEngine = null;
let presenceSystem = null;
let conflictEngine = null;

// Initialize collaboration systems
function initializeCollaborationSystems() {
    if (!webSocketManager) {
        webSocketManager = new WebSocketManager({
            port: process.env.WEBSOCKET_PORT || 8080,
            heartbeatInterval: 30000,
            maxConnections: 1000
        });

        documentEngine = new CollaborativeDocumentEngine();
        presenceSystem = new PresenceAwarenessSystem();
        conflictEngine = new ConflictResolutionEngine();

        // Set up event forwarding between systems
        setupSystemIntegration();
    }
}

// Set up integration between collaboration systems
function setupSystemIntegration() {
    // WebSocket to Presence integration
    webSocketManager.on('user_authenticated', ({ connectionId, userId }) => {
        const sessionId = uuidv4();
        presenceSystem.registerPresence(userId, sessionId, connectionId);
    });

    webSocketManager.on('disconnection', ({ connectionId }) => {
        presenceSystem.unregisterPresence(connectionId);
    });

    webSocketManager.on('room_joined', ({ connectionId, roomId, userId }) => {
        presenceSystem.joinDocument(userId, roomId);
    });

    webSocketManager.on('room_left', ({ connectionId, roomId, userId }) => {
        presenceSystem.leaveDocument(userId, roomId);
    });

    // Document to WebSocket integration
    documentEngine.on('change_applied', (data) => {
        webSocketManager.sendToRoom(data.documentId, {
            type: 'document_changed',
            ...data
        });
    });

    documentEngine.on('cursor_updated', (data) => {
        webSocketManager.sendToRoom(data.documentId, {
            type: 'cursor_updated',
            ...data
        });
    });

    // Presence to WebSocket integration
    presenceSystem.on('cursor_updated', (data) => {
        webSocketManager.sendToRoom(data.documentId, {
            type: 'presence_cursor_updated',
            ...data
        });
    });

    presenceSystem.on('typing_status_changed', (data) => {
        webSocketManager.sendToRoom(data.documentId, {
            type: 'typing_status_changed',
            ...data
        });
    });

    // Conflict to WebSocket integration
    conflictEngine.on('conflict_detected', (conflictSummary) => {
        const documentId = conflictSummary.metadata?.documentId;
        if (documentId) {
            webSocketManager.sendToRoom(documentId, {
                type: 'conflict_detected',
                conflict: conflictSummary
            });
        }
    });

    conflictEngine.on('conflict_resolved', (data) => {
        const conflict = conflictEngine.getConflict(data.conflictId);
        const documentId = conflict?.metadata?.documentId;
        if (documentId) {
            webSocketManager.sendToRoom(documentId, {
                type: 'conflict_resolved',
                ...data
            });
        }
    });
}

/**
 * WebSocket Server Management Routes
 */

// Start WebSocket server
router.post('/websocket/start', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.start_websocket', async () => {
            initializeCollaborationSystems();
            
            const result = await webSocketManager.start();
            await presenceSystem.start();
            
            res.json({
                success: true,
                data: result,
                message: 'Collaboration systems started successfully'
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop WebSocket server
router.post('/websocket/stop', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.stop_websocket', async () => {
            if (webSocketManager) {
                await webSocketManager.stop();
                await presenceSystem.stop();
            }
            
            res.json({
                success: true,
                message: 'Collaboration systems stopped successfully'
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get WebSocket server status
router.get('/websocket/status', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const status = {
            websocket: webSocketManager.getStatus(),
            presence: presenceSystem.getStatus(),
            documents: documentEngine.getStatus(),
            conflicts: conflictEngine.getStatus()
        };

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Document Collaboration Routes
 */

// Create a new collaborative document
router.post('/documents', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.create_document', async () => {
            initializeCollaborationSystems();
            
            const { documentId, initialContent = '', userId } = req.body;
            
            if (!documentId) {
                return res.status(400).json({
                    success: false,
                    error: 'Document ID is required'
                });
            }

            const document = documentEngine.createDocument(documentId, initialContent, userId);
            const state = document.getState(userId);

            res.json({
                success: true,
                data: state
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get document state
router.get('/documents/:documentId', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const { documentId } = req.params;
        const { userId } = req.query;
        
        const document = documentEngine.getDocument(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const state = document.getState(userId);
        
        res.json({
            success: true,
            data: state
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Join document collaboration
router.post('/documents/:documentId/join', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.join_document', async () => {
            initializeCollaborationSystems();
            
            const { documentId } = req.params;
            const { userId, permissions = ['read'] } = req.body;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
            }

            const result = documentEngine.joinDocument(documentId, userId, permissions);
            
            res.json({
                success: true,
                data: result
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Leave document collaboration
router.post('/documents/:documentId/leave', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.leave_document', async () => {
            initializeCollaborationSystems();
            
            const { documentId } = req.params;
            const { userId } = req.body;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
            }

            const result = documentEngine.leaveDocument(documentId, userId);
            
            res.json({
                success: true,
                data: result
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Apply document change
router.post('/documents/:documentId/changes', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.apply_change', async () => {
            initializeCollaborationSystems();
            
            const { documentId } = req.params;
            const { userId, operations, revision } = req.body;
            
            if (!userId || !operations) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID and operations are required'
                });
            }

            // Convert operations to proper format
            const documentOperations = operations.map(op => 
                new Operation(op.type, op.length, op.text || null)
            );

            const change = new DocumentChange(documentOperations, revision, userId);
            
            // Detect conflicts before applying
            const conflicts = conflictEngine.detectConflicts(documentId, [change]);
            
            const result = documentEngine.applyChange(documentId, change, userId);
            
            res.json({
                success: true,
                data: {
                    ...result,
                    conflicts
                }
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get document change history
router.get('/documents/:documentId/history', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const { documentId } = req.params;
        const { userId, startRevision = 0, endRevision } = req.query;
        
        const document = documentEngine.getDocument(documentId);
        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const history = document.getHistory(
            userId, 
            parseInt(startRevision), 
            endRevision ? parseInt(endRevision) : null
        );
        
        res.json({
            success: true,
            data: { history }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update cursor position
router.post('/documents/:documentId/cursor', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.update_cursor', async () => {
            initializeCollaborationSystems();
            
            const { documentId } = req.params;
            const { userId, position, selectionStart, selectionEnd } = req.body;
            
            if (!userId || position === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID and position are required'
                });
            }

            // Update in document engine
            const docResult = documentEngine.updateCursor(documentId, userId, position, selectionStart, selectionEnd);
            
            // Update in presence system
            const presenceResult = presenceSystem.updateCursor(userId, documentId, position, { start: selectionStart, end: selectionEnd });
            
            res.json({
                success: true,
                data: {
                    document: docResult,
                    presence: presenceResult
                }
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Presence Awareness Routes
 */

// Get document presence
router.get('/presence/documents/:documentId', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const { documentId } = req.params;
        
        const presence = presenceSystem.getDocumentPresence(documentId);
        
        res.json({
            success: true,
            data: presence
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user presence
router.get('/presence/users/:userId', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const { userId } = req.params;
        
        const presence = presenceSystem.getUserPresence(userId);
        
        res.json({
            success: true,
            data: presence
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Set typing status
router.post('/presence/typing', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.set_typing', async () => {
            initializeCollaborationSystems();
            
            const { userId, documentId, isTyping } = req.body;
            
            if (!userId || !documentId || isTyping === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID, document ID, and typing status are required'
                });
            }

            const result = presenceSystem.setTyping(userId, documentId, isTyping);
            
            res.json({
                success: true,
                data: result
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update user status
router.post('/presence/status', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.update_status', async () => {
            initializeCollaborationSystems();
            
            const { userId, status, metadata = {} } = req.body;
            
            if (!userId || !status) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID and status are required'
                });
            }

            const result = presenceSystem.updateStatus(userId, status, metadata);
            
            res.json({
                success: true,
                data: result
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get active users
router.get('/presence/users', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const activeUsers = presenceSystem.getActiveUsers();
        
        res.json({
            success: true,
            data: { users: activeUsers }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get active documents
router.get('/presence/documents', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const activeDocuments = presenceSystem.getActiveDocuments();
        
        res.json({
            success: true,
            data: { documents: activeDocuments }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Conflict Resolution Routes
 */

// Get document conflicts
router.get('/conflicts/documents/:documentId', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const { documentId } = req.params;
        
        const conflicts = conflictEngine.getDocumentConflicts(documentId);
        
        res.json({
            success: true,
            data: { conflicts }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific conflict
router.get('/conflicts/:conflictId', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const { conflictId } = req.params;
        
        const conflict = conflictEngine.getConflict(conflictId);
        if (!conflict) {
            return res.status(404).json({
                success: false,
                error: 'Conflict not found'
            });
        }
        
        res.json({
            success: true,
            data: conflict
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Resolve conflict
router.post('/conflicts/:conflictId/resolve', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.resolve_conflict', async () => {
            initializeCollaborationSystems();
            
            const { conflictId } = req.params;
            const { strategy = ResolutionStrategy.OPERATIONAL_TRANSFORM, userId } = req.body;
            
            const result = await conflictEngine.resolveConflict(conflictId, strategy);
            
            res.json({
                success: true,
                data: result
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Set user priority for conflict resolution
router.post('/conflicts/priorities', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.set_priority', async () => {
            initializeCollaborationSystems();
            
            const { userId, priority } = req.body;
            
            if (!userId || priority === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID and priority are required'
                });
            }

            conflictEngine.setUserPriority(userId, priority);
            
            res.json({
                success: true,
                message: 'User priority set successfully'
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Analytics and Monitoring Routes
 */

// Get collaboration analytics
router.get('/analytics', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const analytics = {
            websocket: webSocketManager.getStatus(),
            documents: documentEngine.getStatus(),
            presence: presenceSystem.getStatus(),
            conflicts: conflictEngine.getStatus(),
            summary: {
                totalConnections: webSocketManager.getStatus().connectionCount,
                activeDocuments: documentEngine.getStatus().metrics.activeDocuments,
                activeUsers: presenceSystem.getStatus().metrics.activeUsers,
                totalConflicts: conflictEngine.getStatus().metrics.totalConflicts,
                resolvedConflicts: conflictEngine.getStatus().metrics.resolvedConflicts
            }
        };
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get room information
router.get('/rooms/:roomId', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const { roomId } = req.params;
        
        const roomInfo = webSocketManager.getRoomInfo(roomId);
        const documentPresence = presenceSystem.getDocumentPresence(roomId);
        
        res.json({
            success: true,
            data: {
                room: roomInfo,
                presence: documentPresence
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user's documents
router.get('/users/:userId/documents', (req, res) => {
    try {
        initializeCollaborationSystems();
        
        const { userId } = req.params;
        
        const userDocuments = documentEngine.getUserDocuments(userId);
        const userPresence = presenceSystem.getUserPresence(userId);
        
        res.json({
            success: true,
            data: {
                documents: userDocuments,
                presence: userPresence
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Cleanup inactive sessions
router.post('/cleanup', async (req, res) => {
    try {
        await OpenTelemetryTracing.traceOperation('collaboration_api.cleanup', async () => {
            initializeCollaborationSystems();
            
            const docCleanup = documentEngine.cleanup();
            // presenceSystem cleanup is automatic
            
            res.json({
                success: true,
                data: docCleanup
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
router.get('/health', (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                websocket: webSocketManager ? webSocketManager.getStatus().isRunning : false,
                documents: documentEngine ? true : false,
                presence: presenceSystem ? presenceSystem.getStatus().isRunning : false,
                conflicts: conflictEngine ? true : false
            }
        };

        const allHealthy = Object.values(health.services).every(status => status === true);
        health.status = allHealthy ? 'healthy' : 'degraded';

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
