// packages/backend/src/system/SensoryProcessingService.js
const { createClient } = require('@deepgram/sdk');
const MessageBus = require('./MessageBus');

class SensoryProcessingService {
  constructor(coreAgent) {
    this.coreAgent = coreAgent;
    this.connections = new Map();
    
    // Temporarily disable Deepgram to test mock mode
    console.log('[SensoryService] Using mock transcription mode for testing.');
    this.deepgram = null;
  }

  handleConnection(socket) {
    console.log(`[SensoryService] New ambient connection for user: ${socket.user.name}`);
    console.log(`[SensoryService] Deepgram available: ${!!this.deepgram}`);
    
    // Handle case where Deepgram is not available
    if (!this.deepgram) {
      console.log(`[SensoryService] Deepgram not available, using mock transcription for user: ${socket.user.name}`);
      this.handleConnectionWithoutDeepgram(socket);
      return;
    }

    let deepgramConnection;
    try {
      deepgramConnection = this.deepgram.listen.live({
        model: 'nova-2',
        smart_format: true,
        interim_results: false,
        endpointing: 300,
      });
      console.log(`[SensoryService] Created Deepgram connection for user: ${socket.user.name}`);
    } catch (error) {
      console.error(`[SensoryService] Failed to create Deepgram connection:`, error);
      this.handleConnectionWithoutDeepgram(socket);
      return;
    }

    deepgramConnection.on('open', () => {
      console.log(`[SensoryService] Deepgram connection opened for user: ${socket.user.name}`);

      deepgramConnection.on('transcript', (data) => {
        console.log(`[SensoryService] Raw Deepgram data:`, JSON.stringify(data, null, 2));
        if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
          const transcript = data.channel.alternatives[0].transcript;
          if (transcript && transcript.trim()) {
            console.log(`[SensoryService] Transcript received: "${transcript}"`);
            console.log(`[SensoryService] Calling handleAmbientTranscript for user: ${socket.user.name}`);
            this.coreAgent.handleAmbientTranscript(transcript, socket.user);
          } else {
            console.log(`[SensoryService] Empty transcript received`);
          }
        } else {
          console.log(`[SensoryService] Invalid transcript data structure`);
        }
      });

      deepgramConnection.on('error', (error) => {
        console.error('[SensoryService] Deepgram error:', error);
        // Fallback to mock transcription on error
        console.log(`[SensoryService] Falling back to mock transcription for user: ${socket.user.name}`);
        this.handleConnectionWithoutDeepgram(socket);
      });
      deepgramConnection.on('close', () => {
        console.log(`[SensoryService] Deepgram connection closed for user: ${socket.user.name}`);
        this.connections.delete(socket.id);
      });
    });

    socket.on('audio_stream', (audioData) => {
      // DEBUG LOG: Confirm that audio data is being received.
      console.log(`[SensoryService] Received audio chunk of size: ${audioData.byteLength || audioData.length}, type: ${typeof audioData}`);
      console.log(`[SensoryService] Deepgram connection ready state: ${deepgramConnection.getReadyState()}`);
      
      if (deepgramConnection.getReadyState() === 1) {
        try {
          // Ensure audio data is in the right format
          const buffer = Buffer.from(audioData);
          deepgramConnection.send(buffer);
          console.log(`[SensoryService] Successfully sent ${buffer.length} bytes to Deepgram`);
        } catch (error) {
          console.error(`[SensoryService] Error sending audio to Deepgram:`, error);
        }
      } else {
        console.log(`[SensoryService] Deepgram connection not ready, skipping audio chunk`);
      }
    });

    socket.on('video_frame', (videoData) => {
      console.log(`[SensoryService] Received video frame of size: ${videoData.byteLength || videoData.length} for user: ${socket.user.name}`);
      // Process video frame for visual analysis
      const buffer = Buffer.from(videoData);
      this.coreAgent.handleVideoFrame(buffer, socket.user);
    });

    socket.on('disconnect', () => {
      console.log(`[SensoryService] Ambient socket disconnected for user: ${socket.user.name}`);
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
    });

    this.connections.set(socket.id, deepgramConnection);
  }

  // Fallback method when Deepgram is not available
  handleConnectionWithoutDeepgram(socket) {
    console.log(`[SensoryService] Setting up mock transcription for user: ${socket.user.name}`);
    
    // Mock transcription - for testing purposes, we'll simulate hearing "cartrita"
    let mockTranscriptTimer = null;
    
    socket.on('audio_stream', (audioData) => {
      console.log(`[SensoryService] Received audio chunk (mock mode): ${audioData.byteLength || audioData.length} bytes`);
      
      // For testing - simulate hearing "cartrita" every 30 seconds
      if (!mockTranscriptTimer) {
        mockTranscriptTimer = setTimeout(() => {
          console.log(`[SensoryService] Mock transcript: "hey cartrita can you help me"`);
          this.coreAgent.handleAmbientTranscript("hey cartrita can you help me", socket.user);
          mockTranscriptTimer = null;
        }, 10000); // 10 seconds for testing
      }
    });

    socket.on('video_frame', (videoData) => {
      console.log(`[SensoryService] Received video frame (mock mode): ${videoData.byteLength || videoData.length} bytes`);
      const buffer = Buffer.from(videoData);
      this.coreAgent.handleVideoFrame(buffer, socket.user);
    });

    socket.on('disconnect', () => {
      console.log(`[SensoryService] Mock ambient socket disconnected for user: ${socket.user.name}`);
      if (mockTranscriptTimer) {
        clearTimeout(mockTranscriptTimer);
      }
    });
  }
}

module.exports = SensoryProcessingService;
