import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  MicrophoneIcon, 
  StopIcon, 
  SpeakerWaveIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import {
  checkMediaSupport,
  getOptimalAudioConstraints,
  getSupportedMimeType,
  logMediaDeviceInfo,
} from "@/utils/mediaUtils";
import { AudioVisualizer } from "../AudioVisualizer";
import {
  MediaPermissionHandler,
  MediaPermissionState,
} from "../MediaPermissionHandler";

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

interface EnhancedVoiceToTextButtonProps {
  onTranscript: (result: VoiceToTextResult) => void;
  disabled?: boolean;
  token: string;
  showAdvancedSettings?: boolean;
  className?: string;
}

interface STTSettings {
  model: string;
  language: string;
  enable_confidence: boolean;
  enable_alternatives: boolean;
  noise_reduction: boolean;
  auto_punctuation: boolean;
  provider_preference: 'huggingface' | 'auto';
}

export const EnhancedVoiceToTextButton: React.FC<EnhancedVoiceToTextButtonProps> = ({
  onTranscript,
  disabled = false,
  token,
  showAdvancedSettings = false,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissions, setPermissions] = useState<MediaPermissionState>({
    microphone: "unknown",
    camera: "unknown",
  });
  const [showPermissionUI, setShowPermissionUI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastResult, setLastResult] = useState<VoiceToTextResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // STT Settings
  const [settings, setSettings] = useState<STTSettings>({
    model: 'openai/whisper-large-v3',
    language: 'auto',
    enable_confidence: true,
    enable_alternatives: true,
    noise_reduction: true,
    auto_punctuation: true,
    provider_preference: 'huggingface'
  });

  // Expanded STT model choices (covering whisper tiers, wav2vec2 variants, conformer, small multilingual models)
  const availableModels = [
    { id: 'openai/whisper-large-v3', name: 'Whisper Large v3', quality: 'High', speed: 'Medium' },
    { id: 'openai/whisper-medium', name: 'Whisper Medium', quality: 'Med', speed: 'Fast' },
    { id: 'openai/whisper-small', name: 'Whisper Small', quality: 'Basic', speed: 'Very Fast' },
    { id: 'openai/whisper-tiny', name: 'Whisper Tiny', quality: 'Low', speed: 'Ultra Fast' },
    { id: 'distil-whisper/distil-large-v3', name: 'Distil Whisper Large v3', quality: 'High', speed: 'Faster' },
    { id: 'distil-whisper/distil-medium.en', name: 'Distil Whisper Medium EN', quality: 'Med', speed: 'Faster' },
    { id: 'facebook/wav2vec2-large-960h', name: 'Wav2Vec2 Large', quality: 'Med', speed: 'Fast' },
    { id: 'facebook/wav2vec2-base-960h', name: 'Wav2Vec2 Base', quality: 'Basic', speed: 'Very Fast' },
    { id: 'jonatasgrosman/wav2vec2-large-xlsr-53-english', name: 'Wav2Vec2 XLSR EN', quality: 'Med', speed: 'Fast' },
    { id: 'jonatasgrosman/wav2vec2-large-xlsr-53-spanish', name: 'Wav2Vec2 XLSR ES', quality: 'Med', speed: 'Fast' },
    { id: 'nbroad/paraformer-ctc-en', name: 'Paraformer CTC EN', quality: 'Med', speed: 'Fast' },
    { id: 'kamo-naoyuki/wav2vec2-large-japanese', name: 'Wav2Vec2 Japanese', quality: 'Med', speed: 'Fast' },
    { id: 'openai/whisper-large-v2', name: 'Whisper Large v2', quality: 'High', speed: 'Medium' },
    { id: 'openai/whisper-base', name: 'Whisper Base', quality: 'Basic', speed: 'Fast' },
    { id: 'openai/whisper-base.en', name: 'Whisper Base EN', quality: 'Basic', speed: 'Fast' }
  ];

  // Audio validation with enhanced analysis
  const isAudioValid = useCallback(async (blob: Blob): Promise<{ valid: boolean; analysis: any }> => {
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);

      const data = buffer.getChannelData(0);
      const length = data.length;
      const sampleRate = buffer.sampleRate;
      const duration = buffer.duration;

      // Iterative single-pass computations to avoid large spreads & multiple passes
      let sumSquares = 0;
      let peakAbs = 0;
      let zeroCrossings = 0;
      let prevSign = Math.sign(data[0]) || 1;
      const stride = Math.max(1, Math.floor(length / 200_000)); // down-sample if extremely large
      for (let i = 0; i < length; i += stride) {
        const v = data[i];
        const abs = v < 0 ? -v : v;
        sumSquares += v * v;
        if (abs > peakAbs) peakAbs = abs;
        const sign = v === 0 ? prevSign : (v > 0 ? 1 : -1);
        if (sign !== prevSign) zeroCrossings++;
        prevSign = sign;
      }
      const effectiveSamples = Math.ceil(length / stride);
      const rms = Math.sqrt(sumSquares / effectiveSamples);

      // Thresholds (tuned)
      const energyThreshold = 0.001;
      const peakThreshold = 0.01;
      const minDuration = 0.5; // seconds
      const maxZeroCrossings = (sampleRate * duration * 0.3) / stride;

      const analysis = {
        duration,
        rms,
        peak: peakAbs,
        zeroCrossings,
        sampleRate,
        fileSize: blob.size,
        quality: peakAbs > peakThreshold ? 'good' : rms > energyThreshold ? 'fair' : 'poor'
      };

      const valid = duration >= minDuration &&
        (rms > energyThreshold || peakAbs > peakThreshold) &&
        zeroCrossings < maxZeroCrossings;

      return { valid, analysis };
    } catch (error) {
      console.error('[STT] Audio validation error:', error);
      return { valid: true, analysis: null };
    } finally {
      try { ctx?.close(); } catch(_) {}
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || !token) return;

    try {
      setError('');
      setIsRecording(true);
      console.log("[Enhanced STT] Starting recording with HuggingFace provider");

      // Check media support
      const support = checkMediaSupport();
      if (!support.isSupported) {
        throw new Error(`Media not supported: ${support.issues.join(", ")}`);
      }

      await logMediaDeviceInfo();

      // Enhanced audio constraints for better quality
      const audioConstraints = {
        ...getOptimalAudioConstraints(),
        sampleRate: 16000, // Optimal for most STT models
        channelCount: 1,   // Mono for STT
        echoCancellation: settings.noise_reduction,
        noiseSuppression: settings.noise_reduction,
        autoGainControl: true
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      const processedRef = { done: false };
      mediaRecorder.onstop = async () => {
        if (processedRef.done) return; // guard duplicate firing
        processedRef.done = true;
        console.log("[Enhanced STT] Processing with HuggingFace STT");
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          const { valid, analysis } = await isAudioValid(audioBlob);
          
          if (!valid) {
            throw new Error(
              `Audio quality insufficient. Duration: ${analysis?.duration?.toFixed(2)}s, Quality: ${analysis?.quality}`
            );
          }

          // Use the new HuggingFace STT endpoint
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          // Add STT settings
          const sttOptions = {
            model: settings.model,
            language: settings.language !== 'auto' ? settings.language : undefined,
            enable_confidence: settings.enable_confidence,
            enable_alternatives: settings.enable_alternatives,
            noise_reduction: settings.noise_reduction,
            auto_punctuation: settings.auto_punctuation
          };

          const response = await fetch('/api/huggingface/audio', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `STT failed: ${response.statusText}`);
          }

          const result = await response.json();
          
          if (result.success && result.result) {
            const sttResult: VoiceToTextResult = {
              transcript: result.result.transcript || result.result.text || '',
              confidence: result.result.confidence || 0.9,
              provider: 'huggingface',
              model: settings.model,
              latency_ms: result.result.latency_ms || 0,
              language_detected: result.result.language_detected,
              word_count: (result.result.transcript || result.result.text || '').split(' ').length,
              alternatives: result.result.alternatives
            };

            setLastResult(sttResult);
            onTranscript(sttResult);
          } else {
            throw new Error('No transcript received from HuggingFace STT');
          }
        } catch (error) {
          console.error("[Enhanced STT] Processing error:", error);
          setError(error instanceof Error ? error.message : 'Transcription failed');
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error("[Enhanced STT] Failed to start recording:", error);
      setIsRecording(false);
      
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setError("Microphone permission denied. Please allow microphone access.");
          setShowPermissionUI(true);
        } else if (error.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone.");
        } else if (error.name === "NotReadableError") {
          setError("Microphone is already in use by another application.");
        } else {
          setError(error.message);
        }
      }
    }
  }, [disabled, token, settings, isAudioValid, onTranscript]);

  const stopRecording = useCallback(() => {
    console.log("[Enhanced STT] Stopping recording");

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const handleClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      if (permissions.microphone !== "granted") {
        setShowPermissionUI(true);
        return;
      }
      startRecording();
    }
  }, [isRecording, permissions.microphone, startRecording, stopRecording]);

  const handlePermissionChange = useCallback((newPermissions: MediaPermissionState) => {
    setPermissions(newPermissions);
    if (newPermissions.microphone === "granted" && showPermissionUI) {
      setShowPermissionUI(false);
    }
  }, [showPermissionUI]);

  // Test audio system
  const testAudioSystem = useCallback(async () => {
    try {
      setError('');
      setIsProcessing(true);
      
      const response = await fetch('/api/huggingface/health');
      const health = await response.json();
      
      if (health.success && health.health.agents?.AudioWizard?.status === 'healthy') {
        setError(''); // Clear any previous errors
        // Could add a success message here
      } else {
        setError('Audio system not ready. Please try again in a moment.');
      }
    } catch (error) {
      setError('Failed to test audio system');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, [isRecording, stopRecording]);

  const isButtonDisabled = disabled || isProcessing || !token;

  return (
    <div className={`relative ${className}`}>
      {/* Main Button */}
      <button
        onClick={handleClick}
        disabled={isButtonDisabled}
        className={`
          p-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          ${isRecording
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
          isRecording
            ? "Stop recording (HuggingFace STT)"
            : isProcessing
              ? "Processing with HuggingFace..."
              : "Start voice input (Enhanced STT)"
        }
      >
        {isRecording ? (
          <StopIcon className="h-6 w-6" />
        ) : (
          <MicrophoneIcon
            className={`h-6 w-6 ${isProcessing ? "animate-pulse" : ""}`}
          />
        )}
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white" />
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 bg-blue-500 text-white text-sm rounded shadow-lg whitespace-nowrap">
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            <span>Processing with HuggingFace STT...</span>
          </div>
        </div>
      )}

      {/* Audio Visualizer */}
      {isRecording && streamRef.current && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4">
          <AudioVisualizer
            isRecording={isRecording}
            audioStream={streamRef.current}
            width={250}
            height={50}
            barColor="#ef4444"
            backgroundColor="rgba(0, 0, 0, 0.8)"
            sensitivity={1.5}
          />
        </div>
      )}

      {/* Settings Button */}
      {showAdvancedSettings && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 p-1 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          title="STT Settings"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>
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
              Transcribed {lastResult.word_count} words 
              ({lastResult.confidence > 0.8 ? 'High' : lastResult.confidence > 0.6 ? 'Med' : 'Low'} confidence)
            </span>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">STT Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model
              </label>
              <select
                value={settings.model}
                onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.quality} quality, {model.speed} speed)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ru">Russian</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.enable_confidence}
                  onChange={(e) => setSettings(prev => ({ ...prev, enable_confidence: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable confidence scoring</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.enable_alternatives}
                  onChange={(e) => setSettings(prev => ({ ...prev, enable_alternatives: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Generate alternatives</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.noise_reduction}
                  onChange={(e) => setSettings(prev => ({ ...prev, noise_reduction: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Noise reduction</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.auto_punctuation}
                  onChange={(e) => setSettings(prev => ({ ...prev, auto_punctuation: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Auto punctuation</span>
              </label>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={testAudioSystem}
                disabled={isProcessing}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
              >
                Test Audio System
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Handler */}
      {showPermissionUI && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 w-80">
          <MediaPermissionHandler
            onPermissionChange={handlePermissionChange}
            requiredPermissions={["microphone"]}
            showUI={true}
            autoRequest={false}
          />
        </div>
      )}
    </div>
  );
};