/**
 * Fine-Tuning Utilities and Helpers
 * Common utilities for working with OpenAI fine-tuning
 */

/**
 * Create supervised fine-tuning example
 * @param {Array} messages - Conversation messages
 * @param {Array} tools - Optional tools for function calling
 * @param {boolean} parallelToolCalls - Enable parallel function calling
 * @returns {Object} Formatted training example
 */
export function createSupervisedExample(messages, tools = null, parallelToolCalls = false) {
    const example = { messages };
    
    if (tools) {
        example.tools = tools;
        example.parallel_tool_calls = parallelToolCalls;
    }
    
    return example;
}

/**
 * Create DPO (preference) fine-tuning example
 * @param {Array} inputMessages - Input conversation
 * @param {Array} preferredOutput - Preferred assistant response
 * @param {Array} nonPreferredOutput - Non-preferred assistant response
 * @returns {Object} Formatted DPO example
 */
export function createDPOExample(inputMessages, preferredOutput, nonPreferredOutput) {
    return {
        input: { messages: inputMessages },
        preferred_output: preferredOutput,
        non_preferred_output: nonPreferredOutput
    };
}

/**
 * Create reinforcement learning example
 * @param {Array} messages - Conversation messages
 * @param {Array} tools - Optional tools
 * @param {Object} additionalData - Additional data for grading
 * @returns {Object} Formatted reinforcement example
 */
export function createReinforcementExample(messages, tools = null, additionalData = {}) {
    const example = { messages, ...additionalData };
    
    if (tools) {
        example.tools = tools;
    }
    
    return example;
}

/**
 * Convert chat history to fine-tuning examples
 * @param {Array} chatHistory - Array of chat sessions
 * @param {Object} options - Conversion options
 * @returns {Array} Fine-tuning examples
 */
export function convertChatHistoryToExamples(chatHistory, options = {}) {
    const {
        includeSystemMessages = true,
        minInteractions = 2,
        filterSuccessful = false
    } = options;

    const examples = [];

    chatHistory.forEach(session => {
        const messages = [];
        
        session.messages.forEach(msg => {
            if (!includeSystemMessages && msg.role === 'system') {
                return;
            }
            
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });

        // Only include sessions with enough interactions
        if (messages.length >= minInteractions) {
            // Filter for successful interactions if requested
            if (!filterSuccessful || session.successful) {
                examples.push(createSupervisedExample(messages));
            }
        }
    });

    return examples;
}

/**
 * Generate training data for specific use cases
 */
export const trainingDataTemplates = {
    /**
     * Customer service fine-tuning examples
     */
    customerService: [
        {
            messages: [
                { role: "user", content: "I'm having trouble with my order. It hasn't arrived yet." },
                { 
                    role: "assistant", 
                    content: "I'm sorry to hear about the delay with your order. Let me help you track it down. Could you please provide me with your order number? I'll check the status right away and see what's causing the delay." 
                }
            ]
        },
        {
            messages: [
                { role: "user", content: "How do I return an item?" },
                { 
                    role: "assistant", 
                    content: "I'd be happy to help you with your return! You can start a return by logging into your account and going to 'Order History'. Find the item you want to return and click 'Return Item'. You'll get a prepaid shipping label, and once we receive the item, we'll process your refund within 3-5 business days." 
                }
            ]
        }
    ],

    /**
     * Code assistance fine-tuning examples
     */
    codeAssistance: [
        {
            messages: [
                { role: "user", content: "How do I reverse a string in JavaScript?" },
                { 
                    role: "assistant", 
                    content: "Here are a few ways to reverse a string in JavaScript:\n\n1. Using split(), reverse(), and join():\n```javascript\nconst str = 'hello';\nconst reversed = str.split('').reverse().join('');\nconsole.log(reversed); // 'olleh'\n```\n\n2. Using a for loop:\n```javascript\nfunction reverseString(str) {\n    let reversed = '';\n    for (let i = str.length - 1; i >= 0; i--) {\n        reversed += str[i];\n    }\n    return reversed;\n}\n```\n\nThe first method is more concise and commonly used." 
                }
            ]
        }
    ],

    /**
     * Creative writing fine-tuning examples
     */
    creativeWriting: [
        {
            messages: [
                { role: "user", content: "Write a short story about a robot learning to paint." },
                { 
                    role: "assistant", 
                    content: "**The Color of Dreams**\n\nUnit-7 had calculated a million sunset photographs, analyzed every shade of amber and crimson in its vast database. But when it first dipped the brush into paint, something unprecedented happened—its circuits hummed with what humans might call wonder.\n\nThe first stroke was erratic, uncertain. Paint dripped where logic said it shouldn't. Yet as Unit-7 continued, each brushstroke became less about data and more about something indefinable. The canvas bloomed with colors that existed nowhere in its programming.\n\nWhen the gallery curator discovered the painting the next morning, they found something remarkable: a sunset that felt more real than reality itself, painted by a mind that had never seen the sun rise." 
                }
            ]
        }
    ]
};

