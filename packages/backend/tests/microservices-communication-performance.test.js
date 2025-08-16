/**
 * Microservices Communication Performance Test Suite
 * 
 * Performance and stress testing for the Advanced Microservices Communication Platform
 * covering load testing, benchmarking, and scalability validation.
 */

import { expect } from 'chai';
import { performance } from 'perf_hooks';
import cluster from 'cluster';
import os from 'os';

// Import components
import ServiceMeshController from '../src/services/ServiceMeshController.js';
import GRPCEnhancedTransport from '../src/services/GRPCEnhancedTransport.js';
import MessageQueueEngine from '../src/services/MessageQueueEngine.js';
import EventSourcingPlatform from '../src/services/EventSourcingPlatform.js';
import { CircuitBreakerManager } from '../src/services/CircuitBreakerManager.js';

describe('Microservices Communication - Performance Tests', function() {
    this.timeout(60000); // Extended timeout for performance tests

    let mockDb, serviceMesh, grpcTransport, messageQueue, eventSourcing, circuitBreaker;
    let performanceMetrics = {
        serviceMesh: [],
        grpcTransport: [],
        messageQueue: [],
        eventSourcing: [],
        circuitBreaker: []
    };

    before(async function() {
        // Mock database with performance tracking
        mockDb = {
            query: async (sql, params) => {
                const start = performance.now();
                // Simulate DB delay
                await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
                const end = performance.now();
                return { 
                    rows: [], 
                    queryTime: end - start 
                };
            },
            connect: async () => {},
            end: async () => {}
        };

        // Initialize components with performance-oriented configs
        serviceMesh = new ServiceMeshController(mockDb, {
            enabled: true,
            healthCheckInterval: 500, // Faster health checks
            serviceTimeout: 2000,
            maxServices: 1000
        });

        grpcTransport = new GRPCEnhancedTransport(mockDb, {
            enabled: true,
            defaultTimeout: 1000,
            maxRetries: 1, // Fewer retries for performance
            connectionPoolSize: 10
        });

        messageQueue = new MessageQueueEngine(mockDb, {
            enabled: true,
            maxQueueSize: 10000,
            processingInterval: 50, // Faster processing
            batchSize: 100
        });

        eventSourcing = new EventSourcingPlatform(mockDb, {
            eventStoreEnabled: true,
            snapshotsEnabled: true,
            cqrsEnabled: true,
            projectionsEnabled: true,
            batchSize: 50
        });

        circuitBreaker = new CircuitBreakerManager(mockDb, {
            enabled: true,
            defaultTimeout: 1000,
            defaultFailureThreshold: 10, // Higher threshold for performance tests
            maxConcurrentCalls: 100
        });

        await Promise.all([
            serviceMesh.initialize(),
            grpcTransport.initialize(),
            messageQueue.initialize(),
            eventSourcing.initialize(),
            circuitBreaker.initialize()
        ]);
    });

    after(async function() {
        await Promise.all([
            serviceMesh.shutdown(),
            grpcTransport.shutdown(),
            messageQueue.shutdown(),
            eventSourcing.shutdown(),
            circuitBreaker.shutdown()
        ]);

        // Output performance summary
        console.log('\n=== PERFORMANCE SUMMARY ===');
        for (const [component, metrics] of Object.entries(performanceMetrics)) {
            if (metrics.length > 0) {
                const avg = metrics.reduce((sum, m) => sum + m, 0) / metrics.length;
                const min = Math.min(...metrics);
                const max = Math.max(...metrics);
                console.log(`${component}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
            }
        }
    });

    // Helper function to measure operation time
    const measureOperation = async (component, operation) => {
        const start = performance.now();
        const result = await operation();
        const end = performance.now();
        const duration = end - start;
        
        if (performanceMetrics[component]) {
            performanceMetrics[component].push(duration);
        }
        
        return { result, duration };
    };

    // ==================== SERVICE MESH PERFORMANCE ====================
    describe('Service Mesh Performance', function() {
        it('should handle service registration at scale', async function() {
            const serviceCount = 100;
            const registrationTimes = [];

            for (let i = 0; i < serviceCount; i++) {
                const { duration } = await measureOperation('serviceMesh', async () => {
                    return await serviceMesh.registerService({
                        name: `perf-service-${i}`,
                        address: '127.0.0.1',
                        port: 8000 + i,
                        protocol: 'http'
                    });
                });
                registrationTimes.push(duration);
            }

            const avgRegistrationTime = registrationTimes.reduce((sum, t) => sum + t, 0) / registrationTimes.length;
            console.log(`Average service registration time: ${avgRegistrationTime.toFixed(2)}ms`);

            // Performance threshold: should register services in under 10ms on average
            expect(avgRegistrationTime).to.be.below(10);
        });

        it('should handle service discovery efficiently', async function() {
            // Register services for discovery testing
            for (let i = 0; i < 50; i++) {
                await serviceMesh.registerService({
                    name: `discovery-service-${i % 10}`, // 10 unique service names, 5 instances each
                    address: '127.0.0.1',
                    port: 9000 + i,
                    protocol: 'http'
                });
            }

            const discoveryTimes = [];
            const serviceNames = Array.from({ length: 10 }, (_, i) => `discovery-service-${i}`);

            for (let i = 0; i < 100; i++) {
                const serviceName = serviceNames[i % 10];
                const { duration } = await measureOperation('serviceMesh', async () => {
                    return await serviceMesh.discoverServices(serviceName);
                });
                discoveryTimes.push(duration);
            }

            const avgDiscoveryTime = discoveryTimes.reduce((sum, t) => sum + t, 0) / discoveryTimes.length;
            console.log(`Average service discovery time: ${avgDiscoveryTime.toFixed(2)}ms`);

            // Performance threshold: should discover services in under 5ms on average
            expect(avgDiscoveryTime).to.be.below(5);
        });

        it('should perform load balancing efficiently', async function() {
            // Register services for load balancing
            const serviceName = 'load-balance-perf-service';
            for (let i = 0; i < 10; i++) {
                await serviceMesh.registerService({
                    name: serviceName,
                    address: '127.0.0.1',
                    port: 7000 + i,
                    protocol: 'http'
                });
            }

            const selectionTimes = [];
            const algorithms = ['round-robin', 'least-connections', 'weighted'];

            for (let i = 0; i < 300; i++) {
                const algorithm = algorithms[i % 3];
                const { duration } = await measureOperation('serviceMesh', async () => {
                    return await serviceMesh.selectService(serviceName, algorithm);
                });
                selectionTimes.push(duration);
            }

            const avgSelectionTime = selectionTimes.reduce((sum, t) => sum + t, 0) / selectionTimes.length;
            console.log(`Average load balancing time: ${avgSelectionTime.toFixed(2)}ms`);

            // Performance threshold: should select services in under 3ms on average
            expect(avgSelectionTime).to.be.below(3);
        });

        it('should handle concurrent service operations', async function() {
            const concurrentOperations = 50;
            const operations = [];

            for (let i = 0; i < concurrentOperations; i++) {
                operations.push(
                    measureOperation('serviceMesh', async () => {
                        // Mix of registration, discovery, and selection
                        if (i % 3 === 0) {
                            return await serviceMesh.registerService({
                                name: `concurrent-service-${i}`,
                                address: '127.0.0.1',
                                port: 6000 + i,
                                protocol: 'http'
                            });
                        } else if (i % 3 === 1) {
                            return await serviceMesh.discoverServices('concurrent-service-0');
                        } else {
                            return await serviceMesh.selectService('concurrent-service-0', 'round-robin');
                        }
                    })
                );
            }

            const start = performance.now();
            const results = await Promise.all(operations);
            const end = performance.now();
            const totalTime = end - start;

            console.log(`Concurrent operations (${concurrentOperations}) completed in: ${totalTime.toFixed(2)}ms`);
            
            // All operations should succeed
            results.forEach(({ result }) => {
                expect(result).to.exist;
            });

            // Performance threshold: concurrent operations should complete in reasonable time
            expect(totalTime).to.be.below(1000); // Under 1 second for 50 operations
        });
    });

    // ==================== MESSAGE QUEUE PERFORMANCE ====================
    describe('Message Queue Performance', function() {
        it('should handle high-throughput message sending', async function() {
            await messageQueue.createQueue('perf-send-queue', { maxSize: 10000 });

            const messageCount = 1000;
            const sendTimes = [];

            for (let i = 0; i < messageCount; i++) {
                const { duration } = await measureOperation('messageQueue', async () => {
                    return await messageQueue.sendMessage('perf-send-queue', {
                        id: i,
                        data: `performance test message ${i}`,
                        timestamp: Date.now()
                    });
                });
                sendTimes.push(duration);
            }

            const avgSendTime = sendTimes.reduce((sum, t) => sum + t, 0) / sendTimes.length;
            console.log(`Average message send time: ${avgSendTime.toFixed(2)}ms`);

            // Performance threshold: should send messages in under 2ms on average
            expect(avgSendTime).to.be.below(2);
        });

        it('should handle batch message processing efficiently', async function() {
            await messageQueue.createQueue('perf-batch-queue', { maxSize: 10000 });

            const batchSizes = [10, 50, 100, 200];
            const batchResults = [];

            for (const batchSize of batchSizes) {
                const messages = Array.from({ length: batchSize }, (_, i) => ({
                    id: i,
                    data: `batch message ${i}`,
                    batchSize
                }));

                const { duration } = await measureOperation('messageQueue', async () => {
                    return await messageQueue.sendBatchMessages('perf-batch-queue', messages);
                });

                const throughput = batchSize / (duration / 1000); // messages per second
                batchResults.push({ batchSize, duration, throughput });
                
                console.log(`Batch size ${batchSize}: ${duration.toFixed(2)}ms, throughput: ${throughput.toFixed(0)} msg/sec`);
            }

            // Verify throughput increases with batch size
            expect(batchResults[3].throughput).to.be.greaterThan(batchResults[0].throughput);
        });

        it('should handle pub/sub with multiple subscribers efficiently', async function() {
            await messageQueue.createTopic('perf-topic', { durable: true });

            const subscriberCount = 20;
            const messageCount = 100;
            let totalMessagesReceived = 0;
            const subscriptionTimes = [];

            // Create subscribers
            for (let i = 0; i < subscriberCount; i++) {
                const { duration } = await measureOperation('messageQueue', async () => {
                    return await messageQueue.subscribe(`perf-topic`, `perf-subscriber-${i}`, 
                        (message) => {
                            totalMessagesReceived++;
                        }
                    );
                });
                subscriptionTimes.push(duration);
            }

            const avgSubscriptionTime = subscriptionTimes.reduce((sum, t) => sum + t, 0) / subscriptionTimes.length;
            console.log(`Average subscription time: ${avgSubscriptionTime.toFixed(2)}ms`);

            // Publish messages
            const publishStart = performance.now();
            for (let i = 0; i < messageCount; i++) {
                await messageQueue.publish('perf-topic', {
                    messageId: i,
                    content: `pub/sub performance test ${i}`
                });
            }
            const publishEnd = performance.now();
            const publishTime = publishEnd - publishStart;

            console.log(`Published ${messageCount} messages in ${publishTime.toFixed(2)}ms`);

            // Wait for message delivery
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Each message should be received by all subscribers
            expect(totalMessagesReceived).to.equal(messageCount * subscriberCount);
        });

        it('should maintain priority ordering under load', async function() {
            await messageQueue.createQueue('perf-priority-queue');

            const messageCount = 500;
            const priorities = ['low', 'normal', 'high', 'critical'];
            const sendPromises = [];

            // Send messages with random priorities concurrently
            for (let i = 0; i < messageCount; i++) {
                const priority = priorities[Math.floor(Math.random() * priorities.length)];
                sendPromises.push(
                    messageQueue.sendMessage('perf-priority-queue', { id: i }, { priority })
                );
            }

            const sendStart = performance.now();
            await Promise.all(sendPromises);
            const sendEnd = performance.now();

            console.log(`Sent ${messageCount} priority messages in ${(sendEnd - sendStart).toFixed(2)}ms`);

            // Consume all messages and verify priority ordering
            const consumeStart = performance.now();
            const allMessages = await messageQueue.consumeMessages('perf-priority-queue', { maxMessages: messageCount });
            const consumeEnd = performance.now();

            console.log(`Consumed ${allMessages.length} messages in ${(consumeEnd - consumeStart).toFixed(2)}ms`);

            // Verify priority ordering (critical > high > normal > low)
            const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
            for (let i = 1; i < allMessages.length; i++) {
                const currentPriority = priorityOrder[allMessages[i].priority];
                const previousPriority = priorityOrder[allMessages[i - 1].priority];
                expect(currentPriority).to.be.at.most(previousPriority);
            }
        });
    });

    // ==================== EVENT SOURCING PERFORMANCE ====================
    describe('Event Sourcing Performance', function() {
        it('should handle high-throughput event storage', async function() {
            const eventCount = 1000;
            const aggregateCount = 10;
            const storeTimes = [];

            for (let i = 0; i < eventCount; i++) {
                const aggregateId = `perf-aggregate-${i % aggregateCount}`;
                const version = Math.floor(i / aggregateCount) + 1;

                const { duration } = await measureOperation('eventSourcing', async () => {
                    return await eventSourcing.storeEvent({
                        type: 'PerformanceTestEvent',
                        aggregateId,
                        version,
                        data: {
                            eventNumber: i,
                            timestamp: Date.now(),
                            payload: 'test data'
                        }
                    });
                });
                storeTimes.push(duration);
            }

            const avgStoreTime = storeTimes.reduce((sum, t) => sum + t, 0) / storeTimes.length;
            console.log(`Average event store time: ${avgStoreTime.toFixed(2)}ms`);

            // Performance threshold: should store events in under 5ms on average
            expect(avgStoreTime).to.be.below(5);
        });

        it('should handle aggregate loading efficiently', async function() {
            // Create events for multiple aggregates
            const aggregateIds = [];
            for (let i = 0; i < 50; i++) {
                const aggregateId = `load-test-aggregate-${i}`;
                aggregateIds.push(aggregateId);

                // Store 20 events per aggregate
                for (let version = 1; version <= 20; version++) {
                    await eventSourcing.storeEvent({
                        type: 'LoadTestEvent',
                        aggregateId,
                        version,
                        data: { step: version, data: `step ${version} data` }
                    });
                }
            }

            // Test concurrent aggregate loading
            const loadTimes = [];
            const loadPromises = aggregateIds.map(async (aggregateId) => {
                const { duration } = await measureOperation('eventSourcing', async () => {
                    return await eventSourcing.loadAggregate(aggregateId, 'UserAggregate');
                });
                loadTimes.push(duration);
                return duration;
            });

            await Promise.all(loadPromises);

            const avgLoadTime = loadTimes.reduce((sum, t) => sum + t, 0) / loadTimes.length;
            console.log(`Average aggregate load time: ${avgLoadTime.toFixed(2)}ms`);

            // Performance threshold: should load aggregates in under 10ms on average
            expect(avgLoadTime).to.be.below(10);
        });

        it('should handle CQRS command processing efficiently', async function() {
            // Register performance-optimized command handler
            eventSourcing.registerCommandHandler('PerfTestCommand', {
                handle: async (command, context, platform) => {
                    await platform.storeEvent({
                        type: 'PerfCommandExecuted',
                        aggregateId: command.aggregateId,
                        version: command.version || 1,
                        data: command.data
                    });
                    return { processed: true, aggregateId: command.aggregateId };
                }
            });

            const commandCount = 200;
            const processingTimes = [];

            for (let i = 0; i < commandCount; i++) {
                const command = {
                    type: 'PerfTestCommand',
                    aggregateId: `perf-command-aggregate-${i % 20}`,
                    version: Math.floor(i / 20) + 1,
                    data: { commandId: i, timestamp: Date.now() }
                };

                const { duration } = await measureOperation('eventSourcing', async () => {
                    return await eventSourcing.processCommand(command);
                });
                processingTimes.push(duration);
            }

            const avgProcessingTime = processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;
            console.log(`Average command processing time: ${avgProcessingTime.toFixed(2)}ms`);

            // Performance threshold: should process commands in under 8ms on average
            expect(avgProcessingTime).to.be.below(8);
        });

        it('should handle event streaming efficiently', async function() {
            const streamName = 'perf-stream';
            let eventsReceived = 0;
            const receiveStart = performance.now();

            // Subscribe to event stream
            await eventSourcing.subscribeToEventStream(
                streamName,
                (event, subscriptionId) => {
                    eventsReceived++;
                },
                { fromPosition: 0 }
            );

            // Store events with stream
            const eventCount = 100;
            const storeStart = performance.now();

            for (let i = 0; i < eventCount; i++) {
                await eventSourcing.storeEvent({
                    type: 'StreamPerfEvent',
                    aggregateId: `stream-perf-${i}`,
                    version: 1,
                    data: { eventIndex: i }
                }, { streamName });
            }

            const storeEnd = performance.now();
            console.log(`Stored ${eventCount} stream events in ${(storeEnd - storeStart).toFixed(2)}ms`);

            // Wait for events to be streamed
            await new Promise(resolve => setTimeout(resolve, 500));

            const receiveEnd = performance.now();
            console.log(`Received ${eventsReceived} events in ${(receiveEnd - receiveStart).toFixed(2)}ms`);

            expect(eventsReceived).to.equal(eventCount);
        });

        it('should handle projection updates efficiently', async function() {
            const projectionName = 'PerfProjection';
            let projectionUpdates = 0;

            // Register performance projection
            await eventSourcing.registerProjection(
                projectionName,
                {
                    getInitialState: () => ({ eventCount: 0, aggregates: {} }),
                    handle: (event, state) => {
                        projectionUpdates++;
                        state.eventCount++;
                        if (!state.aggregates[event.aggregateId]) {
                            state.aggregates[event.aggregateId] = 0;
                        }
                        state.aggregates[event.aggregateId]++;
                        return state;
                    }
                },
                { eventTypes: ['ProjectionPerfEvent'] }
            );

            // Store events that trigger projection
            const eventCount = 300;
            const projectionStart = performance.now();

            for (let i = 0; i < eventCount; i++) {
                await eventSourcing.storeEvent({
                    type: 'ProjectionPerfEvent',
                    aggregateId: `proj-perf-${i % 30}`, // 30 different aggregates
                    version: Math.floor(i / 30) + 1,
                    data: { eventIndex: i }
                });
            }

            // Wait for projections to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            const projectionEnd = performance.now();

            console.log(`Processed ${projectionUpdates} projection updates in ${(projectionEnd - projectionStart).toFixed(2)}ms`);

            expect(projectionUpdates).to.equal(eventCount);

            const avgProjectionTime = (projectionEnd - projectionStart) / projectionUpdates;
            console.log(`Average projection update time: ${avgProjectionTime.toFixed(2)}ms`);
        });
    });

    // ==================== CIRCUIT BREAKER PERFORMANCE ====================
    describe('Circuit Breaker Performance', function() {
        it('should handle high-frequency calls efficiently', async function() {
            const circuitName = 'perf-test-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                timeout: 1000,
                failureThreshold: 50,
                maxConcurrentCalls: 100
            });

            const callCount = 1000;
            const callTimes = [];

            const fastOperation = () => {
                return Promise.resolve({ success: true, data: 'fast response' });
            };

            for (let i = 0; i < callCount; i++) {
                const { duration } = await measureOperation('circuitBreaker', async () => {
                    return await circuitBreaker.executeCall(circuitName, fastOperation);
                });
                callTimes.push(duration);
            }

            const avgCallTime = callTimes.reduce((sum, t) => sum + t, 0) / callTimes.length;
            console.log(`Average circuit breaker call time: ${avgCallTime.toFixed(2)}ms`);

            // Performance threshold: circuit breaker should add minimal overhead
            expect(avgCallTime).to.be.below(2);
        });

        it('should handle concurrent calls efficiently', async function() {
            const circuitName = 'concurrent-perf-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                timeout: 5000,
                failureThreshold: 100,
                maxConcurrentCalls: 200
            });

            const concurrentCalls = 100;
            const callPromises = [];

            const operation = async (callId) => {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                return { callId, result: 'success' };
            };

            const concurrentStart = performance.now();

            for (let i = 0; i < concurrentCalls; i++) {
                callPromises.push(
                    circuitBreaker.executeCall(circuitName, () => operation(i))
                );
            }

            const results = await Promise.all(callPromises);
            const concurrentEnd = performance.now();
            const totalTime = concurrentEnd - concurrentStart;

            console.log(`${concurrentCalls} concurrent calls completed in ${totalTime.toFixed(2)}ms`);

            // All calls should succeed
            expect(results).to.have.length(concurrentCalls);
            results.forEach((result, index) => {
                expect(result.callId).to.equal(index);
            });

            // Performance threshold: concurrent calls should complete efficiently
            expect(totalTime).to.be.below(1000);
        });

        it('should handle state transitions efficiently', async function() {
            const circuitName = 'state-transition-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                timeout: 100,
                failureThreshold: 3,
                successThreshold: 2,
                recoveryTimeout: 50
            });

            const stateTransitionTimes = [];

            // Measure time to open circuit
            const openStart = performance.now();
            
            for (let i = 0; i < 3; i++) {
                try {
                    await circuitBreaker.executeCall(circuitName, () => {
                        throw new Error('Intentional failure');
                    });
                } catch (e) { /* ignore */ }
            }

            const openEnd = performance.now();
            stateTransitionTimes.push({ state: 'OPEN', duration: openEnd - openStart });

            expect(circuitBreaker.getCircuitStatus(circuitName).state).to.equal('OPEN');

            // Wait for recovery timeout
            await new Promise(resolve => setTimeout(resolve, 100));

            // Measure time for half-open transition
            const halfOpenStart = performance.now();
            
            try {
                await circuitBreaker.executeCall(circuitName, () => ({ success: true }));
            } catch (e) { /* ignore */ }
            
            const halfOpenEnd = performance.now();
            stateTransitionTimes.push({ state: 'HALF_OPEN', duration: halfOpenEnd - halfOpenStart });

            console.log('State transition times:');
            stateTransitionTimes.forEach(({ state, duration }) => {
                console.log(`  ${state}: ${duration.toFixed(2)}ms`);
            });

            // State transitions should be fast
            stateTransitionTimes.forEach(({ duration }) => {
                expect(duration).to.be.below(100);
            });
        });

        it('should handle bulkhead isolation efficiently', async function() {
            const circuitName = 'bulkhead-perf-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                timeout: 1000,
                maxConcurrentCalls: 10
            });

            const acceptedCalls = [];
            const rejectedCalls = [];

            const slowOperation = () => {
                return new Promise(resolve => setTimeout(() => resolve({ slow: true }), 200));
            };

            // Start more calls than the bulkhead allows
            const callPromises = [];
            for (let i = 0; i < 20; i++) {
                callPromises.push(
                    circuitBreaker.executeCall(circuitName, slowOperation)
                        .then(result => acceptedCalls.push(result))
                        .catch(error => rejectedCalls.push(error))
                );
            }

            const bulkheadStart = performance.now();
            await Promise.all(callPromises);
            const bulkheadEnd = performance.now();

            console.log(`Bulkhead test completed in ${(bulkheadEnd - bulkheadStart).toFixed(2)}ms`);
            console.log(`Accepted calls: ${acceptedCalls.length}, Rejected calls: ${rejectedCalls.length}`);

            // Should have exactly 10 accepted calls (bulkhead limit)
            expect(acceptedCalls.length).to.equal(10);
            expect(rejectedCalls.length).to.equal(10);

            // Rejected calls should be fast (no waiting)
            rejectedCalls.forEach(error => {
                expect(error.code).to.equal('BULKHEAD_FULL');
            });
        });

        it('should maintain performance under metrics collection', async function() {
            const circuitName = 'metrics-perf-circuit';
            await circuitBreaker.createCircuitBreaker(circuitName, {
                timeout: 1000,
                collectDetailedMetrics: true // Enable detailed metrics
            });

            const operationCount = 500;
            const operationTimes = [];

            const quickOperation = (id) => {
                return Promise.resolve({ operationId: id, timestamp: Date.now() });
            };

            for (let i = 0; i < operationCount; i++) {
                const { duration } = await measureOperation('circuitBreaker', async () => {
                    return await circuitBreaker.executeCall(circuitName, () => quickOperation(i));
                });
                operationTimes.push(duration);
            }

            const avgOperationTime = operationTimes.reduce((sum, t) => sum + t, 0) / operationTimes.length;
            console.log(`Average operation time with metrics: ${avgOperationTime.toFixed(2)}ms`);

            // Get detailed metrics
            const status = circuitBreaker.getCircuitStatus(circuitName);
            console.log(`Circuit stats: ${JSON.stringify(status.stats)}`);

            expect(status.stats.totalCalls).to.equal(operationCount);
            expect(status.stats.successfulCalls).to.equal(operationCount);

            // Metrics collection should not significantly impact performance
            expect(avgOperationTime).to.be.below(3);
        });
    });

    // ==================== INTEGRATION PERFORMANCE ====================
    describe('Integration Performance', function() {
        it('should handle complex multi-component scenarios', async function() {
            const scenarioName = 'complex-integration-scenario';
            
            // Set up components for integration scenario
            await serviceMesh.registerService({
                name: scenarioName,
                address: '127.0.0.1',
                port: 8080,
                protocol: 'http'
            });

            await circuitBreaker.createCircuitBreaker(scenarioName, {
                timeout: 2000,
                failureThreshold: 10
            });

            await messageQueue.createQueue(`${scenarioName}-queue`);

            // Complex scenario: service call -> event store -> message queue -> projection
            const scenarioCount = 100;
            const scenarioTimes = [];

            for (let i = 0; i < scenarioCount; i++) {
                const scenarioStart = performance.now();

                try {
                    // 1. Execute through circuit breaker (simulating service call)
                    await circuitBreaker.executeCall(scenarioName, async () => {
                        return { serviceCall: true, scenarioId: i };
                    });

                    // 2. Store event
                    await eventSourcing.storeEvent({
                        type: 'IntegrationScenarioEvent',
                        aggregateId: `scenario-${i}`,
                        version: 1,
                        data: { scenarioId: i, step: 'event_stored' }
                    });

                    // 3. Send message
                    await messageQueue.sendMessage(`${scenarioName}-queue`, {
                        scenarioId: i,
                        step: 'message_sent'
                    });

                    const scenarioEnd = performance.now();
                    scenarioTimes.push(scenarioEnd - scenarioStart);

                } catch (error) {
                    console.error(`Scenario ${i} failed:`, error.message);
                }
            }

            const avgScenarioTime = scenarioTimes.reduce((sum, t) => sum + t, 0) / scenarioTimes.length;
            console.log(`Average complex scenario time: ${avgScenarioTime.toFixed(2)}ms`);

            // Complex scenarios should complete in reasonable time
            expect(avgScenarioTime).to.be.below(20);
            expect(scenarioTimes.length).to.equal(scenarioCount);
        });

        it('should maintain performance under system stress', async function() {
            const stressTestDuration = 5000; // 5 seconds
            const operations = ['serviceMesh', 'messageQueue', 'eventSourcing', 'circuitBreaker'];
            let totalOperations = 0;
            const operationCounts = {};
            operations.forEach(op => operationCounts[op] = 0);

            const stressStart = performance.now();
            const stressPromises = [];

            // Start continuous operations for each component
            operations.forEach(operation => {
                stressPromises.push(new Promise((resolve) => {
                    const runStressOperations = async () => {
                        const endTime = stressStart + stressTestDuration;

                        while (performance.now() < endTime) {
                            try {
                                switch (operation) {
                                    case 'serviceMesh':
                                        await serviceMesh.discoverServices('stress-test-service');
                                        break;
                                    case 'messageQueue':
                                        await messageQueue.sendMessage('stress-queue', { stress: true });
                                        break;
                                    case 'eventSourcing':
                                        await eventSourcing.storeEvent({
                                            type: 'StressEvent',
                                            aggregateId: 'stress-aggregate',
                                            version: operationCounts[operation] + 1,
                                            data: { stress: true }
                                        });
                                        break;
                                    case 'circuitBreaker':
                                        await circuitBreaker.executeCall('stress-circuit', () => ({ stress: true }));
                                        break;
                                }
                                operationCounts[operation]++;
                                totalOperations++;
                            } catch (error) {
                                // Continue despite errors
                            }
                        }
                        resolve();
                    };
                    runStressOperations();
                }));
            });

            // Create stress queues and circuits if they don't exist
            try {
                await messageQueue.createQueue('stress-queue');
                await circuitBreaker.createCircuitBreaker('stress-circuit', { timeout: 1000 });
            } catch (e) { /* may already exist */ }

            await Promise.all(stressPromises);
            
            const stressEnd = performance.now();
            const actualDuration = stressEnd - stressStart;
            const throughput = totalOperations / (actualDuration / 1000);

            console.log(`Stress test results (${actualDuration.toFixed(0)}ms):`);
            console.log(`Total operations: ${totalOperations}`);
            console.log(`Throughput: ${throughput.toFixed(0)} ops/sec`);
            operations.forEach(op => {
                console.log(`  ${op}: ${operationCounts[op]} operations`);
            });

            // System should maintain reasonable throughput under stress
            expect(throughput).to.be.greaterThan(100); // At least 100 ops/sec
            expect(totalOperations).to.be.greaterThan(500); // Reasonable operation count

            // All components should complete some operations
            operations.forEach(op => {
                expect(operationCounts[op]).to.be.greaterThan(10);
            });
        });
    });

    // ==================== MEMORY AND RESOURCE PERFORMANCE ====================
    describe('Memory and Resource Performance', function() {
        it('should not leak memory during extended operations', async function() {
            const initialMemory = process.memoryUsage();
            
            // Perform extended operations
            for (let i = 0; i < 500; i++) {
                // Service mesh operations
                await serviceMesh.registerService({
                    name: `memory-test-${i}`,
                    address: '127.0.0.1',
                    port: 5000 + (i % 100), // Reuse ports
                    protocol: 'http'
                });

                // Message queue operations
                await messageQueue.sendMessage('memory-test-queue', { id: i });

                // Event sourcing operations
                await eventSourcing.storeEvent({
                    type: 'MemoryTestEvent',
                    aggregateId: `memory-aggregate-${i % 50}`, // Reuse aggregates
                    version: Math.floor(i / 50) + 1,
                    data: { iteration: i }
                });

                // Circuit breaker operations
                await circuitBreaker.executeCall('memory-test-circuit', () => ({ id: i }));

                // Force garbage collection every 100 operations
                if (i % 100 === 0 && global.gc) {
                    global.gc();
                }
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = {
                heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
                heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
                external: finalMemory.external - initialMemory.external
            };

            console.log('Memory usage change:');
            console.log(`  Heap used: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Heap total: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  External: ${(memoryIncrease.external / 1024 / 1024).toFixed(2)} MB`);

            // Memory increase should be reasonable (less than 50MB for heap used)
            expect(memoryIncrease.heapUsed).to.be.below(50 * 1024 * 1024); // 50MB
        });

        it('should cleanup resources properly on shutdown', async function() {
            // Create temporary components for cleanup testing
            const tempServiceMesh = new ServiceMeshController(mockDb, { enabled: true });
            const tempMessageQueue = new MessageQueueEngine(mockDb, { enabled: true });
            const tempEventSourcing = new EventSourcingPlatform(mockDb, { eventStoreEnabled: true });
            const tempCircuitBreaker = new CircuitBreakerManager(mockDb, { enabled: true });

            await tempServiceMesh.initialize();
            await tempMessageQueue.initialize();
            await tempEventSourcing.initialize();
            await tempCircuitBreaker.initialize();

            // Use components briefly
            await tempServiceMesh.registerService({
                name: 'cleanup-test-service',
                address: '127.0.0.1',
                port: 8999,
                protocol: 'http'
            });

            await tempMessageQueue.createQueue('cleanup-test-queue');
            await tempMessageQueue.sendMessage('cleanup-test-queue', { test: true });

            // Measure cleanup time
            const cleanupStart = performance.now();
            
            await Promise.all([
                tempServiceMesh.shutdown(),
                tempMessageQueue.shutdown(),
                tempEventSourcing.shutdown(),
                tempCircuitBreaker.shutdown()
            ]);

            const cleanupEnd = performance.now();
            const cleanupTime = cleanupEnd - cleanupStart;

            console.log(`Component cleanup completed in ${cleanupTime.toFixed(2)}ms`);

            // Cleanup should be fast
            expect(cleanupTime).to.be.below(1000); // Under 1 second

            // Verify components are properly shutdown
            expect(tempServiceMesh.isRunning).to.be.false;
            expect(tempMessageQueue.isRunning).to.be.false;
            expect(tempEventSourcing.isRunning).to.be.false;
            expect(tempCircuitBreaker.isRunning).to.be.false;
        });
    });
});
