const EventEmitter = require('events');
const DeepgramService = require('./DeepgramService');
const TextToSpeechService = require('./TextToSpeechService');
const MessageBus = require('../system/EnhancedMessageBus');

class VoiceInteractionService extends EventEmitter {
  constructor() {
    super();
    this.isListening = false;
    this.isProcessing = false;
    this.isSpeaking = false;
    this.voiceActivated = false;
    this.currentSession = null;
    this.interactionHistory = [];
    this.wakeWordDetected = false;
    
    // Voice interaction settings
    this.settings = {
      wakeWords: ['cartrita', 'hey cartrita', 'cartrita!'],
      autoListen: true,
      responseDelay: 500, // ms to wait before responding
      maxSilenceDuration: 3000, // ms of silence before stopping
      voicePersonality: 'urban_feminine',
      interruptionEnabled: true
    };

    this.initializeService();
  }

  async initializeService() {
    console.log('[VoiceInteractionService] Initializing voice interaction service...');
    
    // Set up Deepgram event listeners
    DeepgramService.on('connected', () => {
      console.log('[VoiceInteractionService] Deepgram connected');
      this.emit('serviceReady', 'deepgram');
    });

    DeepgramService.on('finalTranscript', (result) => {
      this.handleFinalTranscript(result);
    });

    DeepgramService.on('interimTranscript', (result) => {
      this.handleInterimTranscript(result);
    });

    DeepgramService.on('speechStarted', () => {
      this.handleSpeechStarted();
    });

    DeepgramService.on('speechEnded', () => {
      this.handleSpeechEnded();
    });

    DeepgramService.on('error', (error) => {
      console.error('[VoiceInteractionService] Deepgram error:', error);
      this.emit('error', error);
    });

    console.log('[VoiceInteractionService] Service initialized');
  }

