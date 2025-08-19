#!/bin/bash

# Quick installation script for migration dependencies
# Works around workspace installation issues

set -e

log() {
    echo -e "\033[0;32m[install]:\033[0m $1"
}

warn() {
    echo -e "\033[1;33m[install]:\033[0m $1"
}

error() {
    echo -e "\033[0;31m[install]:\033[0m $1"
    exit 1
}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log "Creating node_modules directory..."
    mkdir -p node_modules/.bin
fi

# Install pg directly
if [ ! -d "node_modules/pg" ]; then
    log "Installing pg (PostgreSQL client)..."
    curl -s https://registry.npmjs.org/pg/-/pg-8.12.0.tgz | tar -xz -C node_modules/ --strip-components=1 --exclude="package" pg
fi

# Install tsx directly  
if [ ! -d "node_modules/tsx" ]; then
    log "Installing tsx (TypeScript execution)..."
    curl -s https://registry.npmjs.org/tsx/-/tsx-4.19.1.tgz | tar -xz -C node_modules/ --strip-components=1 --exclude="package" tsx
fi

# Create simple tsx wrapper
cat > node_modules/.bin/tsx << 'EOF'
#!/usr/bin/env node

// Simple tsx wrapper for TypeScript execution
const { spawn } = require('child_process');
const path = require('path');

// Use node with --loader for TypeScript support
const args = [
  '--loader', 'ts-node/esm',
  ...process.argv.slice(2)
];

const child = spawn('node', args, {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
EOF

chmod +x node_modules/.bin/tsx

log "Migration dependencies installed successfully"
log "Available commands:"
log "  npm run db:migrate      # Run database migrations"
log "  npm run v2:migrate      # Full v1 to v2 migration"
log "  ./migrate-v1-to-v2.sh   # Direct migration script"