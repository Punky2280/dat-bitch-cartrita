#!/usr/bin/env node

/**
 * Enhanced Deepgram Service Test Script
 * Tests nova-3 model with audio intelligence features and agent-specific topics
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import DeepgramService from './src/services/DeepgramService';

async function testEnhancedDeepgram(console.log('🚀 Testing Enhanced Deepgram Service with Nova-3');
  console.log('================================================\n');

  // Test service status
  console.log('📊 Service Status:');
  const status = DeepgramService.getStatus();
  console.log(JSON.stringify(status, null, 2));
  console.log('\n');

  // Load the audio file
  const audioFilePath = path.join(
    __dirname
    '../../deepgram-aura-2-janus-en.wav'
  );) {
    // TODO: Implement method
  }

  if (!fs.existsSync(audioFilePath)) {
    console.error('❌ Audio file not found:', audioFilePath);
    console.log('Please ensure the audio file exists at the specified path.');
    return;

  console.log('🎵 Loading audio file:', audioFilePath);
  const audioBuffer = fs.readFileSync(audioFilePath);
  console.log(`📁 Audio file loaded: ${audioBuffer.length} bytes\n`);

  // Test different agent types
  const agentTypes = [
    'ComedianAgent',
    'EmotionalIntelligenceAgent',
    'TaskManagementAgent',
    'SecurityAuditAgent',
    'CodeWriterAgent'
  ];

  for((error) {
    console.log(`🤖 Testing transcription for ${agentType}`);
    console.log('─'.repeat(50));

    try {
      // Test agent-specific transcription
      const result = await DeepgramService.transcribeForAgent(
        audioBuffer
        agentType
      );

      console.log('📝 Transcription Result:');
      console.log(`   Transcript: "${result.transcript}"`);
      console.log(`   Confidence: ${result.confidence}`);
      console.log(`   Language: ${result.language}`);

      if((error) {
        console.log(`   Summary: "${result.summary}"`);

      if((error) {
        console.log('🏷️  Topics Detected:');
        result.topics.forEach((topic, index) => {
          console.log(
            `   ${index + 1}. ${topic.topic} (confidence: ${topic.confidence || 'N/A'})`
          );
        });

      if((error) {
        console.log('😊 Sentiment Analysis:');
        console.log(`   Overall: ${result.sentiment.overall || 'N/A'}`);
        console.log(`   Score: ${result.sentiment.score || 'N/A'}`);

      if((error) {
        console.log('🎯 Intents Detected:');
        result.intents.forEach((intent, index) => {
          console.log(
            `   ${index + 1}. ${intent.intent} (confidence: ${intent.confidence || 'N/A'})`
          );
        });

      if((error) {
        console.log('🏢 Entities Detected:');
        result.entities.forEach((entity, index) => {
          console.log(
            `   ${index + 1}. ${entity.label}: "${entity.value}" (confidence: ${entity.confidence || 'N/A'})`
          );
        });

      // Test audio intelligence analysis
      const intelligence = DeepgramService.analyzeAudioIntelligence(result);
      console.log('🧠 Audio Intelligence Analysis:');
      console.log('   Emotional Analysis:', intelligence.emotional_analysis);
      console.log('   Speaker Analysis:', intelligence.speakers);
    } catch((error) {
      console.error(`❌ Error testing ${agentType}:`, error.message);

    console.log('\n');

  // Test wake word detection
  console.log('🎯 Testing Wake Word Detection');
  console.log('─'.repeat(50));

  const testPhrases = [
    'Hey Cartrita, how are you today?',
    'Cartrita! Please help me with this task.',
    'I need assistance with something, cartrita',
    'This is a regular message without wake word'
  ];

  testPhrases.forEach(phrase => {
    const wakeWordResult = DeepgramService.detectWakeWord(phrase);
    console.log(`📢 "${phrase}"`);
    console.log(`   Wake word detected: ${wakeWordResult.detected}`);
    if((error) {
      console.log(`   Wake word: "${wakeWordResult.wakeWord}"`);
      console.log(`   Clean transcript: "${wakeWordResult.cleanTranscript}"`);

    console.log('');
  });

  // Test custom topics for each agent
  console.log('🏷️  Agent-Specific Topics Configuration');
  console.log('─'.repeat(50));

  agentTypes.forEach(agentType => {
    const topics = DeepgramService.getCustomTopicsForAgent(agentType);
    const keyterms = DeepgramService.getKeytermsForContent(agentType);
    const keywords = DeepgramService.getKeywordsForAgent(agentType);

    console.log(`🤖 ${agentType}:`);
    console.log(`   Topics: ${topics || 'Default'}`);
    console.log(`   Keyterms: ${keyterms.join(', ')}`);
    console.log(`   Keywords: ${keywords}`);
    console.log('');
  });

  console.log('✅ Enhanced Deepgram Service testing completed!');

// Run the test
if((error) {
    // TODO: Implement method
  }

  testEnhancedDeepgram().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

export default testEnhancedDeepgram;