  /**
   * Start voice interaction session
   */
  async startVoiceSession(userId, options = {}) {
    try {
      if (this.currentSession) {
        console.warn('[VoiceInteractionService] Session already active');
        return false;
      }

      console.log('[VoiceInteractionService] Starting voice session for user:', userId);

      this.currentSession = {
        userId: userId,
        sessionId: this.generateSessionId(),
        startTime: new Date(),
        settings: { ...this.settings, ...options },
        context: {
          conversationHistory: [],
          lastInteraction: null,
          currentTopic: null
        }
      };

      // Start listening for wake words
      await this.startWakeWordDetection();
      
      // Send greeting
      await this.sendGreeting();

      this.emit('sessionStarted', this.currentSession);
      return true;

    } catch (error) {
      console.error('[VoiceInteractionService] Failed to start session:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Stop voice interaction session
   */
  async stopVoiceSession() {
    try {
      if (!this.currentSession) {
        console.warn('[VoiceInteractionService] No active session to stop');
        return false;
      }

      console.log('[VoiceInteractionService] Stopping voice session');

      // Stop all active processes
      await this.stopListening();
      this.stopSpeaking();

      const sessionId = this.currentSession.sessionId;
      this.currentSession = null;
      this.voiceActivated = false;
      this.wakeWordDetected = false;

      this.emit('sessionEnded', { sessionId });
      return true;

    } catch (error) {
      console.error('[VoiceInteractionService] Failed to stop session:', error);
      return false;
    }
  }

  /**
   * Start listening for wake words
   */
  async startWakeWordDetection() {
    try {
      console.log('[VoiceInteractionService] Starting wake word detection');
      
      await DeepgramService.startLiveTranscription({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 500,
        vad_events: true
      });

      this.isListening = true;
      this.emit('listeningStarted', 'wake_word');

    } catch (error) {
      console.error('[VoiceInteractionService] Failed to start wake word detection:', error);
      throw error;
    }
  }

  /**
   * Start active conversation listening
   */
  async startConversationListening() {
    try {
      if (this.isListening) {
        console.log('[VoiceInteractionService] Already listening, switching to conversation mode');
        this.voiceActivated = true;
        this.emit('conversationModeActivated');
        return;
      }

      console.log('[VoiceInteractionService] Starting conversation listening');
      
      await DeepgramService.startLiveTranscription({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        vad_events: true,
        filler_words: false
      });

      this.isListening = true;
      this.voiceActivated = true;
      this.emit('listeningStarted', 'conversation');

    } catch (error) {
      console.error('[VoiceInteractionService] Failed to start conversation listening:', error);
      throw error;
    }
  }

  /**
   * Stop listening
   */
  async stopListening() {
    try {
      if (!this.isListening) {
        return;
      }

      console.log('[VoiceInteractionService] Stopping listening');
      DeepgramService.stopLiveTranscription();
      this.isListening = false;
      this.emit('listeningStopped');

    } catch (error) {
      console.error('[VoiceInteractionService] Error stopping listening:', error);
    }
  }

  /**
   * Handle final transcript from Deepgram
   */
  async handleFinalTranscript(result) {
    try {
      console.log('[VoiceInteractionService] Final transcript:', result);

      if (!result.text || result.text.trim().length === 0) {
        return;
      }

      const transcript = result.text.trim();
      
      // Check for wake word if not already activated
      if (!this.voiceActivated) {
        const wakeWordResult = DeepgramService.detectWakeWord(transcript, this.currentSession?.settings?.wakeWords);
        
        if (wakeWordResult.detected) {
          console.log('[VoiceInteractionService] Wake word detected!');
          this.wakeWordDetected = true;
          await this.activateVoiceMode(wakeWordResult.cleanTranscript);
          return;
        }
      }

      // Process conversation if voice is activated
      if (this.voiceActivated && !this.isProcessing) {
        await this.processVoiceInput(transcript, result.confidence);
      }

    } catch (error) {
      console.error('[VoiceInteractionService] Error handling final transcript:', error);
    }
  }

  /**
   * Handle interim transcript from Deepgram
   */
  handleInterimTranscript(result) {
    if (this.voiceActivated && result.text && result.text.trim().length > 0) {
      this.emit('interimTranscript', {
        text: result.text,
        confidence: result.confidence,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle speech started event
   */
  handleSpeechStarted() {
    console.log('[VoiceInteractionService] Speech started');
    
    // Stop current speech if interruption is enabled
    if (this.currentSession?.settings?.interruptionEnabled && this.isSpeaking) {
      this.stopSpeaking();
    }
    
    this.emit('speechStarted');
  }

  /**
   * Handle speech ended event
   */
  handleSpeechEnded() {
    console.log('[VoiceInteractionService] Speech ended');
    this.emit('speechEnded');
  }

  /**
   * Activate voice mode after wake word detection
   */
  async activateVoiceMode(initialCommand = '') {
    try {
      console.log('[VoiceInteractionService] Activating voice mode');
      
      this.voiceActivated = true;
      await this.startConversationListening();
      
      // Acknowledge activation
      const acknowledgments = [
        "I'm here! What's up?",
        "Yes! How can I help?",
        "Hey! What do you need?",
        "I'm listening! What can I do for you?",
        "Yo! I'm here for you!"
      ];
      
      const acknowledgment = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
      await this.speak(acknowledgment, 'friendly');
      
      // Process initial command if provided
      if (initialCommand && initialCommand.trim().length > 0) {
        setTimeout(() => {
          this.processVoiceInput(initialCommand, 1.0);
        }, 1000); // Give time for acknowledgment to play
      }
      
      this.emit('voiceModeActivated', { initialCommand });

    } catch (error) {
      console.error('[VoiceInteractionService] Error activating voice mode:', error);
    }
  }

  /**
   * Process voice input and generate response
   */
  async processVoiceInput(transcript, confidence) {
    try {
      if (this.isProcessing) {
        console.log('[VoiceInteractionService] Already processing, ignoring input');
        return;
      }

      console.log('[VoiceInteractionService] Processing voice input:', transcript);
      
      this.isProcessing = true;
      this.emit('processingStarted', { transcript, confidence });

      // Add to interaction history
      const interaction = {
        timestamp: new Date(),
        type: 'voice_input',
        transcript: transcript,
        confidence: confidence,
        userId: this.currentSession.userId
      };

      this.interactionHistory.push(interaction);
      this.currentSession.context.conversationHistory.push(interaction);

      // Check for system commands
      const systemCommand = this.checkSystemCommands(transcript);
      if (systemCommand) {
        await this.handleSystemCommand(systemCommand, transcript);
        this.isProcessing = false;
        return;
      }

      // Send to AI system for processing
      const response = await this.getAIResponse(transcript);
      
      // Generate and play speech response
      await this.speak(response.text, response.emotion || 'friendly');
      
      // Add response to history
      const responseInteraction = {
        timestamp: new Date(),
        type: 'voice_response',
        text: response.text,
        emotion: response.emotion,
        userId: this.currentSession.userId
      };

      this.interactionHistory.push(responseInteraction);
      this.currentSession.context.conversationHistory.push(responseInteraction);
      this.currentSession.context.lastInteraction = new Date();

      this.emit('responseGenerated', responseInteraction);

    } catch (error) {
      console.error('[VoiceInteractionService] Error processing voice input:', error);
      await this.speak("Sorry, I had trouble understanding that. Can you try again?", 'calm');
    } finally {
      this.isProcessing = false;
      this.emit('processingEnded');
    }
  }

  /**
   * Check for system commands
   */
  checkSystemCommands(transcript) {
    const lowerTranscript = transcript.toLowerCase();
    
    const commands = {
      stop: ['stop', 'end conversation', 'goodbye', 'bye', 'that\'s all'],
      pause: ['pause', 'hold on', 'wait'],
      repeat: ['repeat', 'say that again', 'what did you say'],
      louder: ['louder', 'speak up', 'volume up'],
      quieter: ['quieter', 'lower volume', 'volume down'],
      faster: ['faster', 'speed up'],
      slower: ['slower', 'slow down']
    };

    for (const [command, phrases] of Object.entries(commands)) {
      for (const phrase of phrases) {
        if (lowerTranscript.includes(phrase)) {
          return command;
        }
      }
    }

    return null;
  }

  /**
   * Handle system commands
   */
  async handleSystemCommand(command, transcript) {
    console.log('[VoiceInteractionService] Handling system command:', command);

    switch (command) {
      case 'stop':
        await this.speak("Alright, I'll stop listening. Just say Cartrita if you need me again!", 'friendly');
        setTimeout(() => {
          this.voiceActivated = false;
          this.emit('voiceModeDeactivated');
        }, 2000);
        break;

      case 'pause':
        await this.speak("Okay, I'll wait for you!", 'friendly');
        this.voiceActivated = false;
        setTimeout(() => {
          this.voiceActivated = true;
        }, 5000);
        break;

      case 'repeat':
        const lastResponse = this.interactionHistory
          .slice()
          .reverse()
          .find(i => i.type === 'voice_response');
        
        if (lastResponse) {
          await this.speak(lastResponse.text, lastResponse.emotion);
        } else {
          await this.speak("I haven't said anything yet! What can I help you with?", 'playful');
        }
        break;

      default:
        await this.speak("Got it! I'll adjust that for you.", 'friendly');
    }
  }

  /**
   * Get AI response for voice input
   */
  async getAIResponse(transcript) {
    try {
      // Send message to MessageBus to get AI response
      const messagePayload = {
        type: 'TASK_REQUEST',
        payload: {
          task_type: 'voice_conversation',
          prompt: transcript,
          context: {
            isVoiceMode: true,
            personality: 'urban_feminine',
            conversationHistory: this.currentSession.context.conversationHistory.slice(-5) // Last 5 interactions
          },
          userId: this.currentSession.userId,
          language: 'en'
        }
      };

      // For now, use a simple response - in full implementation, this would go through the agent system
      const responses = this.generateContextualResponse(transcript);
      
      return {
        text: responses.text,
        emotion: responses.emotion || 'friendly'
      };

    } catch (error) {
      console.error('[VoiceInteractionService] Error getting AI response:', error);
      return {
        text: "I'm having trouble processing that right now. Can you try asking in a different way?",
        emotion: 'calm'
      };
    }
  }

  /**
   * Generate contextual response (placeholder for full AI integration)
   */
  generateContextualResponse(input) {
    const lowerInput = input.toLowerCase();
    
    // Greeting responses
    if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
      return {
        text: "Hey there! Great to talk with you! What's on your mind today?",
        emotion: 'friendly'
      };
    }
    
    // Question responses
    if (lowerInput.includes('how are you')) {
      return {
        text: "I'm doing amazing! Thanks for asking! I'm here and ready to help with whatever you need.",
        emotion: 'excited'
      };
    }
    
    // Help requests
    if (lowerInput.includes('help') || lowerInput.includes('can you')) {
      return {
        text: "Absolutely! I'm here to help you with anything you need. Just tell me what you're looking for!",
        emotion: 'encouraging'
      };
    }
    
    // Default response
    return {
      text: "That's interesting! Tell me more about that, I'd love to help you figure it out.",
      emotion: 'friendly'
    };
  }

  /**
   * Speak text using TTS service
   */
  async speak(text, emotion = 'friendly') {
    try {
      if (this.isSpeaking) {
        console.log('[VoiceInteractionService] Already speaking, queuing response');
        // In a full implementation, you might queue responses
        return;
      }

      console.log('[VoiceInteractionService] Speaking:', text.substring(0, 50) + '...');
      
      this.isSpeaking = true;
      this.emit('speakingStarted', { text, emotion });

      const speechResult = await TextToSpeechService.generateEmotionalSpeech(text, emotion);
      
      // In a real implementation, you would send this audio to the client
      // For now, we'll simulate the speaking duration
      const duration = speechResult.duration * 1000; // Convert to milliseconds
      
      this.emit('audioGenerated', {
        audioBuffer: speechResult.audioBuffer,
        format: speechResult.format,
        duration: duration,
        text: text,
        emotion: emotion
      });

      // Simulate speaking time
      setTimeout(() => {
        this.isSpeaking = false;
        this.emit('speakingEnded', { text, emotion, duration });
      }, duration);

    } catch (error) {
      console.error('[VoiceInteractionService] Error speaking:', error);
      this.isSpeaking = false;
      this.emit('speakingError', error);
    }
  }

  /**
   * Stop current speech
   */
  stopSpeaking() {
    if (this.isSpeaking) {
      console.log('[VoiceInteractionService] Stopping speech');
      this.isSpeaking = false;
      this.emit('speakingStopped');
    }
  }

  /**
   * Send greeting message
   */
  async sendGreeting() {
    try {
      const greeting = await TextToSpeechService.generateGreeting();
      await this.speak(greeting.text || "Hey! I'm ready to chat whenever you are. Just say my name!", 'friendly');
    } catch (error) {
      console.error('[VoiceInteractionService] Error sending greeting:', error);
    }
  }

  /**
   * Send audio data to Deepgram (for real-time streaming)
   */
  sendAudioData(audioData) {
    if (this.isListening) {
      return DeepgramService.sendAudioData(audioData);
    }
    return false;
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `voice_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isListening: this.isListening,
      isProcessing: this.isProcessing,
      isSpeaking: this.isSpeaking,
      voiceActivated: this.voiceActivated,
      hasActiveSession: !!this.currentSession,
      sessionId: this.currentSession?.sessionId || null,
      deepgramStatus: DeepgramService.getStatus(),
      ttsStatus: TextToSpeechService.getStatus()
    };
  }

  /**
   * Get interaction history
   */
  getInteractionHistory() {
    return {
      totalInteractions: this.interactionHistory.length,
      recentInteractions: this.interactionHistory.slice(-10),
      currentSession: this.currentSession ? {
        sessionId: this.currentSession.sessionId,
        startTime: this.currentSession.startTime,
        conversationLength: this.currentSession.context.conversationHistory.length
      } : null
    };
  }
}

// Export singleton instance
module.exports = new VoiceInteractionService();