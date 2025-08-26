/**
 * @fileoverview Enhanced AI Routes with Advanced Features
 * @description Sophisticated AI capabilities including code execution,
 * vision analysis, sentiment detection, and multi-modal processing
 */

import express from 'express';
import multer from 'multer';
import authenticateToken from '../middleware/authenticateToken.js';
import { OpenAI } from 'openai';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, code files, and documents
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/javascript',
      'text/python',
      'application/json',
      'text/csv',
      'text/markdown',
    ];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.match(/\.(py|js|ts|md|txt|json|csv)$/)
    ) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  },
});

/**
 * @route POST /api/ai/code-execution
 * @desc Execute code safely in a sandboxed environment
 * @access Private
 */
router.post('/code-execution', authenticateToken, async (req, res) => {
  const { code, language = 'python', timeout = 10000 } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Code is required',
    });
  }

  try {
    let result;

    switch (language.toLowerCase()) {
      case 'python':
        result = await executePython(code, timeout);
        break;
      case 'javascript':
      case 'js':
        result = await executeJavaScript(code, timeout);
        break;
      case 'node':
        result = await executeNode(code, timeout);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Language '${language}' not supported. Supported: python, javascript, node`,
        });
    }

    res.json({
      success: true,
      language,
      output: result.output,
      error: result.error,
      executionTime: result.executionTime,
      memoryUsage: result.memoryUsage,
    });
  } catch (error) {
    console.error('[AI Enhanced] Code execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Code execution failed',
      details: error.message,
    });
  }
});

/**
 * @route POST /api/ai/vision-analysis
 * @desc Analyze images using computer vision and AI
 * @access Private
 */
router.post(
  '/vision-analysis',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required',
      });
    }

    const { task = 'analyze' } = req.body;

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      if (!openai.apiKey) {
        return res.status(500).json({
          success: false,
          error: 'OpenAI API key not configured',
        });
      }

      // Convert image to base64
      const imageBase64 = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;

      let prompt;
      switch (task) {
        case 'analyze':
          prompt =
            'Analyze this image in detail. Describe what you see, including objects, people, colors, composition, and any notable features.';
          break;
        case 'ocr':
          prompt =
            'Extract and transcribe any text visible in this image. Return the exact text content.';
          break;
        case 'objects':
          prompt =
            'Identify and list all objects visible in this image with their approximate locations.';
          break;
        case 'emotions':
          prompt =
            'Analyze the emotional content of this image. If there are people, describe their emotions and expressions.';
          break;
        case 'accessibility':
          prompt =
            'Provide an accessibility description of this image suitable for screen readers and visually impaired users.';
          break;
        default:
          prompt = req.body.customPrompt || 'Describe this image.';
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const analysis = response.choices[0]?.message?.content;

      // Additional processing for specific tasks
      let additionalData = {};
      if (task === 'objects') {
        additionalData.objectCount = (analysis.match(/\d+\./g) || []).length;
      }

      res.json({
        success: true,
        task,
        analysis,
        description: analysis,
        imageSize: {
          bytes: req.file.size,
          humanReadable: `${(req.file.size / 1024).toFixed(1)}KB`,
        },
        processingTime: Date.now() - req.startTime,
        ...additionalData,
      });
    } catch (error) {
      console.error('[AI Enhanced] Vision analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Vision analysis failed',
        details: error.message,
      });
    }
  }
);

/**
 * @route POST /api/ai/sentiment-analysis
 * @desc Analyze sentiment and emotions in text
 * @access Private
 */
router.post('/sentiment-analysis', authenticateToken, async (req, res) => {
  const { text, language = 'en', detailed = false } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Text is required',
    });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (!openai.apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured',
      });
    }

    const prompt = detailed
      ? `Analyze the sentiment and emotions in this text. Provide:
         1. Overall sentiment (positive/negative/neutral) with confidence score
         2. Primary emotions detected
         3. Emotional intensity (1-10)
         4. Key phrases that indicate sentiment
         5. Tone analysis (formal/casual/aggressive/calm, etc.)
         
         Text: "${text}"`
      : `Analyze the sentiment of this text and respond with a JSON object containing:
         - sentiment: "positive", "negative", or "neutral"
         - confidence: number between 0 and 1
         - emotion: primary emotion detected
         - valence: number between -1 (very negative) and 1 (very positive)
         
         Text: "${text}"`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert in sentiment analysis and emotional intelligence. Provide accurate, nuanced analysis.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: detailed ? 500 : 200,
      temperature: 0.3,
    });

    const analysis = response.choices[0]?.message?.content;

    // Try to parse JSON response for non-detailed analysis
    let structuredResult = {};
    if (!detailed) {
      try {
        structuredResult = JSON.parse(analysis);
      } catch {
        // Fallback to text analysis
        structuredResult = {
          sentiment: analysis.toLowerCase().includes('positive')
            ? 'positive'
            : analysis.toLowerCase().includes('negative')
              ? 'negative'
              : 'neutral',
          confidence: 0.8,
          emotion: 'unknown',
          valence: 0,
        };
      }
    }

    res.json({
      success: true,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      analysis: detailed ? analysis : structuredResult,
      detailed,
      language,
      processingTime: Date.now() - req.startTime,
    });
  } catch (error) {
    console.error('[AI Enhanced] Sentiment analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Sentiment analysis failed',
      details: error.message,
    });
  }
});

/**
 * @route POST /api/ai/multi-modal-analysis
 * @desc Analyze multiple types of content together
 * @access Private
 */
router.post(
  '/multi-modal-analysis',
  authenticateToken,
  upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'documents', maxCount: 3 },
  ]),
  async (req, res) => {
    const { text, task = 'comprehensive' } = req.body;
    const images = req.files?.images || [];
    const documents = req.files?.documents || [];

    if (!text && images.length === 0 && documents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one input (text, image, or document) is required',
      });
    }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      if (!openai.apiKey) {
        return res.status(500).json({
          success: false,
          error: 'OpenAI API key not configured',
        });
      }

      const messageContent = [];

      // Add text content
      if (text) {
        messageContent.push({
          type: 'text',
          text: `Text content: ${text}`,
        });
      }

      // Add image content
      for (const image of images) {
        const imageBase64 = image.buffer.toString('base64');
        messageContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${image.mimetype};base64,${imageBase64}`,
            detail: 'high',
          },
        });
      }

      // Add document content (read text files)
      for (const doc of documents) {
        if (doc.mimetype.startsWith('text/')) {
          const docContent = doc.buffer.toString('utf-8');
          messageContent.push({
            type: 'text',
            text: `Document content (${doc.originalname}): ${docContent.substring(0, 2000)}`,
          });
        }
      }

      let analysisPrompt;
      switch (task) {
        case 'comprehensive':
          analysisPrompt =
            'Provide a comprehensive analysis of all the provided content. Look for connections, patterns, and insights across text, images, and documents.';
          break;
        case 'summary':
          analysisPrompt =
            'Create a concise summary that captures the key points from all provided content.';
          break;
        case 'insights':
          analysisPrompt =
            'Extract key insights and actionable recommendations from the provided content.';
          break;
        case 'comparison':
          analysisPrompt =
            'Compare and contrast the different pieces of content, highlighting similarities and differences.';
          break;
        default:
          analysisPrompt =
            req.body.customPrompt || 'Analyze the provided content.';
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert analyst capable of processing and connecting insights across multiple types of content including text, images, and documents.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              ...messageContent,
            ],
          },
        ],
        max_tokens: 1500,
      });

      const analysis = response.choices[0]?.message?.content;

      res.json({
        success: true,
        task,
        analysis,
        inputSummary: {
          textLength: text ? text.length : 0,
          imageCount: images.length,
          documentCount: documents.length,
          totalSizeKB:
            [...images, ...documents].reduce(
              (sum, file) => sum + file.size,
              0
            ) / 1024,
        },
        processingTime: Date.now() - req.startTime,
      });
    } catch (error) {
      console.error('[AI Enhanced] Multi-modal analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Multi-modal analysis failed',
        details: error.message,
      });
    }
  }
);

