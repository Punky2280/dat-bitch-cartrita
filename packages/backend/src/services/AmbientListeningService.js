const EventEmitter = require('events');
const DeepgramService = require('./DeepgramService');

class AmbientListeningService extends EventEmitter {
  constructor() {
    super();
    this.isAmbientActive = false;
    this.soundClassifier = null;
    this.environmentalContext = {
      roomType: 'unknown',
      activityLevel: 'quiet',
      backgroundSounds: [],
      timeOfDay: 'unknown',
      userPresence: false
    };
    
    this.soundPatterns = new Map();
    this.activityHistory = [];
    this.ambientSettings = {
      sensitivity: 0.3,
      soundClassification: true,
      contextualAwareness: true,
      smartFiltering: true,
      responseThreshold: 0.7
    };
    
    this.initializeSoundClassification();
  }

  /**
   * Initialize sound classification patterns
   */
  initializeSoundClassification() {
    // Define sound patterns and their characteristics
    this.soundPatterns.set('music', {
      keywords: ['music', 'song', 'beat', 'rhythm', 'melody'],
      response_type: 'appreciative',
      confidence_threshold: 0.6,
      typical_responses: [
        "This music has such a good vibe!",
        "I love this beat! What song is this?",
        "The rhythm is really getting to me!",
        "This sounds amazing! You have great taste!"
      ]
    });

    this.soundPatterns.set('cooking', {
      keywords: ['sizzling', 'chopping', 'frying', 'boiling', 'microwave'],
      response_type: 'curious',
      confidence_threshold: 0.5,
      typical_responses: [
        "Sounds like you're cooking something good!",
        "That smells delicious! What are you making?",
        "I love hearing kitchen sounds - so homey!",
        "Cooking something special tonight?"
      ]
    });

    this.soundPatterns.set('typing', {
      keywords: ['typing', 'keyboard', 'clicking', 'computer'],
      response_type: 'supportive',
      confidence_threshold: 0.4,
      typical_responses: [
        "Getting some work done? You're so productive!",
        "That typing sounds focused - in the zone!",
        "Need any help with what you're working on?",
        "Love the sound of productivity!"
      ]
    });

    this.soundPatterns.set('phone_call', {
      keywords: ['phone', 'call', 'talking', 'conversation'],
      response_type: 'respectful',
      confidence_threshold: 0.7,
      typical_responses: [
        "I'll keep it down while you're on your call!",
        "Sounds important - I'll wait until you're done!",
        "Take your time, I'm here when you need me!"
      ]
    });

    this.soundPatterns.set('door', {
      keywords: ['door', 'knock', 'doorbell', 'opening', 'closing'],
      response_type: 'alert',
      confidence_threshold: 0.6,
      typical_responses: [
        "Sounds like someone's at the door!",
        "I heard that door - expecting someone?",
        "Company's here! Want me to pause what we're doing?",
        "That sounded like the door!"
      ]
    });

    this.soundPatterns.set('tv_media', {
      keywords: ['television', 'movie', 'show', 'video', 'streaming'],
      response_type: 'casual',
      confidence_threshold: 0.5,
      typical_responses: [
        "What are we watching? Sounds interesting!",
        "I love movie nights! What's the show?",
        "This sounds like a good one!",
        "Mind if I listen in? This sounds entertaining!"
      ]
    });

    this.soundPatterns.set('exercise', {
      keywords: ['exercise', 'workout', 'running', 'jumping', 'weights'],
      response_type: 'encouraging',
      confidence_threshold: 0.6,
      typical_responses: [
        "Get it girl! You're crushing that workout!",
        "I love the energy! Keep it up!",
        "You're so motivated - I'm inspired!",
        "That sounds like some serious exercise!"
      ]
    });

    this.soundPatterns.set('pets', {
      keywords: ['dog', 'cat', 'barking', 'meowing', 'pet'],
      response_type: 'affectionate',
      confidence_threshold: 0.5,
      typical_responses: [
        "Aww, your pet sounds so cute!",
        "I hear your furry friend! So adorable!",
        "Pets make everything better, don't they?",
        "That little voice is so sweet!"
      ]
    });

    this.soundPatterns.set('cleaning', {
      keywords: ['vacuum', 'cleaning', 'washing', 'scrubbing'],
      response_type: 'supportive',
      confidence_threshold: 0.5,
      typical_responses: [
        "Getting the place all clean and fresh!",
        "I love a good cleaning session!",
        "Your space is gonna look amazing!",
        "So satisfying to get everything clean!"
      ]
    });

    this.soundPatterns.set('weather', {
      keywords: ['rain', 'thunder', 'wind', 'storm'],
      response_type: 'atmospheric',
      confidence_threshold: 0.4,
      typical_responses: [
        "That rain sounds so peaceful!",
        "Love the sound of a good storm!",
        "The weather sounds intense out there!",
        "Nature's got quite the show going on!"
      ]
    });

    console.log('[AmbientListeningService] Sound classification patterns initialized');
  }

