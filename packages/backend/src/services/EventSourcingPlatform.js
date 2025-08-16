/**
 * Event Sourcing Platform
 * 
 * Comprehensive event sourcing implementation with event store, snapshots, replaying,
 * CQRS patterns, aggregate management, projection handling, and event streaming.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class EventSourcingPlatform extends EventEmitter {
    constructor(db, config = {}) {
        super();
        this.db = db;
        this.config = {
            // Event Store Configuration
            eventStoreEnabled: config.eventStoreEnabled !== false,
            maxEventsPerAggregate: config.maxEventsPerAggregate || 10000,
            eventRetention: config.eventRetention || 31536000000, // 1 year
            compressionEnabled: config.compressionEnabled !== false,
            
            // Snapshot Configuration
            snapshotsEnabled: config.snapshotsEnabled !== false,
            snapshotInterval: config.snapshotInterval || 100, // Events between snapshots
            snapshotRetention: config.snapshotRetention || 10, // Number of snapshots to keep
            
            // CQRS Configuration
            cqrsEnabled: config.cqrsEnabled !== false,
            commandTimeout: config.commandTimeout || 30000,
            queryTimeout: config.queryTimeout || 10000,
            
            // Projection Configuration
            projectionsEnabled: config.projectionsEnabled !== false,
            projectionConcurrency: config.projectionConcurrency || 5,
            projectionBatchSize: config.projectionBatchSize || 100,
            
            // Event Streaming
            streamingEnabled: config.streamingEnabled !== false,
            streamBufferSize: config.streamBufferSize || 1000,
            streamBatchTimeout: config.streamBatchTimeout || 1000,
            
            // Consistency and Durability
            consistencyLevel: config.consistencyLevel || 'eventual', // strong, eventual
            durabilityLevel: config.durabilityLevel || 'persistent', // memory, persistent
            
            // Performance
            cachingEnabled: config.cachingEnabled !== false,
            cacheSize: config.cacheSize || 1000,
            indexingEnabled: config.indexingEnabled !== false,
            
            ...config
        };

        this.tracer = OpenTelemetryTracing.getTracer('event-sourcing-platform');
        this.initialized = false;
        this.isRunning = false;

        // Event Storage
        this.eventStore = new Map(); // aggregateId -> events[]
        this.eventsByType = new Map(); // eventType -> events[]
        this.eventById = new Map(); // eventId -> event
        this.eventStreams = new Map(); // streamName -> events[]
        
        // Snapshots
        this.snapshots = new Map(); // aggregateId -> snapshot
        this.snapshotVersions = new Map(); // aggregateId -> version[]
        
        // Aggregates and Entities
        this.aggregates = new Map(); // aggregateId -> aggregateInstance
        this.aggregateDefinitions = new Map(); // aggregateType -> definition
        
        // Command and Query Handlers
        this.commandHandlers = new Map(); // commandType -> handler
        this.queryHandlers = new Map(); // queryType -> handler
        this.eventHandlers = new Map(); // eventType -> handlers[]
        
        // Projections
        this.projections = new Map(); // projectionName -> projection
        this.projectionState = new Map(); // projectionName -> state
        this.projectionOffsets = new Map(); // projectionName -> lastProcessedEventId
        
        // Event Streaming
        this.streamSubscriptions = new Map(); // subscriptionId -> subscription
        this.streamBuffers = new Map(); // streamName -> buffer
        
        // Caching
        this.cache = new Map(); // key -> value
        this.cacheMetadata = new Map(); // key -> metadata
        
        // Metrics and Monitoring
        this.metrics = {
            events_stored: 0,
            events_replayed: 0,
            commands_processed: 0,
            queries_processed: 0,
            snapshots_created: 0,
            projections_updated: 0,
            aggregates_loaded: 0,
            cache_hits: 0,
            cache_misses: 0,
            avg_event_processing_time: 0
        };

        // Internal state
        this.processingQueues = new Map();
        this.projectionWorkers = new Map();
        this.streamingIntervals = new Map();
    }

    /**
     * Initialize Event Sourcing Platform
     */
    async initialize() {
        const span = this.tracer.startSpan('event-sourcing-platform.initialize');
        
        try {
            console.log('[EventSourcingPlatform] Initializing event sourcing platform...');

            // Initialize event store
            if (this.config.eventStoreEnabled) {
                await this.initializeEventStore();
            }

            // Initialize snapshots
            if (this.config.snapshotsEnabled) {
                await this.initializeSnapshots();
            }

            // Initialize CQRS components
            if (this.config.cqrsEnabled) {
                await this.initializeCQRS();
            }

            // Initialize projections
            if (this.config.projectionsEnabled) {
                await this.initializeProjections();
            }

            // Initialize event streaming
            if (this.config.streamingEnabled) {
                await this.initializeEventStreaming();
            }

            // Initialize caching
            if (this.config.cachingEnabled) {
                await this.initializeCaching();
            }

            // Register default aggregate types
            await this.registerDefaultAggregates();

            this.initialized = true;
            this.isRunning = true;

            span.setAttributes({
                'event_store.enabled': this.config.eventStoreEnabled,
                'snapshots.enabled': this.config.snapshotsEnabled,
                'cqrs.enabled': this.config.cqrsEnabled,
                'projections.enabled': this.config.projectionsEnabled,
                'streaming.enabled': this.config.streamingEnabled,
                'consistency.level': this.config.consistencyLevel
            });

            console.log('[EventSourcingPlatform] Event sourcing platform initialized successfully');

            this.emit('initialized');
            return { success: true };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            console.error('[EventSourcingPlatform] Failed to initialize:', error);
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Store event in event store
     */
    async storeEvent(event, options = {}) {
        const span = this.tracer.startSpan('event-sourcing-platform.store-event');
        const startTime = Date.now();
        
        try {
            // Validate and prepare event
            const eventObj = this.prepareEvent(event, options);

            // Store event in event store
            await this.persistEvent(eventObj);

            // Update event indices
            await this.updateEventIndices(eventObj);

            // Add to event streams if specified
            if (eventObj.streamName) {
                await this.addToEventStream(eventObj);
            }

            // Trigger event handlers
            await this.triggerEventHandlers(eventObj);

            // Update projections
            if (this.config.projectionsEnabled) {
                await this.updateProjections(eventObj);
            }

            // Update metrics
            this.metrics.events_stored++;
            const processingTime = Date.now() - startTime;
            this.metrics.avg_event_processing_time = (this.metrics.avg_event_processing_time + processingTime) / 2;

            span.setAttributes({
                'event.id': eventObj.id,
                'event.type': eventObj.type,
                'event.aggregate_id': eventObj.aggregateId,
                'event.version': eventObj.version,
                'event.size': JSON.stringify(eventObj).length
            });

            console.log(`[EventSourcingPlatform] Event stored: ${eventObj.type} (${eventObj.id})`);

            this.emit('eventStored', { event: eventObj });
            return { success: true, eventId: eventObj.id, version: eventObj.version };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Load aggregate from event store
     */
    async loadAggregate(aggregateId, aggregateType, options = {}) {
        const span = this.tracer.startSpan('event-sourcing-platform.load-aggregate');
        
        try {
            // Check cache first
            const cacheKey = `aggregate:${aggregateId}`;
            if (this.config.cachingEnabled && this.cache.has(cacheKey)) {
                this.metrics.cache_hits++;
                const cached = this.cache.get(cacheKey);
                
                span.setAttributes({
                    'aggregate.id': aggregateId,
                    'aggregate.type': aggregateType,
                    'aggregate.cache_hit': true,
                    'aggregate.version': cached.version
                });

                return cached;
            }

            this.metrics.cache_misses++;

            // Load from snapshot if available
            let aggregate = null;
            let fromVersion = 0;
            
            if (this.config.snapshotsEnabled) {
                const snapshot = await this.loadSnapshot(aggregateId);
                if (snapshot) {
                    aggregate = this.deserializeAggregate(snapshot.data, aggregateType);
                    fromVersion = snapshot.version;
                    console.log(`[EventSourcingPlatform] Loaded aggregate ${aggregateId} from snapshot at version ${fromVersion}`);
                }
            }

            // Create new aggregate if no snapshot
            if (!aggregate) {
                const aggregateDefinition = this.aggregateDefinitions.get(aggregateType);
                if (!aggregateDefinition) {
                    throw new Error(`Aggregate type not registered: ${aggregateType}`);
                }
                aggregate = new aggregateDefinition.constructor();
                aggregate.id = aggregateId;
                aggregate.type = aggregateType;
                aggregate.version = 0;
            }

            // Load and apply events since snapshot
            const events = await this.loadEvents(aggregateId, fromVersion + 1);
            for (const event of events) {
                await this.applyEventToAggregate(aggregate, event);
            }

            // Cache the aggregate
            if (this.config.cachingEnabled) {
                this.cache.set(cacheKey, { ...aggregate });
                this.cacheMetadata.set(cacheKey, {
                    loadedAt: Date.now(),
                    accessCount: 1,
                    lastAccessed: Date.now()
                });
            }

            // Track loaded aggregate
            this.aggregates.set(aggregateId, aggregate);
            this.metrics.aggregates_loaded++;

            span.setAttributes({
                'aggregate.id': aggregateId,
                'aggregate.type': aggregateType,
                'aggregate.version': aggregate.version,
                'aggregate.events_applied': events.length,
                'aggregate.cache_hit': false
            });

            console.log(`[EventSourcingPlatform] Aggregate loaded: ${aggregateType} (${aggregateId}) version ${aggregate.version}`);

            return aggregate;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Process command using CQRS pattern
     */
    async processCommand(command, options = {}) {
        const span = this.tracer.startSpan('event-sourcing-platform.process-command');
        const startTime = Date.now();
        
        try {
            // Validate command
            this.validateCommand(command);

            // Get command handler
            const handler = this.commandHandlers.get(command.type);
            if (!handler) {
                throw new Error(`No command handler registered for: ${command.type}`);
            }

            // Prepare command context
            const context = {
                commandId: command.id || uuidv4(),
                timestamp: new Date(),
                userId: options.userId || 'system',
                correlationId: options.correlationId || uuidv4(),
                metadata: options.metadata || {}
            };

            // Execute command with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Command timeout')), this.config.commandTimeout);
            });

            const executionPromise = handler.handle(command, context, this);
            const result = await Promise.race([executionPromise, timeoutPromise]);

            // Update metrics
            this.metrics.commands_processed++;
            const processingTime = Date.now() - startTime;

            span.setAttributes({
                'command.type': command.type,
                'command.id': context.commandId,
                'command.aggregate_id': command.aggregateId,
                'command.processing_time': processingTime,
                'command.user_id': context.userId
            });

            console.log(`[EventSourcingPlatform] Command processed: ${command.type} (${context.commandId})`);

            this.emit('commandProcessed', { command, context, result });
            return { success: true, result, commandId: context.commandId };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Execute query using CQRS pattern
     */
    async executeQuery(query, options = {}) {
        const span = this.tracer.startSpan('event-sourcing-platform.execute-query');
        
        try {
            // Validate query
            this.validateQuery(query);

            // Get query handler
            const handler = this.queryHandlers.get(query.type);
            if (!handler) {
                throw new Error(`No query handler registered for: ${query.type}`);
            }

            // Prepare query context
            const context = {
                queryId: query.id || uuidv4(),
                timestamp: new Date(),
                userId: options.userId || 'system',
                correlationId: options.correlationId || uuidv4(),
                metadata: options.metadata || {}
            };

            // Execute query with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Query timeout')), this.config.queryTimeout);
            });

            const executionPromise = handler.handle(query, context, this);
            const result = await Promise.race([executionPromise, timeoutPromise]);

            // Update metrics
            this.metrics.queries_processed++;

            span.setAttributes({
                'query.type': query.type,
                'query.id': context.queryId,
                'query.user_id': context.userId,
                'query.result_count': Array.isArray(result) ? result.length : 1
            });

            console.log(`[EventSourcingPlatform] Query executed: ${query.type} (${context.queryId})`);

            this.emit('queryExecuted', { query, context, result });
            return { success: true, result, queryId: context.queryId };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Create snapshot for aggregate
     */
    async createSnapshot(aggregateId, options = {}) {
        const span = this.tracer.startSpan('event-sourcing-platform.create-snapshot');
        
        try {
            const aggregate = this.aggregates.get(aggregateId);
            if (!aggregate) {
                throw new Error(`Aggregate not loaded: ${aggregateId}`);
            }

            // Check if snapshot is needed
            const lastSnapshot = this.snapshots.get(aggregateId);
            const eventsSinceSnapshot = lastSnapshot ? aggregate.version - lastSnapshot.version : aggregate.version;
            
            if (!options.force && eventsSinceSnapshot < this.config.snapshotInterval) {
                return { success: true, created: false, reason: 'Snapshot not needed yet' };
            }

            // Create snapshot
            const snapshot = {
                id: uuidv4(),
                aggregateId: aggregateId,
                aggregateType: aggregate.type,
                version: aggregate.version,
                data: this.serializeAggregate(aggregate),
                createdAt: new Date(),
                metadata: options.metadata || {}
            };

            // Store snapshot
            await this.persistSnapshot(snapshot);

            // Update snapshot tracking
            this.snapshots.set(aggregateId, snapshot);
            
            // Maintain snapshot version history
            let versions = this.snapshotVersions.get(aggregateId) || [];
            versions.push({
                version: snapshot.version,
                snapshotId: snapshot.id,
                createdAt: snapshot.createdAt
            });

            // Keep only recent snapshots
            if (versions.length > this.config.snapshotRetention) {
                const oldVersions = versions.splice(0, versions.length - this.config.snapshotRetention);
                // Clean up old snapshots
                for (const oldVersion of oldVersions) {
                    await this.deleteSnapshot(oldVersion.snapshotId);
                }
            }

            this.snapshotVersions.set(aggregateId, versions);
            this.metrics.snapshots_created++;

            span.setAttributes({
                'snapshot.id': snapshot.id,
                'snapshot.aggregate_id': aggregateId,
                'snapshot.version': snapshot.version,
                'snapshot.size': JSON.stringify(snapshot.data).length
            });

            console.log(`[EventSourcingPlatform] Snapshot created: ${aggregateId} at version ${snapshot.version}`);

            this.emit('snapshotCreated', { snapshot });
            return { success: true, created: true, snapshotId: snapshot.id, version: snapshot.version };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Replay events for aggregate
     */
    async replayEvents(aggregateId, fromVersion = 0, toVersion = null, options = {}) {
        const span = this.tracer.startSpan('event-sourcing-platform.replay-events');
        
        try {
            // Load events for replay
            const events = await this.loadEvents(aggregateId, fromVersion, toVersion);
            
            if (events.length === 0) {
                return { success: true, eventsReplayed: 0 };
            }

            // Get or create aggregate
            let aggregate = this.aggregates.get(aggregateId);
            if (!aggregate && options.aggregateType) {
                const aggregateDefinition = this.aggregateDefinitions.get(options.aggregateType);
                if (!aggregateDefinition) {
                    throw new Error(`Aggregate type not registered: ${options.aggregateType}`);
                }
                aggregate = new aggregateDefinition.constructor();
                aggregate.id = aggregateId;
                aggregate.type = options.aggregateType;
                aggregate.version = fromVersion - 1;
            }

            if (!aggregate) {
                throw new Error(`Cannot replay events: aggregate not found and no type specified`);
            }

            // Replay events
            let replayedCount = 0;
            for (const event of events) {
                await this.applyEventToAggregate(aggregate, event);
                replayedCount++;
                
                // Emit replay progress
                if (options.onProgress) {
                    await options.onProgress(event, replayedCount, events.length);
                }
            }

            // Update aggregate tracking
            this.aggregates.set(aggregateId, aggregate);
            this.metrics.events_replayed += replayedCount;

            span.setAttributes({
                'replay.aggregate_id': aggregateId,
                'replay.from_version': fromVersion,
                'replay.to_version': toVersion || events[events.length - 1].version,
                'replay.events_count': replayedCount
            });

            console.log(`[EventSourcingPlatform] Replayed ${replayedCount} events for aggregate ${aggregateId}`);

            this.emit('eventsReplayed', { aggregateId, eventsReplayed: replayedCount, aggregate });
            return { success: true, eventsReplayed: replayedCount, finalVersion: aggregate.version };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Subscribe to event stream
     */
    async subscribeToEventStream(streamName, callback, options = {}) {
        const span = this.tracer.startSpan('event-sourcing-platform.subscribe-stream');
        
        try {
            const subscriptionId = options.subscriptionId || uuidv4();

            // Validate stream exists or create it
            if (!this.eventStreams.has(streamName)) {
                this.eventStreams.set(streamName, []);
            }

            const subscription = {
                id: subscriptionId,
                streamName,
                callback,
                options: {
                    fromPosition: options.fromPosition || 0,
                    batchSize: options.batchSize || 1,
                    catchUp: options.catchUp !== false,
                    liveOnly: options.liveOnly || false,
                    filter: options.filter || null,
                    ...options
                },
                stats: {
                    eventsProcessed: 0,
                    lastEventPosition: options.fromPosition || 0,
                    subscribedAt: new Date(),
                    lastProcessedAt: null
                }
            };

            this.streamSubscriptions.set(subscriptionId, subscription);

            // If catch-up is enabled, process historical events
            if (subscription.options.catchUp && !subscription.options.liveOnly) {
                await this.processCatchUpEvents(subscription);
            }

            span.setAttributes({
                'subscription.id': subscriptionId,
                'subscription.stream': streamName,
                'subscription.from_position': subscription.options.fromPosition,
                'subscription.catch_up': subscription.options.catchUp
            });

            console.log(`[EventSourcingPlatform] Subscribed to event stream ${streamName}: ${subscriptionId}`);

            this.emit('streamSubscribed', { subscriptionId, streamName, subscription });
            return { success: true, subscriptionId };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Register projection
     */
    async registerProjection(projectionName, projectionHandler, options = {}) {
        const span = this.tracer.startSpan('event-sourcing-platform.register-projection');
        
        try {
            if (this.projections.has(projectionName)) {
                throw new Error(`Projection already registered: ${projectionName}`);
            }

            const projection = {
                name: projectionName,
                handler: projectionHandler,
                options: {
                    eventTypes: options.eventTypes || [], // Empty = all events
                    batchSize: options.batchSize || this.config.projectionBatchSize,
                    persistent: options.persistent !== false,
                    enabled: options.enabled !== false,
                    ...options
                },
                stats: {
                    eventsProcessed: 0,
                    lastProcessedEventId: null,
                    registeredAt: new Date(),
                    lastUpdatedAt: null,
                    errors: 0
                }
            };

            this.projections.set(projectionName, projection);

            // Initialize projection state
            const initialState = await projectionHandler.getInitialState();
            this.projectionState.set(projectionName, initialState);
            this.projectionOffsets.set(projectionName, 0);

            // Start projection processing if enabled
            if (projection.options.enabled) {
                await this.startProjectionProcessing(projectionName);
            }

            span.setAttributes({
                'projection.name': projectionName,
                'projection.event_types': projection.options.eventTypes.length,
                'projection.enabled': projection.options.enabled,
                'projection.persistent': projection.options.persistent
            });

            console.log(`[EventSourcingPlatform] Projection registered: ${projectionName}`);

            this.emit('projectionRegistered', { projectionName, projection });
            return { success: true, projectionName };

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Get platform status
     */
    getStatus() {
        const activeProjections = Array.from(this.projections.values()).filter(p => p.options.enabled).length;
        const activeStreams = this.streamSubscriptions.size;

        return {
            service: 'EventSourcingPlatform',
            initialized: this.initialized,
            running: this.isRunning,
            features: {
                event_store: this.config.eventStoreEnabled,
                snapshots: this.config.snapshotsEnabled,
                cqrs: this.config.cqrsEnabled,
                projections: this.config.projectionsEnabled,
                event_streaming: this.config.streamingEnabled,
                caching: this.config.cachingEnabled,
                consistency_level: this.config.consistencyLevel
            },
            storage: {
                events_count: Array.from(this.eventStore.values()).reduce((sum, events) => sum + events.length, 0),
                aggregates_loaded: this.aggregates.size,
                snapshots_count: this.snapshots.size,
                cache_entries: this.cache.size
            },
            cqrs: {
                command_handlers: this.commandHandlers.size,
                query_handlers: this.queryHandlers.size,
                event_handlers: this.eventHandlers.size
            },
            projections: {
                registered: this.projections.size,
                active: activeProjections,
                inactive: this.projections.size - activeProjections
            },
            streaming: {
                streams: this.eventStreams.size,
                subscriptions: activeStreams
            },
            metrics: this.metrics,
            timestamp: new Date().toISOString()
        };
    }

    // Helper Methods

    /**
     * Prepare event object with metadata
     */
    prepareEvent(event, options = {}) {
        return {
            id: event.id || uuidv4(),
            type: event.type,
            aggregateId: event.aggregateId,
            version: event.version || 1,
            data: event.data || {},
            metadata: {
                timestamp: new Date(),
                correlationId: options.correlationId || null,
                causationId: options.causationId || null,
                userId: options.userId || 'system',
                source: options.source || 'unknown',
                ...event.metadata,
                ...options.metadata
            },
            streamName: options.streamName || null,
            expectedVersion: options.expectedVersion || null
        };
    }

    /**
     * Persist event to storage
     */
    async persistEvent(event) {
        // Add to aggregate event store
        let aggregateEvents = this.eventStore.get(event.aggregateId);
        if (!aggregateEvents) {
            aggregateEvents = [];
            this.eventStore.set(event.aggregateId, aggregateEvents);
        }
        
        // Check for version conflicts
        if (event.expectedVersion !== null) {
            const currentVersion = aggregateEvents.length;
            if (currentVersion !== event.expectedVersion) {
                throw new Error(`Version conflict: expected ${event.expectedVersion}, actual ${currentVersion}`);
            }
        }

        aggregateEvents.push(event);
        
        // Update event by ID mapping
        this.eventById.set(event.id, event);
        
        console.log(`[EventSourcingPlatform] Event persisted: ${event.type} (${event.id})`);
    }

    /**
     * Update event indices
     */
    async updateEventIndices(event) {
        // Index by event type
        let typeEvents = this.eventsByType.get(event.type);
        if (!typeEvents) {
            typeEvents = [];
            this.eventsByType.set(event.type, typeEvents);
        }
        typeEvents.push(event);

        // Additional indexing could be implemented here
    }

    /**
     * Add event to stream
     */
    async addToEventStream(event) {
        let streamEvents = this.eventStreams.get(event.streamName);
        if (!streamEvents) {
            streamEvents = [];
            this.eventStreams.set(event.streamName, streamEvents);
        }
        
        streamEvents.push(event);
        
        // Notify stream subscribers
        await this.notifyStreamSubscribers(event.streamName, event);
    }

    /**
     * Trigger event handlers
     */
    async triggerEventHandlers(event) {
        const handlers = this.eventHandlers.get(event.type) || [];
        
        for (const handler of handlers) {
            try {
                await handler(event, this);
            } catch (error) {
                console.error(`[EventSourcingPlatform] Event handler error for ${event.type}:`, error);
            }
        }
    }

    /**
     * Load events for aggregate
     */
    async loadEvents(aggregateId, fromVersion = 1, toVersion = null) {
        const aggregateEvents = this.eventStore.get(aggregateId) || [];
        
        return aggregateEvents.filter(event => {
            if (event.version < fromVersion) return false;
            if (toVersion !== null && event.version > toVersion) return false;
            return true;
        });
    }

    /**
     * Apply event to aggregate
     */
    async applyEventToAggregate(aggregate, event) {
        // Check if aggregate has event handler method
        const methodName = `on${event.type}`;
        if (typeof aggregate[methodName] === 'function') {
            aggregate[methodName](event);
        } else if (typeof aggregate.apply === 'function') {
            aggregate.apply(event);
        }
        
        // Update aggregate version
        aggregate.version = event.version;
        aggregate.lastModified = event.metadata.timestamp;
    }

    /**
     * Load snapshot for aggregate
     */
    async loadSnapshot(aggregateId) {
        return this.snapshots.get(aggregateId) || null;
    }

    /**
     * Serialize aggregate for snapshot
     */
    serializeAggregate(aggregate) {
        // Simple serialization - in practice, this would be more sophisticated
        return {
            id: aggregate.id,
            type: aggregate.type,
            version: aggregate.version,
            state: aggregate.getState ? aggregate.getState() : aggregate,
            lastModified: aggregate.lastModified
        };
    }

    /**
     * Deserialize aggregate from snapshot
     */
    deserializeAggregate(data, aggregateType) {
        const aggregateDefinition = this.aggregateDefinitions.get(aggregateType);
        if (!aggregateDefinition) {
            throw new Error(`Aggregate type not registered: ${aggregateType}`);
        }
        
        const aggregate = new aggregateDefinition.constructor();
        aggregate.id = data.id;
        aggregate.type = data.type;
        aggregate.version = data.version;
        aggregate.lastModified = data.lastModified;
        
        if (aggregate.setState && data.state) {
            aggregate.setState(data.state);
        } else {
            Object.assign(aggregate, data.state);
        }
        
        return aggregate;
    }

    /**
     * Validate command
     */
    validateCommand(command) {
        if (!command || typeof command !== 'object') {
            throw new Error('Command must be a valid object');
        }
        
        if (!command.type || typeof command.type !== 'string') {
            throw new Error('Command must have a valid type');
        }
        
        if (!command.aggregateId || typeof command.aggregateId !== 'string') {
            throw new Error('Command must have a valid aggregateId');
        }
    }

    /**
     * Validate query
     */
    validateQuery(query) {
        if (!query || typeof query !== 'object') {
            throw new Error('Query must be a valid object');
        }
        
        if (!query.type || typeof query.type !== 'string') {
            throw new Error('Query must have a valid type');
        }
    }

    /**
     * Initialize event store
     */
    async initializeEventStore() {
        console.log('[EventSourcingPlatform] Event store initialized');
    }

    /**
     * Initialize snapshots
     */
    async initializeSnapshots() {
        console.log('[EventSourcingPlatform] Snapshot system initialized');
    }

    /**
     * Initialize CQRS components
     */
    async initializeCQRS() {
        console.log('[EventSourcingPlatform] CQRS components initialized');
    }

    /**
     * Initialize projections
     */
    async initializeProjections() {
        console.log('[EventSourcingPlatform] Projection system initialized');
    }

    /**
     * Initialize event streaming
     */
    async initializeEventStreaming() {
        console.log('[EventSourcingPlatform] Event streaming initialized');
    }

    /**
     * Initialize caching
     */
    async initializeCaching() {
        console.log('[EventSourcingPlatform] Caching system initialized');
    }

    /**
     * Register default aggregate types
     */
    async registerDefaultAggregates() {
        // Register sample aggregate types
        this.registerAggregateType('UserAggregate', class UserAggregate {
            constructor() {
                this.id = null;
                this.type = 'UserAggregate';
                this.version = 0;
                this.name = '';
                this.email = '';
                this.isActive = false;
                this.lastModified = null;
            }
            
            getState() {
                return {
                    name: this.name,
                    email: this.email,
                    isActive: this.isActive
                };
            }
            
            setState(state) {
                this.name = state.name || '';
                this.email = state.email || '';
                this.isActive = state.isActive || false;
            }
            
            onUserCreated(event) {
                this.name = event.data.name;
                this.email = event.data.email;
                this.isActive = true;
            }
            
            onUserUpdated(event) {
                if (event.data.name !== undefined) this.name = event.data.name;
                if (event.data.email !== undefined) this.email = event.data.email;
            }
            
            onUserDeactivated(event) {
                this.isActive = false;
            }
        });
        
        console.log('[EventSourcingPlatform] Default aggregates registered');
    }

    /**
     * Register aggregate type
     */
    registerAggregateType(typeName, aggregateClass) {
        this.aggregateDefinitions.set(typeName, {
            name: typeName,
            constructor: aggregateClass
        });
    }

    /**
     * Register command handler
     */
    registerCommandHandler(commandType, handler) {
        this.commandHandlers.set(commandType, handler);
    }

    /**
     * Register query handler
     */
    registerQueryHandler(queryType, handler) {
        this.queryHandlers.set(queryType, handler);
    }

    /**
     * Register event handler
     */
    registerEventHandler(eventType, handler) {
        let handlers = this.eventHandlers.get(eventType);
        if (!handlers) {
            handlers = [];
            this.eventHandlers.set(eventType, handlers);
        }
        handlers.push(handler);
    }

    /**
     * Update projections with new event
     */
    async updateProjections(event) {
        for (const [projectionName, projection] of this.projections) {
            if (!projection.options.enabled) continue;
            
            // Check if projection handles this event type
            if (projection.options.eventTypes.length > 0 && 
                !projection.options.eventTypes.includes(event.type)) {
                continue;
            }
            
            try {
                const currentState = this.projectionState.get(projectionName);
                const newState = await projection.handler.handle(event, currentState);
                
                this.projectionState.set(projectionName, newState);
                this.projectionOffsets.set(projectionName, event.version);
                
                projection.stats.eventsProcessed++;
                projection.stats.lastProcessedEventId = event.id;
                projection.stats.lastUpdatedAt = new Date();
                
                this.metrics.projections_updated++;
                
            } catch (error) {
                projection.stats.errors++;
                console.error(`[EventSourcingPlatform] Projection error for ${projectionName}:`, error);
            }
        }
    }

    /**
     * Start projection processing
     */
    async startProjectionProcessing(projectionName) {
        console.log(`[EventSourcingPlatform] Started projection processing: ${projectionName}`);
    }

    /**
     * Process catch-up events for subscription
     */
    async processCatchUpEvents(subscription) {
        const streamEvents = this.eventStreams.get(subscription.streamName) || [];
        const fromPosition = subscription.options.fromPosition;
        
        const catchUpEvents = streamEvents.slice(fromPosition);
        
        for (const event of catchUpEvents) {
            try {
                if (subscription.options.filter && !this.applyEventFilter(event, subscription.options.filter)) {
                    continue;
                }
                
                await subscription.callback(event, subscription.id);
                subscription.stats.eventsProcessed++;
                subscription.stats.lastEventPosition = streamEvents.indexOf(event);
                subscription.stats.lastProcessedAt = new Date();
                
            } catch (error) {
                console.error(`[EventSourcingPlatform] Catch-up processing error for subscription ${subscription.id}:`, error);
            }
        }
        
        console.log(`[EventSourcingPlatform] Catch-up completed for subscription ${subscription.id}: ${catchUpEvents.length} events`);
    }

    /**
     * Notify stream subscribers
     */
    async notifyStreamSubscribers(streamName, event) {
        for (const subscription of this.streamSubscriptions.values()) {
            if (subscription.streamName !== streamName) continue;
            
            try {
                if (subscription.options.filter && !this.applyEventFilter(event, subscription.options.filter)) {
                    continue;
                }
                
                await subscription.callback(event, subscription.id);
                subscription.stats.eventsProcessed++;
                subscription.stats.lastProcessedAt = new Date();
                
            } catch (error) {
                console.error(`[EventSourcingPlatform] Stream notification error for subscription ${subscription.id}:`, error);
            }
        }
    }

    /**
     * Apply event filter
     */
    applyEventFilter(event, filter) {
        if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
            return false;
        }
        
        if (filter.aggregateTypes && !filter.aggregateTypes.includes(event.aggregateType)) {
            return false;
        }
        
        return true;
    }

    /**
     * Persist snapshot
     */
    async persistSnapshot(snapshot) {
        console.log(`[EventSourcingPlatform] Snapshot persisted: ${snapshot.id} (mocked)`);
    }

    /**
     * Delete snapshot
     */
    async deleteSnapshot(snapshotId) {
        console.log(`[EventSourcingPlatform] Snapshot deleted: ${snapshotId} (mocked)`);
    }

    /**
     * Shutdown event sourcing platform
     */
    async shutdown() {
        console.log('[EventSourcingPlatform] Shutting down event sourcing platform...');

        // Clear intervals and workers
        for (const interval of this.streamingIntervals.values()) {
            clearInterval(interval);
        }

        // Clear all state
        this.eventStore.clear();
        this.eventsByType.clear();
        this.eventById.clear();
        this.eventStreams.clear();
        this.snapshots.clear();
        this.aggregates.clear();
        this.projections.clear();
        this.streamSubscriptions.clear();
        this.cache.clear();

        this.isRunning = false;
        console.log('[EventSourcingPlatform] Event sourcing platform shutdown complete');
    }
}

export default EventSourcingPlatform;
