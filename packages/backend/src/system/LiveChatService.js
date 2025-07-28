// packages/backend/src/system/LiveChatService.js
const { createClient } = require('@deepgram/sdk');

class LiveChatService {
  constructor(coreAgent) {
    this.coreAgent = coreAgent;
    if (process.env.DEEPGRAM_API_KEY) {
      this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
      console.log('[LiveChatService] Deepgram client initialized.');
    } else {
      this.deepgram = null;
      console.error('[LiveChatService] DEEPGRAM_API_KEY not found. Live chat will not function.');
    }
  }

  handleConnection(socket) {
    if (!this.deepgram) {
      socket.emit('error', 'Live chat service is not configured on the server.');
      return;
    }

    console.log(`[LiveChatService] New connection for user: ${socket.user.name}`);

    const deepgramConnection = this.deepgram.listen.live({
      model: 'nova-2',
      smart_format: true,
      interim_results: true, // We want interim for better UX
      endpointing: 500, // Shorter endpointing for conversational flow
      utterance_end_ms: 1000,
    });

    deepgramConnection.on('open', () => {
      console.log(`[LiveChatService] Deepgram connection opened for: ${socket.user.name}`);

      deepgramConnection.on('transcript', (data) => {
        const transcript = data.channel.alternatives[0].transcript;
        if (transcript) {
          // Emit interim results to the frontend for a responsive UI
          socket.emit('live_transcript', {
            text: transcript,
            is_final: data.is_final,
          });
        }

        // When the utterance is final and not empty, process it
        if (data.is_final && transcript.trim()) {
          console.log(`[LiveChatService] Final transcript received: "${transcript}"`);
          this.processTranscript(transcript, socket);
        }
      });

      deepgramConnection.on('error', (error) => console.error('[LiveChatService] Deepgram error:', error));
      deepgramConnection.on('close', () => console.log(`[LiveChatService] Deepgram connection closed for: ${socket.user.name}`));
    });

    socket.on('audio_stream', (audioData) => {
      if (deepgramConnection.getReadyState() === 1) { // 1 = OPEN
        deepgramConnection.send(Buffer.from(audioData));
      }
    });

    socket.on('disconnect', () => {
      console.log(`[LiveChatService] User disconnected: ${socket.user.name}`);
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
    });
  }

  async processTranscript(transcript, socket) {
    try {
      const agentResponse = await this.coreAgent.generateResponse(transcript, 'en', socket.user.userId);
      socket.emit('live_response_text', agentResponse); // Send text for UI display

      const audioBuffer = await this.coreAgent.generateSpeech(agentResponse.text);
      if (audioBuffer) {
        socket.emit('live_response_audio', { audio: audioBuffer.toString('base64') });
        console.log(`[LiveChatService] Sent audio response of ${audioBuffer.length} bytes.`);
      }
    } catch (error) {
      console.error('[LiveChatService] Error processing transcript:', error);
      socket.emit('error', 'Failed to process your request.');
    }
  }
}

module.exports = LiveChatService;