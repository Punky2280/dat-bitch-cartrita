/**
 * Vision Lab Page - Cartrita V2
 * Computer vision analysis and processing interface
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeIcon,
  PhotoIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  ArrowPathIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  AdjustmentsHorizontalIcon,
  BeakerIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  FolderIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import { useDropzone } from 'react-dropzone';
import AppLayout from '@/components/layout/AppLayout';
import { useVisionStore } from '@/stores';

interface VisionAnalysis {
  id: string;
  name: string;
  type: 'image' | 'video' | 'batch';
  file_path: string;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  results: {
    objects?: Array<{ label: string; confidence: number; bbox: number[] }>;
    text?: string;
    faces?: Array<{ age?: number; gender?: string; emotion?: string; bbox: number[] }>;
    scene?: { description: string; confidence: number };
    colors?: Array<{ color: string; percentage: number }>;
    metadata?: { width: number; height: number; format: string; size: number };
  };
  analysis_types: string[];
}

interface VisionCapability {
  id: string;
  name: string;
  description: string;
  category: 'detection' | 'recognition' | 'analysis' | 'generation';
  icon: React.ComponentType<{ className?: string }>;
  models: string[];
}

const VISION_CAPABILITIES: VisionCapability[] = [
  {
    id: 'object_detection',
    name: 'Object Detection',
    description: 'Detect and locate objects in images with bounding boxes',
    category: 'detection',
    icon: MagnifyingGlassIcon,
    models: ['YOLOv8', 'DETR', 'Faster R-CNN']
  },
  {
    id: 'ocr',
    name: 'Optical Character Recognition',
    description: 'Extract text from images and documents',
    category: 'recognition',
    icon: DocumentTextIcon,
    models: ['Tesseract', 'EasyOCR', 'PaddleOCR']
  },
  {
    id: 'face_analysis',
    name: 'Face Analysis',
    description: 'Detect faces and analyze demographics and emotions',
    category: 'analysis',
    icon: EyeIcon,
    models: ['RetinaFace', 'FaceNet', 'DeepFace']
  },
  {
    id: 'scene_understanding',
    name: 'Scene Understanding',
    description: 'Analyze and describe the overall scene content',
    category: 'analysis',
    icon: PhotoIcon,
    models: ['CLIP', 'BLIP-2', 'LLaVA']
  },
  {
    id: 'image_classification',
    name: 'Image Classification',
    description: 'Classify images into predefined categories',
    category: 'recognition',
    icon: ChartBarIcon,
    models: ['ResNet', 'EfficientNet', 'Vision Transformer']
  },
  {
    id: 'color_analysis',
    name: 'Color Analysis',
    description: 'Extract dominant colors and color palettes',
    category: 'analysis',
    icon: BeakerIcon,
    models: ['K-Means', 'ColorThief', 'Custom']
  }
];

export default function VisionLabPage() {
  const {
    analyses,
    selectedAnalysis,
    isProcessing,
    error,
    loadAnalyses,
    createAnalysis,
    deleteAnalysis,
    selectAnalysis
  } = useVisionStore();

  const [activeTab, setActiveTab] = useState<'upload' | 'analyses' | 'results'>('upload');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(['object_detection']);
  const [selectedModel, setSelectedModel] = useState<Record<string, string>>({});
  const [processingQueue, setProcessingQueue] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setProcessingQueue(prev => [...prev, ...acceptedFiles]);
    
    // Preview first image
    if (acceptedFiles.length > 0 && acceptedFiles[0].type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewImage(e.target?.result as string);
      reader.readAsDataURL(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    },
    multiple: true
  });

  const handleProcessFiles = async () => {
    for (const file of processingQueue) {
      const analysisData = {
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        file: file,
        analysis_types: selectedCapabilities,
        models: selectedModel
      };
      
      await createAnalysis(analysisData);
    }
    setProcessingQueue([]);
    setPreviewImage(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'detection':
        return 'text-blue-600 dark:text-blue-400';
      case 'recognition':
        return 'text-green-600 dark:text-green-400';
      case 'analysis':
        return 'text-purple-600 dark:text-purple-400';
      case 'generation':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const analysisStats = {
    total: analyses.length,
    processing: analyses.filter(a => a.status === 'processing').length,
    completed: analyses.filter(a => a.status === 'completed').length,
    failed: analyses.filter(a => a.status === 'failed').length
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mr-4">
                <EyeIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Vision Lab
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Advanced computer vision analysis and processing
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {processingQueue.length} files queued
              </span>
              <button
                onClick={() => setActiveTab('upload')}
                className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                New Analysis
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analysisStats.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Analyses</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {analysisStats.processing}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Processing</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {analysisStats.completed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {analysisStats.failed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { id: 'upload', name: 'Upload & Process', icon: CloudArrowUpIcon },
              { id: 'analyses', name: 'Analyses', icon: ClockIcon },
              { id: 'results', name: 'Results', icon: ChartBarIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* File Upload */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Upload Files
                </h2>
                
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'
                  }`}
                >
                  <input {...getInputProps()} />
                  <CloudArrowUpIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  
                  {isDragActive ? (
                    <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Drop files here to upload
                    </p>
                  ) : (
                    <>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        Drag & drop images or videos here, or click to browse
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports JPG, PNG, GIF, MP4, AVI, MOV
                      </p>
                    </>
                  )}
                </div>

                {/* Queue Display */}
                {processingQueue.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Files in Queue ({processingQueue.length})
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {processingQueue.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            {file.type.startsWith('image/') ? (
                              <PhotoIcon className="w-5 h-5 text-gray-400" />
                            ) : (
                              <VideoCameraIcon className="w-5 h-5 text-gray-400" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {file.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setProcessingQueue(prev => 
                              prev.filter((_, i) => i !== index)
                            )}
                            className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                {previewImage && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Preview
                    </h3>
                    <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis Configuration */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Analysis Configuration
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Select Analysis Types
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {VISION_CAPABILITIES.map((capability) => (
                        <div
                          key={capability.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            selectedCapabilities.includes(capability.id)
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                          }`}
                          onClick={() => {
                            setSelectedCapabilities(prev =>
                              prev.includes(capability.id)
                                ? prev.filter(id => id !== capability.id)
                                : [...prev, capability.id]
                            );
                          }}
                        >
                          <div className="flex items-start space-x-3">
                            <capability.icon className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {capability.name}
                                </h4>
                                <span className={`text-xs font-medium capitalize ${getCategoryColor(capability.category)}`}>
                                  {capability.category}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {capability.description}
                              </p>
                              
                              {selectedCapabilities.includes(capability.id) && (
                                <div className="mt-3">
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Model
                                  </label>
                                  <select
                                    value={selectedModel[capability.id] || capability.models[0]}
                                    onChange={(e) => setSelectedModel(prev => ({
                                      ...prev,
                                      [capability.id]: e.target.value
                                    }))}
                                    className="w-full text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {capability.models.map(model => (
                                      <option key={model} value={model}>
                                        {model}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Process Button */}
                  <button
                    onClick={handleProcessFiles}
                    disabled={processingQueue.length === 0 || selectedCapabilities.length === 0 || isProcessing}
                    className="w-full flex items-center justify-center px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-5 h-5 mr-2" />
                        Start Analysis
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Analyses Tab */}
          {activeTab === 'analyses' && (
            <motion.div
              key="analyses"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Analysis History
                </h2>
                
                <div className="space-y-4">
                  {analyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        {analysis.type === 'image' ? (
                          <PhotoIcon className="w-10 h-10 text-gray-400" />
                        ) : analysis.type === 'video' ? (
                          <VideoCameraIcon className="w-10 h-10 text-gray-400" />
                        ) : (
                          <FolderIcon className="w-10 h-10 text-gray-400" />
                        )}
                        
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {analysis.name}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(analysis.status)}`}>
                              {analysis.status}
                            </span>
                            <span>•</span>
                            <span>{analysis.analysis_types.length} analysis types</span>
                            <span>•</span>
                            <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {analysis.status === 'completed' && (
                          <button
                            onClick={() => {
                              selectAnalysis(analysis.id);
                              setActiveTab('results');
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="View Results"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteAnalysis(analysis.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete Analysis"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {analyses.length === 0 && (
                    <div className="text-center py-12">
                      <EyeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No analyses yet
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Upload some files to start analyzing.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {selectedAnalysis ? (
                <AnalysisResults analysis={selectedAnalysis} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="text-center py-12">
                    <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Select an analysis to view results
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Choose a completed analysis from the analyses tab.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

// Analysis Results Component
interface AnalysisResultsProps {
  analysis: VisionAnalysis;
}

function AnalysisResults({ analysis }: AnalysisResultsProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {analysis.name} - Results
          </h2>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            analysis.status === 'completed'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
          }`}>
            {analysis.status}
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type:</span>
            <span className="ml-2 font-medium capitalize">{analysis.type}</span>
          </div>
          <div>
            <span className="text-gray-500">Analysis Types:</span>
            <span className="ml-2 font-medium">{analysis.analysis_types.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Created:</span>
            <span className="ml-2 font-medium">{new Date(analysis.created_at).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Completed:</span>
            <span className="ml-2 font-medium">
              {analysis.completed_at ? new Date(analysis.completed_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Objects */}
        {analysis.results.objects && analysis.results.objects.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Detected Objects
            </h3>
            <div className="space-y-3">
              {analysis.results.objects.slice(0, 5).map((obj, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {obj.label}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {(obj.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      confidence
                    </div>
                  </div>
                </div>
              ))}
              {analysis.results.objects.length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  +{analysis.results.objects.length - 5} more objects
                </div>
              )}
            </div>
          </div>
        )}

        {/* OCR Text */}
        {analysis.results.text && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Extracted Text
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono">
                {analysis.results.text}
              </pre>
            </div>
          </div>
        )}

        {/* Face Analysis */}
        {analysis.results.faces && analysis.results.faces.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Face Analysis
            </h3>
            <div className="space-y-3">
              {analysis.results.faces.map((face, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Face {index + 1}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {face.age && (
                      <div>
                        <span className="text-gray-500">Age:</span>
                        <span className="ml-1">{face.age}</span>
                      </div>
                    )}
                    {face.gender && (
                      <div>
                        <span className="text-gray-500">Gender:</span>
                        <span className="ml-1">{face.gender}</span>
                      </div>
                    )}
                    {face.emotion && (
                      <div>
                        <span className="text-gray-500">Emotion:</span>
                        <span className="ml-1">{face.emotion}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scene Description */}
        {analysis.results.scene && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Scene Understanding
            </h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-gray-900 dark:text-white mb-3">
                {analysis.results.scene.description}
              </p>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Confidence: {(analysis.results.scene.confidence * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* Color Analysis */}
        {analysis.results.colors && analysis.results.colors.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Color Palette
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {analysis.results.colors.slice(0, 6).map((color, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div
                    className="w-8 h-8 rounded-lg border-2 border-gray-200 dark:border-gray-600"
                    style={{ backgroundColor: color.color }}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {color.color}
                    </div>
                    <div className="text-xs text-gray-500">
                      {color.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {analysis.results.metadata && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              File Metadata
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Dimensions:</span>
                <span className="ml-2 font-medium">
                  {analysis.results.metadata.width} × {analysis.results.metadata.height}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Format:</span>
                <span className="ml-2 font-medium uppercase">
                  {analysis.results.metadata.format}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Size:</span>
                <span className="ml-2 font-medium">
                  {(analysis.results.metadata.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}