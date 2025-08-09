#!/usr/bin/env node

/**
 * Simple test script to test Cartrita agents via socket
 */

const io = require('socket.io-client');

const testQueries = [
  { prompt: 'What time is it?', expected_agent: 'CoreAgent-Time' },
  { prompt: 'Create an image of a sunset', expected_agent: 'ArtistAgent' },
  { prompt: 'Write a Python function', expected_agent: 'CodeWriterAgent' },
  { prompt: 'Schedule a meeting', expected_agent: 'SchedulerAgent' },
  { prompt: 'Translate hello to Spanish', expected_agent: 'TranslationAgent' },
  { prompt: 'What is 2 + 2?', expected_agent: 'CoreAgent-Default' },
];

let results = [];

class CartritaAgentTester {
  constructor() {
    this.socket = null;
    this.userId = 4;
    this.currentTest = 0;
  }

  async runTests() {
    console.log('🧪 Cartrita Agent Delegation Test');
    console.log('================================\n');

    try {
      await this.connectSocket();
      await this.runTestSequence();
      this.generateReport();
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    } finally {
      if (this.socket) {
        this.socket.disconnect();
      }
    }
  }

  async connectSocket() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to Cartrita socket...');

      this.socket = io('http://localhost:8000', {
        query: { userId: this.userId },
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to Cartrita');
        console.log(`   Socket ID: ${this.socket.id}\n`);
        resolve();
      });

      this.socket.on('connect_error', error => {
        console.error('❌ Socket connection failed:', error.message);
        reject(error);
      });

      setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 10000);
    });
  }

  async runTestSequence() {
    for (let i = 0; i < testQueries.length; i++) {
      const test = testQueries[i];
      console.log(`🔍 Test ${i + 1}: "${test.prompt}"`);

      const result = await this.sendMessage(test.prompt);

      results.push({
        test_number: i + 1,
        prompt: test.prompt,
        expected_agent: test.expected_agent,
        response: result.text?.substring(0, 200) + '...',
        response_time: result.response_time_ms,
        tools_used: result.tools_used || [],
        model: result.model,
        success: !result.error,
      });

      console.log(`   ✅ Response: ${result.text?.substring(0, 100)}...`);
      console.log(`   📊 Model: ${result.model || 'unknown'}`);
      console.log(`   ⏱️  Time: ${result.response_time_ms || 'unknown'}ms`);
      if (result.tools_used?.length) {
        console.log(`   🔧 Tools: ${result.tools_used.join(', ')}`);
      }
      console.log('');

      // Wait between tests
      await this.sleep(2000);
    }
  }

  async sendMessage(text) {
    return new Promise(resolve => {
      const startTime = Date.now();

      this.socket.emit('message', {
        text: text,
        language: 'en',
      });

      const responseHandler = data => {
        data.response_time_ms = Date.now() - startTime;
        this.socket.off('response', responseHandler);
        resolve(data);
      };

      this.socket.on('response', responseHandler);

      setTimeout(() => {
        this.socket.off('response', responseHandler);
        resolve({
          text: 'Timeout - no response received',
          error: true,
          response_time_ms: Date.now() - startTime,
        });
      }, 15000);
    });
  }

  generateReport() {
    console.log('📊 CARTRITA AGENT DELEGATION REPORT');
    console.log('===================================\n');

    const successfulTests = results.filter(r => r.success).length;
    const totalTests = results.length;
    const successRate = ((successfulTests / totalTests) * 100).toFixed(1);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Successful: ${successfulTests}`);
    console.log(`Success Rate: ${successRate}%\n`);

    const avgResponseTime =
      results
        .filter(r => r.response_time && r.success)
        .reduce((sum, r) => sum + r.response_time, 0) / successfulTests;

    console.log(
      `Average Response Time: ${avgResponseTime?.toFixed(0) || 'N/A'}ms\n`
    );

    console.log('Detailed Results:');
    console.log('-'.repeat(80));

    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} Test ${result.test_number}: ${result.prompt}`);
      console.log(`    Expected: ${result.expected_agent}`);
      console.log(`    Model: ${result.model || 'unknown'}`);
      console.log(
        `    Tools: ${
          result.tools_used?.length ? result.tools_used.join(', ') : 'none'
        }`
      );
      console.log(`    Time: ${result.response_time || 'N/A'}ms`);
      console.log('');
    });

    // Save results
    const fs = require('fs');
    fs.writeFileSync(
      'cartrita-agent-test-results.json',
      JSON.stringify(results, null, 2)
    );
    console.log(
      '💾 Detailed results saved to cartrita-agent-test-results.json'
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the tests
if (require.main === module) {
  const tester = new CartritaAgentTester();
  tester.runTests().catch(console.error);
}

module.exports = CartritaAgentTester;
