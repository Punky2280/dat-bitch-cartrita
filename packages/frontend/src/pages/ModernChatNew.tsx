import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  Image, 
  Code, 
  Bot, 
  User, 
  RefreshCw, 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  MoreHorizontal,
  Sparkles,
  Zap,
  Brain,
  MessageSquare,
  Plus,
  Trash2,
  Archive,
  Share,
  BookOpen,
  Lightbulb,
  Clock,
  CheckCircle,
  Download,
  Edit3,
  BarChart3
} from 'lucide-react';
import { useApp } from '../context/AppContext';

// Types
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  attachments?: any[];
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
}

// Modern Chat Interface
export const ModernChat: React.FC = () => {
  const { state, actions } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [currentModel, setCurrentModel] = useState('Cartrita-GPT');
  const [selectedSession, setSelectedSession] = useState('current');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use messages from context
  const messages = state.chat.messages;
  const isTyping = state.chat.isTyping;

  // Sample chat sessions
  const chatSessions = [
    {
      id: 'current',
      title: 'New Chat',
      lastMessage: messages.length > 0 ? messages[messages.length - 1].content.substring(0, 50) + '...' : 'Start a new conversation',
      timestamp: 'Now',
      messageCount: messages.length
    },
    {
      id: 'analysis-session',
      title: 'Data Analysis Project',
      lastMessage: 'Here\'s the pandas DataFrame optimization...',
      timestamp: 'Yesterday',
      messageCount: 28
    },
    ...state.chat.sessions.map(session => ({
      id: session.id,
      title: session.title,
      lastMessage: session.messages.length > 0 ? session.messages[session.messages.length - 1].content.substring(0, 50) + '...' : 'Empty session',
      timestamp: new Date(session.updatedAt).toLocaleString(),
      messageCount: session.messages.length
    }))
  ];

  // Suggested prompts
  const suggestedPrompts = [
    {
      icon: Code,
      text: "Help me debug this Python code",
      category: "Development"
    },
    {
      icon: BarChart3,
      text: "Analyze this dataset and find patterns",
      category: "Analysis"
    },
    {
      icon: Lightbulb,
      text: "Brainstorm ideas for my startup",
      category: "Creative"
    },
    {
      icon: BookOpen,
      text: "Explain quantum computing concepts",
      category: "Learning"
    }
  ];

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || state.chat.isTyping) return;

    try {
      // Send message using the app context
      await actions.sendMessage(inputValue, state.chat.currentSession?.id);
      setInputValue('');
    } catch (error) {
      console.error('Failed to send message:', error);
      actions.showNotification('error', 'Failed to send message');
    }
  };

  // Handle prompt suggestion click
  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  // Copy message content
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    actions.showNotification('success', 'Message copied to clipboard');
  };

  // Create new chat session
  const createNewChat = async () => {
    try {
      const session = await actions.createChatSession();
      setSelectedSession(session.id);
      actions.showNotification('success', 'New chat session created');
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  // Handle session selection
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSession(sessionId);
    if (sessionId !== 'current') {
      actions.loadChatHistory(sessionId);
    }
  };

  // Initialize chat data
  useEffect(() => {
    if (state.chat.sessions.length === 0) {
      actions.loadChatSessions();
    }
    
    // Load initial welcome message if no messages
    if (messages.length === 0) {
      // Add welcome message if this is first load
      const welcomeMessage = {
        id: 'welcome',
        role: 'assistant' as const,
        content: `Hello! I'm Cartrita, your advanced AI assistant. I'm here to help you with anything you need - from coding and analysis to creative projects and problem-solving. 

I have access to multiple AI agents and can handle complex multi-step tasks. What would you like to work on today?`,
        timestamp: new Date(),
        status: 'sent' as const,
        metadata: {
          model: 'Cartrita-GPT',
          processingTime: 234
        }
      };
      // Only add welcome message if no messages exist
      if (messages.length === 0) {
        // You can call actions.addMessage here once implemented
        console.log('Welcome message ready to be added');
      }
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Sidebar */}
      <div className="w-80 bg-slate-900/50 backdrop-blur border-r border-slate-700 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-700">
          <button 
            onClick={createNewChat}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Chat Sessions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
            Recent Chats
          </div>
          {chatSessions.map((session) => (
            <motion.button
              key={session.id}
              onClick={() => handleSessionSelect(session.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full text-left p-3 rounded-lg transition-all group ${
                selectedSession === session.id
                  ? 'bg-slate-800 border border-slate-600'
                  : 'hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-white truncate">
                  {session.title}
                </h3>
                <span className="text-xs text-slate-400">
                  {session.messageCount}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mb-1">
                {session.lastMessage}
              </p>
              <span className="text-xs text-slate-500">
                {session.timestamp}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400 space-y-2">
            <div className="flex items-center justify-between">
              <span>Model:</span>
              <span className="text-cyan-400 font-medium">{currentModel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-400 font-medium">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/30 backdrop-blur">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Cartrita AI Assistant</h2>
              <p className="text-xs text-slate-400">Advanced Multi-Agent AI • Online</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Export Chat">
              <Download className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
            <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Share Chat">
              <Share className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
            <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Archive Chat">
              <Archive className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
            <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Clear Chat">
              <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Welcome Section for empty chat */}
            {messages.length === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Welcome to Cartrita AI
                </h2>
                <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
                  I'm your advanced AI assistant powered by a multi-agent system. I can help you with complex tasks, 
                  provide intelligent analysis, generate code, and much more. How can I assist you today?
                </p>

                {/* Suggested Prompts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {suggestedPrompts.map((prompt, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handlePromptClick(prompt.text)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="p-4 text-left border border-slate-700 hover:border-slate-600 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all group"
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <prompt.icon className="w-5 h-5 text-cyan-400" />
                        <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
                          {prompt.category}
                        </span>
                      </div>
                      <p className="text-sm text-white group-hover:text-cyan-100">
                        {prompt.text}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Messages */}
            <div className="space-y-8">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-start space-x-4 ${
                    message.role === 'user' ? 'justify-end' : ''
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  
                  <div className={`max-w-3xl ${message.role === 'user' ? 'order-first' : ''}`}>
                    <div className={`p-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white ml-12'
                        : 'bg-slate-800/50 border border-slate-700'
                    }`}>
                      <div className="prose prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                    </div>
                    
                    {/* Message Actions */}
                    <div className="flex items-center justify-between mt-2 px-2">
                      <div className="flex items-center space-x-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{message.timestamp.toLocaleTimeString()}</span>
                        {message.metadata && (
                          <>
                            <span>•</span>
                            <span>{message.metadata.processingTime}ms</span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => copyMessage(message.content)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                          title="Copy message"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {message.role === 'assistant' && (
                          <>
                            <button className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400 transition-colors" title="Good response">
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors" title="Poor response">
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        <button className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title="More options">
                          <MoreHorizontal className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start space-x-4"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                      <span className="text-sm text-slate-400">Cartrita is thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-700 bg-slate-900/30 backdrop-blur p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message Cartrita AI... (Press Enter to send, Shift+Enter for new line)"
                className="w-full px-4 py-4 pr-16 bg-slate-800 border border-slate-600 rounded-2xl text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: '56px', maxHeight: '200px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              
              {/* Input Actions */}
              <div className="absolute right-3 bottom-3 flex items-center space-x-2">
                <button
                  type="button"
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className={`p-2 rounded-lg transition-all ${
                    inputValue.trim() && !isTyping
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Input Footer */}
            <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
              <div className="flex items-center space-x-4">
                <span>Model: {currentModel}</span>
                <span>•</span>
                <span>Context: {messages.length} messages</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span>System ready</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ModernChat;