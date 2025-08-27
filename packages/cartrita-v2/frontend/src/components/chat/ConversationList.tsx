'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Search,
  Plus,
  MoreVertical,
  Edit3,
  Copy,
  Star,
  Pin,
  Share2,
  Download,
  Archive,
  Trash2,
  Filter,
  Calendar,
  Clock,
  User,
  Bot,
  ChevronDown,
  X,
  Sparkles
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useThemeStore } from '../../store/additionalStores';

interface ConversationListProps {
  className?: string;
  onConversationSelect?: (conversationId: string) => void;
  selectedConversationId?: string;
  compact?: boolean;
}

interface FilterOptions {
  timeRange: 'all' | 'today' | 'week' | 'month';
  participants: 'all' | 'user' | 'assistant';
  status: 'all' | 'active' | 'archived' | 'starred';
  sortBy: 'recent' | 'alphabetical' | 'starred';
}

const ConversationList: React.FC<ConversationListProps> = ({
  className = '',
  onConversationSelect,
  selectedConversationId,
  compact = false
}) => {
  const chatStore = useChatStore();
  const { currentTheme } = useThemeStore();
  const isDarkMode = currentTheme === 'dark';

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    conversationId: string;
  } | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    timeRange: 'all',
    participants: 'all',
    status: 'all',
    sortBy: 'recent'
  });
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Get conversations from store
  const conversations = chatStore.conversations || [];

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = [...conversations];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => 
        conv.title.toLowerCase().includes(query) ||
        conv.messages.some(msg => 
          msg.content.toLowerCase().includes(query)
        )
      );
    }

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const timeThresholds = {
        today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getFullYear(), now.getMonth(), 1)
      };
      
      const threshold = timeThresholds[filters.timeRange];
      if (threshold) {
        filtered = filtered.filter(conv => 
          new Date(conv.updated_at) >= threshold
        );
      }
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(conv => {
        switch (filters.status) {
          case 'active':
            return !conv.archived && !conv.deleted;
          case 'archived':
            return conv.archived;
          case 'starred':
            return conv.starred;
          default:
            return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'starred':
          if (a.starred !== b.starred) {
            return a.starred ? -1 : 1;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'recent':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return filtered;
  }, [conversations, searchQuery, filters]);

  // Event handlers
  const handleCreateNew = useCallback(async () => {
    setIsCreatingNew(true);
    try {
      const newConversation = await chatStore.createConversation();
      if (newConversation && onConversationSelect) {
        onConversationSelect(newConversation.id);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreatingNew(false);
    }
  }, [chatStore, onConversationSelect]);

  const handleConversationClick = useCallback((conversationId: string) => {
    if (onConversationSelect) {
      onConversationSelect(conversationId);
    }
  }, [onConversationSelect]);

  const handleContextMenu = useCallback((event: React.MouseEvent, conversationId: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      conversationId
    });
  }, []);

  const handleContextAction = useCallback(async (action: string, conversationId: string) => {
    setContextMenu(null);
    
    try {
      switch (action) {
        case 'rename':
          const conversation = conversations.find(c => c.id === conversationId);
          if (conversation) {
            setEditingConversationId(conversationId);
            setEditingTitle(conversation.title);
          }
          break;
        case 'duplicate':
          await chatStore.duplicateConversation(conversationId);
          break;
        case 'star':
          await chatStore.toggleStar(conversationId);
          break;
        case 'pin':
          await chatStore.togglePin(conversationId);
          break;
        case 'share':
          await chatStore.shareConversation(conversationId);
          break;
        case 'export':
          await chatStore.exportConversation(conversationId);
          break;
        case 'archive':
          await chatStore.archiveConversation(conversationId);
          break;
        case 'delete':
          if (confirm('Are you sure you want to delete this conversation?')) {
            await chatStore.deleteConversation(conversationId);
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} conversation:`, error);
    }
  }, [conversations, chatStore]);

  const handleTitleEdit = useCallback(async (conversationId: string, newTitle: string) => {
    if (newTitle.trim() && newTitle !== editingTitle) {
      try {
        await chatStore.updateConversationTitle(conversationId, newTitle.trim());
      } catch (error) {
        console.error('Failed to update conversation title:', error);
      }
    }
    setEditingConversationId(null);
    setEditingTitle('');
  }, [editingTitle, chatStore]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Helper functions
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, []);

  const getConversationPreview = useCallback((conversation: any) => {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return 'No messages';
    
    const preview = lastMessage.content.substring(0, 100);
    return preview.length < lastMessage.content.length ? preview + '...' : preview;
  }, []);

  const getMessageCount = useCallback((conversation: any) => {
    return conversation.messages.length;
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Conversations
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title="Filters"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={handleCreateNew}
              disabled={isCreatingNew}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              title="New conversation"
            >
              {isCreatingNew ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                      Time Range
                    </label>
                    <select
                      value={filters.timeRange}
                      onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                      className="w-full text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    >
                      <option value="all">All time</option>
                      <option value="today">Today</option>
                      <option value="week">This week</option>
                      <option value="month">This month</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                      Sort By
                    </label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                      className="w-full text-xs p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    >
                      <option value="recent">Most recent</option>
                      <option value="alphabetical">Alphabetical</option>
                      <option value="starred">Starred first</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery 
                  ? 'Try adjusting your search or filters'
                  : 'Start a new conversation to get going'
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreateNew}
                  disabled={isCreatingNew}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Start Conversation
                </button>
              )}
            </div>
          ) : (
            <div className="p-2">
              {filteredConversations.map((conversation) => (
                <motion.div
                  key={conversation.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className={`group relative p-3 mb-2 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedConversationId === conversation.id
                      ? isDarkMode
                        ? 'bg-blue-900/30 border border-blue-600'
                        : 'bg-blue-50 border border-blue-300'
                      : isDarkMode
                        ? 'hover:bg-gray-700/50 border border-transparent hover:border-gray-600'
                        : 'hover:bg-gray-50 border border-transparent hover:border-gray-200'
                  }`}
                  onClick={() => handleConversationClick(conversation.id)}
                  onContextMenu={(e) => handleContextMenu(e, conversation.id)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {editingConversationId === conversation.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleTitleEdit(conversation.id, editingTitle)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleTitleEdit(conversation.id, editingTitle);
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm font-medium bg-white dark:bg-gray-700 border border-blue-500 rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                          {conversation.title}
                        </h3>
                      )}
                      
                      {/* Status indicators */}
                      <div className="flex items-center gap-1">
                        {conversation.starred && (
                          <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        )}
                        {conversation.pinned && (
                          <Pin className="w-3 h-3 text-blue-500" />
                        )}
                        {conversation.archived && (
                          <Archive className="w-3 h-3 text-gray-500" />
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleContextMenu(e, conversation.id)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preview */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                    {getConversationPreview(conversation)}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>{getMessageCount(conversation)}</span>
                      </div>
                      
                      {conversation.model && (
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>{conversation.model}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(conversation.updated_at)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={`fixed z-50 w-48 rounded-lg shadow-lg border ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
          }`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onBlur={() => setContextMenu(null)}
        >
          <div className="py-1">
            {[
              { key: 'rename', label: 'Rename', icon: Edit3 },
              { key: 'duplicate', label: 'Duplicate', icon: Copy },
              { key: 'star', label: 'Star', icon: Star },
              { key: 'pin', label: 'Pin', icon: Pin },
              { key: 'share', label: 'Share', icon: Share2 },
              null,
              { key: 'export', label: 'Export', icon: Download },
              { key: 'archive', label: 'Archive', icon: Archive },
              { key: 'delete', label: 'Delete', icon: Trash2 }
            ].map((item, index) => {
              if (item === null) {
                return <div key={index} className="border-t border-gray-200 dark:border-gray-600 my-1" />;
              }
              
              return (
                <button
                  key={item.key}
                  onClick={() => handleContextAction(item.key, contextMenu.conversationId)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    item.key === 'delete'
                      ? 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : isDarkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationList;