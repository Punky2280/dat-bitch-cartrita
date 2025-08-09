import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useRef,
} from "react";
import { io, Socket } from "socket.io-client";

type PermissionState = "prompt" | "granted" | "denied";

interface AmbientSettings {
  audioEnabled: boolean;
  videoEnabled: boolean;
  proactiveResponses: boolean;
  privacyMode: "standard" | "enhanced";
}

interface AmbientContextType {
  isAmbientModeEnabled: boolean;
  permissionState: PermissionState;
  settings: AmbientSettings;
  enableAmbientMode: (
    token: string,
    options?: Partial<AmbientSettings>,
  ) => Promise<void>;
  disableAmbientMode: () => void;
  updateSettings: (newSettings: Partial<AmbientSettings>) => void;
}

const defaultSettings: AmbientSettings = {
  audioEnabled: true,
  videoEnabled: false,
  proactiveResponses: true,
  privacyMode: "standard",
};

const AmbientContext = createContext<AmbientContextType | undefined>(undefined);
export const AmbientProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const [settings, setSettings] = useState<AmbientSettings>(defaultSettings);

  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const videoProcessorRef = useRef<NodeJS.Timeout | null>(null);

  const setupAudioProcessing = (socket: Socket, stream: MediaStream) => {
    try {
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          socket.emit("audio_stream", event.data);
        }
      });

      recorder.addEventListener("error", (event) => {
        console.error("[AudioRecorder] Error:", event);
      });

      recorder.start(250); // Send audio chunks every 250ms
      console.log("[AudioRecorder] Started");
    } catch (error) {
      console.error("[AudioRecorder] Setup failed:", error);
    }
  };

  const setupVideoProcessing = (socket: Socket, stream: MediaStream) => {
    try {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        console.error("[VideoProcessor] Failed to get canvas context");
        return;
      }

      video.srcObject = stream;
      video.play();

      video.addEventListener("loadedmetadata", () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Process frames at 1 FPS for privacy and performance
        const processFrame = () => {
          if (!isEnabled) return;

          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  socket.emit("video_frame", blob);
                }
              },
              "image/jpeg",
              0.3,
            ); // Low quality for privacy
          } catch (error) {
            console.error("[VideoProcessor] Frame processing error:", error);
          }
        };

        videoProcessorRef.current = setInterval(processFrame, 1000); // 1 FPS
        console.log("[VideoProcessor] Started at 1 FPS");
      });
    } catch (error) {
      console.error("[VideoProcessor] Setup failed:", error);
    }
  };

  const enable = async (
    token: string,
    options: Partial<AmbientSettings> = {},
  ) => {
    if (isEnabled) return;

    const effectiveSettings = { ...settings, ...options };
    setSettings(effectiveSettings);

    try {
      // Request appropriate permissions based on settings
      const constraints: MediaStreamConstraints = {
        audio: effectiveSettings.audioEnabled,
        video: effectiveSettings.videoEnabled
          ? { width: 640, height: 480, frameRate: 5 }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (effectiveSettings.audioEnabled) {
        audioStreamRef.current = stream;
      }
      if (effectiveSettings.videoEnabled) {
        videoStreamRef.current = stream;
      }

      setPermission("granted");
      setIsEnabled(true);

      // Connect to ambient socket
      const socket = io("/ambient", {
        auth: { token },
        query: {
          audioEnabled: effectiveSettings.audioEnabled,
          videoEnabled: effectiveSettings.videoEnabled,
          privacyMode: effectiveSettings.privacyMode,
        },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log(
          "[AmbientSocket] Connected with settings:",
          effectiveSettings,
        );

        // Setup audio processing
        if (effectiveSettings.audioEnabled && audioStreamRef.current) {
          setupAudioProcessing(socket, audioStreamRef.current);
        }

        // Setup video processing
        if (effectiveSettings.videoEnabled && videoStreamRef.current) {
          setupVideoProcessing(socket, videoStreamRef.current);
        }
      });

      socket.on("disconnect", () => {
        console.log("[AmbientSocket] Disconnected");
      });
    } catch (err) {
      console.error("[AmbientContext] Permission denied or error:", err);
      setPermission("denied");
      setIsEnabled(false);
    }
  };
  const disable = () => {
    console.log("[AmbientContext] Disabling ambient mode");

    // Stop video processing
    if (videoProcessorRef.current) {
      clearInterval(videoProcessorRef.current);
      videoProcessorRef.current = null;
    }

    // Stop audio recording
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Stop all media streams
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }

    setIsEnabled(false);
  };

  const updateSettings = (newSettings: Partial<AmbientSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));

    // If ambient mode is currently enabled, restart with new settings
    if (isEnabled && socketRef.current) {
      // Store current token for restart
      socketRef.current;
      disable();
      setTimeout(() => {
        // We'll need to get the token from the parent component for restart
        console.log("[AmbientContext] Settings updated, restart required");
      }, 100);
    }
  };

  return (
    <AmbientContext.Provider
      value={{
        isAmbientModeEnabled: isEnabled,
        permissionState: permission,
        settings,
        enableAmbientMode: enable,
        disableAmbientMode: disable,
        updateSettings,
      }}
    >
      {children}
    </AmbientContext.Provider>
  );
};
export const useAmbient = (): AmbientContextType => {
  const context = useContext(AmbientContext);
  if (!context)
    throw new Error("useAmbient must be used within an AmbientProvider");
  return context;
};
