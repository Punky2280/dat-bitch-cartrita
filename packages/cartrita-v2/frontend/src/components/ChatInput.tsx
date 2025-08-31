
'use client'; // This is required for using hooks

import React, { useState } from 'react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Send a message..." 
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSendMessage(text);
      setText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full p-3 pr-12 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            disabled 
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
              : 'bg-white text-gray-900 border-gray-300'
          }`}
        />
        <button 
          type="submit" 
          disabled={disabled || !text.trim()}
          className={`absolute inset-y-0 right-0 flex items-center px-4 ${
            disabled || !text.trim()
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-blue-600 hover:text-blue-700'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
