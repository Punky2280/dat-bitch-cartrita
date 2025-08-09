#!/usr/bin/env node

/**
 * Infinite Loop Detection Monitor for Cartrita
 * This script monitors the backend logs for infinite delegation loops between agents
 */

import fs from 'fs';
import { spawn } from 'child_process';

console.log('🔍 Starting infinite loop monitor...');
console.log('📊 Watching for patterns that indicate agent delegation loops');

// Track supervisor processing calls
let supervisorCalls = [];
let lastMessageTime = Date.now();

// Monitor the log file
const logFile = 'packages/backend/startup.log';
const tail = spawn('tail', ['-f', logFile]);

let lineBuffer = '';

tail.stdout.on('data', data => {
  lineBuffer += data.toString();
  const lines = lineBuffer.split('\n');

  // Process all complete lines
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    analyzeLogLine(line);
  }

  // Keep the incomplete line in buffer
  lineBuffer = lines[lines.length - 1];
});

function analyzeLogLine(line) {
  const timestamp = Date.now();

  // Detect supervisor processing calls
  if (line.includes('[CartritaSupervisor] 🧠 Cartrita supervisor processing')) {
    supervisorCalls.push(timestamp);

    // Remove calls older than 30 seconds
    supervisorCalls = supervisorCalls.filter(time => timestamp - time < 30000);

    // Check for excessive calls (more than 5 in 30 seconds indicates a loop)
    if (supervisorCalls.length > 5) {
      console.log(
        `🚨 INFINITE LOOP DETECTED! ${supervisorCalls.length} supervisor calls in 30 seconds`
      );
      console.log(
        '🔄 Recent supervisor processing pattern suggests agent delegation loop'
      );

      // Log the pattern
      const timeDiffs = supervisorCalls
        .slice(-5)
        .map((time, index, arr) => (index > 0 ? time - arr[index - 1] : 0))
        .slice(1);

      console.log('📈 Time between recent calls (ms):', timeDiffs);

      if (timeDiffs.every(diff => diff < 2000)) {
        console.log(
          '⚠️  CRITICAL: Calls are happening too frequently (< 2s apart)'
        );
        console.log('💡 This indicates agents are bouncing between each other');
      }
    }

    lastMessageTime = timestamp;
  }

  // Detect agent delegations
  if (
    line.includes('🎯 Delegating to') ||
    line.includes('🔄 Processing request')
  ) {
    console.log(`🔄 Agent activity: ${line.split(']')[1]?.trim() || line}`);
  }

  // Detect when responses are returned to chat
  if (
    line.includes('🎯 Using sub-agent response') ||
    line.includes('Successfully processed request')
  ) {
    console.log(`✅ Response completed: ${line.split(']')[1]?.trim() || line}`);
  }

  // Detect recursion limit hits
  if (line.includes('recursion') || line.includes('Graph recursion')) {
    console.log(`🔥 RECURSION ISSUE: ${line}`);
  }
}

// Check for stalled conversations (no activity for 30 seconds during a conversation)
setInterval(() => {
  if (supervisorCalls.length > 0 && Date.now() - lastMessageTime > 30000) {
    console.log(
      '⚠️  Possible stalled conversation - no activity for 30+ seconds'
    );
    supervisorCalls = []; // Reset
  }
}, 10000);

console.log(`📋 Monitoring ${logFile} for infinite loop patterns...`);
console.log('📋 Will detect:');
console.log('   • Excessive supervisor calls (>5 in 30s)');
console.log('   • Rapid delegation patterns (<2s apart)');
console.log('   • Recursion limit hits');
console.log('   • Stalled conversations');
console.log('🔍 Press Ctrl+C to stop monitoring\n');

process.on('SIGINT', () => {
  console.log('\n📊 Final Report:');
  console.log(`   • Total supervisor calls tracked: ${supervisorCalls.length}`);
  console.log('   • Monitor stopped by user');
  process.exit(0);
});
