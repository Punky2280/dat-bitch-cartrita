'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  MessageSquare, 
  MoreHorizontal, 
  Search,
  Settings,
  User,
  Send,
  Paperclip,
  ArrowUp,
  Sun,
  Moon,
  Menu,
  Edit,
  Trash2,
  Bot,
  Workflow,
  Sparkles,
  Users,
  Crown,
  Zap
} from 'lucide-react';
import AgentDashboard from '@/components/agents/AgentDashboard';
import MultiModalInterface from '@/components/multimodal/MultiModalInterface';
import WorkflowManager from '@/components/workflows/WorkflowManager';

// 🔥 DAT BITCH CARTRITA - Sassy Urban AI with Attitude 🔥
// Original color scheme: Bold purples, electric blues, hot pinks - street smart vibes
const ChatGPTLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [message, setMessage] = useState('');
  const [currentView, setCurrentView] = useState<'chat' | 'agents' | 'multimodal' | 'workflows'>('chat');
  const [conversations, setConversations] = useState([
    { id: 1, title: 'New chat', time: 'Just now' },
    { id: 2, title: 'Help me write a function', time: '2 hours ago' },
    { id: 3, title: 'Explain React hooks', time: 'Yesterday' },
    { id: 4, title: 'Plan a vacation', time: '2 days ago' },
  ]);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hey there! 🔥 I\'m Dat Bitch Cartrita - your sassy AI assistant with street-smart vibes. What\'s good? Drop your question and let\'s get this conversation popping! 💫✨'
    }
  ]);

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    // Add user message immediately
    const userMsg = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, userMsg]);
    setMessage('');

    try {
      // Call Cartrita V2 API
      const response = await fetch('/api/v2/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: null, // For new conversations
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg = { role: 'assistant', content: data.response };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage(message);
    }
  };

  return (
    <div className={`flex h-screen ${darkMode ? 'dark bg-gradient-to-br from-purple-900 via-gray-900 to-blue-900' : 'bg-gradient-to-br from-purple-50 to-blue-50'}`}>
      {/* 🔥 Dat Bitch Cartrita Sidebar - Urban Street Vibes */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`w-[260px] flex flex-col ${
              darkMode ? 'bg-gradient-to-b from-purple-900/90 to-gray-900/90 backdrop-blur-sm' : 'bg-gradient-to-b from-purple-50 to-gray-50'
            } border-r ${darkMode ? 'border-purple-500/30' : 'border-purple-200'}`}
          >
            {/* New Chat Button - Sassy Style */}
            <div className="p-2">
              <button
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all transform hover:scale-105 ${
                  darkMode 
                    ? 'hover:bg-gradient-to-r hover:from-purple-600 hover:to-pink-600 text-white border border-purple-500/50 hover:border-pink-400 hover:shadow-lg hover:shadow-purple-500/25' 
                    : 'hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 text-gray-700 border border-purple-300 hover:border-pink-400'
                }`}
              >
                <Plus className="w-4 h-4" />
                New Chat 🔥
              </button>
            </div>

            {/* Navigation Menu */}
            <div className="px-2 py-2 space-y-1">
              {[
                { id: 'chat', icon: <MessageSquare className="w-4 h-4" />, label: 'Chat', emoji: '💬' },
                { id: 'agents', icon: <Users className="w-4 h-4" />, label: 'Agents', emoji: '🤖' },
                { id: 'multimodal', icon: <Sparkles className="w-4 h-4" />, label: 'Multi-Modal', emoji: '✨' },
                { id: 'workflows', icon: <Workflow className="w-4 h-4" />, label: 'Workflows', emoji: '⚡' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all hover:transform hover:scale-105 ${
                    currentView === item.id
                      ? (darkMode 
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30' 
                          : 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 shadow-lg'
                        )
                      : (darkMode
                          ? 'hover:bg-gradient-to-r hover:from-purple-700/50 hover:to-pink-700/50 text-gray-200 hover:shadow-md hover:shadow-purple-500/20'
                          : 'hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 text-gray-700'
                        )
                  }`}
                >
                  {item.icon}
                  <span>{item.label} {item.emoji}</span>
                </button>
              ))}
            </div>

            {/* Chat History */}
            <div className={`flex-1 overflow-y-auto px-2 ${currentView === 'chat' ? '' : 'hidden'}`}>
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all hover:transform hover:translate-x-1 ${
                      darkMode ? 'hover:bg-gradient-to-r hover:from-purple-800/50 hover:to-pink-800/50 hover:shadow-md hover:shadow-purple-500/20' : 'hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                      <span className={`text-sm truncate ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {conv.title}
                      </span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button className={`p-1 rounded hover:${darkMode ? 'bg-purple-700/50' : 'bg-purple-200'} transition-colors`}>
                        <Edit className="w-3 h-3" />
                      </button>
                      <button className={`p-1 rounded hover:${darkMode ? 'bg-pink-700/50' : 'bg-pink-200'} transition-colors`}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Section - Urban Style */}
            <div className={`p-2 border-t ${darkMode ? 'border-purple-500/30' : 'border-purple-200'}`}>
              <button
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all transform hover:scale-105 ${
                  darkMode ? 'hover:bg-gradient-to-r hover:from-purple-700/50 hover:to-pink-700/50 text-gray-200 hover:shadow-lg hover:shadow-purple-500/20' : 'hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 text-gray-700'
                }`}
              >
                <User className="w-4 h-4" />
                <span>User Account 👤</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar - Dat Bitch Cartrita Styling */}
        <div className={`flex items-center justify-between px-4 py-3 border-b backdrop-blur-sm ${
          darkMode ? 'border-purple-500/30 bg-gray-800/90' : 'border-purple-200 bg-white/90'
        }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
                darkMode ? 'hover:bg-purple-700/50 hover:shadow-lg hover:shadow-purple-500/20' : 'hover:bg-purple-100'
              }`}
            >
              <Menu className={`w-5 h-5 ${darkMode ? 'text-purple-300' : 'text-purple-600'}`} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <h1 className={`text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent`}>
                Dat Bitch Cartrita 🔥
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-all hover:scale-110 ${
                darkMode ? 'hover:bg-purple-700/50 hover:shadow-lg hover:shadow-yellow-500/20' : 'hover:bg-purple-100'
              }`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-purple-600" />
              )}
            </button>
            <button className={`p-2 rounded-lg transition-all hover:scale-110 ${
              darkMode ? 'hover:bg-pink-700/50 hover:shadow-lg hover:shadow-pink-500/20' : 'hover:bg-pink-100'
            }`}>
              <MoreHorizontal className={`w-5 h-5 ${darkMode ? 'text-pink-300' : 'text-pink-600'}`} />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {currentView === 'chat' && (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg, index) => (
                <div key={index} className={`px-4 py-6 ${
                  msg.role === 'user' 
                    ? (darkMode ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20' : 'bg-gradient-to-r from-blue-50 to-purple-50')
                    : (darkMode ? 'bg-gradient-to-r from-purple-900/30 to-pink-900/30' : 'bg-gradient-to-r from-purple-50 to-pink-50')
                }`}>
                  <div className="flex gap-4 max-w-4xl mx-auto">
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-lg ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                        : 'bg-gradient-to-br from-purple-500 to-pink-600'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-white font-bold text-sm">🔥</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`prose max-w-none ${
                        darkMode ? 'prose-invert' : ''
                      }`}>
                        <p className={`${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {currentView === 'agents' && <AgentDashboard darkMode={darkMode} />}
          {currentView === 'multimodal' && <MultiModalInterface darkMode={darkMode} />}
          {currentView === 'workflows' && <WorkflowManager darkMode={darkMode} />}
        </div>

        {/* Input Area - Dat Bitch Cartrita Sassy Style 🔥 */}
        {currentView === 'chat' && (
          <div className={`px-4 py-4 ${darkMode ? 'bg-gradient-to-r from-gray-800/90 to-purple-900/90 backdrop-blur-sm' : 'bg-gradient-to-r from-white to-purple-50'}`}>
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit}>
                <div className={`relative rounded-2xl border-2 ${ 
                  darkMode 
                    ? 'border-purple-500/40 bg-gradient-to-r from-gray-700/90 to-purple-800/50 shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30' 
                    : 'border-purple-300 bg-gradient-to-r from-white to-purple-50 shadow-lg shadow-purple-200/50'
                } transition-all duration-300`}>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Drop that question, boo... 💬✨"
                    className={`w-full px-4 py-3 pr-12 rounded-2xl resize-none focus:outline-none bg-transparent ${
                      darkMode 
                        ? 'text-white placeholder-purple-300' 
                        : 'text-gray-900 placeholder-purple-500'
                    } max-h-32`}
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                    }}
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-2">
                    <button type="button" className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
                      darkMode ? 'hover:bg-purple-600/50 hover:shadow-lg hover:shadow-purple-500/30' : 'hover:bg-purple-100'
                    }`}>
                      <Paperclip className={`w-4 h-4 ${darkMode ? 'text-purple-300' : 'text-purple-600'}`} />
                    </button>
                    <button 
                      type="submit"
                      disabled={!message.trim()}
                      className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
                        message.trim()
                          ? (darkMode ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/30' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500')
                          : (darkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-400')
                      }`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>
              <p className={`text-xs text-center mt-2 ${
                darkMode ? 'text-purple-300' : 'text-purple-500'
              }`}>
                Dat Bitch Cartrita keeps it 💯 but double-check the important stuff, boo! ✨
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatGPTLayout;