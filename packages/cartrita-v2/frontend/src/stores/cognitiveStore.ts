import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface CognitiveAnalysisResult {
  cognitiveType: string;
  insights: {
    primaryInsights: string[];
    secondaryObservations: string[];
    cognitiveLoad: string;
    processingEfficiency: number;
  };
  emotionalIntelligence: {
    detectedEmotions: string[];
    empathyScore: number;
    emotionalResilience: number;
  };
  cognitivePatterns: {
    reasoningPath: string[];
    decisionMatrix: any;
    learningAdaptations: string[];
  };
  predictiveAnalysis: {
    futureStates: string[];
    riskAssessment: string[];
    opportunityMapping: string[];
  };
  metaverseCompatibility: {
    spatialAwareness: number;
    virtualInteractionPotential: number;
    immersiveCapabilities: number;
  };
  processingMetadata: {
    model_used: string;
    processing_time: number;
    confidence: number;
    complexity_score: number;
  };
  timestamp: string;
}

interface CognitiveState {
  currentEmotionalState: string;
  cognitiveLoad: 'low' | 'medium' | 'high';
  learningProgress: number;
  adaptationHistory: string[];
  contextMemory: Record<string, any>;
  personalityProfile: {
    traits: Record<string, number>;
    preferences: Record<string, any>;
    behaviorPatterns: string[];
  };
}

interface MetaverseSession {
  sessionId: string;
  metaverseType: string;
  spatialData: {
    position: { x: number; y: number; z: number };
    orientation: { yaw: number; pitch: number; roll: number };
    scale: number;
    boundingBox: { width: number; height: number; depth: number };
  };
  avatarConfiguration: {
    appearance: string;
    capabilities: string[];
    interactionModes: string[];
  };
  immersiveFeatures: {
    vrSupport: boolean;
    arSupport: boolean;
    hapticFeedback: boolean;
    spatialAudio: boolean;
    gestureRecognition: boolean;
  };
  networkStatus: {
    latency: number;
    bandwidth: string;
    connectionQuality: string;
  };
  collaborationData: {
    activeUsers: number;
    sharedSpaces: string[];
    realTimeSync: boolean;
  };
  isConnected: boolean;
  lastUpdate: string;
}

interface CognitiveStore {
  // Cognitive Analysis State
  analysisHistory: CognitiveAnalysisResult[];
  currentAnalysis: CognitiveAnalysisResult | null;
  isAnalyzing: boolean;
  analysisQueue: string[];
  
  // Cognitive State Management
  cognitiveState: CognitiveState;
  stateHistory: CognitiveState[];
  realTimeUpdates: boolean;
  
  // Metaverse Integration
  metaverseSession: MetaverseSession | null;
  metaverseHistory: MetaverseSession[];
  spatialAwareness: Record<string, any>;
  
  // Real-time Learning
  learningPatterns: Record<string, any>;
  adaptiveResponses: string[];
  contextualInsights: Record<string, any>;
  
  // Actions
  setCurrentAnalysis: (analysis: CognitiveAnalysisResult | null) => void;
  addAnalysisToHistory: (analysis: CognitiveAnalysisResult) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  updateCognitiveState: (state: Partial<CognitiveState>) => void;
  setMetaverseSession: (session: MetaverseSession | null) => void;
  updateSpatialData: (spatialData: Partial<MetaverseSession['spatialData']>) => void;
  addLearningPattern: (pattern: string, data: any) => void;
  updateContextMemory: (key: string, value: any) => void;
  processRealTimeUpdate: (updateType: string, data: any) => void;
  getPersonalityInsights: () => Record<string, any>;
  predictBehavior: (context: string) => string[];
  optimizeCognitiveLoad: () => void;
  syncWithMetaverse: () => Promise<void>;
}

