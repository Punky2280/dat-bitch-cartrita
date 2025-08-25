#!/usr/bin/env node

/**
 * Enhanced Cartrita Backend Server Startup Script
 * Starts the full backend server with all enhancements from 60-task implementation
 */

console.log('🚀 Starting Enhanced Cartrita Backend Server...');
console.log('📋 60-Task Implementation: Tasks 1-7 Enhanced');
console.log('🔒 Security: Rate limiting, helmet, input validation active');
console.log(
  '🔧 Features: Security dashboard, Knowledge hub, Life OS, Settings'
);
console.log('');

// Import and start the enhanced server
import('./src/server.js')
  .then(() => {
    console.log('✅ Enhanced backend server started successfully');
    console.log('🌐 Available endpoints:');
    console.log('  - Security: /api/security/*');
    console.log('  - Knowledge Hub: /api/knowledge/*');
    console.log('  - Life OS: /api/lifeos/*');
    console.log('  - Settings: /api/settings/*');
    console.log('  - Health: /health, /api/health');
    console.log('');
    console.log(
      '📊 Progress: 7/60 tasks implemented (Security, Knowledge Hub, Life OS, Settings)'
    );
  })
  .catch(error => {
    console.error('❌ Failed to start enhanced backend server:', error);
    process.exit(1);
  });
