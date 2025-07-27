// packages/frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // This rule forwards all API requests to the backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // FIXED: This new rule specifically handles the Socket.IO connection
      // and enables the WebSocket proxy.
      '/socket.io': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
