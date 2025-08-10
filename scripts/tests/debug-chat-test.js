#!/usr/bin/env node
import { io } from 'socket.io-client';

async function debugChatTest() {
  console.log('🔍 Debug Chat Test - Creating user and testing full flow...');
  
  try {
    // Create user
    const registerResponse = await fetch('http://localhost:8001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Debug User', 
        email: `debug-${Date.now()}@example.com`, 
        password: 'password123'
      })
    });
    
    const userData = await registerResponse.json();
    const token = userData.token;
    
    console.log('✅ User created with token');
    
    const socket = io('http://localhost:8001', {
      transports: ['websocket'],
      auth: { token },
      timeout: 30000
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      
      setTimeout(() => {
        console.log('📤 Sending message: "What is 2 + 2?"');
        socket.emit('user_message', {
          text: 'What is 2 + 2?',
          timestamp: new Date().toISOString(),
          language: 'en'
        });
      }, 3000);
    });

    socket.on('agent_response', (data) => {
      console.log('🎉 CARTRITA RESPONDED:');
      console.log('   Text:', data.text);
      console.log('   Model:', data.model);
      console.log('   Response Time:', data.responseTime);
      console.log('   Tools Used:', data.tools_used);
      socket.disconnect();
      process.exit(0);
    });

    socket.on('typing', (data) => {
      console.log('⌨️  Typing status:', data.isTyping ? 'THINKING...' : 'STOPPED');
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error received:', JSON.stringify(error, null, 2));
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection failed:', error.message);
      process.exit(1);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
    });

    // Extended timeout for this test
    setTimeout(() => {
      console.log('⏰ Test timeout after 45 seconds');
      socket.disconnect();
      process.exit(1);
    }, 45000);
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    process.exit(1);
  }
}

debugChatTest();