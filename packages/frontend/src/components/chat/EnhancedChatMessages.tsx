import React, { useState, useCallback } from "react";
import type { Message } from "../../types/chat";
import { EnhancedMessageItem } from "./EnhancedMessageItem";
import { EnhancedTypingIndicator } from "./EnhancedTypingIndicator";
import { EmptyState } from "./EmptyState";

interface EnhancedChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSuggestionClick: (suggestion: string) => void;
  onMessageCopy?: (text: string) => void;
  onMessageFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
  onMessageRegenerate?: (messageId: string) => void;
  agentActivity?: 'thinking' | 'processing' | 'analyzing' | 'responding';
  estimatedResponseTime?: number;
  showMessageMetadata?: boolean;
  showTimestamps?: boolean;
}

export const EnhancedChatMessages: React.FC<EnhancedChatMessagesProps> = ({
  messages,
  isLoading,
  isTyping,
  messagesEndRef,
  onSuggestionClick,
  onMessageCopy,
  onMessageFeedback,
  onMessageRegenerate,
  agentActivity = 'thinking',
  estimatedResponseTime,
  showMessageMetadata = true,
  showTimestamps = true
}) => {
  const [feedbackStates, setFeedbackStates] = useState<Record<string, 'positive' | 'negative'>>({});

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (onMessageCopy) {
        onMessageCopy(text);
      }
      // Could show a toast notification here
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, [onMessageCopy]);

  const handleFeedback = useCallback((messageId: string, type: 'positive' | 'negative') => {
    setFeedbackStates(prev => ({
      ...prev,
      [messageId]: type
    }));
    
    if (onMessageFeedback) {
      onMessageFeedback(messageId, type);
    }
  }, [onMessageFeedback]);

  const handleRegenerate = useCallback((messageId: string) => {
    if (onMessageRegenerate) {
      onMessageRegenerate(messageId);
    }
  }, [onMessageRegenerate]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      {messages.length === 0 ? (
        <EmptyState onSuggestionClick={onSuggestionClick} />
      ) : (
        <>
          {messages.map((message, index) => (
            <EnhancedMessageItem
              key={message.id}
              message={message}
              index={index}
              onCopy={handleCopy}
              onFeedback={handleFeedback}
              onRegenerate={handleRegenerate}
              showTimestamp={showTimestamps}
              showMetadata={showMessageMetadata}
            />
          ))}
        </>
      )}

      {(isLoading || isTyping) && (
        <EnhancedTypingIndicator
          agentName="Cartrita"
          activity={agentActivity}
          showAgentStatus={true}
          estimatedTime={estimatedResponseTime}
        />
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
