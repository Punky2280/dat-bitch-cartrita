#!/usr/bin/env node

/**
 * Test script to verify Cartrita socket functionality and MCP LangChain protocol
 * Tests agent delegation and statistical tracking
 */

const io = require('socket.io-client');
const axios = require('axios');

class CartritaSocketTester {
  constructor() {
    this.backendUrl = 'http://localhost:8000';
    this.socket = null;
    this.userId = 4; // Using the newly created user_id=4
    this.authToken = null;
    this.testResults = {
      socket_tests: [],
      delegation_tests: [],
      mcp_tests: [],
      statistics: {
        total_queries: 0,
        successful_delegations: 0,
        failed_delegations: 0,
        agent_usage: new Map(),
      },
    };
    this.testQueries = [
      'What time is it?',
      'Create an image of a sunset',
      'Help me write a Python function',
      'Schedule a meeting for tomorrow',
      "Translate 'hello' to Spanish",
      'Check the weather',
      'Analyze this data',
      'Design a logo',
      'Write a poem',
      'Calculate 2+2',
    ];
  }

  async runTests() {
    console.log('🚀 Starting Cartrita Socket and MCP Tests');
    console.log('=========================================\n');

    try {
      // Test 1: Verify backend health
      await this.testBackendHealth();

      // Test 2: Authenticate user
      await this.authenticateUser();

      // Test 3: Connect socket
      await this.connectSocket();

      // Test 3: Test basic socket communication
      await this.testSocketCommunication();

      // Test 4: Test agent delegation queries
      await this.testAgentDelegation();

      // Test 5: Test MCP LangChain protocol
      await this.testMCPProtocol();

      // Test 6: Generate statistics
      this.generateStatistics();
    } catch (error) {
      console.error('❌ Test execution failed:', error);
    } finally {
      if (this.socket) {
        this.socket.disconnect();
      }
    }
  }

