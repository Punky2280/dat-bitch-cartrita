/**
 * Vision Master Agent - Specialized in computer vision and image analysis
 * Leverages HuggingFace models for comprehensive visual understanding
 */

import HuggingFaceInferenceService from '../services/HuggingFaceInferenceService.js';

export default class VisionMasterAgent {
  constructor() {
    this.name = 'VisionMaster';
    this.personality = 'Analytical and detail-oriented visual intelligence expert';
    this.specializations = [
      'image-classification',
      'object-detection', 
      'image-segmentation',
      'depth-estimation',
      'visual-question-answering',
      'zero-shot-image-classification',
      'image-to-text',
      'text-to-image'
    ];
    this.hfService = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.hfService = new HuggingFaceInferenceService();
      this.isInitialized = true;
      console.log('[VisionMaster] 👁️ Visual intelligence agent initialized');
      return true;
    } catch (error) {
      console.error('[VisionMaster] ❌ Initialization failed:', error.message);
      return false;
    }
  }

  async analyzeImage(imageData, analysisType = 'comprehensive', options = {}) {
    if (!this.isInitialized) {
      throw new Error('VisionMaster agent not initialized');
    }

    const results = {
      agent: this.name,
      analysisType,
      timestamp: new Date().toISOString(),
      results: {}
    };

    try {
      switch (analysisType) {
        case 'classification':
          results.results.classification = await this.hfService.imageClassification(imageData, options);
          break;
          
        case 'objects':
          results.results.objects = await this.hfService.objectDetection(imageData, options);
          break;
          
        case 'description':
          results.results.description = await this.hfService.imageToText(imageData, options);
          break;
          
        case 'depth':
          results.results.depth = await this.hfService.depthEstimation(imageData, options);
          break;
          
        case 'segmentation':
          results.results.segmentation = await this.hfService.imageSegmentation(imageData, options);
          break;
          
        case 'comprehensive':
          // Run multiple analyses in parallel
          const [classification, objects, description] = await Promise.allSettled([
            this.hfService.imageClassification(imageData, options),
            this.hfService.objectDetection(imageData, options),
            this.hfService.imageToText(imageData, options)
          ]);
          
          results.results.classification = classification.status === 'fulfilled' ? classification.value : null;
          results.results.objects = objects.status === 'fulfilled' ? objects.value : null;
          results.results.description = description.status === 'fulfilled' ? description.value : null;
          break;
          
        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }
      
      return results;
    } catch (error) {
      console.error(`[VisionMaster] Analysis failed:`, error);
      throw error;
    }
  }

  async answerVisualQuestion(imageData, question, options = {}) {
    if (!this.isInitialized) {
      throw new Error('VisionMaster agent not initialized');
    }

    const result = await this.hfService.visualQuestionAnswering(imageData, question, options);
    
    return {
      agent: this.name,
      question,
      answer: result.answer,
      confidence: result.score,
      timestamp: new Date().toISOString()
    };
  }

  async classifyWithLabels(imageData, labels, options = {}) {
    if (!this.isInitialized) {
      throw new Error('VisionMaster agent not initialized');
    }

    const result = await this.hfService.zeroShotImageClassification(imageData, labels, options);
    
    return {
      agent: this.name,
      classifications: result.map(r => ({
        label: r.label,
        confidence: r.score
      })),
      timestamp: new Date().toISOString()
    };
  }

  async generateImage(prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('VisionMaster agent not initialized');
    }

    const imageBlob = await this.hfService.textToImage(prompt, options);
    
    return {
      agent: this.name,
      prompt,
      image: imageBlob,
      parameters: options,
      timestamp: new Date().toISOString()
    };
  }

  generateResponse(userMessage, context = {}) {
    const responses = [
      `I see what you're looking for! Let me analyze this visual content for you.`,
      `My visual sensors are processing this image. Give me a moment to identify all the details.`,
      `Interesting visual data! I can detect multiple elements in this image.`,
      `Let me examine this image with my computer vision capabilities.`,
      `I'm scanning this image for objects, patterns, and contextual information.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  getCapabilities() {
    return {
      name: this.name,
      personality: this.personality,
      specializations: this.specializations,
      features: [
        'Multi-class image classification',
        'Object detection and localization', 
        'Image-to-text description generation',
        'Visual question answering',
        'Zero-shot classification with custom labels',
        'Depth estimation and 3D understanding',
        'Image segmentation and masking',
        'Text-to-image generation'
      ]
    };
  }
}