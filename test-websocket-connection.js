#!/usr/bin/env node

import { io } from 'socket.io-client';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsIm5hbWUiOiJSb2JiaWUiLCJlbWFpbCI6InJvYmJpZW5vc2ViZXN0QGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlzX2FkbWluIjp0cnVlLCJpc3MiOiJjYXJ0cml0YS1hdXRoIiwiYXVkIjoiY2FydHJpdGEtY2xpZW50cyIsImlhdCI6MTc1NTM0NDYwMywiZXhwIjoxNzU1NDMxMDAzfQ.ebXDTDpbYHQgAvv4hlcSEHprQOg_FoWq2_lRrNDBAR0';

console.log('🔗 Testing WebSocket connection...');

const socket = io('http://localhost:8001', {
  transports: ['polling', 'websocket'],
  auth: { token },
  query: { token },
  timeout: 20000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ Connected successfully!');
  console.log('🆔 Socket ID:', socket.id);
  console.log('🚀 Transport:', socket.io.engine.transport.name);
  
  socket.emit('user_message', { text: 'Hello from test script!' });
  
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

socket.on('ai_response', (data) => {
  console.log('🤖 AI Response:', data);
});

setTimeout(() => {
  console.log('⏰ Test timeout');
  socket.disconnect();
  process.exit(1);
}, 10000);