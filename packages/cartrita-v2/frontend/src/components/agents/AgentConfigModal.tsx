'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Settings,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Bot,
  Zap,
  Shield,
  Brain,
  Sliders,
  Code,
  Activity,
  Users,
  MessageSquare
} from 'lucide-react';

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  allowedTools: string[];
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enabled: boolean;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  security: {
    allowedDomains: string[];
    restrictedActions: string[];
    requireApproval: boolean;
  };
  monitoring: {
    logLevel: 'debug' | 'info' | 'warning' | 'error';
    metricsEnabled: boolean;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
    };
  };
}

interface AgentConfigModalProps {
  agent: {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    allowedTools: string[];
    status: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AgentConfig) => Promise<void>;
  darkMode: boolean;
}

const AgentConfigModal: React.FC<AgentConfigModalProps> = ({
  agent,
  isOpen,
  onClose,
  onSave,
  darkMode
}) => {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'general' | 'model' | 'security' | 'monitoring'>('general');

  useEffect(() => {
    if (agent && isOpen) {
      loadAgentConfig();
    }
  }, [agent, isOpen]);

  const loadAgentConfig = async () => {
    if (!agent) {
      return;
    }
    
    setLoading(true);
    try {
      // Load current agent configuration
      const response = await fetch(`/api/v2/agents/${agent.id}/status`);
      
      if (response.ok) {
        const agentData = await response.json();
        
        // Create configuration object with defaults
        const agentConfig: AgentConfig = {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          capabilities: agent.capabilities,
          allowedTools: agent.allowedTools,
          model: agentData.model || 'gpt-4o',
          temperature: agentData.temperature || 0.7,
          maxTokens: agentData.max_tokens || 4096,
          systemPrompt: agentData.system_prompt || 'You are a helpful AI assistant.',
          enabled: agentData.enabled !== false,
          rateLimits: {
            requestsPerMinute: agentData.rate_limits?.requests_per_minute || 60,
            tokensPerMinute: agentData.rate_limits?.tokens_per_minute || 100000
          },
          security: {
            allowedDomains: agentData.security?.allowed_domains || ['*'],
            restrictedActions: agentData.security?.restricted_actions || [],
            requireApproval: agentData.security?.require_approval || false
          },
          monitoring: {
            logLevel: agentData.monitoring?.log_level || 'info',
            metricsEnabled: agentData.monitoring?.metrics_enabled !== false,
            alertThresholds: {
              errorRate: agentData.monitoring?.alert_thresholds?.error_rate || 0.1,
              responseTime: agentData.monitoring?.alert_thresholds?.response_time || 5000
            }
          }
        };
        
        setConfig(agentConfig);
      } else {
        // Fallback to defaults if API fails
        setConfig(createDefaultConfig());
      }
    } catch (error) {
      console.error('Failed to load agent config:', error);
      setConfig(createDefaultConfig());
    } finally {
      setLoading(false);
    }
  };

  const createDefaultConfig = (): AgentConfig => ({
    id: agent?.id || 'unknown',
    name: agent?.name || 'Unknown Agent',
    description: agent?.description || 'AI Assistant Agent',
    capabilities: agent?.capabilities || [],
    allowedTools: agent?.allowedTools || [],
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful AI assistant with a Miami personality. Be engaging, helpful, and add some flair to your responses.',
    enabled: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    },
    security: {
      allowedDomains: ['*'],
      restrictedActions: [],
      requireApproval: false
    },
    monitoring: {
      logLevel: 'info',
      metricsEnabled: true,
      alertThresholds: {
        errorRate: 0.1,
        responseTime: 5000
      }
    }
  });

  const handleSave = async () => {
    if (!config) {
      return;
    }
    
    setSaving(true);
    setErrors({});
    
    try {
      // Validate configuration
      const validationErrors = validateConfig(config);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Failed to save config:', error);
      setErrors({ general: 'Failed to save configuration. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const validateConfig = (config: AgentConfig): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!config.name.trim()) {
      errors.name = 'Agent name is required';
    }
    
    if (config.temperature < 0 || config.temperature > 2) {
      errors.temperature = 'Temperature must be between 0 and 2';
    }
    
    if (config.maxTokens < 1 || config.maxTokens > 128000) {
      errors.maxTokens = 'Max tokens must be between 1 and 128,000';
    }
    
    if (config.rateLimits.requestsPerMinute < 1) {
      errors.requestsPerMinute = 'Requests per minute must be at least 1';
    }
    
    return errors;
  };

  const updateConfig = (path: string, value: any) => {
    if (!config) {
      return;
    }
    
    const pathParts = path.split('.');
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      current[pathParts[i]] = { ...current[pathParts[i]] };
      current = current[pathParts[i]];
    }
    
    current[pathParts[pathParts.length - 1]] = value;
    setConfig(newConfig);
  };

  const addCapability = (capability: string) => {
    if (!config || !capability.trim() || config.capabilities.includes(capability)) {
      return;
    }
    updateConfig('capabilities', [...config.capabilities, capability.trim()]);
  };

  const removeCapability = (capability: string) => {
    if (!config) {
      return;
    }
    updateConfig('capabilities', config.capabilities.filter(c => c !== capability));
  };

  if (!isOpen) {
    return null;
  }

  const tabs = [
    { id: 'general', label: 'General', icon: <Bot className="w-4 h-4" /> },
    { id: 'model', label: 'Model', icon: <Brain className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'monitoring', label: 'Monitoring', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <AnimatePresence>
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
          className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl ${
            darkMode 
              ? 'bg-gradient-to-br from-gray-800 to-purple-900 text-white' 
              : 'bg-gradient-to-br from-white to-purple-50 text-gray-900'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${
            darkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Agent Configuration</h2>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {config ? config.name : 'Loading...'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className={`w-8 h-8 border-2 border-t-transparent rounded-full ${
                  darkMode ? 'border-purple-400' : 'border-purple-600'
                }`}
              />
            </div>
          ) : config ? (
            <>
              {/* Tab Navigation */}
              <div className={`flex border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeTab === tab.id
                        ? (darkMode ? 'bg-purple-900/50 text-purple-300 border-b-2 border-purple-400' : 'bg-purple-50 text-purple-700 border-b-2 border-purple-500')
                        : (darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {errors.general && (
                  <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                    darkMode ? 'bg-red-900/20 text-red-400 border border-red-800' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    <AlertCircle className="w-4 h-4" />
                    {errors.general}
                  </div>
                )}

                {activeTab === 'general' && (
                  <div className="space-y-6">
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
                          errors.name 
                            ? 'border-red-500' 
                            : (darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white')
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                      {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
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
                          darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        System Prompt
                      </label>
                      <textarea
                        value={config.systemPrompt}
                        onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                        rows={4}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                        placeholder="Define the agent's personality and behavior..."
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => updateConfig('enabled', e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Agent Enabled
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'model' && (
                  <div className="space-y-6">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Model
                      </label>
                      <select
                        value={config.model}
                        onChange={(e) => updateConfig('model', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      >
                        <option value="gpt-4o">GPT-4o (Recommended)</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                        {errors.temperature && <p className="mt-1 text-sm text-red-500">{errors.temperature}</p>}
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          darkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Max Tokens
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="128000"
                          value={config.maxTokens}
                          onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                          className={`w-full px-3 py-2 rounded-lg border ${
                            errors.maxTokens 
                              ? 'border-red-500' 
                              : (darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white')
                          } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                        />
                        {errors.maxTokens && <p className="mt-1 text-sm text-red-500">{errors.maxTokens}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={config.security.requireApproval}
                        onChange={(e) => updateConfig('security.requireApproval', e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Require approval for sensitive operations
                      </label>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Allowed Domains (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={config.security.allowedDomains.join(', ')}
                        onChange={(e) => updateConfig('security.allowedDomains', e.target.value.split(',').map(d => d.trim()))}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                        placeholder="*, example.com, api.service.com"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'monitoring' && (
                  <div className="space-y-6">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Log Level
                      </label>
                      <select
                        value={config.monitoring.logLevel}
                        onChange={(e) => updateConfig('monitoring.logLevel', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                        } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                      >
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={config.monitoring.metricsEnabled}
                        onChange={(e) => updateConfig('monitoring.metricsEnabled', e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <label className={`text-sm font-medium ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Enable metrics collection
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          darkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Error Rate Alert Threshold (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={config.monitoring.alertThresholds.errorRate * 100}
                          onChange={(e) => updateConfig('monitoring.alertThresholds.errorRate', parseInt(e.target.value) / 100)}
                          className={`w-full px-3 py-2 rounded-lg border ${
                            darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                          } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          darkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Response Time Alert Threshold (ms)
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="30000"
                          step="100"
                          value={config.monitoring.alertThresholds.responseTime}
                          onChange={(e) => updateConfig('monitoring.alertThresholds.responseTime', parseInt(e.target.value))}
                          className={`w-full px-3 py-2 rounded-lg border ${
                            darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'
                          } focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`flex items-center justify-end gap-3 p-6 border-t ${
                darkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <button
                  onClick={onClose}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setConfig(createDefaultConfig())}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Configuration
                </button>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p>Failed to load agent configuration.</p>
              <button
                onClick={loadAgentConfig}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Retry
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AgentConfigModal;