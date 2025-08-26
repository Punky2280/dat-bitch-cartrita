/**
 * Settings Page - Cartrita V2
 * User preferences and system configuration
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CogIcon,
  UserIcon,
  BellIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  GlobeAltIcon,
  ComputerDesktopIcon,
  KeyIcon,
  CloudIcon,
  MoonIcon,
  SunIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/layout/AppLayout';
import { useSettingsStore, useAuthStore } from '@/stores';

interface SettingSection {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTING_SECTIONS: SettingSection[] = [
  {
    id: 'profile',
    name: 'Profile',
    description: 'Personal information and account settings',
    icon: UserIcon
  },
  {
    id: 'appearance',
    name: 'Appearance',
    description: 'Theme, colors, and display preferences',
    icon: PaintBrushIcon
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Email, push, and in-app notification settings',
    icon: BellIcon
  },
  {
    id: 'security',
    name: 'Security & Privacy',
    description: 'Password, 2FA, and privacy settings',
    icon: ShieldCheckIcon
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Third-party services and API connections',
    icon: GlobeAltIcon
  },
  {
    id: 'system',
    name: 'System',
    description: 'Performance, storage, and advanced settings',
    icon: ComputerDesktopIcon
  }
];

const THEMES = [
  { id: 'light', name: 'Light', icon: SunIcon },
  { id: 'dark', name: 'Dark', icon: MoonIcon },
  { id: 'system', name: 'System', icon: ComputerDesktopIcon }
];

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' }
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const {
    settings,
    isLoading,
    error,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings
  } = useSettingsStore();

  const [activeSection, setActiveSection] = useState<string>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Local state for form inputs
  const [formData, setFormData] = useState({
    // Profile
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
    
    // Appearance
    theme: settings?.theme || 'system',
    language: settings?.language || 'en',
    fontSize: settings?.fontSize || 'medium',
    sidebarCollapsed: settings?.sidebarCollapsed || false,
    
    // Notifications
    emailNotifications: settings?.emailNotifications || true,
    pushNotifications: settings?.pushNotifications || true,
    desktopNotifications: settings?.desktopNotifications || true,
    notificationSound: settings?.notificationSound || true,
    
    // Security
    twoFactorEnabled: settings?.twoFactorEnabled || false,
    sessionTimeout: settings?.sessionTimeout || 30,
    loginAlerts: settings?.loginAlerts || true,
    
    // System
    autoSave: settings?.autoSave || true,
    analytics: settings?.analytics || true,
    errorReporting: settings?.errorReporting || true,
    debugMode: settings?.debugMode || false
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings(formData);
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleReset = async () => {
    try {
      await resetSettings();
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl flex items-center justify-center mr-4">
                <CogIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Settings
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Customize your Cartrita experience
                </p>
              </div>
            </div>

            {/* Save/Reset Actions */}
            {unsavedChanges && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CheckIcon className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {/* Unsaved Changes Warning */}
          {unsavedChanges && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  You have unsaved changes. Don't forget to save your settings.
                </span>
              </div>
            </div>
          )}

          {/* Section Navigation */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {SETTING_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex flex-col items-center p-4 rounded-lg text-center transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 border-2 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                    : 'bg-gray-50 border-2 border-transparent text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                <section.icon className="w-6 h-6 mb-2" />
                <span className="text-xs font-medium">{section.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <AnimatePresence mode="wait">
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Profile Settings
                </h2>
                
                <div className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      {formData.avatar ? (
                        <img
                          src={formData.avatar}
                          alt="Avatar"
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-10 h-10 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        Change Avatar
                      </button>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG up to 5MB
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Appearance Section */}
            {activeSection === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Appearance Settings
                </h2>
                
                <div className="space-y-6">
                  {/* Theme Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => handleInputChange('theme', theme.id)}
                          className={`flex items-center justify-center p-4 border-2 rounded-lg transition-colors ${
                            formData.theme === theme.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          <theme.icon className="w-5 h-5 mr-2" />
                          {theme.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Language
                    </label>
                    <select
                      value={formData.language}
                      onChange={(e) => handleInputChange('language', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Size
                    </label>
                    <select
                      value={formData.fontSize}
                      onChange={(e) => handleInputChange('fontSize', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                      <option value="xl">Extra Large</option>
                    </select>
                  </div>

                  {/* UI Preferences */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Interface
                    </h3>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Collapse Sidebar by Default
                        </label>
                        <p className="text-xs text-gray-500">
                          Start with a collapsed sidebar for more screen space
                        </p>
                      </div>
                      <button
                        onClick={() => handleInputChange('sidebarCollapsed', !formData.sidebarCollapsed)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.sidebarCollapsed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.sidebarCollapsed ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Notifications Section */}
            {activeSection === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Notification Settings
                </h2>
                
                <div className="space-y-6">
                  {[
                    { key: 'emailNotifications', name: 'Email Notifications', description: 'Receive notifications via email' },
                    { key: 'pushNotifications', name: 'Push Notifications', description: 'Browser push notifications' },
                    { key: 'desktopNotifications', name: 'Desktop Notifications', description: 'System desktop notifications' },
                    { key: 'notificationSound', name: 'Notification Sound', description: 'Play sound for notifications' }
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {setting.name}
                        </label>
                        <p className="text-xs text-gray-500">
                          {setting.description}
                        </p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setting.key, !formData[setting.key as keyof typeof formData])}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData[setting.key as keyof typeof formData] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData[setting.key as keyof typeof formData] ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Security Section */}
            {activeSection === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Security & Privacy
                </h2>
                
                <div className="space-y-6">
                  {/* Password Change */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Change Password
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? (
                              <EyeSlashIcon className="w-4 h-4" />
                            ) : (
                              <EyeIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            New Password
                          </label>
                          <input
                            type="password"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        Update Password
                      </button>
                    </div>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          Two-Factor Authentication
                        </h3>
                        <p className="text-sm text-gray-500">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <button
                        onClick={() => handleInputChange('twoFactorEnabled', !formData.twoFactorEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Session Settings */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Session Settings
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Session Timeout (minutes)
                        </label>
                        <select
                          value={formData.sessionTimeout}
                          onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={120}>2 hours</option>
                          <option value={480}>8 hours</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Login Alerts
                          </label>
                          <p className="text-xs text-gray-500">
                            Get notified of new login attempts
                          </p>
                        </div>
                        <button
                          onClick={() => handleInputChange('loginAlerts', !formData.loginAlerts)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formData.loginAlerts ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.loginAlerts ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Integrations Section */}
            {activeSection === 'integrations' && (
              <motion.div
                key="integrations"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Integrations
                </h2>
                
                <div className="space-y-6">
                  {/* Connected Services */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Connected Services
                    </h3>
                    <div className="space-y-3">
                      {[
                        { name: 'GitHub', status: 'connected', description: 'Code repository integration' },
                        { name: 'OpenAI', status: 'connected', description: 'AI model provider' },
                        { name: 'Slack', status: 'disconnected', description: 'Team communication' },
                        { name: 'Google Drive', status: 'disconnected', description: 'Cloud storage' }
                      ].map((service) => (
                        <div key={service.name} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {service.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {service.description}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              service.status === 'connected'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            }`}>
                              {service.status}
                            </span>
                            <button className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                              service.status === 'connected'
                                ? 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'
                                : 'text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                            }`}>
                              {service.status === 'connected' ? 'Disconnect' : 'Connect'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Webhooks */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Webhooks
                      </h3>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        Add Webhook
                      </button>
                    </div>
                    
                    <div className="text-center py-8 text-gray-500">
                      No webhooks configured
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* System Section */}
            {activeSection === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  System Settings
                </h2>
                
                <div className="space-y-6">
                  {/* Performance Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Performance
                    </h3>
                    
                    <div className="space-y-4">
                      {[
                        { key: 'autoSave', name: 'Auto-save', description: 'Automatically save changes' },
                        { key: 'analytics', name: 'Usage Analytics', description: 'Help improve Cartrita by sharing usage data' },
                        { key: 'errorReporting', name: 'Error Reporting', description: 'Automatically report errors' },
                        { key: 'debugMode', name: 'Debug Mode', description: 'Enable debug logging (may affect performance)' }
                      ].map((setting) => (
                        <div key={setting.key} className="flex items-center justify-between">
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {setting.name}
                            </label>
                            <p className="text-xs text-gray-500">
                              {setting.description}
                            </p>
                          </div>
                          <button
                            onClick={() => handleInputChange(setting.key, !formData[setting.key as keyof typeof formData])}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              formData[setting.key as keyof typeof formData] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formData[setting.key as keyof typeof formData] ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Data Management */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Data Management
                    </h3>
                    
                    <div className="space-y-3">
                      <button
                        onClick={exportSettings}
                        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <CloudIcon className="w-4 h-4 mr-2" />
                        Export Settings
                      </button>
                      
                      <button
                        onClick={() => document.getElementById('import-settings')?.click()}
                        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <DatabaseIcon className="w-4 h-4 mr-2" />
                        Import Settings
                      </button>
                      <input
                        id="import-settings"
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            importSettings(file);
                          }
                        }}
                        className="hidden"
                      />
                      
                      <button
                        onClick={handleReset}
                        className="w-full flex items-center justify-center px-4 py-3 border-2 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <ArrowPathIcon className="w-4 h-4 mr-2" />
                        Reset to Defaults
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="border-t border-red-200 dark:border-red-800 pt-6">
                    <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
                      Danger Zone
                    </h3>
                    
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-red-800 dark:text-red-300">
                            Delete Account
                          </h4>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Permanently delete your account and all associated data
                          </p>
                        </div>
                        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}