/**
 * @fileoverview Database Connection for MCP Orchestrator
 * Integrates with existing Cartrita PostgreSQL infrastructure
 */

import { Client, Pool } from 'pg';
import { Logger } from '../core/index.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

let pool: Pool | null = null;
const logger = Logger.create('DatabaseConnection');

export async function connectToDatabase(config: DatabaseConfig): Promise<Pool> {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Test the connection
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    client.release();

    logger.info('Database connection established', {
      host: config.host,
      database: config.database,
      serverVersion: result.rows[0].version,
    });
  } catch (error) {
    logger.error('Database connection failed', error as Error);
    throw error;
  }

  // Create MCP-specific tables if they don't exist
  await createMCPTables();

  return pool;
}

async function createMCPTables(): Promise<void> {
  if (!pool) throw new Error('Database pool not initialized');

  const client = await pool.connect();

  try {
    // Enable UUID extension if not exists
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // MCP Messages table for exactly-once delivery
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id UUID UNIQUE NOT NULL,
        correlation_id UUID,
        trace_id VARCHAR(32),
        sender VARCHAR(255) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        message_type VARCHAR(100) NOT NULL,
        payload JSONB,
        context JSONB,
        delivery JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Index for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcp_messages_message_id ON mcp_messages(message_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_messages_correlation_id ON mcp_messages(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_messages_trace_id ON mcp_messages(trace_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_messages_status ON mcp_messages(status);
      CREATE INDEX IF NOT EXISTS idx_mcp_messages_created_at ON mcp_messages(created_at);
    `);

    // MCP Agent Registry
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_agents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id VARCHAR(255) UNIQUE NOT NULL,
        agent_name VARCHAR(255) NOT NULL,
        agent_type VARCHAR(50) NOT NULL,
        version VARCHAR(50),
        capabilities JSONB,
        metadata JSONB,
        health JSONB,
        registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcp_agents_agent_id ON mcp_agents(agent_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_agents_type ON mcp_agents(agent_type);
      CREATE INDEX IF NOT EXISTS idx_mcp_agents_active ON mcp_agents(is_active);
    `);

    // MCP Audit Log
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_type VARCHAR(100) NOT NULL,
        actor_id VARCHAR(255),
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        trace_id VARCHAR(32),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcp_audit_event_type ON mcp_audit_log(event_type);
      CREATE INDEX IF NOT EXISTS idx_mcp_audit_actor_id ON mcp_audit_log(actor_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_audit_created_at ON mcp_audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_mcp_audit_trace_id ON mcp_audit_log(trace_id);
    `);

    // MCP Task Executions for monitoring
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_task_executions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        task_id UUID UNIQUE NOT NULL,
        task_type VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255),
        supervisor_id VARCHAR(255),
        user_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        parameters JSONB,
        result JSONB,
        error_message TEXT,
        error_code VARCHAR(100),
        metrics JSONB,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        duration_ms INTEGER,
        trace_id VARCHAR(32)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcp_tasks_task_id ON mcp_task_executions(task_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_tasks_type ON mcp_task_executions(task_type);
      CREATE INDEX IF NOT EXISTS idx_mcp_tasks_status ON mcp_task_executions(status);
      CREATE INDEX IF NOT EXISTS idx_mcp_tasks_user_id ON mcp_task_executions(user_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_tasks_started_at ON mcp_task_executions(started_at);
      CREATE INDEX IF NOT EXISTS idx_mcp_tasks_trace_id ON mcp_task_executions(trace_id);
    `);

    logger.info('MCP database tables initialized successfully');
  } catch (error) {
    logger.error('Failed to create MCP tables', error as Error);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not connected. Call connectToDatabase first.');
  }
  return pool;
}
