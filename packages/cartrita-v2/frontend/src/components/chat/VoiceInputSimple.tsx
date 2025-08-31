// Simple voice input component
'use client';

import React from 'react';

interface VoiceInputProps {
  isRecording: boolean;
  onTranscription: (text: string) => void;
  onStop: () => void;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ isRecording, onTranscription, onStop }) => {
  // Simple placeholder for now
  return null;
};

export default VoiceInput;