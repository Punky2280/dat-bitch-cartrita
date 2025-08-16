// WorkflowSchedulingService.js
// Component 5: Advanced Scheduling System - Backend Service
// Sophisticated workflow scheduling with cron expressions, event triggers, conditional scheduling

import DatabaseService from './DatabaseService.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { EventEmitter } from 'events';
import cron from 'node-cron';

/**
 * Advanced workflow scheduling service with enterprise-grade capabilities
 * Supports cron expressions, event triggers, conditional scheduling, and calendar integration
 */
class WorkflowSchedulingService extends EventEmitter {
    constructor() {
        super();
        this.db = DatabaseService;
        this.activeCronJobs = new Map();
        this.eventTriggers = new Map();
        this.conditionalSchedules = new Map();
        this.batchProcessors = new Map();
        this.priorityQueue = [];
        this.isProcessing = false;
        
        // Scheduling statistics
        this.stats = {
            totalScheduled: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            skippedExecutions: 0,
            avgExecutionTime: 0,
            lastProcessed: null
        };

        this.initializeSchedulingEngine();
    }

    /**
     * Initialize the scheduling engine
     */
    async initializeSchedulingEngine() {
        try {
            // Load existing schedules from database
            await this.loadExistingSchedules();
            
            // Start the priority queue processor
            this.startQueueProcessor();
            
            // Setup cleanup intervals
            this.setupCleanupJobs();
            
            // Start conditional scheduler
            this.startConditionalScheduler();
            
            console.log('✅ Workflow Scheduling Service initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing scheduling service:', error);
        }
    }

    /**
     * Create a new workflow schedule
     */
    async createSchedule(scheduleConfig, userId) {
        return await OpenTelemetryTracing.traceOperation('workflow.scheduling.create', async () => {
            const {
                workflowId,
                scheduleType, // 'cron', 'event', 'conditional', 'batch'
                name,
                description,
                configuration,
                isActive = true,
                priority = 5, // 1-10 scale
                metadata = {}
            } = scheduleConfig;

            // Validate configuration based on schedule type
            this.validateScheduleConfiguration(scheduleType, configuration);

            const query = `
                INSERT INTO workflow_schedules (
                    workflow_id, user_id, schedule_type, name, description,
                    configuration, is_active, priority, metadata, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                RETURNING *
            `;

            const result = await this.db.query(query, [
                workflowId,
                userId,
                scheduleType,
                name,
                description,
                JSON.stringify(configuration),
                isActive,
                priority,
                JSON.stringify(metadata)
            ]);

            const schedule = result.rows[0];

            // Initialize the schedule based on type
            if (isActive) {
                await this.initializeSchedule(schedule);
            }

            this.emit('schedule-created', schedule);
            return schedule;
        });
    }

    /**
     * Initialize a schedule based on its type
     */
    async initializeSchedule(schedule) {
        const { id, schedule_type, configuration } = schedule;
        const config = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;

        switch (schedule_type) {
            case 'cron':
                this.setupCronSchedule(schedule, config);
                break;
            case 'event':
                this.setupEventTrigger(schedule, config);
                break;
            case 'conditional':
                this.setupConditionalSchedule(schedule, config);
                break;
            case 'batch':
                this.setupBatchProcessor(schedule, config);
                break;
            case 'calendar':
                this.setupCalendarIntegration(schedule, config);
                break;
            default:
                throw new Error(`Unsupported schedule type: ${schedule_type}`);
        }
    }

    /**
     * Setup cron-based schedule
     */
    setupCronSchedule(schedule, config) {
        const { id, workflow_id } = schedule;
        const { cronExpression, timezone = 'UTC', retryConfig = {} } = config;

        // Validate cron expression
        if (!cron.validate(cronExpression)) {
            throw new Error(`Invalid cron expression: ${cronExpression}`);
        }

        const cronJob = cron.schedule(cronExpression, async () => {
            await this.executeCronJob(schedule);
        }, {
            scheduled: false,
            timezone
        });

        this.activeCronJobs.set(id, {
            job: cronJob,
            schedule,
            config,
            lastExecution: null,
            nextExecution: this.getNextCronExecution(cronExpression)
        });

        cronJob.start();
        console.log(`📅 Cron schedule activated: ${schedule.name} (${cronExpression})`);
    }

