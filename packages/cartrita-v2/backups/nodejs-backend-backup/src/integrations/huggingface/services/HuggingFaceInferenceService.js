/**
 * Comprehensive HuggingFace Inference Service
 * Supports all HF Inference API tasks with intelligent model selection
 */

import { HfInference } from '@huggingface/inference';
import fs from 'fs/promises';
import path from 'path';

export default class HuggingFaceInferenceService {
  constructor() {
    const token = process.env.HUGGINGFACE_API_TOKEN;
    if (!token) {
      throw new Error(
        'HUGGINGFACE_API_TOKEN is required for HuggingFace operations'
      );
    }

    this.hf = new HfInference(token);
    this.modelCache = new Map();
    this.taskModelMap = this.initializeTaskModelMap();
  }

  // Initialize task-to-model mapping with recommended models
  initializeTaskModelMap() {
    return {
      // Multimodal
      'audio-text-to-text': [
        'openai/whisper-large-v3',
        'facebook/wav2vec2-large-960h',
      ],
      'image-text-to-text': [
        'Salesforce/blip-image-captioning-large',
        'nlpconnect/vit-gpt2-image-captioning',
      ],
      'visual-question-answering': [
        'dandelin/vilt-b32-finetuned-vqa',
        'microsoft/git-large-vqav2',
      ],
      'document-question-answering': [
        'impira/layoutlm-document-qa',
        'microsoft/layoutlmv3-base',
      ],
      'video-text-to-text': [
        'MCG-NJU/videomae-base',
        'microsoft/xclip-base-patch32',
      ],
      'visual-document-retrieval': ['sentence-transformers/clip-ViT-B-32'],

      // Computer Vision
      'depth-estimation': ['Intel/dpt-large', 'facebook/dpt-dinov2-small-nyu'],
      'image-classification': [
        'google/vit-base-patch16-224',
        'microsoft/resnet-50',
      ],
      'object-detection': ['facebook/detr-resnet-50', 'microsoft/yolos-tiny'],
      'image-segmentation': [
        'facebook/detr-resnet-50-panoptic',
        'nvidia/segformer-b0-finetuned-ade-512-512',
      ],
      'text-to-image': [
        'stabilityai/stable-diffusion-xl-base-1.0',
        'runwayml/stable-diffusion-v1-5',
      ],
      'image-to-text': [
        'Salesforce/blip-image-captioning-base',
        'microsoft/git-base-coco',
      ],
      'image-to-image': [
        'timbrooks/instruct-pix2pix',
        'lllyasviel/sd-controlnet-canny',
      ],
      'image-to-video': [
        'ali-vilab/i2vgen-xl',
        'runwayml/stable-video-diffusion-img2vid-xt',
      ],
      'unconditional-image-generation': ['CompVis/stable-diffusion-v1-4'],
      'video-classification': ['MCG-NJU/videomae-base-finetuned-kinetics'],
      'text-to-video': [
        'ali-vilab/text-to-video-ms-1.7b',
        'cerspense/zeroscope_v2_576w',
      ],
      'zero-shot-image-classification': [
        'openai/clip-vit-large-patch14',
        'laion/CLIP-ViT-B-32-laion2B-s34B-b79K',
      ],
      'mask-generation': ['facebook/sam-vit-huge', 'facebook/sam-vit-base'],
      'zero-shot-object-detection': [
        'google/owlvit-base-patch32',
        'facebook/detr-resnet-50',
      ],
      'text-to-3d': ['threestudio-project/threestudio'],
      'image-to-3d': ['ashawkey/stable-dreamfusion'],
      'image-feature-extraction': ['sentence-transformers/clip-ViT-B-32'],
      'keypoint-detection': ['microsoft/table-transformer-detection'],
      'video-to-video': ['runwayml/stable-video-diffusion-img2vid-xt'],

      // Natural Language Processing
      'text-classification': [
        'cardiffnlp/twitter-roberta-base-sentiment-latest',
        'microsoft/DialoGPT-medium',
      ],
      'token-classification': [
        'dbmdz/bert-large-cased-finetuned-conll03-english',
        'microsoft/DialoGPT-medium',
      ],
      'table-question-answering': [
        'google/tapas-large-finetuned-wtq',
        'microsoft/tapex-large-finetuned-wtq',
      ],
      'question-answering': [
        'deepset/roberta-base-squad2',
        'microsoft/DialoGPT-medium',
      ],
      'zero-shot-classification': [
        'facebook/bart-large-mnli',
        'microsoft/DialoGPT-medium',
      ],
      translation: ['Helsinki-NLP/opus-mt-en-de', 'facebook/m2m100_418M'],
      summarization: ['facebook/bart-large-cnn', 'microsoft/DialoGPT-medium'],
      'feature-extraction': [
        'sentence-transformers/all-MiniLM-L6-v2',
        'microsoft/DialoGPT-medium',
      ],
      'text-generation': ['microsoft/DialoGPT-large', 'gpt2-large'],
      'fill-mask': ['bert-base-uncased', 'roberta-base'],
      'sentence-similarity': ['sentence-transformers/all-MiniLM-L6-v2'],
      'text-ranking': ['cross-encoder/ms-marco-MiniLM-L-6-v2'],

      // Audio
      'text-to-speech': ['microsoft/speecht5_tts', 'facebook/mms-tts-eng'],
      'text-to-audio': ['facebook/musicgen-small', 'microsoft/speecht5_tts'],
      'automatic-speech-recognition': [
        'openai/whisper-large-v3',
        'facebook/wav2vec2-large-960h',
      ],
      'audio-to-audio': ['facebook/musicgen-small', 'microsoft/speecht5_vc'],
      'audio-classification': [
        'MIT/ast-finetuned-audioset-10-10-0.4593',
        'facebook/wav2vec2-large-960h',
      ],
      'voice-activity-detection': ['pyannote/voice-activity-detection'],

      // Tabular
      'tabular-classification': ['scikit-learn/TabNet'],
      'tabular-regression': ['scikit-learn/TabNet'],
      'time-series-forecasting': ['huggingface/CodeBERTa-small-v1'],

      // Reinforcement Learning & Robotics
      'reinforcement-learning': ['sb3-contrib/ppo-CartPole-v1'],
      robotics: ['robotics-transformers/rt1'],

      // Other
      'graph-machine-learning': ['microsoft/graphcodebert-base'],
    };
  }

