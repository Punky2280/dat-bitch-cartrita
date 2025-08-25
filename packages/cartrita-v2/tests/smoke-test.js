/**
 * Cartrita V2 - Smoke Test
 * Basic functionality verification
 */

const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

class CartritaSmokeTest {
    constructor() {
        this.baseUrl = 'http://localhost:8001';
        this.pythonUrl = 'http://localhost:8002';
        this.serverProcess = null;
        this.testResults = [];
    }
    
    async runTests() {
        console.log('🧪 Starting Cartrita V2 Smoke Tests\n');
        
        try {
            // Start server in background
            await this.startServer();
            
            // Wait for server to be ready
            await this.waitForServer();
            
            // Run tests
            await this.testRootEndpoint();
            await this.testHealthEndpoint();
            await this.testChatEndpoint();
            await this.testAgentStatus();
            await this.testMetricsEndpoint();
            
            // Test Python backend if available
            await this.testPythonBackend();
            
            // Print results
            this.printResults();
            
        } catch (error) {
            console.error('❌ Smoke test failed:', error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
    
    async startServer() {
        console.log('🚀 Starting Cartrita V2 server...');
        
        return new Promise((resolve, reject) => {
            const serverScript = path.join(__dirname, '../src/index-hybrid.js');
            
            this.serverProcess = spawn('node', [serverScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                    PORT: '8001',
                    ENABLE_PYTHON_AGENTS: 'true',
                    ENABLE_NODE_AGENTS: 'true'
                }
            });
            
            let startupOutput = '';
            
            this.serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                startupOutput += output;
                
                if (output.includes('Server ready for requests')) {
                    console.log('✅ Server started successfully');
                    resolve();
                }
            });
            
            this.serverProcess.stderr.on('data', (data) => {
                const error = data.toString();
                if (!error.includes('WARNING') && !error.includes('deprecated')) {
                    console.error('Server error:', error);
                }
            });
            
            this.serverProcess.on('error', (error) => {
                reject(new Error(`Failed to start server: ${error.message}`));
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (!startupOutput.includes('Server ready for requests')) {
                    reject(new Error('Server startup timeout'));
                }
            }, 30000);
        });
    }
    
