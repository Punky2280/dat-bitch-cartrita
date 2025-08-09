// Test script for voice permission functionality
// Run this in browser console to test media permissions

console.log('🧪 Starting Voice Permission Test Suite...');

// Test 1: Check media API availability
function testMediaAPIAvailability() {
  console.log('\n📋 Test 1: Media API Availability');

  if (!navigator.mediaDevices) {
    console.error('❌ navigator.mediaDevices not available');
    return false;
  }

  if (!navigator.mediaDevices.getUserMedia) {
    console.error('❌ getUserMedia not available');
    return false;
  }

  console.log('✅ Media APIs available');
  return true;
}

// Test 2: Check permissions
async function testPermissions() {
  console.log('\n📋 Test 2: Permission Status');

  try {
    const micPermission = await navigator.permissions.query({
      name: 'microphone',
    });
    const cameraPermission = await navigator.permissions.query({
      name: 'camera',
    });

    console.log(`🎤 Microphone permission: ${micPermission.state}`);
    console.log(`📹 Camera permission: ${cameraPermission.state}`);

    return {
      microphone: micPermission.state,
      camera: cameraPermission.state,
    };
  } catch (error) {
    console.warn(
      '⚠️ Could not check permissions (this is normal in some browsers)'
    );
    return null;
  }
}

// Test 3: Test microphone access
async function testMicrophoneAccess() {
  console.log('\n📋 Test 3: Microphone Access');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        sampleRate: 44100,
      },
    });

    console.log('✅ Microphone access granted');
    console.log(`🎤 Audio tracks: ${stream.getAudioTracks().length}`);

    // Test audio analysis
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach((track, index) => {
      console.log(
        `   Track ${index}: ${track.label} - enabled: ${track.enabled}, state: ${track.readyState}`
      );
    });

    // Clean up
    stream.getTracks().forEach(track => track.stop());

    return true;
  } catch (error) {
    console.error(
      `❌ Microphone access failed: ${error.name} - ${error.message}`
    );
    return false;
  }
}

// Test 4: Test camera access
async function testCameraAccess() {
  console.log('\n📋 Test 4: Camera Access');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 15, min: 10 },
      },
    });

    console.log('✅ Camera access granted');
    console.log(`📹 Video tracks: ${stream.getVideoTracks().length}`);

    // Test video track info
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach((track, index) => {
      const settings = track.getSettings();
      console.log(
        `   Track ${index}: ${track.label} - ${settings.width}x${settings.height}@${settings.frameRate}fps`
      );
    });

    // Clean up
    stream.getTracks().forEach(track => track.stop());

    return true;
  } catch (error) {
    console.error(`❌ Camera access failed: ${error.name} - ${error.message}`);
    return false;
  }
}

// Test 5: Test combined access
async function testCombinedAccess() {
  console.log('\n📋 Test 5: Combined Access (Microphone + Camera)');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        sampleRate: 44100,
      },
      video: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 15, min: 10 },
      },
    });

    console.log('✅ Combined access granted');
    console.log(
      `🎬 Total tracks: ${stream.getTracks().length} (${
        stream.getAudioTracks().length
      } audio, ${stream.getVideoTracks().length} video)`
    );

    // Clean up
    stream.getTracks().forEach(track => track.stop());

    return true;
  } catch (error) {
    console.error(
      `❌ Combined access failed: ${error.name} - ${error.message}`
    );
    return false;
  }
}

// Test 6: Test MediaRecorder support
function testMediaRecorderSupport() {
  console.log('\n📋 Test 6: MediaRecorder Support');

  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];

  let supportedType = null;

  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`✅ Supported: ${type}`);
      if (!supportedType) supportedType = type;
    } else {
      console.log(`❌ Not supported: ${type}`);
    }
  }

  if (supportedType) {
    console.log(`🎯 Best supported type: ${supportedType}`);
    return supportedType;
  } else {
    console.error('❌ No supported audio MIME types found');
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running comprehensive voice permission tests...');

  const results = {
    apiAvailable: testMediaAPIAvailability(),
    permissions: await testPermissions(),
    microphoneAccess: await testMicrophoneAccess(),
    cameraAccess: await testCameraAccess(),
    combinedAccess: await testCombinedAccess(),
    mediaRecorderSupport: testMediaRecorderSupport(),
  };

  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`API Available: ${results.apiAvailable ? '✅' : '❌'}`);
  console.log(`Microphone Access: ${results.microphoneAccess ? '✅' : '❌'}`);
  console.log(`Camera Access: ${results.cameraAccess ? '✅' : '❌'}`);
  console.log(`Combined Access: ${results.combinedAccess ? '✅' : '❌'}`);
  console.log(
    `MediaRecorder Support: ${results.mediaRecorderSupport ? '✅' : '❌'}`
  );

  if (results.permissions) {
    console.log(`Microphone Permission: ${results.permissions.microphone}`);
    console.log(`Camera Permission: ${results.permissions.camera}`);
  }

  const allPassed =
    results.apiAvailable &&
    results.microphoneAccess &&
    results.mediaRecorderSupport;

  if (allPassed) {
    console.log('\n🎉 All core tests passed! Voice functionality should work.');
  } else {
    console.log('\n⚠️ Some tests failed. Voice functionality may have issues.');
  }

  return results;
}

// Export for use
if (typeof window !== 'undefined') {
  window.testVoicePermissions = runAllTests;
  console.log(
    '\n💡 You can run this test suite by calling: testVoicePermissions()'
  );
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && window.location) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testMicrophoneAccess,
  testCameraAccess,
  testMediaRecorderSupport,
};
