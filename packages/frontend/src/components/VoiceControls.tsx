import React, { useState, useEffect, useRef } from 'react';
import { 
  MicrophoneIcon, 
  StopIcon, 
  SpeakerWaveIcon,
  EyeIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';

interface VoiceControlsProps {
  onVoiceStart?: () => void;
  onVoiceStop?: () => void;
  onToggleVisual?: () => void;
  onToggleAmbient?: () => void;
  token?: string;
  className?: string;
}

interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  visualEnabled: boolean;
  ambientEnabled: boolean;
  sessionActive: boolean;
  wakeWordActive: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  onVoiceStart,
  onVoiceStop,
  onToggleVisual,
  onToggleAmbient,
  token,
  className = ''
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    visualEnabled: false,
    ambientEnabled: false,
    sessionActive: false,
    wakeWordActive: false
  });

  const [status, setStatus] = useState<string>('Ready');
  const [lastResponse, setLastResponse] = useState<string>('');

  const handleStartVoice = async () => {
    try {
      setVoiceState(prev => ({ ...prev, isProcessing: true }));
      setStatus('Starting voice session...');

      // Call the voice chat API to start session
      const response = await fetch('/api/voice-chat/start-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: {
            wakeWords: ['cartrita', 'hey cartrita'],
            ambientMode: voiceState.ambientEnabled,
            visualMode: voiceState.visualEnabled
          }
        })
      });

      if (response.ok) {
        setVoiceState(prev => ({
          ...prev,
          sessionActive: true,
          isListening: true,
          isProcessing: false,
          wakeWordActive: true
        }));
        setStatus('Voice session active - say "Cartrita!" to start');
        onVoiceStart?.();
      } else {
        throw new Error('Failed to start voice session');
      }
    } catch (error) {
      console.error('Voice start error:', error);
      setStatus('Error starting voice session');
      setVoiceState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleStopVoice = async () => {
    try {
      setVoiceState(prev => ({ ...prev, isProcessing: true }));
      setStatus('Stopping voice session...');

      // Call the voice chat API to stop session
      await fetch('/api/voice-chat/stop-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setVoiceState({
        isListening: false,
        isProcessing: false,
        isSpeaking: false,
        visualEnabled: voiceState.visualEnabled,
        ambientEnabled: voiceState.ambientEnabled,
        sessionActive: false,
        wakeWordActive: false
      });
      setStatus('Voice session stopped');
      onVoiceStop?.();
    } catch (error) {
      console.error('Voice stop error:', error);
      setStatus('Error stopping voice session');
      setVoiceState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleToggleVisual = () => {
    const newState = !voiceState.visualEnabled;
    setVoiceState(prev => ({ ...prev, visualEnabled: newState }));
    setStatus(newState ? 'Visual mode enabled' : 'Visual mode disabled');
    onToggleVisual?.();
  };

  const handleToggleAmbient = () => {
    const newState = !voiceState.ambientEnabled;
    setVoiceState(prev => ({ ...prev, ambientEnabled: newState }));
    setStatus(newState ? 'Ambient listening enabled' : 'Ambient listening disabled');
    onToggleAmbient?.();
  };

  const getStatusColor = () => {
    if (voiceState.isProcessing) return 'text-yellow-600';
    if (voiceState.isSpeaking) return 'text-blue-600';
    if (voiceState.isListening) return 'text-green-600';
    if (voiceState.sessionActive) return 'text-purple-600';
    return 'text-gray-600';
  };

  const getMainButtonColor = () => {
    if (voiceState.isProcessing) return 'bg-yellow-500 hover:bg-yellow-600';
    if (voiceState.wakeWordActive) return 'bg-purple-500 hover:bg-purple-600';
    if (voiceState.sessionActive) return 'bg-red-500 hover:bg-red-600';
    return 'bg-blue-500 hover:bg-blue-600';
  };

  return (
    <div className={`voice-controls bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border ${className}`}>
      {/* Status Display */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Voice Controls
          </h3>
          <div className={`text-sm ${getStatusColor()}`}>
            {status}
          </div>
        </div>
        
        {/* Indicators */}
        <div className="flex items-center space-x-4 text-xs">
          {voiceState.sessionActive && (
            <div className="flex items-center space-x-1 text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Active</span>
            </div>
          )}
          
          {voiceState.wakeWordActive && (
            <div className="flex items-center space-x-1 text-purple-600">
              <span>🎤</span>
              <span>Wake word ready</span>
            </div>
          )}
          
          {voiceState.isSpeaking && (
            <div className="flex items-center space-x-1 text-blue-600">
              <SpeakerWaveIcon className="w-4 h-4 animate-pulse" />
              <span>Speaking</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        {/* Main Voice Button */}
        <button
          onClick={voiceState.sessionActive ? handleStopVoice : handleStartVoice}
          disabled={voiceState.isProcessing}
          className={`
            relative p-4 rounded-full transition-all duration-200 text-white
            focus:outline-none focus:ring-4 focus:ring-offset-2
            ${getMainButtonColor()}
            ${voiceState.isProcessing 
              ? 'opacity-50 cursor-not-allowed' 
              : 'transform hover:scale-105 shadow-lg'
            }
          `}
          title={voiceState.sessionActive ? 'Stop Voice Session' : 'Start Voice Session'}
        >
          {voiceState.isProcessing ? (
            <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
          ) : voiceState.sessionActive ? (
            <StopIcon className="h-8 w-8" />
          ) : (
            <MicrophoneIcon className="h-8 w-8" />
          )}
          
          {/* Wake word indicator */}
          {voiceState.wakeWordActive && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-400 rounded-full animate-pulse" />
          )}
        </button>
      </div>

      {/* Feature Toggles */}
      <div className="flex items-center justify-center space-x-3 mb-4">
        {/* Visual Toggle */}
        <button
          onClick={handleToggleVisual}
          className={`
            p-2 rounded-lg transition-colors text-sm flex items-center space-x-1
            ${voiceState.visualEnabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }
          `}
          title="Toggle Visual Analysis"
        >
          <EyeIcon className="h-4 w-4" />
          <span>Visual</span>
        </button>

        {/* Ambient Toggle */}
        <button
          onClick={handleToggleAmbient}
          className={`
            p-2 rounded-lg transition-colors text-sm flex items-center space-x-1
            ${voiceState.ambientEnabled
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }
          `}
          title="Toggle Ambient Listening"
        >
          <SpeakerWaveIcon className="h-4 w-4" />
          <span>Ambient</span>
        </button>
      </div>

      {/* Instructions */}
      {voiceState.sessionActive && (
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            💡 Say <strong>"Cartrita!"</strong> to activate voice mode
          </p>
        </div>
      )}

      {/* Quick Test Button */}
      {!voiceState.sessionActive && (
        <div className="text-center">
          <button
            onClick={() => setLastResponse('Voice system ready for Iteration 21!')}
            className="text-sm text-purple-600 hover:text-purple-700 underline"
          >
            Test Voice System
          </button>
        </div>
      )}

      {/* Last Response */}
      {lastResponse && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Cartrita:</strong> {lastResponse}
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;