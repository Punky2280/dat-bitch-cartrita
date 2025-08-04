#!/bin/bash
echo "🧹 Cleaning up directory structure..."

# Backend cleanup
cd packages/backend
echo "📁 Reorganizing backend..."

# AGI files
if [ -d "src/agi/consciousness/scripts/scripts" ]; then
    mkdir -p src/agi/consciousness
    cp -r src/agi/consciousness/scripts/scripts/* src/agi/consciousness/ 2>/dev/null || true
    rm -rf src/agi/consciousness/scripts 2>/dev/null || true
fi

if [ -d "src/agi/ethics/scripts/scripts" ]; then
    mkdir -p src/agi/ethics
    cp -r src/agi/ethics/scripts/scripts/* src/agi/ethics/ 2>/dev/null || true
    rm -rf src/agi/ethics/scripts 2>/dev/null || true
fi

if [ -d "src/agi/memory/scripts/scripts" ]; then
    mkdir -p src/agi/memory
    cp -r src/agi/memory/scripts/scripts/* src/agi/memory/ 2>/dev/null || true
    rm -rf src/agi/memory/scripts 2>/dev/null || true
fi

if [ -d "src/agi/scripts/scripts" ]; then
    cp -r src/agi/scripts/scripts/* src/agi/ 2>/dev/null || true
    rm -rf src/agi/scripts 2>/dev/null || true
fi

if [ -d "scripts/scripts" ]; then
    cp -r scripts/scripts/* ./ 2>/dev/null || true
    rm -rf scripts 2>/dev/null || true
fi

# Frontend cleanup
cd ../frontend
echo "📁 Reorganizing frontend..."

# Components
if [ -d "src/components/scripts/scripts" ]; then
    mkdir -p src/components
    cp -r src/components/scripts/scripts/* src/components/ 2>/dev/null || true
    rm -rf src/components/scripts 2>/dev/null || true
fi

# Pages
if [ -d "src/pages/scripts/scripts" ]; then
    mkdir -p src/pages
    cp -r src/pages/scripts/scripts/* src/pages/ 2>/dev/null || true
    rm -rf src/pages/scripts 2>/dev/null || true
fi

# Context
if [ -d "src/context/scripts/scripts" ]; then
    mkdir -p src/context
    cp -r src/context/scripts/scripts/* src/context/ 2>/dev/null || true
    rm -rf src/context/scripts 2>/dev/null || true
fi

if [ -d "src/context/modules/scripts/scripts" ]; then
    mkdir -p src/context/modules
    cp -r src/context/modules/scripts/scripts/* src/context/modules/ 2>/dev/null || true
    rm -rf src/context/modules/scripts 2>/dev/null || true
fi

# Hooks
if [ -d "src/hooks/scripts/scripts" ]; then
    mkdir -p src/hooks
    cp -r src/hooks/scripts/scripts/* src/hooks/ 2>/dev/null || true
    rm -rf src/hooks/scripts 2>/dev/null || true
fi

# Utils
if [ -d "src/utils/scripts/scripts" ]; then
    mkdir -p src/utils
    cp -r src/utils/scripts/scripts/* src/utils/ 2>/dev/null || true
    rm -rf src/utils/scripts 2>/dev/null || true
fi

# Styles
if [ -d "src/styles/styles" ]; then
    mkdir -p src/styles
    cp -r src/styles/styles/* src/styles/ 2>/dev/null || true
    rm -rf src/styles/styles 2>/dev/null || true
fi

# Main src files
if [ -d "src/scripts/scripts" ]; then
    cp -r src/scripts/scripts/* src/ 2>/dev/null || true
    rm -rf src/scripts 2>/dev/null || true
fi

# Config files
if [ -d "scripts/scripts" ]; then
    cp -r scripts/scripts/* ./ 2>/dev/null || true
    rm -rf scripts 2>/dev/null || true
fi

cd ../..
echo "✅ Directory cleanup complete!"