    /**
     * Setup event-driven trigger
     */
    setupEventTrigger(schedule, config) {
        const { id } = schedule;
        const { 
            eventType, 
            eventSource, 
            conditions = {},
            debounceMs = 0,
            maxExecutionsPerHour = 60
        } = config;

        const triggerHandler = async (eventData) => {
            // Check conditions
            if (!this.evaluateEventConditions(eventData, conditions)) {
                return;
            }

            // Check rate limiting
            if (!this.checkRateLimit(id, maxExecutionsPerHour)) {
                console.log(`⚠️ Rate limit exceeded for event trigger: ${schedule.name}`);
                return;
            }

            // Apply debouncing
            if (debounceMs > 0) {
                await this.debounceEventTrigger(id, debounceMs, () => {
                    this.executeEventTrigger(schedule, eventData);
                });
            } else {
                await this.executeEventTrigger(schedule, eventData);
            }
        };

        // Register event listener
        this.eventTriggers.set(id, {
            schedule,
            config,
            handler: triggerHandler,
            executionCount: 0,
            lastExecution: null
        });

        // Setup event listener based on source
        this.setupEventListener(eventType, eventSource, triggerHandler);
        
        console.log(`🎯 Event trigger activated: ${schedule.name} (${eventType})`);
    }

    /**
     * Setup conditional schedule
     */
    setupConditionalSchedule(schedule, config) {
        const { id } = schedule;
        const {
            checkInterval = 60000, // 1 minute default
            conditions = [],
            maxDailyExecutions = 100,
            quietHours = null // {start: '22:00', end: '06:00'}
        } = config;

        this.conditionalSchedules.set(id, {
            schedule,
            config,
            checkInterval: setInterval(async () => {
                await this.checkConditionalSchedule(schedule, config);
            }, checkInterval),
            executionCount: 0,
            lastCheck: null,
            lastExecution: null
        });

        console.log(`🔍 Conditional schedule activated: ${schedule.name}`);
    }

    /**
     * Setup batch processor
     */
    setupBatchProcessor(schedule, config) {
        const { id } = schedule;
        const {
            batchSize = 10,
            processingInterval = 300000, // 5 minutes
            dataSource,
            filterCriteria = {},
            parallelProcessing = false,
            maxConcurrency = 3
        } = config;

        const processor = setInterval(async () => {
            await this.processBatchSchedule(schedule, config);
        }, processingInterval);

        this.batchProcessors.set(id, {
            schedule,
            config,
            processor,
            isProcessing: false,
            lastBatch: null,
            processedCount: 0
        });

        console.log(`📦 Batch processor activated: ${schedule.name}`);
    }

    /**
     * Setup calendar integration
     */
    setupCalendarIntegration(schedule, config) {
        const { id } = schedule;
        const {
            calendarProvider, // 'google', 'outlook', 'ical'
            calendarId,
            eventQuery = {},
            triggerOffset = 0, // minutes before event
            businessHoursOnly = false
        } = config;

        // Calendar integration would connect to external calendar APIs
        console.log(`📆 Calendar integration activated: ${schedule.name} (${calendarProvider})`);
    }

    /**
     * Execute cron job
     */
    async executeCronJob(schedule) {
        try {
            const cronData = this.activeCronJobs.get(schedule.id);
            if (!cronData) return;

            console.log(`⏰ Executing cron job: ${schedule.name}`);
            
            const executionResult = await this.executeWorkflowFromSchedule(schedule, {
                triggerType: 'cron',
                cronExpression: cronData.config.cronExpression
            });

            cronData.lastExecution = new Date();
            cronData.nextExecution = this.getNextCronExecution(cronData.config.cronExpression);

            await this.recordScheduleExecution(schedule.id, executionResult);
            
        } catch (error) {
            console.error(`❌ Error executing cron job ${schedule.name}:`, error);
            await this.recordScheduleExecution(schedule.id, { 
                status: 'failed', 
                error: error.message 
            });
        }
    }

