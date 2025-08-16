/**
 * Content Management API Routes
 * 
 * Comprehensive REST API for the Advanced Content Management System providing:
 * - Full CRUD operations for content items
 * - Version control and history management
 * - Real-time collaborative editing endpoints
 * - Comment and approval workflow management
 * - AI-powered content analysis and optimization
 * - Multi-channel publishing and scheduling
 * - Content analytics and performance tracking
 * - Bulk operations and import/export functionality
 */

import express from 'express';
import multer from 'multer';
import ContentEngine from '../services/ContentEngine.js';
import CollaborationEngine from '../services/CollaborationEngine.js';
import ContentAI from '../services/ContentAI.js';
import PublishingEngine from '../services/PublishingEngine.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Initialize services
let contentEngine;
let collaborationEngine;
let contentAI;
let publishingEngine;

// OpenTelemetry tracer
const tracer = OpenTelemetryTracing.getTracer('content-api');

// File upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];
        const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
        cb(null, isAllowed);
    }
});

/**
 * Initialize content management services
 */
async function initializeServices(database, webSocketServer = null) {
    // Initialize ContentEngine
    contentEngine = new ContentEngine({
        enableVersioning: true,
        enableCollaboration: true,
        enableAIOptimization: true,
        enableAnalytics: true
    });
    await contentEngine.initialize(database);
    
    // Initialize CollaborationEngine
    collaborationEngine = new CollaborationEngine({
        enableRealTimeEditing: true,
        enableComments: true,
        enableWorkflows: true,
        maxConcurrentEditors: 50
    });
    await collaborationEngine.initialize(database, webSocketServer);
    
    // Initialize ContentAI
    contentAI = new ContentAI({
        enableSEOAnalysis: true,
        enableSentimentAnalysis: true,
        enableReadabilityAnalysis: true,
        enableDuplicateDetection: true,
        enableAutoTagging: true
    });
    await contentAI.initialize(database);
    
    // Initialize PublishingEngine
    publishingEngine = new PublishingEngine({
        enableScheduledPublishing: true,
        enableBulkOperations: true,
        enableApprovalWorkflows: true,
        enableMultiChannel: true
    });
    await publishingEngine.initialize(database);
    
    console.log('Content management services initialized');
}

/**
 * Middleware for request validation and tracing
 */
const validateRequest = (requiredFields = []) => {
    return (req, res, next) => {
        const span = tracer.startSpan('content_api_validate_request');
        
        try {
            // Check required fields
            for (const field of requiredFields) {
                if (req.body[field] === undefined) {
                    span.setStatus({ code: 2, message: `Missing required field: ${field}` });
                    return res.status(400).json({
                        success: false,
                        error: `Missing required field: ${field}`
                    });
                }
            }
            
            // Add user context if available
            req.userId = req.user?.id || req.headers['x-user-id'];
            
            span.setAttributes({
                'request.method': req.method,
                'request.path': req.path,
                'user.id': req.userId || 'anonymous'
            });
            
            next();
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            res.status(500).json({ success: false, error: error.message });
        } finally {
            span.end();
        }
    };
};

/**
 * Error handling middleware
 */
const handleError = (error, req, res, next) => {
    console.error('Content API Error:', error);
    
    const span = tracer.startSpan('content_api_error');
    span.recordException(error);
    span.setAttributes({
        'error.type': error.constructor.name,
        'request.path': req.path,
        'request.method': req.method
    });
    span.end();
    
    res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
};

// =============================================================================
// CONTENT CRUD OPERATIONS
// =============================================================================

/**
 * Create new content item
 * POST /api/content
 */