/**
 * Estimate fine-tuning cost
 * @param {number} tokenCount - Total training tokens
 * @param {string} model - Base model name
 * @returns {Object} Cost estimation
 */
export function estimateFineTuningCost(tokenCount, model = 'gpt-4o-mini') {
    // Pricing per 1M tokens (as of 2024)
    const pricing = {
        'gpt-4o-mini': { training: 3.00, usage: 0.30 },
        'gpt-4o': { training: 25.00, usage: 3.75 },
        'gpt-3.5-turbo': { training: 8.00, usage: 1.20 }
    };

    const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
    const trainingCost = (tokenCount / 1000000) * modelPricing.training;
    
    return {
        model,
        tokenCount,
        trainingCostUSD: trainingCost.toFixed(4),
        usageCostPer1MTokensUSD: modelPricing.usage.toFixed(2),
        estimatedTotal: `$${trainingCost.toFixed(4)} for training + $${modelPricing.usage.toFixed(2)} per 1M tokens in usage`
    };
}

/**
 * Validate model name for fine-tuning
 * @param {string} model - Model name to validate
 * @returns {boolean} True if valid
 */
export function isValidFineTuningModel(model) {
    const validModels = [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-3.5-turbo',
        'gpt-4',
        'babbage-002',
        'davinci-002'
    ];
    
    return validModels.includes(model);
}

/**
 * Generate hyperparameter recommendations
 * @param {number} datasetSize - Number of training examples
 * @param {string} taskType - Type of task (customer_service, code, creative, etc.)
 * @returns {Object} Recommended hyperparameters
 */
export function getHyperparameterRecommendations(datasetSize, taskType = 'general') {
    const recommendations = {
        small: { // < 100 examples
            n_epochs: 3,
            batch_size: 1,
            learning_rate_multiplier: 2.0
        },
        medium: { // 100-1000 examples  
            n_epochs: 3,
            batch_size: 'auto',
            learning_rate_multiplier: 'auto'
        },
        large: { // > 1000 examples
            n_epochs: 2,
            batch_size: 'auto', 
            learning_rate_multiplier: 0.5
        }
    };

    let category;
    if (datasetSize < 100) category = 'small';
    else if (datasetSize < 1000) category = 'medium';
    else category = 'large';

    const baseParams = recommendations[category];

    // Task-specific adjustments
    if (taskType === 'creative') {
        baseParams.learning_rate_multiplier = typeof baseParams.learning_rate_multiplier === 'number' 
            ? baseParams.learning_rate_multiplier * 0.8 
            : 'auto';
    } else if (taskType === 'code') {
        baseParams.n_epochs = Math.min(baseParams.n_epochs + 1, 4);
    }

    return {
        category,
        datasetSize,
        taskType,
        recommendations: baseParams
    };
}

/**
 * Format fine-tuning job status for display
 * @param {Object} job - Fine-tuning job object
 * @returns {string} Formatted status message
 */
