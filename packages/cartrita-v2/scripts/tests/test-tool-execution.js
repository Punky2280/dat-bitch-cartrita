#!/usr/bin/env node

/**
 * Test script to diagnose LangChain orchestrator tool execution failure
 * Based on user logs showing tools aren't being called despite intent detection
 */

const io = require('socket.io-client');

class ToolExecutionTester {
  constructor() {
    this.socket = null;
    this.userId = 5;
  }

  async runDiagnostics() {
    console.log('🔍 Cartrita Tool Execution Diagnostic');
    console.log('=====================================\n');

    try {
      await this.connectSocket();
      await this.testTimeQuery();
      await this.testImageGeneration();
      await this.testSystemStatus();
    } catch (error) {
      console.error('❌ Diagnostic failed:', error.message);
    } finally {
      if (this.socket) {
        this.socket.disconnect();
      }
    }
  }

  async connectSocket() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to Cartrita socket...');

      // Use proper JWT authentication
      this.socket = io('http://localhost:8001', {
        auth: {
          token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo1LCJ1c2VybmFtZSI6InRlc3RhZ2VudCIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsImlhdCI6MTc1NDIwNDk3OCwiZXhwIjoxNzU0MjkxMzc4fQ.knLt-6FagiLdY7QZzKU089PTBHH50W68wJwCi0DQBxQ',
        },
        query: { userId: 5 },
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

  async testTimeQuery() {
    console.log('⏰ Testing Time Query (should use getCurrentDateTime tool)');
    console.log('='.repeat(60));

    const result = await this.sendMessage('What time is it?');

    console.log('📊 ANALYSIS:');
    console.log(`   Response: ${result.text?.substring(0, 150)}...`);
    console.log(`   Model: ${result.model || 'unknown'}`);
    console.log(
      `   Tools Used: ${
        result.tools_used?.length ? result.tools_used.join(', ') : 'NONE'
      }`
    );
    console.log(`   Response Time: ${result.responseTime || 'unknown'}ms`);

    // Check if tool was actually called
    if (!result.tools_used?.includes('getCurrentDateTime')) {
      console.log('🚨 ISSUE: getCurrentDateTime tool was NOT called');
      console.log('   Expected: Tool should be called for time queries');
      console.log('   Actual: Agent answered directly without tool execution');
    } else {
      console.log('✅ SUCCESS: getCurrentDateTime tool was properly called');
    }
    console.log('');
  }

  async testImageGeneration() {
    console.log('🎨 Testing Image Generation (should delegate to ArtistAgent)');
    console.log('='.repeat(60));

    const result = await this.sendMessage(
      'Create an image of a sunset over mountains'
    );

    console.log('📊 ANALYSIS:');
    console.log(`   Response: ${result.text?.substring(0, 150)}...`);
    console.log(`   Model: ${result.model || 'unknown'}`);
    console.log(
      `   Tools Used: ${
        result.tools_used?.length ? result.tools_used.join(', ') : 'NONE'
      }`
    );
    console.log(`   Response Time: ${result.responseTime || 'unknown'}ms`);

    // Check if appropriate delegation occurred
    if (
      !result.tools_used?.length &&
      result.text?.includes('technical difficulties')
    ) {
      console.log(
        '🚨 ISSUE: No tools called, agent apologized for technical difficulties'
      );
      console.log(
        '   Expected: Should delegate to ArtistAgent or image generation tool'
      );
      console.log('   Actual: Generic apology response');
    } else if (result.tools_used?.length) {
      console.log('✅ SUCCESS: Tool delegation occurred');
    } else {
      console.log('⚠️  UNCLEAR: Response pattern differs from expected');
    }
    console.log('');
  }

  async testSystemStatus() {
    console.log('🔧 Testing System Status (should use getSystemStatus tool)');
    console.log('='.repeat(60));

    const result = await this.sendMessage('What is the system status?');

    console.log('📊 ANALYSIS:');
    console.log(`   Response: ${result.text?.substring(0, 150)}...`);
    console.log(`   Model: ${result.model || 'unknown'}`);
    console.log(
      `   Tools Used: ${
        result.tools_used?.length ? result.tools_used.join(', ') : 'NONE'
      }`
    );
    console.log(`   Response Time: ${result.responseTime || 'unknown'}ms`);

    // Check if tool was actually called
    if (!result.tools_used?.includes('getSystemStatus')) {
      console.log('🚨 ISSUE: getSystemStatus tool was NOT called');
      console.log('   Expected: Tool should be called for system queries');
      console.log('   Actual: Agent answered directly without tool execution');
    } else {
      console.log('✅ SUCCESS: getSystemStatus tool was properly called');
    }
    console.log('');
  }

  async sendMessage(text) {
    return new Promise(resolve => {
      const startTime = Date.now();

      // Listen for debug logs
      console.log(`🔎 Sending: "${text}"`);

      this.socket.emit('user_message', {
        text: text,
        language: 'en',
        timestamp: new Date().toISOString(),
      });

      const responseHandler = data => {
        data.responseTime = Date.now() - startTime;
        this.socket.off('agent_response', responseHandler);
        resolve(data);
      };

      this.socket.on('agent_response', responseHandler);

      setTimeout(() => {
        this.socket.off('agent_response', responseHandler);
        resolve({
          text: 'Timeout - no response received',
          error: true,
          responseTime: Date.now() - startTime,
        });
      }, 15000);
    });
  }
}

// Run the diagnostic
if (require.main === module) {
  const tester = new ToolExecutionTester();
  tester.runDiagnostics().catch(console.error);
}

module.exports = ToolExecutionTester;