router.post('/', validateRequest(['title', 'content']), async (req, res, next) => {
    try {
        const span = tracer.startSpan('content_api_create_content');
        
        const contentData = {
            title: req.body.title,
            content: req.body.content,
            contentType: req.body.contentType || 'article',
            status: req.body.status || 'draft',
            metadata: req.body.metadata || {},
            tags: req.body.tags || [],
            parentId: req.body.parentId,
            templateId: req.body.templateId
        };
        
        const result = await contentEngine.createContent(contentData, req.userId);
        
        // Trigger AI analysis if enabled
        if (req.body.enableAIAnalysis) {
            try {
                const analysis = await contentAI.analyzeContent(result.id, contentData.content);
                result.aiAnalysis = analysis;
            } catch (error) {
                console.warn('AI analysis failed:', error.message);
            }
        }
        
        span.setAttributes({
            'content.id': result.id,
            'content.type': contentData.contentType,
            'content.status': contentData.status,
            'content.length': contentData.content.length
        });
        
        span.end();
        
        res.status(201).json({
            success: true,
            data: result
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get content item by ID
 * GET /api/content/:id
 */
router.get('/:id', async (req, res, next) => {
    try {
        const span = tracer.startSpan('content_api_get_content');
        
        const contentId = req.params.id;
        const includeVersions = req.query.includeVersions === 'true';
        const includeAnalytics = req.query.includeAnalytics === 'true';
        
        const content = await contentEngine.getContent(contentId, {
            includeVersions,
            includeAnalytics,
            userId: req.userId
        });
        
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
        
        // Add collaboration info if requested
        if (req.query.includeCollaboration === 'true') {
            content.collaboration = {
                activeUsers: collaborationEngine.getActiveUsers(contentId),
                comments: await collaborationEngine.getComments(contentId),
                workflowStatus: await collaborationEngine.getWorkflowStatus(contentId)
            };
        }
        
        span.setAttributes({
            'content.id': contentId,
            'content.type': content.content_type,
            'content.status': content.status,
            'request.include_versions': includeVersions,
            'request.include_analytics': includeAnalytics
        });
        
        span.end();
        
        res.json({
            success: true,
            data: content
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Update content item
 * PUT /api/content/:id
 */
router.put('/:id', validateRequest(), async (req, res, next) => {
    try {
        const span = tracer.startSpan('content_api_update_content');
        
        const contentId = req.params.id;
        const updates = {
            title: req.body.title,
            content: req.body.content,
            contentType: req.body.contentType,
            status: req.body.status,
            metadata: req.body.metadata,
            tags: req.body.tags
        };
        
        // Remove undefined values
        Object.keys(updates).forEach(key => {
            if (updates[key] === undefined) delete updates[key];
        });
        
        const options = {
            createVersion: req.body.createVersion !== false,
            versionComment: req.body.versionComment,
            userId: req.userId
        };
        
        const result = await contentEngine.updateContent(contentId, updates, options);
        
        // Trigger AI analysis if content changed and enabled
        if (updates.content && req.body.enableAIAnalysis) {
            try {
                const analysis = await contentAI.analyzeContent(contentId, updates.content);
                result.aiAnalysis = analysis;
            } catch (error) {
                console.warn('AI analysis failed:', error.message);
            }
        }
        
        span.setAttributes({
            'content.id': contentId,
            'update.fields': Object.keys(updates).length,
            'version.created': options.createVersion
        });
        
        span.end();
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Delete content item
 * DELETE /api/content/:id
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const span = tracer.startSpan('content_api_delete_content');
        
        const contentId = req.params.id;
        const softDelete = req.query.soft !== 'false';
        
        await contentEngine.deleteContent(contentId, {
            softDelete,
            userId: req.userId,
            reason: req.body.reason
        });
        
        span.setAttributes({
            'content.id': contentId,
            'delete.soft': softDelete
        });
        
        span.end();
        
        res.json({
            success: true,
            message: softDelete ? 'Content archived' : 'Content permanently deleted'
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * List content items with filtering and pagination
 * GET /api/content
 */
router.get('/', async (req, res, next) => {
    try {
        const span = tracer.startSpan('content_api_list_content');
        
        const filters = {
            contentType: req.query.type,
            status: req.query.status,
            authorId: req.query.author,
            tags: req.query.tags ? req.query.tags.split(',') : undefined,
            createdAfter: req.query.createdAfter,
            createdBefore: req.query.createdBefore,
            search: req.query.search,
            parentId: req.query.parentId
        };
        
        const options = {
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
            sortBy: req.query.sortBy || 'created_at',
            sortOrder: req.query.sortOrder || 'desc',
            includeMetrics: req.query.includeMetrics === 'true'
        };
        
        const result = await contentEngine.listContent(filters, options);
        
        span.setAttributes({
            'content.count': result.items.length,
            'content.total': result.total,
            'request.limit': options.limit,
            'request.offset': options.offset
        });
        
        span.end();
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// VERSION CONTROL
// =============================================================================

/**
 * Get content version history
 * GET /api/content/:id/versions
 */
router.get('/:id/versions', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const versions = await contentEngine.getVersionHistory(contentId, { limit, offset });
        
        res.json({
            success: true,
            data: versions
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get specific content version
 * GET /api/content/:id/versions/:versionId
 */
router.get('/:id/versions/:versionId', async (req, res, next) => {
    try {
        const { id: contentId, versionId } = req.params;
        
        const version = await contentEngine.getVersion(contentId, versionId);
        
        if (!version) {
            return res.status(404).json({
                success: false,
                error: 'Version not found'
            });
        }
        
        res.json({
            success: true,
            data: version
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Restore content to specific version
 * POST /api/content/:id/versions/:versionId/restore
 */
router.post('/:id/versions/:versionId/restore', validateRequest(), async (req, res, next) => {
    try {
        const { id: contentId, versionId } = req.params;
        
        const result = await contentEngine.restoreVersion(contentId, versionId, {
            userId: req.userId,
            comment: req.body.comment
        });
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Compare two versions
 * GET /api/content/:id/versions/:versionId/compare/:compareVersionId
 */
router.get('/:id/versions/:versionId/compare/:compareVersionId', async (req, res, next) => {
    try {
        const { id: contentId, versionId, compareVersionId } = req.params;
        
        const comparison = await contentEngine.compareVersions(contentId, versionId, compareVersionId);
        
        res.json({
            success: true,
            data: comparison
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// COLLABORATION FEATURES
// =============================================================================

/**
 * Start editing session
 * POST /api/content/:id/edit-session
 */
router.post('/:id/edit-session', validateRequest(), async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const session = await collaborationEngine.startEditSession(contentId, req.userId, {
            permissions: req.body.permissions,
            initialCursor: req.body.cursor,
            metadata: req.body.metadata
        });
        
        res.json({
            success: true,
            data: session
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * End editing session
 * DELETE /api/content/:id/edit-session/:sessionId
 */
router.delete('/:id/edit-session/:sessionId', async (req, res, next) => {
    try {
        const { id: contentId, sessionId } = req.params;
        
        await collaborationEngine.leaveEditSession(sessionId, req.userId);
        
        res.json({
            success: true,
            message: 'Edit session ended'
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Broadcast edit operation
 * POST /api/content/:id/edit-session/:sessionId/edit
 */
router.post('/:id/edit-session/:sessionId/edit', validateRequest(['operation']), async (req, res, next) => {
    try {
        const { id: contentId, sessionId } = req.params;
        
        const result = await collaborationEngine.broadcastEdit(sessionId, {
            type: req.body.operation.type,
            data: req.body.operation.data,
            cursor: req.body.cursor,
            selection: req.body.selection
        });
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get active collaborators
 * GET /api/content/:id/collaborators
 */
router.get('/:id/collaborators', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const collaborators = collaborationEngine.getActiveUsers(contentId);
        
        res.json({
            success: true,
            data: collaborators
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// COMMENTS SYSTEM
// =============================================================================

/**
 * Add comment to content
 * POST /api/content/:id/comments
 */
router.post('/:id/comments', validateRequest(['text']), async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const comment = await collaborationEngine.addComment(contentId, {
            text: req.body.text,
            type: req.body.type || 'comment',
            position: req.body.position,
            parentId: req.body.parentId
        }, req.userId);
        
        res.status(201).json({
            success: true,
            data: comment
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get comments for content
 * GET /api/content/:id/comments
 */
router.get('/:id/comments', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const filters = {
            status: req.query.status,
            type: req.query.type,
            userId: req.query.userId,
            includeReplies: req.query.includeReplies !== 'false',
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };
        
        const comments = await collaborationEngine.getComments(contentId, filters);
        
        res.json({
            success: true,
            data: comments
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Reply to comment
 * POST /api/content/:id/comments/:commentId/reply
 */
router.post('/:id/comments/:commentId/reply', validateRequest(['text']), async (req, res, next) => {
    try {
        const { id: contentId, commentId } = req.params;
        
        const reply = await collaborationEngine.replyToComment(commentId, {
            text: req.body.text
        }, req.userId);
        
        res.status(201).json({
            success: true,
            data: reply
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Resolve comment
 * PUT /api/content/:id/comments/:commentId/resolve
 */
router.put('/:id/comments/:commentId/resolve', async (req, res, next) => {
    try {
        const { id: contentId, commentId } = req.params;
        
        const result = await collaborationEngine.resolveComment(commentId, req.body.resolution, req.userId);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// WORKFLOW MANAGEMENT
// =============================================================================

/**
 * Initialize workflow for content
 * POST /api/content/:id/workflow
 */
router.post('/:id/workflow', validateRequest(['workflowType']), async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const workflow = await collaborationEngine.initializeWorkflow(contentId, req.body.workflowType, {
            name: req.body.name,
            reviewers: req.body.reviewers,
            approvers: req.body.approvers,
            dueDate: req.body.dueDate,
            priority: req.body.priority
        });
        
        res.status(201).json({
            success: true,
            data: workflow
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Advance workflow step
 * POST /api/content/:id/workflow/:workflowId/advance
 */
router.post('/:id/workflow/:workflowId/advance', validateRequest(['decision']), async (req, res, next) => {
    try {
        const { id: contentId, workflowId } = req.params;
        
        const result = await collaborationEngine.advanceWorkflow(workflowId, {
            action: req.body.decision,
            comment: req.body.comment
        }, req.userId);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get workflow status
 * GET /api/content/:id/workflow
 */
router.get('/:id/workflow', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const workflow = await collaborationEngine.getWorkflowStatus(contentId);
        
        res.json({
            success: true,
            data: workflow
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// AI-POWERED FEATURES
// =============================================================================

/**
 * Analyze content with AI
 * POST /api/content/:id/analyze
 */
router.post('/:id/analyze', async (req, res, next) => {
    try {
        const span = tracer.startSpan('content_api_ai_analyze');
        
        const contentId = req.params.id;
        
        // Get content
        const content = await contentEngine.getContent(contentId);
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
        
        // Perform AI analysis
        const analysis = await contentAI.analyzeContent(contentId, content.content, {
            metadata: content.metadata,
            enableSEO: req.body.enableSEO !== false,
            enableSentiment: req.body.enableSentiment !== false,
            enableReadability: req.body.enableReadability !== false,
            enableDuplicateCheck: req.body.enableDuplicateCheck !== false
        });
        
        span.setAttributes({
            'content.id': contentId,
            'analysis.seo_score': analysis.seo?.score || 0,
            'analysis.readability_score': analysis.readability?.score || 0,
            'analysis.overall_score': analysis.overall?.score || 0
        });
        
        span.end();
        
        res.json({
            success: true,
            data: analysis
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Optimize content with AI
 * POST /api/content/:id/optimize
 */
router.post('/:id/optimize', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        // Get content and analysis
        const content = await contentEngine.getContent(contentId);
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
        
        // Get or perform analysis
        let analysis = req.body.analysis;
        if (!analysis) {
            analysis = await contentAI.analyzeContent(contentId, content.content);
        }
        
        // Optimize content
        const optimization = await contentAI.optimizeContent(contentId, content.content, analysis, {
            goals: req.body.goals,
            preserveStyle: req.body.preserveStyle !== false,
            userId: req.userId
        });
        
        res.json({
            success: true,
            data: optimization
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Generate content summary
 * POST /api/content/:id/summarize
 */
router.post('/:id/summarize', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const content = await contentEngine.getContent(contentId);
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found'
            });
        }
        
        const summary = await contentAI.generateSummary(content.content, {
            length: req.body.length || 'medium',
            style: req.body.style || 'neutral'
        });
        
        res.json({
            success: true,
            data: summary
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// PUBLISHING SYSTEM
// =============================================================================

/**
 * Publish content to channels
 * POST /api/content/:id/publish
 */
router.post('/:id/publish', validateRequest(['channels']), async (req, res, next) => {
    try {
        const span = tracer.startSpan('content_api_publish_content');
        
        const contentId = req.params.id;
        
        const publication = await publishingEngine.publishContent(contentId, req.body.channels, {
            immediate: req.body.immediate !== false,
            userId: req.userId,
            priority: req.body.priority || 'normal',
            metadata: req.body.metadata
        });
        
        span.setAttributes({
            'publication.id': publication.id,
            'content.id': contentId,
            'publication.channels': req.body.channels.length,
            'publication.status': publication.status
        });
        
        span.end();
        
        res.json({
            success: true,
            data: publication
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Schedule content publication
 * POST /api/content/:id/schedule
 */
router.post('/:id/schedule', validateRequest(['channels', 'scheduleTime']), async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const scheduledPublication = await publishingEngine.schedulePublication(
            contentId,
            req.body.channels,
            req.body.scheduleTime,
            {
                userId: req.userId,
                recurring: req.body.recurring,
                recurrencePattern: req.body.recurrencePattern,
                metadata: req.body.metadata
            }
        );
        
        res.json({
            success: true,
            data: scheduledPublication
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get publication status
 * GET /api/content/:id/publications
 */
router.get('/:id/publications', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const publications = await publishingEngine.getPublicationStatus(contentId);
        
        res.json({
            success: true,
            data: publications
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Rollback publication
 * POST /api/content/:id/publications/:publicationId/rollback
 */
router.post('/:id/publications/:publicationId/rollback', async (req, res, next) => {
    try {
        const { id: contentId, publicationId } = req.params;
        
        const rollback = await publishingEngine.rollbackPublication(publicationId, {
            userId: req.userId,
            reason: req.body.reason
        });
        
        res.json({
            success: true,
            data: rollback
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Bulk publish multiple content items
 * POST /api/content/bulk/publish
 */
router.post('/bulk/publish', validateRequest(['publications']), async (req, res, next) => {
    try {
        const bulkOperation = await publishingEngine.bulkPublish(req.body.publications, {
            batchSize: req.body.batchSize,
            batchDelay: req.body.batchDelay,
            userId: req.userId
        });
        
        res.json({
            success: true,
            data: bulkOperation
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Bulk update content items
 * PUT /api/content/bulk/update
 */
router.put('/bulk/update', validateRequest(['contentIds', 'updates']), async (req, res, next) => {
    try {
        const { contentIds, updates } = req.body;
        const results = [];
        
        for (const contentId of contentIds) {
            try {
                const result = await contentEngine.updateContent(contentId, updates, {
                    userId: req.userId,
                    createVersion: req.body.createVersion !== false
                });
                results.push({
                    contentId,
                    status: 'success',
                    data: result
                });
            } catch (error) {
                results.push({
                    contentId,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            data: {
                total: contentIds.length,
                successful: results.filter(r => r.status === 'success').length,
                failed: results.filter(r => r.status === 'failed').length,
                results
            }
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Bulk analyze content items
 * POST /api/content/bulk/analyze
 */
router.post('/bulk/analyze', validateRequest(['contentIds']), async (req, res, next) => {
    try {
        const { contentIds } = req.body;
        const results = [];
        
        for (const contentId of contentIds) {
            try {
                const content = await contentEngine.getContent(contentId);
                if (content) {
                    const analysis = await contentAI.analyzeContent(contentId, content.content);
                    results.push({
                        contentId,
                        status: 'success',
                        data: analysis
                    });
                } else {
                    results.push({
                        contentId,
                        status: 'failed',
                        error: 'Content not found'
                    });
                }
            } catch (error) {
                results.push({
                    contentId,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            data: {
                total: contentIds.length,
                successful: results.filter(r => r.status === 'success').length,
                failed: results.filter(r => r.status === 'failed').length,
                results
            }
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// MEDIA AND ATTACHMENTS
// =============================================================================

/**
 * Upload media attachment
 * POST /api/content/:id/media
 */
router.post('/:id/media', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }
        
        const contentId = req.params.id;
        
        const mediaAsset = await contentEngine.addMediaAsset(contentId, {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            buffer: req.file.buffer,
            description: req.body.description,
            altText: req.body.altText,
            userId: req.userId
        });
        
        res.status(201).json({
            success: true,
            data: mediaAsset
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get media assets for content
 * GET /api/content/:id/media
 */
router.get('/:id/media', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        
        const mediaAssets = await contentEngine.getMediaAssets(contentId);
        
        res.json({
            success: true,
            data: mediaAssets
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// ANALYTICS AND METRICS
// =============================================================================

/**
 * Get content analytics
 * GET /api/content/:id/analytics
 */
router.get('/:id/analytics', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        const timeframe = req.query.timeframe || '30d';
        
        const analytics = await contentEngine.getContentAnalytics(contentId, {
            timeframe,
            includeEngagement: req.query.includeEngagement === 'true',
            includePerformance: req.query.includePerformance === 'true'
        });
        
        res.json({
            success: true,
            data: analytics
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get content management dashboard metrics
 * GET /api/content/metrics/dashboard
 */
router.get('/metrics/dashboard', async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe || '7d';
        
        const metrics = {
            content: await contentEngine.getDashboardMetrics(timeframe),
            collaboration: collaborationEngine.getStatistics(),
            ai: contentAI.getStatistics(),
            publishing: publishingEngine.getStatistics()
        };
        
        res.json({
            success: true,
            data: metrics
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// SEARCH AND DISCOVERY
// =============================================================================

/**
 * Search content
 * GET /api/content/search
 */
router.get('/search', async (req, res, next) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        
        const results = await contentEngine.searchContent(query, {
            filters: {
                contentType: req.query.type,
                status: req.query.status,
                tags: req.query.tags ? req.query.tags.split(',') : undefined
            },
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
            includeHighlights: req.query.includeHighlights === 'true'
        });
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * Get content recommendations
 * GET /api/content/:id/recommendations
 */
router.get('/:id/recommendations', async (req, res, next) => {
    try {
        const contentId = req.params.id;
        const limit = parseInt(req.query.limit) || 10;
        
        const recommendations = await contentEngine.getContentRecommendations(contentId, {
            limit,
            includeReasons: req.query.includeReasons === 'true'
        });
        
        res.json({
            success: true,
            data: recommendations
        });
        
    } catch (error) {
        next(error);
    }
});

// =============================================================================
// SYSTEM STATUS AND HEALTH
// =============================================================================

/**
 * Get content management system status
 * GET /api/content/status
 */
router.get('/status', async (req, res, next) => {
    try {
        const status = {
            contentEngine: {
                initialized: contentEngine?.initialized || false,
                statistics: contentEngine?.getStatistics() || {}
            },
            collaborationEngine: {
                initialized: collaborationEngine?.initialized || false,
                statistics: collaborationEngine?.getStatistics() || {}
            },
            contentAI: {
                initialized: contentAI?.initialized || false,
                statistics: contentAI?.getStatistics() || {}
            },
            publishingEngine: {
                initialized: publishingEngine?.initialized || false,
                statistics: publishingEngine?.getStatistics() || {}
            },
            timestamp: Date.now()
        };
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        next(error);
    }
});

// Apply error handling middleware
router.use(handleError);

export { router, initializeServices };
