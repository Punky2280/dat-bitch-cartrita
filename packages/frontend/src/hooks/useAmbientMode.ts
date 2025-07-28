import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { setupAmbientAudio } from '../context/modules/AmbientAudio';
import { setupVideoElements, startVideoCapture } from '../context/modules/AmbientVideo';
import { createAudioPlayer, AgentStatus } from '../utils/AudioPlayer';

export const useAmbientMode = (token: string | null) => {
  const [isAmbientMode, setIsAmbientMode] = useState(false);
  const [proactiveAgentStatus, setProactiveAgentStatus] = useState<AgentStatus>('idle');
  
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef(createAudioPlayer(setProactiveAgentStatus));
  const videoElementsRef = useRef<{ video: HTMLVideoElement, canvas: HTMLCanvasElement } | null>(null);

  const startAmbientMode = useCallback(async () => {
    if (!token || isAmbientMode) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      
      const audioRecorder = setupAmbientAudio(stream, (audioData) => {
        socketRef.current?.emit('audio_stream', audioData);
      });
      if (!audioRecorder) throw new Error('Failed to set up ambient audio recorder.');
      mediaRecorderRef.current = audioRecorder;

      const { video, canvas } = setupVideoElements();
      videoElementsRef.current = { video, canvas };
      videoIntervalRef.current = startVideoCapture(video, canvas, stream, (frame) => {
        socketRef.current?.emit('video_frame', frame);
      });

      const newSocket = io(`${import.meta.env.VITE_API_BASE_URL}/ambient`, { auth: { token } });

      newSocket.on('connect', () => setIsAmbientMode(true));
      newSocket.on('disconnect', () => setIsAmbientMode(false));
      newSocket.on('proactive_audio', ({ audio }) => audioPlayerRef.current.addToQueue(audio));

      socketRef.current = newSocket;

    } catch (error) {
      console.error('Error starting ambient mode:', error);
      alert('Could not start ambient mode. Please ensure microphone and camera permissions are granted.');
      // Clean up any partial setup
      mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
    }
  }, [token, isAmbientMode]);

  const stopAmbientMode = useCallback(() => {
    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
    mediaRecorderRef.current?.stop();
    
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    
    // Clean up video elements from the DOM
    if (videoElementsRef.current) {
      document.body.removeChild(videoElementsRef.current.video);
      document.body.removeChild(videoElementsRef.current.canvas);
      videoElementsRef.current = null;
    }
    
    socketRef.current?.disconnect();

    setIsAmbientMode(false);
    setProactiveAgentStatus('idle');
  }, []);

  useEffect(() => {
    return () => stopAmbientMode(); // Cleanup on unmount
  }, [stopAmbientMode]);

  return {
    isAmbientMode,
    proactiveAgentStatus,
    startAmbientMode,
    stopAmbientMode,
  };
};