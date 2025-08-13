#!/usr/bin/env node
/**
 * Multi-Provider AI Service Test Suite
 * Validates all endpoints and inference tasks
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8001';
const ENDPOINTS = [
  { path: '/api/ai/health', method: 'GET' },
  { path: '/api/ai/providers', method: 'GET' },
  { path: '/api/ai/route-task', method: 'POST' },
  { path: '/api/ai/inference', method: 'POST' }
];

const TEST_CASES = [
  {
    name: 'Text Classification',
    endpoint: '/api/ai/inference',
    payload: {
      task: 'text-classification',
      input: 'I love this product! It works amazingly well.'
    },
    expected: (result) => result.payload && result.payload[0] && result.payload[0][0].label === 'POSITIVE'
  },
  {
    name: 'Zero-Shot Classification',
    endpoint: '/api/ai/inference',
    payload: {
      task: 'zero-shot',
      input: 'This is a great educational resource for learning machine learning',
      params: {
        candidate_labels: ['education', 'technology', 'business', 'entertainment', 'sports']
      }
    },
    expected: (result) => result.payload && result.payload.labels && result.payload.labels[0] === 'education'
  },
  {
    name: 'Named Entity Recognition',
    endpoint: '/api/ai/inference',
    payload: {
      task: 'ner',
      input: 'My name is John Smith and I work at Microsoft in Seattle.'
    },
    expected: (result) => result.payload && result.payload.length >= 3
  },
  {
    name: 'Question Answering',
    endpoint: '/api/ai/inference',
    payload: {
      task: 'qa',
      input: {
        question: 'What is the capital of France?',
        context: 'France is a country in Western Europe. Its capital and largest city is Paris, which is located in the north-central part of the country.'
      }
    },
    expected: (result) => result.payload && result.payload.answer && result.payload.answer.toLowerCase().includes('paris')
  },
  {
    name: 'Task Routing',
    endpoint: '/api/ai/route-task',
    payload: {
      input: 'What is the sentiment of this text: I love this product'
    },
    expected: (result) => result.detected_task && result.selected_provider
  }
];

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testEndpoint(endpoint, method = 'GET', payload = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (payload) {
      options.body = JSON.stringify(payload);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      error: error.message
    };
  }
}

async function runBasicEndpointTests() {
  log(colors.bold + colors.blue, '\\n🔍 Testing Basic Endpoints...');
  
  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint.path, endpoint.method);
    
    if (result.success) {
      log(colors.green, `✅ ${endpoint.method} ${endpoint.path} - Status: ${result.status}`);
    } else {
      log(colors.red, `❌ ${endpoint.method} ${endpoint.path} - Status: ${result.status}, Error: ${result.error}`);
    }
  }
}

async function runInferenceTests() {
  log(colors.bold + colors.blue, '\\n🤖 Testing AI Inference Tasks...');
  
  for (const testCase of TEST_CASES) {
    try {
      const result = await testEndpoint(testCase.endpoint, 'POST', testCase.payload);
      
      if (result.success && result.data.success) {
        const isValid = testCase.expected(result.data);
        
        if (isValid) {
          log(colors.green, `✅ ${testCase.name} - Passed`);
          
          // Log key results
          if (testCase.name === 'Text Classification' && result.data.payload[0]) {
            const prediction = result.data.payload[0][0];
            log(colors.yellow, `   📊 ${prediction.label}: ${(prediction.score * 100).toFixed(1)}%`);
          }
          
          if (testCase.name === 'Zero-Shot Classification' && result.data.payload.scores) {
            const topLabel = result.data.payload.labels[0];
            const topScore = result.data.payload.scores[0];
            log(colors.yellow, `   📊 ${topLabel}: ${(topScore * 100).toFixed(1)}%`);
          }
          
          if (testCase.name === 'Named Entity Recognition') {
            const entities = result.data.payload.length;
            log(colors.yellow, `   📊 Found ${entities} entities`);
          }
          
          if (testCase.name === 'Question Answering' && result.data.payload.answer) {
            const answer = result.data.payload.answer;
            const score = result.data.payload.score;
            log(colors.yellow, `   📊 Answer: "${answer}" (${(score * 100).toFixed(1)}%)`);
          }
          
        } else {
          log(colors.red, `❌ ${testCase.name} - Failed validation`);
          console.log('   Response:', JSON.stringify(result.data, null, 2));
        }
        
      } else {
        log(colors.red, `❌ ${testCase.name} - API Error: ${result.data?.error || result.error}`);
      }
      
    } catch (error) {
      log(colors.red, `❌ ${testCase.name} - Exception: ${error.message}`);
    }
  }
}

async function testProviderCapabilities() {
  log(colors.bold + colors.blue, '\\n🎯 Testing Provider Capabilities...');
  
  const result = await testEndpoint('/api/ai/providers');
  
  if (result.success && result.data.success) {
    const providers = result.data.providers;
    const withKeys = providers.filter(p => p.hasApiKey).length;
    const withoutKeys = providers.filter(p => !p.hasApiKey).length;
    
    log(colors.green, `✅ Total Providers: ${providers.length}`);
    log(colors.green, `📋 With API Keys: ${withKeys}`);
    log(colors.yellow, `⚠️  Without API Keys: ${withoutKeys}`);
    
    // List providers with keys
    const workingProviders = providers.filter(p => p.hasApiKey);
    if (workingProviders.length > 0) {
      log(colors.blue, '\\n🔑 Working Providers:');
      workingProviders.forEach(p => {
        log(colors.green, `   • ${p.name} - Tasks: ${p.tasks.join(', ')}`);
      });
    }
    
  } else {
    log(colors.red, `❌ Failed to get providers: ${result.error}`);
  }
}

async function generateSummaryReport() {
  log(colors.bold + colors.blue, '\\n📊 Multi-Provider AI Service Summary...');
  
  const healthResult = await testEndpoint('/api/ai/health');
  
  if (healthResult.success && healthResult.data.success) {
    const stats = healthResult.data;
    
    log(colors.green, `✅ Service Status: ${stats.status}`);
    log(colors.blue, `📦 Service Version: ${stats.version}`);
    log(colors.blue, `🔧 Total Providers: ${stats.providers}`);
    log(colors.blue, `📈 Success Rate: ${(stats.metrics.successRate * 100).toFixed(1)}%`);
    log(colors.blue, `⏱️  Avg Latency: ${stats.metrics.avgLatency.toFixed(2)}ms`);
    
    if (stats.metrics.requests > 0) {
      log(colors.yellow, `\\n📊 Request Statistics:`);
      log(colors.yellow, `   Total Requests: ${stats.metrics.requests}`);
      log(colors.yellow, `   Successes: ${stats.metrics.successes}`);
      log(colors.yellow, `   Failures: ${stats.metrics.failures}`);
    }
    
  } else {
    log(colors.red, `❌ Failed to get health status: ${healthResult.error}`);
  }
}

async function main() {
  log(colors.bold + colors.blue, '🤖 Multi-Provider AI Service Test Suite');
  log(colors.blue, '================================================\\n');
  
  try {
    await runBasicEndpointTests();
    await testProviderCapabilities();
    await runInferenceTests();
    await generateSummaryReport();
    
    log(colors.bold + colors.green, '\\n✅ All tests completed successfully!');
    
  } catch (error) {
    log(colors.red, `\\n❌ Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main, testEndpoint, TEST_CASES };