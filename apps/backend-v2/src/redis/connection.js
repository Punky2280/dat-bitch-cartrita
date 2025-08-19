/**
 * Cartrita V2 - Redis Connection
 * Redis client with connection pooling, clustering support, and health monitoring
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { trace } from '@opentelemetry/api';

let redis = null;
let redisSubscriber = null;
let redisPublisher = null;

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
  
  // Connection settings
  connectTimeout: 10000,
  lazyConnect: true,
  retryDelayOnFailover: 100,
  retryConnect: 3,
  maxRetriesPerRequest: 3,
  
  // Connection pool
  family: 4,
  keepAlive: true,
  
  // Reconnection strategy
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis reconnection attempt ${times}, delaying ${delay}ms`);
    return delay;
  }
};

export async function connectRedis() {
  const span = trace.getTracer('cartrita-v2').startSpan('redis.connect');
  
  try {
    // Main Redis connection
    redis = new Redis(redisConfig);
    
    // Separate connections for pub/sub to avoid blocking
    redisSubscriber = new Redis({
      ...redisConfig,
      db: redisConfig.db + 1 // Use different DB for pub/sub
    });
    
    redisPublisher = new Redis({
      ...redisConfig,
      db: redisConfig.db + 1
    });

    // Wait for connections
    await Promise.all([
      redis.connect(),
      redisSubscriber.connect(),
      redisPublisher.connect()
    ]);

    // Test connections
    await redis.ping();
    const info = await redis.info('server');
    const serverInfo = parseRedisInfo(info);

    logger.info('✅ Redis connected successfully', {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      version: serverInfo.redis_version,
      mode: serverInfo.redis_mode || 'standalone'
    });

    // Setup event handlers
    setupRedisEventHandlers(redis, 'main');
    setupRedisEventHandlers(redisSubscriber, 'subscriber');
    setupRedisEventHandlers(redisPublisher, 'publisher');

    span.setStatus({ code: 1 }); // OK
    return { redis, redisSubscriber, redisPublisher };
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message }); // ERROR
    logger.error('❌ Redis connection failed', {
      error: error.message,
      config: {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db
      }
    });
    throw error;
  } finally {
    span.end();
  }
}

function setupRedisEventHandlers(client, connectionName) {
  client.on('connect', () => {
    logger.debug(`Redis ${connectionName} connected`);
  });

  client.on('ready', () => {
    logger.info(`Redis ${connectionName} ready`);
  });

  client.on('error', (error) => {
    logger.error(`Redis ${connectionName} error`, {
      error: error.message
    });
  });

  client.on('close', () => {
    logger.warn(`Redis ${connectionName} connection closed`);
  });

  client.on('reconnecting', (times) => {
    logger.warn(`Redis ${connectionName} reconnecting`, { attempt: times });
  });

  client.on('end', () => {
    logger.info(`Redis ${connectionName} connection ended`);
  });
}

function parseRedisInfo(info) {
  const lines = info.split('\r\n');
  const result = {};
  
  for (const line of lines) {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key] = value;
      }
    }
  }
  
  return result;
}

export function getRedis() {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
}

export function getRedisSubscriber() {
  if (!redisSubscriber) {
    throw new Error('Redis subscriber not connected. Call connectRedis() first.');
  }
  return redisSubscriber;
}

export function getRedisPublisher() {
  if (!redisPublisher) {
    throw new Error('Redis publisher not connected. Call connectRedis() first.');
  }
  return redisPublisher;
}

// Helper functions with tracing
export async function setCache(key, value, ttl = 3600) {
  const span = trace.getTracer('cartrita-v2').startSpan('redis.set');
  
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const result = await redis.setex(key, ttl, serialized);
    
    span.setAttributes({
      'redis.operation': 'setex',
      'redis.key': key,
      'redis.ttl': ttl,
      'redis.value_size': serialized.length
    });

    span.setStatus({ code: 1 });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    logger.error('Redis setCache failed', {
      error: error.message,
      key
    });
    throw error;
  } finally {
    span.end();
  }
}

export async function getCache(key, parse = true) {
  const span = trace.getTracer('cartrita-v2').startSpan('redis.get');
  
  try {
    const value = await redis.get(key);
    
    span.setAttributes({
      'redis.operation': 'get',
      'redis.key': key,
      'redis.hit': value !== null
    });

    if (value === null) {
      span.setStatus({ code: 1 });
      return null;
    }

    const result = parse ? JSON.parse(value) : value;
    span.setStatus({ code: 1 });
    return result;
  } catch (error) {
    // If parsing fails, return the raw value
    if (error instanceof SyntaxError && parse) {
      const value = await redis.get(key);
      span.setStatus({ code: 1 });
      return value;
    }
    
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    logger.error('Redis getCache failed', {
      error: error.message,
      key
    });
    throw error;
  } finally {
    span.end();
  }
}

export async function deleteCache(key) {
  const span = trace.getTracer('cartrita-v2').startSpan('redis.delete');
  
  try {
    const result = await redis.del(key);
    
    span.setAttributes({
      'redis.operation': 'del',
      'redis.key': key,
      'redis.deleted': result
    });

    span.setStatus({ code: 1 });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    logger.error('Redis deleteCache failed', {
      error: error.message,
      key
    });
    throw error;
  } finally {
    span.end();
  }
}

export async function publishMessage(channel, message) {
  const span = trace.getTracer('cartrita-v2').startSpan('redis.publish');
  
  try {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    const result = await redisPublisher.publish(channel, payload);
    
    span.setAttributes({
      'redis.operation': 'publish',
      'redis.channel': channel,
      'redis.subscribers': result
    });

    logger.debug('Redis message published', {
      channel,
      subscribers: result
    });

    span.setStatus({ code: 1 });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    logger.error('Redis publishMessage failed', {
      error: error.message,
      channel
    });
    throw error;
  } finally {
    span.end();
  }
}

export async function healthCheck() {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    const info = await redis.info('memory');
    const memoryInfo = parseRedisInfo(info);
    
    return {
      status: 'healthy',
      connected: true,
      latency,
      memory: {
        used: memoryInfo.used_memory_human,
        peak: memoryInfo.used_memory_peak_human,
        fragmentation: parseFloat(memoryInfo.mem_fragmentation_ratio)
      }
    };
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      connected: false,
      error: error.message
    };
  }
}

export async function closeRedis() {
  const connections = [redis, redisSubscriber, redisPublisher].filter(Boolean);
  
  if (connections.length > 0) {
    logger.info('Closing Redis connections...');
    await Promise.all(connections.map(conn => conn.quit()));
    redis = null;
    redisSubscriber = null;
    redisPublisher = null;
    logger.info('✅ Redis connections closed');
  }
}