import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useRef
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
}

const AmbientContext = createContext<AmbientContextType | undefined>(undefined);

export const AmbientProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAmbientModeEnabled, setIsAmbientModeEnabled] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const ambientSocketRef = useRef<ReturnType<typeof connectAmbientSocket> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const enableAmbientMode = async (token: string) => {
    if (streamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      streamRef.current = stream;
      setPermissionState('granted');
      setIsAmbientModeEnabled(true);

      const ambientSocket = connectAmbientSocket(token);
      ambientSocketRef.current = ambientSocket;

      mediaRecorderRef.current = setupAmbientAudio(stream, (buffer) => {
        ambientSocket.emit('audio_stream', buffer);
      });

      const { video, canvas } = setupVideoElements();
      videoRef.current = video;
      canvasRef.current = canvas;

      videoIntervalRef.current = startVideoCapture(
        video,
        canvas,
        stream,
        (blob) => ambientSocket.emit('video_frame', blob)
      );

    } catch (error) {
      console.error('[AmbientProvider] Media permissions denied:', error);
      setPermissionState('denied');
      setIsAmbientModeEnabled(false);
    }
  };

  const disableAmbientMode = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    ambientSocketRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(track => track.stop());
    videoIntervalRef.current && clearInterval(videoIntervalRef.current);

    if (videoRef.current?.parentNode) {
      videoRef.current.parentNode.removeChild(videoRef.current);
    }

    mediaRecorderRef.current = null;
    ambientSocketRef.current = null;
    streamRef.current = null;
    videoRef.current = null;
    canvasRef.current = null;
    videoIntervalRef.current = null;

    setIsAmbientModeEnabled(false);
  };

  const value = {
    isAmbientModeEnabled,
    permissionState,
    enableAmbientMode,
    disableAmbientMode,
  };

  return (
    <AmbientContext.Provider value={value}>
      {children}
    </AmbientContext.Provider>
  );
};

export const useAmbient = (): AmbientContextType => {
  const context = useContext(AmbientContext);
  if (!context) {
    throw new Error('useAmbient must be used within an AmbientProvider');
  }
  return context;
};
