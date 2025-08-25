'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Sliders,
  Zap,
  Shield,
  Gauge,
  Brain,
  Activity,
  MessageSquare,
  FileText,
  Clock,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AgentConfig {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  maxTokens: number;
  temperature: number;
  responseTimeout: number;
  retryAttempts: number;
  enableLogging: boolean;
  enableTelemetry: boolean;
  priority: number;
}

interface AgentSettingsProps {
  agentId: string;
  darkMode: boolean;
  onClose: () => void;
  onSave: (config: AgentConfig) => void;
}

const AgentSettings: React.FC<AgentSettingsProps> = ({ 
  agentId, 
  darkMode, 
  onClose, 
  onSave 
}) => {
  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    role: 'sub',
    description: '',
    systemPrompt: '',
    allowedTools: [],
    maxTokens: 4000,
    temperature: 0.7,
    responseTimeout: 30000,
    retryAttempts: 3,
    enableLogging: true,
    enableTelemetry: true,
    priority: 5
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced' | 'tools' | 'monitoring'>('general');
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    fetchAgentConfig();
    fetchAvailableTools();
  }, [agentId]);

  useEffect(() => {
    setUnsavedChanges(true);
  }, [config]);

  const fetchAgentConfig = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch agent config:', error);
      toast.error('Failed to load agent configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTools = async () => {
    try {
      const response = await fetch('/api/agents/tools');
      if (response.ok) {
        const data = await response.json();
        setAvailableTools(data.tools || []);
      }
    } catch (error) {
      console.error('Failed to fetch available tools:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        toast.success('Agent configuration saved successfully!');
        setUnsavedChanges(false);
        onSave(config);
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save agent config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchAgentConfig();
    setUnsavedChanges(false);
  };

  const updateConfig = (field: keyof AgentConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const toggleTool = (tool: string) => {
    const updatedTools = config.allowedTools.includes(tool)
      ? config.allowedTools.filter(t => t !== tool)
      : [...config.allowedTools, tool];
    updateConfig('allowedTools', updatedTools);
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'advanced' as const, label: 'Advanced', icon: <Sliders className="w-4 h-4" /> },
    { id: 'tools' as const, label: 'Tools', icon: <Zap className="w-4 h-4" /> },
    { id: 'monitoring' as const, label: 'Monitoring', icon: <Activity className="w-4 h-4" /> }
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className={`w-8 h-8 border-2 border-t-transparent rounded-full ${
            darkMode ? 'border-purple-400' : 'border-purple-600'
          }`}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={`w-full max-w-4xl max-h-[90vh] rounded-2xl ${
          darkMode 
            ? 'bg-gradient-to-br from-gray-900 to-purple-900' 
            : 'bg-gradient-to-br from-white to-purple-50'
        } shadow-2xl overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 border-b ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center`}>
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Agent Configuration ⚙️
                </h1>
                <p className={`text-sm ${
                  darkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Customize your agent's behavior and capabilities
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {unsavedChanges && (
                <div className="flex items-center gap-1 text-orange-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Unsaved changes</span>
                </div>
              )}
              
              <button
                onClick={handleReset}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
                title="Reset to saved"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              
              <button
                onClick={handleSave}
                disabled={saving || !unsavedChanges}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                  saving || !unsavedChanges
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                } transition-colors`}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`px-6 pt-4 border-b ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? (darkMode 
                        ? 'bg-gray-700 text-purple-400 border-b-2 border-purple-400'
                        : 'bg-gray-100 text-purple-600 border-b-2 border-purple-600'
                      )
                    : (darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className={`font-semibold ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Agent Name
                      </label>
                      <input
                        type="text"
                        value={config.name}
                        onChange={(e) => updateConfig('name', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Role
                      </label>
                      <select
                        value={config.role}
                        onChange={(e) => updateConfig('role', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      >
                        <option value="sub">Sub Agent</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="specialist">Specialist</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Description
                    </label>
                    <textarea
                      value={config.description}
                      onChange={(e) => updateConfig('description', e.target.value)}
                      rows={3}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      placeholder="Describe what this agent does..."
                    />
                  </div>
                </div>

                {/* System Prompt */}
                <div className="space-y-4">
                  <h3 className={`font-semibold ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    System Prompt
                  </h3>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Instructions & Personality
                    </label>
                    <textarea
                      value={config.systemPrompt}
                      onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                      rows={8}
                      className={`w-full px-3 py-2 rounded-lg border font-mono text-sm ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      placeholder="Enter the agent's system prompt with detailed instructions and personality..."
                    />
                    <div className={`text-xs mt-1 ${
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Characters: {config.systemPrompt.length} | Lines: {config.systemPrompt.split('\n').length}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'advanced' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Performance Settings */}
                <div className="space-y-4">
                  <h3 className={`font-semibold flex items-center gap-2 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Gauge className="w-5 h-5" />
                    Performance Settings
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={config.maxTokens}
                        onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                        min="100"
                        max="8000"
                        step="100"
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Temperature ({config.temperature})
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={config.temperature}
                        onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Conservative</span>
                        <span>Creative</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Response Timeout (ms)
                      </label>
                      <input
                        type="number"
                        value={config.responseTimeout}
                        onChange={(e) => updateConfig('responseTimeout', parseInt(e.target.value))}
                        min="5000"
                        max="120000"
                        step="5000"
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Retry Attempts
                      </label>
                      <input
                        type="number"
                        value={config.retryAttempts}
                        onChange={(e) => updateConfig('retryAttempts', parseInt(e.target.value))}
                        min="1"
                        max="10"
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Priority Level ({config.priority})
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={config.priority}
                      onChange={(e) => updateConfig('priority', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Low Priority</span>
                      <span>High Priority</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'tools' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold flex items-center gap-2 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Zap className="w-5 h-5" />
                    Available Tools
                  </h3>
                  <div className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {config.allowedTools.length} of {availableTools.length} selected
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableTools.map((tool) => (
                    <label
                      key={tool}
                      className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                        config.allowedTools.includes(tool)
                          ? (darkMode 
                              ? 'bg-purple-900/50 border-2 border-purple-500' 
                              : 'bg-purple-100 border-2 border-purple-500'
                            )
                          : (darkMode 
                              ? 'bg-gray-700/50 border-2 border-gray-600 hover:border-gray-500' 
                              : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                            )
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={config.allowedTools.includes(tool)}
                        onChange={() => toggleTool(tool)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          config.allowedTools.includes(tool)
                            ? 'bg-purple-500 border-purple-500'
                            : (darkMode ? 'border-gray-400' : 'border-gray-300')
                        }`}>
                          {config.allowedTools.includes(tool) && (
                            <CheckCircle className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className={`text-sm ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {tool}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'monitoring' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className={`font-semibold flex items-center gap-2 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  <Activity className="w-5 h-5" />
                  Monitoring & Logging
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <div className={`font-medium ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          Enable Logging
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Log all agent interactions and responses
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableLogging}
                        onChange={(e) => updateConfig('enableLogging', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-green-500" />
                      <div>
                        <div className={`font-medium ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          Enable Telemetry
                        </div>
                        <div className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Collect performance metrics and traces
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableTelemetry}
                        onChange={(e) => updateConfig('enableTelemetry', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AgentSettings;