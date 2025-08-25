#!/usr/bin/env node
/**
 * Chat Test - Test WebSocket chat functionality
 */

import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:8001';

console.log('🧪 Testing WebSocket chat functionality...\n');

const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'] // Try polling first to avoid initial WebSocket errors
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log(`🔍 Socket ID: ${socket.id}\n`);
  
  // Send a test message
  console.log('📤 Sending test message: "Hello, can you hear me?"');
  socket.emit('user_message', {
    text: 'Hello, can you hear me?',
    timestamp: new Date().toISOString(),
    language: 'en'
  });
});

socket.on('connected', (data) => {
  console.log('📡 Server connection confirmation:', data);
});

socket.on('typing', () => {
  console.log('⌨️  Server is typing...');
});

socket.on('stopTyping', () => {
  console.log('✋ Server stopped typing');
});

socket.on('agent_response', (data) => {
  console.log('📨 Received response:');
  console.log(`   Text: ${data.text}`);
  console.log(`   Model: ${data.model}`);
  console.log(`   Speaker: ${data.speaker}`);
  if (data.tools_used && data.tools_used.length > 0) {
    console.log(`   Tools used: ${data.tools_used.join(', ')}`);
  }
  if (data.response_time_ms) {
    console.log(`   Response time: ${data.response_time_ms}ms`);
  }
  console.log('\n🎉 Chat test completed successfully!');
  process.exit(0);
});

socket.on('disconnect', (reason) => {
  console.log(`❌ Disconnected: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timed out - no response received');
  process.exit(1);
}, 30000);