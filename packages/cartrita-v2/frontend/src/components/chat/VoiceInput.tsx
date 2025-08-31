import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';

interface VoiceInputProps {
  messageId: string;
  sessionId: string;
  onTranscriptionUpdate: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface TranscriptionEvent {
  type: 'interim' | 'final';
  text: string;
  seq: number;
  is_final: boolean;
  latency_ms: number;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  messageId,
  sessionId,
  onTranscriptionUpdate,
  onError
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const vadThresholdRef = useRef(0.01); // Voice Activity Detection threshold

  const initializeWebSocket = useCallback(() => {
    const wsUrl = `ws://localhost:8003/ws/transcribe/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setConnectionStatus('connected');
      console.log('WebSocket connected for transcription');
    };

    ws.onmessage = (event) => {
      try {
        const data: TranscriptionEvent = JSON.parse(event.data);
        
        if (data.type === 'interim') {
          setInterimText(data.text);
          onTranscriptionUpdate(data.text, false);
        } else if (data.type === 'final') {
          setTranscript(prev => prev + ' ' + data.text);
          setInterimText('');
          onTranscriptionUpdate(data.text, true);
        }
      } catch (error) {
        console.error('Error parsing transcription data:', error);
        onError?.('Failed to parse transcription data');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
      onError?.('WebSocket connection error');
    };

    ws.onclose = (event) => {
      setConnectionStatus('disconnected');
      if (event.code === 4000) {
        console.log('WebSocket closed due to timeout');
      } else if (event.code === 4001) {
        console.log('WebSocket closed due to idle timeout');
      }
    };

    websocketRef.current = ws;
  }, [sessionId, onTranscriptionUpdate, onError]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });

      // Initialize WebSocket connection
      setConnectionStatus('connecting');
      initializeWebSocket();

      // Setup MediaRecorder for Opus/webm format
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && websocketRef.current?.readyState === WebSocket.OPEN) {
          // Send audio chunk to WebSocket
          event.data.arrayBuffer().then(buffer => {
            websocketRef.current?.send(buffer);
          });
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setIsPaused(false);
        audioChunksRef.current = [];
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        setIsPaused(false);
        stream.getTracks().forEach(track => track.stop());
        
        // Close WebSocket connection
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.close();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      
      // Start recording with small chunks for streaming
      mediaRecorder.start(250); // 250ms chunks

    } catch (error) {
      console.error('Error starting recording:', error);
      onError?.('Failed to start recording. Please check microphone permissions.');
      setIsRecording(false);
    }
  }, [initializeWebSocket, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.close();
      }
    };
  }, [isRecording]);

  return (
    <div className="voice-input-container p-4 border rounded-lg bg-white dark:bg-gray-800">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-3 rounded-full transition-all ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          disabled={connectionStatus === 'connecting'}
        >
          {isRecording ? <Square size={20} /> : <Mic size={20} />}
        </button>

        {isRecording && (
          <button
            onClick={isPaused ? resumeRecording : pauseRecording}
            className="p-2 rounded-full bg-gray-500 hover:bg-gray-600 text-white"
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="capitalize">{connectionStatus}</span>
        </div>
      </div>

      {/* Transcript Display */}
      {(transcript || interimText) && (
        <div className="transcript-display p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Transcript:
          </div>
          <div className="text-gray-900 dark:text-white">
            {transcript && <span className="finalized-text">{transcript}</span>}
            {interimText && (
              <span className="interim-text text-gray-500 dark:text-gray-400 italic">
                {transcript ? ' ' : ''}{interimText}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recording Status */}
      {isRecording && (
        <div className="recording-status mt-3 flex items-center gap-2 text-sm">
          <div className="recording-indicator w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-gray-600 dark:text-gray-400">
            {isPaused ? 'Recording paused' : 'Recording...'}
          </span>
        </div>
      )}
    </div>
  );
};