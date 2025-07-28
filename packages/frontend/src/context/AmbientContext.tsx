// packages/frontend/src/context/AmbientContext.tsx
import React, { createContext, useState, useContext, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// --- Types ---
type PermissionState = 'prompt' | 'granted' | 'denied';

interface AmbientContextType {
  isAmbientModeEnabled: boolean;
  permissionState: PermissionState;
  enableAmbientMode: (token: string) => Promise<void>;
  disableAmbientMode: () => void;
}

// --- Context Definition ---
const AmbientContext = createContext<AmbientContextType | undefined>(undefined);

// --- Provider Component ---
export const AmbientProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAmbientModeEnabled, setIsAmbientModeEnabled] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  
  // Refs to hold persistent objects without causing re-renders
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const ambientSocketRef = useRef<Socket | null>(null);

  const enableAmbientMode = async (token: string) => {
    if (streamRef.current) return;

    try {
      console.log('[AmbientContext] Requesting media permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false, // We only need audio for now
      });
      
      console.log('[AmbientContext] Permissions granted.');
      streamRef.current = stream;
      setPermissionState('granted');
      setIsAmbientModeEnabled(true);

      // Connect to the dedicated /ambient namespace
      const ambientSocket = io('/ambient', { auth: { token } });
      ambientSocketRef.current = ambientSocket;

      ambientSocket.on('connect', () => {
        console.log('[AmbientSocket] Connected to /ambient namespace.');
        
        // Start recording and streaming
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            ambientSocket.emit('audio_stream', event.data);
          }
        });
        // Send audio data every 250ms
        mediaRecorderRef.current.start(250); 
      });

      ambientSocket.on('disconnect', () => {
        console.log('[AmbientSocket] Disconnected from /ambient namespace.');
      });

    } catch (error) {
      console.error('[AmbientContext] Media permissions denied:', error);
      setPermissionState('denied');
      setIsAmbientModeEnabled(false);
    }
  };

  const disableAmbientMode = () => {
    // Stop the media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    // Disconnect the ambient socket
    if (ambientSocketRef.current) {
      ambientSocketRef.current.disconnect();
      ambientSocketRef.current = null;
    }
    // Stop the media stream tracks
    if (streamRef.current) {
      console.log('[AmbientContext] Stopping all media tracks.');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
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

// --- Custom Hook ---
export const useAmbient = (): AmbientContextType => {
  const context = useContext(AmbientContext);
  if (context === undefined) {
    throw new Error('useAmbient must be used within an AmbientProvider');
  }
  return context;
};
