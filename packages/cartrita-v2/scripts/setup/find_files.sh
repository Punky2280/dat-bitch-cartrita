#!/bin/bash

# This script searches for key files related to Iteration 15: Customizable Personality.
# Run it from the root directory of your monorepo.

echo "---"
echo "🔍 Searching for the 'user_settings' database migration file..."
# Search for files in the migrations directory that contain "user_settings"
find ./packages/backend/src/db/migrations -type f \( -name "*.js" -o -name "*.sql" \) -exec grep -l "user_settings" {} +

echo "---"
echo "🔍 Searching for the backend API route file for settings..."
# Search for route files that define '/api/settings'
find ./packages/backend/src/routes -type f -name "*.js" -exec grep -l "/api/settings" {} +

echo "---"
echo "🔍 Searching for the CoreAgent AI file..."
# Search for files in the AI services directory that define the "CoreAgent" class
find ./packages/backend/src/services/ai -type f -name "*.js" -exec grep -l "class CoreAgent" {} +
echo "---"