  async testBackendHealth() {
    console.log('🏥 Testing backend health...');
    try {
      const response = await axios.get(`${this.backendUrl}/health`);
      console.log('✅ Backend health check passed');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   System: ${response.data.system}\n`);

      this.testResults.socket_tests.push({
        test: 'backend_health',
        status: 'passed',
        data: response.data,
      });
    } catch (error) {
      console.error('❌ Backend health check failed:', error.message);
      this.testResults.socket_tests.push({
        test: 'backend_health',
        status: 'failed',
        error: error.message,
      });
      throw error;
    }
  }

  async authenticateUser() {
    console.log('🔐 Authenticating user...');
    try {
      const response = await axios.post(`${this.backendUrl}/api/auth/login`, {
        username: 'Robert Allen Socket',
        password: 'test123',
      });

      this.authToken = response.data.token;
      console.log('✅ User authenticated successfully');
      console.log(`   User: ${response.data.user.username}`);
      console.log(`   Token: ${this.authToken.substring(0, 20)}...\n`);

      this.testResults.socket_tests.push({
        test: 'authentication',
        status: 'passed',
        user: response.data.user,
      });
    } catch (error) {
      console.error(
        '❌ Authentication failed:',
        error.response?.data || error.message
      );
      this.testResults.socket_tests.push({
        test: 'authentication',
        status: 'failed',
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  async connectSocket() {
    console.log('🔌 Connecting to socket...');

    return new Promise((resolve, reject) => {
      this.socket = io(this.backendUrl, {
        query: { userId: this.userId },
        auth: { token: this.authToken },
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected successfully');
        console.log(`   Socket ID: ${this.socket.id}`);
        console.log(`   User ID: ${this.userId}\n`);

        this.testResults.socket_tests.push({
          test: 'socket_connection',
          status: 'passed',
          socketId: this.socket.id,
          userId: this.userId,
        });

        resolve();
      });

      this.socket.on('connect_error', error => {
        console.error('❌ Socket connection failed:', error.message);
        this.testResults.socket_tests.push({
          test: 'socket_connection',
          status: 'failed',
          error: error.message,
        });
        reject(error);
      });

      setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 10000);
    });
  }

  async testSocketCommunication() {
    console.log('💬 Testing basic socket communication...');

    return new Promise(resolve => {
      this.socket.emit('message', {
        text: 'Hello Cartrita, this is a test message',
        language: 'en',
      });

      this.socket.on('response', data => {
        console.log('✅ Received response from Cartrita');
        console.log(`   Response: ${data.text?.substring(0, 100)}...`);
        console.log(`   Model: ${data.model}`);
        console.log(`   Protocol: ${data.protocol_version || 'unknown'}\n`);

        this.testResults.socket_tests.push({
          test: 'basic_communication',
          status: 'passed',
          response: data,
        });

        resolve();
      });

      setTimeout(() => {
        console.log('⚠️  No response received within timeout');
        this.testResults.socket_tests.push({
          test: 'basic_communication',
          status: 'timeout',
        });
        resolve();
      }, 15000);
    });
  }

  async testAgentDelegation() {
    console.log('🤖 Testing agent delegation capabilities...');

    for (const [index, query] of this.testQueries.entries()) {
      console.log(`   Query ${index + 1}: "${query}"`);

      await this.sendQueryAndAnalyze(query, index);

      // Wait between queries
      await this.sleep(2000);
    }

    console.log('\n✅ Agent delegation tests completed\n');
  }

  async sendQueryAndAnalyze(query, index) {
    return new Promise(resolve => {
      const startTime = Date.now();

      this.socket.emit('message', {
        text: query,
        language: 'en',
      });

      const responseHandler = data => {
        const responseTime = Date.now() - startTime;

        // Analyze which agent was likely used
        const detectedAgent = this.detectUsedAgent(query, data);

        this.testResults.statistics.total_queries++;

        if (data.text && !data.error) {
          this.testResults.statistics.successful_delegations++;

          // Track agent usage
          if (detectedAgent) {
            const currentCount =
              this.testResults.statistics.agent_usage.get(detectedAgent) || 0;
            this.testResults.statistics.agent_usage.set(
              detectedAgent,
              currentCount + 1
            );
          }
        } else {
          this.testResults.statistics.failed_delegations++;
        }

        this.testResults.delegation_tests.push({
          query,
          query_index: index,
          detected_agent: detectedAgent,
          response_time_ms: responseTime,
          tools_used: data.tools_used || [],
          model: data.model,
          success: !data.error,
          response_length: data.text?.length || 0,
        });

        console.log(
          `      → Agent: ${
            detectedAgent || 'unknown'
          } | Time: ${responseTime}ms | Success: ${!data.error}`
        );

        this.socket.off('response', responseHandler);
        resolve();
      };

      this.socket.on('response', responseHandler);

      setTimeout(() => {
        this.socket.off('response', responseHandler);
        this.testResults.statistics.failed_delegations++;
        console.log(`      → Timeout for query: "${query}"`);
        resolve();
      }, 10000);
    });
  }

  detectUsedAgent(query, response) {
    const queryLower = query.toLowerCase();
    const responseText = response.text?.toLowerCase() || '';
    const toolsUsed = response.tools_used || [];

    // Check for specific tool usage first
    if (
      toolsUsed.includes('getCurrentDateTime') ||
      queryLower.includes('time')
    ) {
      return 'CoreAgent-Time';
    }
    if (
      toolsUsed.includes('create_art') ||
      queryLower.includes('image') ||
      queryLower.includes('create')
    ) {
      return 'ArtistAgent';
    }

    // Detect by query content
    if (queryLower.includes('time') || queryLower.includes('date')) {
      return 'CoreAgent-Time';
    }
    if (
      queryLower.includes('image') ||
      queryLower.includes('picture') ||
      queryLower.includes('draw')
    ) {
      return 'ArtistAgent';
    }
    if (
      queryLower.includes('code') ||
      queryLower.includes('function') ||
      queryLower.includes('python')
    ) {
      return 'CodeWriterAgent';
    }
    if (
      queryLower.includes('schedule') ||
      queryLower.includes('meeting') ||
      queryLower.includes('calendar')
    ) {
      return 'SchedulerAgent';
    }
    if (queryLower.includes('translate') || queryLower.includes('spanish')) {
      return 'TranslationAgent';
    }
    if (queryLower.includes('weather')) {
      return 'ResearcherAgent';
    }
    if (queryLower.includes('analyze') || queryLower.includes('data')) {
      return 'AnalyticsAgent';
    }
    if (queryLower.includes('design') || queryLower.includes('logo')) {
      return 'DesignAgent';
    }
    if (queryLower.includes('poem') || queryLower.includes('write')) {
      return 'WriterAgent';
    }

    return 'CoreAgent-Default';
  }

  async testMCPProtocol() {
    console.log('🔗 Testing MCP LangChain protocol...');

    try {
      // Test orchestrator status
      const response = await axios.get(`${this.backendUrl}/api/agent/metrics`);
      console.log('✅ MCP metrics endpoint accessible');
      console.log(`   Active agents: ${response.data.active_agents || 0}`);
      console.log(
        `   System status: ${response.data.system_status || 'unknown'}\n`
      );

      this.testResults.mcp_tests.push({
        test: 'mcp_metrics',
        status: 'passed',
        data: response.data,
      });
    } catch (error) {
      console.error('❌ MCP protocol test failed:', error.message);
      this.testResults.mcp_tests.push({
        test: 'mcp_metrics',
        status: 'failed',
        error: error.message,
      });
    }
  }

  generateStatistics() {
    console.log('📊 CARTRITA DELEGATION STATISTICS');
    console.log('=================================\n');

    const stats = this.testResults.statistics;
    const successRate =
      stats.total_queries > 0
        ? ((stats.successful_delegations / stats.total_queries) * 100).toFixed(
            2
          )
        : 0;

    console.log(`Total Queries Processed: ${stats.total_queries}`);
    console.log(`Successful Delegations: ${stats.successful_delegations}`);
    console.log(`Failed Delegations: ${stats.failed_delegations}`);
    console.log(`Success Rate: ${successRate}%\n`);

    console.log('Agent Usage Distribution:');
    console.log('------------------------');

    const sortedAgents = Array.from(stats.agent_usage.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    for (const [agent, count] of sortedAgents) {
      const percentage = ((count / stats.total_queries) * 100).toFixed(1);
      console.log(`${agent.padEnd(20)} : ${count} queries (${percentage}%)`);
    }

    console.log('\nMachine Learning Insights:');
    console.log('-------------------------');

    const avgResponseTime =
      this.testResults.delegation_tests.length > 0
        ? this.testResults.delegation_tests.reduce(
            (sum, test) => sum + test.response_time_ms,
            0
          ) / this.testResults.delegation_tests.length
        : 0;

    console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`Most Used Agent: ${sortedAgents[0]?.[0] || 'None'}`);
    console.log(
      `Agent Diversity Score: ${stats.agent_usage.size}/${
        this.testQueries.length
      } (${((stats.agent_usage.size / this.testQueries.length) * 100).toFixed(
        1
      )}%)`
    );

    // Save detailed results
    console.log('\n💾 Saving detailed test results...');
    const fs = require('fs');
    fs.writeFileSync(
      'cartrita-test-results.json',
      JSON.stringify(this.testResults, null, 2)
    );
    console.log('✅ Results saved to cartrita-test-results.json');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the tests
if (require.main === module) {
  const tester = new CartritaSocketTester();
  tester.runTests().catch(console.error);
}

module.exports = CartritaSocketTester;
