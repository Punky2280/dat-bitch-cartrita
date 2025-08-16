import React, { useState, useRef, useEffect, useCallback } from "react";
import { EnhancedChatMessages } from "./EnhancedChatMessages";
import { EnhancedChatInput } from "./EnhancedChatInput";
import { ChatHeader } from "./ChatHeader";
import type { Message } from "../../types/chat";

interface EnhancedChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  isConnected: boolean;
  onSendMessage: (message: string, files?: File[]) => void;
  onVoiceTranscript: (transcript: string) => void;
  token: string;
  title?: string;
  subtitle?: string;
  agentActivity?: 'thinking' | 'processing' | 'analyzing' | 'responding';
  estimatedResponseTime?: number;
  showAdvancedFeatures?: boolean;
  onMessageFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
  onMessageRegenerate?: (messageId: string) => void;
  onClearHistory?: () => void;
  onExportHistory?: () => void;
}

export const EnhancedChatInterface: React.FC<EnhancedChatInterfaceProps> = ({
  messages,
  isLoading,
  isConnected,
  onSendMessage,
  onVoiceTranscript,
  token,
  title = "Cartrita AI Assistant",
  subtitle = "Your intelligent companion",
  agentActivity = 'thinking',
  estimatedResponseTime,
  showAdvancedFeatures = true,
  onMessageFeedback,
  onMessageRegenerate,
  onClearHistory,
  onExportHistory
}) => {
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isTyping]);

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    
    // Trigger typing indicator (debounced)
    setIsTyping(true);
    const timer = setTimeout(() => setIsTyping(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [inputText, attachedFiles]);

  // Send message
  const handleSendMessage = useCallback(() => {
    if (!inputText.trim() && attachedFiles.length === 0) return;
    if (!isConnected || isLoading) return;

    onSendMessage(inputText.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
    setInputText("");
    setAttachedFiles([]);
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [inputText, attachedFiles, isConnected, isLoading, onSendMessage]);

  // Handle voice transcript
  const handleVoiceTranscript = useCallback((transcript: string) => {
    setInputText(prev => prev + (prev ? " " : "") + transcript);
    onVoiceTranscript(transcript);
  }, [onVoiceTranscript]);

  // Handle file uploads
  const handleFileUpload = useCallback((files: File[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  }, []);

  // Handle suggestion clicks
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputText(suggestion);
    // Auto-focus input after suggestion
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string) => {
    const cursorPosition = inputRef.current?.selectionStart || inputText.length;
    const newText = inputText.slice(0, cursorPosition) + emoji + inputText.slice(cursorPosition);
    setInputText(newText);
    
    // Set cursor position after emoji
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length);
      }
    }, 0);
  }, [inputText]);

  // Handle message copy
  const handleMessageCopy = useCallback((text: string) => {
    // Could show a toast notification
    console.log('Message copied:', text.substring(0, 50) + '...');
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Chat Header */}
      <ChatHeader
        title={title}
        subtitle={subtitle}
        isConnected={isConnected}
        messageCount={messages.length}
        onClearHistory={onClearHistory}
        onExportHistory={onExportHistory}
        showAdvancedControls={showAdvancedFeatures}
      />

      {/* Messages Area */}
      <div className="flex-1 relative overflow-hidden">
        <EnhancedChatMessages
          messages={messages}
          isLoading={isLoading}
          isTyping={isTyping}
          messagesEndRef={messagesEndRef}
          onSuggestionClick={handleSuggestionClick}
          onMessageCopy={handleMessageCopy}
          onMessageFeedback={onMessageFeedback}
          onMessageRegenerate={onMessageRegenerate}
          agentActivity={agentActivity}
          estimatedResponseTime={estimatedResponseTime}
          showMessageMetadata={showAdvancedFeatures}
          showTimestamps={true}
        />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-gray-700/50 bg-gray-800/30 backdrop-blur-sm">
        <EnhancedChatInput
          inputText={inputText}
          isConnected={isConnected}
          isLoading={isLoading}
          messageHistoryCount={messages.length}
          inputRef={inputRef}
          onInputChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onSendMessage={handleSendMessage}
          onVoiceTranscript={handleVoiceTranscript}
          onFileUpload={handleFileUpload}
          onEmojiSelect={handleEmojiSelect}
          token={token}
          placeholder="Type your message... (Shift+Enter for new line)"
          maxLength={4000}
          showFileUpload={showAdvancedFeatures}
          showEmoji={showAdvancedFeatures}
          showVoice={showAdvancedFeatures}
        />
      </div>
    </div>
  );
};
