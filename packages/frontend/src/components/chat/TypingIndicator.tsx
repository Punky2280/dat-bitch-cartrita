import React from "react";

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start message-appear">
      <div className="bg-gradient-to-br from-gray-700 to-gray-800 px-4 py-3 rounded-2xl rounded-bl-md shadow-lg">
        <div className="flex items-center space-x-1">
          <span className="text-sm text-gray-300">Cartrita is thinking</span>
          <div className="typing-indicator ml-2">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
