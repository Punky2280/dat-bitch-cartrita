import { EventEmitter } from 'events';
import Queue from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import EnhancedRedisService from './EnhancedRedisService.js';

/**
 * Advanced Message Queue Service
 * Provides distributed job processing, task scheduling, and monitoring with auto-scaling capabilities
 */
class MessageQueueService extends EventEmitter {
  constructor() {
    super();
    this.queues = new Map();
    this.workers = new Map();
    this.isInitialized = false;
    this.bullBoard = null;
    this.monitoring = null;
    this.metrics = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      delayedJobs: 0,
      waiting: 0,
      workers: 0,
      lastMetricsUpdate: null
    };
    
    // Job processors registry
    this.processors = new Map();
    
    // Default job options
    this.defaultJobOptions = {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    };
  }

  /**
   * Initialize message queue service
   */
  async initialize(config = {}) {
    const span = OpenTelemetryTracing.traceOperation('message_queue.initialize');
    
    try {
      console.log('📨 Initializing Advanced Message Queue Service...');
      
      // Ensure Redis is initialized
      if (!EnhancedRedisService.isInitialized) {
        await EnhancedRedisService.initialize();
      }
      
      const defaultConfig = {
        redis: {
          client: EnhancedRedisService.client
        },
        
        // Default queues to create
        queues: {
          'email': {
            name: 'email-processing',
            concurrency: 5,
            rateLimiter: {
              max: 100,
              duration: 60000 // 100 jobs per minute
            }
          },
          'image': {
            name: 'image-processing',
            concurrency: 3,
            rateLimiter: {
              max: 20,
              duration: 60000 // 20 jobs per minute
            }
          },
          'analytics': {
            name: 'analytics-processing',
            concurrency: 10,
            rateLimiter: {
              max: 200,
              duration: 60000 // 200 jobs per minute
            }
          },
          'notifications': {
            name: 'notification-delivery',
            concurrency: 15,
            rateLimiter: {
              max: 500,
              duration: 60000 // 500 jobs per minute
            }
          },
          'cleanup': {
            name: 'cleanup-tasks',
            concurrency: 2,
            rateLimiter: {
              max: 10,
              duration: 60000 // 10 jobs per minute
            }
          },
          'workflow': {
            name: 'workflow-execution',
            concurrency: 8,
            rateLimiter: {
              max: 100,
              duration: 60000 // 100 jobs per minute
            }
          },
          'security': {
            name: 'security-monitoring',
            concurrency: 5,
            rateLimiter: {
              max: 1000,
              duration: 60000 // 1000 jobs per minute for security events
            }
          }
        },
        
        // Monitoring dashboard settings
        dashboard: {
          enabled: process.env.QUEUE_DASHBOARD_ENABLED !== 'false',
          path: '/admin/queues',
          title: 'Cartrita Queue Monitor'
        },
        
        // Global job settings
        defaultJobOptions: {
          removeOnComplete: parseInt(process.env.QUEUE_KEEP_COMPLETED) || 100,
          removeOnFail: parseInt(process.env.QUEUE_KEEP_FAILED) || 50,
          attempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS) || 3,
          backoff: {
            type: 'exponential',
            delay: parseInt(process.env.QUEUE_BACKOFF_DELAY) || 2000
          }
        },
        
        // Health monitoring
        monitoring: {
          enabled: true,
          interval: parseInt(process.env.QUEUE_MONITORING_INTERVAL) || 30000, // 30 seconds
          alertThreshold: {
            failedJobs: parseInt(process.env.QUEUE_FAILED_THRESHOLD) || 100,
            queueLength: parseInt(process.env.QUEUE_LENGTH_THRESHOLD) || 1000
          }
        }
      };
      
      this.config = { ...defaultConfig, ...config };
      this.defaultJobOptions = this.config.defaultJobOptions;
      
      // Initialize queues
      await this.initializeQueues();
      
      // Setup monitoring dashboard
      if (this.config.dashboard.enabled) {
        this.setupDashboard();
      }
      
      // Register default processors
      this.registerDefaultProcessors();
      
      // Start monitoring
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }
      
      this.isInitialized = true;
      console.log(`✅ Message Queue Service initialized with ${this.queues.size} queues`);
      
      span.setAttributes({
        'queue.total_queues': this.queues.size,
        'queue.dashboard_enabled': this.config.dashboard.enabled,
        'queue.monitoring_enabled': this.config.monitoring.enabled
      });
      
      return true;
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Message Queue Service initialization failed:', error.message);
      this.isInitialized = false;
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Initialize all configured queues
   */
  async initializeQueues() {
    const span = OpenTelemetryTracing.traceOperation('message_queue.initialize_queues');
    
    try {
      const queuePromises = Object.entries(this.config.queues).map(async ([key, queueConfig]) => {
        try {
          const queue = new Queue(queueConfig.name, {
            redis: this.config.redis,
            defaultJobOptions: this.defaultJobOptions,
            settings: {
              stalledInterval: 30000,
              maxStalledCount: 1
            }
          });
          
          // Setup event handlers
          this.setupQueueEvents(queue, key);
          
          // Configure rate limiting
          if (queueConfig.rateLimiter) {
            queue.process('*', queueConfig.concurrency, async (job) => {
              return await this.processJob(key, job);
            });
          }
          
          this.queues.set(key, queue);
          console.log(`✅ Queue '${key}' (${queueConfig.name}) initialized`);
          
          return { key, status: 'success' };
        } catch (error) {
          console.error(`❌ Failed to initialize queue '${key}':`, error.message);
          return { key, status: 'failed', error: error.message };
        }
      });
      
      const results = await Promise.all(queuePromises);
      const successful = results.filter(r => r.status === 'success').length;
      
      console.log(`📊 Queue initialization complete: ${successful}/${results.length} successful`);
      
      span.setAttributes({
        'queue.initialization.total': results.length,
        'queue.initialization.successful': successful,
        'queue.initialization.failed': results.length - successful
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Queue initialization failed:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Setup event handlers for a queue
   */
  setupQueueEvents(queue, queueKey) {
    queue.on('completed', (job, result) => {
      this.metrics.completedJobs++;
      console.log(`✅ Job ${job.id} completed in queue ${queueKey}`);
      
      if (job.opts.attempts > 1 && job.attemptsMade > 1) {
        console.log(`🔄 Job ${job.id} completed after ${job.attemptsMade} attempts`);
      }
    });

    queue.on('failed', (job, err) => {
      this.metrics.failedJobs++;
      console.error(`❌ Job ${job.id} failed in queue ${queueKey}:`, err.message);
      
      // Log failed job details for debugging
      if (job.attemptsMade >= job.opts.attempts) {
        console.error(`🚨 Job ${job.id} exhausted all ${job.opts.attempts} attempts`);
      }
    });

    queue.on('active', (job) => {
      this.metrics.activeJobs++;
      console.log(`🔄 Job ${job.id} started processing in queue ${queueKey}`);
    });

    queue.on('stalled', (job) => {
      console.warn(`⚠️ Job ${job.id} stalled in queue ${queueKey}`);
    });

    queue.on('error', (error) => {
      console.error(`❌ Queue ${queueKey} error:`, error.message);
    });

    queue.on('waiting', (jobId) => {
      this.metrics.waiting++;
    });

    queue.on('removed', (job) => {
      console.log(`🗑️ Job ${job.id} removed from queue ${queueKey}`);
    });
  }

  /**
   * Setup Bull Board monitoring dashboard
   */
  setupDashboard() {
    try {
      const queueAdapters = Array.from(this.queues.values()).map(queue => 
        new BullAdapter(queue)
      );
      
      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath(this.config.dashboard.path);
      
      this.bullBoard = createBullBoard({
        queues: queueAdapters,
        serverAdapter: serverAdapter,
        options: {
          uiConfig: {
            boardTitle: this.config.dashboard.title,
            boardLogo: {
              path: 'https://cdn.jsdelivr.net/npm/bull-board@latest/public/images/logo.svg',
              width: '100px',
              height: 'auto'
            }
          }
        }
      });
      
      console.log(`📊 Bull Board dashboard available at ${this.config.dashboard.path}`);
      
    } catch (error) {
      console.error('❌ Failed to setup Bull Board dashboard:', error.message);
    }
  }

  /**
   * Register default job processors
   */
  registerDefaultProcessors() {
    // Email processing
    this.registerProcessor('email', async (job) => {
      const { type, data } = job.data;
      console.log(`📧 Processing email job: ${type}`);
      
      // Simulate email processing
      await this.delay(1000 + Math.random() * 2000);
      
      return { status: 'sent', timestamp: Date.now(), type };
    });

    // Image processing
    this.registerProcessor('image', async (job) => {
      const { operation, imageUrl, options } = job.data;
      console.log(`🖼️ Processing image: ${operation} on ${imageUrl}`);
      
      // Simulate image processing
      await this.delay(2000 + Math.random() * 3000);
      
      return { 
        status: 'processed', 
        operation, 
        originalUrl: imageUrl,
        processedUrl: `${imageUrl}_${operation}`,
        timestamp: Date.now() 
      };
    });

    // Analytics processing
    this.registerProcessor('analytics', async (job) => {
      const { eventType, data, userId } = job.data;
      console.log(`📊 Processing analytics event: ${eventType} for user ${userId}`);
      
      // Simulate analytics processing
      await this.delay(500 + Math.random() * 1000);
      
      return { 
        status: 'recorded', 
        eventType, 
        userId,
        processedAt: Date.now() 
      };
    });

    // Notification delivery
    this.registerProcessor('notifications', async (job) => {
      const { type, recipient, message } = job.data;
      console.log(`🔔 Delivering ${type} notification to ${recipient}`);
      
      // Simulate notification delivery
      await this.delay(800 + Math.random() * 1200);
      
      return { 
        status: 'delivered', 
        type, 
        recipient,
        deliveredAt: Date.now() 
      };
    });

    // Cleanup tasks
    this.registerProcessor('cleanup', async (job) => {
      const { task, parameters } = job.data;
      console.log(`🧹 Running cleanup task: ${task}`);
      
      // Simulate cleanup processing
      await this.delay(3000 + Math.random() * 5000);
      
      return { 
        status: 'completed', 
        task, 
        itemsProcessed: Math.floor(Math.random() * 100),
        completedAt: Date.now() 
      };
    });

    // Workflow execution
    this.registerProcessor('workflow', async (job) => {
      const { workflowId, stepId, data } = job.data;
      console.log(`⚡ Executing workflow ${workflowId}, step ${stepId}`);
      
      // Simulate workflow step execution
      await this.delay(1500 + Math.random() * 2500);
      
      return { 
        status: 'executed', 
        workflowId, 
        stepId,
        result: data,
        executedAt: Date.now() 
      };
    });

    // Security monitoring
    this.registerProcessor('security', async (job) => {
      const { eventType, severity, data } = job.data;
      console.log(`🔒 Processing security event: ${eventType} (${severity})`);
      
      // Simulate security event processing
      await this.delay(300 + Math.random() * 700);
      
      return { 
        status: 'analyzed', 
        eventType, 
        severity,
        actionTaken: severity === 'high' ? 'blocked' : 'logged',
        processedAt: Date.now() 
      };
    });
  }

  /**
   * Register a custom job processor
   */
  registerProcessor(queueName, processor) {
    if (!this.queues.has(queueName)) {
      throw new Error(`Queue '${queueName}' not found`);
    }
    
    this.processors.set(queueName, processor);
    
    const queue = this.queues.get(queueName);
    const queueConfig = this.config.queues[queueName];
    
    // Setup processor with concurrency
    queue.process('*', queueConfig.concurrency || 1, async (job) => {
      return await this.processJob(queueName, job);
    });
    
    console.log(`✅ Processor registered for queue: ${queueName}`);
  }

  /**
   * Process a job with tracing and error handling
   */
  async processJob(queueName, job) {
    const span = OpenTelemetryTracing.traceOperation(`message_queue.process_job.${queueName}`);
    
    try {
      const processor = this.processors.get(queueName);
      if (!processor) {
        throw new Error(`No processor found for queue: ${queueName}`);
      }
      
      console.log(`🔄 Processing job ${job.id} in queue ${queueName}`);
      
      const startTime = Date.now();
      const result = await processor(job);
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Job ${job.id} completed in ${processingTime}ms`);
      
      span.setAttributes({
        'job.id': job.id.toString(),
        'job.queue': queueName,
        'job.processing_time': processingTime,
        'job.attempts': job.attemptsMade,
        'job.status': 'completed'
      });
      
      return result;
      
    } catch (error) {
      span.recordException(error);
      console.error(`❌ Job ${job.id} failed in queue ${queueName}:`, error.message);
      
      span.setAttributes({
        'job.id': job.id.toString(),
        'job.queue': queueName,
        'job.attempts': job.attemptsMade,
        'job.status': 'failed',
        'job.error': error.message
      });
      
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add a job to a queue
   */
  async addJob(queueName, jobType, data, options = {}) {
    const span = OpenTelemetryTracing.traceOperation('message_queue.add_job');
    
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue '${queueName}' not found`);
      }
      
      const jobOptions = {
        ...this.defaultJobOptions,
        ...options
      };
      
      const job = await queue.add(jobType, data, jobOptions);
      this.metrics.totalJobs++;
      
      console.log(`📨 Job ${job.id} added to queue ${queueName} (type: ${jobType})`);
      
      span.setAttributes({
        'job.id': job.id.toString(),
        'job.queue': queueName,
        'job.type': jobType,
        'job.priority': jobOptions.priority || 0,
        'job.delay': jobOptions.delay || 0
      });
      
      return job;
      
    } catch (error) {
      span.recordException(error);
      console.error(`❌ Failed to add job to queue ${queueName}:`, error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add multiple jobs as a batch
   */
  async addBulkJobs(queueName, jobs) {
    const span = OpenTelemetryTracing.traceOperation('message_queue.add_bulk_jobs');
    
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue '${queueName}' not found`);
      }
      
      const jobsData = jobs.map(job => ({
        name: job.type || 'bulk-job',
        data: job.data,
        opts: {
          ...this.defaultJobOptions,
          ...job.options
        }
      }));
      
      const addedJobs = await queue.addBulk(jobsData);
      this.metrics.totalJobs += addedJobs.length;
      
      console.log(`📦 Added ${addedJobs.length} bulk jobs to queue ${queueName}`);
      
      span.setAttributes({
        'jobs.count': addedJobs.length,
        'jobs.queue': queueName,
        'jobs.bulk_operation': true
      });
      
      return addedJobs;
      
    } catch (error) {
      span.recordException(error);
      console.error(`❌ Failed to add bulk jobs to queue ${queueName}:`, error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Schedule a recurring job
   */
  async scheduleRecurringJob(queueName, jobType, data, cronExpression, options = {}) {
    const span = OpenTelemetryTracing.traceOperation('message_queue.schedule_recurring');
    
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue '${queueName}' not found`);
      }
      
      const jobOptions = {
        ...this.defaultJobOptions,
        repeat: { cron: cronExpression },
        jobId: `recurring-${jobType}-${Date.now()}`,
        ...options
      };
      
      const job = await queue.add(jobType, data, jobOptions);
      
      console.log(`⏰ Recurring job scheduled in queue ${queueName} (cron: ${cronExpression})`);
      
      span.setAttributes({
        'job.id': job.id.toString(),
        'job.queue': queueName,
        'job.type': jobType,
        'job.cron': cronExpression,
        'job.recurring': true
      });
      
      return job;
      
    } catch (error) {
      span.recordException(error);
      console.error(`❌ Failed to schedule recurring job:`, error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Start monitoring queues
   */
  startMonitoring() {
    console.log('📊 Starting queue monitoring...');
    
    this.monitoring = setInterval(async () => {
      await this.updateMetrics();
      await this.checkAlerts();
    }, this.config.monitoring.interval);
  }

  /**
   * Update queue metrics
   */
  async updateMetrics() {
    try {
      let totalActive = 0;
      let totalWaiting = 0;
      let totalCompleted = 0;
      let totalFailed = 0;
      let totalDelayed = 0;
      
      for (const [queueName, queue] of this.queues) {
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();
        const delayed = await queue.getDelayed();
        
        totalWaiting += waiting.length;
        totalActive += active.length;
        totalCompleted += completed.length;
        totalFailed += failed.length;
        totalDelayed += delayed.length;
      }
      
      this.metrics.activeJobs = totalActive;
      this.metrics.waiting = totalWaiting;
      this.metrics.delayedJobs = totalDelayed;
      this.metrics.workers = this.processors.size;
      this.metrics.lastMetricsUpdate = new Date();
      
      // Log metrics periodically
      if (this.metrics.totalJobs % 100 === 0) {
        console.log(`📊 Queue metrics - Active: ${totalActive}, Waiting: ${totalWaiting}, Completed: ${this.metrics.completedJobs}, Failed: ${this.metrics.failedJobs}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to update queue metrics:', error.message);
    }
  }

  /**
   * Check for alerts and notifications
   */
  async checkAlerts() {
    try {
      const { failedJobs, queueLength } = this.config.monitoring.alertThreshold;
      
      // Check failed jobs threshold
      if (this.metrics.failedJobs > failedJobs) {
        console.warn(`🚨 High number of failed jobs: ${this.metrics.failedJobs} (threshold: ${failedJobs})`);
      }
      
      // Check queue length threshold
      if (this.metrics.waiting > queueLength) {
        console.warn(`🚨 High queue length: ${this.metrics.waiting} (threshold: ${queueLength})`);
      }
      
      // Check for stalled queues
      for (const [queueName, queue] of this.queues) {
        const active = await queue.getActive();
        const stalledJobs = active.filter(job => 
          Date.now() - job.processedOn > 300000 // 5 minutes
        );
        
        if (stalledJobs.length > 0) {
          console.warn(`⚠️ Found ${stalledJobs.length} stalled jobs in queue ${queueName}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to check queue alerts:', error.message);
    }
  }

  /**
   * Get queue status and statistics
   */
  async getQueueStatus(queueName = null) {
    const span = OpenTelemetryTracing.traceOperation('message_queue.get_status');
    
    try {
      if (queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
          throw new Error(`Queue '${queueName}' not found`);
        }
        
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);
        
        return {
          name: queueName,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: await queue.isPaused()
        };
      }
      
      // Get status for all queues
      const queueStatuses = {};
      
      for (const [name, queue] of this.queues) {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);
        
        queueStatuses[name] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: await queue.isPaused()
        };
      }
      
      span.setAttributes({
        'queue.status_requested': queueName || 'all',
        'queue.total_queues': this.queues.size
      });
      
      return {
        isInitialized: this.isInitialized,
        totalQueues: this.queues.size,
        globalMetrics: this.metrics,
        queues: queueStatuses
      };
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Failed to get queue status:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get Bull Board router for Express integration
   */
  getDashboardRouter() {
    if (!this.bullBoard) {
      throw new Error('Bull Board dashboard not initialized');
    }
    
    return this.bullBoard.serverAdapter.getRouter();
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }
    
    await queue.pause();
    console.log(`⏸️ Queue ${queueName} paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }
    
    await queue.resume();
    console.log(`▶️ Queue ${queueName} resumed`);
  }

  /**
   * Clean up completed/failed jobs
   */
  async cleanQueue(queueName, options = {}) {
    const span = OpenTelemetryTracing.traceOperation('message_queue.clean');
    
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue '${queueName}' not found`);
      }
      
      const {
        grace = 3600000, // 1 hour
        status = 'completed',
        limit = 1000
      } = options;
      
      const cleaned = await queue.clean(grace, status, limit);
      console.log(`🧹 Cleaned ${cleaned.length} ${status} jobs from queue ${queueName}`);
      
      span.setAttributes({
        'queue.name': queueName,
        'queue.cleaned_count': cleaned.length,
        'queue.status': status,
        'queue.grace_period': grace
      });
      
      return cleaned;
      
    } catch (error) {
      span.recordException(error);
      console.error(`❌ Failed to clean queue ${queueName}:`, error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Scale workers for a specific queue
   * @param {string} queueName - Name of the queue
   * @param {number} targetWorkers - Target number of workers
   * @param {string} reason - Reason for scaling
   */
  async scaleWorkers(queueName, targetWorkers, reason = 'manual') {
    const span = OpenTelemetryTracing.traceOperation('message_queue.scale_workers');
    
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }
      
      const currentWorkers = this.workers.get(queueName) || 0;
      
      if (targetWorkers === currentWorkers) {
        console.log(`🔧 No scaling needed for queue ${queueName} (already ${currentWorkers} workers)`);
        return;
      }
      
      const direction = targetWorkers > currentWorkers ? 'up' : 'down';
      const workerDiff = Math.abs(targetWorkers - currentWorkers);
      
      // Update worker count
      this.workers.set(queueName, targetWorkers);
      
      // Emit scaling event
      this.emit('workersScaled', {
        queueName,
        direction,
        previousWorkers: currentWorkers,
        newWorkers: targetWorkers,
        workerDiff,
        reason
      });
      
      console.log(`📈 Scaled queue ${queueName} workers ${direction}: ${currentWorkers} → ${targetWorkers} (${reason})`);
      
      span.setAttributes({
        'queue.name': queueName,
        'scaling.direction': direction,
        'scaling.previous_workers': currentWorkers,
        'scaling.new_workers': targetWorkers,
        'scaling.reason': reason
      });
      
    } catch (error) {
      span.recordException(error);
      console.error(`❌ Failed to scale workers for queue ${queueName}:`, error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Auto-scale workers based on queue metrics
   * @param {string} queueName - Name of the queue
   */
  async autoScaleWorkers(queueName) {
    const span = OpenTelemetryTracing.traceOperation('message_queue.auto_scale_workers');
    
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        return;
      }
      
      const queueMetrics = await this.getQueueMetrics(queueName);
      const currentWorkers = this.workers.get(queueName) || 1;
      
      let targetWorkers = currentWorkers;
      let reason = 'none';
      
      // Scale up conditions
      if (queueMetrics.waiting > 50 && queueMetrics.waiting > currentWorkers * 10) {
        targetWorkers = Math.min(currentWorkers + Math.ceil(queueMetrics.waiting / 20), 20);
        reason = 'high_queue_backlog';
      } else if (queueMetrics.active > currentWorkers * 2) {
        targetWorkers = Math.min(currentWorkers + 2, 15);
        reason = 'high_active_jobs';
      }
      
      // Scale down conditions
      else if (queueMetrics.waiting === 0 && queueMetrics.active < currentWorkers * 0.3 && currentWorkers > 2) {
        targetWorkers = Math.max(currentWorkers - 1, 2);
        reason = 'low_utilization';
      }
      
      if (targetWorkers !== currentWorkers) {
        await this.scaleWorkers(queueName, targetWorkers, reason);
      }
      
      span.setAttributes({
        'queue.name': queueName,
        'queue.waiting': queueMetrics.waiting,
        'queue.active': queueMetrics.active,
        'workers.current': currentWorkers,
        'workers.target': targetWorkers,
        'scaling.reason': reason
      });
      
    } catch (error) {
      span.recordException(error);
      console.warn(`⚠️ Auto-scaling failed for queue ${queueName}:`, error.message);
    } finally {
      span.end();
    }
  }

  /**
   * Get performance metrics for scaling decisions
   */
  getPerformanceMetrics() {
    const totalThroughput = Array.from(this.queues.values()).reduce((sum, queue) => {
      // Mock throughput calculation
      return sum + (queue.metrics?.throughput || 0);
    }, 0);
    
    return {
      throughput: totalThroughput,
      performance: {
        averageJobDuration: this.metrics.totalJobs > 0 ? 
          (this.metrics.completedJobs * 1000) / this.metrics.totalJobs : 0,
        successRate: this.metrics.totalJobs > 0 ?
          this.metrics.completedJobs / this.metrics.totalJobs : 1,
        errorRate: this.metrics.totalJobs > 0 ?
          this.metrics.failedJobs / this.metrics.totalJobs : 0
      },
      scaling: {
        totalWorkers: Array.from(this.workers.values()).reduce((sum, count) => sum + count, 0),
        avgWorkersPerQueue: this.workers.size > 0 ?
          Array.from(this.workers.values()).reduce((sum, count) => sum + count, 0) / this.workers.size : 0
      },
      optimization: {
        queueUtilization: this.queues.size > 0 ?
          this.metrics.activeJobs / (this.queues.size * 10) : 0, // Assuming 10 max active per queue
        scalingEfficiency: this.metrics.completedJobs > 0 ?
          this.metrics.completedJobs / (this.metrics.completedJobs + this.metrics.failedJobs) : 0
      }
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup() {
    const span = OpenTelemetryTracing.traceOperation('message_queue.cleanup');
    
    try {
      console.log('🔄 Cleaning up Message Queue Service...');
      
      // Stop monitoring
      if (this.monitoring) {
        clearInterval(this.monitoring);
        this.monitoring = null;
      }
      
      // Close all queues
      const closePromises = Array.from(this.queues.entries()).map(async ([name, queue]) => {
        try {
          await queue.close();
          console.log(`✅ Queue ${name} closed successfully`);
        } catch (error) {
          console.error(`❌ Error closing queue ${name}:`, error.message);
        }
      });
      
      await Promise.all(closePromises);
      
      this.queues.clear();
      this.processors.clear();
      this.workers.clear();
      this.isInitialized = false;
      
      console.log('✅ Message Queue Service cleanup completed');
      
      span.setAttributes({
        'cleanup.completed': true,
        'queues.closed': closePromises.length
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Message Queue Service cleanup failed:', error.message);
    } finally {
      span.end();
    }
  }
}

export default new MessageQueueService();
