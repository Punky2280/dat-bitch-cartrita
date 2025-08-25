/* global process, console */
// packages/backend/src/services/VisionAnalysisService.js

import OpenAIWrapper from '../system/OpenAIWrapper.js';

/**
 * Advanced Vision Analysis Service using GPT-4 Vision (GPT-4o) and DALL-E
 * Provides comprehensive image analysis, generation, and multimodal capabilities
 */
class VisionAnalysisService {
  constructor() {
    this.supportedFormats = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    this.maxImageSize = 20 * 1024 * 1024; // 20MB
    this.maxImageDimension = 2048;

    // Analysis capabilities
    this.analysisTypes = {
      general: 'General image description and analysis',
      objects: 'Object detection and identification',
      text: 'Text extraction and OCR',
      faces: 'Face detection and analysis',
      scene: 'Scene understanding and context',
      sentiment: 'Emotion and sentiment analysis',
      accessibility: 'Accessibility description for visually impaired',
      safety: 'Content safety and moderation',
      technical: 'Technical image analysis (dimensions, format, etc.)',
    };

    console.log(
      '[VisionAnalysisService] ✅ Initialized with capabilities:',
      Object.keys(this.analysisTypes)
    );
  }

  /**
   * Analyze image(s) with comprehensive AI vision capabilities
   */
  async analyzeImage(images, options = {}) {
    try {
      const startTime = Date.now();

      // Validate and prepare images
      const processedImages = await this.preprocessImages(images);
      if (processedImages.length === 0) {
        throw new Error('No valid images provided');
      }

      const analysisType = options.analysisType || 'general';
      const includeDetails = options.includeDetails !== false;
      const language = options.language || 'en';
      const customPrompt = options.customPrompt;

      console.log(
        `[VisionAnalysisService] 🔍 Analyzing ${processedImages.length} image(s) - type: ${analysisType}`
      );

      // Build analysis prompt
      const prompt =
        customPrompt || this.buildAnalysisPrompt(analysisType, options);

      // Prepare multimodal messages for GPT-4V
      const messages = [
        {
          role: 'system',
          content: this.getSystemPrompt(analysisType, language),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            ...processedImages.map(img => ({
              type: 'image_url',
              image_url: {
                url: img.dataUrl,
                detail: includeDetails ? 'high' : 'low',
              },
            })),
          ],
        },
      ];

      // Call GPT-4 Vision
      const response = await OpenAIWrapper.createChatCompletion({
        model: 'gpt-4o',
        messages,
        max_tokens: options.maxTokens || 1500,
        temperature: options.temperature || 0.1,
      });

      const analysisText =
        response.choices?.[0]?.message?.content || 'No analysis generated';

      // Parse structured analysis if requested
      let structuredAnalysis = null;
      if (options.structured) {
        try {
          structuredAnalysis = this.parseStructuredAnalysis(
            analysisText,
            analysisType
          );
        } catch (error) {
          console.warn(
            '[VisionAnalysisService] Failed to parse structured analysis:',
            error.message
          );
        }
      }

      // Generate additional analyses if requested
      const additionalAnalyses = {};
      if (options.includeMultiple) {
        for (const type of ['objects', 'text', 'sentiment']) {
          if (type !== analysisType) {
            try {
              additionalAnalyses[type] = await this.performSpecificAnalysis(
                processedImages,
                type
              );
            } catch (error) {
              console.warn(
                `[VisionAnalysisService] Additional ${type} analysis failed:`,
                error.message
              );
            }
          }
        }
      }

      const result = {
        success: true,
        analysis: analysisText,
        type: analysisType,
        imageCount: processedImages.length,
        processingTime: Date.now() - startTime,
        model: 'gpt-4o',
        usage: response.usage,
        metadata: {
          language,
          includeDetails,
          structured: !!structuredAnalysis,
          dimensions: processedImages.map(img => ({
            width: img.width,
            height: img.height,
          })),
        },
      };

      if (structuredAnalysis) {
        result.structured = structuredAnalysis;
      }

      if (Object.keys(additionalAnalyses).length > 0) {
        result.additional = additionalAnalyses;
      }

      console.log(
        `[VisionAnalysisService] ✅ Analysis completed in ${result.processingTime}ms`
      );
      return result;
    } catch (error) {
      console.error(
        '[VisionAnalysisService] ❌ Image analysis failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        type: options.analysisType || 'general',
      };
    }
  }

  /**
   * Generate images using DALL-E with advanced options
   */
  async generateImage(prompt, options = {}) {
    try {
      const startTime = Date.now();

      console.log(
        `[VisionAnalysisService] 🎨 Generating image: "${prompt.substring(0, 50)}..."`
      );

      // Enhanced prompt processing
      const enhancedPrompt = this.enhanceGenerationPrompt(prompt, options);

      const params = {
        prompt: enhancedPrompt,
        model: options.model || 'dall-e-3',
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'vivid',
        response_format: 'url',
        n: 1, // DALL-E 3 only supports n=1
      };

      const response = await OpenAIWrapper.createImage(params);

      const imageData = response.data?.[0];
      if (!imageData) {
        throw new Error('No image generated');
      }

      // Optional: Download and analyze the generated image
      let generatedAnalysis = null;
      if (options.analyzeGenerated) {
        try {
          generatedAnalysis = await this.analyzeImage([imageData.url], {
            analysisType: 'general',
            includeDetails: false,
          });
        } catch (error) {
          console.warn(
            '[VisionAnalysisService] Failed to analyze generated image:',
            error.message
          );
        }
      }

      const result = {
        success: true,
        image: {
          url: imageData.url,
          revisedPrompt: imageData.revised_prompt || enhancedPrompt,
          originalPrompt: prompt,
        },
        generation: {
          model: params.model,
          size: params.size,
          quality: params.quality,
          style: params.style,
          processingTime: Date.now() - startTime,
        },
      };

      if (generatedAnalysis?.success) {
        result.analysis = generatedAnalysis.analysis;
      }

      console.log(
        `[VisionAnalysisService] ✅ Image generated in ${result.generation.processingTime}ms`
      );
      return result;
    } catch (error) {
      console.error(
        '[VisionAnalysisService] ❌ Image generation failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        originalPrompt: prompt,
      };
    }
  }

  /**
   * Compare multiple images and find similarities/differences
   */
  async compareImages(images, options = {}) {
    try {
      if (images.length < 2) {
        throw new Error('At least 2 images required for comparison');
      }

      const processedImages = await this.preprocessImages(images);
      const compareType = options.compareType || 'general';

      const prompt = `Compare these ${processedImages.length} images in detail. Focus on:
${compareType === 'similarity' ? '- What similarities do you see between the images?' : ''}
${compareType === 'differences' ? '- What are the key differences between the images?' : ''}
${compareType === 'general' ? '- Similarities and differences\n- Common elements and unique features' : ''}
- Overall relationship between the images
- Any patterns or themes you notice

Provide a comprehensive comparison analysis.`;

      const result = await this.analyzeImage(processedImages, {
        customPrompt: prompt,
        analysisType: 'comparison',
        structured: options.structured,
      });

      if (result.success) {
        result.comparison = {
          type: compareType,
          imageCount: processedImages.length,
          method: 'ai-multimodal',
        };
      }

      return result;
    } catch (error) {
      console.error(
        '[VisionAnalysisService] ❌ Image comparison failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        comparison: { imageCount: images.length },
      };
    }
  }

  /**
   * Extract text from images (OCR capabilities)
   */
  async extractText(images, options = {}) {
    try {
      const result = await this.analyzeImage(images, {
        analysisType: 'text',
        customPrompt: `Extract all text visible in this image. Format the output as:
        
TEXT_CONTENT:
[Provide the extracted text here, maintaining structure and formatting where possible]

METADATA:
- Language detected: [language]
- Text confidence: [high/medium/low]
- Layout type: [document/sign/handwritten/mixed]
- Notable formatting: [any special formatting observed]`,
        structured: true,
        ...options,
      });

      if (result.success && result.structured) {
        result.textExtraction = {
          method: 'gpt-4-vision-ocr',
          confidence: result.structured.confidence || 'medium',
          language: result.structured.language || 'unknown',
        };
      }

      return result;
    } catch (error) {
      console.error(
        '[VisionAnalysisService] ❌ Text extraction failed:',
        error.message
      );
      return {
        success: false,
        error: error.message,
        textExtraction: { method: 'gpt-4-vision-ocr' },
      };
    }
  }

  /**
   * Preprocessing and validation helpers
   */
  async preprocessImages(images) {
    const processed = [];
    const imageList = Array.isArray(images) ? images : [images];

    for (let i = 0; i < imageList.length; i++) {
      const image = imageList[i];

      try {
        let processedImage;

        if (typeof image === 'string') {
          // URL or data URL
          if (image.startsWith('data:')) {
            processedImage = await this.processDataUrl(image);
          } else if (image.startsWith('http')) {
            processedImage = await this.processImageUrl(image);
          } else {
            throw new Error('Invalid image string format');
          }
        } else if (image instanceof Buffer || image instanceof ArrayBuffer) {
          processedImage = await this.processImageBuffer(image);
        } else if (image.url || image.data) {
          // Object with url or data property
          processedImage = await this.processImageObject(image);
        } else {
          throw new Error('Unsupported image format');
        }

        if (processedImage) {
          processed.push(processedImage);
        }
      } catch (error) {
        console.warn(
          `[VisionAnalysisService] Failed to process image ${i}:`,
          error.message
        );
      }
    }

    return processed;
  }

  async processDataUrl(dataUrl) {
    // Extract MIME type and validate
    const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
    if (!mimeMatch || !this.supportedFormats.includes(mimeMatch[1])) {
      throw new Error(
        `Unsupported image format: ${mimeMatch?.[1] || 'unknown'}`
      );
    }

    return {
      dataUrl,
      mimeType: mimeMatch[1],
      width: null, // Would need image processing library to get dimensions
      height: null,
    };
  }

  async processImageUrl(url) {
    // For external URLs, we pass them directly to OpenAI
    return {
      dataUrl: url,
      mimeType: 'image/unknown',
      width: null,
      height: null,
      isExternal: true,
    };
  }

  async processImageBuffer(buffer) {
    // Convert buffer to data URL
    // This is a simplified implementation - production would detect format properly
    const base64 = buffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return {
      dataUrl,
      mimeType: 'image/jpeg',
      width: null,
      height: null,
    };
  }

  async processImageObject(imageObj) {
    if (imageObj.url) {
      return this.processImageUrl(imageObj.url);
    } else if (imageObj.data) {
      return this.processDataUrl(imageObj.data);
    }
    throw new Error('Image object must have url or data property');
  }

  /**
   * Prompt building helpers
   */
  buildAnalysisPrompt(analysisType, options) {
    const prompts = {
      general:
        'Analyze this image comprehensively. Describe what you see, including objects, people, settings, actions, and any notable details.',
      objects:
        'Identify and list all objects visible in this image. Include their positions, sizes, colors, and relationships to each other.',
      text: 'Extract and transcribe all text visible in this image. Maintain formatting and structure where possible.',
      faces:
        'Analyze any faces in this image. Describe apparent emotions, age ranges, and expressions while being respectful of privacy.',
      scene:
        "Describe the scene, setting, and context of this image. What is happening? Where might this be? What's the mood or atmosphere?",
      sentiment:
        'Analyze the emotional tone and sentiment of this image. What feelings or emotions does it convey?',
      accessibility:
        'Provide a detailed accessibility description of this image for visually impaired users. Be comprehensive and clear.',
      safety:
        'Analyze this image for content safety. Identify any potentially problematic content while being objective.',
      technical:
        'Provide technical details about this image including apparent quality, lighting, composition, and any technical aspects you can observe.',
    };

    let prompt = prompts[analysisType] || prompts.general;

    if (options.focus) {
      prompt += ` Pay special attention to: ${options.focus}`;
    }

    if (options.context) {
      prompt += ` Context: ${options.context}`;
    }

    return prompt;
  }

  getSystemPrompt(analysisType, language) {
    const basePrompt = `You are an advanced AI vision analysis system. Provide accurate, detailed, and helpful image analysis.`;

    const typeSpecific = {
      accessibility:
        ' Focus on creating descriptions that would be helpful for visually impaired users.',
      safety:
        ' Be objective and factual when identifying content. Avoid being overly restrictive.',
      technical:
        ' Use appropriate technical terminology for photography and image analysis.',
    };

    let systemPrompt = basePrompt + (typeSpecific[analysisType] || '');

    if (language !== 'en') {
      systemPrompt += ` Respond in ${language}.`;
    }

    return systemPrompt;
  }

  enhanceGenerationPrompt(prompt, options) {
    let enhanced = prompt;

    if (options.style && !prompt.toLowerCase().includes('style')) {
      enhanced += `, ${options.style} style`;
    }

    if (
      options.mood &&
      !prompt.toLowerCase().includes(options.mood.toLowerCase())
    ) {
      enhanced += `, ${options.mood} mood`;
    }

    if (
      options.quality === 'hd' &&
      !prompt.toLowerCase().includes('high quality')
    ) {
      enhanced += ', high quality, detailed';
    }

    return enhanced;
  }

  parseStructuredAnalysis(text, analysisType) {
    // Simple structured parsing - in production this would be more sophisticated
    const lines = text.split('\n').filter(line => line.trim());
    const structured = {};

    let currentSection = null;
    for (const line of lines) {
      if (line.includes(':') && line.length < 50) {
        // Likely a section header
        const [key, ...valueParts] = line.split(':');
        currentSection = key.trim().toLowerCase().replace(/\s+/g, '_');
        const value = valueParts.join(':').trim();
        if (value) {
          structured[currentSection] = value;
        }
      } else if (currentSection) {
        // Continue previous section
        if (structured[currentSection]) {
          structured[currentSection] += ' ' + line.trim();
        } else {
          structured[currentSection] = line.trim();
        }
      }
    }

    return Object.keys(structured).length > 0 ? structured : null;
  }

  async performSpecificAnalysis(processedImages, type) {
    try {
      const result = await this.analyzeImage(processedImages, {
        analysisType: type,
        includeDetails: false,
        maxTokens: 500,
      });
      return result.success ? result.analysis : null;
    } catch (error) {
      console.error(`Vision analysis failed for type ${type}:`, error.message);
      throw error;
    }
  }

  /**
   * Service health and capabilities
   */
  getCapabilities() {
    return {
      analysisTypes: this.analysisTypes,
      supportedFormats: this.supportedFormats,
      maxImageSize: this.maxImageSize,
      maxImageDimension: this.maxImageDimension,
      models: {
        analysis: 'gpt-4o (GPT-4 Vision)',
        generation: 'dall-e-3',
      },
      features: [
        'multimodal-analysis',
        'text-extraction-ocr',
        'object-detection',
        'scene-understanding',
        'image-generation',
        'image-comparison',
        'accessibility-descriptions',
        'content-safety-analysis',
      ],
    };
  }

  isHealthy() {
    return OpenAIWrapper.isAvailable();
  }

  getStats() {
    return {
      healthy: this.isHealthy(),
      capabilities: Object.keys(this.analysisTypes).length,
      supportedFormats: this.supportedFormats.length,
      openaiStatus: OpenAIWrapper.getStats(),
    };
  }
}

export default new VisionAnalysisService();