export const useCognitiveStore = create<CognitiveStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    analysisHistory: [],
    currentAnalysis: null,
    isAnalyzing: false,
    analysisQueue: [],
    
    cognitiveState: {
      currentEmotionalState: 'neutral',
      cognitiveLoad: 'medium',
      learningProgress: 0,
      adaptationHistory: [],
      contextMemory: {},
      personalityProfile: {
        traits: {
          openness: 0.5,
          conscientiousness: 0.5,
          extraversion: 0.5,
          agreeableness: 0.5,
          neuroticism: 0.5
        },
        preferences: {},
        behaviorPatterns: []
      }
    },
    
    stateHistory: [],
    realTimeUpdates: false,
    metaverseSession: null,
    metaverseHistory: [],
    spatialAwareness: {},
    learningPatterns: {},
    adaptiveResponses: [],
    contextualInsights: {},
    
    // Actions
    setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
    
    addAnalysisToHistory: (analysis) => set((state) => ({
      analysisHistory: [analysis, ...state.analysisHistory].slice(0, 50) // Keep last 50
    })),
    
    setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
    
    updateCognitiveState: (newState) => set((state) => {
      const updatedState = { ...state.cognitiveState, ...newState };
      const stateHistory = [state.cognitiveState, ...state.stateHistory].slice(0, 20);
      
      return {
        cognitiveState: updatedState,
        stateHistory
      };
    }),
    
    setMetaverseSession: (session) => set((state) => {
      const metaverseHistory = session && state.metaverseSession 
        ? [state.metaverseSession, ...state.metaverseHistory].slice(0, 10)
        : state.metaverseHistory;
        
      return {
        metaverseSession: session,
        metaverseHistory
      };
    }),
    
    updateSpatialData: (spatialData) => set((state) => {
      if (!state.metaverseSession) return state;
      
      return {
        metaverseSession: {
          ...state.metaverseSession,
          spatialData: { ...state.metaverseSession.spatialData, ...spatialData },
          lastUpdate: new Date().toISOString()
        }
      };
    }),
    
    addLearningPattern: (pattern, data) => set((state) => ({
      learningPatterns: {
        ...state.learningPatterns,
        [pattern]: data
      }
    })),
    
    updateContextMemory: (key, value) => set((state) => ({
      cognitiveState: {
        ...state.cognitiveState,
        contextMemory: {
          ...state.cognitiveState.contextMemory,
          [key]: value
        }
      }
    })),
    
    processRealTimeUpdate: (updateType, data) => {
      const state = get();
      
      switch (updateType) {
        case 'emotional_state':
          set((state) => ({
            cognitiveState: {
              ...state.cognitiveState,
              currentEmotionalState: data.emotion,
              adaptationHistory: [...state.cognitiveState.adaptationHistory, `Emotional shift to ${data.emotion}`]
            }
          }));
          break;
          
        case 'cognitive_load':
          set((state) => ({
            cognitiveState: {
              ...state.cognitiveState,
              cognitiveLoad: data.load
            }
          }));
          break;
          
        case 'learning_progress':
          set((state) => ({
            cognitiveState: {
              ...state.cognitiveState,
              learningProgress: Math.min(state.cognitiveState.learningProgress + data.increment, 1.0)
            }
          }));
          break;
          
        case 'spatial_update':
          if (state.metaverseSession) {
            get().updateSpatialData(data.spatialData);
          }
          break;
      }
    },
    
    getPersonalityInsights: () => {
      const state = get();
      const { personalityProfile, adaptationHistory } = state.cognitiveState;
      
      return {
        dominantTraits: Object.entries(personalityProfile.traits)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([trait, score]) => ({ trait, score })),
        recentAdaptations: adaptationHistory.slice(-5),
        behaviorPredictions: personalityProfile.behaviorPatterns,
        cognitiveStrengths: state.analysisHistory
          .slice(0, 5)
          .flatMap(analysis => analysis.insights.primaryInsights)
          .filter((insight, index, arr) => arr.indexOf(insight) === index)
      };
    },
    
    predictBehavior: (context) => {
      const state = get();
      const { personalityProfile, contextMemory } = state.cognitiveState;
      
      // Simple behavior prediction based on personality traits and context
      const predictions = [];
      
      if (personalityProfile.traits.openness > 0.7) {
        predictions.push('Likely to explore new features');
      }
      
      if (personalityProfile.traits.conscientiousness > 0.7) {
        predictions.push('Will complete tasks systematically');
      }
      
      if (personalityProfile.traits.extraversion > 0.7) {
        predictions.push('May seek collaborative interactions');
      }
      
      // Context-based predictions
      if (contextMemory.recentActions) {
        predictions.push('Building on recent interaction patterns');
      }
      
      return predictions;
    },
    
    optimizeCognitiveLoad: () => {
      const state = get();
      const { cognitiveLoad, learningProgress } = state.cognitiveState;
      
      let optimizedLoad: 'low' | 'medium' | 'high' = cognitiveLoad;
      
      // Optimize based on learning progress and current load
      if (learningProgress > 0.8 && cognitiveLoad === 'high') {
        optimizedLoad = 'medium';
      } else if (learningProgress < 0.3 && cognitiveLoad === 'low') {
        optimizedLoad = 'medium';
      }
      
      if (optimizedLoad !== cognitiveLoad) {
        get().updateCognitiveState({ cognitiveLoad: optimizedLoad });
      }
    },
    
    syncWithMetaverse: async () => {
      const state = get();
      if (!state.metaverseSession) return;
      
      try {
        // Sync cognitive state with metaverse session
        const response = await fetch('/api/v2/metaverse/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.metaverseSession.sessionId,
            cognitiveState: state.cognitiveState,
            spatialData: state.metaverseSession.spatialData
          })
        });
        
        if (response.ok) {
          const syncData = await response.json();
          if (syncData.success) {
            get().processRealTimeUpdate('spatial_update', syncData.data);
          }
        }
      } catch (error) {
        console.error('Metaverse sync error:', error);
      }
    }
  }))
);

// Real-time update subscription
useCognitiveStore.subscribe(
  (state) => state.realTimeUpdates,
  (realTimeUpdates) => {
    if (realTimeUpdates) {
      const interval = setInterval(() => {
        const state = useCognitiveStore.getState();
        state.optimizeCognitiveLoad();
        
        if (state.metaverseSession?.isConnected) {
          state.syncWithMetaverse();
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }
);

// Cognitive state change reactions
useCognitiveStore.subscribe(
  (state) => state.cognitiveState.currentEmotionalState,
  (emotionalState) => {
    const state = useCognitiveStore.getState();
    
    // Auto-adapt personality traits based on emotional patterns
    const traits = { ...state.cognitiveState.personalityProfile.traits };
    
    switch (emotionalState) {
      case 'excited':
        traits.extraversion = Math.min(traits.extraversion + 0.1, 1.0);
        traits.openness = Math.min(traits.openness + 0.1, 1.0);
        break;
      case 'focused':
        traits.conscientiousness = Math.min(traits.conscientiousness + 0.1, 1.0);
        break;
      case 'stressed':
        traits.neuroticism = Math.min(traits.neuroticism + 0.1, 1.0);
        break;
    }
    
    state.updateCognitiveState({
      personalityProfile: {
        ...state.cognitiveState.personalityProfile,
        traits
      }
    });
  }
);