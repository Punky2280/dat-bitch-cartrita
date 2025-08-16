/**
 * @fileoverview Performance Tests - API Stress Testing
 * Comprehensive performance and load testing for API endpoints
 */

import { test, expect } from '@playwright/test';

import { LoadTester, DatabaseStressTester, MemoryProfiler } from '../utils/PerformanceUtils.js';
import { TestDatabase } from '../utils/TestDatabase.js';

test.describe('Performance and Stress Tests', () => {
  let apiContext;
  let authToken;
  let testDatabase;
  let memoryProfiler;

  test.beforeAll(async ({ playwright }) => {
    // Setup database for stress testing
    testDatabase = new TestDatabase();
    await testDatabase.initialize();

    // Setup API context
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000/api',
      extraHTTPHeaders: {
        'Content-Type': 'application/json'
      }
    });

    // Authenticate
    const loginResponse = await apiContext.post('/auth/login', {
      data: {
        email: 'e2etest@example.com',
        password: 'TestPassword123!'
      }
    });

    const loginData = await loginResponse.json();
    authToken = loginData.data.token;

    // Update context with auth
    await apiContext.dispose();
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000/api',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Initialize memory profiler
    memoryProfiler = new MemoryProfiler();
  });

  test.afterAll(async () => {
    if (memoryProfiler.isMonitoring) {
      memoryProfiler.stopMonitoring();
    }
    
    await testDatabase.cleanup();
    await apiContext.dispose();
  });

  test.describe('API Load Testing', () => {
    test('authentication endpoints should handle load', async () => {
      const loadTester = new LoadTester({
        concurrent: 10,
        duration: 15000, // 15 seconds
        thresholds: {
          request_duration: 2000 // 2 seconds max
        }
      });

      const testFunction = async () => {
        const timestamp = Date.now() + Math.random();
        
        // Register new user
        await apiContext.post('/auth/register', {
          data: {
            name: `Load Test User ${timestamp}`,
            email: `loadtest${timestamp}@example.com`,
            password: 'LoadTestPass123!'
          }
        });
      };

      memoryProfiler.startMonitoring(500);
      
      const report = await loadTester.runLoadTest(testFunction);
      
      const memoryReport = memoryProfiler.stopMonitoring();

      console.log('Load Test Report:', JSON.stringify(report, null, 2));
      console.log('Memory Report:', JSON.stringify(memoryReport, null, 2));

      // Assertions
      expect(report.passed).toBe(true);
      expect(parseFloat(report.summary.errorRate)).toBeLessThan(5); // < 5% error rate
      expect(parseFloat(report.summary.throughput)).toBeGreaterThan(1); // > 1 req/s
      
      // Memory should not grow excessively
      const heapGrowth = memoryReport.memoryGrowth?.heapUsed?.bytes || 0;
      expect(Math.abs(heapGrowth)).toBeLessThan(100 * 1024 * 1024); // < 100MB growth
    });

    test('chat endpoints should handle concurrent conversations', async () => {
      const loadTester = new LoadTester({
        concurrent: 15,
        duration: 20000, // 20 seconds
        thresholds: {
          request_duration: 3000 // 3 seconds max for chat responses
        }
      });

      const testFunction = async () => {
        const messageId = Date.now() + Math.random();
        
        const response = await apiContext.post('/chat', {
          data: {
            message: `Load test message ${messageId} - How are you?`,
            conversationId: null
          }
        });

        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.conversationId).toBeDefined();
      };

      memoryProfiler.startMonitoring(1000);
      
      const report = await loadTester.runLoadTest(testFunction);
      
      const memoryReport = memoryProfiler.stopMonitoring();

      console.log('Chat Load Test Report:', JSON.stringify(report, null, 2));

      // Assertions
      expect(report.passed).toBe(true);
      expect(parseFloat(report.summary.errorRate)).toBeLessThan(3); // < 3% error rate
      expect(parseFloat(report.summary.throughput)).toBeGreaterThan(0.5); // > 0.5 req/s (chat is slower)
      
      // Check for memory leaks
      const heapGrowth = memoryReport.memoryGrowth?.heapUsed?.bytes || 0;
      expect(Math.abs(heapGrowth)).toBeLessThan(200 * 1024 * 1024); // < 200MB growth for chat
    });

    test('workflow endpoints should handle bulk operations', async () => {
      const loadTester = new LoadTester({
        concurrent: 8,
        duration: 10000, // 10 seconds
        thresholds: {
          request_duration: 1500 // 1.5 seconds max
        }
      });

      let workflowCounter = 0;

      const testFunction = async () => {
        const workflowId = ++workflowCounter;
        
        // Create workflow
        const createResponse = await apiContext.post('/workflows', {
          data: {
            name: `Load Test Workflow ${workflowId}`,
            description: `Generated by load test ${Date.now()}`,
            definition: {
              nodes: [
                {
                  id: 'trigger',
                  type: 'manual',
                  position: { x: 100, y: 100 },
                  config: {}
                },
                {
                  id: 'action',
                  type: 'log',
                  position: { x: 300, y: 100 },
                  config: { message: `Load test workflow ${workflowId}` }
                }
              ],
              edges: [{ source: 'trigger', target: 'action' }]
            }
          }
        });

        expect(createResponse.ok()).toBeTruthy();
        
        const createData = await createResponse.json();
        const workflowIdFromResponse = createData.data.id;
        
        // Execute workflow
        const executeResponse = await apiContext.post(`/workflows/${workflowIdFromResponse}/execute`, {
          data: {
            input: { test: `load-test-${workflowId}` },
            config: { async: false }
          }
        });

        expect(executeResponse.ok()).toBeTruthy();
      };

      const report = await loadTester.runLoadTest(testFunction);

      console.log('Workflow Load Test Report:', JSON.stringify(report, null, 2));

      // Assertions
      expect(report.passed).toBe(true);
      expect(parseFloat(report.summary.errorRate)).toBeLessThan(5); // < 5% error rate
      expect(parseFloat(report.summary.throughput)).toBeGreaterThan(0.8); // > 0.8 req/s
    });
  });

  test.describe('Database Stress Testing', () => {
    test('database should handle concurrent operations', async () => {
      const dbStressTester = new DatabaseStressTester(testDatabase, {
        maxConnections: 20,
        testDuration: 15000, // 15 seconds
        operationMix: {
          read: 0.6,
          write: 0.3,
          delete: 0.1
        }
      });

      memoryProfiler.startMonitoring(1000);

      const report = await dbStressTester.runStressTest();

      const memoryReport = memoryProfiler.stopMonitoring();

      console.log('Database Stress Test Report:', JSON.stringify(report, null, 2));
      console.log('Memory During DB Stress:', JSON.stringify(memoryReport, null, 2));

      // Assertions
      expect(report.summary.totalOperations).toBeGreaterThan(100); // Should complete many operations
      expect(parseFloat(report.summary.errorRate)).toBeLessThan(5); // < 5% error rate
      
      // Performance thresholds
      if (report.performance.readOperations) {
        expect(report.performance.readOperations.p95).toBeLessThan(1000); // < 1s for 95% of reads
      }
      
      if (report.performance.writeOperations) {
        expect(report.performance.writeOperations.p95).toBeLessThan(2000); // < 2s for 95% of writes
      }

      // No major memory leaks during DB stress
      const heapGrowth = memoryReport.memoryGrowth?.heapUsed?.bytes || 0;
      expect(Math.abs(heapGrowth)).toBeLessThan(150 * 1024 * 1024); // < 150MB growth
    });

    test('database connection pool should handle connection churning', async () => {
      const connectionTest = async () => {
        // Simulate rapid connection creation/destruction
        const operations = [];
        
        for (let i = 0; i < 50; i++) {
          operations.push(
            testDatabase.query('SELECT COUNT(*) FROM users WHERE email LIKE $1', ['stress_test_%'])
          );
        }
        
        const results = await Promise.all(operations);
        
        // All queries should succeed
        results.forEach(result => {
          expect(result.rows).toBeDefined();
        });
      };

      // Run the test multiple times
      const iterations = 5;
      for (let i = 0; i < iterations; i++) {
        await connectionTest();
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`Connection churning test completed ${iterations} iterations successfully`);
    });
  });

  test.describe('Memory and Resource Testing', () => {
    test('should not have significant memory leaks during normal operations', async () => {
      memoryProfiler.startMonitoring(500);

      // Simulate normal application usage
      for (let i = 0; i < 50; i++) {
        // Create conversation
        const chatResponse = await apiContext.post('/chat', {
          data: {
            message: `Memory test message ${i}`,
            conversationId: null
          }
        });

        expect(chatResponse.ok()).toBeTruthy();
        
        const chatData = await chatResponse.json();
        const conversationId = chatData.data.conversationId;

        // Get conversation details
        await apiContext.get(`/chat/conversations/${conversationId}`);

        // Create workflow
        const workflowResponse = await apiContext.post('/workflows', {
          data: {
            name: `Memory Test Workflow ${i}`,
            description: `Memory test workflow ${i}`,
            definition: {
              nodes: [
                {
                  id: 'start',
                  type: 'manual',
                  position: { x: 100, y: 100 },
                  config: {}
                }
              ],
              edges: []
            }
          }
        });

        if (workflowResponse.ok()) {
          const workflowData = await workflowResponse.json();
          const workflowId = workflowData.data.id;
          
          // Execute workflow
          await apiContext.post(`/workflows/${workflowId}/execute`, {
            data: {
              input: { test: `memory-${i}` },
              config: { async: false }
            }
          });
          
          // Clean up workflow
          await apiContext.delete(`/workflows/${workflowId}`);
        }

        // Clean up conversation
        await apiContext.delete(`/chat/conversations/${conversationId}`);
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const memoryReport = memoryProfiler.stopMonitoring();

      console.log('Memory Leak Test Report:', JSON.stringify(memoryReport, null, 2));

      // Memory growth should be minimal
      const heapGrowth = memoryReport.memoryGrowth?.heapUsed?.bytes || 0;
      const peakHeap = memoryReport.peakUsage?.heapUsed?.bytes || 0;
      
      expect(Math.abs(heapGrowth)).toBeLessThan(50 * 1024 * 1024); // < 50MB growth
      expect(peakHeap).toBeLessThan(500 * 1024 * 1024); // < 500MB peak usage
      
      console.log(`Memory growth: ${(heapGrowth / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Peak usage: ${(peakHeap / 1024 / 1024).toFixed(2)} MB`);
    });

    test('should handle resource cleanup correctly', async () => {
      const initialSnapshot = process.memoryUsage();

      // Create many resources
      const createdResources = [];
      
      for (let i = 0; i < 20; i++) {
        // Create chat conversation
        const chatResponse = await apiContext.post('/chat', {
          data: {
            message: `Cleanup test message ${i}`,
            conversationId: null
          }
        });

        if (chatResponse.ok()) {
          const chatData = await chatResponse.json();
          createdResources.push({
            type: 'conversation',
            id: chatData.data.conversationId
          });
        }

        // Create workflow
        const workflowResponse = await apiContext.post('/workflows', {
          data: {
            name: `Cleanup Test Workflow ${i}`,
            description: `Cleanup test workflow ${i}`,
            definition: {
              nodes: [
                {
                  id: 'start',
                  type: 'manual',
                  position: { x: 100, y: 100 },
                  config: {}
                }
              ],
              edges: []
            }
          }
        });

        if (workflowResponse.ok()) {
          const workflowData = await workflowResponse.json();
          createdResources.push({
            type: 'workflow',
            id: workflowData.data.id
          });
        }
      }

      console.log(`Created ${createdResources.length} resources for cleanup test`);

      // Let garbage collection run
      if (global.gc) {
        global.gc();
      }

      const midSnapshot = process.memoryUsage();

      // Clean up all resources
      for (const resource of createdResources) {
        try {
          if (resource.type === 'conversation') {
            await apiContext.delete(`/chat/conversations/${resource.id}`);
          } else if (resource.type === 'workflow') {
            await apiContext.delete(`/workflows/${resource.id}`);
          }
        } catch (error) {
          console.warn(`Failed to cleanup ${resource.type} ${resource.id}:`, error.message);
        }
      }

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for cleanup

      const finalSnapshot = process.memoryUsage();

      console.log('Resource Cleanup Memory Snapshots:');
      console.log('Initial:', (initialSnapshot.heapUsed / 1024 / 1024).toFixed(2), 'MB');
      console.log('After Creation:', (midSnapshot.heapUsed / 1024 / 1024).toFixed(2), 'MB');
      console.log('After Cleanup:', (finalSnapshot.heapUsed / 1024 / 1024).toFixed(2), 'MB');

      // Memory should return close to initial levels after cleanup
      const netGrowth = finalSnapshot.heapUsed - initialSnapshot.heapUsed;
      expect(Math.abs(netGrowth)).toBeLessThan(30 * 1024 * 1024); // < 30MB net growth

      console.log(`Net memory growth after cleanup: ${(netGrowth / 1024 / 1024).toFixed(2)} MB`);
    });
  });

  test.describe('Throughput and Latency', () => {
    test('API response times should be within acceptable limits', async () => {
      const measurements = [];

      // Test various endpoints for response time
      const endpoints = [
        { method: 'GET', path: '/auth/profile' },
        { method: 'GET', path: '/chat/conversations' },
        { method: 'GET', path: '/workflows' }
      ];

      for (const endpoint of endpoints) {
        const times = [];
        
        for (let i = 0; i < 10; i++) {
          const start = Date.now();
          
          const response = endpoint.method === 'GET' 
            ? await apiContext.get(endpoint.path)
            : await apiContext.post(endpoint.path);
          
          const duration = Date.now() - start;
          
          expect(response.ok()).toBeTruthy();
          times.push(duration);
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        measurements.push({
          endpoint: `${endpoint.method} ${endpoint.path}`,
          avgResponseTime: avgTime,
          maxResponseTime: maxTime,
          minResponseTime: minTime,
          measurements: times.length
        });

        // Response time assertions
        expect(avgTime).toBeLessThan(2000); // Average < 2s
        expect(maxTime).toBeLessThan(5000); // Max < 5s

        console.log(`${endpoint.method} ${endpoint.path}: avg=${avgTime.toFixed(0)}ms, max=${maxTime}ms, min=${minTime}ms`);
      }

      console.log('Response Time Measurements:', JSON.stringify(measurements, null, 2));
    });

    test('system should maintain performance under sustained load', async () => {
      const loadTester = new LoadTester({
        concurrent: 5,
        duration: 30000, // 30 seconds sustained load
        thresholds: {
          request_duration: 3000
        }
      });

      memoryProfiler.startMonitoring(2000);

      const testFunction = async () => {
        // Mix of operations to simulate real usage
        const operations = [
          () => apiContext.get('/auth/profile'),
          () => apiContext.get('/chat/conversations'),
          () => apiContext.get('/workflows'),
          () => apiContext.post('/chat', {
            data: {
              message: `Sustained load test ${Date.now()}`,
              conversationId: null
            }
          })
        ];

        const operation = operations[Math.floor(Math.random() * operations.length)];
        const response = await operation();
        
        expect(response.ok()).toBeTruthy();
      };

      const report = await loadTester.runLoadTest(testFunction);
      const memoryReport = memoryProfiler.stopMonitoring();

      console.log('Sustained Load Test Report:', JSON.stringify(report, null, 2));

      // System should remain stable under sustained load
      expect(report.passed).toBe(true);
      expect(parseFloat(report.summary.errorRate)).toBeLessThan(2); // < 2% error rate
      expect(parseFloat(report.summary.throughput)).toBeGreaterThan(1); // > 1 req/s

      // Memory should remain stable
      const heapGrowth = memoryReport.memoryGrowth?.heapUsed?.bytes || 0;
      expect(Math.abs(heapGrowth)).toBeLessThan(100 * 1024 * 1024); // < 100MB growth over 30s

      console.log(`Sustained load completed: ${report.summary.totalRequests} requests over 30 seconds`);
    });
  });
});
