import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 🔍 Preflight ambient volume check
  async function isAudioValid(blob: Blob): Promise<boolean> {
    const ctx = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);

    const data = buffer.getChannelData(0);
    const avg = data.reduce((acc, val) => acc + Math.abs(val), 0) / data.length;

    console.log('[VoiceToText] Avg volume:', avg);
    return avg > 0.005; // Sensitivity threshold — tweak if needed
  }

  const startRecording = async () => {
    if (disabled || !token) return;

    try {
      console.log('[VoiceToText] Starting recording');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];
      setIsRecording(true);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[VoiceToText] Recording stopped, processing...');
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm',
          });
          console.log(
            '[VoiceToText] Audio blob created:',
            audioBlob.size,
            'bytes'
          );

          const isValid = await isAudioValid(audioBlob);
          if (!isValid) {
            console.warn(
              '[VoiceToText] Skipping transcription — audio is silent'
            );
            alert('No speech detected in your recording. Please try again.');
            return;
          }

          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          console.log('[VoiceToText] FormData created, sending request...');

          const response = await fetch('http://localhost:8000/api/voice-to-text/transcribe', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          console.log(
            '[VoiceToText] Response received:',
            response.status,
            response.statusText
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[VoiceToText] Error response:', errorText);
            throw new Error(
              `Transcription failed: ${response.status} ${response.statusText} - ${errorText}`
            );
          }

          const result = await response.json();
          console.log('[VoiceToText] Transcription result:', result);

          if (result.transcript) {
            console.log(
              '[VoiceToText] Transcription successful:',
              result.transcript
            );
            onTranscript(result.transcript);
          } else {
            console.warn('[VoiceToText] No transcript received');
          }
        } catch (error) {
          console.error('[VoiceToText] Transcription error:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          alert(`Failed to transcribe speech: ${errorMessage}`);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error('[VoiceToText] Failed to start recording:', error);
      setIsRecording(false);

      if (error instanceof Error && error.name === 'NotAllowedError') {
        alert('Microphone permission is required for voice input.');
      } else {
        alert('Failed to start voice recording. Please try again.');
      }
    }
  };

  const stopRecording = () => {
    console.log('[VoiceToText] Stopping recording');

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
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
              ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500'
              : isProcessing
                ? 'bg-blue-500 text-white animate-pulse'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600 focus:ring-blue-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
          }
          ${isButtonDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title={
          isRecording
            ? 'Stop recording'
            : isProcessing
              ? 'Processing...'
              : 'Start voice input'
        }
      >
        {isRecording ? (
          <StopIcon className="h-5 w-5" />
        ) : (
          <MicrophoneIcon
            className={`h-5 w-5 ${isProcessing ? 'animate-pulse' : ''}`}
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
    </div>
  );
};
