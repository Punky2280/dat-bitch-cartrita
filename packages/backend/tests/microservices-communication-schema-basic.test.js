/**
 * Microservices Communication Database Schema - Basic Tests
 * 
 * Basic tests for validating database schema structure and SQL syntax
 */

import fs from 'fs';
import path from 'path';

describe('Microservices Communication Database Schema - Basic Tests', function() {
    let schemaSql;

    beforeAll(function() {
        // Read the schema file
        const schemaPath = path.join(__dirname, '../../../db-init/23_microservices_communication_schema.sql');
        
        try {
            schemaSql = fs.readFileSync(schemaPath, 'utf8');
        } catch (error) {
            throw new Error(`Could not read schema file: ${error.message}`);
        }
    });

    test('should load schema SQL file successfully', function() {
        expect(schemaSql).toBeDefined();
        expect(schemaSql.length).toBeGreaterThan(1000); // Schema should be substantial
        expect(typeof schemaSql).toBe('string');
    });

    describe('Table Creation Statements', function() {
        test('should contain service mesh tables', function() {
            expect(schemaSql).toMatch(/CREATE TABLE.*service_registry/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*health_check_status/i);
        });

        test('should contain message queue tables', function() {
            expect(schemaSql).toMatch(/CREATE TABLE.*message_queues/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*queue_messages/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*pubsub_topics/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*topic_subscriptions/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*published_messages/i);
        });

        test('should contain event sourcing tables', function() {
            expect(schemaSql).toMatch(/CREATE TABLE.*event_store/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*event_snapshots/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*event_projections/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*event_stream_subscriptions/i);
        });

        test('should contain circuit breaker tables', function() {
            expect(schemaSql).toMatch(/CREATE TABLE.*circuit_breakers/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*circuit_breaker_state/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*circuit_breaker_stats/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*circuit_breaker_history/i);
        });

        test('should contain monitoring tables', function() {
            expect(schemaSql).toMatch(/CREATE TABLE.*system_metrics/i);
            expect(schemaSql).toMatch(/CREATE TABLE.*performance_windows/i);
        });
    });

    describe('Data Types and Constraints', function() {
        test('should use appropriate data types', function() {
            // Check for common PostgreSQL data types
            expect(schemaSql).toMatch(/VARCHAR\(/i);
            expect(schemaSql).toMatch(/INTEGER/i);
            expect(schemaSql).toMatch(/BOOLEAN/i);
            expect(schemaSql).toMatch(/TIMESTAMP/i);
            expect(schemaSql).toMatch(/JSONB/i);
            expect(schemaSql).toMatch(/TEXT/i);
        });

        test('should define primary keys', function() {
            // Should have PRIMARY KEY constraints
            expect(schemaSql).toMatch(/PRIMARY KEY/gi);
            
            // Count primary key occurrences (should be many for all tables)
            const primaryKeyMatches = schemaSql.match(/PRIMARY KEY/gi);
            expect(primaryKeyMatches).toBeTruthy();
            expect(primaryKeyMatches.length).toBeGreaterThan(10);
        });

        test('should define foreign key relationships', function() {
            // Should have REFERENCES for foreign keys
            expect(schemaSql).toMatch(/REFERENCES/gi);
            
            // Should have ON DELETE CASCADE for some relationships
            expect(schemaSql).toMatch(/ON DELETE CASCADE/gi);
        });

        test('should have NOT NULL constraints', function() {
            expect(schemaSql).toMatch(/NOT NULL/gi);
            
            // Count NOT NULL occurrences
            const notNullMatches = schemaSql.match(/NOT NULL/gi);
            expect(notNullMatches).toBeTruthy();
            expect(notNullMatches.length).toBeGreaterThan(20);
        });

        test('should have default values', function() {
            expect(schemaSql).toMatch(/DEFAULT/gi);
            expect(schemaSql).toMatch(/DEFAULT NOW\(\)/gi);
            expect(schemaSql).toMatch(/DEFAULT 0/gi);
            expect(schemaSql).toMatch(/DEFAULT TRUE/gi);
        });
    });

    describe('Indexes and Performance', function() {
        test('should create indexes for performance', function() {
            expect(schemaSql).toMatch(/CREATE INDEX/gi);
            
            // Count index creation statements
            const indexMatches = schemaSql.match(/CREATE INDEX/gi);
            expect(indexMatches).toBeTruthy();
            expect(indexMatches.length).toBeGreaterThan(15);
        });

        test('should have indexes on common query patterns', function() {
            // Should index foreign keys and commonly queried columns
            expect(schemaSql).toMatch(/idx.*service/i);
            expect(schemaSql).toMatch(/idx.*queue/i);
            expect(schemaSql).toMatch(/idx.*event/i);
            expect(schemaSql).toMatch(/idx.*circuit/i);
        });

        test('should have composite indexes where appropriate', function() {
            // Look for multi-column indexes
            expect(schemaSql).toMatch(/CREATE INDEX.*ON.*\(.*,.*\)/i);
        });
    });

    describe('Functions and Triggers', function() {
        test('should define utility functions', function() {
            expect(schemaSql).toMatch(/CREATE OR REPLACE FUNCTION/gi);
            
            // Count function definitions
            const functionMatches = schemaSql.match(/CREATE OR REPLACE FUNCTION/gi);
            expect(functionMatches).toBeTruthy();
            expect(functionMatches.length).toBeGreaterThan(0);
        });

        test('should have triggers for automatic updates', function() {
            expect(schemaSql).toMatch(/CREATE TRIGGER/gi);
            
            // Should have triggers for timestamp updates
            expect(schemaSql).toMatch(/update_timestamp/i);
        });

        test('should have update timestamp functionality', function() {
            expect(schemaSql).toMatch(/update_timestamp/i);
            expect(schemaSql).toMatch(/BEFORE UPDATE/gi);
            expect(schemaSql).toMatch(/updated_at/i);
        });
    });

    describe('Initial Data and Defaults', function() {
        test('should insert default data', function() {
            expect(schemaSql).toMatch(/INSERT INTO/gi);
            
            // Count insert statements for default data
            const insertMatches = schemaSql.match(/INSERT INTO/gi);
            expect(insertMatches).toBeTruthy();
            expect(insertMatches.length).toBeGreaterThan(5);
        });

        test('should create default circuit breakers', function() {
            expect(schemaSql).toMatch(/INSERT INTO.*circuit_breakers/i);
            expect(schemaSql).toMatch(/default-http/i);
            expect(schemaSql).toMatch(/default-grpc/i);
            expect(schemaSql).toMatch(/default-database/i);
        });

        test('should create default message queues', function() {
            expect(schemaSql).toMatch(/INSERT INTO.*message_queues/i);
            expect(schemaSql).toMatch(/default-notifications/i);
            expect(schemaSql).toMatch(/default-events/i);
            expect(schemaSql).toMatch(/dead-letter-queue/i);
        });
    });

    describe('SQL Syntax Validation', function() {
        test('should have balanced parentheses', function() {
            const openParens = (schemaSql.match(/\(/g) || []).length;
            const closeParens = (schemaSql.match(/\)/g) || []).length;
            expect(openParens).toBe(closeParens);
        });

        test('should properly terminate statements', function() {
            // Most statements should end with semicolons
            expect(schemaSql).toMatch(/;/g);
            
            // Count semicolons (should be many)
            const semicolonMatches = schemaSql.match(/;/g);
            expect(semicolonMatches).toBeTruthy();
            expect(semicolonMatches.length).toBeGreaterThan(50);
        });

        test('should not have common syntax errors', function() {
            // Check for common issues
            expect(schemaSql).not.toMatch(/\s{5,}/); // No excessive whitespace
            expect(schemaSql).not.toMatch(/\t{3,}/); // No excessive tabs
            expect(schemaSql).not.toMatch(/;;/); // No double semicolons
        });

        test('should use consistent naming conventions', function() {
            // Snake_case for table and column names
            expect(schemaSql).toMatch(/service_registry/);
            expect(schemaSql).toMatch(/created_at/);
            expect(schemaSql).toMatch(/updated_at/);
            expect(schemaSql).toMatch(/circuit_breaker/);
            expect(schemaSql).toMatch(/event_store/);
        });
    });

    describe('Schema Structure Validation', function() {
        test('should have proper table count', function() {
            const tableMatches = schemaSql.match(/CREATE TABLE/gi);
            expect(tableMatches).toBeTruthy();
            expect(tableMatches.length).toBeGreaterThan(15);
            expect(tableMatches.length).toBeLessThan(30);
        });

        test('should have required service mesh columns', function() {
            expect(schemaSql).toMatch(/name.*VARCHAR/i);
            expect(schemaSql).toMatch(/address.*VARCHAR/i);
            expect(schemaSql).toMatch(/port.*INTEGER/i);
            expect(schemaSql).toMatch(/protocol.*VARCHAR/i);
            expect(schemaSql).toMatch(/is_healthy.*BOOLEAN/i);
        });

        test('should have required event sourcing columns', function() {
            expect(schemaSql).toMatch(/event_type.*VARCHAR/i);
            expect(schemaSql).toMatch(/aggregate_id.*UUID/i);
            expect(schemaSql).toMatch(/event_version.*INTEGER/i);
            expect(schemaSql).toMatch(/event_data.*JSONB/i);
        });

        test('should have required circuit breaker columns', function() {
            expect(schemaSql).toMatch(/timeout_ms.*BIGINT/i);
            expect(schemaSql).toMatch(/failure_threshold.*INTEGER/i);
            expect(schemaSql).toMatch(/current_state.*VARCHAR/i);
            expect(schemaSql).toMatch(/failure_count.*INTEGER/i);
        });

        test('should have required message queue columns', function() {
            expect(schemaSql).toMatch(/priority.*VARCHAR/i);
            expect(schemaSql).toMatch(/max_size.*BIGINT/i);
            expect(schemaSql).toMatch(/is_durable.*BOOLEAN/i);
            expect(schemaSql).toMatch(/retry_count.*INTEGER/i);
        });
    });

    describe('Performance and Optimization', function() {
        test('should have indexes on frequently queried columns', function() {
            // Service registry indexes
            expect(schemaSql).toMatch(/idx.*service.*name/i);
            expect(schemaSql).toMatch(/idx.*service.*registry/i);
            
            // Event store indexes
            expect(schemaSql).toMatch(/idx.*event.*aggregate_id/i);
            expect(schemaSql).toMatch(/idx.*event.*store/i);
            
            // Circuit breaker indexes
            expect(schemaSql).toMatch(/idx.*circuit.*breaker/i);
            
            // Message queue indexes
            expect(schemaSql).toMatch(/idx.*queue.*messages/i);
        });

        test('should have compound indexes for complex queries', function() {
            // Multi-column indexes for better query performance
            const compoundIndexRegex = /CREATE INDEX.*ON.*\([^)]*,.*[^)]*\)/gi;
            const compoundIndexes = schemaSql.match(compoundIndexRegex);
            expect(compoundIndexes).toBeTruthy();
            expect(compoundIndexes.length).toBeGreaterThan(5);
        });
    });

    describe('Data Integrity', function() {
        test('should have check constraints where appropriate', function() {
            expect(schemaSql).toMatch(/CHECK/gi);
            
            // Should have check constraints for enum-like values
            expect(schemaSql).toMatch(/CHECK.*IN.*\(/i);
        });

        test('should have unique constraints', function() {
            expect(schemaSql).toMatch(/UNIQUE/gi);
            
            // Service names should be unique
            // Circuit breaker names should be unique
            expect(schemaSql).toMatch(/UNIQUE.*name/i);
        });
    });

    test('should be ready for production deployment', function() {
        // Overall validation that the schema is comprehensive
        expect(schemaSql).toMatch(/CREATE TABLE.*service_registry/i);
        expect(schemaSql).toMatch(/CREATE TABLE.*event_store/i);
        expect(schemaSql).toMatch(/CREATE TABLE.*circuit_breakers/i);
        expect(schemaSql).toMatch(/CREATE TABLE.*message_queues/i);
        
        expect(schemaSql).toMatch(/CREATE INDEX/gi);
        expect(schemaSql).toMatch(/CREATE TRIGGER/gi);
        expect(schemaSql).toMatch(/INSERT INTO/gi);
        
        // Should be substantial in size (comprehensive schema)
        expect(schemaSql.length).toBeGreaterThan(10000);
        
        console.log(`Schema validation complete: ${schemaSql.length} characters, comprehensive microservices communication database schema verified`);
    });
});
