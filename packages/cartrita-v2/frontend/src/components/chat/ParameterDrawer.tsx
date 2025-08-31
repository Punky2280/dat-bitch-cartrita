// Simple parameter drawer component
'use client';

import React, { useState } from 'react';
import { X, Settings, Thermometer, Hash, Clock, Zap } from 'lucide-react';
import { useModelStore } from '../../store/additionalStores';

interface ParameterDrawerProps {
  onClose: () => void;
}

const ParameterDrawer: React.FC<ParameterDrawerProps> = ({ onClose }) => {
  const modelStore = useModelStore();
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [reasoningEffort, setReasoningEffort] = useState('medium');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Model Parameters
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Model Selection */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Zap className="w-4 h-4" />
          Model
        </label>
        <select
          value={modelStore.currentModel}
          onChange={(e) => modelStore.setCurrentModel(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          id="model-select"
          name="model"
        >
          {modelStore.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </option>
          ))}
        </select>
      </div>

      {/* Temperature */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Thermometer className="w-4 h-4" />
          Temperature: {temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          id="temperature-slider"
          name="temperature"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>Focused</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Hash className="w-4 h-4" />
          Max Output Tokens
        </label>
        <input
          type="number"
          min="100"
          max="4000"
          step="100"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          id="max-tokens"
          name="maxTokens"
        />
      </div>

      {/* Reasoning Effort */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Clock className="w-4 h-4" />
          Reasoning Effort
        </label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { value: 'low', label: 'Fast' },
            { value: 'medium', label: 'Balanced' },
            { value: 'high', label: 'Thorough' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setReasoningEffort(option.value)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                reasoningEffort === option.value
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Presets */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Quick Presets
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setTemperature(0.1);
              setMaxTokens(1000);
              setReasoningEffort('high');
            }}
            className="px-3 py-2 text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50"
          >
            Precise
          </button>
          <button
            onClick={() => {
              setTemperature(0.7);
              setMaxTokens(2000);
              setReasoningEffort('medium');
            }}
            className="px-3 py-2 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            Balanced
          </button>
          <button
            onClick={() => {
              setTemperature(1.2);
              setMaxTokens(3000);
              setReasoningEffort('low');
            }}
            className="px-3 py-2 text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50"
          >
            Creative
          </button>
          <button
            onClick={() => {
              setTemperature(0.3);
              setMaxTokens(4000);
              setReasoningEffort('high');
            }}
            className="px-3 py-2 text-xs bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50"
          >
            Analysis
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParameterDrawer;