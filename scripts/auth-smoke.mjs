#!/usr/bin/env node
/**
 * Auth Smoke Test - End-to-end authentication flow validation
 * Tests: register, login, verify, protected route, invalid token rejection
 */

import { randomBytes } from 'crypto';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8001';
const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to make HTTP requests with proper CORS headers
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Origin': ORIGIN,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { text };
  }
  
  return { response, data };
}

// Test helper
function test(name, fn) {
  return async () => {
    try {
      console.log(`🧪 Testing: ${name}`);
      await fn();
      console.log(`✅ PASS: ${name}`);
      testResults.passed++;
      testResults.tests.push({ name, status: 'PASS' });
    } catch (error) {
      console.log(`❌ FAIL: ${name} - ${error.message}`);
      testResults.failed++;
      testResults.tests.push({ name, status: 'FAIL', error: error.message });
    }
  };
}

// Generate unique test user
const testUser = {
  name: `Test User ${randomBytes(4).toString('hex')}`,
  email: `test${randomBytes(4).toString('hex')}@example.com`,
  password: 'testpass123'
};

let authToken = null;

const tests = [
  test('CORS Preflight - OPTIONS request returns proper headers', async () => {
    const { response } = await makeRequest('/api/auth/login', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });
    
    if (response.status !== 204) {
      throw new Error(`Expected 204, got ${response.status}`);
    }
    
    const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
    if (!corsOrigin) {
      throw new Error('Missing Access-Control-Allow-Origin header');
    }
  }),

  test('User Registration - Create new test user', async () => {
    const { response, data } = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });
    
    if (response.status !== 201) {
      throw new Error(`Registration failed: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    if (!data.success || !data.token) {
      throw new Error('Registration response missing success or token');
    }
    
    authToken = data.token;
  }),

  test('User Login - Authenticate with registered user', async () => {
    const { response, data } = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    
    if (response.status !== 200) {
      throw new Error(`Login failed: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    if (!data.success || !data.token) {
      throw new Error('Login response missing success or token');
    }
    
    authToken = data.token; // Update with fresh token
  }),

  test('Token Verification - Validate JWT token', async () => {
    const { response, data } = await makeRequest('/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`Token verification failed: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    if (!data.success || !data.user) {
      throw new Error('Token verification response missing success or user data');
    }
  }),

  test('Protected Route Access - Valid token should allow access', async () => {
    const { response, data } = await makeRequest('/api/models/catalog', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`Protected route access failed: ${response.status} - ${data.error || 'Unknown error'}`);
    }
    
    if (!data.success) {
      throw new Error('Protected route response missing success flag');
    }
  }),

  test('Invalid Token Rejection - Malformed token should be rejected', async () => {
    const { response, data } = await makeRequest('/api/models/catalog', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid_token_here'
      }
    });
    
    if (response.status !== 403) {
      throw new Error(`Expected 403 for invalid token, got ${response.status}`);
    }
    
    if (!data.error) {
      throw new Error('Expected error message for invalid token');
    }
  }),

  test('No Token Access - Should be rejected for protected routes', async () => {
    const { response, data } = await makeRequest('/api/models/catalog', {
      method: 'GET'
    });
    
    if (response.status !== 401 && response.status !== 403) {
      throw new Error(`Expected 401 or 403 for missing token, got ${response.status}`);
    }
  }),

  test('Login with Invalid Credentials - Should return 401', async () => {
    const { response, data } = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: 'wrongpassword'
      })
    });
    
    if (response.status !== 401) {
      throw new Error(`Expected 401 for invalid credentials, got ${response.status}`);
    }
    
    if (!data.error) {
      throw new Error('Expected error message for invalid credentials');
    }
  })
];

// Run all tests
async function runTests() {
  console.log('🚀 Starting Auth Smoke Tests...\n');
  
  for (const testFn of tests) {
    await testFn();
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Total: ${testResults.passed + testResults.failed}`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

// Handle errors and cleanup
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error.message);
  process.exit(1);
});

// Run the tests
runTests().catch(console.error);