/**
 * Collaborative Document Engine - Task 17: Real-time Collaboration Engine
 * Implements operational transforms for real-time collaborative editing
 * 
 * Features:
 * - Operational Transform (OT) conflict resolution
 * - Document versioning and state synchronization
 * - Multi-user cursor and selection tracking
 * - Real-time change broadcasting
 * - Document locking and access control
 * - Change history and undo/redo support
 * - Persistence and recovery mechanisms
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

/**
 * Operation types for Operational Transform
 */
const OperationType = {
    INSERT: 'insert',
    DELETE: 'delete',
    RETAIN: 'retain'
};

/**
 * Individual operation within a document change
 */
class Operation {
    constructor(type, length, text = null) {
        this.type = type;
        this.length = length;
        this.text = text;
    }

    /**
     * Create an insert operation
     */
    static insert(text) {
        return new Operation(OperationType.INSERT, text.length, text);
    }

    /**
     * Create a delete operation
     */
    static delete(length) {
        return new Operation(OperationType.DELETE, length);
    }

    /**
     * Create a retain operation
     */
    static retain(length) {
        return new Operation(OperationType.RETAIN, length);
    }

    /**
     * Convert operation to JSON
     */
    toJSON() {
        const json = { type: this.type, length: this.length };
        if (this.text !== null) {
            json.text = this.text;
        }
        return json;
    }

    /**
     * Create operation from JSON
     */
    static fromJSON(json) {
        return new Operation(json.type, json.length, json.text || null);
    }
}

/**
 * Document Change - represents a set of operations applied to a document
 */
class DocumentChange {
    constructor(operations = [], revision = 0, authorId = null) {
        this.operations = operations;
        this.revision = revision;
        this.authorId = authorId;
        this.timestamp = new Date().toISOString();
        this.id = uuidv4();
    }

    /**
     * Apply this change to a document
     */
    applyToDocument(document) {
        let result = '';
        let docIndex = 0;
        let opIndex = 0;

        for (const operation of this.operations) {
            switch (operation.type) {
                case OperationType.RETAIN:
                    result += document.substring(docIndex, docIndex + operation.length);
                    docIndex += operation.length;
                    break;
                
                case OperationType.INSERT:
                    result += operation.text;
                    break;
                
                case OperationType.DELETE:
                    docIndex += operation.length;
                    break;
            }
        }

        // Add any remaining document content
        result += document.substring(docIndex);
        
        return result;
    }

    /**
     * Get the length of content this change operates on
     */
    getBaseLength() {
        return this.operations.reduce((length, op) => {
            return length + (op.type === OperationType.DELETE || op.type === OperationType.RETAIN ? op.length : 0);
        }, 0);
    }

    /**
     * Get the length of content after applying this change
     */
    getTargetLength() {
        return this.operations.reduce((length, op) => {
            return length + (op.type === OperationType.INSERT || op.type === OperationType.RETAIN ? op.length : 0);
        }, 0);
    }