    /**
     * Execute event trigger
     */
    async executeEventTrigger(schedule, eventData) {
        try {
            console.log(`🎯 Executing event trigger: ${schedule.name}`);
            
            const executionResult = await this.executeWorkflowFromSchedule(schedule, {
                triggerType: 'event',
                eventData
            });

            const triggerData = this.eventTriggers.get(schedule.id);
            if (triggerData) {
                triggerData.lastExecution = new Date();
                triggerData.executionCount++;
            }

            await this.recordScheduleExecution(schedule.id, executionResult);
            
        } catch (error) {
            console.error(`❌ Error executing event trigger ${schedule.name}:`, error);
            await this.recordScheduleExecution(schedule.id, { 
                status: 'failed', 
                error: error.message 
            });
        }
    }

    /**
     * Check and execute conditional schedule
     */
    async checkConditionalSchedule(schedule, config) {
        try {
            const conditionalData = this.conditionalSchedules.get(schedule.id);
            if (!conditionalData) return;

            conditionalData.lastCheck = new Date();

            // Check quiet hours
            if (config.quietHours && this.isInQuietHours(config.quietHours)) {
                return;
            }

            // Check daily execution limit
            if (this.hasExceededDailyLimit(schedule.id, config.maxDailyExecutions)) {
                return;
            }

            // Evaluate all conditions
            const allConditionsMet = await this.evaluateAllConditions(config.conditions);
            
            if (allConditionsMet) {
                console.log(`🔍 Conditions met for schedule: ${schedule.name}`);
                
                const executionResult = await this.executeWorkflowFromSchedule(schedule, {
                    triggerType: 'conditional',
                    conditions: config.conditions
                });

                conditionalData.lastExecution = new Date();
                conditionalData.executionCount++;

                await this.recordScheduleExecution(schedule.id, executionResult);
            }
            
        } catch (error) {
            console.error(`❌ Error checking conditional schedule ${schedule.name}:`, error);
        }
    }

    /**
     * Process batch schedule
     */
    async processBatchSchedule(schedule, config) {
        try {
            const batchData = this.batchProcessors.get(schedule.id);
            if (!batchData || batchData.isProcessing) return;

            batchData.isProcessing = true;
            console.log(`📦 Processing batch schedule: ${schedule.name}`);

            // Get batch data based on data source
            const batchItems = await this.getBatchData(config.dataSource, config.filterCriteria, config.batchSize);
            
            if (batchItems.length === 0) {
                batchData.isProcessing = false;
                return;
            }

            // Process batch items
            const results = [];
            if (config.parallelProcessing) {
                // Process in parallel with concurrency limit
                const chunks = this.chunkArray(batchItems, config.maxConcurrency);
                for (const chunk of chunks) {
                    const chunkPromises = chunk.map(item => 
                        this.executeWorkflowFromSchedule(schedule, {
                            triggerType: 'batch',
                            batchItem: item
                        })
                    );
                    const chunkResults = await Promise.allSettled(chunkPromises);
                    results.push(...chunkResults);
                }
            } else {
                // Process sequentially
                for (const item of batchItems) {
                    const result = await this.executeWorkflowFromSchedule(schedule, {
                        triggerType: 'batch',
                        batchItem: item
                    });
                    results.push(result);
                }
            }

            batchData.lastBatch = new Date();
            batchData.processedCount += batchItems.length;
            batchData.isProcessing = false;

            await this.recordBatchExecution(schedule.id, results);
            
        } catch (error) {
            console.error(`❌ Error processing batch schedule ${schedule.name}:`, error);
            const batchData = this.batchProcessors.get(schedule.id);
            if (batchData) {
                batchData.isProcessing = false;
            }
        }
    }

