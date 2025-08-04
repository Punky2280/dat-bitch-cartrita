#!/usr/bin/env node

/**
 * Simple test to verify LangChain is working with the available packages
 */

console.log('Testing LangChain imports...');

try {
  // Test basic langchain imports
  console.log('Testing langchain/llms/openai...');
  const { ChatOpenAI } = require('langchain/llms/openai');
  console.log('✅ ChatOpenAI imported successfully');

  console.log('Testing langchain/agents...');
  const { AgentExecutor } = require('langchain/agents');
  console.log('✅ AgentExecutor imported successfully');

  console.log('Testing langchain/tools...');
  const { DynamicTool } = require('langchain/tools');
  console.log('✅ DynamicTool imported successfully');

  console.log('Testing langchain/prompts...');
  const { ChatPromptTemplate } = require('langchain/prompts');
  console.log('✅ ChatPromptTemplate imported successfully');

  console.log('\n🎉 All LangChain imports successful!');

  // Test basic tool creation
  console.log('\nTesting tool creation...');
  const testTool = new DynamicTool({
    name: 'test_tool',
    description: 'A test tool',
    func: async () => 'Hello from tool!'
  });
  console.log('✅ Tool created successfully');

  console.log('\n✅ LangChain basic functionality is working!');

} catch (error) {
  console.error('❌ Error testing LangChain:', error.message);
  console.error('Stack:', error.stack);
}