#!/usr/bin/env node

/**
 * Cartrita V2 - Computer Use Agent System Test
 * Comprehensive test suite for the hierarchical Computer Use Agent system
 */

import ComputerUseAgentBridge from './src/services/ComputerUseAgentBridge.js';
import { logger } from './src/core/logger.js';

// Mock tracing for testing
const mockTracing = {
    traceOperation: async (name, fn) => {
        console.log(`🔍 Tracing: ${name}`);
        return await fn();
    }
};

class ComputerUseAgentTester {
    constructor() {
        this.logger = logger;
        this.bridge = new ComputerUseAgentBridge(this.logger, mockTracing);
        this.testResults = [];
    }

    async runTests() {
        console.log('🧪 Starting Computer Use Agent System Tests\n');

        const tests = [
            this.testBridgeInitialization,
            this.testPythonDependencies,
            this.testAgentCreation,
            this.testComputerAccessRequest,
            this.testTaskExecution,
            this.testSystemStatus,
            this.testAgentListing,
            this.testErrorHandling
        ];

        for (const test of tests) {
            try {
                await test.call(this);
            } catch (error) {
                this.recordTest(test.name, false, error.message);
            }
        }

        this.printResults();
        await this.cleanup();
    }

    recordTest(testName, success, details = '') {
        this.testResults.push({
            test: testName,
            success,
            details,
            timestamp: new Date().toISOString()
        });

        const status = success ? '✅' : '❌';
        const detailStr = details ? ` - ${details}` : '';
        console.log(`${status} ${testName}${detailStr}`);
    }

    async testBridgeInitialization() {
        console.log('🔧 Testing bridge initialization...');
        
        const result = await this.bridge.initialize();
        
        this.recordTest('Bridge Initialization', result.success, 
            `Dependencies satisfied: ${result.dependenciesSatisfied}`);
        
        if (result.missing && result.missing.length > 0) {
            console.log('  ⚠️ Missing dependencies:', result.missing);
            console.log('  💡 Install with: pip install openai langchain-openai pydantic pyautogui pillow');
        }
    }

    async testPythonDependencies() {
        console.log('🐍 Testing Python dependencies...');
        
        const deps = await this.bridge.checkPythonDependencies();
        
        this.recordTest('Python Dependencies Check', true, 
            `Satisfied: ${deps.satisfied}, Missing: ${deps.missing?.length || 0}`);
        
        if (deps.missing && deps.missing.length > 0) {
            console.log('  📦 Missing packages:', deps.missing);
        }
    }

    async testAgentCreation() {
        console.log('🤖 Testing agent creation...');
        
        const result = await this.bridge.createAgent('test_agent', 'SUPERVISED', {
            description: 'Test agent for automated testing',
            environment: 'ubuntu'
        });
        
        this.recordTest('Agent Creation', result.success, 
            `Agent ID: ${result.agentId}`);
        
        // Store agent ID for subsequent tests
        this.testAgentId = result.agentId;
    }

    async testComputerAccessRequest() {
        if (!this.testAgentId) {
            this.recordTest('Computer Access Request', false, 'No test agent available');
            return;
        }
        
        console.log('🔐 Testing computer access request...');
        
        const result = await this.bridge.requestComputerAccess(
            this.testAgentId,
            'Take a screenshot for testing',
            'Automated test scenario'
        );
        
        this.recordTest('Computer Access Request', result.success, 
            `Status: ${result.accessRequest.status}`);
    }

    async testTaskExecution() {
        if (!this.testAgentId) {
            this.recordTest('Task Execution', false, 'No test agent available');
            return;
        }
        
        console.log('⚡ Testing task execution...');
        
        try {
            const result = await this.bridge.executeComputerTask(
                this.testAgentId,
                'Take a screenshot and analyze the desktop',
                {
                    maxIterations: 3,
                    justification: 'Test execution with safe screenshot task'
                }
            );
            
            this.recordTest('Task Execution', result.success, 
                `Execution ID: ${result.executionId}`);
            
        } catch (error) {
            // Task execution may fail due to missing dependencies, but that's expected
            this.recordTest('Task Execution', false, 
                `Expected failure: ${error.message.substring(0, 100)}...`);
        }
    }

