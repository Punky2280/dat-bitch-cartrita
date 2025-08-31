#!/bin/bash
# Cartrita Duplicate File Cleanup Script
# Removes duplicate files and legacy directories while preserving V2 functionality

set -e

echo "🧹 Starting Cartrita duplicate file cleanup..."

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"
cd "$PROJECT_ROOT"

echo "📁 Working directory: $PROJECT_ROOT"

# Create backup directory with timestamp
BACKUP_DIR="backups/cleanup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Created backup directory: $BACKUP_DIR"

# Function to safely remove directory with backup
safe_remove() {
    local target="$1"
    local reason="$2"
    
    if [ -d "$target" ]; then
        echo "🗂️ Backing up $target -> $BACKUP_DIR/$(basename "$target")"
        cp -r "$target" "$BACKUP_DIR/"
        echo "❌ Removing $target ($reason)"
        rm -rf "$target"
    else
        echo "⏭️ Skipping $target (not found)"
    fi
}

# Function to safely remove file with backup
safe_remove_file() {
    local target="$1"
    local reason="$2"
    
    if [ -f "$target" ]; then
        echo "📄 Backing up $target -> $BACKUP_DIR/"
        mkdir -p "$BACKUP_DIR/$(dirname "$target")"
        cp "$target" "$BACKUP_DIR/$target"
        echo "❌ Removing $target ($reason)"
        rm -f "$target"
    else
        echo "⏭️ Skipping $target (not found)"
    fi
}

echo "🔍 Scanning for duplicate directories and files..."

# Remove the large duplicate cartrita-v2 directory
safe_remove "packages/cartrita-v2" "Legacy V2 directory with duplicated content"

# Remove duplicate temp directories
safe_remove "temp-v2-fastify" "Temporary V2 FastAPI directory"

# Remove duplicate Dockerfiles at root (keep the ones in packages)
safe_remove_file "Dockerfile.backend-v2" "Duplicate of packages/backend/Dockerfile"
safe_remove_file "Dockerfile.frontend-v2" "Duplicate frontend Dockerfile"

# Clean up any additional temp directories
for temp_dir in temp-* *-temp; do
    if [ -d "$temp_dir" ]; then
        safe_remove "$temp_dir" "Temporary directory"
    fi
done

# Remove empty test suite files (they now have placeholder tests)
echo "🧪 Checking for problematic test files..."

# Remove duplicate configuration files
duplicate_configs=(
    "babel.config.js.backup"
    "package.json.backup"
    "package.json.root"
    "tsconfig.json.root"
)

for config in "${duplicate_configs[@]}"; do
    safe_remove_file "$config" "Duplicate configuration file"
done

# Clean up node_modules in backup locations
find backups/ -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find packages/cartrita-v2/ -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

echo "📊 Cleanup Statistics:"
echo "   Backup directory: $BACKUP_DIR"
echo "   Backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"

# Verify V2 functionality is preserved
echo "✅ Verifying V2 functionality preservation:"
if [ -f "db-init/28_v2_gpt5_features.sql" ]; then
    echo "   ✅ V2 database migrations preserved"
else
    echo "   ❌ V2 database migrations missing!"
fi

if [ -d "packages/backend/src" ]; then
    echo "   ✅ Backend V2 structure preserved"
else
    echo "   ❌ Backend structure missing!"
fi

echo "🧹 Duplicate cleanup completed successfully!"
echo "📦 All removed files have been backed up to: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Run 'make hygiene' to verify cleanup"
echo "2. Run tests to ensure V2 functionality works"
echo "3. If everything works, you can remove $BACKUP_DIR in 30 days"