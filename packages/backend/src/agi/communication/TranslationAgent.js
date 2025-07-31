// packages/backend/src/agi/communication/TranslationAgent.js

const BaseAgent = require('../../system/BaseAgent');
const MessageBus = require('../../system/EnhancedMessageBus');

class TranslationAgent extends BaseAgent {
  constructor() {
    super('TranslationAgent', 'main', [
      'language_translation',
      'language_detection',
      'localization',
      'cultural_adaptation',
      'multilingual_support',
      'content_localization'
    ]);

    this.setupMessageHandlers();
    this.initializeTranslationEngine();
    this.status = 'ready';
    console.log('[TranslationAgent.main] Agent initialized and ready');
  }

  setupMessageHandlers() {
    // Call parent class method to set up MCP message handlers
    super.setupMessageHandlers();
    
    // Set up translation-specific message handlers
    MessageBus.on('translate.text', this.translateText.bind(this));
    MessageBus.on('detect.language', this.detectLanguage.bind(this));
    MessageBus.on('localize.content', this.localizeContent.bind(this));
    MessageBus.on('cultural.adapt', this.adaptCulturally.bind(this));
    MessageBus.on('validate.translation', this.validateTranslation.bind(this));
    MessageBus.on(`${this.agentId}.health`, this.healthCheck.bind(this));
  }

  initializeTranslationEngine() {
    // Supported languages with ISO codes
    this.supportedLanguages = new Map([
      ['en', { name: 'English', nativeName: 'English', rtl: false, pluralRules: 'en' }],
      ['es', { name: 'Spanish', nativeName: 'Español', rtl: false, pluralRules: 'es' }],
      ['fr', { name: 'French', nativeName: 'Français', rtl: false, pluralRules: 'fr' }],
      ['de', { name: 'German', nativeName: 'Deutsch', rtl: false, pluralRules: 'de' }],
      ['it', { name: 'Italian', nativeName: 'Italiano', rtl: false, pluralRules: 'it' }],
      ['pt', { name: 'Portuguese', nativeName: 'Português', rtl: false, pluralRules: 'pt' }],
      ['ru', { name: 'Russian', nativeName: 'Русский', rtl: false, pluralRules: 'ru' }],
      ['zh', { name: 'Chinese', nativeName: '中文', rtl: false, pluralRules: 'zh' }],
      ['ja', { name: 'Japanese', nativeName: '日本語', rtl: false, pluralRules: 'ja' }],
      ['ko', { name: 'Korean', nativeName: '한국어', rtl: false, pluralRules: 'ko' }],
      ['ar', { name: 'Arabic', nativeName: 'العربية', rtl: true, pluralRules: 'ar' }],
      ['hi', { name: 'Hindi', nativeName: 'हिन्दी', rtl: false, pluralRules: 'hi' }],
      ['nl', { name: 'Dutch', nativeName: 'Nederlands', rtl: false, pluralRules: 'nl' }],
      ['sv', { name: 'Swedish', nativeName: 'Svenska', rtl: false, pluralRules: 'sv' }],
      ['pl', { name: 'Polish', nativeName: 'Polski', rtl: false, pluralRules: 'pl' }]
    ]);

    // Cultural adaptation rules
    this.culturalRules = new Map([
      ['formal_address', {
        'de': 'Use Sie instead of du for formal contexts',
        'fr': 'Use vous instead of tu for formal contexts',
        'es': 'Use usted instead of tú for formal contexts',
        'ja': 'Use appropriate keigo (honorific language)',
        'ko': 'Use appropriate jondaetmal (honorific language)'
      }],
      ['currency_format', {
        'en-US': { symbol: '$', position: 'before', separator: ',' },
        'en-GB': { symbol: '£', position: 'before', separator: ',' },
        'de': { symbol: '€', position: 'after', separator: '.' },
        'fr': { symbol: '€', position: 'after', separator: ' ' },
        'ja': { symbol: '¥', position: 'before', separator: ',' }
      }],
      ['date_format', {
        'en-US': 'MM/DD/YYYY',
        'en-GB': 'DD/MM/YYYY',
        'de': 'DD.MM.YYYY',
        'fr': 'DD/MM/YYYY',
        'ja': 'YYYY/MM/DD',
        'zh': 'YYYY年MM月DD日'
      }]
    ]);

    // Language detection patterns
    this.languagePatterns = new Map([
      ['en', /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi],
      ['es', /\b(el|la|los|las|de|en|a|para|con|por|y|o|pero)\b/gi],
      ['fr', /\b(le|la|les|de|du|des|en|à|pour|avec|par|et|ou|mais)\b/gi],
      ['de', /\b(der|die|das|den|dem|des|und|oder|aber|in|an|auf|für|mit|von)\b/gi],
      ['it', /\b(il|la|lo|gli|le|di|da|in|con|su|per|tra|fra|e|o|ma)\b/gi],
      ['pt', /\b(o|a|os|as|de|em|para|com|por|e|ou|mas|da|do|na|no)\b/gi],
      ['ru', /[а-яё]/gi],
      ['zh', /[\u4e00-\u9fff]/g],
      ['ja', /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g],
      ['ko', /[\uac00-\ud7af]/g],
      ['ar', /[\u0600-\u06ff]/g],
      ['hi', /[\u0900-\u097f]/g]
    ]);

    this.translationMetrics = {
      translations_performed: 0,
      languages_detected: 0,
      content_localized: 0,
      cultural_adaptations: 0,
      validation_checks: 0
    };

    this.translationCache = new Map();
    this.qualityScores = new Map();
  }

