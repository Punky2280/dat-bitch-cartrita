#!/usr/bin/env node

// Test permanent token authentication
import request from 'supertest';
import express from 'express';
import authenticateToken from './packages/backend/src/middleware/authenticateToken.js';

const app = express();

// Test middleware with a simple protected route
app.get('/test-auth', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    user: req.user,
    message: 'Authentication successful' 
  });
});

console.log('🧪 Testing permanent token authentication...');

// Test permanent media tokens
const permanentTokens = [
  'cartrita-media-2025-permanent-token-v1',
  'cartrita-media-fallback-token',
  'cartrita-permanent-media-access',
  'media-token-never-expires'
];

async function testPermanentTokens() {
  for (const token of permanentTokens) {
    try {
      console.log(`\n🔑 Testing token: ${token}`);
      
      const response = await request(app)
        .get('/test-auth')
        .set('Authorization', `Bearer ${token}`);
      
      if (response.status === 200) {
        console.log('✅ Token accepted:', response.body.user.name);
        console.log('📋 User scope:', response.body.user.scope);
      } else {
        console.log('❌ Token rejected:', response.status, response.body);
      }
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }
}

// Test invalid token
async function testInvalidToken() {
  try {
    console.log(`\n🔑 Testing invalid token...`);
    
    const response = await request(app)
      .get('/test-auth')
      .set('Authorization', `Bearer invalid-token-12345`);
    
    if (response.status === 403) {
      console.log('✅ Invalid token correctly rejected');
    } else {
      console.log('❌ Invalid token unexpectedly accepted:', response.status);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test no token
async function testNoToken() {
  try {
    console.log(`\n🔑 Testing no token...`);
    
    const response = await request(app)
      .get('/test-auth');
    
    if (response.status === 401) {
      console.log('✅ No token correctly rejected');
    } else {
      console.log('❌ No token unexpectedly accepted:', response.status);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

await testPermanentTokens();
await testInvalidToken();
await testNoToken();

console.log('\n🎯 Permanent token authentication test completed.');