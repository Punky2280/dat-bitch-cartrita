/**
 * @fileoverview Performance Testing Utilities
 * Utilities for measuring and validating performance characteristics
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

class PerformanceTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.metrics = new Map();
    this.thresholds = {
      responseTime: options.responseTime || 1000, // 1s default
      throughput: options.throughput || 100, // 100 req/s default
      errorRate: options.errorRate || 0.01, // 1% default
      ...options.thresholds
    };
    this.measurements = [];
  }

  startTimer(label) {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        this.recordMetric(label, duration);
        return duration;
      }
    };
  }

  recordMetric(label, value, metadata = {}) {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    const measurement = {
      value,
      timestamp: Date.now(),
      metadata
    };
    
    this.metrics.get(label).push(measurement);
    this.measurements.push({ label, ...measurement });
    
    this.emit('metric', { label, ...measurement });
  }

  getStats(label) {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) {
      return null;
    }

    const numbers = values.map(v => v.value);
    const sorted = numbers.sort((a, b) => a - b);
    
    return {
      count: numbers.length,
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      avg: numbers.reduce((a, b) => a + b, 0) / numbers.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  getAllStats() {
    const stats = {};
    for (const [label] of this.metrics) {
      stats[label] = this.getStats(label);
    }
    return stats;
  }

  validateThresholds() {
    const violations = [];
    
    for (const [label, threshold] of Object.entries(this.thresholds)) {
      const stats = this.getStats(label);
      if (!stats) continue;
      
      if (stats.p95 > threshold) {
        violations.push({
          metric: label,
          threshold,
          actual: stats.p95,
          type: 'p95_exceeded'
        });
      }
    }
    
    return violations;
  }

  reset() {
    this.metrics.clear();
    this.measurements = [];
  }

  export() {
    return {
      stats: this.getAllStats(),
      measurements: this.measurements,
      thresholds: this.thresholds,
      violations: this.validateThresholds(),
      timestamp: Date.now()
    };
  }
}

class LoadTester {
  constructor(options = {}) {
    this.options = {
      concurrent: 10,
      duration: 30000, // 30 seconds
      rampUpTime: 5000, // 5 seconds
      coolDownTime: 2000, // 2 seconds
      ...options
    };
    
    this.tracker = new PerformanceTracker(options.thresholds);
    this.isRunning = false;
    this.workers = [];
    this.stats = {
      requests: 0,
      errors: 0,
      successes: 0,
      startTime: null,
      endTime: null
    };
  }

  async runLoadTest(testFunction, options = {}) {
    const config = { ...this.options, ...options };
    
    console.log(`Starting load test with ${config.concurrent} concurrent workers for ${config.duration}ms`);
    
    this.isRunning = true;
    this.stats.startTime = Date.now();
    this.tracker.reset();

    // Ramp up phase
    await this.rampUp(testFunction, config);
    
    // Main test phase
    await this.runMainTest(testFunction, config);
    
    // Cool down phase
    await this.coolDown();
    
    this.stats.endTime = Date.now();
    this.isRunning = false;
    
    return this.generateReport();
  }

  async rampUp(testFunction, config) {
    const rampUpWorkers = Math.floor(config.concurrent / 2);
    const delay = config.rampUpTime / rampUpWorkers;
    
    for (let i = 0; i < rampUpWorkers && this.isRunning; i++) {
      this.spawnWorker(testFunction, `rampup-${i}`);
      await this.sleep(delay);
    }
  }

  async runMainTest(testFunction, config) {
    const remainingWorkers = config.concurrent - this.workers.length;
    
    // Spawn remaining workers
    for (let i = 0; i < remainingWorkers; i++) {
      this.spawnWorker(testFunction, `main-${i}`);
    }
    
    // Run for specified duration
    await this.sleep(config.duration);
    
    // Signal workers to stop
    this.isRunning = false;
  }

  async coolDown() {
    await this.sleep(this.options.coolDownTime);
    
    // Wait for all workers to finish
    await Promise.allSettled(this.workers);
    this.workers = [];
  }

  spawnWorker(testFunction, workerId) {
    const worker = this.runWorker(testFunction, workerId);
    this.workers.push(worker);
    return worker;
  }

  async runWorker(testFunction, workerId) {
    while (this.isRunning) {
      try {
        const timer = this.tracker.startTimer('request_duration');
        
        await testFunction();
        
        const duration = timer.end();
        this.stats.successes++;
        this.stats.requests++;
        
        this.tracker.recordMetric('throughput', 1);
        
      } catch (error) {
        this.stats.errors++;
        this.stats.requests++;
        this.tracker.recordMetric('errors', 1, { error: error.message });
      }
      
      // Small delay to prevent overwhelming
      await this.sleep(10);
    }
  }

  generateReport() {
    const duration = this.stats.endTime - this.stats.startTime;
    const throughput = (this.stats.requests / duration) * 1000; // requests per second
    const errorRate = this.stats.errors / this.stats.requests;
    
    return {
      summary: {
        duration,
        totalRequests: this.stats.requests,
        successfulRequests: this.stats.successes,
        errorRequests: this.stats.errors,
        throughput: throughput.toFixed(2),
        errorRate: (errorRate * 100).toFixed(2) + '%'
      },
      performance: this.tracker.getAllStats(),
      thresholdViolations: this.tracker.validateThresholds(),
      passed: this.tracker.validateThresholds().length === 0 && errorRate <= this.options.errorRate
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class DatabaseStressTester {
  constructor(database, options = {}) {
    this.database = database;
    this.options = {
      maxConnections: 50,
      testDuration: 30000,
      operationMix: {
        read: 0.7,
        write: 0.2,
        delete: 0.1
      },
      ...options
    };
    
    this.tracker = new PerformanceTracker();
    this.isRunning = false;
  }

  async runStressTest() {
    console.log('Starting database stress test...');
    
    this.isRunning = true;
    this.tracker.reset();
    
    // Prepare test data
    await this.setupTestData();
    
    // Create connection pools
    const workers = [];
    
    for (let i = 0; i < this.options.maxConnections; i++) {
      workers.push(this.runDatabaseWorker(i));
    }
    
    // Run for specified duration
    setTimeout(() => {
      this.isRunning = false;
    }, this.options.testDuration);
    
    await Promise.allSettled(workers);
    
    // Cleanup test data
    await this.cleanupTestData();
    
    return this.generateDatabaseReport();
  }

  async setupTestData() {
    console.log('Setting up test data...');
    
    // Create test users
    for (let i = 0; i < 1000; i++) {
      await this.database.query(`
        INSERT INTO users (name, email, password_hash, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (email) DO NOTHING
      `, [
        `stress_test_user_${i}`,
        `stress_test_${i}@example.com`,
        'test_hash'
      ]);
    }
    
    console.log('Test data setup complete');
  }

  async cleanupTestData() {
    console.log('Cleaning up test data...');
    
    await this.database.query(`
      DELETE FROM conversation_messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE user_id IN (
          SELECT id FROM users WHERE email LIKE 'stress_test_%@example.com'
        )
      )
    `);
    
    await this.database.query(`
      DELETE FROM conversations WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE 'stress_test_%@example.com'
      )
    `);
    
    await this.database.query(`
      DELETE FROM users WHERE email LIKE 'stress_test_%@example.com'
    `);
    
    console.log('Test data cleanup complete');
  }

  async runDatabaseWorker(workerId) {
    while (this.isRunning) {
      try {
        const operation = this.selectOperation();
        const timer = this.tracker.startTimer(`db_${operation}`);
        
        switch (operation) {
          case 'read':
            await this.performReadOperation();
            break;
          case 'write':
            await this.performWriteOperation();
            break;
          case 'delete':
            await this.performDeleteOperation();
            break;
        }
        
        timer.end();
        this.tracker.recordMetric('db_operations_success', 1);
        
      } catch (error) {
        this.tracker.recordMetric('db_operations_error', 1, {
          error: error.message,
          workerId
        });
      }
      
      // Small delay
      await this.sleep(Math.random() * 100);
    }
  }

  selectOperation() {
    const rand = Math.random();
    const mix = this.options.operationMix;
    
    if (rand < mix.read) return 'read';
    if (rand < mix.read + mix.write) return 'write';
    return 'delete';
  }

  async performReadOperation() {
    const operations = [
      // User queries
      () => this.database.query('SELECT * FROM users WHERE email LIKE $1 LIMIT 10', ['stress_test_%']),
      
      // Conversation queries
      () => this.database.query(`
        SELECT c.*, u.name as user_name 
        FROM conversations c 
        JOIN users u ON c.user_id = u.id 
        WHERE u.email LIKE $1 
        LIMIT 20
      `, ['stress_test_%']),
      
      // Complex join query
      () => this.database.query(`
        SELECT c.title, COUNT(cm.id) as message_count
        FROM conversations c
        LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
        WHERE c.user_id IN (SELECT id FROM users WHERE email LIKE $1)
        GROUP BY c.id, c.title
        ORDER BY message_count DESC
        LIMIT 5
      `, ['stress_test_%']),
      
      // Aggregation query
      () => this.database.query(`
        SELECT DATE(created_at) as day, COUNT(*) as user_count
        FROM users 
        WHERE email LIKE $1
        GROUP BY DATE(created_at)
        ORDER BY day DESC
      `, ['stress_test_%'])
    ];
    
    const operation = operations[Math.floor(Math.random() * operations.length)];
    await operation();
  }

  async performWriteOperation() {
    const userId = await this.getRandomTestUserId();
    if (!userId) return;
    
    const operations = [
      // Create conversation
      () => this.database.query(`
        INSERT INTO conversations (user_id, title, created_at)
        VALUES ($1, $2, NOW())
        RETURNING id
      `, [userId, `Stress Test Conversation ${Date.now()}`]),
      
      // Update user
      () => this.database.query(`
        UPDATE users 
        SET updated_at = NOW(), name = $1
        WHERE id = $2
      `, [`Updated User ${Date.now()}`, userId]),
      
      // Create message
      async () => {
        const conversationId = await this.getRandomTestConversationId(userId);
        if (conversationId) {
          await this.database.query(`
            INSERT INTO conversation_messages (conversation_id, role, content, created_at)
            VALUES ($1, $2, $3, NOW())
          `, [conversationId, 'user', `Stress test message ${Date.now()}`]);
        }
      }
    ];
    
    const operation = operations[Math.floor(Math.random() * operations.length)];
    await operation();
  }

  async performDeleteOperation() {
    // Delete old conversations (safe cleanup)
    await this.database.query(`
      DELETE FROM conversations 
      WHERE id IN (
        SELECT id FROM conversations 
        WHERE user_id IN (
          SELECT id FROM users WHERE email LIKE 'stress_test_%@example.com'
        )
        AND created_at < NOW() - INTERVAL '1 hour'
        LIMIT 5
      )
    `);
  }

  async getRandomTestUserId() {
    const result = await this.database.query(`
      SELECT id FROM users 
      WHERE email LIKE 'stress_test_%@example.com'
      ORDER BY RANDOM()
      LIMIT 1
    `);
    
    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  async getRandomTestConversationId(userId) {
    const result = await this.database.query(`
      SELECT id FROM conversations 
      WHERE user_id = $1
      ORDER BY RANDOM()
      LIMIT 1
    `, [userId]);
    
    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  generateDatabaseReport() {
    const stats = this.tracker.getAllStats();
    
    return {
      summary: {
        testDuration: this.options.testDuration,
        maxConnections: this.options.maxConnections,
        operationMix: this.options.operationMix,
        totalOperations: (stats.db_operations_success?.count || 0) + (stats.db_operations_error?.count || 0),
        successfulOperations: stats.db_operations_success?.count || 0,
        errorOperations: stats.db_operations_error?.count || 0,
        errorRate: stats.db_operations_error ? 
          ((stats.db_operations_error.count / (stats.db_operations_success?.count + stats.db_operations_error.count)) * 100).toFixed(2) + '%' : 
          '0%'
      },
      performance: {
        readOperations: stats.db_read || null,
        writeOperations: stats.db_write || null,
        deleteOperations: stats.db_delete || null
      },
      thresholdViolations: this.tracker.validateThresholds()
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class MemoryProfiler {
  constructor() {
    this.snapshots = [];
    this.isMonitoring = false;
    this.interval = null;
  }

  startMonitoring(intervalMs = 1000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.snapshots = [];
    
    this.interval = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
    
    console.log('Memory monitoring started');
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    console.log('Memory monitoring stopped');
    return this.generateMemoryReport();
  }

  takeSnapshot() {
    const usage = process.memoryUsage();
    
    this.snapshots.push({
      timestamp: Date.now(),
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    });
  }

  generateMemoryReport() {
    if (this.snapshots.length === 0) {
      return { error: 'No memory snapshots collected' };
    }

    const firstSnapshot = this.snapshots[0];
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const duration = lastSnapshot.timestamp - firstSnapshot.timestamp;

    const memoryGrowth = {
      rss: lastSnapshot.rss - firstSnapshot.rss,
      heapTotal: lastSnapshot.heapTotal - firstSnapshot.heapTotal,
      heapUsed: lastSnapshot.heapUsed - firstSnapshot.heapUsed,
      external: lastSnapshot.external - firstSnapshot.external,
      arrayBuffers: lastSnapshot.arrayBuffers - firstSnapshot.arrayBuffers
    };

    const peakUsage = {
      rss: Math.max(...this.snapshots.map(s => s.rss)),
      heapTotal: Math.max(...this.snapshots.map(s => s.heapTotal)),
      heapUsed: Math.max(...this.snapshots.map(s => s.heapUsed)),
      external: Math.max(...this.snapshots.map(s => s.external)),
      arrayBuffers: Math.max(...this.snapshots.map(s => s.arrayBuffers))
    };

    return {
      duration,
      snapshotCount: this.snapshots.length,
      memoryGrowth: this.formatBytes(memoryGrowth),
      peakUsage: this.formatBytes(peakUsage),
      finalUsage: this.formatBytes(lastSnapshot),
      snapshots: this.snapshots.map(s => ({
        timestamp: s.timestamp,
        ...this.formatBytes(s)
      }))
    };
  }

  formatBytes(memoryObject) {
    const formatted = {};
    
    for (const [key, bytes] of Object.entries(memoryObject)) {
      if (typeof bytes === 'number') {
        formatted[key] = {
          bytes,
          mb: (bytes / 1024 / 1024).toFixed(2) + ' MB'
        };
      } else {
        formatted[key] = bytes;
      }
    }
    
    return formatted;
  }
}

export {
  PerformanceTracker,
  LoadTester,
  DatabaseStressTester,
  MemoryProfiler
};
