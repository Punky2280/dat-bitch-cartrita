// PromptInputZone.tsx - Advanced prompt input with all features
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Square,
  Paperclip,
  Mic,
  MicOff,
  Settings,
  Zap,
  DollarSign,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Trash2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Image,
  FileText,
  Code,
  Camera,
  Upload,
  X,
  Wand2,
  User,
  Bot,
  BookOpen,
  Lightbulb,
  Target,
  Sparkles
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAttachmentStore, useModelStore, useModerationStore, useThemeStore, useAccessibilityStore, useAnalyticsStore } from '../../store/additionalStores';
import AttachmentTray from './AttachmentTray';
import ToolSelector from './ToolSelector';
import ParameterDrawer from './ParameterDrawer';
import PromptSuggestions from './PromptSuggestions';
import VoiceInput from './VoiceInputSimple';
import ModerationOverlay from './ModerationOverlay';

// Whisper API transcription function based on OpenAI 2025 best practices
const transcribeAudio = async (audioFile: File): Promise<{ text: string }> => {
  const formData = new FormData();
  formData.append('file', audioFile, audioFile.name);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en'); // Can be made configurable
  formData.append('response_format', 'json');

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return { text: result.text || '' };
};

interface PromptInputZoneProps {
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showSuggestions?: boolean;
  showAttachments?: boolean;
  showTools?: boolean;
  showParameters?: boolean;
  showVoiceInput?: boolean;
}

