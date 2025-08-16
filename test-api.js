#!/usr/bin/env node

// Simple API test script to verify backend functionality
import fetch from 'node-fetch';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001';

async function testEndpoint(path, options = {}) {
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, options);
    const data = await response.json().catch(() => null);
    return {
      path,
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    return {
      path,
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🧪 Running API Tests...\n');
  
  const tests = [
    { path: '/health', description: 'Health Check' },
    { path: '/api/health', description: 'API Health Check' },
    { path: '/api/user/preferences', description: 'Preferences (should be unauthorized)' },
    { path: '/api/vault/status', description: 'Vault Status (should be unauthorized)' },
    { path: '/api/monitoring/health', description: 'Monitoring Health' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`Testing ${test.description}...`);
    const result = await testEndpoint(test.path);
    
    if (result.status === 0) {
      console.log(`  ❌ FAILED: ${result.error}\n`);
      failed++;
    } else if (test.path.includes('/user/') || test.path.includes('/vault/')) {
      // These should be unauthorized (401)
      if (result.status === 401) {
        console.log(`  ✅ PASS: Properly unauthorized (${result.status})\n`);
        passed++;
      } else {
        console.log(`  ❌ FAILED: Expected 401 but got ${result.status}\n`);
        failed++;
      }
    } else if (result.ok) {
      console.log(`  ✅ PASS: ${result.status}\n`);
      passed++;
    } else {
      console.log(`  ❌ FAILED: ${result.status} - ${JSON.stringify(result.data)}\n`);
      failed++;
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! API is functioning correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please check the issues above.');
    process.exit(1);
  }
}

runTests().catch(console.error);
