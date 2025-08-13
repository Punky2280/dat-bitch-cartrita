/**
 * Virtualized Chat List Component
 * High-performance chat list with inline media rendering
 */

import React, { useMemo, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import EnhancedChatMessage from './EnhancedChatMessage';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

interface VirtualizedChatListProps {
  messages: ChatMessage[];
  enableMediaRendering?: boolean;
  allowUntrustedMedia?: boolean;
  maxMediaWidth?: number;
  showTimestamps?: boolean;
  className?: string;
  onMessageUpdate?: (messageId: string, updates: Partial<ChatMessage>) => void;
}

const VirtualizedChatList: React.FC<VirtualizedChatListProps> = ({
  messages,
  enableMediaRendering = true,
  allowUntrustedMedia = false,
  maxMediaWidth = 380,
  showTimestamps = true,
  className = '',
  // onMessageUpdate
}) => {
  // Memoize message components to prevent unnecessary re-renders
  const messageComponents = useMemo(() => {
    return messages.map((message) => (
      <EnhancedChatMessage
        key={message.id}
        message={message}
        enableMediaRendering={enableMediaRendering}
        allowUntrustedMedia={allowUntrustedMedia}
        maxMediaWidth={maxMediaWidth}
        showTimestamp={showTimestamps}
        className="px-4 py-2"
      />
    ));
  }, [messages, enableMediaRendering, allowUntrustedMedia, maxMediaWidth, showTimestamps]);

  // Item content renderer
  const itemContent = useCallback((index: number) => {
    return messageComponents[index];
  }, [messageComponents]);

  // Follow output - auto-scroll to bottom when new messages arrive
  const followOutput = useCallback((isAtBottom: boolean) => {
    return isAtBottom;
  }, []);

  // Header component for loading state
  const Header = useCallback(() => {
    if (messages.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="text-lg mb-2">💬</div>
            <div>No messages yet</div>
            <div className="text-sm">Start a conversation!</div>
          </div>
        </div>
      );
    }
    return null;
  }, [messages.length]);

  // Footer component for typing indicator or load more
  const Footer = useCallback(() => {
    return <div className="h-4" />; // Small spacer at bottom
  }, []);

  return (
    <div className={`chat-list-container ${className}`}>
      <Virtuoso
        style={{ height: '100%', width: '100%' }}
        data={messages}
        itemContent={itemContent}
        followOutput={followOutput}
        alignToBottom
        components={{
          Header,
          Footer
        }}
        className="virtuoso-chat-list"
        increaseViewportBy={200} // Pre-render items outside viewport
        initialTopMostItemIndex={messages.length - 1} // Start at bottom
      />
      
  <style>{`
        .virtuoso-chat-list {
          /* Custom scrollbar styling */
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
        }
        
        .virtuoso-chat-list::-webkit-scrollbar {
          width: 6px;
        }
        
        .virtuoso-chat-list::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .virtuoso-chat-list::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 3px;
        }
        
        .virtuoso-chat-list::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.8);
        }
        
        /* Dark mode scrollbar */
  .dark .virtuoso-chat-list {
          scrollbar-color: rgba(107, 114, 128, 0.5) transparent;
        }
        
        .dark .virtuoso-chat-list::-webkit-scrollbar-thumb {
          background-color: rgba(107, 114, 128, 0.5);
        }
        
        .dark .virtuoso-chat-list::-webkit-scrollbar-thumb:hover {
          background-color: rgba(107, 114, 128, 0.8);
        }
      `}</style>
    </div>
  );
};

export default VirtualizedChatList;