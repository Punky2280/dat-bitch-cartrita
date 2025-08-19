/**
 * Cartrita V2 - Database Connection
 * PostgreSQL connection with connection pooling and health monitoring
 */

import pg from 'pg';
import { logger } from '../utils/logger.js';
import { trace } from '@opentelemetry/api';

const { Pool } = pg;

let pool = null;

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'cartrita_v2',
  user: process.env.POSTGRES_USER || 'cartrita',
  password: process.env.POSTGRES_PASSWORD,
  
  // Connection pool settings
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' && process.env.POSTGRES_SSL !== 'false' ? {
    rejectUnauthorized: false // For managed databases
  } : false
};

export async function connectDatabase() {
  let span = null;
  
  try {
    const tracer = trace.getTracer('cartrita-v2');
    span = tracer.startSpan('database.connect');
    if (!dbConfig.password) {
      throw new Error('POSTGRES_PASSWORD environment variable is required');
    }

    pool = new Pool(dbConfig);

    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as connected_at, version()');
    client.release();

    logger.info('✅ Database connected successfully', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      poolSize: { min: dbConfig.min, max: dbConfig.max },
      connectedAt: result.rows[0].connected_at,
      version: result.rows[0].version
    });

    // Setup connection event handlers
    pool.on('connect', (client) => {
      logger.debug('Database client connected', { 
        processId: client.processID 
      });
    });

    pool.on('acquire', (client) => {
      logger.debug('Database client acquired from pool', { 
        processId: client.processID 
      });
    });

    pool.on('error', (err, client) => {
      logger.error('Database pool error', {
        error: err.message,
        processId: client?.processID
      });
    });

    pool.on('remove', (client) => {
      logger.debug('Database client removed from pool', { 
        processId: client.processID 
      });
    });

    span.setStatus({ code: 1 }); // OK
    return pool;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message }); // ERROR
    logger.error('❌ Database connection failed', {
      error: error.message,
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user
      }
    });
    throw error;
  } finally {
    span.end();
  }
}

export function getDatabase() {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
}

export async function query(text, params = []) {
  const span = trace.getTracer('cartrita-v2').startSpan('database.query');
  
  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    span.setAttributes({
      'db.statement': text,
      'db.rows_affected': result.rowCount || 0,
      'db.duration_ms': duration
    });

    logger.logDatabase('query', 'executed', {
      duration,
      rowCount: result.rowCount,
      paramCount: params.length
    });

    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message }); // ERROR
    
    logger.error('Database query failed', {
      error: error.message,
      query: text,
      params: params.length
    });
    throw error;
  } finally {
    span.end();
  }
}

export async function transaction(callback) {
  const span = trace.getTracer('cartrita-v2').startSpan('database.transaction');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Wrap client.query to add tracing
    const originalQuery = client.query.bind(client);
    client.query = async (text, params = []) => {
      const querySpan = trace.getTracer('cartrita-v2').startSpan('database.transaction.query');
      try {
        const start = Date.now();
        const result = await originalQuery(text, params);
        const duration = Date.now() - start;

        querySpan.setAttributes({
          'db.statement': text,
          'db.rows_affected': result.rowCount || 0,
          'db.duration_ms': duration
        });

        querySpan.setStatus({ code: 1 });
        return result;
      } catch (error) {
        querySpan.recordException(error);
        querySpan.setStatus({ code: 2, message: error.message });
        throw error;
      } finally {
        querySpan.end();
      }
    };

    const result = await callback(client);
    await client.query('COMMIT');
    
    logger.logDatabase('transaction', 'committed');
    span.setStatus({ code: 1 });
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    logger.error('Database transaction failed', {
      error: error.message
    });
    throw error;
  } finally {
    client.release();
    span.end();
  }
}

export async function healthCheck() {
  try {
    const result = await pool.query('SELECT 1 as health_check');
    return {
      status: 'healthy',
      connected: true,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      connected: false,
      error: error.message
    };
  }
}

export async function closeDatabase() {
  if (pool) {
    logger.info('Closing database connection pool...');
    await pool.end();
    pool = null;
    logger.info('✅ Database connection pool closed');
  }
}