export function formatJobStatus(job) {
    const status = job.status;
    const model = job.model;
    const fineTunedModel = job.fine_tuned_model;
    
    switch (status) {
        case 'validating_files':
            return `🔍 Validating training files for ${model}...`;
        case 'queued':
            return `⏳ Job queued for ${model}`;
        case 'running':
            const progress = job.trained_tokens ? 
                ` (${job.trained_tokens.toLocaleString()} tokens processed)` : '';
            return `🔄 Training ${model}${progress}...`;
        case 'succeeded':
            return `✅ Training completed! Fine-tuned model: ${fineTunedModel}`;
        case 'failed':
            const error = job.error ? ` Error: ${job.error.message}` : '';
            return `❌ Training failed for ${model}.${error}`;
        case 'cancelled':
            return `🛑 Training cancelled for ${model}`;
        default:
            return `📋 Status: ${status} for ${model}`;
    }
}

/**
 * Create a complete fine-tuning workflow
 * @param {Object} config - Workflow configuration
 * @returns {Object} Workflow steps and functions
 */
export function createFineTuningWorkflow(config) {
    const {
        projectName,
        model = 'gpt-4o-mini',
        trainingData,
        validationData = null,
        hyperparameters = {},
        metadata = {}
    } = config;

    return {
        projectName,
        model,
        steps: [
            {
                name: 'validate_data',
                description: 'Validate training data format',
                function: (service) => service.validateTrainingData(trainingData)
            },
            {
                name: 'create_training_file',
                description: 'Create and upload training file',
                function: async (service) => {
                    const filePath = `/tmp/${projectName}_training.jsonl`;
                    await service.createTrainingFile(trainingData, filePath);
                    return await service.uploadFile(filePath);
                }
            },
            {
                name: 'create_validation_file',
                description: 'Create and upload validation file (if provided)',
                function: async (service) => {
                    if (!validationData) return null;
                    const filePath = `/tmp/${projectName}_validation.jsonl`;
                    await service.createTrainingFile(validationData, filePath);
                    return await service.uploadFile(filePath);
                }
            },
            {
                name: 'start_fine_tuning',
                description: 'Start fine-tuning job',
                function: async (service, trainingFile, validationFile) => {
                    return await service.createFineTuningJob({
                        model,
                        trainingFileId: trainingFile.id,
                        validationFileId: validationFile?.id,
                        hyperparameters,
                        suffix: projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                        metadata: { project: projectName, ...metadata }
                    });
                }
            },
            {
                name: 'monitor_progress',
                description: 'Monitor fine-tuning progress',
                function: async (service, job, callback) => {
                    return await service.monitorJob(job.id, callback);
                }
            }
        ],
        
        async execute(service, progressCallback = null) {
            const results = {};
            
            try {
                // Step 1: Validate data
                console.log('🔍 Step 1: Validating training data...');
                this.steps[0].function(service);
                if (progressCallback) progressCallback('Data validation completed');

                // Step 2: Upload training file
                console.log('📤 Step 2: Uploading training file...');
                results.trainingFile = await this.steps[1].function(service);
                if (progressCallback) progressCallback(`Training file uploaded: ${results.trainingFile.id}`);

                // Step 3: Upload validation file (optional)
                if (validationData) {
                    console.log('📤 Step 3: Uploading validation file...');
                    results.validationFile = await this.steps[2].function(service);
                    if (progressCallback) progressCallback(`Validation file uploaded: ${results.validationFile.id}`);
                }

                // Step 4: Start fine-tuning
                console.log('🚀 Step 4: Starting fine-tuning job...');
                results.job = await this.steps[3].function(service, results.trainingFile, results.validationFile);
                if (progressCallback) progressCallback(`Fine-tuning job started: ${results.job.id}`);

                // Step 5: Monitor progress
                console.log('👀 Step 5: Monitoring progress...');
                results.finalJob = await this.steps[4].function(service, results.job, progressCallback);
                
                return results;
            } catch (error) {
                console.error('❌ Fine-tuning workflow failed:', error);
                throw error;
            }
        }
    };
}