  /**
   * Start ambient listening mode
   */
  async startAmbientListening(userId, settings = {}) {
    try {
      if (this.isAmbientActive) {
        console.warn('[AmbientListeningService] Already in ambient mode');
        return false;
      }

      console.log('[AmbientListeningService] Starting ambient listening for user:', userId);
      
      this.ambientSettings = { ...this.ambientSettings, ...settings };
      this.currentUserId = userId;
      
      // Start continuous transcription with ambient-optimized settings
      await DeepgramService.startLiveTranscription({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        interim_results: true,
        endpointing: 1000, // Longer endpointing for ambient
        vad_events: true,
        filler_words: false,
        diarize: false,
        // Ambient-specific settings
        keywords: this.getKeywordsForClassification(),
        detect_entities: true,
        redact: ['pii'], // Protect privacy in ambient mode
        alternatives: 3 // Get multiple interpretations
      });

      this.setupAmbientEventHandlers();
      this.isAmbientActive = true;
      this.startEnvironmentalAnalysis();
      
      this.emit('ambientStarted', { userId, settings: this.ambientSettings });
      return true;

    } catch (error) {
      console.error('[AmbientListeningService] Failed to start ambient listening:', error);
      throw error;
    }
  }

  /**
   * Stop ambient listening mode
   */
  async stopAmbientListening() {
    try {
      if (!this.isAmbientActive) {
        console.warn('[AmbientListeningService] Not in ambient mode');
        return false;
      }

      console.log('[AmbientListeningService] Stopping ambient listening');
      
      DeepgramService.stopLiveTranscription();
      this.isAmbientActive = false;
      this.currentUserId = null;
      
      this.emit('ambientStopped');
      return true;

    } catch (error) {
      console.error('[AmbientListeningService] Error stopping ambient listening:', error);
      return false;
    }
  }

  /**
   * Set up event handlers for ambient mode
   */
  setupAmbientEventHandlers() {
    // Handle final transcripts for sound classification
    DeepgramService.on('finalTranscript', (result) => {
      if (this.isAmbientActive) {
        this.processAmbientAudio(result);
      }
    });

    // Handle speech events for presence detection
    DeepgramService.on('speechStarted', () => {
      if (this.isAmbientActive) {
        this.updateUserPresence(true);
      }
    });

    DeepgramService.on('speechEnded', () => {
      if (this.isAmbientActive) {
        this.updateUserPresence(false);
      }
    });
  }

  /**
   * Process ambient audio for classification and context
   */
  async processAmbientAudio(result) {
    try {
      if (!result.text || result.text.trim().length === 0) {
        return;
      }

      const transcript = result.text.toLowerCase();
      console.log('[AmbientListeningService] Processing ambient audio:', transcript);

      // Classify the sound/activity
      const classification = await this.classifyAmbientSound(transcript, result.confidence);
      
      // Update environmental context
      this.updateEnvironmentalContext(classification);
      
      // Check if response is warranted
      if (this.shouldRespondToAmbientSound(classification)) {
        await this.generateAmbientResponse(classification, transcript);
      }

      // Record activity for pattern analysis
      this.recordActivity(classification, transcript, result.confidence);

    } catch (error) {
      console.error('[AmbientListeningService] Error processing ambient audio:', error);
    }
  }

  /**
   * Classify ambient sounds and activities
   */
  async classifyAmbientSound(transcript, confidence) {
    const classification = {
      timestamp: new Date(),
      transcript: transcript,
      confidence: confidence,
      soundType: 'unknown',
      activityLevel: this.calculateActivityLevel(transcript),
      emotionalTone: this.detectEmotionalTone(transcript),
      contextualRelevance: 0,
      shouldRespond: false
    };

    // Check against known sound patterns
    for (const [soundType, pattern] of this.soundPatterns.entries()) {
      const matches = pattern.keywords.filter(keyword => 
        transcript.includes(keyword)
      ).length;

      if (matches > 0 && confidence >= pattern.confidence_threshold) {
        classification.soundType = soundType;
        classification.contextualRelevance = matches / pattern.keywords.length;
        classification.shouldRespond = classification.contextualRelevance >= this.ambientSettings.responseThreshold;
        break;
      }
    }

    // Advanced pattern recognition for unclassified sounds
    if (classification.soundType === 'unknown') {
      classification.soundType = await this.advancedSoundClassification(transcript);
    }

    console.log('[AmbientListeningService] Sound classified:', classification);
    return classification;
  }

