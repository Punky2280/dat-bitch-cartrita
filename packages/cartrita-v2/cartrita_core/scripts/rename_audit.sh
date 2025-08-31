#!/usr/bin/env bash
set -e

# Check for legacy branding in actual source code (not in our own audit scripts)
LEGACY=$(grep -R -n "cartridges-v2\|Cartridges V2\|cartridge registry" packages/backend/src packages/frontend/src 2>/dev/null || true)
if [ -n "$LEGACY" ]; then
echo "ERROR: Legacy branding strings remain in source code:"
echo "$LEGACY"
exit 1
fi

# Check for proper Cartrita branding in supervisor
CARTRITA_CHECK=$(grep -R "Cartrita" packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js 2>/dev/null || true)
if [ -z "$CARTRITA_CHECK" ]; then
echo "WARN: Cartrita branding not found in supervisor agent"
fi

# Check for any remaining old brand references in config files
OLD_BRAND=$(grep -R "dat-bitch-cartrita" package*.json 2>/dev/null | grep -v "name.*dat-bitch-cartrita" || true)
if [ -n "$OLD_BRAND" ]; then
echo "INFO: Repository name references found (expected):"
echo "$OLD_BRAND"
fi

echo "✅ Branding clean (Cartrita only)."