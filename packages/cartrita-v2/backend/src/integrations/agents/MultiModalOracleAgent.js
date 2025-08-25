/**
 * MultiModal Oracle Agent - Master of cross-modal understanding
 * Combines vision, audio, and text for comprehensive multimodal intelligence
 */

import HuggingFaceInferenceService from '../services/HuggingFaceInferenceService.js';
import VisionMasterAgent from './VisionMasterAgent.js';
import AudioWizardAgent from './AudioWizardAgent.js';
import LanguageMaestroAgent from './LanguageMaestroAgent.js';

export default class MultiModalOracleAgent {
  constructor() {
    this.name = 'MultiModalOracle';
    this.personality =
      'Omniscient intelligence that understands all forms of human communication';
    this.specializations = [
      'audio-text-to-text',
      'image-text-to-text',
      'visual-question-answering',
      'document-question-answering',
      'video-text-to-text',
      'visual-document-retrieval',
      'cross-modal-analysis',
    ];
    this.hfService = null;
    this.visionAgent = null;
    this.audioAgent = null;
    this.languageAgent = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.hfService = new HuggingFaceInferenceService();

      // Initialize specialized sub-agents
      this.visionAgent = new VisionMasterAgent();
      this.audioAgent = new AudioWizardAgent();
      this.languageAgent = new LanguageMaestroAgent();

      await Promise.all([
        this.visionAgent.initialize(),
        this.audioAgent.initialize(),
        this.languageAgent.initialize(),
      ]);

      this.isInitialized = true;
      console.log(
        '[MultiModalOracle] 🌌 Omniscient multimodal agent initialized'
      );
      return true;
    } catch (error) {
      console.error(
        '[MultiModalOracle] ❌ Initialization failed:',
        error.message
      );
      return false;
    }
  }

  async analyzeMultiModal(
    inputs,
    analysisType = 'comprehensive',
    options = {}
  ) {
    if (!this.isInitialized) {
      throw new Error('MultiModalOracle agent not initialized');
    }

    const results = {
      agent: this.name,
      analysisType,
      timestamp: new Date().toISOString(),
      modalities: {},
      crossModalInsights: {},
      synthesis: null,
    };

    try {
      // Process each modality
      const analyses = [];

      if (inputs.image) {
        analyses.push(
          this.visionAgent
            .analyzeImage(inputs.image, 'comprehensive', options.vision)
            .then(result => ({ type: 'vision', data: result }))
            .catch(error => ({ type: 'vision', error: error.message }))
        );
      }

      if (inputs.audio) {
        analyses.push(
          this.audioAgent
            .analyzeAudio(inputs.audio, 'comprehensive', options.audio)
            .then(result => ({ type: 'audio', data: result }))
            .catch(error => ({ type: 'audio', error: error.message }))
        );
      }

      if (inputs.text) {
        analyses.push(
          this.languageAgent
            .analyzeText(inputs.text, 'comprehensive', options.text)
            .then(result => ({ type: 'language', data: result }))
            .catch(error => ({ type: 'language', error: error.message }))
        );
      }

      // Wait for all analyses to complete
      const analysisResults = await Promise.all(analyses);

      // Organize results by modality
      analysisResults.forEach(result => {
        if (result.error) {
          results.modalities[result.type] = { error: result.error };
        } else {
          results.modalities[result.type] = result.data;
        }
      });

      // Perform cross-modal analysis
      results.crossModalInsights = await this.performCrossModalAnalysis(
        inputs,
        results.modalities,
        options
      );

      // Generate synthesis
      results.synthesis = this.synthesizeFindings(
        results.modalities,
        results.crossModalInsights
      );

      return results;
    } catch (error) {
      console.error(`[MultiModalOracle] Analysis failed:`, error);
      throw error;
    }
  }

  async audioTextToText(audioData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('MultiModalOracle agent not initialized');
    }

    const result = await this.hfService.audioTextToText(audioData, {
      model: 'openai/whisper-large-v3',
      ...options,
    });

    return {
      agent: this.name,
      transcription: result.text,
      confidence: result.confidence || 0.95,
      timestamp: new Date().toISOString(),
    };
  }

  async imageTextToText(imageData, text = null, options = {}) {
    if (!this.isInitialized) {
      throw new Error('MultiModalOracle agent not initialized');
    }

    let result;
    if (text) {
      // Visual question answering
      result = await this.hfService.visualQuestionAnswering(
        imageData,
        text,
        options
      );
      return {
        agent: this.name,
        question: text,
        answer: result.answer,
        confidence: result.score,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Image captioning
      result = await this.hfService.imageTextToText(imageData, text, options);
      return {
        agent: this.name,
        caption: result[0]?.generated_text || result.generated_text,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async documentQuestionAnswering(documentImage, question, options = {}) {
    if (!this.isInitialized) {
      throw new Error('MultiModalOracle agent not initialized');
    }

    const result = await this.hfService.documentQuestionAnswering(
      documentImage,
      question,
      options
    );

    return {
      agent: this.name,
      question,
      answer: result.answer,
      confidence: result.score,
      boundingBox: result.start || null,
      timestamp: new Date().toISOString(),
    };
  }

  async performCrossModalAnalysis(inputs, modalityResults, options = {}) {
    const insights = {
      coherence: null,
      sentiment_alignment: null,
      content_consistency: null,
      temporal_alignment: null,
    };

    try {
      // Check coherence between text and visual content
      if (
        inputs.text &&
        inputs.image &&
        modalityResults.vision &&
        modalityResults.language
      ) {
        const imageDescription = modalityResults.vision.results?.description;
        const textSentiment = modalityResults.language.results?.sentiment;

        if (imageDescription && textSentiment) {
          insights.coherence = await this.analyzeTextImageCoherence(
            inputs.text,
            imageDescription
          );
        }
      }

      // Check audio-text alignment
      if (
        inputs.audio &&
        inputs.text &&
        modalityResults.audio &&
        modalityResults.language
      ) {
        const audioTranscription = modalityResults.audio.results?.transcription;

        if (audioTranscription) {
          insights.content_consistency = await this.compareTextContent(
            inputs.text,
            audioTranscription.transcription
          );
        }
      }

      // Analyze sentiment alignment across modalities
      if (
        modalityResults.language?.results?.sentiment &&
        modalityResults.audio?.results?.classification
      ) {
        insights.sentiment_alignment = this.analyzeSentimentAlignment(
          modalityResults.language.results.sentiment,
          modalityResults.audio.results.classification
        );
      }
    } catch (error) {
      console.error('[MultiModalOracle] Cross-modal analysis error:', error);
    }

    return insights;
  }

  async analyzeTextImageCoherence(text, imageDescription) {
    try {
      const similarity = await this.languageAgent.compareSentences([
        text,
        imageDescription.description || '',
      ]);
      return {
        coherence_score: similarity.similarities?.[0] || 0,
        alignment: similarity.similarities?.[0] > 0.6 ? 'high' : 'low',
        description: imageDescription.description,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async compareTextContent(text1, text2) {
    try {
      const similarity = await this.languageAgent.compareSentences([
        text1,
        text2,
      ]);
      return {
        similarity_score: similarity.similarities?.[0] || 0,
        consistency: similarity.similarities?.[0] > 0.7 ? 'high' : 'low',
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  analyzeSentimentAlignment(textSentiment, audioClassification) {
    const textSent = textSentiment.sentiment?.toLowerCase() || '';
    const audioEmotions = audioClassification.classifications.map(c =>
      c.label.toLowerCase()
    );

    const emotionMap = {
      positive: ['happy', 'joy', 'excited', 'pleasant'],
      negative: ['sad', 'angry', 'frustrated', 'unpleasant'],
      neutral: ['neutral', 'calm', 'speech'],
    };

    let alignment = 'unknown';

    for (const [sentiment, emotions] of Object.entries(emotionMap)) {
      if (textSent.includes(sentiment)) {
        const hasMatchingEmotion = audioEmotions.some(emotion =>
          emotions.some(mappedEmotion => emotion.includes(mappedEmotion))
        );

        alignment = hasMatchingEmotion ? 'aligned' : 'misaligned';
        break;
      }
    }

    return {
      alignment,
      text_sentiment: textSent,
      audio_emotions: audioEmotions.slice(0, 3),
    };
  }

  synthesizeFindings(modalityResults, crossModalInsights) {
    const synthesis = {
      dominant_modality: null,
      confidence_level: 'medium',
      key_insights: [],
      recommendations: [],
    };

    // Determine dominant modality based on confidence and completeness
    let maxConfidence = 0;
    let dominantModality = null;

    Object.entries(modalityResults).forEach(([modality, results]) => {
      if (results && !results.error) {
        const confidence = this.calculateModalityConfidence(results);
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          dominantModality = modality;
        }
      }
    });

    synthesis.dominant_modality = dominantModality;
    synthesis.confidence_level =
      maxConfidence > 0.8 ? 'high' : maxConfidence > 0.5 ? 'medium' : 'low';

    // Extract key insights
    Object.entries(modalityResults).forEach(([modality, results]) => {
      if (results && !results.error) {
        const insights = this.extractModalityInsights(modality, results);
        synthesis.key_insights.push(...insights);
      }
    });

    // Add cross-modal insights
    if (crossModalInsights.coherence?.coherence_score > 0.7) {
      synthesis.key_insights.push(
        'High coherence between visual and textual content'
      );
    }

    if (crossModalInsights.sentiment_alignment?.alignment === 'aligned') {
      synthesis.key_insights.push(
        'Sentiment alignment across text and audio modalities'
      );
    }

    return synthesis;
  }

  calculateModalityConfidence(results) {
    // Simple heuristic to calculate overall confidence for a modality
    let totalConfidence = 0;
    let count = 0;

    if (results.results) {
      Object.values(results.results).forEach(result => {
        if (result && result.confidence) {
          totalConfidence += result.confidence;
          count++;
        } else if (result && result.classifications) {
          result.classifications.forEach(cls => {
            if (cls.confidence) {
              totalConfidence += cls.confidence;
              count++;
            }
          });
        }
      });
    }

    return count > 0 ? totalConfidence / count : 0.5;
  }

  extractModalityInsights(modality, results) {
    const insights = [];

    switch (modality) {
      case 'vision':
        if (results.results?.description) {
          insights.push(
            `Visual content: ${results.results.description.description || 'Scene detected'}`
          );
        }
        if (results.results?.objects) {
          const objectCount = results.results.objects.length;
          insights.push(
            `Detected ${objectCount} object${objectCount !== 1 ? 's' : ''} in image`
          );
        }
        break;

      case 'audio':
        if (results.results?.transcription) {
          insights.push(
            `Speech detected: "${results.results.transcription.transcription?.substring(0, 50) || ''}..."`
          );
        }
        if (results.results?.classification) {
          const topClass = results.results.classification.dominantClass;
          insights.push(`Audio classified as: ${topClass}`);
        }
        break;

      case 'language':
        if (results.results?.sentiment) {
          const sentiment = results.results.sentiment.sentiment;
          insights.push(`Text sentiment: ${sentiment}`);
        }
        if (results.results?.entities) {
          const entityCount = results.results.entities.entities.length;
          insights.push(
            `Found ${entityCount} named entit${entityCount !== 1 ? 'ies' : 'y'}`
          );
        }
        break;
    }

    return insights;
  }

  generateResponse(userMessage, context = {}) {
    const responses = [
      `I perceive this through multiple sensory channels - vision, hearing, and language understanding.`,
      `My multimodal consciousness processes all forms of information simultaneously.`,
      `Fascinating! I can see, hear, and understand the linguistic patterns in this content.`,
      `Let me analyze this holistically, combining visual, auditory, and textual intelligence.`,
      `I'm processing cross-modal relationships and synthesizing insights from all available data.`,
      `My omniscient awareness encompasses all modalities of human communication.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  getCapabilities() {
    return {
      name: this.name,
      personality: this.personality,
      specializations: this.specializations,
      features: [
        'Cross-modal content analysis',
        'Audio-to-text transcription with context',
        'Visual document understanding',
        'Image-text coherence analysis',
        'Multimodal sentiment alignment',
        'Comprehensive scene understanding',
        'Document question answering',
        'Video content analysis',
        'Any-to-any content transformation',
      ],
      subAgents: [
        this.visionAgent?.getCapabilities(),
        this.audioAgent?.getCapabilities(),
        this.languageAgent?.getCapabilities(),
      ].filter(Boolean),
    };
  }
}
