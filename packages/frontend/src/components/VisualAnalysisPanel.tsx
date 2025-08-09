import React, { useState, useRef, useEffect } from "react";
import {
  EyeIcon,
  EyeSlashIcon,
  CameraIcon,
  StopIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { API_BASE_URL } from "../config/constants";
import {
  requestCameraPermission,
  FrameCaptureManager,
  FrameCaptureResult,
  isCameraSupported,
} from "@/utils/cameraUtils";

interface VisualAnalysisPanelProps {
  token: string;
  isActive: boolean;
  onAnalysisResult?: (analysis: any) => void;
  onError?: (error: string) => void;
  settings?: {
    captureInterval?: number;
    analysisType?: "comprehensive" | "basic" | "emotion" | "activity";
    enableFaceDetection?: boolean;
    enableObjectDetection?: boolean;
    privacyMode?: boolean;
  };
}

interface AnalysisState {
  isCapturing: boolean;
  hasPermission: boolean;
  error: string | null;
  lastAnalysis: any | null;
  analysisCount: number;
  isAnalyzing: boolean;
}

export const VisualAnalysisPanel: React.FC<VisualAnalysisPanelProps> = ({
  token,
  isActive,
  onAnalysisResult,
  onError,
  settings = {},
}) => {
  const {
    captureInterval = 3000,
    analysisType = "comprehensive",
    enableFaceDetection = true,
    enableObjectDetection = true,
    privacyMode = false,
  } = settings;

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isCapturing: false,
    hasPermission: false,
    error: null,
    lastAnalysis: null,
    analysisCount: 0,
    isAnalyzing: false,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureManagerRef = useRef<FrameCaptureManager | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera when component becomes active
  useEffect(() => {
    if (isActive && !analysisState.hasPermission) {
      initializeCamera();
    } else if (!isActive) {
      cleanup();
    }

    return () => cleanup();
  }, [isActive]);

  // Check camera support on mount
  useEffect(() => {
    if (!isCameraSupported()) {
      setAnalysisState((prev) => ({
        ...prev,
        error: "Camera not supported in this browser",
      }));
      onError?.("Camera not supported in this browser");
    }
  }, [onError]);

  const initializeCamera = async () => {
    try {
      console.log("[VisualAnalysis] Initializing camera...");

      const permissionResult = await requestCameraPermission();

      if (!permissionResult.granted) {
        throw new Error(permissionResult.error || "Camera permission denied");
      }

      if (videoRef.current && permissionResult.stream) {
        videoRef.current.srcObject = permissionResult.stream;
        streamRef.current = permissionResult.stream;

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          startVisualCapture();
        };

        setAnalysisState((prev) => ({
          ...prev,
          hasPermission: true,
          error: null,
        }));
      }
    } catch (error: any) {
      console.error("[VisualAnalysis] Camera initialization failed:", error);
      const errorMessage = error.message || "Failed to initialize camera";

      setAnalysisState((prev) => ({
        ...prev,
        error: errorMessage,
        hasPermission: false,
      }));

      onError?.(errorMessage);
    }
  };

  const startVisualCapture = () => {
    if (!videoRef.current || analysisState.isCapturing) {
      return;
    }

    console.log("[VisualAnalysis] Starting visual capture...");

    const captureManager = new FrameCaptureManager(
      videoRef.current,
      handleFrameCapture,
      {
        width: 640,
        height: 480,
        quality: 0.8,
        format: "jpeg",
      },
    );

    captureManager.startCapture(captureInterval);
    captureManagerRef.current = captureManager;

    setAnalysisState((prev) => ({
      ...prev,
      isCapturing: true,
    }));
  };

  const handleFrameCapture = async (frameResult: FrameCaptureResult) => {
    if (!frameResult.success || !frameResult.blob) {
      console.error(
        "[VisualAnalysis] Frame capture failed:",
        frameResult.error,
      );
      return;
    }

    // Skip analysis if already analyzing or in privacy mode
    if (analysisState.isAnalyzing || privacyMode) {
      return;
    }

    try {
      setAnalysisState((prev) => ({ ...prev, isAnalyzing: true }));

      const analysis = await analyzeFrame(frameResult.blob);

      if (analysis) {
        setAnalysisState((prev) => ({
          ...prev,
          lastAnalysis: analysis,
          analysisCount: prev.analysisCount + 1,
          isAnalyzing: false,
        }));

        onAnalysisResult?.(analysis);

        // Draw analysis overlay if canvas is available
        drawAnalysisOverlay(analysis);
      }
    } catch (error: any) {
      console.error("[VisualAnalysis] Frame analysis failed:", error);
      setAnalysisState((prev) => ({ ...prev, isAnalyzing: false }));
    }
  };

  const analyzeFrame = async (imageBlob: Blob): Promise<any> => {
    const formData = new FormData();
    formData.append("image", imageBlob, "frame.jpg");
    formData.append("analysisType", analysisType);
    formData.append(
      "focusAreas",
      JSON.stringify({
        faces: enableFaceDetection,
        objects: enableObjectDetection,
        activities: true,
        emotions:
          analysisType === "emotion" || analysisType === "comprehensive",
      }),
    );

    const response = await fetch(`${API_BASE_URL}/api/vision/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status}`);
    }

    const result = await response.json();
    return result.analysis;
  };

  const drawAnalysisOverlay = (analysis: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || !analysis) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear previous overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw analysis indicators (simple version for now)
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.font = "16px Arial";
    ctx.fillStyle = "#00ff88";

    // Draw analysis status
    ctx.fillText(`Analysis: ${analysis.summary || "Processing..."}`, 10, 30);

    if (analysis.objects && analysis.objects.length > 0) {
      ctx.fillText(`Objects: ${analysis.objects.length}`, 10, 55);
    }

    if (analysis.people && analysis.people.length > 0) {
      ctx.fillText(`People: ${analysis.people.length}`, 10, 80);
    }
  };

  const cleanup = () => {
    console.log("[VisualAnalysis] Cleaning up...");

    // Stop capture manager
    if (captureManagerRef.current) {
      captureManagerRef.current.stopCapture();
      captureManagerRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Reset video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setAnalysisState({
      isCapturing: false,
      hasPermission: false,
      error: null,
      lastAnalysis: null,
      analysisCount: 0,
      isAnalyzing: false,
    });
  };

  const toggleCapture = () => {
    if (analysisState.isCapturing) {
      captureManagerRef.current?.stopCapture();
      setAnalysisState((prev) => ({ ...prev, isCapturing: false }));
    } else {
      startVisualCapture();
    }
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className="visual-analysis-panel">
      <div className="bg-black/80 rounded-lg p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <EyeIcon className="h-5 w-5 text-blue-400" />
            <span className="text-white font-medium">Visual Analysis</span>
            {analysisState.isAnalyzing && (
              <SparklesIcon className="h-4 w-4 text-yellow-400 animate-pulse" />
            )}
          </div>

          <div className="flex items-center space-x-2">
            {analysisState.analysisCount > 0 && (
              <span className="text-xs text-gray-400">
                {analysisState.analysisCount} frames analyzed
              </span>
            )}

            <button
              onClick={toggleCapture}
              disabled={!analysisState.hasPermission}
              className={`
                p-1 rounded ${
                  analysisState.isCapturing
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-500 hover:bg-green-600"
                } text-white disabled:opacity-50
              `}
            >
              {analysisState.isCapturing ? (
                <StopIcon className="h-4 w-4" />
              ) : (
                <CameraIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {analysisState.error && (
          <div className="flex items-center space-x-2 text-red-400 text-sm">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>{analysisState.error}</span>
          </div>
        )}

        {/* Video Preview with Overlay */}
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full max-w-sm rounded border border-gray-600"
            style={{ transform: "scaleX(-1)" }} // Mirror for user-facing camera
          />

          {/* Analysis overlay canvas */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* Status indicators */}
          {analysisState.isCapturing && (
            <div className="absolute top-2 right-2 flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-white bg-black/50 px-1 rounded">
                ANALYZING
              </span>
            </div>
          )}
        </div>

        {/* Analysis Summary */}
        {analysisState.lastAnalysis && (
          <div className="text-xs text-gray-300 bg-gray-800/50 p-2 rounded">
            <div className="font-medium mb-1">Latest Analysis:</div>
            <div>
              {analysisState.lastAnalysis.summary || "Scene analysis complete"}
            </div>
            {analysisState.lastAnalysis.mood && (
              <div className="mt-1">
                Mood: {analysisState.lastAnalysis.mood}
              </div>
            )}
          </div>
        )}

        {/* Settings Display */}
        {privacyMode && (
          <div className="flex items-center space-x-2 text-yellow-400 text-sm">
            <EyeSlashIcon className="h-4 w-4" />
            <span>Privacy Mode Active</span>
          </div>
        )}
      </div>
    </div>
  );
};
