#!/usr/bin/env node

// Test enhanced provider selection optimization
import dotenv from 'dotenv';
dotenv.config();

import { scoreProvider, selectBestProvider, providerConfig } from './packages/backend/src/cartrita/router/providerConfig.js';

console.log('🎯 Testing Enhanced Provider Selection Optimization...\n');

// Test 1: Chat task with different weighting preferences
console.log('=== Test 1: Chat Task with Different Weights ===');

const chatTaskOptions = [
  { 
    name: 'Cost-Optimized', 
    latencyWeight: 0.1, 
    reliabilityWeight: 0.2, 
    costWeight: 0.7,
    availableProviders: ['openai', 'huggingface']
  },
  { 
    name: 'Latency-Optimized', 
    latencyWeight: 0.7, 
    reliabilityWeight: 0.2, 
    costWeight: 0.1,
    availableProviders: ['openai', 'huggingface']
  },
  { 
    name: 'Reliability-Optimized', 
    latencyWeight: 0.1, 
    reliabilityWeight: 0.8, 
    costWeight: 0.1,
    availableProviders: ['openai', 'huggingface']
  }
];

for (const option of chatTaskOptions) {
  const bestProvider = selectBestProvider('chat', option);
  const scores = {
    openai: scoreProvider('openai', 'chat', option),
    huggingface: scoreProvider('huggingface', 'chat', option)
  };
  
  console.log(`${option.name}:`);
  console.log(`  Best Provider: ${bestProvider}`);
  console.log(`  OpenAI Score: ${scores.openai.toFixed(3)}`);
  console.log(`  HuggingFace Score: ${scores.huggingface.toFixed(3)}`);
  console.log(`  Weight Distribution: Latency=${option.latencyWeight}, Reliability=${option.reliabilityWeight}, Cost=${option.costWeight}\n`);
}

// Test 2: Audio transcription task comparison
console.log('=== Test 2: Audio Transcription Provider Selection ===');

const audioOptions = [
  { 
    name: 'Balanced', 
    latencyWeight: 0.33, 
    reliabilityWeight: 0.33, 
    costWeight: 0.34,
    availableProviders: ['openai', 'deepgram']
  },
  { 
    name: 'Speed-First', 
    latencyWeight: 0.8, 
    reliabilityWeight: 0.15, 
    costWeight: 0.05,
    availableProviders: ['openai', 'deepgram']
  }
];

for (const option of audioOptions) {
  try {
    const bestProvider = selectBestProvider('audio_transcribe', option);
    const scores = {
      openai: scoreProvider('openai', 'audio_transcribe', option),
      deepgram: scoreProvider('deepgram', 'audio_transcribe', option)
    };
    
    console.log(`${option.name}:`);
    console.log(`  Best Provider: ${bestProvider}`);
    console.log(`  OpenAI Score: ${scores.openai.toFixed(3)}`);
    console.log(`  Deepgram Score: ${scores.deepgram.toFixed(3)}\n`);
  } catch (error) {
    console.log(`${option.name}: Error - ${error.message}\n`);
  }
}

// Test 3: Provider capability overview
console.log('=== Test 3: Provider Capability Matrix ===');

const tasks = ['chat', 'embedding', 'classification', 'audio_transcribe', 'vision'];
const providers = ['openai', 'huggingface', 'deepgram'];

console.log('Task'.padEnd(20), ...providers.map(p => p.padEnd(12)));
console.log('-'.repeat(60));

for (const task of tasks) {
  const row = [task.padEnd(20)];
  
  for (const provider of providers) {
    const config = providerConfig[provider];
    const supported = config && config.tasks.includes(task) ? '✅' : '❌';
    const score = supported === '✅' ? scoreProvider(provider, task).toFixed(2) : 'N/A';
    row.push(`${supported} ${score}`.padEnd(12));
  }
  
  console.log(...row);
}

// Test 4: Cost Analysis
console.log('\n=== Test 4: Cost Analysis per Provider ===');

for (const [providerId, config] of Object.entries(providerConfig)) {
  console.log(`\n${config.name} (${providerId}):`);
  console.log(`  Latency Score: ${config.latencyScore}`);
  console.log(`  Reliability Score: ${config.reliabilityScore}`);
  console.log(`  Supported Tasks: ${config.tasks.join(', ')}`);
  
  if (Object.keys(config.pricing).length > 0) {
    console.log('  Pricing (per 1M tokens unless noted):');
    for (const [model, price] of Object.entries(config.pricing)) {
      const input = price.input || 'N/A';
      const output = price.output ? `/ ${price.output} output` : '';
      console.log(`    ${model}: $${input}${output}`);
    }
  } else {
    console.log('  Pricing: Not specified');
  }
}

console.log('\n🎯 Provider optimization testing completed!');