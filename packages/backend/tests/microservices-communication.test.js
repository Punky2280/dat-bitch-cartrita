/**
 * Microservices Communication Platform Test Suite
 * 
 * Comprehensive test suite covering Service Mesh, gRPC Enhancement, Message Queues,
 * Event Sourcing, Circuit Breakers, and complete integration scenarios.
 */

import request from 'supertest';
import express from 'express';

// Import components to test
import ServiceMeshController from '../src/services/ServiceMeshController.js';
import GRPCEnhancedTransport from '../src/services/GRPCEnhancedTransport.js';
import MessageQueueEngine from '../src/services/MessageQueueEngine.js';
import EventSourcingPlatform from '../src/services/EventSourcingPlatform.js';
import { CircuitBreakerManager } from '../src/services/CircuitBreakerManager.js';
import createMicroservicesCommRoutes from '../src/routes/microservicesComm.js';

describe('Advanced Microservices Communication Platform', function() {
    this.timeout(30000); // Increase timeout for integration tests

    let mockDb, serviceMesh, grpcTransport, messageQueue, eventSourcing, circuitBreaker;
    let app;

    before(async function() {        
        // Mock database
        mockDb = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            connect: jest.fn().mockResolvedValue(),
            end: jest.fn().mockResolvedValue()
        };

        // Initialize all components
        serviceMesh = new ServiceMeshController(mockDb, {
            enabled: true,
            healthCheckInterval: 1000, // Faster for tests
            serviceTimeout: 5000
        });

        grpcTransport = new GRPCEnhancedTransport(mockDb, {
            enabled: true,
            defaultTimeout: 5000,
            maxRetries: 2
        });

        messageQueue = new MessageQueueEngine(mockDb, {
            enabled: true,
            maxQueueSize: 1000,
            processingInterval: 100
        });

        eventSourcing = new EventSourcingPlatform(mockDb, {
            eventStoreEnabled: true,
            snapshotsEnabled: true,
            cqrsEnabled: true,
            projectionsEnabled: true
        });

        circuitBreaker = new CircuitBreakerManager(mockDb, {
            enabled: true,
            defaultTimeout: 5000,
            defaultFailureThreshold: 3
        });

        // Initialize all components
        await Promise.all([
            serviceMesh.initialize(),
            grpcTransport.initialize(),
            messageQueue.initialize(),
            eventSourcing.initialize(),
            circuitBreaker.initialize()
        ]);

        // Create Express app with routes
        app = express();
        app.use(express.json());
        app.use('/api/microservices', createMicroservicesCommRoutes(
            serviceMesh,
            grpcTransport,
            messageQueue,
            eventSourcing,
            circuitBreaker
        ));
    });

    after(async function() {
        // Cleanup all components
        await Promise.all([
            serviceMesh.shutdown(),
            grpcTransport.shutdown(),
            messageQueue.shutdown(),
            eventSourcing.shutdown(),
            circuitBreaker.shutdown()
        ]);
    });

    // ==================== SERVICE MESH TESTS ====================
    describe('Service Mesh Controller', function() {
        it('should initialize successfully', function() {
            expect(serviceMesh.initialized).to.be.true;
            expect(serviceMesh.isRunning).to.be.true;
        });

        it('should register a service', async function() {
            const serviceConfig = {
                name: 'test-service',
                address: '127.0.0.1',
                port: 8080,
                protocol: 'http',
                healthCheckPath: '/health'
            };

            const result = await serviceMesh.registerService(serviceConfig);
            
            expect(result.success).to.be.true;
            expect(result.serviceId).to.be.a('string');
        });

        it('should discover services by name', async function() {
            // First register a service
            await serviceMesh.registerService({
                name: 'api-service',
                address: '127.0.0.1',
                port: 9000,
                protocol: 'http'
            });

            const services = await serviceMesh.discoverServices('api-service');
            expect(services).to.have.length.greaterThan(0);
            expect(services[0]).to.have.property('name', 'api-service');
        });

        it('should perform load balancing', async function() {
            // Register multiple instances
            const instances = [
                { name: 'lb-service', address: '127.0.0.1', port: 8001, protocol: 'http' },
                { name: 'lb-service', address: '127.0.0.1', port: 8002, protocol: 'http' },
                { name: 'lb-service', address: '127.0.0.1', port: 8003, protocol: 'http' }
            ];

            for (const instance of instances) {
                await serviceMesh.registerService(instance);
            }

            // Test round-robin load balancing
            const selections = [];
            for (let i = 0; i < 6; i++) {
                const selected = await serviceMesh.selectService('lb-service', 'round-robin');
                selections.push(selected.port);
            }

            // Should cycle through all three services twice
            expect(selections).to.include.members([8001, 8002, 8003]);
            expect(selections.slice(0, 3)).to.deep.equal(selections.slice(3, 6));
        });

        it('should handle health checks', async function() {
            const serviceId = (await serviceMesh.registerService({
                name: 'health-service',
                address: '127.0.0.1',
                port: 8080,
                protocol: 'http',
                healthCheckPath: '/health'
            })).serviceId;

            // Mock health check response
            sandbox.stub(serviceMesh, 'performHealthCheck').resolves(true);

            await serviceMesh.checkServiceHealth(serviceId);
            const service = await serviceMesh.getService(serviceId);
            
            expect(service.isHealthy).to.be.true;
        });

        it('should configure traffic splitting', async function() {
            const result = await serviceMesh.configureTrafficSplit('split-service', [
                { version: 'v1', weight: 80 },
                { version: 'v2', weight: 20 }
            ]);

            expect(result.success).to.be.true;
            expect(result.rules).to.have.length(2);
        });
    });

    // ==================== GRPC TRANSPORT TESTS ====================
    describe('gRPC Enhanced Transport', function() {
        it('should initialize successfully', function() {
            expect(grpcTransport.initialized).to.be.true;
            expect(grpcTransport.isRunning).to.be.true;
        });

        it('should create connection pool', async function() {
            const target = 'localhost:50051';
            const result = await grpcTransport.createConnection(target, {}, 3);

            expect(result.success).to.be.true;
            expect(result.poolSize).to.equal(3);
            expect(result.connectionId).to.be.a('string');
        });

        it('should handle connection retry logic', async function() {
            const target = 'unreachable:50051';
            
            // Mock failed connection
            sandbox.stub(grpcTransport, 'establishConnection').rejects(new Error('Connection failed'));

            try {
                await grpcTransport.createConnection(target);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Connection failed');
            }

            // Verify retry attempts were made
            expect(grpcTransport.establishConnection.callCount).to.be.greaterThan(1);
        });

        it('should implement circuit breaker for connections', async function() {
            const target = 'failing:50051';
            
            // Mock consistent failures
            sandbox.stub(grpcTransport, 'makeRawCall').rejects(new Error('Service unavailable'));

            // Make multiple calls to trigger circuit breaker
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    grpcTransport.makeCall(target, 'TestMethod', {})
                        .catch(err => ({ error: err.message }))
                );
            }

            const results = await Promise.all(promises);
            
            // Later calls should be rejected by circuit breaker
            const circuitBreakerRejections = results.filter(r => 
                r.error && r.error.includes('circuit') || r.error.includes('breaker')
            );
            expect(circuitBreakerRejections.length).to.be.greaterThan(0);
        });

        it('should optimize streaming connections', async function() {
            const connectionId = (await grpcTransport.createConnection('localhost:50051')).connectionId;
            
            // Mock streaming setup
            const mockStream = {
                write: sandbox.stub(),
                end: sandbox.stub(),
                on: sandbox.stub()
            };
            sandbox.stub(grpcTransport, 'createStream').returns(mockStream);

            const stream = await grpcTransport.createClientStream(connectionId, 'StreamMethod');
            
            expect(stream).to.equal(mockStream);
            expect(grpcTransport.createStream.calledOnce).to.be.true;
        });

        it('should track performance metrics', async function() {
            const target = 'metrics-test:50051';
            
            // Mock successful call
            sandbox.stub(grpcTransport, 'makeRawCall').resolves({ data: 'success' });

            await grpcTransport.makeCall(target, 'TestMethod', {});
            
            const metrics = await grpcTransport.getMetrics();
            expect(metrics.total_calls).to.be.greaterThan(0);
            expect(metrics.successful_calls).to.be.greaterThan(0);
            expect(metrics.avg_response_time).to.be.a('number');
        });
    });

    // ==================== MESSAGE QUEUE TESTS ====================
    describe('Message Queue Engine', function() {
        it('should initialize successfully', function() {
            expect(messageQueue.initialized).to.be.true;
            expect(messageQueue.isRunning).to.be.true;
        });

        it('should create and manage queues', async function() {
            const result = await messageQueue.createQueue('test-queue', {
                priority: 'normal',
                durable: true,
                maxSize: 1000
            });

            expect(result.success).to.be.true;
            expect(result.queueName).to.equal('test-queue');

            const queueInfo = await messageQueue.getQueueInfo('test-queue');
            expect(queueInfo.name).to.equal('test-queue');
            expect(queueInfo.priority).to.equal('normal');
        });

        it('should send and consume messages', async function() {
            await messageQueue.createQueue('message-test-queue');

            // Send a message
            const sendResult = await messageQueue.sendMessage('message-test-queue', 
                { text: 'Hello, World!' },
                { priority: 'high' }
            );

            expect(sendResult.success).to.be.true;
            expect(sendResult.messageId).to.be.a('string');

            // Consume the message
            const messages = await messageQueue.consumeMessages('message-test-queue', { maxMessages: 1 });
            
            expect(messages).to.have.length(1);
            expect(messages[0].data.text).to.equal('Hello, World!');
            expect(messages[0].priority).to.equal('high');
        });

        it('should handle message priority ordering', async function() {
            await messageQueue.createQueue('priority-queue');

            // Send messages with different priorities
            const messages = [
                { data: { id: 1 }, priority: 'low' },
                { data: { id: 2 }, priority: 'critical' },
                { data: { id: 3 }, priority: 'high' },
                { data: { id: 4 }, priority: 'normal' }
            ];

            for (const msg of messages) {
                await messageQueue.sendMessage('priority-queue', msg.data, { priority: msg.priority });
            }

            // Consume all messages
            const consumed = await messageQueue.consumeMessages('priority-queue', { maxMessages: 4 });

            // Should be ordered by priority: critical, high, normal, low
            expect(consumed[0].data.id).to.equal(2); // critical
            expect(consumed[1].data.id).to.equal(3); // high
            expect(consumed[2].data.id).to.equal(4); // normal
            expect(consumed[3].data.id).to.equal(1); // low
        });

        it('should implement pub/sub topics', async function() {
            await messageQueue.createTopic('test-topic', { durable: true });

            // Subscribe to topic
            let receivedMessages = [];
            const subscriptionId = await messageQueue.subscribe('test-topic', 'test-subscriber', 
                (message) => {
                    receivedMessages.push(message);
                }
            );

            expect(subscriptionId).to.be.a('string');

            // Publish a message
            await messageQueue.publish('test-topic', { event: 'user_created', userId: 123 });

            // Give some time for message delivery
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(receivedMessages).to.have.length(1);
            expect(receivedMessages[0].data.event).to.equal('user_created');
        });

        it('should handle dead letter queues', async function() {
            await messageQueue.createQueue('dlq-test-queue', {
                maxRetries: 2,
                deadLetterQueueName: 'dlq-test-dead-letters'
            });
            await messageQueue.createQueue('dlq-test-dead-letters');

            // Send a message that will always fail processing
            await messageQueue.sendMessage('dlq-test-queue', { shouldFail: true });

            // Mock message processing that always fails
            messageQueue.registerMessageProcessor('dlq-test-queue', async (message) => {
                if (message.data.shouldFail) {
                    throw new Error('Simulated processing failure');
                }
            });

            // Process messages (should fail and eventually go to DLQ)
            await messageQueue.processQueue('dlq-test-queue');
            
            // Check dead letter queue
            const dlqMessages = await messageQueue.consumeMessages('dlq-test-dead-letters', { maxMessages: 10 });
            expect(dlqMessages).to.have.length(1);
            expect(dlqMessages[0].data.shouldFail).to.be.true;
        });

        it('should handle batch processing', async function() {
            await messageQueue.createQueue('batch-queue');

            // Send multiple messages
            const batchData = [];
            for (let i = 0; i < 5; i++) {
                batchData.push({ id: i, data: `message-${i}` });
            }

            const result = await messageQueue.sendBatchMessages('batch-queue', batchData);
            expect(result.success).to.be.true;
            expect(result.messageIds).to.have.length(5);

            // Consume in batch
            const messages = await messageQueue.consumeMessages('batch-queue', { maxMessages: 10 });
            expect(messages).to.have.length(5);
        });
    });

    // ==================== EVENT SOURCING TESTS ====================
    describe('Event Sourcing Platform', function() {
        it('should initialize successfully', function() {
            expect(eventSourcing.initialized).to.be.true;
            expect(eventSourcing.isRunning).to.be.true;
        });

        it('should store and retrieve events', async function() {
            const event = {
                type: 'UserCreated',
                aggregateId: 'user-123',
                version: 1,
                data: {
                    name: 'John Doe',
                    email: 'john@example.com'
                }
            };

            const result = await eventSourcing.storeEvent(event);
            expect(result.success).to.be.true;
            expect(result.eventId).to.be.a('string');

            // Load aggregate to verify event was stored
            const aggregate = await eventSourcing.loadAggregate('user-123', 'UserAggregate');
            expect(aggregate.name).to.equal('John Doe');
            expect(aggregate.email).to.equal('john@example.com');
            expect(aggregate.version).to.equal(1);
        });

        it('should handle CQRS commands and queries', async function() {
            // Register a command handler
            eventSourcing.registerCommandHandler('CreateUser', {
                handle: async (command, context, platform) => {
                    await platform.storeEvent({
                        type: 'UserCreated',
                        aggregateId: command.aggregateId,
                        version: 1,
                        data: command.data
                    });
                    return { userId: command.aggregateId };
                }
            });

            // Register a query handler
            eventSourcing.registerQueryHandler('GetUser', {
                handle: async (query, context, platform) => {
                    return await platform.loadAggregate(query.userId, 'UserAggregate');
                }
            });

            // Process command
            const command = {
                type: 'CreateUser',
                aggregateId: 'user-456',
                data: {
                    name: 'Jane Doe',
                    email: 'jane@example.com'
                }
            };

            const commandResult = await eventSourcing.processCommand(command);
            expect(commandResult.success).to.be.true;
            expect(commandResult.result.userId).to.equal('user-456');

            // Execute query
            const query = {
                type: 'GetUser',
                userId: 'user-456'
            };

            const queryResult = await eventSourcing.executeQuery(query);
            expect(queryResult.success).to.be.true;
            expect(queryResult.result.name).to.equal('Jane Doe');
        });

        it('should create and load snapshots', async function() {
            const aggregateId = 'user-snapshot-test';

            // Create multiple events
            const events = [
                { type: 'UserCreated', version: 1, data: { name: 'Test User' } },
                { type: 'UserUpdated', version: 2, data: { name: 'Updated User' } },
                { type: 'UserUpdated', version: 3, data: { email: 'test@example.com' } }
            ];

            for (const event of events) {
                await eventSourcing.storeEvent({
                    ...event,
                    aggregateId
                });
            }

            // Load aggregate (should be at version 3)
            const aggregate = await eventSourcing.loadAggregate(aggregateId, 'UserAggregate');
            expect(aggregate.version).to.equal(3);

            // Create snapshot
            const snapshotResult = await eventSourcing.createSnapshot(aggregateId, { force: true });
            expect(snapshotResult.success).to.be.true;
            expect(snapshotResult.created).to.be.true;

            // Load aggregate again (should use snapshot)
            const aggregateFromSnapshot = await eventSourcing.loadAggregate(aggregateId, 'UserAggregate');
            expect(aggregateFromSnapshot.version).to.equal(3);
            expect(aggregateFromSnapshot.name).to.equal('Updated User');
            expect(aggregateFromSnapshot.email).to.equal('test@example.com');
        });

        it('should replay events', async function() {
            const aggregateId = 'replay-test-user';

            // Create events
            for (let i = 1; i <= 5; i++) {
                await eventSourcing.storeEvent({
                    type: 'UserUpdated',
                    aggregateId,
                    version: i,
                    data: { updateCount: i }
                });
            }

            // Replay events from version 2 to 4
            const replayResult = await eventSourcing.replayEvents(aggregateId, 2, 4, {
                aggregateType: 'UserAggregate'
            });

            expect(replayResult.success).to.be.true;
            expect(replayResult.eventsReplayed).to.equal(3);
            expect(replayResult.finalVersion).to.equal(4);
        });

        it('should handle event stream subscriptions', async function() {
            const streamName = 'test-stream';
            let receivedEvents = [];

            // Subscribe to event stream
            const subscriptionResult = await eventSourcing.subscribeToEventStream(
                streamName,
                (event, subscriptionId) => {
                    receivedEvents.push({ event, subscriptionId });
                },
                { fromPosition: 0 }
            );

            expect(subscriptionResult.success).to.be.true;

            // Store event with stream name
            await eventSourcing.storeEvent({
                type: 'StreamTestEvent',
                aggregateId: 'stream-test-123',
                version: 1,
                data: { message: 'Hello Stream!' }
            }, { streamName });

            // Give time for event processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(receivedEvents).to.have.length(1);
            expect(receivedEvents[0].event.type).to.equal('StreamTestEvent');
        });

        it('should register and update projections', async function() {
            const projectionName = 'UserEmailProjection';

            // Register projection
            const projectionHandler = {
                getInitialState: () => ({ userEmails: {} }),
                handle: (event, state) => {
                    if (event.type === 'UserCreated' && event.data.email) {
                        state.userEmails[event.aggregateId] = event.data.email;
                    }
                    return state;
                }
            };

            const regResult = await eventSourcing.registerProjection(
                projectionName,
                projectionHandler,
                { eventTypes: ['UserCreated'] }
            );

            expect(regResult.success).to.be.true;

            // Store an event that should trigger the projection
            await eventSourcing.storeEvent({
                type: 'UserCreated',
                aggregateId: 'projection-user-123',
                version: 1,
                data: {
                    name: 'Projection User',
                    email: 'projection@example.com'
                }
            });

            // Give time for projection processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check projection state
            const projection = eventSourcing.projections.get(projectionName);
            expect(projection).to.exist;
            expect(projection.stats.eventsProcessed).to.be.greaterThan(0);
        });
    });

    // ==================== CIRCUIT BREAKER TESTS ====================
    describe('Circuit Breaker Manager', function() {
        it('should initialize successfully', function() {
            expect(circuitBreaker.initialized).to.be.true;
            expect(circuitBreaker.isRunning).to.be.true;
        });

        it('should create circuit breakers', async function() {
            const result = await circuitBreaker.createCircuitBreaker('test-circuit', {
                timeout: 5000,
                failureThreshold: 3,
                successThreshold: 2,
                recoveryTimeout: 10000
            });

            expect(result.success).to.be.true;
            expect(result.name).to.equal('test-circuit');

            const status = circuitBreaker.getCircuitStatus('test-circuit');
            expect(status).to.exist;
            expect(status.state).to.equal('CLOSED');
        });

        it('should open circuit after failures', async function() {
            const circuitName = 'failure-test-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                failureThreshold: 2,
                timeout: 1000
            });

            // Mock operation that always fails
            const failingOperation = () => {
                throw new Error('Operation failed');
            };

            // Execute failing operations
            try {
                await circuitBreaker.executeCall(circuitName, failingOperation);
            } catch (e) { /* ignore */ }

            try {
                await circuitBreaker.executeCall(circuitName, failingOperation);
            } catch (e) { /* ignore */ }

            // Circuit should now be OPEN
            const status = circuitBreaker.getCircuitStatus(circuitName);
            expect(status.state).to.equal('OPEN');
        });

        it('should transition to HALF_OPEN after recovery timeout', async function() {
            const circuitName = 'recovery-test-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                failureThreshold: 1,
                recoveryTimeout: 100, // Short timeout for test
                timeout: 1000
            });

            // Cause circuit to open
            try {
                await circuitBreaker.executeCall(circuitName, () => {
                    throw new Error('Fail to open circuit');
                });
            } catch (e) { /* ignore */ }

            expect(circuitBreaker.getCircuitStatus(circuitName).state).to.equal('OPEN');

            // Wait for recovery timeout
            await new Promise(resolve => setTimeout(resolve, 150));

            // Next call should attempt to transition to HALF_OPEN
            const successfulOperation = () => ({ success: true });

            try {
                const result = await circuitBreaker.executeCall(circuitName, successfulOperation);
                expect(result.success).to.be.true;
            } catch (e) { /* ignore */ }

            // Should eventually be HALF_OPEN or CLOSED
            const finalStatus = circuitBreaker.getCircuitStatus(circuitName);
            expect(['HALF_OPEN', 'CLOSED']).to.include(finalStatus.state);
        });

        it('should handle bulkhead isolation', async function() {
            const circuitName = 'bulkhead-test-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                maxConcurrentCalls: 2,
                timeout: 5000
            });

            const longRunningOperation = () => {
                return new Promise(resolve => setTimeout(() => resolve('done'), 1000));
            };

            // Start 2 concurrent operations (should succeed)
            const promise1 = circuitBreaker.executeCall(circuitName, longRunningOperation);
            const promise2 = circuitBreaker.executeCall(circuitName, longRunningOperation);

            // Third operation should be rejected due to bulkhead
            try {
                await circuitBreaker.executeCall(circuitName, longRunningOperation);
                expect.fail('Should have been rejected by bulkhead');
            } catch (error) {
                expect(error.code).to.equal('BULKHEAD_FULL');
            }

            // Wait for original operations to complete
            await Promise.all([promise1, promise2]);
        });

        it('should execute fallback functions', async function() {
            const circuitName = 'fallback-test-circuit';
            
            const fallbackFn = () => ({ fallback: true, data: 'fallback response' });
            
            await circuitBreaker.createCircuitBreaker(circuitName, {
                failureThreshold: 1,
                timeout: 1000,
                fallback: fallbackFn
            });

            circuitBreaker.registerFallback(circuitName, fallbackFn);

            // Cause circuit to open
            try {
                await circuitBreaker.executeCall(circuitName, () => {
                    throw new Error('Primary operation failed');
                });
            } catch (e) { /* ignore */ }

            // Next call should use fallback
            const result = await circuitBreaker.executeCall(circuitName, () => {
                throw new Error('Should not reach here');
            });

            expect(result.fallback).to.be.true;
            expect(result.data).to.equal('fallback response');
        });

        it('should reset circuit breaker state', async function() {
            const circuitName = 'reset-test-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                failureThreshold: 1,
                timeout: 1000
            });

            // Open the circuit
            try {
                await circuitBreaker.executeCall(circuitName, () => {
                    throw new Error('Fail to open');
                });
            } catch (e) { /* ignore */ }

            expect(circuitBreaker.getCircuitStatus(circuitName).state).to.equal('OPEN');

            // Reset the circuit
            const resetResult = await circuitBreaker.resetCircuit(circuitName);
            expect(resetResult.success).to.be.true;
            expect(resetResult.newState).to.equal('CLOSED');

            const status = circuitBreaker.getCircuitStatus(circuitName);
            expect(status.state).to.equal('CLOSED');
            expect(status.stats.failureCount).to.equal(0);
        });

        it('should track comprehensive metrics', async function() {
            const circuitName = 'metrics-test-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, { timeout: 1000 });

            // Execute successful operations
            for (let i = 0; i < 3; i++) {
                await circuitBreaker.executeCall(circuitName, () => ({ success: true }));
            }

            // Execute failing operation
            try {
                await circuitBreaker.executeCall(circuitName, () => {
                    throw new Error('Intentional failure');
                });
            } catch (e) { /* ignore */ }

            const status = circuitBreaker.getCircuitStatus(circuitName);
            expect(status.stats.totalCalls).to.equal(4);
            expect(status.stats.successfulCalls).to.equal(3);
            expect(status.stats.failedCalls).to.equal(1);
            expect(status.stats.failureRate).to.be.approximately(25, 1); // 1/4 = 25%

            const globalMetrics = circuitBreaker.getStatus().metrics;
            expect(globalMetrics.total_calls).to.be.greaterThan(0);
            expect(globalMetrics.successful_calls).to.be.greaterThan(0);
        });
    });

    // ==================== API INTEGRATION TESTS ====================
    describe('API Integration', function() {
        it('should return system status', async function() {
            const response = await request(app)
                .get('/api/microservices/system/status')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('serviceMesh');
            expect(response.body.data).to.have.property('grpcTransport');
            expect(response.body.data).to.have.property('messageQueue');
            expect(response.body.data).to.have.property('eventSourcing');
            expect(response.body.data).to.have.property('circuitBreaker');
        });

        it('should handle service mesh API operations', async function() {
            // Register service via API
            const serviceData = {
                name: 'api-test-service',
                address: '127.0.0.1',
                port: 8080,
                protocol: 'http',
                healthCheckPath: '/health'
            };

            const registerResponse = await request(app)
                .post('/api/microservices/service-mesh/services')
                .send(serviceData)
                .expect(201);

            expect(registerResponse.body.success).to.be.true;
            expect(registerResponse.body.data.serviceId).to.be.a('string');

            const serviceId = registerResponse.body.data.serviceId;

            // Get service via API
            const getResponse = await request(app)
                .get(`/api/microservices/service-mesh/services/${serviceId}`)
                .expect(200);

            expect(getResponse.body.success).to.be.true;
            expect(getResponse.body.data.name).to.equal('api-test-service');
        });

        it('should handle message queue API operations', async function() {
            // Create queue via API
            const queueData = {
                name: 'api-test-queue',
                priority: 'high',
                durable: true,
                maxSize: 5000
            };

            const createResponse = await request(app)
                .post('/api/microservices/message-queue/queues')
                .send(queueData)
                .expect(201);

            expect(createResponse.body.success).to.be.true;

            // Send message via API
            const messageData = {
                data: { message: 'Hello from API test!' },
                priority: 'high'
            };

            const sendResponse = await request(app)
                .post('/api/microservices/message-queue/queues/api-test-queue/messages')
                .send(messageData)
                .expect(201);

            expect(sendResponse.body.success).to.be.true;
            expect(sendResponse.body.data.messageId).to.be.a('string');

            // Consume message via API
            const consumeResponse = await request(app)
                .post('/api/microservices/message-queue/queues/api-test-queue/consume')
                .send({ maxMessages: 1 })
                .expect(200);

            expect(consumeResponse.body.success).to.be.true;
            expect(consumeResponse.body.data.messages).to.have.length(1);
            expect(consumeResponse.body.data.messages[0].data.message).to.equal('Hello from API test!');
        });

        it('should handle event sourcing API operations', async function() {
            // Store event via API
            const eventData = {
                type: 'APITestEvent',
                aggregateId: 'api-test-aggregate-123',
                version: 1,
                data: {
                    action: 'test_action',
                    value: 'test_value'
                }
            };

            const storeResponse = await request(app)
                .post('/api/microservices/event-sourcing/events')
                .send(eventData)
                .expect(201);

            expect(storeResponse.body.success).to.be.true;
            expect(storeResponse.body.data.eventId).to.be.a('string');

            // Load aggregate via API
            const loadResponse = await request(app)
                .get('/api/microservices/event-sourcing/aggregates/api-test-aggregate-123')
                .query({ aggregateType: 'UserAggregate' })
                .expect(200);

            expect(loadResponse.body.success).to.be.true;
            expect(loadResponse.body.data.id).to.equal('api-test-aggregate-123');
        });

        it('should handle circuit breaker API operations', async function() {
            // Create circuit breaker via API
            const circuitData = {
                name: 'api-test-circuit',
                timeout: 10000,
                failureThreshold: 5,
                successThreshold: 3
            };

            const createResponse = await request(app)
                .post('/api/microservices/circuit-breaker/circuits')
                .send(circuitData)
                .expect(201);

            expect(createResponse.body.success).to.be.true;

            // Get circuit breaker status via API
            const statusResponse = await request(app)
                .get('/api/microservices/circuit-breaker/circuits/api-test-circuit')
                .expect(200);

            expect(statusResponse.body.success).to.be.true;
            expect(statusResponse.body.data.name).to.equal('api-test-circuit');
            expect(statusResponse.body.data.state).to.equal('CLOSED');

            // Reset circuit breaker via API
            const resetResponse = await request(app)
                .post('/api/microservices/circuit-breaker/circuits/api-test-circuit/reset')
                .expect(200);

            expect(resetResponse.body.success).to.be.true;
            expect(resetResponse.body.data.newState).to.equal('CLOSED');
        });

        it('should handle API validation errors', async function() {
            // Test missing required fields
            const invalidService = {
                name: 'invalid-service'
                // Missing address, port, protocol
            };

            const response = await request(app)
                .post('/api/microservices/service-mesh/services')
                .send(invalidService)
                .expect(400);

            expect(response.body.success).to.be.false;
            expect(response.body.error).to.equal('Validation failed');
            expect(response.body.details).to.be.an('array').with.length.greaterThan(0);
        });

        it('should return health check status', async function() {
            const response = await request(app)
                .get('/api/microservices/health')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.data.status).to.equal('healthy');
            expect(response.body.data.components).to.have.property('serviceMesh');
            expect(response.body.data.components).to.have.property('grpcTransport');
            expect(response.body.data.components).to.have.property('messageQueue');
            expect(response.body.data.components).to.have.property('eventSourcing');
            expect(response.body.data.components).to.have.property('circuitBreaker');
        });

        it('should return comprehensive system metrics', async function() {
            const response = await request(app)
                .get('/api/microservices/system/metrics')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.data).to.have.property('serviceMesh');
            expect(response.body.data).to.have.property('grpc');
            expect(response.body.data).to.have.property('messageQueue');
            expect(response.body.data).to.have.property('eventSourcing');
            expect(response.body.data).to.have.property('circuitBreaker');

            // Verify metrics structure
            expect(response.body.data.serviceMesh).to.have.property('totalServices');
            expect(response.body.data.grpc).to.have.property('activeConnections');
            expect(response.body.data.messageQueue).to.have.property('totalQueues');
            expect(response.body.data.eventSourcing).to.have.property('totalEvents');
            expect(response.body.data.circuitBreaker).to.have.property('totalCircuits');
        });
    });

    // ==================== INTEGRATION SCENARIOS ====================
    describe('Integration Scenarios', function() {
        it('should handle end-to-end microservices communication', async function() {
            // 1. Register service in service mesh
            const service = await serviceMesh.registerService({
                name: 'integration-service',
                address: '127.0.0.1',
                port: 8080,
                protocol: 'grpc'
            });

            // 2. Create circuit breaker for the service
            await circuitBreaker.createCircuitBreaker('integration-service', {
                timeout: 5000,
                failureThreshold: 3
            });

            // 3. Create message queue for async communication
            await messageQueue.createQueue('integration-queue');

            // 4. Set up event sourcing for state tracking
            await eventSourcing.storeEvent({
                type: 'ServiceRegistered',
                aggregateId: service.serviceId,
                version: 1,
                data: { serviceName: 'integration-service' }
            });

            // 5. Execute operation through circuit breaker
            const operation = async () => {
                // Simulate gRPC call
                await grpcTransport.makeCall('127.0.0.1:8080', 'TestMethod', {});
                
                // Send async notification
                await messageQueue.sendMessage('integration-queue', {
                    event: 'operation_completed',
                    serviceId: service.serviceId
                });

                return { success: true };
            };

            const result = await circuitBreaker.executeCall('integration-service', operation);
            expect(result.success).to.be.true;

            // 6. Verify all components tracked the operation
            const serviceStatus = serviceMesh.getServiceStatus(service.serviceId);
            expect(serviceStatus).to.exist;

            const circuitStatus = circuitBreaker.getCircuitStatus('integration-service');
            expect(circuitStatus.stats.totalCalls).to.be.greaterThan(0);

            const queueInfo = await messageQueue.getQueueInfo('integration-queue');
            expect(queueInfo.totalMessages).to.be.greaterThan(0);
        });

        it('should handle cascading failures gracefully', async function() {
            // Set up services with dependencies
            const services = [
                { name: 'frontend-service', port: 8001 },
                { name: 'api-service', port: 8002 },
                { name: 'database-service', port: 8003 }
            ];

            // Register all services
            for (const svc of services) {
                await serviceMesh.registerService({
                    name: svc.name,
                    address: '127.0.0.1',
                    port: svc.port,
                    protocol: 'http'
                });

                await circuitBreaker.createCircuitBreaker(svc.name, {
                    failureThreshold: 2,
                    timeout: 1000
                });
            }

            // Simulate database service failure
            const dbFailOperation = () => {
                throw new Error('Database connection failed');
            };

            // This should open the database circuit
            try {
                await circuitBreaker.executeCall('database-service', dbFailOperation);
                await circuitBreaker.executeCall('database-service', dbFailOperation);
            } catch (e) { /* ignore */ }

            const dbCircuitStatus = circuitBreaker.getCircuitStatus('database-service');
            expect(dbCircuitStatus.state).to.equal('OPEN');

            // API service calls should now use fallback or fail gracefully
            const apiOperation = async () => {
                // Simulate API service trying to call database
                try {
                    await circuitBreaker.executeCall('database-service', () => {
                        throw new Error('Should not execute - circuit is open');
                    });
                } catch (error) {
                    if (error.code === 'CIRCUIT_OPEN') {
                        // Use cached data as fallback
                        return { data: 'cached_response', source: 'fallback' };
                    }
                    throw error;
                }
            };

            const apiResult = await apiOperation();
            expect(apiResult.source).to.equal('fallback');

            // Frontend should still be able to serve some content
            const frontendStatus = circuitBreaker.getCircuitStatus('frontend-service');
            expect(frontendStatus.state).to.equal('CLOSED'); // Not affected by downstream failure
        });

        it('should handle high load scenarios', async function() {
            // Set up load testing scenario
            await serviceMesh.registerService({
                name: 'load-test-service',
                address: '127.0.0.1',
                port: 8080,
                protocol: 'http'
            });

            await circuitBreaker.createCircuitBreaker('load-test-service', {
                maxConcurrentCalls: 5,
                timeout: 100
            });

            await messageQueue.createQueue('load-test-queue', { maxSize: 1000 });

            // Simulate high load
            const concurrentOperations = [];
            for (let i = 0; i < 20; i++) {
                const operation = async () => {
                    try {
                        // Some operations go through circuit breaker
                        if (i % 3 === 0) {
                            return await circuitBreaker.executeCall('load-test-service', async () => {
                                await new Promise(resolve => setTimeout(resolve, 50));
                                return { operationId: i, result: 'circuit-breaker' };
                            });
                        }
                        
                        // Some operations use message queues
                        if (i % 3 === 1) {
                            await messageQueue.sendMessage('load-test-queue', {
                                operationId: i,
                                timestamp: Date.now()
                            });
                            return { operationId: i, result: 'message-queue' };
                        }
                        
                        // Some operations store events
                        await eventSourcing.storeEvent({
                            type: 'LoadTestEvent',
                            aggregateId: `load-test-${i}`,
                            version: 1,
                            data: { operationId: i }
                        });
                        return { operationId: i, result: 'event-sourcing' };

                    } catch (error) {
                        return { operationId: i, error: error.message };
                    }
                };

                concurrentOperations.push(operation());
            }

            const results = await Promise.all(concurrentOperations);
            
            // Verify that system handled the load
            const successfulOps = results.filter(r => r.result && !r.error);
            const failedOps = results.filter(r => r.error);
            
            // Some operations should succeed
            expect(successfulOps.length).to.be.greaterThan(10);
            
            // Some may fail due to bulkhead limits, but system should remain stable
            const circuitStatus = circuitBreaker.getCircuitStatus('load-test-service');
            const queueInfo = await messageQueue.getQueueInfo('load-test-queue');
            
            expect(circuitStatus).to.exist;
            expect(queueInfo.totalMessages).to.be.greaterThan(5);

            console.log(`Load test results: ${successfulOps.length} succeeded, ${failedOps.length} failed`);
        });

        it('should maintain data consistency across components', async function() {
            // Create a scenario where multiple components need to stay in sync
            const aggregateId = 'consistency-test-123';

            // 1. Store initial event
            await eventSourcing.storeEvent({
                type: 'AccountCreated',
                aggregateId,
                version: 1,
                data: { balance: 1000, accountNumber: '12345' }
            });

            // 2. Send notification via message queue
            await messageQueue.sendMessage('account-notifications', {
                event: 'account_created',
                aggregateId,
                balance: 1000
            });

            // 3. Register account service
            const service = await serviceMesh.registerService({
                name: 'account-service',
                address: '127.0.0.1',
                port: 8080,
                protocol: 'http'
            });

            // 4. Process transaction through event sourcing
            await eventSourcing.storeEvent({
                type: 'MoneyWithdrawn',
                aggregateId,
                version: 2,
                data: { amount: 100, newBalance: 900 }
            });

            // 5. Load aggregate and verify consistency
            const aggregate = await eventSourcing.loadAggregate(aggregateId, 'UserAggregate');
            expect(aggregate.version).to.equal(2);

            // 6. Verify message was queued
            const queueInfo = await messageQueue.getQueueInfo('account-notifications');
            expect(queueInfo.totalMessages).to.be.greaterThan(0);

            // 7. Verify service is tracked
            const serviceInfo = await serviceMesh.getService(service.serviceId);
            expect(serviceInfo.name).to.equal('account-service');

            // All components should have consistent view of the system state
            expect(aggregate.id).to.equal(aggregateId);
            expect(serviceInfo.id).to.equal(service.serviceId);
        });
    });
});

module.exports = {
    // Export test utilities for use in other test files
    createMockServices: async (serviceMesh, count = 3) => {
        const services = [];
        for (let i = 0; i < count; i++) {
            const service = await serviceMesh.registerService({
                name: `mock-service-${i}`,
                address: '127.0.0.1',
                port: 8000 + i,
                protocol: 'http'
            });
            services.push(service);
        }
        return services;
    },

    createMockEvents: async (eventSourcing, aggregateId, count = 5) => {
        const events = [];
        for (let i = 1; i <= count; i++) {
            const event = await eventSourcing.storeEvent({
                type: `MockEvent${i}`,
                aggregateId,
                version: i,
                data: { eventNumber: i, timestamp: Date.now() }
            });
            events.push(event);
        }
        return events;
    },

    waitForAsync: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};