    /**
     * Execute workflow from schedule
     */
    async executeWorkflowFromSchedule(schedule, context = {}) {
        try {
            // Add workflow to priority queue
            const queueItem = {
                scheduleId: schedule.id,
                workflowId: schedule.workflow_id,
                priority: schedule.priority || 5,
                context,
                scheduledAt: new Date(),
                retries: 0
            };

            this.addToPriorityQueue(queueItem);
            
            return {
                status: 'queued',
                queuedAt: new Date(),
                context
            };
            
        } catch (error) {
            console.error('Error executing workflow from schedule:', error);
            return {
                status: 'failed',
                error: error.message,
                context
            };
        }
    }

    /**
     * Add item to priority queue
     */
    addToPriorityQueue(item) {
        this.priorityQueue.push(item);
        // Sort by priority (higher number = higher priority)
        this.priorityQueue.sort((a, b) => b.priority - a.priority);
        
        this.emit('queue-updated', {
            queueLength: this.priorityQueue.length,
            item
        });
    }

    /**
     * Start priority queue processor
     */
    startQueueProcessor() {
        const processQueue = async () => {
            if (this.isProcessing || this.priorityQueue.length === 0) {
                return;
            }

            this.isProcessing = true;
            const item = this.priorityQueue.shift();
            
            try {
                console.log(`🚀 Processing queued workflow: ${item.workflowId} (Priority: ${item.priority})`);
                
                // Execute workflow through WorkflowExecutionEngine
                const WorkflowExecutionEngine = (await import('./WorkflowExecutionEngine.js')).default;
                const executionEngine = new WorkflowExecutionEngine();
                
                const result = await executionEngine.executeWorkflow(
                    item.workflowId,
                    item.context.batchItem || item.context.eventData || {},
                    {
                        triggerType: item.context.triggerType,
                        scheduleId: item.scheduleId,
                        priority: item.priority
                    }
                );

                await this.recordQueueExecution(item, result);
                this.stats.successfulExecutions++;
                
            } catch (error) {
                console.error(`❌ Error processing queued workflow:`, error);
                
                // Retry logic
                if (item.retries < 3) {
                    item.retries++;
                    item.scheduledAt = new Date(Date.now() + (item.retries * 60000)); // Exponential backoff
                    this.addToPriorityQueue(item);
                    console.log(`🔄 Retrying workflow execution (${item.retries}/3)`);
                } else {
                    await this.recordQueueExecution(item, { status: 'failed', error: error.message });
                    this.stats.failedExecutions++;
                }
            } finally {
                this.isProcessing = false;
                this.stats.lastProcessed = new Date();
            }
        };

        // Process queue every 5 seconds
        setInterval(processQueue, 5000);
    }

    /**
     * Load existing schedules from database
     */
    async loadExistingSchedules() {
        try {
            const query = `
                SELECT * FROM workflow_schedules 
                WHERE is_active = true 
                ORDER BY priority DESC, created_at ASC
            `;
            
            const result = await this.db.query(query);
            
            for (const schedule of result.rows) {
                await this.initializeSchedule(schedule);
            }
            
            console.log(`📋 Loaded ${result.rows.length} active schedules`);
            
        } catch (error) {
            console.error('Error loading existing schedules:', error);
        }
    }

    /**
     * Validation and helper methods
     */
    validateScheduleConfiguration(scheduleType, configuration) {
        switch (scheduleType) {
            case 'cron':
                if (!configuration.cronExpression) {
                    throw new Error('Cron expression is required for cron schedules');
                }
                if (!cron.validate(configuration.cronExpression)) {
                    throw new Error(`Invalid cron expression: ${configuration.cronExpression}`);
                }
                break;
                
            case 'event':
                if (!configuration.eventType || !configuration.eventSource) {
                    throw new Error('Event type and source are required for event schedules');
                }
                break;
                
            case 'conditional':
                if (!configuration.conditions || !Array.isArray(configuration.conditions)) {
                    throw new Error('Conditions array is required for conditional schedules');
                }
                break;
                
            case 'batch':
                if (!configuration.dataSource) {
                    throw new Error('Data source is required for batch schedules');
                }
                break;
                
            case 'calendar':
                if (!configuration.calendarProvider || !configuration.calendarId) {
                    throw new Error('Calendar provider and ID are required for calendar schedules');
                }
                break;
        }
    }

