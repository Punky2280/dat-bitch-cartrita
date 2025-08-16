/**
 * Real-time Collaboration API Routes
 * Handles collaborative editing, presence tracking, and resource sharing
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { sanitizeHtml } = require('../utils/sanitizer');

const router = express.Router();

// Rate limiting for collaboration endpoints
const collaborationRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
    message: 'Too many collaboration requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting to all collaboration routes
router.use(collaborationRateLimit);
router.use(requireAuth);

/**
 * @route GET /api/collaboration/presence
 * @desc Get current user presence information
 * @access Private
 */
router.get('/presence', async (req, res) => {
    try {
        const presence = await db.query(
            'SELECT * FROM user_presence WHERE user_id = $1',
            [req.user.id]
        );

        res.json({
            success: true,
            presence: presence.rows[0] || {
                user_id: req.user.id,
                status: 'offline',
                last_seen: new Date()
            }
        });

    } catch (error) {
        logger.error('Error getting user presence:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get presence information'
        });
    }
});

/**
 * @route PUT /api/collaboration/presence
 * @desc Update user presence status
 * @access Private
 */
router.put('/presence',
    [
        body('status').isIn(['online', 'away', 'busy', 'offline']).withMessage('Invalid status'),
        body('activity').optional().isString().isLength({ max: 200 }),
        body('socketId').optional().isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { status, activity, socketId } = req.body;

            await db.query(
                'SELECT update_user_presence($1, $2, $3, $4)',
                [req.user.id, status, activity, socketId]
            );

            // Emit presence update to connected sockets
            if (req.app.get('io')) {
                req.app.get('io').to('/collaboration').emit('presence_updated', {
                    user_id: req.user.id,
                    username: req.user.username,
                    status,
                    activity,
                    timestamp: new Date()
                });
            }

            res.json({
                success: true,
                message: 'Presence updated successfully'
            });

        } catch (error) {
            logger.error('Error updating user presence:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update presence'
            });
        }
    }
);

/**
 * @route GET /api/collaboration/presence/users
 * @desc Get presence information for multiple users
 * @access Private
 */
router.get('/presence/users',
    [
        query('userIds').isString().withMessage('User IDs required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const userIds = req.query.userIds.split(',');

            const presences = await db.query(`
                SELECT 
                    up.user_id,
                    u.username,
                    u.display_name,
                    up.status,
                    up.current_activity,
                    up.last_seen
                FROM user_presence up
                JOIN users u ON up.user_id = u.id
                WHERE up.user_id = ANY($1::uuid[])
            `, [userIds]);

            res.json({
                success: true,
                presences: presences.rows
            });

        } catch (error) {
            logger.error('Error getting user presences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user presences'
            });
        }
    }
);

/**
 * @route POST /api/collaboration/sessions
 * @desc Create a new collaboration session
 * @access Private
 */
