import React, { useState, useCallback } from 'react';
import {
  SparklesIcon,
  ChartBarIcon,
  CpuChipIcon,
  MicrophoneIcon,
  CameraIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';

import { HuggingFaceModelCatalog } from './HuggingFaceModelCatalog';
import { RAGPipelineInterface } from './RAGPipelineInterface';
import { HuggingFaceRoutingDashboard } from './HuggingFaceRoutingDashboard';
import { EnhancedVoiceToTextButton } from './EnhancedVoiceToTextButton';
import { EnhancedCameraButton } from './EnhancedCameraButton';
import { AudioTestingInterface } from './AudioTestingInterface';
import { CameraTestingInterface } from './CameraTestingInterface';

interface HuggingFaceIntegrationHubProps {
  token: string;
  className?: string;
}

type TabType = 'dashboard' | 'models' | 'rag' | 'voice' | 'vision' | 'audio-test' | 'camera-test';

interface ModelEntry {
  idx: number;
  repo_id: string;
  category: string;
  approx_params: string;
  primary_tasks: string[];
  serverless_candidate: boolean;
  requires_endpoint: boolean;
  notes: string;
  cost_tier?: string;
  quality_score?: number;
  context_length?: number;
}

interface VisionAnalysisResult {
  task_type: string;
  predictions: any[];
  confidence: number;
  model_used: string;
  processing_time_ms: number;
  detected_objects?: Array<{
    label: string;
    confidence: number;
    bbox?: [number, number, number, number];
  }>;
  classifications?: Array<{
    label: string;
    confidence: number;
  }>;
  generated_text?: string;
  image_description?: string;
}

interface VoiceToTextResult {
  transcript: string;
  confidence: number;
  provider: string;
  model: string;
  latency_ms: number;
  language_detected?: string;
  word_count: number;
  alternatives?: string[];
}

const TABS = [
  { 
    id: 'dashboard', 
    name: 'Dashboard', 
    icon: ChartBarIcon, 
    description: 'System health and performance metrics' 
  },
  { 
    id: 'models', 
    name: 'Model Catalog', 
    icon: CpuChipIcon, 
    description: 'Browse and select HuggingFace models' 
  },
  { 
    id: 'rag', 
    name: 'RAG Pipeline', 
    icon: DocumentTextIcon, 
    description: 'Document-based question answering' 
  },
  { 
    id: 'voice', 
    name: 'Voice AI', 
    icon: MicrophoneIcon, 
    description: 'Speech-to-text and voice processing' 
  },
  { 
    id: 'vision', 
    name: 'Computer Vision', 
    icon: CameraIcon, 
    description: 'Image analysis and understanding' 
  },
  { 
    id: 'audio-test', 
    name: 'Audio Testing', 
    icon: BeakerIcon, 
    description: 'Test audio processing capabilities' 
  },
  { 
    id: 'camera-test', 
    name: 'Vision Testing', 
    icon: BeakerIcon, 
    description: 'Test computer vision capabilities' 
  }
] as const;

export const HuggingFaceIntegrationHub: React.FC<HuggingFaceIntegrationHubProps> = ({
  token,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedModel, setSelectedModel] = useState<ModelEntry | undefined>();
  const [lastVoiceResult, setLastVoiceResult] = useState<VoiceToTextResult | null>(null);
  const [lastVisionResult, setLastVisionResult] = useState<VisionAnalysisResult | null>(null);

  const handleModelSelection = useCallback((model: ModelEntry) => {
    setSelectedModel(model);
    console.log('[HF Hub] Model selected:', model.repo_id);
  }, []);

  const handleVoiceTranscript = useCallback((result: VoiceToTextResult) => {
    setLastVoiceResult(result);
    console.log('[HF Hub] Voice transcript received:', result.transcript);
  }, []);

  const handleVisionAnalysis = useCallback((result: VisionAnalysisResult) => {
    setLastVisionResult(result);
    console.log('[HF Hub] Vision analysis received:', result);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <HuggingFaceRoutingDashboard
            token={token}
            className="w-full"
          />
        );

      case 'models':
        return (
          <HuggingFaceModelCatalog
            onSelectModel={handleModelSelection}
            selectedModel={selectedModel}
            className="w-full"
          />
        );

      case 'rag':
        return (
          <RAGPipelineInterface
            token={token}
            className="w-full"
          />
        );

      case 'voice':
        return (
          <div className="space-y-6">
            {/* Voice Controls Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Enhanced Voice AI
              </h3>
              
              <div className="flex items-center space-x-6">
                <EnhancedVoiceToTextButton
                  onTranscript={handleVoiceTranscript}
                  token={token}
                  showAdvancedSettings={true}
                  className="flex-shrink-0"
                />
                
                <div className="flex-1">
                  {lastVoiceResult ? (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">
                          Latest Transcription
                        </h4>
                        <div className="flex items-center space-x-3 text-sm text-blue-700 dark:text-blue-300">
                          <span>Model: {lastVoiceResult.model.split('/').pop()}</span>
                          <span>Confidence: {Math.round(lastVoiceResult.confidence * 100)}%</span>
                          <span>Latency: {lastVoiceResult.latency_ms}ms</span>
                        </div>
                      </div>
                      <blockquote className="text-blue-800 dark:text-blue-200 italic">
                        "{lastVoiceResult.transcript}"
                      </blockquote>
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        Words: {lastVoiceResult.word_count} | 
                        {lastVoiceResult.language_detected && ` Language: ${lastVoiceResult.language_detected} |`}
                        Provider: {lastVoiceResult.provider}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                      <p className="text-gray-600 dark:text-gray-400">
                        Click the microphone button to start voice recording with HuggingFace STT
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Voice Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Advanced STT</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>✅ Multiple model support (Whisper, Wav2Vec2)</li>
                  <li>✅ Multilingual recognition</li>
                  <li>✅ Confidence scoring</li>
                  <li>✅ Real-time audio analysis</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Quality Control</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>✅ Audio validation</li>
                  <li>✅ Noise reduction</li>
                  <li>✅ Quality metrics</li>
                  <li>✅ Auto punctuation</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Performance</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>✅ Sub-5s processing</li>
                  <li>✅ Fallback models</li>
                  <li>✅ Cost optimization</li>
                  <li>✅ Real-time feedback</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'vision':
        return (
          <div className="space-y-6">
            {/* Vision Controls Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Enhanced Computer Vision
              </h3>
              
              <div className="flex items-start space-x-6">
                <EnhancedCameraButton
                  onAnalysis={handleVisionAnalysis}
                  token={token}
                  showAdvancedSettings={true}
                  className="flex-shrink-0"
                />
                
                <div className="flex-1">
                  {lastVisionResult ? (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-green-900 dark:text-green-100">
                          Latest Vision Analysis
                        </h4>
                        <div className="flex items-center space-x-3 text-sm text-green-700 dark:text-green-300">
                          <span>Task: {lastVisionResult.task_type}</span>
                          <span>Confidence: {Math.round(lastVisionResult.confidence * 100)}%</span>
                          <span>Time: {lastVisionResult.processing_time_ms}ms</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        {lastVisionResult.classifications && (
                          <div>
                            <strong className="text-green-800 dark:text-green-200">Classifications:</strong>
                            <div className="mt-1">
                              {lastVisionResult.classifications.slice(0, 3).map((cls, i) => (
                                <div key={i} className="text-green-700 dark:text-green-300">
                                  • {cls.label}: {Math.round(cls.confidence * 100)}%
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {lastVisionResult.detected_objects && (
                          <div>
                            <strong className="text-green-800 dark:text-green-200">
                              Objects ({lastVisionResult.detected_objects.length} detected):
                            </strong>
                            <div className="mt-1">
                              {lastVisionResult.detected_objects.slice(0, 5).map((obj, i) => (
                                <div key={i} className="text-green-700 dark:text-green-300">
                                  • {obj.label}: {Math.round(obj.confidence * 100)}%
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {lastVisionResult.generated_text && (
                          <div>
                            <strong className="text-green-800 dark:text-green-200">Description:</strong>
                            <p className="mt-1 text-green-700 dark:text-green-300 italic">
                              "{lastVisionResult.generated_text}"
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                        Model: {lastVisionResult.model_used} | Provider: HuggingFace
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                      <p className="text-gray-600 dark:text-gray-400">
                        Click the camera button to start image analysis with HuggingFace Vision
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vision Features */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Classification</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>✅ ViT models</li>
                  <li>✅ ResNet variants</li>
                  <li>✅ Custom categories</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Object Detection</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>✅ DETR models</li>
                  <li>✅ Bounding boxes</li>
                  <li>✅ Multi-object</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Image Captioning</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>✅ BLIP models</li>
                  <li>✅ GIT variants</li>
                  <li>✅ Context-aware</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Visual Q&A</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>✅ ViLT models</li>
                  <li>✅ Custom questions</li>
                  <li>✅ Context reasoning</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'audio-test':
        return (
          <AudioTestingInterface
            token={token}
            className="w-full"
          />
        );

      case 'camera-test':
        return (
          <CameraTestingInterface
            token={token}
            className="w-full"
          />
        );

      default:
        return <div>Tab content not implemented</div>;
    }
  };

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                HuggingFace AI Integration Hub
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Advanced AI capabilities with enhanced routing, RAG, and multimodal processing
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
              Enhanced
            </div>
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
              v2.0
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex space-x-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={tab.description}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>

      {/* Status Bar */}
      <div className="px-6 py-3 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4 text-gray-600 dark:text-gray-400">
            <span>Active Tab: {TABS.find(t => t.id === activeTab)?.name}</span>
            {selectedModel && (
              <span>Selected Model: {selectedModel.repo_id}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-4 text-gray-600 dark:text-gray-400">
            {lastVoiceResult && (
              <span className="flex items-center space-x-1">
                <MicrophoneIcon className="h-4 w-4 text-blue-500" />
                <span>Last STT: {lastVoiceResult.word_count} words</span>
              </span>
            )}
            
            {lastVisionResult && (
              <span className="flex items-center space-x-1">
                <CameraIcon className="h-4 w-4 text-green-500" />
                <span>Last Vision: {lastVisionResult.task_type}</span>
              </span>
            )}
            
            <span className="text-xs text-gray-500">
              HuggingFace Integration Hub • Enhanced with Advanced Routing & RAG
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};