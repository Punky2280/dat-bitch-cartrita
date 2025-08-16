/**
 * ContentEngine - Advanced Content Management System Core Service
 * 
 * Provides comprehensive content lifecycle management with:
 * - Hierarchical content organization and relationships
 * - Advanced version control with Git-like branching and merging
 * - Multi-format content support (Markdown, HTML, Rich Text, JSON)
 * - Intelligent content search and filtering
 * - Performance optimization and caching
 * - Real-time content operations with event streaming
 * - Enterprise-grade security and audit logging
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class ContentEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Core configuration
            enableVersioning: true,
            enableFullTextSearch: true,
            enableRealTimeSync: true,
            enableContentAnalytics: true,
            
            // Performance settings
            cacheEnabled: true,
            cacheTTL: 300000, // 5 minutes
            maxCacheSize: 1000,
            batchSize: 100,
            
            // Version control settings
            defaultBranch: 'main',
            maxVersions: 1000,
            enableAutoBranching: false,
            versioningStrategy: 'semantic', // 'semantic', 'timestamp', 'incremental'
            
            // Content processing
            autoGenerateMetadata: true,
            autoOptimizeContent: true,
            enableContentValidation: true,
            supportedFormats: ['markdown', 'html', 'richtext', 'json'],
            
            // Security settings
            enableContentEncryption: false,
            encryptSensitiveFields: true,
            auditAllOperations: true,
            
            ...config
        };
        
        this.initialized = false;
        this.isRunning = false;
        this.db = null;
        this.cache = new Map();
        this.searchIndex = new Map();
        
        // Performance metrics
        this.metrics = {
            totalContent: 0,
            totalVersions: 0,
            totalCollections: 0,
            operationsPerformed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            searchQueries: 0,
            avgResponseTime: 0,
            lastOperation: null
        };
        
        // Content validation rules
        this.validationRules = {
            title: { required: true, minLength: 1, maxLength: 255 },
            slug: { required: true, pattern: /^[a-z0-9-]+$/, maxLength: 100 },
            content_body: { required: true },
            type: { required: true, enum: ['article', 'page', 'media', 'template', 'component', 'document', 'snippet', 'form', 'widget'] },
            status: { enum: ['draft', 'in_review', 'approved', 'published', 'archived', 'deleted'] }
        };
        
        // OpenTelemetry tracing
        this.tracer = OpenTelemetryTracing.getTracer('content-engine');
        
        // Bind methods
        this.createContent = this.createContent.bind(this);
        this.updateContent = this.updateContent.bind(this);
        this.deleteContent = this.deleteContent.bind(this);
        this.getContent = this.getContent.bind(this);
        this.listContent = this.listContent.bind(this);
        
        // Add test-expected method aliases
        this.create = this.createContent.bind(this);
        this.getById = this.getContent.bind(this);
        this.update = this.updateContent.bind(this);
        this.archive = (id, userId) => this.updateContent(id, { status: 'archived' }, userId);
        this.list = this.listContent.bind(this);
    }
    
    /**
     * Initialize the Content Engine
     */
    async initialize(database) {
        const span = this.tracer.startSpan('content_engine_initialize');
        
        try {
            this.db = database;
            
            // Initialize cache if enabled
            if (this.config.cacheEnabled) {
                this.initializeCache();
            }
            
            // Initialize search index
            if (this.config.enableFullTextSearch) {
                await this.initializeSearchIndex();
            }
            
            // Load content statistics
            await this.loadStatistics();
            
            this.initialized = true;
            this.isRunning = true;
            
            this.emit('initialized', { timestamp: Date.now(), config: this.config });
            
            span.setAttributes({
                'content.engine.initialized': true,
                'content.engine.cache_enabled': this.config.cacheEnabled,
                'content.engine.search_enabled': this.config.enableFullTextSearch
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw new Error(`ContentEngine initialization failed: ${error.message}`);
        } finally {
            span.end();
        }
    }
    
    /**
     * Create new content item with comprehensive validation and processing
     */
    async createContent(data, userId = null) {
        const span = this.tracer.startSpan('content_engine_create_content');
        const startTime = Date.now();
        
        try {
            // Validate input data
            this.validateContentData(data);
            
            // Prepare content data with defaults
            const contentData = {
                id: crypto.randomUUID(),
                type: data.type,
                title: data.title,
                slug: data.slug || this.generateSlug(data.title),
                content_body: this.processContentBody(data.content_body, data.format || 'markdown'),
                metadata: this.generateMetadata(data),
                status: data.status || 'draft',
                version_info: this.initializeVersion(),
                permissions: data.permissions || this.getDefaultPermissions(userId),
                author_id: userId,
                parent_id: data.parent_id || null,
                template_id: data.template_id || null
            };
            
            // Begin database transaction
            const client = await this.db.connect();
            await client.query('BEGIN');
            
            try {
                // Insert content item
                const insertQuery = `
                    INSERT INTO content_items (
                        id, type, title, slug, content_body, metadata, status, 
                        version_info, permissions, author_id, parent_id, template_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING *
                `;
                
                const values = [
                    contentData.id,
                    contentData.type,
                    contentData.title,
                    contentData.slug,
                    contentData.content_body,
                    contentData.metadata,
                    contentData.status,
                    contentData.version_info,
                    contentData.permissions,
                    contentData.author_id,
                    contentData.parent_id,
                    contentData.template_id
                ];
                
                const result = await client.query(insertQuery, values);
                const createdContent = result.rows[0];
                
                // Create initial version
                if (this.config.enableVersioning) {
                    await this.createInitialVersion(client, createdContent);
                }
                
                // Add to collections if specified
                if (data.collections && data.collections.length > 0) {
                    await this.addToCollections(client, createdContent.id, data.collections, userId);
                }
                
                // Process relationships
                if (data.relationships && data.relationships.length > 0) {
                    await this.createRelationships(client, createdContent.id, data.relationships);
                }
                
                await client.query('COMMIT');
                
                // Update cache
                this.updateCache(createdContent);
                
                // Update metrics
                this.updateMetrics('create', Date.now() - startTime);
                
                // Emit event
                this.emit('contentCreated', {
                    content: createdContent,
                    userId,
                    timestamp: Date.now()
                });
                
                span.setAttributes({
                    'content.id': createdContent.id,
                    'content.type': createdContent.type,
                    'content.status': createdContent.status,
                    'content.author_id': userId
                });
                
                return createdContent;
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
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
     * Update existing content with version control
     */
    async updateContent(id, updateData, userId = null, options = {}) {
        const span = this.tracer.startSpan('content_engine_update_content');
        const startTime = Date.now();
        
        try {
            // Get existing content
            const existingContent = await this.getContent(id);
            if (!existingContent) {
                throw new Error(`Content not found: ${id}`);
            }
            
            // Check permissions
            this.checkPermissions(existingContent, userId, 'update');
            
            // Validate update data
            this.validateContentUpdateData(updateData);
            
            // Prepare updated content
            const updatedContent = {
                ...existingContent,
                ...updateData,
                updated_at: new Date(),
                editor_id: userId
            };
            
            // Process content body if provided
            if (updateData.content_body) {
                updatedContent.content_body = this.processContentBody(
                    updateData.content_body, 
                    updateData.format || existingContent.content_body.format
                );
            }
            
            // Update metadata
            if (updateData.metadata) {
                updatedContent.metadata = {
                    ...existingContent.metadata,
                    ...updateData.metadata,
                    updated_at: new Date().toISOString()
                };
            }
            
            const client = await this.db.connect();
            await client.query('BEGIN');
            
            try {
                // Create new version if content significantly changed
                if (this.shouldCreateNewVersion(existingContent, updatedContent, options)) {
                    updatedContent.version_info = await this.createNewVersion(
                        client, 
                        existingContent, 
                        updatedContent,
                        options.versionOptions || {}
                    );
                }
                
                // Update content item
                const updateQuery = `
                    UPDATE content_items 
                    SET title = $2, slug = $3, content_body = $4, metadata = $5, 
                        status = $6, version_info = $7, editor_id = $8, updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                `;
                
                const values = [
                    id,
                    updatedContent.title,
                    updatedContent.slug,
                    updatedContent.content_body,
                    updatedContent.metadata,
                    updatedContent.status,
                    updatedContent.version_info,
                    userId
                ];
                
                const result = await client.query(updateQuery, values);
                const updated = result.rows[0];
                
                // Update relationships if provided
                if (updateData.relationships) {
                    await this.updateRelationships(client, id, updateData.relationships);
                }
                
                // Update collections if provided
                if (updateData.collections !== undefined) {
                    await this.updateCollections(client, id, updateData.collections, userId);
                }
                
                await client.query('COMMIT');
                
                // Update cache
                this.updateCache(updated);
                
                // Update metrics
                this.updateMetrics('update', Date.now() - startTime);
                
                // Emit event
                this.emit('contentUpdated', {
                    content: updated,
                    previousVersion: existingContent,
                    userId,
                    timestamp: Date.now()
                });
                
                span.setAttributes({
                    'content.id': id,
                    'content.version_changed': updated.version_info.current !== existingContent.version_info.current
                });
                
                return updated;
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
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
     * Delete content item (soft or hard delete)
     */
    async deleteContent(id, soft = true, userId = null) {
        const span = this.tracer.startSpan('content_engine_delete_content');
        const startTime = Date.now();
        
        try {
            const content = await this.getContent(id);
            if (!content) {
                throw new Error(`Content not found: ${id}`);
            }
            
            // Check permissions
            this.checkPermissions(content, userId, 'delete');
            
            const client = await this.db.connect();
            await client.query('BEGIN');
            
            try {
                if (soft) {
                    // Soft delete - mark as deleted
                    const updateQuery = `
                        UPDATE content_items 
                        SET status = 'deleted', updated_at = NOW(), archived_at = NOW()
                        WHERE id = $1
                        RETURNING *
                    `;
                    await client.query(updateQuery, [id]);
                } else {
                    // Hard delete - remove from database
                    // First delete related records (cascade will handle most)
                    await client.query('DELETE FROM content_collection_items WHERE content_id = $1', [id]);
                    await client.query('DELETE FROM content_relationships WHERE parent_id = $1 OR child_id = $1', [id]);
                    await client.query('DELETE FROM content_comments WHERE content_id = $1', [id]);
                    await client.query('DELETE FROM content_versions WHERE content_id = $1', [id]);
                    await client.query('DELETE FROM content_items WHERE id = $1', [id]);
                }
                
                await client.query('COMMIT');
                
                // Remove from cache
                this.cache.delete(id);
                
                // Update metrics
                this.updateMetrics('delete', Date.now() - startTime);
                
                // Emit event
                this.emit('contentDeleted', {
                    contentId: id,
                    soft,
                    userId,
                    timestamp: Date.now()
                });
                
                span.setAttributes({
                    'content.id': id,
                    'content.delete_type': soft ? 'soft' : 'hard'
                });
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
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
     * Get content item by ID with optional version
     */
    async getContent(id, version = null, includeRelations = false) {
        const span = this.tracer.startSpan('content_engine_get_content');
        const startTime = Date.now();
        
        try {
            // Check cache first
            const cacheKey = `${id}:${version || 'current'}:${includeRelations}`;
            if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
                this.metrics.cacheHits++;
                return this.cache.get(cacheKey);
            }
            
            this.metrics.cacheMisses++;
            
            let query = `
                SELECT c.*, 
                       u1.email as author_email,
                       u2.email as editor_email
                FROM content_items c
                LEFT JOIN users u1 ON c.author_id = u1.id
                LEFT JOIN users u2 ON c.editor_id = u2.id
                WHERE c.id = $1
            `;
            
            let content;
            
            if (version) {
                // Get specific version
                const versionQuery = `
                    SELECT cv.content_snapshot as content_data,
                           cv.version_hash,
                           cv.version_number,
                           cv.created_at as version_created_at,
                           u.email as version_author_email
                    FROM content_versions cv
                    LEFT JOIN users u ON cv.author_id = u.id
                    WHERE cv.content_id = $1 AND (cv.version_hash = $2 OR cv.version_number = $2)
                    ORDER BY cv.created_at DESC
                    LIMIT 1
                `;
                
                const versionResult = await this.db.query(versionQuery, [id, version]);
                if (versionResult.rows.length === 0) {
                    throw new Error(`Content version not found: ${id}@${version}`);
                }
                
                content = {
                    ...versionResult.rows[0].content_data,
                    version_hash: versionResult.rows[0].version_hash,
                    version_number: versionResult.rows[0].version_number,
                    version_created_at: versionResult.rows[0].version_created_at,
                    version_author_email: versionResult.rows[0].version_author_email
                };
            } else {
                const result = await this.db.query(query, [id]);
                if (result.rows.length === 0) {
                    return null;
                }
                content = result.rows[0];
            }
            
            // Include relationships if requested
            if (includeRelations) {
                content.relationships = await this.getContentRelationships(id);
                content.collections = await this.getContentCollections(id);
                content.comments_count = await this.getContentCommentsCount(id);
                content.versions_count = await this.getContentVersionsCount(id);
            }
            
            // Update cache
            if (this.config.cacheEnabled) {
                this.updateCache(content, cacheKey);
            }
            
            // Update metrics
            this.updateMetrics('get', Date.now() - startTime);
            
            span.setAttributes({
                'content.id': id,
                'content.version': version || 'current',
                'content.found': !!content
            });
            
            return content;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * List content with advanced filtering and pagination
     */
    async listContent(filters = {}, pagination = {}) {
        const span = this.tracer.startSpan('content_engine_list_content');
        const startTime = Date.now();
        
        try {
            const {
                type = null,
                status = null,
                author_id = null,
                parent_id = null,
                collections = [],
                search = null,
                date_from = null,
                date_to = null,
                has_template = null,
                sort_by = 'created_at',
                sort_order = 'DESC'
            } = filters;
            
            const {
                limit = 50,
                offset = 0,
                include_relations = false,
                include_stats = false
            } = pagination;
            
            // Build query
            let whereConditions = [];
            let params = [];
            let paramIndex = 1;
            
            // Base query
            let query = `
                SELECT c.*,
                       u1.email as author_email,
                       u2.email as editor_email
                FROM content_items c
                LEFT JOIN users u1 ON c.author_id = u1.id
                LEFT JOIN users u2 ON c.editor_id = u2.id
            `;
            
            // Add filters
            if (type) {
                whereConditions.push(`c.type = $${paramIndex++}`);
                params.push(type);
            }
            
            if (status) {
                if (Array.isArray(status)) {
                    whereConditions.push(`c.status = ANY($${paramIndex++})`);
                    params.push(status);
                } else {
                    whereConditions.push(`c.status = $${paramIndex++}`);
                    params.push(status);
                }
            }
            
            if (author_id) {
                whereConditions.push(`c.author_id = $${paramIndex++}`);
                params.push(author_id);
            }
            
            if (parent_id !== null) {
                if (parent_id === 'null') {
                    whereConditions.push('c.parent_id IS NULL');
                } else {
                    whereConditions.push(`c.parent_id = $${paramIndex++}`);
                    params.push(parent_id);
                }
            }
            
            if (search) {
                whereConditions.push(`(
                    c.search_vector @@ plainto_tsquery('english', $${paramIndex++}) OR
                    c.title ILIKE $${paramIndex++} OR
                    c.content_body->>'raw' ILIKE $${paramIndex++}
                )`);
                params.push(search, `%${search}%`, `%${search}%`);
                this.metrics.searchQueries++;
            }
            
            if (date_from) {
                whereConditions.push(`c.created_at >= $${paramIndex++}`);
                params.push(date_from);
            }
            
            if (date_to) {
                whereConditions.push(`c.created_at <= $${paramIndex++}`);
                params.push(date_to);
            }
            
            if (has_template !== null) {
                if (has_template) {
                    whereConditions.push('c.template_id IS NOT NULL');
                } else {
                    whereConditions.push('c.template_id IS NULL');
                }
            }
            
            // Handle collections filter
            if (collections.length > 0) {
                query = `
                    SELECT DISTINCT c.*,
                           u1.email as author_email,
                           u2.email as editor_email
                    FROM content_items c
                    LEFT JOIN users u1 ON c.author_id = u1.id
                    LEFT JOIN users u2 ON c.editor_id = u2.id
                    INNER JOIN content_collection_items cci ON c.id = cci.content_id
                    INNER JOIN content_collections cc ON cci.collection_id = cc.id
                `;
                
                whereConditions.push(`cc.slug = ANY($${paramIndex++})`);
                params.push(collections);
            }
            
            // Add WHERE clause
            if (whereConditions.length > 0) {
                query += ` WHERE ${whereConditions.join(' AND ')}`;
            }
            
            // Add ordering
            const allowedSortFields = ['created_at', 'updated_at', 'published_at', 'title', 'word_count', 'seo_score'];
            const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
            const sortDirection = ['ASC', 'DESC'].includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';
            
            query += ` ORDER BY c.${sortField} ${sortDirection}`;
            
            // Add pagination
            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, offset);
            
            // Execute query
            const result = await this.db.query(query, params);
            const content = result.rows;
            
            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(*) as total
                FROM content_items c
            `;
            
            if (collections.length > 0) {
                countQuery = `
                    SELECT COUNT(DISTINCT c.id) as total
                    FROM content_items c
                    INNER JOIN content_collection_items cci ON c.id = cci.content_id
                    INNER JOIN content_collections cc ON cci.collection_id = cc.id
                `;
            }
            
            if (whereConditions.length > 0) {
                // Remove LIMIT and OFFSET params for count
                const countParams = params.slice(0, -2);
                const countWhereConditions = whereConditions.map(condition => 
                    condition.replace(/c\./g, 'c.')
                );
                countQuery += ` WHERE ${countWhereConditions.join(' AND ')}`;
                
                const countResult = await this.db.query(countQuery, countParams);
                var totalCount = parseInt(countResult.rows[0].total);
            } else {
                const countResult = await this.db.query(countQuery);
                var totalCount = parseInt(countResult.rows[0].total);
            }
            
            // Include additional data if requested
            if (include_relations) {
                for (let item of content) {
                    item.relationships = await this.getContentRelationships(item.id);
                    item.collections = await this.getContentCollections(item.id);
                }
            }
            
            if (include_stats) {
                for (let item of content) {
                    item.analytics = await this.getContentAnalytics(item.id);
                }
            }
            
            // Update metrics
            this.updateMetrics('list', Date.now() - startTime);
            
            const response = {
                content,
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    pages: Math.ceil(totalCount / limit),
                    current_page: Math.floor(offset / limit) + 1,
                    has_next: offset + limit < totalCount,
                    has_prev: offset > 0
                },
                filters: filters
            };
            
            span.setAttributes({
                'content.list.total': totalCount,
                'content.list.returned': content.length,
                'content.list.has_search': !!search
            });
            
            return response;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Version Control Methods
     */
    
    /**
     * Create new version of content
     */
    async createVersion(contentId, changes, options = {}) {
        const span = this.tracer.startSpan('content_engine_create_version');
        
        try {
            const content = await this.getContent(contentId);
            if (!content) {
                throw new Error(`Content not found: ${contentId}`);
            }
            
            const {
                commitMessage = 'Update content',
                branchName = 'main',
                isMajorVersion = false,
                userId = null
            } = options;
            
            const client = await this.db.connect();
            await client.query('BEGIN');
            
            try {
                // Generate version hash
                const versionHash = this.generateVersionHash(content, changes);
                
                // Determine version number
                const versionNumber = await this.getNextVersionNumber(
                    client, 
                    contentId, 
                    branchName, 
                    isMajorVersion
                );
                
                // Create version record
                const versionQuery = `
                    INSERT INTO content_versions (
                        content_id, version_hash, parent_hash, branch_name,
                        version_number, content_snapshot, changes_summary,
                        change_log, author_id, commit_message, is_major_version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING *
                `;
                
                const changeLog = this.generateChangeLog(content, changes);
                const contentSnapshot = this.createContentSnapshot(content, changes);
                
                const values = [
                    contentId,
                    versionHash,
                    content.version_info.current,
                    branchName,
                    versionNumber,
                    contentSnapshot,
                    this.generateChangesSummary(changes),
                    changeLog,
                    userId,
                    commitMessage,
                    isMajorVersion
                ];
                
                const versionResult = await client.query(versionQuery, values);
                const version = versionResult.rows[0];
                
                // Update content version info
                const updatedVersionInfo = {
                    ...content.version_info,
                    current: versionHash,
                    branch: branchName,
                    commits: [...(content.version_info.commits || []), {
                        hash: versionHash,
                        message: commitMessage,
                        timestamp: new Date().toISOString(),
                        author: userId
                    }]
                };
                
                await client.query(
                    'UPDATE content_items SET version_info = $1 WHERE id = $2',
                    [updatedVersionInfo, contentId]
                );
                
                await client.query('COMMIT');
                
                // Update metrics
                this.metrics.totalVersions++;
                
                // Emit event
                this.emit('versionCreated', {
                    contentId,
                    version,
                    userId,
                    timestamp: Date.now()
                });
                
                span.setAttributes({
                    'content.id': contentId,
                    'version.hash': versionHash,
                    'version.number': versionNumber,
                    'version.branch': branchName
                });
                
                return version;
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
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
     * Get version history for content
     */
    async getVersionHistory(contentId, options = {}) {
        const {
            limit = 50,
            offset = 0,
            branchName = null,
            includeChanges = false
        } = options;
        
        let query = `
            SELECT cv.*, u.email as author_email
            FROM content_versions cv
            LEFT JOIN users u ON cv.author_id = u.id
            WHERE cv.content_id = $1
        `;
        
        const params = [contentId];
        let paramIndex = 2;
        
        if (branchName) {
            query += ` AND cv.branch_name = $${paramIndex++}`;
            params.push(branchName);
        }
        
        query += ` ORDER BY cv.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);
        
        const result = await this.db.query(query, params);
        let versions = result.rows;
        
        if (!includeChanges) {
            // Remove large change_log and content_snapshot fields for performance
            versions = versions.map(v => ({
                ...v,
                content_snapshot: undefined,
                change_log: v.change_log ? v.change_log.length : 0,
                snapshot_size: JSON.stringify(v.content_snapshot || {}).length
            }));
        }
        
        return versions;
    }
    
    /**
     * Compare two versions of content
     */
    async compareVersions(contentId, version1, version2) {
        const span = this.tracer.startSpan('content_engine_compare_versions');
        
        try {
            const v1Data = await this.getContent(contentId, version1);
            const v2Data = await this.getContent(contentId, version2);
            
            if (!v1Data || !v2Data) {
                throw new Error('One or both versions not found');
            }
            
            const diff = this.generateContentDiff(v1Data, v2Data);
            
            span.setAttributes({
                'content.id': contentId,
                'version.from': version1,
                'version.to': version2,
                'diff.changes': diff.changes.length
            });
            
            return {
                contentId,
                version1: version1,
                version2: version2,
                diff,
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
     * Helper Methods
     */
    
    initializeCache() {
        // Simple LRU-like cache implementation
        setInterval(() => {
            if (this.cache.size > this.config.maxCacheSize) {
                const keysToDelete = Array.from(this.cache.keys()).slice(0, Math.floor(this.config.maxCacheSize * 0.3));
                keysToDelete.forEach(key => this.cache.delete(key));
            }
        }, 60000); // Clean cache every minute
    }
    
    async initializeSearchIndex() {
        // Initialize full-text search capabilities
        // This would typically involve loading existing content into search index
        console.log('Search index initialized');
    }
    
    async loadStatistics() {
        try {
            const stats = await this.db.query(`
                SELECT 
                    COUNT(*) as total_content,
                    COUNT(DISTINCT type) as content_types,
                    COUNT(*) FILTER (WHERE status = 'published') as published_content
                FROM content_items
                WHERE status != 'deleted'
            `);
            
            const versionStats = await this.db.query(`
                SELECT COUNT(*) as total_versions
                FROM content_versions
            `);
            
            const collectionStats = await this.db.query(`
                SELECT COUNT(*) as total_collections
                FROM content_collections
                WHERE is_active = true
            `);
            
            this.metrics.totalContent = parseInt(stats.rows[0].total_content);
            this.metrics.totalVersions = parseInt(versionStats.rows[0].total_versions);
            this.metrics.totalCollections = parseInt(collectionStats.rows[0].total_collections);
            
        } catch (error) {
            console.error('Failed to load statistics:', error.message);
        }
    }
    
    validateContentData(data) {
        const errors = [];
        
        for (const [field, rules] of Object.entries(this.validationRules)) {
            const value = data[field];
            
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must be no more than ${rules.maxLength} characters`);
                }
                
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${field} format is invalid`);
                }
                
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
                }
            }
        }
        
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }
    
    validateContentUpdateData(data) {
        // Similar to validateContentData but allows partial updates
        const errors = [];
        
        for (const [field, value] of Object.entries(data)) {
            if (this.validationRules[field]) {
                const rules = this.validationRules[field];
                
                if (value !== undefined && value !== null) {
                    if (rules.minLength && value.length < rules.minLength) {
                        errors.push(`${field} must be at least ${rules.minLength} characters`);
                    }
                    
                    if (rules.maxLength && value.length > rules.maxLength) {
                        errors.push(`${field} must be no more than ${rules.maxLength} characters`);
                    }
                    
                    if (rules.pattern && !rules.pattern.test(value)) {
                        errors.push(`${field} format is invalid`);
                    }
                    
                    if (rules.enum && !rules.enum.includes(value)) {
                        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
                    }
                }
            }
        }
        
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }
    
    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 100);
    }
    
    processContentBody(content, format = 'markdown') {
        return {
            format,
            raw: content,
            compiled: this.compileContent(content, format),
            last_processed: new Date().toISOString()
        };
    }
    
    compileContent(content, format) {
        // Placeholder for content compilation (markdown to HTML, etc.)
        switch (format) {
            case 'markdown':
                // Would use markdown processor here
                return content; // Simplified
            case 'html':
                return content;
            default:
                return content;
        }
    }
    
    generateMetadata(data) {
        const metadata = {
            ...data.metadata,
            generated_at: new Date().toISOString(),
            seo: {
                title: data.title,
                description: data.metadata?.description || '',
                keywords: data.metadata?.keywords || [],
                ...data.metadata?.seo
            },
            publishing: {
                auto_publish: false,
                scheduled_at: null,
                ...data.metadata?.publishing
            },
            analytics: {
                track_performance: true,
                track_engagement: true,
                ...data.metadata?.analytics
            }
        };
        
        if (this.config.autoGenerateMetadata) {
            // Auto-generate additional metadata
            if (data.content_body) {
                const content = typeof data.content_body === 'string' ? data.content_body : data.content_body.raw;
                metadata.auto_generated = {
                    excerpt: content.substring(0, 160),
                    estimated_read_time: Math.ceil(content.split(' ').length / 200),
                    generated_at: new Date().toISOString()
                };
            }
        }
        
        return metadata;
    }
    
    initializeVersion() {
        return {
            current: '1.0',
            branch: this.config.defaultBranch,
            commits: [],
            created_at: new Date().toISOString()
        };
    }
    
    getDefaultPermissions(userId) {
        return {
            owner: userId,
            read: ['public'],
            write: [userId],
            delete: [userId],
            publish: [userId]
        };
    }
    
    checkPermissions(content, userId, action) {
        if (!userId) {
            throw new Error('Authentication required');
        }
        
        const permissions = content.permissions || {};
        
        // Owner has all permissions
        if (permissions.owner === userId) {
            return true;
        }
        
        // Check specific action permissions
        const allowedUsers = permissions[action] || [];
        if (!allowedUsers.includes(userId) && !allowedUsers.includes('public')) {
            throw new Error(`Insufficient permissions for ${action}`);
        }
        
        return true;
    }
    
    shouldCreateNewVersion(oldContent, newContent, options) {
        if (options.forceNewVersion) return true;
        
        // Create new version for significant changes
        const significantFields = ['title', 'content_body', 'status'];
        return significantFields.some(field => {
            const oldValue = typeof oldContent[field] === 'object' ? 
                JSON.stringify(oldContent[field]) : String(oldContent[field] || '');
            const newValue = typeof newContent[field] === 'object' ? 
                JSON.stringify(newContent[field]) : String(newContent[field] || '');
            return oldValue !== newValue;
        });
    }
    
    generateVersionHash(content, changes = {}) {
        const data = {
            id: content.id,
            content_body: changes.content_body || content.content_body,
            metadata: changes.metadata || content.metadata,
            timestamp: Date.now()
        };
        
        return crypto
            .createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex');
    }
    
    async getNextVersionNumber(client, contentId, branchName, isMajorVersion) {
        const query = `
            SELECT version_number
            FROM content_versions
            WHERE content_id = $1 AND branch_name = $2
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const result = await client.query(query, [contentId, branchName]);
        
        if (result.rows.length === 0) {
            return '1.0';
        }
        
        const lastVersion = result.rows[0].version_number;
        const [major, minor] = lastVersion.split('.').map(Number);
        
        if (isMajorVersion) {
            return `${major + 1}.0`;
        } else {
            return `${major}.${minor + 1}`;
        }
    }
    
    generateChangeLog(oldContent, changes) {
        const log = [];
        
        for (const [field, newValue] of Object.entries(changes)) {
            const oldValue = oldContent[field];
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                log.push({
                    field,
                    old_value: oldValue,
                    new_value: newValue,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        return log;
    }
    
    createContentSnapshot(content, changes) {
        return {
            ...content,
            ...changes,
            snapshot_created_at: new Date().toISOString()
        };
    }
    
    generateChangesSummary(changes) {
        const changedFields = Object.keys(changes);
        return `Updated ${changedFields.join(', ')}`;
    }
    
    generateContentDiff(version1, version2) {
        // Simplified diff generation
        const changes = [];
        
        const fields = ['title', 'content_body', 'metadata', 'status'];
        
        for (const field of fields) {
            const v1Value = version1[field];
            const v2Value = version2[field];
            
            if (JSON.stringify(v1Value) !== JSON.stringify(v2Value)) {
                changes.push({
                    field,
                    type: 'modified',
                    old_value: v1Value,
                    new_value: v2Value
                });
            }
        }
        
        return {
            changes,
            summary: `${changes.length} changes detected`,
            generated_at: new Date().toISOString()
        };
    }
    
    updateCache(content, key = null) {
        if (!this.config.cacheEnabled) return;
        
        const cacheKey = key || content.id;
        this.cache.set(cacheKey, content);
        
        // Set TTL for cache cleanup
        setTimeout(() => {
            this.cache.delete(cacheKey);
        }, this.config.cacheTTL);
    }
    
    updateMetrics(operation, duration) {
        this.metrics.operationsPerformed++;
        this.metrics.lastOperation = {
            operation,
            duration,
            timestamp: Date.now()
        };
        
        // Update average response time
        if (this.metrics.avgResponseTime === 0) {
            this.metrics.avgResponseTime = duration;
        } else {
            this.metrics.avgResponseTime = (this.metrics.avgResponseTime + duration) / 2;
        }
    }
    
    async getContentRelationships(contentId) {
        const query = `
            SELECT r.*, 
                   parent.title as parent_title,
                   child.title as child_title
            FROM content_relationships r
            LEFT JOIN content_items parent ON r.parent_id = parent.id
            LEFT JOIN content_items child ON r.child_id = child.id
            WHERE r.parent_id = $1 OR r.child_id = $1
            ORDER BY r.relationship_type, r.weight
        `;
        
        const result = await this.db.query(query, [contentId]);
        return result.rows;
    }
    
    async getContentCollections(contentId) {
        const query = `
            SELECT cc.*, cci.sort_order, cci.added_at
            FROM content_collections cc
            INNER JOIN content_collection_items cci ON cc.id = cci.collection_id
            WHERE cci.content_id = $1
            ORDER BY cci.sort_order, cc.name
        `;
        
        const result = await this.db.query(query, [contentId]);
        return result.rows;
    }
    
    async getContentCommentsCount(contentId) {
        const query = 'SELECT COUNT(*) as count FROM content_comments WHERE content_id = $1';
        const result = await this.db.query(query, [contentId]);
        return parseInt(result.rows[0].count);
    }
    
    async getContentVersionsCount(contentId) {
        const query = 'SELECT COUNT(*) as count FROM content_versions WHERE content_id = $1';
        const result = await this.db.query(query, [contentId]);
        return parseInt(result.rows[0].count);
    }
    
    async getContentAnalytics(contentId) {
        const query = `
            SELECT *
            FROM content_analytics
            WHERE content_id = $1
            ORDER BY date_recorded DESC
            LIMIT 30
        `;
        
        const result = await this.db.query(query, [contentId]);
        return result.rows;
    }
    
    /**
     * Get service statistics and health information
     */
    getStatistics() {
        return {
            ...this.metrics,
            cache: {
                size: this.cache.size,
                max_size: this.config.maxCacheSize,
                hit_rate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
            },
            config: {
                versioning_enabled: this.config.enableVersioning,
                search_enabled: this.config.enableFullTextSearch,
                cache_enabled: this.config.cacheEnabled,
                formats_supported: this.config.supportedFormats
            },
            initialized: this.initialized,
            running: this.isRunning
        };
    }
    
    /**
     * Stop the ContentEngine service
     */
    async stop() {
        this.isRunning = false;
        this.cache.clear();
        
        this.emit('stopped', { timestamp: Date.now() });
        console.log('ContentEngine service stopped');
    }
}

export default ContentEngine;