router.post('/sessions',
    [
        body('resourceId').isString().withMessage('Resource ID required'),
        body('resourceType').isIn(['document', 'workflow', 'conversation']).withMessage('Invalid resource type'),
        body('sessionData').optional().isObject(),
        body('expiresIn').optional().isInt({ min: 1, max: 24 }).withMessage('Expires in must be 1-24 hours')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { resourceId, resourceType, sessionData = {}, expiresIn = 2 } = req.body;

            // Check if user has access to the resource
            const hasAccess = await checkResourceAccess(req.user.id, resourceId, resourceType);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            const expiresAt = new Date(Date.now() + (expiresIn * 60 * 60 * 1000)); // hours to milliseconds

            const result = await db.query(`
                INSERT INTO collaboration_sessions (resource_id, resource_type, session_data, collaborators, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [
                resourceId,
                resourceType,
                JSON.stringify(sessionData),
                JSON.stringify([{ user_id: req.user.id, joined_at: new Date() }]),
                expiresAt
            ]);

            const session = result.rows[0];

            // Emit session created event
            if (req.app.get('io')) {
                req.app.get('io').to('/collaboration').emit('session_created', {
                    session_id: session.id,
                    resource_id: resourceId,
                    resource_type: resourceType,
                    created_by: req.user.id,
                    timestamp: new Date()
                });
            }

            res.status(201).json({
                success: true,
                session
            });

        } catch (error) {
            logger.error('Error creating collaboration session:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create collaboration session'
            });
        }
    }
);

/**
 * @route GET /api/collaboration/sessions/:sessionId
 * @desc Get collaboration session details
 * @access Private
 */
router.get('/sessions/:sessionId',
    [
        param('sessionId').isUUID().withMessage('Invalid session ID')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const session = await db.query(
                'SELECT * FROM collaboration_sessions WHERE id = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
                [req.params.sessionId]
            );

            if (session.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found or expired'
                });
            }

            const sessionData = session.rows[0];
            
            // Check if user is a collaborator or has access to the resource
            const collaborators = sessionData.collaborators || [];
            const isCollaborator = collaborators.some(c => c.user_id === req.user.id);
            const hasAccess = await checkResourceAccess(req.user.id, sessionData.resource_id, sessionData.resource_type);

            if (!isCollaborator && !hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to collaboration session'
                });
            }

            res.json({
                success: true,
                session: sessionData
            });

        } catch (error) {
            logger.error('Error getting collaboration session:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get collaboration session'
            });
        }
    }
);

/**
 * @route POST /api/collaboration/sessions/:sessionId/join
 * @desc Join a collaboration session
 * @access Private
 */
router.post('/sessions/:sessionId/join',
    [
        param('sessionId').isUUID().withMessage('Invalid session ID')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const session = await db.query(
                'SELECT * FROM collaboration_sessions WHERE id = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
                [req.params.sessionId]
            );

            if (session.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found or expired'
                });
            }

            const sessionData = session.rows[0];
            
            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, sessionData.resource_id, sessionData.resource_type);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            // Add user to collaborators if not already present
            const collaborators = sessionData.collaborators || [];
            const isAlreadyCollaborator = collaborators.some(c => c.user_id === req.user.id);

            if (!isAlreadyCollaborator) {
                collaborators.push({
                    user_id: req.user.id,
                    username: req.user.username,
                    joined_at: new Date()
                });

                await db.query(
                    'UPDATE collaboration_sessions SET collaborators = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [JSON.stringify(collaborators), req.params.sessionId]
                );
            }

            // Log activity
            await db.query(`
                INSERT INTO collaboration_activity (resource_id, resource_type, user_id, activity_type, activity_data, ip_address, user_agent)
                VALUES ($1, $2, $3, 'joined', $4, $5, $6)
            `, [
                sessionData.resource_id,
                sessionData.resource_type,
                req.user.id,
                JSON.stringify({ session_id: req.params.sessionId }),
                req.ip,
                req.get('User-Agent')
            ]);

            // Emit user joined event
            if (req.app.get('io')) {
                req.app.get('io').to('/collaboration').emit('user_joined', {
                    session_id: req.params.sessionId,
                    user: {
                        id: req.user.id,
                        username: req.user.username,
                        display_name: req.user.display_name
                    },
                    timestamp: new Date()
                });
            }

            res.json({
                success: true,
                message: 'Successfully joined collaboration session',
                collaborators
            });

        } catch (error) {
            logger.error('Error joining collaboration session:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join collaboration session'
            });
        }
    }
);

/**
 * @route POST /api/collaboration/sessions/:sessionId/leave
 * @desc Leave a collaboration session
 * @access Private
 */
router.post('/sessions/:sessionId/leave',
    [
        param('sessionId').isUUID().withMessage('Invalid session ID')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const session = await db.query(
                'SELECT * FROM collaboration_sessions WHERE id = $1',
                [req.params.sessionId]
            );

            if (session.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                });
            }

            const sessionData = session.rows[0];
            const collaborators = sessionData.collaborators || [];
            const updatedCollaborators = collaborators.filter(c => c.user_id !== req.user.id);

            await db.query(
                'UPDATE collaboration_sessions SET collaborators = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [JSON.stringify(updatedCollaborators), req.params.sessionId]
            );

            // Release any locks held by the user for this resource
            await db.query(`
                DELETE FROM resource_locks 
                WHERE resource_id = $1 AND resource_type = $2 AND user_id = $3
            `, [sessionData.resource_id, sessionData.resource_type, req.user.id]);

            // Log activity
            await db.query(`
                INSERT INTO collaboration_activity (resource_id, resource_type, user_id, activity_type, activity_data, ip_address, user_agent)
                VALUES ($1, $2, $3, 'left', $4, $5, $6)
            `, [
                sessionData.resource_id,
                sessionData.resource_type,
                req.user.id,
                JSON.stringify({ session_id: req.params.sessionId }),
                req.ip,
                req.get('User-Agent')
            ]);

            // Emit user left event
            if (req.app.get('io')) {
                req.app.get('io').to('/collaboration').emit('user_left', {
                    session_id: req.params.sessionId,
                    user_id: req.user.id,
                    timestamp: new Date()
                });
            }

            res.json({
                success: true,
                message: 'Successfully left collaboration session'
            });

        } catch (error) {
            logger.error('Error leaving collaboration session:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to leave collaboration session'
            });
        }
    }
);

/**
 * @route POST /api/collaboration/locks
 * @desc Acquire a resource lock
 * @access Private
 */
router.post('/locks',
    [
        body('resourceId').isString().withMessage('Resource ID required'),
        body('resourceType').isString().withMessage('Resource type required'),
        body('lockType').isString().withMessage('Lock type required'),
        body('socketId').isString().withMessage('Socket ID required'),
        body('duration').optional().isInt({ min: 1, max: 120 }).withMessage('Duration must be 1-120 minutes')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { resourceId, resourceType, lockType, socketId, duration = 30 } = req.body;

            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, resourceId, resourceType);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            const result = await db.query(
                'SELECT acquire_resource_lock($1, $2, $3, $4, $5, $6)',
                [resourceId, resourceType, lockType, req.user.id, socketId, duration]
            );

            const lockAcquired = result.rows[0].acquire_resource_lock;

            if (lockAcquired) {
                // Emit lock acquired event
                if (req.app.get('io')) {
                    req.app.get('io').to('/collaboration').emit('lock_acquired', {
                        resource_id: resourceId,
                        resource_type: resourceType,
                        lock_type: lockType,
                        user_id: req.user.id,
                        username: req.user.username,
                        timestamp: new Date()
                    });
                }

                res.json({
                    success: true,
                    message: 'Lock acquired successfully'
                });
            } else {
                res.status(409).json({
                    success: false,
                    message: 'Resource is already locked'
                });
            }

        } catch (error) {
            logger.error('Error acquiring resource lock:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to acquire lock'
            });
        }
    }
);

/**
 * @route DELETE /api/collaboration/locks
 * @desc Release a resource lock
 * @access Private
 */
router.delete('/locks',
    [
        body('resourceId').isString().withMessage('Resource ID required'),
        body('resourceType').isString().withMessage('Resource type required'),
        body('lockType').isString().withMessage('Lock type required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { resourceId, resourceType, lockType } = req.body;

            const result = await db.query(
                'SELECT release_resource_lock($1, $2, $3, $4)',
                [resourceId, resourceType, lockType, req.user.id]
            );

            const lockReleased = result.rows[0].release_resource_lock;

            if (lockReleased) {
                // Emit lock released event
                if (req.app.get('io')) {
                    req.app.get('io').to('/collaboration').emit('lock_released', {
                        resource_id: resourceId,
                        resource_type: resourceType,
                        lock_type: lockType,
                        user_id: req.user.id,
                        timestamp: new Date()
                    });
                }

                res.json({
                    success: true,
                    message: 'Lock released successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Lock not found or not owned by user'
                });
            }

        } catch (error) {
            logger.error('Error releasing resource lock:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to release lock'
            });
        }
    }
);

/**
 * @route GET /api/collaboration/locks/:resourceId
 * @desc Get locks for a resource
 * @access Private
 */
router.get('/locks/:resourceId',
    [
        param('resourceId').isString().withMessage('Invalid resource ID'),
        query('resourceType').isString().withMessage('Resource type required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { resourceId } = req.params;
            const { resourceType } = req.query;

            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, resourceId, resourceType);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            const locks = await db.query(`
                SELECT 
                    rl.*,
                    u.username,
                    u.display_name
                FROM resource_locks rl
                JOIN users u ON rl.user_id = u.id
                WHERE rl.resource_id = $1 
                  AND rl.resource_type = $2 
                  AND rl.expires_at > CURRENT_TIMESTAMP
            `, [resourceId, resourceType]);

            res.json({
                success: true,
                locks: locks.rows
            });

        } catch (error) {
            logger.error('Error getting resource locks:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get resource locks'
            });
        }
    }
);

/**
 * @route POST /api/collaboration/operations
 * @desc Log a document operation for operational transform
 * @access Private
 */
router.post('/operations',
    [
        body('documentId').isString().withMessage('Document ID required'),
        body('documentType').isString().withMessage('Document type required'),
        body('operationType').isString().withMessage('Operation type required'),
        body('operationData').isObject().withMessage('Operation data required'),
        body('version').isInt({ min: 0 }).withMessage('Version must be a non-negative integer'),
        body('position').optional().isInt({ min: 0 }),
        body('content').optional().isString(),
        body('sessionId').optional().isUUID()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const {
                documentId,
                documentType,
                operationType,
                operationData,
                version,
                position,
                content,
                sessionId
            } = req.body;

            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, documentId, documentType);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            const result = await db.query(`
                INSERT INTO document_operations 
                (document_id, document_type, operation_data, operation_type, user_id, version, position, content, session_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                documentId,
                documentType,
                JSON.stringify(operationData),
                operationType,
                req.user.id,
                version,
                position,
                content,
                sessionId
            ]);

            const operation = result.rows[0];

            // Emit operation to other collaborators
            if (req.app.get('io')) {
                req.app.get('io').to('/collaboration').emit('operation_applied', {
                    operation,
                    user: {
                        id: req.user.id,
                        username: req.user.username
                    },
                    timestamp: new Date()
                });
            }

            res.status(201).json({
                success: true,
                operation
            });

        } catch (error) {
            logger.error('Error logging document operation:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to log operation'
            });
        }
    }
);