    async testSystemStatus() {
        console.log('📊 Testing system status...');
        
        const status = this.bridge.getSystemStatus();
        
        this.recordTest('System Status', true, 
            `Agents: ${status.agents.length}, Initialized: ${status.bridge.initialized}`);
        
        console.log('  📈 System Status:', JSON.stringify(status, null, 2));
    }

    async testAgentListing() {
        console.log('📋 Testing agent listing...');
        
        const agents = this.bridge.listAgents();
        
        this.recordTest('Agent Listing', true, 
            `Found ${agents.length} agents`);
        
        agents.forEach(agent => {
            console.log(`  🤖 ${agent.name} (${agent.id}): ${agent.permissionLevel}`);
        });
    }

    async testErrorHandling() {
        console.log('🚨 Testing error handling...');
        
        try {
            // Test with invalid agent ID
            await this.bridge.executeComputerTask('invalid_agent_id', 'test task');
            this.recordTest('Error Handling', false, 'Should have thrown error');
        } catch (error) {
            this.recordTest('Error Handling', true, 
                'Correctly handled invalid agent ID');
        }
    }

    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('=' * 50);
        
        const passed = this.testResults.filter(r => r.success).length;
        const failed = this.testResults.filter(r => !r.success).length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);
        
        console.log('\nDetailed Results:');
        this.testResults.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`  ${status} ${result.test}: ${result.details}`);
        });
        
        // Test environment recommendations
        console.log('\n💡 Recommendations:');
        
        const depTest = this.testResults.find(r => r.test === 'testPythonDependencies');
        if (depTest && depTest.details.includes('Missing: ')) {
            console.log('  📦 Install missing Python dependencies for full functionality');
            console.log('  🔧 Run: pip install openai langchain-openai pydantic pyautogui pillow');
        }
        
        const initTest = this.testResults.find(r => r.test === 'testBridgeInitialization');
        if (initTest && initTest.details.includes('false')) {
            console.log('  🐍 Ensure Python 3.8+ is installed and accessible');
        }
        
        console.log('  🔑 Ensure OPENAI_API_KEY and OPENAI_FINETUNING_API_KEY are set');
        console.log('  🗄️ Run database migration 18 for Computer Use Agent tables');
        console.log('  🚀 Start V2 backend with: npm run dev:v2');
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test resources...');
        await this.bridge.cleanup();
        console.log('✅ Cleanup complete');
    }
}

// Performance test function
async function performanceTest() {
    console.log('\n⚡ Running Performance Tests...');
    
    const bridge = new ComputerUseAgentBridge(logger, mockTracing);
    await bridge.initialize();
    
    const startTime = Date.now();
    const agentCount = 10;
    const promises = [];
    
    // Create multiple agents concurrently
    for (let i = 0; i < agentCount; i++) {
        promises.push(bridge.createAgent(`perf_agent_${i}`, 'SUPERVISED'));
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    const agentsPerSecond = Math.round((agentCount / duration) * 1000);
    
    console.log(`📊 Performance Results:`);
    console.log(`  Created ${agentCount} agents in ${duration}ms`);
    console.log(`  Rate: ${agentsPerSecond} agents/second`);
    
    await bridge.cleanup();
}

// API Integration test function
async function integrationTest() {
    console.log('\n🔗 Running Integration Tests...');
    
    // Test API endpoints (requires server to be running)
    const endpoints = [
        'http://localhost:8000/api/v2/computer-use/health',
        'http://localhost:8000/api/v2/computer-use/system/status'
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint);
            const data = await response.json();
            
            const status = response.ok ? '✅' : '❌';
            console.log(`  ${status} ${endpoint}: ${data.success ? 'Success' : 'Failed'}`);
            
        } catch (error) {
            console.log(`  ❌ ${endpoint}: Server not running or endpoint unavailable`);
        }
    }
    
    console.log('  💡 Tip: Start V2 backend with "npm run dev:v2" for full integration testing');
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--performance')) {
        await performanceTest();
        return;
    }
    
    if (args.includes('--integration')) {
        await integrationTest();
        return;
    }
    
    if (args.includes('--all')) {
        const tester = new ComputerUseAgentTester();
        await tester.runTests();
        await performanceTest();
        await integrationTest();
        return;
    }
    
    // Default: run basic tests
    const tester = new ComputerUseAgentTester();
    await tester.runTests();
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled Promise Rejection:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
}

export { ComputerUseAgentTester, performanceTest, integrationTest };