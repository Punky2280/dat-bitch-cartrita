'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircleIcon,
  XMarkIcon,
  PencilIcon,
  ShieldCheckIcon,
  CogIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  KeyIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  BellIcon,
  EyeIcon,
  UserIcon,
  CreditCardIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useUserStore, UserService } from '@/stores/userStore';
import { useNotificationStore } from '@/stores/notificationStore';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'usage' | 'settings'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  
  const {
    user,
    loading,
    updateProfile,
    logout,
    hasPermission,
    canAccessFeature,
    getRemainingApiCalls,
    getUsagePercentage,
  } = useUserStore();
  
  const { addNotification } = useNotificationStore();
  const userService = UserService.getInstance();

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Initialize edit form when user changes
  useEffect(() => {
    if (user) {
      setEditForm({ name: user.name, email: user.email });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) {
      return;
    }

    try {
      await userService.updateProfile({
        name: editForm.name,
        email: editForm.email,
      });

      addNotification({
        title: 'Profile Updated',
        message: 'Your profile information has been successfully updated.',
        type: 'success',
        category: 'user',
        priority: 'medium',
        read: false,
      });

      setIsEditing(false);
    } catch (error) {
      addNotification({
        title: 'Update Failed',
        message: 'Failed to update profile. Please try again.',
        type: 'error',
        category: 'user',
        priority: 'high',
        read: false,
      });
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
    addNotification({
      title: 'Logged Out',
      message: 'You have been successfully logged out.',
      type: 'info',
      category: 'user',
      priority: 'low',
      read: false,
    });
  };

  if (!user) {
    return null;
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'usage', name: 'Usage', icon: ChartBarIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon },
  ] as const;

  const getSubscriptionBadgeColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'pro':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <UserCircleIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      User Profile
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Manage your account and preferences
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex">
              {/* Sidebar Navigation */}
              <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <nav className="p-4 space-y-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <tab.icon className="w-5 h-5" />
                      <span>{tab.name}</span>
                    </button>
                  ))}
                </nav>

                {/* User Summary */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Subscription
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSubscriptionBadgeColor(user.subscription.plan)}`}>
                        {user.subscription.plan.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">API Calls</span>
                        <span className="text-gray-900 dark:text-white">
                          {getRemainingApiCalls().toLocaleString()} left
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: `${getUsagePercentage()}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 p-6 overflow-y-auto max-h-[calc(90vh-5rem)]">
                {activeTab === 'profile' && (
                  <ProfileTab
                    user={user}
                    isEditing={isEditing}
                    editForm={editForm}
                    loading={loading}
                    onEdit={() => setIsEditing(true)}
                    onCancel={() => {
                      setIsEditing(false);
                      setEditForm({ name: user.name, email: user.email });
                    }}
                    onSave={handleSaveProfile}
                    onChange={setEditForm}
                    formatDate={formatDate}
                  />
                )}

                {activeTab === 'security' && (
                  <SecurityTab user={user} formatDate={formatDate} />
                )}

                {activeTab === 'usage' && (
                  <UsageTab 
                    user={user} 
                    getRemainingApiCalls={getRemainingApiCalls}
                    getUsagePercentage={getUsagePercentage}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsTab user={user} updateProfile={updateProfile} />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Last active: {formatDate(user.usage.lastActive)}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Profile Tab Component
function ProfileTab({ user, isEditing, editForm, loading, onEdit, onCancel, onSave, onChange, formatDate }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Profile Information
        </h3>
        {!isEditing && (
          <button
            onClick={onEdit}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            <span>Edit</span>
          </button>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => onChange({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{user.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            {isEditing ? (
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => onChange({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{user.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
              {user.role.toUpperCase()}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              User ID
            </label>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-mono">
              {user.id}
            </p>
          </div>
        </div>

        {isEditing && (
          <div className="mt-6 flex items-center space-x-4">
            <button
              onClick={onSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Security Tab Component
function SecurityTab({ user, formatDate }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Security Settings
      </h3>

      {/* Two-Factor Authentication */}
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <DevicePhoneMobileIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Two-Factor Authentication
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {user.security.twoFactorEnabled ? (
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Enabled</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
                <ExclamationTriangleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Disabled</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <KeyIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Password
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last changed: {formatDate(user.security.lastPasswordChange)}
              </p>
            </div>
          </div>
          <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
            Change Password
          </button>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <GlobeAltIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Active Sessions
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user.security.activeSessions} active sessions
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {user.security.loginHistory.slice(0, 3).map((login: any) => (
            <div key={login.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {login.device}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {login.location} • {formatDate(login.timestamp)}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Usage Tab Component
function UsageTab({ user, getRemainingApiCalls, getUsagePercentage }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Usage Statistics
      </h3>

      {/* Current Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">API CALLS</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {user.usage.apiCalls.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {getRemainingApiCalls().toLocaleString()} remaining
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <UserCircleIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">AGENTS</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {user.usage.agentsCreated}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Created
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">TOKENS</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {(user.usage.tokensUsed / 1000).toFixed(1)}k
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Processed
          </div>
        </div>
      </div>

      {/* Usage Chart Placeholder */}
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Usage Over Time
        </h4>
        <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <ChartBarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Usage analytics coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({ user, updateProfile }: any) {
  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateProfile({
      preferences: {
        ...user.preferences,
        theme,
      },
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Preferences
      </h3>

      {/* Theme Settings */}
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <EyeIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Theme
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Choose your preferred theme
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {['light', 'dark', 'system'].map((theme) => (
            <button
              key={theme}
              onClick={() => handleThemeChange(theme as any)}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                user.preferences.theme === theme
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <BellIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your notification preferences
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          {Object.entries(user.preferences.notifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                {key} notifications
              </span>
              <button
                onClick={() => {
                  updateProfile({
                    preferences: {
                      ...user.preferences,
                      notifications: {
                        ...user.preferences.notifications,
                        [key]: !value,
                      },
                    },
                  });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}