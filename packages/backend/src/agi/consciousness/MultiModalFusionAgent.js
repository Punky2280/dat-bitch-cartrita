import BaseAgent from '../../system/BaseAgent.js';
import VoiceInteractionService from '../../services/VoiceInteractionService.js';
import AmbientListeningService from '../../services/AmbientListeningService.js';
import VisualAnalysisService from '../../services/VisualAnalysisService.js';
import TextToSpeechService from '../../services/TextToSpeechService.js';

class MultiModalFusionAgent extends BaseAgent {
  constructor(config = {}) {
    super('MultiModalFusionAgent', config);
    this.modalityWeights = {
      voice: 0.4,
      visual: 0.3,
      ambient: 0.2,
      text: 0.1
    };
    this.fusionHistory = [];
    this.activeModalities = new Set();
    this.initialized = false;
    
    console.log('🔀 MultiModalFusionAgent initialized');
    this.initialize();
  }

  async initialize() {
    try {
      // Set up cross-modal event listeners
      this.setupModalityListeners();
      
      this.initialized = true;
      console.log('[MultiModalFusionAgent] ✅ Service initialized');
    } catch (error) {
      console.error('[MultiModalFusionAgent] ❌ Initialization failed:', error);
    }
  }

  setupModalityListeners() {
    // Voice interaction events
    VoiceInteractionService.on('transcript-ready', (data) => {
      this.processFusion('voice', data);
    });

    // Ambient listening events
    AmbientListeningService.on('ambient-sound-detected', (data) => {
      this.processFusion('ambient', data);
    });
  }

  async processFusion(modality, data) {
    try {
      this.activeModalities.add(modality);
      
      const fusionData = {
        modality,
        data,
        timestamp: new Date().toISOString(),
        weight: this.modalityWeights[modality] || 0.1
      };

      this.fusionHistory.push(fusionData);
      
      // Keep only recent fusion events
      if (this.fusionHistory.length > 50) {
        this.fusionHistory = this.fusionHistory.slice(-25);
      }

      // Trigger multi-modal analysis if multiple modalities are active
      if (this.activeModalities.size >= 2) {
        await this.performFusionAnalysis();
      }

    } catch (error) {
      console.error('[MultiModalFusionAgent] ❌ Fusion processing failed:', error);
    }
  }

  async performFusionAnalysis() {
    const recentEvents = this.fusionHistory.slice(-10);
    const modalityGroups = this.groupByModality(recentEvents);
    
    const fusionResult = {
      timestamp: new Date().toISOString(),
      modalities: Array.from(this.activeModalities),
      confidence: this.calculateFusionConfidence(modalityGroups),
      summary: await this.generateFusionSummary(modalityGroups)
    };

    this.emit('fusion-complete', fusionResult);
    console.log('[MultiModalFusionAgent] 🔗 Multi-modal fusion completed');
    
    return fusionResult;
  }

  groupByModality(events) {
    const groups = {};
    
    for (const event of events) {
      if (!groups[event.modality]) {
        groups[event.modality] = [];
      }
      groups[event.modality].push(event);
    }
    
    return groups;
  }

  calculateFusionConfidence(modalityGroups) {
    let totalWeight = 0;
    let weightedConfidence = 0;
    
    for (const [modality, events] of Object.entries(modalityGroups)) {
      const weight = this.modalityWeights[modality] || 0.1;
      const avgConfidence = events.reduce((sum, event) => 
        sum + (event.data.confidence || 0.5), 0) / events.length;
      
      totalWeight += weight;
      weightedConfidence += weight * avgConfidence;
    }
    
    return totalWeight > 0 ? weightedConfidence / totalWeight : 0.5;
  }

  async generateFusionSummary(modalityGroups) {
    const summaryParts = [];
    
    for (const [modality, events] of Object.entries(modalityGroups)) {
      const latest = events[events.length - 1];
      
      switch (modality) {
        case 'voice':
          summaryParts.push(`Voice: "${latest.data.transcript}"`);
          break;
        case 'visual':
          summaryParts.push(`Visual: ${latest.data.analysis}`);
          break;
        case 'ambient':
          summaryParts.push(`Ambient: ${latest.data.type} detected`);
          break;
        default:
          summaryParts.push(`${modality}: ${JSON.stringify(latest.data)}`);
      }
    }
    
    return summaryParts.join(' | ');
  }

  getStatus() {
    return {
      agent: 'MultiModalFusionAgent',
      initialized: this.initialized,
      activeModalities: Array.from(this.activeModalities),
      fusionHistorySize: this.fusionHistory.length,
      modalityWeights: this.modalityWeights,
      timestamp: new Date().toISOString()
    };
  }
}

export default MultiModalFusionAgent;