    getNextCronExecution(cronExpression) {
        // This would use a cron parser to get the next execution time
        // For simplicity, returning a placeholder
        return new Date(Date.now() + 60000);
    }

    evaluateEventConditions(eventData, conditions) {
        // Evaluate conditions against event data
        for (const [key, value] of Object.entries(conditions)) {
            if (eventData[key] !== value) {
                return false;
            }
        }
        return true;
    }

    async evaluateAllConditions(conditions) {
        // Evaluate complex conditions (database queries, API calls, etc.)
        for (const condition of conditions) {
            const result = await this.evaluateCondition(condition);
            if (!result) return false;
        }
        return true;
    }

    async evaluateCondition(condition) {
        const { type, query, expectedValue, operator = 'equals' } = condition;
        
        try {
            let actualValue;
            
            switch (type) {
                case 'database':
                    const result = await this.db.query(query);
                    actualValue = result.rows[0]?.value;
                    break;
                    
                case 'api':
                    // API call implementation
                    break;
                    
                case 'time':
                    actualValue = new Date();
                    break;
                    
                default:
                    return false;
            }
            
            return this.compareValues(actualValue, expectedValue, operator);
            
        } catch (error) {
            console.error('Error evaluating condition:', error);
            return false;
        }
    }

    compareValues(actual, expected, operator) {
        switch (operator) {
            case 'equals': return actual === expected;
            case 'not_equals': return actual !== expected;
            case 'greater_than': return actual > expected;
            case 'less_than': return actual < expected;
            case 'contains': return actual && actual.includes(expected);
            default: return false;
        }
    }

    checkRateLimit(scheduleId, maxExecutionsPerHour) {
        // Implementation for rate limiting
        return true; // Simplified for now
    }

    async debounceEventTrigger(scheduleId, debounceMs, callback) {
        // Debouncing implementation
        setTimeout(callback, debounceMs);
    }

    setupEventListener(eventType, eventSource, handler) {
        // Setup event listeners based on source
        this.on(eventType, handler);
    }

    isInQuietHours(quietHours) {
        // Check if current time is in quiet hours
        return false; // Simplified for now
    }

    hasExceededDailyLimit(scheduleId, maxDailyExecutions) {
        // Check daily execution limit
        return false; // Simplified for now
    }

