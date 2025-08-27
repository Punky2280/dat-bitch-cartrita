// ConversationList.tsx - Advanced conversation management with all features
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Search,
  Filter,
  MoreVertical,
  Star,
  Archive,
  Trash2,
  Pin,
  Edit3,
  Copy,
  Download,
  Clock,
  Calendar,
  Users,
  Zap,
  DollarSign,
  Hash,
  Plus,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Tag,
  BookOpen,
  Eye,
  EyeOff,
  Share2,
  ExternalLink,
  GitBranch,
  CheckSquare,
  Square
} from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import { useChatStore } from '../../store/chatStore';
import { useThemeStore } from '../../store/themeStore';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { useAccessibilityStore } from '../../store/accessibilityStore';

interface Conversation {
  id: string;
  title: string;
  preview: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  token_count?: number;
  cost_estimate?: number;
  starred: boolean;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  participants?: string[];
  branch_count?: number;
  last_model_used?: string;
  privacy_mode?: boolean;
  shared?: boolean;
  folder_id?: string;
}

interface ConversationFolder {
  id: string;
  name: string;
  color: string;
  expanded: boolean;
  conversation_count: number;
  parent_id?: string;
}

const ConversationList: React.FC = () => {
  const sessionStore = useSessionStore();
  const chatStore = useChatStore();
  const themeStore = useThemeStore();
  const analyticsStore = useAnalyticsStore();
  const accessibilityStore = useAccessibilityStore();

  // Local state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<ConversationFolder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'starred' | 'pinned' | 'archived' | 'shared'>('all');
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name' | 'messages'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFolders, setShowFolders] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);

  const isDarkMode = themeStore.currentTheme === 'dark';

  // Mock data - In real implementation, this would come from the API
  useEffect(() => {
    const mockConversations: Conversation[] = [
      {
        id: 'conv-1',
        title: 'React Component Optimization',
        preview: 'How can I optimize my React components for better performance?',
        created_at: Date.now() - 3600000,
        updated_at: Date.now() - 300000,
        message_count: 12,
        token_count: 2847,
        cost_estimate: 0.0284,
        starred: true,
        pinned: false,
        archived: false,
        tags: ['react', 'performance', 'optimization'],
        participants: ['user', 'assistant'],
        branch_count: 2,
        last_model_used: 'gpt-5-mini',
        folder_id: 'folder-dev'
      },
      {
        id: 'conv-2',
        title: 'Database Design Questions',
        preview: 'Need help with PostgreSQL schema design for a e-commerce platform',
        created_at: Date.now() - 7200000,
        updated_at: Date.now() - 1800000,
        message_count: 8,
        token_count: 1923,
        cost_estimate: 0.0192,
        starred: false,
        pinned: true,
        archived: false,
        tags: ['database', 'postgresql', 'schema'],
        participants: ['user', 'assistant'],
        branch_count: 1,
        last_model_used: 'gpt-5',
        privacy_mode: true,
        folder_id: 'folder-dev'
      },
      {
        id: 'conv-3',
        title: 'Marketing Strategy Discussion',
        preview: 'Brainstorming ideas for Q4 marketing campaign',
        created_at: Date.now() - 14400000,
        updated_at: Date.now() - 3600000,
        message_count: 24,
        token_count: 5642,
        cost_estimate: 0.0564,
        starred: false,
        pinned: false,
        archived: false,
        tags: ['marketing', 'strategy', 'brainstorming'],
        participants: ['user', 'assistant'],
        branch_count: 0,
        last_model_used: 'gpt-5-mini',
        shared: true,
        folder_id: 'folder-business'
      }
    ];

    const mockFolders: ConversationFolder[] = [
      {
        id: 'folder-dev',
        name: 'Development',
        color: 'blue',
        expanded: true,
        conversation_count: 2
      },
      {
        id: 'folder-business',
        name: 'Business',
        color: 'green',
        expanded: true,
        conversation_count: 1
      },
      {
        id: 'folder-personal',
        name: 'Personal',
        color: 'purple',
        expanded: false,
        conversation_count: 0
      }
    ];

    setConversations(mockConversations);
    setFolders(mockFolders);
  }, []);

  // Filtered and sorted conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter(conv => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!conv.title.toLowerCase().includes(query) &&
            !conv.preview.toLowerCase().includes(query) &&
            !conv.tags.some(tag => tag.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Type filter
      switch (filterType) {
        case 'starred':
          return conv.starred;
        case 'pinned':
          return conv.pinned;
        case 'archived':
          return conv.archived;
        case 'shared':
          return conv.shared;
        default:
          return !conv.archived; // Show all except archived by default
      }
    });

    // Sort conversations
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'updated':
          comparison = a.updated_at - b.updated_at;
          break;
        case 'created':
          comparison = a.created_at - b.created_at;
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'messages':
          comparison = a.message_count - b.message_count;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [conversations, searchQuery, filterType, sortBy, sortOrder]);

  // Group conversations by folder
  const conversationsByFolder = useMemo(() => {
    const grouped = new Map<string, Conversation[]>();
    const ungrouped: Conversation[] = [];

    filteredConversations.forEach(conv => {
      if (conv.folder_id) {
        if (!grouped.has(conv.folder_id)) {
          grouped.set(conv.folder_id, []);
        }
        grouped.get(conv.folder_id)!.push(conv);
      } else {
        ungrouped.push(conv);
      }
    });

    return { grouped, ungrouped };
  }, [filteredConversations]);

  // Event handlers
  const handleConversationClick = (conversationId: string) => {
    setActiveConversationId(conversationId);
    sessionStore.loadSession(conversationId);
    analyticsStore.trackEvent('conversation.opened', { conversation_id: conversationId });
  };

  const handleConversationSelect = (conversationId: string, selected: boolean) => {
    if (selected) {
      setSelectedConversations(prev => [...prev, conversationId]);
    } else {
      setSelectedConversations(prev => prev.filter(id => id !== conversationId));
    }
  };

  const handleSelectAll = () => {
    if (selectedConversations.length === filteredConversations.length) {
      setSelectedConversations([]);
    } else {
      setSelectedConversations(filteredConversations.map(c => c.id));
    }
  };

  const handleBulkAction = async (action: 'star' | 'unstar' | 'pin' | 'unpin' | 'archive' | 'delete' | 'export') => {
    // TODO: Implement bulk actions
    console.log(`Bulk ${action} for conversations:`, selectedConversations);
    setSelectedConversations([]);
    setShowBulkActions(false);
  };

  const handleContextMenu = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, conversationId });
  };

  const handleContextAction = async (action: string, conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    switch (action) {
      case 'rename':
        // TODO: Implement rename
        break;
      case 'duplicate':
        // TODO: Implement duplicate
        break;
      case 'star':
        // TODO: Implement star toggle
        break;
      case 'pin':
        // TODO: Implement pin toggle
        break;
      case 'archive':
        // TODO: Implement archive
        break;
      case 'delete':
        // TODO: Implement delete
        break;
      case 'export':
        // TODO: Implement export
        break;
      case 'share':
        // TODO: Implement share
        break;
    }

    setContextMenu(null);
  };

  const handleNewConversation = () => {
    const newConversationId = sessionStore.createNewSession();
    setActiveConversationId(newConversationId);
    analyticsStore.trackEvent('conversation.created');
  };

  const handleFolderToggle = (folderId: string) => {
    setFolders(prev => prev.map(folder => 
      folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder
    ));
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getFolderColor = (color: string) => {
    const colors = {
      blue: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
      green: 'text-green-500 bg-green-100 dark:bg-green-900/30',
      purple: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
      red: 'text-red-500 bg-red-100 dark:bg-red-900/30',
      yellow: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30',
      gray: 'text-gray-500 bg-gray-100 dark:bg-gray-900/30'
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  const renderConversationItem = (conversation: Conversation) => (
    <motion.div
      key={conversation.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
        activeConversationId === conversation.id
          ? isDarkMode
            ? 'bg-blue-900/30 border border-blue-700'
            : 'bg-blue-50 border border-blue-200'
          : isDarkMode
            ? 'hover:bg-gray-700/50 border border-transparent'
            : 'hover:bg-gray-50 border border-transparent'
      }`}
      onClick={() => handleConversationClick(conversation.id)}
      onContextMenu={(e) => handleContextMenu(e, conversation.id)}
    >
      {/* Selection checkbox */}
      {showBulkActions && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={selectedConversations.includes(conversation.id)}
            onChange={(e) => handleConversationSelect(conversation.id, e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className={`flex items-start gap-3 ${showBulkActions ? 'ml-6' : ''}`}>
        {/* Conversation icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
        }`}>
          <MessageSquare className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-medium truncate ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {conversation.title}
            </h3>

            {/* Status indicators */}
            <div className="flex items-center gap-1">
              {conversation.pinned && (
                <Pin className="w-3 h-3 text-yellow-500" fill="currentColor" />
              )}
              {conversation.starred && (
                <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
              )}
              {conversation.privacy_mode && (
                <EyeOff className="w-3 h-3 text-gray-400" />
              )}
              {conversation.shared && (
                <Share2 className="w-3 h-3 text-blue-500" />
              )}
              {conversation.branch_count && conversation.branch_count > 0 && (
                <div className="flex items-center gap-0.5">
                  <GitBranch className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{conversation.branch_count}</span>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <p className={`text-sm truncate mb-2 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {conversation.preview}
          </p>

          {/* Tags */}
          {conversation.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {conversation.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className={`px-1.5 py-0.5 text-xs rounded ${
                    isDarkMode 
                      ? 'bg-gray-700 text-gray-300' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tag}
                </span>
              ))}
              {conversation.tags.length > 3 && (
                <span className={`text-xs ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  +{conversation.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className={`flex items-center justify-between text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(conversation.updated_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>{conversation.message_count}</span>
              </div>
              {conversation.token_count && (
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>{conversation.token_count}</span>
                </div>
              )}
            </div>

            {conversation.cost_estimate && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span>${conversation.cost_estimate.toFixed(4)}</span>
              </div>
            )}
          </div>

          {/* Model info */}
          {conversation.last_model_used && (
            <div className={`mt-1 text-xs ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {conversation.last_model_used}
            </div>
          )}
        </div>

        {/* Actions menu */}
        <button
          className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
            isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
          }`}
          onClick={(e) => handleContextMenu(e, conversation.id)}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );

  const renderFolder = (folder: ConversationFolder) => {
    const folderConversations = conversationsByFolder.grouped.get(folder.id) || [];

    return (
      <div key={folder.id} className="mb-4">
        <button
          onClick={() => handleFolderToggle(folder.id)}
          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
            isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'
          }`}
        >
          {folder.expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          
          <div className={`w-3 h-3 rounded ${getFolderColor(folder.color)}`} />
          
          <span className={`font-medium ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {folder.name}
          </span>
          
          <span className={`text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            ({folderConversations.length})
          </span>
        </button>

        <AnimatePresence>
          {folder.expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="ml-6 mt-2 space-y-1"
            >
              {folderConversations.map(renderConversationItem)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col ${
      isDarkMode ? 'bg-gray-900' : 'bg-white'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`font-semibold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Conversations
          </h2>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className={`p-1.5 rounded transition-colors ${
                showBulkActions
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : isDarkMode
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
              }`}
              title="Select multiple"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleNewConversation}
              className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              isDarkMode 
                ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-400' 
                : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 flex gap-1">
            {[
              { key: 'all', label: 'All', icon: MessageSquare },
              { key: 'starred', label: 'Starred', icon: Star },
              { key: 'pinned', label: 'Pinned', icon: Pin },
              { key: 'archived', label: 'Archived', icon: Archive },
              { key: 'shared', label: 'Shared', icon: Share2 }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilterType(key as any)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filterType === key
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : isDarkMode
                      ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                      : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title={label}
              >
                <Icon className="w-3 h-3" />
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFolders(!showFolders)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showFolders
                ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Toggle folders"
          >
            <Folder className="w-3 h-3" />
          </button>
        </div>

        {/* Bulk actions */}
        {showBulkActions && selectedConversations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-2 rounded-lg border ${
              isDarkMode 
                ? 'border-gray-600 bg-gray-800' 
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {selectedConversations.length} selected
              </span>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {selectedConversations.length === filteredConversations.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            
            <div className="flex gap-2">
              {[
                { key: 'star', label: 'Star', icon: Star },
                { key: 'pin', label: 'Pin', icon: Pin },
                { key: 'archive', label: 'Archive', icon: Archive },
                { key: 'export', label: 'Export', icon: Download },
                { key: 'delete', label: 'Delete', icon: Trash2 }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleBulkAction(key as any)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    key === 'delete'
                      ? 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'
                      : isDarkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-600 hover:bg-gray-200'
                  }`}
                  title={label}
                >
                  <Icon className="w-3 h-3" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {showFolders ? (
          <>
            {/* Folders */}
            {folders.map(renderFolder)}
            
            {/* Ungrouped conversations */}
            {conversationsByFolder.ungrouped.length > 0 && (
              <div>
                <div className={`text-xs font-medium mb-2 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Other
                </div>
                <div className="space-y-1">
                  {conversationsByFolder.ungrouped.map(renderConversationItem)}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map(renderConversationItem)}
          </div>
        )}

        {filteredConversations.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${
              isDarkMode ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <h3 className={`text-lg font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              No conversations found
            </h3>
            <p className={`text-sm mb-4 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {searchQuery ? 'Try adjusting your search terms' : 'Start a new conversation to get started'}
            </p>
            <button
              onClick={handleNewConversation}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              New Conversation
            </button>
          </div>
        )}
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
            ].map((item, index) => 
              item === null ? (
                <div key={index} className="border-t border-gray-200 dark:border-gray-600 my-1" />
              ) : (
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
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationList;