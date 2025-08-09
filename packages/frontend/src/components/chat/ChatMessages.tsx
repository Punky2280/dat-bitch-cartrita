import React from "react";
import type { Message } from "../../types/chat";
import { MessageItem } from "./MessageItem";
import { EmptyState } from "./EmptyState";
import { TypingIndicator } from "./TypingIndicator";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSuggestionClick: (suggestion: string) => void;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isLoading,
  isTyping,
  messagesEndRef,
  onSuggestionClick,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      {messages.length === 0 ? (
        <EmptyState onSuggestionClick={onSuggestionClick} />
      ) : (
        messages.map((message, index) => (
          <MessageItem key={message.id} message={message} index={index} />
        ))
      )}

      {(isLoading || isTyping) && <TypingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
};
