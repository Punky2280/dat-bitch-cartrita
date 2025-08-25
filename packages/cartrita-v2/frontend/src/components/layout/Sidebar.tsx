'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Calendar,
  Archive,
  Star,
  Trash2,
  MoreVertical,
  Edit3,
  Pin,
  PinOff
} from 'lucide-react';
import { formatDate, truncate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import useAppStore, { 
  useConversations, 
  useCurrentConversation,
  useUser 
} from '@/store';
import { Conversation } from '@/types';

const Sidebar: React.FC = () => {
  const conversations = useConversations();
  const currentConversation = useCurrentConversation();
  const user = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const {
    createNewConversation,
    setCurrentConversation,
    updateConversation,
    deleteConversation,
    loadConversation
  } = useAppStore();

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter(conv => {
      const matchesSearch = !searchQuery || 
        conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.summary?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesArchive = showArchived ? conv.isArchived : !conv.isArchived;
      
      return matchesSearch && matchesArchive;
    });

    // Sort: pinned first, then by last updated
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [conversations, searchQuery, showArchived]);

  const handleNewConversation = async () => {
    try {
      await createNewConversation();
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    if (currentConversation?.id === conversation.id) return;
    
    try {
      await loadConversation(conversation.id);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await updateConversation(id, { title: newTitle });
      setActiveDropdown(null);
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  const handlePinConversation = async (id: string, isPinned: boolean) => {
    try {
      await updateConversation(id, { isPinned: !isPinned });
      setActiveDropdown(null);
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  };

  const handleArchiveConversation = async (id: string, isArchived: boolean) => {
    try {
      await updateConversation(id, { isArchived: !isArchived });
      setActiveDropdown(null);
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      deleteConversation(id);
      setActiveDropdown(null);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const ConversationDropdown: React.FC<{ conversation: Conversation }> = ({ conversation }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [newTitle, setNewTitle] = useState(conversation.title);

    const handleRename = () => {
      if (newTitle.trim() && newTitle !== conversation.title) {
        handleRenameConversation(conversation.id, newTitle.trim());
      }
      setIsRenaming(false);
    };

    if (isRenaming) {
      return (
        <div className="absolute right-2 top-2 z-10">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="text-xs px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
            autoFocus
          />
        </div>
      );
    }

    return (
      <div className="absolute right-2 top-2 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[150px]"
        >
          <button
            onClick={() => setIsRenaming(true)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Rename
          </button>
          
          <button
            onClick={() => handlePinConversation(conversation.id, conversation.isPinned || false)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            {conversation.isPinned ? (
              <>
                <PinOff className="w-4 h-4" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="w-4 h-4" />
                Pin
              </>
            )}
          </button>
          
          <button
            onClick={() => handleArchiveConversation(conversation.id, conversation.isArchived || false)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            {conversation.isArchived ? 'Unarchive' : 'Archive'}
          </button>
          
          <button
            onClick={() => handleDeleteConversation(conversation.id)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </motion.div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Please log in to view your conversations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col sidebar-glass border-r border-gray-200/50 dark:border-gray-700/50">
      {/* Premium Header */}
      <div className="p-6 border-b border-gray-200/30 dark:border-gray-700/30">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNewConversation}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-2xl shadow-emerald transition-all duration-200 flex items-center justify-center gap-2 mb-6"
        >
          <Plus className="w-5 h-5" />
          New Chat
        </motion.button>

        {/* Premium Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 text-sm bg-white/60 dark:bg-gray-800/60 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        {/* Premium Filter Tabs */}
        <div className="flex mt-4 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl backdrop-blur-sm">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowArchived(false)}
            className={cn(
              "flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl transition-all duration-200",
              !showArchived 
                ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm" 
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            )}
          >
            Recent
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowArchived(true)}
            className={cn(
              "flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl transition-all duration-200",
              showArchived 
                ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm" 
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            )}
          >
            Archived
          </motion.button>
        </div>
      </div>

      {/* Premium Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <AnimatePresence>
          {filteredConversations.map((conversation, index) => (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                scale: 1,
                transition: { delay: index * 0.05, duration: 0.3 }
              }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              className={cn(
                "conversation-item-enhanced relative mb-2 group",
                currentConversation?.id === conversation.id && "active"
              )}
              onClick={() => handleSelectConversation(conversation)}
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div className="flex-shrink-0 mt-1.5">
                  {conversation.isPinned ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
                      <Pin className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 flex items-center justify-center">
                      <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {truncate(conversation.title, 30)}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2 font-medium">
                      {formatDate(conversation.updatedAt)}
                    </span>
                  </div>
                  
                  {conversation.summary && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {truncate(conversation.summary, 60)}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {conversation.messageCount} {conversation.messageCount === 1 ? 'message' : 'messages'}
                    </span>
                    
                    {conversation.tags && conversation.tags.length > 0 && (
                      <div className="flex space-x-1">
                        {conversation.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="inline-block px-2 py-0.5 text-xs bg-gradient-to-r from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 text-emerald-700 dark:text-emerald-300 rounded-full font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                        {conversation.tags.length > 2 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            +{conversation.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Premium More Options Button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: currentConversation?.id === conversation.id ? 1 : 0, 
                  scale: currentConversation?.id === conversation.id ? 1 : 0.8 
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDropdown(
                    activeDropdown === conversation.id ? null : conversation.id
                  );
                }}
                className="absolute top-3 right-3 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-200 group-hover:opacity-100"
              >
                <MoreVertical className="w-4 h-4" />
              </motion.button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {activeDropdown === conversation.id && (
                  <ConversationDropdown conversation={conversation} />
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredConversations.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No conversations found' : 
               showArchived ? 'No archived conversations' : 'No conversations yet'}
            </p>
            {!searchQuery && !showArchived && (
              <p className="text-xs text-muted-foreground mt-1">
                Start a new chat to get started
              </p>
            )}
          </div>
        )}
      </div>

      {/* Premium User Info */}
      <div className="p-6 border-t border-gray-200/30 dark:border-gray-700/30">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="flex items-center space-x-4 p-3 rounded-2xl hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 cursor-pointer"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl flex items-center justify-center text-sm font-bold shadow-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium">{user.email}</p>
          </div>
          <div className="status-indicator status-online" />
        </motion.div>
      </div>
    </div>
  );
};

export default Sidebar;