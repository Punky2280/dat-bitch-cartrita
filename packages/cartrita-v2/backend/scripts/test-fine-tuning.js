/**
 * Fine-Tuning API Test Script
 * Tests the fine-tuning integration and endpoints
 */

import '../src/loadEnv.js';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:8001/api/fine-tuning';

// Sample training data for testing
const sampleTrainingData = [
  {
    messages: [
      { role: 'user', content: 'What is machine learning?' },
      {
        role: 'assistant',
        content:
          'Machine learning is a subset of artificial intelligence (AI) that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms to analyze data, identify patterns, and make predictions or decisions.',
      },
    ],
  },
  {
    messages: [
      { role: 'user', content: 'How does supervised learning work?' },
      {
        role: 'assistant',
        content:
          'Supervised learning works by training a model on labeled data, where both input features and correct outputs are provided. The algorithm learns to map inputs to outputs, then can make predictions on new, unseen data. Common examples include classification and regression tasks.',
      },
    ],
  },
  {
    messages: [
      { role: 'user', content: 'What are neural networks?' },
      {
        role: 'assistant',
        content:
          'Neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) organized in layers that process information. Deep neural networks with multiple hidden layers are the foundation of deep learning and can solve complex pattern recognition problems.',
      },
    ],
  },
];

/**
 * Test API endpoint
 */
async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    console.log(`\n🧪 Testing ${method} ${endpoint}`);

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const result = await response.json();

    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(result, null, 2));

    return { success: response.ok, status: response.status, data: result };
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting Fine-Tuning API Tests...\n');

  const results = [];

  // Test 1: List supported models
  console.log('═══════════════════════════════════════');
  console.log('TEST 1: List Supported Models');
  console.log('═══════════════════════════════════════');
  const modelsTest = await testEndpoint('/models');
  results.push({ test: 'List Models', ...modelsTest });

  // Test 2: Validate training data
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 2: Validate Training Data');
  console.log('═══════════════════════════════════════');
  const validationTest = await testEndpoint('/validate', 'POST', {
    training_data: sampleTrainingData,
    method: 'supervised',
  });
  results.push({ test: 'Validate Data', ...validationTest });

  // Test 3: Estimate cost
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 3: Estimate Training Cost');
  console.log('═══════════════════════════════════════');
  const costTest = await testEndpoint('/estimate-cost', 'POST', {
    training_data: sampleTrainingData,
    model: 'gpt-4o-mini',
  });
  results.push({ test: 'Cost Estimation', ...costTest });

  // Test 4: Get hyperparameter recommendations
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 4: Hyperparameter Recommendations');
  console.log('═══════════════════════════════════════');
  const recommendationsTest = await testEndpoint('/recommendations', 'POST', {
    dataset_size: sampleTrainingData.length,
    task_type: 'education',
  });
  results.push({ test: 'Recommendations', ...recommendationsTest });

  // Test 5: List existing fine-tuning jobs (should work even if empty)
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 5: List Fine-Tuning Jobs');
  console.log('═══════════════════════════════════════');
  const jobsTest = await testEndpoint('/jobs?limit=5');
  results.push({ test: 'List Jobs', ...jobsTest });

  // Test 6: Test file validation with invalid data
  console.log('\n═══════════════════════════════════════');
  console.log('TEST 6: Invalid Data Validation');
  console.log('═══════════════════════════════════════');
  const invalidTest = await testEndpoint('/validate', 'POST', {
    training_data: [{ invalid: 'This should fail' }],
    method: 'supervised',
  });
  results.push({ test: 'Invalid Data Test', ...invalidTest });

  // Summary
  console.log('\n🏁 TEST SUMMARY');
  console.log('════════════════════════════════════════');

  const passed = results.filter(r => r.success).length;
  const total = results.length;

  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(
      `${status} Test ${index + 1}: ${result.test} (${result.status || 'Error'})`
    );
  });

  console.log(`\n📊 Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All fine-tuning API tests passed!');
  } else {
    console.log(
      '⚠️  Some tests failed. Check the API key configuration and server status.'
    );
  }

  return results;
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export default runTests;
