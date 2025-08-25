#!/usr/bin/env node

/**
 * Comprehensive HuggingFace Integration Test
 * Tests all agent capabilities and API endpoints
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:8001/api/huggingface';
const AUTH_TOKEN = process.env.JWT_TOKEN || 'test-token'; // You'll need a valid token

console.log('🧪 Starting HuggingFace Integration Tests\n');
console.log('='.repeat(60));

async function testEndpoint(name, url, options = {}) {
  console.log(`\n🔬 Testing: ${name}`);
  console.log(`📡 ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Status: ${response.status}`);
      console.log(
        `📄 Success:`,
        JSON.stringify(data, null, 2).substring(0, 500) + '...'
      );
      return { success: true, data, status: response.status };
    } else {
      console.log(`❌ Status: ${response.status}`);
      console.log(`📄 Error:`, JSON.stringify(data, null, 2));
      return { success: false, data, status: response.status };
    }
  } catch (error) {
    console.log(`❌ Network Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function testTextEndpoint(taskType, text, additionalData = {}) {
  return await testEndpoint(`Text: ${taskType}`, `${BASE_URL}/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskType,
      text,
      ...additionalData,
    }),
  });
}

async function testImageEndpoint(taskType, imagePath, additionalData = {}) {
  const form = new FormData();
  form.append('taskType', taskType);

  // Add image file if it exists
  if (imagePath && fs.existsSync(imagePath)) {
    form.append('image', fs.createReadStream(imagePath));
  }

  // Add additional data
  Object.entries(additionalData).forEach(([key, value]) => {
    form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
  });

  return await testEndpoint(`Vision: ${taskType}`, `${BASE_URL}/vision`, {
    method: 'POST',
    body: form,
  });
}

async function testMultiModalEndpoint(taskType, data = {}) {
  const form = new FormData();
  form.append('taskType', taskType);

  if (data.text) form.append('text', data.text);
  if (data.question) form.append('question', data.question);
  if (data.imagePath && fs.existsSync(data.imagePath)) {
    form.append('image', fs.createReadStream(data.imagePath));
  }

  return await testEndpoint(
    `Multimodal: ${taskType}`,
    `${BASE_URL}/multimodal`,
    {
      method: 'POST',
      body: form,
    }
  );
}

async function runTests() {
  const results = {};

  // Test 1: Health Check
  results.health = await testEndpoint('Health Check', `${BASE_URL}/health`);

  // Test 2: Capabilities
  results.capabilities = await testEndpoint(
    'Get Capabilities',
    `${BASE_URL}/capabilities`
  );

  // Test 3: Available Tasks
  results.tasks = await testEndpoint('Available Tasks', `${BASE_URL}/tasks`);

  // Test 4: Text Classification
  results.textClassification = await testTextEndpoint(
    'text-classification',
    'I love this new HuggingFace integration! It works amazingly well.'
  );

  // Test 5: Text Generation
  results.textGeneration = await testTextEndpoint(
    'text-generation',
    'The future of AI is'
  );

  // Test 6: Question Answering
  results.questionAnswering = await testTextEndpoint(
    'question-answering',
    'What is the capital of France?',
    {
      context:
        'Paris is the capital and most populous city of France. It is located in northern central France.',
      question: 'What is the capital of France?',
    }
  );

  // Test 7: Summarization
  results.summarization = await testTextEndpoint(
    'summarization',
    'HuggingFace is a company that develops tools for building applications using machine learning. The company was founded in 2016 and is headquartered in New York. HuggingFace is known for its Transformers library, which provides thousands of pretrained models to perform tasks on different modalities such as text, vision, and audio. The platform allows developers to easily download and train state-of-the-art models for their applications.'
  );

  // Test 8: Zero-shot Classification
  results.zeroShotClassification = await testTextEndpoint(
    'zero-shot-classification',
    'This movie was absolutely terrible. I want my money back.',
    {
      labels: ['positive', 'negative', 'neutral'],
    }
  );

  // Test 9: Translation
  results.translation = await testTextEndpoint(
    'translation',
    'Hello, how are you today?'
  );

  // Test 10: Sentence Similarity
  results.sentenceSimilarity = await testTextEndpoint(
    'sentence-similarity',
    null,
    {
      sentences: [
        'The cat sits on the mat',
        'A cat is sitting on a rug',
        'Dogs are playing in the park',
      ],
    }
  );

  // Test 11: Data Analysis (if we have sample data)
  results.dataAnalysis = await testEndpoint(
    'Data Analysis',
    `${BASE_URL}/data`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskType: 'data-analysis',
        data: [
          { name: 'Alice', age: 25, salary: 50000, department: 'Engineering' },
          { name: 'Bob', age: 30, salary: 60000, department: 'Engineering' },
          { name: 'Charlie', age: 35, salary: 70000, department: 'Marketing' },
          { name: 'Diana', age: 28, salary: 55000, department: 'Marketing' },
          { name: 'Eve', age: 32, salary: 65000, department: 'Sales' },
        ],
      }),
    }
  );

  // Test 12: Time Series Forecasting
  results.timeSeriesForecasting = await testEndpoint(
    'Time Series Forecasting',
    `${BASE_URL}/data`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskType: 'time-series-forecasting',
        data: [
          { date: '2024-01-01', value: 100 },
          { date: '2024-01-02', value: 105 },
          { date: '2024-01-03', value: 110 },
          { date: '2024-01-04', value: 108 },
          { date: '2024-01-05', value: 115 },
          { date: '2024-01-06', value: 120 },
          { date: '2024-01-07', value: 118 },
          { date: '2024-01-08', value: 125 },
          { date: '2024-01-09', value: 130 },
          { date: '2024-01-10', value: 128 },
        ],
      }),
    }
  );

  // Create a simple test image if it doesn't exist
  const testImagePath = '/tmp/test-image.txt';
  if (!fs.existsSync(testImagePath)) {
    // Create a placeholder - in a real test, you'd use an actual image
    fs.writeFileSync(testImagePath, 'This would be image data in a real test');
  }

  // Test 13: Multimodal Analysis (with text only since we don't have real images)
  results.multiModalAnalysis = await testMultiModalEndpoint(
    'multimodal-analysis',
    {
      text: 'This is a test of the multimodal analysis system.',
      question: 'What is being tested?',
    }
  );

  // Test 14: Batch Processing
  results.batchProcessing = await testEndpoint(
    'Batch Processing',
    `${BASE_URL}/batch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: [
          {
            taskType: 'text-classification',
            inputs: { text: 'This is great!' },
            options: {},
          },
          {
            taskType: 'text-classification',
            inputs: { text: 'This is terrible.' },
            options: {},
          },
          {
            taskType: 'text-generation',
            inputs: { text: 'The weather today is' },
            options: { maxTokens: 20 },
          },
        ],
      }),
    }
  );

  // Clean up test file
  if (fs.existsSync(testImagePath)) {
    fs.unlinkSync(testImagePath);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));

  let passCount = 0;
  let totalCount = 0;

  for (const [testName, result] of Object.entries(results)) {
    totalCount++;
    if (result.success) {
      passCount++;
      console.log(`✅ ${testName}: PASSED`);
    } else {
      console.log(`❌ ${testName}: FAILED`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.status === 503) {
        console.log(
          `   Note: Service unavailable - may need HuggingFace API token`
        );
      }
      if (result.status === 401) {
        console.log(
          `   Note: Authentication failed - check JWT_TOKEN environment variable`
        );
      }
    }
  }

  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);

  if (passCount === totalCount) {
    console.log(
      '🎉 All tests passed! HuggingFace integration is working correctly.'
    );
  } else if (passCount > 0) {
    console.log('⚠️  Some tests passed. Check the setup and configuration.');
    console.log('\n📝 Setup Requirements:');
    console.log('   1. Set HUGGINGFACE_API_TOKEN in .env file');
    console.log('   2. Set JWT_TOKEN for authentication');
    console.log('   3. Ensure backend server is running on port 8001');
  } else {
    console.log('❌ All tests failed. Check the setup and configuration.');
  }

  // Additional Information
  console.log('\n📋 Test Coverage:');
  console.log('   ✓ Health and capability checks');
  console.log('   ✓ Text processing (NLP tasks)');
  console.log('   ✓ Data analysis and forecasting');
  console.log('   ✓ Multimodal processing');
  console.log('   ✓ Batch processing');

  console.log('\n🔗 API Endpoints Tested:');
  console.log('   • GET  /api/huggingface/health');
  console.log('   • GET  /api/huggingface/capabilities');
  console.log('   • GET  /api/huggingface/tasks');
  console.log('   • POST /api/huggingface/text');
  console.log('   • POST /api/huggingface/data');
  console.log('   • POST /api/huggingface/multimodal');
  console.log('   • POST /api/huggingface/batch');
}

// Enhanced error handling
process.on('uncaughtException', error => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Run tests
console.log('🚀 Make sure the backend server is running on port 8001');
console.log('🔑 Set HUGGINGFACE_API_TOKEN and JWT_TOKEN environment variables');
console.log('\nStarting tests in 3 seconds...\n');

setTimeout(() => {
  runTests().catch(console.error);
}, 3000);
