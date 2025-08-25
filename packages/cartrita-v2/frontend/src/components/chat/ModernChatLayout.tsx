/**
 * Modern Chat Layout - ChatGPT/Claude Style
 * Main chat interface with sidebar and conversation area
 */
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  PlusIcon, 
  PaperAirplaneIcon, 
  PhotoIcon, 
  PaperClipIcon,
  SparklesIcon,
  ArrowPathIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ComputerDesktopIcon,
  CodeBracketIcon,
  AcademicCapIcon,
  PenIcon
} from '@heroicons/react/24/outline';
import { 
  HandThumbUpIcon as HandThumbUpSolid,
  HandThumbDownIcon as HandThumbDownSolid,
  SparklesIcon as SparklesSolid
} from '@heroicons/react/24/solid';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type: string;
  agent_id?: string;
  model_used?: string;
  tools_used?: any[];
  computer_actions?: any[];
  attachments?: any[];
  created_at: string;
  response_time_ms?: number;
  status: string;
  is_favorite?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  agent_id: string;
  session_type: string;
  updated_at: string;
  message_count: number;
  last_message_time: string;
}

interface ConversationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  suggested_agents: string[];
}

const AGENT_INFO = {
  'supervisor_cartrita_v2': {
    name: 'Supervisor',
    icon: '🎯',
    color: 'bg-blue-500',
    description: 'Coordinates tasks and manages workflows'
  },
  'research_agent_v2': {
    name: 'Research',
    icon: '🔍',
    color: 'bg-green-500',
    description: 'Web research and fact-finding'
  },
  'writer_agent_v2': {
    name: 'Writer',
    icon: '✍️',
    color: 'bg-purple-500',
    description: 'Content creation and writing'
  },
  'vision_agent_v2': {
    name: 'Vision',
    icon: '👁️',
    color: 'bg-orange-500',
    description: 'Image analysis and visual understanding'
  },
  'computer_use_agent_v2': {
    name: 'Computer Use',
    icon: '💻',
    color: 'bg-red-500',
    description: 'Desktop automation and GUI control'
  },
  'code_writer_agent_v2': {
    name: 'Code Writer',
    icon: '💻',
    color: 'bg-indigo-500',
    description: 'Programming and software development'
  }
};

const TEMPLATES: ConversationTemplate[] = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'General questions and tasks',
    category: 'general',
    suggested_agents: ['supervisor_cartrita_v2']
  },
  {
    id: 'coding',
    name: 'Code Assistant',
    description: 'Programming and development',
    category: 'coding',
    suggested_agents: ['code_writer_agent_v2']
  },
  {
    id: 'research',
    name: 'Research Assistant',
    description: 'Research and fact-finding',
    category: 'research',
    suggested_agents: ['research_agent_v2']
  },
  {
    id: 'writing',
    name: 'Writing Assistant',
    description: 'Content creation and writing',
    category: 'writing',
    suggested_agents: ['writer_agent_v2']
  },
  {
    id: 'computer',
    name: 'Computer Use',
    description: 'Desktop automation tasks',
    category: 'automation',
    suggested_agents: ['computer_use_agent_v2']
  }
];

