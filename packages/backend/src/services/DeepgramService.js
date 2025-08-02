const { createClient } = require('@deepgram/sdk');
const EventEmitter = require('events');

class DeepgramService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.liveConnection = null;
    this.isConnected = false;
    this.agentTopics = this.initializeAgentTopics();
    this.initializeClient();
  }

  initializeClient() {
    if (!process.env.DEEPGRAM_API_KEY) {
      console.error('[DeepgramService] API key not configured');
      return;
    }

    this.client = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('[DeepgramService] Client initialized with enhanced nova-3 configuration');
  }

  /**
   * Initialize custom topics for each agent type
   */
  initializeAgentTopics() {
    return {
      'ComedianAgent': ['humor', 'comedy', 'jokes', 'entertainment', 'laughter', 'satire', 'wit'],
      'EmotionalIntelligenceAgent': ['emotion', 'feelings', 'empathy', 'mental_health', 'psychology', 'mood', 'wellbeing'],
      'TaskManagementAgent': ['productivity', 'tasks', 'scheduling', 'planning', 'organization', 'workflow', 'deadlines'],
      'AnalyticsAgent': ['data', 'metrics', 'analysis', 'statistics', 'insights', 'trends', 'patterns'],
      'DesignAgent': ['design', 'creativity', 'aesthetics', 'visual', 'graphics', 'layout', 'typography'],
      'GitHubSearchAgent': ['development', 'programming', 'code', 'software', 'technology', 'github', 'repositories'],
      'SecurityAuditAgent': ['security', 'vulnerability', 'threats', 'privacy', 'encryption', 'authentication', 'audit'],
      'NotificationAgent': ['alerts', 'notifications', 'communication', 'messages', 'updates', 'reminders'],
      'TranslationAgent': ['language', 'translation', 'linguistics', 'communication', 'multilingual', 'interpretation'],
      'APIGatewayAgent': ['integration', 'api', 'services', 'endpoints', 'connectivity', 'data_exchange'],
      'MultiModalFusionAgent': ['multimodal', 'fusion', 'integration', 'synthesis', 'combination', 'coordination'],
      'CodeWriterAgent': ['programming', 'development', 'coding', 'software', 'algorithms', 'debugging'],
      'SchedulerAgent': ['scheduling', 'calendar', 'appointments', 'time_management', 'events', 'meetings'],
      'ArtistAgent': ['art', 'creativity', 'visual_arts', 'artistic', 'imagination', 'expression'],
      'WriterAgent': ['writing', 'content', 'narrative', 'storytelling', 'documentation', 'communication'],
      'ResearcherAgent': ['research', 'investigation', 'analysis', 'knowledge', 'information', 'discovery'],
      'PersonalizationAgent': ['personalization', 'customization', 'preferences', 'user_experience', 'adaptation']
    };
  }

  /**
   * Get keyterms for specific content or agent type
   */
  getKeytermsForContent(agentType) {
    if (!agentType || !this.agentTopics[agentType]) {
      return ['Cartrita', 'assistant', 'AI', 'help'];
    }
    
    return ['Cartrita', ...this.agentTopics[agentType].slice(0, 5)];
  }

  /**
   * Get keywords with intensifiers for specific agent type
   */
  getKeywordsForAgent(agentType) {
    if (!agentType || !this.agentTopics[agentType]) {
      return 'Cartrita:2,assistant:1.5,AI:1.5';
    }
    
    const topics = this.agentTopics[agentType];
    const keywords = [
      'Cartrita:2',
      `${topics[0]}:2`,
      `${topics[1]}:1.5`,
      `${topics[2]}:1.5`
    ];
    
    return keywords.join(',');
  }

  /**
   * Get custom topics for specific agent type
   */
  getCustomTopicsForAgent(agentType) {
    if (!agentType || !this.agentTopics[agentType]) {
      return null;
    }
    
    return this.agentTopics[agentType].join(',');
  }

  /**
   * Transcribe pre-recorded audio file
   */
  async transcribeFile(audioBuffer, options = {}) {
    try {
      if (!this.client) {
        throw new Error('Deepgram client not initialized');
      }

      const defaultOptions = {
        model: 'nova-3',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        utt_split: 0.8,
        diarize: true,
        filler_words: false,
        profanity_filter: false,
        // Audio Intelligence Features
        summarize: 'v2',
        topics: true,
        intents: true,
        sentiment: true,
        detect_entities: true,
        // Enhanced transcription features
        keyterm: this.getKeytermsForContent(options.agentType),
        keywords: this.getKeywordsForAgent(options.agentType),
        ...options
      };

      console.log('[DeepgramService] Transcribing audio file with options:', defaultOptions);

      const response = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        defaultOptions
      );

      const result = this.processTranscriptionResult(response);
      
      console.log('[DeepgramService] Transcription completed:', {
        transcript: result.transcript?.substring(0, 100) + '...',
        confidence: result.confidence,
        language: result.language
      });

      return result;
    } catch (error) {
      console.error('[DeepgramService] Transcription error:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Start live transcription stream
   */
  async startLiveTranscription(options = {}) {
    try {
      if (!this.client) {
        throw new Error('Deepgram client not initialized');
      }

      if (this.isConnected) {
        console.warn('[DeepgramService] Live connection already active');
        return;
      }

      const defaultOptions = {
        model: 'nova-3',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        utt_split: 0.8,
        interim_results: true,
        endpointing: 300,
        vad_events: true,
        diarize: true,
        filler_words: false,
        // Live Audio Intelligence
        sentiment: true,
        intents: true,
        // Enhanced live features
        keyterm: this.getKeytermsForContent(options.agentType),
        keywords: this.getKeywordsForAgent(options.agentType),
        ...options
      };

      console.log('[DeepgramService] Starting live transcription with options:', defaultOptions);

      this.liveConnection = this.client.listen.live(defaultOptions);

      // Set up event listeners
      this.liveConnection.on('open', () => {
        console.log('[DeepgramService] Live connection opened');
        this.isConnected = true;
        this.emit('connected');
      });

      this.liveConnection.on('transcript', (data) => {
        console.log('[DeepgramService] Live transcript received:', data);
        this.handleLiveTranscript(data);
      });

      this.liveConnection.on('metadata', (data) => {
        console.log('[DeepgramService] Live metadata:', data);
        this.emit('metadata', data);
      });

      this.liveConnection.on('speech_started', () => {
        console.log('[DeepgramService] Speech started');
        this.emit('speechStarted');
      });

      this.liveConnection.on('speech_ended', () => {
        console.log('[DeepgramService] Speech ended');
        this.emit('speechEnded');
      });

      this.liveConnection.on('utterance_end', (utterance) => {
        console.log('[DeepgramService] Utterance end:', utterance);
        this.emit('utteranceEnd', utterance);
      });

      this.liveConnection.on('error', (error) => {
        console.error('[DeepgramService] Live connection error:', error);
        this.emit('error', error);
        this.isConnected = false;
      });

      this.liveConnection.on('close', () => {
        console.log('[DeepgramService] Live connection closed');
        this.isConnected = false;
        this.emit('disconnected');
      });

      return this.liveConnection;
    } catch (error) {
      console.error('[DeepgramService] Failed to start live transcription:', error);
      throw error;
    }
  }

  /**
   * Send audio data to live transcription
   */
  sendAudioData(audioData) {
    if (!this.liveConnection || !this.isConnected) {
      console.warn('[DeepgramService] No active live connection for audio data');
      return false;
    }

    try {
      this.liveConnection.send(audioData);
      return true;
    } catch (error) {
      console.error('[DeepgramService] Error sending audio data:', error);
      return false;
    }
  }

  /**
   * Stop live transcription
   */
  stopLiveTranscription() {
    if (!this.liveConnection || !this.isConnected) {
      console.warn('[DeepgramService] No active live connection to stop');
      return;
    }

    try {
      console.log('[DeepgramService] Stopping live transcription');
      this.liveConnection.finish();
      this.liveConnection = null;
      this.isConnected = false;
    } catch (error) {
      console.error('[DeepgramService] Error stopping live transcription:', error);
    }
  }

  /**
   * Handle live transcript data
   */
  handleLiveTranscript(data) {
    try {
      const transcript = data.channel?.alternatives?.[0];
      
      if (!transcript) {
        return;
      }

      const result = {
        text: transcript.transcript,
        confidence: transcript.confidence,
        is_final: data.is_final,
        speech_final: data.speech_final,
        channel_index: data.channel_index,
        duration: data.duration,
        start: data.start
      };

      // Only emit significant transcripts
      if (result.text && result.text.trim().length > 0) {
        if (result.is_final) {
          this.emit('finalTranscript', result);
        } else {
          this.emit('interimTranscript', result);
        }
      }
    } catch (error) {
      console.error('[DeepgramService] Error handling live transcript:', error);
    }
  }

  /**
   * Process transcription result
   */
  processTranscriptionResult(response) {
    try {
      const channel = response.result?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      
      if (!alternative) {
        return {
          transcript: '',
          confidence: 0,
          language: 'en-US',
          words: [],
          paragraphs: []
        };
      }

      return {
        transcript: alternative.transcript || '',
        confidence: alternative.confidence || 0,
        language: channel.detected_language || 'en-US',
        words: alternative.words || [],
        paragraphs: alternative.paragraphs?.paragraphs || [],
        summary: alternative.summaries?.[0]?.summary || null,
        // Audio Intelligence results
        topics: alternative.topics || [],
        intents: alternative.intents || [],
        sentiment: alternative.sentiment || null,
        entities: alternative.entities || [],
        // Enhanced metadata
        processing_time: response.result?.metadata?.duration || 0,
        model_info: response.result?.metadata?.model_info || null
      };
    } catch (error) {
      console.error('[DeepgramService] Error processing transcription result:', error);
      return {
        transcript: '',
        confidence: 0,
        language: 'en-US',
        words: [],
        paragraphs: []
      };
    }
  }

  /**
   * Detect wake word in transcript
   */
  detectWakeWord(transcript, wakeWords = ['cartrita', 'hey cartrita', 'cartrita!']) {
    const normalizedTranscript = transcript.toLowerCase().trim();
    
    for (const wakeWord of wakeWords) {
      const normalizedWakeWord = wakeWord.toLowerCase();
      
      // Check if wake word is at the beginning or is a separate word
      if (normalizedTranscript.startsWith(normalizedWakeWord) || 
          normalizedTranscript.includes(' ' + normalizedWakeWord) ||
          normalizedTranscript === normalizedWakeWord) {
        
        console.log('[DeepgramService] Wake word detected:', wakeWord);
        
        // Remove wake word from transcript
        const cleanTranscript = normalizedTranscript
          .replace(normalizedWakeWord, '')
          .trim()
          .replace(/^[,.\s]+/, ''); // Remove leading punctuation
        
        return {
          detected: true,
          wakeWord: wakeWord,
          cleanTranscript: cleanTranscript
        };
      }
    }
    
    return {
      detected: false,
      wakeWord: null,
      cleanTranscript: transcript
    };
  }

  /**
   * Transcribe with agent-specific context
   */
  async transcribeForAgent(audioBuffer, agentType, options = {}) {
    const agentSpecificOptions = {
      agentType,
      topics: this.getCustomTopicsForAgent(agentType),
      keyterm: this.getKeytermsForContent(agentType),
      keywords: this.getKeywordsForAgent(agentType),
      ...options
    };

    console.log(`[DeepgramService] Transcribing for agent: ${agentType}`, {
      topics: agentSpecificOptions.topics,
      keyterms: agentSpecificOptions.keyterm
    });

    return await this.transcribeFile(audioBuffer, agentSpecificOptions);
  }

  /**
   * Analyze audio intelligence features
   */
  analyzeAudioIntelligence(result) {
    const analysis = {
      transcript: result.transcript,
      confidence: result.confidence,
      summary: result.summary,
      sentiment: {
        overall: result.sentiment?.average || 'neutral',
        score: result.sentiment?.score || 0,
        segments: result.sentiment?.segments || []
      },
      topics: (result.topics || []).map(topic => ({
        topic: topic.topic,
        confidence: topic.confidence,
        relevance: topic.relevance || 0
      })),
      intents: (result.intents || []).map(intent => ({
        intent: intent.intent,
        confidence: intent.confidence
      })),
      entities: (result.entities || []).map(entity => ({
        label: entity.label,
        value: entity.value,
        confidence: entity.confidence,
        start_word: entity.start_word,
        end_word: entity.end_word
      })),
      speakers: result.words ? this.analyzeSpeakers(result.words) : [],
      emotional_analysis: this.analyzeEmotionalContent(result)
    };

    return analysis;
  }

  /**
   * Analyze speakers from word-level data
   */
  analyzeSpeakers(words) {
    const speakers = new Set();
    const speakerSegments = [];
    
    words.forEach(word => {
      if (word.speaker !== undefined) {
        speakers.add(word.speaker);
      }
    });

    return {
      count: speakers.size,
      speakers: Array.from(speakers),
      segments: speakerSegments
    };
  }

  /**
   * Analyze emotional content from transcription
   */
  analyzeEmotionalContent(result) {
    const transcript = result.transcript?.toLowerCase() || '';
    
    // Basic emotional indicators
    const emotionalIndicators = {
      positive: ['happy', 'joy', 'excited', 'great', 'awesome', 'love', 'excellent'],
      negative: ['sad', 'angry', 'frustrated', 'terrible', 'hate', 'awful', 'horrible'],
      neutral: ['okay', 'fine', 'normal', 'regular', 'standard']
    };

    const emotions = {
      positive: 0,
      negative: 0,
      neutral: 0
    };

    Object.entries(emotionalIndicators).forEach(([emotion, indicators]) => {
      indicators.forEach(indicator => {
        if (transcript.includes(indicator)) {
          emotions[emotion]++;
        }
      });
    });

    return emotions;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      clientInitialized: !!this.client,
      liveConnected: this.isConnected,
      apiKeyConfigured: !!process.env.DEEPGRAM_API_KEY,
      model: 'nova-3',
      audioIntelligence: {
        sentiment: true,
        topics: true,
        intents: true,
        entities: true,
        summarization: true
      },
      agentTopics: Object.keys(this.agentTopics)
    };
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      if (!this.client) {
        throw new Error('Client not initialized');
      }

      // Create a small test audio buffer (silence)
      const testBuffer = Buffer.alloc(1024, 0);
      
      const response = await this.client.listen.prerecorded.transcribeFile(testBuffer, {
        model: 'nova-3',
        language: 'en-US',
        smart_format: true
      });

      return {
        success: true,
        message: 'Connection test successful',
        response: response
      };
    } catch (error) {
      console.error('[DeepgramService] Connection test failed:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }
}

// Export singleton instance
module.exports = new DeepgramService();