/**
 * Model Registry Event Emission System
 * 
 * Comprehensive event tracking and emission for model registry operations,
 * cost tracking, and performance monitoring.
 * 
 * @author Claude (Internal Developer Agent) 
 * @date August 2025
 */

import { EventEmitter } from 'events';
import { CostEvent, EventType } from './types';

export interface ModelCallEvent {
  event_id: string;
  event_type: EventType;
  timestamp: Date;
  model_id: string;
  user_id?: number;
  workflow_run_id?: string;
  stage?: string;
  supervisor?: string;
  usage?: {
    tokens_in: number;
    tokens_out: number;
    latency_ms?: number;
  };
  cost?: {
    cost_usd: number;
    cumulative_day_usd?: number;
    currency: string;
    estimation_method?: string;
  };
  pipeline_context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class ModelRegistryEventEmitter extends EventEmitter {
  private eventBuffer: ModelCallEvent[] = [];
  private readonly bufferSize = 1000;
  private batchTimeout?: NodeJS.Timeout;

  constructor(
    private logger: any = console,
    private databaseClient?: any,
    private redisClient?: any
  ) {
    super();
    this.setupEventHandlers();
  }

  /**
   * Emit model call planned event
   */
  emitModelCallPlanned(data: {
    model_id: string;
    user_id?: number;
    workflow_run_id?: string;
    stage?: string;
    supervisor?: string;
    estimated_tokens: number;
    estimated_cost_usd: number;
    pipeline_context?: Record<string, any>;
  }): void {
    const event: ModelCallEvent = {
      event_id: this.generateEventId(),
      event_type: 'model_call.planned',
      timestamp: new Date(),
      model_id: data.model_id,
      user_id: data.user_id,
      workflow_run_id: data.workflow_run_id,
      stage: data.stage,
      supervisor: data.supervisor,
      usage: {
        tokens_in: data.estimated_tokens,
        tokens_out: 0
      },
      cost: {
        cost_usd: data.estimated_cost_usd,
        currency: 'USD',
        estimation_method: 'pre_execution'
      },
      pipeline_context: data.pipeline_context
    };

    this.emitEvent(event);
  }

  /**
   * Emit model call started event
   */
  emitModelCallStarted(data: {
    model_id: string;
    user_id?: number;
    workflow_run_id?: string;
    stage?: string;
    supervisor?: string;
    actual_tokens_in: number;
    pipeline_context?: Record<string, any>;
  }): void {
    const event: ModelCallEvent = {
      event_id: this.generateEventId(),
      event_type: 'model_call.started',
      timestamp: new Date(),
      model_id: data.model_id,
      user_id: data.user_id,
      workflow_run_id: data.workflow_run_id,
      stage: data.stage,
      supervisor: data.supervisor,
      usage: {
        tokens_in: data.actual_tokens_in,
        tokens_out: 0
      },
      pipeline_context: data.pipeline_context
    };

    this.emitEvent(event);
  }

  /**
   * Emit model call completed event
   */
  emitModelCallCompleted(data: {
    model_id: string;
    user_id?: number;
    workflow_run_id?: string;
    stage?: string;
    supervisor?: string;
    tokens_in: number;
    tokens_out: number;
    latency_ms: number;
    cost_usd: number;
    cumulative_day_usd?: number;
    estimation_method?: string;
    pipeline_context?: Record<string, any>;
  }): void {
    const event: ModelCallEvent = {
      event_id: this.generateEventId(),
      event_type: 'model_call.completed',
      timestamp: new Date(),
      model_id: data.model_id,
      user_id: data.user_id,
      workflow_run_id: data.workflow_run_id,
      stage: data.stage,
      supervisor: data.supervisor,
      usage: {
        tokens_in: data.tokens_in,
        tokens_out: data.tokens_out,
        latency_ms: data.latency_ms
      },
      cost: {
        cost_usd: data.cost_usd,
        cumulative_day_usd: data.cumulative_day_usd,
        currency: 'USD',
        estimation_method: data.estimation_method
      },
      pipeline_context: data.pipeline_context
    };

    this.emitEvent(event);
  }

  /**
   * Emit model call failed event
   */
  emitModelCallFailed(data: {
    model_id: string;
    user_id?: number;
    workflow_run_id?: string;
    stage?: string;
    supervisor?: string;
    error: Error;
    tokens_in?: number;
    latency_ms?: number;
    pipeline_context?: Record<string, any>;
  }): void {
    const event: ModelCallEvent = {
      event_id: this.generateEventId(),
      event_type: 'model_call.failed',
      timestamp: new Date(),
      model_id: data.model_id,
      user_id: data.user_id,
      workflow_run_id: data.workflow_run_id,
      stage: data.stage,
      supervisor: data.supervisor,
      usage: data.tokens_in ? {
        tokens_in: data.tokens_in,
        tokens_out: 0,
        latency_ms: data.latency_ms
      } : undefined,
      metadata: {
        error_message: data.error.message,
        error_stack: data.error.stack
      },
      pipeline_context: data.pipeline_context
    };

    this.emitEvent(event);
  }

  /**
   * Emit model cost accumulated event
   */
  emitModelCostAccumulated(data: {
    model_id: string;
    user_id?: number;
    daily_total_usd: number;
    monthly_total_usd?: number;
    currency: string;
    period: 'daily' | 'weekly' | 'monthly';
    budget_name?: string;
  }): void {
    const event: ModelCallEvent = {
      event_id: this.generateEventId(),
      event_type: 'model_cost.accumulated',
      timestamp: new Date(),
      model_id: data.model_id,
      user_id: data.user_id,
      cost: {
        cost_usd: data.daily_total_usd,
        currency: data.currency
      },
      metadata: {
        period: data.period,
        monthly_total_usd: data.monthly_total_usd,
        budget_name: data.budget_name
      }
    };

    this.emitEvent(event);
  }

  /**
   * Emit budget threshold crossed event
   */
  emitBudgetThresholdCrossed(data: {
    budget_name: string;
    threshold_type: 'warning' | 'critical' | 'hard_stop';
    threshold_percent: number;
    current_spent_usd: number;
    budget_limit_usd: number;
    user_id?: number;
    time_remaining?: string;
  }): void {
    const event: ModelCallEvent = {
      event_id: this.generateEventId(),
      event_type: 'budget.threshold_crossed',
      timestamp: new Date(),
      model_id: 'budget_system', // Special model ID for budget events
      user_id: data.user_id,
      cost: {
        cost_usd: data.current_spent_usd,
        currency: 'USD'
      },
      metadata: {
        budget_name: data.budget_name,
        threshold_type: data.threshold_type,
        threshold_percent: data.threshold_percent,
        budget_limit_usd: data.budget_limit_usd,
        utilization_percent: (data.current_spent_usd / data.budget_limit_usd) * 100,
        time_remaining: data.time_remaining
      }
    };

    this.emitEvent(event);
  }

  /**
   * Internal event emission with buffering
   */
  private emitEvent(event: ModelCallEvent): void {
    // Add to buffer
    this.eventBuffer.push(event);
    
    // Emit for real-time listeners
    super.emit(event.event_type, event);
    super.emit('modelEvent', event);

    // Log event
    this.logger.debug('Model event emitted', {
      event_id: event.event_id,
      event_type: event.event_type,
      model_id: event.model_id
    });

    // Flush buffer if full
    if (this.eventBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }

    // Set batch timeout for partial buffer flush
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushBuffer();
      }, 5000); // 5 second timeout
    }
  }

  /**
   * Flush event buffer to storage
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];
    
    // Clear timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = undefined;
    }

    try {
      // Store in database
      if (this.databaseClient) {
        await this.storeEventsInDatabase(eventsToFlush);
      }

      // Cache recent events in Redis
      if (this.redisClient) {
        await this.cacheEventsInRedis(eventsToFlush);
      }

      this.logger.debug('Event buffer flushed', { 
        events_count: eventsToFlush.length 
      });

    } catch (error) {
      this.logger.error('Failed to flush event buffer', { error });
      
      // Re-add failed events to buffer (simple retry)
      this.eventBuffer.unshift(...eventsToFlush);
    }
  }

  /**
   * Store events in database
   */
  private async storeEventsInDatabase(events: ModelCallEvent[]): Promise<void> {
    if (!this.databaseClient) return;

    const costEvents: CostEvent[] = events.map(event => ({
      event_id: event.event_id,
      event_type: event.event_type,
      model_id: event.model_id,
      user_id: event.user_id,
      workflow_run_id: event.workflow_run_id,
      stage: event.stage,
      supervisor: event.supervisor,
      tokens_in: event.usage?.tokens_in || 0,
      tokens_out: event.usage?.tokens_out || 0,
      latency_ms: event.usage?.latency_ms,
      cost_usd: event.cost?.cost_usd || 0,
      currency: event.cost?.currency || 'USD',
      estimation_method: event.cost?.estimation_method,
      pipeline_context: event.pipeline_context,
      created_at: event.timestamp
    }));

    // Batch insert
    const query = `
      INSERT INTO cost_events (
        event_id, event_type, model_id, user_id, workflow_run_id,
        stage, supervisor, tokens_in, tokens_out, latency_ms,
        cost_usd, currency, estimation_method, pipeline_context, created_at
      ) VALUES ${costEvents.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
    `;

    const values = costEvents.flatMap(event => [
      event.event_id,
      event.event_type,
      event.model_id,
      event.user_id || null,
      event.workflow_run_id || null,
      event.stage || null,
      event.supervisor || null,
      event.tokens_in,
      event.tokens_out,
      event.latency_ms || null,
      event.cost_usd,
      event.currency,
      event.estimation_method || null,
      JSON.stringify(event.pipeline_context || {}),
      event.created_at
    ]);

    await this.databaseClient.query(query, values);
  }

  /**
   * Cache recent events in Redis
   */
  private async cacheEventsInRedis(events: ModelCallEvent[]): Promise<void> {
    if (!this.redisClient) return;

    for (const event of events) {
      // Cache by model ID for quick retrieval
      const key = `model_events:${event.model_id}`;
      await this.redisClient.lpush(key, JSON.stringify(event));
      await this.redisClient.ltrim(key, 0, 99); // Keep last 100 events per model
      await this.redisClient.expire(key, 86400); // 24 hour TTL

      // Cache recent events globally
      const globalKey = 'recent_events';
      await this.redisClient.lpush(globalKey, JSON.stringify(event));
      await this.redisClient.ltrim(globalKey, 0, 999); // Keep last 1000 events
      await this.redisClient.expire(globalKey, 3600); // 1 hour TTL
    }
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    // Monitor for high cost events
    this.on('model_call.completed', (event: ModelCallEvent) => {
      if (event.cost && event.cost.cost_usd > 1.0) { // $1+ threshold
        this.logger.warn('High cost model call detected', {
          event_id: event.event_id,
          model_id: event.model_id,
          cost_usd: event.cost.cost_usd
        });
        super.emit('highCostEvent', event);
      }
    });

    // Monitor for slow responses
    this.on('model_call.completed', (event: ModelCallEvent) => {
      if (event.usage && event.usage.latency_ms && event.usage.latency_ms > 10000) { // 10s threshold
        this.logger.warn('Slow model response detected', {
          event_id: event.event_id,
          model_id: event.model_id,
          latency_ms: event.usage.latency_ms
        });
        super.emit('slowResponseEvent', event);
      }
    });

    // Monitor for failures
    this.on('model_call.failed', (event: ModelCallEvent) => {
      this.logger.error('Model call failed', {
        event_id: event.event_id,
        model_id: event.model_id,
        error: event.metadata?.error_message
      });
      super.emit('modelFailureEvent', event);
    });

    // Monitor budget alerts
    this.on('budget.threshold_crossed', (event: ModelCallEvent) => {
      this.logger.warn('Budget threshold crossed', {
        budget_name: event.metadata?.budget_name,
        threshold_type: event.metadata?.threshold_type,
        utilization_percent: event.metadata?.utilization_percent
      });
      super.emit('budgetAlertEvent', event);
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent events from cache
   */
  async getRecentEvents(modelId?: string, limit: number = 50): Promise<ModelCallEvent[]> {
    if (!this.redisClient) {
      return this.eventBuffer.slice(-limit);
    }

    const key = modelId ? `model_events:${modelId}` : 'recent_events';
    const events = await this.redisClient.lrange(key, 0, limit - 1);
    
    return events.map((eventStr: string) => JSON.parse(eventStr));
  }

  /**
   * Get event statistics
   */
  getStatistics(): {
    buffer_size: number;
    total_events_emitted: number;
    events_by_type: Record<string, number>;
  } {
    const stats = {
      buffer_size: this.eventBuffer.length,
      total_events_emitted: this.listenerCount('modelEvent'),
      events_by_type: {} as Record<string, number>
    };

    // Count events by type in buffer
    for (const event of this.eventBuffer) {
      stats.events_by_type[event.event_type] = 
        (stats.events_by_type[event.event_type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Force flush buffer (for graceful shutdown)
   */
  async forceFlu‌sh(): Promise<void> {
    await this.flushBuffer();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    await this.flushBuffer();
    this.removeAllListeners();
  }
}