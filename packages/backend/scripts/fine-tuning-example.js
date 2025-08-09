/**
 * Fine-Tuning Workflow Example
 * Demonstrates how to create and manage fine-tuning jobs
 */

import '../src/loadEnv.js';
import OpenAIFineTuningService from '../src/services/OpenAIFineTuningService.js';
import { 
    createFineTuningWorkflow, 
    trainingDataTemplates,
    estimateFineTuningCost,
    getHyperparameterRecommendations 
} from '../src/utils/fineTuningHelpers.js';

/**
 * Example: Customer Service Fine-Tuning
 */
async function customerServiceExample() {
    console.log('🎯 Customer Service Fine-Tuning Example');
    console.log('========================================\n');
    
    const fineTuningService = new OpenAIFineTuningService();
    
    // 1. Prepare training data
    const trainingData = [
        ...trainingDataTemplates.customerService,
        {
            messages: [
                { role: "user", content: "My account is locked and I can't log in." },
                { 
                    role: "assistant", 
                    content: "I understand how frustrating that must be! I can help you unlock your account right away. For security purposes, I'll need to verify your identity first. Could you please provide me with the email address associated with your account?" 
                }
            ]
        },
        {
            messages: [
                { role: "user", content: "I want to cancel my subscription." },
                { 
                    role: "assistant", 
                    content: "I'm sorry to hear you're considering canceling your subscription. I'd love to help address any concerns you might have first. Could you tell me what's prompting this decision? There might be a solution that works better for you." 
                }
            ]
        },
        {
            messages: [
                { role: "user", content: "The app keeps crashing on my phone." },
                { 
                    role: "assistant", 
                    content: "That sounds really frustrating! App crashes can usually be resolved quickly. Let's troubleshoot this together. First, could you tell me what type of phone you're using and which version of our app you have installed?" 
                }
            ]
        }
    ];
    
    try {
        // 2. Validate training data
        console.log('📋 Step 1: Validating training data...');
        fineTuningService.validateTrainingData(trainingData, 'supervised');
        console.log('✅ Training data is valid!\n');
        
        // 3. Get cost estimate
        console.log('💰 Step 2: Estimating costs...');
        const totalText = trainingData.map(ex => JSON.stringify(ex)).join(' ');
        const estimatedTokens = Math.ceil(totalText.length / 4);
        const costEstimate = estimateFineTuningCost(estimatedTokens, 'gpt-4o-mini');
        console.log('Cost Estimate:', costEstimate);
        console.log('');
        
        // 4. Get hyperparameter recommendations
        console.log('⚙️  Step 3: Getting hyperparameter recommendations...');
        const recommendations = getHyperparameterRecommendations(trainingData.length, 'customer_service');
        console.log('Recommendations:', recommendations);
        console.log('');
        
        // 5. Create workflow (but don't execute - just show structure)
        console.log('🔧 Step 4: Creating fine-tuning workflow...');
        const workflow = createFineTuningWorkflow({
            projectName: 'customer-service-v1',
            model: 'gpt-4o-mini',
            trainingData: trainingData,
            hyperparameters: recommendations.recommendations,
            metadata: {
                use_case: 'customer_service',
                version: '1.0',
                created_by: 'cartrita-system'
            }
        });
        
        console.log('✅ Workflow created with the following steps:');
        workflow.steps.forEach((step, index) => {
            console.log(`   ${index + 1}. ${step.name}: ${step.description}`);
        });
        console.log('');
        
        console.log('🚀 To execute this workflow, you would call:');
        console.log('   workflow.execute(fineTuningService, progressCallback)');
        console.log('');
        console.log('⚠️  Note: Actual fine-tuning job creation is commented out to avoid charges.');
        console.log('   Uncomment the execution code below to run the full workflow.');
        
        // UNCOMMENT BELOW TO ACTUALLY RUN THE FINE-TUNING JOB
        // WARNING: This will incur OpenAI API charges!
        /*
        console.log('🚀 Step 5: Executing workflow...');
        const results = await workflow.execute(fineTuningService, (progress) => {
            console.log(`   Progress: ${progress}`);
        });
        
        console.log('🎉 Fine-tuning completed!');
        console.log('Final Job:', results.finalJob);
        console.log('Fine-tuned Model:', results.finalJob.fine_tuned_model);
        */
        
    } catch (error) {
        console.error('❌ Error in customer service example:', error.message);
    }
}

