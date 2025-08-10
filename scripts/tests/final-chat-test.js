#!/usr/bin/env node
import { io } from 'socket.io-client';

// Create a user first and get token
async function createUserAndTest() {
  try {
    console.log('1️⃣ Creating test user...');
    const registerResponse = await fetch('http://localhost:8001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User Final', 
        email: `test-final-${Date.now()}@example.com`, 
        password: 'password123'
      })
    });
    
    const userData = await registerResponse.json();
    console.log('✅ User created:', userData.user.email);
    
    const token = userData.token;
    console.log('2️⃣ Connecting to chat with token...');
    
    const socket = io('http://localhost:8001', {
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('✅ Connected! Socket ID:', socket.id);
      
      // Wait a moment, then send message
      setTimeout(() => {
        console.log('3️⃣ Sending test message...');
        socket.emit('user_message', {
          text: 'Hello Cartrita, this is a test!',
          timestamp: new Date().toISOString(),
          language: 'en'
        });
      }, 2000);
    });

    socket.on('agent_response', (data) => {
      console.log('🎉 SUCCESS! Got response from Cartrita:');
      console.log('   Text:', data.text);
      console.log('   Response time:', data.responseTime, 'ms');
      socket.disconnect();
      process.exit(0);
    });

    socket.on('typing', (data) => {
      if (data.isTyping) {
        console.log('⌨️  Cartrita is thinking...');
      } else {
        console.log('✋ Cartrita stopped thinking');
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      socket.disconnect();
      process.exit(1);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      process.exit(1);
    });

    setTimeout(() => {
      console.log('⏰ Test timeout - no response after 20 seconds');
      socket.disconnect();
      process.exit(1);
    }, 20000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

createUserAndTest();