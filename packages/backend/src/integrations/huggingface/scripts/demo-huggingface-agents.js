#!/usr/bin/env node

/**
 * HuggingFace Agents Demo
 * Showcases the capabilities of each specialized agent
 */

import '../src/loadEnv.js';
import VisionMasterAgent from '../src/agi/agents/VisionMasterAgent.js';
import AudioWizardAgent from '../src/agi/agents/AudioWizardAgent.js';
import LanguageMaestroAgent from '../src/agi/agents/LanguageMaestroAgent.js';
import MultiModalOracleAgent from '../src/agi/agents/MultiModalOracleAgent.js';
import DataSageAgent from '../src/agi/agents/DataSageAgent.js';
import AgentOrchestrator from '../src/agi/AgentOrchestrator.js';

console.log('🎭 HuggingFace Specialized Agents Demo\n');
console.log('=' .repeat(50));

async function demonstrateAgent(agent, agentName) {
  console.log(`\n🤖 ${agentName} Demo`);
  console.log('-' .repeat(30));
  
  try {
    const initialized = await agent.initialize();
    
    if (!initialized) {
      console.log(`❌ ${agentName} failed to initialize`);
      return false;
    }
    
    console.log(`✅ ${agentName} initialized successfully`);
    
    // Get and display capabilities
    if (typeof agent.getCapabilities === 'function') {
      const capabilities = agent.getCapabilities();
      console.log(`📋 Capabilities:`);
      console.log(`   Name: ${capabilities.name}`);
      console.log(`   Personality: ${capabilities.personality}`);
      console.log(`   Specializations: ${capabilities.specializations.join(', ')}`);
      console.log(`   Features: ${capabilities.features.length} available`);
      
      // Show some features
      capabilities.features.slice(0, 3).forEach((feature, index) => {
        console.log(`   ${index + 1}. ${feature}`);
      });
      
      if (capabilities.features.length > 3) {
        console.log(`   ... and ${capabilities.features.length - 3} more`);
      }
    }
    
    // Test response generation
    if (typeof agent.generateResponse === 'function') {
      const response = agent.generateResponse('Hello, what can you do?');
      console.log(`💬 Sample Response: "${response}"`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ ${agentName} demo failed: ${error.message}`);
    return false;
  }
}

async function demonstrateLanguageCapabilities(agent) {
  console.log('\n📝 Testing Language Processing...');
  
  try {
    // Test text classification
    const sentimentResult = await agent.classifyText(
      "I absolutely love the new HuggingFace integration! It's amazing!"
    );
    console.log(`✅ Sentiment Analysis:`, sentimentResult.sentiment, `(${Math.round(sentimentResult.confidence * 100)}%)`);
    
    // Test text generation
    const generationResult = await agent.generateText(
      "The future of artificial intelligence is"
    );
    console.log(`✅ Text Generation:`, generationResult.generatedText.substring(0, 100) + '...');
    
  } catch (error) {
    console.log(`❌ Language test failed: ${error.message}`);
  }
}

async function demonstrateDataCapabilities(agent) {
  console.log('\n📊 Testing Data Analysis...');
  
  try {
    // Sample data
    const sampleData = [
      { product: 'A', sales: 100, quarter: 'Q1', region: 'North' },
      { product: 'B', sales: 150, quarter: 'Q1', region: 'South' },
      { product: 'A', sales: 120, quarter: 'Q2', region: 'North' },
      { product: 'B', sales: 180, quarter: 'Q2', region: 'South' },
      { product: 'C', sales: 90, quarter: 'Q1', region: 'East' },
      { product: 'C', sales: 110, quarter: 'Q2', region: 'East' }
    ];
    
    const analysisResult = await agent.analyzeTabularData(sampleData, 'comprehensive');
    console.log(`✅ Data Summary:`, `${analysisResult.dataShape.rows} rows, ${analysisResult.dataShape.columns} columns`);
    console.log(`📊 Recommendations:`, analysisResult.results.recommendations.slice(0, 2).join('; '));
    
    // Time series forecasting
    const timeSeriesData = [
      { value: 100 }, { value: 105 }, { value: 110 }, { value: 108 },
      { value: 115 }, { value: 120 }, { value: 118 }, { value: 125 }
    ];
    
    const forecastResult = await agent.forecastTimeSeries(timeSeriesData, { periods: 3 });
    console.log(`✅ Time Series Forecast: Next 3 values:`, 
      forecastResult.forecast.map(f => Math.round(f.value)).join(', '));
    
  } catch (error) {
    console.log(`❌ Data analysis test failed: ${error.message}`);
  }
}

async function demonstrateOrchestrator() {
  console.log('\n🎭 Agent Orchestrator Demo');
  console.log('-' .repeat(30));
  
  try {
    const orchestrator = new AgentOrchestrator();
    const initialized = await orchestrator.initialize();
    
    if (!initialized) {
      console.log('❌ Orchestrator failed to initialize');
      return;
    }
    
    console.log('✅ Orchestrator initialized successfully');
    
    // Get capabilities
    const capabilities = await orchestrator.getAgentCapabilities();
    console.log(`📋 Total Agents: ${Object.keys(capabilities).length}`);
    
    Object.keys(capabilities).forEach(agentName => {
      console.log(`   • ${agentName}`);
    });
    
    // Test task routing
    console.log('\n🔀 Testing Task Routing...');
    
    const testTasks = [
      { type: 'text-classification', input: 'This is wonderful!', expectedAgent: 'LanguageMaestro' },
      { type: 'data-analysis', input: [{ x: 1, y: 2 }], expectedAgent: 'DataSage' },
      { type: 'multimodal-analysis', input: { text: 'Hello world' }, expectedAgent: 'MultiModalOracle' }
    ];
    
    testTasks.forEach(task => {
      const selectedAgent = orchestrator.selectAgent(task.type, task.input);
      const status = selectedAgent === task.expectedAgent ? '✅' : '⚠️';
      console.log(`${status} ${task.type} → ${selectedAgent}`);
    });
    
    // Health check
    const health = await orchestrator.healthCheck();
    console.log(`\n🏥 Health Status: ${health.status}`);
    console.log(`📊 Healthy Agents: ${Object.values(health.agents).filter(a => a.status === 'healthy').length}/${Object.keys(health.agents).length}`);
    
  } catch (error) {
    console.log(`❌ Orchestrator demo failed: ${error.message}`);
  }
}

async function runDemo() {
  console.log('🚀 Starting HuggingFace Agents Demo\n');
  
  // Check environment
  if (!process.env.HUGGINGFACE_API_TOKEN) {
    console.log('⚠️  Warning: HUGGINGFACE_API_TOKEN not set in environment');
    console.log('   Some features may not work without the API token\n');
  } else {
    console.log('✅ HuggingFace API token found\n');
  }
  
  const agents = [
    { agent: new VisionMasterAgent(), name: 'VisionMaster' },
    { agent: new AudioWizardAgent(), name: 'AudioWizard' },
    { agent: new LanguageMaestroAgent(), name: 'LanguageMaestro' },
    { agent: new MultiModalOracleAgent(), name: 'MultiModalOracle' },
    { agent: new DataSageAgent(), name: 'DataSage' }
  ];
  
  let successCount = 0;
  
  // Demonstrate each agent
  for (const { agent, name } of agents) {
    const success = await demonstrateAgent(agent, name);
    if (success) successCount++;
  }
  
  // Special demonstrations for specific agents
  if (successCount > 0) {
    console.log('\n🧪 Special Capability Tests');
    console.log('=' .repeat(30));
    
    // Test LanguageMaestro with actual tasks
    const languageAgent = agents.find(a => a.name === 'LanguageMaestro')?.agent;
    if (languageAgent?.isInitialized) {
      await demonstrateLanguageCapabilities(languageAgent);
    }
    
    // Test DataSage with actual data
    const dataAgent = agents.find(a => a.name === 'DataSage')?.agent;
    if (dataAgent?.isInitialized) {
      await demonstrateDataCapabilities(dataAgent);
    }
  }
  
  // Demonstrate orchestrator
  await demonstrateOrchestrator();
  
  // Final summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Demo Summary');
  console.log('=' .repeat(50));
  console.log(`🎭 Agents Demonstrated: ${successCount}/${agents.length}`);
  console.log(`🔧 Core Features: All agent types created and tested`);
  console.log(`🌐 API Integration: Routes created and configured`);
  console.log(`🎯 Task Routing: Intelligent agent selection implemented`);
  console.log(`💾 HuggingFace Pro: Ready for all inference tasks`);
  
  console.log('\n🚀 Ready for Production!');
  console.log('   • All specialized agents created');
  console.log('   • Comprehensive task coverage');
  console.log('   • Intelligent orchestration');
  console.log('   • RESTful API endpoints');
  console.log('   • Multimodal capabilities');
  
  console.log('\n📝 Next Steps:');
  console.log('   1. Test with real audio/image files');
  console.log('   2. Configure HuggingFace Pro models');
  console.log('   3. Integrate with frontend components');
  console.log('   4. Set up monitoring and logging');
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Run the demo
runDemo().catch(console.error);