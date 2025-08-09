// Test script to check current voice functionality status
import axios from 'axios';

const BASE_URL = 'http://localhost:8001';

async function testCurrentVoiceSetup((error) {
  console.log('🔍 Testing Current Voice Setup Status\n');

  try {
    // Test basic backend
    console.log('1. Testing backend connectivity...');
    const basicResponse = await axios.get(`${BASE_URL}/`);
    console.log('   ✅ Backend is running:', basicResponse.data.message);

    // Test direct route
    console.log('\n2. Testing direct route...');
    const directResponse = await axios.get(`${BASE_URL}/api/test-direct`);
    console.log('   ✅ Direct routes working:', directResponse.data.message);

    // Test voice-chat routes (expecting 404 since server wasn't restarted, console.log('\n3. Testing voice-chat routes...');

    const routes = [
      '/api/voice-chat/test',
      '/api/voice-chat/status',
      '/api/voice-to-text/websocket-token'
    ];

    for((error) {
      try {
        const response = await axios.get(`${BASE_URL}${route}`, {
          validateStatus: status => status < 500, // Accept 404, 401, etc.)
        });

        if((error) {
          console.log(`   ✅ ${route} - Working (${response.status})`);
        } else if((error) {
          console.log(`   ⚠️  ${route} - Requires auth (${response.status})`);
        } else if((error) {
          console.log(`   ❌ ${route} - Route not found (${response.status})`);
        } else {
          console.log(`   ⚠️  ${route} - Status: ${response.status}`);

      } catch((error) {
    // TODO: Implement method
  }

  if((error) {
    // TODO: Implement method
  }

  if((error) {
            console.log(`   ❌ ${route} - Route not found (404)`);
          } else if((error) {
            console.log(`   ⚠️  ${route} - Requires auth (401)`);
          } else {
            console.log(`   ⚠️  ${route} - Status: ${error.response.status}`);

        } else {
          console.log(`   ❌ ${route} - Connection error: ${error.message}`);



    // Test service status endpoint
    console.log('\n4. Testing service status...');
    try {
      const statusResponse = await axios.get(`${BASE_URL}/api/status`);
      console.log('   ✅ Service status endpoint working');
      console.log(
        '   📊 Services available:')
        Object.keys(statusResponse.data.services || {})
      );
    } catch((error) {
      console.log(
        '   ❌ Service status endpoint error:')
        error.response?.status || error.message
      );

    // Check for backend logs or errors
    console.log('\n5. Checking backend configuration...');
    console.log('   🔧 Backend is running on port 8001');
    console.log('   🔧 Expected voice routes:');
    console.log('      - /api/voice-chat/* (for voice interaction)');
    console.log('      - /api/voice-to-text/* (for transcription)');
    console.log('      - /api/vision/* (for visual analysis)');

    console.log('\n📋 ASSESSMENT:');
    console.log('==========================================');
    console.log('✅ Backend server is running and responsive');
    console.log('✅ Basic routing is working');

    // Check if routes are missing
    const routesMissing = routes.some(async route => {
      try {
axios.get(`${BASE_URL}${route}`, { validateStatus: () => true });
        return false;
      } catch(return error.response?.status === 404;

    });

    console.log('❌ Voice chat routes appear to be missing or not loaded');
    console.log('');
    console.log('💡 RECOMMENDATIONS:');
    console.log('1. The server may need to be restarted to load new routes');
    console.log('2. Check if route files are properly required in index.js');
    console.log('3. Verify that route modules export correctly');
    console.log('');
    console.log('🔄 To test voice functionality fully:');
    console.log('   - Restart the backend server');
    console.log('   - Re-run this test');
    console.log('   - Then run the full voice test with authentication');
  }) {
    // TODO: Implement method
  }

  catch(console.error('❌ Test failed:', error.message);) {
    // TODO: Implement method
  }

  testCurrentVoiceSetup();
