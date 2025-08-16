#!/usr/bin/env node

// Debug authentication middleware
import express from 'express';
import authenticateToken from './packages/backend/src/middleware/authenticateToken.js';

const app = express();
const port = 9999;

// Test endpoint using the same middleware
app.get('/test-auth', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    user: req.user
  });
});

app.listen(port, () => {
  console.log(`🧪 Debug server running on port ${port}`);
});

console.log('Testing permanent tokens...');

const permanentTokens = [
  'cartrita-media-2025-permanent-token-v1',
  'cartrita-media-fallback-token',
  'cartrita-permanent-media-access',
  'media-token-never-expires'
];

// Test each token with actual HTTP requests
import fetch from 'node-fetch';

setTimeout(async () => {
  for (const token of permanentTokens) {
    try {
      console.log(`\n🔑 Testing token: ${token}`);
      
      const response = await fetch(`http://localhost:${port}/test-auth`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Token accepted:', result.user?.name);
      } else {
        const error = await response.json();
        console.log('❌ Token rejected:', response.status, error);
      }
    } catch (error) {
      console.error('❌ Request failed:', error.message);
    }
  }
  
  process.exit(0);
}, 2000);