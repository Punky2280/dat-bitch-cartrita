'use client'; // This is required for using hooks

import React, { useEffect, useRef } from 'react';
import Message from './Message';
import ChatInput from './ChatInput';
import { useChat } from '@/hooks/useChat';

const Chat = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    isLoading,
    error,
    isConnected,
    sendMessage,
    setError
  } = useChat({ enableRealtime: true });

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    await sendMessage(text);
  };

  const handleRetry = () => {
    setError(null);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Connection Status */}
      <div className={`px-4 py-2 text-xs ${isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
        {isConnected ? '🟢 Connected to Cartrita' : '🟡 Connecting...'}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 py-8">
            <div className="text-2xl mb-2">👋</div>
            <p className="text-lg font-medium">Welcome to Cartrita AI</p>
            <p className="text-sm">Start a conversation by typing a message below</p>
          </div>
        )}

        {messages.map((msg, index) => (
          <Message 
            key={msg.id || index} 
            text={msg.text} 
            sender={msg.sender}
            timestamp={msg.timestamp}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-start">
            <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-xs text-gray-500 ml-1">Cartrita is thinking...</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm">{error}</span>
              <button 
                onClick={handleRetry}
                className="text-xs bg-red-200 hover:bg-red-300 px-2 py-1 rounded"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-gray-50">
        <ChatInput 
          onSendMessage={handleSendMessage} 
          disabled={isLoading}
          placeholder={isConnected ? "Type your message..." : "Connecting..."}
        />
      </div>
    </div>
  );
};

export default Chat;