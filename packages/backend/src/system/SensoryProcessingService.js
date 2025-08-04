// packages/backend/src/system/SensoryProcessingService.js
// Sensory Processing Service for Cartrita AI Assistant

import EventEmitter from 'events';

class SensoryProcessingService extends EventEmitter {
  constructor() {
    super();
    this.audioBuffer = [];
    this.visualBuffer = [];
    this.textBuffer = [];
    this.isProcessing = false;
    
    console.log('[SensoryProcessingService] 🧠 Sensory processing service initialized');
  }

  // Process audio input
  processAudio(audioData) {
    try {
      this.audioBuffer.push({
        data: audioData,
        timestamp: Date.now(),
        type: 'audio'
      });
      
      this.emit('audioProcessed', audioData);
      console.log('[SensoryProcessingService] 🎵 Audio processed');
    } catch (error) {
      console.error('[SensoryProcessingService] ❌ Audio processing error:', error);
    }
  }

  // Process visual input
  processVisual(visualData) {
    try {
      this.visualBuffer.push({
        data: visualData,
        timestamp: Date.now(),
        type: 'visual'
      });
      
      this.emit('visualProcessed', visualData);
      console.log('[SensoryProcessingService] 👁️ Visual processed');
    } catch (error) {
      console.error('[SensoryProcessingService] ❌ Visual processing error:', error);
    }
  }

  // Process text input
  processText(textData) {
    try {
      this.textBuffer.push({
        data: textData,
        timestamp: Date.now(),
        type: 'text'
      });
      
      this.emit('textProcessed', textData);
      console.log('[SensoryProcessingService] 📝 Text processed');
    } catch (error) {
      console.error('[SensoryProcessingService] ❌ Text processing error:', error);
    }
  }

  // Get recent sensory data
  getRecentData(type = 'all', limit = 10) {
    try {
      let data = [];
      
      if (type === 'all' || type === 'audio') {
        data = data.concat(this.audioBuffer.slice(-limit));
      }
      if (type === 'all' || type === 'visual') {
        data = data.concat(this.visualBuffer.slice(-limit));
      }
      if (type === 'all' || type === 'text') {
        data = data.concat(this.textBuffer.slice(-limit));
      }
      
      return data.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    } catch (error) {
      console.error('[SensoryProcessingService] ❌ Error getting recent data:', error);
      return [];
    }
  }

  // Clear buffers
  clearBuffers() {
    this.audioBuffer = [];
    this.visualBuffer = [];
    this.textBuffer = [];
    console.log('[SensoryProcessingService] 🧹 Buffers cleared');
  }
}

export default SensoryProcessingService;
