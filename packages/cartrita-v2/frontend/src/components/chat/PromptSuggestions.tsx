// Simple prompt suggestions component
'use client';

import React from 'react';
import { X, Lightbulb, Zap } from 'lucide-react';

interface PromptSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  onClose: () => void;
}

const PromptSuggestions: React.FC<PromptSuggestionsProps> = ({ suggestions, onSelect, onClose }) => {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Lightbulb className="w-4 h-4" />
          Prompt Suggestions
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className="p-3 text-left text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-blue-500" />
              <span className="text-gray-900 dark:text-gray-100">{suggestion}</span>
            </div>
          </button>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-600">
        Click a suggestion to use it, or start typing your own message
      </div>
    </div>
  );
};

export default PromptSuggestions;