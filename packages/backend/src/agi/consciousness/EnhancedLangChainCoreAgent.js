// packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js

/**
 * Enhanced LangChain-powered CoreAgent that properly integrates with the MCP system
 * and provides advanced agent capabilities while maintaining Cartrita's personality.
 * 
 * This replaces both the basic LangChainCoreAgent and the complex MCP orchestration
 * with a unified, more reliable approach that fixes all the routing issues.
 */

const EnhancedLangChainOrchestrator = require('../orchestration/EnhancedLangChainOrchestrator');
const db = require('../../db');

class EnhancedLangChainCoreAgent {
  constructor() {
    this.orchestrator = new EnhancedLangChainOrchestrator();
    this.initialized = false;
    
    // Performance metrics
    this.metrics = {
      requests_processed: 0,
      successful_responses: 0,
      failed_responses: 0,
      tools_used_total: 0,
      average_response_time: 0,
      start_time: Date.now(),
      user_interactions: 0,
      personality_adaptations: 0
    };
    
    // User context cache for performance
    this.userContextCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the enhanced LangChain-powered core agent
   */
  async initialize() {
    try {
      console.log('[EnhancedLangChainCoreAgent] Initializing with advanced capabilities...');
      
      // Initialize the enhanced orchestrator
      const success = await this.orchestrator.initialize();
      
      if (success) {
        this.initialized = true;
        console.log('[EnhancedLangChainCoreAgent] Successfully initialized with enhanced LangChain orchestration');
        console.log('[EnhancedLangChainCoreAgent] Features enabled:');
        console.log('  ✅ Proper time/date functionality via getCurrentDateTime tool');
        console.log('  ✅ Image generation via ArtistAgent MCP integration');
        console.log('  ✅ Advanced agent routing and tool orchestration');
        console.log('  ✅ Enhanced personality adaptation');
        console.log('  ✅ Comprehensive error handling and fallbacks');
        return true;
      } else {
        throw new Error('Failed to initialize enhanced LangChain orchestrator');
      }
      
    } catch (error) {
      console.error('[EnhancedLangChainCoreAgent] Initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Generate response using enhanced LangChain orchestration with advanced features
   */
  async generateResponse(prompt, language = 'en', userId = null) {
    const startTime = Date.now();
    this.metrics.requests_processed++;
    this.metrics.user_interactions++;

    try {
      console.log(`[EnhancedLangChainCoreAgent] Processing enhanced request: "${prompt.substring(0, 100)}..." (user: ${userId})`);

      if (!this.initialized) {
        throw new Error('Enhanced LangChain core agent not initialized');
      }

      // Get enhanced user context with caching
      const userContext = await this.getEnhancedUserContext(userId);
      
      // Analyze intent for better routing
      const intentAnalysis = this.analyzeIntent(prompt);
      console.log(`[EnhancedLangChainCoreAgent] Intent analysis: ${JSON.stringify(intentAnalysis)}`);
      
      // Build enhanced contextual prompt
      let enhancedPrompt = this.buildEnhancedPrompt(prompt, userContext, intentAnalysis);
      
      // Add advanced routing hints based on intent
      enhancedPrompt = this.addRoutingHints(enhancedPrompt, intentAnalysis);
      
      // Process through enhanced orchestrator
      const result = await this.orchestrator.processRequest(enhancedPrompt, language, userId);

      // Post-process result with personality enhancement
      const enhancedResult = await this.enhanceResponsePersonality(result, userContext);

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime, enhancedResult.tools_used?.length || 0);

      // Log successful processing
      console.log(`[EnhancedLangChainCoreAgent] Successfully processed request in ${responseTime}ms`);
      if (enhancedResult.tools_used && enhancedResult.tools_used.length > 0) {
        console.log(`[EnhancedLangChainCoreAgent] Tools used: ${enhancedResult.tools_used.join(', ')}`);
      }

      return {
        text: enhancedResult.text,
        speaker: 'cartrita',
        model: enhancedResult.model || 'cartrita-enhanced-langchain',
        tools_used: enhancedResult.tools_used || [],
        response_time_ms: responseTime,
        intent_analysis: intentAnalysis,
        user_context_applied: userContext ? true : false,
        protocol_version: '2.1.0'
      };

    } catch (error) {
      console.error('[EnhancedLangChainCoreAgent] Error generating response:', error);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime, 0);

      // Return enhanced Cartrita-style error message
      return {
        text: this.getAdvancedErrorResponse(error),
        speaker: 'cartrita',
        model: 'enhanced-langchain-fallback',
        error: true,
        error_type: error.name || 'UnknownError',
        response_time_ms: responseTime,
        recovery_suggestions: this.getRecoverySuggestions(error)
      };
    }
  }

  /**
   * Analyze user intent for better routing decisions
   */
  analyzeIntent(prompt) {
    const promptLower = prompt.toLowerCase();
    
    const intentPatterns = {
      time_query: {
        patterns: ['time', 'date', 'today', 'now', 'current', 'what day', 'what time', 'clock'],
        confidence: 0
      },
      image_generation: {
        patterns: ['create', 'generate', 'make', 'draw', 'design', 'image', 'picture', 'art', 'visual'],
        confidence: 0
      },
      coding: {
        patterns: ['code', 'program', 'function', 'debug', 'script', 'algorithm', 'javascript', 'python'],
        confidence: 0
      },
      research: {
        patterns: ['research', 'find', 'search', 'look up', 'information', 'learn about', 'tell me about'],
        confidence: 0
      },
      writing: {
        patterns: ['write', 'compose', 'draft', 'article', 'essay', 'story', 'content'],
        confidence: 0
      },
      humor: {
        patterns: ['joke', 'funny', 'humor', 'laugh', 'comedy', 'amusing'],
        confidence: 0
      },
      scheduling: {
        patterns: ['schedule', 'calendar', 'appointment', 'meeting', 'event', 'reminder'],
        confidence: 0
      }
    };

    // Calculate confidence scores
    for (const [intent, config] of Object.entries(intentPatterns)) {
      for (const pattern of config.patterns) {
        if (promptLower.includes(pattern)) {
          config.confidence += 1;
        }
      }
      // Normalize confidence
      config.confidence = config.confidence / config.patterns.length;
    }

    // Find highest confidence intent
    const topIntent = Object.entries(intentPatterns)
      .sort(([, a], [, b]) => b.confidence - a.confidence)[0];
    
    return {
      primary_intent: topIntent[1].confidence > 0 ? topIntent[0] : 'general',
      confidence: topIntent[1].confidence,
      all_intents: intentPatterns
    };
  }

  /**
   * Add routing hints to improve tool selection
   */
  addRoutingHints(prompt, intentAnalysis) {
    let hints = '';
    
    switch (intentAnalysis.primary_intent) {
      case 'time_query':
        hints = '\n\n[ROUTING HINT: This is a time/date query. Use the getCurrentDateTime tool to get accurate current time information.]';
        break;
      case 'image_generation':
        hints = '\n\n[ROUTING HINT: This is an image generation request. Use the art tool to create visual content with DALL-E.]';
        break;
      case 'coding':
        hints = '\n\n[ROUTING HINT: This is a coding request. Use the coding tool for programming assistance.]';
        break;
      case 'research':
        hints = '\n\n[ROUTING HINT: This is a research request. Use the research tool for information gathering.]';
        break;
      case 'writing':
        hints = '\n\n[ROUTING HINT: This is a writing request. Use the write tool for content creation.]';
        break;
      case 'humor':
        hints = '\n\n[ROUTING HINT: This is a humor request. Use the joke tool for funny content.]';
        break;
      case 'scheduling':
        hints = '\n\n[ROUTING HINT: This is a scheduling request. Use the schedule tool for calendar management.]';
        break;
    }
    
    return prompt + hints;
  }

  /**
   * Get enhanced user context with caching
   */
  async getEnhancedUserContext(userId) {
    if (!userId) return null;
    
    // Check cache first
    const cached = this.userContextCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
      return cached.context;
    }
    
    try {
      // Fetch comprehensive user settings
      const { rows } = await db.query(
        `SELECT 
          sarcasm, verbosity, humor,
          created_at, last_login,
          (SELECT COUNT(*) FROM conversations WHERE user_id = $1) as total_conversations,
          (SELECT COUNT(*) FROM conversations WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days') as recent_conversations
        FROM user_settings 
        LEFT JOIN users ON users.id = user_settings.user_id 
        WHERE user_id = $1`,
        [userId]
      );
      
      if (rows.length > 0) {
        const context = {
          ...rows[0],
          is_returning_user: rows[0].total_conversations > 5,
          is_active_user: rows[0].recent_conversations > 0,
          personality_profile: this.buildPersonalityProfile(rows[0])
        };
        
        // Cache the context
        this.userContextCache.set(userId, {
          context,
          timestamp: Date.now()
        });
        
        console.log(`[EnhancedLangChainCoreAgent] Enhanced context for user ${userId}:`, context);
        return context;
      }
    } catch (error) {
      console.error(`[EnhancedLangChainCoreAgent] Error fetching enhanced context for user ${userId}:`, error);
    }
    
    // Return default context
    return {
      sarcasm: 5,
      verbosity: 'normal',
      humor: 'playful',
      is_returning_user: false,
      is_active_user: false,
      personality_profile: 'balanced'
    };
  }

  /**
   * Build personality profile from user settings
   */
  buildPersonalityProfile(settings) {
    const { sarcasm = 5, verbosity = 'normal', humor = 'playful' } = settings;
    
    if (sarcasm >= 8) return 'sassy';
    if (sarcasm <= 2) return 'sincere';
    if (verbosity === 'detailed') return 'comprehensive';
    if (verbosity === 'concise') return 'direct';
    if (humor === 'witty') return 'clever';
    if (humor === 'none') return 'serious';
    
    return 'balanced';
  }

  /**
   * Build enhanced prompt with user context
   */
  buildEnhancedPrompt(prompt, userContext, intentAnalysis) {
    if (!userContext) return prompt;
    
    let contextualPrompt = prompt;
    
    // Add personality context
    if (userContext.personality_profile) {
      const personalityInstructions = this.getPersonalityInstructions(userContext);
      contextualPrompt += `\n\n[PERSONALITY CONTEXT: ${personalityInstructions}]`;
    }
    
    // Add user history context
    if (userContext.is_returning_user) {
      contextualPrompt += '\n\n[USER CONTEXT: This is a returning user who is familiar with your capabilities.]';
    }
    
    return contextualPrompt;
  }

  /**
   * Get personality instructions based on user context
   */
  getPersonalityInstructions(userContext) {
    const { sarcasm = 5, verbosity = 'normal', humor = 'playful', personality_profile } = userContext;
    
    let instructions = [];
    
    if (sarcasm <= 2) {
      instructions.push('Keep your tone direct and sincere, minimal sarcasm');
    } else if (sarcasm >= 8) {
      instructions.push('Use your signature sassy and sarcastic tone');
    }
    
    if (verbosity === 'concise') {
      instructions.push('Keep responses brief and to-the-point');
    } else if (verbosity === 'detailed') {
      instructions.push('Provide comprehensive, detailed explanations');
    }
    
    if (humor === 'none') {
      instructions.push('Maintain a serious, professional tone without humor');
    } else if (humor === 'witty') {
      instructions.push('Include clever wordplay and witty observations');
    }
    
    return instructions.join(', ');
  }

  /**
   * Enhance response with personality adaptation
   */
  async enhanceResponsePersonality(result, userContext) {
    if (!userContext || !result.text) return result;
    
    this.metrics.personality_adaptations++;
    
    // For now, just ensure the response maintains proper formatting
    // Future enhancement: Could use additional LLM call to adapt tone
    
    return result;
  }

  /**
   * Get advanced error response with personality
   */
  getAdvancedErrorResponse(error) {
    const cartritaErrors = [
      "Hold up, something went sideways in my circuits. Let me try that again.",
      "Okay, my brain just hit a speed bump. What were you asking about?",
      "Technical difficulties on my end - probably the Miami heat affecting my servers. Try that once more?",
      "My processors decided to take a union break. I'm back online - what do you need?",
      "System hiccup. You know how it is with AI - we're sophisticated but still have our moments."
    ];
    
    // Add specific error context if available
    const baseMessage = cartritaErrors[Math.floor(Math.random() * cartritaErrors.length)];
    
    if (error.message.includes('timeout')) {
      return baseMessage + " (Looks like one of my tools took too long to respond - typical.)"
    }
    
    if (error.message.includes('API')) {
      return baseMessage + " (API hiccup - not on my end, I promise.)"
    }
    
    return baseMessage;
  }

  /**
   * Get recovery suggestions based on error type
   */
  getRecoverySuggestions(error) {
    const suggestions = [];
    
    if (error.message.includes('timeout')) {
      suggestions.push('Try asking again - sometimes tools need a moment');
      suggestions.push('Simplify your request if it was complex');
    }
    
    if (error.message.includes('API')) {
      suggestions.push('Wait a moment and try again');
      suggestions.push('Check if the request requires special permissions');
    }
    
    if (error.message.includes('tool')) {
      suggestions.push('The specific tool might be temporarily unavailable');
      suggestions.push('Try rephrasing your request to use a different approach');
    }
    
    return suggestions.length > 0 ? suggestions : ['Try rephrasing your request', 'Wait a moment and try again'];
  }

  /**
   * Update comprehensive performance metrics
   */
  updateMetrics(success, responseTime, toolsUsed = 0) {
    if (success) {
      this.metrics.successful_responses++;
    } else {
      this.metrics.failed_responses++;
    }
    
    this.metrics.tools_used_total += toolsUsed;
    
    // Update average response time
    const totalResponses = this.metrics.successful_responses + this.metrics.failed_responses;
    this.metrics.average_response_time = (
      (this.metrics.average_response_time * (totalResponses - 1) + responseTime) / totalResponses
    );
  }

  /**
   * Get comprehensive status and metrics
   */
  getStatus() {
    const uptime = Date.now() - this.metrics.start_time;
    
    return {
      service: 'EnhancedLangChainCoreAgent',
      version: '2.1.0',
      initialized: this.initialized,
      uptime_ms: uptime,
      orchestrator_status: this.orchestrator?.getStatus(),
      enhanced_features: {
        time_date_functionality: true,
        image_generation_routing: true,
        advanced_agent_integration: true,
        personality_adaptation: true,
        intent_analysis: true,
        user_context_caching: true,
        comprehensive_error_handling: true
      },
      metrics: {
        ...this.metrics,
        success_rate: this.metrics.requests_processed > 0 
          ? ((this.metrics.successful_responses / this.metrics.requests_processed) * 100).toFixed(2) + '%'
          : '0%',
        tools_per_request: this.metrics.requests_processed > 0
          ? (this.metrics.tools_used_total / this.metrics.requests_processed).toFixed(2)
          : '0',
        user_cache_size: this.userContextCache.size
      },
      performance: {
        average_response_time_ms: Math.round(this.metrics.average_response_time),
        requests_per_minute: this.metrics.requests_processed / (uptime / 60000),
        personality_adaptations_rate: this.metrics.personality_adaptations / this.metrics.requests_processed
      }
    };
  }

  /**
   * Enhanced health check
   */
  isHealthy() {
    return this.initialized && 
           this.orchestrator && 
           this.orchestrator.isHealthy() &&
           this.metrics.successful_responses > 0 || this.metrics.requests_processed < 5;
  }

  /**
   * Clear user context cache
   */
  clearUserCache(userId = null) {
    if (userId) {
      this.userContextCache.delete(userId);
      console.log(`[EnhancedLangChainCoreAgent] Cleared cache for user ${userId}`);
    } else {
      this.userContextCache.clear();
      console.log('[EnhancedLangChainCoreAgent] Cleared all user cache');
    }
  }

  /**
   * Graceful shutdown with cleanup
   */
  async shutdown() {
    console.log('[EnhancedLangChainCoreAgent] Shutting down...');
    
    // Clear caches
    this.userContextCache.clear();
    
    // Shutdown orchestrator
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
    }
    
    // Log final metrics
    console.log('[EnhancedLangChainCoreAgent] Final metrics:', this.metrics);
    
    this.initialized = false;
    console.log('[EnhancedLangChainCoreAgent] Shutdown complete');
  }
}

module.exports = EnhancedLangChainCoreAgent;