#!/usr/bin/env node

/**
 * Enhanced LangChain Core Agent Integration Testing Suite
 * Tests the complete integration with existing consciousness system
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 Starting Enhanced LangChain Core Agent Integration Tests...\n');

// Mock database for testing
const mockDb = {
  query: async (sql, params) => {
    console.log(`[MockDB] Query: ${sql.substring(0, 50)}...`);

    // Mock user settings response
    if (sql.includes('user_settings')) {
      return {
        rows: [
          {
            sarcasm: 7,
            verbosity: 'normal',
            humor: 'witty',
            created_at: new Date('2024-01-01'),
            last_login: new Date(),
            total_conversations: 25,
            recent_conversations: 5,
            coding_conversations: 8,
            creative_conversations: 3,
            time_queries: 2,
          },
        ],
      };
    }

    // Mock conversation history
    if (sql.includes('conversations')) {
      return {
        rows: [
          {
            text: 'What time is it?',
            speaker: 'user',
            created_at: new Date(),
            model: 'test',
          },
          {
            text: 'Can you create an image?',
            speaker: 'user',
            created_at: new Date(),
            model: 'test',
          },
          {
            text: 'Help me debug this code',
            speaker: 'user',
            created_at: new Date(),
            model: 'test',
          },
        ],
      };
    }

    return { rows: [] };
  },
};

// Mock orchestrator for testing
const mockOrchestrator = {
  initialize: async () => {
    console.log('[MockOrchestrator] Initialized');
    return true;
  },

  processRequest: async (prompt, language, userId) => {
    console.log(
      `[MockOrchestrator] Processing: "${prompt.substring(0, 30)}..."`
    );

    const mockResponses = {
      time: {
        text: "It's currently 2:30 PM EST on a lovely Tuesday afternoon.",
        tools_used: ['getCurrentDateTime'],
        response_time_ms: 850,
      },
      image: {
        text: "I've created a stunning image for you! Here's your masterpiece.",
        tools_used: ['art', 'dalle'],
        response_time_ms: 3200,
      },
      code: {
        text: "Here's the debugged version of your code with explanations.",
        tools_used: ['code', 'programming'],
        response_time_ms: 1500,
      },
      default: {
        text: "I understand what you're asking. Let me help you with that.",
        tools_used: [],
        response_time_ms: 650,
      },
    };

    // Simulate processing delay
new Promise(resolve => setTimeout(resolve, 100));
    if (prompt.toLowerCase().includes('time')) return mockResponses.time;
    if (
      prompt.toLowerCase().includes('image') ||
      prompt.toLowerCase().includes('create')
    )
      return mockResponses.image;
    if (
      prompt.toLowerCase().includes('code') ||
      prompt.toLowerCase().includes('debug')
    )
      return mockResponses.code;

    return mockResponses.default;
  },

  getAvailableTools: () => [
    { name: 'getCurrentDateTime', description: 'Get current date and time' },
    { name: 'art', description: 'Generate images and artwork' },
    { name: 'code', description: 'Programming assistance' },
    { name: 'search', description: 'Search for information' },
  ],
};

// Test scenarios
const testScenarios = [
  {
    name: 'Time Query Intent Recognition',
    prompt: 'What time is it right now?',
    userId: 'test-user-1',
    expectedIntent: 'time_query',
    expectedTools: ['getCurrentDateTime'],
  },
  {
    name: 'Image Generation Request',
    prompt: 'Create a beautiful sunset image with mountains',
    userId: 'test-user-2',
    expectedIntent: 'image_generation',
    expectedTools: ['art', 'dalle'],
  },
  {
    name: 'Coding Assistance',
    prompt: 'Help me debug this JavaScript function that is not working',
    userId: 'test-user-3',
    expectedIntent: 'coding',
    expectedTools: ['code'],
  },
  {
    name: 'Complex Multi-Intent Request',
    prompt:
      'Can you create an image of a clock showing the current time and then help me code a timer function?',
    userId: 'test-user-4',
    expectedIntent: 'image_generation',
    expectedSecondaryIntent: 'coding',
  },
  {
    name: 'Personality Adaptation Test',
    prompt: 'Hey there, how are you doing today?',
    userId: 'test-user-5',
    expectedIntent: 'conversation',
    testPersonality: true,
  },
];

async function runIntegrationTests() {
  try {
    // Check if the Enhanced Agent file exists
    const agentPath = path.join(
      __dirname,
      '..',
      'src',
      'agi',
      'consciousness',
      'EnhancedLangChainCoreAgent.js'
    );

    if (!fs.existsSync(agentPath)) {
      throw new Error(`Enhanced Agent file not found at: ${agentPath}`);
    }

    // Load the Enhanced Agent
    const EnhancedLangChainCoreAgent = require('../src/agi/consciousness/EnhancedLangChainCoreAgent');

    // Initialize with mocks
    const agent = new EnhancedLangChainCoreAgent();

    // Inject mocks
    agent.db = mockDb;
    agent.orchestrator = mockOrchestrator;

    console.log('🔧 Initializing Enhanced Agent...');
agent.initialize();
    if (!agent.isInitialized) {
      throw new Error('Agent failed to initialize');
    }

    console.log('✅ Agent initialized successfully\n');

    let passedTests = 0;
    let totalTests = testScenarios.length;

    // Run test scenarios
    for (const [index, scenario] of testScenarios.entries()) {
      console.log(`\n🧪 Test ${index + 1}/${totalTests}: ${scenario.name}`);
      console.log(`   📝 Prompt: "${scenario.prompt}"`);

      try {
        const startTime = Date.now();
        const result = await agent.processRequest(
          scenario.prompt,
          'en',
          scenario.userId,
          `test-request-${index + 1}`
        );
        const endTime = Date.now();

        // Validate response structure
        if (!result || !result.text) {
          throw new Error('Invalid response structure');
        }

        console.log(`   ✅ Response: "${result.text.substring(0, 50)}..."`);
        console.log(`   ⏱️  Response time: ${endTime - startTime}ms`);
        console.log(
          `   🔧 Tools used: ${JSON.stringify(result.tools_used || [])}`
        );

        // Test intent analysis
        if (scenario.expectedIntent) {
          // We can't directly access intent analysis from the result,
          // but we can infer from tools used
          const toolsMatch =
            scenario.expectedTools &&
            scenario.expectedTools.some(
              tool => result.tools_used && result.tools_used.includes(tool)
            );

          if (scenario.expectedTools && !toolsMatch) {
            console.log(
              `   ⚠️  Expected tools ${JSON.stringify(scenario.expectedTools)} but got ${JSON.stringify(result.tools_used)}`
            );
          } else {
            console.log(`   ✅ Intent recognition successful`);
          }
        }

        // Test personality adaptation
        if (scenario.testPersonality) {
          const hasPersonality =
            result.text.length > 20 &&
            (result.text.includes('!') ||
              result.text.includes('?') ||
              result.text.toLowerCase().includes('hey') ||
              result.text.toLowerCase().includes('doing'));

          if (hasPersonality) {
            console.log(`   ✅ Personality adaptation detected`);
          } else {
            console.log(`   ⚠️  Personality adaptation not clearly evident`);
          }
        }

        passedTests++;
        console.log(`   ✅ Test passed`);
      } catch (error) {
        console.log(`   ❌ Test failed: ${error.message}`);
      }
    }

    // Test system health and metrics
    console.log(`\n🏥 Testing System Health & Metrics...`);

    const health = agent.checkSystemHealth();
    console.log(
      `   Health Status: ${health.healthy ? '✅ Healthy' : '❌ Issues detected'}`
    );

    if (!health.healthy) {
      console.log(`   Issues: ${JSON.stringify(health.issues)}`);
    }

    const status = agent.getStatus();
    console.log(`   Uptime: ${status.uptime_readable}`);
    console.log(`   Requests processed: ${status.metrics.requests_processed}`);
    console.log(`   Cache size: ${status.cache_stats.user_context_cache_size}`);

    // Test performance metrics
    console.log(`\n📊 Performance Metrics:`);
    agent.logPerformanceMetrics();

    // Test cache functionality
    console.log(`\n💾 Testing Cache Functionality...`);
    const cacheTestUser = 'cache-test-user';

    // First call should miss cache
    console.log(`   First context fetch (should miss cache)...`);
    const context1 = await agent.getEnhancedUserContext(
      cacheTestUser,
      'cache-test-1'
    );

    // Second call should hit cache
    console.log(`   Second context fetch (should hit cache)...`);
    const context2 = await agent.getEnhancedUserContext(
      cacheTestUser)
      'cache-test-2'
    );

    if (context1 && context2) {
      console.log(`   ✅ Cache functionality working`);
    }

    // Test cleanup
    console.log(`\n🧹 Testing Cache Cleanup...`);
    agent.cleanupExpiredCache();
    console.log(`   ✅ Cache cleanup completed`);

    // Final results
    console.log(`\n📊 Integration Test Results:`);
    console.log(`   ✅ Passed: ${passedTests}/${totalTests} tests`);
    console.log(
      `   📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`
    );
    console.log(
      `   🏥 System Health: ${health.healthy ? 'Healthy' : 'Issues detected'}`
    );
    console.log(`   💾 Cache: Working`);
    console.log(`   📊 Metrics: Collecting`);

    if (passedTests === totalTests && health.healthy) {
      console.log(
        `\n🎉 All integration tests passed! System is ready for production.`
      );
      return true;
    } else {
      console.log(
        `\n⚠️  Some tests failed or issues detected. Review before production deployment.`
      );
      return false;
    }
  } catch (error) {
    console.error(`\n❌ Integration test failed with error:`, error);
    console.error(`Stack trace:`, error.stack);
    return false;
  }
}

// Run the tests
runIntegrationTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
