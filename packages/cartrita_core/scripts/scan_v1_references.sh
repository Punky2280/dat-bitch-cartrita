#!/usr/bin/env bash
set -e

echo "Scanning for V1 (first edition) architecture patterns that should be V2..."

V1_ISSUES=""

# Check for non-versioned API routes in our main backend files (the big issue)
OLD_ROUTES=$(grep -r "app\\.get.*'/api/[^v]" packages/backend/src/server.js packages/backend/src/index.js 2>/dev/null || true)
if [ -n "$OLD_ROUTES" ]; then
    ROUTE_COUNT=$(echo "$OLD_ROUTES" | wc -l)
    V1_ISSUES="$V1_ISSUES\n❌ Found $ROUTE_COUNT non-versioned API routes (should be /api/v2/*):"
    V1_ISSUES="$V1_ISSUES\n   Examples: $(echo "$OLD_ROUTES" | head -3 | grep -o "'/api/[^']*'" | tr '\n' ' ')"
fi

# Check for hardcoded localhost endpoints in our source files (not docs/examples)
OUR_ENDPOINTS=$(grep -r "localhost:[0-9]*/api/[^v]" packages/backend/src packages/frontend/src 2>/dev/null | grep -v node_modules | head -5 || true)
if [ -n "$OUR_ENDPOINTS" ]; then
    V1_ISSUES="$V1_ISSUES\n❌ Hardcoded non-versioned endpoints in source:"
    V1_ISSUES="$V1_ISSUES\n   $(echo "$OUR_ENDPOINTS" | head -2)"
fi

# Check for excessive relative imports across packages (indicates poor v2 structure)
CROSS_PACKAGE_IMPORTS=$(grep -r "import.*from.*'\\.\\./\\.\\./" packages/backend/src packages/frontend/src 2>/dev/null | grep -v node_modules | head -10 || true)
if [ -n "$CROSS_PACKAGE_IMPORTS" ]; then
    IMPORT_COUNT=$(echo "$CROSS_PACKAGE_IMPORTS" | wc -l)
    if [ "$IMPORT_COUNT" -gt 20 ]; then
        V1_ISSUES="$V1_ISSUES\n⚠️  Excessive cross-package relative imports: $IMPORT_COUNT found"
        V1_ISSUES="$V1_ISSUES\n   This suggests V1 structure - consider proper package boundaries"
    fi
fi

# Check for any V1 directory structure remnants
if [ -d "packages/cartrita-v2" ]; then
    V1_ISSUES="$V1_ISSUES\n❌ V1 directory 'packages/cartrita-v2' still exists (should be integrated)"
fi

# Report findings
if [ -n "$V1_ISSUES" ]; then
    echo ""
    echo "V1 → V2 Migration Issues Found:"
    echo -e "$V1_ISSUES"
    echo ""
    echo "🔧 Migration Action Items:"
    echo "   1. Update server.js routes from '/api/*' to '/api/v2/*'"
    echo "   2. Update frontend API calls to use /api/v2/* endpoints"
    echo "   3. Clean up old cartrita-v2 directory if present"
    echo "   4. Improve package boundaries to reduce relative imports"
    exit 1
fi

echo "✅ No V1 architecture issues found - project follows V2 patterns."