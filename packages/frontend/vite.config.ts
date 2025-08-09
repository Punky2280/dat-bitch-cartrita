import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': { 
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8001', 
        changeOrigin: true 
      },
      '/socket.io': { 
        target: process.env.VITE_BACKEND_URL?.replace('http', 'ws') || 'ws://localhost:8001', 
        ws: true 
      },
    },
  },
});