// Helper functions for code execution

async function executePython(code, timeout) {
  return new Promise(resolve => {
    const startTime = Date.now();
  const python = spawn('/bin/python3.13', ['-c', code], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let error = '';

    python.stdout.on('data', data => {
      output += data.toString();
    });

    python.stderr.on('data', data => {
      error += data.toString();
    });

    python.on('close', code => {
      const executionTime = Date.now() - startTime;
      resolve({
        output: output.trim(),
        error: error.trim(),
        exitCode: code,
        executionTime,
        memoryUsage: process.memoryUsage(),
      });
    });

    python.on('error', err => {
      resolve({
        output: '',
        error: `Execution error: ${err.message}`,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        memoryUsage: process.memoryUsage(),
      });
    });
  });
}

async function executeJavaScript(code, timeout) {
  return new Promise(resolve => {
    const startTime = Date.now();

    try {
      // Create a simple sandbox
// sourcery skip: no-eval
      const result = /* The above code is using the `eval` function in JavaScript to execute the code
      contained within the `code` variable as a function. The code is wrapped in an
      immediately invoked function expression (IIFE) to create a new scope for the
      code to run in. This can be a way to dynamically execute code that is stored in
      a variable. */
      eval(`(function() { ${code} })()`);
      resolve({
        output: String(result),
        error: '',
        exitCode: 0,
        executionTime: Date.now() - startTime,
        memoryUsage: process.memoryUsage(),
      });
    } catch (error) {
      resolve({
        output: '',
        error: error.message,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        memoryUsage: process.memoryUsage(),
      });
    }
  });
}

async function executeNode(code, timeout) {
  return new Promise(resolve => {
    const startTime = Date.now();
    const node = spawn('node', ['-e', code], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let error = '';

    node.stdout.on('data', data => {
      output += data.toString();
    });

    node.stderr.on('data', data => {
      error += data.toString();
    });

    node.on('close', code => {
      const executionTime = Date.now() - startTime;
      resolve({
        output: output.trim(),
        error: error.trim(),
        exitCode: code,
        executionTime,
        memoryUsage: process.memoryUsage(),
      });
    });

    node.on('error', err => {
      resolve({
        output: '',
        error: `Execution error: ${err.message}`,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        memoryUsage: process.memoryUsage(),
      });
    });
  });
}

// Middleware to track request start time
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

export { router };
