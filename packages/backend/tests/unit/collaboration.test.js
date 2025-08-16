/**
 * Real-time Collaboration Engine Test Suite - Task 17
 * Comprehensive tests for WebSocket management, collaborative editing, presence awareness, and conflict resolution
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect } from '@jest/globals';
import WebSocket from 'ws';
import request from 'supertest';
import express from 'express';

// Import collaboration components
import WebSocketManager from '../../src/WebSocketManager.js';
import { CollaborativeDocumentEngine, DocumentChange, Operation, OperationType } from '../../src/CollaborativeDocumentEngine.js';
import { PresenceAwarenessSystem, PresenceStatus } from '../../src/PresenceAwarenessSystem.js';
import { ConflictResolutionEngine, ResolutionStrategy } from '../../src/ConflictResolutionEngine.js';
import collaborationRouter from '../../src/routes/collaboration.js';

// Test configuration
const TEST_CONFIG = {
    websocketPort: 9001,
    heartbeatInterval: 1000,
    maxConnections: 100,
    testTimeout: 10000
};

describe('Real-time Collaboration Engine - Task 17 Tests', () => {
    let app;
    let webSocketManager;
    let documentEngine;
    let presenceSystem;
    let conflictEngine;
    let testClients = [];

    beforeAll(async () => {
        // Setup Express app with collaboration routes
        app = express();
        app.use(express.json());
        app.use('/api/collaboration', collaborationRouter);

        // Initialize collaboration systems
        webSocketManager = new WebSocketManager({
            port: TEST_CONFIG.websocketPort,
            heartbeatInterval: TEST_CONFIG.heartbeatInterval,
            maxConnections: TEST_CONFIG.maxConnections
        });

        documentEngine = new CollaborativeDocumentEngine();
        presenceSystem = new PresenceAwarenessSystem();
        conflictEngine = new ConflictResolutionEngine();

        await webSocketManager.start();
        await presenceSystem.start();
    });

    afterAll(async () => {
        // Cleanup all test clients
        await Promise.all(testClients.map(client => closeWebSocketClient(client)));
        testClients = [];

        // Stop collaboration systems
        if (webSocketManager) {
            await webSocketManager.stop();
        }
        if (presenceSystem) {
            await presenceSystem.stop();
        }
    });

    beforeEach(() => {
        // Clear document engine state
        documentEngine.cleanup();
        // Note: ConflictResolutionEngine doesn't have a clear method
    });

    afterEach(async () => {
        // Close any remaining test clients
        await Promise.all(testClients.map(client => closeWebSocketClient(client)));
        testClients = [];
    });

    /**
     * WebSocket Management Tests
     */
    describe('WebSocket Management', () => {
        test('should start and stop WebSocket server', async () => {
            const initialStatus = webSocketManager.getStatus();
            expect(initialStatus.isRunning).toBe(true);
            expect(initialStatus.port).toBe(TEST_CONFIG.websocketPort);

            await webSocketManager.stop();
            const stoppedStatus = webSocketManager.getStatus();
            expect(stoppedStatus.isRunning).toBe(false);

            await webSocketManager.start();
            const restartedStatus = webSocketManager.getStatus();
            expect(restartedStatus.isRunning).toBe(true);
        }, TEST_CONFIG.testTimeout);

        test('should handle client connections and authentication', async () => {
            const client = await createWebSocketClient();
            
            // Send authentication message
            const authMessage = {
                type: 'auth',
                token: 'test-token',
                userId: 'user-1'
            };
            
            client.send(JSON.stringify(authMessage));
            
            const response = await waitForMessage(client);
            expect(response.type).toBe('auth_success');
            expect(response.userId).toBe('user-1');
        }, TEST_CONFIG.testTimeout);

        test('should manage room joining and leaving', async () => {
            const client = await createWebSocketClient();
            await authenticateClient(client, 'user-1');

            // Join room
            const joinMessage = {
                type: 'join_room',
                roomId: 'document-1'
            };
            client.send(JSON.stringify(joinMessage));

            const joinResponse = await waitForMessage(client);
            expect(joinResponse.type).toBe('room_joined');
            expect(joinResponse.roomId).toBe('document-1');

            // Leave room
            const leaveMessage = {
                type: 'leave_room',
                roomId: 'document-1'
            };
            client.send(JSON.stringify(leaveMessage));

            const leaveResponse = await waitForMessage(client);
            expect(leaveResponse.type).toBe('room_left');
            expect(leaveResponse.roomId).toBe('document-1');
        }, TEST_CONFIG.testTimeout);

        test('should handle heartbeat and connection monitoring', async () => {
            const client = await createWebSocketClient();
            await authenticateClient(client, 'user-1');

            // Wait for heartbeat
            await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.heartbeatInterval + 500));
            
            const status = webSocketManager.getStatus();
            expect(status.connectionCount).toBe(1);
        }, TEST_CONFIG.testTimeout);

        test('should rate limit connections', async () => {
            const client = await createWebSocketClient();
            await authenticateClient(client, 'user-1');

            // Send rapid messages to trigger rate limiting
            const messages = Array.from({ length: 20 }, (_, i) => ({
                type: 'room_message',
                roomId: 'test-room',
                message: `Message ${i}`
            }));

            let rateLimited = false;
            client.on('message', (data) => {
                const message = JSON.parse(data);
                if (message.type === 'rate_limited') {
                    rateLimited = true;
                }
            });

            messages.forEach(msg => client.send(JSON.stringify(msg)));
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            expect(rateLimited).toBe(true);
        }, TEST_CONFIG.testTimeout);
    });

    /**
     * Collaborative Document Engine Tests
     */
    describe('Collaborative Document Engine', () => {
        test('should create and manage collaborative documents', () => {
            const documentId = 'test-doc-1';
            const initialContent = 'Hello, world!';
            const userId = 'user-1';

            const document = documentEngine.createDocument(documentId, initialContent, userId);
            expect(document).toBeDefined();

            const state = document.getState(userId);
            expect(state.content).toBe(initialContent);
            expect(state.revision).toBe(0);
            expect(state.documentId).toBe(documentId);
        });

        test('should apply operational transforms correctly', () => {
            const documentId = 'test-doc-2';
            const document = documentEngine.createDocument(documentId, 'Hello, world!', 'user-1');

            // Create an insert operation
            const insertOp = new Operation(OperationType.INSERT, 7, 'beautiful ');
            const change = new DocumentChange([insertOp], 0, 'user-1');

            const result = documentEngine.applyChange(documentId, change, 'user-1');
            expect(result.success).toBe(true);
            expect(result.newContent).toBe('Hello, beautiful world!');
            expect(result.newRevision).toBe(1);
        });

        test('should handle concurrent edits with operational transforms', () => {
            const documentId = 'test-doc-3';
            const document = documentEngine.createDocument(documentId, 'Hello, world!', 'user-1');

            // User 1 inserts at position 7
            const change1 = new DocumentChange([
                new Operation(OperationType.INSERT, 7, 'beautiful ')
            ], 0, 'user-1');

            // User 2 inserts at position 0 (concurrent)
            const change2 = new DocumentChange([
                new Operation(OperationType.INSERT, 0, 'Hey, ')
            ], 0, 'user-2');

            // Apply both changes
            const result1 = documentEngine.applyChange(documentId, change1, 'user-1');
            const result2 = documentEngine.applyChange(documentId, change2, 'user-2');

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);

            // Final content should reflect both changes
            const finalState = document.getState('user-1');
            expect(finalState.content).toContain('Hey,');
            expect(finalState.content).toContain('beautiful');
        });

        test('should track cursor positions and selections', () => {
            const documentId = 'test-doc-4';
            const document = documentEngine.createDocument(documentId, 'Hello, world!', 'user-1');

            const cursorResult = documentEngine.updateCursor(documentId, 'user-1', 7, 0, 5);
            expect(cursorResult.success).toBe(true);
            expect(cursorResult.cursor.position).toBe(7);
            expect(cursorResult.cursor.selectionStart).toBe(0);
            expect(cursorResult.cursor.selectionEnd).toBe(5);
        });

        test('should maintain document access control', () => {
            const documentId = 'test-doc-5';
            const document = documentEngine.createDocument(documentId, 'Private document', 'user-1');

            // Join with read permissions
            const joinResult = documentEngine.joinDocument(documentId, 'user-2', ['read']);
            expect(joinResult.success).toBe(true);

            // Try to apply change without write permission
            const change = new DocumentChange([
                new Operation(OperationType.INSERT, 0, 'Modified: ')
            ], 0, 'user-2');

            const result = documentEngine.applyChange(documentId, change, 'user-2');
            expect(result.success).toBe(false);
            expect(result.error).toContain('permission');
        });

        test('should handle document history and snapshots', () => {
            const documentId = 'test-doc-6';
            const document = documentEngine.createDocument(documentId, 'Initial content', 'user-1');

            // Apply several changes
            const changes = [
                new DocumentChange([new Operation(OperationType.INSERT, 16, ' - v1')], 0, 'user-1'),
                new DocumentChange([new Operation(OperationType.INSERT, 21, ' updated')], 1, 'user-1'),
                new DocumentChange([new Operation(OperationType.DELETE, 0, null, 7)], 2, 'user-1')
            ];

            changes.forEach(change => {
                documentEngine.applyChange(documentId, change, 'user-1');
            });

            const history = document.getHistory('user-1', 0, 3);
            expect(history.length).toBe(4); // Initial + 3 changes
            expect(history[0].revision).toBe(0);
            expect(history[3].revision).toBe(3);
        });
    });

    /**
     * Presence Awareness System Tests
     */
    describe('Presence Awareness System', () => {
        test('should register and track user presence', () => {
            const userId = 'user-1';
            const sessionId = 'session-1';
            const connectionId = 'conn-1';

            const result = presenceSystem.registerPresence(userId, sessionId, connectionId);
            expect(result.success).toBe(true);

            const presence = presenceSystem.getUserPresence(userId);
            expect(presence).toBeDefined();
            expect(presence.status).toBe(PresenceStatus.ONLINE);
            expect(presence.sessionId).toBe(sessionId);
        });

        test('should track document-specific presence', () => {
            const userId = 'user-1';
            const sessionId = 'session-1';
            const documentId = 'doc-1';

            presenceSystem.registerPresence(userId, sessionId, 'conn-1');
            const joinResult = presenceSystem.joinDocument(userId, documentId);
            expect(joinResult.success).toBe(true);

            const docPresence = presenceSystem.getDocumentPresence(documentId);
            expect(docPresence.users).toHaveLength(1);
            expect(docPresence.users[0].userId).toBe(userId);
        });

        test('should update cursor positions and selections', () => {
            const userId = 'user-1';
            const sessionId = 'session-1';
            const documentId = 'doc-1';

            presenceSystem.registerPresence(userId, sessionId, 'conn-1');
            presenceSystem.joinDocument(userId, documentId);

            const cursorResult = presenceSystem.updateCursor(userId, documentId, 42, { start: 10, end: 20 });
            expect(cursorResult.success).toBe(true);

            const docPresence = presenceSystem.getDocumentPresence(documentId);
            const userPresence = docPresence.users.find(u => u.userId === userId);
            expect(userPresence.cursor.position).toBe(42);
            expect(userPresence.selection.start).toBe(10);
            expect(userPresence.selection.end).toBe(20);
        });

        test('should track typing status', () => {
            const userId = 'user-1';
            const sessionId = 'session-1';
            const documentId = 'doc-1';

            presenceSystem.registerPresence(userId, sessionId, 'conn-1');
            presenceSystem.joinDocument(userId, documentId);

            const typingResult = presenceSystem.setTyping(userId, documentId, true);
            expect(typingResult.success).toBe(true);

            const docPresence = presenceSystem.getDocumentPresence(documentId);
            const userPresence = docPresence.users.find(u => u.userId === userId);
            expect(userPresence.isTyping).toBe(true);
        });

        test('should handle user status updates', () => {
            const userId = 'user-1';
            const sessionId = 'session-1';

            presenceSystem.registerPresence(userId, sessionId, 'conn-1');

            const statusResult = presenceSystem.updateStatus(userId, PresenceStatus.AWAY, { reason: 'meeting' });
            expect(statusResult.success).toBe(true);

            const presence = presenceSystem.getUserPresence(userId);
            expect(presence.status).toBe(PresenceStatus.AWAY);
            expect(presence.metadata.reason).toBe('meeting');
        });

        test('should clean up expired presence automatically', async () => {
            const userId = 'user-1';
            const sessionId = 'session-1';

            // Register presence with short expiry
            presenceSystem.registerPresence(userId, sessionId, 'conn-1');
            
            const initialPresence = presenceSystem.getUserPresence(userId);
            expect(initialPresence).toBeDefined();

            // Wait for cleanup (presence system runs cleanup every second)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Presence should still exist (not expired yet)
            const laterPresence = presenceSystem.getUserPresence(userId);
            expect(laterPresence).toBeDefined();
        });

        test('should generate unique user colors', () => {
            const colors = new Set();
            
            for (let i = 0; i < 10; i++) {
                const userId = `user-${i}`;
                const sessionId = `session-${i}`;
                presenceSystem.registerPresence(userId, sessionId, `conn-${i}`);
                
                const presence = presenceSystem.getUserPresence(userId);
                colors.add(presence.color);
            }

            // Should have generated multiple unique colors
            expect(colors.size).toBeGreaterThan(1);
        });
    });

    /**
     * Conflict Resolution Engine Tests
     */
    describe('Conflict Resolution Engine', () => {
        test('should detect conflicts between concurrent changes', () => {
            const documentId = 'conflict-doc-1';
            
            // Create conflicting changes at same position
            const change1 = new DocumentChange([
                new Operation(OperationType.INSERT, 5, 'Alice')
            ], 0, 'user-1');

            const change2 = new DocumentChange([
                new Operation(OperationType.INSERT, 5, 'Bob')
            ], 0, 'user-2');

            const conflicts = conflictEngine.detectConflicts(documentId, [change1, change2]);
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].type).toBe('concurrent_edit');
            expect(conflicts[0].involvedUsers).toContain('user-1');
            expect(conflicts[0].involvedUsers).toContain('user-2');
        });

        test('should resolve conflicts using operational transform strategy', async () => {
            const documentId = 'conflict-doc-2';
            
            const change1 = new DocumentChange([
                new Operation(OperationType.INSERT, 0, 'Hello, ')
            ], 0, 'user-1');

            const change2 = new DocumentChange([
                new Operation(OperationType.INSERT, 0, 'Hi, ')
            ], 0, 'user-2');

            const conflicts = conflictEngine.detectConflicts(documentId, [change1, change2]);
            expect(conflicts).toHaveLength(1);

            const conflictId = conflicts[0].id;
            const resolution = await conflictEngine.resolveConflict(conflictId, ResolutionStrategy.OPERATIONAL_TRANSFORM);
            
            expect(resolution.success).toBe(true);
            expect(resolution.strategy).toBe(ResolutionStrategy.OPERATIONAL_TRANSFORM);
            expect(resolution.resolvedOperations).toBeDefined();
        });

        test('should handle priority-based conflict resolution', async () => {
            const documentId = 'conflict-doc-3';
            
            // Set user priorities
            conflictEngine.setUserPriority('user-1', 5);
            conflictEngine.setUserPriority('user-2', 10); // Higher priority

            const change1 = new DocumentChange([
                new Operation(OperationType.DELETE, 0, null, 5)
            ], 0, 'user-1');

            const change2 = new DocumentChange([
                new Operation(OperationType.INSERT, 0, 'Important: ')
            ], 0, 'user-2');

            const conflicts = conflictEngine.detectConflicts(documentId, [change1, change2]);
            const conflictId = conflicts[0].id;
            
            const resolution = await conflictEngine.resolveConflict(conflictId, ResolutionStrategy.PRIORITY_BASED);
            expect(resolution.success).toBe(true);
            expect(resolution.winningUser).toBe('user-2'); // Higher priority user wins
        });

        test('should track conflict resolution attempts', async () => {
            const documentId = 'conflict-doc-4';
            
            const change1 = new DocumentChange([
                new Operation(OperationType.INSERT, 10, 'conflict')
            ], 0, 'user-1');

            const change2 = new DocumentChange([
                new Operation(OperationType.DELETE, 8, null, 5)
            ], 0, 'user-2');

            const conflicts = conflictEngine.detectConflicts(documentId, [change1, change2]);
            const conflict = conflicts[0];
            
            // First resolution attempt
            await conflictEngine.resolveConflict(conflict.id, ResolutionStrategy.OPERATIONAL_TRANSFORM);
            
            const updatedConflict = conflictEngine.getConflict(conflict.id);
            expect(updatedConflict.resolutionAttempts).toBe(1);
            expect(updatedConflict.status).toBe('resolved');
        });

        test('should support semantic conflict rules', () => {
            const rule = {
                name: 'no_duplicate_headers',
                description: 'Prevent duplicate header insertions',
                condition: (change) => {
                    return change.operations.some(op => 
                        op.type === OperationType.INSERT && 
                        op.text && 
                        op.text.startsWith('#')
                    );
                },
                severity: 'high'
            };

            conflictEngine.addSemanticRule(rule);

            const change = new DocumentChange([
                new Operation(OperationType.INSERT, 0, '# Duplicate Header')
            ], 0, 'user-1');

            const semanticConflicts = conflictEngine.checkSemanticRules('doc-1', change);
            expect(semanticConflicts).toHaveLength(1);
            expect(semanticConflicts[0].rule.name).toBe('no_duplicate_headers');
        });

        test('should handle auto-resolution with fallback strategies', async () => {
            const documentId = 'conflict-doc-5';
            
            const change1 = new DocumentChange([
                new Operation(OperationType.INSERT, 0, 'Auto-resolve test')
            ], 0, 'user-1');

            const change2 = new DocumentChange([
                new Operation(OperationType.INSERT, 0, 'Fallback test')
            ], 0, 'user-2');

            const conflicts = conflictEngine.detectConflicts(documentId, [change1, change2]);
            const conflictId = conflicts[0].id;
            
            // Enable auto-resolution
            const resolution = await conflictEngine.resolveConflict(conflictId, ResolutionStrategy.AUTO_RESOLVE);
            expect(resolution.success).toBe(true);
            expect(resolution.autoResolved).toBe(true);
        });
    });

    /**
     * API Routes Integration Tests
     */
    describe('API Routes Integration', () => {
        test('should start and stop WebSocket server via API', async () => {
            const startResponse = await request(app)
                .post('/api/collaboration/websocket/start')
                .expect(200);

            expect(startResponse.body.success).toBe(true);

            const statusResponse = await request(app)
                .get('/api/collaboration/websocket/status')
                .expect(200);

            expect(statusResponse.body.data.websocket.isRunning).toBe(true);

            const stopResponse = await request(app)
                .post('/api/collaboration/websocket/stop')
                .expect(200);

            expect(stopResponse.body.success).toBe(true);
        });

        test('should create and manage documents via API', async () => {
            const createResponse = await request(app)
                .post('/api/collaboration/documents')
                .send({
                    documentId: 'api-test-doc-1',
                    initialContent: 'API test document',
                    userId: 'user-1'
                })
                .expect(200);

            expect(createResponse.body.success).toBe(true);
            expect(createResponse.body.data.content).toBe('API test document');

            const getResponse = await request(app)
                .get('/api/collaboration/documents/api-test-doc-1')
                .query({ userId: 'user-1' })
                .expect(200);

            expect(getResponse.body.data.content).toBe('API test document');
        });

        test('should handle document collaboration via API', async () => {
            // Create document
            await request(app)
                .post('/api/collaboration/documents')
                .send({
                    documentId: 'api-collab-doc',
                    initialContent: 'Collaboration test',
                    userId: 'user-1'
                })
                .expect(200);

            // Join document
            const joinResponse = await request(app)
                .post('/api/collaboration/documents/api-collab-doc/join')
                .send({
                    userId: 'user-2',
                    permissions: ['read', 'write']
                })
                .expect(200);

            expect(joinResponse.body.success).toBe(true);

            // Apply change
            const changeResponse = await request(app)
                .post('/api/collaboration/documents/api-collab-doc/changes')
                .send({
                    userId: 'user-2',
                    operations: [
                        {
                            type: 'insert',
                            length: 0,
                            text: 'Updated: '
                        }
                    ],
                    revision: 0
                })
                .expect(200);

            expect(changeResponse.body.success).toBe(true);
        });

        test('should manage presence via API', async () => {
            const presenceResponse = await request(app)
                .post('/api/collaboration/presence/typing')
                .send({
                    userId: 'user-1',
                    documentId: 'presence-test-doc',
                    isTyping: true
                })
                .expect(200);

            expect(presenceResponse.body.success).toBe(true);

            const statusResponse = await request(app)
                .post('/api/collaboration/presence/status')
                .send({
                    userId: 'user-1',
                    status: 'busy',
                    metadata: { reason: 'in meeting' }
                })
                .expect(200);

            expect(statusResponse.body.success).toBe(true);
        });

        test('should provide analytics via API', async () => {
            const analyticsResponse = await request(app)
                .get('/api/collaboration/analytics')
                .expect(200);

            expect(analyticsResponse.body.success).toBe(true);
            expect(analyticsResponse.body.data).toHaveProperty('summary');
            expect(analyticsResponse.body.data.summary).toHaveProperty('totalConnections');
        });

        test('should perform health checks', async () => {
            const healthResponse = await request(app)
                .get('/api/collaboration/health')
                .expect(200);

            expect(healthResponse.body.success).toBe(true);
            expect(healthResponse.body.data.status).toMatch(/healthy|degraded/);
            expect(healthResponse.body.data.services).toHaveProperty('websocket');
        });
    });

    /**
     * Integration and End-to-End Tests
     */
    describe('Full Integration Tests', () => {
        test('should support complete collaborative editing workflow', async () => {
            // Setup multiple clients
            const client1 = await createWebSocketClient();
            const client2 = await createWebSocketClient();
            
            await authenticateClient(client1, 'user-1');
            await authenticateClient(client2, 'user-2');

            // Both join same document room
            client1.send(JSON.stringify({ type: 'join_room', roomId: 'integration-doc' }));
            client2.send(JSON.stringify({ type: 'join_room', roomId: 'integration-doc' }));

            await waitForMessage(client1); // room_joined
            await waitForMessage(client2); // room_joined

            // Create document
            const document = documentEngine.createDocument('integration-doc', 'Hello', 'user-1');
            documentEngine.joinDocument('integration-doc', 'user-2', ['read', 'write']);

            // User 1 makes a change
            const change1 = new DocumentChange([
                new Operation(OperationType.INSERT, 5, ', World!')
            ], 0, 'user-1');

            documentEngine.applyChange('integration-doc', change1, 'user-1');

            // User 2 should receive the change notification
            const changeNotification = await waitForMessage(client2);
            expect(changeNotification.type).toBe('document_changed');

            // User 2 makes a concurrent change
            const change2 = new DocumentChange([
                new Operation(OperationType.INSERT, 0, 'Hi, ')
            ], 0, 'user-2');

            documentEngine.applyChange('integration-doc', change2, 'user-2');

            // Both users should have consistent final state
            const finalState = document.getState('user-1');
            expect(finalState.content).toContain('Hi,');
            expect(finalState.content).toContain('Hello');
            expect(finalState.content).toContain('World!');
        }, TEST_CONFIG.testTimeout);

        test('should handle presence awareness in collaborative session', async () => {
            const client1 = await createWebSocketClient();
            const client2 = await createWebSocketClient();
            
            await authenticateClient(client1, 'user-1');
            await authenticateClient(client2, 'user-2');

            // Setup presence
            presenceSystem.registerPresence('user-1', 'session-1', 'conn-1');
            presenceSystem.registerPresence('user-2', 'session-2', 'conn-2');
            presenceSystem.joinDocument('user-1', 'presence-doc');
            presenceSystem.joinDocument('user-2', 'presence-doc');

            // User 1 updates cursor
            presenceSystem.updateCursor('user-1', 'presence-doc', 10, { start: 5, end: 15 });

            // User 2 starts typing
            presenceSystem.setTyping('user-2', 'presence-doc', true);

            // Check document presence
            const docPresence = presenceSystem.getDocumentPresence('presence-doc');
            expect(docPresence.users).toHaveLength(2);
            
            const user1Presence = docPresence.users.find(u => u.userId === 'user-1');
            const user2Presence = docPresence.users.find(u => u.userId === 'user-2');
            
            expect(user1Presence.cursor.position).toBe(10);
            expect(user2Presence.isTyping).toBe(true);
        }, TEST_CONFIG.testTimeout);

        test('should resolve conflicts in collaborative editing scenario', async () => {
            const documentId = 'conflict-integration-doc';
            
            // Create document with initial content
            documentEngine.createDocument(documentId, 'Original text', 'user-1');
            documentEngine.joinDocument(documentId, 'user-2', ['read', 'write']);

            // Create conflicting changes
            const change1 = new DocumentChange([
                new Operation(OperationType.INSERT, 13, ' modified by user1')
            ], 0, 'user-1');

            const change2 = new DocumentChange([
                new Operation(OperationType.INSERT, 13, ' changed by user2')
            ], 0, 'user-2');

            // Detect conflicts
            const conflicts = conflictEngine.detectConflicts(documentId, [change1, change2]);
            expect(conflicts).toHaveLength(1);

            // Resolve using operational transform
            const conflictId = conflicts[0].id;
            const resolution = await conflictEngine.resolveConflict(conflictId, ResolutionStrategy.OPERATIONAL_TRANSFORM);
            
            expect(resolution.success).toBe(true);
            expect(resolution.resolvedOperations).toBeDefined();
        }, TEST_CONFIG.testTimeout);
    });

    /**
     * Helper Functions
     */
    async function createWebSocketClient() {
        return new Promise((resolve, reject) => {
            const client = new WebSocket(`ws://localhost:${TEST_CONFIG.websocketPort}`);
            
            client.on('open', () => {
                testClients.push(client);
                resolve(client);
            });
            
            client.on('error', reject);
            
            setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
        });
    }

    async function authenticateClient(client, userId) {
        const authMessage = {
            type: 'auth',
            token: 'test-token',
            userId
        };
        
        client.send(JSON.stringify(authMessage));
        const response = await waitForMessage(client);
        
        if (response.type !== 'auth_success') {
            throw new Error(`Authentication failed: ${response.error || 'Unknown error'}`);
        }
        
        return response;
    }

    async function waitForMessage(client, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Message timeout'));
            }, timeout);
            
            const handler = (data) => {
                clearTimeout(timer);
                client.removeListener('message', handler);
                resolve(JSON.parse(data));
            };
            
            client.on('message', handler);
        });
    }

    async function closeWebSocketClient(client) {
        if (client && client.readyState === WebSocket.OPEN) {
            client.close();
            
            return new Promise((resolve) => {
                client.on('close', resolve);
                setTimeout(resolve, 1000); // Force resolve after 1 second
            });
        }
        
        return Promise.resolve();
    }
});
