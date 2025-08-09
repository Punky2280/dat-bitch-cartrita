// Quick API Endpoint Diagnostic Script
// Run in browser console to test all endpoints

console.log('🔍 Testing API Endpoints...');

const API_BASE = 'http://localhost:8001';

// Get auth token from localStorage
const getToken = () => localStorage.getItem('authToken') || 'test-token';

// Test endpoints
const endpoints = [
  { name: 'User Profile', url: `${API_BASE}/api/user/me`, method: 'GET' },
  { name: 'Settings', url: `${API_BASE}/api/settings`, method: 'GET' },
  { name: 'Chat History', url: `${API_BASE}/api/chat/history`, method: 'GET' },
  {
    name: 'Voice Transcribe',
    url: `${API_BASE}/api/voice-to-text/transcribe`,
    method: 'POST',
  },
];

async function testEndpoint(endpoint) {
  try {
    const options = {
      method: endpoint.method,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    };

    // Add dummy body for POST requests
    if (endpoint.method === 'POST') {
      options.body = JSON.stringify({ test: true });
    }

    const response = await fetch(endpoint.url, options);

    return {
      name: endpoint.name,
      url: endpoint.url,
      status: response.status,
      ok: response.ok,
      message: response.ok ? 'Success' : `Error ${response.status}`,
    };
  } catch (error) {
    return {
      name: endpoint.name,
      url: endpoint.url,
      status: 'FAIL',
      ok: false,
      message: error.message,
    };
  }
}

async function testAllEndpoints() {
  console.log('🚀 Testing all API endpoints...\n');

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    const status = result.ok ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.message}`);
    console.log(`   URL: ${result.url}`);
    if (!result.ok) {
      console.log(`   Status: ${result.status}`);
    }
    console.log('');
  }

  console.log('🔐 Auth Token:', getToken().substring(0, 20) + '...');
  console.log('📡 Backend URL:', API_BASE);
}

// Auto-run
testAllEndpoints();

// Export for manual use
if (typeof window !== 'undefined') {
  window.testAPI = testAllEndpoints;
}
