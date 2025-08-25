#!/usr/bin/env node

// Simple test script to verify vault endpoints are working
const axios = require('axios');

const BACKEND_URL = 'http://localhost:8002';

async function testBasicConnectivity() {
  console.log('🔍 Testing basic backend connectivity...\n');
  
  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    console.log('✅ Health check:', response.status, response.statusText);
    console.log('📊 Health data:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testAuthRoutes() {
  console.log('🔐 Testing authentication endpoints...\n');
  
  try {
    // Try to register
    const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, {
      name: "Vault Test User",
      email: "vaulttest@cartrita.com",
      password: "testpass123"
    }, { timeout: 10000 });
    
    console.log('✅ Registration:', registerResponse.status);
    const token = registerResponse.data.token;
    
    if (token) {
      console.log('🎫 Got auth token:', token.substring(0, 20) + '...');
      return token;
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.error?.includes('already exists')) {
      console.log('🔄 User exists, trying login...');
      
      try {
        const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
          email: "vaulttest@cartrita.com", 
          password: "testpass123"
        }, { timeout: 10000 });
        
        console.log('✅ Login successful:', loginResponse.status);
        const token = loginResponse.data.token;
        console.log('🎫 Got auth token:', token.substring(0, 20) + '...');
        return token;
      } catch (loginError) {
        console.error('❌ Login failed:', loginError.response?.data || loginError.message);
        return null;
      }
    } else {
      console.error('❌ Registration failed:', error.response?.data || error.message);
      return null;
    }
  }
}

async function testVaultEndpoints(token) {
  console.log('🏦 Testing vault endpoints...\n');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  // Test providers endpoint
  try {
    console.log('📋 Testing /api/vault/providers...');
    const providersResponse = await axios.get(`${BACKEND_URL}/api/vault/providers`, { 
      headers, 
      timeout: 10000 
    });
    console.log('✅ Providers endpoint:', providersResponse.status);
    console.log(`📊 Found ${providersResponse.data.providers?.length || 0} providers`);
  } catch (error) {
    console.error('❌ Providers endpoint failed:', error.response?.data || error.message);
  }
  
  // Test keys endpoint  
  try {
    console.log('🔑 Testing /api/vault/keys...');
    const keysResponse = await axios.get(`${BACKEND_URL}/api/vault/keys`, { 
      headers,
      timeout: 10000 
    });
    console.log('✅ Keys endpoint:', keysResponse.status);
    console.log(`🔐 Found ${keysResponse.data.keys?.length || 0} keys`);
  } catch (error) {
    console.error('❌ Keys endpoint failed:', error.response?.data || error.message);
    console.error('🐛 Error details:', error.response?.status, error.response?.statusText);
  }
}

async function testUserPreferences(token) {
  console.log('⚙️ Testing user preferences endpoint...\n');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  try {
    console.log('👤 Testing /api/user/preferences...');
    const response = await axios.get(`${BACKEND_URL}/api/user/preferences`, { 
      headers,
      timeout: 10000 
    });
    console.log('✅ User preferences:', response.status);
    console.log('📊 Preferences data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ User preferences failed:', error.response?.data || error.message);
    console.error('🐛 Status:', error.response?.status, error.response?.statusText);
  }
}

async function main() {
  console.log('🚀 Cartrita Vault Testing Tool\n');
  console.log('🎯 Target: http://localhost:8002\n');
  
  // Test basic connectivity
  const isHealthy = await testBasicConnectivity();
  if (!isHealthy) {
    console.error('❌ Backend is not accessible. Make sure it\'s running on port 8002.');
    process.exit(1);
  }
  
  // Test authentication
  const token = await testAuthRoutes();
  if (!token) {
    console.error('❌ Authentication failed. Cannot test authenticated endpoints.');
    process.exit(1);
  }
  
  // Test vault endpoints
  await testVaultEndpoints(token);
  
  // Test user preferences
  await testUserPreferences(token);
  
  console.log('\n🎉 Testing completed!');
  console.log('📝 Check logs above for any failures');
}

main().catch(error => {
  console.error('💥 Test script failed:', error.message);
  process.exit(1);
});