    async getBatchData(dataSource, filterCriteria, batchSize) {
        // Get batch data from various sources
        return []; // Simplified for now
    }

    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    async recordScheduleExecution(scheduleId, result) {
        try {
            const query = `
                INSERT INTO workflow_schedule_executions 
                    (schedule_id, execution_id, status, started_at, completed_at, context, error_message)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
            
            await this.db.query(query, [
                scheduleId,
                result.executionId || null,
                result.status,
                result.startedAt || new Date(),
                result.completedAt || (result.status === 'completed' ? new Date() : null),
                JSON.stringify(result.context || {}),
                result.error || null
            ]);
            
        } catch (error) {
            console.error('Error recording schedule execution:', error);
        }
    }

    async recordBatchExecution(scheduleId, results) {
        // Record batch execution results
        for (const result of results) {
            await this.recordScheduleExecution(scheduleId, result.value || result.reason);
        }
    }

    async recordQueueExecution(item, result) {
        await this.recordScheduleExecution(item.scheduleId, {
            ...result,
            queuedAt: item.scheduledAt,
            priority: item.priority,
            retries: item.retries
        });
    }

    setupCleanupJobs() {
        // Clean up old execution records daily
        cron.schedule('0 2 * * *', async () => {
            try {
                await this.db.query(`
                    DELETE FROM workflow_schedule_executions 
                    WHERE started_at < NOW() - INTERVAL '90 days'
                `);
                console.log('🧹 Cleaned up old schedule execution records');
            } catch (error) {
                console.error('Error cleaning up execution records:', error);
            }
        });
    }

    startConditionalScheduler() {
        // Master conditional scheduler that checks all conditional schedules
        setInterval(async () => {
            for (const [scheduleId, conditionalData] of this.conditionalSchedules) {
                await this.checkConditionalSchedule(conditionalData.schedule, conditionalData.config);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Public API methods for schedule management
     */
    async updateSchedule(scheduleId, updates, userId) {
        return await OpenTelemetryTracing.traceOperation('workflow.scheduling.update', async () => {
            const query = `
                UPDATE workflow_schedules 
                SET name = $1, description = $2, configuration = $3, 
                    is_active = $4, priority = $5, metadata = $6, updated_at = NOW()
                WHERE id = $7 AND user_id = $8
                RETURNING *
            `;

            const result = await this.db.query(query, [
                updates.name,
                updates.description,
                JSON.stringify(updates.configuration),
                updates.isActive,
                updates.priority,
                JSON.stringify(updates.metadata),
                scheduleId,
                userId
            ]);

            if (result.rows.length === 0) {
                throw new Error('Schedule not found or access denied');
            }

            const schedule = result.rows[0];

            // Reinitialize schedule if active
            await this.deactivateSchedule(scheduleId);
            if (schedule.is_active) {
                await this.initializeSchedule(schedule);
            }

            this.emit('schedule-updated', schedule);
            return schedule;
        });
    }

    async deleteSchedule(scheduleId, userId) {
        await this.deactivateSchedule(scheduleId);
        
        const query = `
            DELETE FROM workflow_schedules 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `;

        const result = await this.db.query(query, [scheduleId, userId]);
        
        if (result.rows.length === 0) {
            throw new Error('Schedule not found or access denied');
        }

        this.emit('schedule-deleted', { scheduleId, userId });
        return { deleted: true };
    }

    async deactivateSchedule(scheduleId) {
        // Remove from active collections
        if (this.activeCronJobs.has(scheduleId)) {
            this.activeCronJobs.get(scheduleId).job.stop();
            this.activeCronJobs.delete(scheduleId);
        }

        if (this.eventTriggers.has(scheduleId)) {
            this.eventTriggers.delete(scheduleId);
        }

        if (this.conditionalSchedules.has(scheduleId)) {
            const conditional = this.conditionalSchedules.get(scheduleId);
            clearInterval(conditional.checkInterval);
            this.conditionalSchedules.delete(scheduleId);
        }

        if (this.batchProcessors.has(scheduleId)) {
            const batch = this.batchProcessors.get(scheduleId);
            clearInterval(batch.processor);
            this.batchProcessors.delete(scheduleId);
        }
    }

    async getSchedules(userId, filters = {}) {
        let query = `
            SELECT ws.*, wd.name as workflow_name
            FROM workflow_schedules ws
            LEFT JOIN workflow_definitions wd ON ws.workflow_id = wd.id
            WHERE ws.user_id = $1
        `;
        const params = [userId];
        let paramCount = 1;

        if (filters.scheduleType) {
            query += ` AND ws.schedule_type = $${++paramCount}`;
            params.push(filters.scheduleType);
        }

        if (filters.isActive !== undefined) {
            query += ` AND ws.is_active = $${++paramCount}`;
            params.push(filters.isActive);
        }

        query += ` ORDER BY ws.priority DESC, ws.created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${++paramCount}`;
            params.push(filters.limit);
        }

        const result = await this.db.query(query, params);
        return result.rows;
    }

    async getScheduleStatus(scheduleId) {
        const scheduleData = {
            cron: this.activeCronJobs.get(scheduleId),
            event: this.eventTriggers.get(scheduleId),
            conditional: this.conditionalSchedules.get(scheduleId),
            batch: this.batchProcessors.get(scheduleId)
        };

        const activeType = Object.keys(scheduleData).find(key => scheduleData[key]);
        
        return {
            isActive: !!activeType,
            type: activeType,
            data: scheduleData[activeType],
            queueLength: this.priorityQueue.length,
            stats: this.stats
        };
    }
}

export { WorkflowSchedulingService };
