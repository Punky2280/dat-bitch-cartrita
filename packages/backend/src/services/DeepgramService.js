const { createClient } = require('@deepgram/sdk');
const EventEmitter = require('events');

class DeepgramService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.liveConnection = null;
    this.isConnected = false;
    this.initializeClient();
  }

  initializeClient() {
    if (!process.env.DEEPGRAM_API_KEY) {
      console.error('[DeepgramService] API key not configured');
      return;
    }

    this.client = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('[DeepgramService] Client initialized');
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
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        diarize: false,
        filler_words: false,
        utterances: true,
        paragraphs: true,
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
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        interim_results: true,
        endpointing: 300,
        vad_events: true,
        filler_words: false,
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
        summary: alternative.summaries?.[0]?.summary || null
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
   * Get service status
   */
  getStatus() {
    return {
      clientInitialized: !!this.client,
      liveConnected: this.isConnected,
      apiKeyConfigured: !!process.env.DEEPGRAM_API_KEY
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
        model: 'nova-2',
        language: 'en-US'
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