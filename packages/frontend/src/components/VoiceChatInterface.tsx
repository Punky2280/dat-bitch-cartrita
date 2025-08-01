import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MicrophoneIcon, 
  StopIcon, 
  SpeakerWaveIcon,
  EyeIcon,
  EyeSlashIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { AudioVisualizer } from './AudioVisualizer';
import { VisualAnalysisPanel } from './VisualAnalysisPanel';
import { MediaPermissionHandler, MediaPermissionState } from './MediaPermissionHandler';
import { VoiceActivityDetector, VADResult } from '@/utils/voiceActivityDetection';
import { createWakeWordDetector, WakeWordResult } from '@/utils/wakeWordDetection';

interface VoiceChatState {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  voiceActivated: boolean;
  ambientMode: boolean;
  visualMode: boolean;
  sessionActive: boolean;
  wakeWordDetected: boolean;
  vadActive: boolean;
  currentVolume: number;
  permissions: MediaPermissionState;
}

interface VoiceChatProps {
  onTranscript?: (text: string) => void;
  onResponse?: (response: any) => void;
  token?: string;
  userId?: string;
}

export const VoiceChatInterface: React.FC<VoiceChatProps> = ({ 
  onTranscript, 
  onResponse,
  token
}) => {
  // State management
  const [chatState, setChatState] = useState<VoiceChatState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    voiceActivated: false,
    ambientMode: false,
    visualMode: false,
    sessionActive: false
  });

  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [ambientSounds] = useState<string[]>([]);
  const [emotionalState, setEmotionalState] = useState<string>('friendly');
  const [wakeWordDetected, setWakeWordDetected] = useState<boolean>(false);

  // Refs for media handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Real-time audio analysis
  const setupAudioAnalysis = useCallback(async () => {
    try {
      if (!streamRef.current) return;

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const analyzeAudio = () => {
        if (!analyserRef.current || !chatState.sessionActive) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate volume level
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const volumeLevel = average / 255;
        
        // Detect speech patterns
        if (volumeLevel > 0.1 && !chatState.isProcessing) {
          // Speech detected - could trigger wake word detection
          if (!chatState.voiceActivated && volumeLevel > 0.3) {
            checkForWakeWord();
          }
        }
        
        requestAnimationFrame(analyzeAudio);
      };
      
      analyzeAudio();
    } catch (error) {
      console.error('[VoiceChat] Error setting up audio analysis:', error);
    }
  }, [chatState.sessionActive, chatState.voiceActivated, chatState.isProcessing]);

  // Wake word detection
  const checkForWakeWord = useCallback(async () => {
    if (chatState.voiceActivated || !audioChunksRef.current.length) return;
    
    try {
      // Create a short audio clip for wake word detection
      const audioBlob = new Blob(audioChunksRef.current.slice(-2), { type: 'audio/webm' });
      
      if (audioBlob.size < 1000) return; // Too small to analyze
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'wake-check.webm');
      
      const response = await fetch('http://localhost:8000/api/voice-to-text/transcribe', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.wakeWord && result.wakeWord.detected) {
          console.log('[VoiceChat] Wake word detected:', result.wakeWord.wakeWord);
          setWakeWordDetected(true);
          activateVoiceMode(result.wakeWord.cleanTranscript);
        }
      }
    } catch (error) {
      console.error('[VoiceChat] Wake word detection error:', error);
    }
  }, [chatState.voiceActivated, token]);

  // Activate voice mode
  const activateVoiceMode = useCallback(async (initialCommand?: string) => {
    try {
      console.log('[VoiceChat] Activating voice mode');
      
      setChatState(prev => ({ ...prev, voiceActivated: true, isListening: true }));
      setWakeWordDetected(true);
      
      // Send acknowledgment
      const acknowledgment = "Hey! I'm here, what's up?";
      await playTTSResponse(acknowledgment, 'friendly');
      
      // Process initial command if provided
      if (initialCommand && initialCommand.trim()) {
        setTimeout(() => {
          processVoiceInput(initialCommand);
        }, 1500);
      }
      
    } catch (error) {
      console.error('[VoiceChat] Error activating voice mode:', error);
    }
  }, []);

  // Start comprehensive session
  const startVoiceSession = useCallback(async () => {
    try {
      if (chatState.sessionActive) {
        console.warn('[VoiceChat] Session already active');
        return;
      }

      console.log('[VoiceChat] Starting comprehensive voice session');
      
      // Get media permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
        video: chatState.visualMode ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 }
        } : false
      });

      streamRef.current = stream;
      
      // Set up video if enabled
      if (chatState.visualMode && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Set up audio recording
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Keep only recent chunks for wake word detection
          if (audioChunksRef.current.length > 10) {
            audioChunksRef.current = audioChunksRef.current.slice(-10);
          }
        }
      };
      
      mediaRecorder.start(500); // Collect data every 500ms
      
      // Set up audio analysis
      await setupAudioAnalysis();
      
      // Start backend voice session
      const sessionResponse = await fetch('http://localhost:8000/api/voice-chat/start-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: {
            wakeWords: ['cartrita', 'hey cartrita', 'cartrita!'],
            ambientMode: chatState.ambientMode,
            visualMode: chatState.visualMode,
            sensitivity: 0.3
          }
        })
      });
      
      if (sessionResponse.ok) {
        setChatState(prev => ({ 
          ...prev, 
          sessionActive: true, 
          isListening: true 
        }));
        
        // Start visual analysis if enabled
        if (chatState.visualMode) {
          startVisualAnalysis();
        }
        
        // Start ambient monitoring if enabled
        if (chatState.ambientMode) {
          startAmbientMonitoring();
        }
        
        // Play greeting
        await playTTSResponse("Hey! I'm all set up and ready to chat! Just say my name when you want to talk!", 'friendly');
      }
      
    } catch (error) {
      console.error('[VoiceChat] Failed to start session:', error);
      alert('Failed to start voice chat. Please check your microphone permissions.');
    }
  }, [chatState.sessionActive, chatState.visualMode, chatState.ambientMode, token, setupAudioAnalysis]);

  // Stop session
  const stopVoiceSession = useCallback(async () => {
    try {
      console.log('[VoiceChat] Stopping voice session');
      
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Stop audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop backend session
      await fetch('http://localhost:8000/api/voice-chat/stop-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      
      setChatState({
        isListening: false,
        isProcessing: false,
        isSpeaking: false,
        voiceActivated: false,
        ambientMode: false,
        visualMode: false,
        sessionActive: false
      });
      
      setWakeWordDetected(false);
      setInterimTranscript('');
      
    } catch (error) {
      console.error('[VoiceChat] Error stopping session:', error);
    }
  }, [token]);

  // Process voice input
  const processVoiceInput = useCallback(async (transcript: string) => {
    try {
      setChatState(prev => ({ ...prev, isProcessing: true }));
      
      // Add to conversation history
      const userMessage = {
        timestamp: new Date(),
        type: 'user',
        content: transcript,
        mode: 'voice'
      };
      
      setConversationHistory(prev => [...prev, userMessage]);
      
      if (onTranscript) {
        onTranscript(transcript);
      }
      
      // Get response from backend (this would integrate with your agent system)
      const response = await generateVoiceResponse(transcript);
      
      // Add response to history
      const assistantMessage = {
        timestamp: new Date(),
        type: 'assistant',
        content: response.text,
        emotion: response.emotion,
        mode: 'voice'
      };
      
      setConversationHistory(prev => [...prev, assistantMessage]);
      setEmotionalState(response.emotion);
      
      // Play TTS response
      await playTTSResponse(response.text, response.emotion);
      
      if (onResponse) {
        onResponse(response);
      }
      
    } catch (error) {
      console.error('[VoiceChat] Error processing voice input:', error);
      await playTTSResponse("Sorry, I had trouble with that. Can you try again?", 'calm');
    } finally {
      setChatState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [onTranscript, onResponse]);

  // Generate voice response
  const generateVoiceResponse = useCallback(async (input: string) => {
    // This would integrate with your full agent system
    // For now, using simple responses
    const responses = {
      greeting: {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
        response: "Hey there! So good to hear your voice! What's going on today?",
        emotion: 'friendly'
      },
      compliment: {
        patterns: ['beautiful', 'amazing', 'great', 'awesome', 'incredible'],
        response: "Aww, you're so sweet! Thank you, that totally made my day!",
        emotion: 'excited'
      },
      question: {
        patterns: ['what', 'how', 'why', 'when', 'where', 'can you'],
        response: "That's a great question! I love talking about stuff like this. Let me think...",
        emotion: 'curious'
      },
      help: {
        patterns: ['help', 'assist', 'support'],
        response: "Of course I can help! I'm here for whatever you need. What can I do for you?",
        emotion: 'encouraging'
      }
    };
    
    const lowerInput = input.toLowerCase();
    
    for (const [category, config] of Object.entries(responses)) {
      if (config.patterns.some(pattern => lowerInput.includes(pattern))) {
        return {
          text: config.response,
          emotion: config.emotion,
          category: category
        };
      }
    }
    
    // Default response
    return {
      text: "That's really interesting! I love hearing your thoughts. Tell me more about that!",
      emotion: 'friendly',
      category: 'default'
    };
  }, []);

  // Play TTS response
  const playTTSResponse = useCallback(async (text: string, emotion: string = 'friendly') => {
    try {
      setChatState(prev => ({ ...prev, isSpeaking: true }));
      
      const response = await fetch('http://localhost:8000/api/voice-chat/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: text,
          emotion: emotion,
          voice: 'nova',
          speed: 1.0
        })
      });
      
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioData = await audioContext.decodeAudioData(audioBuffer);
        const source = audioContext.createBufferSource();
        
        source.buffer = audioData;
        source.connect(audioContext.destination);
        
        source.onended = () => {
          setChatState(prev => ({ ...prev, isSpeaking: false }));
        };
        
        source.start();
      }
      
    } catch (error) {
      console.error('[VoiceChat] Error playing TTS response:', error);
      setChatState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, [token]);

  // Visual analysis
  const startVisualAnalysis = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const analyzeFrame = async () => {
      if (!chatState.visualMode || !chatState.sessionActive) return;
      
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
      const video = videoRef.current!;
      
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        // Convert to blob and send for analysis
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          
          const formData = new FormData();
          formData.append('image', blob, 'frame.jpg');
          
          try {
            const response = await fetch('http://localhost:8000/api/vision/analyze', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData
            });
            
            if (response.ok) {
              const analysis = await response.json();
              // Process visual analysis results
              processVisualAnalysis(analysis);
            }
          } catch (error) {
            console.error('[VoiceChat] Visual analysis error:', error);
          }
        }, 'image/jpeg', 0.8);
      }
      
      // Analyze every 5 seconds
      setTimeout(analyzeFrame, 5000);
    };
    
    setTimeout(analyzeFrame, 2000); // Start after 2 seconds
  }, [chatState.visualMode, chatState.sessionActive, token]);

  // Process visual analysis
  const processVisualAnalysis = useCallback((analysis: any) => {
    if (analysis.cartrita_comments && analysis.cartrita_comments.length > 0) {
      // Occasionally comment on what she sees (10% chance)
      if (Math.random() < 0.1) {
        const comment = analysis.cartrita_comments[0];
        setTimeout(() => {
          playTTSResponse(comment, 'casual');
        }, 1000);
      }
    }
  }, [playTTSResponse]);

  // Ambient monitoring
  const startAmbientMonitoring = useCallback(() => {
    // This would connect to ambient listening service
    console.log('[VoiceChat] Starting ambient monitoring');
  }, []);

  // Toggle functions
  const toggleAmbientMode = useCallback(() => {
    setChatState(prev => ({ ...prev, ambientMode: !prev.ambientMode }));
  }, []);

  const toggleVisualMode = useCallback(() => {
    setChatState(prev => ({ ...prev, visualMode: !prev.visualMode }));
  }, []);

  const toggleSession = useCallback(() => {
    if (chatState.sessionActive) {
      stopVoiceSession();
    } else {
      startVoiceSession();
    }
  }, [chatState.sessionActive, startVoiceSession, stopVoiceSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chatState.sessionActive) {
        stopVoiceSession();
      }
    };
  }, []);

  return (
    <div className="voice-chat-interface bg-gray-50 dark:bg-gray-900 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Cartrita Voice Chat
          </h2>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Visual Mode Toggle */}
          <button
            onClick={toggleVisualMode}
            className={`p-2 rounded-full transition-colors ${
              chatState.visualMode
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
            title="Toggle Visual Mode"
          >
            {chatState.visualMode ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
          </button>
          
          {/* Ambient Mode Toggle */}
          <button
            onClick={toggleAmbientMode}
            className={`p-2 rounded-full transition-colors ${
              chatState.ambientMode
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
            title="Toggle Ambient Listening"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Status Display */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 text-sm">
          <div className={`flex items-center space-x-2 ${
            chatState.sessionActive ? 'text-green-600' : 'text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              chatState.sessionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span>{chatState.sessionActive ? 'Active' : 'Inactive'}</span>
          </div>
          
          {wakeWordDetected && (
            <div className="flex items-center space-x-2 text-purple-600">
              <SparklesIcon className="h-4 w-4" />
              <span>Voice Activated</span>
            </div>
          )}
          
          {chatState.isSpeaking && (
            <div className="flex items-center space-x-2 text-blue-600">
              <SpeakerWaveIcon className="h-4 w-4 animate-pulse" />
              <span>Speaking</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Feed */}
      {chatState.visualMode && (
        <div className="mb-6">
          <video
            ref={videoRef}
            autoPlay
            muted
            className="w-full max-w-md mx-auto rounded-lg shadow-md"
            style={{ maxHeight: '200px' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}

      {/* Conversation Display */}
      <div className="mb-6 h-64 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg p-4 border">
        {conversationHistory.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <SparklesIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Start chatting with Cartrita!</p>
            <p className="text-sm mt-1">Say "Cartrita!" to activate voice mode</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conversationHistory.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <p>{message.content}</p>
                  {message.emotion && (
                    <p className="text-xs opacity-75 mt-1">({message.emotion})</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Interim Transcript */}
        {interimTranscript && (
          <div className="flex justify-end mt-2">
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-300 text-blue-900 opacity-75">
              <p className="italic">{interimTranscript}...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4">
        {/* Main Voice Button */}
        <button
          onClick={toggleSession}
          disabled={chatState.isProcessing}
          className={`
            relative p-4 rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2
            ${
              chatState.sessionActive
                ? chatState.voiceActivated
                  ? 'bg-purple-500 hover:bg-purple-600 text-white focus:ring-purple-500 shadow-lg'
                  : 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-500'
                : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500'
            }
            ${
              chatState.isProcessing
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer transform hover:scale-105'
            }
          `}
          title={
            chatState.sessionActive
              ? 'Stop Voice Session'
              : 'Start Voice Session'
          }
        >
          {chatState.isProcessing ? (
            <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
          ) : chatState.sessionActive ? (
            <StopIcon className="h-8 w-8" />
          ) : (
            <MicrophoneIcon className="h-8 w-8" />
          )}
          
          {/* Voice Activated Indicator */}
          {chatState.voiceActivated && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-400 rounded-full animate-pulse" />
          )}
          
          {/* Listening Indicator */}
          {chatState.isListening && !chatState.voiceActivated && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
          )}
        </button>
      </div>

      {/* Wake Word Instruction */}
      {chatState.sessionActive && !chatState.voiceActivated && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            💡 Say <strong>"Cartrita!"</strong> to activate voice mode
          </p>
        </div>
      )}

      {/* Ambient Sounds Display */}
      {chatState.ambientMode && ambientSounds.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            Ambient Sounds Detected:
          </p>
          <div className="flex flex-wrap gap-2">
            {ambientSounds.map((sound, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded-full"
              >
                {sound}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Emotional State */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Current mood: <span className="font-medium text-purple-600 dark:text-purple-400">{emotionalState}</span>
        </p>
      </div>
    </div>
  );
};

export default VoiceChatInterface;