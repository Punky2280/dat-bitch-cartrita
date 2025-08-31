/**
 * OpenAI Fine-Tuning Service
 * Handles all fine-tuning operations using the dedicated fine-tuning API key
 */

import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OpenAIFineTuningService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_FINETUNING_API_KEY,
    });

    if (!process.env.OPENAI_FINETUNING_API_KEY) {
      throw new Error(
        'OPENAI_FINETUNING_API_KEY is required for fine-tuning operations'
      );
    }
  }

  /**
   * Upload a file for fine-tuning
   * @param {string} filePath - Path to the JSONL training file
   * @param {string} purpose - Purpose of the file ('fine-tune')
   * @returns {Promise<Object>} Upload response with file ID
   */
  async uploadFile(filePath, purpose = 'fine-tune') {
    try {
      console.log(`[FineTuning] Uploading file: ${filePath}`);

      const fileContent = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      const response = await this.openai.files.create({
        file: new File([fileContent], fileName, { type: 'application/jsonl' }),
        purpose: purpose,
      });

      console.log(`[FineTuning] File uploaded successfully: ${response.id}`);
      return response;
    } catch (error) {
      console.error(`[FineTuning] Error uploading file:`, error);
      throw error;
    }
  }

  /**
   * Create a fine-tuning job
   * @param {Object} config - Fine-tuning configuration
   * @returns {Promise<Object>} Fine-tuning job response
   */
  async createFineTuningJob(config) {
    const {
      model = 'gpt-4o-mini',
      trainingFileId,
      validationFileId = null,
      hyperparameters = {},
      suffix = null,
      metadata = null,
    } = config;

    try {
      console.log(`[FineTuning] Creating fine-tuning job for model: ${model}`);

      const jobConfig = {
        model,
        training_file: trainingFileId,
      };

      if (validationFileId) {
        jobConfig.validation_file = validationFileId;
      }

      if (suffix) {
        jobConfig.suffix = suffix;
      }

      if (metadata) {
        jobConfig.metadata = metadata;
      }

      // Add hyperparameters if provided
      if (Object.keys(hyperparameters).length > 0) {
        jobConfig.method = {
          type: 'supervised',
          supervised: {
            hyperparameters: {
              batch_size: hyperparameters.batchSize || 'auto',
              learning_rate_multiplier:
                hyperparameters.learningRateMultiplier || 'auto',
              n_epochs: hyperparameters.nEpochs || 'auto',
            },
          },
        };
      }

      const response = await this.openai.fineTuning.jobs.create(jobConfig);

      console.log(`[FineTuning] Fine-tuning job created: ${response.id}`);
      return response;
    } catch (error) {
      console.error(`[FineTuning] Error creating fine-tuning job:`, error);
      throw error;
    }
  }

  /**
   * List fine-tuning jobs
   * @param {Object} options - Listing options
   * @returns {Promise<Object>} List of fine-tuning jobs
   */
  async listFineTuningJobs(options = {}) {
    try {
      const { limit = 20, after = null, metadata = null } = options;

      const params = { limit };
      if (after) params.after = after;
      if (metadata) params.metadata = metadata;

      const response = await this.openai.fineTuning.jobs.list(params);

      console.log(
        `[FineTuning] Retrieved ${response.data.length} fine-tuning jobs`
      );
      return response;
    } catch (error) {
      console.error(`[FineTuning] Error listing fine-tuning jobs:`, error);
      throw error;
    }
  }

  /**
   * Get fine-tuning job details
   * @param {string} jobId - Fine-tuning job ID
   * @returns {Promise<Object>} Fine-tuning job details
   */
  async getFineTuningJob(jobId) {
    try {
      const response = await this.openai.fineTuning.jobs.retrieve(jobId);

      console.log(
        `[FineTuning] Retrieved job ${jobId} status: ${response.status}`
      );
      return response;
    } catch (error) {
      console.error(
        `[FineTuning] Error retrieving fine-tuning job ${jobId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Cancel a fine-tuning job
   * @param {string} jobId - Fine-tuning job ID
   * @returns {Promise<Object>} Cancelled job response
   */
  async cancelFineTuningJob(jobId) {
    try {
      const response = await this.openai.fineTuning.jobs.cancel(jobId);

      console.log(`[FineTuning] Cancelled job: ${jobId}`);
      return response;
    } catch (error) {
      console.error(
        `[FineTuning] Error cancelling fine-tuning job ${jobId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * List fine-tuning events for a job
   * @param {string} jobId - Fine-tuning job ID
   * @param {Object} options - Event listing options
   * @returns {Promise<Object>} List of fine-tuning events
   */
  async listFineTuningEvents(jobId, options = {}) {
    try {
      const { limit = 20, after = null } = options;

      const params = { limit };
      if (after) params.after = after;

      const response = await this.openai.fineTuning.jobs.listEvents(
        jobId,
        params
      );

      console.log(
        `[FineTuning] Retrieved ${response.data.length} events for job ${jobId}`
      );
      return response;
    } catch (error) {
      console.error(
        `[FineTuning] Error listing events for job ${jobId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * List checkpoints for a fine-tuning job
   * @param {string} jobId - Fine-tuning job ID
   * @param {Object} options - Checkpoint listing options
   * @returns {Promise<Object>} List of checkpoints
   */
  async listCheckpoints(jobId, options = {}) {
    try {
      const { limit = 10, after = null } = options;

      const params = { limit };
      if (after) params.after = after;

      const response = await this.openai.fineTuning.jobs.listCheckpoints(
        jobId,
        params
      );

      console.log(
        `[FineTuning] Retrieved ${response.data.length} checkpoints for job ${jobId}`
      );
      return response;
    } catch (error) {
      console.error(
        `[FineTuning] Error listing checkpoints for job ${jobId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Validate training data format
   * @param {Array} trainingData - Array of training examples
   * @param {string} method - Fine-tuning method ('supervised', 'dpo', 'reinforcement')
   * @returns {boolean} True if valid, throws error if invalid
   */
  validateTrainingData(trainingData, method = 'supervised') {
    if (!Array.isArray(trainingData) || trainingData.length === 0) {
      throw new Error('Training data must be a non-empty array');
    }

    trainingData.forEach((example, index) => {
      switch (method) {
        case 'supervised':
          this.validateSupervisedExample(example, index);
          break;
        case 'dpo':
          this.validateDPOExample(example, index);
          break;
        case 'reinforcement':
          this.validateReinforcementExample(example, index);
          break;
        default:
          throw new Error(`Unknown fine-tuning method: ${method}`);
      }
    });

    console.log(
      `[FineTuning] Validated ${trainingData.length} training examples for ${method} method`
    );
    return true;
  }

  /**
   * Validate supervised learning example
   * @private
   */
  validateSupervisedExample(example, index) {
    if (!example.messages || !Array.isArray(example.messages)) {
      throw new Error(
        `Example ${index}: 'messages' field is required and must be an array`
      );
    }

    if (example.messages.length === 0) {
      throw new Error(`Example ${index}: 'messages' array cannot be empty`);
    }

    example.messages.forEach((message, msgIndex) => {
      if (
        !message.role ||
        !['user', 'assistant', 'system'].includes(message.role)
      ) {
        throw new Error(
          `Example ${index}, Message ${msgIndex}: Invalid role "${message.role}"`
        );
      }

      if (!message.content && !message.tool_calls) {
        throw new Error(
          `Example ${index}, Message ${msgIndex}: Either 'content' or 'tool_calls' is required`
        );
      }
    });
  }

  /**
   * Validate DPO (preference) learning example
   * @private
   */
  validateDPOExample(example, index) {
    const required = ['input', 'preferred_output', 'non_preferred_output'];
    required.forEach(field => {
      if (!example[field]) {
        throw new Error(
          `Example ${index}: '${field}' field is required for DPO method`
        );
      }
    });

    if (!example.input.messages || !Array.isArray(example.input.messages)) {
      throw new Error(`Example ${index}: 'input.messages' must be an array`);
    }

    [example.preferred_output, example.non_preferred_output].forEach(
      (output, outputIndex) => {
        const outputName =
          outputIndex === 0 ? 'preferred_output' : 'non_preferred_output';
        if (!Array.isArray(output)) {
          throw new Error(`Example ${index}: '${outputName}' must be an array`);
        }
      }
    );
  }

  /**
   * Validate reinforcement learning example
   * @private
   */
  validateReinforcementExample(example, index) {
    if (!example.messages || !Array.isArray(example.messages)) {
      throw new Error(
        `Example ${index}: 'messages' field is required and must be an array`
      );
    }
  }

  /**
   * Create training file from data
   * @param {Array} trainingData - Training examples
   * @param {string} outputPath - Path to save the JSONL file
   * @returns {Promise<string>} Path to created file
   */
  async createTrainingFile(trainingData, outputPath) {
    try {
      const jsonlContent = trainingData
        .map(example => JSON.stringify(example))
        .join('\n');

      await fs.writeFile(outputPath, jsonlContent, 'utf8');

      console.log(`[FineTuning] Created training file: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`[FineTuning] Error creating training file:`, error);
      throw error;
    }
  }

  /**
   * Monitor fine-tuning job progress
   * @param {string} jobId - Fine-tuning job ID
   * @param {Function} callback - Callback function for status updates
   * @param {number} pollInterval - Polling interval in milliseconds (default: 30000)
   * @returns {Promise<Object>} Final job status
   */
  async monitorJob(jobId, callback = null, pollInterval = 30000) {
    console.log(`[FineTuning] Starting to monitor job: ${jobId}`);

    while (true) {
      try {
        const job = await this.getFineTuningJob(jobId);

        if (callback) {
          callback(job);
        }

        if (['succeeded', 'failed', 'cancelled'].includes(job.status)) {
          console.log(
            `[FineTuning] Job ${jobId} finished with status: ${job.status}`
          );
          return job;
        }

        console.log(
          `[FineTuning] Job ${jobId} status: ${job.status}, waiting ${pollInterval}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error(`[FineTuning] Error monitoring job ${jobId}:`, error);
        throw error;
      }
    }
  }
}

export default OpenAIFineTuningService;