/**
 * Example: Code Assistant Fine-Tuning
 */
async function codeAssistantExample() {
    console.log('\n🔧 Code Assistant Fine-Tuning Example');
    console.log('======================================\n');
    
    const trainingData = [
        ...trainingDataTemplates.codeAssistance,
        {
            messages: [
                { role: "user", content: "How do I create a REST API endpoint in Express.js?" },
                { 
                    role: "assistant", 
                    content: "Here's how to create a basic REST API endpoint in Express.js:\n\n```javascript\nconst express = require('express');\nconst app = express();\n\n// Middleware to parse JSON\napp.use(express.json());\n\n// GET endpoint\napp.get('/api/users', (req, res) => {\n  res.json({ users: ['Alice', 'Bob'] });\n});\n\n// POST endpoint\napp.post('/api/users', (req, res) => {\n  const { name } = req.body;\n  res.status(201).json({ message: 'User created', name });\n});\n\napp.listen(3000, () => {\n  console.log('Server running on port 3000');\n});\n```\n\nThis creates basic GET and POST endpoints for a users resource." 
                }
            ]
        }
    ];
    
    console.log('📊 Code Assistant Training Data:');
    console.log(`   - ${trainingData.length} examples`);
    console.log(`   - Focus: JavaScript/Node.js development`);
    console.log(`   - Format: Code explanations with examples\n`);
    
    const costEstimate = estimateFineTuningCost(
        Math.ceil(JSON.stringify(trainingData).length / 4), 
        'gpt-4o-mini'
    );
    console.log('💰 Estimated Cost:', costEstimate.estimatedTotal);
    
    const recommendations = getHyperparameterRecommendations(trainingData.length, 'code');
    console.log('⚙️  Recommended Settings:', recommendations.recommendations);
}

/**
 * Example: Monitoring Existing Jobs
 */
async function monitoringExample() {
    console.log('\n👀 Job Monitoring Example');
    console.log('==========================\n');
    
    try {
        const fineTuningService = new OpenAIFineTuningService();
        
        console.log('📋 Fetching recent fine-tuning jobs...');
        const jobs = await fineTuningService.listFineTuningJobs({ limit: 5 });
        
        if (jobs.data.length === 0) {
            console.log('   No fine-tuning jobs found.');
        } else {
            console.log(`   Found ${jobs.data.length} jobs:\n`);
            
            jobs.data.forEach((job, index) => {
                console.log(`   ${index + 1}. ${job.id}`);
                console.log(`      Model: ${job.model}`);
                console.log(`      Status: ${job.status}`);
                console.log(`      Created: ${new Date(job.created_at * 1000).toISOString()}`);
                if (job.fine_tuned_model) {
                    console.log(`      Fine-tuned Model: ${job.fine_tuned_model}`);
                }
                console.log('');
            });
        }
    } catch (error) {
        console.error('❌ Error fetching jobs:', error.message);
        if (error.message.includes('API key')) {
            console.log('   Make sure OPENAI_FINETUNING_API_KEY is set in your .env file');
        }
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🎯 OpenAI Fine-Tuning Examples');
    console.log('===============================\n');
    
    console.log('Environment Check:');
    console.log(`   OPENAI_FINETUNING_API_KEY: ${process.env.OPENAI_FINETUNING_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log('');
    
    if (!process.env.OPENAI_FINETUNING_API_KEY) {
        console.log('⚠️  OPENAI_FINETUNING_API_KEY is required for fine-tuning operations.');
        console.log('   Please add it to your .env file and try again.');
        return;
    }
    
    // Run examples
    await customerServiceExample();
    await codeAssistantExample();
    await monitoringExample();
    
    console.log('\n🏁 Examples completed!');
    console.log('=====================================');
    console.log('Next steps:');
    console.log('1. Uncomment execution code in customerServiceExample() to run actual fine-tuning');
    console.log('2. Monitor job progress using the monitoring functions');
    console.log('3. Use fine-tuned models in your applications');
    console.log('4. Check /api/fine-tuning endpoints for web interface integration');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}