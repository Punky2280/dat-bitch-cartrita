/**
 * @fileoverview Contextual Awareness Service
 * @description Advanced service for real-time context understanding,
 * sentiment analysis, and adaptive response generation
 */

import EventEmitter from 'events';
import { OpenAI } from 'openai';

class ContextualAwarenessService extends EventEmitter {
  constructor() {
    super();
    this.userContexts = new Map(); // userId -> context
    this.conversationHistory = new Map(); // userId -> messages[]
    this.sentimentHistory = new Map(); // userId -> sentiments[]
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.isEnabled = !!process.env.OPENAI_API_KEY;
    
    // Context analysis intervals
    this.contextAnalysisInterval = 30000; // 30 seconds
    this.sentimentAnalysisInterval = 10000; // 10 seconds
    
    this.initializeService();
  }

  initializeService() {
    console.log('[ContextualAwareness] Service initializing...');
    
    // Periodic context analysis
    setInterval(() => {
      this.performPeriodicContextAnalysis();
    }, this.contextAnalysisInterval);

    // Periodic sentiment analysis
    setInterval(() => {
      this.performPeriodicSentimentAnalysis();
    }, this.sentimentAnalysisInterval);

    console.log('[ContextualAwareness] Service initialized successfully');
  }

  /**
   * Initialize context for a user session
   */
  initializeUserContext(userId, initialData = {}) {
    const context = {
      userId,
      sessionStart: new Date(),
      currentState: 'neutral',
      emotionalContext: {
        currentMood: 'neutral',
        stressLevel: 0.5,
        engagementLevel: 0.7,
        frustrationLevel: 0.3
      },
      conversationContext: {
        currentTopic: null,
        topicHistory: [],
        questionCount: 0,
        requestTypes: [],
        complexity: 'medium'
      },
      behavioralPatterns: {
        responsePreference: 'balanced', // brief, balanced, detailed
        communicationStyle: 'casual', // formal, casual, technical
        preferredFeatures: [],
        timeOfDayPatterns: {},
        averageSessionLength: 0
      },
      environmentalContext: {
        timeZone: initialData.timeZone || 'UTC',
        language: initialData.language || 'en',
        deviceType: initialData.deviceType || 'desktop',
        connectivity: initialData.connectivity || 'good'
      },
      adaptiveSettings: {
        responseStyle: 'empathetic',
        responseLength: 'moderate',
        technicalLevel: 'medium',
        patience: 'high'
      },
      lastUpdate: new Date(),
      metrics: {
        totalMessages: 0,
        averageResponseTime: 0,
        satisfactionScore: 0.8,
        taskCompletionRate: 0.7
      }
    };

    this.userContexts.set(userId, context);
    this.conversationHistory.set(userId, []);
    this.sentimentHistory.set(userId, []);

    console.log(`[ContextualAwareness] Context initialized for user ${userId}`);
    return context;
  }

  /**
   * Update context based on user message
   */
  async updateContextFromMessage(userId, message, metadata = {}) {
    if (!this.isEnabled) return null;

    let context = this.userContexts.get(userId);
    if (!context) {
      context = this.initializeUserContext(userId);
    }

    // Add message to history
    const messageEntry = {
      content: message,
      timestamp: new Date(),
      metadata,
      processed: false
    };

    const history = this.conversationHistory.get(userId) || [];
    history.push(messageEntry);
    this.conversationHistory.set(userId, history.slice(-50)); // Keep last 50 messages

    // Analyze message for immediate context updates
    try {
      const analysis = await this.analyzeMessageContext(message, context);
      
      // Update context based on analysis
      this.updateContextFromAnalysis(userId, analysis);

      // Emit context update event
      this.emit('contextUpdated', { userId, context, analysis });

      return analysis;
    } catch (error) {
      console.error('[ContextualAwareness] Error updating context:', error);
      return null;
    }
  }

