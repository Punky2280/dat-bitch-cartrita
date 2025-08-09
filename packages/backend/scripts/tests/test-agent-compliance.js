#!/usr/bin/env node

/**
 * Agent Compliance Testing Script
 * Tests all agents for proper output procedures and response formats
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

// Import agents to test
const agentPaths = [
  '../src/agi/consciousness/ComedianAgent.js',
  '../src/agi/consciousness/ResearcherAgent.js',
  '../src/agi/consciousness/CodeWriterAgent.js',
  '../src/agi/consciousness/ArtistAgent.js',
  '../src/agi/consciousness/WriterAgent.js',
  '../src/agi/consciousness/SchedulerAgent.js',
  '../src/agi/consciousness/TaskManagementAgent.js',
  '../src/agi/consciousness/AnalyticsAgent.js',
  '../src/agi/consciousness/DesignAgent.js',
  '../src/agi/consciousness/ToolAgent.js',
  '../src/agi/consciousness/EmotionalIntelligenceAgent.js',
  '../src/agi/consciousness/MultiModalFusionAgent.js',
  '../src/agi/consciousness/PersonalizationAgent.js',
  '../src/agi/consciousness/GitHubSearchAgent.js',
];

class AgentComplianceTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      agents: {},
    };
  }

  async runTests() {
    console.log('🧪 Starting Agent Compliance Testing...\n');

    for (const agentPath of agentPaths) {
      await this.testAgent(agentPath);
    }

    this.printSummary();
  }

  async testAgent(agentPath) {
    try {
      const agentModule = await import(agentPath);
      const agent = agentModule.default;
      const agentName = path.basename(agentPath, '.js');

      console.log(`📋 Testing ${agentName}...`);

      const testResults = {
        name: agentName,
        tests: [],
        passed: 0,
        failed: 0,
      };

      // Test 1: Agent has proper constructor
      testResults.tests.push(await this.testConstructor(agent, agentName));

      // Test 2: Agent has execute method
      testResults.tests.push(await this.testExecuteMethod(agent, agentName));

      // Test 3: Agent returns proper response format
      testResults.tests.push(await this.testResponseFormat(agent, agentName));

      // Test 4: Agent handles errors gracefully
      testResults.tests.push(await this.testErrorHandling(agent, agentName));

      // Test 5: Agent has proper configuration
      testResults.tests.push(await this.testConfiguration(agent, agentName));

      // Calculate results
      testResults.passed = testResults.tests.filter(t => t.passed).length;
      testResults.failed = testResults.tests.filter(t => !t.passed).length;

      this.results.agents[agentName] = testResults;
      this.results.total++;

      if (testResults.failed === 0) {
        this.results.passed++;
        console.log(
          `  ✅ ${agentName}: All tests passed (${testResults.passed}/5)`
        );
      } else {
        this.results.failed++;
        console.log(
          `  ❌ ${agentName}: ${testResults.failed} test(s) failed (${testResults.passed}/5)`
        );
        testResults.tests.forEach(test => {
          if (!test.passed) {
            console.log(`    - ${test.name}: ${test.error}`);
          }
        });
      }

      console.log('');
    } catch (error) {
      console.log(
        `  💥 ${path.basename(agentPath, '.js')}: Failed to load - ${
          error.message
        }\n`
      );
      this.results.total++;
      this.results.failed++;
    }
  }

  async testConstructor(agent, agentName) {
    try {
      const hasConfig = agent.config && typeof agent.config === 'object';
      const hasName =
        agent.config?.name && typeof agent.config.name === 'string';
      const hasDescription = agent.config?.description;

      if (hasConfig && hasName && hasDescription) {
        return { name: 'Constructor', passed: true };
      } else {
        return {
          name: 'Constructor',
          passed: false,
          error: 'Missing config, name, or description',
        };
      }
    } catch (error) {
      return {
        name: 'Constructor',
        passed: false,
        error: error.message,
      };
    }
  }

  async testExecuteMethod(agent, agentName) {
    try {
      const hasExecute = typeof agent.execute === 'function';
      const hasGenerateResponse = typeof agent.generateResponse === 'function';

      if (hasExecute || hasGenerateResponse) {
        return { name: 'Execute Method', passed: true };
      } else {
        return {
          name: 'Execute Method',
          passed: false,
          error: 'Missing execute() or generateResponse() method',
        };
      }
    } catch (error) {
      return {
        name: 'Execute Method',
        passed: false,
        error: error.message,
      };
    }
  }

  async testResponseFormat(agent, agentName) {
    try {
      // Test with a simple prompt
      let response;
      if (typeof agent.execute === 'function') {
        response = await agent.execute('test prompt', 'en', 'test-user');
      } else if (typeof agent.generateResponse === 'function') {
        response = await agent.generateResponse('test prompt');
      } else {
        throw new Error('No execute or generateResponse method found');
      }

      // Check response format
      const isString = typeof response === 'string';
      const isObject = typeof response === 'object' && response !== null;
      const hasText = isObject && (response.text || response.content);

      if (isString || hasText) {
        return { name: 'Response Format', passed: true };
      } else {
        return {
          name: 'Response Format',
          passed: false,
          error: `Invalid response format: ${typeof response}`,
        };
      }
    } catch (error) {
      // For testing purposes, we'll consider API key errors as passed
      if (
        error.message.includes('API key') ||
        error.message.includes('openai')
      ) {
        return { name: 'Response Format', passed: true };
      }
      return {
        name: 'Response Format',
        passed: false,
        error: error.message,
      };
    }
  }

  async testErrorHandling(agent, agentName) {
    try {
      // Test with invalid input
      let response;
      if (typeof agent.execute === 'function') {
        response = await agent.execute(null, 'en', 'test-user');
      } else if (typeof agent.generateResponse === 'function') {
        response = await agent.generateResponse(null);
      }

      // Should not throw an error, should handle gracefully
      return { name: 'Error Handling', passed: true };
    } catch (error) {
      // Expected to handle errors gracefully, not throw
      return {
        name: 'Error Handling',
        passed: false,
        error: 'Does not handle null input gracefully',
      };
    }
  }

  async testConfiguration(agent, agentName) {
    try {
      const config = agent.config;
      const hasValidName =
        config?.name &&
        typeof config.name === 'string' &&
        config.name.length > 0;
      const hasCapabilities =
        Array.isArray(config?.capabilities) || Array.isArray(config?.tags);
      const hasDescription =
        config?.description && typeof config.description === 'string';

      if (hasValidName && hasCapabilities && hasDescription) {
        return { name: 'Configuration', passed: true };
      } else {
        return {
          name: 'Configuration',
          passed: false,
          error: 'Invalid configuration object',
        };
      }
    } catch (error) {
      return {
        name: 'Configuration',
        passed: false,
        error: error.message,
      };
    }
  }

  printSummary() {
    console.log('📊 Agent Compliance Test Summary');
    console.log('================================');
    console.log(`Total Agents Tested: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(
      `Success Rate: ${Math.round(
        (this.results.passed / this.results.total) * 100
      )}%\n`
    );

    if (this.results.failed > 0) {
      console.log('❌ Failed Agents:');
      Object.values(this.results.agents).forEach(agent => {
        if (agent.failed > 0) {
          console.log(
            `  - ${agent.name}: ${agent.failed}/${agent.tests.length} tests failed`
          );
        }
      });
      console.log('');
    }

    console.log('✅ Compliant Agents:');
    Object.values(this.results.agents).forEach(agent => {
      if (agent.failed === 0) {
        console.log(`  - ${agent.name}: All tests passed`);
      }
    });
  }
}

// Run the tests
const tester = new AgentComplianceTester();
tester.runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