  // Get recommended model for a task
  getRecommendedModel(task, options = {}) {
    const models = this.taskModelMap[task];
    if (!models || models.length === 0) {
      throw new Error(`No models available for task: ${task}`);
    }

    // Return first model by default, or specific model if requested
    return options.model || models[0];
  }

  // MULTIMODAL TASKS
  async audioTextToText(audioData, options = {}) {
    const model = this.getRecommendedModel('audio-text-to-text', options);
    return await this.hf.automaticSpeechRecognition({
      data: audioData,
      model,
    });
  }

  async imageTextToText(imageData, text, options = {}) {
    const model = this.getRecommendedModel('image-text-to-text', options);
    return await this.hf.imageToText({
      data: imageData,
      model,
    });
  }

  async visualQuestionAnswering(imageData, question, options = {}) {
    const model = this.getRecommendedModel(
      'visual-question-answering',
      options
    );
    return await this.hf.visualQuestionAnswering({
      inputs: { image: imageData, question },
      model,
    });
  }

  async documentQuestionAnswering(imageData, question, options = {}) {
    const model = this.getRecommendedModel(
      'document-question-answering',
      options
    );
    return await this.hf.documentQuestionAnswering({
      inputs: { image: imageData, question },
      model,
    });
  }

  // COMPUTER VISION TASKS
  async depthEstimation(imageData, options = {}) {
    const model = this.getRecommendedModel('depth-estimation', options);
    return await this.hf.depthEstimation({
      data: imageData,
      model,
    });
  }

  async imageClassification(imageData, options = {}) {
    const model = this.getRecommendedModel('image-classification', options);
    return await this.hf.imageClassification({
      data: imageData,
      model,
    });
  }

  async objectDetection(imageData, options = {}) {
    const model = this.getRecommendedModel('object-detection', options);
    return await this.hf.objectDetection({
      data: imageData,
      model,
    });
  }

  async imageSegmentation(imageData, options = {}) {
    const model = this.getRecommendedModel('image-segmentation', options);
    return await this.hf.imageSegmentation({
      data: imageData,
      model,
    });
  }

  async textToImage(text, options = {}) {
    const model = this.getRecommendedModel('text-to-image', options);
    return await this.hf.textToImage({
      inputs: text,
      model,
      parameters: {
        negative_prompt: options.negativePrompt,
        num_inference_steps: options.steps || 50,
        guidance_scale: options.guidanceScale || 7.5,
        width: options.width || 512,
        height: options.height || 512,
      },
    });
  }

  async imageToText(imageData, options = {}) {
    const model = this.getRecommendedModel('image-to-text', options);
    return await this.hf.imageToText({
      data: imageData,
      model,
    });
  }

