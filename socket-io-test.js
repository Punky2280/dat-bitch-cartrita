#!/usr/bin/env node

/**
 * Task 2: Socket.IO Connectivity & Real-Time Channel Validation
 * Comprehensive test of all Socket.IO namespaces and channels
 */

import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:8001';
const TEST_NAMESPACES = [
  'dashboard',
  'model-catalog', 
  'rag-pipeline',
  'voice',
  'computer-vision',
  'audio',
  'video',
  'analytics',
  'security',
  'ai-hub',
  'camera-vision'
];

class SocketIOTester {
  constructor() {
    this.results = {
      connected: 0,
      failed: 0,
      messagesSent: 0,
      messagesReceived: 0,
      avgLatency: [],
      errors: []
    };
  }

  async testNamespace(namespace) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = io(`${BACKEND_URL}/${namespace}`, {
        timeout: 5000,
        reconnectionAttempts: 1
      });

      const testData = {
        test: true,
        timestamp: Date.now(),
        namespace: namespace,
        messageId: `test-${Math.random().toString(36).substr(2, 9)}`
      };

      socket.on('connect', () => {
        console.log(`✅ Connected to /${namespace}`);
        this.results.connected++;
        
        // Send test message
        socket.emit('test-message', testData);
        this.results.messagesSent++;
      });

      socket.on('test-response', (data) => {
        const latency = Date.now() - testData.timestamp;
        this.results.avgLatency.push(latency);
        this.results.messagesReceived++;
        console.log(`📨 Response from /${namespace} (${latency}ms)`);
        socket.disconnect();
        resolve({ success: true, latency });
      });

      socket.on('connect_error', (error) => {
        console.log(`❌ Failed to connect to /${namespace}: ${error.message}`);
        this.results.failed++;
        this.results.errors.push({ namespace, error: error.message });
        socket.disconnect();
        resolve({ success: false, error: error.message });
      });

      socket.on('disconnect', () => {
        const duration = Date.now() - startTime;
        console.log(`🔌 Disconnected from /${namespace} (${duration}ms total)`);
        resolve({ success: false, timeout: true });
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        socket.disconnect();
        resolve({ success: false, timeout: true });
      }, 10000);
    });
  }

  async runTests() {
    console.log('🧪 Starting Socket.IO Connectivity Tests...\n');
    
    // Test main connection first
    console.log('🔍 Testing main Socket.IO connection...');
    const mainResult = await this.testNamespace('');
    
    console.log('\n🔍 Testing namespace connections...');
    
    // Test all namespaces
    for (const namespace of TEST_NAMESPACES) {
      await this.testNamespace(namespace);
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay between tests
    }

    // Generate report
    this.generateReport();
  }

  generateReport() {
    const total = this.results.connected + this.results.failed;
    const successRate = ((this.results.connected / total) * 100).toFixed(1);
    const avgLatency = this.results.avgLatency.length > 0 
      ? (this.results.avgLatency.reduce((a, b) => a + b, 0) / this.results.avgLatency.length).toFixed(2)
      : 'N/A';
    const p95Latency = this.results.avgLatency.length > 0
      ? this.results.avgLatency.sort((a, b) => a - b)[Math.floor(this.results.avgLatency.length * 0.95)]
      : 'N/A';

    console.log('\n📊 Socket.IO Test Results:');
    console.log('==========================');
    console.log(`Total Namespaces Tested: ${total + 1}`);
    console.log(`Successful Connections: ${this.results.connected}`);
    console.log(`Failed Connections: ${this.results.failed}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Messages Sent: ${this.results.messagesSent}`);
    console.log(`Messages Received: ${this.results.messagesReceived}`);
    console.log(`Average Latency: ${avgLatency}ms`);
    console.log(`P95 Latency: ${p95Latency}ms`);

    const targetSuccessRate = 98.9;
    const passed = parseFloat(successRate) >= targetSuccessRate;
    
    console.log(`\n🎯 Target: ≥${targetSuccessRate}% success rate`);
    console.log(`📈 Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.results.errors.forEach(({ namespace, error }) => {
        console.log(`  - /${namespace}: ${error}`);
      });
    }

    console.log(`\n${passed ? '✅' : '❌'} Task 2 Status: ${passed ? 'COMPLETED' : 'NEEDS_ATTENTION'}`);
  }
}

// Run the tests
const tester = new SocketIOTester();
tester.runTests().catch(console.error);
