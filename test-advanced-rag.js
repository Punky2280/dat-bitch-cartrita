#!/usr/bin/env node

/**
 * Advanced RAG Pipeline Test Suite
 * Tests Task 13 implementation with comprehensive validation
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8001/api/knowledge';

// Test configuration
const TEST_CONFIG = {
  credentials: process.env.TEST_AUTH_TOKEN || null,
  testQueries: [
    {
      query: "What are the best practices for Node.js development?",
      intent: "question",
      expectedFeatures: ["multi-stage retrieval", "reasoning", "sources"]
    },
    {
      query: "How do I implement authentication in Express?",
      intent: "procedural",
      expectedFeatures: ["step-by-step", "code examples", "security"]
    },
    {
      query: "Tell me about database optimization techniques",
      intent: "exploration",
      expectedFeatures: ["comprehensive", "multiple approaches", "trade-offs"]
    }
  ]
};

class AdvancedRAGTester {
  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (TEST_CONFIG.credentials) {
      this.headers['Authorization'] = `Bearer ${TEST_CONFIG.credentials}`;
    }
    
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      details: []
    };
  }

  async runTest(name, testFn) {
    this.results.total++;
    console.log(`\n🔬 Testing: ${name}`);
    
    try {
      const result = await testFn();
      if (result.success) {
        this.results.passed++;
        console.log(`✅ ${name} - PASSED`);
        if (result.details) console.log(`   ${result.details}`);
      } else {
        this.results.failed++;
        console.log(`❌ ${name} - FAILED: ${result.error}`);
      }
      this.results.details.push({ name, ...result });
    } catch (error) {
      this.results.failed++;
      console.log(`❌ ${name} - ERROR: ${error.message}`);
      this.results.details.push({ name, success: false, error: error.message });
    }
  }

  async testKnowledgeHubStatus() {
    return this.runTest('Knowledge Hub Status', async () => {
      const response = await fetch(`${BASE_URL}/`, {
        headers: this.headers
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      
      // Validate response structure
      const required = ['success', 'service', 'status', 'version', 'advancedRAG'];
      const missing = required.filter(field => !(field in data));
      
      if (missing.length > 0) {
        return { success: false, error: `Missing fields: ${missing.join(', ')}` };
      }
      
      if (data.version !== '3.1') {
        return { success: false, error: `Expected version 3.1, got ${data.version}` };
      }
      
      return { 
        success: true, 
        details: `Status: ${data.status}, Advanced RAG: ${data.advancedRAG.status}` 
      };
    });
  }

  async testRAGMetrics() {
    return this.runTest('RAG Metrics Endpoint', async () => {
      const response = await fetch(`${BASE_URL}/rag-metrics`, {
        headers: this.headers
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      
      if (data.success && data.metrics) {
        const expectedMetrics = ['totalQueries', 'avgResponseTime', 'avgConfidenceScore'];
        const hasMetrics = expectedMetrics.every(metric => 
          metric in data.metrics || data.metrics.totalQueries === 0
        );
        
        if (!hasMetrics) {
          return { success: false, error: 'Missing expected metrics' };
        }
        
        return { 
          success: true, 
          details: `Queries: ${data.metrics.totalQueries}, Success Rate: ${(data.metrics.successRate * 100).toFixed(1)}%` 
        };
      }
      
      return { success: false, error: 'Invalid metrics response' };
    });
  }

  async testAdvancedRAGQuery() {
    return this.runTest('Advanced RAG Query Processing', async () => {
      const testQuery = TEST_CONFIG.testQueries[0];
      
      const response = await fetch(`${BASE_URL}/advanced-rag`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          query: testQuery.query,
          options: {
            temperature: 0.3,
            maxTokens: 1000
          }
        })
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      
      if (!data.success) {
        return { success: false, error: data.error || 'RAG processing failed' };
      }
      
      // Validate response structure
      const expectedFields = ['response', 'confidence', 'sources', 'processingTime'];
      const missingFields = expectedFields.filter(field => !(field in data));
      
      if (missingFields.length > 0) {
        return { success: false, error: `Missing fields: ${missingFields.join(', ')}` };
      }
      
      // Validate response quality
      if (!data.response || data.response.length < 50) {
        return { success: false, error: 'Response too short or empty' };
      }
      
      if (data.confidence < 0 || data.confidence > 1) {
        return { success: false, error: `Invalid confidence score: ${data.confidence}` };
      }
      
      return { 
        success: true, 
        details: `Confidence: ${data.confidence}, Sources: ${data.sources?.length || 0}, Time: ${data.processingTime}ms` 
      };
    });
  }

  async testRAGConfiguration() {
    return this.runTest('RAG Configuration Update', async () => {
      const newConfig = {
        retrieval: {
          finalDocuments: 3,
          semanticThreshold: 0.8
        },
        generation: {
          temperature: 0.1,
          enableCoT: false
        }
      };
      
      const response = await fetch(`${BASE_URL}/rag-config`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ config: newConfig })
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      
      if (!data.success) {
        return { success: false, error: data.error || 'Config update failed' };
      }
      
      // Verify configuration was applied
      if (data.newConfig?.retrieval?.finalDocuments !== 3) {
        return { success: false, error: 'Configuration not properly applied' };
      }
      
      return { 
        success: true, 
        details: `Final docs: ${data.newConfig.retrieval.finalDocuments}, CoT: ${data.newConfig.generation.enableCoT}` 
      };
    });
  }

  async testConversationMemory() {
    return this.runTest('Conversation Memory Management', async () => {
      // First, make a query to establish memory
      const firstQuery = await fetch(`${BASE_URL}/advanced-rag`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          query: "What is Node.js?",
          options: {}
        })
      });
      
      if (!firstQuery.ok) {
        return { success: false, error: 'Failed to establish conversation memory' };
      }
      
      // Clear the memory
      const clearResponse = await fetch(`${BASE_URL}/rag-memory`, {
        method: 'DELETE',
        headers: this.headers
      });
      
      if (!clearResponse.ok) {
        return { success: false, error: `HTTP ${clearResponse.status}` };
      }
      
      const data = await clearResponse.json();
      
      if (!data.success) {
        return { success: false, error: data.error || 'Memory clear failed' };
      }
      
      return { 
        success: true, 
        details: 'Memory cleared successfully' 
      };
    });
  }

  async testErrorHandling() {
    return this.runTest('Error Handling', async () => {
      // Test with invalid query
      const response = await fetch(`${BASE_URL}/advanced-rag`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({}) // Missing query
      });
      
      if (response.ok) {
        return { success: false, error: 'Should have failed with missing query' };
      }
      
      if (response.status !== 400) {
        return { success: false, error: `Expected 400, got ${response.status}` };
      }
      
      const data = await response.json();
      
      if (!data.error) {
        return { success: false, error: 'Missing error message' };
      }
      
      return { 
        success: true, 
        details: `Properly handled 400 error: ${data.error}` 
      };
    });
  }

  async runAllTests() {
    console.log('🧠 Advanced RAG Pipeline Test Suite');
    console.log('=====================================');
    console.log(`Testing against: ${BASE_URL}`);
    
    if (!TEST_CONFIG.credentials) {
      console.log('⚠️  No auth token provided - some tests may fail');
    }

    // Run all tests
    await this.testKnowledgeHubStatus();
    await this.testRAGMetrics();
    await this.testAdvancedRAGQuery();
    await this.testRAGConfiguration();
    await this.testConversationMemory();
    await this.testErrorHandling();

    // Print summary
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.details
        .filter(test => !test.success)
        .forEach(test => console.log(`   - ${test.name}: ${test.error}`));
    }

    return {
      passed: this.results.passed === this.results.total,
      summary: this.results
    };
  }
}

// Run tests if called directly
if (process.argv[1].endsWith('test-advanced-rag.js')) {
  const tester = new AdvancedRAGTester();
  
  tester.runAllTests()
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export default AdvancedRAGTester;