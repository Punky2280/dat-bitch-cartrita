#!/usr/bin/env node

// Test voice-to-text integration from frontend to backend
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

console.log('🎤 Testing Voice-to-Text Integration...\n');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8001';

// Test with a sample audio file or URL
const testAudioUrl = 'https://www2.cs.uic.edu/~i101/SoundFiles/taunt.wav';

async function testVoiceToTextAPI() {
  console.log('=== Test 1: Voice-to-Text API with URL ===');
  
  try {
    // Test with JSON body (URL)
    const response = await fetch(`${API_BASE_URL}/api/voice-to-text/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer cartrita-media-2025-permanent-token-v1'
      },
      body: JSON.stringify({
        url: testAudioUrl,
        language: 'en',
        sentiment: true,
        intents: true,
        topics: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Voice-to-Text API failed:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Voice-to-Text API Response:', {
      success: result.success,
      transcript: result.transcript,
      confidence: result.confidence,
      wakeWord: result.wakeWord,
      model: result.model,
      fallback: result.fallback
    });

    return result.success;
    
  } catch (error) {
    console.error('❌ Voice-to-Text API test failed:', error.message);
    return false;
  }
}

async function testVoiceToTextStatus() {
  console.log('\n=== Test 2: Voice-to-Text Status Endpoint ===');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/voice-to-text/status`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer cartrita-media-2025-permanent-token-v1'
      }
    });

    if (!response.ok) {
      console.error('❌ Status endpoint failed:', response.status);
      return false;
    }

    const result = await response.json();
    console.log('✅ Voice-to-Text Status:', {
      deepgramAvailable: result.deepgram?.available,
      intelligenceFeatures: result.deepgram?.intelligence,
      provider: result.provider
    });

    return true;
    
  } catch (error) {
    console.error('❌ Status endpoint test failed:', error.message);
    return false;
  }
}

async function testVoiceChatEndpoint() {
  console.log('\n=== Test 3: Voice Chat Endpoint ===');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/voice-chat/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer cartrita-media-2025-permanent-token-v1'
      },
      body: JSON.stringify({
        text: 'Hello, this is a test of the voice synthesis system.',
        voice: 'nova',
        model: 'tts-1'
      })
    });

    console.log('Voice Chat Response Status:', response.status);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      console.log('✅ Voice Chat API responded successfully');
      console.log('Content-Type:', contentType);
      
      if (contentType && contentType.includes('audio')) {
        console.log('✅ Audio content received');
      } else {
        const result = await response.json();
        console.log('Voice Chat Result:', result);
      }
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Voice Chat API failed:', response.status, errorText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Voice Chat test failed:', error.message);
    return false;
  }
}

async function testCartritaRouterVoice() {
  console.log('\n=== Test 4: Cartrita Router Voice Transcription ===');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/unified/inference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task: 'audio_transcribe',
        input: testAudioUrl,
        options: {
          model: 'whisper-1',
          language: 'en'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Cartrita Router failed:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Cartrita Router Response:', {
      success: result.success,
      task: result.task,
      providerId: result.providerId,
      model: result.model,
      transcript: result.result?.transcript
    });

    return result.success;
    
  } catch (error) {
    console.error('❌ Cartrita Router test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runIntegrationTests() {
  console.log(`Testing against: ${API_BASE_URL}\n`);
  
  const results = {
    voiceToTextAPI: await testVoiceToTextAPI(),
    voiceToTextStatus: await testVoiceToTextStatus(),
    voiceChatEndpoint: await testVoiceChatEndpoint(),
    cartritaRouter: await testCartritaRouterVoice()
  };
  
  console.log('\n=== Integration Test Results ===');
  console.log('Voice-to-Text API:', results.voiceToTextAPI ? '✅ PASS' : '❌ FAIL');
  console.log('Voice-to-Text Status:', results.voiceToTextStatus ? '✅ PASS' : '❌ FAIL');
  console.log('Voice Chat Endpoint:', results.voiceChatEndpoint ? '✅ PASS' : '❌ FAIL');
  console.log('Cartrita Router:', results.cartritaRouter ? '✅ PASS' : '❌ FAIL');
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Integration Test Summary: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All voice integration tests PASSED!');
  } else {
    console.log('⚠️  Some voice integration tests FAILED');
  }
}

runIntegrationTests();