/**
 * Vision Lab Component
 * Advanced computer vision analysis and processing interface
 */
'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  PhotoIcon,
  EyeIcon,
  CpuChipIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  FilmIcon,
  BeakerIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useVisionStore } from '@/stores';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

interface AnalysisTask {
  id: string;
  imageId: string;
  type: VisionAnalysisType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

type VisionAnalysisType = 
  | 'object-detection'
  | 'face-recognition' 
  | 'scene-analysis'
  | 'text-extraction'
  | 'image-classification'
  | 'emotion-detection'
  | 'style-transfer'
  | 'super-resolution';

const ANALYSIS_TYPES = [
  {
    type: 'object-detection' as VisionAnalysisType,
    name: 'Object Detection',
    description: 'Identify and locate objects in images',
    icon: MagnifyingGlassIcon,
    estimatedTime: '5-10 seconds',
    complexity: 'Medium'
  },
  {
    type: 'face-recognition' as VisionAnalysisType,
    name: 'Face Recognition',
    description: 'Detect and analyze facial features',
    icon: EyeIcon,
    estimatedTime: '3-8 seconds',
    complexity: 'Low'
  },
  {
    type: 'scene-analysis' as VisionAnalysisType,
    name: 'Scene Analysis',
    description: 'Understand image context and environment',
    icon: PhotoIcon,
    estimatedTime: '10-15 seconds',
    complexity: 'High'
  },
  {
    type: 'text-extraction' as VisionAnalysisType,
    name: 'OCR Text Extraction',
    description: 'Extract and recognize text from images',
    icon: DocumentArrowUpIcon,
    estimatedTime: '5-12 seconds',
    complexity: 'Medium'
  },
  {
    type: 'image-classification' as VisionAnalysisType,
    name: 'Image Classification',
    description: 'Categorize images by content type',
    icon: ChartBarIcon,
    estimatedTime: '2-5 seconds',
    complexity: 'Low'
  },
  {
    type: 'emotion-detection' as VisionAnalysisType,
    name: 'Emotion Detection',
    description: 'Analyze facial expressions and emotions',
    icon: SparklesIcon,
    estimatedTime: '4-9 seconds',
    complexity: 'Medium'
  },
  {
    type: 'style-transfer' as VisionAnalysisType,
    name: 'Style Transfer',
    description: 'Apply artistic styles to images',
    icon: BeakerIcon,
    estimatedTime: '30-60 seconds',
    complexity: 'High'
  },
  {
    type: 'super-resolution' as VisionAnalysisType,
    name: 'Super Resolution',
    description: 'Enhance image quality and resolution',
    icon: CpuChipIcon,
    estimatedTime: '20-45 seconds',
    complexity: 'High'
  }
];

export default function VisionLab() {
  const { analyzeImage, isProcessing } = useVisionStore();
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
  const [analysisTasks, setAnalysisTasks] = useState<AnalysisTask[]>([]);
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<VisionAnalysisType>('object-detection');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date()
    }));

    setUploadedImages(prev => [...prev, ...newImages]);
    
    if (!selectedImage && newImages.length > 0) {
      setSelectedImage(newImages[0]);
    }
  }, [selectedImage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp']
    },
    multiple: true
  });

  const removeImage = (imageId: string) => {
    setUploadedImages(prev => {
      const filtered = prev.filter(img => img.id !== imageId);
      if (selectedImage?.id === imageId) {
        setSelectedImage(filtered.length > 0 ? filtered[0] : null);
      }
      return filtered;
    });

    // Clean up analysis tasks for this image
    setAnalysisTasks(prev => prev.filter(task => task.imageId !== imageId));
  };

  const startAnalysis = async (analysisType: VisionAnalysisType) => {
    if (!selectedImage || isProcessing) {
      return;
    }

    const taskId = `task_${Date.now()}`;
    const newTask: AnalysisTask = {
      id: taskId,
      imageId: selectedImage.id,
      type: analysisType,
      status: 'processing',
      progress: 0,
      startTime: new Date()
    };

    setAnalysisTasks(prev => [newTask, ...prev]);

    try {
      // Simulate analysis progress
      const progressInterval = setInterval(() => {
        setAnalysisTasks(prev => prev.map(task => {
          if (task.id === taskId && task.status === 'processing') {
            const increment = Math.random() * 20 + 10; // 10-30% progress per update
            const newProgress = Math.min(100, task.progress + increment);
            
            if (newProgress >= 100) {
              clearInterval(progressInterval);
              return {
                ...task,
                status: 'completed',
                progress: 100,
                endTime: new Date(),
                result: generateMockResult(analysisType, selectedImage)
              };
            }
            
            return { ...task, progress: newProgress };
          }
          return task;
        }));
      }, 500);

      await analyzeImage(selectedImage.file, analysisType);
    } catch (error) {
      setAnalysisTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: 'failed', 
              error: 'Analysis failed. Please try again.',
              endTime: new Date()
            }
          : task
      ));
    }
  };

  const generateMockResult = (type: VisionAnalysisType, image: UploadedImage) => {
    switch (type) {
      case 'object-detection':
        return {
          objects: [
            { name: 'person', confidence: 0.95, bbox: [100, 150, 200, 350] },
            { name: 'car', confidence: 0.87, bbox: [300, 200, 450, 300] },
            { name: 'building', confidence: 0.92, bbox: [0, 0, 800, 200] }
          ],
          totalObjects: 3,
          processingTime: (Math.random() * 5 + 3).toFixed(1) + 's'
        };
      case 'face-recognition':
        return {
          faces: [
            { 
              id: 'face_1', 
              confidence: 0.94, 
              age: Math.floor(Math.random() * 40 + 20),
              gender: Math.random() > 0.5 ? 'male' : 'female',
              bbox: [150, 120, 250, 250]
            }
          ],
          totalFaces: 1,
          processingTime: (Math.random() * 3 + 2).toFixed(1) + 's'
        };
      case 'scene-analysis':
        return {
          scene: 'urban street',
          confidence: 0.89,
          attributes: ['outdoor', 'daytime', 'cloudy', 'buildings', 'vehicles'],
          mood: 'neutral',
          lighting: 'natural',
          processingTime: (Math.random() * 8 + 7).toFixed(1) + 's'
        };
      case 'text-extraction':
        return {
          text: 'STOP\nMain Street\nNo Parking',
          confidence: 0.91,
          language: 'en',
          wordCount: 5,
          processingTime: (Math.random() * 4 + 3).toFixed(1) + 's'
        };
      case 'image-classification':
        return {
          categories: [
            { name: 'urban scene', probability: 0.85 },
            { name: 'street photography', probability: 0.72 },
            { name: 'architecture', probability: 0.64 }
          ],
          topCategory: 'urban scene',
          processingTime: (Math.random() * 2 + 1).toFixed(1) + 's'
        };
      case 'emotion-detection':
        return {
          emotions: {
            happy: 0.15,
            sad: 0.05,
            angry: 0.08,
            surprised: 0.12,
            neutral: 0.60
          },
          dominantEmotion: 'neutral',
          processingTime: (Math.random() * 4 + 2).toFixed(1) + 's'
        };
      default:
        return {
          success: true,
          processingTime: (Math.random() * 10 + 5).toFixed(1) + 's',
          message: 'Analysis completed successfully'
        };
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Low': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'Medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'High': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'processing': return <CpuChipIcon className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed': return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'failed': return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />;
      default: return <ClockIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
            <EyeIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Vision Lab
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Advanced computer vision analysis and image processing
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <PhotoIcon className="w-4 h-4" />
          <span>{uploadedImages.length} images • {analysisTasks.length} analyses</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Upload and Gallery */}
        <div className="lg:col-span-1 space-y-4">
          {/* Upload Area */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <DocumentArrowUpIcon className="w-5 h-5 mr-2" />
              Upload Images
            </h3>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <input {...getInputProps()} />
              <CameraIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {isDragActive
                  ? 'Drop images here...'
                  : 'Drag & drop images or click to select'
                }
              </p>
              <p className="text-sm text-gray-500 mt-1">
                JPG, PNG, GIF, WebP up to 10MB
              </p>
            </div>
          </div>

          {/* Image Gallery */}
          {uploadedImages.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Image Gallery
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {uploadedImages.map(image => (
                  <div
                    key={image.id}
                    onClick={() => setSelectedImage(image)}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedImage?.id === image.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <img
                      src={image.preview}
                      alt={image.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {image.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(image.size)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(image.id);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Image Preview and Analysis */}
        <div className="lg:col-span-2 space-y-4">
          {selectedImage ? (
            <>
              {/* Image Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {selectedImage.name}
                </h3>
                <div className="relative">
                  <img
                    src={selectedImage.preview}
                    alt={selectedImage.name}
                    className="w-full max-h-96 object-contain rounded-lg bg-gray-100 dark:bg-gray-700"
                  />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <p className="font-medium">{formatFileSize(selectedImage.size)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium">{selectedImage.type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Uploaded:</span>
                    <p className="font-medium">{selectedImage.uploadedAt.toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>

              {/* Analysis Tools */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <BeakerIcon className="w-5 h-5 mr-2" />
                  Analysis Tools
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {ANALYSIS_TYPES.map(analysis => (
                    <div
                      key={analysis.type}
                      onClick={() => setSelectedAnalysisType(analysis.type)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedAnalysisType === analysis.type
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <analysis.icon className="w-5 h-5 text-indigo-600" />
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(analysis.complexity)}`}>
                          {analysis.complexity}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {analysis.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {analysis.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        ~{analysis.estimatedTime}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => startAnalysis(selectedAnalysisType)}
                  disabled={isProcessing}
                  className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <CpuChipIcon className="w-5 h-5 animate-pulse" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5" />
                      <span>Start Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
              <PhotoIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Image Selected
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upload an image to get started with computer vision analysis
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Results */}
      {analysisTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <ChartBarIcon className="w-5 h-5 mr-2" />
              Analysis Results
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {analysisTasks.slice(0, 5).map(task => {
              const analysisType = ANALYSIS_TYPES.find(t => t.type === task.type);
              const image = uploadedImages.find(img => img.id === task.imageId);
              
              return (
                <div key={task.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getTaskStatusIcon(task.status)}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {analysisType?.name || task.type} • {image?.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Started {task.startTime.toLocaleTimeString()}
                          {task.endTime && ` • Completed ${task.endTime.toLocaleTimeString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {task.progress.toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {task.status === 'processing' && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${task.progress}%` }}
                          className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  )}

                  {task.result && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <h5 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                        Analysis Results:
                      </h5>
                      <pre className="text-sm text-green-700 dark:text-green-400 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(task.result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {task.error && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                      <h5 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                        Error:
                      </h5>
                      <p className="text-sm text-red-700 dark:text-red-400">
                        {task.error}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}