  /**
   * Advanced sound classification using AI
   */
  async advancedSoundClassification(transcript) {
    try {
      // Use OpenAI to classify ambiguous sounds
      const classificationPrompt = `
        Classify this ambient sound description into a category:
        Sound: "${transcript}"
        
        Categories: music, conversation, activity, household, technology, weather, pets, other
        
        Respond with just the category name:
      `;

      // This would use OpenAI API - placeholder for now
      // const response = await openai.chat.completions.create({...});
      
      // For now, use simple keyword matching
      if (transcript.includes('sound') || transcript.includes('noise')) return 'ambient_sound';
      if (transcript.includes('talk') || transcript.includes('speak')) return 'conversation';
      if (transcript.includes('move') || transcript.includes('walk')) return 'activity';
      
      return 'other';

    } catch (error) {
      console.error('[AmbientListeningService] Advanced classification error:', error);
      return 'other';
    }
  }

  /**
   * Calculate activity level from transcript
   */
  calculateActivityLevel(transcript) {
    const activeWords = ['loud', 'fast', 'quick', 'running', 'moving', 'active'];
    const quietWords = ['quiet', 'soft', 'gentle', 'calm', 'peaceful', 'still'];
    
    const activeCount = activeWords.filter(word => transcript.includes(word)).length;
    const quietCount = quietWords.filter(word => transcript.includes(word)).length;
    
    if (activeCount > quietCount) return 'active';
    if (quietCount > activeCount) return 'quiet';
    return 'moderate';
  }

  /**
   * Detect emotional tone from transcript
   */
  detectEmotionalTone(transcript) {
    const positiveWords = ['happy', 'good', 'great', 'love', 'amazing', 'wonderful'];
    const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'angry'];
    const excitedWords = ['wow', 'awesome', 'incredible', 'fantastic'];
    
    const positiveCount = positiveWords.filter(word => transcript.includes(word)).length;
    const negativeCount = negativeWords.filter(word => transcript.includes(word)).length;
    const excitedCount = excitedWords.filter(word => transcript.includes(word)).length;
    
    if (excitedCount > 0) return 'excited';
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Update environmental context based on classification
   */
  updateEnvironmentalContext(classification) {
    this.environmentalContext.activityLevel = classification.activityLevel;
    this.environmentalContext.userPresence = classification.confidence > 0.5;
    this.environmentalContext.timeOfDay = this.getTimeOfDay();
    
    // Update background sounds
    if (classification.soundType !== 'unknown') {
      this.environmentalContext.backgroundSounds.push({
        type: classification.soundType,
        timestamp: classification.timestamp,
        confidence: classification.confidence
      });
      
      // Keep only recent background sounds (last 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      this.environmentalContext.backgroundSounds = this.environmentalContext.backgroundSounds
        .filter(sound => sound.timestamp > tenMinutesAgo);
    }
    
    this.emit('contextUpdated', this.environmentalContext);
  }

  /**
   * Determine if should respond to ambient sound
   */
  shouldRespondToAmbientSound(classification) {
    // Don't respond to low confidence classifications
    if (classification.confidence < this.ambientSettings.sensitivity) {
      return false;
    }
    
    // Don't respond too frequently
    const recentResponses = this.activityHistory
      .filter(activity => 
        activity.responded && 
        Date.now() - activity.timestamp < 30000 // 30 seconds
      );
    
    if (recentResponses.length > 2) {
      return false; // Already responded recently
    }
    
    // Respond to high-relevance sounds
    return classification.shouldRespond && classification.contextualRelevance > 0.6;
  }