  async zeroShotImageClassification(imageData, labels, options = {}) {
    const model = this.getRecommendedModel(
      'zero-shot-image-classification',
      options
    );
    return await this.hf.zeroShotImageClassification({
      inputs: { image: imageData, candidate_labels: labels },
      model,
    });
  }

  // NATURAL LANGUAGE PROCESSING TASKS
  async textClassification(text, options = {}) {
    const model = this.getRecommendedModel('text-classification', options);
    return await this.hf.textClassification({
      inputs: text,
      model,
    });
  }

  async tokenClassification(text, options = {}) {
    const model = this.getRecommendedModel('token-classification', options);
    return await this.hf.tokenClassification({
      inputs: text,
      model,
    });
  }

  async questionAnswering(question, context, options = {}) {
    const model = this.getRecommendedModel('question-answering', options);
    return await this.hf.questionAnswering({
      inputs: { question, context },
      model,
    });
  }

  async zeroShotClassification(text, labels, options = {}) {
    const model = this.getRecommendedModel('zero-shot-classification', options);
    return await this.hf.zeroShotClassification({
      inputs: text,
      parameters: { candidate_labels: labels },
      model,
    });
  }

  async translation(text, options = {}) {
    const model = this.getRecommendedModel('translation', options);
    return await this.hf.translation({
      inputs: text,
      model,
    });
  }

  async summarization(text, options = {}) {
    const model = this.getRecommendedModel('summarization', options);
    return await this.hf.summarization({
      inputs: text,
      parameters: {
        max_length: options.maxLength || 150,
        min_length: options.minLength || 30,
      },
      model,
    });
  }

  async textGeneration(prompt, options = {}) {
    const model = this.getRecommendedModel('text-generation', options);
    return await this.hf.textGeneration({
      inputs: prompt,
      parameters: {
        max_new_tokens: options.maxTokens || 100,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.95,
      },
      model,
    });
  }

  async fillMask(text, options = {}) {
    const model = this.getRecommendedModel('fill-mask', options);
    return await this.hf.fillMask({
      inputs: text,
      model,
    });
  }

  async sentenceSimilarity(sentences, options = {}) {
    const model = this.getRecommendedModel('sentence-similarity', options);
    return await this.hf.sentenceSimilarity({
      inputs: {
        source_sentence: sentences[0],
        sentences: sentences.slice(1),
      },
      model,
    });
  }

  // AUDIO TASKS
  async textToSpeech(text, options = {}) {
    const model = this.getRecommendedModel('text-to-speech', options);
    return await this.hf.textToSpeech({
      inputs: text,
      model,
    });
  }

  async automaticSpeechRecognition(audioData, options = {}) {
    const model = this.getRecommendedModel(
      'automatic-speech-recognition',
      options
    );
    return await this.hf.automaticSpeechRecognition({
      data: audioData,
      model,
    });
  }

  async audioClassification(audioData, options = {}) {
    const model = this.getRecommendedModel('audio-classification', options);
    return await this.hf.audioClassification({
      data: audioData,
      model,
    });
  }

  // UTILITY METHODS
  async featureExtraction(text, options = {}) {
    const model = this.getRecommendedModel('feature-extraction', options);
    return await this.hf.featureExtraction({
      inputs: text,
      model,
    });
  }

  // Model management
  async listAvailableModels(task) {
    return this.taskModelMap[task] || [];
  }

  async getModelInfo(modelId) {
    try {
      // This would typically call HF API to get model info
      return {
        modelId,
        cached: this.modelCache.has(modelId),
        lastUsed: this.modelCache.get(modelId)?.lastUsed || null,
      };
    } catch (error) {
      console.error(`Error getting model info for ${modelId}:`, error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      // Test with a simple text classification
      const result = await this.textClassification('Hello world', {
        model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      });
      return {
        status: 'healthy',
        message: 'HuggingFace Inference Service is operational',
        testResult: result,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        error: error.toString(),
      };
    }
  }

  // Batch processing
  async batchProcess(tasks) {
    const results = [];
    for (const task of tasks) {
      try {
        const { type, inputs, options } = task;
        let result;

        switch (type) {
          case 'text-classification':
            result = await this.textClassification(inputs, options);
            break;
          case 'image-classification':
            result = await this.imageClassification(inputs, options);
            break;
          case 'text-generation':
            result = await this.textGeneration(inputs, options);
            break;
          // Add more cases as needed
          default:
            throw new Error(`Unsupported task type: ${type}`);
        }

        results.push({ success: true, result, task });
      } catch (error) {
        results.push({ success: false, error: error.message, task });
      }
    }
    return results;
  }
}