/**
 * @route GET /api/collaboration/operations/:documentId
 * @desc Get document operations history
 * @access Private
 */
router.get('/operations/:documentId',
    [
        param('documentId').isString().withMessage('Invalid document ID'),
        query('documentType').isString().withMessage('Document type required'),
        query('since').optional().isISO8601().withMessage('Invalid date format'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { documentId } = req.params;
            const { documentType, since, limit = 50 } = req.query;

            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, documentId, documentType);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            let query = `
                SELECT 
                    do.*,
                    u.username,
                    u.display_name
                FROM document_operations do
                JOIN users u ON do.user_id = u.id
                WHERE do.document_id = $1 AND do.document_type = $2
            `;
            const params = [documentId, documentType];

            if (since) {
                query += ' AND do.applied_at > $3';
                params.push(since);
            }

            query += ' ORDER BY do.applied_at DESC, do.version DESC LIMIT $' + (params.length + 1);
            params.push(limit);

            const operations = await db.query(query, params);

            res.json({
                success: true,
                operations: operations.rows
            });

        } catch (error) {
            logger.error('Error getting document operations:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get operations'
            });
        }
    }
);

/**
 * @route POST /api/collaboration/comments
 * @desc Add a comment to a resource
 * @access Private
 */
router.post('/comments',
    [
        body('resourceId').isString().withMessage('Resource ID required'),
        body('resourceType').isString().withMessage('Resource type required'),
        body('commentText').isString().isLength({ min: 1, max: 2000 }).withMessage('Comment text must be 1-2000 characters'),
        body('positionData').optional().isObject(),
        body('threadId').optional().isUUID().withMessage('Invalid thread ID')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { resourceId, resourceType, commentText, positionData, threadId } = req.body;

            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, resourceId, resourceType);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            // Sanitize comment text
            const sanitizedText = sanitizeHtml(commentText);

            const result = await db.query(`
                INSERT INTO collaboration_comments 
                (resource_id, resource_type, user_id, comment_text, position_data, thread_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [
                resourceId,
                resourceType,
                req.user.id,
                sanitizedText,
                positionData ? JSON.stringify(positionData) : null,
                threadId
            ]);

            const comment = result.rows[0];

            // Get user details for the response
            const userInfo = await db.query(
                'SELECT username, display_name FROM users WHERE id = $1',
                [req.user.id]
            );

            const commentWithUser = {
                ...comment,
                user: userInfo.rows[0]
            };

            // Log activity
            await db.query(`
                INSERT INTO collaboration_activity (resource_id, resource_type, user_id, activity_type, activity_data, ip_address, user_agent)
                VALUES ($1, $2, $3, 'commented', $4, $5, $6)
            `, [
                resourceId,
                resourceType,
                req.user.id,
                JSON.stringify({ comment_id: comment.id, thread_id: threadId }),
                req.ip,
                req.get('User-Agent')
            ]);

            // Emit comment added event
            if (req.app.get('io')) {
                req.app.get('io').to('/collaboration').emit('comment_added', {
                    comment: commentWithUser,
                    timestamp: new Date()
                });
            }

            res.status(201).json({
                success: true,
                comment: commentWithUser
            });

        } catch (error) {
            logger.error('Error adding comment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add comment'
            });
        }
    }
);

/**
 * @route GET /api/collaboration/comments/:resourceId
 * @desc Get comments for a resource
 * @access Private
 */
router.get('/comments/:resourceId',
    [
        param('resourceId').isString().withMessage('Invalid resource ID'),
        query('resourceType').isString().withMessage('Resource type required'),
        query('includeResolved').optional().isBoolean()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { resourceId } = req.params;
            const { resourceType, includeResolved = true } = req.query;

            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, resourceId, resourceType);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            let query = `
                SELECT 
                    cc.*,
                    u.username,
                    u.display_name,
                    resolver.username as resolved_by_username
                FROM collaboration_comments cc
                JOIN users u ON cc.user_id = u.id
                LEFT JOIN users resolver ON cc.resolved_by = resolver.id
                WHERE cc.resource_id = $1 AND cc.resource_type = $2
            `;
            const params = [resourceId, resourceType];

            if (!includeResolved) {
                query += ' AND cc.is_resolved = false';
            }

            query += ' ORDER BY cc.created_at ASC';

            const comments = await db.query(query, params);

            // Organize comments by thread
            const commentsByThread = {};
            const rootComments = [];

            comments.rows.forEach(comment => {
                const commentWithUser = {
                    ...comment,
                    user: {
                        username: comment.username,
                        display_name: comment.display_name
                    },
                    resolved_by_user: comment.resolved_by_username ? {
                        username: comment.resolved_by_username
                    } : null
                };

                delete commentWithUser.username;
                delete commentWithUser.display_name;
                delete commentWithUser.resolved_by_username;

                if (comment.thread_id) {
                    if (!commentsByThread[comment.thread_id]) {
                        commentsByThread[comment.thread_id] = [];
                    }
                    commentsByThread[comment.thread_id].push(commentWithUser);
                } else {
                    rootComments.push(commentWithUser);
                }
            });

            // Attach replies to root comments
            rootComments.forEach(comment => {
                comment.replies = commentsByThread[comment.id] || [];
            });

            res.json({
                success: true,
                comments: rootComments
            });

        } catch (error) {
            logger.error('Error getting comments:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get comments'
            });
        }
    }
);

/**
 * @route PUT /api/collaboration/comments/:commentId/resolve
 * @desc Mark a comment as resolved
 * @access Private
 */
router.put('/comments/:commentId/resolve',
    [
        param('commentId').isUUID().withMessage('Invalid comment ID')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            // Check if comment exists and user has access
            const comment = await db.query(`
                SELECT cc.*, cc.resource_id, cc.resource_type
                FROM collaboration_comments cc
                WHERE cc.id = $1
            `, [req.params.commentId]);

            if (comment.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Comment not found'
                });
            }

            const commentData = comment.rows[0];

            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, commentData.resource_id, commentData.resource_type);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            await db.query(`
                UPDATE collaboration_comments 
                SET is_resolved = true, resolved_by = $1, resolved_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [req.user.id, req.params.commentId]);

            // Emit comment resolved event
            if (req.app.get('io')) {
                req.app.get('io').to('/collaboration').emit('comment_resolved', {
                    comment_id: req.params.commentId,
                    resolved_by: req.user.id,
                    timestamp: new Date()
                });
            }

            res.json({
                success: true,
                message: 'Comment marked as resolved'
            });

        } catch (error) {
            logger.error('Error resolving comment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to resolve comment'
            });
        }
    }
);

