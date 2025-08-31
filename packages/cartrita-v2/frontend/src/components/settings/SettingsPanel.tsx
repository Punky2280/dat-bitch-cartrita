'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Bell,
  Shield,
  Palette,
  Mic,
  Camera,
  Globe,
  Download,
  Upload,
  Trash2,
  Key,
  Database,
  Code,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Plus,
  Minus,
  Check,
  AlertTriangle,
  Info
} from 'lucide-react';
import useAppStore from '@/store';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'profile' | 'preferences' | 'privacy' | 'appearance' | 'audio' | 'tools' | 'data' | 'api';

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { user, preferences, updatePreferences, models, tools } = useAppStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '',
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'audio', label: 'Audio & Video', icon: Mic },
    { id: 'tools', label: 'Tools', icon: Code },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'api', label: 'API Keys', icon: Key },
  ];

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save logic would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      bio: user?.bio || '',
    });
    toast.success('Settings reset to default');
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <button className="absolute -bottom-1 -right-1 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors">
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <div>
          <h3 className="text-lg font-semibold">{user?.name || 'User'}</h3>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
            placeholder="Tell us about yourself..."
          />
        </div>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Chat Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sarcasm Level</p>
              <p className="text-sm text-muted-foreground">How sarcastic should Cartrita be?</p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="1"
                max="10"
                value={preferences?.sarcasmLevel || 5}
                onChange={(e) => updatePreferences({ sarcasmLevel: parseInt(e.target.value) })}
                className="w-24"
              />
              <span className="text-sm font-medium w-8">{preferences?.sarcasmLevel || 5}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Verbosity</p>
              <p className="text-sm text-muted-foreground">Response length preference</p>
            </div>
            <select
              value={preferences?.verbosity || 'normal'}
              onChange={(e) => updatePreferences({ verbosity: e.target.value as any })}
              className="px-3 py-1 border border-input rounded-lg"
            >
              <option value="minimal">Minimal</option>
              <option value="normal">Normal</option>
              <option value="verbose">Verbose</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Humor Style</p>
              <p className="text-sm text-muted-foreground">Preferred humor style</p>
            </div>
            <select
              value={preferences?.humorStyle || 'playful'}
              onChange={(e) => updatePreferences({ humorStyle: e.target.value as any })}
              className="px-3 py-1 border border-input rounded-lg"
            >
              <option value="playful">Playful</option>
              <option value="sarcastic">Sarcastic</option>
              <option value="witty">Witty</option>
              <option value="dry">Dry</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Notifications</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span>Enable notifications</span>
            </div>
            <input
              type="checkbox"
              checked={preferences?.notificationsEnabled || false}
              onChange={(e) => updatePreferences({ notificationsEnabled: e.target.checked })}
              className="rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <span>Voice responses</span>
            </div>
            <input
              type="checkbox"
              checked={preferences?.voiceEnabled || false}
              onChange={(e) => updatePreferences({ voiceEnabled: e.target.checked })}
              className="rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mic className="w-5 h-5 text-muted-foreground" />
              <span>Ambient listening</span>
            </div>
            <input
              type="checkbox"
              checked={preferences?.ambientListening || false}
              onChange={(e) => updatePreferences({ ambientListening: e.target.checked })}
              className="rounded"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'auto', label: 'Auto', icon: Monitor },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => updatePreferences({ theme: value as any })}
              className={cn(
                "p-4 border rounded-lg flex flex-col items-center space-y-2 transition-colors",
                preferences?.theme === value
                  ? "border-primary bg-primary/10"
                  : "border-input hover:border-primary/50"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Language</h3>
        <select
          value={preferences?.languagePreference || 'en'}
          onChange={(e) => updatePreferences({ languagePreference: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-lg"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="it">Italiano</option>
          <option value="pt">Português</option>
        </select>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Timezone</h3>
        <select
          value={preferences?.timezone || 'America/New_York'}
          onChange={(e) => updatePreferences({ timezone: e.target.value })}
          className="w-full px-3 py-2 border border-input rounded-lg"
        >
          <option value="America/New_York">Eastern Time</option>
          <option value="America/Chicago">Central Time</option>
          <option value="America/Denver">Mountain Time</option>
          <option value="America/Los_Angeles">Pacific Time</option>
          <option value="Europe/London">GMT</option>
          <option value="Europe/Paris">CET</option>
          <option value="Asia/Tokyo">JST</option>
        </select>
      </div>
    </div>
  );

  const renderToolsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Available Tools</h3>
        <div className="space-y-3">
          {tools.map((tool) => (
            <div key={tool.id} className="flex items-center justify-between p-3 border border-input rounded-lg">
              <div>
                <p className="font-medium">{tool.name}</p>
                <p className="text-sm text-muted-foreground">{tool.description}</p>
              </div>
              <input
                type="checkbox"
                checked={tool.enabled}
                onChange={() => {
                  // Toggle tool enabled state
                  toast.success(`${tool.name} ${tool.enabled ? 'disabled' : 'enabled'}`);
                }}
                className="rounded"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Python Environment</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span>Enable Python execution</span>
            <input type="checkbox" defaultChecked className="rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span>Sandbox mode</span>
            <input type="checkbox" defaultChecked className="rounded" />
          </div>
          <div className="flex items-center justify-between">
            <span>Allow file operations</span>
            <input type="checkbox" className="rounded" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderDataTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Data Management</h3>
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-3 border border-input rounded-lg hover:bg-accent transition-colors">
            <div className="flex items-center space-x-3">
              <Download className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <p className="font-medium">Export Data</p>
                <p className="text-sm text-muted-foreground">Download all your conversations and data</p>
              </div>
            </div>
          </button>

          <button className="w-full flex items-center justify-between p-3 border border-input rounded-lg hover:bg-accent transition-colors">
            <div className="flex items-center space-x-3">
              <Upload className="w-5 h-5 text-green-500" />
              <div className="text-left">
                <p className="font-medium">Import Data</p>
                <p className="text-sm text-muted-foreground">Import conversations from backup</p>
              </div>
            </div>
          </button>

          <button className="w-full flex items-center justify-between p-3 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-red-600">
            <div className="flex items-center space-x-3">
              <Trash2 className="w-5 h-5" />
              <div className="text-left">
                <p className="font-medium">Clear All Data</p>
                <p className="text-sm text-red-500">Permanently delete all conversations</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Storage</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Conversations: 157 MB</span>
            <span>Attachments: 423 MB</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }} />
          </div>
          <p className="text-xs text-muted-foreground">580 MB of 1 GB used</p>
        </div>
      </div>
    </div>
  );

  const renderApiTab = () => (
    <div className="space-y-6">
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Keep your API keys secure</p>
            <p className="text-sm text-yellow-700">Never share your API keys publicly</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">OpenAI API Key</label>
          <div className="relative">
            <input
              type="password"
              placeholder="sk-..."
              className="w-full px-3 py-2 pr-10 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Anthropic API Key</label>
          <div className="relative">
            <input
              type="password"
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 pr-10 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Google AI API Key</label>
          <div className="relative">
            <input
              type="password"
              placeholder="AI..."
              className="w-full px-3 py-2 pr-10 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'preferences':
        return renderPreferencesTab();
      case 'appearance':
        return renderAppearanceTab();
      case 'tools':
        return renderToolsTab();
      case 'data':
        return renderDataTab();
      case 'api':
        return renderApiTab();
      default:
        return renderPreferencesTab();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-background rounded-xl shadow-2xl border w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold">Settings</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex h-[calc(90vh-200px)]">
              {/* Sidebar */}
              <div className="w-64 border-r bg-accent/50">
                <div className="p-4">
                  <nav className="space-y-1">
                    {tabs.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id as SettingsTab)}
                        className={cn(
                          "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors",
                          activeTab === id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  {renderContent()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-accent/30">
              <button
                onClick={handleReset}
                className="flex items-center space-x-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>

              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors",
                    isLoading
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;