const PromptInputZone: React.FC<PromptInputZoneProps> = ({
  disabled = false,
  placeholder = "Type your message...",
  maxLength = 10000,
  showSuggestions = true,
  showAttachments = true,
  showTools = true,
  showParameters = true,
  showVoiceInput = true
}) => {
  const chatStore = useChatStore();
  const attachmentStore = useAttachmentStore();
  const modelStore = useModelStore();
  const moderationStore = useModerationStore();
  const themeStore = useThemeStore();
  const accessibilityStore = useAccessibilityStore();
  const analyticsStore = useAnalyticsStore();

  // Local state
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [showParameterDrawer, setShowParameterDrawer] = useState(false);
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [costEstimate, setCostEstimate] = useState(0);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout>();

  // Constants
  const isDarkMode = themeStore.currentTheme === 'dark';
  const isStreaming = chatStore.streaming?.active;
  const hasAttachments = attachmentStore.attachments.length > 0;
  const isInputDisabled = disabled || chatStore.input_disabled || isStreaming;

  // Role options
  const roleOptions = [
    { id: 'user', name: 'User', icon: User, description: 'Ask as yourself' },
    { id: 'teacher', name: 'Teacher', icon: BookOpen, description: 'Explain concepts clearly' },
    { id: 'debugger', name: 'Debugger', icon: Code, description: 'Find and fix problems' },
    { id: 'creative', name: 'Creative', icon: Lightbulb, description: 'Generate creative ideas' },
    { id: 'analyst', name: 'Analyst', icon: Target, description: 'Analyze data and patterns' },
    { id: 'assistant', name: 'Assistant', icon: Bot, description: 'General purpose help' }
  ];

  // Prompt suggestions
  const promptSuggestions = [
    "Explain this concept in simple terms",
    "Write code to solve this problem",
    "Summarize the key points",
    "Generate creative alternatives",
    "Debug this issue",
    "Create a step-by-step guide",
    "Analyze the pros and cons",
    "Provide examples and use cases"
  ];

  // Effects
  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 240) + 'px';
    }
  }, [inputValue]);

  useEffect(() => {
    // Autosave draft
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (inputValue.trim()) {
        chatStore.saveDraft(inputValue);
      }
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [inputValue, chatStore]);

  useEffect(() => {
    // Load draft on mount
    if (chatStore.draft_message && !inputValue) {
      setInputValue(chatStore.draft_message);
    }
  }, [chatStore.draft_message, inputValue]);

  useEffect(() => {
    // Calculate token count and cost estimate
    const tokens = Math.ceil(inputValue.length / 4); // Rough estimate
    setTokenCount(tokens);
    setCostEstimate(tokens * 0.00001); // Rough cost estimate
  }, [inputValue]);

  useEffect(() => {
    // Check for moderation warnings
    const checkModeration = async () => {
      if (inputValue.length > 20) {
        const result = await moderationStore.checkContent(inputValue);
        if (result.flagged) {
          setModerationWarning(result.reason || 'Content may violate policies');
        } else {
          setModerationWarning(null);
        }
      } else {
        setModerationWarning(null);
      }
    };

    const timer = setTimeout(checkModeration, 500);
    return () => clearTimeout(timer);
  }, [inputValue, moderationStore]);

  // Event handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setInputValue(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }

    // Navigate suggestions with arrow keys
    if (showSuggestionPanel && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const suggestions = getFilteredSuggestions();
      if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          setSelectedSuggestion(prev => prev < suggestions.length - 1 ? prev + 1 : 0);
        } else {
          setSelectedSuggestion(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
        }
      }
    }

    // Select suggestion with Enter
    if (showSuggestionPanel && e.key === 'Enter' && selectedSuggestion >= 0) {
      e.preventDefault();
      const suggestions = getFilteredSuggestions();
      if (suggestions[selectedSuggestion]) {
        handleSuggestionClick(suggestions[selectedSuggestion]);
      }
    }

    // Analytics
    analyticsStore.trackEvent('input.keypress', { key: e.key });
  };

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isInputDisabled || moderationWarning) {
      return;
    }

    // Create user message
    const messageId = chatStore.addMessage({
      role: 'user',
      content: inputValue.trim(),
      attachments: [...attachmentStore.attachments],
      tool_invocations: selectedTools.map(tool => ({
        id: `tool-${Date.now()}-${Math.random()}`,
        tool_name: tool,
        status: 'idle' as const,
        input: {},
        collapsed: false
      }))
    });

    // Clear input and attachments
    const messageContent = inputValue.trim();
    setInputValue('');
    attachmentStore.clearAttachments();
    setSelectedTools([]);
    chatStore.clearDraft();

    // Create assistant message and start streaming
    const assistantMessageId = chatStore.addMessage({
      role: 'assistant',
      content: '',
      state: 'pending'
    });

    chatStore.startStreaming(assistantMessageId);

    // Analytics
    analyticsStore.trackEvent('message.sent', {
      message_id: messageId,
      length: messageContent.length,
      has_attachments: hasAttachments,
      selected_tools: selectedTools,
      selected_role: selectedRole
    });

    // Send to backend API
    try {
      const { apiClient } = await import('../../lib/apiClient');
      
      // Try streaming first
      let hasStreamed = false;
      try {
        for await (const chunk of apiClient.streamMessage(messageContent)) {
          hasStreamed = true;
          if (chunk.type === 'chunk' && chunk.content) {
            chatStore.addStreamingChunk(chunk.content);
          } else if (chunk.type === 'complete') {
            chatStore.completeStreaming();
            break;
          } else if (chunk.type === 'error') {
            throw new Error(chunk.error || 'Streaming failed');
          }
        }
      } catch (streamError) {
        console.warn('Streaming failed, falling back to regular request:', streamError);
        
        if (!hasStreamed) {
          // Fallback to non-streaming request
          const response = await apiClient.sendMessage(messageContent);
          chatStore.updateMessage(assistantMessageId, {
            content: response.response,
            state: 'complete',
            model_used: response.model_used,
            tokens: response.tokens,
            latency_ms: response.latency_ms
          });
          chatStore.completeStreaming();
        }
      }
    } catch (error) {
      console.error('API request failed:', error);
      chatStore.updateMessage(assistantMessageId, {
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        state: 'error'
      });
      chatStore.completeStreaming();
    }
  }, [
    inputValue,
    isInputDisabled,
    moderationWarning,
    chatStore,
    attachmentStore,
    selectedTools,
    hasAttachments,
    selectedRole,
    analyticsStore
  ]);

  const handleStop = () => {
    chatStore.stopStreaming();
    analyticsStore.trackEvent('message.stopped');
  };

  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach(file => {
      attachmentStore.addAttachment(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      // Stop voice recording
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    } else {
      setIsRecording(true);
      // Start voice recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        
        recorder.ondataavailable = (e) => {
          chunks.push(e.data);
        };
        
        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], 'voice_recording.webm', { type: 'audio/webm' });
          
          try {
            // Transcribe the audio using the Whisper API
            const result = await transcribeAudio(audioFile);
            setInputValue(prev => prev + ' ' + result.text);
            analyticsStore.trackEvent('voice.transcribed', { length: result.text.length });
          } catch (error) {
            console.error('Failed to transcribe audio:', error);
            // Fallback: show that audio was recorded but couldn't be transcribed
            setInputValue(prev => prev + ' [Voice recording - transcription failed]');
          } finally {
            stream.getTracks().forEach(track => track.stop());
          }
        };
        
        setMediaRecorder(recorder);
        recorder.start();
      } catch (error) {
        console.error('Failed to start recording:', error);
        setIsRecording(false);
      }
    }
  };

  const handlePromptRewrite = async () => {
    if (!inputValue.trim()) return;

    const rewritten = await moderationStore.rewritePrompt(inputValue);
    if (rewritten) {
      setInputValue(rewritten);
      analyticsStore.trackEvent('prompt.rewritten');
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestionPanel(false);
    setSelectedSuggestion(-1);
    textareaRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSuggestionSelect(suggestion);
  };

  const getFilteredSuggestions = () => {
    return suggestions.filter(s => 
      s.toLowerCase().includes(inputValue.toLowerCase()) ||
      inputValue.toLowerCase().includes(s.toLowerCase())
    );
  };  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    const role = roleOptions.find(r => r.id === roleId);
    if (role) {
      analyticsStore.trackEvent('role.selected', { role: roleId });
    }
  };

  // Get current model info
  const currentModel = modelStore.currentModel;
  const modelInfo = modelStore.models.find(m => m.id === currentModel);

  return (
    <div className="relative">
      {/* Parameter Drawer */}
      <AnimatePresence>
        {showParameterDrawer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`absolute bottom-full left-0 right-0 mb-2 rounded-lg border shadow-lg ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}
          >
            <ParameterDrawer onClose={() => setShowParameterDrawer(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tool Selector */}
      <AnimatePresence>
        {showToolSelector && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`absolute bottom-full left-0 right-0 mb-2 rounded-lg border shadow-lg ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}
          >
            <ToolSelector
              selectedTools={selectedTools}
              onToolsChange={setSelectedTools}
              onClose={() => setShowToolSelector(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestion Panel */}
      <AnimatePresence>
        {showSuggestionPanel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`absolute bottom-full left-0 right-0 mb-2 rounded-lg border shadow-lg ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}
          >
            <PromptSuggestions
              suggestions={promptSuggestions}
              onSelect={handleSuggestionSelect}
              onClose={() => setShowSuggestionPanel(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments Tray */}
      {hasAttachments && (
        <div className="mb-3">
          <AttachmentTray />
        </div>
      )}

      {/* Main Input Area */}
      <div
        ref={dropZoneRef}
        className={`relative rounded-xl border-2 transition-all duration-200 ${
          isDragging 
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
            : moderationWarning 
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20' 
              : isDarkMode 
                ? 'border-gray-600 bg-gray-800' 
                : 'border-gray-200 bg-white'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 rounded-xl z-10">
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-sm font-medium text-blue-600">Drop files to attach</p>
            </div>
          </div>
        )}

        {/* Role Selector */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Role:</span>
          <div className="flex flex-wrap gap-1">
            {roleOptions.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-full transition-colors ${
                  selectedRole === role.id
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={role.description}
              >
                <role.icon className="w-3 h-3" />
                {role.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isInputDisabled}
            className={`w-full min-h-[60px] max-h-[240px] p-4 bg-transparent border-none resize-none focus:outline-none ${
              isDarkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
            } ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ fontSize: accessibilityStore.fontSize }}
            aria-label="Message input"
            aria-describedby={moderationWarning ? 'moderation-warning' : undefined}
          />

          {/* Character count */}
          <div className={`absolute bottom-2 right-2 text-xs ${
            inputValue.length > maxLength * 0.9 
              ? 'text-red-500' 
              : isDarkMode 
                ? 'text-gray-400' 
                : 'text-gray-500'
          }`}>
            {inputValue.length}/{maxLength}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700">
          {/* Left side - Tools & Attachments */}
          <div className="flex items-center gap-2">
            {showAttachments && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isInputDisabled}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
                  } ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  accept="image/*,audio/*,.pdf,.txt,.doc,.docx,.json,.csv,.md"
                />
              </>
            )}

            {showVoiceInput && (
              <button
                onClick={handleVoiceToggle}
                disabled={isInputDisabled}
                className={`p-2 rounded-lg transition-colors ${
                  isRecording 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                    : isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
                } ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isRecording ? 'Stop recording' : 'Voice input'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {showTools && (
              <button
                onClick={() => setShowToolSelector(!showToolSelector)}
                disabled={isInputDisabled}
                className={`p-2 rounded-lg transition-colors ${
                  selectedTools.length > 0 || showToolSelector
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
                } ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Tools"
              >
                <Zap className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handlePromptRewrite}
              disabled={isInputDisabled || !inputValue.trim()}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
              } ${isInputDisabled || !inputValue.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Improve prompt"
            >
              <Wand2 className="w-4 h-4" />
            </button>

            {showSuggestions && (
              <button
                onClick={() => setShowSuggestionPanel(!showSuggestionPanel)}
                disabled={isInputDisabled}
                className={`p-2 rounded-lg transition-colors ${
                  showSuggestionPanel
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                    : isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
                } ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Prompt suggestions"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Center - Model & Cost Info */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {modelInfo && (
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{modelInfo.name}</span>
              </div>
            )}

            {tokenCount > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>{tokenCount} tokens</span>
              </div>
            )}

            {costEstimate > 0 && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span>${costEstimate.toFixed(4)}</span>
              </div>
            )}
          </div>

          {/* Right side - Submit/Stop & Settings */}
          <div className="flex items-center gap-2">
            {showParameters && (
              <button
                onClick={() => setShowParameterDrawer(!showParameterDrawer)}
                disabled={isInputDisabled}
                className={`p-2 rounded-lg transition-colors ${
                  showParameterDrawer
                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    : isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
                } ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Model parameters"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Submit or Stop button */}
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
                title="Stop generation"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isInputDisabled || !inputValue.trim() || !!moderationWarning}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  isInputDisabled || !inputValue.trim() || moderationWarning
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="Send message"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            )}
          </div>
        </div>

        {/* Moderation Warning */}
        {moderationWarning && (
          <ModerationOverlay
            warning={moderationWarning}
            onDismiss={() => setModerationWarning(null)}
          />
        )}
      </div>

      {/* Voice Input Component */}
      <VoiceInput
        isRecording={isRecording}
        onTranscription={(text) => setInputValue(prev => prev + text)}
        onStop={() => setIsRecording(false)}
      />
    </div>
  );
};

export default PromptInputZone;