    /**
     * Transform this change against another change (operational transform)
     */
    transform(otherChange, priority = 'left') {
        const transformed = new DocumentChange([], this.revision, this.authorId);
        const otherOps = [...otherChange.operations];
        const thisOps = [...this.operations];
        
        let i = 0, j = 0;
        let offsetA = 0, offsetB = 0;

        while (i < thisOps.length || j < otherOps.length) {
            if (i >= thisOps.length) {
                // No more operations in this change
                break;
            }
            
            if (j >= otherOps.length) {
                // No more operations in other change, copy remaining
                transformed.operations.push(...thisOps.slice(i));
                break;
            }

            const opA = thisOps[i];
            const opB = otherOps[j];

            if (opA.type === OperationType.INSERT) {
                // Insert always goes through
                transformed.operations.push(Operation.insert(opA.text));
                i++;
            } else if (opB.type === OperationType.INSERT) {
                // Other insert, we need to retain over it
                transformed.operations.push(Operation.retain(opB.length));
                j++;
            } else if (opA.type === OperationType.RETAIN && opB.type === OperationType.RETAIN) {
                // Both retain, take the minimum
                const minLength = Math.min(opA.length, opB.length);
                transformed.operations.push(Operation.retain(minLength));
                
                if (opA.length > minLength) {
                    thisOps[i] = Operation.retain(opA.length - minLength);
                } else {
                    i++;
                }
                
                if (opB.length > minLength) {
                    otherOps[j] = Operation.retain(opB.length - minLength);
                } else {
                    j++;
                }
            } else if (opA.type === OperationType.DELETE && opB.type === OperationType.DELETE) {
                // Both delete, resolve by taking minimum
                const minLength = Math.min(opA.length, opB.length);
                
                if (opA.length > minLength) {
                    thisOps[i] = Operation.delete(opA.length - minLength);
                } else {
                    i++;
                }
                
                if (opB.length > minLength) {
                    otherOps[j] = Operation.delete(opB.length - minLength);
                } else {
                    j++;
                }
            } else if (opA.type === OperationType.DELETE && opB.type === OperationType.RETAIN) {
                // We delete, they retain
                const minLength = Math.min(opA.length, opB.length);
                transformed.operations.push(Operation.delete(minLength));
                
                if (opA.length > minLength) {
                    thisOps[i] = Operation.delete(opA.length - minLength);
                } else {
                    i++;
                }
                
                if (opB.length > minLength) {
                    otherOps[j] = Operation.retain(opB.length - minLength);
                } else {
                    j++;
                }
            } else if (opA.type === OperationType.RETAIN && opB.type === OperationType.DELETE) {
                // We retain, they delete - skip the deleted portion
                const minLength = Math.min(opA.length, opB.length);
                
                if (opA.length > minLength) {
                    thisOps[i] = Operation.retain(opA.length - minLength);
                } else {
                    i++;
                }
                
                if (opB.length > minLength) {
                    otherOps[j] = Operation.delete(opB.length - minLength);
                } else {
                    j++;
                }
            }
        }

        return transformed;
    }

    /**
     * Compose this change with another change
     */
    compose(otherChange) {
        const composed = new DocumentChange([], Math.max(this.revision, otherChange.revision), this.authorId);
        const opsA = [...this.operations];
        const opsB = [...otherChange.operations];
        
        let i = 0, j = 0;

        while (i < opsA.length || j < opsB.length) {
            if (i >= opsA.length) {
                composed.operations.push(...opsB.slice(j));
                break;
            }
            
            if (j >= opsB.length) {
                composed.operations.push(...opsA.slice(i));
                break;
            }

            const opA = opsA[i];
            const opB = opsB[j];

            if (opA.type === OperationType.DELETE) {
                composed.operations.push(opA);
                i++;
            } else if (opB.type === OperationType.INSERT) {
                composed.operations.push(opB);
                j++;
            } else if (opA.type === OperationType.RETAIN && opB.type === OperationType.RETAIN) {
                const minLength = Math.min(opA.length, opB.length);
                composed.operations.push(Operation.retain(minLength));
                
                if (opA.length > minLength) {
                    opsA[i] = Operation.retain(opA.length - minLength);
                } else {
                    i++;
                }
                
                if (opB.length > minLength) {
                    opsB[j] = Operation.retain(opB.length - minLength);
                } else {
                    j++;
                }
            } else if (opA.type === OperationType.INSERT && opB.type === OperationType.DELETE) {
                // Insert then delete - they cancel out
                const minLength = Math.min(opA.length, opB.length);
                
                if (opA.length > minLength) {
                    opsA[i] = Operation.insert(opA.text.substring(minLength));
                } else {
                    i++;
                }
                
                if (opB.length > minLength) {
                    opsB[j] = Operation.delete(opB.length - minLength);
                } else {
                    j++;
                }
            } else if (opA.type === OperationType.INSERT && opB.type === OperationType.RETAIN) {
                const minLength = Math.min(opA.length, opB.length);
                composed.operations.push(Operation.insert(opA.text.substring(0, minLength)));
                
                if (opA.length > minLength) {
                    opsA[i] = Operation.insert(opA.text.substring(minLength));
                } else {
                    i++;
                }
                
                if (opB.length > minLength) {
                    opsB[j] = Operation.retain(opB.length - minLength);
                } else {
                    j++;
                }
            } else if (opA.type === OperationType.RETAIN && opB.type === OperationType.DELETE) {
                const minLength = Math.min(opA.length, opB.length);
                composed.operations.push(Operation.delete(minLength));
                
                if (opA.length > minLength) {
                    opsA[i] = Operation.retain(opA.length - minLength);
                } else {
                    i++;
                }
                
                if (opB.length > minLength) {
                    opsB[j] = Operation.delete(opB.length - minLength);
                } else {
                    j++;
                }
            }
        }

        return composed;
    }

    /**
     * Convert to JSON
     */
    toJSON() {
        return {
            id: this.id,
            operations: this.operations.map(op => op.toJSON()),
            revision: this.revision,
            authorId: this.authorId,
            timestamp: this.timestamp
        };
    }

    /**
     * Create from JSON
     */
    static fromJSON(json) {
        const change = new DocumentChange(
            json.operations.map(op => Operation.fromJSON(op)),
            json.revision,
            json.authorId
        );
        change.id = json.id;
        change.timestamp = json.timestamp;
        return change;
    }
}

/**
 * User Cursor/Selection tracking
 */
class UserCursor {
    constructor(userId, position, selectionStart = null, selectionEnd = null) {
        this.userId = userId;
        this.position = position;
        this.selectionStart = selectionStart;
        this.selectionEnd = selectionEnd;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Transform cursor position based on document changes
     */
    transform(change) {
        let newPosition = this.position;
        let newSelectionStart = this.selectionStart;
        let newSelectionEnd = this.selectionEnd;
        
        let offset = 0;
        
        for (const operation of change.operations) {
            switch (operation.type) {
                case OperationType.RETAIN:
                    offset += operation.length;
                    break;
                    
                case OperationType.INSERT:
                    if (offset <= this.position) {
                        newPosition += operation.length;
                    }
                    if (this.selectionStart !== null && offset <= this.selectionStart) {
                        newSelectionStart += operation.length;
                    }
                    if (this.selectionEnd !== null && offset <= this.selectionEnd) {
                        newSelectionEnd += operation.length;
                    }
                    break;
                    
                case OperationType.DELETE:
                    if (offset < this.position) {
                        newPosition = Math.max(offset, this.position - operation.length);
                    }
                    if (this.selectionStart !== null && offset < this.selectionStart) {
                        newSelectionStart = Math.max(offset, this.selectionStart - operation.length);
                    }
                    if (this.selectionEnd !== null && offset < this.selectionEnd) {
                        newSelectionEnd = Math.max(offset, this.selectionEnd - operation.length);
                    }
                    break;
            }
        }

        return new UserCursor(this.userId, newPosition, newSelectionStart, newSelectionEnd);
    }

    toJSON() {
        return {
            userId: this.userId,
            position: this.position,
            selectionStart: this.selectionStart,
            selectionEnd: this.selectionEnd,
            timestamp: this.timestamp
        };
    }
}

/**
 * Collaborative Document - manages a single document's collaborative state
 */
class CollaborativeDocument extends EventEmitter {
    constructor(documentId, initialContent = '') {
        super();
        
        this.documentId = documentId;
        this.content = initialContent;
        this.revision = 0;
        this.changes = []; // History of all changes
        this.pendingChanges = new Map(); // authorId -> [changes waiting for revision]
        this.cursors = new Map(); // userId -> UserCursor
        this.collaborators = new Set();
        this.locked = false;
        this.lockHolder = null;
        this.accessControl = {
            readUsers: new Set(),
            writeUsers: new Set(),
            adminUsers: new Set()
        };
        
        this.metrics = {
            totalChanges: 0,
            activeCollaborators: 0,
            conflictsResolved: 0,
            lastActivity: new Date().toISOString()
        };
    }

