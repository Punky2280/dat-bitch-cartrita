#!/usr/bin/env node

// Simple WebSocket health monitoring test
import { io } from 'socket.io-client';

console.log('🔗 Testing WebSocket health monitoring connection...');

const socket = io('http://localhost:8001/health', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjI3LCJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwicm9sZSI6InVzZXIiLCJpc19hZG1pbiI6ZmFsc2UsImlzcyI6ImNhcnRyaXRhLWF1dGgiLCJhdWQiOiJjYXJ0cml0YS1jbGllbnRzIiwiaWF0IjoxNzU1Mjc3Nzk2LCJleHAiOjE3NTUzNjQxOTZ9.czaVJqczv3PFbVKf5n_-uL7MLJHhoXdwDHZaaUZxtNE'
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ Connected to health monitoring WebSocket');
  console.log('📊 Socket ID:', socket.id);
});

socket.on('health-update', (data) => {
  console.log('📊 Health update received:', {
    timestamp: data.timestamp,
    cpu: data.system?.cpu_usage?.toFixed(1) + '%',
    memory: data.system?.memory_usage_percent?.toFixed(1) + '%',
    connections: data.database?.active_connections,
    uptime: Math.round(data.system?.uptime_seconds / 60) + 'm'
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

// Keep alive for 30 seconds
setTimeout(() => {
  console.log('⏰ Test completed, disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 30000);

console.log('⏳ Waiting for health updates (30 seconds)...');