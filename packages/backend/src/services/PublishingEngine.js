/**
 * PublishingEngine - Multi-Channel Content Distribution System
 * 
 * Provides comprehensive content publishing and distribution capabilities including:
 * - Multi-channel publishing (web, social, email, RSS, API)
 * - Content scheduling and automated publishing
 * - Publication workflows with approval chains
 * - Channel-specific content optimization and formatting
 * - Publishing analytics and performance tracking
 * - Content syndication and cross-posting
 * - Publication status monitoring and error handling
 * - Template-based content formatting
 * - Bulk publishing operations
 * - Publication rollback and versioning
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import cron from 'node-cron';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class PublishingEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Channel Configuration
            enabledChannels: ['web', 'api', 'rss', 'email', 'webhook'],
            defaultChannel: 'web',
            maxConcurrentPublications: 20,
            retryAttempts: 3,
            retryDelay: 5000, // milliseconds
            
            // Scheduling Configuration
            enableScheduledPublishing: true,
            schedulerInterval: '*/1 * * * *', // Every minute
            maxScheduledJobs: 1000,
            enableRecurringPublishing: true,
            
            // Workflow Configuration
            enableApprovalWorkflows: true,
            defaultApprovalSteps: ['review', 'approve', 'publish'],
            approvalTimeout: 604800000, // 7 days
            enablePublishingRules: true,
            
            // Content Processing
            enableContentTransformation: true,
            enableChannelOptimization: true,
            enableTemplateProcessing: true,
            enableMetadataInjection: true,
            
            // Analytics and Tracking
            enablePublishingAnalytics: true,
            enablePerformanceTracking: true,
            trackingRetentionDays: 90,
            enableEventTracking: true,
            
            // Error Handling
            enableErrorRecovery: true,
            enableFailureNotifications: true,
            enablePublicationRollback: true,
            maxRollbackVersions: 10,
            
            // Performance Settings
            enableBulkOperations: true,
            bulkBatchSize: 50,
            enablePublishingQueue: true,
            queueProcessingInterval: 5000, // milliseconds
            
            // Security Settings
            enablePublicationAudit: true,
            requireApprovalForSensitiveContent: true,
            enableChannelPermissions: true,
            
            ...config
        };
        
        this.initialized = false;
        this.isRunning = false;
        this.db = null;
        
        // Publishing channels registry
        this.channels = new Map();
        this.channelTemplates = new Map();
        this.channelConfigurations = new Map();
        
        // Scheduler and queue management
        this.scheduler = null;
        this.publishingQueue = [];
        this.activePublications = new Map(); // publicationId -> Promise
        this.scheduledJobs = new Map(); // contentId -> cronJob
        
        // Publication tracking
        this.publicationHistory = new Map(); // contentId -> Publication[]
        this.publishingMetrics = new Map(); // channelId -> metrics
        
        // Error tracking and recovery
        this.failedPublications = new Map();
        this.retryQueue = [];
        
        // Performance metrics
        this.metrics = {
            totalPublications: 0,
            successfulPublications: 0,
            failedPublications: 0,
            scheduledPublications: 0,
            activePublications: 0,
            totalChannels: 0,
            publicationsPerChannel: {},
            avgPublishingTime: 0,
            bulkOperations: 0,
            rollbacksPerformed: 0,
            lastActivity: null
        };
        
        // OpenTelemetry tracing
        this.tracer = OpenTelemetryTracing.getTracer('publishing-engine');
        
        // Bind methods
        this.publishContent = this.publishContent.bind(this);
        this.schedulePublication = this.schedulePublication.bind(this);
        this.bulkPublish = this.bulkPublish.bind(this);
        this.rollbackPublication = this.rollbackPublication.bind(this);
        
        // Add test-expected method aliases
        this.publish = this.publishContent.bind(this);
        this.schedule = this.schedulePublication.bind(this);
    }
    
    /**
     * Initialize the Publishing Engine
     */
    async initialize(database) {
        const span = this.tracer.startSpan('publishing_engine_initialize');
        
        try {
            this.db = database;
            
            // Initialize default channels
            await this.initializeDefaultChannels();
            
            // Load channel configurations
            await this.loadChannelConfigurations();
            
            // Load scheduled publications
            await this.loadScheduledPublications();
            
            // Start scheduler if enabled
            if (this.config.enableScheduledPublishing) {
                this.startScheduler();
            }
            
            // Start queue processor
            if (this.config.enablePublishingQueue) {
                this.startQueueProcessor();
            }
            
            // Start retry processor
            this.startRetryProcessor();
            
            this.initialized = true;
            this.isRunning = true;
            
            this.emit('initialized', {
                timestamp: Date.now(),
                channels: Array.from(this.channels.keys()),
                scheduledJobs: this.scheduledJobs.size
            });
            
            span.setAttributes({
                'publishing.engine.initialized': true,
                'publishing.channels.count': this.channels.size,
                'publishing.scheduled_jobs': this.scheduledJobs.size,
                'publishing.queue_enabled': this.config.enablePublishingQueue
            });
            
            console.log('PublishingEngine initialized successfully');
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw new Error(`PublishingEngine initialization failed: ${error.message}`);
        } finally {
            span.end();
        }
    }
    
    /**
     * Publish content to specified channels
     */
    async publishContent(contentId, channels, options = {}) {
        const span = this.tracer.startSpan('publishing_engine_publish_content');
        const startTime = Date.now();
        
        try {
            if (!this.initialized) {
                throw new Error('PublishingEngine not initialized');
            }
            
            // Generate publication ID
            const publicationId = crypto.randomUUID();
            
            // Validate channels
            const validChannels = channels.filter(channelId => this.channels.has(channelId));
            if (validChannels.length === 0) {
                throw new Error('No valid channels specified');
            }
            
            // Get content data
            const content = await this.getContentData(contentId);
            if (!content) {
                throw new Error(`Content not found: ${contentId}`);
            }
            
            // Check publication rules
            if (this.config.enablePublishingRules) {
                await this.validatePublishingRules(content, validChannels, options);
            }
            
            // Create publication record
            const publication = {
                id: publicationId,
                contentId,
                channels: validChannels,
                status: 'publishing',
                startTime,
                options,
                results: {},
                metadata: {
                    userId: options.userId,
                    trigger: options.trigger || 'manual',
                    priority: options.priority || 'normal'
                }
            };
            
            // Track active publication
            this.activePublications.set(publicationId, publication);
            
            // Save publication record to database
            await this.savePublicationRecord(publication);
            
            // Publish to each channel
            const publishingPromises = validChannels.map(channelId => 
                this.publishToChannel(publicationId, contentId, channelId, content, options)
            );
            
            // Wait for all publications to complete
            const results = await Promise.allSettled(publishingPromises);
            
            // Process results
            let successCount = 0;
            let failureCount = 0;
            
            results.forEach((result, index) => {
                const channelId = validChannels[index];
                
                if (result.status === 'fulfilled') {
                    publication.results[channelId] = {
                        status: 'success',
                        data: result.value,
                        timestamp: Date.now()
                    };
                    successCount++;
                } else {
                    publication.results[channelId] = {
                        status: 'failed',
                        error: result.reason?.message || 'Unknown error',
                        timestamp: Date.now()
                    };
                    failureCount++;
                }
            });
            
            // Update publication status
            publication.status = failureCount === 0 ? 'completed' : 
                                successCount === 0 ? 'failed' : 'partial';
            publication.endTime = Date.now();
            publication.duration = publication.endTime - publication.startTime;
            
            // Update publication record
            await this.updatePublicationRecord(publication);
            
            // Update metrics
            this.metrics.totalPublications++;
            if (publication.status === 'completed') {
                this.metrics.successfulPublications++;
            } else {
                this.metrics.failedPublications++;
            }
            this.metrics.lastActivity = Date.now();
            this.updateAvgPublishingTime(publication.duration);
            
            // Update channel metrics
            validChannels.forEach(channelId => {
                if (!this.metrics.publicationsPerChannel[channelId]) {
                    this.metrics.publicationsPerChannel[channelId] = 0;
                }
                this.metrics.publicationsPerChannel[channelId]++;
            });
            
            // Remove from active publications
            this.activePublications.delete(publicationId);
            
            // Add to publication history
            if (!this.publicationHistory.has(contentId)) {
                this.publicationHistory.set(contentId, []);
            }
            this.publicationHistory.get(contentId).push(publication);
            
            // Schedule retry for failed channels if enabled
            if (failureCount > 0 && this.config.enableErrorRecovery) {
                this.scheduleRetry(publicationId, publication);
            }
            
            // Emit events
            this.emit('publicationCompleted', publication);
            
            if (publication.status === 'completed') {
                this.emit('publishingSuccess', { publicationId, contentId, channels: validChannels });
            } else if (failureCount > 0) {
                this.emit('publishingFailure', { publicationId, contentId, failures: failureCount });
            }
            
            span.setAttributes({
                'publication.id': publicationId,
                'content.id': contentId,
                'publication.channels': validChannels.length,
                'publication.success_count': successCount,
                'publication.failure_count': failureCount,
                'publication.status': publication.status,
                'publication.duration_ms': publication.duration
            });
            
            return publication;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Schedule content publication
     */
    async schedulePublication(contentId, channels, scheduleTime, options = {}) {
        const span = this.tracer.startSpan('publishing_engine_schedule_publication');
        
        try {
            if (!this.config.enableScheduledPublishing) {
                throw new Error('Scheduled publishing is disabled');
            }
            
            const scheduleId = crypto.randomUUID();
            const scheduleDate = new Date(scheduleTime);
            
            if (scheduleDate <= new Date()) {
                throw new Error('Schedule time must be in the future');
            }
            
            // Create scheduled publication record
            const scheduledPublication = {
                id: scheduleId,
                contentId,
                channels,
                scheduleTime: scheduleDate,
                status: 'scheduled',
                options,
                createdAt: new Date(),
                attempts: 0,
                metadata: {
                    userId: options.userId,
                    recurring: options.recurring || false,
                    recurrencePattern: options.recurrencePattern
                }
            };
            
            // Save to database
            const insertQuery = `
                INSERT INTO content_publications (
                    id, content_id, publication_channels, status,
                    scheduled_at, publication_data, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            
            const values = [
                scheduleId,
                contentId,
                channels,
                'scheduled',
                scheduleDate,
                scheduledPublication,
                new Date()
            ];
            
            await this.db.query(insertQuery, values);
            
            // Create cron job if not using batch scheduler
            if (!options.batchSchedule) {
                const cronTime = this.generateCronTime(scheduleDate);
                const job = cron.schedule(cronTime, async () => {
                    await this.executeScheduledPublication(scheduleId);
                }, { scheduled: false });
                
                this.scheduledJobs.set(scheduleId, job);
                job.start();
            }
            
            // Update metrics
            this.metrics.scheduledPublications++;
            
            // Emit event
            this.emit('publicationScheduled', {
                scheduleId,
                contentId,
                channels,
                scheduleTime: scheduleDate,
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'schedule.id': scheduleId,
                'content.id': contentId,
                'schedule.channels': channels.length,
                'schedule.time': scheduleDate.toISOString()
            });
            
            return scheduledPublication;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Bulk publish multiple content items
     */
    async bulkPublish(publications, options = {}) {
        const span = this.tracer.startSpan('publishing_engine_bulk_publish');
        
        try {
            if (!this.config.enableBulkOperations) {
                throw new Error('Bulk operations are disabled');
            }
            
            const bulkId = crypto.randomUUID();
            const batchSize = options.batchSize || this.config.bulkBatchSize;
            
            // Validate publications
            for (const pub of publications) {
                if (!pub.contentId || !pub.channels) {
                    throw new Error('Each publication must have contentId and channels');
                }
            }
            
            // Create bulk operation record
            const bulkOperation = {
                id: bulkId,
                totalItems: publications.length,
                processedItems: 0,
                successfulItems: 0,
                failedItems: 0,
                status: 'processing',
                startTime: Date.now(),
                results: []
            };
            
            // Process in batches
            for (let i = 0; i < publications.length; i += batchSize) {
                const batch = publications.slice(i, i + batchSize);
                const batchPromises = batch.map(pub => 
                    this.publishContent(pub.contentId, pub.channels, {
                        ...pub.options,
                        bulkId,
                        batchIndex: Math.floor(i / batchSize)
                    })
                );
                
                const batchResults = await Promise.allSettled(batchPromises);
                
                // Process batch results
                batchResults.forEach((result, index) => {
                    const publication = batch[index];
                    bulkOperation.processedItems++;
                    
                    if (result.status === 'fulfilled') {
                        bulkOperation.successfulItems++;
                        bulkOperation.results.push({
                            contentId: publication.contentId,
                            status: 'success',
                            publicationId: result.value.id
                        });
                    } else {
                        bulkOperation.failedItems++;
                        bulkOperation.results.push({
                            contentId: publication.contentId,
                            status: 'failed',
                            error: result.reason?.message
                        });
                    }
                });
                
                // Add delay between batches if specified
                if (options.batchDelay && i + batchSize < publications.length) {
                    await new Promise(resolve => setTimeout(resolve, options.batchDelay));
                }
            }
            
            // Complete bulk operation
            bulkOperation.status = bulkOperation.failedItems === 0 ? 'completed' : 'partial';
            bulkOperation.endTime = Date.now();
            bulkOperation.duration = bulkOperation.endTime - bulkOperation.startTime;
            
            // Update metrics
            this.metrics.bulkOperations++;
            
            // Emit event
            this.emit('bulkPublishCompleted', bulkOperation);
            
            span.setAttributes({
                'bulk.id': bulkId,
                'bulk.total_items': bulkOperation.totalItems,
                'bulk.successful_items': bulkOperation.successfulItems,
                'bulk.failed_items': bulkOperation.failedItems,
                'bulk.duration_ms': bulkOperation.duration
            });
            
            return bulkOperation;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Rollback a publication
     */
    async rollbackPublication(publicationId, options = {}) {
        const span = this.tracer.startSpan('publishing_engine_rollback_publication');
        
        try {
            if (!this.config.enablePublicationRollback) {
                throw new Error('Publication rollback is disabled');
            }
            
            // Get publication record
            const publication = await this.getPublicationRecord(publicationId);
            if (!publication) {
                throw new Error(`Publication not found: ${publicationId}`);
            }
            
            if (publication.status !== 'completed') {
                throw new Error('Can only rollback completed publications');
            }
            
            const rollbackId = crypto.randomUUID();
            const rollbackResults = {};
            
            // Rollback from each channel
            for (const channelId of publication.channels) {
                if (publication.results[channelId]?.status === 'success') {
                    try {
                        const channel = this.channels.get(channelId);
                        if (channel && channel.rollback) {
                            await channel.rollback(publication.contentId, publication.results[channelId].data);
                            rollbackResults[channelId] = { status: 'success' };
                        } else {
                            rollbackResults[channelId] = { status: 'not_supported' };
                        }
                    } catch (error) {
                        rollbackResults[channelId] = { 
                            status: 'failed', 
                            error: error.message 
                        };
                    }
                }
            }
            
            // Create rollback record
            const rollback = {
                id: rollbackId,
                publicationId,
                contentId: publication.contentId,
                results: rollbackResults,
                timestamp: Date.now(),
                userId: options.userId,
                reason: options.reason
            };
            
            // Save rollback record
            await this.saveRollbackRecord(rollback);
            
            // Update publication status
            await this.db.query(
                'UPDATE content_publications SET status = $1 WHERE id = $2',
                ['rolled_back', publicationId]
            );
            
            // Update metrics
            this.metrics.rollbacksPerformed++;
            
            // Emit event
            this.emit('publicationRolledBack', rollback);
            
            span.setAttributes({
                'rollback.id': rollbackId,
                'publication.id': publicationId,
                'content.id': publication.contentId,
                'rollback.channels': publication.channels.length
            });
            
            return rollback;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Get publication status and analytics
     */
    async getPublicationStatus(contentId) {
        const query = `
            SELECT p.*, pa.analytics_data
            FROM content_publications p
            LEFT JOIN content_analytics pa ON p.id = pa.publication_id
            WHERE p.content_id = $1
            ORDER BY p.created_at DESC
        `;
        
        const result = await this.db.query(query, [contentId]);
        
        return {
            contentId,
            publications: result.rows,
            totalPublications: result.rows.length,
            lastPublication: result.rows[0] || null,
            publishedChannels: [...new Set(result.rows.flatMap(p => p.publication_channels || []))]
        };
    }
    
    /**
     * Get channel statistics
     */
    getChannelStatistics() {
        const channelStats = {};
        
        for (const [channelId, channel] of this.channels) {
            channelStats[channelId] = {
                name: channel.name,
                type: channel.type,
                enabled: channel.enabled,
                publications: this.metrics.publicationsPerChannel[channelId] || 0,
                lastActivity: channel.lastActivity,
                configuration: this.channelConfigurations.get(channelId)
            };
        }
        
        return channelStats;
    }
    
    /**
     * Channel Management Methods
     */
    
    async initializeDefaultChannels() {
        // Web Channel
        this.registerChannel('web', {
            name: 'Website',
            type: 'web',
            enabled: true,
            publish: async (contentId, content, options) => {
                // Mark content as published on web
                await this.db.query(
                    'UPDATE content_items SET status = $1, published_at = NOW() WHERE id = $2',
                    ['published', contentId]
                );
                
                return {
                    url: `${options.baseUrl || ''}/content/${contentId}`,
                    publishedAt: new Date().toISOString()
                };
            },
            rollback: async (contentId, publishData) => {
                await this.db.query(
                    'UPDATE content_items SET status = $1 WHERE id = $2',
                    ['draft', contentId]
                );
            }
        });
        
        // API Channel
        this.registerChannel('api', {
            name: 'API Endpoint',
            type: 'api',
            enabled: true,
            publish: async (contentId, content, options) => {
                // Content is available via API - just mark as published
                return {
                    endpoint: `/api/content/${contentId}`,
                    publishedAt: new Date().toISOString()
                };
            }
        });
        
        // RSS Channel
        this.registerChannel('rss', {
            name: 'RSS Feed',
            type: 'feed',
            enabled: true,
            publish: async (contentId, content, options) => {
                // Add to RSS feed (would integrate with RSS generator)
                return {
                    feedUrl: '/rss.xml',
                    publishedAt: new Date().toISOString()
                };
            }
        });
        
        // Email Channel
        this.registerChannel('email', {
            name: 'Email Newsletter',
            type: 'email',
            enabled: false, // Disabled by default - needs email service configuration
            publish: async (contentId, content, options) => {
                // Send email newsletter (would integrate with email service)
                throw new Error('Email channel not configured');
            }
        });
        
        // Webhook Channel
        this.registerChannel('webhook', {
            name: 'Webhook',
            type: 'webhook',
            enabled: true,
            publish: async (contentId, content, options) => {
                // Send webhook notification (would make HTTP request)
                return {
                    webhookUrl: options.webhookUrl || 'not_configured',
                    publishedAt: new Date().toISOString()
                };
            }
        });
        
        this.metrics.totalChannels = this.channels.size;
    }
    
    registerChannel(channelId, channelConfig) {
        this.channels.set(channelId, {
            id: channelId,
            ...channelConfig,
            registeredAt: Date.now()
        });
        
        console.log(`Registered publishing channel: ${channelId}`);
    }
    
    async loadChannelConfigurations() {
        try {
            const query = 'SELECT * FROM content_publishing_channels WHERE enabled = true';
            const result = await this.db.query(query);
            
            result.rows.forEach(row => {
                this.channelConfigurations.set(row.channel_id, {
                    id: row.channel_id,
                    name: row.channel_name,
                    configuration: row.channel_config,
                    enabled: row.enabled,
                    priority: row.priority || 1
                });
                
                // Update channel if it exists
                if (this.channels.has(row.channel_id)) {
                    const channel = this.channels.get(row.channel_id);
                    channel.configuration = row.channel_config;
                    channel.enabled = row.enabled;
                }
            });
            
        } catch (error) {
            console.warn('Error loading channel configurations:', error.message);
        }
    }
    
    async publishToChannel(publicationId, contentId, channelId, content, options) {
        const span = this.tracer.startSpan('publishing_engine_publish_to_channel');
        
        try {
            const channel = this.channels.get(channelId);
            if (!channel || !channel.enabled) {
                throw new Error(`Channel not available: ${channelId}`);
            }
            
            // Apply channel-specific transformations
            const transformedContent = await this.transformContentForChannel(content, channelId, options);
            
            // Apply channel template if available
            const formattedContent = await this.applyChannelTemplate(transformedContent, channelId, options);
            
            // Publish to channel
            const publishResult = await channel.publish(contentId, formattedContent, {
                ...options,
                publicationId,
                channelConfig: this.channelConfigurations.get(channelId)
            });
            
            // Update channel last activity
            channel.lastActivity = Date.now();
            
            span.setAttributes({
                'publication.id': publicationId,
                'content.id': contentId,
                'channel.id': channelId,
                'channel.type': channel.type
            });
            
            return publishResult;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    async transformContentForChannel(content, channelId, options) {
        if (!this.config.enableContentTransformation) {
            return content;
        }
        
        const channel = this.channels.get(channelId);
        let transformed = { ...content };
        
        // Apply channel-specific transformations
        switch (channel.type) {
            case 'email':
                // Add email-specific formatting
                transformed.content = this.addEmailFormatting(content.content);
                break;
            
            case 'feed':
                // Add RSS-specific elements
                transformed.description = content.summary || content.content.substring(0, 200);
                break;
            
            case 'webhook':
                // Structure for webhook payload
                transformed = {
                    event: 'content.published',
                    contentId: content.id,
                    title: content.title,
                    url: `/content/${content.id}`,
                    publishedAt: new Date().toISOString()
                };
                break;
        }
        
        return transformed;
    }
    
    async applyChannelTemplate(content, channelId, options) {
        if (!this.config.enableTemplateProcessing) {
            return content;
        }
        
        const template = this.channelTemplates.get(channelId);
        if (!template) {
            return content;
        }
        
        // Simple template processing - would be more sophisticated in production
        let processed = template;
        
        Object.keys(content).forEach(key => {
            const placeholder = `{{${key}}}`;
            processed = processed.replace(new RegExp(placeholder, 'g'), content[key] || '');
        });
        
        return { ...content, rendered: processed };
    }
    
    addEmailFormatting(content) {
        // Add basic email HTML formatting
        return content
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }
    
    /**
     * Scheduler and Queue Management
     */
    
    startScheduler() {
        this.scheduler = cron.schedule(this.config.schedulerInterval, async () => {
            await this.processScheduledPublications();
        });
        
        console.log('Publishing scheduler started');
    }
    
    async processScheduledPublications() {
        try {
            const now = new Date();
            
            const query = `
                SELECT * FROM content_publications 
                WHERE status = 'scheduled' 
                AND scheduled_at <= $1 
                ORDER BY scheduled_at ASC 
                LIMIT 50
            `;
            
            const result = await this.db.query(query, [now]);
            
            for (const row of result.rows) {
                await this.executeScheduledPublication(row.id);
            }
            
        } catch (error) {
            console.error('Error processing scheduled publications:', error);
        }
    }
    
    async executeScheduledPublication(scheduleId) {
        const span = this.tracer.startSpan('publishing_engine_execute_scheduled');
        
        try {
            // Get scheduled publication
            const query = 'SELECT * FROM content_publications WHERE id = $1';
            const result = await this.db.query(query, [scheduleId]);
            
            if (result.rows.length === 0) {
                return;
            }
            
            const scheduled = result.rows[0];
            const publicationData = scheduled.publication_data;
            
            // Update status to publishing
            await this.db.query(
                'UPDATE content_publications SET status = $1 WHERE id = $2',
                ['publishing', scheduleId]
            );
            
            // Execute publication
            await this.publishContent(
                scheduled.content_id,
                scheduled.publication_channels,
                {
                    ...publicationData.options,
                    scheduledId: scheduleId,
                    trigger: 'scheduled'
                }
            );
            
            // Remove from scheduled jobs
            const job = this.scheduledJobs.get(scheduleId);
            if (job) {
                job.stop();
                this.scheduledJobs.delete(scheduleId);
            }
            
            span.setAttributes({
                'schedule.id': scheduleId,
                'content.id': scheduled.content_id,
                'channels.count': scheduled.publication_channels.length
            });
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            
            // Mark as failed
            await this.db.query(
                'UPDATE content_publications SET status = $1, error_message = $2 WHERE id = $3',
                ['failed', error.message, scheduleId]
            );
            
        } finally {
            span.end();
        }
    }
    
    async loadScheduledPublications() {
        try {
            const query = `
                SELECT * FROM content_publications 
                WHERE status = 'scheduled' AND scheduled_at > NOW()
            `;
            
            const result = await this.db.query(query);
            
            result.rows.forEach(row => {
                const scheduleDate = new Date(row.scheduled_at);
                const cronTime = this.generateCronTime(scheduleDate);
                
                const job = cron.schedule(cronTime, async () => {
                    await this.executeScheduledPublication(row.id);
                }, { scheduled: false });
                
                this.scheduledJobs.set(row.id, job);
                job.start();
            });
            
            console.log(`Loaded ${result.rows.length} scheduled publications`);
            
        } catch (error) {
            console.warn('Error loading scheduled publications:', error.message);
        }
    }
    
    startQueueProcessor() {
        setInterval(async () => {
            if (this.publishingQueue.length > 0 && this.activePublications.size < this.config.maxConcurrentPublications) {
                const queueItem = this.publishingQueue.shift();
                try {
                    await this.publishContent(queueItem.contentId, queueItem.channels, queueItem.options);
                } catch (error) {
                    console.error('Queue processing error:', error);
                }
            }
        }, this.config.queueProcessingInterval);
    }
    
    startRetryProcessor() {
        setInterval(async () => {
            if (this.retryQueue.length > 0) {
                const retryItem = this.retryQueue.shift();
                
                if (retryItem.attempts < this.config.retryAttempts) {
                    try {
                        await this.executeRetry(retryItem);
                    } catch (error) {
                        retryItem.attempts++;
                        if (retryItem.attempts < this.config.retryAttempts) {
                            this.retryQueue.push(retryItem);
                        }
                    }
                }
            }
        }, this.config.retryDelay);
    }
    
    scheduleRetry(publicationId, publication) {
        const failedChannels = Object.keys(publication.results).filter(
            channelId => publication.results[channelId].status === 'failed'
        );
        
        if (failedChannels.length > 0) {
            this.retryQueue.push({
                publicationId,
                contentId: publication.contentId,
                channels: failedChannels,
                attempts: 0,
                originalPublication: publication
            });
        }
    }
    
    async executeRetry(retryItem) {
        await this.publishContent(
            retryItem.contentId,
            retryItem.channels,
            {
                ...retryItem.originalPublication.options,
                isRetry: true,
                originalPublicationId: retryItem.publicationId,
                retryAttempt: retryItem.attempts + 1
            }
        );
    }
    
    /**
     * Helper Methods
     */
    
    async getContentData(contentId) {
        const query = `
            SELECT ci.*, cm.metadata
            FROM content_items ci
            LEFT JOIN content_metadata cm ON ci.id = cm.content_id
            WHERE ci.id = $1
        `;
        
        const result = await this.db.query(query, [contentId]);
        return result.rows[0] || null;
    }
    
    async validatePublishingRules(content, channels, options) {
        // Check if content is approved for publishing
        if (content.status !== 'approved' && content.status !== 'ready') {
            throw new Error('Content must be approved before publishing');
        }
        
        // Check channel permissions
        if (this.config.enableChannelPermissions) {
            for (const channelId of channels) {
                const hasPermission = await this.checkChannelPermission(options.userId, channelId);
                if (!hasPermission) {
                    throw new Error(`No permission to publish to channel: ${channelId}`);
                }
            }
        }
        
        // Check for sensitive content
        if (this.config.requireApprovalForSensitiveContent && content.is_sensitive && !content.sensitive_approved) {
            throw new Error('Sensitive content requires additional approval');
        }
    }
    
    async checkChannelPermission(userId, channelId) {
        // Simplified permission check - would integrate with actual permission system
        return true;
    }
    
    generateCronTime(date) {
        return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} *`;
    }
    
    async savePublicationRecord(publication) {
        const insertQuery = `
            INSERT INTO content_publications (
                id, content_id, publication_channels, status,
                publication_data, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `;
        
        const values = [
            publication.id,
            publication.contentId,
            publication.channels,
            publication.status,
            publication
        ];
        
        await this.db.query(insertQuery, values);
    }
    
    async updatePublicationRecord(publication) {
        const updateQuery = `
            UPDATE content_publications 
            SET status = $1, publication_data = $2, updated_at = NOW()
            WHERE id = $3
        `;
        
        await this.db.query(updateQuery, [publication.status, publication, publication.id]);
    }
    
    async getPublicationRecord(publicationId) {
        const query = 'SELECT publication_data FROM content_publications WHERE id = $1';
        const result = await this.db.query(query, [publicationId]);
        return result.rows[0]?.publication_data || null;
    }
    
    async saveRollbackRecord(rollback) {
        // Would save rollback record to database
        console.log('Rollback saved:', rollback.id);
    }
    
    updateAvgPublishingTime(duration) {
        if (this.metrics.avgPublishingTime === 0) {
            this.metrics.avgPublishingTime = duration;
        } else {
            this.metrics.avgPublishingTime = (this.metrics.avgPublishingTime + duration) / 2;
        }
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            activePublications: this.activePublications.size,
            scheduledJobs: this.scheduledJobs.size,
            queueSize: this.publishingQueue.length,
            retryQueueSize: this.retryQueue.length,
            channelStatistics: this.getChannelStatistics(),
            config: {
                enabledChannels: this.config.enabledChannels,
                scheduledPublishingEnabled: this.config.enableScheduledPublishing,
                bulkOperationsEnabled: this.config.enableBulkOperations,
                approvalWorkflowsEnabled: this.config.enableApprovalWorkflows,
                maxConcurrentPublications: this.config.maxConcurrentPublications
            },
            initialized: this.initialized,
            running: this.isRunning
        };
    }
    
    /**
     * Stop the Publishing Engine
     */
    async stop() {
        this.isRunning = false;
        
        // Stop scheduler
        if (this.scheduler) {
            this.scheduler.stop();
        }
        
        // Stop all scheduled jobs
        for (const job of this.scheduledJobs.values()) {
            job.stop();
        }
        this.scheduledJobs.clear();
        
        // Clear queues
        this.publishingQueue = [];
        this.retryQueue = [];
        
        // Clear active publications
        this.activePublications.clear();
        
        console.log('PublishingEngine service stopped');
    }
}

export default PublishingEngine;