/**
 * @route GET /api/collaboration/activity/:resourceId
 * @desc Get activity history for a resource
 * @access Private
 */
router.get('/activity/:resourceId',
    [
        param('resourceId').isString().withMessage('Invalid resource ID'),
        query('resourceType').isString().withMessage('Resource type required'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
        query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { resourceId } = req.params;
            const { resourceType, limit = 20, offset = 0 } = req.query;

            // Check resource access
            const hasAccess = await checkResourceAccess(req.user.id, resourceId, resourceType);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to resource'
                });
            }

            const activities = await db.query(`
                SELECT 
                    ca.*,
                    u.username,
                    u.display_name
                FROM collaboration_activity ca
                JOIN users u ON ca.user_id = u.id
                WHERE ca.resource_id = $1 AND ca.resource_type = $2
                ORDER BY ca.created_at DESC
                LIMIT $3 OFFSET $4
            `, [resourceId, resourceType, limit, offset]);

            res.json({
                success: true,
                activities: activities.rows
            });

        } catch (error) {
            logger.error('Error getting activity history:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get activity history'
            });
        }
    }
);

// Helper function to check resource access
async function checkResourceAccess(userId, resourceId, resourceType) {
    try {
        switch (resourceType) {
            case 'document':
                // Check if user has access to document (implement based on your document model)
                return true; // Placeholder
            case 'workflow':
                const workflow = await db.query(
                    'SELECT id FROM workflows WHERE id = $1 AND (user_id = $2 OR visibility = $3)',
                    [resourceId, userId, 'public']
                );
                return workflow.rows.length > 0;
            case 'conversation':
                const conversation = await db.query(
                    'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
                    [resourceId, userId]
                );
                return conversation.rows.length > 0;
            default:
                return false;
        }
    } catch (error) {
        logger.error('Error checking resource access:', error);
        return false;
    }
}

module.exports = router;
