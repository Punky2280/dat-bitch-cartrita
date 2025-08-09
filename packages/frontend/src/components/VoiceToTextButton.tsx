import React, { useState, useRef, useEffect } from "react";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/24/outline";
import {
  checkMediaSupport,
  getOptimalAudioConstraints,
  getSupportedMimeType,
  logMediaDeviceInfo,
} from "@/utils/mediaUtils";
import { API_BASE_URL } from "../config/constants";
import { AudioVisualizer } from "./AudioVisualizer";
import {
  MediaPermissionHandler,
  MediaPermissionState,
} from "./MediaPermissionHandler";

interface VoiceToTextButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  token?: string;
}

export const VoiceToTextButton: React.FC<VoiceToTextButtonProps> = ({
  onTranscript,
  disabled = false,
  token,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissions, setPermissions] = useState<MediaPermissionState>({
    microphone: "unknown",
    camera: "unknown",
  });
  const [showPermissionUI, setShowPermissionUI] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 🔍 Preflight ambient volume check with lower threshold
  async function isAudioValid(blob: Blob): Promise<boolean> {
    try {
      const ctx = new AudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);

      const data = buffer.getChannelData(0);
      const avg =
        data.reduce((acc, val) => acc + Math.abs(val), 0) / data.length;

      // Find max value efficiently without spread operator
      let max = 0;
      for (let i = 0; i < data.length; i++) {
        const absVal = Math.abs(data[i]);
        if (absVal > max) {
          max = absVal;
        }
      }

      console.log(
        "[VoiceToText] Audio analysis - Avg volume:",
        avg.toFixed(6),
        "Max volume:",
        max.toFixed(6),
      );

      // More lenient threshold - if there's any significant audio activity
      return avg > 0.001 || max > 0.01;
    } catch (error) {
      console.error("[VoiceToText] Audio validation error:", error);
      return true; // If we can't validate, assume it's valid
    }
  }

  const startRecording = async () => {
    if (disabled || !token) return;

    try {
      console.log("[VoiceToText] Starting recording");

      // Check media support
      const support = checkMediaSupport();
      if (!support.isSupported) {
        console.error("[VoiceToText] Media support issues:", support.issues);
        throw new Error(`Media not supported: ${support.issues.join(", ")}`);
      }

      // Log available devices for debugging
      await logMediaDeviceInfo();

      // Request permissions with optimal settings
      const audioConstraints = getOptimalAudioConstraints();
      console.log("[VoiceToText] Audio constraints:", audioConstraints);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      console.log("[VoiceToText] Microphone access granted");
      console.log(
        "[VoiceToText] Audio tracks:",
        stream.getAudioTracks().length,
      );

      // Check if audio tracks are active
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks available");
      }

      audioTracks.forEach((track, index) => {
        console.log(
          `[VoiceToText] Track ${index}:`,
          track.label,
          "enabled:",
          track.enabled,
          "readyState:",
          track.readyState,
        );
      });

      streamRef.current = stream;
      audioChunksRef.current = [];
      setIsRecording(true);

      // Use optimal MIME type
      const mimeType = getSupportedMimeType();
      console.log("[VoiceToText] Using MIME type:", mimeType || "default");

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("[VoiceToText] Recording stopped, processing...");
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          console.log(
            "[VoiceToText] Audio blob created:",
            audioBlob.size,
            "bytes",
          );

          const isValid = await isAudioValid(audioBlob);
          if (!isValid) {
            console.warn(
              "[VoiceToText] Skipping transcription — audio appears silent",
            );
            console.warn(
              "[VoiceToText] Try speaking louder or closer to the microphone",
            );
            alert(
              "No speech detected in your recording. Please speak louder and closer to the microphone, then try again.",
            );
            return;
          }

          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          console.log("[VoiceToText] FormData created, sending request...");

          const response = await fetch(
            `${API_BASE_URL}/api/voice-to-text/transcribe`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            },
          );

          console.log(
            "[VoiceToText] Response received:",
            response.status,
            response.statusText,
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[VoiceToText] Error response:", errorText);
            throw new Error(
              `Transcription failed: ${response.status} ${response.statusText} - ${errorText}`,
            );
          }

          const result = await response.json();
          console.log("[VoiceToText] Transcription result:", result);

          if (result.transcript) {
            console.log(
              "[VoiceToText] Transcription successful:",
              result.transcript,
            );
            onTranscript(result.transcript);
          } else {
            console.warn("[VoiceToText] No transcript received");
          }
        } catch (error) {
          console.error("[VoiceToText] Transcription error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          alert(`Failed to transcribe speech: ${errorMessage}`);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error("[VoiceToText] Failed to start recording:", error);
      setIsRecording(false);

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          alert(
            "Microphone permission was denied. Please allow microphone access in your browser settings and try again.",
          );
        } else if (error.name === "NotFoundError") {
          alert(
            "No microphone found. Please connect a microphone and try again.",
          );
        } else if (error.name === "NotReadableError") {
          alert(
            "Microphone is already in use by another application. Please close other applications using the microphone and try again.",
          );
        } else {
          alert(`Failed to start voice recording: ${error.message}`);
        }
      } else {
        alert("Failed to start voice recording. Please try again.");
      }
    }
  };

  const stopRecording = () => {
    console.log("[VoiceToText] Stopping recording");

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Check permissions before starting recording
      if (permissions.microphone !== "granted") {
        setShowPermissionUI(true);
        return;
      }
      startRecording();
    }
  };

  const handlePermissionChange = (newPermissions: MediaPermissionState) => {
    setPermissions(newPermissions);

    // Auto-hide permission UI if microphone access is granted
    if (newPermissions.microphone === "granted" && showPermissionUI) {
      setShowPermissionUI(false);
    }
  };

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  const isButtonDisabled = disabled || isProcessing || !token;

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isButtonDisabled}
        className={`
          p-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
          ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500"
              : isProcessing
                ? "bg-blue-500 text-white animate-pulse"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600 focus:ring-blue-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
          }
          ${
            isButtonDisabled
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer"
          }
        `}
        title={
          isRecording
            ? "Stop recording"
            : isProcessing
              ? "Processing..."
              : "Start voice input"
        }
      >
        {isRecording ? (
          <StopIcon className="h-5 w-5" />
        ) : (
          <MicrophoneIcon
            className={`h-5 w-5 ${isProcessing ? "animate-pulse" : ""}`}
          />
        )}
      </button>

      {isProcessing && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-blue-500 text-white text-xs rounded shadow-lg whitespace-nowrap">
          Processing...
        </div>
      )}

      {isRecording && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
      )}

      {/* Audio Visualizer - shown when recording */}
      {isRecording && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4">
          <AudioVisualizer
            isRecording={isRecording}
            audioStream={streamRef.current}
            width={200}
            height={40}
            barColor="#ef4444"
            backgroundColor="rgba(0, 0, 0, 0.8)"
            sensitivity={1.2}
          />
        </div>
      )}

      {/* Permission Handler - shown when permissions are needed */}
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