export default function ModernChatLayout() {
  // State management
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ConversationTemplate | null>(null);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageFeedback, setMessageFeedback] = useState<Record<string, { type: string; given: boolean }>>({});
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat sessions
  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/chat/sessions');
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, []);

  // Load messages for a session
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/v2/chat/sessions/${sessionId}/messages`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []);

  // Create new chat session
  const createNewSession = async (template?: ConversationTemplate) => {
    try {
      const response = await fetch('/api/v2/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template ? `${template.name} Chat` : 'New Chat',
          agent_id: template?.suggested_agents[0] || 'supervisor_cartrita_v2',
          session_type: template?.category || 'chat',
          template_id: template?.id
        })
      });
      
      const data = await response.json();
      if (data.success) {
        const newSession = data.session;
        setSessions(prev => [newSession, ...prev]);
        setCurrentSession(newSession);
        setMessages([]);
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  // Send message with streaming response
  const sendMessage = async () => {
    if (!inputMessage.trim() || !currentSession || isStreamingResponse) {
      return;
    }

    const messageContent = inputMessage.trim();
    const messageAttachments = [...attachments];
    
    // Clear input immediately
    setInputMessage('');
    setAttachments([]);
    setIsStreamingResponse(true);

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageContent,
      content_type: 'text',
      created_at: new Date().toISOString(),
      status: 'completed',
      attachments: messageAttachments.map(f => ({ file_name: f.name, file_type: f.type, file_size: f.size }))
    };
    
    setMessages(prev => [...prev, userMessage]);

    try {
      // Prepare FormData for file upload
      const formData = new FormData();
      formData.append('content', messageContent);
      messageAttachments.forEach(file => {
        formData.append('attachments', file);
      });

      // Start Server-Sent Events connection
      eventSourceRef.current = new EventSource(
        `/api/v2/chat/sessions/${currentSession.id}/messages`,
        {
          method: 'POST',
          body: formData
        }
      );

      let assistantMessage: ChatMessage | null = null;
      let accumulatedContent = '';

      eventSourceRef.current.onmessage = (event) => {
        if (event.data === '[DONE]') {
          setIsStreamingResponse(false);
          eventSourceRef.current?.close();
          loadSessions(); // Refresh session list
          return;
        }

        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'user_message':
              // Update the temporary user message with real data
              setMessages(prev => prev.map(msg => 
                msg.id === userMessage.id ? { ...data.message, attachments: data.attachments } : msg
              ));
              break;

            case 'assistant_message_start':
              assistantMessage = {
                id: data.messageId,
                role: 'assistant',
                content: '',
                content_type: 'markdown',
                agent_id: currentSession.agent_id,
                created_at: new Date().toISOString(),
                status: 'streaming'
              };
              setMessages(prev => [...prev, assistantMessage!]);
              break;

            case 'assistant_message_chunk':
              accumulatedContent += data.chunk;
              setMessages(prev => prev.map(msg => 
                msg.id === data.messageId ? { ...msg, content: accumulatedContent } : msg
              ));
              break;

            case 'assistant_message_complete':
              setMessages(prev => prev.map(msg => 
                msg.id === data.message.id ? { ...data.message, status: 'completed' } : msg
              ));
              break;

            case 'error':
              console.error('Streaming error:', data.error);
              setIsStreamingResponse(false);
              break;
          }
        } catch (e) {
          console.error('Error parsing SSE data:', e);
        }
      };

      eventSourceRef.current.onerror = () => {
        setIsStreamingResponse(false);
        eventSourceRef.current?.close();
      };

    } catch (error) {
      console.error('Error sending message:', error);
      setIsStreamingResponse(false);
    }
  };

  // Handle message feedback
  const handleMessageFeedback = async (messageId: string, feedbackType: string) => {
    try {
      await fetch(`/api/v2/chat/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_type: feedbackType })
      });
      
      setMessageFeedback(prev => ({
        ...prev,
        [messageId]: { type: feedbackType, given: true }
      }));
    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  };

  // Handle file attachment
  const handleFileSelect = (files: FileList | null) => {
    if (!files) {
      return;
    }
    const newFiles = Array.from(files).slice(0, 5 - attachments.length);
    setAttachments(prev => [...prev, ...newFiles]);
  };

  // Auto-resize textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Update session title
  const updateSessionTitle = async (sessionId: string, title: string) => {
    try {
      await fetch(`/api/v2/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      
      setSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, title } : session
      ));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(prev => prev ? { ...prev, title } : null);
      }
    } catch (error) {
      console.error('Error updating session title:', error);
    }
  };

  // Effects
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.id);
    }
  }, [currentSession, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className=\"flex h-screen bg-gray-50 dark:bg-gray-900\">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden`}>
        {/* Sidebar Header */}
        <div className=\"p-4 border-b border-gray-200 dark:border-gray-700\">
          <button 
            onClick={() => setSelectedTemplate(TEMPLATES[0]) || createNewSession(TEMPLATES[0])}
            className=\"w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors\"
          >
            <PlusIcon className=\"w-5 h-5\" />
            New Chat
          </button>
        </div>

        {/* Template Selection */}
        {selectedTemplate && (
          <div className=\"p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700\">
            <h3 className=\"font-medium text-gray-900 dark:text-white mb-2\">Choose Template:</h3>
            <div className=\"space-y-2\">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => createNewSession(template)}
                  className=\"w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors\"
                >
                  <div className=\"font-medium text-gray-900 dark:text-white\">{template.name}</div>
                  <div className=\"text-sm text-gray-500 dark:text-gray-400\">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className=\"p-4 border-b border-gray-200 dark:border-gray-700\">
          <div className=\"relative\">
            <MagnifyingGlassIcon className=\"w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400\" />
            <input
              type=\"text\"
              placeholder=\"Search conversations...\"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className=\"w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
            />
          </div>
        </div>

        {/* Chat Sessions List */}
        <div className=\"flex-1 overflow-y-auto\">
          {sessions.filter(session => 
            !searchQuery || session.title.toLowerCase().includes(searchQuery.toLowerCase())
          ).map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSession(session)}
              className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                currentSession?.id === session.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className=\"flex items-start gap-3\">
                <div className={`w-8 h-8 rounded-full ${AGENT_INFO[session.agent_id as keyof typeof AGENT_INFO]?.color || 'bg-gray-500'} flex items-center justify-center text-white text-sm`}>
                  {AGENT_INFO[session.agent_id as keyof typeof AGENT_INFO]?.icon || '🤖'}
                </div>
                <div className=\"flex-1 min-w-0\">
                  <h3 className=\"font-medium text-gray-900 dark:text-white truncate\">{session.title}</h3>
                  <p className=\"text-sm text-gray-500 dark:text-gray-400 mt-1\">
                    {session.message_count} messages • {new Date(session.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className=\"flex-1 flex flex-col\">
        {/* Chat Header */}
        {currentSession && (
          <div className=\"p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between\">
            <div className=\"flex items-center gap-3\">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className=\"p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors lg:hidden\"
              >
                <EllipsisHorizontalIcon className=\"w-5 h-5\" />
              </button>
              
              <div className={`w-8 h-8 rounded-full ${AGENT_INFO[currentSession.agent_id as keyof typeof AGENT_INFO]?.color || 'bg-gray-500'} flex items-center justify-center text-white text-sm`}>
                {AGENT_INFO[currentSession.agent_id as keyof typeof AGENT_INFO]?.icon || '🤖'}
              </div>
              
              <div>
                <h1 className=\"font-semibold text-gray-900 dark:text-white\">{currentSession.title}</h1>
                <p className=\"text-sm text-gray-500 dark:text-gray-400\">
                  {AGENT_INFO[currentSession.agent_id as keyof typeof AGENT_INFO]?.description || 'AI Assistant'}
                </p>
              </div>
            </div>
            
            <div className=\"flex items-center gap-2\">
              <button className=\"p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors\">
                <AdjustmentsHorizontalIcon className=\"w-5 h-5 text-gray-600 dark:text-gray-300\" />
              </button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className=\"flex-1 overflow-y-auto bg-white dark:bg-gray-900\">
          {!currentSession ? (
            <div className=\"h-full flex items-center justify-center\">
              <div className=\"text-center max-w-md mx-auto p-8\">
                <SparklesSolid className=\"w-16 h-16 text-blue-500 mx-auto mb-4\" />
                <h2 className=\"text-2xl font-semibold text-gray-900 dark:text-white mb-2\">
                  Welcome to Cartrita V2
                </h2>
                <p className=\"text-gray-600 dark:text-gray-300 mb-6\">
                  Start a new conversation with our AI agents or select from conversation templates.
                </p>
                <button
                  onClick={() => setSelectedTemplate(TEMPLATES[0])}
                  className=\"inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors\"
                >
                  <PlusIcon className=\"w-5 h-5\" />
                  Start New Chat
                </button>
              </div>
            </div>
          ) : (
            <div className=\"max-w-4xl mx-auto\">
              {messages.map((message, index) => (
                <div key={message.id || index} className={`p-6 ${message.role === 'assistant' ? 'bg-gray-50 dark:bg-gray-800' : ''}`}>
                  <div className=\"flex gap-4 max-w-none\">
                    {/* Avatar */}
                    <div className=\"flex-shrink-0\">
                      {message.role === 'user' ? (
                        <div className=\"w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium\">
                          U
                        </div>
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${AGENT_INFO[message.agent_id as keyof typeof AGENT_INFO]?.color || 'bg-gray-500'} flex items-center justify-center text-white text-sm`}>
                          {AGENT_INFO[message.agent_id as keyof typeof AGENT_INFO]?.icon || '🤖'}
                        </div>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className=\"flex-1 min-w-0\">
                      {/* Message Header */}
                      {message.role === 'assistant' && (
                        <div className=\"flex items-center gap-2 mb-2\">
                          <span className=\"font-medium text-gray-900 dark:text-white\">
                            {AGENT_INFO[message.agent_id as keyof typeof AGENT_INFO]?.name || 'AI Assistant'}
                          </span>
                          {message.model_used && (
                            <span className=\"text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded\">
                              {message.model_used}
                            </span>
                          )}
                          {message.response_time_ms && (
                            <span className=\"text-xs text-gray-500 dark:text-gray-400\">
                              {message.response_time_ms}ms
                            </span>
                          )}
                        </div>
                      )}

                      {/* Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className=\"mb-3 flex flex-wrap gap-2\">
                          {message.attachments.map((attachment, idx) => (
                            <div key={idx} className=\"inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm\">
                              <PaperClipIcon className=\"w-4 h-4\" />
                              {attachment.file_name}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Message Text */}
                      <div className={`prose max-w-none ${message.status === 'streaming' ? 'animate-pulse' : ''} ${
                        message.role === 'assistant' ? 'prose-gray dark:prose-invert' : 'prose-blue dark:prose-invert'
                      }`}>
                        {message.content_type === 'markdown' ? (
                          <div dangerouslySetInnerHTML={{ __html: message.content.replace(/\\n/g, '<br>') }} />
                        ) : (
                          <p className=\"whitespace-pre-wrap\">{message.content}</p>
                        )}
                      </div>

                      {/* Tools Used */}
                      {message.tools_used && message.tools_used.length > 0 && (
                        <div className=\"mt-3 flex flex-wrap gap-1\">
                          {message.tools_used.map((tool, idx) => (
                            <span key={idx} className=\"inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded text-xs\">
                              <span className=\"w-2 h-2 bg-green-500 rounded-full\"></span>
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Computer Actions */}
                      {message.computer_actions && message.computer_actions.length > 0 && (
                        <div className=\"mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg\">
                          <div className=\"flex items-center gap-2 mb-2\">
                            <ComputerDesktopIcon className=\"w-4 h-4 text-purple-600\" />
                            <span className=\"text-sm font-medium text-purple-800 dark:text-purple-200\">
                              Computer Actions: {message.computer_actions.length}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Message Actions */}
                      {message.role === 'assistant' && message.status === 'completed' && (
                        <div className=\"mt-4 flex items-center gap-2\">
                          <button
                            onClick={() => handleMessageFeedback(message.id, 'thumbs_up')}
                            className={`p-2 rounded-lg transition-colors ${
                              messageFeedback[message.id]?.type === 'thumbs_up' 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600' 
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                            }`}
                          >
                            {messageFeedback[message.id]?.type === 'thumbs_up' ? 
                              <HandThumbUpSolid className=\"w-4 h-4\" /> : 
                              <HandThumbUpIcon className=\"w-4 h-4\" />
                            }
                          </button>
                          
                          <button
                            onClick={() => handleMessageFeedback(message.id, 'thumbs_down')}
                            className={`p-2 rounded-lg transition-colors ${
                              messageFeedback[message.id]?.type === 'thumbs_down' 
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600' 
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                            }`}
                          >
                            {messageFeedback[message.id]?.type === 'thumbs_down' ? 
                              <HandThumbDownSolid className=\"w-4 h-4\" /> : 
                              <HandThumbDownIcon className=\"w-4 h-4\" />
                            }
                          </button>
                          
                          <button
                            onClick={() => navigator.clipboard.writeText(message.content)}
                            className=\"p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors\"
                          >
                            <DocumentDuplicateIcon className=\"w-4 h-4\" />
                          </button>
                          
                          <button
                            onClick={() => handleMessageFeedback(message.id, 'regenerate')}
                            className=\"p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors\"
                          >
                            <ArrowPathIcon className=\"w-4 h-4\" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isStreamingResponse && (
                <div className=\"p-6 bg-gray-50 dark:bg-gray-800\">
                  <div className=\"flex gap-4\">
                    <div className={`w-8 h-8 rounded-full ${AGENT_INFO[currentSession.agent_id as keyof typeof AGENT_INFO]?.color || 'bg-gray-500'} flex items-center justify-center text-white text-sm`}>
                      {AGENT_INFO[currentSession.agent_id as keyof typeof AGENT_INFO]?.icon || '🤖'}
                    </div>
                    <div className=\"flex-1\">
                      <div className=\"flex items-center gap-2 mb-2\">
                        <span className=\"font-medium text-gray-900 dark:text-white\">
                          {AGENT_INFO[currentSession.agent_id as keyof typeof AGENT_INFO]?.name || 'AI Assistant'}
                        </span>
                        <div className=\"flex space-x-1\">
                          <div className=\"w-2 h-2 bg-blue-500 rounded-full animate-bounce\"></div>
                          <div className=\"w-2 h-2 bg-blue-500 rounded-full animate-bounce\" style={{ animationDelay: '0.1s' }}></div>
                          <div className=\"w-2 h-2 bg-blue-500 rounded-full animate-bounce\" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        {currentSession && (
          <div className=\"p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700\">
            <div className=\"max-w-4xl mx-auto\">
              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className=\"mb-3 flex flex-wrap gap-2\">
                  {attachments.map((file, index) => (
                    <div key={index} className=\"inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm\">
                      <PaperClipIcon className=\"w-4 h-4\" />
                      {file.name}
                      <button
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                        className=\"ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-1\"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className=\"flex items-end gap-3\">
                {/* File Upload */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreamingResponse || attachments.length >= 5}
                  className=\"p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors\"
                >
                  <PaperClipIcon className=\"w-5 h-5 text-gray-600 dark:text-gray-300\" />
                </button>
                
                <input
                  ref={fileInputRef}
                  type=\"file\"
                  multiple
                  accept=\"image/*,.pdf,.txt,.md,.py,.js,.ts,.json\"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className=\"hidden\"
                />

                {/* Message Input */}
                <div className=\"flex-1 relative\">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={handleTextareaInput}
                    onKeyDown={handleKeyDown}
                    placeholder={isStreamingResponse ? 'AI is responding...' : 'Type your message...'}
                    disabled={isStreamingResponse}
                    rows={1}
                    className=\"w-full resize-none rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed\"
                    style={{ maxHeight: '200px' }}
                  />
                  
                  {/* Send Button */}
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isStreamingResponse}
                    className=\"absolute right-2 bottom-2 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors\"
                  >
                    <PaperAirplaneIcon className=\"w-4 h-4 text-white\" />
                  </button>
                </div>
              </div>
              
              <div className=\"mt-2 text-xs text-gray-500 dark:text-gray-400 text-center\">
                Press Enter to send, Shift+Enter for new line
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}