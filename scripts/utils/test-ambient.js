// Test script to check if ambient mode is working
const { io } = require('socket.io-client');
// const fs = require('fs');

console.log('Testing ambient mode...');

// Create a test socket connection
const socket = io('http://localhost:8000/ambient', {
  auth: {
    token: 'test-token', // You'll need a valid token
  },
});

socket.on('connect', () => {
  console.log('Connected to ambient namespace');

  // Test sending some audio data
  const testAudioData = Buffer.from('test audio data');
  socket.emit('audio_stream', testAudioData);
  console.log('Sent test audio data');

  // Test sending video frame
  const testVideoData = Buffer.from('fake video frame data');
  socket.emit('video_frame', testVideoData);
  console.log('Sent test video frame');
});

socket.on('connect_error', error => {
  console.error('Connection error:', error);
});

socket.on('proactive_response', data => {
  console.log('Received proactive response:', data);
});

socket.on('visual_analysis', data => {
  console.log('Received visual analysis:', data);
});

// Keep the script running for a few seconds
setTimeout(() => {
  socket.disconnect();
  console.log('Test completed');
  process.exit(0);
}, 5000);
