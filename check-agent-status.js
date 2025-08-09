#!/usr/bin/env node
// Quick script to test the agent status
import fetch from 'node-fetch';

async function checkAgentStatus() {
  try {
    const response = await fetch('http://localhost:8001/api/agent/metrics');
    const data = await response.json();
    
    console.log('🤖 Agent Status:');
    console.log('   Requests processed:', data.requests_processed);
    console.log('   Successful responses:', data.successful_responses); 
    console.log('   Failed responses:', data.failed_responses);
    console.log('   Uptime:', Math.floor(data.uptime / 1000), 'seconds');
    
    if (data.successful_responses === 0 && data.failed_responses > 0) {
      console.log('❌ Agent appears to have initialization issues');
    } else {
      console.log('✅ Agent appears to be working');
    }
    
  } catch (error) {
    console.error('❌ Error checking agent status:', error.message);
  }
}

checkAgentStatus();