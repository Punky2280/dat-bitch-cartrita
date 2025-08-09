import React from "react";
import { CHAT_SUGGESTIONS } from "../../config/constants";

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onSuggestionClick,
}) => {
  return (
    <div className="text-center text-gray-400 mt-16">
      <div className="text-6xl mb-4">🤖</div>
      <h3 className="text-xl font-semibold mb-2">Ready to Chat!</h3>
      <p className="text-gray-500">
        Start a conversation with Cartrita. She&apos;s sassy, smart, and ready
        to help.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-2 max-w-md mx-auto">
        {CHAT_SUGGESTIONS.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSuggestionClick(suggestion.text)}
            className="text-left p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-sm"
          >
            {suggestion.icon} {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
};
