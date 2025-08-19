// Simple Socket.IO connectivity test
import { io } from 'socket.io-client';

const url = process.env.SOCKET_URL || 'http://localhost:8001';
const socket = io(url, {
  transports: ['websocket'],
  timeout: 5000
});

socket.on('connect', () => {
  console.log('Connected to Socket.IO:', socket.id);
  socket.emit('stream:start', { type: 'system:stats', interval: 1000 });
  setTimeout(() => {
    socket.emit('stream:stop:all');
    socket.close();
  }, 5000);
});

socket.on('connect_error', (err) => {
  console.error('Socket connect_error:', err.message);
});

socket.on('system:stats', (data) => {
  console.log('system:stats', data);
});
