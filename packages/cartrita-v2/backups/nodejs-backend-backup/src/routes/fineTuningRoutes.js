/**
 * Fine-Tuning API Routes
 * Handles all fine-tuning related endpoints
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import OpenAIFineTuningService from '../services/OpenAIFineTuningService.js';
import {
  createFineTuningWorkflow,
  estimateFineTuningCost,
  formatJobStatus,
  getHyperparameterRecommendations,
  isValidFineTuningModel,
} from '../utils/fineTuningHelpers.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/json' ||
      file.originalname.endsWith('.jsonl') ||
      file.originalname.endsWith('.json')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON and JSONL files are allowed'), false);
    }
  },
});

// Initialize fine-tuning service
const fineTuningService = new OpenAIFineTuningService();

/**
 * POST /api/fine-tuning/upload
 * Upload a training file
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const { purpose = 'fine-tune' } = req.body;
    const uploadedFile = await fineTuningService.uploadFile(
      req.file.path,
      purpose
    );

    // Clean up temporary file
    await fs.unlink(req.file.path).catch(console.error);

    res.json({
      success: true,
      file: uploadedFile,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/fine-tuning/jobs
 * Create a fine-tuning job
 */
router.post('/jobs', async (req, res) => {
  try {
    const {
      model = 'gpt-4o-mini',
      training_file_id,
      validation_file_id,
      hyperparameters = {},
      suffix,
      metadata = {},
    } = req.body;

    if (!training_file_id) {
      return res.status(400).json({
        success: false,
        error: 'training_file_id is required',
      });
    }

    if (!isValidFineTuningModel(model)) {
      return res.status(400).json({
        success: false,
        error: `Invalid model: ${model}. Supported models: gpt-4o-mini, gpt-4o, gpt-3.5-turbo`,
      });
    }

    const job = await fineTuningService.createFineTuningJob({
      model,
      trainingFileId: training_file_id,
      validationFileId: validation_file_id,
      hyperparameters,
      suffix,
      metadata,
    });

    res.json({
      success: true,
      job,
      status: formatJobStatus(job),
      message: 'Fine-tuning job created successfully',
    });
  } catch (error) {
    console.error('Error creating fine-tuning job:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/fine-tuning/jobs
 * List fine-tuning jobs
 */
router.get('/jobs', async (req, res) => {
  try {
    const { limit = 20, after, metadata } = req.query;

    const options = { limit: parseInt(limit) };
    if (after) options.after = after;
    if (metadata) {
      try {
        options.metadata = JSON.parse(metadata);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid metadata JSON format',
        });
      }
    }

    const response = await fineTuningService.listFineTuningJobs(options);

    // Add formatted status to each job
    const jobsWithStatus = response.data.map(job => ({
      ...job,
      formatted_status: formatJobStatus(job),
    }));

    res.json({
      success: true,
      jobs: jobsWithStatus,
      has_more: response.has_more,
      total: response.data.length,
    });
  } catch (error) {
    console.error('Error listing fine-tuning jobs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/fine-tuning/jobs/:jobId
 * Get fine-tuning job details
 */
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await fineTuningService.getFineTuningJob(jobId);

    res.json({
      success: true,
      job: {
        ...job,
        formatted_status: formatJobStatus(job),
      },
    });
  } catch (error) {
    console.error('Error retrieving fine-tuning job:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/fine-tuning/jobs/:jobId/cancel
 * Cancel a fine-tuning job
 */
router.post('/jobs/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await fineTuningService.cancelFineTuningJob(jobId);

    res.json({
      success: true,
      job: {
        ...job,
        formatted_status: formatJobStatus(job),
      },
      message: 'Fine-tuning job cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling fine-tuning job:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/fine-tuning/jobs/:jobId/events
 * List fine-tuning events for a job
 */
router.get('/jobs/:jobId/events', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 20, after } = req.query;

    const options = { limit: parseInt(limit) };
    if (after) options.after = after;

    const response = await fineTuningService.listFineTuningEvents(
      jobId,
      options
    );

    res.json({
      success: true,
      events: response.data,
      has_more: response.has_more,
    });
  } catch (error) {
    console.error('Error listing fine-tuning events:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/fine-tuning/jobs/:jobId/checkpoints
 * List checkpoints for a fine-tuning job
 */
router.get('/jobs/:jobId/checkpoints', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 10, after } = req.query;

    const options = { limit: parseInt(limit) };
    if (after) options.after = after;

    const response = await fineTuningService.listCheckpoints(jobId, options);

    res.json({
      success: true,
      checkpoints: response.data,
      has_more: response.has_more,
    });
  } catch (error) {
    console.error('Error listing checkpoints:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/fine-tuning/estimate-cost
 * Estimate fine-tuning cost
 */
router.post('/estimate-cost', async (req, res) => {
  try {
    const { training_data, model = 'gpt-4o-mini' } = req.body;

    if (!training_data || !Array.isArray(training_data)) {
      return res.status(400).json({
        success: false,
        error: 'training_data array is required',
      });
    }

    // Rough token estimation (4 chars per token average)
    const totalText = training_data
      .map(example => JSON.stringify(example))
      .join(' ');
    const estimatedTokens = Math.ceil(totalText.length / 4);

    const costEstimate = estimateFineTuningCost(estimatedTokens, model);

    res.json({
      success: true,
      estimate: costEstimate,
      training_examples: training_data.length,
    });
  } catch (error) {
    console.error('Error estimating cost:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/fine-tuning/recommendations
 * Get hyperparameter recommendations
 */
router.post('/recommendations', async (req, res) => {
  try {
    const { dataset_size, task_type = 'general' } = req.body;

    if (!dataset_size || typeof dataset_size !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'dataset_size (number) is required',
      });
    }

    const recommendations = getHyperparameterRecommendations(
      dataset_size,
      task_type
    );

    res.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/fine-tuning/workflow
 * Execute a complete fine-tuning workflow
 */
router.post('/workflow', async (req, res) => {
  try {
    const {
      project_name,
      model = 'gpt-4o-mini',
      training_data,
      validation_data,
      hyperparameters = {},
      metadata = {},
    } = req.body;

    if (!project_name || !training_data) {
      return res.status(400).json({
        success: false,
        error: 'project_name and training_data are required',
      });
    }

    // Create workflow
    const workflow = createFineTuningWorkflow({
      projectName: project_name,
      model,
      trainingData: training_data,
      validationData: validation_data,
      hyperparameters,
      metadata,
    });

    // Execute workflow with progress tracking
    const progressUpdates = [];
    const results = await workflow.execute(fineTuningService, update => {
      progressUpdates.push({
        timestamp: new Date().toISOString(),
        message: update,
      });
      console.log(`[Workflow] ${update}`);
    });

    res.json({
      success: true,
      workflow_results: results,
      progress_log: progressUpdates,
      final_status: formatJobStatus(results.finalJob),
      message: 'Fine-tuning workflow completed',
    });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/fine-tuning/models
 * List supported models for fine-tuning
 */
router.get('/models', (req, res) => {
  const supportedModels = [
    {
      name: 'gpt-4o-mini',
      description: 'Most cost-effective option, good for most use cases',
      pricing: { training: '$3.00/1M tokens', usage: '$0.30/1M tokens' },
    },
    {
      name: 'gpt-4o',
      description: 'Most capable model, best for complex tasks',
      pricing: { training: '$25.00/1M tokens', usage: '$3.75/1M tokens' },
    },
    {
      name: 'gpt-3.5-turbo',
      description: 'Fast and efficient, good for simple tasks',
      pricing: { training: '$8.00/1M tokens', usage: '$1.20/1M tokens' },
    },
  ];

  res.json({
    success: true,
    supported_models: supportedModels,
  });
});

/**
 * POST /api/fine-tuning/validate
 * Validate training data format
 */
router.post('/validate', async (req, res) => {
  try {
    const { training_data, method = 'supervised' } = req.body;

    if (!training_data || !Array.isArray(training_data)) {
      return res.status(400).json({
        success: false,
        error: 'training_data array is required',
      });
    }

    // Validate using the service
    const isValid = fineTuningService.validateTrainingData(
      training_data,
      method
    );

    res.json({
      success: true,
      valid: isValid,
      examples_count: training_data.length,
      method,
      message: 'Training data validation completed successfully',
    });
  } catch (error) {
    console.error('Error validating training data:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