    async waitForServer() {
        console.log('⏳ Waiting for server to be ready...');
        
        for (let i = 0; i < 30; i++) {
            try {
                const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
                if (response.status === 200) {
                    console.log('✅ Server is ready');
                    return;
                }
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        throw new Error('Server failed to become ready');
    }
    
    async testRootEndpoint() {
        const testName = 'Root Endpoint';
        console.log(`🧪 Testing ${testName}...`);
        
        try {
            const response = await axios.get(`${this.baseUrl}/`);
            
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(response.data.message, 'Should have message');
            this.assert(response.data.version === '2.0.0', 'Should have correct version');
            this.assert(response.data.architecture === 'hybrid', 'Should be hybrid architecture');
            
            this.testResults.push({ name: testName, status: 'PASS' });
            console.log('✅ Root endpoint test passed');
            
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            console.error(`❌ ${testName} failed:`, error.message);
        }
    }
    
    async testHealthEndpoint() {
        const testName = 'Health Endpoint';
        console.log(`🧪 Testing ${testName}...`);
        
        try {
            const response = await axios.get(`${this.baseUrl}/health`);
            
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(response.data.status === 'healthy', 'Should be healthy');
            this.assert(response.data.orchestrator, 'Should have orchestrator status');
            this.assert(response.data.database, 'Should have database status');
            
            this.testResults.push({ name: testName, status: 'PASS' });
            console.log('✅ Health endpoint test passed');
            
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            console.error(`❌ ${testName} failed:`, error.message);
        }
    }
    
    async testChatEndpoint() {
        const testName = 'Chat Endpoint';
        console.log(`🧪 Testing ${testName}...`);
        
        try {
            const response = await axios.post(`${this.baseUrl}/api/v2/chat`, {
                message: 'Hello, this is a test message',
                user_id: 'smoke_test_user',
                priority: 'low'
            });
            
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(response.data.success !== undefined, 'Should have success field');
            this.assert(response.data.orchestrator_metadata, 'Should have orchestrator metadata');
            
            this.testResults.push({ name: testName, status: 'PASS' });
            console.log('✅ Chat endpoint test passed');
            
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            console.error(`❌ ${testName} failed:`, error.message);
        }
    }
    
    async testAgentStatus() {
        const testName = 'Agent Status';
        console.log(`🧪 Testing ${testName}...`);
        
        try {
            const response = await axios.get(`${this.baseUrl}/api/v2/agents/status`);
            
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(response.data.success, 'Should be successful');
            this.assert(response.data.orchestrator, 'Should have orchestrator info');
            this.assert(response.data.backends, 'Should have backend info');
            
            this.testResults.push({ name: testName, status: 'PASS' });
            console.log('✅ Agent status test passed');
            
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            console.error(`❌ ${testName} failed:`, error.message);
        }
    }
    
    async testMetricsEndpoint() {
        const testName = 'Metrics Endpoint';
        console.log(`🧪 Testing ${testName}...`);
        
        try {
            const response = await axios.get(`${this.baseUrl}/api/v2/metrics`);
            
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(response.data.success, 'Should be successful');
            this.assert(response.data.metrics, 'Should have metrics');
            this.assert(response.data.metrics.system, 'Should have system metrics');
            
            this.testResults.push({ name: testName, status: 'PASS' });
            console.log('✅ Metrics endpoint test passed');
            
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            console.error(`❌ ${testName} failed:`, error.message);
        }
    }
    
    async testPythonBackend() {
        const testName = 'Python Backend';
        console.log(`🧪 Testing ${testName}...`);
        
        try {
            // Try to reach Python backend directly
            const response = await axios.get(`${this.pythonUrl}/health`, { timeout: 5000 });
            
            this.assert(response.status === 200, 'Python backend should be healthy');
            this.assert(response.data.success, 'Should be successful');
            
            this.testResults.push({ name: testName, status: 'PASS' });
            console.log('✅ Python backend test passed');
            
        } catch (error) {
            this.testResults.push({ 
                name: testName, 
                status: 'WARN', 
                error: 'Python backend not available (expected in some environments)' 
            });
            console.log('⚠️ Python backend not available (this may be expected)');
        }
    }
    
    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }
    
    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        
        let passCount = 0;
        let failCount = 0;
        let warnCount = 0;
        
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : 
                          result.status === 'FAIL' ? '❌' : '⚠️';
            
            console.log(`${status} ${result.name}: ${result.status}`);
            
            if (result.error && result.status === 'FAIL') {
                console.log(`   Error: ${result.error}`);
            }
            
            if (result.status === 'PASS') passCount++;
            else if (result.status === 'FAIL') failCount++;
            else warnCount++;
        });
        
        console.log('\n📈 Summary:');
        console.log(`   Passed: ${passCount}`);
        console.log(`   Failed: ${failCount}`);
        console.log(`   Warnings: ${warnCount}`);
        
        if (failCount === 0) {
            console.log('\n🎉 All critical tests passed! Cartrita V2 is working correctly.');
        } else {
            console.log('\n💥 Some tests failed. Please check the errors above.');
            process.exit(1);
        }
    }
    
    async cleanup() {
        console.log('\n🧹 Cleaning up...');
        
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM');
            
            // Give it time to shutdown gracefully
            await new Promise(resolve => {
                const timeout = setTimeout(() => {
                    this.serverProcess.kill('SIGKILL');
                    resolve();
                }, 5000);
                
                this.serverProcess.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
        }
        
        console.log('✅ Cleanup completed');
    }
}

// Run tests if called directly
if (require.main === module) {
    const smokeTest = new CartritaSmokeTest();
    smokeTest.runTests().catch(error => {
        console.error('❌ Smoke test suite failed:', error);
        process.exit(1);
    });
}

module.exports = CartritaSmokeTest;