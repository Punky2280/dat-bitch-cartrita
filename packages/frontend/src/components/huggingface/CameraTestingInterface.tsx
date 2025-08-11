import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  CameraIcon,
  PhotoIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  StopIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface CameraTestResult {
  test_type: 'image-classification' | 'object-detection' | 'image-to-text' | 'visual-question-answering';
  success: boolean;
  result?: any;
  error?: string;
  latency_ms: number;
  confidence: number;
  model_used: string;
  provider: string;
  image_analysis?: {
    resolution: string;
    file_size: number;
    quality_score: number;
  };
}

interface CameraTestingInterfaceProps {
  token: string;
  className?: string;
}

interface TestSettings {
  resolution: 'low' | 'medium' | 'high';
  models: {
    'image-classification': string;
    'object-detection': string;
    'image-to-text': string;
    'visual-question-answering': string;
  };
  test_images: string[];
  confidence_threshold: number;
  latency_threshold: number;
  enable_batch_testing: boolean;
  auto_capture_interval: number;
}

// Removed unused DEFAULT_TEST_SCENARIOS constant

const TEST_QUESTIONS = [
  "What objects can you see in this image?",
  "What colors are prominent in this image?", 
  "What is the main subject of this image?",
  "What activities are happening in this image?",
  "What is the setting or location of this image?"
];

const AVAILABLE_MODELS = {
  'image-classification': [
    { id: 'google/vit-base-patch16-224', name: 'Vision Transformer Base', quality: 'High' },
    { id: 'microsoft/resnet-50', name: 'ResNet-50', quality: 'Medium' }
  ],
  'object-detection': [
    { id: 'facebook/detr-resnet-50', name: 'DETR ResNet-50', quality: 'High' },
    { id: 'microsoft/table-transformer-detection', name: 'Table Transformer', quality: 'Specialized' }
  ],
  'image-to-text': [
    { id: 'Salesforce/blip-image-captioning-base', name: 'BLIP Image Captioning', quality: 'High' },
    { id: 'microsoft/git-base', name: 'GIT Base', quality: 'Medium' }
  ],
  'visual-question-answering': [
    { id: 'dandelin/vilt-b32-finetuned-vqa', name: 'ViLT VQA', quality: 'High' }
  ]
};

