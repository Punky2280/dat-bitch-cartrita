#!/usr/bin/env node

// Quick test script to verify voice transcription fallback mechanism
// This bypasses module caching issues by running independently

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import { processCartritaRequest } from './src/cartrita/router/cartritaRouter.js';

console.log('🎤 Testing Cartrita Router voice transcription fallback...');

async function testVoiceTranscription() {
  try {
    console.log('📋 Testing audio_transcribe task with OpenAI Whisper...');
    
    // Test audio transcription with a sample URL - force OpenAI provider
    const result = await processCartritaRequest({
      task: 'audio_transcribe',
      input: 'https://www2.cs.uic.edu/~i101/SoundFiles/taunt.wav',
      providerId: 'openai', // Force OpenAI Whisper
      options: {
        model: 'whisper-1',
        language: 'en'
      },
      userId: 'test-user'
    });
    
    console.log('✅ Cartrita Router transcription result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Transcription test failed:', error.message);
    console.error('Full error:', error);
  }
}

async function testProviderDetection() {
  try {
    console.log('🔍 Testing provider detection...');
    console.log('🔧 Environment check:');
    console.log('  - OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY);
    console.log('  - HF_TOKEN:', !!process.env.HF_TOKEN);
    console.log('  - DEEPGRAM_API_KEY:', !!process.env.DEEPGRAM_API_KEY);
    
    // Import the router to test provider detection
    const { cartritaRouter } = await import('./src/cartrita/router/cartritaRouter.js');
    
    const chatProviders = cartritaRouter.getAvailableProviders('chat');
    const audioProviders = cartritaRouter.getAvailableProviders('audio_transcribe');
    
    console.log('💬 Chat providers:', chatProviders);
    console.log('🎤 Audio transcribe providers:', audioProviders);
    
  } catch (error) {
    console.error('❌ Provider detection test failed:', error.message);
  }
}

// Run tests
testProviderDetection();
testVoiceTranscription();