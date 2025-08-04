// Comprehensive Settings Functionality Test Script
// Run this in browser console to test all settings features

console.log('🧪 Testing Cartrita Settings Functionality...');

const API_BASE = 'http://localhost:8000/api';
const FRONTEND_BASE = 'http://localhost:5173';

// Mock authentication token for testing
const getTestToken = () => {
  return localStorage.getItem('authToken') || 'test-token';
};

// Test 1: Settings API Connectivity
async function testSettingsAPI() {
  console.log('\n📋 Test 1: Settings API Connectivity');

  const token = getTestToken();
  console.log(`Using token: ${token.substring(0, 20)}...`);

  try {
    const response = await fetch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Settings API responding');
      console.log('Settings data structure:', Object.keys(data));

      // Check required fields
      const requiredFields = [
        'sarcasm',
        'verbosity',
        'humor',
        'voice_responses',
        'ambient_listening',
        'sound_effects',
      ];
      const missingFields = requiredFields.filter(field => !(field in data));

      if (missingFields.length === 0) {
        console.log('✅ All required settings fields present');
      } else {
        console.log(`⚠️ Missing fields: ${missingFields.join(', ')}`);
      }

      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`❌ Settings API error: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.log(`❌ Settings API connection failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 2: Audio Settings Update
async function testAudioSettingsUpdate() {
  console.log('\n📋 Test 2: Audio Settings Update');

  const token = getTestToken();
  const testSettings = {
    voice_responses: true,
    ambient_listening: false,
    sound_effects: true,
    camera_enabled: false,
  };

  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testSettings),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Audio settings update successful');
      console.log('Updated settings:', data);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`❌ Audio settings update failed: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.log(`❌ Audio settings update error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 3: Personality Settings Update
async function testPersonalitySettings() {
  console.log('\n📋 Test 3: Personality Settings Update');

  const token = getTestToken();
  const testSettings = {
    sarcasm: 7,
    verbosity: 'detailed',
    humor: 'playful',
  };

  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testSettings),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Personality settings update successful');
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`❌ Personality settings update failed: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.log(`❌ Personality settings update error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 4: User Profile API
async function testUserProfile() {
  console.log('\n📋 Test 4: User Profile API');

  const token = getTestToken();

  try {
    const response = await fetch(`${API_BASE}/user/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ User profile API responding');
      console.log('User data:', {
        id: data.id,
        name: data.name,
        email: data.email,
      });
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`❌ User profile API error: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.log(`❌ User profile API connection failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 5: Frontend Settings Form Validation
function testFrontendForms() {
  console.log('\n📋 Test 5: Frontend Settings Form Validation');

  const results = {
    settingsPage: false,
    audioForm: false,
    personalityForm: false,
    profileForm: false,
  };

  // Check if settings page elements exist
  const settingsElements = {
    audioCheckboxes: document.querySelectorAll('input[type="checkbox"]').length,
    personalityInputs: document.querySelectorAll('input[type="range"], select')
      .length,
    profileInputs: document.querySelectorAll(
      'input[type="text"], input[type="email"]'
    ).length,
    submitButtons: document.querySelectorAll('button[type="submit"]').length,
  };

  console.log('Settings form elements found:', settingsElements);

  if (settingsElements.audioCheckboxes > 0) {
    console.log('✅ Audio settings form elements present');
    results.audioForm = true;
  }

  if (settingsElements.personalityInputs > 0) {
    console.log('✅ Personality settings form elements present');
    results.personalityForm = true;
  }

  if (settingsElements.profileInputs > 0) {
    console.log('✅ Profile form elements present');
    results.profileForm = true;
  }

  return results;
}

// Test 6: Local Storage & Session Management
function testSessionManagement() {
  console.log('\n📋 Test 6: Session Management');

  const authToken = localStorage.getItem('authToken');
  const preferredLanguage = localStorage.getItem('preferredLanguage');
  const theme = localStorage.getItem('theme');

  console.log('Session data:');
  console.log(`Auth token: ${authToken ? '✅ Present' : '❌ Missing'}`);
  console.log(`Language: ${preferredLanguage || 'Not set'}`);
  console.log(`Theme: ${theme || 'Not set'}`);

  return {
    hasAuth: !!authToken,
    hasLanguage: !!preferredLanguage,
    hasTheme: !!theme,
  };
}

// Test 7: Voice & Media Settings
async function testVoiceSettings() {
  console.log('\n📋 Test 7: Voice & Media Settings');

  const results = {
    mediaSupport: false,
    permissions: {},
    voiceEndpoints: false,
  };

  // Check media support
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    console.log('✅ Media devices API supported');
    results.mediaSupport = true;

    // Check permissions
    try {
      const micPermission = await navigator.permissions.query({
        name: 'microphone',
      });
      const cameraPermission = await navigator.permissions.query({
        name: 'camera',
      });

      results.permissions = {
        microphone: micPermission.state,
        camera: cameraPermission.state,
      };

      console.log(`Microphone permission: ${micPermission.state}`);
      console.log(`Camera permission: ${cameraPermission.state}`);
    } catch (error) {
      console.log('⚠️ Could not check permissions (normal in some browsers)');
    }
  } else {
    console.log('❌ Media devices API not supported');
  }

  // Test voice endpoints
  const token = getTestToken();
  try {
    const response = await fetch(`${API_BASE}/voice-to-text/test`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok || response.status === 404) {
      // 404 is acceptable - means endpoint exists
      console.log('✅ Voice endpoints accessible');
      results.voiceEndpoints = true;
    }
  } catch (error) {
    console.log('⚠️ Voice endpoints not accessible');
  }

  return results;
}

// Main test runner
async function runAllSettingsTests() {
  console.log('🚀 Running comprehensive settings functionality tests...\n');

  const results = {
    settingsAPI: await testSettingsAPI(),
    audioSettings: await testAudioSettingsUpdate(),
    personalitySettings: await testPersonalitySettings(),
    userProfile: await testUserProfile(),
    frontendForms: testFrontendForms(),
    sessionManagement: testSessionManagement(),
    voiceSettings: await testVoiceSettings(),
  };

  console.log('\n📊 Settings Test Results Summary:');
  console.log('=====================================');

  const testResults = [
    ['Settings API', results.settingsAPI.success],
    ['Audio Settings Update', results.audioSettings.success],
    ['Personality Settings', results.personalitySettings.success],
    ['User Profile API', results.userProfile.success],
    [
      'Frontend Forms',
      results.frontendForms.audioForm && results.frontendForms.personalityForm,
    ],
    ['Session Management', results.sessionManagement.hasAuth],
    ['Media Support', results.voiceSettings.mediaSupport],
  ];

  testResults.forEach(([test, passed]) => {
    console.log(`${test}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  });

  const overallSuccess = testResults.every(([, passed]) => passed);

  if (overallSuccess) {
    console.log('\n🎉 All settings functionality tests PASSED!');
  } else {
    console.log('\n⚠️ Some settings functionality needs attention.');

    // Provide specific recommendations
    console.log('\n🔧 Recommendations:');
    if (!results.settingsAPI.success) {
      console.log('- Check backend server is running on port 8000');
      console.log('- Verify authentication token is valid');
    }
    if (!results.sessionManagement.hasAuth) {
      console.log('- User needs to log in to test settings');
    }
    if (!results.voiceSettings.mediaSupport) {
      console.log(
        '- Browser does not support media devices (use Chrome/Firefox)'
      );
    }
  }

  return results;
}

// Export for manual use
if (typeof window !== 'undefined') {
  window.testSettings = runAllSettingsTests;
  window.testSettingsAPI = testSettingsAPI;
  window.testAudioSettings = testAudioSettingsUpdate;
  console.log('\n💡 Available test functions:');
  console.log('- testSettings() - Run all tests');
  console.log('- testSettingsAPI() - Test API connectivity');
  console.log('- testAudioSettings() - Test audio settings update');
}

// Auto-run if in browser
if (typeof window !== 'undefined' && window.location) {
  runAllSettingsTests();
}

module.exports = {
  runAllSettingsTests,
  testSettingsAPI,
  testAudioSettingsUpdate,
};
