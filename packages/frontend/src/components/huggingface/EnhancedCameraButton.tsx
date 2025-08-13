import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  CameraIcon,
  StopIcon,
  PhotoIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import {
  MediaPermissionHandler,
  MediaPermissionState,
} from '../MediaPermissionHandler';
import FloatingMediaOverlay from '../ui/FloatingMediaOverlay';

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

interface CameraSettings {
  resolution: 'low' | 'medium' | 'high';
  task: 'image-classification' | 'object-detection' | 'image-to-text' | 'visual-question-answering';
  model_preference: 'fast' | 'quality' | 'auto';
  auto_capture: boolean;
  capture_interval: number; // seconds
  enable_preprocessing: boolean;
  batch_analysis: boolean;
}

interface EnhancedCameraButtonProps {
  onAnalysis: (result: VisionAnalysisResult) => void;
  disabled?: boolean;
  token: string;
  showAdvancedSettings?: boolean;
  className?: string;
}

const RESOLUTION_SETTINGS = {
  low: { width: 640, height: 480 },
  medium: { width: 1280, height: 720 },
  high: { width: 1920, height: 1080 }
};

const AVAILABLE_TASKS = [
  { 
    id: 'image-classification', 
    name: 'Image Classification', 
    description: 'Identify what\'s in the image',
    icon: '🏷️'
  },
  { 
    id: 'object-detection', 
    name: 'Object Detection', 
    description: 'Find and locate objects in the image',
    icon: '🎯'
  },
  { 
    id: 'image-to-text', 
    name: 'Image Description', 
    description: 'Generate text description of the image',
    icon: '📝'
  },
  { 
    id: 'visual-question-answering', 
    name: 'Visual Q&A', 
    description: 'Answer questions about the image',
    icon: '❓'
  }
];

const MODEL_PREFERENCES = [
  { id: 'fast', name: 'Fast', description: 'Quick results, basic quality' },
  { id: 'quality', name: 'Quality', description: 'Best results, slower processing' },
  { id: 'auto', name: 'Auto', description: 'Balanced speed and quality' }
];

