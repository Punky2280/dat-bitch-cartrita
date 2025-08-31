#!/bin/bash

echo "==============================================="
echo "🚀 Cartrita V2 API Route Migration"
echo "==============================================="
echo "This script migrates all non-versioned API routes to /api/v2/* pattern"
echo ""

# Check if we're in the correct directory
if [[ ! -f "packages/backend/src/server.js" ]]; then
    echo "❌ Error: Must be run from root directory with packages/backend/src/server.js"
    exit 1
fi

BACKEND_SERVER="packages/backend/src/server.js"
FRONTEND_DIR="packages/frontend/src"

echo "📋 Step 1: Backing up current server.js..."
cp "$BACKEND_SERVER" "${BACKEND_SERVER}.backup"
echo "✅ Backup created: ${BACKEND_SERVER}.backup"

echo ""
echo "📋 Step 2: Migrating backend routes..."

# Create a sed script to replace all non-versioned API routes with v2 versions
# Preserve the route structure but add v2 prefix

# Replace '/api/ with '/api/v2/ for all route definitions
sed -i "s|app\.\(get\|post\|put\|delete\|patch\)('/api/|app.\1('/api/v2/|g" "$BACKEND_SERVER"

echo "✅ Backend routes migrated to /api/v2/* pattern"

# Count how many routes were migrated
MIGRATED_COUNT=$(grep -c "app\.\(get\|post\|put\|delete\|patch\)('/api/v2/" "$BACKEND_SERVER")
echo "📊 Migrated $MIGRATED_COUNT routes to /api/v2/* pattern"

echo ""
echo "📋 Step 3: Frontend API call migration..."

# Find all frontend files that might have API calls
FRONTEND_FILES=$(find "$FRONTEND_DIR" -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" 2>/dev/null)

if [[ -n "$FRONTEND_FILES" ]]; then
    echo "🔍 Scanning frontend files for API calls..."
    
    # Create backup directory for frontend files
    mkdir -p "${FRONTEND_DIR}/.api-migration-backups"
    
    # Counter for frontend changes
    FRONTEND_CHANGES=0
    
    for file in $FRONTEND_FILES; do
        # Check if file contains API calls
        if grep -q "fetch.*['\"]\/api\/" "$file" || grep -q "axios.*['\"]\/api\/" "$file" || grep -q "['\"]\/api\/" "$file"; then
            # Create backup
            cp "$file" "${FRONTEND_DIR}/.api-migration-backups/$(basename "$file").backup"
            
            # Replace API calls
            sed -i "s|['\"]\/api\/|'/api/v2/|g" "$file"
            sed -i 's|"/api/|"/api/v2/|g' "$file"
            
            FRONTEND_CHANGES=$((FRONTEND_CHANGES + 1))
            echo "✅ Updated: $file"
        fi
    done
    
    echo "📊 Updated $FRONTEND_CHANGES frontend files"
else
    echo "⚠️  No frontend files found - skipping frontend migration"
fi

echo ""
echo "📋 Step 4: Validation..."

# Check if migration was successful
NEW_ROUTES=$(grep -c "app\.\(get\|post\|put\|delete\|patch\)('/api/v2/" "$BACKEND_SERVER")
OLD_ROUTES=$(grep -c "app\.\(get\|post\|put\|delete\|patch\)('/api/[^v]" "$BACKEND_SERVER")

echo "📊 Validation Results:"
echo "   ✅ New /api/v2/* routes: $NEW_ROUTES"
echo "   🔍 Remaining non-versioned routes: $OLD_ROUTES"

if [[ $OLD_ROUTES -gt 0 ]]; then
    echo ""
    echo "⚠️  Warning: Some non-versioned routes remain:"
    grep "app\.\(get\|post\|put\|delete\|patch\)('/api/[^v]" "$BACKEND_SERVER" | head -5
    echo "   (showing first 5 - check manually)"
fi

echo ""
echo "📋 Step 5: Testing server startup..."

# Quick syntax validation
if node -c "$BACKEND_SERVER" >/dev/null 2>&1; then
    echo "✅ Server.js syntax validation passed"
else
    echo "❌ Server.js syntax error detected!"
    echo "🔄 Restoring from backup..."
    cp "${BACKEND_SERVER}.backup" "$BACKEND_SERVER"
    echo "❌ Migration failed - backup restored"
    exit 1
fi

echo ""
echo "🎉 V2 API Route Migration Complete!"
echo ""
echo "📋 Summary:"
echo "   • Migrated $NEW_ROUTES backend routes to /api/v2/*"
echo "   • Updated $FRONTEND_CHANGES frontend files"
echo "   • Backup available: ${BACKEND_SERVER}.backup"
echo ""
echo "🔄 Next Steps:"
echo "   1. Run 'make audit-v1' to verify migration"
echo "   2. Run 'make test' to ensure functionality"
echo "   3. Update any remaining hardcoded endpoints"
echo "   4. Remove backup files when satisfied"
echo ""
echo "==============================================="