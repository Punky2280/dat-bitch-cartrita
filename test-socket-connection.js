#!/usr/bin/env node
import { io } from 'socket.io-client';

const TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsIm5hbWUiOiJUZXN0IFVzZXIiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE3NTQ2NDI5NzgsImV4cCI6MTc1NDcyOTM3OH0.s0ZPHegztJXSH3hj3DrAHcEtFpy_gtcnmc4BTs9GWx4";
const SOCKET_URL = 'http://localhost:8001';

console.log('🔌 Testing Socket.IO connection to:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'],
  withCredentials: true,
  timeout: 30000,
  forceNew: true,
  auth: {
    token: TEST_TOKEN
  }
});

socket.on('connect', () => {
  console.log('✅ Connected! Socket ID:', socket.id);
  
  // Test sending a message
  console.log('📤 Sending test message...');
  socket.emit('user_message', {
    text: 'Hello Cartrita, can you hear me?',
    timestamp: new Date().toISOString(),
    language: 'en'
  });
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

socket.on('agent_response', (data) => {
  console.log('📨 Received response from Cartrita:');
  console.log('   Text:', data.text);
  console.log('   Model:', data.model);
  console.log('   Response Time:', data.responseTime, 'ms');
  
  // Disconnect after receiving response
  console.log('✅ Test successful! Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

socket.on('typing', () => {
  console.log('⌨️  Cartrita is typing...');
});

socket.on('error', (error) => {
  console.error('🚨 Socket error:', error);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - disconnecting');
  socket.disconnect();
  process.exit(1);
}, 30000);