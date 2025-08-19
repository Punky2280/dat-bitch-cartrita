/**
 * Cartrita V2 - Enhanced Database Connection Pool
 * Built from V1 with improved error handling, monitoring, and connection management
 */

import { Pool } from 'pg';
import { logger } from '../core/logger.js';

// Enhanced database configuration from environment
const dbConfig = {
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'robert',
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'dat-bitch-cartrita',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'punky1',
  port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5432),
  
  // Enhanced pool configuration for V2
  max: Number(process.env.DB_POOL_MAX || 20),
  min: Number(process.env.DB_POOL_MIN || 5),
  idle: Number(process.env.DB_POOL_IDLE || 10000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT || 10000),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
  
  // V2 specific settings
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  application_name: 'cartrita-v2'
};

// Fallback ports for development
const fallbackPorts = [5432, 5435, 5433];

let pool;
let isConnected = false;
let connectionAttempts = 0;
const maxConnectionAttempts = 3;

// Database statistics
const stats = {
  queries: 0,
  errors: 0,
  slowQueries: 0,
  startTime: Date.now(),
  connectionCount: 0
};

// Test/Skip mode
if (process.env.DB_SKIP === '1' || process.env.NODE_ENV === 'test') {
  logger.info('📊 Database connection skipped (test/skip mode)');
  pool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    end: async () => {},
    on: () => {},
    stats: () => stats,
    isHealthy: () => false
  };
} else {
  // Create enhanced connection pool
  pool = createDatabasePool(dbConfig);
}

function createDatabasePool(config) {
  const dbPool = new Pool(config);
  
  // Enhanced event handlers
  dbPool.on('connect', (client) => {
    stats.connectionCount++;
    isConnected = true;
    logger.database('connect', 'pool', 0, {
      host: config.host,
      port: config.port,
      database: config.database,
      totalConnections: stats.connectionCount
    });
  });
  
  dbPool.on('error', (err, client) => {
    stats.errors++;
    isConnected = false;
    logger.database('error', 'pool', 0, {
      error: err.message,
      code: err.code,
      totalErrors: stats.errors
    });
  });
  
  dbPool.on('acquire', (client) => {
    logger.debug('💾 Database client acquired from pool');
  });
  
  dbPool.on('remove', (client) => {
    logger.debug('💾 Database client removed from pool');
  });
  
  // Enhanced query wrapper with monitoring
  const originalQuery = dbPool.query.bind(dbPool);
  dbPool.query = async (text, params) => {
    const startTime = Date.now();
    stats.queries++;
    
    try {
      logger.debug('💾 Executing query', { sql: text, params: params?.length || 0 });
      const result = await originalQuery(text, params);
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        stats.slowQueries++;
        logger.performance('slow-query', duration, {
          sql: text.substring(0, 100) + '...',
          rows: result.rowCount
        });
      }
      
      logger.database('query', 'executed', duration, {
        rowCount: result.rowCount,
        fields: result.fields?.length || 0
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      stats.errors++;
      logger.database('query-error', 'failed', duration, {
        error: error.message,
        code: error.code,
        sql: text.substring(0, 100) + '...'
      });
      throw error;
    }
  };
  
  // Add utility methods
  dbPool.stats = () => ({
    ...stats,
    uptime: Date.now() - stats.startTime,
    poolConnections: dbPool.totalCount,
    idleConnections: dbPool.idleCount,
    waitingClients: dbPool.waitingCount
  });
  
  dbPool.isHealthy = async () => {
    try {
      const result = await dbPool.query('SELECT 1 as health_check, NOW() as timestamp');
      return result.rows[0] !== undefined;
    } catch (error) {
      return false;
    }
  };
  
  return dbPool;
}

// Enhanced connection initialization with fallback logic
async function initializeConnection() {
  if (process.env.DB_SKIP === '1' || process.env.NODE_ENV === 'test') {
    return true;
  }
  
  for (const port of fallbackPorts) {
    try {
      connectionAttempts++;
      const testConfig = { ...dbConfig, port };
      
      logger.info(`🔌 Attempting database connection to ${testConfig.host}:${port}...`);
      
      const testPool = new Pool(testConfig);
      await testPool.query('SELECT 1');
      await testPool.end();
      
      // Success - recreate pool with working config
      if (pool && pool.end) {
        await pool.end().catch(() => {});
      }
      
      pool = createDatabasePool(testConfig);
      isConnected = true;
      
      logger.info('✅ Database connection established', {
        host: testConfig.host,
        port: testConfig.port,
        database: testConfig.database,
        attempt: connectionAttempts
      });
      
      return true;
    } catch (error) {
      logger.warn(`❌ Database connection failed on port ${port}`, {
        error: error.message,
        code: error.code,
        attempt: connectionAttempts
      });
      
      if (connectionAttempts >= maxConnectionAttempts) {
        logger.error('❌ All database connection attempts failed', {
          ports: fallbackPorts,
          totalAttempts: connectionAttempts
        });
        return false;
      }
    }
  }
  
  return false;
}

// Enhanced migration runner
async function runMigrations() {
  if (process.env.DB_SKIP === '1' || !isConnected) {
    logger.info('📊 Migrations skipped');
    return;
  }
  
  try {
    logger.info('🔄 Checking database migrations...');
    
    // Check if migrations table exists
    const migrationTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);
    
    if (!migrationTableExists.rows[0].exists) {
      logger.info('📊 Creating schema_migrations table...');
      await pool.query(`
        CREATE TABLE schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW(),
          description TEXT
        );
      `);
    }
    
    logger.info('✅ Migration check completed');
  } catch (error) {
    logger.error('❌ Migration check failed', { error: error.message });
    throw error;
  }
}

// Initialize connection on import (non-blocking)
initializeConnection()
  .then(() => runMigrations())
  .catch(error => {
    logger.error('❌ Database initialization failed', { error: error.message });
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🔄 Closing database connections...');
  if (pool && pool.end) {
    await pool.end();
  }
  logger.info('✅ Database connections closed');
});

process.on('SIGTERM', async () => {
  logger.info('🔄 Closing database connections...');
  if (pool && pool.end) {
    await pool.end();
  }
  logger.info('✅ Database connections closed');
});

export default pool;
export { pool, initializeConnection, runMigrations, stats, dbConfig };