export const EnhancedCameraButton: React.FC<EnhancedCameraButtonProps> = ({
  onAnalysis,
  disabled = false,
  token,
  showAdvancedSettings = false,
  className = ''
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissions, setPermissions] = useState<MediaPermissionState>({
    microphone: "unknown",
    camera: "unknown",
  });
  const [showPermissionUI, setShowPermissionUI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastResult, setLastResult] = useState<VisionAnalysisResult | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopGuardRef = useRef(false);
  const videoReadyRef = useRef(false);

  // Camera settings
  const [settings, setSettings] = useState<CameraSettings>({
    resolution: 'medium',
    task: 'image-classification',
    model_preference: 'auto',
    auto_capture: false,
    capture_interval: 5,
    enable_preprocessing: true,
    batch_analysis: false
  });

  const [vqaQuestion, setVqaQuestion] = useState('What do you see in this image?');

  // Start camera stream
  const startCamera = useCallback(async () => {
    if (disabled || !token) return;

    try {
      setError('');
      console.log("[Enhanced Camera] Starting camera with HuggingFace vision");

      const constraints = {
        video: {
          ...RESOLUTION_SETTINGS[settings.resolution],
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoReadyRef.current = false;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            videoReadyRef.current = true;
          } catch (e) {
            console.warn('[Enhanced Camera] Autoplay prevented:', e);
          }
        };
        videoRef.current.srcObject = stream;
      }

      setIsStreaming(true);
  setShowOverlay(true);

      // Setup auto-capture if enabled
      if (settings.auto_capture) {
        intervalRef.current = setInterval(() => {
          captureAndAnalyze();
        }, settings.capture_interval * 1000);
      }

    } catch (error) {
      console.error("[Enhanced Camera] Failed to start camera:", error);
      
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setError("Camera permission denied. Please allow camera access.");
          setShowPermissionUI(true);
        } else if (error.name === "NotFoundError") {
          setError("No camera found. Please connect a camera.");
        } else if (error.name === "NotReadableError") {
          setError("Camera is already in use by another application.");
        } else {
          setError(error.message);
        }
      }
    }
  }, [disabled, token, settings]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stopGuardRef.current) return; // prevent duplicate stop logs & track shutdown
    stopGuardRef.current = true;
    console.log("[Enhanced Camera] Stopping camera");

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
  videoReadyRef.current = false;
  setShowOverlay(false);
  setTimeout(() => { stopGuardRef.current = false; }, 100); // allow future starts
  }, []);

  // Capture image and analyze with HuggingFace Vision
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) return;
    if (!videoReadyRef.current) {
      console.warn('[Enhanced Camera] Capture skipped: video not ready');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Failed to get canvas context');

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame
      ctx.drawImage(video, 0, 0);

      // Detect black frame (all pixels near zero) quickly using sampling
      const sampleData = ctx.getImageData(0, 0, Math.min(64, canvas.width), Math.min(64, canvas.height)).data;
      let nonZero = 0;
      for (let i = 0; i < sampleData.length; i += 16) { // sample every 4th pixel (RGBA -> stride 16 covers 4 pixels)
        const r = sampleData[i];
        const g = sampleData[i+1];
        const b = sampleData[i+2];
        if (r + g + b > 30) { nonZero++; if (nonZero > 5) break; }
      }
      if (nonZero <= 5) {
        console.warn('[Enhanced Camera] Black/blank frame detected, skipping analysis');
        setIsProcessing(false);
        return;
      }

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.8);
      });

      // Prepare form data for HuggingFace Vision API
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');
      formData.append('taskType', settings.task);

      // Add task-specific parameters
      if (settings.task === 'visual-question-answering') {
        formData.append('question', vqaQuestion);
      }

      const analysisOptions = {
        model_preference: settings.model_preference,
        enable_preprocessing: settings.enable_preprocessing,
        budget_tier: settings.model_preference === 'fast' ? 'economy' : 
                    settings.model_preference === 'quality' ? 'premium' : 'standard'
      };

      formData.append('options', JSON.stringify(analysisOptions));

      // Call HuggingFace Vision API
      const response = await fetch('/api/huggingface/vision', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Vision analysis failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.result) {
        const visionResult: VisionAnalysisResult = {
          task_type: settings.task,
          predictions: result.result.predictions || [],
          confidence: result.result.confidence || 0.9,
          model_used: result.result.model_used || 'unknown',
          processing_time_ms: result.result.processing_time_ms || 0,
          detected_objects: result.result.detected_objects,
          classifications: result.result.classifications,
          generated_text: result.result.generated_text,
          image_description: result.result.image_description
        };

        setLastResult(visionResult);
        setCaptureCount(prev => prev + 1);
        onAnalysis(visionResult);
      } else {
        throw new Error('No analysis result received from HuggingFace Vision');
      }

    } catch (error) {
      console.error("[Enhanced Camera] Analysis error:", error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsProcessing(false);
    }
  }, [isStreaming, settings, vqaQuestion, token, onAnalysis]);

  const handleClick = useCallback(() => {
    if (isStreaming) {
      stopCamera();
    } else {
      if (permissions.camera !== "granted") {
        setShowPermissionUI(true);
        return;
      }
      startCamera();
    }
  }, [isStreaming, permissions.camera, startCamera, stopCamera]);

  const handlePermissionChange = useCallback((newPermissions: MediaPermissionState) => {
    setPermissions(newPermissions);
    if (newPermissions.camera === "granted" && showPermissionUI) {
      setShowPermissionUI(false);
    }
  }, [showPermissionUI]);

  // Test vision system
  const testVisionSystem = useCallback(async () => {
    try {
      setError('');
      setIsProcessing(true);
      
      const response = await fetch('/api/huggingface/health');
      const health = await response.json();
      
      if (health.success && health.health.agents?.VisionMaster?.status === 'healthy') {
        setError(''); // Clear any previous errors
      } else {
        setError('Vision system not ready. Please try again in a moment.');
      }
    } catch (error) {
      setError('Failed to test vision system');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const isButtonDisabled = disabled || isProcessing || !token;

  return (
    <div className={`relative ${className}`}>
      <FloatingMediaOverlay
        stream={streamRef.current}
        visible={showOverlay}
        position="center"
        onClose={() => setShowOverlay(false)}
      />
      {/* Main Button */}
      <button
        onClick={handleClick}
        disabled={isButtonDisabled}
        className={`
          p-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          ${isStreaming
            ? "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 shadow-lg"
            : isProcessing
              ? "bg-blue-500 text-white animate-pulse"
              : "bg-gray-100 hover:bg-gray-200 text-gray-600 focus:ring-blue-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
          }
          ${isButtonDisabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer transform hover:scale-105"
          }
        `}
        title={
          isStreaming
            ? "Stop camera (HuggingFace Vision)"
            : isProcessing
              ? "Processing with HuggingFace..."
              : "Start camera (Enhanced Vision)"
        }
      >
        {isStreaming ? (
          <StopIcon className="h-6 w-6" />
        ) : (
          <CameraIcon
            className={`h-6 w-6 ${isProcessing ? "animate-pulse" : ""}`}
          />
        )}
      </button>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse border-2 border-white" />
      )}

      {/* Capture button when streaming */}
      {isStreaming && (
        <button
          onClick={captureAndAnalyze}
          disabled={isProcessing}
          className="absolute top-0 left-full ml-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full transition-colors"
          title="Capture and Analyze"
        >
          <PhotoIcon className="h-5 w-5" />
        </button>
      )}

      {/* Settings Button */}
      {showAdvancedSettings && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 p-1 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          title="Vision Settings"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 bg-blue-500 text-white text-sm rounded shadow-lg whitespace-nowrap">
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            <span>Analyzing with HuggingFace Vision...</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 bg-red-500 text-white text-sm rounded shadow-lg max-w-xs">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Last Result Indicator */}
      {lastResult && !error && !isProcessing && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 bg-green-500 text-white text-sm rounded shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-4 w-4" />
            <span>
              {lastResult.task_type === 'image-classification' 
                ? `Classified (${lastResult.confidence > 0.8 ? 'High' : 'Med'} confidence)`
                : lastResult.task_type === 'object-detection'
                ? `Found ${lastResult.detected_objects?.length || 0} objects`
                : lastResult.task_type === 'image-to-text'
                ? 'Description generated'
                : 'Analysis complete'
              }
            </span>
          </div>
        </div>
      )}

      {/* Video Preview */}
      {isStreaming && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 bg-black rounded-lg overflow-hidden shadow-lg">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-80 h-60 object-cover"
          />
          {captureCount > 0 && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              Captures: {captureCount}
            </div>
          )}
          {settings.auto_capture && (
            <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
              <ArrowPathIcon className="h-3 w-3 animate-spin" />
              <span>Auto</span>
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">Vision Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Analysis Task
              </label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_TASKS.map(task => (
                  <button
                    key={task.id}
                    onClick={() => setSettings(prev => ({ ...prev, task: task.id as any }))}
                    className={`p-3 text-left border rounded-lg transition-colors ${
                      settings.task === task.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{task.icon}</span>
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {task.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {task.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {settings.task === 'visual-question-answering' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Question
                </label>
                <input
                  type="text"
                  value={vqaQuestion}
                  onChange={(e) => setVqaQuestion(e.target.value)}
                  placeholder="What do you see in this image?"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model Preference
              </label>
              <select
                value={settings.model_preference}
                onChange={(e) => setSettings(prev => ({ ...prev, model_preference: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODEL_PREFERENCES.map(pref => (
                  <option key={pref.id} value={pref.id}>
                    {pref.name} - {pref.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resolution
              </label>
              <select
                value={settings.resolution}
                onChange={(e) => setSettings(prev => ({ ...prev, resolution: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low (640x480)</option>
                <option value="medium">Medium (1280x720)</option>
                <option value="high">High (1920x1080)</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.auto_capture}
                  onChange={(e) => setSettings(prev => ({ ...prev, auto_capture: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Auto-capture</span>
              </label>

              {settings.auto_capture && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Capture Interval (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.capture_interval}
                    onChange={(e) => setSettings(prev => ({ ...prev, capture_interval: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.enable_preprocessing}
                  onChange={(e) => setSettings(prev => ({ ...prev, enable_preprocessing: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable preprocessing</span>
              </label>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={testVisionSystem}
                disabled={isProcessing}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
              >
                Test Vision System
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Permission Handler */}
      {showPermissionUI && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 w-80">
          <MediaPermissionHandler
            onPermissionChange={handlePermissionChange}
            requiredPermissions={["camera"]}
            showUI={true}
            autoRequest={false}
          />
        </div>
      )}
    </div>
  );
};