    /**
     * Add a collaborator to the document
     */
    addCollaborator(userId, permissions = ['read']) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document.add_collaborator',
            () => {
                this.collaborators.add(userId);
                
                // Set permissions
                if (permissions.includes('read')) this.accessControl.readUsers.add(userId);
                if (permissions.includes('write')) this.accessControl.writeUsers.add(userId);
                if (permissions.includes('admin')) this.accessControl.adminUsers.add(userId);
                
                this.metrics.activeCollaborators = this.collaborators.size;
                this.metrics.lastActivity = new Date().toISOString();
                
                this.emit('collaborator_joined', { userId, documentId: this.documentId });
                
                return {
                    success: true,
                    documentId: this.documentId,
                    content: this.content,
                    revision: this.revision,
                    cursors: Array.from(this.cursors.values()).map(cursor => cursor.toJSON())
                };
            }
        );
    }

    /**
     * Remove a collaborator from the document
     */
    removeCollaborator(userId) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document.remove_collaborator',
            () => {
                this.collaborators.delete(userId);
                this.cursors.delete(userId);
                this.pendingChanges.delete(userId);
                
                // Remove from access control
                this.accessControl.readUsers.delete(userId);
                this.accessControl.writeUsers.delete(userId);
                this.accessControl.adminUsers.delete(userId);
                
                this.metrics.activeCollaborators = this.collaborators.size;
                
                this.emit('collaborator_left', { userId, documentId: this.documentId });
                
                return { success: true };
            }
        );
    }

    /**
     * Check if user has permission
     */
    hasPermission(userId, permission) {
        switch (permission) {
            case 'read':
                return this.accessControl.readUsers.has(userId);
            case 'write':
                return this.accessControl.writeUsers.has(userId);
            case 'admin':
                return this.accessControl.adminUsers.has(userId);
            default:
                return false;
        }
    }

    /**
     * Apply a change to the document
     */
    applyChange(change, userId) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document.apply_change',
            () => {
                // Check permissions
                if (!this.hasPermission(userId, 'write')) {
                    throw new Error('User does not have write permission');
                }

                // Check if document is locked
                if (this.locked && this.lockHolder !== userId) {
                    throw new Error('Document is locked by another user');
                }

                // Validate change revision
                if (change.revision !== this.revision) {
                    return this._handleOutOfSyncChange(change, userId);
                }

                // Apply the change
                const newContent = change.applyToDocument(this.content);
                const oldRevision = this.revision;
                
                this.content = newContent;
                this.revision++;
                change.revision = this.revision;
                
                // Store change in history
                this.changes.push(change);
                this.metrics.totalChanges++;
                this.metrics.lastActivity = new Date().toISOString();

                // Transform all cursors
                this.cursors.forEach((cursor, cursorUserId) => {
                    if (cursorUserId !== userId) {
                        this.cursors.set(cursorUserId, cursor.transform(change));
                    }
                });

                // Broadcast change to all collaborators
                this.emit('change_applied', {
                    documentId: this.documentId,
                    change: change.toJSON(),
                    authorId: userId,
                    newRevision: this.revision,
                    newContent: this.content
                });

                return {
                    success: true,
                    revision: this.revision,
                    change: change.toJSON()
                };
            }
        );
    }

    /**
     * Handle change that's out of sync with current revision
     */
    _handleOutOfSyncChange(change, userId) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document.handle_out_of_sync_change',
            () => {
                // Get all changes since the change's revision
                const missedChanges = this.changes.slice(change.revision);
                
                // Transform the change against all missed changes
                let transformedChange = change;
                for (const missedChange of missedChanges) {
                    if (missedChange.authorId !== userId) {
                        transformedChange = transformedChange.transform(missedChange, 'right');
                        this.metrics.conflictsResolved++;
                    }
                }

                // Update the revision and apply
                transformedChange.revision = this.revision;
                return this.applyChange(transformedChange, userId);
            }
        );
    }

    /**
     * Update user cursor position
     */
    updateCursor(userId, position, selectionStart = null, selectionEnd = null) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document.update_cursor',
            () => {
                if (!this.hasPermission(userId, 'read')) {
                    throw new Error('User does not have read permission');
                }

                const cursor = new UserCursor(userId, position, selectionStart, selectionEnd);
                this.cursors.set(userId, cursor);
                
                // Broadcast cursor update
                this.emit('cursor_updated', {
                    documentId: this.documentId,
                    cursor: cursor.toJSON()
                });

                return { success: true, cursor: cursor.toJSON() };
            }
        );
    }

    /**
     * Lock document for exclusive editing
     */
    lockDocument(userId) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document.lock_document',
            () => {
                if (!this.hasPermission(userId, 'write')) {
                    throw new Error('User does not have write permission');
                }

                if (this.locked && this.lockHolder !== userId) {
                    throw new Error('Document is already locked by another user');
                }

                this.locked = true;
                this.lockHolder = userId;

                this.emit('document_locked', {
                    documentId: this.documentId,
                    lockHolder: userId
                });

                return { success: true, lockHolder: userId };
            }
        );
    }

    /**
     * Unlock document
     */
    unlockDocument(userId) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document.unlock_document',
            () => {
                if (!this.hasPermission(userId, 'admin') && this.lockHolder !== userId) {
                    throw new Error('Only the lock holder or admin can unlock the document');
                }

                this.locked = false;
                this.lockHolder = null;

                this.emit('document_unlocked', {
                    documentId: this.documentId,
                    unlockedBy: userId
                });

                return { success: true };
            }
        );
    }

    /**
     * Get document state
     */
    getState(userId = null) {
        if (userId && !this.hasPermission(userId, 'read')) {
            throw new Error('User does not have read permission');
        }

        return {
            documentId: this.documentId,
            content: this.content,
            revision: this.revision,
            locked: this.locked,
            lockHolder: this.lockHolder,
            collaborators: Array.from(this.collaborators),
            cursors: Array.from(this.cursors.values()).map(cursor => cursor.toJSON()),
            metrics: { ...this.metrics }
        };
    }

    /**
     * Get change history
     */
    getHistory(userId, startRevision = 0, endRevision = null) {
        if (!this.hasPermission(userId, 'read')) {
            throw new Error('User does not have read permission');
        }

        const end = endRevision || this.changes.length;
        return this.changes.slice(startRevision, end).map(change => change.toJSON());
    }

    /**
     * Create a snapshot of current state
     */
    createSnapshot() {
        return {
            documentId: this.documentId,
            content: this.content,
            revision: this.revision,
            changes: this.changes.map(change => change.toJSON()),
            cursors: Object.fromEntries(
                Array.from(this.cursors.entries()).map(([userId, cursor]) => [userId, cursor.toJSON()])
            ),
            collaborators: Array.from(this.collaborators),
            accessControl: {
                readUsers: Array.from(this.accessControl.readUsers),
                writeUsers: Array.from(this.accessControl.writeUsers),
                adminUsers: Array.from(this.accessControl.adminUsers)
            },
            locked: this.locked,
            lockHolder: this.lockHolder,
            metrics: { ...this.metrics },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Restore from snapshot
     */
    restoreFromSnapshot(snapshot) {
        this.documentId = snapshot.documentId;
        this.content = snapshot.content;
        this.revision = snapshot.revision;
        this.changes = snapshot.changes.map(change => DocumentChange.fromJSON(change));
        
        this.cursors = new Map(
            Object.entries(snapshot.cursors).map(([userId, cursorData]) => [
                userId, 
                new UserCursor(cursorData.userId, cursorData.position, cursorData.selectionStart, cursorData.selectionEnd)
            ])
        );
        
        this.collaborators = new Set(snapshot.collaborators);
        this.accessControl = {
            readUsers: new Set(snapshot.accessControl.readUsers),
            writeUsers: new Set(snapshot.accessControl.writeUsers),
            adminUsers: new Set(snapshot.accessControl.adminUsers)
        };
        
        this.locked = snapshot.locked;
        this.lockHolder = snapshot.lockHolder;
        this.metrics = { ...snapshot.metrics };

        this.emit('restored_from_snapshot', { documentId: this.documentId });
    }
}

/**
 * Document Engine - manages multiple collaborative documents
 */
class CollaborativeDocumentEngine extends EventEmitter {
    constructor() {
        super();
        
        this.documents = new Map(); // documentId -> CollaborativeDocument
        this.userDocuments = new Map(); // userId -> Set of documentIds
        this.metrics = {
            totalDocuments: 0,
            activeDocuments: 0,
            totalCollaborators: 0,
            totalChanges: 0
        };
    }

    /**
     * Create or get a document
     */
    createDocument(documentId, initialContent = '', creatorId = null) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document_engine.create_document',
            () => {
                if (this.documents.has(documentId)) {
                    return this.documents.get(documentId);
                }

                const document = new CollaborativeDocument(documentId, initialContent);
                this.documents.set(documentId, document);
                
                // Set up event forwarding
                document.on('change_applied', (data) => this.emit('change_applied', data));
                document.on('cursor_updated', (data) => this.emit('cursor_updated', data));
                document.on('collaborator_joined', (data) => this.emit('collaborator_joined', data));
                document.on('collaborator_left', (data) => this.emit('collaborator_left', data));
                document.on('document_locked', (data) => this.emit('document_locked', data));
                document.on('document_unlocked', (data) => this.emit('document_unlocked', data));

                // Add creator as admin if specified
                if (creatorId) {
                    document.addCollaborator(creatorId, ['read', 'write', 'admin']);
                    
                    if (!this.userDocuments.has(creatorId)) {
                        this.userDocuments.set(creatorId, new Set());
                    }
                    this.userDocuments.get(creatorId).add(documentId);
                }

                this.metrics.totalDocuments++;
                this.metrics.activeDocuments++;

                this.emit('document_created', { documentId, creatorId });

                return document;
            }
        );
    }

    /**
     * Get a document
     */
    getDocument(documentId) {
        return this.documents.get(documentId);
    }

    /**
     * Join a user to a document
     */
    joinDocument(documentId, userId, permissions = ['read']) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document_engine.join_document',
            () => {
                const document = this.documents.get(documentId);
                if (!document) {
                    throw new Error('Document not found');
                }

                const result = document.addCollaborator(userId, permissions);
                
                // Track user documents
                if (!this.userDocuments.has(userId)) {
                    this.userDocuments.set(userId, new Set());
                }
                this.userDocuments.get(userId).add(documentId);

                return result;
            }
        );
    }

    /**
     * Leave a document
     */
    leaveDocument(documentId, userId) {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document_engine.leave_document',
            () => {
                const document = this.documents.get(documentId);
                if (!document) {
                    return { success: true }; // Already not in document
                }

                document.removeCollaborator(userId);
                
                // Update user documents tracking
                const userDocs = this.userDocuments.get(userId);
                if (userDocs) {
                    userDocs.delete(documentId);
                    if (userDocs.size === 0) {
                        this.userDocuments.delete(userId);
                    }
                }

                return { success: true };
            }
        );
    }

    /**
     * Apply change to document
     */
    applyChange(documentId, change, userId) {
        const document = this.documents.get(documentId);
        if (!document) {
            throw new Error('Document not found');
        }

        return document.applyChange(change, userId);
    }

    /**
     * Update cursor position
     */
    updateCursor(documentId, userId, position, selectionStart, selectionEnd) {
        const document = this.documents.get(documentId);
        if (!document) {
            throw new Error('Document not found');
        }

        return document.updateCursor(userId, position, selectionStart, selectionEnd);
    }

    /**
     * Get user's documents
     */
    getUserDocuments(userId) {
        const userDocs = this.userDocuments.get(userId) || new Set();
        return Array.from(userDocs).map(docId => {
            const doc = this.documents.get(docId);
            return doc ? doc.getState(userId) : null;
        }).filter(Boolean);
    }

    /**
     * Get engine status
     */
    getStatus() {
        // Update metrics
        this.metrics.activeDocuments = this.documents.size;
        this.metrics.totalCollaborators = this.userDocuments.size;
        this.metrics.totalChanges = Array.from(this.documents.values())
            .reduce((total, doc) => total + doc.metrics.totalChanges, 0);

        return {
            metrics: { ...this.metrics },
            documents: Array.from(this.documents.keys()),
            activeUsers: Array.from(this.userDocuments.keys())
        };
    }

    /**
     * Clean up inactive documents
     */
    cleanup() {
        return OpenTelemetryTracing.traceOperation(
            'collaborative_document_engine.cleanup',
            () => {
                const now = Date.now();
                const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours
                let cleanedCount = 0;

                for (const [documentId, document] of this.documents) {
                    const lastActivity = new Date(document.metrics.lastActivity).getTime();
                    
                    if (document.collaborators.size === 0 && (now - lastActivity) > inactiveThreshold) {
                        this.documents.delete(documentId);
                        this.emit('document_cleaned', { documentId });
                        cleanedCount++;
                    }
                }

                return { cleanedDocuments: cleanedCount };
            }
        );
    }
}

export {
    CollaborativeDocumentEngine,
    CollaborativeDocument,
    DocumentChange,
    Operation,
    UserCursor,
    OperationType
};
