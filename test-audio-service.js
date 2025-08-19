// Task 16: Verification Test for AudioPostProcessingService
import AudioPostProcessingService from './packages/backend/src/services/AudioPostProcessingService.js';

async function testAudioPostProcessingService() {
  console.log('🎯 Task 16: Testing Production AudioPostProcessingService\n');

  try {
    // Test 1: Service status
    const status = AudioPostProcessingService.getStatus();
    console.log('📊 Service Status:', JSON.stringify(status, null, 2));

    // Test 2: Selection logic with various scenarios
    const testCases = [
      {
        name: 'Basic Quality Selection',
        recordings: [
          { id: 1, duration: 3.0, quality: 0.8, content: 'Test 1' },
          { id: 2, duration: 2.5, quality: 0.9, content: 'Test 2' },
          { id: 3, duration: 4.0, quality: 0.7, content: 'Test 3' }
        ],
        expected: 2
      },
      {
        name: 'Duration Preference (Equal Quality)',
        recordings: [
          { id: 1, duration: 1.0, quality: 0.8, content: 'Too short' },
          { id: 2, duration: 3.0, quality: 0.8, content: 'Optimal' },
          { id: 3, duration: 8.0, quality: 0.8, content: 'Too long' }
        ],
        expected: 2
      },
      {
        name: 'Quality Threshold Filtering',
        recordings: [
          { id: 1, duration: 3.0, quality: 0.5, content: 'Low quality' },
          { id: 2, duration: 3.0, quality: 0.6, content: 'Below threshold' },
          { id: 3, duration: 3.0, quality: 0.75, content: 'Above threshold' }
        ],
        expected: 3
      }
    ];

    let passedTests = 0;
    
    for (const testCase of testCases) {
      const selected = AudioPostProcessingService.selectBestRecording(testCase.recordings);
      
      if (selected && selected.id === testCase.expected) {
        console.log(`✅ ${testCase.name}: Selected ID ${selected.id} (PASS)`);
        passedTests++;
      } else {
        console.log(`❌ ${testCase.name}: Expected ID ${testCase.expected}, got ${selected?.id} (FAIL)`);
      }
    }

    // Test 3: Quality analysis
    console.log('\n🔍 Testing Quality Analysis:');
    const mockBuffer = Buffer.alloc(5000, 128); // 5KB buffer
    const analysis = await AudioPostProcessingService.analyzeAudioQuality(mockBuffer, {
      duration: 3.5,
      sampleRate: 16000,
      channels: 1
    });
    
    console.log('Quality Analysis Result:', {
      quality: analysis.quality,
      confidence: analysis.confidence,
      issues: analysis.issues
    });

    // Test 4: Batch processing
    console.log('\n📦 Testing Batch Processing:');
    const batchRecordings = [
      { 
        id: 1, 
        buffer: Buffer.alloc(3000, 64), 
        metadata: { duration: 2.0, sampleRate: 16000 },
        content: 'Batch test 1'
      },
      { 
        id: 2, 
        buffer: Buffer.alloc(8000, 128), 
        metadata: { duration: 4.0, sampleRate: 16000 },
        content: 'Batch test 2'
      }
    ];

    const batchResult = await AudioPostProcessingService.processBatch(batchRecordings);
    
    if (batchResult.success) {
      console.log(`✅ Batch Processing: Selected recording ID ${batchResult.selectedRecording.id}`);
      console.log('Quality Scores:', batchResult.qualityScores);
      passedTests++;
    } else {
      console.log(`❌ Batch Processing: ${batchResult.error}`);
    }

    // Final report
    console.log('\n' + '='.repeat(60));
    console.log(`📊 AudioPostProcessingService Test Results: ${passedTests}/${testCases.length + 1} passed`);
    
    if (passedTests === testCases.length + 1) {
      console.log('🎉 Task 16: AudioPostProcessingService - ALL TESTS PASSED');
      console.log('✅ Production service ready for deployment');
    } else {
      console.log('⚠️ Task 16: Some tests failed, needs attention');
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testAudioPostProcessingService().catch(console.error);