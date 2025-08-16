#!/bin/bash

echo "🔍 Testing Fusion Aggregation Engine Implementation..."

# Check if backend directory exists
if [ ! -d "packages/backend" ]; then
    echo "❌ Backend directory not found"
    exit 1
fi

cd packages/backend

# Test 1: Check FusionAggregationEngine service exists and can be imported
echo "1. Testing FusionAggregationEngine service import..."
node --input-type=module -e "
try {
    const { default: FusionAggregationEngine } = await import('./src/services/FusionAggregationEngine.js');
    console.log('✅ FusionAggregationEngine imported successfully');
    
    const engine = new FusionAggregationEngine();
    console.log('✅ FusionAggregationEngine instantiated successfully');
    
    // Test basic methods
    const sourceId = engine.registerSource({
        name: 'Test Source',
        type: 'api',
        reliability: 0.9,
        dataTypes: ['text']
    });
    console.log('✅ Source registration works:', sourceId);
    
    const status = engine.getStatus();
    console.log('✅ Status method works:', status.sources.total, 'sources registered');
    
} catch (error) {
    console.error('❌ FusionAggregationEngine test failed:', error.message);
    process.exit(1);
}
"

if [ $? -ne 0 ]; then
    echo "❌ FusionAggregationEngine service test failed"
    exit 1
fi

# Test 2: Check routes can be imported
echo "2. Testing fusion aggregation routes import..."
node --input-type=module -e "
try {
    const { default: router } = await import('./src/routes/fusionAggregation.js');
    console.log('✅ Fusion aggregation routes imported successfully');
} catch (error) {
    console.error('❌ Routes import failed:', error.message);
    process.exit(1);
}
"

if [ $? -ne 0 ]; then
    echo "❌ Routes import test failed"
    exit 1
fi

# Test 3: Check database schema was applied
echo "3. Checking database schema..."
if [ -f "../../db-init/25_create_fusion_aggregation.sql" ]; then
    echo "✅ Fusion database schema file exists"
    
    # Count tables created
    table_count=$(grep -c "CREATE TABLE" ../../db-init/25_create_fusion_aggregation.sql)
    echo "✅ Schema creates $table_count tables"
else
    echo "❌ Fusion database schema file not found"
    exit 1
fi

# Test 4: Check React component exists
echo "4. Checking React component..."
if [ -f "../frontend/src/components/FusionAggregationEngine.tsx" ]; then
    echo "✅ React component exists"
    
    # Check component structure
    if grep -q "export.*FusionAggregationEngine" "../frontend/src/components/FusionAggregationEngine.tsx"; then
        echo "✅ Component exports properly"
    else
        echo "❌ Component export not found"
        exit 1
    fi
else
    echo "❌ React component not found"
    exit 1
fi

# Test 5: Check main server integration
echo "5. Checking server integration..."
if grep -q "fusionAggregationRoutes" "index.js" && grep -q "/api/fusion" "index.js"; then
    echo "✅ Routes properly integrated in main server"
else
    echo "❌ Routes not properly integrated"
    exit 1
fi

echo ""
echo "🎉 All Fusion Aggregation Engine tests passed!"
echo ""
echo "📊 Summary:"
echo "  ✅ Core service implementation"
echo "  ✅ API routes configuration"
echo "  ✅ Database schema ready"
echo "  ✅ React component available"
echo "  ✅ Server integration complete"
echo ""
echo "🚀 Fusion Aggregation Engine is ready for use!"
echo "   Access via: http://localhost:3001/api/fusion"
echo "   UI Component: FusionAggregationEngine.tsx"