export const CameraTestingInterface: React.FC<CameraTestingInterfaceProps> = ({
  token,
  className = ''
}) => {
  const [testResults, setTestResults] = useState<CameraTestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string>('');
  const [capturedImages, setCapturedImages] = useState<Array<{ blob: Blob; timestamp: Date; id: string }>>([]);

  // Camera states
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Test settings
  const [settings, setSettings] = useState<TestSettings>({
    resolution: 'medium',
    models: {
      'image-classification': 'google/vit-base-patch16-224',
      'object-detection': 'facebook/detr-resnet-50',
      'image-to-text': 'Salesforce/blip-image-captioning-base',
      'visual-question-answering': 'dandelin/vilt-b32-finetuned-vqa'
    },
    test_images: [],
    confidence_threshold: 0.7,
    latency_threshold: 10000,
    enable_batch_testing: false,
    auto_capture_interval: 5
  });

  const RESOLUTION_SETTINGS = {
    low: { width: 640, height: 480 },
    medium: { width: 1280, height: 720 },
    high: { width: 1920, height: 1080 }
  };

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError('');
      const constraints = {
        video: {
          ...RESOLUTION_SETTINGS[settings.resolution],
          facingMode: 'user'
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);
    } catch (error) {
      console.error('Failed to start camera:', error);
      setError('Failed to access camera: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [settings.resolution]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
  }, []);

  // Capture image
  const captureImage = useCallback(async (): Promise<Blob> => {
    if (!videoRef.current || !canvasRef.current) {
      throw new Error('Camera not ready');
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Failed to get canvas context');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.85);
    });
  }, []);

  // Capture and store image
  const captureAndStore = useCallback(async () => {
    try {
      const blob = await captureImage();
      const id = `capture_${Date.now()}`;
      setCapturedImages(prev => [...prev, { blob, timestamp: new Date(), id }]);
      setError('');
    } catch (error) {
      setError('Failed to capture image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [captureImage]);

  // Test specific vision task
  const testVisionTask = useCallback(async (
    taskType: CameraTestResult['test_type'],
    imageBlob: Blob,
    question?: string
  ): Promise<CameraTestResult> => {
    const startTime = Date.now();
    const formData = new FormData();
    formData.append('image', imageBlob, 'test-image.jpg');
    formData.append('taskType', taskType);

    if (taskType === 'visual-question-answering' && question) {
      formData.append('question', question);
    }

    const analysisOptions = {
      model: settings.models[taskType],
      confidence_threshold: settings.confidence_threshold
    };
    formData.append('options', JSON.stringify(analysisOptions));

    const response = await fetch('/api/huggingface/vision', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`${taskType} test failed: ${response.statusText}`);
    }

    const result = await response.json();
    const latency = Date.now() - startTime;

    // Analyze image properties
    const imageAnalysis = {
      resolution: `${canvasRef.current?.width}x${canvasRef.current?.height}`,
      file_size: imageBlob.size,
      quality_score: imageBlob.size > 100000 ? 0.9 : imageBlob.size > 50000 ? 0.7 : 0.5
    };

    return {
      test_type: taskType,
      success: result.success,
      result: result.result,
      error: result.error,
      latency_ms: latency,
      confidence: result.result?.confidence || 0,
      model_used: settings.models[taskType],
      provider: 'huggingface',
      image_analysis: imageAnalysis
    };
  }, [settings, token]);

  // Run comprehensive vision test suite
  const runFullTestSuite = useCallback(async () => {
    const selectedImage = capturedImages.find(img => img.id === selectedImageId);
    if (!selectedImage) {
      setError('Please capture and select an image first');
      return;
    }

    setIsRunningTest(true);
    setError('');
    const results: CameraTestResult[] = [];

    try {
      // Test 1: Image Classification
      setCurrentTest('Testing Image Classification...');
      const classificationResult = await testVisionTask('image-classification', selectedImage.blob);
      results.push(classificationResult);

      // Test 2: Object Detection  
      setCurrentTest('Testing Object Detection...');
      const detectionResult = await testVisionTask('object-detection', selectedImage.blob);
      results.push(detectionResult);

      // Test 3: Image to Text
      setCurrentTest('Testing Image Description...');
      const captioningResult = await testVisionTask('image-to-text', selectedImage.blob);
      results.push(captioningResult);

      // Test 4: Visual Question Answering
      for (let i = 0; i < Math.min(2, TEST_QUESTIONS.length); i++) {
        setCurrentTest(`Testing Visual Q&A ${i + 1}...`);
        const vqaResult = await testVisionTask('visual-question-answering', selectedImage.blob, TEST_QUESTIONS[i]);
        results.push(vqaResult);
      }

      setTestResults(results);

    } catch (error) {
      console.error('Test suite error:', error);
      setError(error instanceof Error ? error.message : 'Test suite failed');
    } finally {
      setIsRunningTest(false);
      setCurrentTest('');
    }
  }, [capturedImages, selectedImageId, testVisionTask]);

  // Get overall test status
  const getOverallStatus = useCallback(() => {
    if (testResults.length === 0) return { status: 'pending', message: 'No tests run' };
    
    const passedTests = testResults.filter(r => 
      r.success && 
      r.confidence >= settings.confidence_threshold &&
      r.latency_ms <= settings.latency_threshold
    );
    
    const passRate = passedTests.length / testResults.length;
    
    if (passRate >= 0.8) return { status: 'excellent', message: 'All vision systems performing well' };
    if (passRate >= 0.6) return { status: 'good', message: 'Most vision systems working correctly' };
    if (passRate >= 0.4) return { status: 'fair', message: 'Some vision issues detected' };
    return { status: 'poor', message: 'Multiple vision systems need attention' };
  }, [testResults, settings]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const overallStatus = getOverallStatus();

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <CameraIcon className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Camera Vision Testing
          </h2>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <AdjustmentsHorizontalIcon className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Overall Status */}
      {testResults.length > 0 && (
        <div className={`mb-6 p-4 rounded-lg border ${
          overallStatus.status === 'excellent' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
          overallStatus.status === 'good' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' :
          overallStatus.status === 'fair' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' :
          'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircleIcon className={`h-6 w-6 ${
                overallStatus.status === 'excellent' ? 'text-green-600' :
                overallStatus.status === 'good' ? 'text-blue-600' :
                overallStatus.status === 'fair' ? 'text-yellow-600' :
                'text-red-600'
              }`} />
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Vision Status: {overallStatus.status.charAt(0).toUpperCase() + overallStatus.status.slice(1)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {overallStatus.message}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600 dark:text-gray-400">
              <p>{testResults.filter(r => r.success).length}/{testResults.length} tests passed</p>
              <p>Avg confidence: {Math.round(testResults.reduce((acc, r) => acc + r.confidence, 0) / testResults.length * 100)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Camera Section */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Camera Control
        </h3>
        
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={isStreaming ? stopCamera : startCamera}
            disabled={isRunningTest}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isStreaming 
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400'
            }`}
          >
            {isStreaming ? <StopIcon className="h-5 w-5" /> : <CameraIcon className="h-5 w-5" />}
            <span>{isStreaming ? 'Stop Camera' : 'Start Camera'}</span>
          </button>

          {isStreaming && (
            <button
              onClick={captureAndStore}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <PhotoIcon className="h-5 w-5" />
              <span>Capture Image</span>
            </button>
          )}
        </div>

        {/* Video Preview */}
        {isStreaming && (
          <div className="mb-4 bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full max-w-md mx-auto object-cover"
            />
          </div>
        )}

        {/* Captured Images */}
        {capturedImages.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Captured Images ({capturedImages.length})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {capturedImages.map((image) => (
                <div
                  key={image.id}
                  className={`relative border-2 rounded-lg cursor-pointer ${
                    selectedImageId === image.id
                      ? 'border-blue-500'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedImageId(image.id)}
                >
                  <img
                    src={URL.createObjectURL(image.blob)}
                    alt="Captured"
                    className="w-full h-24 object-cover rounded"
                  />
                  <div className="absolute bottom-1 left-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded text-center">
                    {image.timestamp.toLocaleTimeString()}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCapturedImages(prev => prev.filter(img => img.id !== image.id));
                      if (selectedImageId === image.id) {
                        setSelectedImageId(null);
                      }
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                  {selectedImageId === image.id && (
                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                      <CheckCircleIcon className="h-6 w-6 text-blue-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Test Actions */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={runFullTestSuite}
            disabled={!selectedImageId || isRunningTest}
            className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isRunningTest ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Running Vision Tests...</span>
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-5 w-5" />
                <span>Run Vision Test Suite</span>
              </>
            )}
          </button>

          {isRunningTest && currentTest && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
              <span>{currentTest}</span>
            </div>
          )}
        </div>

        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Capture an image, select it, then run the test suite to validate classification, detection, captioning, and Q&A capabilities.
        </p>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Vision Test Results
          </h3>
          
          <div className="space-y-4">
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${
                  result.success && result.confidence >= settings.confidence_threshold && result.latency_ms <= settings.latency_threshold
                    ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                    : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {result.success ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    )}
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {result.test_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Test
                    </h4>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>Confidence: {(result.confidence * 100).toFixed(0)}%</span>
                    <span>Latency: {result.latency_ms}ms</span>
                  </div>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Model: {result.model_used}</p>
                  {result.image_analysis && (
                    <p>Resolution: {result.image_analysis.resolution} | Size: {(result.image_analysis.file_size / 1024).toFixed(1)}KB</p>
                  )}
                  {result.error && (
                    <p className="text-red-600 dark:text-red-400">Error: {result.error}</p>
                  )}
                  
                  {/* Display specific results based on test type */}
                  {result.success && result.result && (
                    <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs">
                      {result.test_type === 'image-classification' && result.result.classifications && (
                        <div>
                          <strong>Classifications:</strong>
                          {result.result.classifications.slice(0, 3).map((cls: any, i: number) => (
                            <div key={i}>• {cls.label}: {(cls.confidence * 100).toFixed(1)}%</div>
                          ))}
                        </div>
                      )}
                      
                      {result.test_type === 'object-detection' && result.result.detected_objects && (
                        <div>
                          <strong>Objects Detected:</strong> {result.result.detected_objects.length}
                          {result.result.detected_objects.slice(0, 3).map((obj: any, i: number) => (
                            <div key={i}>• {obj.label}: {(obj.confidence * 100).toFixed(1)}%</div>
                          ))}
                        </div>
                      )}
                      
                      {result.test_type === 'image-to-text' && result.result.generated_text && (
                        <div>
                          <strong>Description:</strong> "{result.result.generated_text}"
                        </div>
                      )}
                      
                      {result.test_type === 'visual-question-answering' && result.result.answer && (
                        <div>
                          <strong>Answer:</strong> "{result.result.answer}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Vision Test Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Camera Resolution
              </label>
              <select
                value={settings.resolution}
                onChange={(e) => setSettings(prev => ({ ...prev, resolution: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low (640x480)</option>
                <option value="medium">Medium (1280x720)</option>
                <option value="high">High (1920x1080)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confidence Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.confidence_threshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, confidence_threshold: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Latency Threshold (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  max="30000"
                  step="1000"
                  value={settings.latency_threshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, latency_threshold: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Model Preferences</h4>
              {Object.entries(AVAILABLE_MODELS).map(([taskType, models]) => (
                <div key={taskType}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {taskType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                  <select
                    value={settings.models[taskType as keyof typeof settings.models]}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      models: { ...prev.models, [taskType]: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.quality})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};