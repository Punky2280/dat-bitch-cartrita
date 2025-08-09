#!/usr/bin/env node

/**
 * Test to see what LangChain modules are actually available
 */

console.log('Testing LangChain package availability...\n');

// Test each package separately
const packagesToTest = [
  '@langchain/core',
  '@langchain/openai',
  'langchain',
  'langchain/tools',
  'langchain/agents',
  'langchain/prompts',
];

for (const pkg of packagesToTest) {
  try {
    console.log(`Testing ${pkg}...`);
    const module = require(pkg);
    console.log(`✅ ${pkg} - Available`);

    // For @langchain/openai, let's see what's exported
    if (pkg === '@langchain/openai') {
      console.log(
        '   Available exports:',
        Object.keys(module).slice(0, 10).join(', ')
      );
    }

    // For langchain/tools, test DynamicTool
    if (pkg === 'langchain/tools') {
      const { DynamicTool } = module;
      if (DynamicTool) {
        console.log('   ✅ DynamicTool available');
      }
    }
  } catch (error) {
    console.log(`❌ ${pkg} - Error: ${error.message}`);
  }
}

console.log('\n--- Testing specific imports needed by the system ---');

// Test what we actually need for the orchestrator
try {
  console.log('Testing DynamicTool import...');
  const { DynamicTool } = require('langchain/tools');
  console.log('✅ DynamicTool imported successfully');

  // Test creating a tool
  const testTool = new DynamicTool({
    name: 'test',
    description: 'test tool',
    func: async () => 'test result',
  });
  console.log('✅ DynamicTool can be instantiated');
} catch (error) {
  console.log('❌ DynamicTool error:', error.message);
}

try {
  console.log('Testing ChatOpenAI from @langchain/openai...');
  const { ChatOpenAI } = require('@langchain/openai');
  console.log('✅ ChatOpenAI imported successfully');
} catch (error) {
  console.log('❌ ChatOpenAI error:', error.message);
}

console.log('\n✅ LangChain availability test complete!');
