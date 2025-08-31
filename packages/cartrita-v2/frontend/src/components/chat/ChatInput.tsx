'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Paperclip, 
  Mic, 
  MicOff, 
  Image, 
  FileText, 
  Code, 
  X,
  Plus,
  Zap,
  Camera,
  Upload,
  Square,
  Play,
  Pause,
  Video,
  Monitor,
  Smile,
  Hash,
  AtSign,
  Calendar,
  MapPin,
  Link,
  WifiOff
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import useAppStore, { 
  useCurrentConversation, 
  useIsLoading,
  useTools 
} from '@/store';
import useWebSocket from '@/hooks/useWebSocket';
import { cn, isImageFile, isDocumentFile, formatFileSize } from '@/lib/utils';
import { Tool } from '@/types';
import { toast } from 'react-hot-toast';

const ChatInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const currentConversation = useCurrentConversation();
  const isLoading = useIsLoading();
  const tools = useTools();
  const { sendMessage, createNewConversation } = useAppStore();
  
  // WebSocket integration
  const { 
    isConnected, 
    sendMessage: sendWebSocketMessage, 
    sendTyping,
    sendToolCall 
  } = useWebSocket({
    onMessage: (message) => {
      // Handle real-time messages
      if (message.type === 'message' && message.data.role === 'assistant') {
        // Message will be handled by the store via the WebSocket hook
        setIsSending(false);
        setShowCancel(false);
      } else if (message.type === 'error') {
        setIsSending(false);
        setShowCancel(false);
        toast.error('Failed to send message');
      }
    }
  });

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  // File drop zone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setAttachments(prev => [...prev, ...acceptedFiles]);
    },
    noClick: true,
    multiple: true,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  // Typing indicator handling
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    // Send typing indicator via WebSocket
    if (currentConversation?.id && isConnected) {
      sendTyping(currentConversation.id, newMessage.length > 0);
    }
  }, [currentConversation?.id, isConnected, sendTyping]);

  // Stop typing when user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentConversation?.id && isConnected) {
        sendTyping(currentConversation.id, false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [message, currentConversation?.id, isConnected, sendTyping]);

  const handleSend = async () => {
    if ((!message.trim() && attachments.length === 0) || isLoading || isSending) return;

    const content = message.trim();
    const files = [...attachments];

    // Stop typing indicator
    if (currentConversation?.id && isConnected) {
      sendTyping(currentConversation.id, false);
    }

    setIsSending(true);
    setShowCancel(true);

    // Clear input
    setMessage('');
    setAttachments([]);
    setSelectedTool(null);

    try {
      // Create conversation if none exists
      let conversationId = currentConversation?.id;
      if (!conversationId) {
        const newConversation = await createNewConversation();
        conversationId = newConversation.id;
      }

      // Use WebSocket for real-time messaging if connected
      if (isConnected && conversationId) {
        const success = sendWebSocketMessage(conversationId, content);
        if (!success) {
          // Fallback to API if WebSocket fails
          await sendMessage(content, files);
        }
        // Tool calls via WebSocket
        if (selectedTool) {
          sendToolCall(conversationId, selectedTool.name, { 
            message: content,
            attachments: files.map(f => f.name)
          });
        }
      } else {
        // Fallback to API when WebSocket not available
        await sendMessage(content, files);
        if (!isConnected) {
          toast.warning('Offline mode: Message sent via API');
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore input on error
      setMessage(content);
      setAttachments(files);
      toast.error('Failed to send message');
    } finally {
      // Note: setIsSending(false) is handled by WebSocket response or in catch block
      if (!isConnected) {
        setIsSending(false);
        setShowCancel(false);
      }
    }
  };

  const handleCancel = () => {
    // Cancel any ongoing operations
    if (isRecording) {
      stopRecording();
    }
    if (isRecordingVideo) {
      stopVideoRecording();
    }
    if (isCapturingScreen) {
      stopScreenCapture();
    }
    
    setMessage('');
    setAttachments([]);
    setSelectedTool(null);
    setShowCancel(false);
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow new line
        return;
      } else {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const file = new File([blob], 'recording.wav', { type: 'audio/wav' });
        setAttachments(prev => [...prev, file]);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingStartTime(null);
      setRecordingDuration(0);
    }
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setVideoStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
        setAttachments(prev => [...prev, file]);
        stream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      };

      videoRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingVideo(true);
      setRecordingStartTime(Date.now());
    } catch (error) {
      console.error('Failed to start video recording:', error);
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current) {
      videoRecorderRef.current.stop();
      setIsRecordingVideo(false);
      setRecordingStartTime(null);
      setRecordingDuration(0);
    }
  };

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const file = new File([blob], `screen-recording-${Date.now()}.webm`, { type: 'video/webm' });
        setAttachments(prev => [...prev, file]);
        stream.getTracks().forEach(track => track.stop());
      };

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setIsCapturingScreen(false);
        setRecordingStartTime(null);
        setRecordingDuration(0);
      });

      mediaRecorder.start();
      setIsCapturingScreen(true);
      setRecordingStartTime(Date.now());
    } catch (error) {
      console.error('Failed to start screen capture:', error);
    }
  };

  const stopScreenCapture = () => {
    // Screen capture will be stopped when user stops sharing
    setIsCapturingScreen(false);
    setRecordingStartTime(null);
    setRecordingDuration(0);
  };

  const takeSnapshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      video.addEventListener('loadedmetadata', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `snapshot-${Date.now()}.png`, { type: 'image/png' });
            setAttachments(prev => [...prev, file]);
          }
          stream.getTracks().forEach(track => track.stop());
        }, 'image/png');
      });
    } catch (error) {
      console.error('Failed to take snapshot:', error);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getFileIcon = (file: File) => {
    if (isImageFile(file.name)) return <Image className="w-4 h-4" />;
    if (isDocumentFile(file.name)) return <FileText className="w-4 h-4" />;
    if (file.type.startsWith('audio/')) return <Mic className="w-4 h-4" />;
    if (file.type.startsWith('video/')) return <Camera className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const canSend = (message.trim() || attachments.length > 0) && !isLoading && !isSending;

  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingStartTime) {
      interval = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingStartTime]);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoStream]);

  return (
    <div className="p-4" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10"
          >
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto mb-2 text-primary" />
              <p className="text-lg font-medium text-primary">Drop files here</p>
              <p className="text-sm text-muted-foreground">Images, documents, audio, and more</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tool Picker */}
      <AnimatePresence>
        {showToolPicker && tools.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-4 p-3 bg-accent rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Available Tools</h3>
              <button
                onClick={() => setShowToolPicker(false)}
                className="p-1 rounded hover:bg-background"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {tools.slice(0, 8).map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    setSelectedTool(tool);
                    setShowToolPicker(false);
                    setMessage(prev => prev + `/${tool.name} `);
                    textareaRef.current?.focus();
                  }}
                  className="p-2 text-left rounded hover:bg-background transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{tool.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {tool.description}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Tool Indicator */}
      <AnimatePresence>
        {selectedTool && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-3 p-2 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{selectedTool.name}</span>
              <span className="text-xs text-muted-foreground">tool selected</span>
            </div>
            <button
              onClick={() => setSelectedTool(null)}
              className="p-1 rounded hover:bg-primary/20"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Attachments Preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 space-y-2"
          >
            {attachments.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className="glass-card flex items-center space-x-4 p-3"
              >
                <div className="flex-shrink-0 p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 text-emerald-600 dark:text-emerald-400">
                  {getFileIcon(file)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeAttachment(index)}
                  className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Input Area */}
      <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-premium focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500/50 transition-all duration-200">
        <div className="flex items-end space-x-3 p-4">
          {/* Tool Picker Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowToolPicker(!showToolPicker)}
            className={cn(
              "p-2.5 rounded-xl transition-all duration-200",
              showToolPicker 
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald" 
                : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            )}
            title="Use tools"
          >
            <Zap className="w-5 h-5" />
          </motion.button>

          {/* File Upload Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
            title="Attach files"
          >
            <Paperclip className="w-5 h-5" />
          </motion.button>

          {/* Voice Recording Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "p-2.5 rounded-xl transition-all duration-200 relative",
              isRecording 
                ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg animate-glow" 
                : "hover:bg-purple-50 dark:hover:bg-purple-900/30 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
            )}
            title={isRecording ? "Stop recording" : "Start voice recording"}
          >
            {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {isRecording && recordingDuration > 0 && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-xs bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg"
              >
                {formatDuration(recordingDuration)}
              </motion.span>
            )}
          </motion.button>

          {/* Video Recording Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording}
            className={cn(
              "p-2.5 rounded-xl transition-all duration-200 relative",
              isRecordingVideo 
                ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg animate-glow" 
                : "hover:bg-pink-50 dark:hover:bg-pink-900/30 text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400"
            )}
            title={isRecordingVideo ? "Stop video recording" : "Start video recording"}
          >
            {isRecordingVideo ? <Square className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            {isRecordingVideo && recordingDuration > 0 && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-xs bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg"
              >
                {formatDuration(recordingDuration)}
              </motion.span>
            )}
          </motion.button>

          {/* Screen Capture Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isCapturingScreen ? stopScreenCapture : startScreenCapture}
            className={cn(
              "p-2.5 rounded-xl transition-all duration-200 relative",
              isCapturingScreen 
                ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg animate-glow" 
                : "hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            )}
            title={isCapturingScreen ? "Stop screen recording" : "Start screen recording"}
          >
            {isCapturingScreen ? <Square className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            {isCapturingScreen && recordingDuration > 0 && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-xs bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg"
              >
                {formatDuration(recordingDuration)}
              </motion.span>
            )}
          </motion.button>

          {/* Snapshot Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={takeSnapshot}
            className="p-2.5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/30 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-all duration-200"
            title="Take camera snapshot"
          >
            <Camera className="w-5 h-5" />
          </motion.button>

          {/* Premium Text Input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedTool 
                  ? `Enter parameters for ${selectedTool.name}...`
                  : "Message Cartrita..."
              }
              className="chat-input w-full resize-none border-0 bg-transparent focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base leading-relaxed font-medium"
              rows={1}
              disabled={isLoading}
            />
          </div>

          {/* Premium Send/Cancel Button */}
          {showCancel || isSending ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCancel}
              className="chat-send-button bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              title="Cancel"
            >
              <Square className="w-5 h-5" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: canSend ? 1.05 : 1 }}
              whileTap={{ scale: canSend ? 0.95 : 1 }}
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "chat-send-button",
                canSend
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                  : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-50"
              )}
              title="Send message"
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isConnected ? (
                <Send className="w-5 h-5" />
              ) : (
                <div className="flex items-center space-x-1">
                  <WifiOff className="w-4 h-4" />
                  <Send className="w-4 h-4" />
                </div>
              )}
            </motion.button>
          )}
        </div>

        {/* Premium Character count */}
        {message.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3"
          >
            <p className="text-xs text-gray-400 dark:text-gray-500 text-right font-medium">
              {message.length} {message.length === 1 ? 'character' : 'characters'}
            </p>
          </motion.div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          setAttachments(prev => [...prev, ...files]);
          e.target.value = '';
        }}
      />

      {/* Video Preview */}
      {isRecordingVideo && videoStream && (
        <div className="mt-4 p-3 bg-accent rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-600">Recording Video...</span>
            <span className="text-xs text-muted-foreground">
              {formatDuration(recordingDuration)}
            </span>
          </div>
          <video
            ref={videoRef}
            autoPlay
            muted
            className="w-full max-w-xs rounded-lg"
          />
        </div>
      )}

      {/* Recording Status */}
      {(isRecording || isRecordingVideo || isCapturingScreen) && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-red-700">
            {isRecording && 'Recording audio...'}
            {isRecordingVideo && 'Recording video...'}
            {isCapturingScreen && 'Recording screen...'}
          </span>
          <span className="text-xs text-red-600 ml-auto">
            {formatDuration(recordingDuration)}
          </span>
        </div>
      )}

      {/* Helpful text */}
      <div className="mt-2 text-xs text-muted-foreground text-center space-y-1">
        <div>
          <span>Press Enter to send, Shift+Enter for new line</span>
          {tools.length > 0 && (
            <span className="ml-2">• Use "/" to access tools</span>
          )}
        </div>
        <div className="flex items-center justify-center space-x-4">
          <span>📎 Files</span>
          <span>🎤 Audio</span>
          <span>📹 Video</span>
          <span>🖥️ Screen</span>
          <span>📸 Snapshot</span>
          <span>⚡ Tools</span>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;