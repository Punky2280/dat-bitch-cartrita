#!/usr/bin/env node
// Direct test of the agent without Socket.IO

const testDirectAgent = async () => {
  try {
    // Import the agent
    const { default: CartritaSupervisorAgent } = await import('./packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js');
    
    console.log('🧠 Creating agent instance...');
    const agent = new CartritaSupervisorAgent();
    
    console.log('⚡ Initializing agent...');
    await agent.initialize();
    
    console.log('✅ Agent initialized, checking status...');
    console.log('   Is initialized:', agent.isInitialized);
    
    if (!agent.isInitialized) {
      throw new Error('Agent failed to initialize properly');
    }
    
    console.log('📤 Testing generateResponse...');
    const response = await agent.generateResponse('Hello, can you hear me?', 'en', 'test-user');
    
    console.log('✅ Response received:');
    console.log('   Text:', response.text?.substring(0, 100) + '...');
    console.log('   Model:', response.model);
    console.log('   Response time:', response.responseTime, 'ms');
    
  } catch (error) {
    console.error('❌ Agent test failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
};

testDirectAgent();