/**
 * Language Maestro Agent - Expert in natural language understanding and generation
 * Leverages HuggingFace's best NLP models for comprehensive text intelligence
 */

import HuggingFaceInferenceService from '../services/HuggingFaceInferenceService.js';

export default class LanguageMaestroAgent {
  constructor() {
    this.name = 'LanguageMaestro';
    this.personality =
      'Eloquent linguist with deep understanding of human language and communication';
    this.specializations = [
      'text-generation',
      'text-classification',
      'question-answering',
      'summarization',
      'translation',
      'sentiment-analysis',
      'zero-shot-classification',
      'token-classification',
      'fill-mask',
      'sentence-similarity',
    ];
    this.hfService = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.hfService = new HuggingFaceInferenceService();
      this.isInitialized = true;
      console.log(
        '[LanguageMaestro] 📚 Language intelligence agent initialized'
      );
      return true;
    } catch (error) {
      console.error(
        '[LanguageMaestro] ❌ Initialization failed:',
        error.message
      );
      return false;
    }
  }

  async generateText(prompt, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    const result = await this.hfService.textGeneration(prompt, {
      model: 'microsoft/DialoGPT-large',
      maxTokens: options.maxTokens || 150,
      temperature: options.temperature || 0.7,
      ...options,
    });

    return {
      agent: this.name,
      prompt,
      generatedText: result[0]?.generated_text || result.generated_text,
      parameters: options,
      timestamp: new Date().toISOString(),
    };
  }

  async classifyText(text, labels = null, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    let result;
    if (labels && labels.length > 0) {
      // Zero-shot classification with custom labels
      result = await this.hfService.zeroShotClassification(text, labels, {
        model: 'facebook/bart-large-mnli',
        ...options,
      });

      return {
        agent: this.name,
        text,
        classifications: result.labels.map((label, index) => ({
          label,
          confidence: result.scores[index],
        })),
        predictedLabel: result.labels[0],
        timestamp: new Date().toISOString(),
      };
    } else {
      // Standard text classification (sentiment analysis)
      result = await this.hfService.textClassification(text, {
        model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
        ...options,
      });

      return {
        agent: this.name,
        text,
        classifications: result.map(r => ({
          label: r.label,
          confidence: r.score,
        })),
        sentiment: result[0]?.label,
        confidence: result[0]?.score,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async answerQuestion(question, context, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    const result = await this.hfService.questionAnswering(question, context, {
      model: 'deepset/roberta-base-squad2',
      ...options,
    });

    return {
      agent: this.name,
      question,
      context: context.substring(0, 200) + '...',
      answer: result.answer,
      confidence: result.score,
      startIndex: result.start,
      endIndex: result.end,
      timestamp: new Date().toISOString(),
    };
  }

  async summarizeText(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    const result = await this.hfService.summarization(text, {
      model: 'facebook/bart-large-cnn',
      maxLength: options.maxLength || 150,
      minLength: options.minLength || 30,
      ...options,
    });

    return {
      agent: this.name,
      originalLength: text.length,
      summary: result[0]?.summary_text || result.summary_text,
      compressionRatio:
        text.length /
        (result[0]?.summary_text?.length || result.summary_text?.length || 1),
      timestamp: new Date().toISOString(),
    };
  }

  async translateText(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    // Auto-detect language pair or use provided one
    const model =
      options.model ||
      this.getTranslationModel(options.sourceLang, options.targetLang);

    const result = await this.hfService.translation(text, {
      model,
      ...options,
    });

    return {
      agent: this.name,
      originalText: text,
      translatedText: result[0]?.translation_text || result.translation_text,
      sourceLang: options.sourceLang || 'auto-detected',
      targetLang: options.targetLang || 'detected',
      model,
      timestamp: new Date().toISOString(),
    };
  }

  async extractEntities(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    const result = await this.hfService.tokenClassification(text, {
      model: 'dbmdz/bert-large-cased-finetuned-conll03-english',
      ...options,
    });

    return {
      agent: this.name,
      text,
      entities: result.map(entity => ({
        word: entity.word,
        entity: entity.entity,
        confidence: entity.score,
        start: entity.start,
        end: entity.end,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  async fillInBlanks(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    const result = await this.hfService.fillMask(text, {
      model: 'bert-base-uncased',
      ...options,
    });

    return {
      agent: this.name,
      originalText: text,
      predictions: result.map(pred => ({
        token: pred.token_str,
        confidence: pred.score,
        sequence: pred.sequence,
      })),
      topPrediction: result[0],
      timestamp: new Date().toISOString(),
    };
  }

  async compareSentences(sentences, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    const result = await this.hfService.sentenceSimilarity(sentences, {
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      ...options,
    });

    return {
      agent: this.name,
      sentences,
      similarities: result,
      mostSimilar: Math.max(...result),
      leastSimilar: Math.min(...result),
      timestamp: new Date().toISOString(),
    };
  }

  async analyzeText(text, analysisType = 'comprehensive', options = {}) {
    if (!this.isInitialized) {
      throw new Error('LanguageMaestro agent not initialized');
    }

    const results = {
      agent: this.name,
      analysisType,
      timestamp: new Date().toISOString(),
      results: {},
    };

    try {
      switch (analysisType) {
        case 'sentiment':
          results.results.sentiment = await this.classifyText(
            text,
            null,
            options
          );
          break;

        case 'entities':
          results.results.entities = await this.extractEntities(text, options);
          break;

        case 'summary':
          if (text.length > 100) {
            results.results.summary = await this.summarizeText(text, options);
          }
          break;

        case 'comprehensive':
          // Run multiple analyses in parallel
          const analyses = [];

          // Always do sentiment analysis
          analyses.push(
            this.classifyText(text, null, options).catch(() => null)
          );

          // Entity extraction for longer texts
          if (text.length > 50) {
            analyses.push(
              this.extractEntities(text, options).catch(() => null)
            );
          }

          // Summarization for long texts
          if (text.length > 200) {
            analyses.push(this.summarizeText(text, options).catch(() => null));
          }

          const [sentiment, entities, summary] =
            await Promise.allSettled(analyses);

          results.results.sentiment =
            sentiment.status === 'fulfilled' ? sentiment.value : null;
          results.results.entities =
            entities.status === 'fulfilled' ? entities.value : null;
          results.results.summary =
            summary.status === 'fulfilled' ? summary.value : null;
          break;

        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }

      return results;
    } catch (error) {
      console.error(`[LanguageMaestro] Analysis failed:`, error);
      throw error;
    }
  }

  getTranslationModel(sourceLang, targetLang) {
    const langPair = `${sourceLang || 'en'}-${targetLang || 'de'}`;
    const modelMap = {
      'en-de': 'Helsinki-NLP/opus-mt-en-de',
      'en-fr': 'Helsinki-NLP/opus-mt-en-fr',
      'en-es': 'Helsinki-NLP/opus-mt-en-es',
      'de-en': 'Helsinki-NLP/opus-mt-de-en',
      'fr-en': 'Helsinki-NLP/opus-mt-fr-en',
      'es-en': 'Helsinki-NLP/opus-mt-es-en',
    };

    return modelMap[langPair] || 'facebook/m2m100_418M'; // Fallback to multilingual model
  }

  generateResponse(userMessage, context = {}) {
    const responses = [
      `Let me analyze the linguistic patterns and semantic content of this text.`,
      `I'm processing the natural language structure and extracting meaningful insights.`,
      `Interesting text! I can identify sentiment, entities, and contextual information here.`,
      `My language processing algorithms are analyzing grammar, meaning, and intent.`,
      `I'm applying advanced NLP techniques to understand this text comprehensively.`,
      `Let me examine the linguistic features and extract key information from this content.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  getCapabilities() {
    return {
      name: this.name,
      personality: this.personality,
      specializations: this.specializations,
      features: [
        'Advanced text generation and completion',
        'Multi-class text classification',
        'Context-aware question answering',
        'Intelligent text summarization',
        'Multi-language translation',
        'Named entity recognition',
        'Sentiment and emotion analysis',
        'Zero-shot classification',
        'Semantic text similarity',
        'Fill-in-the-blank predictions',
      ],
    };
  }
}
