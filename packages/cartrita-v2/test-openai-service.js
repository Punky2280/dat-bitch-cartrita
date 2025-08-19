#!/usr/bin/env node

/**
 * Test script for Cartrita V2 OpenAI Service Manager
 * Verifies API keys, tests intelligent routing, and shows usage patterns
 */

import './src/core/environment.js';
import { openAIService } from './src/services/OpenAIService.js';
import { logger } from './src/core/logger.js';

async function testOpenAIService() {
  console.log('\n🚀 Testing Cartrita V2 OpenAI Service Manager\n');

  try {
    // Initialize the service
    console.log('1. Initializing OpenAI Service Manager...');
    await openAIService.initialize();
    console.log('✅ Service initialized successfully\n');

    // Health check
    console.log('2. Performing health checks...');
    const health = await openAIService.healthCheck();
    console.log('Health Status:', JSON.stringify(health, null, 2));
    console.log('');

    // Get available models
    console.log('3. Fetching available models...');
    const models = await openAIService.getAvailableModels();
    console.log('Available Models:');
    Object.entries(models).forEach(([clientType, modelList]) => {
      console.log(`  ${clientType}:`, Array.isArray(modelList) ? `${modelList.length} models` : modelList);
    });
    console.log('');

    // Test different operation types
    console.log('4. Testing intelligent operation routing...\n');

    // General chat completion
    console.log('   Testing general chat completion...');
    try {
      const generalResponse = await openAIService.createChatCompletion([
        { role: 'user', content: 'Hello! How are you today?' }
      ], {
        model: 'gpt-4o',
        max_tokens: 100,
        operationType: 'general'
      });
      
      console.log('   ✅ General completion successful');
      console.log('   Response preview:', generalResponse.choices[0].message.content.substring(0, 100) + '...');
      console.log('   Tokens used:', generalResponse.usage?.total_tokens || 0);
      console.log('');
    } catch (error) {
      console.log('   ❌ General completion failed:', error.message);
    }

    // Test LangChain integration
    console.log('   Testing LangChain integration...');
    try {
      const langchainClient = openAIService.getLangChainClient('general');
      const langchainResponse = await langchainClient.invoke([
        { role: 'user', content: 'What is the capital of France? Answer in one sentence.' }
      ]);
      
      console.log('   ✅ LangChain integration successful');
      console.log('   Response:', langchainResponse.content);
      console.log('');
    } catch (error) {
      console.log('   ❌ LangChain integration failed:', error.message);
    }

    // Test batch processing operation type (should route to fine-tuning client if available)
    console.log('   Testing batch processing routing...');
    try {
      const batchResponse = await openAIService.createChatCompletion([
        { role: 'user', content: 'Generate a short creative story about AI' }
      ], {
        model: 'gpt-4o',
        max_tokens: 150,
        operationType: 'batch-processing'
      });
      
      console.log('   ✅ Batch processing completion successful');
      console.log('   Response preview:', batchResponse.choices[0].message.content.substring(0, 100) + '...');
      console.log('   Client type determined:', openAIService.determineClientType('batch-processing'));
      console.log('');
    } catch (error) {
      console.log('   ❌ Batch processing failed:', error.message);
    }

    // Get usage statistics
    console.log('5. Usage Statistics:');
    const usageStats = openAIService.getUsageStats();
    console.log(JSON.stringify(usageStats, null, 2));
    console.log('');

    // Configuration analysis
    console.log('6. Configuration Analysis:');
    console.log('   Primary Key Available:', !!process.env.OPENAI_API_KEY);
    console.log('   Fine-tuning Key Available:', !!process.env.OPENAI_FINETUNING_API_KEY);
    console.log('   Using Separate Keys:', process.env.OPENAI_FINETUNING_API_KEY !== process.env.OPENAI_API_KEY);
    console.log('   Default Model:', process.env.OPENAI_MODEL || 'gpt-4o');
    console.log('   RPM Limit:', process.env.OPENAI_RPM_LIMIT || 60);
    console.log('   TPM Limit:', process.env.OPENAI_TPM_LIMIT || 90000);

    console.log('\n🎉 OpenAI Service Manager test completed successfully!\n');

    // Key usage recommendations
    console.log('💡 Recommendations:');
    if (process.env.OPENAI_FINETUNING_API_KEY === process.env.OPENAI_API_KEY) {
      console.log('   - Consider setting up a separate OPENAI_FINETUNING_API_KEY for optimal quota management');
      console.log('   - This will preserve your primary key quota for interactive operations');
    } else {
      console.log('   - Excellent! You have separate keys configured for optimal quota management');
      console.log('   - Bulk operations will use the fine-tuning key to preserve primary quota');
    }
    
    const avgTokens = (usageStats.general.tokens + usageStats.finetuning.tokens) / 
                      (usageStats.general.requests + usageStats.finetuning.requests || 1);
    if (avgTokens > 2000) {
      console.log('   - High token usage detected - consider optimizing prompts and context length');
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testOpenAIService().catch(console.error);
}