import React, { useState, useEffect, useRef } from "react";
import {
  MicrophoneIcon,
  StopIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import FloatingMediaOverlay from "./ui/FloatingMediaOverlay";
import api from "../services/apiService";

interface LiveChatButtonProps {
  token: string;
  onActivate?: (mode: "voice" | "text" | "multimodal") => void;
  className?: string;
}

interface LiveChatState {
  isActive: boolean;
  mode: "voice" | "text" | "multimodal" | null;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  wakeWordDetected: boolean;
  sentiment?: {
    emotion: string;
    confidence: number;
    valence: number; // -1 to 1 (negative to positive)
  };
  contextAwareness: {
    backgroundAnalysis: boolean;
    visualContext: boolean;
    emotionalContext: boolean;
  };
  adaptiveResponse: {
    responseStyle: 'empathetic' | 'analytical' | 'casual' | 'professional';
    responseLength: 'brief' | 'moderate' | 'detailed';
  };
}

export const LiveChatButton: React.FC<LiveChatButtonProps> = ({
  token,
  onActivate,
  className = "",
}) => {
  const [chatState, setChatState] = useState<LiveChatState>({
    isActive: false,
    mode: null,
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    currentTranscript: "",
    wakeWordDetected: false,
    contextAwareness: {
      backgroundAnalysis: false,
      visualContext: false,
      emotionalContext: false,
    },
    adaptiveResponse: {
      responseStyle: 'casual',
      responseLength: 'moderate',
    },
  });

  const [showModeSelector, setShowModeSelector] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null,
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioOnlyStream, setAudioOnlyStream] = useState<MediaStream | null>(
    null,
  );
  const [showOverlay, setShowOverlay] = useState(false);
  const currentAudioMime = useRef<string | undefined>(undefined);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (audioOnlyStream) {
        audioOnlyStream.getTracks().forEach((track) => track.stop());
      }
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };
  }, [stream, audioOnlyStream, mediaRecorder]);

  const startLiveChat = async (mode: "voice" | "text" | "multimodal") => {
    try {
      setChatState((prev) => ({ ...prev, isProcessing: true }));

      if (mode === "voice" || mode === "multimodal") {
        // If any previous stream/recorder exists, stop them to avoid device busy
        if (stream) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        }
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          try { mediaRecorder.stop(); } catch (_) {}
        }
        // Check if getUserMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Media devices not supported in this browser");
        }

        console.log(`[LiveChatButton] Requesting ${mode} permissions...`);

        // Request microphone permission with better audio settings
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // Less aggressive noise suppression
            autoGainControl: true,
            sampleRate: 44100,
          },
        };

        // Add video constraints for multimodal
        if (mode === "multimodal") {
          constraints.video = {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 15, min: 10 },
          };
        }

        console.log("[LiveChatButton] Media constraints:", constraints);
        const mediaStream =
          await navigator.mediaDevices.getUserMedia(constraints);

  console.log("[LiveChatButton] Media access granted");
        console.log(
          "[LiveChatButton] Audio tracks:",
          mediaStream.getAudioTracks().length,
        );
        console.log(
          "[LiveChatButton] Video tracks:",
          mediaStream.getVideoTracks().length,
        );

  // Defer setting stream/overlay until recorder starts successfully

        // Validate stream and pick supported mime type
        if (!mediaStream || mediaStream.getTracks().length === 0) {
          throw new Error("Invalid or inactive MediaStream");
        }
        // Build dedicated audio-only stream for recording to avoid recorder errors when video is also present
        const audioStream = new MediaStream(mediaStream.getAudioTracks());
        let selectedMime: string | undefined = undefined;
        const audioPreferred = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/ogg",
        ];
        for (const mt of audioPreferred) {
          if ((window as any).MediaRecorder?.isTypeSupported?.(mt)) {
            selectedMime = mt;
            break;
          }
        }
        const recorder = new MediaRecorder(
          audioStream,
          selectedMime ? { mimeType: selectedMime } : undefined,
        );
        currentAudioMime.current = selectedMime || "audio/webm";

        let audioChunks: Blob[] = [];

        recorder.onerror = (e: any) => {
          console.error("[LiveChatButton] MediaRecorder error:", e?.error || e);
        };
        recorder.onstart = () => {
          console.log("[LiveChatButton] MediaRecorder started with", selectedMime || "(browser default)");
        };
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);

            // Keep only recent chunks for wake word detection
            if (audioChunks.length > 10) {
              audioChunks = audioChunks.slice(-10);
            }

            // Check for wake word periodically
            if (audioChunks.length >= 2) {
              checkForWakeWord(audioChunks.slice(-2), currentAudioMime.current);
            }
          }
        };

        try {
          recorder.start(500); // Collect data every 500ms
        } catch (e: any) {
          console.error("[LiveChatButton] Failed to start MediaRecorder:", e?.message || e);
          // Ensure camera/mic are turned off on failure
          try { audioStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
          try { mediaStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
          throw e;
        }
        setMediaRecorder(recorder);
        setAudioOnlyStream(audioStream);
        setStream(mediaStream);
        setShowOverlay(mode === "multimodal");
      }

      setChatState((prev) => ({
        ...prev,
        isActive: true,
        mode: mode,
        isListening: mode !== "text",
        isProcessing: false,
      }));

      if (onActivate) {
        onActivate(mode);
      }

      setShowModeSelector(false);

      // Play activation sound/message
      await playActivationMessage(mode);
    } catch (error) {
      console.error("[LiveChatButton] Failed to start live chat:", error);
      setChatState((prev) => ({ ...prev, isProcessing: false }));
  // Defensive teardown on partial start so camera doesn't persist
  try { mediaRecorder && mediaRecorder.state !== "inactive" && mediaRecorder.stop(); } catch (_) {}
  try { audioOnlyStream && audioOnlyStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
  try { stream && stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
  setMediaRecorder(null);
  setAudioOnlyStream(null);
  setStream(null);
  setShowOverlay(false);

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          alert(
            "Camera/microphone permission was denied. Please allow access in your browser settings and try again.",
          );
        } else if (error.name === "NotFoundError") {
          alert(
            "No camera or microphone found. Please connect the required devices and try again.",
          );
        } else if (error.name === "NotReadableError") {
          alert(
            "Camera or microphone is already in use by another application. Please close other applications and try again.",
          );
        } else {
          alert(`Failed to start live chat: ${error.message}`);
        }
      } else {
        alert(
          "Failed to start live chat. Please check your permissions and try again.",
        );
      }
    }
  };

  const stopLiveChat = async () => {
    try {
      setChatState((prev) => ({ ...prev, isProcessing: true }));

  if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      if (audioOnlyStream) {
        audioOnlyStream.getTracks().forEach((track) => track.stop());
        setAudioOnlyStream(null);
      }

      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        setMediaRecorder(null);
      }

  setChatState({
        isActive: false,
        mode: null,
        isListening: false,
        isProcessing: false,
        isSpeaking: false,
        currentTranscript: "",
        wakeWordDetected: false,
        contextAwareness: {
          backgroundAnalysis: false,
          visualContext: false,
          emotionalContext: false,
        },
        adaptiveResponse: {
          responseStyle: 'casual',
          responseLength: 'moderate',
        },
      });
  setShowOverlay(false);

      await playDeactivationMessage();
    } catch (error) {
      console.error("[LiveChatButton] Error stopping live chat:", error);
      setChatState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const checkForWakeWord = async (audioChunks: Blob[], mime?: string) => {
    if (chatState.wakeWordDetected) return;

    try {
      const audioBlob = new Blob(audioChunks, { type: mime || "audio/webm" });

      if (audioBlob.size < 1000) return; // Too small to analyze

      const formData = new FormData();
      formData.append("audio", audioBlob, "wake-check.webm");

      const response = await api.postFormData(
        "/api/voice-to-text/transcribe",
        formData
      );

      if (response.success) {
        const result = response.data;

        if (result.wakeWord && result.wakeWord.detected) {
          console.log(
            "[LiveChatButton] Wake word detected:",
            result.wakeWord.wakeWord,
          );
          setChatState((prev) => ({
            ...prev,
            wakeWordDetected: true,
            currentTranscript: result.wakeWord.cleanTranscript || "",
          }));

          // Activate voice mode and process command
          await activateVoiceMode(result.wakeWord.cleanTranscript);
        }
      }
    } catch (error) {
      console.error("[LiveChatButton] Wake word detection error:", error);
    }
  };

  // Hide overlay if user stops camera from browser UI or track ends
  useEffect(() => {
    if (!stream) return;
    const onEnded = () => setShowOverlay(false);
    const vids = stream.getVideoTracks();
    vids.forEach((t) => t.addEventListener("ended", onEnded));
    return () => {
      vids.forEach((t) => t.removeEventListener("ended", onEnded));
    };
  }, [stream]);

  const activateVoiceMode = async (initialCommand?: string) => {
    try {
      setChatState((prev) => ({ ...prev, wakeWordDetected: true }));

      // Play acknowledgment
      await speakResponse("Hey! I'm here, what's up?");

      // Process initial command if provided
      if (initialCommand && initialCommand.trim()) {
        setTimeout(() => {
          processVoiceCommand(initialCommand);
        }, 1500);
      }
    } catch (error) {
      console.error("[LiveChatButton] Error activating voice mode:", error);
    }
  };

  const processVoiceCommand = async (command: string) => {
    try {
      setChatState((prev) => ({
        ...prev,
        isProcessing: true,
        currentTranscript: command,
      }));

      // Send to your chat API for processing
      const response = await api.post("/api/chat", {
        message: command,
        mode: "voice",
      });

      if (response.success) {
        const result = response.data;

        // Speak the response
        if (result.response) {
          await speakResponse(result.response);
        }
      }
    } catch (error) {
      console.error("[LiveChatButton] Error processing voice command:", error);
      await speakResponse("Sorry, I had trouble with that. Can you try again?");
    } finally {
      setChatState((prev) => ({
        ...prev,
        isProcessing: false,
        wakeWordDetected: false,
        currentTranscript: "",
      }));
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setChatState((prev) => ({ ...prev, isSpeaking: true }));

      const response = await api.post(
        "/api/voice-chat/speak",
        {
          text: text,
          voice: "nova",
          speed: 1.0,
        },
        { responseType: "blob" }
      );

      if (response.success) {
        const audioBuffer = await response.data.arrayBuffer();
        const audioContext = new AudioContext();
        const audioData = await audioContext.decodeAudioData(audioBuffer);
        const source = audioContext.createBufferSource();

        source.buffer = audioData;
        source.connect(audioContext.destination);

        source.onended = () => {
          setChatState((prev) => ({ ...prev, isSpeaking: false }));
        };

        source.start();
      }
    } catch (error) {
      console.error("[LiveChatButton] Error speaking response:", error);
      setChatState((prev) => ({ ...prev, isSpeaking: false }));
    }
  };

  const playActivationMessage = async (
    mode: "voice" | "text" | "multimodal",
  ) => {
    const messages = {
      voice: "Voice chat activated! Say 'Cartrita' to get my attention!",
      text: "Live text chat is ready!",
      multimodal:
        "Multi-modal mode activated! I can see, hear, and chat with you!",
    };

    if (mode !== "text") {
      await speakResponse(messages[mode]);
    }
  };

  const playDeactivationMessage = async () => {
    if (chatState.mode !== "text") {
      await speakResponse("Live chat deactivated. See you later!");
    }
  };

  const toggleModeSelector = () => {
    if (chatState.isActive) {
      stopLiveChat();
    } else {
      setShowModeSelector(!showModeSelector);
    }
  };

  const getButtonClass = () => {
    const baseClass = `relative p-4 rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 ${className}`;

    if (chatState.isActive) {
      if (chatState.wakeWordDetected) {
        return `${baseClass} bg-purple-500 hover:bg-purple-600 text-white focus:ring-purple-500 shadow-lg animate-pulse`;
      } else if (chatState.mode === "multimodal") {
        return `${baseClass} bg-green-500 hover:bg-green-600 text-white focus:ring-green-500`;
      } else if (chatState.mode === "voice") {
        return `${baseClass} bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500`;
      } else {
        return `${baseClass} bg-gray-500 hover:bg-gray-600 text-white focus:ring-gray-500`;
      }
    } else {
      return `${baseClass} bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white focus:ring-cyan-500 transform hover:scale-105`;
    }
  };

  const getButtonIcon = () => {
    if (chatState.isProcessing) {
      return (
        <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
      );
    }

    if (chatState.isActive) {
      return <StopIcon className="h-8 w-8" />;
    }

    return <SparklesIcon className="h-8 w-8" />;
  };

  const getStatusIndicator = () => {
    if (chatState.wakeWordDetected) {
      return (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-400 rounded-full animate-pulse" />
      );
    }
    if (chatState.isSpeaking) {
      return (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full animate-pulse" />
      );
    }
    if (chatState.isListening) {
      return (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
      );
    }
    return null;
  };

  return (
    <div className="relative">
      {/* Floating video overlay for multimodal */}
      <FloatingMediaOverlay
        stream={stream}
        visible={showOverlay}
        position="center"
        onClose={() => setShowOverlay(false)}
      />
      {/* Main Button */}
      <button
        onClick={toggleModeSelector}
        disabled={chatState.isProcessing}
        className={getButtonClass()}
        title={chatState.isActive ? "Stop Live Chat" : "Start Live Chat"}
      >
        {getButtonIcon()}
        {getStatusIndicator()}
      </button>

      {/* Mode Selector */}
      {showModeSelector && !chatState.isActive && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-2 min-w-48">
          <div className="text-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Choose Mode
          </div>

          <div className="space-y-1">
            <button
              onClick={() => startLiveChat("text")}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-500" />
              <span>Text Chat</span>
            </button>

            <button
              onClick={() => startLiveChat("voice")}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm"
            >
              <MicrophoneIcon className="h-4 w-4 text-blue-500" />
              <span>Voice Chat</span>
            </button>

            <button
              onClick={() => startLiveChat("multimodal")}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm"
            >
              <VideoCameraIcon className="h-4 w-4 text-green-500" />
              <span>Iteration 21 (Voice + Camera)</span>
            </button>
          </div>
        </div>
      )}

      {/* Status Display */}
      {chatState.isActive && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
          {chatState.wakeWordDetected && "Voice Activated"}
          {chatState.isSpeaking && !chatState.wakeWordDetected && "Speaking"}
          {chatState.isListening &&
            !chatState.wakeWordDetected &&
            !chatState.isSpeaking &&
            `Listening (${chatState.mode})`}
          {chatState.currentTranscript && (
            <div className="mt-1 italic">{chatState.currentTranscript}</div>
          )}
        </div>
      )}

      {/* Wake Word Instruction */}
      {chatState.isActive &&
        chatState.mode !== "text" &&
        !chatState.wakeWordDetected && (
          <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 text-xs rounded px-3 py-2 text-center whitespace-nowrap">
            💡 Say <strong>"Cartrita!"</strong> to activate
          </div>
        )}
    </div>
  );
};

export default LiveChatButton;
