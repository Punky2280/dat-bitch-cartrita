const axios = require('axios');

const BACKEND_URL = 'http://localhost:8002';

async function testVaultAPI() {
  console.log('🔐 Testing API Key Vault System...\n');
  
  try {
    // Test backend health
    const healthResponse = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Backend health check:', healthResponse.data);
  } catch (error) {
    console.error('❌ Backend not accessible:', error.message);
    return;
  }
  
  try {
    // Register test user
    const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, {
      name: "Vault Test User",
      email: "vaulttest@cartrita.com",
      password: "testpass123"
    });
    console.log('✅ User registered, token received');
    var token = registerResponse.data.token;
  } catch (error) {
    if (error.response?.status === 400) {
      // User exists, try login
      try {
        const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
          email: "vaulttest@cartrita.com", 
          password: "testpass123"
        });
        console.log('✅ User logged in, token received');
        var token = loginResponse.data.token;
      } catch (loginError) {
        console.error('❌ Login failed:', loginError.response?.data);
        return;
      }
    } else {
      console.error('❌ Registration failed:', error.response?.data);
      return;
    }
  }
  
  // Test adding a simple API key to vault
  console.log('📝 Testing vault key creation...');
  try {
    const keyResponse = await axios.post(`${BACKEND_URL}/api/vault/credentials`, {
      provider: 'openai',
      keyName: 'Test OpenAI Key',
      credentials: {
        apiKey: 'sk-test-fake-key-for-testing-purposes-12345678901234567890'
      },
      rotation_policy: {
        intervalDays: 90,
        autoRotate: false
      },
      visibility: 'MASKED'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Key added to vault:', {
      id: keyResponse.data.id,
      provider: keyResponse.data.provider,
      maskedValue: keyResponse.data.maskedValue
    });
    
    const keyId = keyResponse.data.id;
    
    // Test key listing
    console.log('📋 Testing vault key listing...');
    const listResponse = await axios.get(`${BACKEND_URL}/api/vault/credentials`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Vault keys listed:', listResponse.data.keys?.length || 0, 'keys found');
    
    // Test key validation (will fail with fake key but tests the endpoint)
    console.log('🔍 Testing key validation...');
    try {
      const validateResponse = await axios.post(`${BACKEND_URL}/api/vault/credentials/${keyId}/validate`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Key validation result:', validateResponse.data);
    } catch (validationError) {
      console.log('⚠️  Key validation failed (expected with fake key):', validationError.response?.data?.error);
    }
    
    console.log('\n🎉 Vault system is working correctly!');
    console.log('🌐 You can now access the vault interface at: http://localhost:3000');
    console.log('📱 Navigate to: Settings → API Key Vault');
    
  } catch (error) {
    console.error('❌ Vault operation failed:', error.response?.data || error.message);
  }
}

testVaultAPI();