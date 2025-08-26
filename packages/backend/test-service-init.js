#!/usr/bin/env node

/**
 * Quick test for the AdvancedAudioAnalyticsService initialization
 * Tests that the service starts without the Python timeout error
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing AdvancedAudioAnalyticsService initialization...\n');

// Mock environment for testing
process.env.NODE_ENV = 'test';
process.env.LIGHTWEIGHT_TEST = '1';

async function testServiceInitialization() {
    try {
        // Import the service
        const { default: AdvancedAudioAnalyticsService } = await import('./src/services/AdvancedAudioAnalyticsService.js');
        
        console.log('📦 Service imported successfully');
        
        // Create service instance
        const service = new AdvancedAudioAnalyticsService();
        console.log('🔧 Service instance created');
        
        // Test initialization without database pool (simulating missing dependencies)
        console.log('🚀 Testing initialization without HF_TOKEN...');
        await service.initialize(null);
        
        console.log('✅ Service initialized successfully in degraded mode');
        
        // Test with HF_TOKEN but no actual Python dependencies
        console.log('🚀 Testing initialization with mock HF_TOKEN...');
        process.env.HF_TOKEN = 'mock_token_for_testing';
        
        const service2 = new AdvancedAudioAnalyticsService();
        await service2.initialize(null);
        
        console.log('✅ Service initialized successfully with mock token');
        
        // Test health check
        console.log('🏥 Testing health check...');
        const health1 = await service.healthCheck();
        const health2 = await service2.healthCheck();
        
        console.log('📊 Health Check Results:');
        console.log(`   Service 1 (no token): ${health1.status}`);
        console.log(`   Service 2 (mock token): ${health2.status}`);
        console.log(`   Python Analysis 1: ${health1.local_processing.enabled}`);
        console.log(`   Python Analysis 2: ${health2.local_processing.enabled}`);
        
        console.log('\n🎉 All service initialization tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Service initialization failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

testServiceInitialization().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});