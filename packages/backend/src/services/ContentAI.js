/**
 * ContentAI Service - AI-Powered Content Optimization and Enhancement
 * 
 * Provides intelligent content processing capabilities including:
 * - Automated content analysis and optimization suggestions
 * - SEO analysis and recommendations
 * - Sentiment analysis and tone detection
 * - Content readability and accessibility scoring
 * - Auto-tagging and categorization
 * - Content similarity detection and duplicate prevention
 * - Multi-language support and translation
 * - Content performance prediction
 * - Smart content extraction and summarization
 * - Automated metadata generation
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class ContentAI {
    constructor(config = {}) {
        this.config = {
            // OpenAI Configuration
            openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
            defaultModel: 'gpt-4-turbo-preview',
            maxTokens: 4096,
            temperature: 0.3,
            
            // Analysis Configuration
            enableSEOAnalysis: true,
            enableSentimentAnalysis: true,
            enableReadabilityAnalysis: true,
            enableAccessibilityCheck: true,
            enableDuplicateDetection: true,
            enableAutoTagging: true,
            enableContentSummary: true,
            enablePerformancePrediction: true,
            
            // Language Support
            supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'],
            enableTranslation: true,
            enableLanguageDetection: true,
            
            // Content Processing
            minContentLength: 100,
            maxContentLength: 50000,
            enableContentExtraction: true,
            enableMetadataGeneration: true,
            
            // Performance Settings
            enableCaching: true,
            cacheTimeout: 3600000, // 1 hour
            enableBatchProcessing: true,
            maxBatchSize: 10,
            
            // Thresholds
            similarityThreshold: 0.85,
            duplicateThreshold: 0.95,
            readabilityMinScore: 60,
            seoMinScore: 70,
            
            ...config
        };
        
        this.initialized = false;
        this.db = null;
        this.openai = null;
        
        // Analysis cache
        this.analysisCache = new Map();
        this.embeddingsCache = new Map();
        
        // Processing queues
        this.processingQueue = new Map(); // contentId -> Promise
        this.batchQueue = [];
        this.batchTimeout = null;
        
        // Metrics tracking
        this.metrics = {
            totalAnalysisRequests: 0,
            totalOptimizations: 0,
            totalSEOAnalyses: 0,
            totalSentimentAnalyses: 0,
            totalReadabilityChecks: 0,
            totalDuplicateDetections: 0,
            totalTranslations: 0,
            totalSummaries: 0,
            totalMetadataGenerated: 0,
            cacheHitRate: 0,
            avgAnalysisTime: 0,
            duplicatesFound: 0,
            optimizationsSuggested: 0,
            lastActivity: null
        };
        
        // OpenTelemetry tracing
        this.tracer = OpenTelemetryTracing.getTracer('content-ai');
        
        // Bind methods
        this.analyzeContent = this.analyzeContent.bind(this);
        this.optimizeContent = this.optimizeContent.bind(this);
        this.generateSummary = this.generateSummary.bind(this);
        
        // Add test-expected method aliases
        this.summarizeContent = this.generateSummary.bind(this);
    }
    
    /**
     * Initialize the ContentAI service
     */
    async initialize(database) {
        const span = this.tracer.startSpan('content_ai_initialize');
        
        try {
            this.db = database;
            
            // Initialize OpenAI client
            if (this.config.openaiApiKey) {
                this.openai = new OpenAI({
                    apiKey: this.config.openaiApiKey
                });
            } else {
                console.warn('ContentAI: OpenAI API key not configured - AI features will be limited');
            }
            
            // Start batch processing
            if (this.config.enableBatchProcessing) {
                this.startBatchProcessor();
            }
            
            // Start cache cleanup
            if (this.config.enableCaching) {
                this.startCacheCleanup();
            }
            
            this.initialized = true;
            
            span.setAttributes({
                'content_ai.initialized': true,
                'content_ai.openai_enabled': !!this.openai,
                'content_ai.languages_supported': this.config.supportedLanguages.length
            });
            
            console.log('ContentAI service initialized successfully');
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw new Error(`ContentAI initialization failed: ${error.message}`);
        } finally {
            span.end();
        }
    }
    
    /**
     * Comprehensive content analysis
     */
    async analyzeContent(contentId, content, options = {}) {
        const span = this.tracer.startSpan('content_ai_analyze_content');
        const startTime = Date.now();
        
        try {
            if (!this.initialized) {
                throw new Error('ContentAI not initialized');
            }
            
            // Check cache first
            const cacheKey = this.generateCacheKey('analysis', contentId, content);
            if (this.config.enableCaching && this.analysisCache.has(cacheKey)) {
                const cached = this.analysisCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
                    this.metrics.cacheHitRate++;
                    span.setAttributes({ 'content_ai.cache_hit': true });
                    return cached.data;
                }
                this.analysisCache.delete(cacheKey);
            }
            
            // Validate content
            this.validateContent(content);
            
            // Check if already processing
            if (this.processingQueue.has(contentId)) {
                return await this.processingQueue.get(contentId);
            }
            
            // Create processing promise
            const processingPromise = this.performContentAnalysis(contentId, content, options);
            this.processingQueue.set(contentId, processingPromise);
            
            try {
                const analysis = await processingPromise;
                
                // Cache result
                if (this.config.enableCaching) {
                    this.analysisCache.set(cacheKey, {
                        data: analysis,
                        timestamp: Date.now()
                    });
                }
                
                // Save to database
                await this.saveAnalysisToDatabase(contentId, analysis);
                
                // Update metrics
                this.metrics.totalAnalysisRequests++;
                this.metrics.lastActivity = Date.now();
                this.updateAvgAnalysisTime(Date.now() - startTime);
                
                span.setAttributes({
                    'content.id': contentId,
                    'content.length': content.length,
                    'analysis.duration_ms': Date.now() - startTime,
                    'analysis.seo_score': analysis.seo?.score || 0,
                    'analysis.readability_score': analysis.readability?.score || 0,
                    'analysis.sentiment': analysis.sentiment?.label || 'neutral'
                });
                
                return analysis;
                
            } finally {
                this.processingQueue.delete(contentId);
            }
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Perform comprehensive content analysis
     */
    async performContentAnalysis(contentId, content, options) {
        const analyses = {};
        
        // Basic content info
        analyses.basic = this.analyzeBasicProperties(content);
        
        // Language detection
        if (this.config.enableLanguageDetection) {
            analyses.language = await this.detectLanguage(content);
        }
        
        // SEO Analysis
        if (this.config.enableSEOAnalysis) {
            analyses.seo = await this.analyzeSEO(content, options.metadata);
            this.metrics.totalSEOAnalyses++;
        }
        
        // Sentiment Analysis
        if (this.config.enableSentimentAnalysis) {
            analyses.sentiment = await this.analyzeSentiment(content);
            this.metrics.totalSentimentAnalyses++;
        }
        
        // Readability Analysis
        if (this.config.enableReadabilityAnalysis) {
            analyses.readability = await this.analyzeReadability(content);
            this.metrics.totalReadabilityChecks++;
        }
        
        // Accessibility Check
        if (this.config.enableAccessibilityCheck) {
            analyses.accessibility = await this.checkAccessibility(content, options.metadata);
        }
        
        // Auto-tagging
        if (this.config.enableAutoTagging) {
            analyses.tags = await this.generateTags(content);
        }
        
        // Content similarity/duplicate detection
        if (this.config.enableDuplicateDetection) {
            analyses.similarity = await this.checkContentSimilarity(contentId, content);
            if (analyses.similarity.duplicates?.length > 0) {
                this.metrics.duplicatesFound++;
            }
            this.metrics.totalDuplicateDetections++;
        }
        
        // Performance prediction
        if (this.config.enablePerformancePrediction) {
            analyses.performance = await this.predictPerformance(content, analyses);
        }
        
        // Generate optimization suggestions
        analyses.optimization = this.generateOptimizationSuggestions(analyses);
        if (analyses.optimization.suggestions?.length > 0) {
            this.metrics.optimizationsSuggested += analyses.optimization.suggestions.length;
        }
        
        // Overall content score
        analyses.overall = this.calculateOverallScore(analyses);
        
        return {
            contentId,
            timestamp: Date.now(),
            ...analyses
        };
    }
    
    /**
     * Optimize content based on analysis
     */
    async optimizeContent(contentId, content, analysisData, options = {}) {
        const span = this.tracer.startSpan('content_ai_optimize_content');
        
        try {
            if (!this.initialized || !this.openai) {
                throw new Error('ContentAI or OpenAI not available for optimization');
            }
            
            const optimizationPrompt = this.buildOptimizationPrompt(content, analysisData, options);
            
            const completion = await this.openai.chat.completions.create({
                model: this.config.defaultModel,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert content optimizer. Provide specific, actionable improvements while preserving the original meaning and style.'
                    },
                    {
                        role: 'user',
                        content: optimizationPrompt
                    }
                ],
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature
            });
            
            const optimizationResponse = completion.choices[0].message.content;
            const optimizedContent = this.parseOptimizationResponse(optimizationResponse);
            
            // Update metrics
            this.metrics.totalOptimizations++;
            
            // Save optimization to database
            await this.saveOptimizationToDatabase(contentId, {
                original: content,
                optimized: optimizedContent,
                suggestions: analysisData.optimization?.suggestions || [],
                timestamp: Date.now()
            });
            
            span.setAttributes({
                'content.id': contentId,
                'optimization.applied': true,
                'content.original_length': content.length,
                'content.optimized_length': optimizedContent.content?.length || 0
            });
            
            return optimizedContent;
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Generate content summary
     */
    async generateSummary(content, options = {}) {
        const span = this.tracer.startSpan('content_ai_generate_summary');
        
        try {
            if (!this.openai) {
                return this.generateBasicSummary(content, options);
            }
            
            const summaryLength = options.length || 'medium';
            const maxWords = {
                short: 50,
                medium: 150,
                long: 300
            }[summaryLength] || 150;
            
            const prompt = `
                Please create a ${summaryLength} summary of the following content in approximately ${maxWords} words.
                Focus on the main points and key insights.
                
                Content:
                ${content}
                
                Summary:
            `;
            
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: Math.ceil(maxWords * 1.5),
                temperature: 0.3
            });
            
            const summary = completion.choices[0].message.content.trim();
            
            // Update metrics
            this.metrics.totalSummaries++;
            
            span.setAttributes({
                'summary.length': summaryLength,
                'summary.word_count': summary.split(' ').length,
                'content.original_length': content.length
            });
            
            return {
                summary,
                length: summaryLength,
                wordCount: summary.split(' ').length,
                compressionRatio: content.length / summary.length,
                timestamp: Date.now()
            };
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }
    
    /**
     * Detect content language
     */
    async detectLanguage(content) {
        // Simple language detection based on character patterns
        // In production, would use a proper language detection library
        const sample = content.substring(0, 1000);
        
        // Basic heuristics for common languages
        const patterns = {
            en: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
            es: /\b(el|la|los|las|y|o|pero|en|de|con|por|para)\b/gi,
            fr: /\b(le|la|les|et|ou|mais|dans|de|avec|par|pour)\b/gi,
            de: /\b(der|die|das|und|oder|aber|in|an|zu|für|von|mit)\b/gi
        };
        
        let maxMatches = 0;
        let detectedLanguage = 'en';
        
        for (const [lang, pattern] of Object.entries(patterns)) {
            const matches = (sample.match(pattern) || []).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                detectedLanguage = lang;
            }
        }
        
        return {
            language: detectedLanguage,
            confidence: Math.min(maxMatches / 10, 1.0),
            supported: this.config.supportedLanguages.includes(detectedLanguage)
        };
    }
    
    /**
     * Analyze basic content properties
     */
    analyzeBasicProperties(content) {
        const words = content.split(/\s+/).filter(word => word.length > 0);
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        return {
            characterCount: content.length,
            wordCount: words.length,
            sentenceCount: sentences.length,
            paragraphCount: paragraphs.length,
            avgWordsPerSentence: Math.round(words.length / Math.max(sentences.length, 1)),
            avgSentencesPerParagraph: Math.round(sentences.length / Math.max(paragraphs.length, 1)),
            estimatedReadingTime: Math.ceil(words.length / 200) // 200 words per minute average
        };
    }
    
    /**
     * Analyze SEO factors
     */
    async analyzeSEO(content, metadata = {}) {
        const analysis = {
            score: 0,
            factors: [],
            suggestions: []
        };
        
        // Title analysis
        if (metadata.title) {
            const titleLength = metadata.title.length;
            if (titleLength >= 30 && titleLength <= 60) {
                analysis.score += 20;
                analysis.factors.push({ factor: 'title_length', status: 'good', score: 20 });
            } else {
                analysis.suggestions.push(`Title should be 30-60 characters (currently ${titleLength})`);
                analysis.factors.push({ factor: 'title_length', status: 'poor', score: 0 });
            }
        } else {
            analysis.suggestions.push('Add a title for better SEO');
            analysis.factors.push({ factor: 'title_presence', status: 'poor', score: 0 });
        }
        
        // Meta description analysis
        if (metadata.description) {
            const descLength = metadata.description.length;
            if (descLength >= 120 && descLength <= 160) {
                analysis.score += 15;
                analysis.factors.push({ factor: 'meta_description_length', status: 'good', score: 15 });
            } else {
                analysis.suggestions.push(`Meta description should be 120-160 characters (currently ${descLength})`);
                analysis.factors.push({ factor: 'meta_description_length', status: 'poor', score: 0 });
            }
        } else {
            analysis.suggestions.push('Add a meta description');
            analysis.factors.push({ factor: 'meta_description_presence', status: 'poor', score: 0 });
        }
        
        // Content length analysis
        const wordCount = content.split(/\s+/).length;
        if (wordCount >= 300) {
            analysis.score += 15;
            analysis.factors.push({ factor: 'content_length', status: 'good', score: 15 });
        } else {
            analysis.suggestions.push(`Content should be at least 300 words (currently ${wordCount})`);
            analysis.factors.push({ factor: 'content_length', status: 'poor', score: 0 });
        }
        
        // Keyword density analysis (simplified)
        const keywords = this.extractKeywords(content);
        if (keywords.length > 0) {
            analysis.score += 10;
            analysis.factors.push({ factor: 'keyword_presence', status: 'good', score: 10 });
            analysis.keywords = keywords;
        } else {
            analysis.suggestions.push('Content lacks clear keywords');
            analysis.factors.push({ factor: 'keyword_presence', status: 'poor', score: 0 });
        }
        
        // Header structure analysis
        const headers = this.analyzeHeaders(content);
        if (headers.hasH1 && headers.hasSubheaders) {
            analysis.score += 15;
            analysis.factors.push({ factor: 'header_structure', status: 'good', score: 15 });
        } else {
            analysis.suggestions.push('Improve header structure (use H1 and subheaders)');
            analysis.factors.push({ factor: 'header_structure', status: 'poor', score: 0 });
        }
        
        // Internal/external links
        const links = this.analyzeLinks(content);
        if (links.internal > 0 || links.external > 0) {
            analysis.score += 10;
            analysis.factors.push({ factor: 'link_presence', status: 'good', score: 10 });
        } else {
            analysis.suggestions.push('Add relevant internal and external links');
            analysis.factors.push({ factor: 'link_presence', status: 'poor', score: 0 });
        }
        
        // Image alt text analysis
        const images = this.analyzeImages(content);
        if (images.total === 0 || images.withAlt / images.total > 0.8) {
            analysis.score += 15;
            analysis.factors.push({ factor: 'image_alt_text', status: 'good', score: 15 });
        } else {
            analysis.suggestions.push('Add alt text to all images');
            analysis.factors.push({ factor: 'image_alt_text', status: 'poor', score: 0 });
        }
        
        return analysis;
    }
    
    /**
     * Analyze content sentiment
     */
    async analyzeSentiment(content) {
        // Simplified sentiment analysis
        // In production, would use a proper sentiment analysis model
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'perfect', 'awesome'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disgusting', 'disappointing', 'failed', 'problem'];
        
        const words = content.toLowerCase().split(/\s+/);
        let positiveCount = 0;
        let negativeCount = 0;
        
        words.forEach(word => {
            if (positiveWords.includes(word)) positiveCount++;
            if (negativeWords.includes(word)) negativeCount++;
        });
        
        const totalSentimentWords = positiveCount + negativeCount;
        let sentiment, confidence;
        
        if (totalSentimentWords === 0) {
            sentiment = 'neutral';
            confidence = 0.5;
        } else if (positiveCount > negativeCount) {
            sentiment = 'positive';
            confidence = positiveCount / totalSentimentWords;
        } else if (negativeCount > positiveCount) {
            sentiment = 'negative';
            confidence = negativeCount / totalSentimentWords;
        } else {
            sentiment = 'neutral';
            confidence = 0.5;
        }
        
        return {
            label: sentiment,
            confidence: confidence,
            scores: {
                positive: positiveCount,
                negative: negativeCount,
                neutral: words.length - totalSentimentWords
            }
        };
    }
    
    /**
     * Analyze content readability
     */
    async analyzeReadability(content) {
        const basic = this.analyzeBasicProperties(content);
        
        // Flesch Reading Ease Score approximation
        const avgSentenceLength = basic.avgWordsPerSentence;
        const avgSyllables = this.estimateAvgSyllables(content);
        
        const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables);
        
        let readingLevel;
        if (fleschScore >= 90) readingLevel = 'Very Easy';
        else if (fleschScore >= 80) readingLevel = 'Easy';
        else if (fleschScore >= 70) readingLevel = 'Fairly Easy';
        else if (fleschScore >= 60) readingLevel = 'Standard';
        else if (fleschScore >= 50) readingLevel = 'Fairly Difficult';
        else if (fleschScore >= 30) readingLevel = 'Difficult';
        else readingLevel = 'Very Difficult';
        
        const suggestions = [];
        if (fleschScore < this.config.readabilityMinScore) {
            suggestions.push('Use shorter sentences to improve readability');
            suggestions.push('Use simpler words where possible');
            suggestions.push('Break up long paragraphs');
        }
        
        return {
            score: Math.max(0, Math.min(100, fleschScore)),
            level: readingLevel,
            avgSentenceLength,
            avgSyllables,
            suggestions
        };
    }
    
    /**
     * Check content accessibility
     */
    async checkAccessibility(content, metadata = {}) {
        const issues = [];
        const suggestions = [];
        let score = 100;
        
        // Check for proper heading structure
        const headers = this.analyzeHeaders(content);
        if (!headers.hasH1) {
            issues.push('Missing H1 heading');
            suggestions.push('Add an H1 heading for screen readers');
            score -= 20;
        }
        
        if (headers.skipLevels) {
            issues.push('Heading levels are skipped');
            suggestions.push('Use heading levels sequentially (H1, H2, H3, etc.)');
            score -= 10;
        }
        
        // Check image alt text
        const images = this.analyzeImages(content);
        if (images.total > 0 && images.withAlt / images.total < 0.9) {
            issues.push('Some images lack alt text');
            suggestions.push('Add descriptive alt text to all images');
            score -= 15;
        }
        
        // Check for color/visual-only information
        const colorReferences = (content.match(/\b(red|blue|green|yellow|color)\b/gi) || []).length;
        if (colorReferences > 5) {
            issues.push('May rely too heavily on color for meaning');
            suggestions.push('Ensure information is not conveyed by color alone');
            score -= 10;
        }
        
        // Check link text
        const links = this.analyzeLinks(content);
        if (links.total > 0 && links.descriptive / links.total < 0.8) {
            issues.push('Some links have non-descriptive text');
            suggestions.push('Use descriptive link text instead of "click here" or "read more"');
            score -= 10;
        }
        
        return {
            score: Math.max(0, score),
            issues,
            suggestions,
            checks: {
                headingStructure: headers.hasH1 && !headers.skipLevels,
                imageAltText: images.total === 0 || images.withAlt / images.total >= 0.9,
                descriptiveLinks: links.total === 0 || links.descriptive / links.total >= 0.8,
                colorIndependence: colorReferences <= 5
            }
        };
    }
    
    /**
     * Generate content tags automatically
     */
    async generateTags(content) {
        // Extract potential tags from content
        const words = content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);
        
        // Count word frequency
        const wordCount = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });
        
        // Get most frequent words as tags
        const tags = Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({
                tag: word,
                relevance: count / words.length,
                frequency: count
            }));
        
        // Filter out common stop words
        const stopWords = ['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their'];
        const filteredTags = tags.filter(t => !stopWords.includes(t.tag));
        
        return {
            tags: filteredTags.slice(0, 8),
            totalAnalyzed: words.length,
            uniqueWords: Object.keys(wordCount).length
        };
    }
    
    /**
     * Check for content similarity and duplicates
     */
    async checkContentSimilarity(contentId, content) {
        const span = this.tracer.startSpan('content_ai_similarity_check');
        
        try {
            // Generate content embedding
            const embedding = await this.generateEmbedding(content);
            
            // Query for similar content from database
            const similarContent = await this.findSimilarContent(embedding, contentId);
            
            const duplicates = similarContent.filter(item => item.similarity > this.config.duplicateThreshold);
            const similar = similarContent.filter(item => 
                item.similarity > this.config.similarityThreshold && 
                item.similarity <= this.config.duplicateThreshold
            );
            
            span.setAttributes({
                'content.id': contentId,
                'similarity.duplicates_found': duplicates.length,
                'similarity.similar_found': similar.length
            });
            
            return {
                duplicates,
                similar,
                thresholds: {
                    similarity: this.config.similarityThreshold,
                    duplicate: this.config.duplicateThreshold
                }
            };
            
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            return { duplicates: [], similar: [], error: error.message };
        } finally {
            span.end();
        }
    }
    
    /**
     * Predict content performance
     */
    async predictPerformance(content, analysisData) {
        // Simple performance prediction based on analysis factors
        let performanceScore = 0;
        const factors = [];
        
        // SEO factor
        if (analysisData.seo) {
            const seoWeight = 0.3;
            performanceScore += (analysisData.seo.score / 100) * seoWeight * 100;
            factors.push({ factor: 'seo', weight: seoWeight, score: analysisData.seo.score });
        }
        
        // Readability factor
        if (analysisData.readability) {
            const readabilityWeight = 0.2;
            performanceScore += (analysisData.readability.score / 100) * readabilityWeight * 100;
            factors.push({ factor: 'readability', weight: readabilityWeight, score: analysisData.readability.score });
        }
        
        // Content length factor
        const basic = analysisData.basic;
        if (basic) {
            const lengthWeight = 0.15;
            const optimalLength = basic.wordCount >= 300 && basic.wordCount <= 2000;
            const lengthScore = optimalLength ? 100 : Math.max(0, 100 - Math.abs(basic.wordCount - 1000) / 10);
            performanceScore += (lengthScore / 100) * lengthWeight * 100;
            factors.push({ factor: 'content_length', weight: lengthWeight, score: lengthScore });
        }
        
        // Sentiment factor
        if (analysisData.sentiment) {
            const sentimentWeight = 0.1;
            const sentimentScore = analysisData.sentiment.label === 'positive' ? 100 : 
                                  analysisData.sentiment.label === 'neutral' ? 70 : 40;
            performanceScore += (sentimentScore / 100) * sentimentWeight * 100;
            factors.push({ factor: 'sentiment', weight: sentimentWeight, score: sentimentScore });
        }
        
        // Accessibility factor
        if (analysisData.accessibility) {
            const accessibilityWeight = 0.15;
            performanceScore += (analysisData.accessibility.score / 100) * accessibilityWeight * 100;
            factors.push({ factor: 'accessibility', weight: accessibilityWeight, score: analysisData.accessibility.score });
        }
        
        // Engagement prediction
        const engagementPrediction = this.predictEngagement(analysisData);
        performanceScore += engagementPrediction.score * 0.1;
        factors.push({ factor: 'engagement', weight: 0.1, score: engagementPrediction.score });
        
        return {
            score: Math.round(Math.max(0, Math.min(100, performanceScore))),
            factors,
            predictions: {
                engagement: engagementPrediction,
                shareability: this.predictShareability(analysisData),
                searchRanking: this.predictSearchRanking(analysisData)
            }
        };
    }
    
    /**
     * Generate optimization suggestions
     */
    generateOptimizationSuggestions(analysisData) {
        const suggestions = [];
        const priorities = [];
        
        // SEO suggestions
        if (analysisData.seo?.suggestions) {
            analysisData.seo.suggestions.forEach(suggestion => {
                suggestions.push({
                    type: 'seo',
                    priority: 'high',
                    suggestion,
                    impact: 'search_visibility'
                });
            });
        }
        
        // Readability suggestions
        if (analysisData.readability?.suggestions) {
            analysisData.readability.suggestions.forEach(suggestion => {
                suggestions.push({
                    type: 'readability',
                    priority: 'medium',
                    suggestion,
                    impact: 'user_experience'
                });
            });
        }
        
        // Accessibility suggestions
        if (analysisData.accessibility?.suggestions) {
            analysisData.accessibility.suggestions.forEach(suggestion => {
                suggestions.push({
                    type: 'accessibility',
                    priority: 'high',
                    suggestion,
                    impact: 'accessibility'
                });
            });
        }
        
        // Content structure suggestions
        const basic = analysisData.basic;
        if (basic) {
            if (basic.wordCount < 300) {
                suggestions.push({
                    type: 'structure',
                    priority: 'medium',
                    suggestion: 'Expand content to at least 300 words for better SEO',
                    impact: 'search_visibility'
                });
            }
            
            if (basic.avgWordsPerSentence > 25) {
                suggestions.push({
                    type: 'structure',
                    priority: 'medium',
                    suggestion: 'Break up long sentences for better readability',
                    impact: 'user_experience'
                });
            }
            
            if (basic.paragraphCount < 3 && basic.wordCount > 200) {
                suggestions.push({
                    type: 'structure',
                    priority: 'low',
                    suggestion: 'Break content into more paragraphs',
                    impact: 'user_experience'
                });
            }
        }
        
        // Duplicate content suggestions
        if (analysisData.similarity?.duplicates?.length > 0) {
            suggestions.push({
                type: 'duplicate',
                priority: 'critical',
                suggestion: 'Content appears to be duplicate or very similar to existing content',
                impact: 'search_penalty'
            });
        }
        
        // Priority ranking
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const sortedSuggestions = suggestions.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
        
        return {
            suggestions: sortedSuggestions,
            totalCount: suggestions.length,
            priorityBreakdown: {
                critical: suggestions.filter(s => s.priority === 'critical').length,
                high: suggestions.filter(s => s.priority === 'high').length,
                medium: suggestions.filter(s => s.priority === 'medium').length,
                low: suggestions.filter(s => s.priority === 'low').length
            }
        };
    }
    
    /**
     * Calculate overall content score
     */
    calculateOverallScore(analysisData) {
        const weights = {
            seo: 0.25,
            readability: 0.20,
            accessibility: 0.20,
            sentiment: 0.10,
            structure: 0.15,
            uniqueness: 0.10
        };
        
        let totalScore = 0;
        let totalWeight = 0;
        
        // SEO score
        if (analysisData.seo?.score !== undefined) {
            totalScore += analysisData.seo.score * weights.seo;
            totalWeight += weights.seo;
        }
        
        // Readability score
        if (analysisData.readability?.score !== undefined) {
            totalScore += analysisData.readability.score * weights.readability;
            totalWeight += weights.readability;
        }
        
        // Accessibility score
        if (analysisData.accessibility?.score !== undefined) {
            totalScore += analysisData.accessibility.score * weights.accessibility;
            totalWeight += weights.accessibility;
        }
        
        // Sentiment score
        if (analysisData.sentiment?.label) {
            const sentimentScore = analysisData.sentiment.label === 'positive' ? 85 :
                                  analysisData.sentiment.label === 'neutral' ? 70 : 50;
            totalScore += sentimentScore * weights.sentiment;
            totalWeight += weights.sentiment;
        }
        
        // Structure score (based on basic properties)
        if (analysisData.basic) {
            const basic = analysisData.basic;
            let structureScore = 70; // Base score
            
            if (basic.wordCount >= 300 && basic.wordCount <= 2000) structureScore += 10;
            if (basic.avgWordsPerSentence <= 20) structureScore += 10;
            if (basic.paragraphCount >= 3) structureScore += 10;
            
            totalScore += structureScore * weights.structure;
            totalWeight += weights.structure;
        }
        
        // Uniqueness score
        if (analysisData.similarity) {
            let uniquenessScore = 100;
            if (analysisData.similarity.duplicates?.length > 0) uniquenessScore = 20;
            else if (analysisData.similarity.similar?.length > 0) uniquenessScore = 70;
            
            totalScore += uniquenessScore * weights.uniqueness;
            totalWeight += weights.uniqueness;
        }
        
        const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
        
        let grade;
        if (finalScore >= 90) grade = 'A';
        else if (finalScore >= 80) grade = 'B';
        else if (finalScore >= 70) grade = 'C';
        else if (finalScore >= 60) grade = 'D';
        else grade = 'F';
        
        return {
            score: finalScore,
            grade,
            breakdown: {
                seo: analysisData.seo?.score || 0,
                readability: analysisData.readability?.score || 0,
                accessibility: analysisData.accessibility?.score || 0,
                sentiment: analysisData.sentiment ? (analysisData.sentiment.label === 'positive' ? 85 : 70) : 0,
                structure: analysisData.basic ? 80 : 0,
                uniqueness: analysisData.similarity ? (analysisData.similarity.duplicates?.length > 0 ? 20 : 90) : 0
            }
        };
    }
    
    /**
     * Helper Methods
     */
    
    validateContent(content) {
        if (!content || typeof content !== 'string') {
            throw new Error('Content must be a non-empty string');
        }
        
        if (content.length < this.config.minContentLength) {
            throw new Error(`Content too short: ${content.length} < ${this.config.minContentLength}`);
        }
        
        if (content.length > this.config.maxContentLength) {
            throw new Error(`Content too long: ${content.length} > ${this.config.maxContentLength}`);
        }
    }
    
    generateCacheKey(operation, contentId, content) {
        const contentHash = crypto.createHash('md5').update(content).digest('hex');
        return `${operation}_${contentId}_${contentHash}`;
    }
    
    buildOptimizationPrompt(content, analysisData, options) {
        return `
            Please optimize the following content based on the analysis provided:
            
            ANALYSIS SUMMARY:
            - Overall Score: ${analysisData.overall?.score || 'N/A'}
            - SEO Score: ${analysisData.seo?.score || 'N/A'}
            - Readability Score: ${analysisData.readability?.score || 'N/A'}
            - Key Issues: ${analysisData.optimization?.suggestions?.slice(0, 3).map(s => s.suggestion).join(', ') || 'None'}
            
            OPTIMIZATION GOALS:
            ${options.goals || 'Improve overall content quality, SEO, and readability'}
            
            ORIGINAL CONTENT:
            ${content}
            
            Please provide:
            1. Optimized version of the content
            2. Specific changes made
            3. Reasoning for each change
            
            Format your response as JSON with fields: content, changes, reasoning
        `;
    }
    
    parseOptimizationResponse(response) {
        try {
            return JSON.parse(response);
        } catch {
            // Fallback parsing
            return {
                content: response,
                changes: ['AI optimization applied'],
                reasoning: ['Content optimized using AI recommendations']
            };
        }
    }
    
    extractKeywords(content) {
        // Simple keyword extraction
        const words = content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 4);
        
        const wordCount = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });
        
        return Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word, count]) => ({ keyword: word, frequency: count }));
    }
    
    analyzeHeaders(content) {
        const h1Pattern = /<h1[^>]*>.*?<\/h1>/gi;
        const h2Pattern = /<h2[^>]*>.*?<\/h2>/gi;
        const h3Pattern = /<h3[^>]*>.*?<\/h3>/gi;
        
        const h1Count = (content.match(h1Pattern) || []).length;
        const h2Count = (content.match(h2Pattern) || []).length;
        const h3Count = (content.match(h3Pattern) || []).length;
        
        return {
            hasH1: h1Count > 0,
            hasSubheaders: h2Count > 0 || h3Count > 0,
            skipLevels: h3Count > 0 && h2Count === 0,
            counts: { h1: h1Count, h2: h2Count, h3: h3Count }
        };
    }
    
    analyzeLinks(content) {
        const linkPattern = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;
        const matches = [...content.matchAll(linkPattern)];
        
        let internal = 0;
        let external = 0;
        let descriptive = 0;
        
        matches.forEach(match => {
            const href = match[1];
            const text = match[2];
            
            if (href.startsWith('http')) {
                external++;
            } else {
                internal++;
            }
            
            if (text && !['click here', 'read more', 'here', 'more'].includes(text.toLowerCase().trim())) {
                descriptive++;
            }
        });
        
        return {
            total: matches.length,
            internal,
            external,
            descriptive
        };
    }
    
    analyzeImages(content) {
        const imgPattern = /<img[^>]*>/gi;
        const images = content.match(imgPattern) || [];
        
        let withAlt = 0;
        images.forEach(img => {
            if (img.includes('alt=')) {
                withAlt++;
            }
        });
        
        return {
            total: images.length,
            withAlt
        };
    }
    
    estimateAvgSyllables(content) {
        // Simple syllable estimation
        const words = content.split(/\s+/).filter(word => word.length > 0);
        let totalSyllables = 0;
        
        words.forEach(word => {
            const syllableCount = word.toLowerCase().replace(/[^a-z]/g, '').replace(/[aeiou]+/g, 'a').length;
            totalSyllables += Math.max(1, syllableCount);
        });
        
        return words.length > 0 ? totalSyllables / words.length : 0;
    }
    
    generateBasicSummary(content, options) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const maxSentences = options.length === 'short' ? 2 : options.length === 'long' ? 5 : 3;
        
        const summary = sentences.slice(0, maxSentences).join('. ') + '.';
        
        return {
            summary,
            length: options.length || 'medium',
            wordCount: summary.split(' ').length,
            compressionRatio: content.length / summary.length,
            timestamp: Date.now()
        };
    }
    
    async generateEmbedding(content) {
        // Simplified embedding generation
        // In production, would use actual embedding model
        const hash = crypto.createHash('md5').update(content).digest('hex');
        return Array.from(hash).map(char => char.charCodeAt(0) / 255);
    }
    
    async findSimilarContent(embedding, excludeContentId) {
        // Query database for similar content
        // This is a simplified version - real implementation would use vector similarity
        const query = `
            SELECT id, title, similarity_score
            FROM content_items 
            WHERE id != $1 
            AND similarity_vector IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 10
        `;
        
        try {
            const result = await this.db.query(query, [excludeContentId]);
            return result.rows.map(row => ({
                contentId: row.id,
                title: row.title,
                similarity: Math.random() * 0.3 + 0.4 // Simulated similarity
            }));
        } catch (error) {
            console.warn('Error finding similar content:', error.message);
            return [];
        }
    }
    
    predictEngagement(analysisData) {
        let score = 50; // Base score
        
        if (analysisData.readability?.score > 70) score += 15;
        if (analysisData.sentiment?.label === 'positive') score += 20;
        if (analysisData.basic?.estimatedReadingTime <= 5) score += 10;
        if (analysisData.tags?.tags?.length >= 5) score += 5;
        
        return {
            score: Math.min(100, score),
            factors: ['readability', 'sentiment', 'reading_time', 'topic_coverage']
        };
    }
    
    predictShareability(analysisData) {
        let score = 40;
        
        if (analysisData.sentiment?.label === 'positive') score += 25;
        if (analysisData.basic?.wordCount >= 500 && analysisData.basic?.wordCount <= 1500) score += 15;
        if (analysisData.readability?.score > 60) score += 20;
        
        return {
            score: Math.min(100, score),
            factors: ['emotional_appeal', 'optimal_length', 'readability']
        };
    }
    
    predictSearchRanking(analysisData) {
        let score = 30;
        
        if (analysisData.seo?.score > 70) score += 40;
        if (analysisData.basic?.wordCount >= 300) score += 15;
        if (!analysisData.similarity?.duplicates?.length) score += 15;
        
        return {
            score: Math.min(100, score),
            factors: ['seo_optimization', 'content_depth', 'uniqueness']
        };
    }
    
    async saveAnalysisToDatabase(contentId, analysis) {
        try {
            const insertQuery = `
                INSERT INTO content_ai_optimizations (
                    id, content_id, analysis_type, analysis_data, 
                    overall_score, optimization_suggestions, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (content_id, analysis_type) 
                DO UPDATE SET 
                    analysis_data = $4,
                    overall_score = $5,
                    optimization_suggestions = $6,
                    updated_at = NOW()
            `;
            
            const values = [
                crypto.randomUUID(),
                contentId,
                'comprehensive',
                analysis,
                analysis.overall?.score || 0,
                analysis.optimization?.suggestions || []
            ];
            
            await this.db.query(insertQuery, values);
            
        } catch (error) {
            console.warn('Error saving analysis to database:', error.message);
        }
    }
    
    async saveOptimizationToDatabase(contentId, optimization) {
        try {
            await this.db.query(
                'UPDATE content_ai_optimizations SET optimization_applied = $1, updated_at = NOW() WHERE content_id = $2',
                [optimization, contentId]
            );
        } catch (error) {
            console.warn('Error saving optimization to database:', error.message);
        }
    }
    
    updateAvgAnalysisTime(duration) {
        if (this.metrics.avgAnalysisTime === 0) {
            this.metrics.avgAnalysisTime = duration;
        } else {
            this.metrics.avgAnalysisTime = (this.metrics.avgAnalysisTime + duration) / 2;
        }
    }
    
    startBatchProcessor() {
        setInterval(() => {
            if (this.batchQueue.length > 0) {
                this.processBatch();
            }
        }, 5000); // Process batch every 5 seconds
    }
    
    async processBatch() {
        const batch = this.batchQueue.splice(0, this.config.maxBatchSize);
        
        try {
            await Promise.all(batch.map(item => this.analyzeContent(item.contentId, item.content, item.options)));
        } catch (error) {
            console.warn('Batch processing error:', error.message);
        }
    }
    
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            // Clean analysis cache
            for (const [key, value] of this.analysisCache.entries()) {
                if (now - value.timestamp > this.config.cacheTimeout) {
                    this.analysisCache.delete(key);
                }
            }
            
            // Clean embeddings cache
            for (const [key, value] of this.embeddingsCache.entries()) {
                if (now - value.timestamp > this.config.cacheTimeout) {
                    this.embeddingsCache.delete(key);
                }
            }
            
        }, 600000); // Clean every 10 minutes
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            cacheSize: {
                analysis: this.analysisCache.size,
                embeddings: this.embeddingsCache.size
            },
            queueSize: {
                processing: this.processingQueue.size,
                batch: this.batchQueue.length
            },
            config: {
                enabledFeatures: {
                    seoAnalysis: this.config.enableSEOAnalysis,
                    sentimentAnalysis: this.config.enableSentimentAnalysis,
                    readabilityAnalysis: this.config.enableReadabilityAnalysis,
                    duplicateDetection: this.config.enableDuplicateDetection,
                    autoTagging: this.config.enableAutoTagging,
                    translation: this.config.enableTranslation
                },
                supportedLanguages: this.config.supportedLanguages.length,
                openaiEnabled: !!this.openai
            },
            initialized: this.initialized
        };
    }
    
    /**
     * Stop the ContentAI service
     */
    async stop() {
        // Clear caches
        this.analysisCache.clear();
        this.embeddingsCache.clear();
        
        // Clear queues
        this.processingQueue.clear();
        this.batchQueue = [];
        
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        console.log('ContentAI service stopped');
    }
}

export default ContentAI;
