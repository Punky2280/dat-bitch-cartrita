/**
 * Enhanced Chat Interface - Cartrita V2
 * Advanced AI chat with comprehensive features, agent selection, and real-time capabilities
 */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  SparklesIcon,
  ChevronDownIcon,
  PhotoIcon,
  DocumentIcon,
  MicrophoneIcon,
  StopIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  BoltIcon,
  CpuChipIcon,
  EyeIcon,
  AcademicCapIcon,
  CodeBracketIcon,
  PencilIcon,
  UserGroupIcon,
  XMarkIcon,
  FaceFrownIcon,
  FaceSmileIcon,
  HeartIcon,
  HandThumbUpIcon,
} from '@heroicons/react/24/outline';
import { useDropzone } from 'react-dropzone';
import { apiClient } from '@/lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_id?: string;
  timestamp: string;
  type?: 'text' | 'image' | 'file' | 'code';
  metadata?: {
    model?: string;
    tokens?: number;
    processing_time?: number;
    confidence?: number;
    source?: string;
  };
  reactions?: string[];
}

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  capabilities: string[];
  status: 'online' | 'busy' | 'offline';
  model: string;
  specialization: string;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messageCount: number;
  agents: string[];
}

// Agent data will be fetched from backend

export default function EnhancedChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string>('default');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Fetch agents from backend
  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/v2/agents');
      const result = await response.json();
      
      if (result.success && result.data) {
        const mappedAgents: Agent[] = result.data.map((agent: any) => {
          const getIcon = (agentId: string) => {
            switch (agentId) {
              case 'supervisor_cartrita_v2': return '👥';
              case 'research_agent_v2': return '🔍';
              case 'writer_agent_v2': return '✍️';
              case 'vision_agent_v2': return '👁️';
              case 'computer_use_agent_v2': return '🖥️';
              case 'code_writer_agent_v2': return '💻';
              default: return '🤖';
            }
          };

          const getColor = (agentId: string) => {
            switch (agentId) {
              case 'supervisor_cartrita_v2': return { color: 'text-blue-600', bgColor: 'bg-blue-500' };
              case 'research_agent_v2': return { color: 'text-green-600', bgColor: 'bg-green-500' };
              case 'writer_agent_v2': return { color: 'text-purple-600', bgColor: 'bg-purple-500' };
              case 'vision_agent_v2': return { color: 'text-pink-600', bgColor: 'bg-pink-500' };
              case 'computer_use_agent_v2': return { color: 'text-red-600', bgColor: 'bg-red-500' };
              case 'code_writer_agent_v2': return { color: 'text-indigo-600', bgColor: 'bg-indigo-500' };
              default: return { color: 'text-gray-600', bgColor: 'bg-gray-500' };
            }
          };

          const colors = getColor(agent.id);
          const modelDisplay = agent.model?.toUpperCase() || 'GPT-5';

          return {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            icon: getIcon(agent.id),
            color: colors.color,
            bgColor: colors.bgColor,
            capabilities: agent.capabilities || [],
            status: agent.status === 'idle' ? 'online' : agent.status,
            model: modelDisplay,
            specialization: agent.description
          };
        });

        setAgents(mappedAgents);
        if (mappedAgents.length > 0 && !selectedAgent) {
          setSelectedAgent(mappedAgents[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputMessage]);

  // File drop handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('Files dropped:', acceptedFiles);
    setUploadedFiles(prev => [...prev, ...acceptedFiles]);
    
    // Show visual feedback
    const fileNames = acceptedFiles.map(f => f.name).join(', ');
    const fileMessage: ChatMessage = {
      id: `file-${Date.now()}`,
      role: 'system',
      content: `📎 Files attached: ${fileNames}`,
      timestamp: new Date().toISOString(),
      type: 'file'
    };
    setMessages(prev => [...prev, fileMessage]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      'image/*': [],
      'text/*': [],
      'application/pdf': [],
      'application/json': [],
      'application/javascript': [],
    }
  });

  // Microphone functionality
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        handleAudioRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks([]);
      setIsRecording(true);

      // Show recording indicator message
      const recordingMessage: ChatMessage = {
        id: `recording-${Date.now()}`,
        role: 'system',
        content: '🎤 Recording audio...',
        timestamp: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => [...prev, recordingMessage]);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleAudioRecording = async (audioBlob: Blob) => {
    try {
      // Create a File object from the blob
      const audioFile = new File([audioBlob], `recording-${Date.now()}.wav`, { type: 'audio/wav' });
      
      const audioMessage: ChatMessage = {
        id: `audio-${Date.now()}`,
        role: 'system',
        content: `🎵 Audio recording captured (${(audioBlob.size / 1024).toFixed(1)}KB). Processing...`,
        timestamp: new Date().toISOString(),
        type: 'file'
      };
      setMessages(prev => [...prev, audioMessage]);

      try {
        // Attempt speech-to-text transcription using the API client
        const transcriptionResult = await apiClient.transcribeAudio(audioFile, {
          language: 'en',
          model: 'whisper-1'
        });
        
        // If transcription successful, set it as input text and remove the processing message
        if (transcriptionResult.text) {
          setInputMessage(transcriptionResult.text);
          setMessages(prev => prev.filter(msg => msg.id !== audioMessage.id));
          
          // Show success message
          const successMessage: ChatMessage = {
            id: `transcription-${Date.now()}`,
            role: 'system',
            content: `✅ Audio transcribed: "${transcriptionResult.text.substring(0, 50)}${transcriptionResult.text.length > 50 ? '...' : ''}}"`,
            timestamp: new Date().toISOString(),
            type: 'text'
          };
          setMessages(prev => [...prev, successMessage]);
        } else {
          throw new Error('No transcription text received');
        }
      } catch (transcriptionError) {
        console.error('Speech-to-text failed:', transcriptionError);
        
        // Fallback: add audio file to uploaded files for manual handling
        setUploadedFiles(prev => [...prev, audioFile]);
        
        // Update the processing message to show fallback
        setMessages(prev => prev.map(msg => 
          msg.id === audioMessage.id 
            ? { ...msg, content: `🎵 Audio file attached (${(audioBlob.size / 1024).toFixed(1)}KB). Speech-to-text unavailable - file will be sent with your next message.` }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error handling audio recording:', error);
      
      const errorMessage: ChatMessage = {
        id: `audio-error-${Date.now()}`,
        role: 'system',
        content: '❌ Failed to process audio recording',
        timestamp: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Handle key press in textarea
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !selectedAgent) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    const messageText = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setShowQuickActions(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          user_id: 'frontend_user',
          agent_id: selectedAgent.id,
          session_id: currentSession,
          attachments: uploadedFiles.length > 0 ? uploadedFiles.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type
          })) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || data.message || data.error || 'I apologize, but I encountered an error processing your request.',
        agent_id: data.agent_id || selectedAgent.id,
        timestamp: new Date().toISOString(),
        type: 'text',
        metadata: {
          model: data.model,
          tokens: data.tokens,
          processing_time: data.processing_time,
          confidence: data.confidence,
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Clear uploaded files after successful send
      setUploadedFiles([]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check the connection and try again.',
        timestamp: new Date().toISOString(),
        type: 'text',
        metadata: { confidence: 0 }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };


  const clearChat = () => {
    setMessages([]);
    setShowQuickActions(true);
  };

  const regenerateResponse = async (messageId: string) => {
    if (isLoading || !selectedAgent) return;

    // Find the message to regenerate
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const messageToRegenerate = messages[messageIndex];
    
    // Find the user message that prompted this response
    let userMessage = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (!userMessage) return;

    // Remove the old response and any messages after it
    setMessages(prev => prev.slice(0, messageIndex));
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          user_id: 'frontend_user',
          agent_id: selectedAgent.id,
          session_id: currentSession,
          regenerate: true, // Flag to indicate this is a regeneration
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const newAssistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || data.message || data.error || 'I apologize, but I encountered an error processing your request.',
        agent_id: data.agent_id || selectedAgent.id,
        timestamp: new Date().toISOString(),
        type: 'text',
        metadata: {
          model: data.model,
          tokens: data.tokens,
          processing_time: data.processing_time,
          confidence: data.confidence,
        }
      };

      setMessages(prev => [...prev, newAssistantMessage]);
    } catch (error) {
      console.error('Error regenerating response:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error while regenerating the response. Please try again.',
        timestamp: new Date().toISOString(),
        type: 'text',
        metadata: { confidence: 0 }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Could add a toast notification here for user feedback
      console.log('Message copied to clipboard');
    } catch (error) {
      console.error('Failed to copy message:', error);
      // Fallback: try to select text for manual copy
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Message copied using fallback method');
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  const addReaction = (messageId: string, reaction: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || [];
        const newReactions = reactions.includes(reaction) 
          ? reactions.filter(r => r !== reaction)
          : [...reactions, reaction];
        return { ...msg, reactions: newReactions };
      }
      return msg;
    }));
  };

  const quickActions = [
    {
      text: "Analyze system performance",
      icon: BoltIcon,
      color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      text: "Generate code example",
      icon: CodeBracketIcon,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
    },
    {
      text: "Research latest trends",
      icon: AcademicCapIcon,
      color: "text-green-600 bg-green-50 dark:bg-green-900/20"
    },
    {
      text: "Create documentation",
      icon: DocumentIcon,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20"
    },
  ];

  // Show loading state while agents are being fetched
  if (!selectedAgent || agents.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Chat
            </h1>
          </div>
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">All Agents Online</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Clear Chat
            </button>
          )}
          
          {/* Agent Selector */}
          <div className="relative">
            <button
              onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className={`w-6 h-6 rounded-full ${selectedAgent.bgColor} flex items-center justify-center`}>
                <span className="text-xs text-white">{selectedAgent.icon}</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white hidden sm:block">
                {selectedAgent.name}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            </button>
            
            <AnimatePresence>
              {isAgentDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto"
                >
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgent(agent);
                        setIsAgentDropdownOpen(false);
                      }}
                      className="w-full flex items-start space-x-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-xl last:rounded-b-xl transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full ${agent.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-lg text-white">{agent.icon}</span>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {agent.name}
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${
                              agent.status === 'online' ? 'bg-green-500' :
                              agent.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                            }`}></div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{agent.model}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                          {agent.description}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities.slice(0, 3).map((capability) => (
                            <span
                              key={capability}
                              className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                            >
                              {capability}
                            </span>
                          ))}
                          {agent.capabilities.length > 3 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              +{agent.capabilities.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedAgent.id === agent.id && (
                        <div className="w-3 h-3 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50 dark:bg-gray-900">
        {messages.length === 0 && showQuickActions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6">
              <SparklesIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Welcome to Cartrita V2
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Your advanced AI orchestration platform with 15+ specialized agents. 
              Choose an agent and start a conversation, or try one of these quick actions:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.text}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                  onClick={() => setInputMessage(action.text)}
                  className={`flex items-center space-x-3 p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all ${action.color} text-left`}
                >
                  <action.icon className="w-6 h-6 flex-shrink-0" />
                  <span className="font-medium">{action.text}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-4xl rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white ml-12'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-700 mr-12'
                } relative group`}
              >
                {message.role === 'assistant' && message.agent_id && (
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full ${agents.find(a => a.id === message.agent_id)?.bgColor || 'bg-gray-500'} flex items-center justify-center`}>
                        <span className="text-xs text-white">
                          {agents.find(a => a.id === message.agent_id)?.icon || '🤖'}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {agents.find(a => a.id === message.agent_id)?.name || 'AI Assistant'}
                      </span>
                      {message.metadata?.model && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {message.metadata.model}
                        </span>
                      )}
                    </div>
                    {message.metadata?.confidence && (
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${
                          message.metadata.confidence > 0.8 ? 'bg-green-500' :
                          message.metadata.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {Math.round(message.metadata.confidence * 100)}% confidence
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-2">
                  <div className={`text-xs ${
                    message.role === 'user' 
                      ? 'text-blue-200' 
                      : 'text-gray-500 dark:text-gray-400'
                  } flex items-center space-x-2`}>
                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                    {message.metadata?.processing_time && (
                      <span>• {message.metadata.processing_time}ms</span>
                    )}
                    {message.metadata?.tokens && (
                      <span>• {message.metadata.tokens} tokens</span>
                    )}
                  </div>
                  
                  {message.role === 'assistant' && (
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyMessage(message.content)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Copy message"
                      >
                        <ClipboardDocumentIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => regenerateResponse(message.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Regenerate response"
                      >
                        <ArrowPathIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Message Reactions */}
                {message.role === 'assistant' && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => addReaction(message.id, '👍')}
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs ${
                          message.reactions?.includes('👍') ? 'bg-blue-100 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        👍 {(message.reactions?.filter(r => r === '👍').length || 0).toString()}
                      </button>
                      <button
                        onClick={() => addReaction(message.id, '❤️')}
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs ${
                          message.reactions?.includes('❤️') ? 'bg-red-100 dark:bg-red-900/20' : ''
                        }`}
                      >
                        ❤️ {(message.reactions?.filter(r => r === '❤️').length || 0).toString()}
                      </button>
                      <button
                        onClick={() => addReaction(message.id, '🤔')}
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs ${
                          message.reactions?.includes('🤔') ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''
                        }`}
                      >
                        🤔 {(message.reactions?.filter(r => r === '🤔').length || 0).toString()}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-4xl bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700 mr-12">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`w-6 h-6 rounded-full ${selectedAgent.bgColor} flex items-center justify-center`}>
                  <span className="text-xs text-white">{selectedAgent.icon}</span>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selectedAgent.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">is thinking...</span>
              </div>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        {isDragActive && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <PhotoIcon className="w-12 h-12 text-blue-500 mx-auto mb-2" />
              <p className="text-blue-700 dark:text-blue-300 font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}
        
        <div className="flex items-end space-x-3 max-w-6xl mx-auto">
          <div className="flex space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Upload file"
            >
              <PhotoIcon className="h-6 w-6" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,text/*,.pdf"
              onChange={(e) => {
                if (e.target.files) {
                  onDrop(Array.from(e.target.files));
                }
              }}
            />
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 transition-colors ${
                isRecording 
                  ? 'text-red-500 hover:text-red-600' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? <StopIcon className="h-6 w-6" /> : <MicrophoneIcon className="h-6 w-6" />}
            </button>
          </div>
          
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${selectedAgent.name}...`}
              rows={1}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
              disabled={isLoading}
              style={{ minHeight: '52px', maxHeight: '120px' }}
            />
            <div className="absolute right-2 bottom-2 text-xs text-gray-400">
              Shift+Enter for new line
            </div>
          </div>
          
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className={`p-3 rounded-2xl transition-all ${
              inputMessage.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}