  async translateText(message) {
    try {
      const { text, fromLanguage, toLanguage, context, options = {} } = message.payload;
      
      // Auto-detect source language if not provided
      const sourceLanguage = fromLanguage || await this.detectTextLanguage(text);
      
      if (!this.supportedLanguages.has(sourceLanguage) || !this.supportedLanguages.has(toLanguage)) {
        throw new Error(`Unsupported language pair: ${sourceLanguage} -> ${toLanguage}`);
      }

      const translation = await this.performTranslation(
        text,
        sourceLanguage,
        toLanguage,
        context,
        options
      );

      this.translationMetrics.translations_performed++;

      MessageBus.publish(`translate.result.${message.id}`, {
        status: 'completed',
        translation,
        source_language: sourceLanguage,
        target_language: toLanguage,
        timestamp: new Date().toISOString(),
        processing_time: Date.now() - message.timestamp
      });

    } catch (error) {
      console.error('[TranslationAgent] Error translating text:', error);
      MessageBus.publish(`translate.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performTranslation(text, fromLanguage, toLanguage, context, options) {
    // Check cache first
    const cacheKey = `${text}:${fromLanguage}:${toLanguage}`;
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey);
    }

    // Prepare translation prompt with context
    const translationPrompt = this.buildTranslationPrompt(
      text,
      fromLanguage,
      toLanguage,
      context,
      options
    );

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: translationPrompt }],
        temperature: 0.2,
        max_tokens: Math.max(text.length * 2, 500)
      });

      const translatedText = response.choices[0].message.content.trim();
      
      // Analyze translation quality
      const qualityAnalysis = await this.analyzeTranslationQuality(
        text,
        translatedText,
        fromLanguage,
        toLanguage
      );

      const result = {
        translated_text: translatedText,
        confidence: qualityAnalysis.confidence,
        quality_score: qualityAnalysis.score,
        alternatives: qualityAnalysis.alternatives || [],
        cultural_notes: await this.getCulturalNotes(fromLanguage, toLanguage, context),
        formatting: this.preserveTextFormatting(text, translatedText)
      };

      // Cache successful translations
      if (qualityAnalysis.score > 0.7) {
        this.translationCache.set(cacheKey, result);
      }

      return result;

    } catch (error) {
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  buildTranslationPrompt(text, fromLanguage, toLanguage, context, options) {
    const fromLangInfo = this.supportedLanguages.get(fromLanguage);
    const toLangInfo = this.supportedLanguages.get(toLanguage);
    
    let prompt = `Translate the following text from ${fromLangInfo.name} (${fromLanguage}) to ${toLangInfo.name} (${toLanguage}):\n\n"${text}"\n\n`;
    
    if (context) {
      prompt += `Context: ${context}\n\n`;
    }

    prompt += `Translation requirements:
1. Maintain the original meaning and tone
2. Use natural, fluent language in the target language
3. Preserve any technical terms appropriately
4. Consider cultural nuances`;

    if (options.formal === true) {
      prompt += `\n5. Use formal register/politeness level`;
    } else if (options.formal === false) {
      prompt += `\n5. Use informal/casual register`;
    }

    if (options.preserve_formatting) {
      prompt += `\n6. Preserve any markdown, HTML, or special formatting`;
    }

    prompt += `\n\nProvide only the translation without explanations.`;

    return prompt;
  }

  async detectLanguage(message) {
    try {
      const { text, options = {} } = message.payload;
      
      const detection = await this.detectTextLanguage(text, options);
      
      this.translationMetrics.languages_detected++;

      MessageBus.publish(`detect.result.${message.id}`, {
        status: 'completed',
        detection,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[TranslationAgent] Error detecting language:', error);
      MessageBus.publish(`detect.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async detectTextLanguage(text, options = {}) {
    const candidates = new Map();
    
    // Pattern-based detection
    for (const [lang, pattern] of this.languagePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        candidates.set(lang, matches.length);
      }
    }

    // If pattern detection is inconclusive, use AI
    if (candidates.size === 0 || Math.max(...candidates.values()) < 3) {
      return await this.aiLanguageDetection(text);
    }

    // Find language with most matches
    const detectedLang = Array.from(candidates.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    const confidence = this.calculateDetectionConfidence(text, detectedLang, candidates);

    return {
      language: detectedLang,
      language_name: this.supportedLanguages.get(detectedLang)?.name || 'Unknown',
      confidence,
      alternatives: Array.from(candidates.entries())
        .filter(([lang]) => lang !== detectedLang)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([lang, score]) => ({
          language: lang,
          language_name: this.supportedLanguages.get(lang)?.name,
          confidence: score / Math.max(...candidates.values())
        }))
    };
  }

  async aiLanguageDetection(text) {
    const prompt = `Detect the language of this text and respond with only the ISO 639-1 language code (e.g., "en", "es", "fr", etc.):

"${text.substring(0, 200)}"

Language code:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 10
      });

      const detectedLang = response.choices[0].message.content.trim().toLowerCase();
      
      return {
        language: detectedLang,
        language_name: this.supportedLanguages.get(detectedLang)?.name || 'Unknown',
        confidence: 0.85,
        method: 'ai_detection'
      };

    } catch (error) {
      return {
        language: 'en',
        language_name: 'English',
        confidence: 0.1,
        error: 'Detection failed, defaulting to English'
      };
    }
  }

  async localizeContent(message) {
    try {
      const { content, targetLocale, contentType, options = {} } = message.payload;
      
      const localization = await this.performContentLocalization(
        content,
        targetLocale,
        contentType,
        options
      );

      this.translationMetrics.content_localized++;

      MessageBus.publish(`localize.result.${message.id}`, {
        status: 'completed',
        localization,
        target_locale: targetLocale,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[TranslationAgent] Error localizing content:', error);
      MessageBus.publish(`localize.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performContentLocalization(content, targetLocale, contentType, options) {
    const [language, region] = targetLocale.split('-');
    const localization = {
      localized_content: content,
      cultural_adaptations: [],
      formatting_changes: [],
      recommendations: []
    };

    // Apply cultural adaptations
    if (contentType === 'ui' || contentType === 'interface') {
      localization.cultural_adaptations.push(...await this.adaptUIContent(content, targetLocale));
    }

    // Apply date and number formatting
    localization.formatting_changes.push(...this.adaptFormatting(content, targetLocale));

    // Apply currency localization
    if (content.includes('$') || content.includes('price') || content.includes('cost')) {
      localization.formatting_changes.push(...this.adaptCurrency(content, targetLocale));
    }

    // Generate AI-powered cultural recommendations
    localization.ai_recommendations = await this.generateLocalizationRecommendations(
      content,
      targetLocale,
      contentType
    );

    return localization;
  }

  async adaptUIContent(content, targetLocale) {
    const adaptations = [];
    const [language] = targetLocale.split('-');
    const langInfo = this.supportedLanguages.get(language);

    // RTL language adaptations
    if (langInfo?.rtl) {
      adaptations.push({
        type: 'text_direction',
        change: 'Set text direction to RTL',
        css: 'direction: rtl; text-align: right;'
      });
    }

    // Formal address adaptations
    const formalRules = this.culturalRules.get('formal_address');
    if (formalRules && formalRules[language]) {
      adaptations.push({
        type: 'formality',
        change: formalRules[language],
        recommendation: 'Review all user-facing text for appropriate formality level'
      });
    }

    return adaptations;
  }

  adaptFormatting(content, targetLocale) {
    const changes = [];
    
    // Date format adaptation
    const dateFormats = this.culturalRules.get('date_format');
    if (dateFormats && dateFormats[targetLocale]) {
      const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/g;
      if (content.match(dateRegex)) {
        changes.push({
          type: 'date_format',
          original_format: 'MM/DD/YYYY',
          target_format: dateFormats[targetLocale],
          recommendation: `Convert dates to ${dateFormats[targetLocale]} format`
        });
      }
    }

    return changes;
  }

  async analyzeTranslationQuality(originalText, translatedText, fromLang, toLang) {
    // Simple heuristic-based quality analysis
    let score = 0.8; // Base score
    let confidence = 0.8;

    // Length comparison (translated text shouldn't be too different in length)
    const lengthRatio = translatedText.length / originalText.length;
    if (lengthRatio < 0.3 || lengthRatio > 3.0) {
      score -= 0.2;
      confidence -= 0.2;
    }

    // Check for untranslated content (same as original)
    if (originalText === translatedText && fromLang !== toLang) {
      score -= 0.4;
      confidence -= 0.3;
    }

    // Check for obvious errors (repeated words, incomplete sentences)
    const repeatedWords = this.checkRepeatedWords(translatedText);
    if (repeatedWords > 2) {
      score -= 0.1;
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      confidence: Math.max(0, Math.min(1, confidence)),
      issues: score < 0.7 ? ['Quality concerns detected'] : [],
      alternatives: [] // Could be populated with alternative translations
    };
  }

  checkRepeatedWords(text) {
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = new Map();
    
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    return Array.from(wordCount.values()).filter(count => count > 3).length;
  }

  calculateDetectionConfidence(text, detectedLang, candidates) {
    const maxMatches = Math.max(...candidates.values());
    const totalMatches = Array.from(candidates.values()).reduce((sum, count) => sum + count, 0);
    
    return Math.min(0.95, (maxMatches / totalMatches) * 0.8 + 0.2);
  }

  async getCulturalNotes(fromLanguage, toLanguage, context) {
    const notes = [];
    
    // Add cultural context based on language pair
    if (fromLanguage === 'en' && toLanguage === 'ja') {
      notes.push('Consider using appropriate honorific language (keigo) based on context');
    }
    
    if (fromLanguage === 'en' && ['de', 'fr', 'es'].includes(toLanguage)) {
      notes.push('Consider formal vs informal address (Sie/Du, vous/tu, usted/tú)');
    }

    return notes;
  }

  preserveTextFormatting(originalText, translatedText) {
    const formatting = {
      has_markdown: /[*_`#\[\]]/g.test(originalText),
      has_html: /<[^>]+>/g.test(originalText),
      has_urls: /https?:\/\/[^\s]+/g.test(originalText),
      line_breaks: (originalText.match(/\n/g) || []).length
    };

    return formatting;
  }

  async adaptCulturally(message) {
    try {
      const { content, sourceLocale, targetLocale, adaptationType } = message.payload;
      
      const adaptation = await this.performCulturalAdaptation(
        content,
        sourceLocale,
        targetLocale,
        adaptationType
      );

      MessageBus.publish(`cultural.adapt.result.${message.id}`, {
        status: 'completed',
        adaptation,
        source_locale: sourceLocale,
        target_locale: targetLocale,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[TranslationAgent] Error adapting culturally:', error);
      MessageBus.publish(`cultural.adapt.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performCulturalAdaptation(content, sourceLocale, targetLocale, adaptationType) {
    const adaptation = {
      adapted_content: content,
      cultural_notes: [],
      changes_made: [],
      confidence: 0.8
    };

    // Apply cultural context adaptations
    const culturalContext = this.getCulturalContext(sourceLocale, targetLocale);
    
    if (culturalContext.requires_formality_adjustment) {
      adaptation.changes_made.push('Adjusted formality level for target culture');
    }

    if (culturalContext.date_format_different) {
      adaptation.changes_made.push('Converted date formats to local standards');
    }

    if (culturalContext.currency_different) {
      adaptation.changes_made.push('Converted currency formats');
    }

    // Add cultural notes
    adaptation.cultural_notes = await this.getCulturalNotes(sourceLocale, targetLocale, adaptationType);

    return adaptation;
  }

  getCulturalContext(sourceLocale, targetLocale) {
    return {
      requires_formality_adjustment: sourceLocale.startsWith('en') && targetLocale.startsWith('de'),
      date_format_different: true,
      currency_different: sourceLocale !== targetLocale
    };
  }

  async validateTranslation(message) {
    try {
      const { originalText, translatedText, sourceLanguage, targetLanguage } = message.payload;
      
      const validation = await this.performTranslationValidation(
        originalText,
        translatedText,
        sourceLanguage,
        targetLanguage
      );

      MessageBus.publish(`validate.translation.result.${message.id}`, {
        status: 'completed',
        validation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[TranslationAgent] Error validating translation:', error);
      MessageBus.publish(`validate.translation.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performTranslationValidation(originalText, translatedText, sourceLanguage, targetLanguage) {
    const qualityAnalysis = await this.analyzeTranslationQuality(
      originalText,
      translatedText,
      sourceLanguage,
      targetLanguage
    );

    return {
      is_valid: qualityAnalysis.score > 0.6,
      quality_score: qualityAnalysis.score,
      confidence: qualityAnalysis.confidence,
      issues: qualityAnalysis.issues,
      recommendations: qualityAnalysis.issues.length > 0 ? 
        ['Consider retranslation', 'Review cultural context'] : 
        ['Translation appears accurate']
    };
  }

  async generateLocalizationRecommendations(content, targetLocale, contentType) {
    const prompt = `
    Provide cultural localization recommendations for this content:
    
    Content: ${content.substring(0, 500)}
    Target Locale: ${targetLocale}
    Content Type: ${contentType}
    
    Please provide:
    1. Cultural sensitivity considerations
    2. Visual/design adaptations needed
    3. Content modifications for local preferences
    4. Legal/regulatory considerations
    5. Marketing/messaging adaptations
    
    Format as actionable localization recommendations.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800
      });

      return {
        recommendations: response.choices[0].message.content,
        confidence: 0.85,
        source: 'GPT-4 Localization Analysis',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        recommendations: 'Unable to generate localization recommendations at this time',
        confidence: 0.1,
        error: error.message
      };
    }
  }

  healthCheck() {
    return {
      status: this.status,
      agentId: this.agentId,
      capabilities: this.capabilities,
      metrics: {
        translations_performed: this.translationMetrics.translations_performed,
        languages_detected: this.translationMetrics.languages_detected,
        content_localized: this.translationMetrics.content_localized,
        cached_translations: this.translationCache.size,
        supported_languages: this.supportedLanguages.size
      },
      supported_languages: Array.from(this.supportedLanguages.entries()).map(([code, info]) => ({
        code,
        name: info.name,
        native_name: info.nativeName
      })),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new TranslationAgent();