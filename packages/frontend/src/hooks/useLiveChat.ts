import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { setupAmbientAudio } from '../context/modules/AmbientAudio';
import { createAudioPlayer, AgentStatus } from '../utils/AudioPlayer';

export const useLiveChat = (token: string | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [agentTranscript, setAgentTranscript] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioPlayerRef = useRef(
    createAudioPlayer(setAgentStatus)
  );

  const handleLiveTranscript = useCallback(({ text, is_final }: { text: string; is_final: boolean }) => {
    setUserTranscript(text);
    if (is_final && text.trim()) {
      setAgentStatus('thinking');
      setAgentTranscript(''); // Clear previous agent response, wait for new one
    }
  }, []);
  
  const startLiveChat = useCallback(async () => {
    if (!token || isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recorder = setupAmbientAudio(stream, (audioData) => {
        socketRef.current?.emit('audio_stream', audioData);
      });

      if (!recorder) {
        console.error('Failed to set up media recorder for live chat.');
        return;
      }
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      const newSocket = io(`${import.meta.env.VITE_API_BASE_URL}/live-chat`, {
        auth: { token },
      });

      newSocket.on('connect', () => setIsConnected(true));
      newSocket.on('disconnect', () => setIsConnected(false));

      newSocket.on('live_transcript', handleLiveTranscript);
      newSocket.on('live_response_text', (response) => setAgentTranscript(response.text || ''));
      newSocket.on('live_response_audio', ({ audio }) => audioPlayerRef.current.addToQueue(audio));

      socketRef.current = newSocket;

    } catch (error) {
      console.error('Error starting live chat:', error);
      alert('Could not start live chat. Please ensure microphone permissions are granted.');
    }
  }, [token, isRecording, handleLiveTranscript]);

  const stopLiveChat = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    
    socketRef.current?.disconnect();
    socketRef.current = null;

    setIsRecording(false);
    setIsConnected(false);
    setUserTranscript('');
    setAgentTranscript('');
    setAgentStatus('idle');
  }, []);

  useEffect(() => {
    return () => stopLiveChat(); // Cleanup on unmount
  }, [stopLiveChat]);

  return {
    isConnected,
    isRecording,
    userTranscript,
    agentStatus,
    agentTranscript,
    startLiveChat,
    stopLiveChat,
  };
};