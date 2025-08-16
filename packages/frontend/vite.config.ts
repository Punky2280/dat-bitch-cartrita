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
            if (id.includes('react-player')) return 'vendor-react-player';
            if (id.includes('three') || id.includes('3d-force-graph')) return 'vendor-3d';
            if (id.includes('linkify')) return 'vendor-linkify';
            if (id.includes('dompurify')) return 'vendor-dompurify';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor';
          }
        },
      },
    },
    // PWA optimizations
    target: ['es2015', 'safari11'],
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    sourcemap: false,
    cssCodeSplit: true,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': { 
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8001', 
        changeOrigin: true 
      },
      // WebSocket proxy must keep HTTP(S) scheme; ws:// scheme here can break upgrade handling.
      '/socket.io': { 
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  // PWA optimizations
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@emotion/react', '@emotion/styled'],
    exclude: ['@vite/client', '@vite/env'],
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
});
