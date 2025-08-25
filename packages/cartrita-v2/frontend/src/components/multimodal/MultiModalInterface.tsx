'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image,
  Mic,
  Video,
  FileText,
  Upload,
  Camera,
  Music,
  Play,
  Pause,
  Square,
  Send,
  Sparkles,
  Eye,
  Headphones,
  FileImage
} from 'lucide-react';

interface MultiModalInterfaceProps {
  darkMode: boolean;
  onSubmit?: (data: MultiModalData) => void;
}

interface MultiModalData {
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  content: string | File;
  prompt?: string;
}

const MultiModalInterface: React.FC<MultiModalInterfaceProps> = ({ darkMode, onSubmit }) => {
  const [activeMode, setActiveMode] = useState<'text' | 'image' | 'audio' | 'video' | 'document'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const modes = [
    {
      id: 'text' as const,
      icon: <FileText className="w-5 h-5" />,
      label: 'Text Analysis',
      description: 'Analyze and process text content',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'image' as const,
      icon: <Image className="w-5 h-5" />,
      label: 'Vision Analysis',
      description: 'Upload and analyze images',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'audio' as const,
      icon: <Mic className="w-5 h-5" />,
      label: 'Audio Processing',
      description: 'Record or upload audio files',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'video' as const,
      icon: <Video className="w-5 h-5" />,
      label: 'Video Analysis',
      description: 'Process video content',
      color: 'from-red-500 to-red-600'
    },
    {
      id: 'document' as const,
      icon: <FileText className="w-5 h-5" />,
      label: 'Document Processing',
      description: 'Analyze PDFs and documents',
      color: 'from-yellow-500 to-yellow-600'
    }
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const audioBlob = new Blob([event.data], { type: 'audio/wav' });
          const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
          setUploadedFile(audioFile);
        }
      };
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        type: activeMode,
        content: uploadedFile || prompt,
        prompt: prompt
      });
    }
    
    // Reset form
    setUploadedFile(null);
    setPrompt('');
    setRecordingDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Multi-Modal Intelligence 🔥
            </h1>
            <p className={`${
              darkMode ? 'text-purple-300' : 'text-purple-600'
            }`}>
              Upload, analyze, and interact with any type of content! ✨
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {modes.map((mode) => (
          <motion.button
            key={mode.id}
            onClick={() => setActiveMode(mode.id)}
            className={`p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
              activeMode === mode.id
                ? (darkMode 
                    ? 'border-purple-400 bg-gradient-to-br from-purple-800/50 to-pink-800/50 shadow-lg shadow-purple-500/20'
                    : 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg shadow-purple-200/50'
                  )
                : (darkMode
                    ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                  )
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-white`}>
                {mode.icon}
              </div>
              <div className="text-center">
                <div className={`font-medium text-sm ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {mode.label}
                </div>
                <div className={`text-xs ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {mode.description}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Content Area */}
      <div className={`rounded-2xl border-2 p-6 ${
        darkMode 
          ? 'border-purple-500/30 bg-gradient-to-br from-gray-800/50 to-purple-900/50'
          : 'border-purple-200 bg-gradient-to-br from-white to-purple-50'
      }`}>
        
        {/* Text Mode */}
        {activeMode === 'text' && (
          <div className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your text to analyze... What's on your mind, boo? 💭"
              className={`w-full h-40 p-4 rounded-xl border-2 resize-none focus:outline-none bg-transparent transition-colors ${
                darkMode 
                  ? 'border-purple-500/30 text-white placeholder-purple-300 focus:border-purple-400'
                  : 'border-purple-200 text-gray-900 placeholder-purple-500 focus:border-purple-400'
              }`}
            />
          </div>
        )}

        {/* Image Mode */}
        {activeMode === 'image' && (
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:scale-105 ${
                darkMode 
                  ? 'border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/20'
                  : 'border-purple-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              {uploadedFile ? (
                <div className="space-y-3">
                  <FileImage className={`w-12 h-12 mx-auto ${
                    darkMode ? 'text-purple-400' : 'text-purple-600'
                  }`} />
                  <div>
                    <div className={`font-medium ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {uploadedFile.name}
                    </div>
                    <div className={`text-sm ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {Math.round(uploadedFile.size / 1024)}KB
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className={`w-12 h-12 mx-auto ${
                    darkMode ? 'text-purple-400' : 'text-purple-600'
                  }`} />
                  <div>
                    <div className={`font-medium ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Drop your image here or click to upload 📸
                    </div>
                    <div className={`text-sm ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Supports JPG, PNG, WebP formats
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like me to analyze about this image? 👀✨"
              className={`w-full h-24 p-4 rounded-xl border-2 resize-none focus:outline-none bg-transparent transition-colors ${
                darkMode 
                  ? 'border-purple-500/30 text-white placeholder-purple-300 focus:border-purple-400'
                  : 'border-purple-200 text-gray-900 placeholder-purple-500 focus:border-purple-400'
              }`}
            />
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Audio Mode */}
        {activeMode === 'audio' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              {!isRecording ? (
                <motion.button
                  onClick={startRecording}
                  className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  whileTap={{ scale: 0.95 }}
                >
                  <Mic className="w-8 h-8" />
                </motion.button>
              ) : (
                <motion.button
                  onClick={stopRecording}
                  className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center text-white shadow-lg"
                  whileTap={{ scale: 0.95 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Square className="w-8 h-8" />
                </motion.button>
              )}
              
              <div className="text-center">
                <div className={`text-lg font-semibold ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {isRecording ? 'Recording...' : 'Ready to Record'}
                </div>
                {isRecording && (
                  <div className={`text-2xl font-mono ${
                    darkMode ? 'text-red-400' : 'text-red-600'
                  }`}>
                    {formatDuration(recordingDuration)}
                  </div>
                )}
                <div className={`text-sm ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {isRecording ? 'Click to stop recording' : 'Click to start recording'}
                </div>
              </div>
            </div>

            <div className="text-center">
              <span className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                or
              </span>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:scale-105 ${
                darkMode 
                  ? 'border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/20'
                  : 'border-purple-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <Headphones className={`w-8 h-8 mx-auto mb-2 ${
                darkMode ? 'text-purple-400' : 'text-purple-600'
              }`} />
              <div className={`font-medium ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Upload Audio File 🎵
              </div>
              <div className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                MP3, WAV, M4A formats supported
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Video Mode */}
        {activeMode === 'video' && (
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:scale-105 ${
                darkMode 
                  ? 'border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/20'
                  : 'border-purple-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <Video className={`w-12 h-12 mx-auto mb-3 ${
                darkMode ? 'text-purple-400' : 'text-purple-600'
              }`} />
              <div className={`font-medium ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Upload Video File 🎬
              </div>
              <div className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                MP4, WebM, AVI formats supported
              </div>
            </div>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like me to analyze in this video? 🎥✨"
              className={`w-full h-24 p-4 rounded-xl border-2 resize-none focus:outline-none bg-transparent transition-colors ${
                darkMode 
                  ? 'border-purple-500/30 text-white placeholder-purple-300 focus:border-purple-400'
                  : 'border-purple-200 text-gray-900 placeholder-purple-500 focus:border-purple-400'
              }`}
            />
            
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Document Mode */}
        {activeMode === 'document' && (
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:scale-105 ${
                darkMode 
                  ? 'border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/20'
                  : 'border-purple-300 hover:border-purple-400 hover:bg-purple-50'
              }`}
            >
              <FileText className={`w-12 h-12 mx-auto mb-3 ${
                darkMode ? 'text-purple-400' : 'text-purple-600'
              }`} />
              <div className={`font-medium ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Upload Document 📄
              </div>
              <div className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                PDF, DOCX, TXT formats supported
              </div>
            </div>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like me to extract or analyze from this document? 📖✨"
              className={`w-full h-24 p-4 rounded-xl border-2 resize-none focus:outline-none bg-transparent transition-colors ${
                darkMode 
                  ? 'border-purple-500/30 text-white placeholder-purple-300 focus:border-purple-400'
                  : 'border-purple-200 text-gray-900 placeholder-purple-500 focus:border-purple-400'
              }`}
            />
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-center mt-6">
          <motion.button
            onClick={handleSubmit}
            disabled={!prompt && !uploadedFile}
            className={`px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-all hover:scale-105 ${
              (!prompt && !uploadedFile)
                ? (darkMode ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400 shadow-lg hover:shadow-xl'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <Send className="w-5 h-5" />
            Let's Analyze This! 🚀
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default MultiModalInterface;