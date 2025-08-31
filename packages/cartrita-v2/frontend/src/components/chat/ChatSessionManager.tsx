'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  Trash2,
  Archive,
  Star,
  StarOff,
  Clock,
  User,
  Bot,
  Download,
  RefreshCw,
  Eye,
  Settings,
  Play,
  Pause,
  X
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  agent_id?: string;
  context?: Record<string, any>;
  message_count: number;
  last_message_preview?: string;
  is_starred?: boolean;
  is_archived?: boolean;
  status: 'active' | 'paused' | 'completed';
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  agent_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  attachments?: string[];
  tools_used?: string[];
}

interface ChatSessionManagerProps {
  darkMode: boolean;
}

const ChatSessionManager: React.FC<ChatSessionManagerProps> = ({ darkMode }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSession, setEditingSession] = useState<ChatSession | null>(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionAgent, setNewSessionAgent] = useState('supervisor');

  useEffect(() => {
    loadSessions();
  }, [filterStatus]);

  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession.id);
    }
  }, [selectedSession]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const sessionsData = await apiClient.getChatSessions(50, 0);
      
      // Transform the data and apply filters
      const transformedSessions = sessionsData.map(session => ({
        ...session,
        is_starred: session.context?.starred || false,
        is_archived: session.context?.archived || false,
        status: session.context?.status || 'active',
        last_message_preview: session.context?.last_message?.slice(0, 100) || ''
      }));

      const filteredSessions = transformedSessions.filter(session => {
        if (filterStatus !== 'all' && session.status !== filterStatus) {
          return false;
        }
        
        if (searchTerm && !session.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        
        return true;
      });

      setSessions(filteredSessions);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const messagesData = await apiClient.getChatMessages(sessionId, 100, 0);
      setMessages(messagesData);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const createSession = async () => {
    if (!newSessionTitle.trim()) {
      return;
    }

    try {
      const newSession = await apiClient.createChatSession(newSessionTitle, newSessionAgent);
      await loadSessions();
      setShowCreateModal(false);
      setNewSessionTitle('');
      setNewSessionAgent('supervisor');
      setSelectedSession(newSession);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const updateSession = async (sessionId: string, updates: Partial<ChatSession>) => {
    try {
      // Since V2 API doesn't have direct session update, we simulate with context updates
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const updatedContext = {
          ...session.context,
          ...updates,
          updated_at: new Date().toISOString()
        };

        // Update local state immediately for better UX
        setSessions(prev => prev.map(s => 
          s.id === sessionId 
            ? { ...s, ...updates, context: updatedContext }
            : s
        ));

        if (selectedSession && selectedSession.id === sessionId) {
          setSelectedSession(prev => prev ? { ...prev, ...updates } : null);
        }
      }
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat session? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const toggleSessionStar = async (session: ChatSession) => {
    await updateSession(session.id, { is_starred: !session.is_starred });
  };

  const toggleSessionArchive = async (session: ChatSession) => {
    await updateSession(session.id, { 
      is_archived: !session.is_archived,
      status: session.is_archived ? 'active' : 'completed'
    });
  };

  const exportSession = async (session: ChatSession) => {
    try {
      const sessionData = {
        session,
        messages: await apiClient.getChatMessages(session.id, 1000, 0)
      };

      const blob = new Blob([JSON.stringify(sessionData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-session-${session.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export session:', error);
    }
  };

  const filteredSessions = sessions.filter(session => {
    if (searchTerm && !session.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Sessions Sidebar */}
      <div className={`w-1/3 border-r ${
        darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white/50'
      } flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Chat Sessions
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="New Session"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={loadSessions}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sessions..."
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                darkMode 
                  ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' 
                  : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
              } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            />
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className={`w-full px-3 py-2 rounded-lg border ${
              darkMode 
                ? 'border-gray-600 bg-gray-700 text-white' 
                : 'border-gray-300 bg-white text-gray-900'
            } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
          >
            <option value="all">All Sessions</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className={`w-6 h-6 border-2 border-t-transparent rounded-full ${
                  darkMode ? 'border-purple-400' : 'border-purple-600'
                }`}
              />
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredSessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg cursor-pointer transition-all group relative ${
                    selectedSession?.id === session.id
                      ? (darkMode ? 'bg-purple-900/30 border border-purple-500/30' : 'bg-purple-50 border border-purple-200')
                      : (darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')
                  }`}
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium truncate ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {session.title}
                        </h3>
                        {session.is_starred && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                        {session.is_archived && (
                          <Archive className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                      
                      <div className={`text-xs flex items-center gap-2 mb-1 ${
                        darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        <span>{session.message_count} messages</span>
                        <span>•</span>
                        <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                      </div>
                      
                      {session.last_message_preview && (
                        <p className={`text-xs truncate ${
                          darkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {session.last_message_preview}
                        </p>
                      )}
                      
                      <div className={`flex items-center gap-1 mt-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          session.status === 'active' ? 'bg-green-500' :
                          session.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`} />
                        <span className="text-xs capitalize">{session.status}</span>
                        {session.agent_id && (
                          <>
                            <span className="text-xs">•</span>
                            <span className="text-xs">{session.agent_id}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Session Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSessionStar(session);
                          }}
                          className={`p-1 rounded transition-colors ${
                            session.is_starred 
                              ? 'text-yellow-500 hover:text-yellow-600' 
                              : (darkMode ? 'text-gray-400 hover:text-yellow-400' : 'text-gray-500 hover:text-yellow-500')
                          }`}
                          title={session.is_starred ? 'Remove star' : 'Add star'}
                        >
                          {session.is_starred ? (
                            <Star className="w-3 h-3 fill-current" />
                          ) : (
                            <StarOff className="w-3 h-3" />
                          )}
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSession(session);
                            setShowEditModal(true);
                          }}
                          className={`p-1 rounded transition-colors ${
                            darkMode ? 'text-gray-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-500'
                          }`}
                          title="Edit session"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportSession(session);
                          }}
                          className={`p-1 rounded transition-colors ${
                            darkMode ? 'text-gray-400 hover:text-green-400' : 'text-gray-500 hover:text-green-500'
                          }`}
                          title="Export session"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                          className={`p-1 rounded transition-colors ${
                            darkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'
                          }`}
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {filteredSessions.length === 0 && !loading && (
                <div className="text-center p-8">
                  <MessageSquare className={`w-12 h-12 mx-auto mb-3 ${
                    darkMode ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <p className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    No chat sessions found
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Create First Session
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages Panel */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            {/* Session Header */}
            <div className={`p-4 border-b ${
              darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white/50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-semibold ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {selectedSession.title}
                  </h3>
                  <p className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {selectedSession.message_count} messages • Agent: {selectedSession.agent_id || 'supervisor'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    selectedSession.status === 'active' ? 'bg-green-100 text-green-700' :
                    selectedSession.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedSession.status}
                  </span>
                  
                  <button
                    onClick={() => updateSession(selectedSession.id, {
                      status: selectedSession.status === 'active' ? 'paused' : 'active'
                    })}
                    className={`p-2 rounded-lg transition-colors ${
                      darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title={selectedSession.status === 'active' ? 'Pause session' : 'Resume session'}
                  >
                    {selectedSession.status === 'active' ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className={`w-6 h-6 border-2 border-t-transparent rounded-full ${
                      darkMode ? 'border-purple-400' : 'border-purple-600'
                    }`}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          darkMode ? 'bg-purple-900/50' : 'bg-purple-100'
                        }`}>
                          <Bot className="w-4 h-4 text-purple-600" />
                        </div>
                      )}
                      
                      <div className={`max-w-[70%] ${
                        message.role === 'user' ? 'order-first' : ''
                      }`}>
                        <div className={`p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : (darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900')
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          
                          {message.tools_used && message.tools_used.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-600 dark:border-gray-300">
                              <p className="text-xs opacity-75">
                                Tools used: {message.tools_used.join(', ')}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className={`text-xs mt-1 ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        } ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                          {message.agent_id && message.role === 'assistant' && (
                            <span> • {message.agent_id}</span>
                          )}
                        </div>
                      </div>
                      
                      {message.role === 'user' && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          darkMode ? 'bg-blue-900/50' : 'bg-blue-100'
                        }`}>
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {messages.length === 0 && (
                    <div className="text-center p-8">
                      <MessageSquare className={`w-12 h-12 mx-auto mb-3 ${
                        darkMode ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                      <p className={`text-sm ${
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        No messages in this session yet
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${
                darkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`text-lg font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Select a chat session
              </h3>
              <p className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Choose a session from the sidebar to view messages
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-md rounded-2xl shadow-2xl ${
                darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Create New Chat Session</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Session Title
                    </label>
                    <input
                      type="text"
                      value={newSessionTitle}
                      onChange={(e) => setNewSessionTitle(e.target.value)}
                      placeholder="Enter session title..."
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'border-gray-600 bg-gray-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Agent
                    </label>
                    <select
                      value={newSessionAgent}
                      onChange={(e) => setNewSessionAgent(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'border-gray-600 bg-gray-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    >
                      <option value="supervisor">Supervisor (General)</option>
                      <option value="retrieval_agent_v2">Retrieval Agent</option>
                      <option value="code_agent_v2">Code Agent</option>
                      <option value="dataviz_agent_v2">Data Visualization</option>
                      <option value="image_agent_v2">Image Agent</option>
                      <option value="audio_agent_v2">Audio Agent</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createSession}
                    disabled={!newSessionTitle.trim()}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Session
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Session Modal */}
      <AnimatePresence>
        {showEditModal && editingSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowEditModal(false);
              setEditingSession(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-md rounded-2xl shadow-2xl ${
                darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Edit Chat Session</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Session Title
                    </label>
                    <input
                      type="text"
                      value={editingSession.title}
                      onChange={(e) => setEditingSession({
                        ...editingSession,
                        title: e.target.value
                      })}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'border-gray-600 bg-gray-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Status
                    </label>
                    <select
                      value={editingSession.status}
                      onChange={(e) => setEditingSession({
                        ...editingSession,
                        status: e.target.value as any
                      })}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'border-gray-600 bg-gray-700 text-white' 
                          : 'border-gray-300 bg-white text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={editingSession.is_archived}
                      onChange={(e) => setEditingSession({
                        ...editingSession,
                        is_archived: e.target.checked
                      })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <label className={`text-sm ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Archive this session
                    </label>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingSession(null);
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                      darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await updateSession(editingSession.id, {
                        title: editingSession.title,
                        status: editingSession.status,
                        is_archived: editingSession.is_archived
                      });
                      setShowEditModal(false);
                      setEditingSession(null);
                      await loadSessions();
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatSessionManager;