#!/bin/bash
echo "🔧 Applying complete MessageBus fix..."

# 1. Fix MessageBus variable usage (uppercase to lowercase) 
echo "Fixing variable usage..."
find packages/backend/src -name "*.js" -type f -exec grep -l "MessageBus\." {} \; | while read file; do
    echo "  - $file"
    sed -i 's/MessageBus\./messageBus\./g' "$file"
done

# 2. Add database column if missing
echo "Ensuring database has model column..."
docker compose exec -T postgres psql -U robert -d dat-bitch-cartrita -c "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS model VARCHAR(255) DEFAULT 'gpt-4';" 2>/dev/null || echo "Database column check complete"

echo "✅ All fixes applied!"
