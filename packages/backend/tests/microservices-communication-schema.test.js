/**
 * Database Schema Validation Test Suite
 * 
 * Tests for validating the microservices communication database schema
 * including table creation, indexes, triggers, functions, and data integrity.
 */

import { expect } from 'chai';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

describe('Microservices Communication Database Schema', function() {
    this.timeout(30000);

    let db, pool;
    const testDatabaseName = `test_microservices_comm_${Date.now()}`;

    before(async function() {
        // Connect to PostgreSQL to create test database
        const adminPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: 'postgres'
        });

        try {
            await adminPool.query(`CREATE DATABASE "${testDatabaseName}"`);
        } catch (error) {
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }

        await adminPool.end();

        // Connect to test database
        pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: testDatabaseName
        });

        db = {
            query: async (text, params) => {
                const client = await pool.connect();
                try {
                    return await client.query(text, params);
                } finally {
                    client.release();
                }
            }
        };
    });

    after(async function() {
        if (pool) {
            await pool.end();
        }

        // Cleanup test database
        const adminPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: 'postgres'
        });

        try {
            await adminPool.query(`DROP DATABASE IF EXISTS "${testDatabaseName}"`);
        } catch (error) {
            console.warn('Could not drop test database:', error.message);
        }

        await adminPool.end();
    });

    it('should install pgvector extension', async function() {
        // First install pgvector (required for some tables)
        const setupSql = fs.readFileSync(
            path.join(__dirname, '../../../db-init/00_setup_pgvector.sql'),
            'utf8'
        );

        await db.query(setupSql);

        // Verify extension is installed
        const result = await db.query(`
            SELECT extname FROM pg_extension WHERE extname = 'vector'
        `);
        
        expect(result.rows).to.have.length.greaterThan(0);
        expect(result.rows[0].extname).to.equal('vector');
    });

    it('should apply microservices communication schema', async function() {
        // Apply the microservices communication schema
        const schemaSql = fs.readFileSync(
            path.join(__dirname, '../../../db-init/23_microservices_communication_schema.sql'),
            'utf8'
        );

        await db.query(schemaSql);

        // Verify schema application succeeded
        const tablesResult = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name LIKE '%microservices%' OR table_name IN (
                'service_registry', 'message_queues', 'queue_messages', 'pubsub_topics',
                'topic_subscriptions', 'published_messages', 'event_store', 'event_snapshots',
                'event_projections', 'event_stream_subscriptions', 'circuit_breakers',
                'circuit_breaker_state', 'circuit_breaker_stats', 'circuit_breaker_history',
                'health_check_status', 'system_metrics', 'performance_windows'
            )
            ORDER BY table_name
        `);

        expect(tablesResult.rows.length).to.be.greaterThan(15);
        console.log(`Created ${tablesResult.rows.length} microservices communication tables`);
    });

    describe('Service Mesh Tables', function() {
        it('should have service_registry table with correct structure', async function() {
            const result = await db.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'service_registry'
                ORDER BY ordinal_position
            `);

            const columns = result.rows.reduce((acc, row) => {
                acc[row.column_name] = {
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES',
                    default: row.column_default
                };
                return acc;
            }, {});

            // Verify required columns
            expect(columns).to.have.property('id');
            expect(columns).to.have.property('name');
            expect(columns).to.have.property('address');
            expect(columns).to.have.property('port');
            expect(columns).to.have.property('protocol');
            expect(columns).to.have.property('health_check_path');
            expect(columns).to.have.property('is_healthy');
            expect(columns).to.have.property('last_health_check');
            expect(columns).to.have.property('metadata');
            expect(columns).to.have.property('created_at');
            expect(columns).to.have.property('updated_at');

            // Verify data types
            expect(columns.name.type).to.equal('character varying');
            expect(columns.port.type).to.equal('integer');
            expect(columns.is_healthy.type).to.equal('boolean');
            expect(columns.metadata.type).to.equal('jsonb');
        });

        it('should allow service registration', async function() {
            const serviceData = {
                id: 'test-service-1',
                name: 'test-service',
                address: '127.0.0.1',
                port: 8080,
                protocol: 'http',
                health_check_path: '/health',
                metadata: JSON.stringify({ version: '1.0.0', environment: 'test' })
            };

            const result = await db.query(`
                INSERT INTO service_registry (id, name, address, port, protocol, health_check_path, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                RETURNING *
            `, [
                serviceData.id, serviceData.name, serviceData.address, 
                serviceData.port, serviceData.protocol, serviceData.health_check_path,
                serviceData.metadata
            ]);

            expect(result.rows).to.have.length(1);
            expect(result.rows[0].name).to.equal(serviceData.name);
            expect(result.rows[0].port).to.equal(serviceData.port);
            expect(result.rows[0].is_healthy).to.be.true; // Default value
        });

        it('should have health_check_status table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'health_check_status'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'id', 'service_id', 'status', 'response_time_ms', 
                'error_message', 'checked_at'
            ]);
        });
    });

    describe('Message Queue Tables', function() {
        it('should have message_queues table with correct structure', async function() {
            const result = await db.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'message_queues'
                ORDER BY ordinal_position
            `);

            const columns = result.rows.reduce((acc, row) => {
                acc[row.column_name] = {
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES'
                };
                return acc;
            }, {});

            expect(columns).to.have.property('id');
            expect(columns).to.have.property('name');
            expect(columns).to.have.property('priority');
            expect(columns).to.have.property('max_size');
            expect(columns).to.have.property('is_durable');
            expect(columns).to.have.property('dead_letter_queue_name');
            expect(columns).to.have.property('max_retries');
            expect(columns).to.have.property('total_messages');
            expect(columns).to.have.property('processed_messages');
            expect(columns).to.have.property('failed_messages');

            // Verify data types
            expect(columns.priority.type).to.equal('character varying');
            expect(columns.max_size.type).to.equal('integer');
            expect(columns.is_durable.type).to.equal('boolean');
        });

        it('should allow queue creation', async function() {
            const result = await db.query(`
                INSERT INTO message_queues (id, name, priority, max_size, is_durable, max_retries)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, ['test-queue-1', 'test-queue', 'normal', 1000, true, 3]);

            expect(result.rows).to.have.length(1);
            expect(result.rows[0].name).to.equal('test-queue');
            expect(result.rows[0].total_messages).to.equal(0); // Default value
        });

        it('should have queue_messages table with priority support', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'queue_messages'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'id', 'queue_name', 'data', 'priority', 'retry_count',
                'max_retries', 'status', 'created_at', 'processed_at'
            ]);
        });

        it('should have pubsub_topics and topic_subscriptions tables', async function() {
            // Check pubsub_topics table
            const topicsResult = await db.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'pubsub_topics'
            `);

            const topicColumns = topicsResult.rows.map(row => row.column_name);
            expect(topicColumns).to.include.members([
                'id', 'name', 'is_durable', 'total_published',
                'total_subscribers', 'created_at'
            ]);

            // Check topic_subscriptions table
            const subscriptionsResult = await db.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'topic_subscriptions'
            `);

            const subscriptionColumns = subscriptionsResult.rows.map(row => row.column_name);
            expect(subscriptionColumns).to.include.members([
                'id', 'topic_name', 'subscriber_id', 'is_active',
                'total_received', 'last_received_at', 'created_at'
            ]);
        });
    });

    describe('Event Sourcing Tables', function() {
        it('should have event_store table with correct structure', async function() {
            const result = await db.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'event_store'
                ORDER BY ordinal_position
            `);

            const columns = result.rows.reduce((acc, row) => {
                acc[row.column_name] = {
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES'
                };
                return acc;
            }, {});

            expect(columns).to.have.property('id');
            expect(columns).to.have.property('event_type');
            expect(columns).to.have.property('aggregate_id');
            expect(columns).to.have.property('aggregate_version');
            expect(columns).to.have.property('event_data');
            expect(columns).to.have.property('metadata');
            expect(columns).to.have.property('stream_name');
            expect(columns).to.have.property('created_at');

            // Verify data types
            expect(columns.event_data.type).to.equal('jsonb');
            expect(columns.metadata.type).to.equal('jsonb');
            expect(columns.aggregate_version.type).to.equal('integer');
        });

        it('should allow event storage', async function() {
            const eventData = {
                id: 'event-1',
                event_type: 'UserCreated',
                aggregate_id: 'user-123',
                aggregate_version: 1,
                event_data: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
                metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
                stream_name: 'user-stream'
            };

            const result = await db.query(`
                INSERT INTO event_store (id, event_type, aggregate_id, aggregate_version, event_data, metadata, stream_name)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
                RETURNING *
            `, [
                eventData.id, eventData.event_type, eventData.aggregate_id,
                eventData.aggregate_version, eventData.event_data, eventData.metadata,
                eventData.stream_name
            ]);

            expect(result.rows).to.have.length(1);
            expect(result.rows[0].event_type).to.equal('UserCreated');
            expect(result.rows[0].aggregate_id).to.equal('user-123');
        });

        it('should have event_snapshots table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'event_snapshots'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'id', 'aggregate_id', 'aggregate_version', 'snapshot_data',
                'created_at'
            ]);
        });

        it('should have event_projections table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'event_projections'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'id', 'name', 'last_processed_event_id', 'state',
                'is_active', 'created_at', 'updated_at'
            ]);
        });

        it('should have event_stream_subscriptions table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'event_stream_subscriptions'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'id', 'stream_name', 'subscriber_id', 'last_position',
                'is_active', 'created_at', 'updated_at'
            ]);
        });
    });

    describe('Circuit Breaker Tables', function() {
        it('should have circuit_breakers table with correct structure', async function() {
            const result = await db.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'circuit_breakers'
                ORDER BY ordinal_position
            `);

            const columns = result.rows.reduce((acc, row) => {
                acc[row.column_name] = {
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES'
                };
                return acc;
            }, {});

            expect(columns).to.have.property('id');
            expect(columns).to.have.property('name');
            expect(columns).to.have.property('timeout_ms');
            expect(columns).to.have.property('failure_threshold');
            expect(columns).to.have.property('success_threshold');
            expect(columns).to.have.property('recovery_timeout_ms');
            expect(columns).to.have.property('max_concurrent_calls');
            expect(columns).to.have.property('created_at');
            expect(columns).to.have.property('updated_at');

            // Verify data types
            expect(columns.timeout_ms.type).to.equal('integer');
            expect(columns.failure_threshold.type).to.equal('integer');
            expect(columns.max_concurrent_calls.type).to.equal('integer');
        });

        it('should allow circuit breaker creation', async function() {
            const cbData = {
                id: 'cb-1',
                name: 'test-circuit',
                timeout_ms: 5000,
                failure_threshold: 3,
                success_threshold: 2,
                recovery_timeout_ms: 10000,
                max_concurrent_calls: 10
            };

            const result = await db.query(`
                INSERT INTO circuit_breakers (id, name, timeout_ms, failure_threshold, success_threshold, recovery_timeout_ms, max_concurrent_calls)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                cbData.id, cbData.name, cbData.timeout_ms, cbData.failure_threshold,
                cbData.success_threshold, cbData.recovery_timeout_ms, cbData.max_concurrent_calls
            ]);

            expect(result.rows).to.have.length(1);
            expect(result.rows[0].name).to.equal('test-circuit');
        });

        it('should have circuit_breaker_state table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'circuit_breaker_state'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'circuit_breaker_id', 'current_state', 'failure_count',
                'success_count', 'last_failure_time', 'last_success_time',
                'next_retry_time', 'updated_at'
            ]);
        });

        it('should have circuit_breaker_stats table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'circuit_breaker_stats'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'circuit_breaker_id', 'total_calls', 'successful_calls',
                'failed_calls', 'timeout_calls', 'rejected_calls',
                'avg_response_time_ms', 'last_reset_at', 'updated_at'
            ]);
        });

        it('should have circuit_breaker_history table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'circuit_breaker_history'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'id', 'circuit_breaker_id', 'old_state', 'new_state',
                'reason', 'metadata', 'created_at'
            ]);
        });
    });

    describe('System Monitoring Tables', function() {
        it('should have system_metrics table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'system_metrics'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'id', 'component', 'metric_name', 'metric_value',
                'labels', 'recorded_at'
            ]);
        });

        it('should have performance_windows table', async function() {
            const result = await db.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'performance_windows'
                ORDER BY ordinal_position
            `);

            const columnNames = result.rows.map(row => row.column_name);
            expect(columnNames).to.include.members([
                'id', 'component', 'window_start', 'window_end',
                'total_operations', 'successful_operations', 'failed_operations',
                'avg_response_time_ms', 'p95_response_time_ms', 'p99_response_time_ms'
            ]);
        });
    });

    describe('Database Indexes', function() {
        it('should have proper indexes for performance', async function() {
            const indexResult = await db.query(`
                SELECT schemaname, tablename, indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                AND tablename IN (
                    'service_registry', 'message_queues', 'queue_messages', 
                    'event_store', 'circuit_breakers', 'system_metrics'
                )
                ORDER BY tablename, indexname
            `);

            const indexes = indexResult.rows;
            const indexNames = indexes.map(idx => idx.indexname);

            // Check for important indexes
            expect(indexNames.filter(name => name.includes('service_registry'))).to.have.length.greaterThan(1);
            expect(indexNames.filter(name => name.includes('event_store'))).to.have.length.greaterThan(1);
            expect(indexNames.filter(name => name.includes('queue_messages'))).to.have.length.greaterThan(1);

            console.log(`Found ${indexes.length} indexes for microservices tables`);
        });

        it('should have unique constraints where needed', async function() {
            const constraintResult = await db.query(`
                SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_schema = 'public'
                AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
                AND tc.table_name IN (
                    'service_registry', 'message_queues', 'pubsub_topics',
                    'event_store', 'circuit_breakers'
                )
                ORDER BY tc.table_name, tc.constraint_name
            `);

            const constraints = constraintResult.rows;
            
            // Each table should have a primary key
            const tablesWithPK = [...new Set(constraints
                .filter(c => c.constraint_type === 'PRIMARY KEY')
                .map(c => c.table_name)
            )];

            expect(tablesWithPK).to.include.members([
                'service_registry', 'message_queues', 'pubsub_topics',
                'event_store', 'circuit_breakers'
            ]);
        });
    });

    describe('Database Functions and Triggers', function() {
        it('should have update timestamp functions', async function() {
            const functionResult = await db.query(`
                SELECT routine_name, routine_type
                FROM information_schema.routines
                WHERE routine_schema = 'public'
                AND routine_type = 'FUNCTION'
                AND routine_name LIKE '%timestamp%'
            `);

            expect(functionResult.rows.length).to.be.greaterThan(0);
            
            const functionNames = functionResult.rows.map(row => row.routine_name);
            console.log('Found timestamp functions:', functionNames);
        });

        it('should have triggers for automatic timestamp updates', async function() {
            const triggerResult = await db.query(`
                SELECT trigger_name, event_object_table, action_timing, event_manipulation
                FROM information_schema.triggers
                WHERE trigger_schema = 'public'
                AND event_object_table IN (
                    'service_registry', 'circuit_breakers', 'event_projections'
                )
            `);

            expect(triggerResult.rows.length).to.be.greaterThan(0);

            const triggersByTable = triggerResult.rows.reduce((acc, trigger) => {
                if (!acc[trigger.event_object_table]) {
                    acc[trigger.event_object_table] = [];
                }
                acc[trigger.event_object_table].push(trigger);
                return acc;
            }, {});

            console.log('Found triggers by table:', Object.keys(triggersByTable));
        });
    });

    describe('Data Integrity and Relationships', function() {
        it('should enforce foreign key constraints', async function() {
            const fkResult = await db.query(`
                SELECT tc.table_name, tc.constraint_name, kcu.column_name,
                       ccu.table_name AS foreign_table_name,
                       ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                AND tc.table_name LIKE '%circuit%' OR tc.table_name LIKE '%health%'
                   OR tc.table_name LIKE '%topic%' OR tc.table_name LIKE '%queue%'
            `);

            expect(fkResult.rows.length).to.be.greaterThan(0);
            console.log(`Found ${fkResult.rows.length} foreign key constraints`);
        });

        it('should handle cascade deletes properly', async function() {
            // Test cascading deletes by creating and deleting related records
            
            // Create a circuit breaker
            await db.query(`
                INSERT INTO circuit_breakers (id, name, timeout_ms, failure_threshold, success_threshold, recovery_timeout_ms, max_concurrent_calls)
                VALUES ('cascade-test-cb', 'cascade-test', 5000, 3, 2, 10000, 10)
            `);

            // Create related state record
            await db.query(`
                INSERT INTO circuit_breaker_state (circuit_breaker_id, current_state, failure_count, success_count)
                VALUES ('cascade-test-cb', 'CLOSED', 0, 0)
            `);

            // Verify both records exist
            const stateBeforeDelete = await db.query(`
                SELECT * FROM circuit_breaker_state WHERE circuit_breaker_id = 'cascade-test-cb'
            `);
            expect(stateBeforeDelete.rows).to.have.length(1);

            // Delete the circuit breaker (should cascade)
            await db.query(`DELETE FROM circuit_breakers WHERE id = 'cascade-test-cb'`);

            // Verify cascaded deletion
            const stateAfterDelete = await db.query(`
                SELECT * FROM circuit_breaker_state WHERE circuit_breaker_id = 'cascade-test-cb'
            `);
            expect(stateAfterDelete.rows).to.have.length(0);
        });
    });

    describe('Initial Data and Defaults', function() {
        it('should have default circuit breakers created', async function() {
            const defaultCBResult = await db.query(`
                SELECT name FROM circuit_breakers 
                WHERE name IN ('default-http', 'default-grpc', 'default-database')
            `);

            // The schema should create some default circuit breakers
            expect(defaultCBResult.rows.length).to.be.greaterThan(0);
            console.log('Found default circuit breakers:', defaultCBResult.rows.map(row => row.name));
        });

        it('should have default message queues created', async function() {
            const defaultQueueResult = await db.query(`
                SELECT name FROM message_queues 
                WHERE name IN ('default-notifications', 'default-events', 'dead-letter-queue')
            `);

            // The schema should create some default queues
            expect(defaultQueueResult.rows.length).to.be.greaterThan(0);
            console.log('Found default message queues:', defaultQueueResult.rows.map(row => row.name));
        });
    });

    describe('Performance Validation', function() {
        it('should handle bulk inserts efficiently', async function() {
            const insertStart = performance.now();

            // Bulk insert services
            const serviceValues = [];
            for (let i = 0; i < 100; i++) {
                serviceValues.push(`('bulk-service-${i}', 'bulk-service-${i}', '127.0.0.1', ${8000 + i}, 'http')`);
            }

            await db.query(`
                INSERT INTO service_registry (id, name, address, port, protocol)
                VALUES ${serviceValues.join(', ')}
            `);

            const insertEnd = performance.now();
            const insertTime = insertEnd - insertStart;

            console.log(`Bulk insert of 100 services took ${insertTime.toFixed(2)}ms`);
            expect(insertTime).to.be.below(1000); // Should complete in under 1 second
        });

        it('should handle complex queries efficiently', async function() {
            // Insert test data first
            await db.query(`
                INSERT INTO event_store (id, event_type, aggregate_id, aggregate_version, event_data, stream_name)
                SELECT 
                    'event-' || i,
                    CASE WHEN i % 3 = 0 THEN 'UserCreated' 
                         WHEN i % 3 = 1 THEN 'UserUpdated'
                         ELSE 'UserDeleted' END,
                    'user-' || (i % 10),
                    i,
                    '{"test": true}'::jsonb,
                    'user-stream'
                FROM generate_series(1, 1000) i
            `);

            const queryStart = performance.now();

            // Complex query with aggregation
            const result = await db.query(`
                SELECT 
                    aggregate_id,
                    COUNT(*) as event_count,
                    MAX(aggregate_version) as latest_version,
                    array_agg(event_type ORDER BY aggregate_version) as event_types
                FROM event_store 
                WHERE stream_name = 'user-stream'
                GROUP BY aggregate_id
                HAVING COUNT(*) > 50
                ORDER BY event_count DESC
                LIMIT 10
            `);

            const queryEnd = performance.now();
            const queryTime = queryEnd - queryStart;

            console.log(`Complex query took ${queryTime.toFixed(2)}ms, returned ${result.rows.length} rows`);
            expect(queryTime).to.be.below(100); // Should complete in under 100ms
            expect(result.rows.length).to.be.greaterThan(0);
        });
    });
});
