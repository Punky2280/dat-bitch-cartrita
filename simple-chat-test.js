#!/usr/bin/env node
import { io } from 'socket.io-client';

const TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsIm5hbWUiOiJUZXN0IFVzZXIiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE3NTQ2NDI5NzgsImV4cCI6MTc1NDcyOTM3OH0.s0ZPHegztJXSH3hj3DrAHcEtFpy_gtcnmc4BTs9GWx4";

console.log('🔌 Connecting to Cartrita chat...');

const socket = io('http://localhost:8001', {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  timeout: 10000,
  auth: { token: TEST_TOKEN }
});

socket.on('connect', () => {
  console.log('✅ Connected to chat server');
  
  setTimeout(() => {
    console.log('📤 Sending simple message...');
    socket.emit('user_message', {
      text: 'Hi there!',
      timestamp: new Date().toISOString(),
      language: 'en'
    });
  }, 1000);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('agent_response', (data) => {
  console.log('✅ GOT RESPONSE FROM CARTRITA:');
  console.log('   Text:', data.text.substring(0, 100) + '...');
  console.log('   Response time:', data.responseTime, 'ms');
  console.log('   Model:', data.model);
  
  socket.disconnect();
  process.exit(0);
});

socket.on('typing', ({ isTyping }) => {
  if (isTyping) {
    console.log('⌨️  Cartrita is thinking...');
  } else {
    console.log('✋ Cartrita finished thinking');
  }
});

socket.on('error', (error) => {
  console.error('🚨 Chat error:', error);
  socket.disconnect();
  process.exit(1);
});

// Auto-exit after 15 seconds
setTimeout(() => {
  console.log('⏰ Timeout - exiting');
  socket.disconnect();
  process.exit(1);
}, 15000);