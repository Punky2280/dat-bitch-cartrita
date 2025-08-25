#!/usr/bin/env node

/**
 * Test script for fine-tuning API endpoints
 * Tests all endpoints to ensure they're working correctly
 */

import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';

const BASE_URL = 'http://localhost:8001/api/fine-tuning';

// Sample training data
const sampleTrainingData = [
  {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, can you help me?' },
      {
        role: 'assistant',
        content:
          "Of course! I'm here to help. What do you need assistance with?",
      },
    ],
  },
  {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: "What's the weather like?" },
      {
        role: 'assistant',
        content:
          "I don't have access to real-time weather data, but I can help you find weather information through weather websites or apps.",
      },
    ],
  },
  {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Explain quantum computing briefly.' },
      {
        role: 'assistant',
        content:
          'Quantum computing uses quantum bits (qubits) that can exist in multiple states simultaneously, potentially solving certain problems much faster than classical computers.',
      },
    ],
  },
];

async function testEndpoint(name, url, options = {}) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`📡 ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    console.log(`✅ Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));

    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.log(`❌ Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function createTestFile() {
  const testFilePath = '/tmp/test-training-data.jsonl';
  const jsonlContent = sampleTrainingData
    .map(item => JSON.stringify(item))
    .join('\n');

  fs.writeFileSync(testFilePath, jsonlContent);
  console.log(`📁 Created test file: ${testFilePath}`);
  return testFilePath;
}

async function testFileUpload(filePath) {
  console.log(`\n🧪 Testing: File Upload`);

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('purpose', 'fine-tune');

  try {
    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: form,
    });

    const data = await response.json();
    console.log(`✅ Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));

    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.log(`❌ Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Fine-Tuning API Tests\n');
  console.log('='.repeat(50));

  const results = {};

  // Test 1: Get supported models
  results.models = await testEndpoint(
    'Get Supported Models',
    `${BASE_URL}/models`
  );

  // Test 2: Validate training data
  results.validate = await testEndpoint(
    'Validate Training Data',
    `${BASE_URL}/validate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        training_data: sampleTrainingData,
        method: 'supervised',
      }),
    }
  );

  // Test 3: Cost estimation
  results.costEstimate = await testEndpoint(
    'Cost Estimation',
    `${BASE_URL}/estimate-cost`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        training_data: sampleTrainingData,
        model: 'gpt-4o-mini',
      }),
    }
  );

  // Test 4: Get recommendations
  results.recommendations = await testEndpoint(
    'Get Hyperparameter Recommendations',
    `${BASE_URL}/recommendations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataset_size: sampleTrainingData.length,
        task_type: 'general',
      }),
    }
  );

  // Test 5: List jobs (should be empty initially)
  results.listJobs = await testEndpoint(
    'List Fine-Tuning Jobs',
    `${BASE_URL}/jobs`
  );

  // Test 6: File upload
  const testFilePath = await createTestFile();
  results.fileUpload = await testFileUpload(testFilePath);

  // If file upload was successful, test creating a job
  if (results.fileUpload.success && results.fileUpload.data.file) {
    const fileId = results.fileUpload.data.file.id;

    results.createJob = await testEndpoint(
      'Create Fine-Tuning Job',
      `${BASE_URL}/jobs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          training_file_id: fileId,
          hyperparameters: {
            n_epochs: 1,
          },
          suffix: 'test-model',
          metadata: {
            test: 'true',
            created_by: 'test-script',
          },
        }),
      }
    );

    // If job creation was successful, test getting job details
    if (results.createJob.success && results.createJob.data.job) {
      const jobId = results.createJob.data.job.id;

      results.getJob = await testEndpoint(
        'Get Job Details',
        `${BASE_URL}/jobs/${jobId}`
      );

      results.getJobEvents = await testEndpoint(
        'Get Job Events',
        `${BASE_URL}/jobs/${jobId}/events`
      );

      // Cancel the job to clean up
      results.cancelJob = await testEndpoint(
        'Cancel Job',
        `${BASE_URL}/jobs/${jobId}/cancel`,
        { method: 'POST' }
      );
    }
  }

  // Clean up test file
  fs.unlinkSync(testFilePath);
  console.log(`🗑️  Cleaned up test file: ${testFilePath}`);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(50));

  let passCount = 0;
  let totalCount = 0;

  for (const [testName, result] of Object.entries(results)) {
    totalCount++;
    if (result.success) {
      passCount++;
      console.log(`✅ ${testName}: PASSED`);
    } else {
      console.log(
        `❌ ${testName}: FAILED - ${result.error || 'Unknown error'}`
      );
    }
  }

  console.log(`\n🎯 Overall: ${passCount}/${totalCount} tests passed`);

  if (passCount === totalCount) {
    console.log('🎉 All tests passed! Fine-tuning API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
  }
}

// Run tests
runTests().catch(console.error);
