import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split large vendor libs into separate chunks for better caching
          if (id.includes('node_modules')) {
            if (id.includes('react-player')) {
              return 'vendor-react-player';
            }
            if (id.includes('three') || id.includes('3d-force-graph')) {
              return 'vendor-3d';
            }
            if (id.includes('linkify')) {
              return 'vendor-linkify';
            }
            if (id.includes('dompurify')) {
              return 'vendor-dompurify';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: {
      host: 'localhost'
      // Let Vite automatically use the same port as the server
    },
    proxy: {
      '/api': { 
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8001', 
        changeOrigin: true,
        secure: false,
        timeout: 60000
      },
      // Enhanced WebSocket proxy configuration
      '/socket.io': { 
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8001',
        ws: true,
        changeOrigin: true,
        secure: false,
        timeout: 60000,
        // Add headers for better WebSocket support
        headers: {
          'Connection': 'upgrade',
          'Upgrade': 'websocket'
        },
        // Configure WebSocket proxy error handling
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
});
