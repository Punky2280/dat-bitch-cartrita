#!/usr/bin/env node

// Script to add all API keys from .env to the encrypted vault system
import fs from 'fs';
import axios from 'axios';

// Read environment variables
const envPath = './packages/backend/.env';
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse .env file
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const BACKEND_URL = 'http://localhost:8002';

// First, let's create a test user account or login
async function createOrLoginUser() {
  try {
    // Try to register a test user
    const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, {
      name: "Test User",
      email: "test@cartrita.com", 
      password: "testpassword123"
    });
    
    console.log('✅ User registered successfully');
    return registerResponse.data.token;
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.error?.includes('already exists')) {
      // User already exists, try to login
      try {
        const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
          email: "test@cartrita.com",
          password: "testpassword123"
        });
        
        console.log('✅ User logged in successfully');
        return loginResponse.data.token;
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

// Mapping of environment variable names to vault provider configurations
const keyMappings = {
  // AI Services
  'OPENAI_API_KEY': {
    provider: 'openai',
    keyName: 'Production OpenAI Key',
    credentials: { apiKey: envVars.OPENAI_API_KEY }
  },
  'OPENAI_FINETUNING_API_KEY': {
    provider: 'openai',
    keyName: 'OpenAI Fine-tuning Key', 
    credentials: { apiKey: envVars.OPENAI_FINETUNING_API_KEY }
  },
  'HF_TOKEN': {
    provider: 'huggingface',
    keyName: 'Hugging Face Token',
    credentials: { token: envVars.HF_TOKEN }
  },
  'DEEPGRAM_API_KEY': {
    provider: 'deepgram',
    keyName: 'Deepgram Speech API',
    credentials: { apiKey: envVars.DEEPGRAM_API_KEY }
  },
  
  // Development Tools
  'GITHUB_TOKEN': {
    provider: 'github', 
    keyName: 'GitHub Personal Token',
    credentials: { token: envVars.GITHUB_TOKEN }
  },
  
  // Google Services
  'GOOGLE_API_KEY': {
    provider: 'google',
    keyName: 'Google API Key',
    credentials: { apiKey: envVars.GOOGLE_API_KEY }
  },
  'GOOGLE_CLIENT_ID': {
    provider: 'google',
    keyName: 'Google OAuth Client',
    credentials: {
      clientId: envVars.GOOGLE_CLIENT_ID,
      clientSecret: envVars.GOOGLE_CLIENT_SECRET,
      serviceAccountEmail: envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      projectId: envVars.GOOGLE_PROJECT_ID
    }
  },
  
  // Search APIs  
  'TAVILY_API_KEY': {
    provider: 'tavily',
    keyName: 'Tavily Search API',
    credentials: { apiKey: envVars.TAVILY_API_KEY }
  },
  'SERPAPI_API_KEY': {
    provider: 'serpapi', 
    keyName: 'SerpAPI Key',
    credentials: { apiKey: envVars.SERPAPI_API_KEY }
  },
  'GNEWS_API_KEY': {
    provider: 'gnews',
    keyName: 'GNews API Key', 
    credentials: { apiKey: envVars.GNEWS_API_KEY }
  },
  
  // Other APIs
  'WOLFRAM_ALPHA_API_KEY': {
    provider: 'wolfram',
    keyName: 'Wolfram Alpha API',
    credentials: { apiKey: envVars.WOLFRAM_ALPHA_API_KEY }
  },
  'LANGCHAIN_API_KEY': {
    provider: 'langchain',
    keyName: 'LangChain API Key',
    credentials: { apiKey: envVars.LANGCHAIN_API_KEY }
  }
};

async function addKeyToVault(token, keyMapping) {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/vault/credentials`, {
      provider: keyMapping.provider,
      keyName: keyMapping.keyName,
      credentials: keyMapping.credentials,
      rotation_policy: {
        intervalDays: 90,
        autoRotate: false,
        warningDays: 7
      },
      visibility: 'MASKED'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      id: response.data.id,
      provider: keyMapping.provider,
      keyName: keyMapping.keyName
    };
  } catch (error) {
    return {
      success: false,
      provider: keyMapping.provider,
      keyName: keyMapping.keyName,
      error: error.response?.data?.error || error.message
    };
  }
}

async function validateKey(token, keyId) {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/vault/credentials/${keyId}/validate`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return {
      success: true,
      valid: response.data.valid,
      details: response.data.details,
      rateLimitRemaining: response.data.rateLimitRemaining
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

async function listVaultKeys(token) {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/vault/credentials`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data.keys || [];
  } catch (error) {
    console.error('❌ Failed to list vault keys:', error.response?.data || error.message);
    return [];
  }
}

async function main() {
  console.log('🔐 Starting API Key Vault Migration...\n');
  
  // Check if backend is running
  try {
    await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Backend server is running on port 8002\n');
  } catch (error) {
    console.error('❌ Backend server not accessible. Make sure it\'s running on port 8002');
    process.exit(1);
  }
  
  // Get authentication token
  const token = await createOrLoginUser();
  if (!token) {
    console.error('❌ Failed to authenticate. Exiting...');
    process.exit(1);
  }
  
  console.log('🔑 Adding API keys to encrypted vault...\n');
  
  const results = [];
  
  // Add each key to vault
  for (const [envKey, keyMapping] of Object.entries(keyMappings)) {
    if (!envVars[envKey] || envVars[envKey] === 'your_key_here' || envVars[envKey].includes('placeholder')) {
      console.log(`⚠️  Skipping ${envKey} - no valid value found`);
      continue;
    }
    
    console.log(`📝 Adding ${keyMapping.keyName} (${keyMapping.provider})...`);
    
    const result = await addKeyToVault(token, keyMapping);
    results.push(result);
    
    if (result.success) {
      console.log(`   ✅ Added successfully (ID: ${result.id})`);
      
      // Test the key validation
      console.log(`   🔍 Validating key...`);
      const validation = await validateKey(token, result.id);
      
      if (validation.success) {
        if (validation.valid) {
          console.log(`   ✅ Key validation: VALID`);
          if (validation.rateLimitRemaining) {
            console.log(`   📊 Rate limit remaining: ${validation.rateLimitRemaining}`);
          }
        } else {
          console.log(`   ❌ Key validation: INVALID`);
        }
      } else {
        console.log(`   ⚠️  Validation failed: ${validation.error}`);
      }
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
    }
    
    console.log(''); // Empty line for readability
  }
  
  // List all keys in vault
  console.log('📋 Current vault contents:');
  const vaultKeys = await listVaultKeys(token);
  
  if (vaultKeys.length === 0) {
    console.log('   (no keys found)');
  } else {
    vaultKeys.forEach(key => {
      console.log(`   🔑 ${key.keyName} (${key.provider}) - ${key.maskedValue || 'encrypted'}`);
    });
  }
  
  // Summary
  console.log('\n📊 Migration Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`   ✅ Successfully added: ${successful} keys`);
  console.log(`   ❌ Failed: ${failed} keys`);
  
  if (failed > 0) {
    console.log('\n❌ Failed keys:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   • ${r.keyName} (${r.provider}): ${r.error}`);
    });
  }
  
  console.log('\n🎉 Vault migration completed!');
  console.log('🌐 Access the vault interface at: http://localhost:3000/settings/api-vault');
  console.log('📚 View documentation: ./ENCRYPTED_KEY_VAULT_GUIDE.md');
}

main().catch(console.error);