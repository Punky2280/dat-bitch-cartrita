import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useRef,
  useCallback
} from 'react';

import { setupAmbientAudio } from './modules/AmbientAudio';
import { setupVideoElements, startVideoCapture } from './modules/AmbientVideo';
import { connectAmbientSocket } from './modules/AmbientSocket';

type PermissionState = 'prompt' | 'granted' | 'denied';

interface AmbientContextType {
  isAmbientModeEnabled: boolean;
  permissionState: PermissionState;
  enableAmbientMode: (token: string) => Promise<void>;
  disableAmbientMode: () => void;
  error: string | null;
  hasAudio: boolean;
  hasVideo: boolean;
}

const AmbientContext = createContext<AmbientContextType | undefined>(undefined);

function AmbientProvider({ children }: { children: ReactNode }) {
  const [isAmbientModeEnabled, setIsAmbientModeEnabled] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const ambientSocketRef = useRef<ReturnType<typeof connectAmbientSocket> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const enableAmbientMode = async (token: string) => {
    if (streamRef.current) return;
    setError(null);

    try {
      console.log('[AmbientProvider] Requesting media permissions...');
      
      // Request permissions with fallback
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
      } catch (e) {
        console.warn('[AmbientProvider] Failed to get both audio and video, trying video only...');
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            }
          });
          setError('Microphone access denied. Video only mode.');
        } catch (e2) {
          throw new Error('Camera and microphone access denied');
        }
      }

      console.log('[AmbientProvider] Permissions granted.');
      streamRef.current = stream;
      setPermissionState('granted');
      
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      setHasAudio(audioTracks.length > 0);
      setHasVideo(videoTracks.length > 0);
      
      console.log(`[AmbientProvider] Tracks - Audio: ${audioTracks.length}, Video: ${videoTracks.length}`);

      const ambientSocket = connectAmbientSocket(token);
      ambientSocketRef.current = ambientSocket;

      // Setup audio with error handling
      if (audioTracks.length > 0) {
        try {
          mediaRecorderRef.current = setupAmbientAudio(stream, (buffer) => {
            ambientSocket.emit('audio_stream', buffer);
          });
          if (!mediaRecorderRef.current) {
            console.error('[AmbientProvider] Audio recorder setup returned null');
            setError('Audio recording failed. Video will still work.');
          }
        } catch (audioError) {
          console.error('[AmbientProvider] Audio setup error:', audioError);
          setError('Audio recording failed. Video will still work.');
        }
      }

      // Setup video
      if (videoTracks.length > 0) {
        const { video, canvas } = setupVideoElements();
        videoRef.current = video;
        canvasRef.current = canvas;

        videoIntervalRef.current = startVideoCapture(
          video,
          canvas,
          stream,
          (blob) => ambientSocket.emit('video_frame', blob)
        );
      }

      setIsAmbientModeEnabled(true);

    } catch (error) {
      console.error('[AmbientProvider] Setup failed:', error);
      setPermissionState('denied');
      setIsAmbientModeEnabled(false);
      setError(error instanceof Error ? error.message : 'Setup failed');
      
      // Clean up any partial setup
      disableAmbientMode();
    }
  };

  const disableAmbientMode = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    ambientSocketRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(track => track.stop());
    videoIntervalRef.current && clearInterval(videoIntervalRef.current);

    if (videoRef.current?.parentNode) {
      videoRef.current.parentNode.removeChild(videoRef.current);
    }
    if (canvasRef.current?.parentNode) {
      canvasRef.current.parentNode.removeChild(canvasRef.current);
    }

    mediaRecorderRef.current = null;
    ambientSocketRef.current = null;
    streamRef.current = null;
    videoRef.current = null;
    canvasRef.current = null;
    videoIntervalRef.current = null;

    setIsAmbientModeEnabled(false);
    setHasAudio(false);
    setHasVideo(false);
    setError(null);
  }, []);

  const value = {
    isAmbientModeEnabled,
    permissionState,
    enableAmbientMode,
    disableAmbientMode,
    error,
    hasAudio,
    hasVideo,
  };

  return (
    <AmbientContext.Provider value={value}>
      {children}
    </AmbientContext.Provider>
  );
}

function useAmbient(): AmbientContextType {
  const context = useContext(AmbientContext);
  if (!context) {
    throw new Error('useAmbient must be used within an AmbientProvider');
  }
  return context;
}

export { AmbientProvider, useAmbient };
