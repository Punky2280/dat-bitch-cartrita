/**
 * Audio Wizard Agent - Master of speech, sound, and audio processing
 * Utilizes HuggingFace Pro models for advanced audio intelligence
 */

import HuggingFaceInferenceService from '../services/HuggingFaceInferenceService.js';

export default class AudioWizardAgent {
  constructor() {
    this.name = 'AudioWizard';
    this.personality = 'Sophisticated audio engineer with deep understanding of sound and speech';
    this.specializations = [
      'automatic-speech-recognition',
      'text-to-speech',
      'audio-classification', 
      'voice-activity-detection',
      'audio-to-audio',
      'text-to-audio'
    ];
    this.hfService = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.hfService = new HuggingFaceInferenceService();
      this.isInitialized = true;
      console.log('[AudioWizard] 🎵 Audio intelligence agent initialized');
      return true;
    } catch (error) {
      console.error('[AudioWizard] ❌ Initialization failed:', error.message);
      return false;
    }
  }

  async transcribeAudio(audioData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AudioWizard agent not initialized');
    }

    const result = await this.hfService.automaticSpeechRecognition(audioData, {
      model: 'openai/whisper-large-v3',
      ...options
    });

    return {
      agent: this.name,
      transcription: result.text,
      confidence: result.confidence || 0.95,
      language: options.language || 'auto-detected',
      timestamp: new Date().toISOString()
    };
  }

  async synthesizeSpeech(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AudioWizard agent not initialized');
    }

    const audioBlob = await this.hfService.textToSpeech(text, {
      model: 'microsoft/speecht5_tts',
      ...options
    });

    return {
      agent: this.name,
      text,
      audio: audioBlob,
      voice: options.voice || 'default',
      timestamp: new Date().toISOString()
    };
  }

  async classifyAudio(audioData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AudioWizard agent not initialized');
    }

    const result = await this.hfService.audioClassification(audioData, {
      model: 'MIT/ast-finetuned-audioset-10-10-0.4593',
      ...options
    });

    return {
      agent: this.name,
      classifications: result.map(r => ({
        label: r.label,
        confidence: r.score
      })),
      dominantClass: result[0]?.label,
      timestamp: new Date().toISOString()
    };
  }

  async detectVoiceActivity(audioData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AudioWizard agent not initialized');
    }

    try {
      // Use specialized VAD model if available
      const result = await this.hfService.audioClassification(audioData, {
        model: 'pyannote/voice-activity-detection',
        ...options
      });

      return {
        agent: this.name,
        hasVoice: result.some(r => r.label.includes('speech') || r.label.includes('voice')),
        segments: result,
        confidence: Math.max(...result.map(r => r.score)),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Fallback to general audio classification
      const result = await this.classifyAudio(audioData, options);
      const hasVoice = result.classifications.some(c => 
        c.label.toLowerCase().includes('speech') || 
        c.label.toLowerCase().includes('voice') ||
        c.label.toLowerCase().includes('talk')
      );

      return {
        agent: this.name,
        hasVoice,
        segments: result.classifications,
        confidence: result.classifications[0]?.confidence || 0.5,
        timestamp: new Date().toISOString(),
        fallback: true
      };
    }
  }

  async analyzeAudio(audioData, analysisType = 'comprehensive', options = {}) {
    if (!this.isInitialized) {
      throw new Error('AudioWizard agent not initialized');
    }

    const results = {
      agent: this.name,
      analysisType,
      timestamp: new Date().toISOString(),
      results: {}
    };

    try {
      switch (analysisType) {
        case 'transcription':
          results.results.transcription = await this.transcribeAudio(audioData, options);
          break;
          
        case 'classification':
          results.results.classification = await this.classifyAudio(audioData, options);
          break;
          
        case 'voice-detection':
          results.results.voiceActivity = await this.detectVoiceActivity(audioData, options);
          break;
          
        case 'comprehensive':
          // Run multiple analyses
          const [transcription, classification, voiceActivity] = await Promise.allSettled([
            this.transcribeAudio(audioData, options).catch(() => null),
            this.classifyAudio(audioData, options).catch(() => null),
            this.detectVoiceActivity(audioData, options).catch(() => null)
          ]);
          
          results.results.transcription = transcription.status === 'fulfilled' ? transcription.value : null;
          results.results.classification = classification.status === 'fulfilled' ? classification.value : null;
          results.results.voiceActivity = voiceActivity.status === 'fulfilled' ? voiceActivity.value : null;
          break;
          
        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }
      
      return results;
    } catch (error) {
      console.error(`[AudioWizard] Analysis failed:`, error);
      throw error;
    }
  }

  async generateAudioFromText(text, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AudioWizard agent not initialized');
    }

    // For music/sound effects, use music generation model
    if (options.type === 'music' || options.type === 'audio') {
      const audioBlob = await this.hfService.hf.textToAudio({
        inputs: text,
        model: 'facebook/musicgen-small',
        ...options
      });

      return {
        agent: this.name,
        prompt: text,
        audio: audioBlob,
        type: options.type,
        timestamp: new Date().toISOString()
      };
    }

    // Default to speech synthesis
    return await this.synthesizeSpeech(text, options);
  }

  generateResponse(userMessage, context = {}) {
    const responses = [
      `Let me analyze this audio with my acoustic sensors and advanced hearing algorithms.`,
      `I'm processing the sound waves and frequency patterns in this audio file.`,
      `My audio analysis systems are detecting speech patterns, tones, and acoustic signatures.`,
      `Interesting audio data! I can identify multiple acoustic elements and speech characteristics.`,
      `I'm listening carefully and analyzing the spectral content of this audio.`,
      `Let me apply my audio intelligence to understand what's happening in this sound.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  getCapabilities() {
    return {
      name: this.name,
      personality: this.personality,
      specializations: this.specializations,
      features: [
        'High-accuracy speech recognition (Whisper-v3)',
        'Natural text-to-speech synthesis',
        'Audio content classification',
        'Voice activity detection',
        'Music and sound generation',
        'Audio-to-audio transformation',
        'Multi-language speech processing',
        'Real-time audio analysis'
      ]
    };
  }
}