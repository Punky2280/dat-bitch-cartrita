import React, { useState } from 'react';

export const PermissionTester: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);
  const [isTestingPermissions, setIsTestingPermissions] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testPermissions = async () => {
    setIsTestingPermissions(true);
    setResults([]);
    addResult('🧪 Starting permission tests...');

    try {
      // Test 1: Check API availability
      addResult('📋 Step 1: Checking API availability');
      if (!navigator.mediaDevices) {
        addResult('❌ navigator.mediaDevices not available');
        return;
      }
      if (!navigator.mediaDevices.getUserMedia) {
        addResult('❌ getUserMedia not available');
        return;
      }
      addResult('✅ Media APIs available');

      // Test 2: Check current permissions
      addResult('📋 Step 2: Checking current permissions');
      try {
        const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        addResult(`🎤 Microphone permission: ${micPermission.state}`);
        addResult(`📹 Camera permission: ${cameraPermission.state}`);
      } catch (error) {
        addResult('⚠️ Could not check permissions (this is normal in some browsers)');
      }

      // Test 3: Request microphone only
      addResult('📋 Step 3: Testing microphone access');
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        addResult('✅ Microphone access granted');
        addResult(`🎤 Audio tracks: ${micStream.getAudioTracks().length}`);
        micStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        addResult(`❌ Microphone access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test 4: Request camera only
      addResult('📋 Step 4: Testing camera access');
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        addResult('✅ Camera access granted');
        addResult(`📹 Video tracks: ${videoStream.getVideoTracks().length}`);
        videoStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        addResult(`❌ Camera access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test 5: Request both
      addResult('📋 Step 5: Testing combined access (microphone + camera)');
      try {
        const combinedStream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true 
        });
        addResult('✅ Combined access granted');
        addResult(`🎬 Total tracks: ${combinedStream.getTracks().length}`);
        combinedStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        addResult(`❌ Combined access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      addResult('🎉 Permission tests completed');

    } catch (error) {
      addResult(`❌ Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingPermissions(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden z-50">
      <div className="bg-gray-700 px-4 py-2 flex justify-between items-center">
        <h3 className="text-white font-semibold text-sm">🔧 Permission Tester</h3>
        <div className="flex space-x-2">
          <button
            onClick={testPermissions}
            disabled={isTestingPermissions}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-xs rounded"
          >
            {isTestingPermissions ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={clearResults}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="p-4 max-h-80 overflow-y-auto bg-gray-900 text-xs text-gray-300">
        {results.length === 0 ? (
          <p className="text-gray-500">Click "Test" to check permissions</p>
        ) : (
          <div className="space-y-1">
            {results.map((result, index) => (
              <div key={index} className="font-mono">
                {result}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};