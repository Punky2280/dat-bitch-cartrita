// Simple tool selector component
'use client';

import React from 'react';
import { X, Search, Code, Calculator, Database, Globe, Image, FileText, Brain } from 'lucide-react';

interface ToolSelectorProps {
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
  onClose: () => void;
}

const AVAILABLE_TOOLS = [
  { id: 'search', name: 'Web Search', icon: Search, description: 'Search the web for information' },
  { id: 'code', name: 'Code Interpreter', icon: Code, description: 'Execute code and analyze results' },
  { id: 'calculator', name: 'Calculator', icon: Calculator, description: 'Perform mathematical calculations' },
  { id: 'database', name: 'Database Query', icon: Database, description: 'Query databases and analyze data' },
  { id: 'image', name: 'Image Analysis', icon: Image, description: 'Analyze and describe images' },
  { id: 'document', name: 'Document Reader', icon: FileText, description: 'Read and analyze documents' },
  { id: 'reasoning', name: 'Deep Reasoning', icon: Brain, description: 'Enhanced reasoning and analysis' },
];

const ToolSelector: React.FC<ToolSelectorProps> = ({ selectedTools, onToolsChange, onClose }) => {
  const handleToggleTool = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      onToolsChange(selectedTools.filter(id => id !== toolId));
    } else {
      onToolsChange([...selectedTools, toolId]);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Select Tools
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {AVAILABLE_TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToggleTool(tool.id)}
            className={`p-3 text-left rounded-lg border transition-colors ${
              selectedTools.includes(tool.id)
                ? 'border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="flex items-start gap-2">
              <tool.icon className={`w-4 h-4 mt-0.5 ${
                selectedTools.includes(tool.id) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
              }`} />
              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  selectedTools.includes(tool.id) ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {tool.name}
                </div>
                <div className={`text-xs mt-1 ${
                  selectedTools.includes(tool.id) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {tool.description}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ToolSelector;