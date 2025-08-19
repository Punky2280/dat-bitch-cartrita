import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'framer-motion';
import { 
  Save, Settings, User, Shield, Bell, Loader2, 
  Monitor, Moon, Sun, Volume2, Database, Key,
  Wifi, Clock, Globe, Palette, Zap, AlertTriangle
} from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
}

const settingsSections: SettingsSection[] = [
  { id: 'profile', title: 'Profile', icon: User, description: 'Personal information and preferences' },
  { id: 'security', title: 'Security', icon: Shield, description: 'Authentication and privacy settings' },
  { id: 'notifications', title: 'Notifications', icon: Bell, description: 'Alerts and communication preferences' },
  { id: 'appearance', title: 'Appearance', icon: Palette, description: 'Theme and display customization' },
  { id: 'system', title: 'System', icon: Monitor, description: 'Performance and system preferences' },
  { id: 'api', title: 'API Keys', icon: Key, description: 'Manage external service integrations' }
];

export const SettingsPage: React.FC = () => {
  const { state, actions, dispatch } = useApp();
  const [activeSection, setActiveSection] = useState('profile');
  const [localSettings, setLocalSettings] = useState(state.settings.data || {});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && !state.settings.loading) {
      actions.loadSettings();
      setInitialized(true);
    }
  }, [initialized, state.settings.loading, actions]);

  useEffect(() => {
    if (state.settings.data) {
      setLocalSettings(state.settings.data);
      setHasChanges(false);
    }
  }, [state.settings.data]);

  const handleChange = (field: string, value: any) => {
    setLocalSettings((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!localSettings || !hasChanges) return;
    
    try {
      setSaving(true);
      await actions.updateSettings(localSettings);
      setHasChanges(false);
      
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: { 
          message: 'Settings saved successfully', 
          type: 'success' 
        } 
      });
    } catch (error) {
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: { 
          message: 'Failed to save settings', 
          type: 'error' 
        } 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(state.settings.data || {});
    setHasChanges(false);
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col space-y-2">
          <label className="text-slate-400 text-sm font-medium">Display Name</label>
          <input
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
            type="text"
            value={localSettings?.displayName || ''}
            onChange={e => handleChange('displayName', e.target.value)}
            placeholder="Your display name"
          />
        </div>
        
        <div className="flex flex-col space-y-2">
          <label className="text-slate-400 text-sm font-medium">Email</label>
          <input
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
            type="email"
            value={localSettings?.email || ''}
            onChange={e => handleChange('email', e.target.value)}
            placeholder="your.email@example.com"
          />
        </div>
      </div>
      
      <div className="flex flex-col space-y-2">
        <label className="text-slate-400 text-sm font-medium">Timezone</label>
        <select
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
          value={localSettings?.timezone || 'UTC'}
          onChange={e => handleChange('timezone', e.target.value)}
        >
          <option value="UTC">UTC</option>
          <option value="America/New_York">Eastern Time</option>
          <option value="America/Chicago">Central Time</option>
          <option value="America/Denver">Mountain Time</option>
          <option value="America/Los_Angeles">Pacific Time</option>
          <option value="Europe/London">London</option>
          <option value="Europe/Paris">Paris</option>
          <option value="Asia/Tokyo">Tokyo</option>
        </select>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
        <div>
          <h4 className="text-white font-medium">Two-Factor Authentication</h4>
          <p className="text-sm text-slate-400">Add an extra layer of security to your account</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!localSettings?.enable2FA}
            onChange={e => handleChange('enable2FA', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
        </label>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
        <div>
          <h4 className="text-white font-medium">Session Timeout</h4>
          <p className="text-sm text-slate-400">Automatically log out after inactivity</p>
        </div>
        <select
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-cyan-400 focus:outline-none"
          value={localSettings?.sessionTimeout || '1h'}
          onChange={e => handleChange('sessionTimeout', e.target.value)}
        >
          <option value="15m">15 minutes</option>
          <option value="30m">30 minutes</option>
          <option value="1h">1 hour</option>
          <option value="4h">4 hours</option>
          <option value="never">Never</option>
        </select>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
        <div>
          <h4 className="text-white font-medium">Data Encryption</h4>
          <p className="text-sm text-slate-400">Encrypt sensitive data at rest</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!localSettings?.dataEncryption}
            onChange={e => handleChange('dataEncryption', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
        </label>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <label className="text-slate-400 text-sm font-medium">Notification Level</label>
        <select
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
          value={String(localSettings?.notifications || 'all')}
          onChange={e => handleChange('notifications', e.target.value)}
        >
          <option value="all">All Notifications</option>
          <option value="important">Important Only</option>
          <option value="mentions">Mentions & Direct Messages</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="space-y-4">
        {[
          { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive notifications via email' },
          { key: 'pushNotifications', label: 'Push Notifications', description: 'Browser push notifications' },
          { key: 'soundNotifications', label: 'Sound Notifications', description: 'Play sounds for notifications' },
          { key: 'agentUpdates', label: 'Agent Updates', description: 'Notifications about agent status changes' },
          { key: 'systemAlerts', label: 'System Alerts', description: 'Critical system and security alerts' }
        ].map(setting => (
          <div key={setting.key} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
            <div>
              <h4 className="text-white font-medium">{setting.label}</h4>
              <p className="text-sm text-slate-400">{setting.description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!localSettings?.[setting.key]}
                onChange={e => handleChange(setting.key, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <label className="text-slate-400 text-sm font-medium">Theme</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'auto', label: 'Auto', icon: Monitor }
          ].map(theme => (
            <button
              key={theme.value}
              onClick={() => handleChange('theme', theme.value)}
              className={`flex flex-col items-center space-y-2 p-4 rounded-lg border-2 transition-colors ${
                localSettings?.theme === theme.value 
                  ? 'border-cyan-400 bg-cyan-400/10' 
                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
              }`}
            >
              <theme.icon className="w-6 h-6 text-slate-300" />
              <span className="text-sm text-white">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col space-y-2">
        <label className="text-slate-400 text-sm font-medium">Accent Color</label>
        <div className="flex space-x-3">
          {[
            { value: 'cyan', class: 'bg-cyan-500' },
            { value: 'blue', class: 'bg-blue-500' },
            { value: 'purple', class: 'bg-purple-500' },
            { value: 'green', class: 'bg-green-500' },
            { value: 'orange', class: 'bg-orange-500' },
            { value: 'red', class: 'bg-red-500' }
          ].map(color => (
            <button
              key={color.value}
              onClick={() => handleChange('accentColor', color.value)}
              className={`w-8 h-8 rounded-full ${color.class} ${
                localSettings?.accentColor === color.value 
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' 
                  : 'hover:scale-110'
              } transition-transform`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
        <div>
          <h4 className="text-white font-medium">Animations</h4>
          <p className="text-sm text-slate-400">Enable UI animations and transitions</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={localSettings?.animations !== false}
            onChange={e => handleChange('animations', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
        </label>
      </div>
    </div>
  );

  const renderSystemSettings = () => (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <label className="text-slate-400 text-sm font-medium">Auto-Save Interval</label>
        <select
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
          value={localSettings?.autoSaveInterval || '5m'}
          onChange={e => handleChange('autoSaveInterval', e.target.value)}
        >
          <option value="1m">1 minute</option>
          <option value="5m">5 minutes</option>
          <option value="10m">10 minutes</option>
          <option value="30m">30 minutes</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="space-y-4">
        {[
          { key: 'enableTelemetry', label: 'Usage Analytics', description: 'Help improve the platform by sharing anonymous usage data' },
          { key: 'enableCaching', label: 'Response Caching', description: 'Cache responses to improve performance' },
          { key: 'enableCompression', label: 'Data Compression', description: 'Compress data to reduce bandwidth usage' },
          { key: 'enableBackups', label: 'Auto Backups', description: 'Automatically backup your data and settings' }
        ].map(setting => (
          <div key={setting.key} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
            <div>
              <h4 className="text-white font-medium">{setting.label}</h4>
              <p className="text-sm text-slate-400">{setting.description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!localSettings?.[setting.key]}
                onChange={e => handleChange(setting.key, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderApiSettings = () => (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-amber-400 font-medium text-sm">Security Notice</h4>
          <p className="text-amber-300/80 text-xs mt-1">
            API keys are stored securely and encrypted. Never share your API keys with others.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {[
          { key: 'openaiKey', label: 'OpenAI API Key', placeholder: 'sk-...' },
          { key: 'deepgramKey', label: 'Deepgram API Key', placeholder: 'Your Deepgram key' },
          { key: 'elevenLabsKey', label: 'ElevenLabs API Key', placeholder: 'Your ElevenLabs key' },
          { key: 'huggingfaceKey', label: 'HuggingFace API Key', placeholder: 'hf_...' }
        ].map(apiKey => (
          <div key={apiKey.key} className="flex flex-col space-y-2">
            <label className="text-slate-400 text-sm font-medium">{apiKey.label}</label>
            <input
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none font-mono text-sm"
              type="password"
              value={localSettings?.[apiKey.key] || ''}
              onChange={e => handleChange(apiKey.key, e.target.value)}
              placeholder={apiKey.placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile': return renderProfileSettings();
      case 'security': return renderSecuritySettings();
      case 'notifications': return renderNotificationSettings();
      case 'appearance': return renderAppearanceSettings();
      case 'system': return renderSystemSettings();
      case 'api': return renderApiSettings();
      default: return renderProfileSettings();
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center space-x-3 mb-6">
        <Settings className="w-8 h-8 text-cyan-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-slate-400">Manage your preferences and system configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">{section.title}</div>
                    <div className="text-xs opacity-70">{section.description}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {state.settings.loading ? (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8">
              <div className="flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            </div>
          ) : (
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
            >
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-2">
                  {settingsSections.find(s => s.id === activeSection)?.title}
                </h2>
                <p className="text-slate-400 text-sm">
                  {settingsSections.find(s => s.id === activeSection)?.description}
                </p>
              </div>

              {renderSectionContent()}

              {/* Action Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-700">
                <button
                  onClick={handleReset}
                  disabled={!hasChanges}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Reset Changes
                </button>
                
                <div className="flex items-center space-x-3">
                  {hasChanges && (
                    <span className="text-sm text-amber-400 flex items-center space-x-1">
                      <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                      <span>Unsaved changes</span>
                    </span>
                  )}
                  
                  <button
                    className="flex items-center space-x-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;