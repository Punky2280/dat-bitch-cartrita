// packages/backend/src/system/SensoryProcessingService.js
const { createClient } = require('@deepgram/sdk');
const MessageBus = require('./MessageBus');

/**
 * The SensoryProcessingService handles real-time sensory data streams,
 * starting with audio. It connects to a transcription service (Deepgram)
 * and pipes the audio data to it. When transcripts are received, they are
 * emitted onto the MessageBus for other agents to act upon.
 */
class SensoryProcessingService {
  constructor(coreAgent) {
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.coreAgent = coreAgent; // Reference to the CoreAgent for proactive responses
    this.connections = new Map();
    console.log('[SensoryService] Initialized.');
  }

  /**
   * Handles a new audio stream connection from a user.
   * @param {Socket} socket - The user's socket.io connection for the ambient namespace.
   */
  handleConnection(socket) {
    console.log(`[SensoryService] New ambient connection for user: ${socket.user.name}`);
    
    const deepgramConnection = this.deepgram.listen.live({
      model: 'nova-2',
      smart_format: true,
      interim_results: false, // We only want final, complete transcripts
      endpointing: 300, // Milliseconds of silence to consider a sentence complete
    });

    deepgramConnection.on('open', () => {
      console.log(`[SensoryService] Deepgram connection opened for user: ${socket.user.name}`);

      deepgramConnection.on('transcript', (data) => {
        const transcript = data.channel.alternatives[0].transcript;
        if (transcript) {
          console.log(`[SensoryService] Transcript received: "${transcript}"`);
          // Pass the transcript to the CoreAgent for potential proactive action
          this.coreAgent.handleAmbientTranscript(transcript, socket.user);
        }
      });

      deepgramConnection.on('error', (error) => {
        console.error('[SensoryService] Deepgram error:', error);
      });

      deepgramConnection.on('close', () => {
        console.log(`[SensoryService] Deepgram connection closed for user: ${socket.user.name}`);
        this.connections.delete(socket.id);
      });
    });

    socket.on('audio_stream', (audioData) => {
      if (deepgramConnection.getReadyState() === 1) { // 1 = OPEN
        deepgramConnection.send(audioData);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SensoryService] Ambient socket disconnected for user: ${socket.user.name}`);
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
    });

    this.connections.set(socket.id, deepgramConnection);
  }
}

module.exports = SensoryProcessingService;