  /**
   * Analyze message context using AI
   */
  async analyzeMessageContext(message, userContext) {
    if (!this.isEnabled) return null;

    try {
      const prompt = `
        Analyze this user message for contextual understanding:
        
        Message: "${message}"
        
        Current user context:
        - Current mood: ${userContext.emotionalContext.currentMood}
        - Stress level: ${userContext.emotionalContext.stressLevel}
        - Communication style: ${userContext.behavioralPatterns.communicationStyle}
        - Current topic: ${userContext.conversationContext.currentTopic || 'none'}
        
        Provide analysis in JSON format:
        {
          "sentiment": {
            "overall": "positive|negative|neutral",
            "confidence": 0.0-1.0,
            "emotions": ["emotion1", "emotion2"],
            "intensity": 0.0-1.0
          },
          "intent": {
            "primary": "question|request|complaint|greeting|goodbye|other",
            "secondary": ["intent1", "intent2"],
            "urgency": "low|medium|high",
            "complexity": "simple|medium|complex"
          },
          "topic": {
            "current": "topic_name",
            "category": "technical|personal|business|casual",
            "isNewTopic": true|false
          },
          "contextualCues": {
            "stressIndicators": ["indicator1", "indicator2"],
            "engagementLevel": 0.0-1.0,
            "needsSupport": true|false,
            "preferredResponseStyle": "brief|detailed|empathetic|technical"
          },
          "adaptiveRecommendations": {
            "responseStyle": "empathetic|analytical|casual|professional",
            "responseLength": "brief|moderate|detailed",
            "tone": "supportive|neutral|encouraging|careful"
          }
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in contextual analysis and emotional intelligence. Provide accurate, nuanced analysis in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const analysisText = response.choices[0]?.message?.content;
      return JSON.parse(analysisText);

    } catch (error) {
      console.error('[ContextualAwareness] Error analyzing message context:', error);
      return this.getFallbackAnalysis(message);
    }
  }

  /**
   * Update user context based on analysis
   */
  updateContextFromAnalysis(userId, analysis) {
    const context = this.userContexts.get(userId);
    if (!context || !analysis) return;

    // Update emotional context
    if (analysis.sentiment) {
      context.emotionalContext.currentMood = analysis.sentiment.overall;
      
      // Update stress level based on sentiment and contextual cues
      if (analysis.contextualCues?.stressIndicators?.length > 0) {
        context.emotionalContext.stressLevel = Math.min(1.0, 
          context.emotionalContext.stressLevel + 0.1 * analysis.contextualCues.stressIndicators.length
        );
      } else if (analysis.sentiment.overall === 'positive') {
        context.emotionalContext.stressLevel = Math.max(0.0, 
          context.emotionalContext.stressLevel - 0.05
        );
      }

      // Update engagement level
      if (analysis.contextualCues?.engagementLevel !== undefined) {
        context.emotionalContext.engagementLevel = 
          (context.emotionalContext.engagementLevel + analysis.contextualCues.engagementLevel) / 2;
      }
    }

    // Update conversation context
    if (analysis.topic) {
      if (analysis.topic.isNewTopic) {
        context.conversationContext.topicHistory.push(context.conversationContext.currentTopic);
      }
      context.conversationContext.currentTopic = analysis.topic.current;
      
      if (analysis.intent?.primary === 'question') {
        context.conversationContext.questionCount++;
      }
      
      context.conversationContext.requestTypes.push(analysis.intent?.primary);
      context.conversationContext.complexity = analysis.intent?.complexity || 'medium';
    }

    // Update adaptive settings based on recommendations
    if (analysis.adaptiveRecommendations) {
      const recs = analysis.adaptiveRecommendations;
      context.adaptiveSettings.responseStyle = recs.responseStyle || context.adaptiveSettings.responseStyle;
      context.adaptiveSettings.responseLength = recs.responseLength || context.adaptiveSettings.responseLength;
      
      // Update patience based on stress and frustration
      if (context.emotionalContext.stressLevel > 0.7) {
        context.adaptiveSettings.patience = 'high';
      } else if (context.emotionalContext.stressLevel < 0.3) {
        context.adaptiveSettings.patience = 'medium';
      }
    }

    // Update metrics
    context.metrics.totalMessages++;
    context.lastUpdate = new Date();

    // Add sentiment to history
    const sentiments = this.sentimentHistory.get(userId) || [];
    sentiments.push({
      timestamp: new Date(),
      sentiment: analysis.sentiment?.overall || 'neutral',
      confidence: analysis.sentiment?.confidence || 0.5,
      emotions: analysis.sentiment?.emotions || [],
      stressLevel: context.emotionalContext.stressLevel
    });
    this.sentimentHistory.set(userId, sentiments.slice(-100)); // Keep last 100 sentiment entries

    this.userContexts.set(userId, context);
  }

  /**
   * Get contextual response recommendations
   */
  getResponseRecommendations(userId, proposedResponse) {
    const context = this.userContexts.get(userId);
    if (!context) return { style: 'casual', length: 'moderate', tone: 'neutral' };

    const recommendations = {
      style: context.adaptiveSettings.responseStyle,
      length: context.adaptiveSettings.responseLength,
      tone: this.determineTone(context),
      adaptations: this.getAdaptations(context),
      warnings: this.getContextualWarnings(context)
    };

    // Adjust based on current stress and engagement
    if (context.emotionalContext.stressLevel > 0.7) {
      recommendations.tone = 'supportive';
      recommendations.style = 'empathetic';
      recommendations.adaptations.push('Use calming language');
      recommendations.adaptations.push('Offer step-by-step guidance');
    }

    if (context.emotionalContext.engagementLevel < 0.4) {
      recommendations.adaptations.push('Use more engaging language');
      recommendations.adaptations.push('Ask follow-up questions');
    }

    return recommendations;
  }

  /**
   * Determine appropriate tone based on context
   */
  determineTone(context) {
    const stress = context.emotionalContext.stressLevel;
    const mood = context.emotionalContext.currentMood;
    const engagement = context.emotionalContext.engagementLevel;

    if (stress > 0.7) return 'supportive';
    if (mood === 'negative' && stress > 0.5) return 'careful';
    if (engagement > 0.8 && mood === 'positive') return 'encouraging';
    if (context.conversationContext.complexity === 'complex') return 'patient';
    
    return 'neutral';
  }

  /**
   * Get contextual adaptations
   */
  getAdaptations(context) {
    const adaptations = [];
    
    if (context.conversationContext.questionCount > 5) {
      adaptations.push('User has asked many questions - check if they need different approach');
    }
    
    if (context.emotionalContext.frustrationLevel > 0.6) {
      adaptations.push('High frustration detected - prioritize solution-focused responses');
    }
    
    if (context.behavioralPatterns.responsePreference === 'brief') {
      adaptations.push('User prefers concise responses');
    }
    
    return adaptations;
  }

  /**
   * Get contextual warnings
   */
  getContextualWarnings(context) {
    const warnings = [];
    
    if (context.emotionalContext.stressLevel > 0.8) {
      warnings.push('HIGH_STRESS: User appears to be under significant stress');
    }
    
    if (context.emotionalContext.engagementLevel < 0.3) {
      warnings.push('LOW_ENGAGEMENT: User engagement is very low');
    }
    
    const recentSentiments = this.sentimentHistory.get(context.userId) || [];
    const recentNegative = recentSentiments.slice(-5).filter(s => s.sentiment === 'negative');
    if (recentNegative.length >= 3) {
      warnings.push('NEGATIVE_TREND: Multiple negative sentiments detected recently');
    }
    
    return warnings;
  }

  /**
   * Fallback analysis when AI is unavailable
   */
  getFallbackAnalysis(message) {
    const isQuestion = message.includes('?') || 
                     message.toLowerCase().startsWith('how') ||
                     message.toLowerCase().startsWith('what') ||
                     message.toLowerCase().startsWith('why');
    
    const hasNegativeWords = /\b(error|fail|problem|issue|broken|wrong|bad)\b/i.test(message);
    const hasPositiveWords = /\b(good|great|awesome|perfect|love|excellent)\b/i.test(message);
    
    return {
      sentiment: {
        overall: hasNegativeWords ? 'negative' : hasPositiveWords ? 'positive' : 'neutral',
        confidence: 0.6,
        emotions: [],
        intensity: 0.5
      },
      intent: {
        primary: isQuestion ? 'question' : 'request',
        urgency: 'medium',
        complexity: 'medium'
      },
      topic: {
        current: 'general',
        category: 'casual',
        isNewTopic: false
      },
      contextualCues: {
        stressIndicators: hasNegativeWords ? ['negative_language'] : [],
        engagementLevel: 0.7,
        needsSupport: hasNegativeWords
      },
      adaptiveRecommendations: {
        responseStyle: hasNegativeWords ? 'empathetic' : 'casual',
        responseLength: 'moderate',
        tone: hasNegativeWords ? 'supportive' : 'neutral'
      }
    };
  }

  /**
   * Periodic context analysis
   */
  async performPeriodicContextAnalysis() {
    for (const [userId, context] of this.userContexts.entries()) {
      try {
        // Analyze conversation patterns
        const history = this.conversationHistory.get(userId) || [];
        const recentMessages = history.slice(-10);
        
        if (recentMessages.length > 0) {
          // Update behavioral patterns
          this.updateBehavioralPatterns(userId, recentMessages);
          
          // Check for concerning patterns
          this.checkForConcerningPatterns(userId, context);
        }
        
        // Clean up old contexts (older than 24 hours of inactivity)
        const timeSinceUpdate = Date.now() - context.lastUpdate.getTime();
        if (timeSinceUpdate > 24 * 60 * 60 * 1000) {
          this.cleanupUserContext(userId);
        }
        
      } catch (error) {
        console.error(`[ContextualAwareness] Error in periodic analysis for user ${userId}:`, error);
      }
    }
  }

  /**
   * Periodic sentiment analysis
   */
  async performPeriodicSentimentAnalysis() {
    for (const [userId, sentiments] of this.sentimentHistory.entries()) {
      try {
        if (sentiments.length < 5) continue;
        
        const recent = sentiments.slice(-10);
        const avgSentimentScore = recent.reduce((sum, s) => {
          const score = s.sentiment === 'positive' ? 1 : s.sentiment === 'negative' ? -1 : 0;
          return sum + score;
        }, 0) / recent.length;
        
        const context = this.userContexts.get(userId);
        if (context) {
          // Update satisfaction score based on sentiment trend
          context.metrics.satisfactionScore = Math.max(0, Math.min(1, 0.5 + avgSentimentScore * 0.3));
          
          // Emit sentiment trend event
          this.emit('sentimentTrend', {
            userId,
            trend: avgSentimentScore > 0.2 ? 'positive' : avgSentimentScore < -0.2 ? 'negative' : 'neutral',
            score: avgSentimentScore,
            confidence: recent.reduce((sum, s) => sum + s.confidence, 0) / recent.length
          });
        }
        
      } catch (error) {
        console.error(`[ContextualAwareness] Error in sentiment analysis for user ${userId}:`, error);
      }
    }
  }

  /**
   * Update behavioral patterns
   */
  updateBehavioralPatterns(userId, recentMessages) {
    const context = this.userContexts.get(userId);
    if (!context) return;

    // Analyze message lengths to determine response preference
    const avgMessageLength = recentMessages.reduce((sum, msg) => sum + msg.content.length, 0) / recentMessages.length;
    
    if (avgMessageLength < 50) {
      context.behavioralPatterns.responsePreference = 'brief';
    } else if (avgMessageLength > 200) {
      context.behavioralPatterns.responsePreference = 'detailed';
    } else {
      context.behavioralPatterns.responsePreference = 'balanced';
    }

    // Update time of day patterns
    const currentHour = new Date().getHours();
    const patterns = context.behavioralPatterns.timeOfDayPatterns;
    patterns[currentHour] = (patterns[currentHour] || 0) + 1;

    this.userContexts.set(userId, context);
  }

  /**
   * Check for concerning patterns
   */
  checkForConcerningPatterns(userId, context) {
    const warnings = [];
    
    // Check for rapid repeated requests
    const history = this.conversationHistory.get(userId) || [];
    const last5Minutes = history.filter(msg => 
      Date.now() - msg.timestamp.getTime() < 5 * 60 * 1000
    );
    
    if (last5Minutes.length > 10) {
      warnings.push('RAPID_REQUESTS: Unusually high message frequency');
      context.emotionalContext.stressLevel = Math.min(1.0, context.emotionalContext.stressLevel + 0.2);
    }
    
    // Check for repetitive questions
    const questionTexts = last5Minutes
      .filter(msg => msg.content.includes('?'))
      .map(msg => msg.content.toLowerCase());
    
    const uniqueQuestions = new Set(questionTexts);
    if (questionTexts.length > 3 && uniqueQuestions.size < questionTexts.length * 0.5) {
      warnings.push('REPETITIVE_QUESTIONS: User asking similar questions repeatedly');
      context.emotionalContext.frustrationLevel = Math.min(1.0, context.emotionalContext.frustrationLevel + 0.3);
    }
    
    if (warnings.length > 0) {
      this.emit('concerningPattern', { userId, warnings, context });
    }
  }

  /**
   * Cleanup user context
   */
  cleanupUserContext(userId) {
    this.userContexts.delete(userId);
    this.conversationHistory.delete(userId);
    this.sentimentHistory.delete(userId);
    console.log(`[ContextualAwareness] Cleaned up context for user ${userId}`);
  }

  /**
   * Get user context
   */
  getUserContext(userId) {
    return this.userContexts.get(userId);
  }

  /**
   * Get conversation history
   */
  getConversationHistory(userId, limit = 10) {
    const history = this.conversationHistory.get(userId) || [];
    return history.slice(-limit);
  }

  /**
   * Get sentiment history
   */
  getSentimentHistory(userId, limit = 20) {
    const sentiments = this.sentimentHistory.get(userId) || [];
    return sentiments.slice(-limit);
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      activeUsers: this.userContexts.size,
      totalContexts: this.userContexts.size,
      totalMessages: Array.from(this.conversationHistory.values())
        .reduce((sum, history) => sum + history.length, 0),
      avgSatisfaction: Array.from(this.userContexts.values())
        .reduce((sum, ctx) => sum + ctx.metrics.satisfactionScore, 0) / this.userContexts.size || 0,
      isEnabled: this.isEnabled
    };
  }
}

// Create and export singleton instance
const contextualAwarenessService = new ContextualAwarenessService();

export default contextualAwarenessService;