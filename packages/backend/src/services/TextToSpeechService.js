const OpenAI = require('openai');
const EventEmitter = require('events');

class TextToSpeechService extends EventEmitter {
  constructor() {
    super();
    this.openai = null;
    this.initializeClient();
  }

  initializeClient() {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[TextToSpeechService] OpenAI API key not configured');
      return;
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    console.log('[TextToSpeechService] OpenAI client initialized');
  }

  /**
   * Generate speech from text with feminine urban voice characteristics
   */
  async generateSpeech(text, options = {}) {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      if (!text || text.trim().length === 0) {
        throw new Error('No text provided for speech generation');
      }

      // Preprocess text for urban feminine voice characteristics
      const processedText = this.preprocessTextForUrbanVoice(text);

      const defaultOptions = {
        model: 'tts-1-hd', // Higher quality model
        voice: 'nova', // Feminine voice that works well for urban characteristics
        response_format: 'mp3',
        speed: 1.0,
        ...options
      };

      console.log('[TextToSpeechService] Generating speech:', {
        text: processedText.substring(0, 100) + '...',
        voice: defaultOptions.voice,
        model: defaultOptions.model
      });

      const mp3 = await this.openai.audio.speech.create({
        model: defaultOptions.model,
        voice: defaultOptions.voice,
        input: processedText,
        response_format: defaultOptions.response_format,
        speed: defaultOptions.speed
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      
      console.log('[TextToSpeechService] Speech generated successfully:', {
        size: buffer.length,
        format: defaultOptions.response_format
      });

      return {
        audioBuffer: buffer,
        format: defaultOptions.response_format,
        text: processedText,
        voice: defaultOptions.voice,
        duration: this.estimateAudioDuration(processedText, defaultOptions.speed)
      };

    } catch (error) {
      console.error('[TextToSpeechService] Speech generation error:', error);
      throw new Error(`Speech generation failed: ${error.message}`);
    }
  }

  /**
   * Generate streaming speech (for real-time conversation)
   */
  async generateStreamingSpeech(text, options = {}) {
    try {
      const defaultOptions = {
        model: 'tts-1', // Faster model for streaming
        voice: 'nova',
        response_format: 'mp3',
        speed: 1.1, // Slightly faster for conversational feel
        ...options
      };

      const processedText = this.preprocessTextForUrbanVoice(text);

      console.log('[TextToSpeechService] Generating streaming speech');

      const mp3 = await this.openai.audio.speech.create({
        model: defaultOptions.model,
        voice: defaultOptions.voice,
        input: processedText,
        response_format: defaultOptions.response_format,
        speed: defaultOptions.speed
      });

      // Return the stream directly for real-time playback
      return {
        audioStream: mp3.body,
        format: defaultOptions.response_format,
        text: processedText,
        voice: defaultOptions.voice
      };

    } catch (error) {
      console.error('[TextToSpeechService] Streaming speech generation error:', error);
      throw error;
    }
  }

  /**
   * Preprocess text to add urban feminine voice characteristics
   */
  preprocessTextForUrbanVoice(text) {
    let processed = text;

    // Add natural speech patterns and emphasis
    processed = processed
      // Add emphasis to important words
      .replace(/\b(absolutely|definitely|totally|really|super|amazing|incredible)\b/gi, '$1!')
      
      // Make questions more conversational
      .replace(/\?/g, '?!')
      
      // Add natural pauses for better flow
      .replace(/\. /g, '... ')
      .replace(/\, /g, ', ')
      
      // Urban speech patterns (keep it professional but friendly)
      .replace(/\boh my god\b/gi, 'oh my gosh')
      .replace(/\bokay\b/gi, 'okay')
      .replace(/\byeah\b/gi, 'yeah!')
      
      // Pronunciation adjustments for better flow
      .replace(/\bgoing to\b/gi, 'gonna')
      .replace(/\bwant to\b/gi, 'wanna')
      .replace(/\bhave to\b/gi, 'gotta')
      .replace(/\bkind of\b/gi, 'kinda');

    // Add personality markers
    const conversationalStarters = [
      'Hey', 'Yo', 'Alright', 'So', 'Listen', 'Look', 'Girl', 'Honey'
    ];
    
    const conversationalEnders = [
      'you know?', 'for real', 'no cap', 'period', 'facts'
    ];

    // Randomly add conversational elements (10% chance)
    if (Math.random() < 0.1 && !processed.toLowerCase().startsWith('hey')) {
      const starter = conversationalStarters[Math.floor(Math.random() * conversationalStarters.length)];
      processed = `${starter}, ${processed.toLowerCase()}`;
    }

    // Clean up excessive punctuation
    processed = processed
      .replace(/\.{4,}/g, '...')
      .replace(/!{3,}/g, '!!')
      .replace(/\?{3,}/g, '??');

    return processed;
  }

  /**
   * Generate speech with emotion/tone
   */
  async generateEmotionalSpeech(text, emotion = 'friendly', options = {}) {
    const emotionalOptions = this.getEmotionalOptions(emotion);
    const enhancedText = this.addEmotionalContext(text, emotion);
    
    return this.generateSpeech(enhancedText, {
      ...emotionalOptions,
      ...options
    });
  }

  /**
   * Get voice options based on emotion
   */
  getEmotionalOptions(emotion) {
    const emotionMap = {
      'friendly': { voice: 'nova', speed: 1.0 },
      'excited': { voice: 'nova', speed: 1.2 },
      'calm': { voice: 'nova', speed: 0.9 },
      'confident': { voice: 'nova', speed: 1.1 },
      'playful': { voice: 'nova', speed: 1.15 },
      'serious': { voice: 'nova', speed: 0.95 },
      'encouraging': { voice: 'nova', speed: 1.05 }
    };

    return emotionMap[emotion] || emotionMap['friendly'];
  }

  /**
   * Add emotional context to text
   */
  addEmotionalContext(text, emotion) {
    const emotionalPrefixes = {
      'excited': ['OMG', 'Yo!', 'No way!', 'That\'s amazing!'],
      'encouraging': ['You got this!', 'I believe in you!', 'Keep going!'],
      'playful': ['Hehe', 'Girl!', 'So cute!'],
      'confident': ['Listen up', 'I know this', 'Trust me'],
      'calm': ['Take a breath', 'It\'s all good', 'No worries']
    };

    if (emotionalPrefixes[emotion] && Math.random() < 0.3) {
      const prefix = emotionalPrefixes[emotion][Math.floor(Math.random() * emotionalPrefixes[emotion].length)];
      return `${prefix}... ${text}`;
    }

    return text;
  }

  /**
   * Estimate audio duration based on text length and speed
   */
  estimateAudioDuration(text, speed = 1.0) {
    // Average speaking rate: ~150 words per minute
    const wordsPerMinute = 150 * speed;
    const wordCount = text.split(/\s+/).length;
    const durationMinutes = wordCount / wordsPerMinute;
    return Math.ceil(durationMinutes * 60); // Return in seconds
  }

  /**
   * Generate greeting message with personality
   */
  async generateGreeting(context = '') {
    const greetings = [
      "Hey there! What's good?",
      "Yo! How can I help you today?",
      "Hey girl! What can I do for you?",
      "What's up! I'm here and ready to help!",
      "Hey! How are we feeling today?",
      "Yo yo! What's on your mind?",
      "Hey beautiful! What can I help you with?",
      "What's poppin'! Ready to get things done?",
      "Hey there! I'm all ears - what do you need?",
      "Yooo! Let's make something happen today!"
    ];

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    const fullGreeting = context ? `${greeting} ${context}` : greeting;
    
    return this.generateEmotionalSpeech(fullGreeting, 'friendly');
  }

  /**
   * Generate conversation response with personality
   */
  async generateConversationalResponse(response, emotion = 'friendly') {
    // Add conversational filler and personality
    const conversationalResponse = this.makeConversational(response);
    return this.generateEmotionalSpeech(conversationalResponse, emotion);
  }

  /**
   * Make response more conversational
   */
  makeConversational(text) {
    const fillers = ['So', 'Well', 'You know', 'I mean', 'Like', 'Basically'];
    const affirmations = ['Right?', 'You feel me?', 'Make sense?', 'You know what I mean?'];
    
    let conversational = text;
    
    // Add occasional filler at the beginning (20% chance)
    if (Math.random() < 0.2) {
      const filler = fillers[Math.floor(Math.random() * fillers.length)];
      conversational = `${filler}, ${conversational.toLowerCase()}`;
    }
    
    // Add occasional affirmation at the end (15% chance)
    if (Math.random() < 0.15) {
      const affirmation = affirmations[Math.floor(Math.random() * affirmations.length)];
      conversational = `${conversational} ${affirmation}`;
    }
    
    return conversational;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      clientInitialized: !!this.openai,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
      availableVoices: ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'],
      defaultVoice: 'nova'
    };
  }

  /**
   * Test TTS service
   */
  async testService() {
    try {
      const testText = "Hey! This is a test of Cartrita's voice system. How does it sound?";
      const result = await this.generateSpeech(testText);
      
      return {
        success: true,
        message: 'TTS test successful',
        audioSize: result.audioBuffer.length,
        estimatedDuration: result.duration
      };
    } catch (error) {
      console.error('[TextToSpeechService] Test failed:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }
}

// Export singleton instance
module.exports = new TextToSpeechService();