  /**
   * Generate ambient response
   */
  async generateAmbientResponse(classification, transcript) {
    try {
      const pattern = this.soundPatterns.get(classification.soundType);
      if (!pattern || !pattern.typical_responses) {
        return;
      }

      // Select appropriate response
      const responses = pattern.typical_responses;
      const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
      
      // Add contextual elements
      const contextualResponse = this.addContextualElements(selectedResponse, classification);
      
      console.log('[AmbientListeningService] Generated ambient response:', contextualResponse);
      
      this.emit('ambientResponse', {
        text: contextualResponse,
        emotion: this.getEmotionForResponseType(pattern.response_type),
        classification: classification,
        responseType: pattern.response_type,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('[AmbientListeningService] Error generating ambient response:', error);
    }
  }

  /**
   * Add contextual elements to response
   */
  addContextualElements(baseResponse, classification) {
    let contextualResponse = baseResponse;
    
    // Time-of-day awareness
    const timeOfDay = this.getTimeOfDay();
    if (timeOfDay === 'morning' && Math.random() < 0.3) {
      contextualResponse = "Good morning! " + contextualResponse;
    } else if (timeOfDay === 'evening' && Math.random() < 0.3) {
      contextualResponse = "This evening " + contextualResponse.toLowerCase();
    }
    
    // Activity history awareness
    const recentSimilarActivities = this.activityHistory
      .filter(activity => 
        activity.soundType === classification.soundType &&
        Date.now() - activity.timestamp < 3600000 // 1 hour
      );
    
    if (recentSimilarActivities.length > 1 && Math.random() < 0.4) {
      contextualResponse += " You've been really into this lately!";
    }
    
    return contextualResponse;
  }

  /**
   * Get emotion for response type
   */
  getEmotionForResponseType(responseType) {
    const emotionMap = {
      'appreciative': 'friendly',
      'curious': 'excited',
      'supportive': 'encouraging',
      'respectful': 'calm',
      'alert': 'confident',
      'casual': 'playful',
      'encouraging': 'excited',
      'affectionate': 'friendly',
      'atmospheric': 'calm'
    };
    
    return emotionMap[responseType] || 'friendly';
  }

  /**
   * Record activity for pattern analysis
   */
  recordActivity(classification, transcript, confidence) {
    const activity = {
      timestamp: Date.now(),
      soundType: classification.soundType,
      transcript: transcript,
      confidence: confidence,
      activityLevel: classification.activityLevel,
      emotionalTone: classification.emotionalTone,
      responded: classification.shouldRespond,
      contextualRelevance: classification.contextualRelevance
    };
    
    this.activityHistory.push(activity);
    
    // Keep history manageable (last 1000 activities)
    if (this.activityHistory.length > 1000) {
      this.activityHistory = this.activityHistory.slice(-1000);
    }
  }

  /**
   * Start environmental analysis
   */
  startEnvironmentalAnalysis() {
    // Update time-based context every minute
    this.environmentalTimer = setInterval(() => {
      this.environmentalContext.timeOfDay = this.getTimeOfDay();
      this.analyzeActivityPatterns();
    }, 60000);
  }

  /**
   * Analyze activity patterns for insights
   */
  analyzeActivityPatterns() {
    const recentActivities = this.activityHistory
      .filter(activity => Date.now() - activity.timestamp < 3600000); // Last hour
    
    if (recentActivities.length === 0) return;
    
    // Calculate activity distribution
    const activityTypes = {};
    recentActivities.forEach(activity => {
      activityTypes[activity.soundType] = (activityTypes[activity.soundType] || 0) + 1;
    });
    
    // Determine dominant activity
    const dominantActivity = Object.keys(activityTypes)
      .reduce((a, b) => activityTypes[a] > activityTypes[b] ? a : b);
    
    this.environmentalContext.dominantActivity = dominantActivity;
    this.emit('activityPatternAnalyzed', {
      dominantActivity,
      activityDistribution: activityTypes,
      totalActivities: recentActivities.length
    });
  }

  /**
   * Get current time of day
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Get keywords for classification
   */
  getKeywordsForClassification() {
    const allKeywords = [];
    for (const pattern of this.soundPatterns.values()) {
      allKeywords.push(...pattern.keywords);
    }
    return [...new Set(allKeywords)]; // Remove duplicates
  }

  /**
   * Update user presence status
   */
  updateUserPresence(isPresent) {
    const wasPresent = this.environmentalContext.userPresence;
    this.environmentalContext.userPresence = isPresent;
    
    if (wasPresent !== isPresent) {
      this.emit('userPresenceChanged', {
        isPresent: isPresent,
        timestamp: new Date(),
        context: this.environmentalContext
      });
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isAmbientActive: this.isAmbientActive,
      currentUserId: this.currentUserId,
      environmentalContext: this.environmentalContext,
      settings: this.ambientSettings,
      activityHistorySize: this.activityHistory.length,
      recentActivities: this.activityHistory.slice(-5),
      soundPatternsLoaded: this.soundPatterns.size
    };
  }

  /**
   * Get activity insights
   */
  getActivityInsights() {
    const insights = {
      totalActivities: this.activityHistory.length,
      timeRange: {
        start: this.activityHistory[0]?.timestamp || null,
        end: this.activityHistory[this.activityHistory.length - 1]?.timestamp || null
      },
      activityBreakdown: {},
      emotionalTones: {},
      responseRate: 0
    };
    
    // Calculate breakdowns
    this.activityHistory.forEach(activity => {
      insights.activityBreakdown[activity.soundType] = 
        (insights.activityBreakdown[activity.soundType] || 0) + 1;
      
      insights.emotionalTones[activity.emotionalTone] = 
        (insights.emotionalTones[activity.emotionalTone] || 0) + 1;
    });
    
    // Calculate response rate
    const responsesGiven = this.activityHistory.filter(a => a.responded).length;
    insights.responseRate = this.activityHistory.length > 0 ? 
      (responsesGiven / this.activityHistory.length) * 100 : 0;
    
    return insights;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.environmentalTimer) {
      clearInterval(this.environmentalTimer);
      this.environmentalTimer = null;
    }
    
    if (this.isAmbientActive) {
      this.stopAmbientListening();
    }
  }
}

// Export singleton instance
module.exports = new AmbientListeningService();